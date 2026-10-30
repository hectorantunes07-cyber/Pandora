import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { MAX_FORTNITE_CONFIG } from './fortnite-config';

export interface FortniteSnapshot { bytes: Buffer; identity: string; }
export interface FortniteAdapter {
  supported: boolean; locationId: string;
  read(): Promise<FortniteSnapshot>; running(): Promise<boolean>;
  replace(expected: FortniteSnapshot, bytes: Buffer): Promise<void>;
}
export const FORTNITE_PROCESS_QUERY = "$ErrorActionPreference='Stop'; $processes=@(Get-Process -ErrorAction Stop); ConvertTo-Json -Compress -InputObject ([bool](@($processes | Where-Object { $_.ProcessName -like 'Fortnite*' }).Count -gt 0))";
export function buildFortniteReplaceScript(temporary: string, target: string, expectedHash: string, desiredHash: string): string {
  const local = (v: string) => /^[a-z]:\\/i.test(v) && !v.includes('\0') && v.length < 4096;
  if (!local(temporary) || !local(target) || !/^\.pandora-[a-f0-9-]{36}\.tmp$/i.test(path.win32.basename(temporary)) ||
      path.win32.basename(target) !== 'GameUserSettings.ini' || path.win32.dirname(temporary).toLowerCase() !== path.win32.dirname(target).toLowerCase() ||
      !/^[a-f0-9]{64}$/.test(expectedHash) || !/^[a-f0-9]{64}$/.test(desiredHash)) throw new Error('Invalid Fortnite replacement paths or hashes.');
  const quote = (v: string) => `'${v.replaceAll("'", "''")}'`;
  // File.Replace uses Windows ReplaceFile: retain the destination ACL/metadata.
  // Do not ignore metadata errors or fall back to an ACL-losing rename.
  return `$ErrorActionPreference='Stop'; $temporary=${quote(temporary)}; $target=${quote(target)};
foreach($file in @($temporary,$target)) {
  $cursor=$file;
  while($cursor) { if(([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Redirected path refused.' }; $cursor=[IO.Path]::GetDirectoryName($cursor) }
  $size=(Get-Item -LiteralPath $file -Force -ErrorAction Stop).Length;
  if($size -le 0 -or $size -gt ${MAX_FORTNITE_CONFIG}) { throw 'Invalid configuration size.' }
}
if(@(Get-Process -ErrorAction Stop | Where-Object { $_.ProcessName -like 'Fortnite*' }).Count -gt 0) { throw 'Close Fortnite before changing its configuration.' }
$hash=[Security.Cryptography.SHA256]::Create();
try {
  $observed=([BitConverter]::ToString($hash.ComputeHash([IO.File]::ReadAllBytes($target)))).Replace('-','').ToLowerInvariant();
  $replacement=([BitConverter]::ToString($hash.ComputeHash([IO.File]::ReadAllBytes($temporary)))).Replace('-','').ToLowerInvariant();
  if($observed -ne '${expectedHash}' -or $replacement -ne '${desiredHash}') { throw 'Configuration changed before replacement.' }
} finally { $hash.Dispose() }
[System.IO.File]::Replace($temporary,$target,$null,$false)`;
}
async function replacePreservingPermissions(temporary: string, target: string, expected: Buffer, desired: Buffer) {
  if (process.platform !== 'win32') { await fs.rename(temporary, target); return; }
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const script = buildFortniteReplaceScript(temporary, target, hash(expected), hash(desired));
  const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  await promisify(execFile)(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15_000, maxBuffer: 4096 });
}
export async function isFortniteRunning(): Promise<boolean> {
  if (process.platform !== 'win32') throw new Error('Fortnite process checks require Windows.');
  try {
    const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const { stdout } = await promisify(execFile)(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', FORTNITE_PROCESS_QUERY], { windowsHide: true, timeout: 10_000, maxBuffer: 4096 });
    const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
    if (typeof result !== 'boolean') throw new Error('Invalid process response');
    return result;
  } catch { throw new Error('Fortnite process status could not be checked. No configuration change is allowed.'); }
}
export function sameFortniteSnapshot(a: FortniteSnapshot, b: FortniteSnapshot) { return a.identity === b.identity && a.bytes.equals(b.bytes); }

/** localData is supplied by the main process, never IPC. Tests use isolated temporary directories. */
export function createFortniteFileAdapter(localData: string, running = isFortniteRunning, supported = process.platform === 'win32'): FortniteAdapter {
  const validRoot = Boolean(localData && path.isAbsolute(localData) && !localData.includes('\0') && !localData.startsWith('\\\\'));
  const file = path.join(localData, 'FortniteGame', 'Saved', 'Config', 'WindowsClient', 'GameUserSettings.ini');
  const canonical = (p: string) => process.platform === 'win32' ? p.toLowerCase() : p;
  const locationId = createHash('sha256').update(canonical(path.resolve(file))).digest('hex');
  async function guard() {
    if (!supported || !validRoot) throw new Error('A local Windows Fortnite configuration is required.');
    // Windows may supply a legitimate 8.3 alias (e.g. RUNNER~1) for LocalAppData
    // or TEMP. Resolve that trusted base, then require the exact fixed suffix.
    // Every lexical ancestor is still checked below, including the base itself.
    const resolvedBase = await fs.realpath(localData);
    const expected = path.join(resolvedBase, 'FortniteGame', 'Saved', 'Config', 'WindowsClient', 'GameUserSettings.ini');
    if (canonical(await fs.realpath(file)) !== canonical(expected)) throw new Error('Redirected Fortnite configuration paths are not supported.');
    let current = path.resolve(file);
    while (true) {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Redirected Fortnite configuration paths are not supported.');
      if (current === path.resolve(file)) {
        if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_FORTNITE_CONFIG || !stat.size) throw new Error('The Fortnite configuration must be a bounded, unlinked regular file.');
        if (!(stat.mode & 0o200)) throw new Error('The Fortnite configuration is read-only. PANDORA will not change its protection.');
      } else if (!stat.isDirectory()) throw new Error('Invalid Fortnite configuration directory.');
      const parent = path.dirname(current); if (parent === current) break; current = parent;
    }
  }
  async function read(): Promise<FortniteSnapshot> {
    try {
      await guard();
      const before = await fs.lstat(file);
      const handle = await fs.open(file, 'r');
      try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino || opened.size > MAX_FORTNITE_CONFIG) throw new Error('Configuration changed while opening.');
        const buffer = Buffer.alloc(MAX_FORTNITE_CONFIG + 1);
        let size = 0;
        while (size < buffer.length) { const chunk = await handle.read(buffer, size, buffer.length - size, size); if (!chunk.bytesRead) break; size += chunk.bytesRead; }
        const after = await handle.stat();
        if (size > MAX_FORTNITE_CONFIG || size !== opened.size || opened.size !== after.size || opened.mtimeMs !== after.mtimeMs || opened.ctimeMs !== after.ctimeMs) throw new Error('Configuration changed while reading.');
        await guard();
        const last = await fs.lstat(file);
        if (last.dev !== opened.dev || last.ino !== opened.ino) throw new Error('Configuration replaced while reading.');
        return { bytes: buffer.subarray(0, size), identity: `${opened.dev}:${opened.ino}:${opened.mtimeMs}:${opened.ctimeMs}` };
      } finally { await handle.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Fortnite configuration not found. Start Fortnite once, save its video settings, then close it.');
      // Do not expose account paths from native filesystem errors.
      if ((error as NodeJS.ErrnoException).code) throw new Error('Fortnite configuration is inaccessible or locked. Close the game and any configuration editors.');
      throw error;
    }
  }
  return {
    supported: supported && validRoot, locationId, read, running,
    async replace(expected, bytes) {
      if (!bytes.length || bytes.length > MAX_FORTNITE_CONFIG) throw new Error('Invalid configuration size.');
      if (await running()) throw new Error('Close Fortnite before changing or restoring its configuration.');
      if (!sameFortniteSnapshot(await read(), expected)) throw new Error('Fortnite configuration changed. Nothing was overwritten.');
      const temporary = path.join(path.dirname(file), `.pandora-${randomUUID()}.tmp`);
      try {
        const handle = await fs.open(temporary, 'wx', 0o600);
        try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
        if (await running()) throw new Error('Fortnite started before the change. Nothing was overwritten.');
        if (!sameFortniteSnapshot(await read(), expected)) throw new Error('Fortnite configuration changed before replacement. Nothing was overwritten.');
        await replacePreservingPermissions(temporary, file, expected.bytes, bytes);
        if (process.platform !== 'win32') { const directory = await fs.open(path.dirname(file), 'r'); try { await directory.sync(); } finally { await directory.close(); } }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code) throw new Error('The Fortnite configuration could not be replaced. Its backup is retained; refresh before retrying.');
        throw error;
      } finally { await fs.unlink(temporary).catch(() => undefined); }
    },
  };
}
