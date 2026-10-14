import { randomUUID } from 'node:crypto';
import type { OperationResult } from '../shared/types';
import type { RestorePointOutcome, RestorePointReview } from '../shared/system-restore';
import { createWindowsRestoreAdapter, restorePointDescription, type SystemRestoreAdapter } from './system-restore-native';
const messages: Record<RestorePointOutcome, string> = {
  created: 'Windows created a new PANDORA restore point and verified it in the system restore-point list. Windows controls its retention. This is not a personal-file backup.',
  cancelled: 'Windows administrator approval was cancelled. PANDORA did not create a restore point.',
  unsupported: 'Windows System Restore is not supported on this Windows edition.',
  failed: 'Windows could not confirm a restore point. Check System Protection, permissions and available disk space before trying again.',
  unconfirmed: 'No new restore point was confirmed. Windows may limit creation to one point per day, or protection/policy may prevent it. If the request timed out, it may still be running; check System Protection before retrying.',
};
export function createSystemRestoreService(adapter: SystemRestoreAdapter = createWindowsRestoreAdapter(), now = Date.now) {
  let approved: { token: string; id: string; expires: number } | null = null, queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => { const work = queue.then(fn, fn); queue = work.catch(() => undefined); return work; };
  return {
    getInfo: () => serial(() => adapter.read()),
    preview: () => serial(async (): Promise<RestorePointReview> => {
      approved = null;
      if (!(await adapter.read()).supported) throw new Error('Windows System Restore is unavailable. Review System Protection first.');
      const id = randomUUID(), token = randomUUID(); approved = { id, token, expires: now() + 300_000 };
      return { token, description: restorePointDescription(id) };
    }),
    create: (token: unknown) => serial(async (): Promise<OperationResult> => {
      const request = approved; approved = null;
      if (!request || token !== request.token || now() > request.expires) throw new Error('Review restore-point creation again before requesting administrator approval.');
      if (!(await adapter.read()).supported) throw new Error('Windows availability changed. No administrator request was started.');
      let outcome: RestorePointOutcome;
      try { outcome = await adapter.create(request.id); } catch { outcome = 'unconfirmed'; }
      return { id: 'windows-system-restore', success: outcome === 'created', message: messages[outcome] };
    }),
  };
}
