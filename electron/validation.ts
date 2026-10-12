export function validateIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50 || !value.every(id => typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(id))) throw new Error('Select valid items to continue.');
  return [...new Set(value)];
}
export function cleanupKind(value: unknown): 'safe' | 'browser' | 'recycle' {
  if (value !== 'safe' && value !== 'browser' && value !== 'recycle') throw new Error('Unknown cleanup category.');
  return value;
}
export function isTrustedRenderer(url: string, packagedUrl: string, devUrl?: string): boolean {
  try { const u = new URL(url); u.hash = ''; const p = new URL(packagedUrl); p.hash = ''; return u.href === p.href || (!!devUrl && u.origin === new URL(devUrl).origin && u.pathname === '/'); } catch { return false; }
}
export function externalDocumentation(url: string): boolean {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && !u.port && ['learn.microsoft.com', 'support.microsoft.com', 'support.xbox.com', 'www.epicgames.com', 'www.nvidia.com', 'www.amd.com'].includes(u.hostname); } catch { return false; }
}

const SETTINGS_PAGES = { display: 'ms-settings:display-advanced', power: 'ms-settings:powersleep', startup: 'ms-settings:startupapps', graphics: 'ms-settings:display-advancedgraphics' } as const;
export function windowsSettingsUri(value: unknown): string {
  if (typeof value !== 'string' || !Object.hasOwn(SETTINGS_PAGES, value)) throw new Error('Unknown Windows settings page.');
  return SETTINGS_PAGES[value as keyof typeof SETTINGS_PAGES];
}
