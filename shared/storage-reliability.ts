export interface StorageCounters {
  temperatureC: number | null;
  wearPercent: number | null;
  powerOnHours: number | null;
  // UInt64 counters remain decimal strings to preserve values above 2^53.
  readErrorsTotal: string | null;
  readErrorsCorrected: string | null;
  readErrorsUncorrected: string | null;
  writeErrorsTotal: string | null;
  writeErrorsCorrected: string | null;
  writeErrorsUncorrected: string | null;
}
export interface StorageDeviceReading extends StorageCounters {
  index: number; model: string; media: string; bus: string; bytes: number | null;
  health: 'Healthy' | 'Warning' | 'Unhealthy' | 'Unknown';
  countersStatus: 'reported' | 'unavailable';
  reason: 'provider-unavailable' | 'not-reported' | 'identity-mismatch' | 'ambiguous-response' | null;
}
export interface StorageReliability {
  timestamp: string; provider: 'Windows Storage'; status: 'available' | 'unavailable';
  cached: boolean; truncated: boolean; devices: StorageDeviceReading[]; reason?: string;
}
