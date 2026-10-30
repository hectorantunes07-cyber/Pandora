import { describe, expect, it, vi } from 'vitest';
import { collectHistoryReport, type HistoryReportSources } from '../electron/history-report';
const plan = '381b4222-f694-41f0-9685-ff5bb260df2e';
const privateText = 'C:\\Users\\PRIVATE_SENTINEL\\secret.exe --private';
function fixture(): HistoryReportSources {
  return {
    activity: async () => ({ available: true, entries: [], limit: 500, discarded: 0, clearedAt: null, incomplete: false, warning: null }),
    history: async () => [{ id: privateText, tweakId: 'game-mode', title: privateText, timestamp: '2026-10-01T00:00:00Z', status: 'applied', originalValue: null, appliedValue: 1, message: privateText }],
    preferences: async () => [],
    profile: async () => ({ selection: { id: 'custom', ids: ['game-mode'] }, ownedIds: ['game-mode'], customIds: ['game-mode'], complete: true }),
    power: async () => ({ supported: true, currentId: plan, plans: [{ id: plan, name: privateText }], backup: { version: 1, originalId: plan, appliedId: plan, status: 'applied', intent: 'apply', timestamp: '2026-10-01T00:00:00Z' }, conflict: false, reason: privateText }),
    powerTuning: async () => ({ supported: true, planId: plan, activePlanId: plan, states: [{ id: 'cpu-minimum', managed: true, original: 5, applied: 0, current: 25, conflict: true }], reason: privateText }),
    startup: async () => [{ id: 'discord', name: privateText, current: null, original: privateText, managed: true, status: 'disabled', token: privateText, reason: privateText }],
    pointer: async () => ({ supported: true, managed: true, conflict: false, current: [6, 10, 0], original: [6, 10, 1], token: privateText, reason: privateText }),
    visual: async () => [{ id: 'menu-animation', managed: true, current: false, original: true, token: privateText, reason: privateText }],
    cursor: async () => ({ supported: true, managed: true, conflict: true, current: { kind: 'String', value: privateText }, original: { kind: 'ExpandString', value: privateText }, currentPreview: privateText, selected: { id: privateText, name: privateText, kind: 'cur', width: 32, height: 32, x: 0, y: 0, preview: privateText, cssCursor: privateText }, useInApp: true, token: privateText, reason: privateText }),
  };
}
describe('managed settings report', () => {
  it('exports retained activity without record identifiers, raw warnings or extra payload fields', async () => {
    const sources = fixture();
    sources.activity = async () => ({ available: true, entries: [{ id: privateText, action: 'clean', startedAt: '2026-10-30T00:00:00.000Z', endedAt: null, status: 'unconfirmed', succeeded: null, notConfirmed: null, cleanup: null }], limit: 500, discarded: 3, clearedAt: null, incomplete: true, warning: privateText });
    const r = await collectHistoryReport(sources, '0.1.0');
    expect(r.activity).toMatchObject({ status: 'available', data: { incomplete: true, discarded: 3, entries: [{ title: 'PC cleanup', status: 'unconfirmed' }] } });
    expect(JSON.stringify(r)).not.toContain('PRIVATE_SENTINEL');
    sources.activity = async () => ({ available: false, entries: [], limit: 500, discarded: 0, clearedAt: null, incomplete: true, warning: privateText });
    const failed = await collectHistoryReport(sources, '0.1.0');
    expect(failed.collectionComplete).toBe(false); expect(failed.activity.status).toBe('unavailable');
  });
  it('includes all supported snapshot sections and preserves null originals, zero values and conflicts', async () => {
    const sources = fixture(); const r = await collectHistoryReport(sources, '0.1.0');
    expect(r.schemaVersion).toBe(2); expect(r.collectionComplete).toBe(true);
    expect(Object.keys(r.sections)).toHaveLength(9);
    expect(r.sections.history).toMatchObject({ data: [{ originalValue: null, appliedValue: 1 }] });
    expect(r.sections.powerTuning).toMatchObject({ data: { states: [{ original: 5, applied: 0, current: 25, conflict: true }] } });
    expect(r.sections.pointer).toMatchObject({ data: { original: [6, 10, 1], current: [6, 10, 0] } });
    expect(r.sections.profile).toMatchObject({ data: { selection: { id: 'custom' }, ownedIds: ['game-mode'] } });
    expect(r.sections.startup).toMatchObject({ data: [{ name: 'Discord', currentEntryPresent: false, savedOriginalPresent: true }] });
    expect(r.sections.cursor).toMatchObject({ data: { originalSaved: true, currentReadable: true, conflict: true, selectedFormat: 'cur' } });
    expect(r.restoration).toContain('cannot be imported'); expect(r.scope).toContain('not a complete historical event log');
  });
  it('omits sensitive free text, paths, commands, cursor pixels and review tokens throughout JSON', async () => {
    const report = JSON.stringify(await collectHistoryReport(fixture(), '0.1.0'));
    expect(report).not.toContain('PRIVATE_SENTINEL');
    for (const key of ['"token"', '"preview"', '"cssCursor"', '"message"', '"plans"']) expect(report).not.toContain(key);
    expect(report).toContain('Discord');
  });
  it('keeps a rejected or corrupt section visibly unavailable without leaking its error or hiding other originals', async () => {
    const sources = fixture(); sources.power = vi.fn(async () => { throw new Error(privateText); });
    const r = await collectHistoryReport(sources, '0.1.0');
    expect(r.collectionComplete).toBe(false); expect(r.sections.power).toMatchObject({ status: 'unavailable', data: null });
    expect(r.sections.history.status).toBe('available'); expect(r.sections.pointer.status).toBe('available');
    expect(JSON.stringify(r)).not.toContain('PRIVATE_SENTINEL'); expect(sources.power).toHaveBeenCalledOnce();
  });
  it('preserves unavailable native values rather than treating missing readings as off or absent', async () => {
    const sources = fixture(); sources.pointer = async () => ({ supported: false, current: null, original: [6, 10, 1], managed: true, conflict: false, token: null });
    sources.startup = async () => [{ id: 'steam', name: 'Steam', current: null, original: privateText, managed: true, status: 'unavailable', token: null, reason: privateText }];
    const r = await collectHistoryReport(sources, '0.1.0');
    expect(r.sections.pointer).toMatchObject({ data: { supported: false, current: null, original: [6, 10, 1], managed: true } });
    expect(r.sections.startup).toMatchObject({ data: [{ currentEntryPresent: null, savedOriginalPresent: true }] });
  });
  it('rejects unknown catalog identities and non-GUID power names rather than exporting arbitrary data', async () => {
    const sources = fixture(); const base = await sources.power(); sources.power = async () => ({ ...base, currentId: privateText });
    const record = (await sources.history())[0]; sources.history = async () => [{ ...record, tweakId: privateText }];
    const r = await collectHistoryReport(sources, '0.1.0');
    expect(r.sections.power.status).toBe('unavailable'); expect(r.sections.history.status).toBe('unavailable');
    expect(JSON.stringify(r)).not.toContain('PRIVATE_SENTINEL');
  });
  it('records the collection interval and copies mutable values', async () => {
    const sources = fixture(), pointer = await sources.pointer(); sources.pointer = async () => pointer;
    const dates = [new Date('2026-10-01T00:00:00Z'), new Date('2026-10-01T00:00:02Z')];
    const r = await collectHistoryReport(sources, '0.1.0', () => dates.shift()!);
    pointer.current![0] = 99;
    expect(r.sections.pointer).toMatchObject({ data: { current: [6, 10, 0] } });
    expect(r.startedAt).toBe('2026-10-01T00:00:00.000Z'); expect(r.completedAt).toBe('2026-10-01T00:00:02.000Z');
  });
});
