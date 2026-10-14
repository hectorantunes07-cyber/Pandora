import { test, expect, type Page } from '@playwright/test';

async function desktopFixture(page: Page) {
  await page.addInitScript(() => {
    const calls: { method: string; args: unknown[] }[] = [];
    (window as any).__calls = calls;
    const listeners: ((event: unknown) => void)[] = [];
    const track = (method: string, ...args: unknown[]) => calls.push({ method, args });
    const states = [{ id: 'transparency', title: 'Reduce transparency', description: 'Use opaque Windows surfaces.', category: 'Quality of life' as const, risk: 'Low' as const, tradeoff: 'Windows surfaces will look opaque.', target: 'HKCU\\Test\\Transparency', desiredValue: 0, restart: 'Sign out may be required.', reference: 'https://support.microsoft.com/', state: 'available' as const, currentValue: 1, managed: false }];
    let visualManaged = false;
    let cursorManaged = false, appCursor = false;
    const cursorInfo = () => ({ supported: true, current: { kind: 'String' as const, value: cursorManaged ? 'C:\\fixture.cur' : '' }, original: cursorManaged ? { kind: 'String' as const, value: '' } : null, currentPreview: null, selected: { id: 'fixture', name: 'Sonnier’s cursor', kind: 'cur' as const, width: 32, height: 32, x: 15, y: 16, preview: './cursors/sonnier.png', cssCursor: 'data:image/x-icon;base64,AA==' }, useInApp: appCursor, managed: cursorManaged, conflict: false, token: 'cursor-review' });
    window.pandora = {
      getPowerTuning: async () => ({ supported: true, planId: '381b4222-f694-41f0-9685-ff5bb260df2e', activePlanId: '381b4222-f694-41f0-9685-ff5bb260df2e', states: [{ id: 'cpu-maximum', current: 100, original: null, applied: null, managed: false, conflict: false }] }),
      previewPowerTuning: async (id, value, restore) => { track('power-tuning-preview', id, value, restore); return { token: 'power-tuning-review', id, planId: '381b4222-f694-41f0-9685-ff5bb260df2e', activePlanId: '381b4222-f694-41f0-9685-ff5bb260df2e', current: 100, desired: value ?? 100, restore }; },
      changePowerTuning: async token => { track('power-tuning-change', token); return { id: 'power-tuning:cpu-maximum', success: true, message: 'Power value verified.' }; },
      getCursor: async () => cursorInfo(), selectCursor: async bundled => { track('cursor-select', bundled); return bundled ? cursorInfo() : null; },
      changeCursor: async (token, restore) => { track('cursor-change', token, restore); cursorManaged = !restore; return { id: 'cursor', success: true, message: 'Normal pointer verified.' }; },
      setAppCursor: async enabled => { track('cursor-app', enabled); appCursor = enabled; return cursorInfo(); },
      getNvidiaPreset: async () => null, saveNvidiaPreset: async preset => { track('nvidia-save', preset); return preset; }, openNvidiaControlPanel: async () => { track('nvidia-open'); },
      getVisualEffects: async () => [{ id: 'menu-animation', current: !visualManaged, original: visualManaged ? true : null, managed: visualManaged, token: 'visual-review-token' }],
      changeVisualEffect: async (token, restore) => { track('visual-change', token, restore); visualManaged = !restore; return { id: 'menu-animation', success: true, message: 'Visual preference verified.' }; },
      getPointer: async () => ({ supported: true, current: [6, 10, 1], original: null, managed: false, conflict: false, token: 'pointer-review-token' }),
      changePointer: async (token, restore) => { track('pointer-change', token, restore); return { id: 'pointer', success: true, message: 'Pointer change verified.' }; },
      inspectNetwork: async () => { track('network-inspect'); return { timestamp: new Date().toISOString(), notes: [], adapters: [{ index: 7, description: 'Radmin VPN test adapter', status: 'Up', physical: false, defaultRoute: false, linkSpeedBits: 1e9, advanced: [], power: [] }, { index: 8, description: 'Realtek test Ethernet', status: 'Up', physical: true, defaultRoute: true, linkSpeedBits: 5e9, advanced: [{ keyword: '*InterruptModeration', name: 'Interrupt Moderation', value: 'Enabled', options: ['Disabled', 'Enabled'] }], power: [] }] }; },
      testDns: async () => { track('dns-test'); return { timestamp: new Date().toISOString(), hostname: 'www.microsoft.com', resolved: true, elapsedMs: 12, answerCount: 2 }; },
      getManualGames: async () => [], selectGameExecutable: async id => { track('game-select', id); return null; }, clearGameExecutable: async id => { track('game-clear', id); },
      previewRestoreAll: async () => ({ token: 'all-review-token', items: [{ id: 'power', category: 'Power plan', title: 'Windows power plan', original: 'Balanced', current: 'High performance', eligible: true, reason: 'Saved original.' }, { id: 'startup:discord', category: 'Startup entry', title: 'Discord startup', original: 'Original command', current: 'External command', eligible: false, reason: 'External startup entry preserved.' }] }),
      restoreAll: async token => { track('restore-all', token); return [{ id: 'power', success: true, message: 'Original power plan restored and verified.' }, { id: 'startup:discord', success: false, message: 'External startup entry preserved.' }]; },
      getStartupControls: async () => [{ id: 'discord', name: 'Discord', current: 'fixture launcher command', original: null, managed: false, status: 'present', token: 'startup-review-token', reason: 'HKCU Run only.' }],
      changeStartup: async (token, restore) => { track('startup-change', token, restore); return { id: 'discord', success: true, message: 'Startup entry change verified.' }; },
      getPower: async () => ({ supported: true, currentId: '381b4222-f694-41f0-9685-ff5bb260df2e', plans: [{ id: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' }, { id: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', name: 'High performance' }], backup: null, conflict: false }),
      applyPower: async (id, expected) => { track('power-apply', id, expected); return { id: 'power-plan', success: true, message: 'Power plan selected and verified.' }; },
      restorePower: async expected => { track('power-restore', expected); return { id: 'power-plan', success: true, message: 'Original power plan restored.' }; },
      getProfile: async () => ({ selection: null, ownedIds: [], complete: true }),
      previewProfile: async (id, custom) => { track('profile-preview', id, custom); return { token: 'review-token', selection: id ? { id, ids: custom ?? ['game-mode'] } : null, blocked: false, changes: [{ id: 'game-mode', title: 'Windows Game Mode', action: 'apply', reason: 'May offer no measurable benefit.', target: 'HKCU test setting', from: 0, to: 1, restart: 'Reopen game.' }] }; },
      applyProfile: async token => { track('profile-apply', token); return [{ id: 'game-mode', success: true, message: 'Applied and verified.' }]; },
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
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
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
  await page.goto('/');
  // Multiple addInitScript callbacks have no guaranteed execution order.
  // Mutate the installed fixture only after the page has initialized it.
  await page.evaluate(() => {
    window.pandora!.scanCleanup = async () => { throw new Error('The Windows provider is unavailable. No files changed.'); };
  });
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
  await expect(page.getByRole('dialog')).toBeFocused();
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
  await page.getByRole('dialog').getByRole('button', { name: 'Review change', exact: true }).click();
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
  await page.getByRole('button', { name: 'Restore all preferences' }).click();
  await expect(page.getByRole('dialog')).toContainText('Restore 2 managed settings?');
  await expect(page.getByRole('dialog')).toContainText('Not set (remove the added value)');
  await expect(page.getByRole('dialog')).not.toContainText('Already restored');
  await expect(page.getByRole('dialog')).not.toContainText('Failed audit record');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'revert'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Restore all preferences' }).click();
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

test('dashboard recommendations explain measured evidence and only navigate for review', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.evaluate(() => {
    const original = window.pandora!.getSystem;
    window.pandora!.getSystem = async () => {
      const data = await original();
      data.volumes[0].freeBytes = 1e10;
      data.physicalDisks![0].health = 'Warning';
      return data;
    };
  });
  await page.getByRole('button', { name: 'Refresh system' }).click();
  const recommendations = page.getByRole('region', { name: 'Recommendations from your readings' });
  await expect(recommendations).toContainText('1.0% free');
  await expect(recommendations).toContainText('Cleaning files is not a repair');
  await recommendations.screenshot({ path: 'test-results/pandora-insights.png' });
  await recommendations.getByRole('button', { name: 'Review temporary files' }).click();
  await expect(page.getByRole('heading', { name: 'PC Cleaner', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.filter((call: any) => ['clean', 'apply', 'scan'].includes(call.method)))).toHaveLength(0);
});

test('navigation and cleaner remain usable on a scaled narrow desktop', async ({ page }) => {
  await desktopFixture(page);
  await page.setViewportSize({ width: 960, height: 640 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: /PC Cleaner/ }).click();
  await expect(page.getByRole('heading', { name: 'PC Cleaner', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Scan & Clean' }).click();
  await page.getByRole('button', { name: 'Clean selected' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my files' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => (window as any).__calls.filter((call: any) => call.method === 'clean'))).toHaveLength(0);
});


test('frame capture review cancels safely, imports measured FPS, persists provenance and clears it on manual edits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Performance Lab', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Before Average FPS', exact: true }).fill('75');
  await page.getByRole('spinbutton', { name: 'Before Latency', exact: true }).fill('15');
  const file = { name: 'private-game-capture.csv', mimeType: 'text/csv', buffer: Buffer.from('frame_time_ms\n' + Array(1000).fill('10').join('\n')) };
  await page.getByLabel('Choose before frame capture').setInputFiles(file);
  await expect(page.getByRole('dialog')).toContainText('100.00 / 100.00 FPS');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Before Average FPS', exact: true })).toHaveValue('75');
  expect(await page.evaluate(() => localStorage.getItem('pandora.benchmark.v1'))).toBeNull();
  await page.getByLabel('Choose before frame capture').setInputFiles(file);
  await page.getByRole('button', { name: 'Use captured results' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Before Average FPS', exact: true })).toHaveValue('100.00');
  await expect(page.getByRole('spinbutton', { name: 'Before 1% low FPS', exact: true })).toHaveValue('100.00');
  await expect(page.getByRole('spinbutton', { name: 'Before Latency', exact: true })).toHaveValue('15');
  await page.getByRole('button', { name: 'Save measurements' }).click();
  const stored = await page.evaluate(() => localStorage.getItem('pandora.benchmark.v1'));
  expect(JSON.parse(stored!).before.capture.frames).toBe(1000);
  expect(stored).not.toContain('private-game');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Performance Lab', exact: true }).click();
  await expect(page.getByText('Imported capture details', { exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Before Latency', exact: true }).fill('16');
  await expect(page.getByText('Imported capture details', { exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Before Average FPS', exact: true }).fill('120');
  await expect(page.getByText('Imported capture details', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save measurements' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pandora.benchmark.v1')!).before.capture)).toBeUndefined();
});

test('invalid capture preserves measurements and valid after import yields a comparison and source-labelled export', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Performance Lab', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Before Average FPS', exact: true }).fill('50');
  await page.getByLabel('Choose after frame capture').setInputFiles({ name: 'mixed.csv', mimeType: 'text/csv', buffer: Buffer.from('ProcessID,MsBetweenPresents\n1,10\n2,10') });
  await expect(page.getByRole('alert')).toContainText('multiple processes or swap chains');
  await expect(page.getByRole('spinbutton', { name: 'Before Average FPS', exact: true })).toHaveValue('50');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Choose after frame capture').setInputFiles({ name: 'after.csv', mimeType: 'text/csv', buffer: Buffer.from('MsBetweenPresents\n' + Array(100).fill('10').join('\n')) });
  await page.getByRole('button', { name: 'Use captured results' }).click();
  await expect(page.getByText('100.0% higher FPS', { exact: false })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'After Latency', exact: true })).toHaveValue('');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const stream = await (await downloaded).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = Buffer.concat(chunks).toString('utf8');
  expect(exported).toContain('Imported MsBetweenPresents intervals');
  expect(exported).toContain('Manual entry; never inferred from frame intervals');
  await page.screenshot({ path: 'test-results/pandora-performance-import.png', fullPage: true });
});


test('benchmark PC snapshots preserve observed configuration and flag comparison differences', async ({ page }) => {
  await desktopFixture(page);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Performance Lab', exact: true }).click();
  await page.getByRole('button', { name: 'Capture before PC configuration' }).click();
  await expect(page.getByText('Before PC snapshot', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save measurements' }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pandora.benchmark.v1')!).before.context);
  expect(before.cpu).toBe('UI test processor');
  expect(before.powerPlan).toBe('Balanced');
  expect(before.preferences[0].id).toBe('transparency');
  expect(before).not.toHaveProperty('volumes');
  await page.evaluate(() => {
    const get = window.pandora!.getSystem;
    window.pandora!.getSystem = async force => ({ ...await get(force), gpuDriver: 'different-driver', powerPlan: 'Power saver' });
  });
  await page.getByRole('button', { name: 'Capture after PC configuration' }).click();
  await expect(page.getByText(/Recorded conditions differ: GPU driver, Power plan/)).toBeVisible();
  await page.getByRole('button', { name: 'Save measurements' }).click();
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Performance Lab', exact: true }).click();
  await expect(page.getByText(/Recorded conditions differ: GPU driver, Power plan/)).toBeVisible();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await page.getByRole('button', { name: 'Clear measurements', exact: true }).click();
  await expect(page.getByText(/Recorded conditions differ:/)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pandora.benchmark.v1'))).toBeNull();
});

test('power-plan review cancels without writing and sends the reviewed original when confirmed', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Optimizations', exact: true }).click();
  await page.getByLabel('Power plan', { exact: true }).selectOption('8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c');
  await page.getByRole('button', { name: 'Review power-plan change', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('battery life');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'power-apply'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Review power-plan change', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm power-plan change', exact: true }).click();
  await expect(page.getByText('Power plan selected and verified.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'power-apply').args)).toEqual(['8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', '381b4222-f694-41f0-9685-ff5bb260df2e']);
});

test('preset switching requires a fresh reviewed token and blocked conflicts cannot be confirmed', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Game Profiles', exact: true }).click();
  await page.getByLabel('Windows preset').selectOption('competitive');
  await page.getByRole('button', { name: 'Review preset', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Review Competitive FPS');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'profile-apply'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Review preset', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm preset changes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Profile results' })).toContainText('Applied and verified.');
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'profile-apply').args)).toEqual(['review-token']);
  await page.evaluate(() => { const original = window.pandora!.previewProfile; window.pandora!.previewProfile = async (id, custom) => ({ ...await original(id, custom), blocked: true }); });
  await page.getByRole('button', { name: 'Review preset', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm preset changes', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog')).toContainText('Resolve the listed conflicts');
});

test('custom preset review includes only selected preferences and original power-plan conflicts stay protected', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.evaluate(() => {
    const original = window.pandora!.getPower;
    window.pandora!.getPower = async () => ({ ...await original(), conflict: true, backup: { version: 1, originalId: '381b4222-f694-41f0-9685-ff5bb260df2e', appliedId: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', status: 'applied', intent: 'apply', timestamp: new Date().toISOString() } });
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Game Profiles', exact: true }).click();
  await page.getByLabel('Windows preset').selectOption('custom');
  await page.getByRole('checkbox', { name: 'Custom profile: Reduce transparency' }).check();
  await page.getByRole('button', { name: 'Review preset', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'profile-preview').args)).toEqual(['custom', ['transparency']]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Restore & History', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restore original power plan', exact: true })).toBeDisabled();
  await expect(page.getByText('Another app or user changed the active power plan.', { exact: false })).toBeVisible();
});

test('startup controls require confirmation and distinguish disable from exact restoration', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Processes & Startup', exact: true }).click();
  await page.getByRole('button', { name: 'Startup apps', exact: true }).click();
  await page.getByRole('button', { name: 'Disable Discord startup', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('fixture launcher command');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'startup-change'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Disable Discord startup', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm startup disable', exact: true }).click();
  await expect(page.getByText('Startup entry change verified.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'startup-change').args)).toEqual(['startup-review-token', false]);
  await page.evaluate(() => { window.pandora!.getStartupControls = async () => [{ id: 'discord', name: 'Discord', current: null, original: 'original fixture command', managed: true, status: 'disabled', token: 'startup-restore-token', reason: 'Original saved.' }]; });
  await page.getByRole('button', { name: 'Refresh startup controls', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Discord startup', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('original fixture command');
  await page.getByRole('button', { name: 'Confirm startup restore', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'startup-change').at(-1).args)).toEqual(['startup-restore-token', true]);
});

test('game guidance preserves all six supported titles without planned placeholders', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Game Profiles', exact: true }).click();
  await page.getByRole('button', { name: /Apex Legends/ }).click();
  await expect(page.getByText(/repeatable firing-range route/)).toBeVisible();
  await page.getByRole('button', { name: /Call of Duty \/ Warzone/ }).click();
  await expect(page.getByText(/does not prove the Warzone content pack/)).toBeVisible();
  await expect(page.locator('.game-cards .game-card')).toHaveCount(6);
  await expect(page.getByText(/GTA VI|Grand Theft Auto VI/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Grand Theft Auto VI/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/pandora-profiles.png', fullPage: true });
});

test('combined restoration reviews all categories, cancels safely and reports conflicts separately', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /Restore & History/ }).click();
  await page.getByRole('button', { name: 'Review all managed changes' }).click();
  await expect(page.getByRole('dialog')).toContainText('External startup entry preserved.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'restore-all'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Review all managed changes' }).click();
  await page.getByRole('button', { name: 'Restore eligible changes' }).click();
  const results = page.getByRole('region', { name: 'Complete restoration results' });
  await expect(results).toContainText('Original power plan restored and verified.');
  await expect(results).toContainText('External startup entry preserved.');
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'restore-all').args)).toEqual(['all-review-token']);
});

test('manual game locations support picker cancellation, missing paths and forgetting without game changes', async ({ page }) => {
  await desktopFixture(page);
  await page.addInitScript(() => {
    let entry: { id: string; executable: string; available: boolean } | null = null, cancel = true;
    window.pandora!.getManualGames = async () => entry ? [entry] : [];
    window.pandora!.selectGameExecutable = async id => {
      if (cancel) { cancel = false; return null; }
      entry = { id, executable: 'C:\\Games\\Fortnite.exe', available: false }; return entry;
    };
    window.pandora!.clearGameExecutable = async () => { entry = null; };
  });
  await page.goto('/'); await page.getByRole('navigation').getByRole('button', { name: /Game Profiles/ }).click();
  await page.getByRole('button', { name: 'Choose executable', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Forget saved path' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose executable', exact: true }).click();
  await expect(page.getByText('The saved executable is missing', { exact: false })).toBeVisible();
  await expect(page.getByText('C:\\Games\\Fortnite.exe', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Forget saved path' }).click();
  await expect(page.getByText('C:\\Games\\Fortnite.exe', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose executable', exact: true })).toBeVisible();
});

test('adapter capabilities distinguish VPNs and DNS runs only on explicit request', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /Network Diagnostics/ }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => ['network-inspect', 'dns-test'].includes(c.method)))).toHaveLength(0);
  await page.getByRole('button', { name: 'Inspect adapters' }).click();
  await expect(page.getByText('Radmin VPN test adapter')).toBeVisible();
  await expect(page.getByText('VIRTUAL / SOFTWARE', { exact: true })).toBeVisible();
  await expect(page.getByText('No default route reported', { exact: true })).toBeVisible();
  await expect(page.getByText('5.0 Gbps', { exact: true })).toBeVisible();
  await page.getByText('Driver settings and power-management support', { exact: true }).last().click();
  await expect(page.getByText('Interrupt Moderation', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check DNS resolution' }).click();
  await expect(page.getByRole('region', { name: 'DNS results' })).toContainText('2 IPv4 answers, 12.0 ms query duration.');
  await page.screenshot({ path: 'test-results/pandora-network-capabilities.png', fullPage: true });
});

test('pointer acceleration reviews exact API values and cancel never changes Windows', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: /Optimizations/ }).click();
  await page.getByRole('button', { name: 'Review acceleration off' }).click();
  await expect(page.getByRole('dialog')).toContainText('6, 10, 0');
  await expect(page.getByRole('dialog')).toContainText('no FPS benefit is promised');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'pointer-change'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Review acceleration off' }).click();
  await page.getByRole('button', { name: 'Confirm pointer change' }).click();
  await expect(page.getByText('Pointer change verified.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'pointer-change').args)).toEqual(['pointer-review-token', false]);
  await page.locator('.optimization-native-controls').screenshot({ path: 'test-results/pandora-native-controls.png' });
});


test('visual effects show current state, cancel safely and require a reviewed token', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Optimizations', exact: true }).click();
  const card = page.locator('.visual-effects .tweak-card').filter({ hasText: 'Turn off menu animations' });
  await expect(card).toContainText('On');
  await card.getByRole('button', { name: 'Review change' }).click();
  await expect(page.getByRole('dialog')).toContainText('Menu transitions become immediate');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'visual-change'))).toHaveLength(0);
  await card.getByRole('button', { name: 'Review change' }).click();
  await page.getByRole('button', { name: 'Confirm visual change' }).click();
  await expect(page.getByText('Visual preference verified.')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'visual-change').args)).toEqual(['visual-review-token', false]);
  await expect(card).toContainText('Managed · Off');
  await card.getByRole('button', { name: 'Review restore' }).click();
  await page.getByRole('button', { name: 'Confirm visual change' }).click();
  await expect(card).toContainText('On');
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'visual-change').at(-1).args)).toEqual(['visual-review-token', true]);
  await expect(page.locator('.visual-effects .tweak-card')).toHaveCount(7);
  await page.locator('.visual-effects').screenshot({ path: 'test-results/pandora-visual-effects.png' });
});


test('graphics guidance uses detected hardware and opens only reviewed Windows settings', async ({ page }) => {
  await desktopFixture(page);
  await page.addInitScript(() => {
    const base = window.pandora!.getSystem;
    window.pandora!.getSystem = async (...args) => ({ ...await base(...args), gpu: 'NVIDIA GeForce test adapter', gpuDriver: 'fixture-driver' });
  });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Optimizations', exact: true }).click();
  const guidance = page.locator('.graphics-guidance');
  await expect(guidance).toContainText('NVIDIA GeForce test adapter');
  await expect(guidance).toContainText('In games that expose NVIDIA Reflex');
  await expect(guidance).toContainText('144 Hz · 6.94 ms per refresh');
  await expect(guidance).toContainText('not measured input latency');
  await guidance.getByRole('button', { name: 'Open graphics settings' }).click();
  expect(await page.evaluate(() => (window as any).__calls.find((c: any) => c.method === 'windows-settings').args)).toEqual(['graphics']);
  await expect(guidance.getByRole('link', { name: 'Official driver downloads' })).toHaveAttribute('href', 'https://www.nvidia.com/en-us/drivers/');
  await guidance.screenshot({ path: 'test-results/pandora-graphics-guidance.png' });
});


test('NVIDIA reference is searchable, scoped and never presented as an applied preset', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('button', { name: 'NVIDIA Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sonnier’s NVIDIA Setup' })).toBeVisible();
  await expect(page.getByText('Manual review required', { exact: true })).toBeVisible();
  await page.getByLabel('Search NVIDIA settings').fill('Shader Cache');
  await expect(page.locator('.nvidia-setting')).toHaveCount(1);
  await expect(page.locator('.reference-value')).toHaveText('100 GB');
  await page.getByRole('button', { name: 'Per-Game', exact: true }).click();
  await page.getByText('Where to find it', { exact: true }).click();
  await expect(page.locator('.nvidia-setting')).toContainText('Program Settings → select your game');
  await page.getByLabel('Your configuration notes').fill('Record original values before editing.');
  await page.getByRole('button', { name: 'Save personal reference' }).click();
  await page.getByRole('button', { name: 'Open NVIDIA Control Panel', exact: true }).click();
  const calls = await page.evaluate(() => (window as any).__calls);
  expect(calls.filter((c: any) => c.method.startsWith('nvidia-')).map((c: any) => c.method)).toEqual(['nvidia-save', 'nvidia-open']);
});

test('readable typography and NVIDIA cards fit a scaled desktop', async ({ page }) => {
  await desktopFixture(page); await page.setViewportSize({ width: 1100, height: 720 }); await page.goto('/');
  const nav = page.getByRole('button', { name: 'NVIDIA Settings', exact: true });
  expect(await nav.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  await nav.click();
  expect(await page.locator('.nvidia-setting p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  expect(await page.locator('#main-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});

test('cursor customization separates preview, app-only use, confirmed Windows apply and original restoration', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('button', { name: 'Quality of Life', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Selected custom cursor' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose .cur or .ani file' }).click();
  await expect(page.getByRole('heading', { name: 'Cursor Customization' })).toBeVisible();
  await page.getByLabel('Use selected cursor inside PANDORA').check();
  await expect(page.locator('html')).toHaveAttribute('data-personal-cursor', 'true');
  await page.getByRole('button', { name: 'Apply Cursor', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Other roles, including text, busy and resize pointers');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'cursor-change'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Apply Cursor', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cursor change', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply Cursor', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Restore Default', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Saved Windows scheme default');
  await page.getByRole('button', { name: 'Confirm cursor change', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restore Default', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'cursor-change').map((c: any) => c.args))).toEqual([['cursor-review', false], ['cursor-review', true]]);
});

test('cursor provider failure blocks Windows apply and restore instead of showing success', async ({ page }) => {
  await desktopFixture(page); await page.addInitScript(() => { window.pandora!.getCursor = async () => { throw new Error('Cursor backup unreadable. Preserved.'); }; });
  await page.goto('/'); await page.getByRole('button', { name: 'Quality of Life', exact: true }).click();
  await expect(page.locator('.cursor-manager').getByRole('alert')).toContainText('Cursor backup unreadable');
  await expect(page.getByRole('button', { name: 'Apply Cursor', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Restore Default', exact: true })).toBeDisabled();
});

test('advanced power controls review exact values and cancel without changing the plan', async ({ page }) => {
  await desktopFixture(page); await page.goto('/');
  await page.getByRole('button', { name: 'Optimizations', exact: true }).click();
  const card = page.locator('.power-tuning .tweak-card').filter({ has: page.getByRole('heading', { name: 'Maximum processor state', exact: true }) });
  await card.getByLabel('Maximum processor state').selectOption('75');
  await card.getByRole('button', { name: 'Review power change' }).click();
  await expect(page.getByRole('dialog')).toContainText('75%');
  await expect(page.getByRole('dialog')).toContainText('Battery');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'power-tuning-change'))).toHaveLength(0);
  await card.getByRole('button', { name: 'Review power change' }).click();
  await page.getByRole('button', { name: 'Confirm power setting', exact: true }).click();
  await expect(page.locator('.power-tuning')).toContainText('Power value verified.');
  expect(await page.evaluate(() => (window as any).__calls.filter((c: any) => c.method === 'power-tuning-change').map((c: any) => c.args))).toEqual([['power-tuning-review']]);
});
