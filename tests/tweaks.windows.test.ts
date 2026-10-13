import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TWEAKS_BY_ID } from '../electron/tweak-catalog';
import { createTweakService, createWindowsRegistryAdapter } from '../electron/tweaks';

/** Opt-in integration check for a disposable Windows CI account ONLY.
 * Never enabled by normal npm test. The finally block restores the genuine
 * pre-test preference, even when the service or an assertion fails.
 */
const allowed = process.platform === 'win32' && process.env.PANDORA_TEST_WINDOWS_TWEAKS === '1';
describe.skipIf(!allowed)('native Windows registry roundtrip (explicit disposable-machine opt-in)', () => {
  it('applies, verifies, relaunches and restores the Explorer extension preference', async () => {
    const adapter = createWindowsRegistryAdapter();
    const tweak = TWEAKS_BY_ID.get('file-extensions')!;
    const original = await adapter.read(tweak);
    expect(original.kind, 'A Windows desktop with a supported Explorer preference is required').not.toBe('unsupported');
    if (original.kind === 'unsupported') throw new Error('Unsupported native preference; no changes were attempted.');
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-native-registry-'));
    const baseline = { kind: 'dword' as const, value: tweak.desiredValue === 0 ? 1 : 0 };
    try {
      await adapter.write(tweak, baseline);
      expect(await adapter.read(tweak)).toEqual(baseline);
      const service = createTweakService(directory, { adapter });
      expect((await service.applyTweaks([tweak.id]))[0].success).toBe(true);
      expect(await adapter.read(tweak)).toEqual({ kind: 'dword', value: tweak.desiredValue });
      expect((await service.getTweaks()).find(item => item.id === tweak.id)?.state).toBe('applied');
      const reopened = createTweakService(directory, { adapter });
      expect((await reopened.revertTweaks([tweak.id]))[0].success).toBe(true);
      expect(await adapter.read(tweak)).toEqual(baseline);
      expect((await reopened.getHistory())[0].status).toBe('reverted');
      // The custom preset uses the same reviewed ownership and native adapter.
      const review = await reopened.previewProfile('custom', [tweak.id]);
      expect((await reopened.applyProfile(review.token)).every(r => r.success)).toBe(true);
      expect((await reopened.getProfile()).ownedIds).toEqual([tweak.id]);
      const relaunched = createTweakService(directory, { adapter });
      const off = await relaunched.previewProfile(null);
      expect((await relaunched.applyProfile(off.token)).every(r => r.success)).toBe(true);
      expect(await adapter.read(tweak)).toEqual(baseline);
    } finally {
      await adapter.write(tweak, original);
      expect(await adapter.read(tweak), 'The actual pre-test preference must be restored').toEqual(original);
      await fs.rm(directory, { recursive: true, force: true });
      // If restoring throws, retain the test journal and fail loudly. Discard the
      // disposable VM/account; never run this integration suite on a personal PC.
    }
  }, 120_000);
});
