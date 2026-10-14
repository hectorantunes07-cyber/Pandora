// Read-only packaged-renderer smoke check. Never applies a tweak or deletes files.
import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'pandora-desktop-smoke-'));
const containerMode = process.env.PANDORA_CONTAINER_SMOKE === '1';
const executablePath = process.env.PANDORA_SMOKE_EXECUTABLE ? resolve(root, process.env.PANDORA_SMOKE_EXECUTABLE) : undefined;
if (containerMode && process.platform !== 'linux') throw new Error('Container flags are only for isolated Linux smoke tests.');
let app;
try {
  app = await electron.launch({
    executablePath,
    args: [...(containerMode ? ['--no-sandbox', '--ozone-platform=headless', '--disable-gpu'] : []), `--user-data-dir=${join(directory, 'user-data')}`, ...(executablePath ? [] : [root])],
    env: { ...process.env, PANDORA_DEV_URL: '', XDG_CONFIG_HOME: join(directory, 'config'), XDG_CACHE_HOME: join(directory, 'cache') },
    timeout: 30000,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const openNavigation = page.getByRole('button', { name: 'Open navigation', exact: true, includeHidden: true });
  await openNavigation.waitFor({ state: 'attached' });
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole('navigation', { name: 'Main navigation' }).waitFor();
  const info = await page.evaluate(async () => {
    const api = window.pandora;
    if (!api) throw new Error('Secure preload bridge did not load.');
    const system = await api.getSystem();
    const metrics = await api.getMetrics();
    return { platform: system.platform, cpu: system.cpu, ramBytes: system.ramBytes, os: system.os,
      physicalCores: system.physicalCores, volumeCount: system.volumes.length, notes: system.notes,
      ramTotal: metrics.ramTotalBytes, nodeExposed: typeof window.require !== 'undefined',
      tweaks: (await api.getTweaks()).map(tweak => tweak.state) };
  });
  assert.equal(info.platform, process.platform);
  assert.ok(info.ramBytes > 0 && info.ramTotal > 0);
  assert.equal(info.nodeExposed, false);
  const cursor = await page.evaluate(() => window.pandora.getCursor());
  assert.equal(cursor.selected.width, 32);
  assert.equal(cursor.selected.x, 15);
  assert.equal(cursor.selected.y, 16);
  assert.equal(cursor.managed, false);
  assert.match(cursor.selected.preview, /^data:image\/png;base64,/);
  assert.equal(await page.evaluate(() => window.pandora.getNvidiaPreset()), null);
  const gpuReadings = await page.evaluate(() => window.pandora.getGpuTelemetry());
  assert.equal(gpuReadings.provider, 'NVIDIA SMI');
  assert.ok(['available', 'unavailable'].includes(gpuReadings.status));
  assert.ok(Array.isArray(gpuReadings.devices));
  assert.ok(Number.isFinite(Date.parse(gpuReadings.timestamp)));
  if (process.platform !== 'win32') assert.equal(gpuReadings.devices.length, 0);
  const powerTuning = await page.evaluate(() => window.pandora.getPowerTuning());
  assert.equal(powerTuning.states.length, 6);
  assert.ok(powerTuning.states.every(state => !state.managed));
  assert.equal(powerTuning.supported, process.platform === 'win32');
  if (process.platform === 'win32') assert.ok(powerTuning.activePlanId, 'Windows power-policy provider must return the active plan');
  if (process.platform === 'win32') {
    assert.match(info.os, /Windows/i, `Windows CIM inventory must load: ${info.notes.join(' ')}`);
    assert.ok(info.physicalCores > 0 && info.volumeCount > 0, 'Windows CPU and volume providers must return real inventory');
  }
  if (process.platform !== 'win32') assert.ok(info.tweaks.every(state => state === 'unsupported'));
  await page.getByRole('navigation').getByRole('button', { name: /PC Cleaner/ }).click();
  await page.getByRole('button', { name: 'Scan & Clean' }).waitFor();
  if (process.platform !== 'win32') {
    await page.getByRole('button', { name: 'Scan & Clean' }).click();
    await page.getByText(/PC Cleaner requires the Windows desktop app/).first().waitFor();
  }
  if (await openNavigation.isVisible()) await openNavigation.click();
  await page.getByRole('navigation').getByRole('button', { name: 'Performance Lab', exact: true }).click();
  // Synthetic input only in this disposable test; no benchmark values ship in
  // the application. Exercise File.text() in the real sandboxed packaged renderer.
  await page.getByLabel('Choose before frame capture').setInputFiles({
    name: 'disposable-smoke.csv', mimeType: 'text/csv', buffer: Buffer.from(`frame_time_ms\n${Array(100).fill('10').join('\n')}`),
  });
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Use captured results' }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Before Average FPS', exact: true }).inputValue(), '100.00');
  assert.equal(await page.getByRole('spinbutton', { name: 'Before 1% low FPS', exact: true }).inputValue(), '100.00');
  assert.equal(await page.getByRole('spinbutton', { name: 'Before Latency', exact: true }).inputValue(), '');
  assert.deepEqual(errors, []);
  const sandboxConfigured = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox);
  assert.equal(sandboxConfigured, true);
  console.log(JSON.stringify({ passed: true, platform: info.platform, realHardwareRead: true,
    bridgeLoaded: true, rendererNodeAccess: false, unavailableWindowsActionsGuarded: process.platform !== 'win32',
    frameCaptureFixtureVerified: true, containerTestFlags: containerMode }, null, 2));
} catch (error) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const message = String(error).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.error(`::error title=Desktop integration::${message}`);
  }
  throw error;
} finally {
  if (app) await app.close();
  await rm(directory, { recursive: true, force: true });
}
