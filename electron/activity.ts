import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readSmallJson, writeDurableJson } from './durable-store';
import { ACTIVITY_ACTIONS, type ActivityAction, type ActivityEntry, type ActivityInfo, type ActivityClearReview } from '../shared/activity';
const LIMIT = 500;
const safeCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value));
interface Store { version: 1; entries: ActivityEntry[]; discarded: number; clearedAt: string | null; incomplete: boolean; }
function validate(raw: unknown): Store {
  const s = raw as Store;
  if (s?.version !== 1 || !Array.isArray(s.entries) || s.entries.length > LIMIT || !safeCount(s.discarded) || typeof s.incomplete !== 'boolean' || (s.clearedAt !== null && !validDate(s.clearedAt))) throw new Error('Invalid activity log.');
  const ids = new Set<string>();
  const entries = s.entries.map(e => {
    if (!e || typeof e.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(e.id) || ids.has(e.id) || !Object.hasOwn(ACTIVITY_ACTIONS, e.action) || !validDate(e.startedAt) || (e.endedAt !== null && !validDate(e.endedAt)) || !['running', 'completed', 'partial', 'unconfirmed', 'cancelled'].includes(e.status) || (e.succeeded !== null && !safeCount(e.succeeded)) || (e.notConfirmed !== null && !safeCount(e.notConfirmed))) throw new Error('Invalid activity entry.');
    if ((e.status === 'running') !== (e.endedAt === null)) throw new Error('Invalid activity completion.');
    ids.add(e.id);
    let cleanup: ActivityEntry['cleanup'] = null;
    if (e.cleanup !== null) {
      const c = e.cleanup;
      if (e.action !== 'clean' || !c || !['safe', 'browser', 'recycle'].includes(c.kind) || !safeCount(c.deletedBytes) || !safeCount(c.deletedFiles) || !safeCount(c.skippedFiles)) throw new Error('Invalid cleanup activity.');
      cleanup = { kind: c.kind, deletedBytes: c.deletedBytes, deletedFiles: c.deletedFiles, skippedFiles: c.skippedFiles };
    }
    return { id: e.id, action: e.action, startedAt: e.startedAt, endedAt: e.endedAt, status: e.status, succeeded: e.succeeded, notConfirmed: e.notConfirmed, cleanup };
  });
  return { version: 1, entries, discarded: s.discarded, clearedAt: s.clearedAt, incomplete: s.incomplete };
}
function outcome(action: ActivityAction, result: unknown): Pick<ActivityEntry, 'status' | 'succeeded' | 'notConfirmed' | 'cleanup'> {
  const base = { status: 'completed' as ActivityEntry['status'], succeeded: null as number | null, notConfirmed: null as number | null, cleanup: null as ActivityEntry['cleanup'] };
  if ((action === 'cursor-select' || action === 'game-select') && result === null) return { ...base, status: 'cancelled' };
  if (action === 'clean') {
    const c = result as NonNullable<ActivityEntry['cleanup']> & { failures: unknown[] };
    if (!c || !['safe', 'browser', 'recycle'].includes(c.kind) || !safeCount(c.deletedBytes) || !safeCount(c.deletedFiles) || !safeCount(c.skippedFiles) || !Array.isArray(c.failures)) return { ...base, status: 'unconfirmed' };
    const notConfirmed = Math.max(c.skippedFiles, c.failures.length);
    return { ...base, notConfirmed, status: notConfirmed ? c.deletedFiles || c.deletedBytes ? 'partial' : 'unconfirmed' : 'completed', cleanup: { kind: c.kind, deletedBytes: c.deletedBytes, deletedFiles: c.deletedFiles, skippedFiles: c.skippedFiles } };
  }
  if (['apply', 'revert', 'profile-apply', 'restore-all'].includes(action)) {
    if (!Array.isArray(result) || result.some(v => typeof v?.success !== 'boolean')) return { ...base, status: 'unconfirmed' };
    const succeeded = result.filter(v => v.success).length, notConfirmed = result.length - succeeded;
    return { ...base, succeeded, notConfirmed, status: notConfirmed ? succeeded ? 'partial' : 'unconfirmed' : 'completed' };
  }
  if (['power-apply', 'power-restore', 'power-tuning-change', 'startup-change', 'pointer-change', 'visual-change', 'cursor-change', 'system-restore-create', 'app-login-change'].includes(action)) {
    const success = (result as { success?: unknown })?.success;
    return { ...base, status: success === true ? 'completed' : 'unconfirmed', succeeded: success === true ? 1 : 0, notConfirmed: success === true ? 0 : 1 };
  }
  return base;
}
export function createActivityService(directory: string, now = Date.now) {
  const file = path.join(directory, 'activity-v1.json');
  let queue: Promise<unknown> = Promise.resolve(), missed = false;
  let review: { token: string; ids: string; expires: number } | null = null;
  const active = new Set<string>();
  const serial = <T>(fn: () => Promise<T>) => { const r = queue.then(fn, fn); queue = r.catch(() => undefined); return r; };
  const date = () => new Date(now()).toISOString();
  const load = async (): Promise<Store> => {
    try { const raw = await readSmallJson(file); return raw === undefined ? { version: 1, entries: [], discarded: 0, clearedAt: null, incomplete: false } : validate(raw); }
    catch { throw new Error('The activity log could not be read safely. It has been preserved; clearing is unavailable.'); }
  };
  const save = async (s: Store) => { s.incomplete ||= missed; await writeDurableJson(file, s); };
  return {
    async track<T>(action: ActivityAction, run: () => Promise<T>): Promise<T> {
      if (!Object.hasOwn(ACTIVITY_ACTIONS, action)) throw new Error('Unknown activity action.');
      const id = randomUUID(); active.add(id);
      let recorded = false;
      try {
        await serial(async () => {
          const s = await load();
          while (s.entries.length >= LIMIT) {
            const index = s.entries.findIndex(e => !active.has(e.id));
            if (index < 0) throw new Error('Activity capacity unavailable.');
            s.entries.splice(index, 1); s.discarded++;
          }
          s.entries.push({ id, action, startedAt: date(), endedAt: null, status: 'running', succeeded: null, notConfirmed: null, cleanup: null });
          await save(s); recorded = true;
        });
      } catch { missed = true; }
      const finish = async (summary: ReturnType<typeof outcome>) => {
        if (!recorded) return;
        try { await serial(async () => { const s = await load(), entry = s.entries.find(e => e.id === id); if (!entry) throw new Error('Activity record missing.'); Object.assign(entry, summary, { endedAt: date() }); await save(s); }); }
        catch { missed = true; }
      };
      try { const result = await run(); await finish(outcome(action, result)); return result; }
      catch (error) { await finish({ status: 'unconfirmed', succeeded: null, notConfirmed: null, cleanup: null }); throw error; }
      finally { active.delete(id); }
    },
    get: () => serial(async (): Promise<ActivityInfo> => {
      try {
        const s = await load();
        return { available: true, limit: LIMIT, discarded: s.discarded, clearedAt: s.clearedAt, incomplete: s.incomplete || missed,
          entries: s.entries.map(e => e.status === 'running' && !active.has(e.id) ? { ...e, status: 'unconfirmed' } : e).reverse() as ActivityEntry[],
          warning: s.incomplete || missed ? 'Some activity could not be recorded. Review the actual settings and saved originals; this log is incomplete.' : null };
      } catch { return { available: false, entries: [], limit: LIMIT, discarded: 0, clearedAt: null, incomplete: true, warning: 'The activity log could not be read. Its file is preserved. Setting backups and restoration remain separate.' }; }
    }),
    previewClear: () => serial(async (): Promise<ActivityClearReview> => {
      review = null; const s = await load(), ids = s.entries.filter(e => !active.has(e.id)).map(e => e.id);
      const token = randomUUID(); review = { token, ids: JSON.stringify(ids), expires: now() + 300_000 };
      return { token, count: ids.length };
    }),
    clear: (token: unknown) => serial(async () => {
      const saved = review; review = null;
      if (!saved || token !== saved.token || now() >= saved.expires) throw new Error('Review clearing activity again.');
      const s = await load(), ids = s.entries.filter(e => !active.has(e.id)).map(e => e.id);
      if (JSON.stringify(ids) !== saved.ids) throw new Error('Activity changed after review. Refresh and review it again.');
      s.entries = s.entries.filter(e => active.has(e.id)); s.discarded += ids.length; s.clearedAt = date(); await save(s);
      return { id: 'activity-clear', success: true, message: 'Reviewed activity entries cleared. Original setting backups were kept.' };
    }),
  };
}
