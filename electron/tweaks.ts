import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { HistoryEntry, OperationResult, TweakState } from '../shared/types';
import { PROFILE_DEFINITIONS, type ProfileSelection, type ProfileStatus, type ProfilePreview } from '../shared/profiles';
import { TWEAK_CATALOG, TWEAKS_BY_ID, type RegistryTweak } from './tweak-catalog';

export type RegistryValue = { kind: 'absent' } | { kind: 'dword'; value: number } | { kind: 'unsupported'; type: string };
export interface RegistryAdapter {
  readonly supported: boolean;
  read(tweak: RegistryTweak): Promise<RegistryValue>;
  write(tweak: RegistryTweak, value: Exclude<RegistryValue, { kind: 'unsupported' }>): Promise<void>;
}
type Snapshot = Exclude<RegistryValue, { kind: 'unsupported' }>;
interface RecordEntry { entry: HistoryEntry; original: Snapshot; intent: 'apply' | 'revert'; profileManaged?: boolean; }
interface Journal { version: 1; records: RecordEntry[]; profile?: ProfileSelection | null; customIds?: string[] }
interface ServiceOptions { adapter?: RegistryAdapter; now?: () => Date }
const execute = promisify(execFile);
const MAX_RECORDS = 10_000;
const MAX_JOURNAL_BYTES = 8 * 1024 * 1024;
const same = (a: RegistryValue, b: RegistryValue): boolean => a.kind === b.kind && (a.kind !== 'dword' || (b.kind === 'dword' && a.value === b.value));
const readableError = (error: unknown): string => error instanceof Error ? error.message.slice(0, 400) : 'Windows could not complete the operation.';
const desired = (tweak: RegistryTweak): Snapshot => ({ kind: 'dword', value: tweak.desiredValue });
const psLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** PowerShell receives only fixed catalog targets, never renderer strings or arbitrary scripts. */
export function createWindowsRegistryAdapter(): RegistryAdapter {
  const supported = process.platform === 'win32' && Number(os.release().split('.')[0]) >= 10;
  const powershell = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  async function run(tweak: RegistryTweak, value?: Snapshot): Promise<RegistryValue> {
    if (!supported) throw new Error('Windows preferences are unavailable on this platform.');
    if (TWEAKS_BY_ID.get(tweak.id) !== tweak) throw new Error('Preference target is not allowlisted.');
    if (value && !isSnapshot(value)) throw new Error('Invalid DWORD snapshot.');
    const key = psLiteral(tweak.key), name = psLiteral(tweak.valueName);
    const operation = value
      ? value.kind === 'absent'
        ? `$key=$hive.OpenSubKey(${key},$true); if($null -ne $key){$key.DeleteValue(${name},$false)}; @{kind='absent'} | ConvertTo-Json -Compress`
        : `$key=$hive.CreateSubKey(${key},$true); $number=[BitConverter]::ToInt32([BitConverter]::GetBytes([uint32]${value.value}),0); $key.SetValue(${name},$number,[Microsoft.Win32.RegistryValueKind]::DWord); @{kind='dword';value=[uint32]${value.value}} | ConvertTo-Json -Compress`
      : `$key=$hive.OpenSubKey(${key},$false); if($null -eq $key){ @{kind='unsupported';type='Missing preference key on this Windows installation'} | ConvertTo-Json -Compress } elseif(-not ($key.GetValueNames() -contains ${name})){ ${tweak.requireExistingValue ? "@{kind='unsupported';type='Missing optional preference on this Windows installation'}" : "@{kind='absent'}"} | ConvertTo-Json -Compress } else { $kind=$key.GetValueKind(${name}); if($kind -ne [Microsoft.Win32.RegistryValueKind]::DWord){ @{kind='unsupported';type=$kind.ToString()} | ConvertTo-Json -Compress } else { $raw=[int]$key.GetValue(${name}); @{kind='dword';value=[BitConverter]::ToUInt32([BitConverter]::GetBytes($raw),0)} | ConvertTo-Json -Compress } }`;
    // Explicit Registry64 view avoids 32-bit redirection. HKCU needs no UAC. No encoded commands or policy bypass.
    const script = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); $key=$null; $hive=$null; try { $hive=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64); ${operation} } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 } finally { if($null -ne $key){$key.Dispose()}; if($null -ne $hive){$hive.Dispose()} }`;
    let stdout: string;
    try {
      ({ stdout } = await execute(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15_000, maxBuffer: 64 * 1024, encoding: 'utf8' }));
    } catch (error) {
      const stderr = typeof (error as { stderr?: unknown }).stderr === 'string' ? (error as { stderr: string }).stderr.trim() : '';
      // execFile's default message contains command text; expose only the bounded Windows failure.
      throw new Error(stderr ? `Windows registry operation failed: ${stderr.slice(0, 300)}` : 'Windows registry access failed or timed out; no successful change was assumed.');
    }
    const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
    if (!isRegistryValue(result)) throw new Error('Windows returned an invalid registry response.');
    return result;
  }
  return { supported, read: tweak => run(tweak), write: async (tweak, value) => { await run(tweak, value); } };
}

function isRegistryValue(value: unknown): value is RegistryValue {
  if (!value || typeof value !== 'object') return false;
  const v = value as RegistryValue;
  return v.kind === 'absent' || (v.kind === 'unsupported' && typeof v.type === 'string') || (v.kind === 'dword' && Number.isInteger(v.value) && v.value >= 0 && v.value <= 0xffffffff);
}

function isSnapshot(value: unknown): value is Snapshot {
  return isRegistryValue(value) && value.kind !== 'unsupported';
}

function parseJournal(raw: string): Journal {
  const journal = JSON.parse(raw) as Journal;
  if (journal?.version !== 1 || !Array.isArray(journal.records) || journal.records.length > MAX_RECORDS) throw new Error('Invalid backup journal format.');
  if (journal.profile != null && (!PROFILE_DEFINITIONS.some(p => p.id === journal.profile!.id) || !Array.isArray(journal.profile.ids) || journal.profile.ids.length > TWEAK_CATALOG.length || journal.profile.ids.some(id => !TWEAKS_BY_ID.has(id)) || new Set(journal.profile.ids).size !== journal.profile.ids.length)) throw new Error('Invalid saved profile; backup preserved.');
  if (journal.customIds !== undefined && (!Array.isArray(journal.customIds) || journal.customIds.length > TWEAK_CATALOG.length || journal.customIds.some(id => !TWEAKS_BY_ID.has(id)) || new Set(journal.customIds).size !== journal.customIds.length)) throw new Error('Invalid saved custom profile; backup preserved.');
  const ids = new Set<string>();
  for (const record of journal.records) {
    const e = record?.entry, tweak = TWEAKS_BY_ID.get(e?.tweakId);
    if (!e || !tweak || typeof e.id !== 'string' || ids.has(e.id) || !/^[a-zA-Z0-9-]{1,80}$/.test(e.id) ||
        typeof e.title !== 'string' || typeof e.timestamp !== 'string' || Number.isNaN(Date.parse(e.timestamp)) || typeof e.message !== 'string' ||
        !['pending', 'applied', 'reverted', 'failed', 'conflict'].includes(e.status) || !['apply', 'revert'].includes(record.intent) || (record.profileManaged !== undefined && typeof record.profileManaged !== 'boolean') ||
        e.appliedValue !== tweak.desiredValue || !isSnapshot(record.original) ||
        e.originalValue !== (record.original.kind === 'dword' ? record.original.value : null)) throw new Error('Backup journal failed validation; it will not be overwritten.');
    ids.add(e.id);
  }
  // Multiple unreverted snapshots for a setting are ambiguous; never guess which one to restore.
  const active = new Set<string>();
  for (const record of journal.records) if (['pending', 'applied', 'conflict'].includes(record.entry.status)) {
    if (active.has(record.entry.tweakId)) throw new Error('Conflicting snapshots exist; automatic changes are disabled.');
    active.add(record.entry.tweakId);
  }
  return journal;
}

export function createTweakService(dataDir: string, options: ServiceOptions = {}) {
  const adapter = options.adapter ?? createWindowsRegistryAdapter();
  const now = options.now ?? (() => new Date());
  const directory = path.join(path.resolve(dataDir), 'backups');
  const journalPath = path.join(directory, 'tweaks-v1.json');
  let journal: Journal = { version: 1, records: [] };
  let initialized = false;
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  };

  async function persist(): Promise<void> {
    const temporary = path.join(directory, `.tweaks-${randomUUID()}.tmp`);
    try {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(journal, null, 2), 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(temporary, journalPath);
      // The Windows directory inherits the current user's app-data ACL. fsync directory is not portable there.
      if (process.platform !== 'win32') {
        const dirHandle = await fs.open(directory, 'r');
        try { await dirHandle.sync(); } finally { await dirHandle.close(); }
      }
    } catch (error) {
      // The rename may have completed before a later sync failed. Reload the durable
      // journal before another operation instead of trusting potentially divergent memory.
      initialized = false;
      await fs.unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async function initialize(): Promise<void> {
    if (initialized) return;
    try {
      const info = await fs.lstat(journalPath);
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_JOURNAL_BYTES) throw new Error('Backup journal is not a safe regular file.');
      journal = parseJournal(await fs.readFile(journalPath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Cannot safely load backups: ${readableError(error)}`);
    }
    if (adapter.supported) {
      let recovered = false;
      for (const record of journal.records.filter(r => r.entry.status === 'pending')) {
        const tweak = TWEAKS_BY_ID.get(record.entry.tweakId)!;
        try {
          const current = await adapter.read(tweak);
          if (same(current, record.original)) {
            record.entry.status = record.intent === 'revert' ? 'reverted' : 'failed';
            record.entry.message = 'Recovered interrupted operation: the original preference is present.';
          } else if (same(current, desired(tweak))) {
            record.entry.status = 'applied';
            record.entry.message = 'Recovered interrupted operation: the PANDORA value was verified; the original backup remains available.';
          } else {
            record.entry.status = 'conflict';
            record.entry.message = 'Interrupted operation found a different current value. Nothing was overwritten; backup retained.';
          }
        } catch (error) {
          record.entry.status = 'conflict';
          record.entry.message = `Interrupted operation could not be verified. Backup retained. ${readableError(error)}`;
        }
        recovered = true;
      }
      if (recovered) await persist();
    }
    initialized = true;
  }

  function activeRecord(id: string): RecordEntry | undefined {
    for (let index = journal.records.length - 1; index >= 0; index--) {
      const record = journal.records[index];
      if (record.entry.tweakId === id && ['pending', 'applied', 'conflict'].includes(record.entry.status)) return record;
    }
    return undefined;
  }

  function validateIds(ids: string[]): string[] {
    if (!Array.isArray(ids) || ids.length > TWEAK_CATALOG.length || ids.some(id => typeof id !== 'string' || id.length > 80)) throw new Error('Select a valid, bounded list of preference IDs.');
    return [...new Set(ids)];
  }

  async function recoverFailure(record: RecordEntry, tweak: RegistryTweak, error: unknown, reverting: boolean): Promise<OperationResult> {
    const failure = readableError(error);
    try {
      const current = await adapter.read(tweak);
      if (same(current, record.original)) {
        record.entry.status = reverting ? 'reverted' : 'failed';
        record.entry.message = `${failure} Original preference verified; no change remains.`;
      } else if (same(current, desired(tweak))) {
        if (reverting) {
          record.entry.status = 'applied';
          record.entry.message = `${failure} Revert did not complete; backup retained and you can retry.`;
        } else {
          await adapter.write(tweak, record.original);
          if (!same(await adapter.read(tweak), record.original)) throw new Error('Rollback could not be verified.');
          record.entry.status = 'failed';
          record.entry.message = `${failure} The original preference was restored and verified.`;
        }
      } else {
        record.entry.status = 'conflict';
        record.entry.message = `${failure} The preference changed unexpectedly. Nothing further was overwritten; backup retained.`;
      }
    } catch (rollbackError) {
      record.entry.status = 'conflict';
      record.entry.message = `${failure} Recovery needs attention: ${readableError(rollbackError)} Backup retained.`;
    }
    try { await persist(); }
    catch { initialized = false; return { id: tweak.id, success: false, message: `${record.entry.message} Could not update the journal; the last durable snapshot is retained. Close PANDORA and check available disk space.` }; }
    return { id: tweak.id, success: false, message: record.entry.message };
  }

  async function applyOne(tweak: RegistryTweak, profileManaged = false, reviewed?: Snapshot): Promise<OperationResult> {
    const existing = activeRecord(tweak.id);
    const current = await adapter.read(tweak);
    if (reviewed && !same(current, reviewed)) return { id: tweak.id, success: false, message: 'The preference changed after review. No write was performed; review the profile again.' };
    if (existing) {
      if (existing.entry.status === 'applied' && same(current, desired(tweak))) return { id: tweak.id, success: true, message: 'Already applied and verified; original backup preserved.' };
      return { id: tweak.id, success: false, message: 'A previous managed change requires review or revert before applying again. No setting was overwritten.' };
    }
    if (current.kind === 'unsupported') return { id: tweak.id, success: false, message: `Expected a DWORD preference, found ${current.type}. No change made.` };
    if (same(current, desired(tweak))) return { id: tweak.id, success: true, message: 'Already set outside PANDORA; no ownership or backup was claimed.' };
    if (journal.records.length >= MAX_RECORDS) throw new Error('The backup journal is full. Export and archive it before making further changes.');
    const record: RecordEntry = {
      original: { ...current }, intent: 'apply', profileManaged, entry: {
        id: randomUUID(), tweakId: tweak.id, title: tweak.title, timestamp: now().toISOString(), status: 'pending',
        originalValue: current.kind === 'dword' ? current.value : null, appliedValue: tweak.desiredValue,
        message: 'Original preference saved before applying the change.',
      },
    };
    journal.records.push(record);
    try { await persist(); }
    catch (error) { journal.records.pop(); throw new Error(`Backup could not be saved. No Windows setting was changed. ${readableError(error)}`); }
    // No recovery write is allowed before we have attempted our own write. In particular,
    // a concurrent external edit matching our desired value must never become ours to undo.
    try {
      if (!same(await adapter.read(tweak), record.original)) throw new Error('The preference changed after backup. No write was performed.');
    } catch (error) {
      record.entry.status = 'failed'; record.entry.message = `${readableError(error)} Original snapshot retained for audit only.`;
      await persist(); return { id: tweak.id, success: false, message: record.entry.message };
    }
    try {
      await adapter.write(tweak, desired(tweak));
      if (!same(await adapter.read(tweak), desired(tweak))) throw new Error('Windows did not retain the requested value.');
      record.entry.status = 'applied'; record.entry.message = 'Applied and verified. The exact original preference is available for restoration.';
      await persist();
      return { id: tweak.id, success: true, message: record.entry.message };
    } catch (error) { return recoverFailure(record, tweak, error, false); }
  }

  async function revertOne(tweak: RegistryTweak): Promise<OperationResult> {
    const record = activeRecord(tweak.id);
    if (!record) return { id: tweak.id, success: true, message: 'No PANDORA-managed change to restore. Nothing was changed.' };
    const current = await adapter.read(tweak);
    if (same(current, record.original)) {
      record.entry.status = 'reverted'; record.entry.message = 'The original preference was already restored; verified without writing.';
      await persist(); return { id: tweak.id, success: true, message: record.entry.message };
    }
    if (!same(current, desired(tweak))) {
      record.entry.status = 'conflict'; record.entry.message = 'The preference was changed outside PANDORA. Revert refused to preserve that change; original backup retained.';
      await persist(); return { id: tweak.id, success: false, message: record.entry.message };
    }
    record.intent = 'revert'; record.entry.status = 'pending'; record.entry.message = 'Restoring the saved original preference.';
    await persist();
    try {
      if (!same(await adapter.read(tweak), desired(tweak))) throw new Error('The preference changed immediately before restoration.');
      await adapter.write(tweak, record.original);
      if (!same(await adapter.read(tweak), record.original)) throw new Error('Restoration could not be verified.');
      record.entry.status = 'reverted'; record.entry.message = record.original.kind === 'absent' ? 'Restored and verified: the value did not originally exist and has been removed.' : 'Restored and verified the exact original DWORD value.';
      await persist(); return { id: tweak.id, success: true, message: record.entry.message };
    } catch (error) { return recoverFailure(record, tweak, error, true); }
  }

  async function mutate(ids: string[], mode: 'apply' | 'revert'): Promise<OperationResult[]> {
    const validIds = validateIds(ids);
    await initialize();
    const results: OperationResult[] = [];
    for (const id of validIds) {
      const tweak = TWEAKS_BY_ID.get(id);
      if (!tweak) { results.push({ id, success: false, message: 'Unknown preference. No action was taken.' }); continue; }
      if (!adapter.supported) { results.push({ id, success: false, message: 'Windows preferences are unavailable on this platform.' }); continue; }
      try { results.push(await (mode === 'apply' ? applyOne(tweak) : revertOne(tweak))); }
      catch (error) { results.push({ id, success: false, message: readableError(error) }); }
      // Never execute another item using potentially stale state after a persistence failure.
      if (!initialized) {
        for (const remaining of validIds.slice(results.length)) results.push({ id: remaining, success: false, message: 'Not attempted because the backup journal needs to be reloaded after a persistence failure.' });
        break;
      }
    }
    return results;
  }

  async function readTweaks(): Promise<TweakState[]> {
      await initialize();
      return Promise.all(TWEAK_CATALOG.map(async tweak => {
        const { key: _key, valueName: _name, requireExistingValue: _existing, ...definition } = tweak;
        const record = activeRecord(tweak.id);
        if (!adapter.supported) return { ...definition, state: 'unsupported' as const, managed: false, currentValue: null, reason: 'Requires the Windows desktop application.' };
        try {
          const current = await adapter.read(tweak);
          const currentValue = current.kind === 'dword' ? current.value : null;
          if (record) {
            const applied = record.entry.status === 'applied' && same(current, desired(tweak));
            return { ...definition, state: applied ? 'applied' as const : 'conflict' as const, managed: true, currentValue, reason: applied ? undefined : 'A managed backup exists, but current state needs review. Revert will preserve external changes.' };
          }
          if (current.kind === 'unsupported') return { ...definition, state: 'unsupported' as const, managed: false, currentValue, reason: `The preference is ${current.type}, not a DWORD; no change is offered.` };
          return { ...definition, state: same(current, desired(tweak)) ? 'already-set' as const : 'available' as const, managed: false, currentValue, reason: current.kind === 'absent' ? 'No explicit value is set. Windows uses its default; PANDORA will restore the absence on revert.' : undefined };
        } catch (error) { return { ...definition, state: 'unknown' as const, managed: Boolean(record), currentValue: null, reason: readableError(error) }; }
      }));
  }
  let preview: { value: ProfilePreview; fingerprint: string; expires: number } | null = null;
  function selectionFor(id: unknown, customIds: unknown): ProfileSelection | null {
    if (id === null) return null;
    const definition = PROFILE_DEFINITIONS.find(p => p.id === id);
    if (!definition) throw new Error('Unknown profile.');
    const ids = definition.id === 'custom' ? validateIds(customIds as string[]) : [...definition.ids];
    if (ids.some(tweakId => !TWEAKS_BY_ID.has(tweakId))) throw new Error('Custom profiles can use only catalog preferences.');
    return { id: definition.id, ids };
  }
  async function makePreview(selection: ProfileSelection | null): Promise<Omit<ProfilePreview, 'token'>> {
    const states = await readTweaks();
    const requested = new Set(selection?.ids ?? []);
    const changes: ProfilePreview['changes'] = [];
    for (const state of states) {
      const record = activeRecord(state.id);
      if (record?.profileManaged && !requested.has(state.id)) {
        let canRestore = state.state === 'applied';
        if (!canRestore) { try { canRestore = same(await adapter.read(TWEAKS_BY_ID.get(state.id)!), record.original); } catch { /* preserve unreadable state */ } }
        changes.push({ id: state.id, title: state.title, action: canRestore ? 'restore' : 'conflict', reason: canRestore ? 'Restore the exact original saved by the previous profile.' : 'A previous profile setting changed or cannot be read. Resolve it before switching.', target: state.target, from: state.currentValue, to: record.entry.originalValue, restart: state.restart });
      } else if (requested.has(state.id)) {
        const action = state.state === 'available' ? 'apply' : ['applied', 'already-set'].includes(state.state) ? 'keep' : state.managed ? 'conflict' : 'skip';
        changes.push({ id: state.id, title: state.title, action, reason: action === 'apply' ? state.tradeoff : action === 'keep' ? record?.profileManaged ? 'Keep the existing profile change and its original backup.' : 'Already configured; preserve manual ownership and any existing backup.' : state.reason ?? 'Unavailable on this PC; no change will be attempted.', target: state.target, from: state.currentValue, to: state.desiredValue, restart: state.restart });
      }
    }
    return { selection, changes, blocked: changes.some(c => c.action === 'conflict') };
  }
  async function getProfile(): Promise<ProfileStatus> {
    const states = await readTweaks();
    const ownedIds = states.filter(t => activeRecord(t.id)?.profileManaged).map(t => t.id);
    const selection = journal.profile ?? null;
    const complete = selection ? selection.ids.every(id => states.some(t => t.id === id && ['applied', 'already-set'].includes(t.state))) && ownedIds.every(id => selection.ids.includes(id)) : ownedIds.length === 0;
    return { selection: selection ? { ...selection, ids: [...selection.ids] } : null, ownedIds, customIds: [...(journal.customIds ?? [])], complete };
  }
  async function previewProfile(id: unknown, customIds?: unknown): Promise<ProfilePreview> {
    await initialize();
    const value = { ...await makePreview(selectionFor(id, customIds)), token: randomUUID() };
    preview = { value, fingerprint: JSON.stringify({ ...value, token: '', previous: journal.profile ?? null }), expires: now().getTime() + 5 * 60_000 };
    return structuredClone(value);
  }
  async function applyProfile(token: unknown): Promise<OperationResult[]> {
    await initialize();
    const approved = preview; preview = null;
    if (!approved || typeof token !== 'string' || token !== approved.value.token || now().getTime() > approved.expires) throw new Error('This profile review expired. Review again before applying.');
    const fresh = await makePreview(approved.value.selection);
    if (fresh.blocked || JSON.stringify({ ...fresh, token: '', previous: journal.profile ?? null }) !== approved.fingerprint) throw new Error('Preference state changed since your review, or a conflict remains. Review again; no changes were made.');
    journal.profile = fresh.selection;
    if (fresh.selection?.id === 'custom') journal.customIds = [...fresh.selection.ids];
    await persist(); // Record the requested profile before its first individual backup/write.
    const results: OperationResult[] = [];
    for (const change of fresh.changes.filter(c => c.action === 'restore')) {
      try { results.push(await revertOne(TWEAKS_BY_ID.get(change.id)!)); }
      catch (error) { results.push({ id: change.id, success: false, message: readableError(error) }); }
      if (!initialized || !results.at(-1)!.success) return [...results, { id: 'profile', success: false, message: 'Profile switch stopped before new changes because a previous setting could not be restored. Original backups remain in Restore & History.' }];
    }
    for (const change of fresh.changes.filter(c => c.action !== 'restore')) {
      if (!initialized) { results.push({ id: change.id, success: false, message: 'Not attempted because the backup journal needs review.' }); continue; }
      if (change.action === 'apply') {
        try { results.push(await applyOne(TWEAKS_BY_ID.get(change.id)!, true, change.from === null ? { kind: 'absent' } : { kind: 'dword', value: change.from })); }
        catch (error) { results.push({ id: change.id, success: false, message: readableError(error) }); }
      } else results.push({ id: change.id, success: change.action === 'keep', message: change.reason });
    }
    return results.length ? results : [{ id: 'profile', success: true, message: 'Profile selection saved. No Windows preferences needed changing.' }];
  }
  return {
    getTweaks: () => serialized(readTweaks),
    getProfile: () => serialized(getProfile),
    previewProfile: (id: unknown, customIds?: unknown) => serialized(() => previewProfile(id, customIds)),
    applyProfile: (token: unknown) => serialized(() => applyProfile(token)),
    applyTweaks: (ids: string[]) => serialized(() => mutate(ids, 'apply')),
    revertTweaks: (ids: string[]) => serialized(() => mutate(ids, 'revert')),
    getHistory: (): Promise<HistoryEntry[]> => serialized(async () => { await initialize(); return journal.records.map(record => ({ ...record.entry })).reverse(); }),
  };
}
