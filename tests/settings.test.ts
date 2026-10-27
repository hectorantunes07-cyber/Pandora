import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSettingsService, defaults, validateSettings } from '../electron/settings';
import { cleanupKind, validateIds, isTrustedRenderer, externalDocumentation } from '../electron/validation';
describe('application settings', () => {
  it('migrates old preferences without enabling background behavior', () => {
    expect(validateSettings({ reduceMotion: false, scanOnLaunch: true, pollInterval: 2000 }).closeToTray).toBe(false);
    expect(() => validateSettings({ ...defaults, closeToTray: 'true' })).toThrow();
  });
  it('persists settings and never silently replaces corrupt user files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandora-settings-'));
    try {
      const service = createSettingsService(dir);
      expect(await service.getSettings()).toEqual(defaults);
      const changed = { reduceMotion: true, pollInterval: 5000, scanOnLaunch: false, closeToTray: true };
      await service.saveSettings(changed);
      expect(await createSettingsService(dir).getSettings()).toEqual(changed);
      await fs.writeFile(path.join(dir, 'settings.json'), '{bad');
      await expect(service.getSettings()).rejects.toThrow('preserved');
      expect(await fs.readFile(path.join(dir, 'settings.json'), 'utf8')).toBe('{bad');
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
  it('rejects dangerous or malformed renderer values', () => {
    expect(() => validateSettings({ ...defaults, pollInterval: 0 })).toThrow();
    expect(() => validateSettings({ ...defaults, reduceMotion: 'false' })).toThrow();
    expect(() => validateIds(['../Documents'])).toThrow();
    expect(() => validateIds(['a; rm -rf /'])).toThrow();
    expect(() => validateIds(new Array(51).fill('valid'))).toThrow();
    expect(validateIds(['game-mode', 'game-mode'])).toEqual(['game-mode']);
    expect(() => cleanupKind('all-files')).toThrow();
  });
});
describe('desktop trust boundary', () => {
  const local = 'file:///app/dist/index.html';
  it('accepts only the main app URL or exact development origin', () => {
    expect(isTrustedRenderer(`${local}#home`, local)).toBe(true);
    expect(isTrustedRenderer('https://attacker.test', local)).toBe(false);
    expect(isTrustedRenderer('file:///app/dist/other.html', local)).toBe(false);
    expect(isTrustedRenderer('http://127.0.0.1:5173/', local, 'http://127.0.0.1:5173')).toBe(true);
    expect(isTrustedRenderer('http://127.0.0.1:5174/', local, 'http://127.0.0.1:5173')).toBe(false);
    expect(isTrustedRenderer('http://127.0.0.1:5173/injected', local, 'http://127.0.0.1:5173')).toBe(false);
  });
  it('limits external links to HTTPS documentation without credentials', () => {
    expect(externalDocumentation('https://learn.microsoft.com/windows/')).toBe(true);
    expect(externalDocumentation('file:///C:/Windows/System32/cmd.exe')).toBe(false);
    expect(externalDocumentation('https://learn.microsoft.com.evil.test')).toBe(false);
    expect(externalDocumentation('https://attacker@learn.microsoft.com/')).toBe(false);
    expect(externalDocumentation('https://learn.microsoft.com:8080')).toBe(false);
  });
});
