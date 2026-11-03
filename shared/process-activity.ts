export interface ProcessActivityRow {
  pid: number; name: string; memoryBytes: number | null;
  cpuPercent: number | null; intervalMs: number | null;
  status: 'measured' | 'new-or-replaced' | 'unavailable';
}
export interface ProcessActivity {
  timestamp: string; logicalProcessors: number | null; rows: ProcessActivityRow[];
  noLongerObserved: number; truncated: boolean; minIntervalMs: number | null; maxIntervalMs: number | null;
}
