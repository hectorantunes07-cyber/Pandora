import { describe, expect, it, vi } from 'vitest';
import { createOptionalAppsService, parseOptionalApps, OPTIONAL_APPS_QUERY } from '../electron/optional-apps';
import { OPTIONAL_APPS } from '../shared/optional-apps';
import { windowsSettingsUri } from '../electron/validation';
const fixture = () => ({ entries: OPTIONAL_APPS.map(a => ({ id: a.id, readable: true, packages: [] as any[] })) });
const pkg = (index = 0) => ({ name: OPTIONAL_APPS[index].packageName, family: `${OPTIONAL_APPS[index].packageName}_${OPTIONAL_APPS[index].publisherId}`, version: '1.2.3.4', architecture: 'X64', framework: false, resource: false, protected: false, signature: 'Store', status: 'Ok' });
describe('optional current-user app inventory', () => {
  it('distinguishes verified installed, absent, protected and unreadable entries without retaining private provider fields', () => {
    const raw = fixture(); raw.entries[0].packages.push({ ...pkg(), InstallLocation: 'PRIVATE_SENTINEL', UserSid: 'PRIVATE_SENTINEL' });
    raw.entries[1].packages.push({ ...pkg(1), protected: true }); raw.entries[2].readable = false;
    const info = parseOptionalApps(raw, 0);
    expect(info.timestamp).toBe('1970-01-01T00:00:00.000Z'); expect(info.complete).toBe(false);
    expect(info.entries[0]).toMatchObject({ state: 'installed', packages: [{ version: '1.2.3.4', protected: false }] });
    expect(info.entries[1].packages[0].protected).toBe(true);
    expect(info.entries[2]).toMatchObject({ state: 'unavailable', packages: [] });
    expect(info.entries[3].state).toBe('not-installed'); expect(JSON.stringify(info)).not.toContain('PRIVATE_SENTINEL');
  });
  it.each([
    { name: 'Microsoft.WindowsStore' }, { family: 'Untrusted_publisher' }, { version: '1.2' }, { version: '1.2.3.65536' },
    { architecture: 'Unknown' }, { framework: true }, { resource: true }, { protected: null }, { signature: 'Developer' }, { status: 'PRIVATE\nPATH' },
  ])('does not invent absence or identify an unsupported package as a trusted optional app: %j', patch => {
    const raw = fixture(); raw.entries[0].packages.push({ ...pkg(), ...patch });
    expect(parseOptionalApps(raw).entries[0].state).toBe('unavailable');
    expect(parseOptionalApps(raw).entries[1].state).toBe('not-installed');
  });
  it('rejects missing, duplicate, foreign and excessive registrations', () => {
    const raw = fixture();raw.entries.pop(); expect(() => parseOptionalApps(raw)).toThrow(/incomplete/);
    const duplicate = fixture(); duplicate.entries[1] = duplicate.entries[0]; expect(() => parseOptionalApps(duplicate)).toThrow(/incomplete/);
    const foreign = fixture(); (foreign.entries[0] as any).id = 'store'; expect(() => parseOptionalApps(foreign)).toThrow(/incomplete/);
    const repeated = fixture(); repeated.entries[0].packages = [pkg(), pkg()]; expect(parseOptionalApps(repeated).entries[0].state).toBe('unavailable');
    repeated.entries[0].packages = Array.from({ length: 5 }, () => pkg()); expect(parseOptionalApps(repeated).entries[0].state).toBe('unavailable');
  });
  it('retains distinct registered versions and non-healthy package status without treating registration as launch verification', () => {
    const raw = fixture(); raw.entries[0].packages = [pkg(), { ...pkg(), version: '2.0.0.0', status: 'LicenseIssue' }];
    expect(parseOptionalApps(raw).entries[0]).toMatchObject({ state: 'installed', packages: [{ version: '1.2.3.4' }, { version: '2.0.0.0', status: 'LicenseIssue' }] });
  });
  it('coalesces concurrent reads but refreshes after completion and recovers from provider failure', async () => {
    let finish!: (value: unknown) => void;
    const run = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockRejectedValueOnce(new Error('PRIVATE_SENTINEL')).mockResolvedValue(fixture());
    const service = createOptionalAppsService(run, true), first = service.get(), other = service.get();
    expect(run).toHaveBeenCalledTimes(1); finish(fixture()); expect(await first).toEqual(await other);
    const failed = await service.get(); expect(failed.complete).toBe(false); expect(failed.entries.every(e => e.state === 'unavailable')).toBe(true); expect(JSON.stringify(failed)).not.toContain('PRIVATE_SENTINEL');
    expect((await service.get()).complete).toBe(true); expect(run).toHaveBeenCalledTimes(3);
  });
  it('avoids native execution on unsupported platforms and handles malformed native responses explicitly', async () => {
    const run = vi.fn(); expect((await createOptionalAppsService(run, false).get()).supported).toBe(false); expect(run).not.toHaveBeenCalled();
    const result = await createOptionalAppsService(async () => ({}), true).get(); expect(result.complete).toBe(false); expect(result.entries.every(e => e.state === 'unavailable')).toBe(true);
  });
  it('queries a fixed current-user inventory only and bounds the Windows settings shortcut', () => {
    expect(OPTIONAL_APPS_QUERY).not.toMatch(/Remove-Appx|Add-Appx|AllUsers|Provisioned|InstallLocation|PackageUserInformation/);
    expect(OPTIONAL_APPS_QUERY).toContain('-PackageTypeFilter Main'); expect(OPTIONAL_APPS_QUERY).toContain('Select-Object -First 5');
    expect(windowsSettingsUri('apps')).toBe('ms-settings:appsfeatures');
    for (const id of ['apps?package=evil', 'ms-settings:appsfeatures', 'constructor', '__proto__']) expect(() => windowsSettingsUri(id)).toThrow();
  });
});
