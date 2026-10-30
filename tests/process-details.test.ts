import { describe, expect, it, vi } from 'vitest';
import { buildProcessDetailsQuery, createProcessDetailsService, isLocalImagePath, parseProcessIdentity } from '../electron/process-details';
const identity = { pid: 123, name: 'game', startedAt: '2026-10-30T12:00:00.000Z', executable: 'C:\\Games\\game.exe', company: 'Reported only', version: '1.0' };
describe('read-only process details and guarded Explorer handoff', () => {
  it('opens only the observed local path after rereading the same process instance', async () => {
    const show = vi.fn(), read = vi.fn(async () => identity), resolve = vi.fn(async (p: string) => p);
    const service = createProcessDetailsService(show, read, resolve), info = await service.get(123);
    expect(show).not.toHaveBeenCalled(); expect(info.token).toEqual(expect.any(String));
    await service.open(info.token); expect(read).toHaveBeenCalledTimes(2); expect(show).toHaveBeenCalledExactlyOnceWith(identity.executable);
    await expect(service.open(info.token)).rejects.toThrow(/again/);
  });
  it.each([{ startedAt: '2026-10-30T12:00:01.000Z' }, { executable: 'C:\\Other\\game.exe' }, { name: 'other' }])('refuses PID reuse or changed image identity: %j', patch => {
    return (async () => {
      const show = vi.fn(), read = vi.fn().mockResolvedValueOnce(identity).mockResolvedValueOnce({ ...identity, ...patch });
      const service = createProcessDetailsService(show, read, async p => p), info = await service.get(123);
      await expect(service.open(info.token)).rejects.toThrow(/changed/); expect(show).not.toHaveBeenCalled();
    })();
  });
  it('refuses changed symlink destinations and vanished files without invoking Explorer', async () => {
    const show = vi.fn(), resolve = vi.fn().mockResolvedValueOnce(identity.executable).mockResolvedValueOnce('C:\\Other\\game.exe');
    const service = createProcessDetailsService(show, async () => identity, resolve), info = await service.get(123);
    await expect(service.open(info.token)).rejects.toThrow(/changed/); expect(show).not.toHaveBeenCalled();
    resolve.mockRejectedValue(new Error('PRIVATE_SENTINEL')); expect((await service.get(123)).token).toBeNull();
  });
  it('expires, invalidates superseded reviews, and requires a valid opaque token', async () => {
    const show = vi.fn(), service = createProcessDetailsService(show, async () => identity, async p => p);
    const first = await service.get(123); await service.get(123); await expect(service.open(first.token)).rejects.toThrow(/again/);
    await service.get(123); await expect(service.open('forged')).rejects.toThrow(/again/);
    const current = await service.get(123), now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300001);
    try { await expect(service.open(current.token)).rejects.toThrow(/again/); } finally { now.mockRestore(); }
    expect(show).not.toHaveBeenCalled();
  });
  it('keeps partial protected-process metadata without permitting a folder action', async () => {
    for (const patch of [{ startedAt: null }, { executable: null }, { executable: '\\\\server\\share\\app.exe' }]) {
      const resolve = vi.fn(), service = createProcessDetailsService(vi.fn(), async () => ({ ...identity, ...patch }), resolve);
      const info = await service.get(123); expect(info.token).toBeNull(); expect(resolve).not.toHaveBeenCalled();
    }
  });
  it('rejects malformed identities, special paths and command-like process IDs', async () => {
    for (const id of [0, -1, 1.2, NaN, Infinity, '123;whoami', null]) {
      expect(() => buildProcessDetailsQuery(id as number)).toThrow();
      await expect(createProcessDetailsService(vi.fn()).get(id)).rejects.toThrow(/valid/);
    }
    expect(() => parseProcessIdentity({ ...identity, pid: 124 }, 123)).toThrow();
    expect(() => parseProcessIdentity({ ...identity, name: 'game\ncommand' }, 123)).toThrow();
    expect(() => parseProcessIdentity({ ...identity, startedAt: 'unknown' }, 123)).toThrow();
    for (const p of ['\\\\?\\C:\\app.exe','C:\\app.exe:stream','https://host/app.exe','C:app.exe','\\\\host\\app.exe']) expect(isLocalImagePath(p)).toBe(false);
    expect(buildProcessDetailsQuery(123)).not.toMatch(/Stop-Process|CommandLine|Start-Process|Get-AuthenticodeSignature/);
  });
  it('does not allow a slow, older details request to replace a newer identity', async () => {
    let finish!: (value: typeof identity) => void;
    const read = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(identity);
    const service = createProcessDetailsService(vi.fn(), read, async p => p), first = service.get(123), second = await service.get(123);
    finish(identity); await expect(first).rejects.toThrow(/newer/); await expect(service.open(second.token)).resolves.toBeUndefined();
  });
});
