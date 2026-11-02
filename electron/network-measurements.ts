import type { NetworkResult, NetworkTarget } from '../shared/types';
export const NETWORK_TARGETS = { cloudflare: '1.1.1.1', google: '8.8.8.8' } as const;
export function summarizeNetwork(target: NetworkTarget, raw: unknown, now: () => number = Date.now): NetworkResult {
  const samples = (raw as { samples?: unknown })?.samples;
  if (!Array.isArray(samples) || samples.length !== 8 || !samples.every(value => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000))) throw new Error('Windows returned incomplete or invalid network measurements.');
  const received = samples.filter((value): value is number => value !== null);
  const changes = samples.slice(1).flatMap((value, index) => value !== null && samples[index] !== null ? [Math.abs(value - samples[index])] : []);
  return { target, address: NETWORK_TARGETS[target], timestamp: new Date(now()).toISOString(), samples,
    received: received.length, lossPercent: (8 - received.length) / 8 * 100,
    averageMs: received.length ? received.reduce((sum, value) => sum + value, 0) / received.length : null,
    minMs: received.length ? Math.min(...received) : null, maxMs: received.length ? Math.max(...received) : null,
    jitterMs: changes.length ? changes.reduce((sum, value) => sum + value, 0) / changes.length : null };
}
