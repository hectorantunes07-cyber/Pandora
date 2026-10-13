import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readSmallJson, writeDurableJson } from './durable-store';
import type { OperationResult, StartupControl } from '../shared/types';
export const STARTUP_APPS = [{ id: 'discord', name: 'Discord', value: 'Discord' }, { id: 'steam', name: 'Steam', value: 'Steam' }, { id: 'epic', name: 'Epic Games Launcher', value: 'EpicGamesLauncher' }, { id: 'spotify', name: 'Spotify', value: 'Spotify' }] as const;
const APPS = STARTUP_APPS;
type App = typeof APPS[number];
export type StartupValue = { kind: 'absent' } | { kind: 'String' | 'ExpandString'; text: string };
export interface StartupAdapter { supported: boolean; read(app: App): Promise<StartupValue>; write(app: App, value: StartupValue): Promise<void>; }
interface Backup { id: string; original: StartupValue & { text: string }; status: 'pending' | 'disabled' | 'restored' | 'conflict' | 'failed'; timestamp: string; }
const isValue = (v: unknown): v is StartupValue => Boolean(v && typeof v === 'object' && ((v as StartupValue).kind === 'absent' || (['String', 'ExpandString'].includes((v as StartupValue).kind) && typeof (v as { text: unknown }).text === 'string' && (v as { text: string }).text.length <= 4096 && !(v as { text: string }).text.includes('\0'))));
const same = (a: StartupValue, b: StartupValue) => a.kind === b.kind && (a.kind === 'absent' || (b.kind !== 'absent' && a.text === b.text));
const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;
const execute = promisify(execFile);
export function createWindowsStartupAdapter(): StartupAdapter {
  const supported = process.platform === 'win32';
  async function run(app: App, value?: StartupValue): Promise<StartupValue> {
    if (!supported || !APPS.includes(app)) throw new Error('This startup target is unavailable.');
    if (value && !isValue(value)) throw new Error('Invalid startup snapshot.');
    const name = literal(app.value);
    const operation = !value
      ? `if($null -eq $key -or -not ($key.GetValueNames() -contains ${name})){ @{kind='absent'} | ConvertTo-Json -Compress } else { $kind=$key.GetValueKind(${name}).ToString(); if($kind -notin @('String','ExpandString')){ throw 'Unsupported startup value type.' }; @{kind=$kind;text=[string]$key.GetValue(${name},$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)} | ConvertTo-Json -Compress }`
      : value.kind === 'absent'
        ? `if($null -ne $key){$key.DeleteValue(${name},$false)}; @{kind='absent'} | ConvertTo-Json -Compress`
        : `if($null -eq $key){throw 'The startup registry key no longer exists.'}; $key.SetValue(${name},${literal(value.text)},[Microsoft.Win32.RegistryValueKind]::${value.kind}); @{kind='${value.kind}';text=${literal(value.text)}} | ConvertTo-Json -Compress`;
    // Only these four named HKCU Run values; no StartupApproved byte hacks, HKLM,
    // services, scheduled tasks, command execution or renderer-controlled paths.
    const script = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); $hive=$null;$key=$null;try{$hive=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64);$key=$hive.OpenSubKey('Software\\Microsoft\\Windows\\CurrentVersion\\Run',$${value ? 'true' : 'false'});${operation}}finally{if($null -ne $key){$key.Dispose()};if($null -ne $hive){$hive.Dispose()}}`;
    try {
      const { stdout } = await execute(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15_000, maxBuffer: 128 * 1024, encoding: 'utf8' });
      const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
      if (!isValue(result)) throw new Error('Invalid response');
      return result;
    } catch { throw new Error('The startup entry could not be read or changed. Windows policy, permissions, an unsupported value or a timeout may prevent this operation.'); }
  }
  return { supported, read: app => run(app), write: async (app, value) => { await run(app, value); } };
}
export function createStartupService(directory: string, adapter = createWindowsStartupAdapter()) {
  const file = path.join(directory, 'backups', 'startup-v1.json');
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => { const r = queue.then(fn, fn); queue = r.catch(() => undefined); return r; };
  async function load(): Promise<Backup[]> {
    const raw = await readSmallJson(file);
    if (raw === undefined) return [];
    const j = raw as { version: number; records: Backup[] };
    if (j?.version !== 1 || !Array.isArray(j.records) || j.records.length > APPS.length || new Set(j.records.map(r => r?.id)).size !== j.records.length || j.records.some(r => !r || !APPS.some(a => a.id === r.id) || !isValue(r.original) || r.original.kind === 'absent' || !['pending', 'disabled', 'restored', 'conflict', 'failed'].includes(r.status) || typeof r.timestamp !== 'string' || !Number.isFinite(Date.parse(r.timestamp)))) throw new Error('The startup backup is invalid. It has been preserved; no changes are allowed.');
    return j.records;
  }
  const active = (r?: Backup) => r && ['pending', 'disabled', 'conflict'].includes(r.status);
  const save = (records: Backup[]) => writeDurableJson(file, { version: 1, records });
  // A short-lived opaque review ties an operation to the exact kind/string shown.
  const reviews = new Map<string, { id: string; value: StartupValue; expires: number }>();
  async function getControls(): Promise<StartupControl[]> {
    const records = await load(); reviews.clear();
    return Promise.all(APPS.map(async app => {
      const record = records.find(r => r.id === app.id);
      try {
        if (!adapter.supported) throw new Error('Startup controls require the Windows app.');
        const current = await adapter.read(app);
        const { randomUUID } = await import('node:crypto'); const token = randomUUID();
        reviews.set(token, { id: app.id, value: current, expires: Date.now() + 5 * 60_000 });
        const managed = Boolean(active(record));
        return { id: app.id, name: app.name, current: current.kind === 'absent' ? null : current.text, original: record?.original.text ?? null, managed, status: managed ? current.kind === 'absent' ? 'disabled' : same(current, record!.original) ? 'original-present' : 'conflict' : current.kind === 'absent' ? 'not-present' : 'present', token, reason: 'HKCU Run entry only. Existing running processes, other startup mechanisms and Windows startup approval metadata are unchanged.' } satisfies StartupControl;
      } catch (error) { return { id: app.id, name: app.name, current: null, original: record?.original.text ?? null, managed: Boolean(active(record)), status: 'unavailable', token: null, reason: error instanceof Error ? error.message : 'Startup entry unavailable.' } satisfies StartupControl; }
    }));
  }
  async function change(token: unknown, restore: unknown): Promise<OperationResult> {
    const review = typeof token === 'string' ? reviews.get(token) : undefined;
    if (typeof token === 'string') reviews.delete(token);
    if (!adapter.supported || !review || review.expires < Date.now() || typeof restore !== 'boolean') throw new Error('Refresh startup controls and review the entry again.');
    const app = APPS.find(a => a.id === review.id)!;
    const current = await adapter.read(app);
    if (!same(current, review.value)) throw new Error('The startup entry changed after review. Nothing was overwritten.');
    const records = await load(); let record = records.find(r => r.id === app.id);
    if (restore) {
      if (!active(record)) throw new Error('There is no managed startup entry to restore.');
      if (same(current, record!.original)) { record!.status = 'restored'; await save(records); return { id: app.id, success: true, message: 'The exact original startup entry is already present; verified without writing.' }; }
      if (current.kind !== 'absent') throw new Error('An external startup entry is present. It was preserved; automatic restore is blocked.');
    } else {
      if (active(record)) throw new Error('Restore the previous managed startup entry first.');
      if (current.kind === 'absent') throw new Error('No supported startup entry is present.');
      const next: Backup = { id: app.id, original: current, status: 'pending', timestamp: new Date().toISOString() };
      if (record) records.splice(records.indexOf(record), 1, next); else records.push(next);
      record = next;
    }
    record!.status = 'pending'; await save(records);
    if (!same(await adapter.read(app), current)) {
      record!.status = restore ? 'conflict' : 'failed'; await save(records);
      throw new Error('The startup entry changed before writing. Nothing was overwritten.');
    }
    try {
      const desired: StartupValue = restore ? record!.original : { kind: 'absent' };
      await adapter.write(app, desired);
      if (!same(await adapter.read(app), desired)) throw new Error('Read-back mismatch');
      record!.status = restore ? 'restored' : 'disabled'; await save(records);
      return { id: app.id, success: true, message: restore ? 'Exact startup command and registry value type restored and verified. Windows approval settings still apply.' : 'This sign-in startup entry was removed and verified. Its original command and type are saved. The running app was not stopped.' };
    } catch {
      try { const observed = await adapter.read(app); record!.status = same(observed, record!.original) ? restore ? 'restored' : 'failed' : observed.kind === 'absent' ? 'disabled' : 'conflict'; await save(records); } catch { /* keep the durable pending snapshot */ }
      return { id: app.id, success: false, message: 'The operation could not be fully confirmed. Refresh to review the current entry; its original backup remains saved. No further write was attempted.' };
    }
  }
  return { getControls: () => serialized(getControls), change: (token: unknown, restore: unknown) => serialized(() => change(token, restore)) };
}
