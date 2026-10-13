import fs from 'node:fs/promises';
import path from 'node:path';
import { GAME_GUIDES } from '../shared/game-guides';
import type { ManualGamePath } from '../shared/types';
import { readSmallJson, writeDurableJson } from './durable-store';
export function validateGameId(id: unknown): string {
  if (typeof id !== 'string' || !GAME_GUIDES.some(g => g.id === id)) throw new Error('Select a supported game first.');
  return id;
}
export async function checkGameExecutable(file: string): Promise<void> {
  if (!path.isAbsolute(file) || file.length > 4096 || file.includes('\0') || file.startsWith('\\\\') || path.extname(file).toLowerCase() !== '.exe') throw new Error('Choose a local Windows executable (.exe).');
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 68) throw new Error('The selected file is not a regular Windows executable.');
  const handle = await fs.open(file, 'r');
  try {
    const header = Buffer.alloc(64), signature = Buffer.alloc(4);
    if ((await handle.read(header, 0, 64, 0)).bytesRead !== 64 || header.readUInt16LE(0) !== 0x5a4d) throw new Error('The selected file has no Windows executable header.');
    const offset = header.readUInt32LE(60);
    if (offset < 64 || offset > stat.size - 4 || (await handle.read(signature, 0, 4, offset)).bytesRead !== 4 || signature.readUInt32LE(0) !== 0x00004550) throw new Error('The selected file has no valid PE signature.');
  } finally { await handle.close(); }
}
export function createGamePathService(directory: string) {
  const file = path.join(directory, 'game-paths-v1.json');
  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(fn: () => Promise<T>) => { const r = queue.then(fn, fn); queue = r.catch(() => undefined); return r; };
  async function load(): Promise<{ id: string; executable: string }[]> {
    const raw = await readSmallJson(file);
    if (raw === undefined) return [];
    const data = raw as { version: number; games: { id: string; executable: string }[] };
    if (data?.version !== 1 || !Array.isArray(data.games) || data.games.length > GAME_GUIDES.length || new Set(data.games.map(g => g?.id)).size !== data.games.length || data.games.some(g => !g || !GAME_GUIDES.some(i => i.id === g.id) || typeof g.executable !== 'string' || g.executable.length > 4096 || g.executable.includes('\0') || !path.isAbsolute(g.executable) || g.executable.startsWith('\\\\') || path.extname(g.executable).toLowerCase() !== '.exe')) throw new Error('Saved game locations are invalid and have been preserved.');
    return data.games;
  }
  async function inspect(entry: { id: string; executable: string }): Promise<ManualGamePath> {
    try { await checkGameExecutable(entry.executable); return { ...entry, available: true }; }
    catch { return { ...entry, available: false }; }
  }
  return {
    list: () => serialized(async () => Promise.all((await load()).map(inspect))),
    // Called only with the main-process native picker result, never a renderer path.
    select: (id: unknown, executable: string) => serialized(async () => {
      const key = validateGameId(id); await checkGameExecutable(executable);
      const games = (await load()).filter(g => g.id !== key); games.push({ id: key, executable });
      await writeDurableJson(file, { version: 1, games });
      return { id: key, executable, available: true } satisfies ManualGamePath;
    }),
    clear: (id: unknown) => serialized(async () => {
      const key = validateGameId(id); const games = (await load()).filter(g => g.id !== key);
      await writeDurableJson(file, { version: 1, games });
    }),
  };
}
