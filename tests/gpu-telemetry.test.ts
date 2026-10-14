import { describe, expect, it, vi } from 'vitest';
import { createGpuTelemetryService, createWindowsGpuAdapter, GPU_QUERY_ARGS, GPU_QUERY_LIMITS, parseGpuReadings } from '../electron/gpu-telemetry';
const row = '0, NVIDIA Test GPU, 16384, 4096, 52, 123.45, 2100, 74';
describe('bounded NVIDIA driver telemetry', () => {
  it('decodes multiple devices without merging identities and converts MiB to bytes', () => {
    const readings = parseGpuReadings('\uFEFF' + row + '\r\n2, "NVIDIA, test device", 8192, 0, 0, 0, 0, 0\r\n');
    expect(readings[0]).toEqual({ index: 0, name: 'NVIDIA Test GPU', memoryTotalBytes: 16384 * 1024 ** 2, memoryUsedBytes: 4096 * 1024 ** 2, temperatureC: 52, powerWatts: 123.45, graphicsMHz: 2100, utilizationPercent: 74 });
    expect(readings[1]).toMatchObject({ index: 2, name: 'NVIDIA, test device', memoryUsedBytes: 0, temperatureC: 0, utilizationPercent: 0 });
  });
  it('preserves individual unsupported readings as null instead of zero or invented values', () => {
    expect(parseGpuReadings('0, GPU, N/A, [N/A], [Not Supported], Not Supported, N/A, N/A')[0]).toMatchObject({ memoryTotalBytes: null, memoryUsedBytes: null, temperatureC: null, powerWatts: null, graphicsMHz: null, utilizationPercent: null });
  });
  it.each(['', 'NVIDIA-SMI has failed', row + ',extra', row.replace('4096', '99999'), row.replace('52', '-1'), row.replace('74', '101'), row.replace('123.45', 'Infinity'), row.replace('2100', '1e3'), row.replace('52', ''), row.replace('NVIDIA Test GPU', '"unclosed'), row + '\n' + row, 'x'.repeat(32769)])('rejects malformed, impossible or oversized output: %s', input => { expect(() => parseGpuReadings(input)).toThrow(); });
  it('coalesces concurrent requests, limits query frequency and expires failed snapshots', async () => {
    let clock = 0; const query = vi.fn(async () => row), service = createGpuTelemetryService({ supported: true, query }, () => clock);
    const [a, b] = await Promise.all([service.get(), service.get()]); expect(query).toHaveBeenCalledTimes(1); expect(a).toEqual(b);
    clock = 14999; expect((await service.get()).cached).toBe(true); expect(query).toHaveBeenCalledTimes(1);
    clock = 15000; query.mockRejectedValueOnce(new Error('private driver path'));
    const failed = await service.get(); expect(failed).toMatchObject({ status: 'unavailable', devices: [] }); expect(JSON.stringify(failed)).not.toContain('private driver');
    clock = 29999; await service.get(); expect(query).toHaveBeenCalledTimes(2);
    clock = 30000; expect((await service.get()).status).toBe('available'); expect(query).toHaveBeenCalledTimes(3);
  });
  it('does not execute on unsupported platforms', async () => {
    const query = vi.fn(async () => row), service = createGpuTelemetryService({ supported: false, query });
    expect((await service.get()).status).toBe('unavailable'); expect(query).not.toHaveBeenCalled();
    const execute = vi.fn(async () => row); await expect(createWindowsGpuAdapter('linux', {}, execute).query()).rejects.toThrow('Windows'); expect(execute).not.toHaveBeenCalled();
  });
  it('uses only fixed absolute installation paths, fixed read-only arguments and bounded execution', async () => {
    const execute = vi.fn(async () => row); const adapter = createWindowsGpuAdapter('win32', { SystemRoot: 'D:\\Windows', ProgramW6432: 'D:\\Program Files' }, execute);
    await adapter.query(); expect(execute).toHaveBeenCalledExactlyOnceWith('D:\\Windows\\System32\\nvidia-smi.exe', [...GPU_QUERY_ARGS], GPU_QUERY_LIMITS);
  });
  it('tries the legacy utility only for an absent executable, not a timeout or driver failure', async () => {
    const execute = vi.fn(async () => row).mockRejectedValueOnce(Object.assign(new Error('absent'), { code: 'ENOENT' }));
    await createWindowsGpuAdapter('win32', {}, execute).query(); expect(execute).toHaveBeenNthCalledWith(2, 'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe', [...GPU_QUERY_ARGS], GPU_QUERY_LIMITS);
    const blocked = vi.fn(async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); });
    await expect(createWindowsGpuAdapter('win32', {}, blocked).query()).rejects.toThrow('query failed'); expect(blocked).toHaveBeenCalledTimes(1);
  });
  it('does not search PATH, relative directories or UNC locations', async () => {
    const execute = vi.fn(async () => row);
    await expect(createWindowsGpuAdapter('win32', { SystemRoot: '.\\temp', ProgramW6432: '\\\\host\\share' }, execute).query()).rejects.toThrow('unavailable'); expect(execute).not.toHaveBeenCalled();
  });
});
