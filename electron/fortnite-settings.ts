import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readSmallJson, writeDurableJson } from './durable-store';
import { parseFortniteConfig, MAX_FORTNITE_CONFIG } from './fortnite-config';
import { createFortniteFileAdapter, sameFortniteSnapshot, type FortniteAdapter, type FortniteSnapshot } from './fortnite-file';
import { FORTNITE_FRAME_CAPS, FORTNITE_FIELDS, validFortniteValues, type FortniteInfo, type FortniteReview } from '../shared/fortnite-settings';
import type { OperationResult } from '../shared/types';

interface Backup { version: 1; locationId: string; original: string; applied: string; status: 'pending' | 'applied' | 'restored'; timestamp: string; }
export function createFortniteService(directory: string, adapter: FortniteAdapter = createFortniteFileAdapter(process.env.LOCALAPPDATA ?? '')) {
  const file = path.join(directory, 'backups', 'fortnite-config-v1.json');
  let queue: Promise<unknown> = Promise.resolve();
  let review: { token: string; restore: boolean; snapshot: FortniteSnapshot; desired: Buffer; backupFingerprint: string; expires: number } | null = null;
  const serial = <T>(fn: () => Promise<T>) => { const r = queue.then(fn, fn); queue = r.catch(() => undefined); return r; };
  const managed = (b: Backup | null) => Boolean(b && b.status !== 'restored');
  function restoration(b: Backup, bytes: Buffer) {
    const original = parseFortniteConfig(Buffer.from(b.original, 'base64'));
    const applied = parseFortniteConfig(Buffer.from(b.applied, 'base64'));
    const current = parseFortniteConfig(bytes);
    const fields = FORTNITE_FIELDS.filter(key => original.values[key] !== applied.values[key]);
    const conflict = fields.some(key => current.values[key] !== original.values[key] && current.values[key] !== applied.values[key]);
    const next = { ...current.values };
    for (const key of fields) Object.assign(next, { [key]: original.values[key] });
    // The unchanged PANDORA file can be restored exactly. Otherwise replace only
    // owned scalar values, keeping newer unrelated values and formatting intact.
    const desired = bytes.toString('base64') === b.applied ? Buffer.from(b.original, 'base64') : current.patch(next, original.rawValues);
    return { conflict, fields, desired };
  }
  async function load(): Promise<Backup | null> {
    const raw = await readSmallJson(file); if (raw === undefined) return null;
    try {
      const b = raw as Backup;
      if (b?.version !== 1 || !/^[a-f0-9]{64}$/.test(b.locationId) || !['pending', 'applied', 'restored'].includes(b.status) || typeof b.timestamp !== 'string' || !Number.isFinite(Date.parse(b.timestamp))) throw new Error();
      for (const value of [b.original, b.applied]) {
        if (typeof value !== 'string' || value.length > Math.ceil(MAX_FORTNITE_CONFIG / 3) * 4 || !value || Buffer.from(value, 'base64').toString('base64') !== value) throw new Error();
      }
      const original = Buffer.from(b.original, 'base64'), applied = Buffer.from(b.applied, 'base64');
      if (original.equals(applied) || !parseFortniteConfig(original).patch(parseFortniteConfig(applied).values).equals(applied)) throw new Error();
      return b;
    } catch { throw new Error('The Fortnite backup is invalid. It has been preserved; no configuration changes are allowed.'); }
  }
  async function inspect(): Promise<FortniteInfo> {
    const b = await load();
    const info: FortniteInfo = { supported: adapter.supported, current: null, original: b ? parseFortniteConfig(Buffer.from(b.original, 'base64')).values : null, managed: managed(b), managedFields: managed(b) ? restoration(b!, Buffer.from(b!.applied, 'base64')).fields : [], conflict: false, running: null, canChange: false, reason: null };
    if (!adapter.supported) return { ...info, reason: 'Fortnite display controls require the Windows app and a local configuration.' };
    if (managed(b) && b!.locationId !== adapter.locationId) return { ...info, conflict: true, reason: 'The saved backup belongs to a different configuration location. It has been preserved.' };
    try {
      const snapshot = await adapter.read();
      info.conflict = managed(b) ? restoration(b!, snapshot.bytes).conflict : false;
      info.current = parseFortniteConfig(snapshot.bytes).values;
      info.running = await adapter.running();
      info.canChange = !info.running && !info.conflict;
      info.reason = info.conflict ? 'A managed display value changed outside PANDORA. Automatic restoration is blocked to preserve that choice; the original backup remains saved.' : info.running ? 'Close Fortnite before reviewing or restoring these settings.' : null;
    } catch (error) { info.reason = error instanceof Error ? error.message : 'Fortnite settings are unavailable.'; }
    return info;
  }
  async function preview(value: unknown, restore: unknown): Promise<FortniteReview> {
    review = null;
    if (typeof restore !== 'boolean' || !adapter.supported) throw new Error('Review Fortnite settings from the Windows app.');
    const b = await load();
    if (managed(b) && b!.locationId !== adapter.locationId) throw new Error('The backup belongs to another configuration location.');
    if (await adapter.running()) throw new Error('Close Fortnite before reviewing its settings.');
    const snapshot = await adapter.read(), current = parseFortniteConfig(snapshot.bytes).values;
    let desired: Buffer;
    if (restore) {
      if (!managed(b)) throw new Error('No managed Fortnite configuration is available to restore.');
      const plan = restoration(b!, snapshot.bytes);
      if (plan.conflict) throw new Error('An external display-setting change is preserved. Automatic restoration is blocked.');
      desired = plan.desired;
    } else {
      if (managed(b)) throw new Error('Restore the managed Fortnite configuration before applying another change.');
      if (!validFortniteValues(value) || (value.frameRateLimit !== current.frameRateLimit && !(FORTNITE_FRAME_CAPS as readonly number[]).includes(value.frameRateLimit))) throw new Error('Choose a supported frame cap and display options.');
      desired = parseFortniteConfig(snapshot.bytes).patch(value);
      if (desired.equals(snapshot.bytes)) throw new Error('Choose a different setting before reviewing.');
    }
    const token = randomUUID();
    review = { token, restore, snapshot, desired, backupFingerprint: JSON.stringify(b), expires: Date.now() + 300_000 };
    return { token, restore, current, desired: parseFortniteConfig(desired).values };
  }
  async function change(token: unknown): Promise<OperationResult> {
    const saved = review; review = null;
    if (!saved || token !== saved.token || Date.now() > saved.expires || !adapter.supported) throw new Error('Refresh and review Fortnite settings again.');
    let b = await load();
    if (JSON.stringify(b) !== saved.backupFingerprint) throw new Error('The saved backup changed after review. Nothing was overwritten.');
    if (await adapter.running()) throw new Error('Close Fortnite before changing or restoring its configuration.');
    if (!sameFortniteSnapshot(await adapter.read(), saved.snapshot)) throw new Error('The configuration changed after review. Nothing was overwritten.');
    if (!saved.restore) b = { version: 1, locationId: adapter.locationId, original: saved.snapshot.bytes.toString('base64'), applied: saved.desired.toString('base64'), status: 'pending', timestamp: new Date().toISOString() };
    await writeDurableJson(file, b);
    try {
      if (!saved.desired.equals(saved.snapshot.bytes)) await adapter.replace(saved.snapshot, saved.desired);
      if (!(await adapter.read()).bytes.equals(saved.desired)) throw new Error('Read-back mismatch');
      b!.status = saved.restore ? 'restored' : 'applied'; await writeDurableJson(file, b);
      return { id: 'fortnite-config', success: true, message: saved.restore ? 'Original managed Fortnite display values restored and verified. Unrelated settings were preserved.' : 'Fortnite display preferences were saved and verified. Confirm them in the game’s video menu on next launch; no performance gain is assumed.' };
    } catch {
      return { id: 'fortnite-config', success: false, message: 'The Fortnite change could not be fully confirmed. The original backup is retained. Refresh before retrying; an external change or lock may prevent restoration.' };
    }
  }
  return { getInfo: () => serial(inspect), preview: (value: unknown, restore: unknown) => serial(() => preview(value, restore)), change: (token: unknown) => serial(() => change(token)) };
}
