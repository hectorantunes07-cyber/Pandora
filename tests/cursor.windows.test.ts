import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCursorService } from '../electron/cursor';
import { createWindowsCursorAdapter } from '../electron/cursor-native';
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_CURSOR === '1' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
describe.skipIf(!allowed)('normal pointer on explicitly disposable hosted Windows only', () => {
  it('loads the actual supplied cursor, persists Arrow, reloads and restores exact original after relaunch', async () => {
    const adapter = createWindowsCursorAdapter(), original = await adapter.read(), dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-cursor-'));
    try {
      const s = createCursorService(dir, path.resolve('public/cursors/sonnier.cur'), adapter);
      const before = await s.getInfo(); expect(before.current).toEqual(original);
      expect((await s.change(before.token, false)).success).toBe(true);
      expect((await adapter.read()).value).toContain(path.join(dir, 'cursors'));
      const reopened = createCursorService(dir, path.resolve('public/cursors/sonnier.cur'), adapter);
      expect((await reopened.change((await reopened.getInfo()).token, true)).success).toBe(true);
      expect(await adapter.read()).toEqual(original);
    } finally { const current = await adapter.read(); if (JSON.stringify(current) !== JSON.stringify(original)) await adapter.write(current, original, true); expect(await adapter.read()).toEqual(original); await fs.rm(dir, { recursive: true, force: true }); }
  }, 180_000);
});
