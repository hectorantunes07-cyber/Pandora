export type Capability = 'available' | 'unavailable' | 'unsupported' | 'permission';
export interface SystemInfo {
  platform: string; timestamp: string; cpu: string; logicalCores: number; physicalCores: number | null;
  gpu: string | null; gpuDriver: string | null; ramBytes: number; ramSpeedMHz: number | null;
  os: string; motherboard: string | null; powerPlan: string | null;
  volumes: { name: string; totalBytes: number; freeBytes: number; model?: string }[];
  monitors: { name: string; width: number; height: number; refreshHz: number | null }[];
  installedRamBytes?: number | null;
  deviceType?: 'Desktop' | 'Portable' | 'Unknown';
  bootTime?: string | null;
  physicalDisks?: { model: string; bytes: number | null; media: string; bus: string; health: string | null }[];
  networkAdapters?: { description: string; status: string; linkSpeedBits: number | null }[];
  notes: string[];
}
export interface Metrics { timestamp: string; cpuPercent: number | null; ramUsedBytes: number; ramTotalBytes: number; gpuPercent: number | null; processCount: number | null; }
export interface ProcessInfo { pid: number; name: string; memoryBytes: number; cpuSeconds: number | null; }
export interface StartupEntry { name: string; location: string; status: string; }
export interface StartupControl { id: string; name: string; current: string | null; original: string | null; managed: boolean; status: 'disabled' | 'original-present' | 'conflict' | 'not-present' | 'present' | 'unavailable'; token: string | null; reason: string; }
export interface GameInfo { id: string; name: string; installed: boolean; path: string | null; }
export interface TweakDefinition { id: string; title: string; description: string; category: 'Gaming' | 'Privacy' | 'Quality of life'; risk: 'Low' | 'Moderate'; tradeoff: string; target: string; desiredValue: number; restart: string; reference: string; }
export interface TweakState extends TweakDefinition { state: 'available' | 'applied' | 'already-set' | 'unsupported' | 'unknown' | 'conflict'; currentValue: number | null; managed: boolean; reason?: string; }
export interface OperationResult { id: string; success: boolean; message: string; }
export interface PowerSnapshot { version: 1; originalId: string; appliedId: string; status: 'pending' | 'applied' | 'reverted' | 'conflict' | 'failed'; intent: 'apply' | 'restore'; timestamp: string; }
export interface PowerInfo { supported: boolean; currentId: string | null; plans: { id: string; name: string }[]; backup: PowerSnapshot | null; conflict: boolean; }
export interface HistoryEntry { id: string; tweakId: string; title: string; timestamp: string; status: 'pending' | 'applied' | 'reverted' | 'failed' | 'conflict'; originalValue: number | null; appliedValue: number; message: string; }
export type CleanupKind = 'safe' | 'browser' | 'recycle';
export interface CleanupCategory { id: string; title: string; description: string; bytes: number; fileCount: number; paths: string[]; }
export interface CleanupScan { id: string; kind: CleanupKind; timestamp: string; categories: CleanupCategory[]; warnings: string[]; }
export interface CleanupResult { kind?: CleanupKind; deletedBytes: number; deletedFiles: number; skippedFiles: number; failures: { path: string; reason: string }[]; recoveredBytes: number | null; }
export interface ProgressEvent { operation: 'scan' | 'clean' | 'tweaks'; completed: number; total: number | null; message: string; }
export interface AppSettings { reduceMotion: boolean; pollInterval: number; scanOnLaunch: boolean; }
export type WindowsSettingsPage = 'display' | 'power' | 'startup' | 'graphics';
export type NetworkTarget = 'cloudflare' | 'google';
export interface NetworkResult {
  target: NetworkTarget; address: string; timestamp: string; samples: (number | null)[];
  received: number; lossPercent: number; averageMs: number | null; minMs: number | null; maxMs: number | null; jitterMs: number | null;
}
export interface AppApi {
  getStartupControls(): Promise<StartupControl[]>;
  changeStartup(token: string, restore: boolean): Promise<OperationResult>;
  getPower(): Promise<PowerInfo>;
  applyPower(id: string, expectedCurrent: string): Promise<OperationResult>;
  restorePower(expectedCurrent: string): Promise<OperationResult>;
  getProfile(): Promise<import('./profiles').ProfileStatus>;
  previewProfile(id: import('./profiles').ProfileId | null, customIds?: string[]): Promise<import('./profiles').ProfilePreview>;
  applyProfile(token: string): Promise<OperationResult[]>;
  openWindowsSettings(page: WindowsSettingsPage): Promise<void>;
  testNetwork(target: NetworkTarget): Promise<NetworkResult>;
  getSystem(forceRefresh?: boolean): Promise<SystemInfo>;
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
