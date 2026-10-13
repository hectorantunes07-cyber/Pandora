import type { SystemInfo, TweakState } from './types';

export interface BenchmarkContext {
  capturedAt: string;
  inventoryAt: string;
  cpu: string;
  gpu: string | null;
  gpuDriver: string | null;
  ramBytes: number;
  os: string;
  powerPlan: string | null;
  displays: string[];
  preferences: { id: string; value: number | null; state: TweakState['state'] }[];
}

export function captureBenchmarkContext(info: SystemInfo, tweaks: TweakState[], now = new Date()): BenchmarkContext {
  // Fixed schema: no installation paths, serials, usernames, addresses or raw commands.
  return {
    capturedAt: now.toISOString(), inventoryAt: info.timestamp, cpu: info.cpu, gpu: info.gpu,
    gpuDriver: info.gpuDriver, ramBytes: info.ramBytes, os: info.os, powerPlan: info.powerPlan,
    displays: info.monitors.map(m => `${m.width} × ${m.height} · ${m.refreshHz ?? 'unknown'} Hz`).sort(),
    preferences: tweaks.map(t => ({ id: t.id, value: t.currentValue, state: t.state })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function validBenchmarkContext(value: unknown): value is BenchmarkContext {
  if (!value || typeof value !== 'object') return false;
  const v = value as BenchmarkContext;
  const text = (s: unknown): s is string => typeof s === 'string' && s.length <= 500;
  return text(v.capturedAt) && Number.isFinite(Date.parse(v.capturedAt)) && text(v.inventoryAt) && Number.isFinite(Date.parse(v.inventoryAt))
    && text(v.cpu) && text(v.os) && [v.gpu, v.gpuDriver, v.powerPlan].every(s => s === null || text(s))
    && typeof v.ramBytes === 'number' && Number.isFinite(v.ramBytes) && v.ramBytes > 0
    && Array.isArray(v.displays) && v.displays.length <= 32 && v.displays.every(text)
    && Array.isArray(v.preferences) && v.preferences.length <= 100 && v.preferences.every(t => t && text(t.id)
      && (t.value === null || (Number.isInteger(t.value) && t.value >= 0 && t.value <= 0xffffffff))
      && ['available', 'applied', 'already-set', 'unsupported', 'unknown', 'conflict'].includes(t.state));
}

export function contextDifferences(before?: BenchmarkContext, after?: BenchmarkContext): string[] {
  if (!before || !after) return [];
  const differences: string[] = [];
  for (const [key, label] of [['cpu', 'CPU'], ['gpu', 'GPU'], ['gpuDriver', 'GPU driver'], ['ramBytes', 'Usable memory'], ['os', 'Windows version'], ['powerPlan', 'Power plan']] as const) {
    if (before[key] !== after[key]) differences.push(label);
  }
  if (JSON.stringify(before.displays) !== JSON.stringify(after.displays)) differences.push('Display mode');
  // Compare effective readings/availability, not whether PANDORA happens to own
  // the unchanged value. Unknown providers do not imply a verified setting change.
  const settings = (c: BenchmarkContext) => c.preferences.map(t => [t.id, t.value, ['unsupported', 'unknown', 'conflict'].includes(t.state) ? t.state : 'read']);
  if (JSON.stringify(settings(before)) !== JSON.stringify(settings(after))) differences.push('Preference values or availability');
  return differences;
}

export function contextRows(context: BenchmarkContext): string[][] {
  return [
    ['Snapshot recorded', context.capturedAt], ['Hardware read', context.inventoryAt], ['CPU', context.cpu],
    ['GPU', context.gpu ?? 'Unavailable'], ['GPU driver', context.gpuDriver ?? 'Unavailable'],
    ['Usable RAM bytes', String(context.ramBytes)], ['Operating system', context.os], ['Power plan', context.powerPlan ?? 'Unavailable'],
    ['Display modes', context.displays.join('; ') || 'Unavailable'],
    ...context.preferences.map(t => [`Preference ${t.id}`, `${t.state}: ${t.value ?? 'not set / unavailable'}`]),
  ];
}
