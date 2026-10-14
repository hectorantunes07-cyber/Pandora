import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { SystemRestoreInfo, RestorePointOutcome } from '../shared/system-restore';
export const SYSTEM_RESTORE_QUERY = String.raw`
$ErrorActionPreference='Stop'
$env:PSModulePath="$PSHOME\Modules"
$os=Get-CimInstance -ClassName Win32_OperatingSystem
if($os.ProductType -ne 1) { @{supported=$false;readable=$false;points=@();reason='Windows System Restore requires a Windows client edition; Windows Server is unsupported.'} | ConvertTo-Json -Compress; return }
try {
 $points=@(Get-CimInstance -Namespace root/default -ClassName SystemRestore -ErrorAction Stop | Sort-Object SequenceNumber -Descending | Select-Object -First 100 | ForEach-Object {
  $time=$null
  try { if($_.CreationTime -is [DateTime]) {$time=$_.CreationTime.ToUniversalTime().ToString('o')} else {$time=[System.Management.ManagementDateTimeConverter]::ToDateTime([string]$_.CreationTime).ToUniversalTime().ToString('o')} } catch {}
  @{sequence=[long]$_.SequenceNumber;description=([string]$_.Description).Substring(0,[Math]::Min(256,([string]$_.Description).Length));createdAt=$time}
 })
 @{supported=$true;readable=$true;points=$points} | ConvertTo-Json -Depth 5 -Compress
} catch {
 @{supported=$true;readable=$false;points=@();reason='The restore-point list is unavailable to this account. Creation can request administrator approval; use Windows System Protection to inspect protection and existing points.'} | ConvertTo-Json -Compress
}`;
const validId = (id: string) => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id);
export const restorePointDescription = (id: string) => { if (!validId(id)) throw new Error('Invalid restore-point request.'); return `PANDORA before changes ${id}`; };
// This self-contained helper is the only elevated action. No script/result files,
// renderer commands, paths or user-provided descriptions cross the UAC boundary.
export function buildRestorePointScript(id: string): string {
  const description = restorePointDescription(id);
  return String.raw`
$ErrorActionPreference='Stop'
$env:PSModulePath="$PSHOME\Modules"
function New-PandoraRestorePoint {
 try {
  if((Get-CimInstance -ClassName Win32_OperatingSystem).ProductType -ne 1) { return 22 }
  $before=@(Get-CimInstance -Namespace root/default -ClassName SystemRestore -ErrorAction Stop | ForEach-Object { [long]$_.SequenceNumber })
  try { Checkpoint-Computer -Description '${description}' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop -WarningAction Stop | Out-Null } catch { }
  $created=@(Get-CimInstance -Namespace root/default -ClassName SystemRestore -ErrorAction Stop | Where-Object { $_.Description -ceq '${description}' -and $before -notcontains [long]$_.SequenceNumber })
  if($created.Count -eq 1) { return 0 }
  return 21
 } catch { return 23 }
}
exit (New-PandoraRestorePoint)
`;
}
export function buildRestoreElevationScript(id: string): string {
  const encoded = Buffer.from(buildRestorePointScript(id), 'utf16le').toString('base64');
  return String.raw`
$ErrorActionPreference='Stop'
$env:PSModulePath="$PSHOME\Modules"
try {
 $p=Start-Process -FilePath "$PSHOME\powershell.exe" -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand','${encoded}') -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ErrorAction Stop
 if($null -eq $p -or $null -eq $p.ExitCode) { @{exitCode=21;cancelled=$false} | ConvertTo-Json -Compress; return }
 @{exitCode=[int]$p.ExitCode;cancelled=$false} | ConvertTo-Json -Compress
} catch {
 $e=$_.Exception; $cancelled=$false
 while($null -ne $e) { if($e -is [System.ComponentModel.Win32Exception] -and $e.NativeErrorCode -eq 1223) {$cancelled=$true}; $e=$e.InnerException }
 @{exitCode=23;cancelled=$cancelled} | ConvertTo-Json -Compress
}`;
}
export interface SystemRestoreAdapter { read(): Promise<SystemRestoreInfo>; create(id: string): Promise<RestorePointOutcome>; }
export function validateRestoreInfo(raw: unknown): SystemRestoreInfo {
  const value = raw as SystemRestoreInfo;
  if (!value || typeof value.supported !== 'boolean' || typeof value.readable !== 'boolean' || !Array.isArray(value.points) || value.points.length > 100 || (!value.readable && value.points.length > 0) || new Set(value.points.map(p => p?.sequence)).size !== value.points.length || value.points.some(p => !p || !Number.isInteger(p.sequence) || p.sequence < 0 || p.sequence > 0xffffffff || typeof p.description !== 'string' || p.description.length > 256 || p.createdAt !== null && (typeof p.createdAt !== 'string' || !Number.isFinite(Date.parse(p.createdAt)))) || value.reason !== undefined && (typeof value.reason !== 'string' || value.reason.length > 600)) throw new Error('Invalid Windows restore-point response.');
  return { supported: value.supported, readable: value.readable, points: value.points.map(p => ({ sequence: p.sequence, description: p.description, createdAt: p.createdAt })), ...(value.reason ? { reason: value.reason } : {}) };
}
export function createWindowsRestoreAdapter(): SystemRestoreAdapter {
  async function run(script: string, timeout: number) {
    if (process.platform !== 'win32') throw new Error('Windows required.');
    const { stdout } = await promisify(execFile)(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout, maxBuffer: 128 * 1024 });
    return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  }
  return {
    async read() {
      if (process.platform !== 'win32') return { supported: false, readable: false, points: [], reason: 'Windows System Restore requires the Windows desktop app.' };
      try { return validateRestoreInfo(await run(SYSTEM_RESTORE_QUERY, 20_000)); }
      catch { return { supported: false, readable: false, points: [], reason: 'Windows System Restore could not be inspected. Open System Protection to check availability and permissions.' }; }
    },
    async create(id) {
      const result = await run(buildRestoreElevationScript(id), 180_000);
      if (result?.cancelled === true) return 'cancelled';
      if (result?.cancelled !== false || !Number.isInteger(result.exitCode)) return 'unconfirmed';
      return result.exitCode === 0 ? 'created' : result.exitCode === 22 ? 'unsupported' : result.exitCode === 21 ? 'unconfirmed' : 'failed';
    },
  };
}
