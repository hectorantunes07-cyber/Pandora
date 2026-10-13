import { describe, expect, it } from 'vitest';
import { systemInsights } from '../shared/insights';
import type { Metrics, SystemInfo, TweakState } from '../shared/types';

const system: SystemInfo = { platform: 'win32', timestamp: '2026-01-01T00:00:00Z', cpu: 'CPU', logicalCores: 8, physicalCores: 4, gpu: 'GPU', gpuDriver: '1', ramBytes: 16000, ramSpeedMHz: null, os: 'Windows', motherboard: null, powerPlan: null, volumes: [], monitors: [], notes: [] };
const metric: Metrics = { timestamp: system.timestamp, cpuPercent: 10, gpuPercent: null, ramUsedBytes: 14400, ramTotalBytes: 16000, processCount: null };
describe('recommendations from actual readings', () => {
  it('identifies actionable storage and memory readings without prescribing mutations', () => {
    const items = systemInsights({ ...system, volumes: [{ name: 'C:', totalBytes: 100, freeBytes: 9 }], physicalDisks: [{ model: 'Disk', bytes: 100, media: 'SSD', bus: 'NVMe', health: 'Warning' }] }, metric, []);
    expect(items.map(item => item.route)).toEqual(['PC Cleaner', 'Processes & Startup', 'System Monitor']);
    expect(items[0].evidence).toContain('9.0%');
    expect(items[1].evidence).toContain('90.0%');
    expect(items[2].guidance).toContain('Cleaning files is not a repair');
  });
  it('does not treat invalid or missing readings as evidence of an issue', () => {
    const bad = { ...system, volumes: [{ name: 'Invalid', totalBytes: 100, freeBytes: -1 }], monitors: [{ name: 'Unknown', width: 1920, height: 1080, refreshHz: NaN }], physicalDisks: [{ model: 'Disk', bytes: null, media: 'Unknown', bus: 'Unknown', health: null }] };
    expect(systemInsights(bad, { ...metric, ramUsedBytes: Infinity }, [])).toEqual([]);
    expect(systemInsights({ ...system, platform: 'linux' }, metric, [])).toEqual([]);
    expect(systemInsights(null, metric, [])).toEqual([]);
  });
  it('labels display and driver uncertainty and gates gaming advice on eligibility', () => {
    const data = { ...system, gpuDriver: null, monitors: [{ name: 'Controller', width: 1920, height: 1080, refreshHz: 60 }] };
    const available = { id: 'game-mode', state: 'available' } as TweakState;
    const items = systemInsights(data, null, [available]);
    expect(items.map(item => item.id)).toEqual(['display', 'driver', 'game-mode']);
    expect(items[0].guidance).toContain('does not establish');
    expect(systemInsights(data, null, [{ ...available, state: 'unsupported' }]).some(item => item.id === 'game-mode')).toBe(false);
    expect(systemInsights({ ...system, volumes: [{ name: 'C:', totalBytes: 100, freeBytes: 10 }] }, null, [])).toEqual([]);
  });
});
