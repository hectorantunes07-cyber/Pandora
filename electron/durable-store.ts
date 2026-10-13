import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readSmallJson(file: string): Promise<unknown | undefined> {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('The backup is not a bounded regular file.');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw new Error('The backup could not be read safely. It has been preserved; no changes are allowed.'); }
}
export async function writeDurableJson(file: string, value: unknown): Promise<void> {
  const directory = path.dirname(file), temporary = path.join(directory, `.pandora-${randomUUID()}.tmp`);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value, null, 2)); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, file);
    if (process.platform !== 'win32') {
      const handle = await fs.open(directory, 'r');
      try { await handle.sync(); } finally { await handle.close(); }
    }
  } finally { await fs.unlink(temporary).catch(() => undefined); }
}
