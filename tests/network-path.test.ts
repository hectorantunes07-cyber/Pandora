import { describe, expect, it, vi } from 'vitest';
import { summarizeNetworkPath } from '../electron/network-path';
import { createNetworkService } from '../electron/network';
const raw = () => ({ gatewayStatus: 'available', routeStable: true, gatewaySamples: [1, 2, null, 4, 4, 4, 4, 4], internetSamples: Array(8).fill(20) });
describe('route-aware network comparison', () => {
  it('calculates each destination independently and strips private provider data', () => {
    const result = summarizeNetworkPath('google', { ...raw(), nextHop: 'PRIVATE', interfaceName: 'PRIVATE', errors: 'PRIVATE' }, () => 0);
    expect(result.gateway).toMatchObject({ received: 7, lossPercent: 12.5, jitterMs: 0.2 });
    expect(result.gateway).not.toHaveProperty('address');
    expect(result.internet).toMatchObject({ address: '8.8.8.8', averageMs: 20 });
    expect(result.timestamp).toBe('1970-01-01T00:00:00.000Z');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
  it('preserves route changes and unavailable route consistency explicitly', () => {
    for (const routeStable of [false, null]) expect(summarizeNetworkPath('cloudflare', { ...raw(), routeStable }).routeStable).toBe(routeStable);
  });
  it('preserves public measurements without a separately usable gateway', () => {
    for (const gatewayStatus of ['no-gateway', 'unavailable']) {
      expect(summarizeNetworkPath('cloudflare', { ...raw(), gatewayStatus, gatewaySamples: null })).toMatchObject({ gatewayStatus, gateway: null, internet: { received: 8 } });
    }
  });
  it('does not turn blocked replies into zero latency', () => {
    expect(summarizeNetworkPath('cloudflare', { ...raw(), gatewaySamples: Array(8).fill(null) }).gateway).toMatchObject({ received: 0, averageMs: null, jitterMs: null });
  });
  it('rejects malformed and contradictory provider output', () => {
    for (const value of [null, {}, { ...raw(), routeStable: 'true' }, { ...raw(), routeStable: undefined }, { ...raw(), gatewayStatus: 'unknown' }, { ...raw(), gatewayStatus: 'unavailable' }, { ...raw(), gatewaySamples: [1] }, { ...raw(), internetSamples: Array(8).fill(-1) }]) {
      expect(() => summarizeNetworkPath('google', value)).toThrow();
    }
  });
  it('shares the concurrency guard and allowlist with the existing ping test', async () => {
    let finish!: (value: unknown) => void;
    const run = vi.fn(); const runPath = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const service = createNetworkService(run, runPath);
    for (const value of [null, {}, '192.168.1.1', 'google; command']) await expect(service.testNetworkPath(value)).rejects.toThrow('supported diagnostic');
    expect(runPath).not.toHaveBeenCalled();
    const pending = service.testNetworkPath('google');
    await expect(service.testNetwork('google')).rejects.toThrow('already running');
    await expect(service.testNetworkPath('cloudflare')).rejects.toThrow('already running');
    expect(run).not.toHaveBeenCalled();
    finish(raw()); await pending;
    expect(runPath).toHaveBeenCalledExactlyOnceWith('8.8.8.8');
  });
  it('releases the shared guard after a failed comparison', async () => {
    const service = createNetworkService(vi.fn().mockResolvedValue({ samples: Array(8).fill(2) }), vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(service.testNetworkPath('cloudflare')).rejects.toThrow('timeout');
    expect((await service.testNetwork('google')).received).toBe(8);
  });
});
