import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OPTIONAL_APPS, type OptionalAppsInfo, type OptionalAppState, type OptionalAppPackage } from '../shared/optional-apps';

// Current-user registration only. No all-users/provisioned enumeration, manifests,
// installation paths, package removal, dependency traversal or administrator prompt.
export const OPTIONAL_APPS_QUERY = String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$catalog=@(${OPTIONAL_APPS.map(a => `@{id='${a.id}';name='${a.packageName}'}`).join(',')})
$result=foreach($entry in $catalog) {
 try {
  $packages=@(Get-AppxPackage -Name $entry.name -PackageTypeFilter Main -ErrorAction Stop | Select-Object -First 5)
  if($packages.Count -gt 4) { throw 'Too many registrations.' }
  $rows=@(foreach($p in $packages) {
   @{ name=[string]$p.Name;family=[string]$p.PackageFamilyName;version=[string]$p.Version;architecture=[string]$p.Architecture;
      framework=$p.IsFramework;resource=$p.IsResourcePackage;protected=$p.NonRemovable;signature=[string]$p.SignatureKind;status=[string]$p.Status }
  })
  @{id=$entry.id;readable=$true;packages=$rows}
 } catch { @{id=$entry.id;readable=$false;packages=@()} }
}
@{entries=@($result)} | ConvertTo-Json -Depth 5 -Compress
`;
const UNKNOWN = 'Windows could not confirm this app’s current-user registration. Refresh or check Installed apps.';
const unavailable = (id: OptionalAppState['id'], reason = UNKNOWN): OptionalAppState => ({ id, state: 'unavailable', packages: [], reason });
export function parseOptionalApps(raw: unknown, now = Date.now()): OptionalAppsInfo {
  const entries = (raw as { entries?: unknown })?.entries;
  if (!Array.isArray(entries) || entries.length !== OPTIONAL_APPS.length || new Set(entries.map(e => e?.id)).size !== OPTIONAL_APPS.length || entries.some(e => !OPTIONAL_APPS.some(a => a.id === e?.id))) throw new Error('Windows returned an incomplete optional-app inventory.');
  const states: OptionalAppState[] = OPTIONAL_APPS.map(app => {
    const entry = entries.find(e => e.id === app.id);
    if (entry.readable !== true) return unavailable(app.id);
    if (!Array.isArray(entry.packages) || entry.packages.length > 4) return unavailable(app.id);
    const packages: OptionalAppPackage[] = [];
    for (const p of entry.packages) {
      if (!p || p.name !== app.packageName || p.family !== `${app.packageName}_${app.publisherId}` ||
          !/^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){3}$/.test(p.version) || p.version.split('.').some((v: string) => Number(v) > 65535) ||
          !['X86', 'X64', 'Arm', 'Arm64', 'Neutral', 'X86OnArm64'].includes(p.architecture) ||
          p.framework !== false || p.resource !== false || typeof p.protected !== 'boolean' ||
          !['Store', 'System'].includes(p.signature) || typeof p.status !== 'string' || !/^[A-Za-z][A-Za-z, ]{0,119}$/.test(p.status)) return unavailable(app.id);
      packages.push({ version: p.version, architecture: p.architecture, protected: p.protected, status: p.status });
    }
    if (new Set(packages.map(p => `${p.version}:${p.architecture}`)).size !== packages.length) return unavailable(app.id);
    return { id: app.id, state: packages.length ? 'installed' : 'not-installed', packages, reason: null };
  });
  return { supported: true, timestamp: new Date(now).toISOString(), entries: states, complete: states.every(e => e.state !== 'unavailable') };
}
export async function queryOptionalApps(): Promise<unknown> {
  if (process.platform !== 'win32') throw new Error('Windows is required.');
  const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  // Reset the module search path in this child only: a pwsh caller may otherwise
  // expose PS7-only modules to Windows PowerShell's Appx provider.
  const modules = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/Modules');
  const { stdout } = await promisify(execFile)(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', OPTIONAL_APPS_QUERY], {
    windowsHide: true, timeout: 30_000, maxBuffer: 64 * 1024, env: { ...process.env, PSModulePath: modules },
  });
  return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
}
export function createOptionalAppsService(run = queryOptionalApps, supported = process.platform === 'win32') {
  let pending: Promise<OptionalAppsInfo> | null = null;
  function get(): Promise<OptionalAppsInfo> {
    if (pending) return pending;
    pending = (async () => {
      if (supported) { try { return parseOptionalApps(await run()); } catch { /* Return explicit unknowns, never invented absence or raw errors/paths. */ } }
      return { supported, timestamp: new Date().toISOString(), entries: OPTIONAL_APPS.map(a => unavailable(a.id, supported ? UNKNOWN : 'Optional-app inventory requires Windows.')), complete: false };
    })().finally(() => { pending = null; });
    return pending;
  }
  return { get };
}
