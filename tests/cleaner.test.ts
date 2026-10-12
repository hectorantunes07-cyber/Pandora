import { describe, expect, it, vi } from 'vitest';
import { createCleanerService } from '../electron/cleaner';
import { createNativeCleanerAdapter, type Candidate, type CleanerAdapter, type NativeScan } from '../electron/cleaner-native';

const file: Candidate = { path: 'C:\\Users\\Tester\\AppData\\Local\\Temp\\old.tmp', root: 'C:\\Users\\Tester\\AppData\\Local\\Temp', bytes: 2048, identity: 'volume:inode:created', modified: 'write-time', categoryId: 'user-temp' };
function scanData(files: Candidate[] = [file]): NativeScan {
  return { groups: [{ id: 'user-temp', title: 'Temporary files', description: 'Stale files only.', roots: [file.root], files }], warnings: ['Exact scan-time sizes; locked files may be skipped.'] };
}
function fixture(data = scanData()) {
  let clock = 1_000_000, counter = 0;
  const events: unknown[] = [];
  const adapter: CleanerAdapter = {
    scan: vi.fn(async () => structuredClone(data)),
    remove: vi.fn(async (_kind, files, onFile) => { for (const candidate of files) onFile({ path: candidate.path, bytes: candidate.bytes, deleted: true }); }),
  };
  const service = createCleanerService(event => events.push(event), { adapter, now: () => clock, id: () => `snapshot-${++counter}` });
  return { service, adapter, events, advance: (ms: number) => { clock += ms; } };
}

describe('cleaner snapshots and measured outcomes', () => {
  it('exposes category summaries, keeps file identities private, and counts only confirmed deletion', async () => {
    const { service, adapter, events } = fixture();
    const scan = await service.scanCleanup('safe');
    expect(scan.categories[0]).toMatchObject({ bytes: 2048, fileCount: 1 });
    expect(JSON.stringify(scan)).not.toContain(file.identity);
    expect(JSON.stringify(scan)).not.toContain('old.tmp');
    const result = await service.clean(scan.id, ['user-temp'], 'safe');
    expect(result).toEqual({ kind: 'safe', deletedBytes: 2048, deletedFiles: 1, skippedFiles: 0, failures: [], recoveredBytes: null });
    expect(adapter.remove).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({ operation: 'clean', completed: 1, total: 1, message: '1 of 1 files processed' });
  });

  it('reports locked/changed/missing files without counting them as recovered', async () => {
    const files = [file, { ...file, path: `${file.root}\\changed.tmp` }, { ...file, path: `${file.root}\\missing.tmp` }];
    const { service, adapter } = fixture(scanData(files));
    adapter.remove = async (_kind, selected, onFile) => selected.forEach((candidate, i) => onFile({ path: candidate.path, deleted: false, bytes: 0, reason: ['Locked', 'Changed since scan', 'Missing'][i] }));
    const scan = await service.scanCleanup('safe');
    const result = await service.clean(scan.id, ['user-temp'], 'safe');
    expect(result.deletedBytes).toBe(0); expect(result.skippedFiles).toBe(3);
    expect(result.failures.map(f => f.reason)).toEqual(['Locked', 'Changed since scan', 'Missing']);
  });

  it('requires a separate matching confirmation for browser or Recycle Bin cleanup', async () => {
    const { service, adapter } = fixture();
    const scan = await service.scanCleanup('browser');
    await expect(service.clean(scan.id, ['user-temp'], 'safe')).rejects.toThrow('Separate confirmation');
    await expect(service.clean(scan.id, ['user-temp'], 'recycle')).rejects.toThrow('Separate confirmation');
    expect(adapter.remove).not.toHaveBeenCalled();
    expect((await service.clean(scan.id, ['user-temp'], 'browser')).deletedBytes).toBe(2048);
  });

  it('rejects arbitrary paths, unknown categories, duplicate categories, and empty selections', async () => {
    const { service, adapter } = fixture();
    const scan = await service.scanCleanup('safe');
    for (const selection of [['C:\\Users\\Tester\\Downloads'], ['unknown'], ['user-temp', 'user-temp'], []]) {
      await expect(service.clean(scan.id, selection, 'safe')).rejects.toThrow();
    }
    await expect(service.clean('C:\\Windows\\System32', ['user-temp'], 'safe')).rejects.toThrow('expired');
    expect(adapter.remove).not.toHaveBeenCalled();
  });

  it('expires scans after ten minutes and invalidates a scan when a newer scan replaces it', async () => {
    const { service, advance, adapter } = fixture();
    const expired = await service.scanCleanup('safe'); advance(600_001);
    await expect(service.clean(expired.id, ['user-temp'], 'safe')).rejects.toThrow('expired');
    const old = await service.scanCleanup('safe'); await service.scanCleanup('safe');
    await expect(service.clean(old.id, ['user-temp'], 'safe')).rejects.toThrow('expired');
    expect(adapter.remove).not.toHaveBeenCalled();
  });

  it('consumes a scan once, including after interruption, and preserves confirmed partial results', async () => {
    const second = { ...file, path: `${file.root}\\second.tmp` };
    const { service, adapter } = fixture(scanData([file, second]));
    adapter.remove = async (_kind, files, onFile) => { onFile({ path: files[0].path, deleted: true, bytes: 2048 }); throw new Error('Native process stopped'); };
    const scan = await service.scanCleanup('safe');
    const result = await service.clean(scan.id, ['user-temp'], 'safe');
    expect(result).toMatchObject({ deletedBytes: 2048, deletedFiles: 1, skippedFiles: 1, recoveredBytes: null });
    expect(result.failures[0]).toMatchObject({ path: second.path, reason: 'Not confirmed deleted: Native process stopped' });
    await expect(service.clean(scan.id, ['user-temp'], 'safe')).rejects.toThrow('already used');
  });

  it('does not permit the UI to mutate the stored scan', async () => {
    const { service, adapter } = fixture();
    const scan = await service.scanCleanup('safe');
    scan.categories[0].paths[0] = 'C:\\Users\\Tester\\Documents'; scan.categories[0].bytes = 9999999;
    await service.clean(scan.id, ['user-temp'], 'safe');
    expect(vi.mocked(adapter.remove).mock.calls[0][1]).toEqual([file]);
  });

  it('serializes scans and mutations to avoid overlap', async () => {
    const { service, adapter } = fixture();
    let release!: () => void;
    adapter.remove = async (_kind, files, onFile) => { await new Promise<void>(resolve => { release = resolve; }); onFile({ path: files[0].path, bytes: 2048, deleted: true }); };
    const scan = await service.scanCleanup('safe');
    const cleaning = service.clean(scan.id, ['user-temp'], 'safe');
    await expect(service.scanCleanup('safe')).rejects.toThrow('running');
    await expect(service.clean(scan.id, ['user-temp'], 'safe')).rejects.toThrow('running');
    release(); await cleaning;
  });

  it('cannot delete extra categories from another saved scan', async () => {
    const { service, adapter } = fixture();
    const first = await service.scanCleanup('safe');
    adapter.scan = async () => ({ groups: [{ id: 'chrome-cache', title: 'Chrome', description: '', roots: [], files: [] }], warnings: [] });
    await service.scanCleanup('browser');
    await expect(service.clean(first.id, ['chrome-cache'], 'safe')).rejects.toThrow('not in this scan');
    expect(adapter.remove).not.toHaveBeenCalled();
  });

  it('rejects unsafe integer accounting and duplicate scan files', async () => {
    const invalid = fixture(scanData([{ ...file, bytes: Number.MAX_SAFE_INTEGER + 1 }]));
    await expect(invalid.service.scanCleanup('safe')).rejects.toThrow('invalid file size');
    const duplicate = fixture(scanData([file, file]));
    await expect(duplicate.service.scanCleanup('safe')).rejects.toThrow('duplicate scan result');
  });

  it('survives a broken progress listener without abandoning deletion accounting', async () => {
    const { adapter } = fixture();
    const service = createCleanerService(() => { throw new Error('Window closed'); }, { adapter });
    const scan = await service.scanCleanup('safe');
    expect((await service.clean(scan.id, ['user-temp'], 'safe')).deletedBytes).toBe(2048);
  });

  it.skipIf(process.platform === 'win32')('fails closed on non-Windows systems', async () => {
    await expect(createNativeCleanerAdapter().scan('safe')).rejects.toThrow('requires the Windows desktop app');
  });
});
