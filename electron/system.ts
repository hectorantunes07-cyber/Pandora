import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import type { GameInfo, Metrics, ProcessInfo, StartupEntry, SystemInfo } from '../shared/types';

/** Fixed, read-only scripts: no renderer text, command lines, serial numbers or credentials. */
export const WINDOWS_QUERIES = {
  system: String.raw`
$notes = New-Object System.Collections.Generic.List[string]
function Query($class, $namespace = 'root\cimv2') {
  try { @(Get-CimInstance -Namespace $namespace -ClassName $class -ErrorAction Stop) }
  catch { $notes.Add("Windows provider unavailable: $class") ; @() }
}
$cpu = @(Query 'Win32_Processor')
$gpu = @(Query 'Win32_VideoController')
$ram = @(Query 'Win32_PhysicalMemory')
$board = @(Query 'Win32_BaseBoard')
$osInfo = @(Query 'Win32_OperatingSystem')
$disks = @(Query 'Win32_LogicalDisk' | Where-Object { $_.DriveType -eq 3 -and $_.Size -gt 0 })
$power = @(Query 'Win32_PowerPlan' 'root\cimv2\power' | Where-Object IsActive)
$computer = @(Query 'Win32_ComputerSystem')
$physical = @()
try {
 $physical = @(Get-PhysicalDisk -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ model=$_.FriendlyName; bytes=[double]$_.Size; media=[string]$_.MediaType; bus=[string]$_.BusType; health=[string]$_.HealthStatus } })
} catch {
 $notes.Add('Storage health and media type are unavailable; physical disk models use the basic Windows provider.')
 $physical = @(Query 'Win32_DiskDrive' | ForEach-Object { [pscustomobject]@{ model=$_.Model; bytes=[double]$_.Size; media='Unknown'; bus=[string]$_.InterfaceType; health=$null } })
}
$adapters = @()
try {
 # LinkSpeed is a formatted display property on Windows. Read the numeric CIM rate.
 $adapters = @(Get-NetAdapter -Physical -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ description=$_.InterfaceDescription; status=[string]$_.Status; linkSpeedBits=$(if ($null -ne $_.TransmitLinkSpeed) { [double]$_.TransmitLinkSpeed } else { $null }) } })
} catch { $notes.Add('Network adapter inventory is unavailable from this Windows provider.') }
$bootTime = $null
if ($osInfo.Count -gt 0 -and $osInfo[0].LastBootUpTime) { $bootTime = $osInfo[0].LastBootUpTime.ToUniversalTime().ToString('o') }
$deviceType = 'Unknown'
if ($computer.Count -gt 0) { if ($computer[0].PCSystemType -eq 2) { $deviceType='Portable' } elseif ($computer[0].PCSystemType -in @(1,3,4,5,6,7,8)) { $deviceType='Desktop' } }
[pscustomobject]@{
 cpu = ($cpu | ForEach-Object Name) -join ' + '
 physicalCores = ($cpu | Measure-Object NumberOfCores -Sum).Sum
 gpu = ($gpu | ForEach-Object Name) -join ' + '
 gpuDriver = ($gpu | ForEach-Object DriverVersion) -join ' + '
 ramSpeedMHz = ($ram | ForEach-Object { if ($_.ConfiguredClockSpeed -gt 0) { $_.ConfiguredClockSpeed } else { $_.Speed } } | Measure-Object -Minimum).Minimum
 os = ($osInfo | ForEach-Object { "$($_.Caption) (build $($_.BuildNumber))" }) -join ', '
 motherboard = ($board | ForEach-Object { "$($_.Manufacturer) $($_.Product)" }) -join ', '
 powerPlan = ($power | ForEach-Object ElementName) -join ', '
 volumes = @($disks | ForEach-Object { [pscustomobject]@{ name = $_.DeviceID; totalBytes = [double]$_.Size; freeBytes = [double]$_.FreeSpace } })
 monitors = @($gpu | Where-Object { $_.CurrentHorizontalResolution -gt 0 -and $_.CurrentVerticalResolution -gt 0 } | ForEach-Object { [pscustomobject]@{ name = $_.Name; width = $_.CurrentHorizontalResolution; height = $_.CurrentVerticalResolution; refreshHz = $(if ($_.CurrentRefreshRate -gt 1) { $_.CurrentRefreshRate } else { $null }) } })
 installedRamBytes = ($ram | Measure-Object Capacity -Sum).Sum
 deviceType = $deviceType
 bootTime = $bootTime
 physicalDisks = @($physical)
 networkAdapters = @($adapters)
 notes = @($notes)
} | ConvertTo-Json -Depth 5 -Compress`,
  metrics: String.raw`
$gpuPercent = $null
try {
 $engines = @(Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop | Where-Object { $_.Name -match 'engtype_3D' })
 if ($engines.Count -gt 0) { $gpuPercent = ($engines | Measure-Object UtilizationPercentage -Maximum).Maximum }
} catch { }
[pscustomobject]@{ gpuPercent = $gpuPercent; processCount = @(Get-Process).Count } | ConvertTo-Json -Compress`,
  processes: String.raw`
@(Get-Process | ForEach-Object {
 [pscustomobject]@{ pid = $_.Id; name = $_.ProcessName; memoryBytes = [double]$_.WorkingSet64; cpuSeconds = $_.CPU }
}) | ConvertTo-Json -Depth 3 -Compress`,
  startup: String.raw`
$entries = New-Object System.Collections.Generic.List[object]
$roots = @(
 @{ Path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; Approved = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'; Label = 'Current user - Registry' },
 @{ Path = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run'; Approved = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'; Label = 'All users - Registry' },
 @{ Path = 'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; Approved = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run32'; Label = 'All users - 32-bit Registry' }
)
foreach ($root in $roots) {
 if (Test-Path -LiteralPath $root.Path) {
  try {
   foreach ($name in (Get-Item -LiteralPath $root.Path -ErrorAction Stop).Property) {
    $status = 'Configured to run'
    try { $approval = Get-ItemPropertyValue -LiteralPath $root.Approved -Name $name -ErrorAction Stop; if ($approval[0] -in @(3,7)) { $status = 'Disabled' } elseif ($approval[0] -in @(2,6)) { $status = 'Enabled' } } catch { }
    $entries.Add([pscustomobject]@{ name = $name; location = $root.Label; status = $status })
   }
  } catch { }
 }
}
foreach ($folder in @(
 @{ Path = [Environment]::GetFolderPath('Startup'); Label = 'Current user - Startup folder'; Approved = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder' },
 @{ Path = [Environment]::GetFolderPath('CommonStartup'); Label = 'All users - Startup folder'; Approved = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder' }
)) {
 if ($folder.Path -and (Test-Path -LiteralPath $folder.Path)) {
  Get-ChildItem -LiteralPath $folder.Path -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object {
   $status = 'Configured to run'
   try { $approval = Get-ItemPropertyValue -LiteralPath $folder.Approved -Name $_.Name -ErrorAction Stop; if ($approval[0] -in @(3,7)) { $status = 'Disabled' } elseif ($approval[0] -in @(2,6)) { $status = 'Enabled' } } catch { }
   $entries.Add([pscustomobject]@{ name = $_.BaseName; location = $folder.Label; status = $status })
  }
 }
}
@($entries.ToArray()) | ConvertTo-Json -Depth 3 -Compress`,
} as const;

export type WindowsQuery = keyof typeof WINDOWS_QUERIES;
type FileStat = { isFile(): boolean; isDirectory(): boolean; size: number };
export interface SystemDependencies {
  platform: NodeJS.Platform;
  now(): number;
  cpus(): os.CpuInfo[];
  totalmem(): number;
  freemem(): number;
  release(): string;
  env: NodeJS.ProcessEnv;
  readFile(file: string): Promise<string>;
  readdir(directory: string): Promise<string[]>;
  stat(file: string): Promise<FileStat>;
  runWindows(query: WindowsQuery): Promise<unknown>;
}

const safeText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 300) : null;
const positive = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
const nonnegative = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []).filter(v => v && typeof v === 'object');

export class WindowsProviderError extends Error {
  constructor(query: WindowsQuery, failure: 'timeout' | 'exit' | 'response') {
    super(`Windows ${query} provider ${failure === 'timeout' ? 'timed out' : failure === 'response' ? 'returned an unreadable response' : 'could not complete'}.`);
    this.name = 'WindowsProviderError';
  }
}

function runWindows(query: WindowsQuery): Promise<unknown> {
  const root = process.env.SystemRoot || 'C:\\Windows';
  const executable = path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); " + WINDOWS_QUERIES[query];
  return new Promise((resolve, reject) => {
    execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, timeout: query === 'system' ? 45_000 : 10_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
    }, (error, stdout) => {
      if (error) return reject(new WindowsProviderError(query, error.killed ? 'timeout' : 'exit'));
      try { resolve(stdout.trim() ? JSON.parse(stdout.replace(/^\uFEFF/, '').trim()) : []); }
      catch { reject(new WindowsProviderError(query, 'response')); }
    });
  });
}

const defaults: SystemDependencies = {
  platform: process.platform, now: Date.now, cpus: os.cpus, totalmem: os.totalmem, freemem: os.freemem,
  release: os.release, env: process.env, readFile: file => fs.readFile(file, 'utf8'),
  readdir: directory => fs.readdir(directory), stat: file => fs.stat(file), runWindows,
};

function cpuTicks(cpus: os.CpuInfo[]) { return cpus.reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle, total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 }); }

export function createSystemService(overrides: Partial<SystemDependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  let ticks = cpuTicks(deps.cpus());
  let inventory: { at: number; value: SystemInfo } | null = null;
  let inventoryPending: Promise<SystemInfo> | null = null;
  let metricsExtra: { at: number; gpuPercent: number | null; processCount: number | null } | null = null;
  let metricsPending: Promise<void> | null = null;

  async function loadSystem(): Promise<SystemInfo> {
    const cpus = deps.cpus();
    const info: SystemInfo = {
      platform: deps.platform, timestamp: new Date(deps.now()).toISOString(), cpu: cpus[0]?.model || 'Unavailable',
      logicalCores: cpus.length, physicalCores: null, gpu: null, gpuDriver: null, ramBytes: deps.totalmem(),
      ramSpeedMHz: null, os: `${deps.platform} ${deps.release()}`, motherboard: null, powerPlan: null,
      volumes: [], monitors: [], notes: [], installedRamBytes: null, deviceType: 'Unknown', bootTime: null, physicalDisks: [], networkAdapters: [],
    };
    if (deps.platform !== 'win32') {
      info.notes.push('Development host: Windows hardware providers, optimizations and startup inventory are unavailable on this platform.');
    } else {
      try {
        const raw = await deps.runWindows('system');
        const data = records(raw)[0] || {};
        info.cpu = safeText(data.cpu) || info.cpu;
        info.physicalCores = positive(data.physicalCores);
        info.gpu = safeText(data.gpu); info.gpuDriver = safeText(data.gpuDriver);
        info.ramSpeedMHz = positive(data.ramSpeedMHz);
        info.os = safeText(data.os) || info.os; info.motherboard = safeText(data.motherboard);
        info.powerPlan = safeText(data.powerPlan);
        info.installedRamBytes = positive(data.installedRamBytes);
        info.deviceType = data.deviceType === 'Desktop' || data.deviceType === 'Portable' ? data.deviceType : 'Unknown';
        const boot = typeof data.bootTime === 'string' ? Date.parse(data.bootTime) : NaN;
        info.bootTime = Number.isFinite(boot) && boot > 0 && boot <= deps.now() ? new Date(boot).toISOString() : null;
        info.physicalDisks = records(data.physicalDisks).flatMap(disk => {
          const model = safeText(disk.model);
          return model ? [{ model, bytes: positive(disk.bytes), media: safeText(disk.media) || 'Unknown', bus: safeText(disk.bus) || 'Unknown', health: safeText(disk.health) }] : [];
        });
        info.networkAdapters = records(data.networkAdapters).flatMap(adapter => {
          const description = safeText(adapter.description);
          return description ? [{ description, status: safeText(adapter.status) || 'Unknown', linkSpeedBits: nonnegative(adapter.linkSpeedBits) }] : [];
        });
        info.volumes = records(data.volumes).flatMap(volume => {
          const totalBytes = positive(volume.totalBytes), freeBytes = nonnegative(volume.freeBytes), name = safeText(volume.name);
          return name && totalBytes !== null && freeBytes !== null && freeBytes <= totalBytes ? [{ name, totalBytes, freeBytes }] : [];
        });
        info.monitors = records(data.monitors).flatMap(monitor => {
          const width = positive(monitor.width), height = positive(monitor.height), name = safeText(monitor.name);
          return name && width && height ? [{ name, width, height, refreshHz: positive(monitor.refreshHz) }] : [];
        });
        if (Array.isArray(data.notes)) info.notes.push(...data.notes.map(safeText).filter((n): n is string => n !== null));
      } catch (error) {
        if (error instanceof WindowsProviderError) info.notes.push(error.message);
        info.notes.push('Windows hardware query failed. CPU and memory come from the operating system; unavailable fields are left blank.');
      }
      if (!info.monitors.length) info.notes.push('Display mode is not exposed by this Windows provider.');
      else info.notes.push('Display modes are reported per active video controller; external monitors may not be enumerated separately.');
      info.notes.push('GPU usage, when available, is the busiest Windows 3D engine. Temperatures require a separate supported sensor provider and are unavailable.');
    }
    inventory = { at: deps.now(), value: info };
    return info;
  }

  async function getSystem(forceRefresh = false): Promise<SystemInfo> {
    if (typeof forceRefresh !== 'boolean') throw new Error('Invalid hardware refresh request.');
    if (inventoryPending) return inventoryPending;
    if (!forceRefresh && inventory && deps.now() - inventory.at < 30_000) return inventory.value;
    if (!inventoryPending) inventoryPending = loadSystem().finally(() => { inventoryPending = null; });
    return inventoryPending;
  }

  async function refreshMetricsExtra(): Promise<void> {
    let gpuPercent: number | null = null, processCount: number | null = null;
    try {
      if (deps.platform === 'win32') {
        const data = records(await deps.runWindows('metrics'))[0] || {};
        const reported = nonnegative(data.gpuPercent);
        gpuPercent = reported === null ? null : Math.min(100, reported);
        processCount = nonnegative(data.processCount);
      } else if (deps.platform === 'linux') processCount = (await deps.readdir('/proc')).filter(name => /^\d+$/.test(name)).length;
    } catch { /* Missing provider is represented by null, never fabricated telemetry. */ }
    metricsExtra = { at: deps.now(), gpuPercent, processCount };
  }

  async function getMetrics(): Promise<Metrics> {
    const current = cpuTicks(deps.cpus()), elapsed = current.total - ticks.total, idle = current.idle - ticks.idle;
    ticks = current;
    const cpuPercent = elapsed > 0 && idle >= 0 ? Math.round(Math.max(0, Math.min(100, (1 - idle / elapsed) * 100)) * 10) / 10 : null;
    if (!metricsExtra || deps.now() - metricsExtra.at >= 5_000) {
      if (!metricsPending) metricsPending = refreshMetricsExtra().finally(() => { metricsPending = null; });
      await metricsPending;
    }
    const ramTotalBytes = deps.totalmem();
    return { timestamp: new Date(deps.now()).toISOString(), cpuPercent, ramTotalBytes,
      ramUsedBytes: Math.max(0, Math.min(ramTotalBytes, ramTotalBytes - deps.freemem())),
      gpuPercent: metricsExtra?.gpuPercent ?? null, processCount: metricsExtra?.processCount ?? null };
  }

  async function getProcesses(): Promise<ProcessInfo[]> {
    let processes: ProcessInfo[] = [];
    if (deps.platform === 'win32') {
      try {
        processes = records(await deps.runWindows('processes')).flatMap(item => {
          const pid = positive(item.pid), name = safeText(item.name), memoryBytes = nonnegative(item.memoryBytes);
          return pid && Number.isSafeInteger(pid) && name && memoryBytes !== null ? [{ pid, name, memoryBytes, cpuSeconds: nonnegative(item.cpuSeconds) }] : [];
        });
      } catch { throw new Error('Windows process inventory is unavailable. Try again after closing other system monitoring tools.'); }
    } else if (deps.platform === 'linux') {
      let pids: string[];
      try { pids = (await deps.readdir('/proc')).filter(name => /^\d+$/.test(name)).slice(0, 10_000); }
      catch { return []; }
      // Batch reads avoid opening thousands of files at once on a busy development host.
      for (let index = 0; index < pids.length; index += 32) {
        const batch = await Promise.all(pids.slice(index, index + 32).map(async (pid): Promise<ProcessInfo | null> => {
          try {
            const status = await deps.readFile(`/proc/${pid}/status`);
            return { pid: Number(pid), name: safeText(status.match(/^Name:\s*(.+)$/m)?.[1]) || 'Unknown process',
              memoryBytes: Number(status.match(/^VmRSS:\s*(\d+)\s+kB/m)?.[1] || 0) * 1024, cpuSeconds: null };
          } catch { return null; }
        }));
        processes.push(...batch.filter((item): item is ProcessInfo => item !== null));
      }
    }
    return processes.sort((a, b) => b.memoryBytes - a.memoryBytes).slice(0, 10_000);
  }

  async function getStartup(): Promise<StartupEntry[]> {
    if (deps.platform !== 'win32') return [];
    try {
      return records(await deps.runWindows('startup')).flatMap(item => {
        const name = safeText(item.name), location = safeText(item.location), status = safeText(item.status);
        return name && location && status ? [{ name, location, status }] : [];
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch { throw new Error('Windows startup inventory is unavailable. No startup settings were changed.'); }
  }

  async function getGames(): Promise<GameInfo[]> {
    if (deps.platform !== 'win32') return [];
    const games = new Map<string, GameInfo>();
    const fileText = async (file: string) => {
      const metadata = await deps.stat(file);
      if (!metadata.isFile() || metadata.size > 1024 * 1024) throw new Error('Unsupported manifest');
      return deps.readFile(file);
    };
    const directory = async (file: string) => { try { return (await deps.stat(file)).isDirectory(); } catch { return false; } };
    const inside = (parent: string, child: string) => { const relative = path.win32.relative(parent, child); return !!relative && relative !== '..' && !relative.startsWith('..\\') && !path.win32.isAbsolute(relative); };
    const drivePath = (value: string) => /^[a-z]:[\\/]/i.test(value) && !value.includes('\0');
    const programData = deps.env.ProgramData || 'C:\\ProgramData';
    const epicManifests = path.win32.join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
    try {
      const manifests = (await deps.readdir(epicManifests)).filter(name => /^[^\\/]+\.item$/i.test(name)).slice(0, 512);
      for (const manifest of manifests) {
        try {
          const data = JSON.parse(await fileText(path.win32.join(epicManifests, manifest))) as Record<string, unknown>;
          const name = safeText(data.DisplayName), id = safeText(data.AppName), install = safeText(data.InstallLocation), executable = safeText(data.LaunchExecutable);
          if (!name || !id || !install || !drivePath(install) || !executable || path.win32.isAbsolute(executable) || !/\.exe$/i.test(executable)) continue;
          const target = path.win32.resolve(install, executable);
          if (!inside(install, target) || !(await deps.stat(target)).isFile()) continue;
          const gameId = id.toLowerCase() === 'fortnite' ? 'fortnite' : `epic:${id}`;
          games.set(gameId, { id: gameId, name, installed: true, path: target });
        } catch { /* A partial launcher download is not an installed game. */ }
      }
    } catch { /* Epic is optional. */ }

    const programFiles = deps.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const steamRoot = path.win32.join(programFiles, 'Steam');
    const libraries = new Set([steamRoot]);
    try {
      const folders = await fileText(path.win32.join(steamRoot, 'steamapps', 'libraryfolders.vdf'));
      for (const match of folders.matchAll(/"path"\s+"((?:\\.|[^"\\])*)"/g)) {
        const folder = match[1].replace(/\\\\/g, '\\');
        if (drivePath(folder)) libraries.add(folder);
      }
    } catch { /* Steam is optional. */ }
    for (const library of [...libraries].slice(0, 32)) {
      const steamapps = path.win32.join(library, 'steamapps');
      try {
        const manifests = (await deps.readdir(steamapps)).filter(name => /^appmanifest_\d+\.acf$/.test(name)).slice(0, 1024);
        for (const manifest of manifests) {
          try {
            const content = await fileText(path.win32.join(steamapps, manifest));
            const value = (key: string) => content.match(new RegExp(`"${key}"\\s+"([^"\\r\\n]*)"`))?.[1];
            const id = value('appid'), name = safeText(value('name')), folder = value('installdir'), state = Number(value('StateFlags'));
            if (!id || !/^\d+$/.test(id) || !name || !folder || !Number.isSafeInteger(state) || (state & 4) === 0) continue;
            const common = path.win32.join(steamapps, 'common'), install = path.win32.resolve(common, folder);
            if (!inside(common, install) || !(await directory(install))) continue;
            games.set(`steam:${id}`, { id: `steam:${id}`, name, installed: true, path: install });
          } catch { /* Do not treat missing or corrupt manifests as installed games. */ }
        }
      } catch { /* Unmounted game libraries are ignored. */ }
    }
    if (!games.has('fortnite')) {
      const root = deps.env.ProgramFiles || 'C:\\Program Files';
      const executable = path.win32.join(root, 'Epic Games', 'Fortnite', 'FortniteGame', 'Binaries', 'Win64', 'FortniteClient-Win64-Shipping.exe');
      try { if ((await deps.stat(executable)).isFile()) games.set('fortnite', { id: 'fortnite', name: 'Fortnite', installed: true, path: executable }); } catch { }
    }
    return [...games.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { getSystem, getMetrics, getProcesses, getStartup, getGames };
}

export const { getSystem, getMetrics, getProcesses, getStartup, getGames } = createSystemService();
