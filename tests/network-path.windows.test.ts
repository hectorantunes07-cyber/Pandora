import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NETWORK_PATH_FUNCTIONS, NETWORK_PATH_QUERY, windowsNetworkPath, summarizeNetworkPath } from '../electron/network-path';
const powershell = process.env.PANDORA_PWSH || (process.platform === 'win32' ? path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : '');
describe.skipIf(!powershell)('native route selection and comparison fixtures', () => {
  it('runs actual route/query logic with isolated route providers and no network traffic', async () => {
    const script = String.raw`
$ErrorActionPreference='Stop'
${NETWORK_PATH_FUNCTIONS}
function Find-NetRoute {
 param([string]$RemoteIPAddress,[string]$ErrorAction)
 if($RemoteIPAddress -ne '1.1.1.1'){throw 'Unexpected target'}
 if($script:scenario -eq 'missing'){throw 'Provider unavailable'}
 $script:reads++
 $hop='192.0.2.1'
 if($script:scenario -eq 'direct'){$hop='0.0.0.0'}
 if($script:scenario -eq 'loopback'){$hop='127.0.0.1'}
 if($script:scenario -eq 'multicast'){$hop='224.0.0.1'}
 if($script:scenario -eq 'ipv6'){$hop='fe80::1'}
 if($script:scenario -eq 'hostname'){$hop='untrusted.invalid'}
 if($script:scenario -eq 'changed' -and $script:reads -eq 2){$hop='192.0.2.2'}
 [pscustomobject]@{IPAddress='PRIVATE_LOCAL_ADDRESS';InterfaceIndex=7}
 [pscustomobject]@{NextHop=$hop;InterfaceIndex=7;DestinationPrefix='0.0.0.0/0'}
 if($script:scenario -eq 'ambiguous'){[pscustomobject]@{NextHop='192.0.2.2';InterfaceIndex=8;DestinationPrefix='0.0.0.0/0'}}
}
function Measure-PandoraHop([string]$Address) {
 $script:probes.Add($Address)
 if($Address -notin @('192.0.2.1','1.1.1.1')){throw 'Unexpected probe'}
 return ,([object[]]@(1,2,3,4,5,6,7,8))
}
$target='1.1.1.1'
foreach($scenario in @('normal','changed','direct','missing','loopback','multicast','ipv6','hostname','ambiguous')) {
 $script:scenario=$scenario; $script:reads=0; $script:probes=New-Object System.Collections.Generic.List[string]
 $json=& { ${NETWORK_PATH_QUERY} }
 $result=$json | ConvertFrom-Json
 if($json.Contains('192.0.2') -or $json.Contains('PRIVATE')){throw 'Route identity leaked'}
 if($result.internetSamples.Count -ne 8){throw 'Internet result missing'}
 if($scenario -in @('normal','changed')) {
  if($result.gatewayStatus -ne 'available' -or $result.gatewaySamples.Count -ne 8 -or $script:probes.Count -ne 2){throw 'Gateway comparison missing'}
  if($result.routeStable -ne ($scenario -eq 'normal')){throw 'Route change not detected'}
 } else {
  if($null -ne $result.gatewaySamples -or $script:probes.Count -ne 1){throw 'Invalid gateway was probed'}
  if($scenario -eq 'direct') { if($result.gatewayStatus -ne 'no-gateway'){throw 'Direct route status'} }
  elseif($result.gatewayStatus -ne 'unavailable' -or $null -ne $result.routeStable){throw 'Unavailable route status'}
 }
}
'Route fixtures passed; no network probes or configuration changes.'
`;
    const { stdout } = await promisify(execFile)(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeout: 30000, maxBuffer: 64000, encoding: 'utf8' });
    expect(stdout).toContain('Route fixtures passed');
  }, 40000);
});


describe.skipIf(process.platform !== 'win32')('native Windows route and ICMP comparison', () => {
  it('queries the actual selected route and returns bounded real replies or explicit timeouts', async () => {
    const raw = await windowsNetworkPath('1.1.1.1');
    const result = summarizeNetworkPath('cloudflare', raw);
    expect(['available', 'no-gateway']).toContain(result.gatewayStatus);
    expect(result.internet.samples).toHaveLength(8);
    if (result.gatewayStatus === 'available') expect(result.gateway?.samples).toHaveLength(8);
    expect(result.routeStable === null || typeof result.routeStable === 'boolean').toBe(true);
    expect(Object.keys(raw as object).sort()).toEqual(['gatewaySamples', 'gatewayStatus', 'internetSamples', 'routeStable']);
  }, 45000);
});
