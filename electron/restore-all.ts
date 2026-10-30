import type { createPowerTuningService } from './power-tuning';
import type { createFortniteService } from './fortnite-settings';
import { fortniteSummary } from '../shared/fortnite-settings';
import { POWER_CONTROLS, powerValueLabel } from '../shared/power-tuning';
import type { createCursorService } from './cursor';
import { VISUAL_EFFECTS } from '../shared/visual-effects';
import type { createVisualEffectsService } from './visual-effects';
import { randomUUID } from 'node:crypto';
import type { createTweakService } from './tweaks';
import type { createPowerService } from './power';
import type { createStartupService } from './startup';
import type { createPointerService } from './pointer';
import type { OperationResult, RestoreReview } from '../shared/types';
type Services = { fortnite: ReturnType<typeof createFortniteService>; powerTuning: ReturnType<typeof createPowerTuningService>; cursor: ReturnType<typeof createCursorService>; visual: ReturnType<typeof createVisualEffectsService>; tweaks: ReturnType<typeof createTweakService>; power: ReturnType<typeof createPowerService>; startup: ReturnType<typeof createStartupService>; pointer: ReturnType<typeof createPointerService> };
export function createRestoreService({ tweaks, power, startup, pointer, visual, cursor, powerTuning, fortnite }: Services) {
  let approved: { token: string; fingerprint: string; expires: number } | null = null;
  async function plan() {
    // Reject unreadable journals instead of silently omitting one class of backup.
    const [history, states, profile, energy, launchers, mouse, effects] = await Promise.all([tweaks.getHistory(), tweaks.getTweaks(), tweaks.getProfile(), power.getInfo(), startup.getControls(), pointer.getInfo(), visual.getStates()]);
    const customCursor = await cursor.getInfo();
    const tuned = await powerTuning.getInfo();
    const game = await fortnite.getInfo();
    const tasks: { item: RestoreReview['items'][number]; run: () => Promise<OperationResult> }[] = [];
    if (game.managed) {
      tasks.push({ item: { id: 'fortnite-config', category: 'Game configuration', title: 'Fortnite display preferences', original: fortniteSummary(game.original, game.managedFields), current: fortniteSummary(game.current, game.managedFields), eligible: game.canChange, reason: game.reason ?? 'Restore original managed display values and preserve unrelated settings. Keep Fortnite closed; conflicting values block restoration.' }, run: async () => fortnite.change((await fortnite.preview(null, true)).token) });
    }
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
    // Relax CPU bounds before tightening them so combined restore respects min <= max.
    const priority = (s: typeof tuned.states[number]) => (s.id === 'cpu-minimum' && s.original! < s.current! || s.id === 'cpu-maximum' && s.original! > s.current!) ? 0 : 1;
    for (const state of tuned.states.filter(s => s.managed).sort((a, b) => priority(a) - priority(b))) {
      const id = `power-tuning:${state.id}`;
      tasks.push({ item: { id, category: 'Plugged-in power policy', title: POWER_CONTROLS.find(c => c.id === state.id)!.title + ` (${tuned.planId})`, original: powerValueLabel(state.id, state.original), current: powerValueLabel(state.id, state.current), eligible: state.current !== null && !state.conflict && Boolean(tuned.activePlanId), reason: state.conflict ? 'External power-policy value preserved.' : state.current === null ? 'Power-policy provider unavailable; backup retained.' : 'Restore the exact original AC value on the saved plan; preserve battery settings and current plan selection.' }, run: async () => { const review = await powerTuning.preview(state.id, null, true); return powerTuning.change(review.token); } });
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
