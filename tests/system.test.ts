import { describe, expect, it, vi } from 'vitest';
import type { CpuInfo } from 'node:os';
import path from 'node:path';
import { createSystemService, WindowsProviderError, type SystemDependencies, type WindowsQuery } from '../electron/system';

function cpu(user = 100, idle = 900): CpuInfo[] {
  return [{ model: 'Test CPU', speed: 3200, times: { user, idle, sys: 0, nice: 0, irq: 0 } }];
}

function dependencies(extra: Partial<SystemDependencies> = {}): Partial<SystemDependencies> {
  return { platform: 'linux', cpus: () => cpu(), totalmem: () => 16_000, freemem: () => 4_000,
    now: () => 1_000_000, release: () => 'test-kernel', env: {}, readdir: async () => [],
    readFile: async () => { throw new Error('ENOENT'); }, stat: async () => { throw new Error('ENOENT'); },
    runWindows: async () => { throw new Error('Windows unavailable'); }, ...extra };
}

describe('hardware inventory and telemetry', () => {
  it('reports physical storage, installed RAM and network adapters without sensitive fields', async () => {
    const service = createSystemService(dependencies({ platform: 'win32', runWindows: async () => ({
      cpuReportedMHz: 4200, architecture: '64-bit', installedRamBytes: 32e9, deviceType: 'Portable', bootTime: '1970-01-01T00:05:00Z',
      physicalDisks: [{ model: 'NVMe test drive', bytes: 1e12, media: 'SSD', bus: 'NVMe', health: 'Healthy', serialNumber: 'private' }, { model: '', bytes: -1 }],
      networkAdapters: [{ description: 'Test Ethernet', status: 'Up', linkSpeedBits: 2.5e9, macAddress: 'private', ip: 'private' }],
    }) }));
    const info = await service.getSystem();
    expect(info.installedRamBytes).toBe(32e9);
    expect(info.cpuReportedMHz).toBe(4200); expect(info.architecture).toBe('64-bit');
    expect(info.deviceType).toBe('Portable');
    expect(info.bootTime).toBe('1970-01-01T00:05:00.000Z');
    expect(info.physicalDisks).toEqual([{ model: 'NVMe test drive', bytes: 1e12, media: 'SSD', bus: 'NVMe', health: 'Healthy' }]);
    expect(info.networkAdapters).toEqual([{ description: 'Test Ethernet', status: 'Up', linkSpeedBits: 2.5e9 }]);
    expect(JSON.stringify(info)).not.toContain('private');
  });

  it('keeps invalid extended hardware readings unavailable', async () => {
    const service = createSystemService(dependencies({ platform: 'win32', runWindows: async () => ({
      cpuReportedMHz: -1, architecture: '', installedRamBytes: -1, deviceType: 'fabricated', bootTime: '2099-01-01T00:00:00Z',
      physicalDisks: [{ model: 'Disk', bytes: Infinity }], networkAdapters: [{ description: 'Adapter', linkSpeedBits: -1 }],
    }) }));
    const info = await service.getSystem();
    expect(info).toMatchObject({ cpuReportedMHz: null, architecture: null, installedRamBytes: null, deviceType: 'Unknown', bootTime: null });
    expect(info.physicalDisks?.[0]).toMatchObject({ bytes: null, media: 'Unknown', health: null });
    expect(info.networkAdapters?.[0].linkSpeedBits).toBeNull();
  });

  it('identifies the real development platform without manufacturing Windows hardware', async () => {
    const query = vi.fn();
    const service = createSystemService(dependencies({ runWindows: query }));
    const info = await service.getSystem();
    expect(info).toMatchObject({ platform: 'linux', cpu: 'Test CPU', ramBytes: 16_000,
      os: 'linux test-kernel', gpu: null, physicalCores: null, motherboard: null, monitors: [] });
    expect(info.notes.join(' ')).toContain('Development host');
    expect(query).not.toHaveBeenCalled();
  });

  it('uses deltas across real CPU counters and real RAM values', async () => {
    let snapshot = cpu();
    const service = createSystemService(dependencies({ cpus: () => snapshot,
      readdir: async () => ['1', '25', 'sys', 'self'] }));
    snapshot = cpu(200, 1000);
    expect(await service.getMetrics()).toMatchObject({ cpuPercent: 50, ramUsedBytes: 12_000,
      ramTotalBytes: 16_000, processCount: 2, gpuPercent: null });
    expect((await service.getMetrics()).cpuPercent).toBeNull();
  });

  it('degrades gracefully when Windows CIM providers are unavailable', async () => {
    const service = createSystemService(dependencies({ platform: 'win32' }));
    const info = await service.getSystem();
    expect(info.cpu).toBe('Test CPU');
    expect(info.gpu).toBeNull();
    expect(info.notes.join(' ')).toContain('query failed');
    expect(await service.getMetrics()).toMatchObject({ gpuPercent: null, processCount: null });
  });

  it('explains bounded provider failures without leaking arbitrary process errors', async () => {
    const timed = createSystemService(dependencies({ platform: 'win32', runWindows: async () => { throw new WindowsProviderError('system', 'timeout'); } }));
    expect((await timed.getSystem()).notes).toContain('Windows system provider timed out.');
    const privateError = createSystemService(dependencies({ platform: 'win32', runWindows: async () => { throw new Error('C:\\Users\\private-user\\secret'); } }));
    expect(JSON.stringify(await privateError.getSystem())).not.toContain('private-user');
  });

  it('validates Windows measurements and caches expensive inventory queries', async () => {
    const runner = vi.fn(async () => ({ cpu: 'Actual CPU', physicalCores: 8, gpu: 'Actual GPU', gpuDriver: '12.34',
      ramSpeedMHz: 6000, powerPlan: 'Balanced', os: 'Windows 11', motherboard: 'Board model',
      volumes: [{ name: 'C:', totalBytes: 1000, freeBytes: 250 }, { name: 'Z:', totalBytes: 10, freeBytes: 50 }],
      monitors: [{ name: 'Display controller', width: 1920, height: 1080, refreshHz: 144 }], notes: [] }));
    const service = createSystemService(dependencies({ platform: 'win32', runWindows: runner }));
    const info = await service.getSystem();
    expect(info).toMatchObject({ cpu: 'Actual CPU', physicalCores: 8, ramSpeedMHz: 6000,
      gpu: 'Actual GPU', powerPlan: 'Balanced' });
    expect(info.volumes).toHaveLength(1);
    expect(info.monitors[0].refreshHz).toBe(144);
    await service.getSystem();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith('system');
  });

  it('coalesces concurrent GPU queries and respects the sampling interval', async () => {
    let now = 10_000;
    const runner = vi.fn(async () => ({ gpuPercent: 26, processCount: 123 }));
    const service = createSystemService(dependencies({ platform: 'win32', now: () => now, runWindows: runner }));
    const values = await Promise.all([service.getMetrics(), service.getMetrics()]);
    expect(values.every(value => value.gpuPercent === 26 && value.processCount === 123)).toBe(true);
    expect(runner).toHaveBeenCalledTimes(1);
    now += 3000;
    await service.getMetrics();
    expect(runner).toHaveBeenCalledTimes(1);
    now += 3000;
    await service.getMetrics();
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it('refreshes changed inventory immediately and shares the pending refresh with readers', async () => {
    let release: (value: unknown) => void = () => {};
    const runner = vi.fn().mockResolvedValueOnce({ powerPlan: 'Balanced' })
      .mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const service = createSystemService(dependencies({ platform: 'win32', runWindows: runner }));
    expect((await service.getSystem()).powerPlan).toBe('Balanced');
    const refresh = service.getSystem(true);
    const concurrent = service.getSystem();
    release({ powerPlan: 'Power saver' });
    expect((await refresh).powerPlan).toBe('Power saver');
    expect((await concurrent).powerPlan).toBe('Power saver');
    expect((await service.getSystem()).powerPlan).toBe('Power saver');
    expect(runner).toHaveBeenCalledTimes(2);
    await expect(service.getSystem('true' as any)).rejects.toThrow('Invalid hardware refresh');
    expect(runner).toHaveBeenCalledTimes(2);
  });
});

describe('read-only process and startup inventories', () => {
  it('returns only permitted process fields, sorted by working memory', async () => {
    const runner = vi.fn(async (query: WindowsQuery) => query === 'processes' ? [
      { pid: 3, name: 'Game', memoryBytes: 500, cpuSeconds: 10, commandLine: 'private credential' },
      { pid: 4, name: 'App', memoryBytes: 1000, cpuSeconds: null },
      { pid: -1, name: 'Invalid', memoryBytes: -50 },
    ] : [{ name: 'Launcher', location: 'Current user - Registry', status: 'Disabled', command: 'secret' }]);
    const service = createSystemService(dependencies({ platform: 'win32', runWindows: runner }));
    expect(await service.getProcesses()).toEqual([
      { pid: 4, name: 'App', memoryBytes: 1000, cpuSeconds: null },
      { pid: 3, name: 'Game', memoryBytes: 500, cpuSeconds: 10 },
    ]);
    expect(await service.getStartup()).toEqual([{ name: 'Launcher', location: 'Current user - Registry', status: 'Disabled' }]);
  });

  it('handles Linux processes exiting between enumeration and reading', async () => {
    const service = createSystemService(dependencies({ readdir: async () => ['1', '2', 'self'],
      readFile: async file => { if (file === '/proc/1/status') return 'Name:\tapp\nVmRSS:\t42 kB\n'; throw new Error('Exited'); } }));
    expect(await service.getProcesses()).toEqual([{ pid: 1, name: 'app', memoryBytes: 42 * 1024, cpuSeconds: null }]);
    expect(await service.getStartup()).toEqual([]);
  });

  it('reports Windows provider failures instead of claiming no applications exist', async () => {
    const service = createSystemService(dependencies({ platform: 'win32' }));
    await expect(service.getProcesses()).rejects.toThrow('unavailable');
    await expect(service.getStartup()).rejects.toThrow('No startup settings were changed');
  });
});

describe('game discovery', () => {
  function fixture(files: Record<string, string>, folders: Record<string, string[]>) {
    return dependencies({ platform: 'win32',
      readFile: async file => { if (file in files) return files[file]; throw new Error('ENOENT'); },
      readdir: async file => { if (file in folders) return folders[file]; throw new Error('ENOENT'); },
      stat: async file => {
        if (file in files) return { isFile: () => true, isDirectory: () => false, size: files[file].length };
        if (file in folders) return { isFile: () => false, isDirectory: () => true, size: 0 };
        throw new Error('ENOENT');
      },
    });
  }

  const epic = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
  const steam = 'C:\\Program Files (x86)\\Steam\\steamapps';

  it('requires a real validated executable before reporting an Epic game', async () => {
    const target = 'D:\\Games\\Fortnite\\FortniteGame\\Binaries\\Win64\\FortniteClient-Win64-Shipping.exe';
    const files = {
      [path.win32.join(epic, 'fortnite.item')]: JSON.stringify({ AppName: 'Fortnite', DisplayName: 'Fortnite',
        InstallLocation: 'D:\\Games\\Fortnite', LaunchExecutable: 'FortniteGame/Binaries/Win64/FortniteClient-Win64-Shipping.exe' }),
      [path.win32.join(epic, 'missing.item')]: JSON.stringify({ AppName: 'Missing', DisplayName: 'Missing game',
        InstallLocation: 'D:\\Games\\Missing', LaunchExecutable: 'Game.exe' }),
      [target]: 'executable fixture',
    };
    const service = createSystemService(fixture(files, { [epic]: ['fortnite.item', 'missing.item'] }));
    expect(await service.getGames()).toEqual([{ id: 'fortnite', name: 'Fortnite', installed: true, path: target }]);
  });

  it('rejects executables escaping their installation directory', async () => {
    const files = {
      [path.win32.join(epic, 'bad.item')]: JSON.stringify({ AppName: 'Bad', DisplayName: 'Bad',
        InstallLocation: 'D:\\Games\\Bad', LaunchExecutable: '../../Other.exe' }),
      'D:\\Other.exe': 'exists outside game',
    };
    const service = createSystemService(fixture(files, { [epic]: ['bad.item'] }));
    expect(await service.getGames()).toEqual([]);
  });

  it('detects installed Steam games on a secondary library but rejects partial downloads', async () => {
    const library = 'D:\\SteamLibrary\\steamapps';
    const install = path.win32.join(library, 'common', 'Counter-Strike Global Offensive');
    const files = {
      [path.win32.join(steam, 'libraryfolders.vdf')]: '"libraryfolders" { "1" { "path" "D:\\\\SteamLibrary" } }',
      [path.win32.join(library, 'appmanifest_730.acf')]: '"AppState" { "appid" "730" "name" "Counter-Strike 2" "StateFlags" "4" "installdir" "Counter-Strike Global Offensive" }',
      [path.win32.join(library, 'appmanifest_999.acf')]: '"AppState" { "appid" "999" "name" "Downloading" "StateFlags" "1024" "installdir" "Pending" }',
    };
    const service = createSystemService(fixture(files, { [library]: ['appmanifest_730.acf', 'appmanifest_999.acf'], [install]: [], [path.win32.join(library, 'common', 'Pending')]: [] }));
    expect(await service.getGames()).toEqual([{ id: 'steam:730', name: 'Counter-Strike 2', installed: true, path: install }]);
  });

  it('returns no invented game installations on an empty machine', async () => {
    expect(await createSystemService(fixture({}, {})).getGames()).toEqual([]);
  });
});
