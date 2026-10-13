import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createStartupService, createWindowsStartupAdapter, STARTUP_APPS } from '../electron/startup';
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_STARTUP === '1' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
describe.skipIf(!allowed)('startup entry roundtrip on explicitly disposable hosted Windows only', () => {
  it('preserves expansion type and quotes through disable/relaunch/restore without executing the command', async () => {
    const powershell = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const run = (script: string) => promisify(execFile)(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15_000, windowsHide: true });
    // The disposable runner may have no Run key. Prepare only the fixture;
    // production deliberately refuses to recreate a missing startup key.
    const key = 'Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    const { stdout } = await run(`$ErrorActionPreference='Stop'; $h=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64'); try{$k=$h.OpenSubKey('${key}'); $existed=$null -ne $k; if($k){$k.Dispose()}; if(-not $existed){$k=$h.CreateSubKey('${key}'); $k.Dispose()}; $existed.ToString()}finally{$h.Dispose()}`);
    const keyExisted = stdout.trim() === 'True';
    const adapter = createWindowsStartupAdapter(), target = STARTUP_APPS[0], original = await adapter.read(target);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-startup-'));
    const fixture = { kind: 'ExpandString' as const, text: '"%LOCALAPPDATA%\\PANDORA disposable O\'Brien\\does-not-exist.exe" --test-only' };
    try {
      await adapter.write(target, fixture); expect(await adapter.read(target)).toEqual(fixture);
      const s = createStartupService(dir, adapter);
      const entry = (await s.getControls()).find(i => i.id === target.id)!;
      expect((await s.change(entry.token!, false)).success).toBe(true);
      expect(await adapter.read(target)).toEqual({ kind: 'absent' });
      const reopened = createStartupService(dir, adapter);
      const restore = (await reopened.getControls()).find(i => i.id === target.id)!;
      expect((await reopened.change(restore.token!, true)).success).toBe(true);
      expect(await adapter.read(target)).toEqual(fixture);
    } finally {
      await adapter.write(target, original); expect(await adapter.read(target)).toEqual(original);
      if (!keyExisted) await run(`$ErrorActionPreference='Stop'; $h=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64'); try{$k=$h.OpenSubKey('${key}'); $empty=$null -ne $k -and $k.ValueCount -eq 0 -and $k.SubKeyCount -eq 0; if($k){$k.Dispose()}; if($empty){$h.DeleteSubKey('${key}',$false)}}finally{$h.Dispose()}`);
      await fs.rm(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
