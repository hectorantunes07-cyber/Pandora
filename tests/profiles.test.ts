import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTweakService, type RegistryAdapter, type RegistryValue } from '../electron/tweaks';
describe('owned preset switching', () => {
  let dir: string, values: Map<string, RegistryValue>, writes: string[], adapter: RegistryAdapter;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-profiles-')); values = new Map(); writes = []; adapter = { supported: true, read: async t => values.get(t.id) ?? { kind: 'absent' }, write: async (t, v) => { writes.push(t.id); values.set(t.id, v); } }; });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const use = async (service: ReturnType<typeof createTweakService>, id: string | null, custom?: string[]) => service.applyProfile((await service.previewProfile(id, custom)).token);
  it('reviews without mutation, applies competitive, restores capture when switching and restores originals on off', async () => {
    const service = createTweakService(dir, { adapter });
    const preview = await service.previewProfile('competitive');
    expect(writes).toEqual([]); expect(preview.changes.map(c => c.action)).toEqual(['apply', 'apply']);
    expect((await service.applyProfile(preview.token)).every(r => r.success)).toBe(true);
    expect(await service.getProfile()).toMatchObject({ selection: { id: 'competitive' }, ownedIds: ['game-mode', 'game-capture'], complete: true });
    const reopened = createTweakService(dir, { adapter });
    const next = await reopened.previewProfile('streaming');
    expect(next.changes.find(c => c.id === 'game-capture')?.action).toBe('restore');
    await reopened.applyProfile(next.token);
    expect(values.get('game-capture')).toEqual({ kind: 'absent' });
    expect((await reopened.getProfile()).ownedIds).toEqual(['game-mode']);
    await use(reopened, null);
    expect(values.get('game-mode')).toEqual({ kind: 'absent' });
    expect(await reopened.getProfile()).toMatchObject({ selection: null, ownedIds: [], complete: true });
  });
  it('preserves individually managed and pre-existing preferences across switch and off', async () => {
    const service = createTweakService(dir, { adapter });
    await service.applyTweaks(['game-capture']);
    values.set('game-mode', { kind: 'dword', value: 1 });
    await use(service, 'competitive'); await use(service, 'balanced'); await use(service, null);
    expect(writes).toEqual(['game-capture']);
    expect(values.get('game-mode')).toEqual({ kind: 'dword', value: 1 });
    expect((await service.getTweaks()).find(t => t.id === 'game-capture')?.managed).toBe(true);
  });
  it('rejects stale, reused and expired reviews before new changes', async () => {
    let time = new Date(); const service = createTweakService(dir, { adapter, now: () => time });
    const stale = await service.previewProfile('balanced'); values.set('game-mode', { kind: 'dword', value: 7 });
    await expect(service.applyProfile(stale.token)).rejects.toThrow(/changed since/);
    const expired = await service.previewProfile('balanced'); time = new Date(time.getTime() + 301_000);
    await expect(service.applyProfile(expired.token)).rejects.toThrow(/expired/);
    const valid = await service.previewProfile('balanced'); await service.applyProfile(valid.token);
    await expect(service.applyProfile(valid.token)).rejects.toThrow(/expired/);
    expect(writes).toEqual(['game-mode']);
  });
  it('blocks a conflicting old profile and does not apply new preferences', async () => {
    const service = createTweakService(dir, { adapter }); await use(service, 'competitive');
    values.set('game-capture', { kind: 'dword', value: 42 });
    const review = await service.previewProfile('creator'); expect(review.blocked).toBe(true);
    await expect(service.applyProfile(review.token)).rejects.toThrow(/conflict/);
    expect(writes).toEqual(['game-mode', 'game-capture']);
  });
  it('keeps custom selections through other profiles and reports skipped unsupported items', async () => {
    const service = createTweakService(dir, { adapter });
    await use(service, 'custom', ['file-extensions', 'explorer-checkboxes']);
    await use(service, 'balanced');
    expect((await createTweakService(dir, { adapter }).getProfile()).customIds).toEqual(['file-extensions', 'explorer-checkboxes']);
    values.set('game-capture', { kind: 'unsupported', type: 'String' });
    const preview = await service.previewProfile('competitive');
    expect(preview.changes.find(c => c.id === 'game-capture')?.action).toBe('skip');
    await service.applyProfile(preview.token); expect((await service.getProfile()).complete).toBe(false);
  });
  it('stops a switch if old restoration fails and retains originals for recovery', async () => {
    const service = createTweakService(dir, { adapter }); await use(service, 'competitive');
    const set = adapter.write;
    adapter.write = async (t, v) => { if (t.id === 'game-mode' && v.kind === 'absent') throw new Error('Denied'); await set(t, v); };
    const results = await use(service, 'creator'); expect(results.some(r => !r.success)).toBe(true);
    expect(writes).not.toContain('file-extensions');
    const reopened = createTweakService(dir, { adapter }); expect((await reopened.getProfile()).complete).toBe(false);
    expect((await reopened.getHistory()).some(e => e.tweakId === 'game-mode' && e.status === 'applied')).toBe(true);
  });
  it('preserves an external edit made after final review but before an individual backup', async () => {
    const read = adapter.read; let reads = 0;
    adapter.read = async t => { if (t.id === 'game-mode' && ++reads === 3) values.set(t.id, { kind: 'dword', value: 42 }); return read(t); };
    const service = createTweakService(dir, { adapter });
    const result = await use(service, 'balanced');
    expect(result[0].success).toBe(false); expect(writes).toEqual([]);
    expect(values.get('game-mode')).toEqual({ kind: 'dword', value: 42 });
  });
  it('validates custom identifiers and old journals while refusing corrupt ownership metadata', async () => {
    const service = createTweakService(dir, { adapter });
    await expect(service.previewProfile('unknown')).rejects.toThrow(/Unknown/);
    await expect(service.previewProfile('custom', ['arbitrary-registry-path'])).rejects.toThrow(/catalog/);
    await use(service, 'balanced');
    const file = path.join(dir, 'backups/tweaks-v1.json'); const data = JSON.parse(await fs.readFile(file, 'utf8'));
    data.records[0].profileManaged = 'yes'; await fs.writeFile(file, JSON.stringify(data));
    await expect(createTweakService(dir, { adapter }).getProfile()).rejects.toThrow(/backups/);
    expect(writes).toEqual(['game-mode']);
  });
});
