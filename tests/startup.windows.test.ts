import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStartupService, createWindowsStartupAdapter, STARTUP_APPS } from '../electron/startup';
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_STARTUP === '1' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
describe.skipIf(!allowed)('startup entry roundtrip on explicitly disposable hosted Windows only', () => {
  it('preserves expansion type and quotes through disable/relaunch/restore without executing the command', async () => {
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
      await fs.rm(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
