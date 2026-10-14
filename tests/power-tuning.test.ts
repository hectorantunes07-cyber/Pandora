import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, test, expect } from 'vitest';
import { POWER_CONTROLS } from '../shared/power-tuning';
import { createPowerTuningService } from '../electron/power-tuning';
import type { PowerTuningAdapter } from '../electron/power-tuning-native';
const A = '381b4222-f694-41f0-9685-ff5bb260df2e', B = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
describe('reviewed plugged-in power controls', () => {
  let dir: string, active: string, values: Record<string, number | null>, writes: string[], failure: 'none' | 'before' | 'after';
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-power-tuning-')); active = A; values = { 'cpu-minimum': 5, 'cpu-maximum': 100, 'cpu-boost': 2, 'cpu-energy': 50, 'pcie-power': 2, 'cpu-cooling': 1 }; writes = []; failure = 'none'; });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const adapter: PowerTuningAdapter = { supported: true, read: async id => ({ planId: id ?? active, activePlanId: active, values: { ...values } }), write: async (plan, expectedPlan, id, expected, desired) => { expect(expectedPlan).toBe(active); expect(plan).toBe(A); expect(values[id]).toBe(expected); if (failure === 'before') throw new Error('denied'); values[id] = desired; writes.push(id); if (failure === 'after') throw new Error('refresh failed'); } };
  const service = () => createPowerTuningService(dir, adapter);
  test.each(POWER_CONTROLS.map(c => c.id))('backs up and restores %s after relaunch without changing active plan', async id => {
    const original = values[id], desired = POWER_CONTROLS.find(c => c.id === id)!.options.find(o => o.value !== original && (id !== 'cpu-maximum' || o.value >= 5))!.value;
    const s = service(), review = await s.preview(id, desired, false); expect(writes).toEqual([]);
    expect((await s.change(review.token)).success).toBe(true); expect(values[id]).toBe(desired);
    active = B; const reopened = service(); expect((await reopened.getInfo()).planId).toBe(A);
    expect((await reopened.change((await reopened.preview(id, null, true)).token)).success).toBe(true); expect(values[id]).toBe(original); expect(active).toBe(B);
  });
  test('rejects stale active plan, stale values and reused confirmations without writing', async () => {
    const s = service(), r = await s.preview('cpu-energy', 0, false); active = B;
    await expect(s.change(r.token)).rejects.toThrow('changed after review'); await expect(s.change(r.token)).rejects.toThrow('Review');
    active = A; const second = await s.preview('cpu-energy', 0, false); values['cpu-energy'] = 25;
    await expect(s.change(second.token)).rejects.toThrow('changed after review'); expect(writes).toEqual([]);
  });
  test('refuses external values and new edits while a different plan has owned changes', async () => {
    const s = service(); await s.change((await s.preview('cpu-energy', 0, false)).token); values['cpu-energy'] = 75;
    expect((await s.getInfo()).states.find(c => c.id === 'cpu-energy')?.conflict).toBe(true);
    await expect(s.preview('cpu-energy', null, true)).rejects.toThrow('outside PANDORA'); active = B;
    await expect(s.preview('pcie-power', 0, false)).rejects.toThrow('Restore the previous');
  });
  test('guards CPU bounds, unsupported values and provider absence', async () => {
    const s = service(); values['cpu-maximum'] = 50;
    await expect(s.preview('cpu-minimum', 100, false)).rejects.toThrow('minimum must not exceed');
    await expect(s.preview('cpu-boost', 8, false)).rejects.toThrow('supported power value');
    values['cpu-cooling'] = null; await expect(s.preview('cpu-cooling', 0, false)).rejects.toThrow('unavailable'); expect(writes).toEqual([]);
  });
  test('retains retryable backup after activation failure and restores exact original', async () => {
    const s = service(); failure = 'after'; expect((await s.change((await s.preview('cpu-energy', 0, false)).token)).success).toBe(false);
    expect((await s.getInfo()).states.find(c => c.id === 'cpu-energy')?.managed).toBe(true);
    expect((await s.change((await s.preview('cpu-energy', null, true)).token)).success).toBe(false);
    expect((await s.getInfo()).states.find(c => c.id === 'cpu-energy')?.managed).toBe(true);
    failure = 'none'; expect((await s.change((await s.preview('cpu-energy', null, true)).token)).success).toBe(true); expect(values['cpu-energy']).toBe(50);
  });
  test('policy denial and corrupt backups never produce successful claims', async () => {
    const s = service(); failure = 'before'; expect((await s.change((await s.preview('cpu-energy', 0, false)).token)).success).toBe(false); expect(values['cpu-energy']).toBe(50);
    await fs.writeFile(path.join(dir, 'backups/power-tuning-v1.json'), '{bad'); await expect(s.getInfo()).rejects.toThrow('preserved'); expect(writes).toEqual([]);
  });
});
