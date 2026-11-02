import { execFile } from 'node:child_process';
import path from 'node:path';
import { summarizeNetworkPath, windowsNetworkPath } from './network-path';
import type { NetworkResult } from '../shared/types';

import { NETWORK_TARGETS, summarizeNetwork } from './network-measurements';
export { NETWORK_TARGETS, summarizeNetwork } from './network-measurements';
// Fixed destinations and bounded ICMP requests. No arbitrary command, URL or host IPC.
export const NETWORK_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$target=$args[0]
if ($target -notin @('1.1.1.1','8.8.8.8')) { throw 'Unsupported destination.' }
$ping=New-Object System.Net.NetworkInformation.Ping
$samples=New-Object System.Collections.Generic.List[object]
try {
 for ($i=0; $i -lt 8; $i++) {
  try {
   $reply=$ping.Send($target,1000)
   if ($reply.Status -eq 'Success') { $samples.Add([double]$reply.RoundtripTime) }
   else { $samples.Add($null) }
  } catch { $samples.Add($null) }
  if ($i -lt 7) { Start-Sleep -Milliseconds 250 }
 }
} finally { $ping.Dispose() }
@{ samples=@($samples.ToArray()) } | ConvertTo-Json -Compress
`;
function windowsPing(address: string): Promise<unknown> {
  if (process.platform !== 'win32') return Promise.reject(new Error('Network diagnostics require the Windows desktop app.'));
  const executable = path.win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  // Destination is mapped from an allowlisted ID, never renderer text.
  return new Promise((resolve, reject) => execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `& { ${NETWORK_SCRIPT} } '${address}'`], { windowsHide: true, timeout: 20000, maxBuffer: 16000 }, (error, stdout) => {
    if (error) return reject(new Error('The Windows network diagnostic could not finish. Check your connection and try again.'));
    try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())); }
    catch { reject(new Error('Windows returned an unreadable network measurement.')); }
  }));
}
export function createNetworkService(run: (address: string) => Promise<unknown> = windowsPing, runPath: (address: string) => Promise<unknown> = windowsNetworkPath) {
  let busy = false;
  return { async testNetwork(input: unknown): Promise<NetworkResult> {
    if (input !== 'cloudflare' && input !== 'google') throw new Error('Choose a supported diagnostic destination.');
    if (busy) throw new Error('A network test is already running.');
    busy = true;
    try { return summarizeNetwork(input, await run(NETWORK_TARGETS[input])); }
    finally { busy = false; }
  }, async testNetworkPath(input: unknown) {
    if (input !== 'cloudflare' && input !== 'google') throw new Error('Choose a supported diagnostic destination.');
    if (busy) throw new Error('A network test is already running.');
    busy = true;
    try { return summarizeNetworkPath(input, await runPath(NETWORK_TARGETS[input])); }
    finally { busy = false; }
  } };
}
