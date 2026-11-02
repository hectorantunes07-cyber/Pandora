import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { NetworkPathResult, NetworkTarget } from '../shared/types';
import { NETWORK_TARGETS, summarizeNetwork } from './network-measurements';

// Functions are separate so native fixtures can replace only providers/probes.
// Production always executes the complete fixed script with an allowlisted IPv4 destination.
export const NETWORK_PATH_FUNCTIONS = String.raw`
function Read-PandoraRoute([string]$Destination) {
 $routes=@(Find-NetRoute -RemoteIPAddress $Destination -ErrorAction Stop | Where-Object { $null -ne $_.NextHop })
 if($routes.Count -ne 1) { throw 'No unique selected route.' }
 $route=$routes[0]
 if([int]$route.InterfaceIndex -le 0 -or [string]::IsNullOrWhiteSpace([string]$route.DestinationPrefix)) { throw 'Invalid route.' }
 $ip=$null
 if(-not [System.Net.IPAddress]::TryParse([string]$route.NextHop,[ref]$ip) -or $ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { throw 'No IPv4 next hop.' }
 $bytes=$ip.GetAddressBytes()
 $gateway=$ip.ToString()
 if($gateway -eq '0.0.0.0') { $gateway=$null }
 elseif($bytes[0] -eq 0 -or $bytes[0] -eq 127 -or $bytes[0] -ge 224 -or $gateway -eq '255.255.255.255') { throw 'Not a usable unicast next hop.' }
 @{ key=([string]$route.InterfaceIndex+'|'+[string]$route.DestinationPrefix+'|'+[string]$route.NextHop); gateway=$gateway }
}
function Measure-PandoraHop([string]$Address) {
 $ping=New-Object System.Net.NetworkInformation.Ping
 $samples=New-Object System.Collections.Generic.List[object]
 try {
  for($i=0; $i -lt 8; $i++) {
   try {
    $reply=$ping.Send($Address,1000)
    if($reply.Status -eq 'Success') { $samples.Add([double]$reply.RoundtripTime) } else { $samples.Add($null) }
   } catch { $samples.Add($null) }
   if($i -lt 7) { Start-Sleep -Milliseconds 250 }
  }
 } finally { $ping.Dispose() }
 return ,($samples.ToArray())
}
`;
export const NETWORK_PATH_QUERY = String.raw`
$before=$null; $after=$null; $gatewaySamples=$null; $gatewayStatus='unavailable'; $stable=$null
try { $before=Read-PandoraRoute $target } catch {}
if($null -ne $before) {
 if($null -eq $before.gateway) { $gatewayStatus='no-gateway' }
 else {
  try { $gatewaySamples=Measure-PandoraHop $before.gateway; $gatewayStatus='available' } catch {}
 }
}
$internetSamples=Measure-PandoraHop $target
try { $after=Read-PandoraRoute $target } catch {}
if($null -ne $before -and $null -ne $after) { $stable=($before.key -eq $after.key) }
@{ gatewayStatus=$gatewayStatus; routeStable=$stable; gatewaySamples=$gatewaySamples; internetSamples=$internetSamples } | ConvertTo-Json -Depth 4 -Compress
`;
export const NETWORK_PATH_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$target=$args[0]
if($target -notin @('1.1.1.1','8.8.8.8')) { throw 'Unsupported destination.' }
` + NETWORK_PATH_FUNCTIONS + NETWORK_PATH_QUERY;

const execute = promisify(execFile);
export async function windowsNetworkPath(address: string): Promise<unknown> {
  if (process.platform !== 'win32') throw new Error('Network path checks require the Windows desktop app.');
  if (!Object.values(NETWORK_TARGETS).includes(address as '1.1.1.1' | '8.8.8.8')) throw new Error('Unsupported diagnostic destination.');
  const executable = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  try {
    const { stdout } = await execute(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `& { ${NETWORK_PATH_SCRIPT} } '${address}'`], { windowsHide: true, timeout: 35000, maxBuffer: 16000, encoding: 'utf8' });
    return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  } catch { throw new Error('Windows could not complete the network path check. No network settings were changed.'); }
}

export function summarizeNetworkPath(target: NetworkTarget, raw: unknown, now: () => number = Date.now): NetworkPathResult {
  const value = raw as Record<string, unknown> | null;
  if (!value || !['available', 'no-gateway', 'unavailable'].includes(value.gatewayStatus as string) || ![true, false, null].includes(value.routeStable as boolean | null)) throw new Error('Windows returned invalid route measurements.');
  const timestamp = now();
  const internet = summarizeNetwork(target, { samples: value.internetSamples }, () => timestamp);
  let gateway: NetworkPathResult['gateway'] = null;
  if (value.gatewayStatus === 'available') {
    const { target: _target, address: _address, ...measurement } = summarizeNetwork(target, { samples: value.gatewaySamples }, () => timestamp);
    gateway = measurement;
  } else if (value.gatewaySamples !== null) throw new Error('Windows returned inconsistent gateway measurements.');
  // Explicit schema excludes route addresses, interface names and provider errors.
  return { target, timestamp: internet.timestamp, gatewayStatus: value.gatewayStatus as NetworkPathResult['gatewayStatus'], routeStable: value.routeStable as boolean | null, gateway, internet };
}
