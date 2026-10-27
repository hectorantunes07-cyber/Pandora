import { describe, expect, it, vi } from 'vitest';
import { createStorageReliabilityService, createWindowsStorageAdapter, parseStorageReadings, STORAGE_QUERY_LIMITS, STORAGE_RELIABILITY_QUERY } from '../electron/storage-reliability';
const device = { index: 0, model: 'Fixture SSD', media: 'SSD', bus: 'NVMe', bytes: 1e12, health: 'Healthy', countersStatus: 'reported', reason: null, temperatureC: 35, wearPercent: 12, powerOnHours: 1200, readErrorsTotal: '18446744073709551615', readErrorsCorrected: null, readErrorsUncorrected: '0', writeErrorsTotal: null, writeErrorsCorrected: null, writeErrorsUncorrected: null };
const encode = (devices: unknown[] = [device], truncated = false) => JSON.stringify({ devices, truncated });
describe('read-only Windows storage reliability', () => {
  it('preserves per-device readings, exact UInt64 counters and zero versus unavailable', () => {
    const result = parseStorageReadings('\uFEFF' + encode([device, { ...device, index: 1, temperatureC: 0, wearPercent: 110, powerOnHours: 0 }]));
    expect(result.devices[0]).toEqual(device);
    expect(result.devices[1]).toMatchObject({ index: 1, temperatureC: 0, wearPercent: 110, powerOnHours: 0 });
    expect(result.devices[0].readErrorsTotal).toBe('18446744073709551615');
    expect(result.devices[0].writeErrorsTotal).toBeNull();
  });
  it('strips unrecognized identifiers and never invents counters for unavailable devices', () => {
    const absent = { ...device, countersStatus: 'unavailable', reason: 'provider-unavailable', temperatureC: null, wearPercent: null, powerOnHours: null, readErrorsTotal: null, readErrorsUncorrected: null, serial: 'private-serial', path: 'private-path' };
    const output = parseStorageReadings(encode([absent]));
    expect(output.devices[0].countersStatus).toBe('unavailable');
    expect(JSON.stringify(output)).not.toContain('private');
  });
  it.each([
    ['temperatureC', -1], ['temperatureC', 256], ['wearPercent', 256], ['powerOnHours', 65536], ['bytes', 1.5], ['bytes', 1e20],
    ['model', ''], ['model', 'x'.repeat(201)], ['model', 'bad\nlabel'], ['readErrorsTotal', 9007199254740992],
    ['readErrorsTotal', '18446744073709551616'], ['readErrorsTotal', '1e3'], ['readErrorsTotal', '-1'], ['readErrorsTotal', '01'],
    ['reason', 'arbitrary private error'], ['reason', 'identity-mismatch'], ['countersStatus', 'unavailable'], ['index', 2],
  ])('rejects invalid or inconsistent %s = %s', (key, value) => {
    expect(() => parseStorageReadings(encode([{ ...device, [key as string]: value }]))).toThrow();
  });
  it('bounds the response, accepts empty inventory, and requires truthful truncation', () => {
    expect(parseStorageReadings(encode([]))).toEqual({ devices: [], truncated: false });
    for (const output of ['', '{}', 'x'.repeat(65537), encode(Array(33).fill(device)), encode([device], true), encode([device, device])]) expect(() => parseStorageReadings(output)).toThrow();
    expect(parseStorageReadings(encode(Array.from({ length: 32 }, (_, index) => ({ ...device, index })), true)).truncated).toBe(true);
  });
  it('coalesces queries, caches for 30 seconds, and clears old success after failure', async () => {
    let clock = 0; const query = vi.fn(async () => encode()); const service = createStorageReliabilityService({ supported: true, query }, () => clock);
    const [first, second] = await Promise.all([service.get(), service.get()]); expect(first).toEqual(second); expect(query).toHaveBeenCalledTimes(1);
    clock = 29999; expect((await service.get()).cached).toBe(true); expect(query).toHaveBeenCalledTimes(1);
    clock = 30000; query.mockRejectedValueOnce(new Error('C:\\private\\provider: secret'));
    const failed = await service.get(); expect(failed).toMatchObject({ status: 'unavailable', devices: [], cached: false }); expect(JSON.stringify(failed)).not.toMatch(/secret|private/);
    clock = 60000; expect((await service.get()).devices).toHaveLength(1); expect(query).toHaveBeenCalledTimes(3);
    clock = 0; await service.get(); expect(query).toHaveBeenCalledTimes(4);
  });
  it('treats an empty provider result as unavailable rather than a clean health scan', async () => {
    expect(await createStorageReliabilityService({ supported: true, query: async () => encode([]) }).get()).toMatchObject({ status: 'unavailable', devices: [], reason: expect.stringContaining('no physical devices') });
  });
  it('never executes on unsupported platforms', async () => {
    const query = vi.fn(async () => encode()), execute = vi.fn(async () => encode());
    expect((await createStorageReliabilityService({ supported: false, query }).get()).status).toBe('unavailable'); expect(query).not.toHaveBeenCalled();
    await expect(createWindowsStorageAdapter('linux', {}, execute).query()).rejects.toThrow('Windows'); expect(execute).not.toHaveBeenCalled();
  });
  it('uses only an absolute Windows executable, an exact encoded read-only script and bounded execution', async () => {
    const execute = vi.fn(async () => encode()); await createWindowsStorageAdapter('win32', { SystemRoot: 'D:\\Windows' }, execute).query();
    expect(execute).toHaveBeenCalledExactlyOnceWith('D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(STORAGE_RELIABILITY_QUERY, 'utf16le').toString('base64')], STORAGE_QUERY_LIMITS);
    for (const root of ['Windows', '\\\\server\\share', 'C:\\Windows\\..\\Temp']) await expect(createWindowsStorageAdapter('win32', { SystemRoot: root }, execute).query()).rejects.toThrow('path');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('does not retry or elevate after a provider timeout', async () => {
    const execute = vi.fn(async (): Promise<string> => { throw new Error('timeout'); });
    const result = await createStorageReliabilityService(createWindowsStorageAdapter('win32', {}, execute)).get();
    expect(result.status).toBe('unavailable'); expect(execute).toHaveBeenCalledTimes(1);
  });
});
