import { app, BrowserWindow, ipcMain, dialog, shell, screen, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getSystem, getMetrics, getProcesses, getStartup, getGames } from './system';
import { createTweakService } from './tweaks';
import { createCleanerService } from './cleaner';
import { createStartupService } from './startup';
import { createPowerService } from './power';
import { createNetworkService } from './network';
import { createSettingsService } from './settings';
import { cleanupKind, validateIds, isTrustedRenderer, externalDocumentation, windowsSettingsUri } from './validation';
import type { ProgressEvent } from '../shared/types';
app.setName('PANDORA');
app.setAppUserModelId('io.sonnier.pandora');
let window: BrowserWindow | null = null;
let activeMutations = 0;
const packagedUrl = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
const requestedDevUrl = process.env.PANDORA_DEV_URL;
const devUrl = !app.isPackaged && requestedDevUrl && /^http:\/\/(127\.0\.0\.1|localhost):5173\/?$/.test(requestedDevUrl) ? requestedDevUrl : undefined;
function checkSender(event: Electron.IpcMainEvent | IpcMainInvokeEvent) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !isTrustedRenderer(event.senderFrame.url, packagedUrl, devUrl)) throw new Error('Untrusted application frame.');
}
function progress(event: ProgressEvent) { if (window && !window.isDestroyed()) window.webContents.send('pandora:progress', event); }
function registerServices() {
  const tweaks = createTweakService(app.getPath('userData'));
  const cleaner = createCleanerService(progress);
  const settings = createSettingsService(app.getPath('userData'));
  function handle(name: string, fn: (...args: any[]) => unknown) {
    ipcMain.handle(`pandora:${name}`, async (event, ...args) => {
      checkSender(event);
      const mutates = ['apply', 'revert', 'clean', 'profile-apply', 'power-apply', 'power-restore', 'startup-change'].includes(name);
      if (mutates) activeMutations++;
      try { return await fn(...args); } finally { if (mutates) activeMutations--; }
    });
  }
  const startup = createStartupService(app.getPath('userData'));
  handle('startup-controls', () => startup.getControls());
  handle('startup-change', (token: unknown, restore: unknown) => startup.change(token, restore));
  const power = createPowerService(app.getPath('userData'));
  handle('power', () => power.getInfo());
  handle('power-apply', (id: unknown, expected: unknown) => power.apply(id, expected));
  handle('power-restore', (expected: unknown) => power.restore(expected));
  handle('profile', () => tweaks.getProfile());
  handle('profile-preview', (id: unknown, custom: unknown) => tweaks.previewProfile(id, custom));
  handle('profile-apply', (token: unknown) => tweaks.applyProfile(token));
  const network = createNetworkService();
  handle('network-test', (target: unknown) => network.testNetwork(target));
  handle('windows-settings', async (page: unknown) => {
    const uri = windowsSettingsUri(page);
    if (process.platform !== 'win32') throw new Error('This shortcut requires Windows.');
    await shell.openExternal(uri);
  });
  handle('system', getSystem);
  handle('metrics', getMetrics);
  handle('processes', getProcesses);
  handle('startup', getStartup);
  handle('games', getGames);
  handle('tweaks', () => tweaks.getTweaks());
  handle('history', () => tweaks.getHistory());
  handle('apply', async (input: unknown) => {
    const ids = validateIds(input);
    progress({ operation: 'tweaks', completed: 0, total: ids.length, message: 'Backing up and applying selected settings…' });
    const result = await tweaks.applyTweaks(ids);
    progress({ operation: 'tweaks', completed: ids.length, total: ids.length, message: 'Settings checked. Review the results.' });
    return result;
  });
  handle('revert', (input: unknown) => tweaks.revertTweaks(validateIds(input)));
  handle('scan-cleanup', (kind: unknown) => cleaner.scanCleanup(cleanupKind(kind)));
  handle('clean', (id: unknown, categories: unknown, confirmation: unknown) => {
    if (typeof id !== 'string' || id.length > 100) throw new Error('Scan again before cleaning.');
    return cleaner.clean(id, validateIds(categories), cleanupKind(confirmation));
  });
  handle('settings', () => settings.getSettings());
  handle('save-settings', (value: unknown) => settings.saveSettings(value));
  handle('export', async (kind: unknown) => {
    if (kind !== 'system' && kind !== 'history') throw new Error('Unknown report type.');
    if (!window) return null;
    // Fixed schema intentionally excludes usernames, network addresses, serials, paths and hardware IDs.
    const info = kind === 'system' ? await getSystem() : null;
    const report = info ? { product: 'PANDORA', version: app.getVersion(), createdBy: 'Sonnier', timestamp: info.timestamp, platform: info.platform, cpu: info.cpu, logicalCores: info.logicalCores, physicalCores: info.physicalCores, gpu: info.gpu, gpuDriver: info.gpuDriver, ramBytes: info.ramBytes, installedRamBytes: info.installedRamBytes, deviceType: info.deviceType, physicalDisks: info.physicalDisks, networkAdapters: info.networkAdapters, ramSpeedMHz: info.ramSpeedMHz, os: info.os, motherboard: info.motherboard, volumes: info.volumes.map(v => ({ totalBytes: v.totalBytes, freeBytes: v.freeBytes })), monitors: info.monitors.map(m => ({ width: m.width, height: m.height, refreshHz: m.refreshHz })) } : { product: 'PANDORA', timestamp: new Date().toISOString(), history: (await tweaks.getHistory()).map(h => ({ tweakId: h.tweakId, title: h.title, timestamp: h.timestamp, status: h.status, originalValue: h.originalValue, appliedValue: h.appliedValue })) };
    const result = await dialog.showSaveDialog(window, { title: 'Save privacy-filtered PANDORA report', defaultPath: `PANDORA-${kind}-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON report', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, JSON.stringify(report, null, 2), { mode: 0o600 });
    return path.basename(result.filePath);
  });
  ipcMain.on('pandora:window', (event, action: unknown) => {
    try { checkSender(event); } catch { return; }
    if (!window) return;
    if (action === 'close') window.close();
    if (action === 'minimize') window.minimize();
    if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
  });
}
function createWindow() {
  // Electron reports work-area sizes in logical pixels, including Windows scaling.
  const area = screen.getPrimaryDisplay().workAreaSize;
  // Some headless/remote sessions expose a 1-pixel placeholder instead of a display.
  const usableWidth = area.width > 1 ? area.width : 1440;
  const usableHeight = area.height > 1 ? area.height : 920;
  window = new BrowserWindow({ width: Math.min(1440, usableWidth), height: Math.min(920, usableHeight), minWidth: Math.min(1280, usableWidth), minHeight: Math.min(720, usableHeight), backgroundColor: '#090714', title: 'PANDORA — Created by Sonnier', frame: false, show: false, autoHideMenuBar: true, icon: path.join(__dirname, '../build/icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } });
  window.webContents.setWindowOpenHandler(({ url }) => { if (externalDocumentation(url)) void shell.openExternal(url).catch(() => undefined); return { action: 'deny' }; });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.once('ready-to-show', () => window?.show());
  window.on('close', event => {
    if (activeMutations > 0) {
      event.preventDefault();
      if (window) void dialog.showMessageBox(window, { type: 'info', title: 'PANDORA is finishing your operation', message: 'Please wait for the current cleanup or settings change to finish.', detail: 'Keeping this window open lets PANDORA report the result and preserve your change history.', buttons: ['Keep PANDORA open'] });
    }
  });
  window.on('closed', () => { window = null; });
  void window.loadURL(devUrl ?? packagedUrl);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => { registerServices(); createWindow(); }).catch(error => { dialog.showErrorBox('PANDORA could not start', String(error)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
