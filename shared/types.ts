export type Capability = 'available' | 'unavailable' | 'unsupported' | 'permission';
export interface SystemInfo {
  platform: string; timestamp: string; cpu: string; logicalCores: number; physicalCores: number | null;
  gpu: string | null; gpuDriver: string | null; ramBytes: number; ramSpeedMHz: number | null;
  os: string; motherboard: string | null; powerPlan: string | null;
  volumes: { name: string; totalBytes: number; freeBytes: number; model?: string }[];
  monitors: { name: string; width: number; height: number; refreshHz: number | null }[];
  notes: string[];
}
export interface Metrics { timestamp: string; cpuPercent: number | null; ramUsedBytes: number; ramTotalBytes: number; gpuPercent: number | null; processCount: number | null; }
export interface ProcessInfo { pid: number; name: string; memoryBytes: number; cpuSeconds: number | null; }
export interface StartupEntry { name: string; location: string; status: string; }
export interface GameInfo { id: string; name: string; installed: boolean; path: string | null; }
export interface TweakDefinition { id: string; title: string; description: string; category: 'Gaming' | 'Privacy' | 'Quality of life'; risk: 'Low' | 'Moderate'; tradeoff: string; target: string; desiredValue: number; restart: string; reference: string; }
export interface TweakState extends TweakDefinition { state: 'available' | 'applied' | 'already-set' | 'unsupported' | 'unknown' | 'conflict'; currentValue: number | null; managed: boolean; reason?: string; }
export interface OperationResult { id: string; success: boolean; message: string; }
export interface HistoryEntry { id: string; tweakId: string; title: string; timestamp: string; status: 'pending' | 'applied' | 'reverted' | 'failed' | 'conflict'; originalValue: number | null; appliedValue: number; message: string; }
export type CleanupKind = 'safe' | 'browser' | 'recycle';
export interface CleanupCategory { id: string; title: string; description: string; bytes: number; fileCount: number; paths: string[]; }
export interface CleanupScan { id: string; kind: CleanupKind; timestamp: string; categories: CleanupCategory[]; warnings: string[]; }
export interface CleanupResult { kind?: CleanupKind; deletedBytes: number; deletedFiles: number; skippedFiles: number; failures: { path: string; reason: string }[]; recoveredBytes: number | null; }
export interface ProgressEvent { operation: 'scan' | 'clean' | 'tweaks'; completed: number; total: number | null; message: string; }
export interface AppSettings { reduceMotion: boolean; pollInterval: number; scanOnLaunch: boolean; }
export interface AppApi {
  getSystem(): Promise<SystemInfo>;
  getMetrics(): Promise<Metrics>;
  getTweaks(): Promise<TweakState[]>;
  applyTweaks(ids: string[]): Promise<OperationResult[]>;
  revertTweaks(ids: string[]): Promise<OperationResult[]>;
  getHistory(): Promise<HistoryEntry[]>;
  scanCleanup(kind: CleanupKind): Promise<CleanupScan>;
  clean(scanId: string, categoryIds: string[], confirmation: CleanupKind): Promise<CleanupResult>;
  getProcesses(): Promise<ProcessInfo[]>;
  getStartup(): Promise<StartupEntry[]>;
  getGames(): Promise<GameInfo[]>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  exportReport(kind: 'system' | 'history'): Promise<string | null>;
  onProgress(callback: (event: ProgressEvent) => void): () => void;
  windowAction(action: 'minimize' | 'maximize' | 'close'): void;
}
declare global { interface Window { pandora?: AppApi } }
