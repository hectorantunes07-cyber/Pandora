import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivityService } from '../electron/activity';
import type { ActivityEntry } from '../shared/activity';
describe('persistent operation activity', () => {
  let dir: string;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-activity-')); });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const file = () => path.join(dir, 'activity-v1.json');
  it('records partial batch outcomes and reopens them without private result messages or arguments', async () => {
    const activity = createActivityService(dir), result = [{ id: 'private-path', success: true, message: 'PRIVATE_SECRET' }, { id: 'other', success: false, message: 'PRIVATE_SECRET' }];
    expect(await activity.track('restore-all', async () => result)).toBe(result);
    const info = await createActivityService(dir).get();
    expect(info.entries).toHaveLength(1); expect(info.entries[0]).toMatchObject({ action: 'restore-all', status: 'partial', succeeded: 1, notConfirmed: 1 });
    expect(info.entries[0].endedAt).not.toBeNull();
    const json = await fs.readFile(file(), 'utf8'); expect(json).not.toContain('PRIVATE_SECRET'); expect(json).not.toContain('private-path');
  });
  it('leaves a durable pending event before the operation and treats an interrupted session as unconfirmed', async () => {
    const activity = createActivityService(dir); let resolve!: (value: unknown) => void;
    const run = vi.fn(() => new Promise(r => { resolve = r; }));
    const operation = activity.track('pointer-change', run);
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect((await activity.get()).entries[0].status).toBe('running');
    expect((await createActivityService(dir).get()).entries[0]).toMatchObject({ status: 'unconfirmed', endedAt: null });
    expect((await activity.previewClear()).count).toBe(0);
    resolve({ success: true }); await operation;
    expect((await createActivityService(dir).get()).entries[0].status).toBe('completed');
  });
  it('preserves thrown errors for callers while only recording an unconfirmed outcome', async () => {
    const activity = createActivityService(dir), error = new Error('PRIVATE_SECRET');
    await expect(activity.track('system-restore-create', async () => { throw error; })).rejects.toBe(error);
    expect((await activity.get()).entries[0].status).toBe('unconfirmed');
    expect(await fs.readFile(file(), 'utf8')).not.toContain('PRIVATE_SECRET');
  });
  it('distinguishes picker cancellation, unsuccessful changes and confirmed local saves', async () => {
    const activity = createActivityService(dir);
    await activity.track('cursor-select', async () => null);
    await activity.track('power-apply', async () => ({ success: false, message: 'private' }));
    await activity.track('nvidia-save', async () => ({ notes: 'PRIVATE_SECRET' }));
    expect((await activity.get()).entries.map(e => e.status)).toEqual(['completed', 'unconfirmed', 'cancelled']);
    expect(await fs.readFile(file(), 'utf8')).not.toContain('PRIVATE_SECRET');
  });
  it('reports Recycle Bin cancellation/failures even when skippedFiles is zero', async () => {
    const activity = createActivityService(dir);
    await activity.track('clean', async () => ({ kind: 'recycle', deletedBytes: 0, deletedFiles: 0, skippedFiles: 0, failures: [{ path: 'PRIVATE_SECRET' }] }));
    await activity.track('clean', async () => ({ kind: 'browser', deletedBytes: 4096, deletedFiles: 2, skippedFiles: 1, failures: [{ path: 'PRIVATE_SECRET' }] }));
    const entries = (await activity.get()).entries;
    expect(entries[0]).toMatchObject({ status: 'partial', cleanup: { kind: 'browser', deletedBytes: 4096, deletedFiles: 2, skippedFiles: 1 } });
    expect(entries[1]).toMatchObject({ status: 'unconfirmed', notConfirmed: 1 });
    expect(await fs.readFile(file(), 'utf8')).not.toContain('PRIVATE_SECRET');
  });
  it('does not turn malformed success or cleanup results into confirmed activity', async () => {
    const activity = createActivityService(dir);
    await activity.track('apply', async () => [{ success: 'yes' }]);
    await activity.track('clean', async () => ({ kind: 'safe', deletedBytes: -1, deletedFiles: 0, skippedFiles: 0, failures: [] }));
    await activity.track('pointer-change', async () => ({}));
    expect((await activity.get()).entries.every(e => e.status === 'unconfirmed')).toBe(true);
  });
  it('allows operations and rollback when activity storage is unreadable without overwriting that file', async () => {
    await fs.writeFile(file(), 'corrupt PRIVATE_SECRET');
    const activity = createActivityService(dir), run = vi.fn(async () => ({ success: true }));
    expect(await activity.track('restore-all', run)).toEqual({ success: true }); expect(run).toHaveBeenCalledOnce();
    const info = await activity.get(); expect(info).toMatchObject({ available: false, incomplete: true });
    expect(JSON.stringify(info)).not.toContain('PRIVATE_SECRET'); expect(await fs.readFile(file(), 'utf8')).toBe('corrupt PRIVATE_SECRET');
    await expect(activity.previewClear()).rejects.toThrow();
  });
  it('does not report a successful Windows operation as failed when the final activity save fails', async () => {
    const activity = createActivityService(dir), result = { success: true };
    expect(await activity.track('power-restore', async () => { await fs.writeFile(file(), 'external corruption'); return result; })).toBe(result);
    expect((await activity.get()).incomplete).toBe(true);
    expect(await fs.readFile(file(), 'utf8')).toBe('external corruption');
  });
  it('retains 500 events, reports pruning and never modifies backup files', async () => {
    const entries: ActivityEntry[] = Array.from({ length: 500 }, () => ({ id: randomUUID(), action: 'save-settings', startedAt: '2026-10-01T00:00:00.000Z', endedAt: '2026-10-01T00:00:01.000Z', status: 'completed', succeeded: null, notConfirmed: null, cleanup: null }));
    await fs.writeFile(file(), JSON.stringify({ version: 1, entries, discarded: 0, clearedAt: null, incomplete: false }));
    await fs.mkdir(path.join(dir, 'backups')); await fs.writeFile(path.join(dir, 'backups', 'original.json'), 'keep exact original');
    const activity = createActivityService(dir); await activity.track('save-settings', async () => ({}));
    const info = await activity.get(); expect(info.entries).toHaveLength(500); expect(info.discarded).toBe(1); expect(info.entries.some(e => e.id === entries[0].id)).toBe(false);
    await activity.clear((await activity.previewClear()).token);
    expect((await activity.get()).entries).toHaveLength(0); expect((await activity.get()).discarded).toBe(501);
    expect(await fs.readFile(path.join(dir, 'backups', 'original.json'), 'utf8')).toBe('keep exact original');
  });
  it('requires a fresh single-use clear review and refuses changes after review', async () => {
    let clock = Date.now(); const activity = createActivityService(dir, () => clock);
    await activity.track('save-settings', async () => ({}));
    const first = await activity.previewClear(); expect((await activity.get()).entries).toHaveLength(1);
    await activity.track('cursor-app', async () => ({})); await expect(activity.clear(first.token)).rejects.toThrow('changed');
    const expired = await activity.previewClear(); clock += 300_000; await expect(activity.clear(expired.token)).rejects.toThrow('Review');
    const last = await activity.previewClear(); await expect(activity.clear('forged')).rejects.toThrow('Review');
    await expect(activity.clear(last.token)).rejects.toThrow('Review');
    const valid = await activity.previewClear(); await activity.clear(valid.token); await expect(activity.clear(valid.token)).rejects.toThrow('Review');
  });
  it('serializes concurrent events without losing either final result', async () => {
    const activity = createActivityService(dir);
    await Promise.all([activity.track('cursor-app', async () => ({})), activity.track('save-settings', async () => ({}))]);
    expect((await activity.get()).entries).toHaveLength(2); expect((await activity.get()).entries.every(e => e.status === 'completed')).toBe(true);
  });
  it('keeps a known recording gap visible after storage recovers and the app reopens', async () => {
    const activity = createActivityService(dir); await fs.writeFile(file(), 'unreadable');
    await activity.track('save-settings', async () => ({}));
    await fs.unlink(file()); // Simulates an external recovery; the service never removes a damaged file.
    await activity.track('save-settings', async () => ({}));
    expect((await createActivityService(dir).get()).incomplete).toBe(true);
  });
});
