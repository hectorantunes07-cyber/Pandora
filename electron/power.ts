import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readSmallJson, writeDurableJson } from './durable-store';
import type { OperationResult, PowerInfo, PowerSnapshot } from '../shared/types';

const execute = promisify(execFile);
const GUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const isGuid = (v: unknown): v is string => typeof v === 'string' && GUID.test(v);
const names: Record<string, string> = {
  '381b4222-f694-41f0-9685-ff5bb260df2e': 'Balanced',
  '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c': 'High performance',
  'a1841308-3541-4fab-bc81-f71556f20b4a': 'Power saver',
};
export interface PowerAdapter {
  supported: boolean;
  read(): Promise<{ currentId: string; plans: { id: string; name: string }[] }>;
  set(id: string): Promise<void>;
}
export function parsePowerPlans(list: string, active: string): Awaited<ReturnType<PowerAdapter['read']>> {
  const pattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  const ids = [...new Set((list.match(pattern) ?? []).map(id => id.toLowerCase()))];
  const activeIds = active.match(pattern)?.map(id => id.toLowerCase());
  if (!ids.length || ids.length > 128 || activeIds?.length !== 1 || !ids.includes(activeIds[0])) throw new Error('Windows did not return a consistent list of installed power plans.');
  // Do not infer encoding or parse localized/OEM prose as a command or GUID.
  return { currentId: activeIds[0], plans: ids.map(id => ({ id, name: names[id] ?? `Existing custom plan (${id.slice(0, 8)})` })) };
}
export function createWindowsPowerAdapter(): PowerAdapter {
  const supported = process.platform === 'win32';
  async function run(args: string[]) {
    if (!supported) throw new Error('Power-plan controls require Windows.');
    try { return (await execute(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'powercfg.exe'), args, { windowsHide: true, timeout: 15_000, maxBuffer: 128 * 1024, encoding: 'utf8' })).stdout; }
    catch { throw new Error('Windows could not complete the power-plan request. Access, policy or a timeout may prevent it. No successful change was assumed.'); }
  }
  return { supported, read: async () => { const list = await run(['/list']); const active = await run(['/getactivescheme']); return parsePowerPlans(list, active); }, set: async id => { if (!isGuid(id)) throw new Error('Invalid power-plan identifier.'); await run(['/setactive', id]); } };
}

function snapshot(value: unknown): PowerSnapshot | null {
  if (value === undefined) return null;
  const s = value as PowerSnapshot;
  if (!s || s.version !== 1 || !isGuid(s.originalId) || !isGuid(s.appliedId) || s.originalId === s.appliedId || !['pending', 'applied', 'reverted', 'conflict', 'failed'].includes(s.status) || !['apply', 'restore'].includes(s.intent) || typeof s.timestamp !== 'string' || !Number.isFinite(Date.parse(s.timestamp))) throw new Error('Invalid power-plan backup. It has been preserved; no changes are allowed.');
  return s;
}
export function createPowerService(directory: string, adapter = createWindowsPowerAdapter()) {
  const file = path.join(directory, 'backups', 'power-v1.json');
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>): Promise<T> => { const result = queue.then(fn, fn); queue = result.catch(() => undefined); return result; };
  const load = async () => snapshot(await readSmallJson(file));
  const owned = (s: PowerSnapshot | null) => s && ['pending', 'applied', 'conflict'].includes(s.status);
  async function getInfo(): Promise<PowerInfo> {
    const backup = await load();
    if (!adapter.supported) return { supported: false, plans: [], currentId: null, backup, conflict: false };
    try {
      const info = await adapter.read();
      return { supported: true, ...info, backup, conflict: Boolean(owned(backup) && info.currentId !== backup!.appliedId && info.currentId !== backup!.originalId) };
    } catch { return { supported: true, plans: [], currentId: null, backup, conflict: false, reason: 'Windows power-plan data is unavailable. The saved backup is preserved; no power-plan change can be reviewed until the provider responds.' }; }
  }
  async function mutate(id: unknown, expected: unknown, restore: boolean): Promise<OperationResult> {
    if (!adapter.supported) throw new Error('Power-plan controls require Windows.');
    if (!isGuid(expected) || (!restore && !isGuid(id))) throw new Error('Review a valid installed power plan first.');
    const current = await adapter.read();
    if (current.currentId !== expected) throw new Error('The active power plan changed after your review. Refresh and review again.');
    const previous = await load();
    let record: PowerSnapshot;
    if (restore) {
      if (!owned(previous)) return { id: 'power-plan', success: true, message: 'No managed power plan needs restoration.' };
      record = { ...previous!, intent: 'restore', status: 'pending' };
      if (current.currentId === record.originalId) {
        record.status = 'reverted'; await writeDurableJson(file, record);
        return { id: 'power-plan', success: true, message: 'The original power plan was already restored; verified without writing.' };
      }
      if (current.currentId !== record.appliedId) throw new Error('The power plan was changed outside PANDORA. That change is preserved; the original backup remains available.');
      id = record.originalId;
    } else {
      if (owned(previous)) throw new Error('Restore the previous managed power plan before selecting another. Your original backup is preserved.');
      if (id === current.currentId) return { id: 'power-plan', success: true, message: 'This plan is already active. No ownership or backup was claimed.' };
      record = { version: 1, originalId: current.currentId, appliedId: id as string, status: 'pending', intent: 'apply', timestamp: new Date().toISOString() };
    }
    if (!current.plans.some(p => p.id === id)) throw new Error('The reviewed power plan is no longer installed. No plan was created or changed.');
    // Durable intent precedes any write. Reloading on every operation also handles
    // a process interruption or a persistence failure after Windows was changed.
    await writeDurableJson(file, record);
    const immediatelyBefore = await adapter.read();
    if (immediatelyBefore.currentId !== expected) {
      record.status = restore ? 'conflict' : 'failed'; await writeDurableJson(file, record);
      throw new Error('The power plan changed before writing. No Windows change was performed.');
    }
    try {
      await adapter.set(id as string);
      if ((await adapter.read()).currentId !== id) throw new Error('Windows did not retain the requested plan.');
      record.status = restore ? 'reverted' : 'applied';
      await writeDurableJson(file, record);
      return { id: 'power-plan', success: true, message: restore ? 'Original power plan restored and verified.' : 'Power plan selected and verified. Its exact original identifier is saved for restoration.' };
    } catch {
      // Never issue a second write on failure: another app may have changed the
      // plan. Preserve the intent and report the observed state for manual review.
      try {
        const actual = (await adapter.read()).currentId;
        record.status = actual === record.originalId ? (restore ? 'reverted' : 'failed') : actual === record.appliedId ? 'applied' : 'conflict';
        await writeDurableJson(file, record);
      } catch { /* the last durable original and pending intent remain */ }
      return { id: 'power-plan', success: false, message: 'The operation could not be fully confirmed. Refresh to inspect the active plan; the original backup was retained. No further Windows change was attempted.' };
    }
  }
  return { getInfo: () => serialized(getInfo), apply: (id: unknown, expected: unknown) => serialized(() => mutate(id, expected, false)), restore: (expected: unknown) => serialized(() => mutate(null, expected, true)) };
}
