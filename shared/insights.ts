import type { Metrics, SystemInfo, TweakState } from './types';

export type InsightRoute = 'PC Cleaner' | 'System Monitor' | 'Processes & Startup' | 'Optimizations';
export interface SystemInsight { id: string; title: string; evidence: string; guidance: string; route: InsightRoute; action: string; }

/** Read-only rules. No health score, estimated gain, or automatic mutation. */
export function systemInsights(system: SystemInfo | null, metrics: Metrics | null, tweaks: TweakState[]): SystemInsight[] {
  if (!system || system.platform !== 'win32') return [];
  const items: SystemInsight[] = [];
  for (const [index, volume] of system.volumes.entries()) {
    if (!Number.isFinite(volume.totalBytes) || volume.totalBytes <= 0 || !Number.isFinite(volume.freeBytes) || volume.freeBytes < 0 || volume.freeBytes > volume.totalBytes) continue;
    const freePercent = volume.freeBytes / volume.totalBytes * 100;
    if (freePercent < 10) items.push({ id: `disk-${index}`, title: 'Review free disk space', evidence: `${volume.name} has ${freePercent.toFixed(1)}% free. This rule flags less than 10% free space.`, guidance: 'Preview safe temporary files in PC Cleaner. Review installed apps separately; PANDORA does not delete personal files to free space.', route: 'PC Cleaner', action: 'Review temporary files' });
  }
  if (metrics && Number.isFinite(metrics.ramTotalBytes) && metrics.ramTotalBytes > 0 && Number.isFinite(metrics.ramUsedBytes) && metrics.ramUsedBytes >= 0 && metrics.ramUsedBytes <= metrics.ramTotalBytes) {
    const used = metrics.ramUsedBytes / metrics.ramTotalBytes * 100;
    if (used >= 90) items.push({ id: 'memory', title: 'Review memory use', evidence: `${used.toFixed(1)}% of usable memory was in use in the latest sample.`, guidance: 'A single sample can be temporary. Review running apps and close unneeded apps yourself. PANDORA does not kill processes or promise a memory boost.', route: 'Processes & Startup', action: 'Review running apps' });
  }
  for (const [index, disk] of (system.physicalDisks || []).entries()) {
    if (disk.health === 'Warning' || disk.health === 'Unhealthy') items.push({ id: `health-${index}`, title: 'Storage reports a warning', evidence: `${disk.model}: Windows reports ${disk.health}.`, guidance: 'Back up important files and use the drive manufacturer’s diagnostics. Cleaning files is not a repair. Provider status alone cannot diagnose a failing drive.', route: 'System Monitor', action: 'Review storage details' });
  }
  if (system.monitors.some(display => display.refreshHz !== null && Number.isFinite(display.refreshHz) && display.refreshHz > 0 && display.refreshHz <= 60)) items.push({ id: 'display', title: 'Review your display mode', evidence: 'An active video controller reports a refresh rate of 60 Hz or lower.', guidance: 'Check supported modes in Windows Display settings if you expect a higher refresh rate. This reading does not establish your monitor’s maximum rate.', route: 'System Monitor', action: 'Review display details' });
  if (system.gpu && !system.gpuDriver) items.push({ id: 'driver', title: 'GPU driver data is unavailable', evidence: 'Graphics hardware was reported, but its driver version was not.', guidance: 'Refresh the hardware inventory and compare it with Windows Device Manager. Missing provider data does not prove that your driver is outdated.', route: 'System Monitor', action: 'Review hardware details' });
  if (tweaks.some(tweak => tweak.id === 'game-mode' && tweak.state === 'available')) items.push({ id: 'game-mode', title: 'Review Windows Game Mode', evidence: 'The current Game Mode preference is eligible for a reviewed change.', guidance: 'Read its tradeoffs and save the original before applying. Measure your game under repeatable conditions; this recommendation does not establish an FPS gain.', route: 'Optimizations', action: 'Review gaming preferences' });
  return items;
}
