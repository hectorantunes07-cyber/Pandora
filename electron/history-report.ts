import type { CursorInfo, HistoryEntry, PointerInfo, PowerInfo, StartupControl, TweakState } from '../shared/types';
import type { PowerTuningInfo } from '../shared/power-tuning';
import type { ProfileStatus } from '../shared/profiles';
import type { VisualEffectState } from '../shared/visual-effects';
import { POWER_CONTROLS } from '../shared/power-tuning';
import { PROFILE_DEFINITIONS } from '../shared/profiles';
import { VISUAL_EFFECTS } from '../shared/visual-effects';
import { STARTUP_APPS } from './startup';
import { TWEAKS_BY_ID } from './tweak-catalog';
import { ACTIVITY_ACTIONS, type ActivityInfo } from '../shared/activity';

export interface HistoryReportSources {
  activity(): Promise<ActivityInfo>;
  history(): Promise<HistoryEntry[]>;
  preferences(): Promise<TweakState[]>;
  profile(): Promise<ProfileStatus>;
  power(): Promise<PowerInfo>;
  powerTuning(): Promise<PowerTuningInfo>;
  startup(): Promise<StartupControl[]>;
  pointer(): Promise<PointerInfo>;
  visual(): Promise<VisualEffectState[]>;
  cursor(): Promise<CursorInfo>;
}
type Section<T> = { status: 'available'; data: T } | { status: 'unavailable'; data: null; reason: string };
async function section<T>(read: () => Promise<T>): Promise<Section<T>> {
  try { return { status: 'available', data: await read() }; }
  catch { return { status: 'unavailable', data: null, reason: 'This section could not be read. Saved originals are retained; no complete record is implied.' }; }
}
const guid = (value: string | null) => {
  if (value === null || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return value;
  throw new Error('Invalid power-plan identifier.');
};
const timestamp = (value: string) => new Date(value).toISOString();
const preferenceId = (id: string) => { if (!TWEAKS_BY_ID.has(id)) throw new Error('Unknown preference.'); return id; };
const catalogEntry = <T extends { id: string }>(catalog: readonly T[], id: string) => {
  const value = catalog.find(item => item.id === id); if (!value) throw new Error('Unknown setting.'); return value;
};
/** Explicit fields only: never serialize a service result, command, path, token or raw error. */
export async function collectHistoryReport(sources: HistoryReportSources, version: string, now = () => new Date()) {
  const startedAt = now().toISOString();
  const [history, preferences, profile, power, powerTuning, startup, pointer, visual, cursor] = await Promise.all([
    section(async () => (await sources.history()).map(record => ({
      tweakId: preferenceId(record.tweakId), title: TWEAKS_BY_ID.get(record.tweakId)!.title,
      timestamp: timestamp(record.timestamp), status: record.status, originalValue: record.originalValue, appliedValue: record.appliedValue,
    }))),
    section(async () => (await sources.preferences()).map(value => ({ id: preferenceId(value.id), state: value.state, currentValue: value.currentValue, managed: value.managed }))),
    section(async () => { const value = await sources.profile(); return {
      selection: value.selection ? { id: catalogEntry(PROFILE_DEFINITIONS, value.selection.id).id, ids: value.selection.ids.map(preferenceId) } : null,
      ownedIds: value.ownedIds.map(preferenceId), customIds: (value.customIds ?? []).map(preferenceId), complete: value.complete,
    }; }),
    section(async () => { const value = await sources.power(); return {
      supported: value.supported, currentPlanId: guid(value.currentId), conflict: value.conflict,
      backup: value.backup ? { originalPlanId: guid(value.backup.originalId), appliedPlanId: guid(value.backup.appliedId), status: value.backup.status, intent: value.backup.intent, timestamp: timestamp(value.backup.timestamp) } : null,
    }; }),
    section(async () => { const value = await sources.powerTuning(); return {
      supported: value.supported, savedPlanId: guid(value.planId), activePlanId: guid(value.activePlanId), states: value.states.map(s => ({
        id: catalogEntry(POWER_CONTROLS, s.id).id, title: catalogEntry(POWER_CONTROLS, s.id).title,
        current: s.current, original: s.original, applied: s.applied, managed: s.managed, conflict: s.conflict,
      })),
    }; }),
    section(async () => (await sources.startup()).map(value => ({
      id: catalogEntry(STARTUP_APPS, value.id).id, name: catalogEntry(STARTUP_APPS, value.id).name,
      managed: value.managed, state: value.status, currentEntryPresent: value.status === 'unavailable' ? null : value.current !== null, savedOriginalPresent: value.original !== null,
    }))),
    section(async () => { const value = await sources.pointer(); return {
      supported: value.supported, managed: value.managed, conflict: value.conflict,
      current: value.current ? [...value.current] : null, original: value.original ? [...value.original] : null,
    }; }),
    section(async () => (await sources.visual()).map(value => ({
      id: catalogEntry(VISUAL_EFFECTS, value.id).id, title: catalogEntry(VISUAL_EFFECTS, value.id).title,
      managed: value.managed, current: value.current, original: value.original,
    }))),
    section(async () => { const value = await sources.cursor(); return {
      supported: value.supported, managed: value.managed, conflict: value.conflict, useInApp: value.useInApp,
      currentReadable: value.current !== null, originalSaved: value.original !== null,
      currentValueKind: value.current?.kind ?? null, originalValueKind: value.original?.kind ?? null,
      selectedFormat: value.selected?.kind ?? null,
    }; }),
  ]);
  const sections = { history, preferences, profile, power, powerTuning, startup, pointer, visual, cursor };
  const activity = await section(async () => {
    const value = await sources.activity();
    if (!value.available) throw new Error('Activity unavailable.');
    return { limit: value.limit, discarded: value.discarded, clearedAt: value.clearedAt, incomplete: value.incomplete,
      entries: value.entries.map(e => { if (!Object.hasOwn(ACTIVITY_ACTIONS, e.action)) throw new Error('Unknown activity.'); return { action: e.action, title: ACTIVITY_ACTIONS[e.action], startedAt: e.startedAt, endedAt: e.endedAt, status: e.status, succeeded: e.succeeded, notConfirmed: e.notConfirmed,
        cleanup: e.cleanup ? { kind: e.cleanup.kind, deletedBytes: e.cleanup.deletedBytes, deletedFiles: e.cleanup.deletedFiles, skippedFiles: e.cleanup.skippedFiles } : null }; }) };
  });
  return {
    schemaVersion: 2, product: 'PANDORA', createdBy: 'Sonnier', version, startedAt, completedAt: now().toISOString(),
    collectionComplete: activity.status === 'available' && Object.values(sections).every(value => value.status === 'available'),
    scope: 'Preference operation history, current managed-setting snapshots and retained activity from versions that record it. Snapshots are not a complete historical event log. Retention, clearing or recording failures can leave activity gaps. Windows or another app may change settings during collection.',
    privacy: 'Local paths, startup commands, cursor images, user-defined plan names, review tokens, internal record identifiers and raw provider errors are omitted.',
    restoration: 'Diagnostic report only. It cannot be imported to restore settings. Keep the original local PANDORA backups; cleanup and manual NVIDIA changes are outside rollback.',
    sections, activity,
  };
}
