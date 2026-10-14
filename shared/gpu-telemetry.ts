export interface GpuReading {
  index: number; name: string;
  memoryTotalBytes: number | null; memoryUsedBytes: number | null;
  temperatureC: number | null; powerWatts: number | null;
  graphicsMHz: number | null; utilizationPercent: number | null;
}
export interface GpuTelemetry {
  timestamp: string; provider: 'NVIDIA SMI'; status: 'available' | 'unavailable';
  cached: boolean; devices: GpuReading[]; reason?: string;
}
