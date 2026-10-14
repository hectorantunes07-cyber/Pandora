import type { AppApi, AppSettings } from '../shared/types';

export const isDesktop = Boolean(window.pandora);
export const unsupportedMessage = 'Open the PANDORA Windows app to access your PC. This browser cannot read hardware or change Windows settings.';
const unavailable = async (): Promise<never> => { throw new Error(unsupportedMessage); };
const defaultSettings: AppSettings = { reduceMotion: false, pollInterval: 2000, scanOnLaunch: true };
const browserSettings = (): AppSettings => {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem('pandora.appearance') || '{}') }; }
  catch { return defaultSettings; }
};
export const api: AppApi = window.pandora ?? {
  getNvidiaPreset: unavailable, saveNvidiaPreset: unavailable, openNvidiaControlPanel: unavailable,
  getVisualEffects: unavailable, changeVisualEffect: unavailable,
  getPointer: unavailable, changePointer: unavailable,
  inspectNetwork: unavailable, testDns: unavailable,
  getManualGames: unavailable, selectGameExecutable: unavailable, clearGameExecutable: unavailable,
  previewRestoreAll: unavailable, restoreAll: unavailable,
  getStartupControls: unavailable, changeStartup: unavailable,
  getPower: unavailable, applyPower: unavailable, restorePower: unavailable, getProfile: unavailable, previewProfile: unavailable, applyProfile: unavailable,
  openWindowsSettings: unavailable, testNetwork: unavailable, getSystem: unavailable, getMetrics: unavailable, getTweaks: unavailable,
  applyTweaks: unavailable, revertTweaks: unavailable, getHistory: unavailable,
  scanCleanup: unavailable, clean: unavailable, getProcesses: unavailable,
  getStartup: unavailable, getGames: unavailable, getSettings: async () => browserSettings(),
  saveSettings: async settings => { localStorage.setItem('pandora.appearance', JSON.stringify(settings)); return settings; },
  exportReport: unavailable, onProgress: () => () => {}, windowAction: () => {},
};
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export function formatBytes(bytes: number | null | undefined, decimals = 2): string {
  if (bytes == null || !Number.isFinite(bytes)) return 'Unavailable';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(decimals)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(decimals)} GB`;
  return `${(bytes / 1e6).toFixed(decimals)} MB`;
}
export const formatDate = (date: string) => new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
