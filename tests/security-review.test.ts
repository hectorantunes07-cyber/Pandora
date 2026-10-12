import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCleanerService } from '../electron/cleaner';
import type { Candidate, CleanerAdapter, FileOutcome, NativeScan } from '../electron/cleaner-native';
import { createTweakService, type RegistryAdapter } from '../electron/tweaks';
import { TWEAK_CATALOG } from '../electron/tweak-catalog';

const tempFile: Candidate = {
  path: 'C:\\Users\\Tester\\AppData\\Local\\Temp\\review.tmp',
  root: 'C:\\Users\\Tester\\AppData\\Local\\Temp', bytes: 1234,
  identity: 'volume:file:creation', modified: 'previous-write', categoryId: 'user-temp',
};
const scan: NativeScan = { groups: [{ id: 'user-temp', title: 'Unused temporary files', description: '', roots: [tempFile.root], files: [tempFile] }], warnings: [] };
const bin: NativeScan = { groups: [{ id: 'recycle-bin', title: 'Recycle Bin', description: '', roots: [], files: [], bytes: 5000, fileCount: 3 }], warnings: [] };

function cleaner(data: NativeScan, outcomes: FileOutcome[]) {
  const adapter: CleanerAdapter = {
    scan: async () => structuredClone(data),
    remove: async (_kind, _files, onFile) => { for (const outcome of outcomes) onFile(outcome); },
  };
  return createCleanerService(() => undefined, { adapter });
}

describe('independent cleaner result validation', () => {
  it('does not claim a completed Recycle Bin cleanup without an explicit native outcome', async () => {
    const service = cleaner(bin, []), snapshot = await service.scanCleanup('recycle');
    const result = await service.clean(snapshot.id, ['recycle-bin'], 'recycle');
    expect(result.deletedBytes).toBe(0);
    expect(result.recoveredBytes).toBeNull();
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toMatch(/could not be confirmed/);
  });

  it('counts a Recycle Bin result once and flags duplicated native messages', async () => {
    const outcome = { path: 'Recycle Bin', deleted: true, bytes: 3000, deletedFiles: 2 };
    const service = cleaner(bin, [outcome, outcome]), snapshot = await service.scanCleanup('recycle');
    const result = await service.clean(snapshot.id, ['recycle-bin'], 'recycle');
    expect(result.deletedBytes).toBe(3000);
    expect(result.deletedFiles).toBe(2);
    expect(result.recoveredBytes).toBeNull();
    expect(result.failures[0].reason).toMatch(/duplicate/);
  });

  it('rejects an unrelated native result during Recycle Bin cleanup', async () => {
    const service = cleaner(bin, [{ path: 'Documents', deleted: true, bytes: 5000 }]);
    const snapshot = await service.scanCleanup('recycle');
    const result = await service.clean(snapshot.id, ['recycle-bin'], 'recycle');
    expect(result.deletedBytes).toBe(0);
    expect(result.failures[0].reason).toMatch(/unknown/);
  });

  it('preserves observed partial bin removal without describing a cancellation as complete', async () => {
    const service = cleaner(bin, [{ path: 'Recycle Bin', deleted: false, bytes: 1000, deletedFiles: 1, reason: 'Windows canceled after partial removal.' }]);
    const snapshot = await service.scanCleanup('recycle');
    const result = await service.clean(snapshot.id, ['recycle-bin'], 'recycle');
    expect(result).toMatchObject({ deletedBytes: 1000, deletedFiles: 1, recoveredBytes: null });
    expect(result.failures).toHaveLength(1);
  });

  for (const invalidBytes of [1235, -1, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
    it(`retains the unconfirmed candidate when a reported byte count is invalid (${invalidBytes})`, async () => {
      const service = cleaner(scan, [{ path: tempFile.path, deleted: true, bytes: invalidBytes }]);
      const snapshot = await service.scanCleanup('safe');
      const result = await service.clean(snapshot.id, ['user-temp'], 'safe');
      expect(result).toMatchObject({ deletedBytes: 0, deletedFiles: 0, skippedFiles: 1, recoveredBytes: null });
      expect(result.failures[0].path).toBe(tempFile.path);
      expect(result.failures[0].reason).toMatch(/Not confirmed deleted/);
    });
  }

  it('never counts a duplicated confirmed file deletion twice', async () => {
    const outcome = { path: tempFile.path, deleted: true, bytes: tempFile.bytes };
    const service = cleaner(scan, [outcome, outcome]), snapshot = await service.scanCleanup('safe');
    const result = await service.clean(snapshot.id, ['user-temp'], 'safe');
    expect(result.deletedBytes).toBe(tempFile.bytes);
    expect(result.deletedFiles).toBe(1);
    expect(result.failures[0].reason).toMatch(/duplicate/);
  });
});

describe('independent restore journal validation', () => {
  const directories: string[] = [];
  afterEach(async () => { await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true }))); });

  const originalRecord = () => ({
    entry: { id: 'review-record-1', tweakId: TWEAK_CATALOG[0].id, title: TWEAK_CATALOG[0].title,
      timestamp: '2026-10-12T10:00:00.000Z', status: 'applied', originalValue: 17,
      appliedValue: TWEAK_CATALOG[0].desiredValue, message: 'Original value saved.' },
    original: { kind: 'dword', value: 17 }, intent: 'apply',
  });

  it.each(['wrong-target', 'unsupported-original', 'disagreed-original', 'ambiguous-active'])(
    'refuses syntactically valid but unsafe backups: %s', async damage => {
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-security-review-'));
      directories.push(directory);
      const record = originalRecord();
      const journal = { version: 1, records: [record] };
      if (damage === 'wrong-target') record.entry.tweakId = 'unmanaged-registry-value';
      if (damage === 'unsupported-original') record.original.kind = 'unsupported';
      if (damage === 'disagreed-original') record.entry.originalValue = 999;
      if (damage === 'ambiguous-active') journal.records.push({ ...originalRecord(), entry: { ...record.entry, id: 'review-record-2' } });
      const file = path.join(directory, 'backups', 'tweaks-v1.json');
      await fs.mkdir(path.dirname(file));
      const raw = JSON.stringify(journal);
      await fs.writeFile(file, raw);
      let readCount = 0, writeCount = 0;
      const adapter: RegistryAdapter = { supported: true,
        read: async () => { readCount++; return { kind: 'dword', value: TWEAK_CATALOG[0].desiredValue }; },
        write: async () => { writeCount++; },
      };
      await expect(createTweakService(directory, { adapter }).revertTweaks([TWEAK_CATALOG[0].id])).rejects.toThrow(/Cannot safely load backups/);
      expect(readCount).toBe(0);
      expect(writeCount).toBe(0);
      expect(await fs.readFile(file, 'utf8')).toBe(raw);
    },
  );
});
