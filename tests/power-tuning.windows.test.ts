import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createPowerTuningService } from '../electron/power-tuning';
import { createWindowsPowerTuningAdapter } from '../electron/power-tuning-native';
import { POWER_CONTROLS } from '../shared/power-tuning';
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_POWER_TUNING === '1' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted';
describe.skipIf(!allowed)('advanced power values on a disposable hosted Windows plan', () => {
  it('changes available AC policies, restores exact originals after relaunch and keeps DC bytes unchanged', async () => {
    const adapter = createWindowsPowerTuningAdapter(), original = await adapter.read();
    const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/powercfg.exe');
    const run = async (...args: string[]) => (await promisify(execFile)(exe, args, { windowsHide: true, timeout: 15_000 })).stdout;
    const created = await run('/duplicatescheme', original.activePlanId), clone = created.match(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/i)?.[0].toLowerCase();
    if (!clone) throw new Error('Disposable power plan could not be identified.');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-power-tuning-'));
    try {
      await run('/setactive', clone);
      const before = await run('/qh', clone); let exercised = 0;
      const errors: string[] = [], write = adapter.write;
      adapter.write = async (...args) => { try { await write(...args); } catch (e) { errors.push(String((e as { stderr?: string }).stderr || e)); throw e; } };
      for (const c of POWER_CONTROLS) {
        const s = createPowerTuningService(dir, adapter), state = (await s.getInfo()).states.find(v => v.id === c.id)!;
        if (state.current === null) continue;
        const option = c.options.find(o => o.value !== state.current && (c.id !== 'cpu-minimum' || o.value <= original.values['cpu-maximum']!) && (c.id !== 'cpu-maximum' || o.value >= original.values['cpu-minimum']!));
        if (!option) continue;
        const applied = await s.change((await s.preview(c.id, option.value, false)).token); expect(applied.success, errors.join('\n') || applied.message).toBe(true);
        const reopened = createPowerTuningService(dir, adapter), restored = await reopened.change((await reopened.preview(c.id, null, true)).token);
        expect(restored.success, errors.join('\n') || restored.message).toBe(true);
        expect((await adapter.read()).values[c.id]).toBe(state.current); exercised++;
      }
      expect(exercised).toBeGreaterThanOrEqual(3);
      // Exact full query equality also detects unintended DC changes after restoration.
      expect(await run('/qh', clone)).toBe(before);
      expect((await adapter.read()).activePlanId).toBe(clone);
    } finally { await run('/setactive', original.activePlanId); await run('/delete', clone); await fs.rm(dir, { recursive: true, force: true }); }
  }, 240_000);
});
