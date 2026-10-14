import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { GpuReading, GpuTelemetry } from '../shared/gpu-telemetry';

// A fixed read-only query. Never accept an executable, arguments or target from IPC.
export const GPU_QUERY_ARGS = ['--query-gpu=index,name,memory.total,memory.used,temperature.gpu,power.draw,clocks.current.graphics,utilization.gpu', '--format=csv,noheader,nounits'] as const;
export const GPU_QUERY_LIMITS = { windowsHide: true, timeout: 6_000, maxBuffer: 32_768 } as const;
const missing = /^(?:N\/A|\[N\/A\]|Not Supported|\[Not Supported\])$/i;
function fields(line: string): string[] {
  const parts: string[] = []; let value = '', quoted = false, closed = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) { if (c === '"') { if (line[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } } else value += c; }
    else if (c === ',') { parts.push(value.trim()); value = ''; closed = false; }
    else if (c === '"' && !value.trim() && !closed) { value = ''; quoted = true; }
    else if (c === '"' || closed && c !== ' ') throw new Error('Malformed GPU response.');
    else value += c;
  }
  if (quoted) throw new Error('Incomplete GPU response.');
  return [...parts, value.trim()];
}
function number(value: string, maximum: number): number | null {
  if (missing.test(value)) return null;
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Invalid GPU reading.');
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed > maximum) throw new Error('GPU reading outside bounds.');
  return parsed;
}
export function parseGpuReadings(output: string): GpuReading[] {
  if (Buffer.byteLength(output) > GPU_QUERY_LIMITS.maxBuffer) throw new Error('GPU response too large.');
  const lines = output.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (!output.trim() || lines.length > 16) throw new Error('GPU response has no supported device list.');
  const devices = lines.map(line => {
    const f = fields(line); if (f.length !== 8 || !/^\d+$/.test(f[0]) || Number(f[0]) > 127 || !f[1] || f[1].length > 200 || /[\x00-\x1f\x7f]/.test(f[1])) throw new Error('Invalid GPU identity.');
    const total = number(f[2], 1_048_576), used = number(f[3], 1_048_576);
    if (used !== null && total !== null && used > total) throw new Error('Invalid GPU memory accounting.');
    return { index: Number(f[0]), name: f[1], memoryTotalBytes: total === null ? null : total * 1024 ** 2, memoryUsedBytes: used === null ? null : used * 1024 ** 2,
      temperatureC: number(f[4], 200), powerWatts: number(f[5], 10_000), graphicsMHz: number(f[6], 20_000), utilizationPercent: number(f[7], 100) };
  });
  if (new Set(devices.map(d => d.index)).size !== devices.length) throw new Error('Duplicate GPU index.');
  return devices;
}
export interface GpuTelemetryAdapter { supported: boolean; query(): Promise<string>; }
export function createWindowsGpuAdapter(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, execute: (file: string, args: string[], limits: typeof GPU_QUERY_LIMITS) => Promise<string> = async (file, args, limits) => (await promisify(execFile)(file, args, limits)).stdout): GpuTelemetryAdapter {
  return { supported: platform === 'win32', async query() {
    if (platform !== 'win32') throw new Error('Windows required.');
    const root = env.SystemRoot ?? 'C:\\Windows', programFiles = env.ProgramW6432 ?? env.ProgramFiles ?? 'C:\\Program Files';
    const candidates = [[root, 'System32', 'nvidia-smi.exe'], [programFiles, 'NVIDIA Corporation', 'NVSMI', 'nvidia-smi.exe']];
    for (const [base, ...rest] of candidates) {
      if (!/^[a-z]:\\/i.test(base) || base.includes('..')) continue;
      try { return await execute(path.win32.join(base, ...rest), [...GPU_QUERY_ARGS], GPU_QUERY_LIMITS); }
      catch (error) { // Try the legacy installation only when the first executable is absent.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('NVIDIA telemetry query failed.');
      }
    }
    throw new Error('NVIDIA telemetry utility is unavailable.');
  } };
}
export function createGpuTelemetryService(adapter: GpuTelemetryAdapter = createWindowsGpuAdapter(), now = Date.now) {
  let cache: GpuTelemetry | null = null, cachedAt = -Infinity, pending: Promise<GpuTelemetry> | null = null;
  return { get(): Promise<GpuTelemetry> {
    if (pending) return pending;
    if (cache && now() >= cachedAt && now() - cachedAt < 15_000) return Promise.resolve({ ...cache, cached: true });
    pending = (async () => {
      let devices: GpuReading[] = [], reason: string | undefined;
      if (!adapter.supported) reason = 'NVIDIA hardware readings require the Windows desktop app and a supported NVIDIA driver.';
      else try { devices = parseGpuReadings(await adapter.query()); } catch { reason = 'NVIDIA hardware readings are unavailable. The driver utility may be missing, unsupported, busy or blocked. No readings were estimated.'; }
      cachedAt = now();
      cache = { timestamp: new Date(cachedAt).toISOString(), provider: 'NVIDIA SMI', status: devices.length ? 'available' : 'unavailable', cached: false, devices, ...(reason ? { reason } : {}) };
      return cache;
    })().finally(() => { pending = null; });
    return pending;
  } };
}
