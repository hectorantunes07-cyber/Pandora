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
  it.each(['ac', 'dc'] as const)('changes available %s policies, restores originals after relaunch and preserves the other source', async source => {
    const native = createWindowsPowerTuningAdapter(source), original = await native.read();
    const other = createWindowsPowerTuningAdapter(source === 'dc' ? 'ac' : 'dc');
    // Hosted runners normally have no battery. Only this disposable-plan fixture
    // supplies a positive battery result and uses the restoration write path to
    // exercise DC APIs. Production apply gates remain covered below and in units.
    const adapter = source === 'ac' ? native : { ...native,
      read: async (id?: string) => ({ ...await native.read(id), batteryPresent: true }),
      write: async (plan: string, active: string, id: string, expected: number, desired: number) => native.write(plan, active, id, expected, desired, true),
    };
    const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/powercfg.exe');
    const run = async (...args: string[]) => (await promisify(execFile)(exe, args, { windowsHide: true, timeout: 15_000 })).stdout;
    const created = await run('/duplicatescheme', original.activePlanId), clone = created.match(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/i)?.[0].toLowerCase();
    if (!clone) throw new Error('Disposable power plan could not be identified.');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-power-tuning-'));
    try {
      await run('/setactive', clone);
      const before = await run('/qh', clone), otherBefore = (await other.read(clone)).values; let exercised = 0;
      if (source === 'dc' && original.batteryPresent !== true) {
        const originalEnergy = (await native.read(clone)).values['cpu-energy'];
        if (originalEnergy !== null) await expect(native.write(clone, clone, 'cpu-energy', originalEnergy, originalEnergy === 0 ? 50 : 0, false)).rejects.toThrow();
        expect(await run('/qh', clone)).toBe(before);
      }
      const errors: string[] = [], write = adapter.write;
      adapter.write = async (...args) => { try { await write(...args); } catch (e) { errors.push(String((e as { stderr?: string }).stderr || e)); throw e; } };
      for (const c of POWER_CONTROLS) {
        const s = createPowerTuningService(dir, adapter, source), state = (await s.getInfo()).states.find(v => v.id === c.id)!;
        if (state.current === null) continue;
        const option = c.options.find(o => o.value !== state.current && (c.id !== 'cpu-minimum' || o.value <= original.values['cpu-maximum']!) && (c.id !== 'cpu-maximum' || o.value >= original.values['cpu-minimum']!));
        if (!option) continue;
        const applied = await s.change((await s.preview(c.id, option.value, false)).token); expect(applied.success, errors.join('\n') || applied.message).toBe(true);
        expect((await other.read(clone)).values).toEqual(otherBefore);
        const reopened = createPowerTuningService(dir, adapter, source), restored = await reopened.change((await reopened.preview(c.id, null, true)).token);
        expect(restored.success, errors.join('\n') || restored.message).toBe(true);
        expect((await adapter.read()).values[c.id]).toBe(state.current); exercised++;
      }
      expect(exercised).toBeGreaterThanOrEqual(3);
      // Exact full query equality covers every AC and DC policy after restoration.
      expect(await run('/qh', clone)).toBe(before);
      expect((await adapter.read()).activePlanId).toBe(clone);
    } finally { await run('/setactive', original.activePlanId); await run('/delete', clone); await fs.rm(dir, { recursive: true, force: true }); }
  }, 240_000);
});
