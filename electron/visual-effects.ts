import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readSmallJson, writeDurableJson } from './durable-store';
import { VISUAL_EFFECTS, type VisualEffectId, type VisualEffectState } from '../shared/visual-effects';
import type { OperationResult } from '../shared/types';

export const VISUAL_EFFECTS_NATIVE_SOURCE = `
using System;
using System.Runtime.InteropServices;
public static class PandoraVisualEffects {
 [DllImport("user32.dll", EntryPoint="SystemParametersInfoW", ExactSpelling=true, SetLastError=true)]
 [return: MarshalAs(UnmanagedType.Bool)]
 static extern bool Spi(uint action, uint parameter, IntPtr value, uint flags);
 static readonly uint[] Gets = new uint[]{${VISUAL_EFFECTS.map(e => e.get).join(',')}};
 static readonly uint[] Sets = new uint[]{${VISUAL_EFFECTS.map(e => e.set).join(',')}};
 public static bool Read(int index) {
  if(index<0 || index>=Gets.Length) throw new ArgumentException();
  IntPtr p=Marshal.AllocHGlobal(4);
  try { Marshal.WriteInt32(p,0); if(!Spi(Gets[index],0,p,0)) throw new System.ComponentModel.Win32Exception(); return Marshal.ReadInt32(p)!=0; }
  finally { Marshal.FreeHGlobal(p); }
 }
 public static void Write(int index,bool enabled) {
  if(index<0 || index>=Sets.Length) throw new ArgumentException();
  if(!Spi(Sets[index],0,new IntPtr(enabled?1:0),3)) throw new System.ComponentModel.Win32Exception();
 }
}`;
type Values = Record<VisualEffectId, boolean | null>;
export interface VisualEffectsAdapter { supported: boolean; read(): Promise<Values>; write(id: VisualEffectId, enabled: boolean): Promise<void>; }
const definition = (id: unknown) => VISUAL_EFFECTS.find(e => e.id === id);
export function createWindowsVisualEffectsAdapter(): VisualEffectsAdapter {
  const supported = process.platform === 'win32';
  async function run(id?: VisualEffectId, enabled?: boolean): Promise<Values> {
    if (!supported) throw new Error('Visual preferences require Windows.');
    const index = id === undefined ? -1 : VISUAL_EFFECTS.findIndex(e => e.id === id);
    if (id !== undefined && (index < 0 || typeof enabled !== 'boolean')) throw new Error('Invalid visual preference.');
    const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${VISUAL_EFFECTS_NATIVE_SOURCE}\n'@\n${index < 0 ? '' : `[PandoraVisualEffects]::Write(${index},$${enabled});`} $out=@{}; ${VISUAL_EFFECTS.map((e, i) => `try {$out['${e.id}']=[PandoraVisualEffects]::Read(${i})} catch {$out['${e.id}']=$null}`).join('; ')}; ConvertTo-Json -InputObject $out -Compress`;
    try {
      const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const { stdout } = await promisify(execFile)(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15_000, maxBuffer: 16_000 });
      const result = JSON.parse(stdout.replace(/^\uFEFF/, '').trim()) as Values;
      if (!result || VISUAL_EFFECTS.some(e => result[e.id] !== null && typeof result[e.id] !== 'boolean')) throw new Error('Invalid response');
      return result;
    } catch { throw new Error('Windows visual preferences are unavailable or the operation timed out.'); }
  }
  return { supported, read: () => run(), write: async (id, enabled) => { await run(id, enabled); } };
}
interface Backup { id: VisualEffectId; original: true; applied: false; status: 'pending' | 'applied' | 'restored' | 'failed'; timestamp: string; }
interface Journal { version: 1; records: Backup[]; }
const owned = (r?: Backup) => Boolean(r && ['pending', 'applied'].includes(r.status));
export function createVisualEffectsService(directory: string, adapter = createWindowsVisualEffectsAdapter()) {
  const file = path.join(directory, 'backups', 'visual-effects-v1.json');
  const reviews = new Map<string, { id: VisualEffectId; current: boolean; expires: number }>();
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>) => { const r = queue.then(fn, fn); queue = r.catch(() => undefined); return r; };
  async function load(): Promise<Journal> {
    const raw = await readSmallJson(file); if (raw === undefined) return { version: 1, records: [] };
    const j = raw as Journal;
    if (j?.version !== 1 || !Array.isArray(j.records) || j.records.length > VISUAL_EFFECTS.length || new Set(j.records.map(r => r?.id)).size !== j.records.length || j.records.some(r => !r || !definition(r.id) || r.original !== true || r.applied !== false || !['pending', 'applied', 'restored', 'failed'].includes(r.status) || typeof r.timestamp !== 'string' || !Number.isFinite(Date.parse(r.timestamp)))) throw new Error('Invalid visual preference backup. It has been preserved; no changes are allowed.');
    return j;
  }
  async function getStates(): Promise<VisualEffectState[]> {
    const journal = await load(); reviews.clear();
    let values: Partial<Values> = {};
    if (adapter.supported) try { values = await adapter.read(); } catch { /* retain backups and expose unavailable states */ }
    return VISUAL_EFFECTS.map(e => {
      const current = typeof values[e.id] === 'boolean' ? values[e.id]! : null, backup = journal.records.find(r => r.id === e.id);
      const token = current === null || !adapter.supported ? null : randomUUID();
      if (token) reviews.set(token, { id: e.id, current: current!, expires: Date.now() + 300_000 });
      return { id: e.id, current, original: backup?.original ?? null, managed: owned(backup), token, ...(current === null ? { reason: 'This Windows preference is unavailable. Any saved original is retained.' } : {}) };
    });
  }
  async function change(token: unknown, restore: unknown): Promise<OperationResult> {
    const review = typeof token === 'string' ? reviews.get(token) : undefined;
    if (typeof token === 'string') reviews.delete(token);
    if (!adapter.supported || !review || review.expires < Date.now() || typeof restore !== 'boolean') throw new Error('Refresh and review visual preferences again.');
    const { id } = review, current = (await adapter.read())[id], journal = await load();
    if (typeof current !== 'boolean' || current !== review.current) throw new Error('Visual preference changed after review. Nothing was overwritten.');
    let record = journal.records.find(r => r.id === id);
    if (restore) {
      if (!owned(record)) throw new Error('There is no managed visual preference to restore.');
      if (current === record!.original) { record!.status = 'restored'; await writeDurableJson(file, journal); return { id, success: true, message: 'Original visual preference already present; verified without writing.' }; }
    } else {
      if (owned(record)) throw new Error('Restore the previous visual preference before applying again.');
      if (!current) return { id, success: true, message: 'This effect is already off. No ownership was claimed.' };
      const next: Backup = { id, original: true, applied: false, status: 'pending', timestamp: new Date().toISOString() };
      if (record) Object.assign(record, next); else { record = next; journal.records.push(record); }
    }
    record!.status = 'pending'; await writeDurableJson(file, journal);
    if ((await adapter.read())[id] !== current) { if (!restore) record!.status = 'failed'; await writeDurableJson(file, journal); throw new Error('Visual preference changed before writing. Nothing was overwritten.'); }
    try {
      const desired = restore ? record!.original : record!.applied;
      await adapter.write(id, desired);
      if ((await adapter.read())[id] !== desired) throw new Error('Read-back mismatch');
      record!.status = restore ? 'restored' : 'applied'; await writeDurableJson(file, journal);
      return { id, success: true, message: restore ? 'Original visual preference restored and verified.' : 'Visual effect disabled and verified. Original Windows API value saved.' };
    } catch {
      try { const observed = (await adapter.read())[id]; if (typeof observed === 'boolean') { record!.status = observed === record!.original ? restore ? 'restored' : 'failed' : 'applied'; await writeDurableJson(file, journal); } } catch { /* durable pending backup remains */ }
      return { id, success: false, message: 'The change could not be fully confirmed. Original values are retained. Refresh before retrying.' };
    }
  }
  return { getStates: () => serial(getStates), change: (token: unknown, restore: unknown) => serial(() => change(token, restore)) };
}
