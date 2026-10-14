import type { createCursorService } from './cursor';
import { VISUAL_EFFECTS } from '../shared/visual-effects';
import type { createVisualEffectsService } from './visual-effects';
import { randomUUID } from 'node:crypto';
import type { createTweakService } from './tweaks';
import type { createPowerService } from './power';
import type { createStartupService } from './startup';
import type { createPointerService } from './pointer';
import type { OperationResult, RestoreReview } from '../shared/types';
type Services = { cursor: ReturnType<typeof createCursorService>; visual: ReturnType<typeof createVisualEffectsService>; tweaks: ReturnType<typeof createTweakService>; power: ReturnType<typeof createPowerService>; startup: ReturnType<typeof createStartupService>; pointer: ReturnType<typeof createPointerService> };
export function createRestoreService({ tweaks, power, startup, pointer, visual, cursor }: Services) {
  let approved: { token: string; fingerprint: string; expires: number } | null = null;
  async function plan() {
    // Reject unreadable journals instead of silently omitting one class of backup.
    const [history, states, profile, energy, launchers, mouse, effects] = await Promise.all([tweaks.getHistory(), tweaks.getTweaks(), tweaks.getProfile(), power.getInfo(), startup.getControls(), pointer.getInfo(), visual.getStates()]);
    const customCursor = await cursor.getInfo();
    const tasks: { item: RestoreReview['items'][number]; run: () => Promise<OperationResult> }[] = [];
    for (const record of history.filter(r => ['pending', 'applied', 'conflict'].includes(r.status))) {
      const state = states.find(t => t.id === record.tweakId);
      const id = `preference:${record.id}`;
      tasks.push({ item: { id, category: 'Preference', title: record.title, original: String(record.originalValue ?? 'Originally absent'), current: state?.state === 'unknown' || state?.state === 'unsupported' ? 'Unavailable' : String(state?.currentValue ?? 'Not explicitly set'), eligible: state?.state === 'applied', reason: state?.state === 'applied' ? 'Restore the saved original value or absence.' : 'Current state needs individual review; external or unreadable settings will be skipped.' }, run: async () => ({ ...(await tweaks.revertTweaks([record.tweakId]))[0], id }) });
    }
    if (energy.backup && ['pending', 'applied', 'conflict'].includes(energy.backup.status)) {
      tasks.push({ item: { id: 'power', category: 'Power plan', title: 'Windows power plan', original: energy.backup.originalId, current: energy.currentId ?? 'Unavailable', eligible: energy.supported && Boolean(energy.currentId) && !energy.conflict, reason: !energy.currentId ? 'Power-plan data is unavailable; the saved original is retained and this item is skipped.' : energy.conflict ? 'An external plan change is preserved; automatic restore is skipped.' : 'Restore the exact original installed plan identifier.' }, run: async () => ({ ...await power.restore(energy.currentId), id: 'power' }) });
    }
    for (const entry of launchers.filter(e => e.managed)) {
      const id = `startup:${entry.id}`;
      tasks.push({ item: { id, category: 'Startup entry', title: `${entry.name} startup`, original: entry.original ?? 'Unavailable', current: entry.current ?? 'No Run entry', eligible: Boolean(entry.token) && ['disabled', 'original-present'].includes(entry.status), reason: ['disabled', 'original-present'].includes(entry.status) ? 'Restore the original command and registry type; existing Windows approval settings still apply.' : 'External or unreadable startup entry preserved; restore skipped.' }, run: async () => ({ ...await startup.change(entry.token, true), id }) });
    }
    if (mouse.managed) {
      tasks.push({ item: { id: 'pointer', category: 'Pointer behavior', title: 'Windows pointer acceleration', original: mouse.original?.join(', ') ?? 'Unavailable', current: mouse.current?.join(', ') ?? 'Unavailable', eligible: mouse.supported && Boolean(mouse.token) && !mouse.conflict, reason: !mouse.current ? 'Pointer data is unavailable; the saved original is retained and this item is skipped.' : mouse.conflict ? 'External pointer values are preserved; automatic restore is skipped.' : 'Restore the original two thresholds and acceleration mode through the Windows API.' }, run: () => pointer.change(mouse.token, true) });
    }
    for (const effect of effects.filter(e => e.managed)) {
      const id = `visual:${effect.id}`;
      tasks.push({ item: { id, category: 'Visual preference', title: VISUAL_EFFECTS.find(e => e.id === effect.id)!.title, original: effect.original ? 'On' : 'Off', current: effect.current === null ? 'Unavailable' : effect.current ? 'On' : 'Off', eligible: Boolean(effect.token), reason: effect.token ? 'Restore the original Windows visual preference.' : 'Preference is unavailable; the saved original is retained.' }, run: async () => ({ ...await visual.change(effect.token, true), id }) });
    }
    if (customCursor?.managed && cursor) {
      tasks.push({ item: { id: 'cursor', category: 'Normal pointer', title: 'Custom Windows cursor', original: customCursor.original?.value || 'Windows scheme default', current: customCursor.current ? customCursor.current.value || 'Windows scheme default' : 'Unavailable', eligible: Boolean(customCursor.token) && !customCursor.conflict, reason: customCursor.conflict ? 'External cursor change preserved; restore skipped.' : !customCursor.current ? 'Cursor provider unavailable; original retained.' : 'Restore the exact original normal pointer. Other roles are preserved.' }, run: () => cursor.change(customCursor.token, true) });
    }
    if (profile.selection) {
      tasks.push({ item: { id: 'profile', category: 'Profile selection', title: 'Saved preset selection', original: 'No preset selected', current: profile.selection.id, eligible: true, reason: 'Clear the active preset only after all profile-owned preferences have been restored. Saved custom choices are retained.' }, run: async () => {
        if ((await tweaks.getProfile()).ownedIds.length) return { id: 'profile', success: false, message: 'Preset selection retained because some profile-owned settings still need review.' };
        const review = await tweaks.previewProfile(null);
        const results = await tweaks.applyProfile(review.token);
        return { id: 'profile', success: results.every(r => r.success), message: results.every(r => r.success) ? 'Preset selection cleared; saved custom choices retained.' : 'Preset selection needs review.' };
      } });
    }
    return tasks;
  }
  return {
    async preview(): Promise<RestoreReview> {
      const items = (await plan()).map(t => t.item), token = randomUUID();
      approved = { token, fingerprint: JSON.stringify(items), expires: Date.now() + 5 * 60_000 };
      return { token, items };
    },
    async restore(token: unknown): Promise<OperationResult[]> {
      const saved = approved; approved = null;
      if (!saved || token !== saved.token || Date.now() > saved.expires) throw new Error('Review all managed changes again before restoring.');
      const tasks = await plan();
      if (JSON.stringify(tasks.map(t => t.item)) !== saved.fingerprint) throw new Error('Managed state changed after review. Review again; no changes were made.');
      const results: OperationResult[] = [];
      for (const { item, run } of tasks) {
        if (!item.eligible) { results.push({ id: item.id, success: false, message: item.reason }); continue; }
        try { results.push(await run()); }
        catch (error) { results.push({ id: item.id, success: false, message: error instanceof Error ? error.message : 'Restoration could not be confirmed. Backup retained.' }); }
      }
      return results;
    },
  };
}
