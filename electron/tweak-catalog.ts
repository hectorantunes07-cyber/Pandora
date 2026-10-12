import type { TweakDefinition } from '../shared/types';

/** These are per-user preferences, not a promise of higher FPS. No machine-wide/security settings. */
export interface RegistryTweak extends TweakDefinition { key: string; valueName: string; requireExistingValue?: boolean }

const define = (tweak: Omit<RegistryTweak, 'target' | 'risk'>): RegistryTweak => Object.freeze({
  ...tweak, risk: 'Low', target: `HKEY_CURRENT_USER\\${tweak.key}\\${tweak.valueName} (REG_DWORD)`,
});

export const TWEAK_CATALOG: readonly RegistryTweak[] = Object.freeze([
  define({
    id: 'game-mode', title: 'Windows Game Mode', category: 'Gaming',
    description: 'Enable the current user’s Game Mode preference. Windows can prioritize a recognized game; improvement depends on the workload.',
    key: 'Software\\Microsoft\\GameBar', valueName: 'AutoGameModeEnabled', desiredValue: 1,
    tradeoff: 'May offer no measurable benefit. This preference does not change CPU scheduling, power plans, or security features.',
    restart: 'Close and reopen your game. Confirm the preference in Windows Settings → Gaming → Game Mode.',
    reference: 'https://support.xbox.com/en-US/help/games-apps/game-setup-and-play/use-game-mode-gaming-on-pc',
  }),
  define({
    id: 'game-capture', title: 'Turn off Windows game capture', category: 'Gaming',
    description: 'Disable the current user’s Windows game-capture preference to avoid capture work when you do not record clips.',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', valueName: 'AppCaptureEnabled', desiredValue: 0,
    tradeoff: 'Windows Game Bar recording may be unavailable. Other recording tools and their settings are unchanged. Skip this if you record clips.',
    restart: 'Close and reopen your game and Game Bar. Managed Windows policies can override this preference.',
    reference: 'https://support.xbox.com/en-US/help/games-apps/game-setup-and-play/adjust-capture-settings-windows-10',
  }),
  define({
    id: 'transparency', title: 'Reduce transparency effects', category: 'Quality of life',
    description: 'Use opaque Windows interface surfaces. This is a visual preference, not a guaranteed in-game performance gain.',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', valueName: 'EnableTransparency', desiredValue: 0,
    tradeoff: 'Windows menus and surfaces lose their translucent appearance.',
    restart: 'Some Windows surfaces may need to be reopened or require signing out.',
    reference: 'https://support.microsoft.com/windows/change-colors-in-windows-5a820c2e-bc69-1eb6-f1bc-4e9ff8b5bf3d',
  }),
  define({
    id: 'taskbar-animations', title: 'Reduce taskbar animations', category: 'Quality of life',
    description: 'Disable the per-user taskbar animation preference for a less animated desktop.',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', valueName: 'TaskbarAnimations', desiredValue: 0, requireExistingValue: true,
    tradeoff: 'Taskbar transitions become simpler. Other animations remain unchanged; newer shell versions may ignore this preference.',
    restart: 'Sign out and back in to refresh Windows Explorer. PANDORA does not restart the shell.',
    reference: 'https://support.microsoft.com/windows/tips-to-improve-pc-performance-in-windows-b3b3ef5b-5953-fb6a-2528-4bbed82fba96',
  }),
  define({
    id: 'file-extensions', title: 'Show file extensions', category: 'Quality of life',
    description: 'Show known filename extensions in File Explorer so file types are easier to identify.',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', valueName: 'HideFileExt', desiredValue: 0,
    tradeoff: 'Filenames include their extensions. Renaming an extension can change how a file opens; this is not a performance tweak.',
    restart: 'Open a new File Explorer window; signing out may be required to refresh all windows.',
    reference: 'https://support.microsoft.com/windows/common-file-name-extensions-in-windows-da4a4430-8e76-89c5-59f7-1cdbbc75cb01',
  }),
  define({
    id: 'explorer-checkboxes', title: 'Show file selection checkboxes', category: 'Quality of life',
    description: 'Enable Explorer item checkboxes for clearer selection when using a mouse or touchscreen.',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', valueName: 'AutoCheckSelect', desiredValue: 1,
    tradeoff: 'Adds a checkbox beside files when selected or hovered. This is an accessibility preference, with no claimed FPS benefit.',
    restart: 'Open a new File Explorer window; signing out may be required to refresh all windows.',
    reference: 'https://support.microsoft.com/windows/find-and-open-file-explorer-ef370130-1cca-9dc5-e0df-2f7416fe1cb1',
  }),
  define({
    id: 'advertising-id', title: 'Turn off advertising ID', category: 'Privacy',
    description: 'Turn off the per-user advertising ID preference used by supported Windows apps for personalized advertising.',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\AdvertisingInfo', valueName: 'Enabled', desiredValue: 0, requireExistingValue: true,
    tradeoff: 'Advertisements may be less personalized. This does not block ads, turn off diagnostic data, or increase FPS.',
    restart: 'Reopen affected apps. Organization policy may override the preference.',
    reference: 'https://support.microsoft.com/windows/general-privacy-settings-in-windows-7c7f6a09-cebd-5589-c376-7f505e5bf65a',
  }),
  define({
    id: 'tailored-experiences', title: 'Turn off tailored experiences', category: 'Privacy',
    description: 'Turn off the per-user preference for personalized tips and recommendations based on diagnostic data.',
    key: 'Software\\Microsoft\\Windows\\CurrentVersion\\Privacy', valueName: 'TailoredExperiencesWithDiagnosticDataEnabled', desiredValue: 0, requireExistingValue: true,
    tradeoff: 'Windows suggestions may be less personalized. Diagnostic data collection and all security protections remain unchanged.',
    restart: 'Applies to future supported suggestions. Some newer Windows versions rename or do not expose this setting.',
    reference: 'https://support.microsoft.com/windows/diagnostics-feedback-and-privacy-in-windows-28808a2b-a31b-dd73-dcd3-4559a5199319',
  }),
]);

export const TWEAKS_BY_ID: ReadonlyMap<string, RegistryTweak> = new Map(TWEAK_CATALOG.map(tweak => [tweak.id, tweak]));
