import { describe, expect, it } from 'vitest';
import { createOptionalAppsService, parseOptionalApps, queryOptionalApps } from '../electron/optional-apps';
import { OPTIONAL_APPS } from '../shared/optional-apps';
describe.skipIf(process.platform !== 'win32')('native read-only optional-app inventory', () => {
  it('executes the Windows Appx query without removing packages or exposing private package paths', async () => {
    const raw = await queryOptionalApps();
    const result = parseOptionalApps(raw);
    expect(result.supported).toBe(true); expect(result.entries).toHaveLength(OPTIONAL_APPS.length);
    expect(result.entries.every(e => ['installed', 'not-installed', 'unavailable'].includes(e.state))).toBe(true);
    // Server images may have no Appx provider/optional apps. Unknown remains unknown;
    // physical Windows client registrations are a separate validation requirement.
    expect(JSON.stringify(raw)).not.toMatch(/InstallLocation|UserSid|PackageUserInformation/);
    expect((await createOptionalAppsService().get()).entries).toHaveLength(OPTIONAL_APPS.length);
  }, 70_000);
});
