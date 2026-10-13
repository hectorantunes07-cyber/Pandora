import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPowerService, parsePowerPlans, type PowerAdapter } from '../electron/power';
const A = '381b4222-f694-41f0-9685-ff5bb260df2e', B = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', C = 'a1841308-3541-4fab-bc81-f71556f20b4a';
describe('reviewed Windows power-plan changes', () => {
  let dir: string, current: string, adapter: PowerAdapter, writes: string[];
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-power-')); current = A; writes = []; adapter = { supported: true, read: async () => ({ currentId: current, plans: [A, B, C].map(id => ({ id, name: id })) }), set: async id => { writes.push(id); current = id; } }; });
  afterEach(async () => { vi.restoreAllMocks(); await fs.rm(dir, { recursive: true, force: true }); });
  it('saves the original before writing and restores exactly after relaunch', async () => {
    const set = adapter.set;
    adapter.set = async id => { expect(JSON.parse(await fs.readFile(path.join(dir, 'backups/power-v1.json'), 'utf8'))).toMatchObject({ originalId: A, appliedId: B, status: 'pending' }); await set(id); };
    expect((await createPowerService(dir, adapter).apply(B, A)).success).toBe(true);
    const reopened = createPowerService(dir, adapter);
    expect((await reopened.getInfo()).backup?.status).toBe('applied');
    expect((await reopened.restore(B)).success).toBe(true);
    expect(current).toBe(A); expect(writes).toEqual([B, A]);
    expect((await reopened.getInfo()).backup?.status).toBe('reverted');
  });
  it('does not claim an existing plan or overwrite an active original', async () => {
    const service = createPowerService(dir, adapter);
    await service.apply(A, A); expect((await service.getInfo()).backup).toBeNull();
    await service.apply(B, A);
    await expect(service.apply(C, B)).rejects.toThrow(/Restore the previous/);
    expect(writes).toEqual([B]);
  });
  it('refuses stale reviews, foreign changes, removed plans and command-like inputs', async () => {
    const service = createPowerService(dir, adapter);
    await expect(service.apply(B, C)).rejects.toThrow(/changed after/);
    await expect(service.apply('deadbeef-1111-2222-3333-444444444444', A)).rejects.toThrow(/no longer installed/);
    await expect(service.apply('/delete ALL', A)).rejects.toThrow(/valid installed/);
    await service.apply(B, A); current = C;
    expect((await service.getInfo()).conflict).toBe(true);
    await expect(service.restore(C)).rejects.toThrow(/outside PANDORA/);
    expect(writes).toEqual([B]);
  });
  it('preserves changes between backup and write without taking ownership', async () => {
    let reads = 0; const read = adapter.read;
    adapter.read = async () => { if (++reads === 2) current = B; return read(); };
    const service = createPowerService(dir, adapter);
    await expect(service.apply(B, A)).rejects.toThrow(/before writing/);
    expect(writes).toEqual([]); expect((await service.getInfo()).backup?.status).toBe('failed');
    await service.restore(B); expect(writes).toEqual([]);
  });
  it('retains recoverable originals after a write-then-fail without blind rollback', async () => {
    const set = adapter.set;
    adapter.set = async id => { await set(id); throw new Error('transport failure'); };
    const service = createPowerService(dir, adapter);
    expect((await service.apply(B, A)).success).toBe(false);
    expect(current).toBe(B); expect((await service.getInfo()).backup?.status).toBe('applied');
    adapter.set = set;
    expect((await createPowerService(dir, adapter).restore(B)).success).toBe(true);
    expect(current).toBe(A);
  });
  it('preserves pending originals on interruption and clears an already-restored backup without writing', async () => {
    await fs.mkdir(path.join(dir, 'backups'));
    await fs.writeFile(path.join(dir, 'backups/power-v1.json'), JSON.stringify({ version: 1, originalId: A, appliedId: B, status: 'pending', intent: 'apply', timestamp: new Date().toISOString() }));
    const service = createPowerService(dir, adapter);
    expect((await service.restore(A)).success).toBe(true);
    expect(writes).toEqual([]); expect((await service.getInfo()).backup?.status).toBe('reverted');
  });
  it('blocks writes when backups are corrupt or cannot be durably saved', async () => {
    await fs.mkdir(path.join(dir, 'backups'));
    const file = path.join(dir, 'backups/power-v1.json'); await fs.writeFile(file, '{broken');
    await expect(createPowerService(dir, adapter).apply(B, A)).rejects.toThrow(/preserved/);
    expect(await fs.readFile(file, 'utf8')).toBe('{broken'); expect(writes).toEqual([]);
    await fs.unlink(file);
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('Disk full'));
    await expect(createPowerService(dir, adapter).apply(B, A)).rejects.toThrow('Disk full');
    expect(writes).toEqual([]);
  });
  it('serializes competing requests and refuses unsupported platforms', async () => {
    const service = createPowerService(dir, adapter);
    const results = await Promise.allSettled([service.apply(B, A), service.apply(C, A)]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected']); expect(writes).toEqual([B]);
    adapter.supported = false;
    expect((await service.getInfo()).supported).toBe(false);
    await expect(service.restore(B)).rejects.toThrow(/require Windows/);
  });
  it('reads GUIDs independently of localized names and rejects inconsistent native output', () => {
    expect(parsePowerPlans(`Esquema: ${A} (Equilibrado)\nScheme: ${B}`, `Active ${B}`)).toMatchObject({ currentId: B, plans: [{ id: A, name: 'Balanced' }, { id: B, name: 'High performance' }] });
    expect(() => parsePowerPlans(A, C)).toThrow(/consistent/);
    expect(() => parsePowerPlans(A, `${A} ${B}`)).toThrow(/consistent/);
  });
});
