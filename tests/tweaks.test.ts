import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTweakService, type RegistryAdapter, type RegistryValue } from '../electron/tweaks';
import { TWEAK_CATALOG, type RegistryTweak } from '../electron/tweak-catalog';

class MemoryRegistry implements RegistryAdapter {
  supported = true;
  values = new Map<string, RegistryValue>();
  writes: { id: string; value: RegistryValue }[] = [];
  onRead?: (tweak: RegistryTweak) => void;
  onWrite?: (tweak: RegistryTweak, value: RegistryValue) => void;
  async read(tweak: RegistryTweak): Promise<RegistryValue> {
    this.onRead?.(tweak);
    return structuredClone(this.values.get(tweak.id) ?? { kind: 'absent' });
  }
  async write(tweak: RegistryTweak, value: RegistryValue): Promise<void> {
    this.writes.push({ id: tweak.id, value: structuredClone(value) });
    this.onWrite?.(tweak, value);
    this.values.set(tweak.id, structuredClone(value));
  }
}

describe('audited per-user preferences', () => {
  let directory: string;
  let adapter: MemoryRegistry;
  beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-tweaks-test-')); adapter = new MemoryRegistry(); });
  afterEach(async () => { vi.restoreAllMocks(); await fs.rm(directory, { recursive: true, force: true }); });

  for (const tweak of TWEAK_CATALOG) {
    it(`${tweak.id}: preserves an absent value through apply, idempotent reapply and revert`, async () => {
      const service = createTweakService(directory, { adapter });
      expect((await service.getTweaks()).find(t => t.id === tweak.id)?.state).toBe('available');
      expect((await service.applyTweaks([tweak.id]))[0].success).toBe(true);
      expect((await service.getTweaks()).find(t => t.id === tweak.id)).toMatchObject({ state: 'applied', managed: true, currentValue: tweak.desiredValue });
      expect((await service.applyTweaks([tweak.id]))[0].success).toBe(true);
      expect(adapter.writes).toHaveLength(1);
      expect(await service.getHistory()).toHaveLength(1);
      expect((await service.revertTweaks([tweak.id]))[0].success).toBe(true);
      expect(await adapter.read(tweak)).toEqual({ kind: 'absent' });
      expect((await service.getHistory())[0]).toMatchObject({ originalValue: null, status: 'reverted' });
      expect((await service.revertTweaks([tweak.id]))[0].success).toBe(true);
      expect(adapter.writes).toHaveLength(2);
    });
    it(`${tweak.id}: restores the exact original DWORD after relaunch`, async () => {
      adapter.values.set(tweak.id, { kind: 'dword', value: 0xffffffff });
      const service = createTweakService(directory, { adapter });
      await service.applyTweaks([tweak.id]);
      const reopened = createTweakService(directory, { adapter });
      expect((await reopened.getHistory())[0].originalValue).toBe(0xffffffff);
      expect((await reopened.revertTweaks([tweak.id]))[0].success).toBe(true);
      expect(await adapter.read(tweak)).toEqual({ kind: 'dword', value: 0xffffffff });
    });
  }

  it('does not claim existing user preferences as PANDORA changes', async () => {
    const tweak = TWEAK_CATALOG[0];
    adapter.values.set(tweak.id, { kind: 'dword', value: tweak.desiredValue });
    const service = createTweakService(directory, { adapter });
    expect((await service.getTweaks())[0]).toMatchObject({ state: 'already-set', managed: false });
    await service.applyTweaks([tweak.id]);
    await service.revertTweaks([tweak.id]);
    expect(adapter.writes).toHaveLength(0);
    expect(await service.getHistory()).toEqual([]);
  });

  it('snapshots durably before the first registry write', async () => {
    const tweak = TWEAK_CATALOG[0];
    const service = createTweakService(directory, { adapter });
    const realWrite = adapter.write.bind(adapter);
    adapter.write = async (target, value) => {
      const snapshot = JSON.parse(await fs.readFile(path.join(directory, 'backups/tweaks-v1.json'), 'utf8'));
      expect(snapshot.records[0]).toMatchObject({ original: { kind: 'absent' }, entry: { status: 'pending', tweakId: target.id } });
      await realWrite(target, value);
    };
    expect((await service.applyTweaks([tweak.id]))[0].success).toBe(true);
  });

  it('refuses external edits during revert and retains the original backup', async () => {
    const tweak = TWEAK_CATALOG[0], service = createTweakService(directory, { adapter });
    adapter.values.set(tweak.id, { kind: 'dword', value: 17 });
    await service.applyTweaks([tweak.id]);
    adapter.values.set(tweak.id, { kind: 'dword', value: 42 });
    expect((await service.getTweaks())[0].state).toBe('conflict');
    expect((await service.revertTweaks([tweak.id]))[0].success).toBe(false);
    expect((await service.applyTweaks([tweak.id]))[0].success).toBe(false);
    expect(adapter.writes).toHaveLength(1);
    expect(await adapter.read(tweak)).toEqual({ kind: 'dword', value: 42 });
    expect((await service.getHistory())[0]).toMatchObject({ status: 'conflict', originalValue: 17 });
  });

  it('does not overwrite or claim an external change occurring after backup but before write', async () => {
    const tweak = TWEAK_CATALOG[0];
    let reads = 0;
    adapter.onRead = target => { if (target.id === tweak.id && ++reads === 2) adapter.values.set(tweak.id, { kind: 'dword', value: tweak.desiredValue }); };
    const service = createTweakService(directory, { adapter });
    expect((await service.applyTweaks([tweak.id]))[0].success).toBe(false);
    await service.revertTweaks([tweak.id]);
    expect(adapter.writes).toHaveLength(0);
    expect((await service.getTweaks())[0]).toMatchObject({ state: 'already-set', managed: false });
  });

  it('records per-item failures and continues a batch without corrupting other snapshots', async () => {
    const [first, second] = TWEAK_CATALOG;
    adapter.onWrite = tweak => { if (tweak.id === first.id) throw new Error('Access denied'); };
    const service = createTweakService(directory, { adapter });
    const results = await service.applyTweaks([first.id, second.id]);
    expect(results.map(result => result.success)).toEqual([false, true]);
    expect((await service.getHistory()).map(entry => entry.status).sort()).toEqual(['applied', 'failed']);
    expect(await adapter.read(first)).toEqual({ kind: 'absent' });
  });

  it('rolls back a completed write when its adapter subsequently reports failure', async () => {
    const tweak = TWEAK_CATALOG[0];
    adapter.onWrite = (target, value) => {
      if (value.kind === 'dword') { adapter.values.set(target.id, value); throw new Error('Write transport failed after commit'); }
    };
    const service = createTweakService(directory, { adapter });
    expect((await service.applyTweaks([tweak.id]))[0].success).toBe(false);
    expect(await adapter.read(tweak)).toEqual({ kind: 'absent' });
    expect((await service.getHistory())[0].status).toBe('failed');
    expect(adapter.writes).toHaveLength(2);
  });

  it('does not roll back an unexpected value after verification fails', async () => {
    const tweak = TWEAK_CATALOG[0];
    let reads = 0;
    adapter.onRead = target => { if (target.id === tweak.id && ++reads === 3) adapter.values.set(tweak.id, { kind: 'dword', value: 999 }); };
    const service = createTweakService(directory, { adapter });
    expect((await service.applyTweaks([tweak.id]))[0].success).toBe(false);
    expect(adapter.writes).toHaveLength(1);
    expect((await service.getHistory())[0].status).toBe('conflict');
    expect(await adapter.read(tweak)).toEqual({ kind: 'dword', value: 999 });
  });

  it('distinguishes read access failure from an absent value', async () => {
    adapter.onRead = () => { throw new Error('Read access denied'); };
    const service = createTweakService(directory, { adapter });
    expect((await service.getTweaks()).every(tweak => tweak.state === 'unknown')).toBe(true);
    expect((await service.applyTweaks([TWEAK_CATALOG[0].id]))[0].success).toBe(false);
    expect(adapter.writes).toHaveLength(0);
    expect(await service.getHistory()).toHaveLength(0);
  });

  it('does not replace a non-DWORD preference', async () => {
    const tweak = TWEAK_CATALOG[0];
    adapter.values.set(tweak.id, { kind: 'unsupported', type: 'String' });
    const service = createTweakService(directory, { adapter });
    expect((await service.getTweaks())[0].state).toBe('unsupported');
    expect((await service.applyTweaks([tweak.id]))[0].success).toBe(false);
    expect(adapter.writes).toHaveLength(0);
  });

  it('serializes concurrent mutations and preserves a single original snapshot', async () => {
    const service = createTweakService(directory, { adapter }), id = TWEAK_CATALOG[0].id;
    const results = await Promise.all([service.applyTweaks([id]), service.applyTweaks([id]), service.applyTweaks([id])]);
    expect(results.every(result => result[0].success)).toBe(true);
    expect(adapter.writes).toHaveLength(1);
    expect(await service.getHistory()).toHaveLength(1);
  });

  it('fails closed on corrupted history and does not overwrite it', async () => {
    const file = path.join(directory, 'backups/tweaks-v1.json');
    await fs.mkdir(path.dirname(file)); await fs.writeFile(file, '{broken json');
    const service = createTweakService(directory, { adapter });
    await expect(service.applyTweaks([TWEAK_CATALOG[0].id])).rejects.toThrow('Cannot safely load backups');
    expect(adapter.writes).toHaveLength(0);
    expect(await fs.readFile(file, 'utf8')).toBe('{broken json');
  });

  it('does not write any preferences if the durable snapshot cannot be saved', async () => {
    const rename = fs.rename.bind(fs);
    let fail = true;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, target) => {
      if (fail) { fail = false; throw new Error('Disk full while saving snapshot'); }
      await rename(source, target);
    });
    const service = createTweakService(directory, { adapter });
    const results = await service.applyTweaks([TWEAK_CATALOG[0].id, TWEAK_CATALOG[1].id]);
    expect(results.map(result => result.success)).toEqual([false, false]);
    expect(adapter.writes).toHaveLength(0);
    expect(results[1].message).toContain('Not attempted');
    expect((await service.applyTweaks([TWEAK_CATALOG[0].id]))[0].success).toBe(true);
  });

  it('rolls back and stops the rest of the batch when saving a verified commit fails', async () => {
    const rename = fs.rename.bind(fs);
    let calls = 0;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, target) => {
      if (++calls === 2) throw new Error('Disk full while saving verified state');
      await rename(source, target);
    });
    const service = createTweakService(directory, { adapter });
    const [first, second] = TWEAK_CATALOG;
    const results = await service.applyTweaks([first.id, second.id]);
    expect(results.map(result => result.success)).toEqual([false, false]);
    expect(adapter.writes.map(write => write.id)).toEqual([first.id, first.id]);
    expect(await adapter.read(first)).toEqual({ kind: 'absent' });
    expect((await service.getHistory())[0].status).toBe('failed');
    expect((await service.applyTweaks([second.id]))[0].success).toBe(true);
  });

  it('refuses restoration without a durable pending record and can retry after disk recovery', async () => {
    const service = createTweakService(directory, { adapter }), tweak = TWEAK_CATALOG[0];
    await service.applyTweaks([tweak.id]);
    const rename = fs.rename.bind(fs);
    let fail = true;
    vi.spyOn(fs, 'rename').mockImplementation(async (source, target) => {
      if (fail) { fail = false; throw new Error('Cannot save pending restoration'); }
      await rename(source, target);
    });
    expect((await service.revertTweaks([tweak.id]))[0].success).toBe(false);
    expect(adapter.writes).toHaveLength(1);
    expect((await service.getHistory())[0].status).toBe('applied');
    expect((await service.revertTweaks([tweak.id]))[0].success).toBe(true);
    expect(await adapter.read(tweak)).toEqual({ kind: 'absent' });
  });

  it('rejects unknown and malformed input without executing anything', async () => {
    const service = createTweakService(directory, { adapter });
    expect((await service.applyTweaks(['game-mode; Remove-Item C:\\']))[0].success).toBe(false);
    await expect(service.applyTweaks(Array(500).fill('game-mode'))).rejects.toThrow('bounded');
    await expect(service.applyTweaks([null] as unknown as string[])).rejects.toThrow('bounded');
    expect(adapter.writes).toHaveLength(0);
  });

  for (const current of ['original', 'applied', 'external'] as const) {
    it(`recovers an interrupted apply with ${current} state without making a new write`, async () => {
      const tweak = TWEAK_CATALOG[0];
      const service = createTweakService(directory, { adapter });
      await service.applyTweaks([tweak.id]);
      const file = path.join(directory, 'backups/tweaks-v1.json');
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      saved.records[0].entry.status = 'pending';
      await fs.writeFile(file, JSON.stringify(saved));
      adapter.values.set(tweak.id, current === 'original' ? { kind: 'absent' } : { kind: 'dword', value: current === 'applied' ? tweak.desiredValue : 33 });
      const reopened = createTweakService(directory, { adapter });
      expect((await reopened.getHistory())[0].status).toBe(current === 'original' ? 'failed' : current === 'applied' ? 'applied' : 'conflict');
      expect(adapter.writes).toHaveLength(1);
    });
  }

  it('recognizes a completed interrupted revert', async () => {
    const tweak = TWEAK_CATALOG[0];
    await createTweakService(directory, { adapter }).applyTweaks([tweak.id]);
    const file = path.join(directory, 'backups/tweaks-v1.json');
    const saved = JSON.parse(await fs.readFile(file, 'utf8'));
    saved.records[0].entry.status = 'pending'; saved.records[0].intent = 'revert';
    await fs.writeFile(file, JSON.stringify(saved));
    adapter.values.set(tweak.id, { kind: 'absent' });
    const reopened = createTweakService(directory, { adapter });
    expect((await reopened.getHistory())[0].status).toBe('reverted');
    expect(adapter.writes).toHaveLength(1);
  });

  it('keeps the managed backup available when revert fails', async () => {
    const tweak = TWEAK_CATALOG[0], service = createTweakService(directory, { adapter });
    await service.applyTweaks([tweak.id]);
    adapter.onWrite = (_target, value) => { if (value.kind === 'absent') throw new Error('Revert access denied'); };
    expect((await service.revertTweaks([tweak.id]))[0].success).toBe(false);
    expect((await service.getHistory())[0].status).toBe('applied');
    adapter.onWrite = undefined;
    expect((await service.revertTweaks([tweak.id]))[0].success).toBe(true);
  });

  it('reports native operations as unsupported on a non-Windows platform', async () => {
    adapter.supported = false;
    const service = createTweakService(directory, { adapter });
    expect((await service.getTweaks()).every(tweak => tweak.state === 'unsupported')).toBe(true);
    expect((await service.applyTweaks([TWEAK_CATALOG[0].id]))[0].success).toBe(false);
    expect(adapter.writes).toHaveLength(0);
  });
});
