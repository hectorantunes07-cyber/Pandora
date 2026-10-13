import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createVisualEffectsService, type VisualEffectsAdapter } from '../electron/visual-effects';
import { VISUAL_EFFECTS, type VisualEffectId } from '../shared/visual-effects';
describe('reversible visual preferences', () => {
  let dir: string, current: Record<VisualEffectId, boolean | null>, writes: [VisualEffectId, boolean][], adapter: VisualEffectsAdapter;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-effects-')); current = Object.fromEntries(VISUAL_EFFECTS.map(e => [e.id, true])) as typeof current; writes = []; adapter = { supported: true, read: async () => ({ ...current }), write: async (id, value) => { writes.push([id, value]); current[id] = value; } }; });
  afterEach(async () => { vi.restoreAllMocks(); await fs.rm(dir, { recursive: true, force: true }); });
  const change = async (s: ReturnType<typeof createVisualEffectsService>, id: VisualEffectId, restore = false) => s.change((await s.getStates()).find(e => e.id === id)!.token, restore);
  it.each(VISUAL_EFFECTS)('backs up $id before writing and restores it after relaunch', async ({ id }) => {
    const write = adapter.write;
    adapter.write = async (key, value) => { const backup = JSON.parse(await fs.readFile(path.join(dir, 'backups/visual-effects-v1.json'), 'utf8')); expect(backup.records).toContainEqual(expect.objectContaining({ id, original: true, applied: false, status: 'pending' })); await write(key, value); };
    expect((await change(createVisualEffectsService(dir, adapter), id)).success).toBe(true); expect(current[id]).toBe(false);
    expect((await change(createVisualEffectsService(dir, adapter), id, true)).success).toBe(true); expect(current[id]).toBe(true);
    expect(writes).toEqual([[id, false], [id, true]]);
  });
  it('retains independent reviews during batch restoration and never claims effects already off', async () => {
    current['cursor-shadow'] = false; const s = createVisualEffectsService(dir, adapter);
    await change(s, 'cursor-shadow'); expect((await s.getStates()).find(e => e.id === 'cursor-shadow')?.managed).toBe(false); expect(writes).toEqual([]);
    const reviews = await s.getStates();
    for (const id of ['menu-animation', 'tooltip-animation']) expect((await s.change(reviews.find(e => e.id === id)!.token, false)).success).toBe(true);
    const restores = await s.getStates();
    for (const r of restores.filter(e => e.managed)) expect((await s.change(r.token, true)).success).toBe(true);
    expect(writes).toHaveLength(4);
  });
  it('rejects stale, expired, reused and invalid approvals without writing', async () => {
    const s = createVisualEffectsService(dir, adapter); const r = (await s.getStates())[0]; current[r.id] = false;
    await expect(s.change(r.token, false)).rejects.toThrow(/after review/); await expect(s.change(r.token, false)).rejects.toThrow(/review/);
    const second = (await s.getStates())[1]; vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
    await expect(s.change(second.token, false)).rejects.toThrow(/review/); await expect(s.change({}, false)).rejects.toThrow(/review/); expect(writes).toEqual([]);
  });
  it('stops a last-moment external change before the first write', async () => {
    let reads = 0; const read = adapter.read; adapter.read = async () => { if (++reads === 3) current['menu-animation'] = false; return read(); };
    const s = createVisualEffectsService(dir, adapter); await expect(change(s, 'menu-animation')).rejects.toThrow(/before writing/);
    expect(writes).toEqual([]); expect((await s.getStates()).find(e => e.id === 'menu-animation')?.managed).toBe(false);
  });
  it('retains originals after write-then-error and reports unavailable providers without discarding backups', async () => {
    const write = adapter.write; adapter.write = async (id, v) => { await write(id, v); throw new Error('transport'); };
    const s = createVisualEffectsService(dir, adapter); expect((await change(s, 'menu-animation')).success).toBe(false); expect(writes).toHaveLength(1);
    const read = adapter.read; adapter.read = async () => { throw new Error('denied'); };
    expect((await s.getStates()).find(e => e.id === 'menu-animation')).toMatchObject({ current: null, original: true, managed: true, token: null });
    adapter.read = read; adapter.write = write; expect((await change(createVisualEffectsService(dir, adapter), 'menu-animation', true)).success).toBe(true);
  });
  it('closes an externally restored backup without overwriting it and rejects corrupt journals', async () => {
    const s = createVisualEffectsService(dir, adapter); await change(s, 'menu-animation'); current['menu-animation'] = true;
    expect((await change(s, 'menu-animation', true)).success).toBe(true); expect(writes).toHaveLength(1);
    await fs.writeFile(path.join(dir, 'backups/visual-effects-v1.json'), JSON.stringify({ version: 1, records: [{ id: 'unknown', original: true, applied: false, status: 'applied', timestamp: new Date().toISOString() }] }));
    await expect(s.getStates()).rejects.toThrow(/preserved/); expect(writes).toHaveLength(1);
  });
});
