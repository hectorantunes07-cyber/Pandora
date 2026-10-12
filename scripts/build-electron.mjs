import { build } from 'esbuild';
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'electron');
const output = join(root, 'dist-electron');
await mkdir(output, { recursive: true });
await build({
  entryPoints: { main: join(source, 'main.ts'), preload: join(source, 'preload.ts') },
  outdir: output,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
});

async function copyNative(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryRelative = join(relative, entry.name);
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await copyNative(path, entryRelative);
    else if (['.ps1', '.cs'].includes(extname(entry.name))) {
      const target = join(output, entryRelative);
      await mkdir(dirname(target), { recursive: true });
      await cp(path, target);
    }
  }
}
await copyNative(source);
