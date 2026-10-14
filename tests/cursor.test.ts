import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCursorService } from '../electron/cursor';
import { validateCursor } from '../electron/cursor-file';
import type { CursorValue } from '../shared/types';
const bundled = path.resolve('public/cursors/sonnier.cur');
function ani(frame: Buffer) {
  const chunk = (id: string, b: Buffer) => { const head = Buffer.alloc(8); head.write(id); head.writeUInt32LE(b.length, 4); return Buffer.concat([head, b, Buffer.alloc(b.length % 2)]); };
  const header = Buffer.alloc(36); header.writeUInt32LE(36); header.writeUInt32LE(1, 4); header.writeUInt32LE(1, 8); header.writeUInt32LE(6, 28); header.writeUInt32LE(1, 32);
  const body = Buffer.concat([Buffer.from('ACON'), chunk('anih', header), chunk('LIST', Buffer.concat([Buffer.from('fram'), chunk('icon', frame)]))]);
  const head = Buffer.alloc(8); head.write('RIFF'); head.writeUInt32LE(body.length, 4); return Buffer.concat([head, body]);
}
test('validates the supplied crosshair, preserves its hotspot and extracts a bounded ANI frame', async () => {
  const bytes = await fs.readFile(bundled), parsed = validateCursor(bytes, '.cur');
  expect(parsed).toMatchObject({ width: 32, height: 32, x: 15, y: 16, kind: 'cur' });
  expect(parsed.hash).toBe('1d73adc392eb917fbb90601c47edc1ca14f1d5249d5f56d85d5ce1f61bbe85d4');
  expect(validateCursor(parsed.frame, '.cur').png).toEqual(parsed.png);
  expect(validateCursor(ani(bytes), '.ani')).toMatchObject({ kind: 'ani', x: 15, y: 16 });
});
test('rejects truncated, oversized, mismatched, invalid-hotspot and overlapping cursor files', async () => {
  const b = await fs.readFile(bundled);
  for (const end of [0, 8, 21, 100, b.length - 1]) expect(() => validateCursor(b.subarray(0, end), '.cur')).toThrow();
  expect(() => validateCursor(Buffer.alloc(2 * 1024 * 1024 + 1), '.cur')).toThrow();
  expect(() => validateCursor(b, '.ani')).toThrow(); expect(() => validateCursor(b, '.exe')).toThrow();
  const hot = Buffer.from(b); hot.writeUInt16LE(33, 10); expect(() => validateCursor(hot, '.cur')).toThrow();
  const offset = Buffer.from(b); offset.writeUInt32LE(6, 18); expect(() => validateCursor(offset, '.cur')).toThrow();
  const compressed = Buffer.from(b); compressed.writeUInt32LE(1, 38); expect(() => validateCursor(compressed, '.cur')).toThrow();
  const malformed = ani(b); malformed.writeUInt32LE(1000, 12 + 8 + 4); expect(() => validateCursor(malformed, '.ani')).toThrow();
});
describe('normal pointer persistence and recovery', () => {
  let dir: string, current: CursorValue, writes: CursorValue[], failure: 'none' | 'before' | 'after';
  const adapter = { supported: true, read: async () => ({ ...current }), preview: async () => null, write: async (expected: CursorValue, desired: CursorValue) => { expect(current).toEqual(expected); if (failure === 'before') throw new Error('policy'); current = { ...desired }; writes.push(current); if (failure === 'after') throw new Error('reload failure'); } };
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-cursor-')); current = { kind: 'ExpandString', value: '%SystemRoot%\\Cursors\\aero_arrow.cur' }; writes = []; failure = 'none'; });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const service = () => createCursorService(dir, bundled, adapter);
  test('backs up exact registry kind, uses persistent validated bytes and restores after relaunch', async () => {
    const original = { ...current }, s = service(), before = await s.getInfo(); expect(before.managed).toBe(false); expect(writes).toEqual([]);
    expect((await s.change(before.token, false)).success).toBe(true);
    expect(current.kind).toBe('String'); expect(path.dirname(current.value!)).toBe(path.join(dir, 'cursors'));
    expect(await fs.readFile(current.value!)).toEqual(await fs.readFile(bundled));
    const reopened = service(); expect((await reopened.getInfo()).original).toEqual(original);
    expect((await reopened.change((await reopened.getInfo()).token, true)).success).toBe(true);
    expect(current).toEqual(original); expect((await reopened.getInfo()).managed).toBe(false);
  });
  test.each([{ kind: null, value: null }, { kind: 'String' as const, value: '' }])('restores absent and empty originals exactly: %j', async original => {
    current = original; const s = service(); await s.change((await s.getInfo()).token, false); await s.change((await s.getInfo()).token, true); expect(current).toEqual(original);
  });
  test('rejects stale and reused confirmations and preserves external changes', async () => {
    const s = service(), old = await s.getInfo(); current = { kind: 'String', value: 'external.cur' };
    await expect(s.change(old.token, false)).rejects.toThrow('changed after review'); expect(writes).toEqual([]);
    await expect(s.change(old.token, false)).rejects.toThrow('review');
    await s.change((await s.getInfo()).token, false); current = { kind: 'String', value: 'new-external.cur' };
    const conflict = await s.getInfo(); expect(conflict.conflict).toBe(true);
    await expect(s.change(conflict.token, true)).rejects.toThrow('external cursor'); expect(writes).toHaveLength(1);
  });
  test('a failed reload retains ownership and allows explicit rollback without extra automatic writes', async () => {
    const s = service(); failure = 'after'; expect((await s.change((await s.getInfo()).token, false)).success).toBe(false);
    expect((await service().getInfo()).managed).toBe(true); expect(writes).toHaveLength(1);
    failure = 'none'; expect((await s.change((await s.getInfo()).token, true)).success).toBe(true);
  });
  test('failed native writes leave original values and backup intact', async () => {
    const s = service(), original = { ...current }; failure = 'before'; expect((await s.change((await s.getInfo()).token, false)).success).toBe(false);
    expect(current).toEqual(original); expect(writes).toHaveLength(0); expect((await s.getInfo()).original).toEqual(original);
  });
  test('corrupt journals block writes; app-only preference never changes Windows', async () => {
    const s = service(); const enabled = await s.setAppCursor(true); expect(enabled.useInApp).toBe(true); expect(writes).toEqual([]); expect((await service().getInfo()).useInApp).toBe(true);
    await fs.mkdir(path.join(dir, 'backups')); await fs.writeFile(path.join(dir, 'backups/cursor-v1.json'), '{broken');
    await expect(s.getInfo()).rejects.toThrow('preserved'); expect(writes).toEqual([]);
  });
  test('tampered selected assets block apply while original rollback remains available', async () => {
    const s = service(); const selected = await s.select(bundled); await s.change(selected.token, false);
    await fs.writeFile(current.value!, 'tampered'); const damaged = await s.getInfo(); expect(damaged.selected).toBeNull(); expect(damaged.managed).toBe(true);
    expect((await s.change(damaged.token, true)).success).toBe(true);
  });
  test('selection validates bytes rather than extension and leaves previous choice on failure', async () => {
    const s = service(); const good = await s.select(bundled), invalid = path.join(dir, 'bad.cur'); await fs.writeFile(invalid, Buffer.alloc(40));
    await expect(s.select(invalid)).rejects.toThrow('invalid cursor'); expect((await s.getInfo()).selected?.id).toBe(good.selected?.id); expect(writes).toEqual([]);
  });
});
