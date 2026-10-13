import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VISUAL_EFFECTS } from '../shared/visual-effects';
import { createVisualEffectsService, createWindowsVisualEffectsAdapter } from '../electron/visual-effects';
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_VISUAL === '1' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
describe.skipIf(!allowed)('visual APIs on explicitly disposable hosted Windows only', () => {
  it('applies and restores all seven exact effective BOOL settings after relaunch', async () => {
    const adapter = createWindowsVisualEffectsAdapter();
    for (const { id } of VISUAL_EFFECTS) {
      const original = (await adapter.read())[id]; expect(typeof original).toBe('boolean');
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-effects-'));
      try {
        await adapter.write(id, true); expect((await adapter.read())[id]).toBe(true);
        const service = createVisualEffectsService(dir, adapter);
        expect((await service.change((await service.getStates()).find(e => e.id === id)!.token, false)).success).toBe(true);
        expect((await adapter.read())[id]).toBe(false);
        const reopened = createVisualEffectsService(dir, adapter);
        expect((await reopened.change((await reopened.getStates()).find(e => e.id === id)!.token, true)).success).toBe(true);
        expect((await adapter.read())[id]).toBe(true);
      } finally {
        await adapter.write(id, original!); expect((await adapter.read())[id]).toBe(original);
        await fs.rm(dir, { recursive: true, force: true });
      }
    }
  }, 300_000);
});
