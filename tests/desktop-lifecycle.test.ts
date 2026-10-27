import { describe, expect, it, vi } from 'vitest';
import { createDesktopLifecycle } from '../electron/desktop-lifecycle';
function fixture() {
  const window = { isMinimized: () => true, restore: vi.fn(), show: vi.fn(), focus: vi.fn(), hide: vi.fn() }, destroy = vi.fn(), quit = vi.fn(), notifyBusy = vi.fn();
  let busy = false; const createTray = vi.fn(() => ({ destroy }));
  const service = createDesktopLifecycle({ window: () => window, busy: () => busy, createTray, quit, notifyBusy });
  return { service, window, destroy, quit, createTray, notifyBusy, busy: (value: boolean) => { busy = value; } };
}
describe('optional notification-area lifecycle', () => {
  it('exits normally by default and only hides after a tray is available', () => {
    const f = fixture(), preventDefault = vi.fn(); f.service.close({ preventDefault }); expect(preventDefault).not.toHaveBeenCalled();
    f.service.configure(true); f.service.close({ preventDefault }); expect(preventDefault).toHaveBeenCalledOnce(); expect(f.window.hide).toHaveBeenCalledOnce();
    f.service.show(); expect(f.window.restore).toHaveBeenCalledOnce(); expect(f.window.show).toHaveBeenCalledOnce(); expect(f.window.focus).toHaveBeenCalledOnce();
  });
  it('does not hide when tray creation fails and shows before removing an enabled tray', () => {
    const f = fixture(), preventDefault = vi.fn(); f.createTray.mockImplementationOnce(() => { throw new Error('tray missing'); });
    expect(() => f.service.configure(true)).toThrow(); f.service.close({ preventDefault }); expect(preventDefault).not.toHaveBeenCalled();
    f.service.configure(true); f.service.configure(true); expect(f.createTray).toHaveBeenCalledTimes(2);
    f.service.configure(false); expect(f.window.show).toHaveBeenCalledOnce(); expect(f.destroy).toHaveBeenCalledOnce();
  });
  it('guards close, tray exit and application quit throughout a mutation', () => {
    const f = fixture(), preventDefault = vi.fn(); f.service.configure(true); f.busy(true);
    f.service.close({ preventDefault }); f.service.requestQuit(); f.service.beforeQuit({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(2); expect(f.quit).not.toHaveBeenCalled(); expect(f.window.hide).not.toHaveBeenCalled(); expect(f.notifyBusy).toHaveBeenCalledTimes(3);
    f.busy(false); f.service.close({ preventDefault }); expect(f.window.hide).toHaveBeenCalledOnce();
  });
  it('explicit exit bypasses hide-to-tray and releases the native icon', () => {
    const f = fixture(), preventDefault = vi.fn(); f.service.configure(true); f.service.requestQuit(); expect(f.quit).toHaveBeenCalledOnce();
    f.service.beforeQuit({ preventDefault }); f.service.close({ preventDefault }); expect(preventDefault).not.toHaveBeenCalled(); expect(f.window.hide).not.toHaveBeenCalled(); f.service.dispose(); expect(f.destroy).toHaveBeenCalledOnce();
  });
  it('cancels pending quit intent when an operation starts before window close', () => {
    const f = fixture(), preventDefault = vi.fn(); f.service.configure(true); f.service.beforeQuit({ preventDefault });
    f.busy(true); f.service.close({ preventDefault }); f.busy(false); f.service.close({ preventDefault });
    expect(f.window.hide).toHaveBeenCalledOnce(); expect(preventDefault).toHaveBeenCalledTimes(2);
  });
});
