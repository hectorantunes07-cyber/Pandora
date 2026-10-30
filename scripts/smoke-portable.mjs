// Starts the actual self-extracting portable launcher on a disposable Windows runner.
// Uses Chromium's existing debugging endpoint; no test-only command is added to PANDORA.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
if (process.platform !== 'win32' || process.env.CI !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') throw new Error('Portable integration requires a disposable hosted Windows runner.');
const executable = resolve('release/PANDORA-Portable-0.1.0-x64.exe');
assert.ok((await stat(executable)).size > 1_000_000);
const directory = await mkdtemp(join(tmpdir(), 'pandora-portable-smoke-'));
const userData = join(directory, 'profile');
let browser, child, exited, exitResult;
try {
  child = spawn(executable, [`--user-data-dir=${userData}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'], { env: { ...process.env, PANDORA_DEV_URL: '' }, stdio: 'ignore' });
  exited = new Promise((resolveExit, reject) => { child.once('error', reject); child.once('exit', (code, signal) => { exitResult = { code, signal }; resolveExit(exitResult); }); });
  // Observe launch errors immediately, including while waiting for extraction.
  void exited.catch(() => undefined);
  let port;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await Promise.race([delay(250), exited.then(result => { throw new Error(`Portable launcher exited before its window opened (${result.code}).`); })]);
    try { const value = (await readFile(join(userData, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]; if (/^\d{1,5}$/.test(value) && +value > 0 && +value <= 65535) { port = +value; break; } }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  assert.ok(port, 'Portable extraction/application startup must publish its debugging port within 90 seconds.');
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  let page = context.pages()[0];
  if (!page) page = await context.waitForEvent('page');
  await page.waitForFunction(() => Boolean(window.pandora));
  assert.match(page.url(), /^file:/);
  const result = await page.evaluate(async () => {
    const system = await window.pandora.getSystem();
    const lifecycle = await window.pandora.getAppLifecycle();
    const cursor = await window.pandora.getCursor();
    return { platform: system.platform, ram: system.ramBytes, cores: system.physicalCores, os: system.os, login: lifecycle.login.supported, loginState: lifecycle.login.state, nodeExposed: typeof window.require !== 'undefined', cursorPreview: cursor.selected?.preview };
  });
  assert.equal(result.platform, 'win32'); assert.match(result.os, /Windows/i);
  assert.ok(result.ram > 0 && result.cores > 0);
  assert.equal(result.login, false); assert.equal(result.loginState, 'unavailable');
  assert.equal(result.nodeExposed, false); assert.match(result.cursorPreview, /^data:image\/png;base64,/);
  const openNavigation = page.getByRole('button', { name: 'Open navigation', exact: true, includeHidden: true });
  await openNavigation.waitFor({ state: 'attached' });
  if (await openNavigation.isVisible()) await openNavigation.click();
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('button', { name: /PC Cleaner/ }).click();
  await page.getByRole('button', { name: 'Scan & Clean' }).waitFor();
  // No cleanup or Windows preference mutation is performed.
  await page.evaluate(() => window.pandora.windowAction('quit'));
  const exit = await Promise.race([exited, delay(30_000).then(() => { throw new Error('Portable launcher did not exit after the app closed.'); })]);
  assert.equal(exit.code, 0); assert.equal(exit.signal, null);
  console.log('Actual portable launcher extraction, sandboxed bridge, hardware inventory, bundled cursor, cleaner navigation, startup-registration guard and clean exit passed.');
} catch (error) {
  const message = String(error).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error(`::error title=Portable integration::${message}`);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (child?.pid && !exitResult) {
    // Only the process tree launched by this test, on the disposable runner.
    await new Promise(resolveKill => { const kill = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); kill.once('error', resolveKill); kill.once('exit', resolveKill); });
  }
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}
