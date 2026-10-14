import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readSmallJson, writeDurableJson } from './durable-store';
import { validateCursor, MAX_CURSOR_BYTES } from './cursor-file';
import { createWindowsCursorAdapter, validCursorValue, type CursorAdapter } from './cursor-native';
import type { CursorAsset, CursorInfo, CursorValue, OperationResult } from '../shared/types';
const same = (a: CursorValue, b: CursorValue) => a.kind === b.kind && a.value === b.value;
type Choice = { id: string; name: string; kind: 'cur' | 'ani' };
type Preferences = { version: 1; selected: Choice | null; useInApp: boolean };
type Backup = { version: 1; original: CursorValue; applied: CursorValue; status: 'pending' | 'applied' | 'restored' | 'conflict' | 'failed'; timestamp: string };
export function createCursorService(directory: string, bundled: string, adapter: CursorAdapter = createWindowsCursorAdapter()) {
  const assetDirectory = path.join(directory, 'cursors'), journal = path.join(directory, 'backups', 'cursor-v1.json'), preferences = path.join(directory, 'cursor-preferences-v1.json');
  let queue: Promise<unknown> = Promise.resolve();
  let review: { token: string; current: CursorValue; selected: string; expires: number } | null = null;
  const serial = <T>(fn: () => Promise<T>) => { const work = queue.then(fn, fn); queue = work.catch(() => undefined); return work; };
  const owned = (b: Backup | null) => Boolean(b && ['pending', 'applied', 'conflict'].includes(b.status));
  const assetPath = (c: Choice) => path.join(assetDirectory, `${c.id}.${c.kind}`);
  async function safeDirectory() {
    await fs.mkdir(assetDirectory, { recursive: true, mode: 0o700 });
    for (const dir of [directory, assetDirectory]) { const s = await fs.lstat(dir); if (!s.isDirectory() || s.isSymbolicLink()) throw new Error('Cursor storage must be a regular local directory.'); }
  }
  async function bytes(file: string) {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_CURSOR_BYTES || stat.size < 22 || stat.nlink > 1) throw new Error('Choose a regular cursor file smaller than 2 MB; links are not accepted.');
    const handle = await fs.open(file, 'r');
    try { const opened = await handle.stat(); if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) throw new Error('The cursor file changed during selection.'); const buffer = Buffer.alloc(opened.size); let count = 0; while (count < buffer.length) { const r = await handle.read(buffer, count, buffer.length - count, count); if (!r.bytesRead) throw new Error('The cursor file changed during reading.'); count += r.bytesRead; } return buffer; }
    finally { await handle.close(); }
  }
  async function prefs(): Promise<Preferences> {
    const raw = await readSmallJson(preferences); if (raw === undefined) return { version: 1, selected: null, useInApp: false };
    const p = raw as Preferences, c = p?.selected;
    if (p?.version !== 1 || typeof p.useInApp !== 'boolean' || c !== null && (!c || !/^[a-f0-9]{64}$/.test(c.id) || !['cur', 'ani'].includes(c.kind) || typeof c.name !== 'string' || c.name.length > 255 || /[\x00-\x1f]/.test(c.name))) throw new Error('Invalid cursor preferences. Your saved files are preserved.');
    return p;
  }
  async function backup(): Promise<Backup | null> {
    const raw = await readSmallJson(journal); if (raw === undefined) return null; const b = raw as Backup;
    if (b?.version !== 1 || !validCursorValue(b.original) || !validCursorValue(b.applied) || b.applied.kind !== 'String' || !b.applied.value || path.dirname(b.applied.value) !== assetDirectory || !/^[a-f0-9]{64}\.(cur|ani)$/.test(path.basename(b.applied.value)) || !['pending', 'applied', 'restored', 'conflict', 'failed'].includes(b.status) || typeof b.timestamp !== 'string' || !Number.isFinite(Date.parse(b.timestamp))) throw new Error('Invalid cursor backup. It has been preserved; no cursor changes are allowed.');
    return b;
  }
  async function asset(p: Preferences): Promise<{ public: CursorAsset; data: Buffer; choice: Choice }> {
    if (p.selected) await safeDirectory();
    const data = await bytes(p.selected ? assetPath(p.selected) : bundled), parsed = validateCursor(data, p.selected ? `.${p.selected.kind}` : '.cur');
    if (p.selected && p.selected.id !== parsed.hash) throw new Error('The saved cursor file changed. Restore your original pointer before selecting another file.');
    const choice: Choice = p.selected ?? { id: parsed.hash, kind: parsed.kind, name: 'Sonnier’s cursor' };
    return { data, choice, public: { ...choice, width: parsed.width, height: parsed.height, x: parsed.x, y: parsed.y, preview: `data:image/png;base64,${parsed.png.toString('base64')}`, cssCursor: `data:image/x-icon;base64,${parsed.frame.toString('base64')}` } };
  }
  async function persist(data: Buffer, choice: Choice) {
    await safeDirectory(); const file = assetPath(choice);
    try { const h = await fs.open(file, 'wx', 0o600); try { await h.writeFile(data); await h.sync(); } finally { await h.close(); } }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    if (validateCursor(await bytes(file), `.${choice.kind}`).hash !== choice.id) throw new Error('Stored cursor verification failed. No Windows setting was changed.');
    return file;
  }
  async function info(): Promise<CursorInfo> {
    review = null; const p = await prefs(), b = await backup();
    let selected: CursorAsset | null = null, reason: string | undefined;
    try { selected = (await asset(p)).public; } catch (e) { reason = e instanceof Error ? e.message : 'Cursor preview unavailable.'; }
    let current: CursorValue | null = null;
    if (adapter.supported) try { current = await adapter.read(); if (!validCursorValue(current)) throw new Error(); } catch { current = null; reason = 'Windows cursor settings are unavailable. Your backup is retained.'; }
    const token = current ? randomUUID() : null;
    if (token && current) review = { token, current: { ...current }, selected: selected?.id ?? '', expires: Date.now() + 300_000 };
    return { supported: adapter.supported, current, original: b?.original ?? null, currentPreview: adapter.supported ? await adapter.preview() : null, selected, useInApp: p.useInApp, managed: owned(b), conflict: Boolean(current && owned(b) && !same(current, b!.original) && !same(current, b!.applied)), token, reason };
  }
  async function change(token: unknown, restore: unknown): Promise<OperationResult> {
    const r = review; review = null;
    if (!adapter.supported || !r || token !== r.token || typeof restore !== 'boolean' || Date.now() > r.expires) throw new Error('Refresh and review the cursor again.');
    const current = await adapter.read(); if (!validCursorValue(current) || !same(current, r.current)) throw new Error('The normal pointer changed after review. Nothing was overwritten.');
    let b = await backup();
    if (restore) {
      if (!owned(b)) throw new Error('No managed cursor is available to restore.');
      if (same(current, b!.original)) { b!.status = 'restored'; await writeDurableJson(journal, b); return { id: 'cursor', success: true, message: 'Saved original pointer already present; no Windows write needed.' }; }
      if (!same(current, b!.applied)) throw new Error('An external cursor change is preserved. Your original backup remains available.');
    } else {
      if (owned(b)) throw new Error('Restore the managed cursor before applying another.');
      const p = await prefs(), a = await asset(p); if (a.public.id !== r.selected) throw new Error('The selected cursor changed. Review again.');
      const file = await persist(a.data, a.choice); const desired: CursorValue = { kind: 'String', value: file };
      if (same(current, desired)) return { id: 'cursor', success: true, message: 'This cursor is already configured. No ownership was claimed.' };
      b = { version: 1, original: current, applied: desired, status: 'pending', timestamp: new Date().toISOString() };
    }
    b!.status = 'pending'; await writeDurableJson(journal, b);
    try {
      const desired = restore ? b!.original : b!.applied;
      if (!same(await adapter.read(), current)) throw new Error('Cursor changed before write.');
      await adapter.write(current, desired, restore);
      if (!same(await adapter.read(), desired)) throw new Error('Cursor read-back failed.');
      b!.status = restore ? 'restored' : 'applied'; await writeDurableJson(journal, b);
      return { id: 'cursor', success: true, message: restore ? 'Saved original normal pointer restored and verified. Other pointer roles were preserved.' : 'Normal pointer applied and Windows configuration verified. The cursor file is stored persistently for future sign-ins. Other pointer roles were preserved.' };
    } catch {
      try { const observed = await adapter.read(); b!.status = same(observed, b!.original) ? restore ? 'restored' : 'failed' : same(observed, b!.applied) ? 'applied' : 'conflict'; await writeDurableJson(journal, b); } catch { /* Retain durable pending backup. */ }
      return { id: 'cursor', success: false, message: 'Windows could not fully confirm the cursor change or reload. Your original backup is retained. Refresh and restore if needed; no extra change was attempted.' };
    }
  }
  return {
    getInfo: () => serial(info),
    change: (token: unknown, restore: unknown) => serial(() => change(token, restore)),
    select: (file: string, bundledSelection = false) => serial(async () => {
      // The only caller providing a path is the native file picker or bundled asset.
      if (process.platform === 'win32' && !/^[A-Za-z]:\\/.test(file)) throw new Error('Choose a cursor on a local drive. Network paths are unsupported.');
      const p = await prefs(), data = await bytes(file), parsed = validateCursor(data, path.extname(file));
      const choice: Choice = { id: parsed.hash, kind: parsed.kind, name: bundledSelection ? 'Sonnier’s cursor' : path.basename(file).replace(/[\x00-\x1f]/g, '').slice(0, 255) };
      await persist(data, choice); await writeDurableJson(preferences, { ...p, selected: choice }); return info();
    }),
    setAppCursor: (enabled: unknown) => serial(async () => {
      if (typeof enabled !== 'boolean') throw new Error('Invalid interface cursor preference.');
      const p = await prefs(); if (enabled) { const a = await asset(p); await persist(a.data, a.choice); p.selected = a.choice; }
      await writeDurableJson(preferences, { ...p, useInApp: enabled }); return info();
    }),
  };
}
