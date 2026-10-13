/** Documented SystemParametersInfo BOOL preferences. No gaming-performance claim. */
export const VISUAL_EFFECTS = [
  { id: 'client-animation', title: 'Reduce window content animations', description: 'Disable animations inside Windows applications that respect the system preference.', tradeoff: 'Supported app content changes without animation. Apps with their own animation settings may be unaffected.', get: 0x1042, set: 0x1043 },
  { id: 'menu-animation', title: 'Turn off menu animations', description: 'Open supported Windows menus without sliding or fading.', tradeoff: 'Menu transitions become immediate. Modern apps may use their own effects.', get: 0x1002, set: 0x1003 },
  { id: 'combo-animation', title: 'Turn off drop-down animations', description: 'Remove the slide-open effect from standard Windows combo boxes.', tradeoff: 'Supported drop-down lists open without animation.', get: 0x1004, set: 0x1005 },
  { id: 'list-smoothing', title: 'Turn off list scrolling effects', description: 'Disable smooth scrolling in standard Windows list boxes.', tradeoff: 'Lists scroll in steps. Browser scrolling and game camera movement are unchanged.', get: 0x1006, set: 0x1007 },
  { id: 'tooltip-animation', title: 'Turn off tooltip animations', description: 'Show supported Windows tooltips without sliding or fading.', tradeoff: 'Tooltips still appear; only their animation changes.', get: 0x1016, set: 0x1017 },
  { id: 'selection-fade', title: 'Turn off menu selection fading', description: 'Remove the brief fade after choosing a supported menu item.', tradeoff: 'Selected menu items disappear immediately. The effect depends on display mode and app support.', get: 0x1014, set: 0x1015 },
  { id: 'cursor-shadow', title: 'Turn off pointer shadow', description: 'Remove the Windows pointer shadow where supported.', tradeoff: 'The pointer may be harder to see on some backgrounds. Mouse sensitivity and latency are unchanged.', get: 0x101a, set: 0x101b },
] as const;
export type VisualEffectId = typeof VISUAL_EFFECTS[number]['id'];
export interface VisualEffectState { id: VisualEffectId; current: boolean | null; original: boolean | null; managed: boolean; token: string | null; reason?: string; }
export const VISUAL_EFFECTS_REFERENCE = 'https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfow';
