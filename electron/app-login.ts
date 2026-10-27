import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppLifecycleState } from '../shared/app-lifecycle';
import type { OperationResult } from '../shared/types';
export const LOGIN_NAME = 'io.sonnier.pandora';
export interface LoginSnapshot { installed: boolean; entry: 'absent' | 'owned' | 'conflict'; }
export interface LoginAdapter { supported: boolean; read(): Promise<LoginSnapshot>; change(expected: 'absent' | 'owned', enable: boolean): Promise<LoginSnapshot>; approved(): boolean | null; }
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
export function buildLoginScript(executable: string, change?: { expected: 'absent' | 'owned'; enable: boolean }): string {
  if (!/^[a-z]:\\/i.test(executable) || !/\\PANDORA\.exe$/i.test(executable) || /["\x00-\x1f]/.test(executable) || executable.split(/[\\/]/).includes('..')) throw new Error('Invalid installed application path.');
  if (change && (!['absent', 'owned'].includes(change.expected) || typeof change.enable !== 'boolean')) throw new Error('Invalid login change.');
  const command = `"${executable}"`;
  return String.raw`
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$hive=$null;$install=$null;$run=$null
try {
 $hive=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64)
 $install=$hive.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall\io.sonnier.pandora',$false)
 $installed=$false
 if($null -ne $install) {
  $folder=[string]$install.GetValue('InstallLocation','',[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  if($folder -and [string]::Equals([IO.Path]::GetFullPath([IO.Path]::Combine($folder,'PANDORA.exe')),${literal(executable)},[StringComparison]::OrdinalIgnoreCase)) {
   $marker=[IO.Path]::Combine($folder,'pandora-install.id')
   if([IO.File]::Exists($marker)) { $f=[IO.FileInfo]::new($marker); if($f.Length -le 100 -and -not ($f.Attributes -band [IO.FileAttributes]::ReparsePoint)) { $installed=([IO.File]::ReadAllText($marker) -ceq 'io.sonnier.pandora') } }
  }
 }
 $run=$hive.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Run',$${change ? 'true' : 'false'})
 function Read-Entry {
  if($null -eq $run -or -not ($run.GetValueNames() -contains '${LOGIN_NAME}')) { return 'absent' }
  if($run.GetValueKind('${LOGIN_NAME}') -eq [Microsoft.Win32.RegistryValueKind]::String -and [string]$run.GetValue('${LOGIN_NAME}',$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq ${literal(command)}) { return 'owned' }
  return 'conflict'
 }
 $entry=Read-Entry
 ${change ? `if(-not $installed -or $entry -cne '${change.expected}') { throw 'Installation or startup registration changed. Nothing was overwritten.' }
 ${change.enable ? `if($null -eq $run) { $run=$hive.CreateSubKey('Software\\Microsoft\\Windows\\CurrentVersion\\Run',$true) }; $run.SetValue('${LOGIN_NAME}',${literal(command)},[Microsoft.Win32.RegistryValueKind]::String)` : `$run.DeleteValue('${LOGIN_NAME}',$false)`}
 $entry=Read-Entry
 if($entry -cne '${change.enable ? 'owned' : 'absent'}') { throw 'Startup registration could not be verified.' }` : ''}
 @{installed=$installed;entry=$entry} | ConvertTo-Json -Compress
} finally { if($null -ne $run){$run.Dispose()};if($null -ne $install){$install.Dispose()};if($null -ne $hive){$hive.Dispose()} }
`;
}
export function validateLoginSnapshot(raw: unknown): LoginSnapshot {
  const value = raw as LoginSnapshot;
  if (!value || typeof value.installed !== 'boolean' || !['absent', 'owned', 'conflict'].includes(value.entry)) throw new Error('Invalid startup registration response.');
  return { installed: value.installed, entry: value.entry };
}
export function createWindowsLoginAdapter(executable: string, packaged: boolean, approved: () => boolean | null): LoginAdapter {
  const supported = process.platform === 'win32' && packaged;
  async function run(change?: { expected: 'absent' | 'owned'; enable: boolean }) {
    if (!supported) throw new Error('The installed Windows app is required.');
    const script = buildLoginScript(executable, change);
    const { stdout } = await promisify(execFile)(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15_000, maxBuffer: 16_384 });
    return validateLoginSnapshot(JSON.parse(stdout.replace(/^\uFEFF/, '').trim()));
  }
  return { supported, read: () => run(), change: (expected, enable) => run({ expected, enable }), approved };
}
export function createLoginService(adapter: LoginAdapter, traySupported: boolean, now = Date.now) {
  let review: { token: string; entry: 'absent' | 'owned'; expires: number } | null = null, queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => { const work = queue.then(fn, fn); queue = work.catch(() => undefined); return work; };
  return {
    get: () => serial(async (): Promise<AppLifecycleState> => {
      review = null;
      let state: AppLifecycleState['login'] = { supported: false, state: 'unavailable', approved: null, token: null, reason: 'Sign-in launch requires PANDORA installed with Setup. Portable and development builds cannot register their temporary executable.' };
      if (adapter.supported) try {
        const snapshot = await adapter.read();
        if (snapshot.installed) {
          let approved: boolean | null = null; try { approved = snapshot.entry === 'owned' ? adapter.approved() : null; } catch { /* unknown approval is not permission to modify it */ }
          if (snapshot.entry !== 'conflict') review = { token: randomUUID(), entry: snapshot.entry, expires: now() + 300_000 };
          state = { supported: true, state: snapshot.entry, approved, token: review?.token ?? null, reason: snapshot.entry === 'conflict' ? 'A different startup entry is using PANDORA’s name. It was preserved; review it in Windows startup settings.' : snapshot.entry === 'owned' ? approved === false ? 'Registered, but disabled in Windows startup settings. Enable it there if you want PANDORA to launch.' : approved === true ? 'Registered for your account and enabled in Windows startup settings.' : 'Registered for your account. Windows startup approval could not be confirmed.' : 'Off. PANDORA opens only when you launch it.' };
        }
      } catch { state.reason = 'Startup registration could not be inspected. No changes are available until Windows responds.'; }
      return { traySupported, login: state };
    }),
    change: (token: unknown, enable: unknown) => serial(async (): Promise<OperationResult> => {
      const request = review; review = null;
      if (!adapter.supported || !request || request.token !== token || now() >= request.expires || typeof enable !== 'boolean' || enable !== (request.entry === 'absent')) throw new Error('Refresh and review the startup change again.');
      const current = await adapter.read();
      if (!current.installed || current.entry !== request.entry) throw new Error('The installation or startup entry changed after review. Nothing was overwritten.');
      try {
        const result = await adapter.change(request.entry, enable);
        if (!result.installed || result.entry !== (enable ? 'owned' : 'absent')) throw new Error('Read-back mismatch');
        return { id: 'pandora-login', success: true, message: enable ? 'PANDORA’s sign-in entry was saved and verified. Windows startup approval still applies; no optimizations run automatically.' : 'PANDORA’s sign-in entry was removed and verified.' };
      } catch { return { id: 'pandora-login', success: false, message: 'The startup change could not be confirmed. Refresh to inspect it before retrying. No other entry or Windows approval setting was changed.' }; }
    }),
  };
}
