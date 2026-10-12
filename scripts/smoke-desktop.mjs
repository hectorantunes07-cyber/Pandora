// Read-only packaged-renderer smoke check. Never applies a tweak or deletes files.
import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'pandora-desktop-smoke-'));
const containerMode = process.env.PANDORA_CONTAINER_SMOKE === '1';
if (containerMode && process.platform !== 'linux') throw new Error('Container flags are only for isolated Linux smoke tests.');
let app;
try {
  app = await electron.launch({
    args: [...(containerMode ? ['--no-sandbox', '--ozone-platform=headless', '--disable-gpu'] : []), root],
    env: { ...process.env, PANDORA_DEV_URL: '', XDG_CONFIG_HOME: join(directory, 'config'), XDG_CACHE_HOME: join(directory, 'cache') },
    timeout: 30000,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('navigation', { name: 'Main navigation' }).waitFor();
  const info = await page.evaluate(async () => {
    const api = window.pandora;
    if (!api) throw new Error('Secure preload bridge did not load.');
    const system = await api.getSystem();
    const metrics = await api.getMetrics();
    return { platform: system.platform, cpu: system.cpu, ramBytes: system.ramBytes,
      ramTotal: metrics.ramTotalBytes, nodeExposed: typeof window.require !== 'undefined',
      tweaks: (await api.getTweaks()).map(tweak => tweak.state) };
  });
  assert.equal(info.platform, process.platform);
  assert.ok(info.ramBytes > 0 && info.ramTotal > 0);
  assert.equal(info.nodeExposed, false);
  if (process.platform !== 'win32') assert.ok(info.tweaks.every(state => state === 'unsupported'));
  await page.getByRole('navigation').getByRole('button', { name: /PC Cleaner/ }).click();
  await page.getByRole('button', { name: 'Scan & Clean' }).waitFor();
  if (process.platform !== 'win32') {
    await page.getByRole('button', { name: 'Scan & Clean' }).click();
    await page.getByText(/PC Cleaner requires the Windows desktop app/).first().waitFor();
  }
  assert.deepEqual(errors, []);
  const sandboxConfigured = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox);
  assert.equal(sandboxConfigured, true);
  console.log(JSON.stringify({ passed: true, platform: info.platform, realHardwareRead: true,
    bridgeLoaded: true, rendererNodeAccess: false, unavailableWindowsActionsGuarded: process.platform !== 'win32',
    containerTestFlags: containerMode }, null, 2));
} finally {
  if (app) await app.close();
  await rm(directory, { recursive: true, force: true });
}
