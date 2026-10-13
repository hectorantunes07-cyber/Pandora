import { describe, expect, it } from 'vitest';
import { captureBenchmarkContext, contextDifferences, contextRows, validBenchmarkContext } from '../shared/benchmark-context';
import type { SystemInfo, TweakState } from '../shared/types';
const system: SystemInfo = {
  platform: 'win32', timestamp: '2026-10-01T12:00:00Z', cpu: 'Processor', logicalCores: 8, physicalCores: 4,
  gpu: 'Graphics', gpuDriver: '1.0', ramBytes: 16e9, ramSpeedMHz: 3200, os: 'Windows', motherboard: 'Board',
  powerPlan: 'Balanced', volumes: [{ name: 'private-path', totalBytes: 1e12, freeBytes: 1e11 }],
  monitors: [{ name: 'private-monitor-id', width: 1920, height: 1080, refreshHz: 144 }], notes: ['private-note'],
};
const tweak = { id: 'game-mode', currentValue: 1, state: 'already-set', managed: false } as TweakState;
describe('benchmark configuration evidence', () => {
  it('captures a fixed private-data-free schema with separate observation timestamps', () => {
    const result = captureBenchmarkContext(system, [tweak], new Date('2026-10-01T12:01:00Z'));
    expect(result.capturedAt).not.toBe(result.inventoryAt);
    expect(validBenchmarkContext(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private-');
    expect(contextRows(result)).toContainEqual(['Power plan', 'Balanced']);
  });
  it('reports changed conditions without assigning causation or claiming gains', () => {
    const before = captureBenchmarkContext(system, [tweak]);
    const after = captureBenchmarkContext({ ...system, gpuDriver: '2.0', powerPlan: null }, [{ ...tweak, currentValue: 0 }]);
    expect(contextDifferences(before, after)).toEqual(['GPU driver', 'Power plan', 'Preference values or availability']);
    expect(contextDifferences(before, undefined)).toEqual([]);
    expect(contextDifferences(before, { ...before, capturedAt: 'later' })).toEqual([]);
    expect(contextDifferences(before, captureBenchmarkContext(system, [{ ...tweak, state: 'applied', managed: true }]))).toEqual([]);
  });
  it('rejects corrupted persisted evidence and preserves unavailable values in exports', () => {
    const context = captureBenchmarkContext({ ...system, gpuDriver: null }, [tweak]);
    expect(contextRows(context)).toContainEqual(['GPU driver', 'Unavailable']);
    expect(validBenchmarkContext({ ...context, ramBytes: NaN })).toBe(false);
    expect(validBenchmarkContext({ ...context, preferences: [{ id: 'bad', value: -1, state: 'applied' }] })).toBe(false);
    expect(validBenchmarkContext({ ...context, capturedAt: 'never' })).toBe(false);
  });
});
