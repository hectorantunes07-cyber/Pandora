import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { StorageCounters, StorageDeviceReading, StorageReliability } from '../shared/storage-reliability';

export const STORAGE_QUERY_LIMITS = { windowsHide: true, timeout: 20_000, maxBuffer: 65_536 } as const;
// Fixed local, read-only cmdlets. Never accept disks, paths, commands or remote sessions from IPC.
export const STORAGE_RELIABILITY_QUERY = String.raw`
$ErrorActionPreference='Stop'
$env:PSModulePath="$PSHOME\Modules"
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
function Text-Field($value,$fallback) {
 $text=([string]$value -replace '[\x00-\x1f\x7f]',' ').Trim()
 if(-not $text) { return $fallback }
 return $text.Substring(0,[Math]::Min(200,$text.Length))
}
function Number-Field($value,[double]$max) {
 if($null -eq $value -or $value -is [bool]) { return $null }
 $s=[string]$value
 if($s -notmatch '^\d+$') { return $null }
 $n=[double]$value
 if($n -lt 0 -or $n -gt $max) { return $null }
 return $n
}
function Counter-Field($value) {
 if($null -eq $value -or $value -is [bool]) { return $null }
 $s=[string]$value; $n=[UInt64]0
 if($s -notmatch '^\d{1,20}$' -or -not [UInt64]::TryParse($s,[ref]$n)) { return $null }
 return $n.ToString([Globalization.CultureInfo]::InvariantCulture)
}
$physical=@(Get-PhysicalDisk -ErrorAction Stop | Sort-Object DeviceId | Select-Object -First 33)
$index=0
$devices=@(foreach($disk in ($physical | Select-Object -First 32)) {
 $c=$null; $reason=$null
 try {
  $rows=@(Get-StorageReliabilityCounter -PhysicalDisk $disk -ErrorAction Stop)
  if($rows.Count -eq 0) { $reason='not-reported' }
  elseif($rows.Count -ne 1) { $reason='ambiguous-response' }
  elseif([string]::IsNullOrWhiteSpace([string]$disk.DeviceId) -or [string]$rows[0].DeviceId -cne [string]$disk.DeviceId) { $reason='identity-mismatch' }
  else { $c=$rows[0] }
 } catch { $reason='provider-unavailable' }
 $health='Unknown'
 if([string]$disk.HealthStatus -in @('Healthy','Warning','Unhealthy')) { $health=[string]$disk.HealthStatus }
 elseif([string]$disk.HealthStatus -eq '0') { $health='Healthy' }
 elseif([string]$disk.HealthStatus -eq '1') { $health='Warning' }
 elseif([string]$disk.HealthStatus -eq '2') { $health='Unhealthy' }
 $item=@{index=$index;model=(Text-Field $disk.Model 'Storage device');media=(Text-Field $disk.MediaType 'Unspecified');bus=(Text-Field $disk.BusType 'Unknown');bytes=(Number-Field $disk.Size 9007199254740991);health=$health;
  temperatureC=(Number-Field $c.Temperature 255);wearPercent=(Number-Field $c.Wear 255);powerOnHours=(Number-Field $c.PowerOnHours 65535);
  readErrorsTotal=(Counter-Field $c.ReadErrorsTotal);readErrorsCorrected=(Counter-Field $c.ReadErrorsCorrected);readErrorsUncorrected=(Counter-Field $c.ReadErrorsUncorrected);
  writeErrorsTotal=(Counter-Field $c.WriteErrorsTotal);writeErrorsCorrected=(Counter-Field $c.WriteErrorsCorrected);writeErrorsUncorrected=(Counter-Field $c.WriteErrorsUncorrected)}
 $reported=@('temperatureC','wearPercent','powerOnHours','readErrorsTotal','readErrorsCorrected','readErrorsUncorrected','writeErrorsTotal','writeErrorsCorrected','writeErrorsUncorrected') | Where-Object { $null -ne $item[$_] }
 if(@($reported).Count -eq 0 -and $null -eq $reason) { $reason='not-reported' }
 $item.countersStatus=if($null -eq $reason) {'reported'} else {'unavailable'}
 $item.reason=$reason
 $item
 $index++
})
@{devices=$devices;truncated=($physical.Count -gt 32)} | ConvertTo-Json -Depth 5 -Compress
`;
const errorKeys = ['readErrorsTotal', 'readErrorsCorrected', 'readErrorsUncorrected', 'writeErrorsTotal', 'writeErrorsCorrected', 'writeErrorsUncorrected'] as const;
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid storage label.');
  return value;
}
function number(value: unknown, max: number): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('Invalid storage reading.');
  return value;
}
function counter(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,19})$/.test(value) || BigInt(value) > 18446744073709551615n) throw new Error('Invalid storage counter.');
  return value;
}
export function parseStorageReadings(output: string): { devices: StorageDeviceReading[]; truncated: boolean } {
  if (Buffer.byteLength(output) > STORAGE_QUERY_LIMITS.maxBuffer) throw new Error('Storage response too large.');
  const raw = JSON.parse(output.replace(/^\uFEFF/, '').trim());
  if (!raw || !Array.isArray(raw.devices) || raw.devices.length > 32 || typeof raw.truncated !== 'boolean' || raw.truncated && raw.devices.length !== 32) throw new Error('Invalid storage response.');
  const devices = raw.devices.map((d: any, index: number): StorageDeviceReading => {
    if (!d || d.index !== index || !['Healthy', 'Warning', 'Unhealthy', 'Unknown'].includes(d.health) || !['reported', 'unavailable'].includes(d.countersStatus) || ![null, 'provider-unavailable', 'not-reported', 'identity-mismatch', 'ambiguous-response'].includes(d.reason)) throw new Error('Invalid storage device.');
    const readings: StorageCounters = { temperatureC: number(d.temperatureC, 255), wearPercent: number(d.wearPercent, 255), powerOnHours: number(d.powerOnHours, 65535), ...Object.fromEntries(errorKeys.map(k => [k, counter(d[k])])) } as StorageCounters;
    const hasReadings = Object.values(readings).some(v => v !== null);
    if (hasReadings !== (d.countersStatus === 'reported') || (d.reason === null) !== hasReadings) throw new Error('Inconsistent storage availability.');
    return { index, model: text(d.model), media: text(d.media), bus: text(d.bus), bytes: number(d.bytes, Number.MAX_SAFE_INTEGER), health: d.health, countersStatus: d.countersStatus, reason: d.reason, ...readings };
  });
  return { devices, truncated: raw.truncated };
}
export interface StorageReliabilityAdapter { supported: boolean; query(): Promise<string>; }
export function createWindowsStorageAdapter(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, execute: (file: string, args: string[], limits: typeof STORAGE_QUERY_LIMITS) => Promise<string> = async (file, args, limits) => (await promisify(execFile)(file, args, limits)).stdout): StorageReliabilityAdapter {
  return { supported: platform === 'win32', async query() {
    if (platform !== 'win32') throw new Error('Windows required.');
    const root = env.SystemRoot ?? 'C:\\Windows';
    if (!/^[a-z]:\\/i.test(root) || root.split(/[\\/]/).includes('..')) throw new Error('Invalid Windows path.');
    return execute(path.win32.join(root, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(STORAGE_RELIABILITY_QUERY, 'utf16le').toString('base64')], STORAGE_QUERY_LIMITS);
  } };
}
export function createStorageReliabilityService(adapter: StorageReliabilityAdapter = createWindowsStorageAdapter(), now = Date.now) {
  let cachedAt = -Infinity, cache: StorageReliability | null = null, pending: Promise<StorageReliability> | null = null;
  return { get(): Promise<StorageReliability> {
    if (pending) return pending;
    if (cache && now() >= cachedAt && now() - cachedAt < 30_000) return Promise.resolve({ ...cache, cached: true });
    pending = (async () => {
      let devices: StorageDeviceReading[] = [], truncated = false, reason: string | undefined;
      if (!adapter.supported) reason = 'Drive diagnostics require the Windows desktop app.';
      else try {
        ({ devices, truncated } = parseStorageReadings(await adapter.query()));
        if (!devices.length) reason = 'The Windows storage provider returned no physical devices.';
      } catch { reason = 'Drive diagnostics are unavailable. Windows permissions, the storage driver or a busy provider may prevent access. No values were estimated.'; }
      cachedAt = now();
      cache = { timestamp: new Date(cachedAt).toISOString(), provider: 'Windows Storage', status: devices.length ? 'available' : 'unavailable', cached: false, truncated, devices, ...(reason ? { reason } : {}) };
      return cache;
    })().finally(() => { pending = null; });
    return pending;
  } };
}
