import { describe, expect, it, vi } from 'vitest';
import { createProcessActivityService, summarizeProcessActivity } from '../electron/process-activity';
const row = (pid = 10, observed = '90071992547409930', cpu = '90071992547409930') => ({ pid, name: 'Fixture', started: '638990000000000000', observed, cpu, memory: 1024 });
const input = () => ({ frequency: '10000000', processorsBefore: 8, processorsAfter: 8, before: { rows: [row()], truncated: false }, after: { rows: [row(10, '90071992567409930', '90071992567409930')], truncated: false } });
describe('measured per-process CPU activity', () => {
  it('uses exact counter differences above Number precision and normalizes to all logical processors', () => {
    expect(summarizeProcessActivity(input(), () => 0)).toMatchObject({ timestamp: '1970-01-01T00:00:00.000Z', logicalProcessors: 8, minIntervalMs: 2000, maxIntervalMs: 2000, rows: [{ cpuPercent: 12.5, intervalMs: 2000, status: 'measured' }] });
  });
  it('keeps real zero CPU separate from unavailable counters', () => {
    const raw = input(); raw.after.rows[0].cpu = raw.before.rows[0].cpu;
    expect(summarizeProcessActivity(raw).rows[0].cpuPercent).toBe(0);
    expect(summarizeProcessActivity({ ...raw, after: { rows: [{ ...raw.after.rows[0], cpu: null }], truncated: false } }).rows[0].cpuPercent).toBeNull();
  });
  it('rejects reused PIDs and missing identity instead of attributing old CPU time to a new process', () => {
    for (const identity of [{ started: '638990000000000001' }, { name: 'Different' }]) {
      const raw = input(); expect(summarizeProcessActivity({ ...raw, after: { rows: [{ ...raw.after.rows[0], ...identity }], truncated: false } }).rows[0]).toMatchObject({ cpuPercent: null, status: 'new-or-replaced' });
    }
    const raw = input(); expect(summarizeProcessActivity({ ...raw, before: { rows: [{ ...raw.before.rows[0], started: null }], truncated: false } }).rows[0].status).toBe('unavailable');
  });
  it('handles new and disappeared IDs and carries snapshot truncation without declaring exit', () => {
    const raw = input(); raw.after.rows[0].pid = 20; raw.before.truncated = true;
    expect(summarizeProcessActivity(raw)).toMatchObject({ noLongerObserved: 1, truncated: true, rows: [{ pid: 20, cpuPercent: null, status: 'new-or-replaced' }] });
  });
  it('does not calculate normalized percentages with an unknown or changing processor count', () => {
    for (const count of [null, 16]) expect(summarizeProcessActivity({ ...input(), processorsAfter: count })).toMatchObject({ logicalProcessors: null, rows: [{ cpuPercent: null, status: 'unavailable' }] });
  });
  it('preserves invalid counters and timing as unavailable rather than clamping them to plausible numbers', () => {
    for (const patch of [{ observed: '90071992547409930' }, { observed: '90071992547409931' }, { observed: '90071993547409930' }, { cpu: '0' }, { cpu: '90071994547409930' }]) {
      const raw = input(); expect(summarizeProcessActivity({ ...raw, after: { rows: [{ ...raw.after.rows[0], ...patch }], truncated: false } }).rows[0]).toMatchObject({ cpuPercent: null, intervalMs: null, status: 'unavailable' });
    }
  });
  it('supports different per-process intervals without imposing a fictitious fixed window', () => {
    const raw = input(); raw.before.rows.push(row(20)); raw.after.rows.push(row(20, '90071992577409930', '90071992567409930'));
    const result = summarizeProcessActivity(raw);
    expect(result.minIntervalMs).toBe(2000); expect(result.maxIntervalMs).toBe(3000); expect(result.rows[1].cpuPercent).toBeCloseTo(100 / 12);
  });
  it('bounds and validates provider data and drops unrecognized private fields', () => {
    const raw = input();
    for (const patch of [{ frequency: '0' }, { frequency: 'NaN' }, { processorsAfter: -1 }, { processorsBefore: 1.5 }, { before: { rows: [row(), row()], truncated: false } }, { before: { rows: Array(513).fill(row()), truncated: false } }, { before: { rows: [{ ...row(), cpu: '9223372036854775808' }], truncated: false } }, { before: { rows: [{ ...row(), name: 'bad\nname' }], truncated: false } }, { before: { rows: [{ ...row(), memory: -1 }], truncated: false } }]) expect(() => summarizeProcessActivity({ ...raw, ...patch })).toThrow();
    const result = summarizeProcessActivity({ ...raw, private: 'PRIVATE', after: { ...raw.after, rows: [{ ...raw.after.rows[0], path: 'PRIVATE', command: 'PRIVATE' }] } });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|638990000000000000|90071992567409930/);
  });
  it('allows empty snapshots without invented aggregate activity', () => {
    expect(summarizeProcessActivity({ ...input(), before: { rows: [], truncated: false }, after: { rows: [], truncated: false } })).toMatchObject({ rows: [], minIntervalMs: null, maxIntervalMs: null, noLongerObserved: 0 });
  });
  it('blocks overlapping requests and releases the guard after failure', async () => {
    let finish!: (value: unknown) => void;
    const run = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockRejectedValueOnce(new Error('provider')).mockResolvedValue(input());
    const service = createProcessActivityService(run), pending = service.sample();
    await expect(service.sample()).rejects.toThrow('already running'); finish(input()); await pending;
    await expect(service.sample()).rejects.toThrow('provider'); expect((await service.sample()).rows[0].status).toBe('measured');
  });
});
