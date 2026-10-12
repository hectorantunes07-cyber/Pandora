import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppSettings } from '../shared/types';
export const defaults: AppSettings = { reduceMotion: false, pollInterval: 2000, scanOnLaunch: true };
export function validateSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings.');
  const v = value as Record<string, unknown>;
  if (typeof v.reduceMotion !== 'boolean' || typeof v.scanOnLaunch !== 'boolean' || ![1000, 2000, 5000].includes(v.pollInterval as number)) throw new Error('Invalid settings. Choose a supported monitoring interval.');
  return { reduceMotion: v.reduceMotion, scanOnLaunch: v.scanOnLaunch, pollInterval: v.pollInterval as number };
}
export function createSettingsService(directory: string) {
  const file = path.join(directory, 'settings.json');
  let pending: Promise<unknown> = Promise.resolve();
  return {
    async getSettings(): Promise<AppSettings> {
      try { return validateSettings(JSON.parse(await fs.readFile(file, 'utf8'))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...defaults }; throw new Error('Settings could not be read. Your saved file has been preserved.'); }
    },
    async saveSettings(input: unknown): Promise<AppSettings> {
      const settings = validateSettings(input);
      const work = pending.catch(() => undefined).then(async () => {
        await fs.mkdir(directory, { recursive: true, mode: 0o700 });
        const temp = `${file}.${randomUUID()}.tmp`;
        try {
          await fs.writeFile(temp, JSON.stringify(settings, null, 2), { mode: 0o600, flag: 'wx' });
          await fs.rename(temp, file);
        } finally { await fs.rm(temp, { force: true }).catch(() => undefined); }
        return settings;
      });
      pending = work;
      return work;
    }
  };
}
