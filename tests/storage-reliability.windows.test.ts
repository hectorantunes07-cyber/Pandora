import { expect, it } from 'vitest';
import { createWindowsStorageAdapter, parseStorageReadings } from '../electron/storage-reliability';

it.skipIf(process.platform !== 'win32')('reads actual Windows physical storage without requiring supported device counters', async () => {
  const result = parseStorageReadings(await createWindowsStorageAdapter().query());
  expect(result.devices.length).toBeGreaterThan(0);
  for (const device of result.devices) {
    expect(device.model.length).toBeGreaterThan(0);
    expect(device.bytes).toBeGreaterThan(0);
    if (device.countersStatus === 'unavailable') expect(device.reason).not.toBeNull();
    expect(Object.keys(device)).not.toContain('serial');
  }
}, 30_000);
