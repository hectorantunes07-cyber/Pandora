import { describe, expect, it, vi } from 'vitest';
import { createProcessDetailsService, readProcessIdentity } from '../electron/process-details';
describe.skipIf(process.platform !== 'win32')('native process identity', () => {
  it('reads and revalidates this test process without terminating it or launching Explorer', async () => {
    const identity = await readProcessIdentity(process.pid);
    expect(identity.pid).toBe(process.pid); expect(identity.startedAt).not.toBeNull(); expect(identity.executable).not.toBeNull();
    const show = vi.fn(), service = createProcessDetailsService(show), info = await service.get(process.pid);
    expect(info.token).not.toBeNull(); await service.open(info.token); expect(show).toHaveBeenCalledTimes(1);
  }, 60_000);
});
