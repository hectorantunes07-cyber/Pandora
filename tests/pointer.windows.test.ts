import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPointerService, createWindowsPointerAdapter } from '../electron/pointer';
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_POINTER === '1' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
describe.skipIf(!allowed)('pointer API roundtrip on explicitly disposable hosted Windows only', () => {
  it('disables acceleration and restores exact effective API values after relaunch', async () => {
    const adapter = createWindowsPointerAdapter(), original = await adapter.read();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-pointer-'));
    try {
      await adapter.write([6, 10, 1]); expect(await adapter.read()).toEqual([6, 10, 1]);
      const s = createPointerService(dir, adapter);
      expect((await s.change((await s.getInfo()).token, false)).success).toBe(true);
      expect(await adapter.read()).toEqual([6, 10, 0]);
      const reopened = createPointerService(dir, adapter);
      expect((await reopened.change((await reopened.getInfo()).token, true)).success).toBe(true);
      expect(await adapter.read()).toEqual([6, 10, 1]);
    } finally { await adapter.write(original); expect(await adapter.read()).toEqual(original); await fs.rm(dir, { recursive: true, force: true }); }
  }, 120_000);
});
