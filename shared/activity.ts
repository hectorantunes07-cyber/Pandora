export const ACTIVITY_ACTIONS = {
  'fortnite-change': 'Change or restore Fortnite display preferences',
  apply: 'Apply Windows preferences', revert: 'Restore Windows preferences', clean: 'PC cleanup',
  'profile-apply': 'Change gaming preset', 'power-apply': 'Change power plan', 'power-restore': 'Restore power plan',
  'power-tuning-change': 'Change power-plan policy', 'startup-change': 'Change launcher startup',
  'pointer-change': 'Change pointer acceleration', 'visual-change': 'Change visual preference',
  'cursor-change': 'Change Windows normal cursor', 'cursor-select': 'Select cursor file', 'cursor-app': 'Change in-app cursor',
  'restore-all': 'Restore managed settings', 'system-restore-create': 'Create Windows restore point',
  'app-login-change': 'Change PANDORA sign-in launch', 'save-settings': 'Save app settings',
  'nvidia-save': 'Save personal NVIDIA reference', 'game-select': 'Save manual game location', 'game-clear': 'Forget manual game location',
} as const;
export type ActivityAction = keyof typeof ACTIVITY_ACTIONS;
export interface ActivityEntry {
  id: string; action: ActivityAction; startedAt: string; endedAt: string | null;
  status: 'running' | 'completed' | 'partial' | 'unconfirmed' | 'cancelled';
  succeeded: number | null; notConfirmed: number | null;
  cleanup: { kind: 'safe' | 'browser' | 'recycle'; deletedBytes: number; deletedFiles: number; skippedFiles: number } | null;
}
export interface ActivityInfo {
  available: boolean; entries: ActivityEntry[]; limit: number; discarded: number; clearedAt: string | null; incomplete: boolean; warning: string | null;
}
export interface ActivityClearReview { token: string; count: number; }
export const ACTIVITY_STATUS = { running: 'In progress', completed: 'Completed', partial: 'Partly completed', unconfirmed: 'Not confirmed', cancelled: 'Cancelled' } as const;
