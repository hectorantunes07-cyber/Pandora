import { describe, expect, it, vi } from 'vitest';
import { createSystemRestoreService } from '../electron/system-restore';
import { buildRestoreElevationScript, buildRestorePointScript, createWindowsRestoreAdapter, validateRestoreInfo } from '../electron/system-restore-native';
import type { RestorePointOutcome, SystemRestoreInfo } from '../shared/system-restore';
const ready: SystemRestoreInfo = { supported: true, readable: true, points: [] };
const id = '8c867f33-14c2-4d27-9557-20fd0173f972';
describe('reviewed Windows restore-point creation', () => {
  it('does not elevate when listing or previewing; consumes the review once', async () => {
    const create = vi.fn(async (): Promise<RestorePointOutcome> => 'created'); const service = createSystemRestoreService({ read: async () => ready, create });
    await service.getInfo(); const review = await service.preview(); expect(create).not.toHaveBeenCalled();
    expect(review.description).toMatch(/^PANDORA before changes [a-f0-9-]{36}$/);
    expect((await service.create(review.token)).success).toBe(true); expect(create).toHaveBeenCalledTimes(1);
    await expect(service.create(review.token)).rejects.toThrow('Review'); expect(create).toHaveBeenCalledTimes(1);
  });
  it('allows reviewed elevation when the normal account cannot list points', async () => {
    const create = vi.fn(async (): Promise<RestorePointOutcome> => 'created'); const service = createSystemRestoreService({ read: async () => ({ supported: true, readable: false, points: [] }), create });
    const r = await service.preview(); expect((await service.create(r.token)).success).toBe(true);
  });
  it.each(['cancelled', 'unconfirmed', 'failed', 'unsupported'] as const)('reports %s without claiming a backup or automatically retrying', async outcome => {
    const create = vi.fn(async () => outcome); const service = createSystemRestoreService({ read: async () => ready, create });
    const result = await service.create((await service.preview()).token); expect(result.success).toBe(false); expect(create).toHaveBeenCalledTimes(1);
  });
  it('treats a timeout as unconfirmed because an elevated child might still finish', async () => {
    const service = createSystemRestoreService({ read: async () => ready, create: async () => { throw new Error('timeout'); } });
    const result = await service.create((await service.preview()).token); expect(result.success).toBe(false); expect(result.message).toContain('may still be running');
  });
  it('refuses stale, replaced, expired and forged reviews before administrator launch', async () => {
    let clock = 0; const create = vi.fn(async (): Promise<RestorePointOutcome> => 'created'); const service = createSystemRestoreService({ read: async () => ready, create }, () => clock);
    const first = await service.preview(); await service.preview(); await expect(service.create(first.token)).rejects.toThrow('Review');
    const expired = await service.preview(); clock = 300001; await expect(service.create(expired.token)).rejects.toThrow('Review');
    await expect(service.create('forged')).rejects.toThrow('Review'); expect(create).not.toHaveBeenCalled();
  });
  it('rechecks OS availability and blocks unsupported editions', async () => {
    let supported = true; const create = vi.fn(async (): Promise<RestorePointOutcome> => 'created'); const service = createSystemRestoreService({ read: async () => ({ ...ready, supported }), create });
    const r = await service.preview(); supported = false; await expect(service.create(r.token)).rejects.toThrow('availability changed'); await expect(service.preview()).rejects.toThrow('unavailable'); expect(create).not.toHaveBeenCalled();
  });
  it('only encodes the fixed helper and refuses arbitrary descriptions or script input', () => {
    const inner = buildRestorePointScript(id), outer = buildRestoreElevationScript(id);
    const encoded = outer.match(/'-EncodedCommand','([A-Za-z0-9+/=]+)'/)![1]; expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe(inner);
    expect(inner).toContain('Checkpoint-Computer'); expect(inner).toContain('$before -notcontains'); expect(inner).toContain('$env:PSModulePath="$PSHOME\\Modules"');
    for (const invalid of ["';whoami;#", '', 'a'.repeat(200)]) expect(() => buildRestoreElevationScript(invalid)).toThrow();
  });
  it('validates bounded provider data and strips non-schema fields', () => {
    expect(validateRestoreInfo({ ...ready, privatePath: 'not retained' })).toEqual(ready);
    for (const points of [[{ sequence: -1, description: '', createdAt: null }], [{ sequence: 1, description: '', createdAt: 'invalid' }], Array(101).fill({ sequence: 1, description: '', createdAt: null })]) expect(() => validateRestoreInfo({ ...ready, points })).toThrow();
  });
  it.skipIf(process.platform === 'win32')('never queries Windows or starts elevation on another platform', async () => {
    const adapter = createWindowsRestoreAdapter(); expect((await adapter.read()).supported).toBe(false); await expect(adapter.create(id)).rejects.toThrow('Windows');
  });
});
