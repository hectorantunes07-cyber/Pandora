import { describe, expect, it, vi } from 'vitest';
import { createNetworkInspection, parseNetworkInspection, ADAPTER_INSPECTION_SCRIPT, DNS_INSPECTION_SCRIPT } from '../electron/network-inspection';
describe('read-only adapter and DNS diagnostics', () => {
  it('distinguishes physical, virtual and unknown interfaces without inferring game traffic', () => {
    const info = parseNetworkInspection({ adapters: [{ index: 1, description: 'Realtek Ethernet', physical: true, defaultRoute: true, linkSpeedBits: 5e9, status: 'Up', ip: 'private', mac: 'private', advanced: [{ keyword: '*EEE', name: 'EEE', value: 'Enabled', options: ['Disabled', 'Enabled'] }, { keyword: 'arbitrary', name: 'secret' }], power: [{ name: 'SelectiveSuspend', value: 'Unsupported' }] }, { index: 2, description: 'Radmin VPN', physical: false, defaultRoute: false, linkSpeedBits: 1e9 }, { index: 3, description: 'Unknown', physical: 'yes', defaultRoute: null, linkSpeedBits: -1 }], notes: [] });
    expect(info.adapters.map(a => a.physical)).toEqual([true, false, null]);
    expect(info.adapters[1].defaultRoute).toBe(false); expect(info.adapters[2].linkSpeedBits).toBeNull();
    expect(info.adapters[0].advanced).toHaveLength(1); expect(info.adapters[0].power[0].value).toBe('Unsupported');
    expect(JSON.stringify(info)).not.toMatch(/private|secret/);
  });
  it('rejects malformed providers and bounds inventory while retaining missing capability states', () => {
    expect(() => parseNetworkInspection({})).toThrow(/invalid/);
    expect(parseNetworkInspection({ adapters: [{ index: 0, description: '' }, { index: '3', description: 'Invalid' }] }).adapters).toEqual([]);
    expect(parseNetworkInspection({ adapters: Array.from({ length: 100 }, (_, index) => ({ index, description: 'Adapter' })) }).adapters).toHaveLength(64);
  });
  it('uses fixed scripts, reports actual DNS duration and never retains returned addresses', async () => {
    const run = vi.fn().mockResolvedValueOnce({ adapters: [], notes: ['Permission required'] }).mockResolvedValueOnce({ resolved: true, answerCount: 2, elapsedMs: 12.5, addresses: ['private'] });
    const service = createNetworkInspection(run);
    expect((await service.inspect()).notes).toEqual(['Permission required']);
    expect(await service.dns()).toMatchObject({ hostname: 'www.microsoft.com', resolved: true, answerCount: 2, elapsedMs: 12.5 });
    expect(run.mock.calls.map(c => c[0])).toEqual([ADAPTER_INSPECTION_SCRIPT, DNS_INSPECTION_SCRIPT]);
    expect(JSON.stringify(await createNetworkInspection(async () => ({ resolved: false, answerCount: 0, elapsedMs: 600 })).dns())).not.toContain('addresses');
  });
  it('rejects inconsistent DNS results and releases its busy guard after failures', async () => {
    const run = vi.fn().mockResolvedValueOnce({ resolved: false, answerCount: 2, elapsedMs: 12 }).mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValue({ resolved: true, answerCount: 1, elapsedMs: 3 });
    const service = createNetworkInspection(run);
    await expect(service.dns()).rejects.toThrow(/invalid/); await expect(service.dns()).rejects.toThrow(/Provider/); expect((await service.dns()).resolved).toBe(true);
  });
});
