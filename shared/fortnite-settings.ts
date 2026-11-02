export const FORTNITE_QUALITY = [
  { id: 'viewDistance', key: 'sg.ViewDistanceQuality', title: 'View distance', description: 'Lower levels can reduce distant object detail and draw work. Visibility and object transitions can change; check the competitive modes you play.' },
  { id: 'antiAliasing', key: 'sg.AntiAliasingQuality', title: 'Anti-aliasing quality', description: 'Lower levels can reduce smoothing work but increase jagged edges and shimmer. The selected rendering mode or upscaler may override this group.' },
  { id: 'shadows', key: 'sg.ShadowQuality', title: 'Shadow quality', description: 'Lower levels can reduce shadow detail and GPU work. Lighting features and rendering mode determine the actual effect.' },
  { id: 'postProcessing', key: 'sg.PostProcessQuality', title: 'Post-processing quality', description: 'Controls supported post-processing effects. Lower settings can reduce image effects and GPU work; the game may override individual effects.' },
  { id: 'textures', key: 'sg.TextureQuality', title: 'Texture quality', description: 'Lower levels can reduce texture detail and memory pressure. Available VRAM, texture streaming and downloaded assets affect results.' },
  { id: 'effects', key: 'sg.EffectsQuality', title: 'Effects quality', description: 'Lower levels can reduce supported visual effects and their rendering cost. Check readability during busy scenes.' },
  { id: 'foliage', key: 'sg.FoliageQuality', title: 'Foliage quality', description: 'Adjusts supported foliage detail and density. Some competitive modes or maps control this independently.' },
  { id: 'shading', key: 'sg.ShadingQuality', title: 'Shading quality', description: 'Controls supported material and shading detail. The active rendering mode determines which changes take effect.' },
] as const;
export type FortniteQualityField = typeof FORTNITE_QUALITY[number]['id'];
export type FortniteValues = { frameRateLimit: number; vsync: boolean; dynamicResolution: boolean } & Partial<Record<FortniteQualityField, number>>;
export type FortniteField = keyof FortniteValues;
export const FORTNITE_BASE_FIELDS = ['frameRateLimit', 'vsync', 'dynamicResolution'] as const;
export const FORTNITE_FIELDS: readonly FortniteField[] = [...FORTNITE_BASE_FIELDS, ...FORTNITE_QUALITY.map(v => v.id)];
export const FORTNITE_LABELS: Record<FortniteField, string> = { frameRateLimit: 'Frame rate limit', vsync: 'V-Sync', dynamicResolution: 'Dynamic resolution', ...Object.fromEntries(FORTNITE_QUALITY.map(v => [v.id, v.title])) } as Record<FortniteField, string>;
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
export const FORTNITE_QUALITY_LEVELS = ['Low', 'Medium', 'High', 'Epic'] as const;
export function validFortniteValues(value: unknown): value is FortniteValues {
  const v = value as FortniteValues;
  return Boolean(v && typeof v === 'object' && !Array.isArray(v) && FORTNITE_BASE_FIELDS.every(key => Object.hasOwn(v, key)) &&
    Object.keys(v).every(key => FORTNITE_FIELDS.includes(key as FortniteField)) &&
    typeof v.frameRateLimit === 'number' && Number.isFinite(v.frameRateLimit) && v.frameRateLimit >= 0 && v.frameRateLimit <= 1000 &&
    typeof v.vsync === 'boolean' && typeof v.dynamicResolution === 'boolean' &&
    FORTNITE_QUALITY.every(({ id }) => !Object.hasOwn(v, id) || (Number.isInteger(v[id]) && v[id]! >= 0 && v[id]! <= 4)));
}
export function fortniteValueLabel(key: FortniteField, value: number | boolean | undefined): string {
  if (value === undefined) return 'Unavailable';
  if (key === 'frameRateLimit') return value === 0 ? 'Unlimited' : `${value} FPS`;
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  return FORTNITE_QUALITY_LEVELS[value] ?? `Cinematic (${value}, stored)`;
}
export function fortniteSummary(v: FortniteValues | null, fields: readonly FortniteField[] = FORTNITE_FIELDS): string {
  return v ? fields.filter(key => v[key] !== undefined).map(key => `${FORTNITE_LABELS[key]}: ${fortniteValueLabel(key, v[key])}`).join(' · ') || 'Unavailable' : 'Unavailable';
}
