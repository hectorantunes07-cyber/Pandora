import { createFortniteService } from '../electron/fortnite-settings';
import { createFortniteFileAdapter } from '../electron/fortnite-file';
import { createPowerTuningService } from '../electron/power-tuning';
import { createActivityService } from '../electron/activity';
import { collectHistoryReport } from '../electron/history-report';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VISUAL_EFFECTS, type VisualEffectId } from '../shared/visual-effects';
import { createVisualEffectsService } from '../electron/visual-effects';
import { createCursorService } from '../electron/cursor';
import { createRestoreService } from '../electron/restore-all';
import { createTweakService, type RegistryValue } from '../electron/tweaks';
import { createPowerService } from '../electron/power';
import { createPointerService } from '../electron/pointer';
import { createStartupService, type StartupValue } from '../electron/startup';
const A = '381b4222-f694-41f0-9685-ff5bb260df2e', B = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
describe('reviewed restoration across all managed features', () => {
  let dir: string, values: Map<string, RegistryValue>, launchers: Map<string, StartupValue>, current: string, writes: string[];
  const command = { kind: 'ExpandString' as const, text: '"%LOCALAPPDATA%\\original.exe" --startup' };
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-restore-all-')); values = new Map(); launchers = new Map([['discord', command], ['steam', command]]); current = A; writes = []; });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  function services() {
    return {
      fortnite: createFortniteService(dir, createFortniteFileAdapter(dir, async () => false, false)),
      powerTuning: createPowerTuningService(dir, { supported: false, read: async () => { throw new Error('unavailable'); }, write: async () => {} }),
      cursor: createCursorService(dir, path.resolve('public/cursors/sonnier.cur'), { supported: false, read: async () => { throw new Error('Unavailable'); }, write: async () => {}, preview: async () => null }),
      visual: createVisualEffectsService(dir, { supported: false, read: async () => { throw new Error('unavailable'); }, write: async () => {} }),
      pointer: createPointerService(dir, { supported: true, read: async () => [6, 10, 0], write: async () => { throw new Error('No pointer changes were applied in this fixture'); } }),
      tweaks: createTweakService(dir, { adapter: { supported: true, read: async t => values.get(t.id) ?? { kind: 'absent' }, write: async (t, v) => { writes.push(t.id); values.set(t.id, v); } } }),
      power: createPowerService(dir, { supported: true, read: async () => ({ currentId: current, plans: [A, B].map(id => ({ id, name: id })) }), set: async id => { writes.push('power'); current = id; } }),
      startup: createStartupService(dir, { supported: true, read: async a => launchers.get(a.id) ?? { kind: 'absent' }, write: async (a, v) => { writes.push(a.id); launchers.set(a.id, v); } }),
    };
  }
  async function populate(s: ReturnType<typeof services>) {
    await s.tweaks.applyProfile((await s.tweaks.previewProfile('custom', ['file-extensions'])).token);
    await s.tweaks.applyTweaks(['transparency']);
    await s.power.apply(B, A);
    const entries = await s.startup.getControls();
    for (const id of ['discord', 'steam']) expect((await s.startup.change(entries.find(e => e.id === id)!.token!, false)).success).toBe(true);
    writes.length = 0;
  }
  it('restores a saved Fortnite configuration with other changes and skips a running game', async () => {
    const s = services(), local = path.join(dir, 'local');
    const config = path.join(local, 'FortniteGame/Saved/Config/WindowsClient/GameUserSettings.ini');
    const original = Buffer.from('[/Script/FortniteGame.FortGameUserSettings]\r\nFrameRateLimit=144.000000\r\nbUseVSync=True\r\nbUseDynamicResolution=False\r\n');
    await fs.mkdir(path.dirname(config), { recursive: true }); await fs.writeFile(config, original);
    let running = false;
    const adapter = createFortniteFileAdapter(local, async () => running, true);
    s.fortnite = createFortniteService(dir, adapter);
    await s.fortnite.change((await s.fortnite.preview({ frameRateLimit: 240, vsync: false, dynamicResolution: false }, false)).token);
    await populate(s); running = true;
    const recovery = createRestoreService(s), blocked = await recovery.preview();
    expect(blocked.items.find(i => i.id === 'fortnite-config')).toMatchObject({ eligible: false });
    const results = await recovery.restore(blocked.token);
    expect(results.filter(r => !r.success)).toMatchObject([{ id: 'fortnite-config' }]);
    expect((await s.fortnite.getInfo()).managed).toBe(true);
    running = false; s.fortnite = createFortniteService(dir, adapter);
    const reopened = createRestoreService(s), reviewed = await reopened.preview();
    expect(reviewed.items).toHaveLength(1);
    expect(reviewed.items[0]).toMatchObject({ id: 'fortnite-config', eligible: true, original: 'Frame rate limit: 144 FPS · V-Sync: On' });
    expect((await reopened.restore(reviewed.token))[0].success).toBe(true);
    expect(await fs.readFile(config)).toEqual(original);
  }, 30_000); // Includes two cold native Windows file replacements.
  it('exports saved cross-feature originals after relaunch without changing Windows or deleting backups', async () => {
    await populate(services());
    const s = services();
    const report = await collectHistoryReport({ fortnite: () => s.fortnite.getInfo(), activity: () => createActivityService(dir).get(), history: () => s.tweaks.getHistory(), preferences: () => s.tweaks.getTweaks(), profile: () => s.tweaks.getProfile(), power: () => s.power.getInfo(), powerTuning: () => s.powerTuning.getInfo(), startup: () => s.startup.getControls(), pointer: () => s.pointer.getInfo(), visual: () => s.visual.getStates(), cursor: () => s.cursor.getInfo() }, 'test');
    expect(report.collectionComplete).toBe(true);
    expect(report.sections.power).toMatchObject({ data: { currentPlanId: B, backup: { originalPlanId: A, appliedPlanId: B, status: 'applied' } } });
    expect(report.sections.startup).toMatchObject({ data: expect.arrayContaining([{ id: 'discord', name: 'Discord', managed: true, state: 'disabled', currentEntryPresent: false, savedOriginalPresent: true }]) });
    expect(report.sections.profile).toMatchObject({ data: { ownedIds: ['file-extensions'] } });
    expect(JSON.stringify(report)).not.toContain('original.exe');
    expect(writes).toEqual([]);
    const recovery = createRestoreService(services());
    const results = await recovery.restore((await recovery.preview()).token);
    expect(results.every(r => r.success)).toBe(true);
    expect(current).toBe(A); expect(launchers.get('discord')).toEqual(command);
  });
  it('restores originals after relaunch, including multiple startup tokens and individual preferences', async () => {
    await populate(services());
    const reopened = services(), recovery = createRestoreService(reopened);
    const preview = await recovery.preview(); expect(preview.items).toHaveLength(6); expect(writes).toEqual([]);
    const results = await recovery.restore(preview.token); expect(results).toHaveLength(6); expect(results.every(r => r.success)).toBe(true);
    expect(current).toBe(A); expect(launchers.get('discord')).toEqual(command); expect(launchers.get('steam')).toEqual(command);
    expect(values.get('file-extensions')).toEqual({ kind: 'absent' }); expect(values.get('transparency')).toEqual({ kind: 'absent' });
    expect(await reopened.tweaks.getProfile()).toMatchObject({ selection: null, ownedIds: [], customIds: ['file-extensions'] });
    expect((await recovery.preview()).items).toEqual([]);
  });
  it('rejects changed and reused reviews before any write', async () => {
    const s = services(); await populate(s); const recovery = createRestoreService(s);
    const preview = await recovery.preview(); launchers.set('discord', { kind: 'String', text: 'external.exe' });
    await expect(recovery.restore(preview.token)).rejects.toThrow(/state changed/); expect(writes).toEqual([]);
    await expect(recovery.restore(preview.token)).rejects.toThrow(/Review all/);
  });
  it('preserves conflicts and the selected profile while restoring unrelated changes', async () => {
    const s = services(); await populate(s);
    values.set('file-extensions', { kind: 'dword', value: 42 }); launchers.set('discord', { kind: 'String', text: 'external.exe' });
    const recovery = createRestoreService(s), preview = await recovery.preview();
    expect(preview.items.filter(i => !i.eligible)).toHaveLength(2);
    const results = await recovery.restore(preview.token); expect(results.filter(r => !r.success)).toHaveLength(3);
    expect(current).toBe(A); expect(values.get('transparency')).toEqual({ kind: 'absent' });
    expect(values.get('file-extensions')).toEqual({ kind: 'dword', value: 42 }); expect(launchers.get('discord')).toEqual({ kind: 'String', text: 'external.exe' });
    expect((await s.tweaks.getProfile()).selection?.id).toBe('custom'); expect(writes).not.toContain('discord'); expect(writes).not.toContain('file-extensions');
  });
  it('fails closed on an unreadable backup instead of restoring a silently incomplete set', async () => {
    const s = services(); await populate(s); await fs.writeFile(path.join(dir, 'backups/startup-v1.json'), '{broken');
    await expect(createRestoreService(s).preview()).rejects.toThrow(/preserved/); expect(writes).toEqual([]);
  });
  it('includes saved pointer API values in the combined review and exact restoration', async () => {
    let current: import('../shared/types').PointerValues = [6, 10, 1];
    const s = services(); s.pointer = createPointerService(dir, { supported: true, read: async () => [...current], write: async v => { current = [...v]; } });
    await s.pointer.change((await s.pointer.getInfo()).token, false);
    const recovery = createRestoreService(s), preview = await recovery.preview();
    expect(preview.items).toMatchObject([{ id: 'pointer', original: '6, 10, 1', current: '6, 10, 0', eligible: true }]);
    expect((await recovery.restore(preview.token))[0].success).toBe(true); expect(current).toEqual([6, 10, 1]);
  });
  it('skips a temporarily unavailable native provider while restoring unrelated valid backups', async () => {
    const s = services(); await populate(s);
    let current: import('../shared/types').PointerValues = [6, 10, 1], unavailable = false;
    s.pointer = createPointerService(dir, { supported: true, read: async () => { if (unavailable) throw new Error('Provider denied'); return [...current]; }, write: async v => { current = [...v]; } });
    await s.pointer.change((await s.pointer.getInfo()).token, false); unavailable = true;
    const recovery = createRestoreService(s), preview = await recovery.preview();
    expect(preview.items.find(i => i.id === 'pointer')).toMatchObject({ eligible: false, current: 'Unavailable' });
    const results = await recovery.restore(preview.token);
    expect(results.find(r => r.id === 'pointer')?.success).toBe(false);
    expect(results.filter(r => r.id !== 'pointer').every(r => r.success)).toBe(true); expect(current).toEqual([6, 10, 0]);
    unavailable = false; expect((await s.pointer.getInfo()).managed).toBe(true);
  });
  it('does not overwrite a late external edit when another category is already restored', async () => {
    const s = services(); await populate(s);
    const revert = s.tweaks.revertTweaks;
    s.tweaks.revertTweaks = async ids => { launchers.set('discord', { kind: 'String', text: 'late.exe' }); return revert(ids); };
    const recovery = createRestoreService(s), preview = await recovery.preview();
    const results = await recovery.restore(preview.token);
    expect(results.find(r => r.id === 'startup:discord')?.success).toBe(false);
    expect(writes).not.toContain('discord'); expect(launchers.get('discord')).toEqual({ kind: 'String', text: 'late.exe' });
    expect(launchers.get('steam')).toEqual(command); expect(current).toBe(A);
  });
  it('includes every managed visual preference and retains unavailable originals', async () => {
    const s = services();
    const current = Object.fromEntries(VISUAL_EFFECTS.map(e => [e.id, true])) as Record<VisualEffectId, boolean | null>;
    s.visual = createVisualEffectsService(dir, { supported: true, read: async () => ({ ...current }), write: async (id, value) => { current[id] = value; } });
    const states = await s.visual.getStates();
    await s.visual.change(states.find(e => e.id === 'menu-animation')!.token, false);
    await s.visual.change(states.find(e => e.id === 'tooltip-animation')!.token, false);
    current['tooltip-animation'] = null;
    const recovery = createRestoreService(s), preview = await recovery.preview();
    expect(preview.items.find(e => e.id === 'visual:tooltip-animation')).toMatchObject({ eligible: false, current: 'Unavailable' });
    const results = await recovery.restore(preview.token);
    expect(results.find(e => e.id === 'visual:menu-animation')?.success).toBe(true);
    expect(results.find(e => e.id === 'visual:tooltip-animation')?.success).toBe(false);
    expect(current['menu-animation']).toBe(true);
    expect((await s.visual.getStates()).find(e => e.id === 'tooltip-animation')?.managed).toBe(true);
  });

  it('includes managed custom cursor in combined restore and rejects corrupt cursor journals', async () => {
    let arrow = { kind: 'String' as const, value: '' };
    const s = services();
    s.cursor = createCursorService(dir, path.resolve('public/cursors/sonnier.cur'), { supported: true, read: async () => arrow, write: async (_expected, desired) => { arrow = desired as typeof arrow; }, preview: async () => null });
    await s.cursor.change((await s.cursor.getInfo()).token, false);
    const recovery = createRestoreService(s), reviewed = await recovery.preview();
    expect(reviewed.items.find(i => i.id === 'cursor')?.eligible).toBe(true);
    expect((await recovery.restore(reviewed.token)).find(i => i.id === 'cursor')?.success).toBe(true);
    expect(arrow).toEqual({ kind: 'String', value: '' });
    await fs.writeFile(path.join(dir, 'backups/cursor-v1.json'), '{bad');
    await expect(recovery.preview()).rejects.toThrow('preserved');
  });

  it.each([[5, 50, 100, 100], [100, 100, 5, 50]])('restores CPU bounds in a valid order: %j', async (originalMin, originalMax, changedMin, changedMax) => {
    const s = services(), policy: Record<string, number | null> = { 'cpu-minimum': originalMin, 'cpu-maximum': originalMax };
    s.powerTuning = createPowerTuningService(dir, { supported: true, read: async () => ({ planId: A, activePlanId: A, values: { ...policy } }), write: async (_plan, _active, id, expected, desired) => { expect(policy[id]).toBe(expected); const low = id === 'cpu-minimum' ? desired : policy['cpu-minimum']!; const high = id === 'cpu-maximum' ? desired : policy['cpu-maximum']!; if (low > high) throw new Error('Invalid bounds'); policy[id] = desired; } });
    const changes = changedMin > originalMin ? [['cpu-maximum', changedMax], ['cpu-minimum', changedMin]] : [['cpu-minimum', changedMin], ['cpu-maximum', changedMax]];
    for (const [id, value] of changes) expect((await s.powerTuning.change((await s.powerTuning.preview(id, value, false)).token)).success).toBe(true);
    const recovery = createRestoreService(s), review = await recovery.preview();
    expect((await recovery.restore(review.token)).every(r => r.success)).toBe(true);
    expect(policy).toEqual({ 'cpu-minimum': originalMin, 'cpu-maximum': originalMax });
  });

});
