export const PROFILE_DEFINITIONS = [
  { id: 'competitive', title: 'Competitive FPS', description: 'Review Game Mode and disable Windows clip recording when you do not use it.', ids: ['game-mode', 'game-capture'], tradeoff: 'Windows Game Bar recording may become unavailable. No graphics, security or game files are changed.' },
  { id: 'balanced', title: 'Balanced Gaming', description: 'Start with Windows Game Mode while preserving recording and appearance preferences.', ids: ['game-mode'], tradeoff: 'Game Mode may provide no measurable benefit. Existing manual preferences are preserved.' },
  { id: 'streaming', title: 'Streaming + Gaming', description: 'Review Game Mode without disabling your recording tools.', ids: ['game-mode'], tradeoff: 'Restores capture changes owned by a previous PANDORA profile. Manually disabled recording is preserved; review it separately.' },
  { id: 'creator', title: 'Creator', description: 'Show file extensions and item selection checkboxes for clearer project-file handling.', ids: ['file-extensions', 'explorer-checkboxes'], tradeoff: 'Changes File Explorer appearance. Renaming an extension can change how a file opens. No rendering-speed claim.' },
  { id: 'everyday', title: 'Quiet / Everyday', description: 'Review simpler Windows surfaces and fewer taskbar animations.', ids: ['transparency', 'taskbar-animations'], tradeoff: 'Quiet refers to the interface, not fan control. Some shell versions ignore taskbar animations; a sign-out may be needed.' },
  { id: 'custom', title: 'Custom', description: 'Choose from the verified preference catalog; review every proposed change.', ids: [], tradeoff: 'Your selected preferences keep their individual tradeoffs. No power, service or security changes are implied.' },
] as const;
export type ProfileId = typeof PROFILE_DEFINITIONS[number]['id'];
export interface ProfileSelection { id: ProfileId; ids: string[] }
export interface ProfileStatus { selection: ProfileSelection | null; ownedIds: string[]; customIds?: string[]; complete: boolean }
export interface ProfilePreview {
  token: string; selection: ProfileSelection | null; blocked: boolean;
  changes: { id: string; title: string; action: 'apply' | 'restore' | 'keep' | 'skip' | 'conflict'; reason: string; target: string; from: number | null; to: number | null; restart: string }[];
}
