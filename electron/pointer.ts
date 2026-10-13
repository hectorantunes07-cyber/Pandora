import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { readSmallJson, writeDurableJson } from './durable-store';
import type { OperationResult, PointerInfo, PointerValues } from '../shared/types';
export const POINTER_NATIVE_SOURCE = `
using System;
using System.Runtime.InteropServices;
public static class PandoraPointer {
 [DllImport("user32.dll", EntryPoint="SystemParametersInfoW", ExactSpelling=true, SetLastError=true)]
 [return: MarshalAs(UnmanagedType.Bool)]
 static extern bool Spi(uint action, uint parameter, [In, Out] int[] values, uint flags);
 public static int[] Read() { var v=new int[3]; if(!Spi(3,0,v,0)) throw new System.ComponentModel.Win32Exception(); return v; }
 public static void Write(int a,int b,int mode) { if(a<0||b<0||mode<0||mode>2) throw new ArgumentException(); var v=new int[]{a,b,mode}; if(!Spi(4,0,v,3)) throw new System.ComponentModel.Win32Exception(); }
}`;
export const validPointer = (v: unknown): v is PointerValues => Array.isArray(v) && v.length === 3 && v.every(n => Number.isInteger(n) && n >= 0 && n <= 0x7fffffff) && v[2] <= 2;
const same = (a: PointerValues, b: PointerValues) => validPointer(a) && validPointer(b) && a.every((v, i) => v === b[i]);
export interface PointerAdapter { supported: boolean; read(): Promise<PointerValues>; write(value: PointerValues): Promise<void>; }
export function createWindowsPointerAdapter(): PointerAdapter {
  const supported = process.platform === 'win32';
  async function run(value?: PointerValues): Promise<PointerValues> {
    if (!supported) throw new Error('Pointer controls require Windows.');
    if (value && !validPointer(value)) throw new Error('Invalid pointer values.');
    const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${POINTER_NATIVE_SOURCE}\n'@\n${value ? `[PandoraPointer]::Write(${value.join(',')});` : ''} ConvertTo-Json -InputObject @([PandoraPointer]::Read()) -Compress`;
    try {
      const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const { stdout } = await promisify(execFile)(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15_000, maxBuffer: 16_000 });
      const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
      if (!validPointer(result)) throw new Error('Invalid pointer response');
      return result;
    } catch { throw new Error('Windows could not read or change pointer acceleration. Policy, session access or a timeout may prevent this operation.'); }
  }
  return { supported, read: () => run(), write: async value => { await run(value); } };
}
interface Backup { version: 1; original: PointerValues; applied: PointerValues; status: 'pending' | 'applied' | 'restored' | 'conflict' | 'failed'; timestamp: string; }
export function createPointerService(directory: string, adapter = createWindowsPointerAdapter()) {
  const file = path.join(directory, 'backups', 'pointer-v1.json');
  let queue: Promise<unknown> = Promise.resolve();
  let review: { token: string; current: PointerValues; expires: number } | null = null;
  const serial = <T>(fn: () => Promise<T>) => { const r = queue.then(fn, fn); queue = r.catch(() => undefined); return r; };
  const owned = (r: Backup | null) => Boolean(r && ['pending', 'applied', 'conflict'].includes(r.status));
  async function load(): Promise<Backup | null> {
    const raw = await readSmallJson(file); if (raw === undefined) return null;
    const r = raw as Backup;
    if (r?.version !== 1 || !validPointer(r.original) || !validPointer(r.applied) || r.original[2] === 0 || r.applied[2] !== 0 || r.original[0] !== r.applied[0] || r.original[1] !== r.applied[1] || !['pending', 'applied', 'restored', 'conflict', 'failed'].includes(r.status) || typeof r.timestamp !== 'string' || !Number.isFinite(Date.parse(r.timestamp))) throw new Error('Invalid pointer backup. It has been preserved; no changes are allowed.');
    return r;
  }
  async function info(): Promise<PointerInfo> {
    const backup = await load(); review = null;
    if (!adapter.supported) return { supported: false, current: null, original: backup?.original ?? null, managed: owned(backup), conflict: false, token: null };
    let current: PointerValues;
    try { current = await adapter.read(); if (!validPointer(current)) throw new Error('Invalid pointer values'); }
    catch { return { supported: true, current: null, original: backup?.original ?? null, managed: owned(backup), conflict: false, token: null, reason: 'Windows pointer values are unavailable. The saved backup is retained; no pointer change can be reviewed until the provider responds.' }; }
    const token = randomUUID(); review = { token, current: [...current], expires: Date.now() + 300_000 };
    return { supported: true, current, original: backup?.original ?? null, managed: owned(backup), conflict: Boolean(owned(backup) && !same(current, backup!.original) && !same(current, backup!.applied)), token };
  }
  async function change(token: unknown, restore: unknown): Promise<OperationResult> {
    const saved = review; review = null;
    if (!adapter.supported || !saved || token !== saved.token || Date.now() > saved.expires || typeof restore !== 'boolean') throw new Error('Refresh and review pointer settings again.');
    const current = await adapter.read(); if (!validPointer(current) || !same(current, saved.current)) throw new Error('Pointer settings changed after review. Nothing was overwritten.');
    let record = await load();
    if (restore) {
      if (!owned(record)) throw new Error('There is no managed pointer change to restore.');
      if (same(current, record!.original)) { record!.status = 'restored'; await writeDurableJson(file, record); return { id: 'pointer', success: true, message: 'Original Windows pointer values already present; verified without writing.' }; }
      if (!same(current, record!.applied)) throw new Error('An external pointer change is preserved. Review the original backup before proceeding.');
    } else {
      if (owned(record)) throw new Error('Restore the previous pointer change before applying again.');
      if (current[2] === 0) return { id: 'pointer', success: true, message: 'Pointer acceleration is already off. No ownership was claimed.' };
      record = { version: 1, original: [...current], applied: [current[0], current[1], 0], status: 'pending', timestamp: new Date().toISOString() };
    }
    record!.status = 'pending'; await writeDurableJson(file, record);
    if (!same(await adapter.read(), current)) { record!.status = restore ? 'conflict' : 'failed'; await writeDurableJson(file, record); throw new Error('Pointer values changed before writing. Nothing was overwritten.'); }
    try {
      const desired = restore ? record!.original : record!.applied;
      await adapter.write(desired);
      if (!same(await adapter.read(), desired)) throw new Error('Pointer read-back mismatch');
      record!.status = restore ? 'restored' : 'applied'; await writeDurableJson(file, record);
      return { id: 'pointer', success: true, message: restore ? 'Original Windows pointer thresholds and acceleration mode restored and verified.' : 'Windows pointer acceleration disabled and verified. Original API values are saved; raw-input games may be unaffected.' };
    } catch {
      try { const observed = await adapter.read(); record!.status = same(observed, record!.original) ? restore ? 'restored' : 'failed' : same(observed, record!.applied) ? 'applied' : 'conflict'; await writeDurableJson(file, record); } catch { /* durable pending original remains */ }
      return { id: 'pointer', success: false, message: 'The pointer change could not be fully confirmed. Original values are retained. Refresh before retrying; no extra Windows write was attempted.' };
    }
  }
  return { getInfo: () => serial(info), change: (token: unknown, restore: unknown) => serial(() => change(token, restore)) };
}
