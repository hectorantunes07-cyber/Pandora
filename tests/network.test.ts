import { describe, it, expect, vi } from 'vitest';
import { createNetworkService, summarizeNetwork } from '../electron/network';
describe('bounded network diagnostics', () => {
  it('calculates loss and jitter without bridging missing replies', () => {
    expect(summarizeNetwork('cloudflare', { samples: [10, 20, null, 100, 120, null, 0, 0] })).toMatchObject({ received: 6, lossPercent: 25, averageMs: 250 / 6, minMs: 0, maxMs: 120, jitterMs: 10, address: '1.1.1.1' });
  });
  it('keeps measurements unavailable when no reply arrives', () => {
    expect(summarizeNetwork('google', { samples: Array(8).fill(null) })).toMatchObject({ received: 0, lossPercent: 100, averageMs: null, minMs: null, maxMs: null, jitterMs: null });
  });
  it('rejects incomplete, nonnumeric and impossible measurements', () => {
    for (const samples of [[], [10], Array(8).fill('10'), Array(8).fill(-1), Array(8).fill(Infinity), Array(8).fill(2000)]) expect(() => summarizeNetwork('google', { samples })).toThrow('invalid network measurements');
  });
  it('accepts only fixed destination IDs and prevents overlapping probes', async () => {
    let finish!: (value: unknown) => void;
    const run = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const service = createNetworkService(run);
    await expect(service.testNetwork('1.2.3.4; command')).rejects.toThrow('supported diagnostic destination');
    expect(run).not.toHaveBeenCalled();
    const pending = service.testNetwork('google');
    await expect(service.testNetwork('cloudflare')).rejects.toThrow('already running');
    finish({ samples: Array(8).fill(5) });
    expect((await pending).averageMs).toBe(5);
    expect(run).toHaveBeenCalledExactlyOnceWith('8.8.8.8');
  });
  it('allows another test after the provider fails', async () => {
    const service = createNetworkService(vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ samples: Array(8).fill(1) }));
    await expect(service.testNetwork('google')).rejects.toThrow('offline');
    expect((await service.testNetwork('cloudflare')).received).toBe(8);
  });
});
