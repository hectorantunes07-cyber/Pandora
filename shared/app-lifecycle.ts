export interface AppLifecycleState {
  traySupported: boolean;
  login: { supported: boolean; state: 'absent' | 'owned' | 'conflict' | 'unavailable'; approved: boolean | null; token: string | null; reason: string };
}
