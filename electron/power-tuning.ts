import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { POWER_CONTROLS, type PowerTuningInfo, type PowerTuningReview } from '../shared/power-tuning';
import { createWindowsPowerTuningAdapter, validPowerGuid, type PowerTuningAdapter } from './power-tuning-native';
import { readSmallJson, writeDurableJson } from './durable-store';
import type { OperationResult } from '../shared/types';
interface RecordEntry { id: string; original: number; applied: number; status: 'pending' | 'applied' | 'restored' | 'failed' | 'conflict'; timestamp: string; }
interface Journal { version: 1; planId: string; records: RecordEntry[]; }
const owned = (r?: RecordEntry) => Boolean(r && ['pending', 'applied', 'conflict'].includes(r.status));
const validValue = (id: string, v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= (POWER_CONTROLS.find(c => c.id === id)?.maximum ?? -1);
export function createPowerTuningService(directory: string, adapter: PowerTuningAdapter = createWindowsPowerTuningAdapter()) {
  const file = path.join(directory, 'backups', 'power-tuning-v1.json');
  let queue: Promise<unknown> = Promise.resolve(), approved: (PowerTuningReview & { expires: number }) | null = null;
  const serial = <T>(fn: () => Promise<T>) => { const r = queue.then(fn, fn); queue = r.catch(() => undefined); return r; };
  async function load(): Promise<Journal | null> {
    const raw = await readSmallJson(file); if (raw === undefined) return null; const j = raw as Journal;
    if (j?.version !== 1 || !validPowerGuid(j.planId) || !Array.isArray(j.records) || j.records.length > POWER_CONTROLS.length || new Set(j.records.map(r => r?.id)).size !== j.records.length || j.records.some(r => !r || !validValue(r.id, r.original) || !validValue(r.id, r.applied) || r.original === r.applied || !['pending', 'applied', 'restored', 'failed', 'conflict'].includes(r.status) || typeof r.timestamp !== 'string' || !Number.isFinite(Date.parse(r.timestamp)))) throw new Error('Invalid advanced power backup. It has been preserved; no changes are allowed.');
    return j;
  }
  async function info(): Promise<PowerTuningInfo> {
    const j = await load(), managedPlan = j?.records.some(owned) ? j.planId : undefined;
    let snapshot: Awaited<ReturnType<PowerTuningAdapter['read']>> | null = null;
    if (adapter.supported) try { snapshot = await adapter.read(managedPlan); } catch { /* expose missing state and preserve backup */ }
    return { supported: adapter.supported, planId: snapshot?.planId ?? managedPlan ?? null, activePlanId: snapshot?.activePlanId ?? null, states: POWER_CONTROLS.map(c => {
      const r = j && j.planId === (snapshot?.planId ?? managedPlan) ? j.records.find(r => r.id === c.id) : undefined, current = snapshot?.values[c.id];
      const value = validValue(c.id, current) ? current : null;
      return { id: c.id, current: value, original: r?.original ?? null, applied: r?.applied ?? null, managed: owned(r), conflict: Boolean(owned(r) && value !== null && value !== r!.original && value !== r!.applied) };
    }), ...(!snapshot ? { reason: 'Power-policy data is unavailable. Original backups are retained. These controls require Windows and a supported power plan.' } : {}) };
  }
  async function preview(id: unknown, desired: unknown, restore: unknown): Promise<PowerTuningReview> {
    approved = null;
    if (typeof id !== 'string' || !POWER_CONTROLS.some(c => c.id === id) || typeof restore !== 'boolean') throw new Error('Choose a supported power control.');
    const current = await info(), state = current.states.find(s => s.id === id)!;
    if (!current.supported || !current.planId || !current.activePlanId || state.current === null || state.conflict) throw new Error('This power control is unavailable or was changed outside PANDORA. Refresh before reviewing.');
    if (restore ? !state.managed : state.managed || current.planId !== current.activePlanId) throw new Error('Restore the previous managed power settings before editing this plan.');
    const value = restore ? state.original : desired;
    if (!validValue(id, value) || !restore && !POWER_CONTROLS.find(c => c.id === id)!.options.some(o => o.value === value)) throw new Error('Choose a supported power value.');
    if (!restore && value === state.current) throw new Error('That value is already configured. No change is needed.');
    const minimum = id === 'cpu-minimum' ? value : current.states.find(s => s.id === 'cpu-minimum')?.current;
    const maximum = id === 'cpu-maximum' ? value : current.states.find(s => s.id === 'cpu-maximum')?.current;
    if (['cpu-minimum', 'cpu-maximum'].includes(id) && (minimum == null || maximum == null || minimum > maximum)) throw new Error('Processor minimum must not exceed maximum. Review the other limit first.');
    const review: PowerTuningReview = { token: randomUUID(), id, current: state.current, desired: value, restore, planId: current.planId, activePlanId: current.activePlanId };
    approved = { ...review, expires: Date.now() + 300_000 }; return review;
  }
  async function change(token: unknown): Promise<OperationResult> {
    const r = approved; approved = null;
    if (!r || token !== r.token || Date.now() > r.expires) throw new Error('Review this power change again.');
    const before = await adapter.read(r.planId);
    if (before.activePlanId !== r.activePlanId || before.planId !== r.planId || before.values[r.id] !== r.current) throw new Error('The power plan or value changed after review. Nothing was overwritten.');
    let j = await load();
    if (!j || j.planId !== r.planId) { if (j?.records.some(owned)) throw new Error('Another plan still has managed changes.'); j = { version: 1, planId: r.planId, records: [] }; }
    let record = j.records.find(e => e.id === r.id);
    if (r.restore) {
      if (!owned(record) || record!.original !== r.desired || ![record!.original, record!.applied].includes(r.current)) throw new Error('The original backup changed. Review restoration again.');
    } else {
      if (owned(record)) throw new Error('Restore the previous change first.');
      const next: RecordEntry = { id: r.id, original: r.current, applied: r.desired, status: 'pending', timestamp: new Date().toISOString() };
      if (record) Object.assign(record, next); else { record = next; j.records.push(record); }
    }
    record!.status = 'pending'; await writeDurableJson(file, j);
    try {
      await adapter.write(r.planId, r.activePlanId, r.id, r.current, r.desired);
      const after = await adapter.read(r.planId);
      if (after.values[r.id] !== r.desired || after.activePlanId !== r.activePlanId) throw new Error('Power verification failed.');
      record!.status = r.restore ? 'restored' : 'applied'; await writeDurableJson(file, j);
      return { id: `power-tuning:${r.id}`, success: true, message: r.restore ? 'Original plugged-in power value restored and verified. Battery settings and the active plan selection were preserved.' : 'Plugged-in power value saved and verified. The original is backed up; battery settings are unchanged. Hardware may apply additional policies.' };
    } catch {
      try { const value = (await adapter.read(r.planId)).values[r.id]; record!.status = value === record!.original ? r.restore ? 'pending' : 'failed' : value === record!.applied ? 'applied' : 'conflict'; await writeDurableJson(file, j); } catch { /* durable pending record retained */ }
      return { id: `power-tuning:${r.id}`, success: false, message: 'Windows could not fully confirm the change or plan refresh. Policy, permissions or an external change may prevent it. The original backup is retained; refresh before retrying.' };
    }
  }
  return { getInfo: () => serial(info), preview: (id: unknown, desired: unknown, restore: unknown) => serial(() => preview(id, desired, restore)), change: (token: unknown) => serial(() => change(token)) };
}
