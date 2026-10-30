import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, test, expect } from 'vitest';
import { POWER_CONTROLS, powerSource } from '../shared/power-tuning';
import { createPowerTuningService } from '../electron/power-tuning';
import type { PowerTuningAdapter } from '../electron/power-tuning-native';
const A = '381b4222-f694-41f0-9685-ff5bb260df2e', B = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const defaults = () => ({ 'cpu-minimum': 5, 'cpu-maximum': 100, 'cpu-boost': 2, 'cpu-energy': 50, 'pcie-power': 2, 'cpu-cooling': 1 } as Record<string, number | null>);
describe('separate, battery-gated power policies', () => {
  let dir: string, active: string, battery: boolean | null | undefined, ac: Record<string, number | null>, dc: Record<string, number | null>, writes: string[], failAfter: boolean;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-battery-')); active = A; battery = true; ac = defaults(); dc = defaults(); writes = []; failAfter = false; });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const adapter = (source: 'ac' | 'dc'): PowerTuningAdapter => ({ supported: true,
    read: async id => ({ planId: id ?? active, activePlanId: active, batteryPresent: battery, values: { ...(source === 'dc' ? dc : ac) } }),
    write: async (plan, expectedPlan, id, expected, desired, restore) => {
      expect(plan).toBe(A); expect(expectedPlan).toBe(active);
      if (source === 'dc' && !restore && battery !== true) throw new Error('No battery');
      const values = source === 'dc' ? dc : ac; expect(values[id]).toBe(expected);
      const low = id === 'cpu-minimum' ? desired : values['cpu-minimum']!, high = id === 'cpu-maximum' ? desired : values['cpu-maximum']!;
      if (low > high) throw new Error('Invalid bounds');
      const saved = JSON.parse(await fs.readFile(path.join(dir, 'backups', source === 'dc' ? 'battery-power-v1.json' : 'power-tuning-v1.json'), 'utf8'));
      expect(saved.records.find((r: { id: string }) => r.id === id).status).toBe('pending');
      values[id] = desired; writes.push(`${source}:${id}`); if (failAfter) throw new Error('Refresh denied');
    },
  });
  const service = (source: 'ac' | 'dc' = 'dc') => createPowerTuningService(dir, adapter(source), source);
  test.each(POWER_CONTROLS.map(c => c.id))('restores %s after relaunch without a battery or changing AC policies', async id => {
    const original = dc[id], desired = POWER_CONTROLS.find(c => c.id === id)!.options.find(o => o.value !== original && (id !== 'cpu-maximum' || o.value >= 5))!.value;
    const s = service(); const review = await s.preview(id, desired, false); expect(review.source).toBe('dc'); expect(writes).toEqual([]);
    expect(await s.change(review.token)).toMatchObject({ id: `battery-power:${id}`, success: true });
    battery = null; active = B;
    const reopened = service(); expect(await reopened.getInfo()).toMatchObject({ source: 'dc', canApply: false, batteryPresent: null, planId: A });
    expect((await reopened.change((await reopened.preview(id, null, true)).token)).success).toBe(true);
    expect(dc).toEqual(defaults()); expect(ac).toEqual(defaults()); expect(active).toBe(B);
  });
  test.each([false, null, undefined])('refuses new DC changes with battery status %s but permits AC changes', async presence => {
    battery = presence; const s = service(); expect((await s.getInfo()).canApply).toBe(false);
    await expect(s.preview('cpu-energy', 0, false)).rejects.toThrow('confirm a battery'); expect(writes).toEqual([]);
    const plugged = service('ac'); expect((await plugged.change((await plugged.preview('cpu-energy', 0, false)).token)).success).toBe(true);
    expect(dc).toEqual(defaults());
  });
  test('rechecks battery presence after review before saving or writing', async () => {
    const s = service(), r = await s.preview('cpu-energy', 0, false); battery = false;
    await expect(s.change(r.token)).rejects.toThrow('Battery status changed'); expect(writes).toEqual([]);
    await expect(fs.stat(path.join(dir, 'backups/battery-power-v1.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    battery = true; await expect(s.change(r.token)).rejects.toThrow('Review');
  });
  test('keeps AC and DC originals, confirmation tokens and journals independent', async () => {
    const a = service('ac'), d = service(); const ar = await a.preview('cpu-energy', 0, false), dr = await d.preview('cpu-energy', 75, false);
    await expect(d.change(ar.token)).rejects.toThrow('Review'); await expect(d.change(dr.token)).rejects.toThrow('Review');
    expect((await a.change(ar.token)).success).toBe(true);
    expect((await d.change((await d.preview('cpu-energy', 75, false)).token)).success).toBe(true);
    const reopened = service(); expect((await reopened.change((await reopened.preview('cpu-energy', null, true)).token)).success).toBe(true);
    expect(ac['cpu-energy']).toBe(0); expect(dc['cpu-energy']).toBe(50);
    expect((await service('ac').getInfo()).states.find(s => s.id === 'cpu-energy')).toMatchObject({ original: 50, applied: 0, managed: true });
  });
  test('accepts legacy AC journals but never interprets one as a DC original', async () => {
    const a = service('ac'); await a.change((await a.preview('cpu-energy', 0, false)).token);
    const file = path.join(dir, 'backups/power-tuning-v1.json'), raw = JSON.parse(await fs.readFile(file, 'utf8')); delete raw.source;
    await fs.writeFile(file, JSON.stringify(raw)); expect((await service('ac').getInfo()).states.find(s => s.id === 'cpu-energy')?.managed).toBe(true);
    await fs.writeFile(path.join(dir, 'backups/battery-power-v1.json'), JSON.stringify(raw));
    await expect(service().getInfo()).rejects.toThrow('Invalid advanced power backup'); expect(dc).toEqual(defaults());
  });
  test('preserves DC backup on failed refresh and refuses external changes', async () => {
    const s = service(); failAfter = true; expect((await s.change((await s.preview('cpu-energy', 0, false)).token)).success).toBe(false);
    dc['cpu-energy'] = 25; expect((await s.getInfo()).states.find(v => v.id === 'cpu-energy')?.conflict).toBe(true);
    await expect(s.preview('cpu-energy', null, true)).rejects.toThrow('outside PANDORA');
    dc['cpu-energy'] = 0; failAfter = false; battery = false;
    expect((await s.change((await s.preview('cpu-energy', null, true)).token)).success).toBe(true); expect(dc['cpu-energy']).toBe(50);
  });
  test('checks DC CPU bounds independently and rejects unknown sources', async () => {
    dc['cpu-maximum'] = 50;
    await expect(service().preview('cpu-minimum', 100, false)).rejects.toThrow('minimum must not exceed');
    expect((await service('ac').preview('cpu-minimum', 100, false)).source).toBe('ac');
    for (const value of ['battery', '', null, {}, 1]) expect(() => powerSource(value)).toThrow('Choose');
    expect(powerSource(undefined)).toBe('ac'); expect(writes).toEqual([]);
  });
});
