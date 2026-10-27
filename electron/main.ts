import { app, BrowserWindow, ipcMain, dialog, shell, screen, Tray, Menu, nativeImage, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getSystem, getMetrics, getProcesses, getStartup, getGames } from './system';
import { createTweakService } from './tweaks';
import { createCleanerService } from './cleaner';
import { createStartupService } from './startup';
import { createPowerTuningService } from './power-tuning';
import { createGpuTelemetryService } from './gpu-telemetry';
import { createStorageReliabilityService } from './storage-reliability';
import { createSystemRestoreService } from './system-restore';
import { createPowerService } from './power';
import { createRestoreService } from './restore-all';
import { createVisualEffectsService } from './visual-effects';
import { createCursorService } from './cursor';
import { createNvidiaService, openNvidiaControlPanel } from './nvidia';
import { createPointerService } from './pointer';
import { createGamePathService, validateGameId } from './game-paths';
import { createNetworkService } from './network';
import { createNetworkInspection } from './network-inspection';
import { createSettingsService, validateSettings } from './settings';
import { createLoginService, createWindowsLoginAdapter, LOGIN_NAME } from './app-login';
import { createDesktopLifecycle } from './desktop-lifecycle';
import { cleanupKind, validateIds, isTrustedRenderer, externalDocumentation, windowsSettingsUri } from './validation';
import type { ProgressEvent } from '../shared/types';
app.setName('PANDORA');
app.setAppUserModelId('io.sonnier.pandora');
let window: BrowserWindow | null = null;
let activeMutations = 0;
const lifecycle = createDesktopLifecycle({
  window: () => window && !window.isDestroyed() ? window : null,
  busy: () => activeMutations > 0,
  quit: () => app.quit(),
  notifyBusy: () => { if (window && !window.isDestroyed()) void dialog.showMessageBox(window, { type: 'info', title: 'PANDORA is finishing your operation', message: 'Please wait for the current cleanup or settings change to finish.', detail: 'Keeping PANDORA open lets it report the result and preserve your change history.', buttons: ['Keep PANDORA open'] }); },
  createTray: (show, quit) => {
    const image = nativeImage.createFromPath(path.join(__dirname, '../build/icon.png')).resize({ width: 16, height: 16 });
    if (image.isEmpty()) throw new Error('PANDORA’s notification-area icon is unavailable.');
    const tray = new Tray(image);
    try {
      tray.setToolTip('PANDORA — Created by Sonnier');
      tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open PANDORA', click: show }, { type: 'separator' }, { label: 'Exit PANDORA', click: quit }]));
      tray.on('click', show);
      return tray;
    } catch (error) { tray.destroy(); throw error; }
  },
});
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
  let mutationQueue: Promise<unknown> = Promise.resolve();
  function handle(name: string, fn: (...args: any[]) => unknown) {
    ipcMain.handle(`pandora:${name}`, async (event, ...args) => {
      checkSender(event);
      const mutates = ['apply', 'revert', 'clean', 'profile-apply', 'power-apply', 'power-restore', 'power-tuning-change', 'startup-change', 'pointer-change', 'visual-change', 'cursor-change', 'cursor-select', 'cursor-app', 'restore-all', 'system-restore-create', 'app-login-change', 'save-settings'].includes(name);
      if (!mutates) return fn(...args);
      activeMutations++;
      const result = mutationQueue.then(() => fn(...args));
      mutationQueue = result.catch(() => undefined);
      try { return await result; } finally { activeMutations--; }
    });
  }
  const systemRestore = createSystemRestoreService();
  const login = createLoginService(createWindowsLoginAdapter(process.execPath, app.isPackaged, () => {
    const items = app.getLoginItemSettings({ path: process.execPath, args: [] }).launchItems;
    const entry = items?.find(item => item.scope === 'user' && item.name === LOGIN_NAME && item.path.toLowerCase() === process.execPath.toLowerCase() && item.args.length === 0);
    return entry ? entry.enabled : null;
  }), process.platform === 'win32');
  handle('app-lifecycle', () => login.get());
  handle('app-login-change', (token: unknown, enable: unknown) => login.change(token, enable));
  handle('system-restore', () => systemRestore.getInfo());
  handle('system-restore-preview', () => systemRestore.preview());
  handle('system-restore-create', (token: unknown) => systemRestore.create(token));
  handle('system-protection-open', async () => {
    if (process.platform !== 'win32') throw new Error('System Protection requires Windows.');
    const error = await shell.openPath(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/SystemPropertiesProtection.exe'));
    if (error) throw new Error('Windows System Protection could not be opened.');
  });
  const nvidia = createNvidiaService(app.getPath('userData'));
  handle('nvidia-preset', () => nvidia.getPreset());
  handle('nvidia-save', (preset: unknown) => nvidia.savePreset(preset));
  handle('nvidia-open', openNvidiaControlPanel);
  const startup = createStartupService(app.getPath('userData'));
  const gamePaths = createGamePathService(app.getPath('userData'));
  handle('manual-games', () => gamePaths.list());
  handle('game-clear', (id: unknown) => gamePaths.clear(id));
  handle('game-select', async (id: unknown) => {
    const key = validateGameId(id);
    if (!window || process.platform !== 'win32') throw new Error('Choose game executables from the Windows app.');
    const result = await dialog.showOpenDialog(window, { title: 'Choose the game executable — saved as a manual location only', properties: ['openFile'], filters: [{ name: 'Windows executable', extensions: ['exe'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    return gamePaths.select(key, result.filePaths[0]);
  });
  handle('startup-controls', () => startup.getControls());
  handle('startup-change', (token: unknown, restore: unknown) => startup.change(token, restore));
  const power = createPowerService(app.getPath('userData'));
  const pointer = createPointerService(app.getPath('userData'));
  handle('pointer', () => pointer.getInfo());
  handle('pointer-change', (token: unknown, restore: unknown) => pointer.change(token, restore));
  const visual = createVisualEffectsService(app.getPath('userData'));
  handle('visual-effects', () => visual.getStates());
  handle('visual-change', (token: unknown, restore: unknown) => visual.change(token, restore));
  const bundledCursor = path.join(__dirname, '../dist/cursors/sonnier.cur');
  const cursor = createCursorService(app.getPath('userData'), bundledCursor);
  handle('cursor', () => cursor.getInfo());
  handle('cursor-change', (token: unknown, restore: unknown) => cursor.change(token, restore));
  handle('cursor-app', (enabled: unknown) => cursor.setAppCursor(enabled));
  handle('cursor-select', async (bundled: unknown) => {
    if (typeof bundled !== 'boolean' || !window || process.platform !== 'win32') throw new Error('Choose cursor files from the Windows app.');
    if (bundled) return cursor.select(bundledCursor, true);
    const result = await dialog.showOpenDialog(window, { title: 'Choose a Windows normal pointer', properties: ['openFile'], filters: [{ name: 'Windows cursor', extensions: ['cur', 'ani'] }] });
    return result.canceled || !result.filePaths[0] ? null : cursor.select(result.filePaths[0]);
  });
  const powerTuning = createPowerTuningService(app.getPath('userData'));
  handle('power-tuning', () => powerTuning.getInfo());
  handle('power-tuning-preview', (id: unknown, value: unknown, restore: unknown) => powerTuning.preview(id, value, restore));
  handle('power-tuning-change', (token: unknown) => powerTuning.change(token));
  const recovery = createRestoreService({ tweaks, power, startup, pointer, visual, cursor, powerTuning });
  handle('restore-preview', () => recovery.preview());
  handle('restore-all', (token: unknown) => recovery.restore(token));
  handle('power', () => power.getInfo());
  handle('power-apply', (id: unknown, expected: unknown) => power.apply(id, expected));
  handle('power-restore', (expected: unknown) => power.restore(expected));
  handle('profile', () => tweaks.getProfile());
  handle('profile-preview', (id: unknown, custom: unknown) => tweaks.previewProfile(id, custom));
  handle('profile-apply', (token: unknown) => tweaks.applyProfile(token));
  const network = createNetworkService();
  const inspection = createNetworkInspection();
  handle('network-inspect', () => inspection.inspect());
  handle('dns-test', () => inspection.dns());
  handle('network-test', (target: unknown) => network.testNetwork(target));
  handle('windows-settings', async (page: unknown) => {
    const uri = windowsSettingsUri(page);
    if (process.platform !== 'win32') throw new Error('This shortcut requires Windows.');
    await shell.openExternal(uri);
  });
  handle('system', getSystem);
  handle('metrics', getMetrics);
  const gpuTelemetry = createGpuTelemetryService();
  handle('gpu-telemetry', () => gpuTelemetry.get());
  const storageReliability = createStorageReliabilityService();
  handle('storage-reliability', () => storageReliability.get());
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
  handle('save-settings', async (value: unknown) => {
    const next = validateSettings(value), wasEnabled = lifecycle.enabled;
    if (process.platform === 'win32' && next.closeToTray) lifecycle.configure(true);
    try {
      const saved = await settings.saveSettings(next);
      lifecycle.configure(process.platform === 'win32' && saved.closeToTray);
      return saved;
    } catch (error) { if (!wasEnabled) lifecycle.configure(false); throw error; }
  });
  handle('export', async (kind: unknown) => {
    if (kind !== 'system' && kind !== 'history') throw new Error('Unknown report type.');
    if (!window) return null;
    // Fixed schema intentionally excludes usernames, network addresses, serials, paths and hardware IDs.
    const info = kind === 'system' ? await getSystem() : null;
    const report = info ? { product: 'PANDORA', version: app.getVersion(), createdBy: 'Sonnier', gpuReadings: await gpuTelemetry.get(), storageReadings: await storageReliability.get(), timestamp: info.timestamp, platform: info.platform, cpu: info.cpu, logicalCores: info.logicalCores, physicalCores: info.physicalCores, cpuReportedMHz: info.cpuReportedMHz, architecture: info.architecture, gpu: info.gpu, gpuDriver: info.gpuDriver, ramBytes: info.ramBytes, installedRamBytes: info.installedRamBytes, deviceType: info.deviceType, physicalDisks: info.physicalDisks, networkAdapters: info.networkAdapters, ramSpeedMHz: info.ramSpeedMHz, os: info.os, motherboard: info.motherboard, volumes: info.volumes.map(v => ({ totalBytes: v.totalBytes, freeBytes: v.freeBytes })), monitors: info.monitors.map(m => ({ width: m.width, height: m.height, refreshHz: m.refreshHz })) } : { product: 'PANDORA', timestamp: new Date().toISOString(), history: (await tweaks.getHistory()).map(h => ({ tweakId: h.tweakId, title: h.title, timestamp: h.timestamp, status: h.status, originalValue: h.originalValue, appliedValue: h.appliedValue })) };
    const result = await dialog.showSaveDialog(window, { title: 'Save privacy-filtered PANDORA report', defaultPath: `PANDORA-${kind}-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON report', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, JSON.stringify(report, null, 2), { mode: 0o600 });
    return path.basename(result.filePath);
  });
  ipcMain.on('pandora:window', (event, action: unknown) => {
    try { checkSender(event); } catch { return; }
    if (!window) return;
    if (action === 'quit') lifecycle.requestQuit();
    if (action === 'close') window.close();
    if (action === 'minimize') window.minimize();
    if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
  });
  return settings;
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
  window.on('close', event => lifecycle.close(event));
  window.on('closed', () => { window = null; });
  void window.loadURL(devUrl ?? packagedUrl);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => lifecycle.show());
  app.on('before-quit', event => lifecycle.beforeQuit(event));
  app.on('will-quit', () => lifecycle.dispose());
  app.whenReady().then(async () => {
    const settings = registerServices();
    const saved = await settings.getSettings().catch(() => null);
    if (saved && process.platform === 'win32') try { lifecycle.configure(saved.closeToTray); }
    catch { dialog.showErrorBox('Notification area unavailable', 'PANDORA could not create its tray icon. Closing the window will exit the app in this session. You can retry the option in Settings.'); }
    createWindow();
  }).catch(error => { dialog.showErrorBox('PANDORA could not start', String(error)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
