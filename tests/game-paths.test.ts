import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { checkGameExecutable, createGamePathService } from '../electron/game-paths';
describe('manual game locations are local metadata, never execution', () => {
  let dir: string, exe: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-game-path-')); exe = path.join(dir, "Game O'Brien.exe");
    const bytes = Buffer.alloc(128); bytes.writeUInt16LE(0x5a4d, 0); bytes.writeUInt32LE(64, 60); bytes.writeUInt32LE(0x4550, 64); await fs.writeFile(exe, bytes);
  });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  it('persists a native-picker path, reports disappearance and forgets only app metadata', async () => {
    const s = createGamePathService(dir); await s.select('fortnite', exe);
    expect(await createGamePathService(dir).list()).toEqual([{ id: 'fortnite', executable: exe, available: true }]);
    await fs.rename(exe, `${exe}.moved`); expect((await s.list())[0].available).toBe(false);
    await fs.rename(`${exe}.moved`, exe); await s.clear('fortnite'); expect(await s.list()).toEqual([]);
    expect((await fs.stat(exe)).size).toBe(128);
  });
  it('refuses unsupported titles, remote paths, directories, disguised text and invalid header offsets', async () => {
    const s = createGamePathService(dir); await expect(s.select('gta6', exe)).rejects.toThrow(/supported game/);
    await expect(checkGameExecutable('\\\\server\\game.exe')).rejects.toThrow(/local/);
    await expect(checkGameExecutable(dir)).rejects.toThrow(/executable/);
    await fs.writeFile(exe, 'not a windows binary'.repeat(20)); await expect(s.select('fortnite', exe)).rejects.toThrow(/header/);
    const bytes = Buffer.alloc(128); bytes.writeUInt16LE(0x5a4d); bytes.writeUInt32LE(0xffffffff, 60); await fs.writeFile(exe, bytes);
    await expect(s.select('fortnite', exe)).rejects.toThrow(/PE signature/); expect(await s.list()).toEqual([]);
  });
  it('serializes selections without losing another game and preserves a corrupt store', async () => {
    const s = createGamePathService(dir); await Promise.all([s.select('fortnite', exe), s.select('valorant', exe)]); expect(await s.list()).toHaveLength(2);
    const file = path.join(dir, 'game-paths-v1.json'); await fs.writeFile(file, '{broken');
    await expect(s.select('fortnite', exe)).rejects.toThrow(/preserved/); expect(await fs.readFile(file, 'utf8')).toBe('{broken');
  });
});
