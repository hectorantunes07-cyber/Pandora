import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStartupService, type StartupAdapter, type StartupValue } from '../electron/startup';
describe('bounded launcher startup controls', () => {
  let dir: string, values: Map<string, StartupValue>, writes: string[], adapter: StartupAdapter;
  const original: StartupValue = { kind: 'ExpandString', text: '"%LOCALAPPDATA%\\Launcher O\'Brien.exe" --start' };
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-startup-')); values = new Map([['discord', original]]); writes = []; adapter = { supported: true, read: async a => values.get(a.id) ?? { kind: 'absent' }, write: async (a, v) => { writes.push(a.id); values.set(a.id, v); } }; });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const token = async (s: ReturnType<typeof createStartupService>) => (await s.getControls()).find(i => i.id === 'discord')!.token!;
  it('saves the exact unexpanded command/type before removal and restores after relaunch', async () => {
    const set = adapter.write;
    adapter.write = async (a, v) => { const j = JSON.parse(await fs.readFile(path.join(dir, 'backups/startup-v1.json'), 'utf8')); expect(j.records[0]).toMatchObject({ original, status: 'pending' }); await set(a, v); };
    const s = createStartupService(dir, adapter); const t = await token(s);
    expect(writes).toEqual([]); expect((await s.change(t, false)).success).toBe(true);
    expect(values.get('discord')).toEqual({ kind: 'absent' });
    const reopened = createStartupService(dir, adapter);
    expect((await reopened.getControls())[0]).toMatchObject({ managed: true, status: 'disabled' });
    expect((await reopened.change(await token(reopened), true)).success).toBe(true);
    expect(values.get('discord')).toEqual(original);
  });
  it('refuses changed entries and reused/unknown tokens', async () => {
    const s = createStartupService(dir, adapter); const t = await token(s);
    values.set('discord', { kind: 'String', text: 'external.exe' });
    await expect(s.change(t, false)).rejects.toThrow(/changed after review/);
    await expect(s.change(t, false)).rejects.toThrow(/Refresh/);
    await expect(s.change('HKLM arbitrary', false)).rejects.toThrow(/Refresh/);
    expect(writes).toEqual([]);
  });
  it('preserves external replacement commands during restoration', async () => {
    const s = createStartupService(dir, adapter); await s.change(await token(s), false);
    values.set('discord', { kind: 'String', text: 'replacement.exe' });
    expect((await s.getControls())[0].status).toBe('conflict');
    await expect(s.change(await token(s), true)).rejects.toThrow(/external startup entry/);
    expect(values.get('discord')).toEqual({ kind: 'String', text: 'replacement.exe' }); expect(writes).toHaveLength(1);
  });
  it('does not claim an external deletion between backup and write', async () => {
    const read = adapter.read; let n = 0;
    adapter.read = async a => { if (a.id === 'discord' && ++n === 3) values.set(a.id, { kind: 'absent' }); return read(a); };
    const s = createStartupService(dir, adapter);
    await expect(s.change(await token(s), false)).rejects.toThrow(/before writing/);
    expect(writes).toEqual([]); expect((await s.getControls())[0].managed).toBe(false);
  });
  it('retains originals when a write commits then reports an error, without automatic extra writes', async () => {
    const set = adapter.write; adapter.write = async (a, v) => { await set(a, v); throw new Error('Transport error'); };
    const s = createStartupService(dir, adapter);
    expect((await s.change(await token(s), false)).success).toBe(false);
    expect(writes).toHaveLength(1); adapter.write = set;
    const reopened = createStartupService(dir, adapter);
    expect((await reopened.change(await token(reopened), true)).success).toBe(true);
    expect(values.get('discord')).toEqual(original);
  });
  it('preserves corrupt backups and refuses unsupported or missing entries', async () => {
    const s = createStartupService(dir, adapter);
    const missing = (await s.getControls()).find(i => i.id === 'steam')!;
    await expect(s.change(missing.token!, false)).rejects.toThrow(/No supported startup/);
    await fs.mkdir(path.join(dir, 'backups')); const f = path.join(dir, 'backups/startup-v1.json'); await fs.writeFile(f, '{broken');
    await expect(s.getControls()).rejects.toThrow(/preserved/); expect(writes).toEqual([]);
    expect(await fs.readFile(f, 'utf8')).toBe('{broken'); await fs.unlink(f);
    adapter.supported = false; expect((await s.getControls()).every(i => i.status === 'unavailable')).toBe(true);
  });
  it('recovers an interrupted operation when the original command is already present', async () => {
    const s = createStartupService(dir, adapter); await s.change(await token(s), false);
    values.set('discord', original);
    const reopened = createStartupService(dir, adapter);
    expect((await reopened.getControls())[0].status).toBe('original-present');
    expect((await reopened.change(await token(reopened), true)).success).toBe(true);
    expect(writes).toHaveLength(1); expect((await reopened.getControls())[0].managed).toBe(false);
  });
});
