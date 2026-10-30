import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFortniteConfig, MAX_FORTNITE_CONFIG } from '../electron/fortnite-config';
import { buildFortniteReplaceScript, createFortniteFileAdapter, isFortniteRunning, type FortniteAdapter } from '../electron/fortnite-file';
import { createFortniteService } from '../electron/fortnite-settings';

const text = '; User configuration — café\r\n[/Script/FortniteGame.FortGameUserSettings]\r\nFrameRateLimit = 144.000000  \r\nbUseVSync=True\r\nbUseDynamicResolution=False\r\nResolutionSizeX=1920\r\nPrivateAccount=PRIVATE_SENTINEL\r\n[Other]\r\nFrameRateLimit=55\r\n';
const originalValues = { frameRateLimit: 144, vsync: true, dynamicResolution: false };
const desired = { frameRateLimit: 240, vsync: false, dynamicResolution: true };
const original = Buffer.from(text);
vi.setConfig({ testTimeout: 20_000 });
describe('Fortnite configuration parsing and bounded editing', () => {
  it.each(['utf8', 'utf8-bom', 'utf16le'] as const)('changes only existing values and preserves %s encoding, formatting and unrelated settings', encoding => {
    const bytes = encoding === 'utf16le' ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, 'utf16le')]) : Buffer.concat([encoding === 'utf8-bom' ? Buffer.from([239, 187, 191]) : Buffer.alloc(0), original]);
    const parsed = parseFortniteConfig(bytes);
    expect(parsed.values).toEqual(originalValues); expect(parsed.patch(originalValues)).toEqual(bytes);
    const next = parsed.patch(desired); expect(parseFortniteConfig(next).values).toEqual(desired);
    const expected = text.replace('144.000000', '240.000000').replace('bUseVSync=True', 'bUseVSync=False').replace('bUseDynamicResolution=False', 'bUseDynamicResolution=True');
    expect(next).toEqual(encoding === 'utf16le' ? Buffer.concat([Buffer.from([255, 254]), Buffer.from(expected, 'utf16le')]) : Buffer.concat([encoding === 'utf8-bom' ? Buffer.from([239, 187, 191]) : Buffer.alloc(0), Buffer.from(expected)]));
  });
  it('retains unchanged custom numeric spelling and handles LF without a final newline', () => {
    const bytes = Buffer.from(text.replaceAll('\r\n', '\n').replace('144.000000', '143.25').trimEnd());
    const next = parseFortniteConfig(bytes).patch({ ...desired, frameRateLimit: 143.25 });
    expect(next.toString()).toContain('FrameRateLimit = 143.25  \n'); expect(next.toString().endsWith('FrameRateLimit=55')).toBe(true);
  });
  it.each([
    text.replace('bUseVSync=True', 'bUseVSync=1'), text.replace('bUseVSync=True', ''),
    text.replace('bUseVSync=True', 'bUseVSync=True\r\nbusevsync=False'),
    text.replace('bUseVSync=True', 'bUseVSync=True\r\n+bUseVSync=False'),
    text.replace('[Other]', '[/Script/FortniteGame.FortGameUserSettings]'),
    text.replace('[Other]', '[ /Script/FortniteGame.FortGameUserSettings ]'),
    text.replace('144.000000', 'NaN'), text.replace('144.000000', '-1'), text.replace('144.000000', '1001'),
    text.replace('bUseVSync=True', 'bUseVSync=True ; inline comment'), text.replace('[Other]', '[broken'),
  ])('refuses ambiguous, missing or unsupported input rather than inventing settings %#', input => {
    expect(() => parseFortniteConfig(Buffer.from(input))).toThrow();
  });
  it('rejects invalid encodings, control bytes and oversized input', () => {
    for (const bytes of [Buffer.from([0xff, 0xfe, 0x20]), Buffer.from([0xfe, 0xff, 0x20, 0]), Buffer.from([0xc3, 0x28]), Buffer.concat([original, Buffer.from([0])]), Buffer.alloc(MAX_FORTNITE_CONFIG + 1)]) expect(() => parseFortniteConfig(bytes)).toThrow();
  });
});

describe('reviewed Fortnite file changes and original recovery', () => {
  let directory: string, config: string, journal: string, running: boolean;
  let adapter: FortniteAdapter;
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-fortnite-'));
    config = path.join(directory, 'local', 'FortniteGame/Saved/Config/WindowsClient/GameUserSettings.ini');
    journal = path.join(directory, 'pandora/backups/fortnite-config-v1.json');
    await fs.mkdir(path.dirname(config), { recursive: true }); await fs.writeFile(config, original); running = false;
    adapter = createFortniteFileAdapter(path.join(directory, 'local'), async () => running, true);
  });
  afterEach(async () => { vi.restoreAllMocks(); await fs.chmod(config, 0o600).catch(() => undefined); await fs.rm(directory, { recursive: true, force: true }); });
  const service = () => createFortniteService(path.dirname(path.dirname(journal)), adapter);
  async function apply() { const s = service(); return s.change((await s.preview(desired, false)).token); }
  it('previews without writing, saves before replacing, verifies, and restores exact bytes after relaunch', async () => {
    const replace = adapter.replace;
    adapter.replace = async (...args) => { const b = JSON.parse(await fs.readFile(journal, 'utf8')); expect(Buffer.from(b.original, 'base64')).toEqual(original); await replace(...args); };
    const s = service(), review = await s.preview(desired, false);
    expect(review).toMatchObject({ current: originalValues, desired, restore: false });
    expect(await fs.readFile(config)).toEqual(original); await expect(fs.stat(journal)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await s.change(review.token)).success).toBe(true); expect((await s.getInfo()).current).toEqual(desired);
    const reopened = service(); expect(await reopened.getInfo()).toMatchObject({ managed: true, canChange: true, original: originalValues, current: desired });
    await expect(reopened.preview({ ...desired, frameRateLimit: 360 }, false)).rejects.toThrow(/Restore/);
    expect((await reopened.change((await reopened.preview(null, true)).token)).success).toBe(true);
    expect(await fs.readFile(config)).toEqual(original); expect((await reopened.getInfo()).managed).toBe(false);
    expect(await fs.readdir(path.dirname(config))).toEqual(['GameUserSettings.ini']);
  });
  it('rejects forged, reused, expired and superseded review tokens', async () => {
    const s = service(); const first = await s.preview(desired, false), second = await s.preview(desired, false);
    await expect(s.change(first.token)).rejects.toThrow(/review/); await expect(s.change(second.token)).rejects.toThrow(/review/);
    const review = await s.preview(desired, false); vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 300_001);
    await expect(s.change(review.token)).rejects.toThrow(/review/); expect(await fs.readFile(config)).toEqual(original);
  });
  it('rejects invalid choices and no-op changes without claiming ownership', async () => {
    const s = service();
    for (const value of [{ ...desired, extra: true }, { ...desired, frameRateLimit: 241 }, { ...desired, vsync: 'false' }, null]) await expect(s.preview(value, false)).rejects.toThrow(/Choose/);
    await expect(s.preview(originalValues, false)).rejects.toThrow(/different/); expect((await s.getInfo()).managed).toBe(false);
  });
  it('blocks running or uncheckable game status before preview and again at confirmation', async () => {
    running = true; expect(await service().getInfo()).toMatchObject({ running: true, canChange: false }); await expect(service().preview(desired, false)).rejects.toThrow(/Close Fortnite/);
    running = false; const s = service(), r = await s.preview(desired, false); running = true; await expect(s.change(r.token)).rejects.toThrow(/Close Fortnite/);
    adapter.running = async () => { throw new Error('Process query unavailable'); };
    expect((await service().getInfo()).canChange).toBe(false); await expect(service().preview(desired, false)).rejects.toThrow(/unavailable/); expect(await fs.readFile(config)).toEqual(original);
  });
  it('preserves external edits both before confirmation and after an applied change', async () => {
    const s = service(), r = await s.preview(desired, false); await fs.appendFile(config, '; user edit');
    await expect(s.change(r.token)).rejects.toThrow(/changed/);
    await fs.writeFile(config, original); await apply(); const external = Buffer.from((await fs.readFile(config, 'utf8')).replace('240.000000', '300.000000')); await fs.writeFile(config, external);
    expect(await service().getInfo()).toMatchObject({ managed: true, conflict: true, canChange: false });
    await expect(service().preview(null, true)).rejects.toThrow(/external/); expect(await fs.readFile(config)).toEqual(external);
  });
  it('refuses a changed backup after review and invalid backup contents', async () => {
    await apply(); const s = service(), r = await s.preview(null, true);
    const b = JSON.parse(await fs.readFile(journal, 'utf8')); b.timestamp = new Date(Date.now() - 1000).toISOString(); await fs.writeFile(journal, JSON.stringify(b));
    await expect(s.change(r.token)).rejects.toThrow(/backup changed/);
    b.applied = Buffer.from(text.replace('PrivateAccount=PRIVATE_SENTINEL', 'PrivateAccount=OTHER').replace('144.000000', '240.000000')).toString('base64'); await fs.writeFile(journal, JSON.stringify(b));
    await expect(service().getInfo()).rejects.toThrow(/invalid/); expect(await fs.readFile(journal, 'utf8')).toContain(b.applied);
  });
  it('restores only owned values while preserving new game settings, unowned display values and formatting', async () => {
    const s = service();
    expect((await s.change((await s.preview({ ...originalValues, frameRateLimit: 240 }, false)).token)).success).toBe(true);
    const newer = (await fs.readFile(config, 'utf8')).replace('FrameRateLimit = 240.000000  ', '  FrameRateLimit=240')
      .replace('bUseDynamicResolution=False', 'bUseDynamicResolution=True').replace('ResolutionSizeX=1920', 'ResolutionSizeX=2560') + '; newer game field\r\n';
    await fs.writeFile(config, newer);
    const reopened = service();
    expect(await reopened.getInfo()).toMatchObject({ managed: true, managedFields: ['frameRateLimit'], conflict: false, canChange: true });
    const r = await reopened.preview(null, true);
    expect(r.desired).toEqual({ ...originalValues, dynamicResolution: true });
    expect((await reopened.change(r.token)).success).toBe(true);
    expect(await fs.readFile(config, 'utf8')).toBe(newer.replace('  FrameRateLimit=240\r\n', '  FrameRateLimit=144.000000\r\n'));
  });
  it('retains already-restored values and does not claim success for a mismatched read-back', async () => {
    const replace = adapter.replace;
    adapter.replace = async (...args) => { await replace(...args); await fs.appendFile(config, '; concurrent writer'); };
    expect((await apply()).success).toBe(false); adapter.replace = replace;
    // An unrelated append does not prevent a later, fresh, reviewed per-value restoration.
    await fs.writeFile(config, (await fs.readFile(config, 'utf8')).replace('240.000000', '144.0'));
    const s = service(), r = await s.preview(null, true);
    expect((await s.change(r.token)).success).toBe(true);
    expect((await fs.readFile(config, 'utf8')).endsWith('; concurrent writer')).toBe(true);
    expect((await fs.readFile(config, 'utf8'))).toContain('FrameRateLimit = 144.0  ');
    expect(parseFortniteConfig(await fs.readFile(config)).values).toEqual(originalValues);
  });
  it('retains pending originals after interrupted confirmation and refuses unknown partial file contents', async () => {
    adapter.replace = async () => { throw new Error('Locked'); }; expect((await apply()).success).toBe(false);
    expect((await service().getInfo()).managed).toBe(true);
    const s = service(); expect((await s.change((await s.preview(null, true)).token)).success).toBe(true); expect(await fs.readFile(config)).toEqual(original);
    adapter.replace = async () => { await fs.writeFile(config, 'partial'); throw new Error('Interrupted'); };
    expect((await apply()).success).toBe(false); expect(await service().getInfo()).toMatchObject({ managed: true, canChange: false });
    expect(Buffer.from(JSON.parse(await fs.readFile(journal, 'utf8')).original, 'base64')).toEqual(original);
  });
  it('keeps a recoverable pending journal if final confirmation recording fails', async () => {
    const replace = adapter.replace;
    adapter.replace = async (...args) => { await replace(...args); vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('journal final write failed')); };
    expect((await apply()).success).toBe(false); vi.restoreAllMocks(); adapter.replace = replace;
    expect(await service().getInfo()).toMatchObject({ managed: true, current: desired, canChange: true });
    const s = service(); expect((await s.change((await s.preview(null, true)).token)).success).toBe(true); expect(await fs.readFile(config)).toEqual(original);
  });
  it('never writes when the durable original cannot be saved', async () => {
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('journal unavailable'));
    await expect(apply()).rejects.toThrow(/unavailable/); expect(await fs.readFile(config)).toEqual(original);
  });
  it('binds backups to their configuration location and supports unavailable platforms without writes', async () => {
    await apply(); adapter.locationId = 'a'.repeat(64);
    expect(await service().getInfo()).toMatchObject({ conflict: true, canChange: false }); await expect(service().preview(null, true)).rejects.toThrow(/location/);
    adapter.supported = false; expect(await service().getInfo()).toMatchObject({ supported: false, managed: true, canChange: false });
  });
  it('rejects missing, read-only, hardlinked and redirected configuration files', async () => {
    await fs.chmod(config, 0o400); await expect(adapter.read()).rejects.toThrow(/read-only/); await fs.chmod(config, 0o600);
    const linked = path.join(directory, 'link.ini'); await fs.link(config, linked); await expect(adapter.read()).rejects.toThrow(/unlinked/); await fs.unlink(linked);
    await fs.rename(config, linked);
    // Directory junctions need no symlink privilege on Windows; leaf links are checked on Unix too.
    const folder = path.dirname(config), moved = `${folder}-real`;
    await fs.rename(folder, moved); await fs.symlink(moved, folder, process.platform === 'win32' ? 'junction' : 'dir');
    await fs.writeFile(path.join(moved, 'GameUserSettings.ini'), original); await expect(adapter.read()).rejects.toThrow(/Redirected/);
    await fs.unlink(folder); await fs.rename(moved, folder); await fs.unlink(config);
    await expect(adapter.read()).rejects.toThrow(/not found/);
  });
  it('checks game status and file contents again immediately before atomic replacement', async () => {
    const snapshot = await adapter.read(); let calls = 0;
    const guarded = createFortniteFileAdapter(path.join(directory, 'local'), async () => { calls++; return calls === 2; }, true);
    await expect(guarded.replace(snapshot, parseFortniteConfig(original).patch(desired))).rejects.toThrow(/started/);
    expect(await fs.readFile(config)).toEqual(original); expect(await fs.readdir(path.dirname(config))).toEqual(['GameUserSettings.ini']);
    const external = createFortniteFileAdapter(path.join(directory, 'local'), async () => { if (++calls === 4) await fs.appendFile(config, '; external'); return false; }, true);
    await expect(external.replace(snapshot, parseFortniteConfig(original).patch(desired))).rejects.toThrow(/changed/); expect((await fs.readFile(config, 'utf8')).endsWith('; external')).toBe(true);
  });
  it('accepts a canonical base alias without allowing redirection beneath the fixed configuration suffix', async () => {
    const realpath = fs.realpath.bind(fs), local = path.join(directory, 'local');
    const resolvedLocal = await realpath(local), resolvedConfig = await realpath(config);
    const canonicalBase = path.join(directory, 'canonical-base');
    vi.spyOn(fs, 'realpath').mockImplementation(async file => {
      const resolved = await realpath(file);
      return resolved.startsWith(resolvedLocal) ? canonicalBase + resolved.slice(resolvedLocal.length) : resolved;
    });
    expect((await adapter.read()).bytes).toEqual(original);
    vi.mocked(fs.realpath).mockImplementation(async file => {
      const resolved = await realpath(file);
      return resolved === resolvedConfig ? path.join(directory, 'outside.ini') : resolved;
    });
    await expect(adapter.read()).rejects.toThrow(/Redirected/);
  });
  it.skipIf(process.platform !== 'win32')('preserves a custom Windows file ACL through apply and original restoration', async () => {
    const exe = path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const quoted = `'${config.replaceAll("'", "''")}'`;
    async function acl(protect = false) {
      // Use Windows PowerShell's .NET Framework ACL APIs directly. A pwsh-hosted
      // runner can pass a PSModulePath that makes Get-Acl autoload a newer,
      // incompatible Microsoft.PowerShell.Security module into Windows PS 5.1.
      const script = `$ErrorActionPreference='Stop'; $file=${quoted}; $acl=[IO.File]::GetAccessControl($file); ${protect ? '$acl.SetAccessRuleProtection($true,$true); [IO.File]::SetAccessControl($file,$acl);' : ''} ([IO.File]::GetAccessControl($file)).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)`;
      const { stdout } = await promisify(execFile)(exe, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 10_000, maxBuffer: 16_000 }); return stdout.trim();
    }
    // Only the disposable fixture's ACL is protected; all its existing grants remain.
    const before = await acl(true); expect(before).toContain('D:P');
    expect((await apply()).success).toBe(true); expect(await acl()).toBe(before);
    const s = service(); expect((await s.change((await s.preview(null, true)).token)).success).toBe(true);
    expect(await acl()).toBe(before); expect(await fs.readFile(config)).toEqual(original);
  }, 30_000);
});

it('bounds the Windows replacement helper to sibling temporary/configuration files and escapes literals', () => {
  const directory = "C:\\Users\\O'Brien\\Local\\FortniteGame\\Saved\\Config\\WindowsClient\\";
  const temporary = directory + '.pandora-11111111-1111-1111-1111-111111111111.tmp', target = directory + 'GameUserSettings.ini';
  const script = buildFortniteReplaceScript(temporary, target, 'a'.repeat(64), 'b'.repeat(64));
  expect(script).toContain("O''Brien"); expect(script).toContain('[System.IO.File]::Replace('); expect(script).toContain('[NullString]::Value,$false)');
  for (const invalid of ['C:\\Other\\GameUserSettings.ini', directory + 'Documents.txt', '\\\\server\\GameUserSettings.ini']) expect(() => buildFortniteReplaceScript(temporary, invalid, 'a'.repeat(64), 'b'.repeat(64))).toThrow();
  expect(() => buildFortniteReplaceScript(temporary, target, "'; Write-Output injected; '", 'b'.repeat(64))).toThrow();
});

it.skipIf(process.platform !== 'win32')('queries actual Windows process presence without changing or starting a game', async () => {
  expect(typeof await isFortniteRunning()).toBe('boolean');
}, 15_000);
