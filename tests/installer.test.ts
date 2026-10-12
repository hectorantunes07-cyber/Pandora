import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const generate = createRequire(import.meta.url)('../build/after-pack.cjs');
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(file => rm(file, { recursive: true, force: true }))); });
describe('installer ownership manifest', () => {
  it('owns only packaged files, escapes NSIS variables and never removes folders recursively', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pandora-installer-')); temporary.push(root);
    const app = path.join(root, 'app'); const out = path.join(root, 'out');
    await mkdir(path.join(app, 'resources'), { recursive: true });
    await writeFile(path.join(app, 'PANDORA.exe'), 'fixture');
    await writeFile(path.join(app, 'resources', '$owned.txt'), 'fixture');
    await generate({ electronPlatformName: 'win32', appOutDir: app, outDir: out });
    const script = await readFile(path.join(out, 'pandora-owned-files.nsh'), 'utf8');
    expect(script).toContain('Delete "$INSTDIR\\PANDORA.exe"');
    expect(script).toContain('Delete "$INSTDIR\\resources\\$$owned.txt"');
    expect(script).toContain('IfFileExists "$INSTDIR\\PANDORA.exe" uninstallFailed');
    expect(script).not.toMatch(/RMDir\s+\/r/i);
    expect(script).not.toContain('$APPDATA');
  });
  it('rejects packaged directory junctions or symlinks', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pandora-installer-')); temporary.push(root);
    const app = path.join(root, 'app'); const outside = path.join(root, 'outside');
    await mkdir(app); await mkdir(outside);
    await symlink(outside, path.join(app, 'linked'), 'junction');
    await expect(generate({ electronPlatformName: 'win32', appOutDir: app, outDir: path.join(root, 'out') })).rejects.toThrow('symlinks');
  });
});
