import { describe, expect, it } from 'vitest';
import { createNetworkInspection } from '../electron/network-inspection';
describe.skipIf(process.platform !== 'win32')('native read-only adapter inspection', () => {
  it('reads the real provider without retaining addresses or modifying network configuration', async () => {
    const result = await createNetworkInspection().inspect();
    expect(result.adapters.length).toBeGreaterThan(0);
    expect(result.adapters.every(a => Number.isInteger(a.index) && a.description.length > 0)).toBe(true);
    for (const a of result.adapters) {
      expect(a).not.toHaveProperty('IPAddress'); expect(a).not.toHaveProperty('MacAddress'); expect(a).not.toHaveProperty('Name');
      expect([true, false, null]).toContain(a.physical);
    }
  }, 60_000);
});
