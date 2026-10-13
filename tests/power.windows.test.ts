import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPowerService, createWindowsPowerAdapter } from '../electron/power';
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_POWER === '1' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
describe.skipIf(!allowed)('power-plan roundtrip on an explicitly disposable hosted Windows runner', () => {
  it('selects an installed alternative, verifies it, relaunches and restores the actual original', async () => {
    const adapter = createWindowsPowerAdapter(), initial = await adapter.read();
    const alternative = initial.plans.find(p => p.id !== initial.currentId);
    expect(alternative, 'The disposable runner must expose two existing plans for this integration check').toBeDefined();
    if (!alternative) throw new Error('No alternate installed plan; no change attempted.');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-power-'));
    try {
      expect((await createPowerService(dir, adapter).apply(alternative.id, initial.currentId)).success).toBe(true);
      expect((await adapter.read()).currentId).toBe(alternative.id);
      expect((await createPowerService(dir, adapter).restore(alternative.id)).success).toBe(true);
      expect((await adapter.read()).currentId).toBe(initial.currentId);
    } finally {
      await adapter.set(initial.currentId);
      expect((await adapter.read()).currentId).toBe(initial.currentId);
      await fs.rm(dir, { recursive: true, force: true });
    }
  }, 90_000);
});
