import { test, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createNvidiaService, validateNvidiaPreset } from '../electron/nvidia';
import { NVIDIA_SETTINGS, NVIDIA_PRESET_NAME } from '../shared/nvidia-library';
const preset = () => ({ version: 1 as const, name: NVIDIA_PRESET_NAME, savedAt: new Date().toISOString(), notes: 'Original values recorded.', values: Object.fromEntries(NVIDIA_SETTINGS.map(s => [s.id, s.value])) });
test('reference persists without native writes and corrupt data is preserved', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pandora-nvidia-'));
  try {
    const service = createNvidiaService(dir); expect(await service.getPreset()).toBeNull();
    const saved = await service.savePreset(preset()); expect(await createNvidiaService(dir).getPreset()).toEqual(saved);
    await writeFile(path.join(dir, 'nvidia-reference-v1.json'), '{bad');
    await expect(service.getPreset()).rejects.toThrow('preserved');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('preset rejects unknown keys, missing settings and oversized notes', () => {
  expect(() => validateNvidiaPreset({ ...preset(), notes: 'x'.repeat(2001) })).toThrow();
  expect(() => validateNvidiaPreset({ ...preset(), values: { anything: 'on' } })).toThrow();
  expect(new Set(NVIDIA_SETTINGS.map(s => s.id)).size).toBe(NVIDIA_SETTINGS.length);
  expect(NVIDIA_SETTINGS.find(s => s.title === 'Video Dynamic Range')?.tradeoff).toContain('video-playback');
});
