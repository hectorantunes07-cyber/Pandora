import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createPointerService, type PointerAdapter } from '../electron/pointer';
import type { PointerValues } from '../shared/types';
describe('reversible Windows pointer acceleration', () => {
  let dir: string, current: PointerValues, writes: PointerValues[], adapter: PointerAdapter;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-pointer-')); current = [6, 10, 1]; writes = []; adapter = { supported: true, read: async () => [...current], write: async v => { writes.push([...v]); current = [...v]; } }; });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const change = async (s: ReturnType<typeof createPointerService>, restore = false) => s.change((await s.getInfo()).token, restore);
  it('saves exact API values before writing and restores them after relaunch', async () => {
    const write = adapter.write;
    adapter.write = async v => { expect(JSON.parse(await fs.readFile(path.join(dir, 'backups/pointer-v1.json'), 'utf8'))).toMatchObject({ original: [6, 10, 1], applied: [6, 10, 0], status: 'pending' }); await write(v); };
    expect((await change(createPointerService(dir, adapter))).success).toBe(true); expect(current).toEqual([6, 10, 0]);
    expect((await change(createPointerService(dir, adapter), true)).success).toBe(true); expect(current).toEqual([6, 10, 1]);
    expect(writes).toEqual([[6, 10, 0], [6, 10, 1]]);
  });
  it('does not claim an already-disabled setting or reuse stale approval', async () => {
    current = [0, 0, 0]; const s = createPointerService(dir, adapter); const review = await s.getInfo();
    expect((await s.change(review.token, false)).success).toBe(true); expect((await s.getInfo()).managed).toBe(false); expect(writes).toEqual([]);
    await expect(s.change(review.token, false)).rejects.toThrow(/Refresh/);
  });
  it('preserves external threshold/mode changes and rejects post-review changes', async () => {
    const s = createPointerService(dir, adapter); const review = await s.getInfo(); current = [3, 5, 2];
    await expect(s.change(review.token, false)).rejects.toThrow(/after review/); expect(writes).toEqual([]);
    await change(s); current = [7, 8, 1]; expect((await s.getInfo()).conflict).toBe(true);
    await expect(change(s, true)).rejects.toThrow(/external pointer/); expect(writes).toHaveLength(1); expect(current).toEqual([7, 8, 1]);
  });
  it('stops after a race at the final pre-write read without claiming ownership', async () => {
    let reads = 0; const read = adapter.read;
    adapter.read = async () => { if (++reads === 3) current = [6, 10, 0]; return read(); };
    const s = createPointerService(dir, adapter); await expect(change(s)).rejects.toThrow(/before writing/);
    expect(writes).toEqual([]); expect((await s.getInfo()).managed).toBe(false);
  });
  it('retains recoverable originals after write-then-error and rejects corrupt backups', async () => {
    const write = adapter.write; adapter.write = async v => { await write(v); throw new Error('transport'); };
    expect((await change(createPointerService(dir, adapter))).success).toBe(false); expect(writes).toHaveLength(1);
    adapter.write = write; expect((await change(createPointerService(dir, adapter), true)).success).toBe(true);
    await fs.writeFile(path.join(dir, 'backups/pointer-v1.json'), '{broken');
    await expect(createPointerService(dir, adapter).getInfo()).rejects.toThrow(/preserved/); expect(writes).toHaveLength(2);
  });
  it('recovers a pending journal when originals are already present, without writing', async () => {
    await fs.mkdir(path.join(dir, 'backups')); await fs.writeFile(path.join(dir, 'backups/pointer-v1.json'), JSON.stringify({ version: 1, original: current, applied: [6, 10, 0], status: 'pending', timestamp: new Date().toISOString() }));
    expect((await change(createPointerService(dir, adapter), true)).success).toBe(true); expect(writes).toEqual([]);
    adapter.supported = false; expect((await createPointerService(dir, adapter).getInfo()).supported).toBe(false);
  });
});
