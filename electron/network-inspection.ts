import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { NetworkInspection, DnsResult } from '../shared/types';
export const ADAPTER_INSPECTION_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
$notes=New-Object System.Collections.Generic.List[string]
$adapters=@(Get-NetAdapter -IncludeHidden -ErrorAction Stop | Select-Object -First 64)
$advanced=@(); $power=@(); $routes=@(); $routeAvailable=$false
try { $advanced=@(Get-NetAdapterAdvancedProperty -Name '*' -AllProperties -IncludeHidden -ErrorAction Stop) } catch { $notes.Add('Advanced driver properties are unavailable or require permission.') }
try { $power=@(Get-NetAdapterPowerManagement -Name '*' -IncludeHidden -ErrorAction Stop) } catch { $notes.Add('Adapter power-management data is unavailable; this provider can require administrator permission. No elevation was requested.') }
try { $routes=@(Get-NetRoute -ErrorAction Stop | Where-Object { $_.DestinationPrefix -in @('0.0.0.0/0','::/0') }); $routeAvailable=$true } catch { $notes.Add('Default-route inventory is unavailable.') }
$output=@($adapters | ForEach-Object {
 $a=$_; $properties=@($advanced | Where-Object { $_.Name -eq $a.Name -and $_.RegistryKeyword -in @('*EEE','EEE','EnableEEE','AdvancedEEE','*InterruptModeration') } | Select-Object -First 16)
 $management=@($power | Where-Object { $_.Name -eq $a.Name } | Select-Object -First 1)
 $features=@()
 if($management.Count -gt 0) {
  foreach($key in @('AllowComputerToTurnOffDevice','SelectiveSuspend','DeviceSleepOnDisconnect','D0PacketCoalescing','ArpOffload','NSOffload','WakeOnMagicPacket','WakeOnPattern')) {
   $value=$management[0].PSObject.Properties[$key]
   if($null -ne $value -and $null -ne $value.Value){$features+=@{name=$key;value=[string]$value.Value}}
  }
 }
 [pscustomobject]@{ index=[int]$a.ifIndex; description=$a.InterfaceDescription; status=[string]$a.Status; physical=$(if($null -eq $a.HardwareInterface){$null}else{[bool]$a.HardwareInterface}); linkSpeedBits=$(if($null -eq $a.TransmitLinkSpeed){$null}else{[double]$a.TransmitLinkSpeed}); defaultRoute=$(if(-not $routeAvailable){$null}else{@($routes | Where-Object {$_.InterfaceIndex -eq $a.ifIndex}).Count -gt 0}); advanced=@($properties | ForEach-Object {@{keyword=$_.RegistryKeyword;name=$_.DisplayName;value=$_.DisplayValue;raw=(@($_.RegistryValue) -join ', ');options=@($_.ValidDisplayValues)}}); power=@($features) }
})
@{adapters=$output;notes=@($notes)} | ConvertTo-Json -Depth 7 -Compress
`;
export const DNS_INSPECTION_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
$timer=[Diagnostics.Stopwatch]::StartNew()
try {
 $answers=@(Resolve-DnsName -Name 'www.microsoft.com' -Type A -DnsOnly -NoHostsFile -QuickTimeout -ErrorAction Stop | Where-Object {$_.Type -eq 'A' -and $_.IPAddress})
 $timer.Stop()
 @{resolved=$answers.Count -gt 0;elapsedMs=$timer.Elapsed.TotalMilliseconds;answerCount=$answers.Count} | ConvertTo-Json -Compress
} catch { $timer.Stop(); @{resolved=$false;elapsedMs=$timer.Elapsed.TotalMilliseconds;answerCount=0} | ConvertTo-Json -Compress }
`;
async function windows(script: string): Promise<unknown> {
  if (process.platform !== 'win32') throw new Error('Network inspection requires the Windows desktop app.');
  const executable = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  try {
    const { stdout } = await promisify(execFile)(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); ${script}`], { windowsHide: true, timeout: 25_000, maxBuffer: 512 * 1024, encoding: 'utf8' });
    return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  } catch { throw new Error('The Windows network provider could not complete. Data may be unavailable, permission-restricted or timed out.'); }
}
const text = (v: unknown) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240) : '';
const rows = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.filter(r => r && typeof r === 'object') : [];
export function parseNetworkInspection(raw: unknown): NetworkInspection {
  const data = raw as { adapters?: unknown; notes?: unknown };
  if (!Array.isArray(data?.adapters)) throw new Error('Windows returned an invalid adapter inventory.');
  const adapters = rows(data.adapters).slice(0, 64).flatMap(a => {
    if (!Number.isInteger(a.index) || Number(a.index) < 0 || !text(a.description)) return [];
    return [{ index: Number(a.index), description: text(a.description), status: text(a.status) || 'Unavailable', physical: typeof a.physical === 'boolean' ? a.physical : null, defaultRoute: typeof a.defaultRoute === 'boolean' ? a.defaultRoute : null, linkSpeedBits: typeof a.linkSpeedBits === 'number' && Number.isFinite(a.linkSpeedBits) && a.linkSpeedBits >= 0 ? a.linkSpeedBits : null,
      advanced: rows(a.advanced).slice(0, 16).filter(p => ['*EEE', 'EEE', 'EnableEEE', 'AdvancedEEE', '*InterruptModeration'].includes(text(p.keyword))).map(p => ({ keyword: text(p.keyword), name: text(p.name) || text(p.keyword), value: text(p.value) || text(p.raw) || 'Unavailable', options: Array.isArray(p.options) ? p.options.map(text).filter(Boolean).slice(0, 32) : [] })),
      power: rows(a.power).filter(p => ['AllowComputerToTurnOffDevice', 'SelectiveSuspend', 'DeviceSleepOnDisconnect', 'D0PacketCoalescing', 'ArpOffload', 'NSOffload', 'WakeOnMagicPacket', 'WakeOnPattern'].includes(text(p.name))).slice(0, 8).map(p => ({ name: text(p.name), value: text(p.value) || 'Unavailable' })),
    }];
  });
  return { timestamp: new Date().toISOString(), adapters, notes: Array.isArray(data.notes) ? data.notes.map(text).filter(Boolean).slice(0, 10) : [] };
}
export function createNetworkInspection(run: (script: string) => Promise<unknown> = windows) {
  let inspecting = false, resolving = false;
  return {
    async inspect(): Promise<NetworkInspection> {
      if (inspecting) throw new Error('An adapter inspection is already running.');
      inspecting = true;
      try { return parseNetworkInspection(await run(ADAPTER_INSPECTION_SCRIPT)); } finally { inspecting = false; }
    },
    async dns(): Promise<DnsResult> {
      if (resolving) throw new Error('A DNS check is already running.');
      resolving = true;
      try {
        const data = await run(DNS_INSPECTION_SCRIPT) as Partial<DnsResult>;
        if (typeof data?.resolved !== 'boolean' || typeof data.elapsedMs !== 'number' || !Number.isFinite(data.elapsedMs) || data.elapsedMs < 0 || data.elapsedMs > 25_000 || !Number.isInteger(data.answerCount) || Number(data.answerCount) < 0 || data.resolved !== (Number(data.answerCount) > 0)) throw new Error('Windows returned an invalid DNS result.');
        return { hostname: 'www.microsoft.com', resolved: data.resolved, elapsedMs: data.elapsedMs, answerCount: Number(data.answerCount), timestamp: new Date().toISOString() };
      } finally { resolving = false; }
    },
  };
}
