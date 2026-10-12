import { test, expect, type Page } from '@playwright/test';

async function desktopFixture(page: Page) {
  await page.addInitScript(() => {
    const calls: { method: string; args: unknown[] }[] = [];
    (window as any).__calls = calls;
    const listeners: ((event: unknown) => void)[] = [];
    const track = (method: string, ...args: unknown[]) => calls.push({ method, args });
    const states = [{ id: 'transparency', title: 'Reduce transparency', description: 'Use opaque Windows surfaces.', category: 'Quality of life' as const, risk: 'Low' as const, tradeoff: 'Windows surfaces will look opaque.', target: 'HKCU\\Test\\Transparency', desiredValue: 0, restart: 'Sign out may be required.', reference: 'https://support.microsoft.com/', state: 'available' as const, currentValue: 1, managed: false }];
    window.pandora = {
      openWindowsSettings: async page => { track('windows-settings', page); },
      testNetwork: async target => { track('network', target); return { target, address: target === 'google' ? '8.8.8.8' : '1.1.1.1', timestamp: new Date().toISOString(), samples: [10, 20, null, 10, 20, 10, 20, 10], received: 7, lossPercent: 12.5, averageMs: 14.3, minMs: 10, maxMs: 20, jitterMs: 10 }; },
      getSystem: async () => ({ platform: 'win32', timestamp: new Date().toISOString(), cpu: 'UI test processor', logicalCores: 8, physicalCores: 4, gpu: 'UI test graphics', gpuDriver: 'test-driver', ramBytes: 16e9, ramSpeedMHz: 3200, os: 'Windows test fixture', motherboard: 'UI test board', installedRamBytes: 32e9, deviceType: 'Portable', physicalDisks: [{ model: 'Test NVMe drive', bytes: 1e12, media: 'SSD', bus: 'NVMe', health: 'Healthy' }], networkAdapters: [{ description: 'Test Ethernet adapter', status: 'Up', linkSpeedBits: 2.5e9 }], powerPlan: 'Balanced', volumes: [{ name: 'C:', totalBytes: 1e12, freeBytes: 6e11 }], monitors: [{ name: 'Test display', width: 1920, height: 1080, refreshHz: 144 }], notes: [] }),
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
  for (const name of ['System Monitor', 'Optimizations', 'Game Profiles', 'PC Cleaner', 'Restore & History', 'Processes & Startup', 'Performance Lab', 'Network Diagnostics']) {
    await page.getByRole('navigation').getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.getByRole('main')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Settings & About' }).click();
  await expect(page.getByText('PANDORA — Created by Sonnier')).toBeVisible();
  await expect(page.locator('.creator')).toBeInViewport();
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
  await expect(page.getByText('Test NVMe drive')).toBeVisible();
  await expect(page.getByText('Test Ethernet adapter')).toBeVisible();
  await expect(page.getByText('Up · 2.5 Gbps link')).toBeVisible();
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

test('preference review explains the target and cancellation never applies a change', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Optimizations', exact: true }).click();
  await page.getByRole('button', { name: 'What changes?' }).click();
  await expect(page.getByRole('dialog')).toContainText('Windows surfaces will look opaque.');
  await expect(page.getByRole('dialog')).toContainText('HKCU\\Test\\Transparency');
  await page.getByRole('button', { name: 'Review change', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'apply'))).toHaveLength(0);
  await page.getByRole('checkbox', { name: 'Select Reduce transparency' }).check();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm & apply' }).click();
  await expect(page.getByText('Applied and verified.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'apply').args)).toEqual([['transparency']]);
});

test('restore all reviews only active originals and retains each partial result', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.evaluate(() => {
    const entries: import('../../shared/types').HistoryEntry[] = [
      { id: 'old', tweakId: 'advertising-id', title: 'Already restored', timestamp: '2026-01-01T12:00:00Z', status: 'reverted', originalValue: 1, appliedValue: 0, message: 'Old history.' },
      { id: 'a', tweakId: 'transparency', title: 'Reduce transparency', timestamp: '2026-01-02T12:00:00Z', status: 'applied', originalValue: null, appliedValue: 0, message: 'Original saved.' },
      { id: 'b', tweakId: 'game-mode', title: 'Windows Game Mode', timestamp: '2026-01-03T12:00:00Z', status: 'conflict', originalValue: 0, appliedValue: 1, message: 'External change detected.' },
      { id: 'failed', tweakId: 'file-extensions', title: 'Failed audit record', timestamp: '2026-01-04T12:00:00Z', status: 'failed', originalValue: 1, appliedValue: 0, message: 'No active change.' }
    ];
    window.pandora!.getHistory = async () => entries;
    window.pandora!.revertTweaks = async ids => {
      (window as any).__calls.push({ method: 'revert', args: [ids] });
      await new Promise(resolve => { (window as any).__finishRestore = resolve; });
      entries[1].status = 'reverted';
      return [{ id: 'game-mode', success: false, message: 'External change preserved; original retained.' }, { id: 'transparency', success: true, message: 'Original absence restored and verified.' }];
    };
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Restore & History' }).click();
  await page.getByRole('button', { name: 'Restore all managed' }).click();
  await expect(page.getByRole('dialog')).toContainText('Restore 2 managed settings?');
  await expect(page.getByRole('dialog')).toContainText('Not set (remove the added value)');
  await expect(page.getByRole('dialog')).not.toContainText('Already restored');
  await expect(page.getByRole('dialog')).not.toContainText('Failed audit record');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'revert'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Restore all managed' }).click();
  await page.getByRole('button', { name: 'Confirm restore' }).click();
  await expect(page.getByRole('button', { name: 'Close window', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => (window as any).__finishRestore());
  const results = page.getByRole('region', { name: 'Restoration results' });
  await expect(results).toContainText('External change preserved; original retained.');
  await expect(results).toContainText('Original absence restored and verified.');
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'revert').args)).toEqual([['game-mode', 'transparency']]);
  await expect(page.getByRole('button', { name: 'Restore', exact: true })).toHaveCount(1);
});

test('hardware refresh requests a new inventory and displays updated storage', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await expect(page.getByText('UI test processor').first()).toBeVisible();
  await page.evaluate(() => {
    const original = window.pandora!.getSystem;
    window.pandora!.getSystem = async force => {
      (window as any).__calls.push({ method: 'system', args: [force] });
      const value = await original();
      value.powerPlan = 'Power saver';
      value.volumes[0].freeBytes = 7e11;
      return value;
    };
  });
  await page.getByRole('navigation').getByRole('button', { name: 'System Monitor', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('Power saver', { exact: true })).toBeVisible();
  await expect(page.getByText('700.0 GB free of 1.0 TB')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'system').args)).toEqual([true]);
});

test('network diagnostic runs only on request and preserves measured results across navigation', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Network Diagnostics' }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'network'))).toHaveLength(0);
  await page.getByLabel('Diagnostic destination').selectOption('google');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('region', { name: 'Network test results' })).toContainText('12.5%');
  await expect(page.getByText('Google · 8.8.8.8', { exact: true }).last()).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'network').args)).toEqual(['google']);
  await page.getByRole('navigation').getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Network Diagnostics' }).click();
  await expect(page.getByRole('region', { name: 'Network test results' })).toContainText('14.3 ms');
  await page.screenshot({ path: 'test-results/pandora-network.png', fullPage: true });
});

test('network failure remains explicit and never renders invented latency', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.evaluate(() => { window.pandora!.testNetwork = async () => { throw new Error('Network provider unavailable.'); }; });
  await page.getByRole('navigation').getByRole('button', { name: 'Network Diagnostics' }).click();
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('alert')).toContainText('Network provider unavailable.');
  await expect(page.getByRole('region', { name: 'Network test results' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start test' })).toBeEnabled();
});

test('Windows settings shortcuts open only their named destination', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'System Monitor', exact: true }).click();
  await page.getByRole('button', { name: 'Power settings' }).click();
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Processes & Startup' }).click();
  await page.getByRole('button', { name: 'Startup apps', exact: true }).click();
  await page.getByRole('button', { name: 'Open Windows startup settings' }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'windows-settings').map((c: any) => c.args))).toEqual([['power'], ['display'], ['startup']]);
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => ['apply', 'clean', 'revert'].includes(c.method)))).toHaveLength(0);
});
