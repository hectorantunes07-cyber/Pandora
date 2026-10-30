// Explicitly mutating integration, restricted to a disposable hosted Windows runner.
import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
if (process.platform !== 'win32' || process.env.CI !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted' || !process.env.PANDORA_SMOKE_EXECUTABLE) throw new Error('Lifecycle mutations require an explicitly selected installed executable on a disposable hosted Windows runner.');
const directory = await mkdtemp(join(tmpdir(), 'pandora-lifecycle-'));
let desktop, completed = false;
async function launch() {
  desktop = await electron.launch({ executablePath: resolve(process.env.PANDORA_SMOKE_EXECUTABLE), args: [`--user-data-dir=${directory}`], env: { ...process.env, PANDORA_DEV_URL: '' }, timeout: 30000 });
  const page = await desktop.firstWindow();
  await page.waitForFunction(() => Boolean(window.pandora));
  return page;
}
try {
  let page = await launch();
  const initial = await page.evaluate(() => window.pandora.getAppLifecycle());
  assert.equal(initial.login.supported, true); assert.equal(initial.login.state, 'absent'); assert.equal(initial.traySupported, true);
  assert.equal(await page.evaluate(() => window.pandora.getSettings().then(s => s.closeToTray)), false);
  const enabled = await page.evaluate(token => window.pandora.changeAppLogin(token, true), initial.login.token);
  assert.equal(enabled.success, true, enabled.message);
  await page.evaluate(async () => { const s = await window.pandora.getSettings(); await window.pandora.saveSettings({ ...s, closeToTray: true }); });
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  await desktop.evaluate(({ app }) => app.emit('second-instance'));
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  await desktop.close(); desktop = null;
  page = await launch();
  assert.equal(await page.evaluate(() => window.pandora.getSettings().then(s => s.closeToTray)), true);
  const activity = await page.evaluate(() => window.pandora.getActivity());
  assert.ok(activity.entries.some(e => e.action === 'app-login-change' && e.status === 'completed'));
  assert.ok(activity.entries.some(e => e.action === 'save-settings' && e.status === 'completed'));
  assert.equal(activity.entries.some(e => e.status === 'running'), false);
  const persisted = await page.evaluate(() => window.pandora.getAppLifecycle()); assert.equal(persisted.login.state, 'owned');
  assert.equal((await page.evaluate(token => window.pandora.changeAppLogin(token, false), persisted.login.token)).success, true);
  const disabled = await page.evaluate(() => window.pandora.getAppLifecycle()); assert.equal(disabled.login.state, 'absent');
  assert.equal((await page.evaluate(token => window.pandora.changeAppLogin(token, true), disabled.login.token)).success, true);
  await page.evaluate(async () => { const s = await window.pandora.getSettings(); await window.pandora.saveSettings({ ...s, closeToTray: false }); });
  // Exit must close the process even after tray mode was enabled earlier.
  const exited = desktop.waitForEvent('close'); await page.evaluate(() => window.pandora.windowAction('quit')); await exited; desktop = null;
  completed = true;
  console.log('Installed sign-in registration, relaunch, disable/re-enable, native tray close/reopen, preference persistence and explicit quit passed. Sign-in itself remains a physical-PC check.');
} finally {
  if (desktop) {
    if (!completed) try { const page = await desktop.firstWindow(); await page.evaluate(async () => { const state = await window.pandora.getAppLifecycle(); if (state.login.state === 'owned' && state.login.token) await window.pandora.changeAppLogin(state.login.token, false); }); } catch { /* runner is disposable; never overwrite an unknown registration */ }
    await desktop.close();
  }
  await rm(directory, { recursive: true, force: true });
}
