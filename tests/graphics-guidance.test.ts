import { describe, expect, it } from 'vitest';
import { graphicsGuidance, refreshBudget } from '../shared/graphics-guidance';
import type { SystemInfo } from '../shared/types';
describe('graphics guidance from actual inventory', () => {
  const system = (gpu: string) => ({ platform: 'win32', gpu, gpuDriver: 'reported-version' }) as SystemInfo;
  it('selects vendor guidance without claiming supported features or driver freshness', () => {
    expect(graphicsGuidance(system('NVIDIA GeForce RTX 5080'))).toMatchObject({ vendor: 'NVIDIA', driver: 'reported-version' });
    expect(graphicsGuidance(system('AMD Radeon RX 9070'))?.advice).toContain('only when your driver exposes support');
    expect(graphicsGuidance(system('Intel Arc B580'))?.vendor).toBe('Intel');
    expect(graphicsGuidance(system('Microsoft Basic Display Adapter'))?.vendor).toBe('Unknown');
    expect(graphicsGuidance({ ...system('NVIDIA'), platform: 'linux' })).toBeNull();
    expect(graphicsGuidance(null)).toBeNull();
  });
  it('calculates only valid refresh intervals without inventing latency readings', () => {
    expect(refreshBudget(360)).toBe('2.78'); expect(refreshBudget(144)).toBe('6.94');
    for (const value of [null, 0, -60, NaN, Infinity]) expect(refreshBudget(value)).toBeNull();
  });
});
