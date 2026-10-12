import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createNativeCleanerAdapter, type Candidate, type FileOutcome } from '../electron/cleaner-native';

// These tests execute the real Win32 handle guard on a Windows runner. They only
// pass disposable fixture candidates to deletion; existing machine files are
// never cleaned. Linux CI explicitly skips them rather than simulating Win32.
describe.skipIf(process.platform !== 'win32')('native Windows cleaner safety', () => {
  const adapter = createNativeCleanerAdapter();
  let fixture = '', outside = '';
  const old = new Date(Date.now() - 9 * 86400_000);
  async function create(name: string, contents = 'disposable test data') {
    const file = path.join(fixture, name); await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents); await fs.utimes(file, old, old); return file;
  }
  async function scan() { return (await adapter.scan('safe')).groups.flatMap(group => group.files).filter(file => file.path.toLowerCase().startsWith(fixture.toLowerCase() + path.sep)); }
  async function remove(candidate: Candidate) { const outcomes: FileOutcome[] = []; await adapter.remove('safe', [candidate], outcome => outcomes.push(outcome)); return outcomes[0]; }
  beforeAll(async () => {
    if (!process.env.LOCALAPPDATA) throw new Error('Windows LocalAppData is required for native tests.');
    fixture = path.join(process.env.LOCALAPPDATA, 'Temp', `Pandora-cleaner-test-${randomUUID()}`);
    outside = path.join(process.env.LOCALAPPDATA, `Pandora-cleaner-outside-${randomUUID()}`);
    await fs.mkdir(fixture, { recursive: true }); await fs.mkdir(outside, { recursive: true });
  });
  afterAll(async () => { if (fixture) await fs.rm(fixture, { recursive: true, force: true }); if (outside) await fs.rm(outside, { recursive: true, force: true }); });

  it('cleans stale temp bytes while preserving recent files, documents, and linked targets', async () => {
    const eligible = await create('eligible.tmp', '12345');
    const document = await create('personal.docx');
    const recent = await create('recent.tmp'); await fs.utimes(recent, new Date(), new Date());
    const outsideFile = path.join(outside, 'personal.tmp'); await fs.writeFile(outsideFile, 'personal'); await fs.utimes(outsideFile, old, old);
    await fs.link(outsideFile, path.join(fixture, 'hardlink.tmp'));
    await fs.symlink(outside, path.join(fixture, 'junction'), 'junction');
    const candidates = await scan();
    expect(candidates.map(file => file.path.toLowerCase())).toContain(eligible.toLowerCase());
    expect(candidates.map(file => file.path.toLowerCase())).not.toContain(document.toLowerCase());
    expect(candidates.map(file => file.path.toLowerCase())).not.toContain(recent.toLowerCase());
    expect(candidates.some(file => file.path.includes('hardlink.tmp') || file.path.includes('junction'))).toBe(false);
    const outcome = await remove(candidates.find(file => file.path.toLowerCase() === eligible.toLowerCase())!);
    expect(outcome).toMatchObject({ deleted: true, bytes: 5 });
    await expect(fs.stat(eligible)).rejects.toThrow();
    expect(await fs.readFile(outsideFile, 'utf8')).toBe('personal');
    expect(await fs.readFile(document, 'utf8')).toBe('disposable test data');
  }, 120_000);

  it('refuses changed, missing, or replaced files after the scan', async () => {
    const changed = await create('changed.tmp'); const missing = await create('missing.tmp'); const replaced = await create('replaced.tmp');
    const candidates = await scan();
    await fs.writeFile(changed, 'new data'); await fs.unlink(missing); await fs.unlink(replaced); await fs.writeFile(replaced, 'personal replacement'); await fs.utimes(replaced, old, old);
    for (const target of [changed, missing, replaced]) {
      const candidate = candidates.find(file => file.path.toLowerCase() === target.toLowerCase())!;
      expect(candidate).toBeTruthy(); expect((await remove(candidate)).deleted).toBe(false);
    }
    expect(await fs.readFile(replaced, 'utf8')).toBe('personal replacement');
  }, 120_000);

  it('refuses an ancestor swapped for a junction and out-of-root path injection', async () => {
    const target = await create('swapped/child.tmp'); const candidates = await scan();
    const candidate = candidates.find(file => file.path.toLowerCase() === target.toLowerCase())!;
    await fs.rename(path.dirname(target), path.join(fixture, 'original'));
    await fs.writeFile(path.join(outside, 'child.tmp'), 'keep me'); await fs.symlink(outside, path.dirname(target), 'junction');
    expect((await remove(candidate)).deleted).toBe(false);
    expect((await remove({ ...candidate, path: path.join(outside, 'child.tmp') })).deleted).toBe(false);
    expect(await fs.readFile(path.join(outside, 'child.tmp'), 'utf8')).toBe('keep me');
  }, 120_000);
});
