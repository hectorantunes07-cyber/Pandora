import { describe, expect, it, vi } from 'vitest';
import { buildLoginScript, createLoginService, validateLoginSnapshot, type LoginSnapshot } from '../electron/app-login';
function fixture() {
  let state: LoginSnapshot = { installed: true, entry: 'absent' }, clock = 0;
  const read = vi.fn(async () => ({ ...state }));
  const change = vi.fn(async (_expected: 'absent' | 'owned', enable: boolean) => { state.entry = enable ? 'owned' : 'absent'; return { ...state }; });
  const approved = vi.fn(() => false);
  const service = createLoginService({ supported: true, read, change, approved }, true, () => clock);
  return { service, read, change, approved, replace: (next: LoginSnapshot) => { state = next; }, advance: () => { clock = 300_000; } };
}
describe('PANDORA sign-in registration', () => {
  it('reviews without writing, verifies enable/disable and preserves Windows disapproval', async () => {
    const f = fixture(); const first = await f.service.get(); expect(f.change).not.toHaveBeenCalled();
    expect((await f.service.change(first.login.token, true)).success).toBe(true);
    const enabled = await f.service.get(); expect(enabled.login).toMatchObject({ state: 'owned', approved: false }); expect(enabled.login.reason).toContain('disabled in Windows');
    expect((await f.service.change(enabled.login.token, false)).success).toBe(true); expect((await f.service.get()).login.state).toBe('absent');
    expect(f.change.mock.calls).toEqual([['absent', true], ['owned', false]]);
  });
  it('does not offer registration for a portable/unregistered executable or foreign entry', async () => {
    const f = fixture(); f.replace({ installed: false, entry: 'absent' }); expect((await f.service.get()).login).toMatchObject({ supported: false, token: null });
    f.replace({ installed: true, entry: 'conflict' }); expect((await f.service.get()).login).toMatchObject({ state: 'conflict', token: null }); expect(f.change).not.toHaveBeenCalled();
  });
  it('rejects expired, replaced, forged, replayed and wrong-direction requests', async () => {
    const f = fixture(); const old = await f.service.get(); await f.service.get(); await expect(f.service.change(old.login.token, true)).rejects.toThrow('review');
    const expire = await f.service.get(); f.advance(); await expect(f.service.change(expire.login.token, true)).rejects.toThrow('review');
    await expect(f.service.change('fake', true)).rejects.toThrow('review');
    const wrong = await f.service.get(); await expect(f.service.change(wrong.login.token, false)).rejects.toThrow('review');
    const valid = await f.service.get(); await f.service.change(valid.login.token, true); await expect(f.service.change(valid.login.token, true)).rejects.toThrow('review'); expect(f.change).toHaveBeenCalledTimes(1);
  });
  it.each([{ installed: false, entry: 'absent' }, { installed: true, entry: 'conflict' }] as const)('rechecks the installation/entry immediately before native change', async changed => {
    const f = fixture(); const r = await f.service.get(); f.replace(changed); await expect(f.service.change(r.login.token, true)).rejects.toThrow('Nothing was overwritten'); expect(f.change).not.toHaveBeenCalled();
  });
  it('returns an unconfirmed failure after a native race or timeout without blind rollback', async () => {
    const f = fixture(); f.change.mockRejectedValueOnce(new Error('private native path')); const r = await f.service.get();
    const result = await f.service.change(r.login.token, true); expect(result.success).toBe(false); expect(result.message).not.toContain('private'); expect(f.change).toHaveBeenCalledTimes(1);
  });
  it('keeps failed inspection unavailable and unknown approval distinct from enabled', async () => {
    const f = fixture(); f.read.mockRejectedValueOnce(new Error('private')); expect((await f.service.get()).login).toMatchObject({ state: 'unavailable', token: null });
    f.replace({ installed: true, entry: 'owned' }); f.approved.mockImplementationOnce(() => { throw new Error('not supported'); }); expect((await f.service.get()).login.approved).toBeNull();
  });
  it('does not invoke Windows for unsupported app platforms', async () => {
    const read = vi.fn(); const service = createLoginService({ supported: false, read, change: vi.fn(), approved: () => null }, false);
    expect((await service.get()).traySupported).toBe(false); expect(read).not.toHaveBeenCalled();
  });
  it('bounds identities and uses a fixed quoted executable without shell arguments', () => {
    const script = buildLoginScript("C:\\Users\\O'Brien\\PANDORA\\PANDORA.exe", { expected: 'absent', enable: true });
    expect(script).toContain('"C:\\Users\\O\'\'Brien\\PANDORA\\PANDORA.exe"');
    expect(script).toContain("CreateSubKey('Software\\Microsoft\\Windows\\CurrentVersion\\Run'");
    expect(script).not.toContain('StartupApproved');
    for (const value of ['PANDORA.exe', '\\\\host\\share\\PANDORA.exe', 'C:\\Temp\\..\\PANDORA.exe', 'C:\\PANDORA.exe" --bad']) expect(() => buildLoginScript(value)).toThrow();
    expect(validateLoginSnapshot({ installed: true, entry: 'absent', privatePath: 'omitted' })).toEqual({ installed: true, entry: 'absent' });
    expect(() => validateLoginSnapshot({ installed: 1, entry: 'owned' })).toThrow();
  });
});
