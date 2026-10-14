export interface WindowsRestorePoint { sequence: number; description: string; createdAt: string | null; }
export interface SystemRestoreInfo { supported: boolean; readable: boolean; points: WindowsRestorePoint[]; reason?: string; }
export interface RestorePointReview { token: string; description: string; }
export type RestorePointOutcome = 'created' | 'cancelled' | 'unconfirmed' | 'failed' | 'unsupported';
