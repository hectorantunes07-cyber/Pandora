import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { ProcessActivity, ProcessActivityRow } from '../shared/process-activity';
export const PROCESS_ACTIVITY_QUERY = String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Read-PandoraProcessors {
 try { $count=[int](Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop).NumberOfLogicalProcessors; if($count -gt 0 -and $count -le 4096){return $count} } catch {}
 return $null
}
function Read-PandoraProcesses {
 $all=@(Get-Process -ErrorAction Stop | Sort-Object Id)
 $wasTruncated=(@($all | Where-Object {$_.Id -gt 0}).Count -gt 512)
 $rows=New-Object System.Collections.Generic.List[object]
 try {
  foreach($p in @($all | Where-Object {$_.Id -gt 0} | Select-Object -First 512)) {
   $started=$null; $cpu=$null; $memory=$null; $name='Unavailable'
   try { $name=[string]$p.ProcessName } catch {}
   try { $started=$p.StartTime.ToUniversalTime().Ticks.ToString([Globalization.CultureInfo]::InvariantCulture) } catch {}
   try { $cpu=$p.TotalProcessorTime.Ticks.ToString([Globalization.CultureInfo]::InvariantCulture) } catch {}
   $observed=[Diagnostics.Stopwatch]::GetTimestamp().ToString([Globalization.CultureInfo]::InvariantCulture)
   try { $memory=[double]$p.WorkingSet64 } catch {}
   $rows.Add(@{pid=[long]$p.Id;name=$name;started=$started;cpu=$cpu;observed=$observed;memory=$memory})
  }
 } finally { foreach($p in $all){$p.Dispose()} }
 @{rows=@($rows.ToArray());truncated=$wasTruncated}
}
$processorsBefore=Read-PandoraProcessors
$before=Read-PandoraProcesses
Start-Sleep -Milliseconds 2000
$after=Read-PandoraProcesses
$processorsAfter=Read-PandoraProcessors
@{frequency=[Diagnostics.Stopwatch]::Frequency.ToString([Globalization.CultureInfo]::InvariantCulture);processorsBefore=$processorsBefore;processorsAfter=$processorsAfter;before=$before;after=$after} | ConvertTo-Json -Depth 6 -Compress
`;
const execute = promisify(execFile);
export async function readProcessActivity(): Promise<unknown> {
  if (process.platform !== 'win32') throw new Error('Process activity sampling requires the Windows desktop app.');
  const executable = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  try {
    const { stdout } = await execute(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', PROCESS_ACTIVITY_QUERY], { windowsHide: true, timeout: 25000, maxBuffer: 512 * 1024, encoding: 'utf8' });
    return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  } catch { throw new Error('Windows could not finish the process activity sample. No processes were stopped or changed.'); }
}
type RawRow = { pid: number; name: string; started: bigint | null; cpu: bigint | null; observed: bigint; memory: number | null };
const tick = (value: unknown, nullable = false): bigint | null => {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^\d{1,19}$/.test(value) || BigInt(value) > 9223372036854775807n) throw new Error('Invalid process counter.');
  return BigInt(value);
};
function snapshot(value: unknown): { rows: RawRow[]; truncated: boolean } {
  const v = value as { rows: Record<string, unknown>[]; truncated: boolean };
  if (!v || !Array.isArray(v.rows) || v.rows.length > 512 || typeof v.truncated !== 'boolean') throw new Error('Invalid process snapshot.');
  const seen = new Set<number>();
  const rows = v.rows.map(row => {
    if (!row || !Number.isInteger(row.pid) || (row.pid as number) <= 0 || (row.pid as number) > 0xffffffff || seen.has(row.pid as number) || typeof row.name !== 'string' || row.name.length > 260 || /[\u0000-\u001f\u007f]/.test(row.name) || !row.name.trim() || row.memory !== null && (!Number.isSafeInteger(row.memory) || (row.memory as number) < 0)) throw new Error('Invalid process snapshot row.');
    seen.add(row.pid as number);
    return { pid: row.pid as number, name: row.name, started: tick(row.started, true), cpu: tick(row.cpu, true), observed: tick(row.observed)!, memory: row.memory as number | null };
  });
  return { rows, truncated: v.truncated };
}
export function summarizeProcessActivity(raw: unknown, now: () => number = Date.now): ProcessActivity {
  const v = raw as Record<string, unknown>;
  if (!v) throw new Error('Invalid process activity response.');
  const frequency = tick(v.frequency)!;
  if (frequency <= 0n || frequency > 1_000_000_000_000n) throw new Error('Invalid process timer frequency.');
  for (const count of [v.processorsBefore, v.processorsAfter]) if (count !== null && (!Number.isInteger(count) || (count as number) <= 0 || (count as number) > 4096)) throw new Error('Invalid logical processor count.');
  const logicalProcessors = v.processorsBefore === v.processorsAfter ? v.processorsAfter as number | null : null;
  const before = snapshot(v.before), after = snapshot(v.after), previous = new Map(before.rows.map(row => [row.pid, row]));
  const rows = after.rows.map((row): ProcessActivityRow => {
    const base = { pid: row.pid, name: row.name, memoryBytes: row.memory, cpuPercent: null, intervalMs: null };
    const old = previous.get(row.pid);
    if (!old || old.started !== null && row.started !== null && (old.started !== row.started || old.name !== row.name)) return { ...base, status: 'new-or-replaced' };
    if (!logicalProcessors || !old.started || !row.started || old.cpu === null || row.cpu === null || old.name !== row.name || row.cpu < old.cpu || row.observed <= old.observed) return { ...base, status: 'unavailable' };
    const seconds = Number(row.observed - old.observed) / Number(frequency);
    if (seconds < 0.1 || seconds > 60) return { ...base, status: 'unavailable' };
    const percent = Number(row.cpu - old.cpu) / 10_000_000 / seconds / logicalProcessors * 100;
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { ...base, status: 'unavailable' };
    return { ...base, cpuPercent: percent, intervalMs: seconds * 1000, status: 'measured' };
  });
  const measured = rows.flatMap(row => row.intervalMs === null ? [] : [row.intervalMs]);
  const currentIds = new Set(after.rows.map(row => row.pid));
  return { timestamp: new Date(now()).toISOString(), logicalProcessors, rows, truncated: before.truncated || after.truncated,
    noLongerObserved: before.rows.filter(row => !currentIds.has(row.pid)).length,
    minIntervalMs: measured.length ? Math.min(...measured) : null, maxIntervalMs: measured.length ? Math.max(...measured) : null };
}
export function createProcessActivityService(run: () => Promise<unknown> = readProcessActivity) {
  let busy = false;
  return { async sample(): Promise<ProcessActivity> {
    if (busy) throw new Error('A process activity sample is already running.');
    busy = true;
    try { return summarizeProcessActivity(await run()); } finally { busy = false; }
  } };
}
