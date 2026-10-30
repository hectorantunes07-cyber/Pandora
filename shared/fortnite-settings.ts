export interface FortniteValues { frameRateLimit: number; vsync: boolean; dynamicResolution: boolean; }
export type FortniteField = keyof FortniteValues;
export const FORTNITE_FIELDS = ['frameRateLimit', 'vsync', 'dynamicResolution'] as const;
export const FORTNITE_LABELS = { frameRateLimit: 'Frame rate limit', vsync: 'V-Sync', dynamicResolution: 'Dynamic resolution' } as const;
export interface FortniteInfo {
  supported: boolean; current: FortniteValues | null; original: FortniteValues | null;
  managed: boolean; conflict: boolean; running: boolean | null; canChange: boolean;
  managedFields: FortniteField[];
  reason: string | null;
}
export interface FortniteReview {
  token: string; restore: boolean; current: FortniteValues; desired: FortniteValues;
}
export const FORTNITE_FRAME_CAPS = [0, 60, 120, 144, 165, 180, 200, 240, 300, 360, 480, 500] as const;
export function validFortniteValues(value: unknown): value is FortniteValues {
  const v = value as FortniteValues;
  return Boolean(v && typeof v === 'object' && Object.keys(v).length === 3 &&
    typeof v.frameRateLimit === 'number' && Number.isFinite(v.frameRateLimit) && v.frameRateLimit >= 0 && v.frameRateLimit <= 1000 &&
    typeof v.vsync === 'boolean' && typeof v.dynamicResolution === 'boolean');
}
export function fortniteSummary(v: FortniteValues | null, fields: readonly FortniteField[] = FORTNITE_FIELDS): string {
  return v ? fields.map(key => `${FORTNITE_LABELS[key]}: ${key === 'frameRateLimit' ? v[key] === 0 ? 'Unlimited' : `${v[key]} FPS` : v[key] ? 'On' : 'Off'}`).join(' · ') : 'Unavailable';
}
