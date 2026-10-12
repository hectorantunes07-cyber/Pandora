import { test, expect, type Page } from '@playwright/test';

async function desktopFixture(page: Page) {
  await page.addInitScript(() => {
    const calls: { method: string; args: unknown[] }[] = [];
    (window as any).__calls = calls;
    const listeners: ((event: unknown) => void)[] = [];
    const track = (method: string, ...args: unknown[]) => calls.push({ method, args });
    const states = [{ id: 'transparency', title: 'Reduce transparency', description: 'Use opaque Windows surfaces.', category: 'Quality of life' as const, risk: 'Low' as const, tradeoff: 'Windows surfaces will look opaque.', target: 'HKCU\\Test\\Transparency', desiredValue: 0, restart: 'Sign out may be required.', reference: 'https://support.microsoft.com/', state: 'available' as const, currentValue: 1, managed: false }];
    window.pandora = {
      getSystem: async () => ({ platform: 'win32', timestamp: new Date().toISOString(), cpu: 'UI test processor', logicalCores: 8, physicalCores: 4, gpu: 'UI test graphics', gpuDriver: 'test-driver', ramBytes: 16e9, ramSpeedMHz: 3200, os: 'Windows test fixture', motherboard: 'UI test board', powerPlan: 'Balanced', volumes: [{ name: 'C:', totalBytes: 1e12, freeBytes: 6e11 }], monitors: [{ name: 'Test display', width: 1920, height: 1080, refreshHz: 144 }], notes: [] }),
      getMetrics: async () => ({ timestamp: new Date().toISOString(), cpuPercent: 24, gpuPercent: null, ramUsedBytes: 6e9, ramTotalBytes: 16e9, processCount: 12 }),
      getTweaks: async () => states,
      applyTweaks: async ids => { track('apply', ids); return ids.map(id => ({ id, success: true, message: 'Applied and verified.' })); },
      revertTweaks: async ids => { track('revert', ids); return ids.map(id => ({ id, success: true, message: 'Restored and verified.' })); },
      getHistory: async () => [],
      getGames: async () => [{ id: 'fortnite', name: 'Fortnite', installed: false, path: null }],
      getProcesses: async () => [{ pid: 123, name: 'fixture.exe', memoryBytes: 1e8, cpuSeconds: 4 }],
      getStartup: async () => [{ name: 'Fixture launcher', location: 'HKCU Run', status: 'Enabled (read-only)' }],
      getSettings: async () => ({ reduceMotion: false, scanOnLaunch: true, pollInterval: 2000 }),
      saveSettings: async settings => { track('settings', settings); return settings; },
      exportReport: async kind => { track('export', kind); return `PANDORA-${kind}.json`; },
      onProgress: callback => { listeners.push(callback as any); return () => {}; },
      windowAction: action => track('window', action),
      scanCleanup: async kind => {
        track('scan', kind);
        return { id: `${kind}-test-snapshot`, kind, timestamp: new Date().toISOString(), warnings: [], categories: kind === 'safe' ? [
          { id: 'user-temp', title: 'Unused temporary files', description: 'Stale temporary files.', bytes: 120e6, fileCount: 3, paths: ['C:\\Users\\Test\\AppData\\Local\\Temp'] },
          { id: 'windows-temp', title: 'Windows temporary files', description: 'Stale Windows temporary files.', bytes: 80e6, fileCount: 2, paths: ['C:\\Windows\\Temp'] }
        ] : [{ id: kind === 'browser' ? 'chrome-cache' : 'recycle-bin', title: kind === 'browser' ? 'Chrome cached images and files' : 'Recycle Bin', description: 'Optional cleanup.', bytes: 10e6, fileCount: 2, paths: [] }] };
      },
      clean: async (id, categories, kind) => {
        track('clean', id, categories, kind);
        listeners.forEach(fn => fn({ operation: 'clean', completed: 1, total: 3, message: 'Removing approved files.' }));
        await new Promise(resolve => setTimeout(resolve, 160));
        return { deletedBytes: 90e6, deletedFiles: 2, skippedFiles: 1, recoveredBytes: null, failures: [{ path: 'C:\\Temp\\locked.tmp', reason: 'File is locked; left untouched.' }] };
      }
    };
  });
}

test('browser preview shows unavailable readings and never pretends to scan files', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Windows app preview')).toBeVisible();
  await expect(page.getByText('Processor not connected')).toBeVisible();
  await page.getByRole('button', { name: /Clean Junk Files/ }).click();
  await page.getByRole('button', { name: 'Scan & Clean' }).click();
  await expect(page.getByText(/This browser cannot read hardware/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clean selected' })).toHaveCount(0);
});

test('cleaner scans without deleting, honors selections, and reports locked files', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Clean Junk Files/ }).click();
  await page.getByRole('button', { name: 'Scan & Clean' }).click();
  await expect(page.getByText('Temporary files · Scan results')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'clean'))).toHaveLength(0);
  await page.getByRole('checkbox', { name: 'Select Windows temporary files' }).uncheck();
  await page.getByRole('button', { name: 'Clean selected' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my files' }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'clean'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Clean selected' }).click();
  await page.getByRole('button', { name: 'Confirm cleanup' }).click();
  await expect(page.getByRole('heading', { name: 'Cleanup Complete' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'clean').args)).toEqual(['safe-test-snapshot', ['user-temp'], 'safe']);
  await expect(page.getByText('90.00 MB').first()).toBeVisible();
  await expect(page.getByText(/Disk space recovery could not be measured reliably/)).toBeVisible();
  await page.getByRole('button', { name: 'Review skipped files' }).click();
  await expect(page.getByText('File is locked; left untouched.')).toBeVisible();
});

for (const kind of ['browser', 'recycle'] as const) {
  test(`${kind} cleanup has a separate explicit confirmation`, async ({ page }) => {
    await desktopFixture(page);
    await page.goto('/');
    await page.getByRole('button', { name: /PC Cleaner/ }).first().click();
    await page.getByRole('button', { name: kind === 'browser' ? 'Review browser cache' : 'Review Recycle Bin' }).click();
    expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'clean'))).toHaveLength(0);
    await page.getByRole('button', { name: 'Clean selected' }).click();
    await expect(page.getByRole('dialog')).toContainText(kind === 'browser' ? 'Clear selected browser caches?' : 'Empty your Recycle Bin?');
    await page.getByRole('button', { name: kind === 'browser' ? 'Clear browser cache' : 'Empty Recycle Bin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cleanup Complete' })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'clean').args[2])).toBe(kind);
  });
}

test('all navigation routes render and the minimum desktop viewport does not overflow', async ({ page }) => {
  await desktopFixture(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  for (const name of ['System Monitor', 'Optimizations', 'Game Profiles', 'PC Cleaner', 'Restore & History', 'Processes & Startup', 'Performance Lab']) {
    await page.getByRole('navigation').getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Settings & About' }).click();
  await expect(page.getByText('PANDORA — Created by Sonnier')).toBeVisible();
  expect(errors).toEqual([]);
});

test('capture branded overview and cleaner for visual review', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: 'test-results/pandora-overview.png', fullPage: true });
  await page.getByRole('button', { name: /Clean Junk Files/ }).click();
  await page.screenshot({ path: 'test-results/pandora-cleaner.png', fullPage: true });
});

test('scanner displays returned hardware, keeps unavailable GPU metrics honest, and exports on request', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'System Monitor', exact: true }).click();
  await expect(page.getByText('UI test processor').first()).toBeVisible();
  await expect(page.getByText('Windows test fixture')).toBeVisible();
  await expect(page.getByText('CPU and GPU temperatures are not exposed', { exact: false })).toBeVisible();
  await expect(page.locator('.metric-card').nth(1).locator('.meter > span')).toHaveText('—');
  await page.getByRole('button', { name: 'Export report' }).click();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'export').args)).toEqual(['system']);
});

test('failed scan reports the provider error and never offers deletion', async ({ page }) => {
  await desktopFixture(page);
  await page.addInitScript(() => {
    const api = window.pandora!;
    api.scanCleanup = async () => { throw new Error('The Windows provider is unavailable. No files changed.'); };
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /PC Cleaner/ }).click();
  await page.getByRole('button', { name: 'Scan & Clean' }).click();
  await expect(page.getByRole('alert')).toContainText('The Windows provider is unavailable');
  await expect(page.getByRole('button', { name: 'Clean selected' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'clean'))).toHaveLength(0);
});

test('cleanup confirmations trap keyboard focus and Escape cancels without deleting', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /PC Cleaner/ }).click();
  await page.getByRole('button', { name: 'Scan & Clean' }).click();
  await page.getByRole('button', { name: 'Clean selected' }).click();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Confirm cleanup' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'clean'))).toHaveLength(0);
});
