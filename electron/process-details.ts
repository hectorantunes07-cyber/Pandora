import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessIdentity, ProcessDetails } from '../shared/process-details';
const validPid = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 0xffffffff;
export const isLocalImagePath = (v: unknown): v is string => typeof v === 'string' && /^[a-z]:\\/i.test(v) && v.length < 32768 && !/[\x00-\x1f]/.test(v) && !v.slice(3).includes(':');
export function buildProcessDetailsQuery(pid: number): string {
  if (!validPid(pid)) throw new Error('Choose a valid running process.');
  return String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$p=Get-Process -Id ${pid} -ErrorAction Stop
try {
 $started=$null;$image=$null;$company=$null;$version=$null
 try { $started=$p.StartTime.ToUniversalTime().ToString('o') } catch {}
 try { $image=$p.MainModule.FileName } catch {}
 if($image -and $image -match '^[a-zA-Z]:\\' -and $image.Length -lt 32768) {
  try { $metadata=[Diagnostics.FileVersionInfo]::GetVersionInfo($image);$company=$metadata.CompanyName;$version=$metadata.FileVersion } catch {}
 }
 $p.Refresh()
 if($p.HasExited){throw 'The selected process exited.'}
 @{pid=[long]$p.Id;name=[string]$p.ProcessName;startedAt=$started;executable=$image;company=$company;version=$version} | ConvertTo-Json -Compress
} finally { $p.Dispose() }
`;
}
function cleanText(v: unknown, maximum: number): string | null {
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || v.length > maximum || /[\x00-\x1f]/.test(v)) throw new Error('Invalid process metadata.');
  return v;
}
export function parseProcessIdentity(raw: unknown, pid: number): ProcessIdentity {
  const r = raw as ProcessIdentity;
  if (!validPid(pid) || r?.pid !== pid) throw new Error('The selected process could not be identified.');
  const name = cleanText(r.name, 260); if (!name) throw new Error('Invalid process name.');
  const startedAt = cleanText(r.startedAt, 50);
  if (startedAt && (!/^\d{4}-\d\d-\d\dT/.test(startedAt) || !Number.isFinite(Date.parse(startedAt)))) throw new Error('Invalid process start time.');
  const executable = r.executable === null || r.executable === '' ? null : isLocalImagePath(r.executable) ? r.executable : null;
  return { pid, name, startedAt, executable, company: cleanText(r.company, 256), version: cleanText(r.version, 128) };
}
export async function readProcessIdentity(pid: number): Promise<ProcessIdentity> {
  const script = buildProcessDetailsQuery(pid);
  if (process.platform !== 'win32') throw new Error('Process details require the Windows app.');
  try {
    const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const { stdout } = await promisify(execFile)(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15_000, maxBuffer: 64 * 1024 });
    return parseProcessIdentity(JSON.parse(stdout.replace(/^\uFEFF/, '').trim()), pid);
  } catch { throw new Error('This process exited or Windows could not read its details. Refresh the process list.'); }
}
export function createProcessDetailsService(show: (location: string) => void, read = readProcessIdentity, resolve = async (file: string) => {
  const canonical = await fs.realpath(file);
  if (!isLocalImagePath(canonical) || !(await fs.stat(canonical)).isFile()) throw new Error('The executable location is unavailable.');
  return canonical;
}) {
  let review: { token: string; identity: ProcessIdentity; expires: number; canonical: string } | null = null;
  let generation = 0;
  async function get(pid: unknown): Promise<ProcessDetails> {
    review = null; const own = ++generation;
    if (!validPid(pid)) throw new Error('Choose a valid running process.');
    const identity = parseProcessIdentity(await read(pid), pid);
    let canonical: string | null = null;
    if (identity.executable && identity.startedAt) { try { const result = await resolve(identity.executable); if (isLocalImagePath(result)) canonical = result; } catch { /* Keep readable metadata; no folder action for an inaccessible image. */ } }
    if (own !== generation) throw new Error('A newer process was selected.');
    if (canonical) review = { token: randomUUID(), identity, expires: Date.now() + 300_000, canonical };
    return { ...identity, token: review?.token ?? null };
  }
  async function open(token: unknown): Promise<void> {
    const saved = review; review = null; ++generation;
    if (!saved || token !== saved.token || Date.now() > saved.expires) throw new Error('Open the process details again before requesting its folder.');
    try {
      const current = parseProcessIdentity(await read(saved.identity.pid), saved.identity.pid);
      if (current.startedAt !== saved.identity.startedAt || !current.executable || current.executable !== saved.identity.executable || current.name !== saved.identity.name) throw new Error('Process identity changed.');
      const canonical = await resolve(current.executable);
      if (canonical !== saved.canonical || !isLocalImagePath(canonical)) throw new Error('Executable location changed.');
      show(canonical);
    } catch { throw new Error('The selected process or executable location changed or became unavailable. Refresh its details; no folder was opened.'); }
  }
  return { get, open };
}
