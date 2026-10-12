import { expect, it } from 'vitest';
import { windowsSettingsUri } from '../electron/validation';
it('opens only known Windows Settings destinations', () => {
  expect(windowsSettingsUri('display')).toBe('ms-settings:display-advanced');
  expect(windowsSettingsUri('power')).toBe('ms-settings:powersleep');
  expect(windowsSettingsUri('startup')).toBe('ms-settings:startupapps');
  for (const value of ['constructor', '__proto__', 'file:///C:/run.exe', 'https://example.com', 'ms-settings:display', { page: 'power' }, null]) expect(() => windowsSettingsUri(value)).toThrow('Unknown Windows settings');
});
