import { describe, expect, it } from 'vitest';
import { createProcessActivityService } from '../electron/process-activity';
describe.skipIf(process.platform !== 'win32')('native read-only process activity', () => {
  it('samples actual process counters with stable identity and monotonic timing', async () => {
    const result = await createProcessActivityService().sample();
    expect(result.logicalProcessors).toBeGreaterThan(0);
    expect(result.rows.length).toBeGreaterThan(0);
    const own = result.rows.find(row => row.pid === process.pid);
    expect(own?.status).toBe('measured'); expect(own?.intervalMs).toBeGreaterThanOrEqual(1900);
    expect(own?.cpuPercent).toBeGreaterThanOrEqual(0); expect(own?.cpuPercent).toBeLessThanOrEqual(100);
    expect(own?.memoryBytes).toBeGreaterThan(0);
    expect(Object.keys(own!)).toEqual(['pid', 'name', 'memoryBytes', 'cpuPercent', 'intervalMs', 'status']);
  }, 40000);
});
