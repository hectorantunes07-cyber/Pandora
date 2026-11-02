import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseFortniteConfig } from '../electron/fortnite-config';
import { createFortniteService } from '../electron/fortnite-settings';
import { createFortniteFileAdapter } from '../electron/fortnite-file';
import { FORTNITE_QUALITY, fortniteSummary, validFortniteValues } from '../shared/fortnite-settings';
const base = '[/Script/FortniteGame.FortGameUserSettings]\r\nFrameRateLimit=144.000000\r\nbUseVSync=True\r\nbUseDynamicResolution=False\r\n';
const quality = '[ScalabilityGroups]\r\n' + FORTNITE_QUALITY.map(v => `  ${v.key}=3  \r\n`).join('') + 'sg.ResolutionQuality=85.000000\r\nPrivateField=PRIVATE_SENTINEL\r\n';
const text = base + quality;
describe('existing Fortnite scalability preferences', () => {
  it.each(['utf8', 'utf8-bom', 'utf16le'] as const)('edits all eight recognized quality values without touching other bytes in %s', encoding => {
    const encode = (s: string) => encoding === 'utf16le' ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(s, 'utf16le')]) : Buffer.concat([encoding === 'utf8-bom' ? Buffer.from([239, 187, 191]) : Buffer.alloc(0), Buffer.from(s)]);
    const parsed = parseFortniteConfig(encode(text));
    const next = { ...parsed.values, ...Object.fromEntries(FORTNITE_QUALITY.map((v, i) => [v.id, i % 3])) };
    let expected = text; FORTNITE_QUALITY.forEach((v, i) => { expected = expected.replace(`${v.key}=3`, `${v.key}=${i % 3}`); });
    expect(parsed.patch(next)).toEqual(encode(expected));
    expect(parseFortniteConfig(encode(expected)).values).toEqual(next);
    expect(parseFortniteConfig(encode(expected)).patch(parsed.values, parsed.rawValues)).toEqual(encode(text));
  });
  it.each(['sg.ShadowQuality=3\r\nsg.ShadowQuality=0', '+sg.ShadowQuality=0\r\nsg.ShadowQuality=3', 'sg.ShadowQuality=3 ; comment', 'sg.ShadowQuality=-1', 'sg.ShadowQuality=5', 'sg.ShadowQuality=1.5', 'sg.ShadowQuality=3\r\nsg.ShadowQuality invalid'])('keeps ambiguous or unsupported shadow values unavailable while preserving other controls: %s', replacement => {
    const bytes = Buffer.from(text.replace('sg.ShadowQuality=3', replacement));
    const parsed = parseFortniteConfig(bytes);
    expect(parsed.values.shadows).toBeUndefined(); expect(parsed.values.textures).toBe(3);
    expect(() => parsed.patch({ ...parsed.values, shadows: 0 })).toThrow(/unavailable/);
    const changed = parsed.patch({ ...parsed.values, textures: 1 });
    expect(changed.toString()).toContain(replacement);
  });
  it('keeps an unavailable managed quality value explicit in combined restoration summaries', () => {
    expect(fortniteSummary(parseFortniteConfig(Buffer.from(base)).values, ['shadows'])).toBe('Unavailable');
  });
  it('never invents missing groups or accepts duplicated sections', () => {
    for (const input of [base, base + quality + '[scalabilitygroups]\r\nsg.ShadowQuality=0', text.replace('[ScalabilityGroups]', '[Other]')]) {
      const parsed = parseFortniteConfig(Buffer.from(input));
      expect(parsed.values.shadows).toBeUndefined();
      expect(() => parsed.patch({ ...parsed.values, shadows: 0 })).toThrow(/unavailable/);
      expect(parsed.patch(parsed.values)).toEqual(Buffer.from(input));
    }
  });
  it('requires complete detected fields and rejects unsupported IPC payloads', () => {
    const parsed = parseFortniteConfig(Buffer.from(text)), { shadows, ...incomplete } = parsed.values;
    expect(() => parsed.patch(incomplete)).toThrow(/removed/);
    for (const value of [{ ...parsed.values, shadows: undefined }, { ...parsed.values, shadows: '0' }, { ...parsed.values, shadows: 0.5 }, { ...parsed.values, shadows: NaN }, { ...parsed.values, command: 'anything' }, Object.create(parsed.values)]) expect(validFortniteValues(value)).toBe(false);
  });
});

describe('durable quality originals and legacy Fortnite journals', () => {
  let directory: string, config: string, data: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-quality-')); data = path.join(directory, 'data');
    config = path.join(directory, 'local/FortniteGame/Saved/Config/WindowsClient/GameUserSettings.ini');
    await fs.mkdir(path.dirname(config), { recursive: true }); await fs.writeFile(config, text);
  });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  const adapter = () => createFortniteFileAdapter(path.join(directory, 'local'), async () => false, true);
  const service = () => createFortniteService(data, adapter());
  it('backs up and restores all eight quality controls exactly after relaunch', async () => {
    const s = service(), current = (await s.getInfo()).current!;
    const values = { ...current, ...Object.fromEntries(FORTNITE_QUALITY.map(v => [v.id, 0])) };
    const review = await s.preview(values, false); expect(await fs.readFile(config, 'utf8')).toBe(text);
    expect((await s.change(review.token)).success).toBe(true);
    const reopened = service(); expect((await reopened.getInfo()).managedFields).toEqual(FORTNITE_QUALITY.map(v => v.id));
    expect((await reopened.change((await reopened.preview(null, true)).token)).success).toBe(true);
    expect(await fs.readFile(config, 'utf8')).toBe(text);
  }, 30000);
  it('preserves newer unowned quality values while restoring a managed value', async () => {
    const s = service(); await s.change((await s.preview({ ...(await s.getInfo()).current!, shadows: 0 }, false)).token);
    const newer = (await fs.readFile(config, 'utf8')).replace('sg.TextureQuality=3', 'sg.TextureQuality=1').replace('sg.ResolutionQuality=85', 'sg.ResolutionQuality=75');
    await fs.writeFile(config, newer);
    const reopened = service(); expect((await reopened.getInfo()).managedFields).toEqual(['shadows']);
    expect((await reopened.change((await reopened.preview(null, true)).token)).success).toBe(true);
    expect(await fs.readFile(config, 'utf8')).toBe(newer.replace('sg.ShadowQuality=0', 'sg.ShadowQuality=3'));
  }, 30000);
  it('blocks changed, missing or ambiguous owned quality values and retains the backup', async () => {
    const s = service(); await s.change((await s.preview({ ...(await s.getInfo()).current!, shadows: 0 }, false)).token);
    const applied = await fs.readFile(config, 'utf8');
    for (const newer of [applied.replace('sg.ShadowQuality=0', 'sg.ShadowQuality=2'), applied.replace('sg.ShadowQuality=0', 'removed=0'), applied.replace('sg.ShadowQuality=0', 'sg.ShadowQuality=0\r\nsg.ShadowQuality=1')]) {
      await fs.writeFile(config, newer);
      const reopened = service(); expect(await reopened.getInfo()).toMatchObject({ managed: true, conflict: true, canChange: false });
      await expect(reopened.preview(null, true)).rejects.toThrow(/external/);
      expect(await fs.readFile(config, 'utf8')).toBe(newer);
    }
    const saved = JSON.parse(await fs.readFile(path.join(data, 'backups/fortnite-config-v1.json'), 'utf8'));
    expect(Buffer.from(saved.original, 'base64').toString()).toBe(text);
  }, 30000);
  it.each([false, true])('restores a legacy three-field journal without taking ownership of quality keys (original had quality: %s)', async hasQuality => {
    const legacyOriginal = hasQuality ? text : base;
    const fileAdapter = adapter(), applied = legacyOriginal.replace('FrameRateLimit=144.000000', 'FrameRateLimit=240.000000');
    await fs.mkdir(path.join(data, 'backups'), { recursive: true });
    await fs.writeFile(path.join(data, 'backups/fortnite-config-v1.json'), JSON.stringify({ version: 1, locationId: fileAdapter.locationId, original: Buffer.from(legacyOriginal).toString('base64'), applied: Buffer.from(applied).toString('base64'), status: 'applied', timestamp: new Date().toISOString() }));
    const newer = (hasQuality ? applied : applied + quality).replace('sg.TextureQuality=3', 'sg.TextureQuality=0'); await fs.writeFile(config, newer);
    const s = service(); expect((await s.getInfo()).managedFields).toEqual(['frameRateLimit']);
    expect((await s.change((await s.preview(null, true)).token)).success).toBe(true);
    expect(await fs.readFile(config, 'utf8')).toBe(newer.replace('FrameRateLimit=240.000000', 'FrameRateLimit=144.000000'));
  }, 30000);
  it('can restore a stored cinematic value but will not newly select it', async () => {
    await fs.writeFile(config, text.replace('sg.ShadowQuality=3', 'sg.ShadowQuality=4'));
    const s = service(), current = (await s.getInfo()).current!;
    await expect(s.preview({ ...current, textures: 4 }, false)).rejects.toThrow(/Low, Medium/);
    expect((await s.change((await s.preview({ ...current, shadows: 0 }, false)).token)).success).toBe(true);
    const reopened = service(); expect((await reopened.change((await reopened.preview(null, true)).token)).success).toBe(true);
    expect(await fs.readFile(config, 'utf8')).toBe(text.replace('sg.ShadowQuality=3', 'sg.ShadowQuality=4'));
  }, 30000);
});
