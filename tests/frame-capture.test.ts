import { describe, expect, it } from 'vitest';
import { MAX_CAPTURE_BYTES, parseFrameCapture, validFrameCapture } from '../shared/frame-capture';

const csv = (values: number[]) => `frame_time_ms\n${values.join('\n')}\n`;
describe('local frame capture import', () => {
  it('uses reciprocal mean frame time, retains stalls, and uses mean slowest 1% rather than percentile FPS', () => {
    const result = parseFrameCapture(csv([...Array(198).fill(10), 30, 50]));
    expect(result.frames).toBe(200);
    expect(result.durationMs).toBe(2060);
    expect(result.averageFps).toBeCloseTo(200_000 / 2060);
    expect(result.lowFps).toBe(25);
    expect(result.p99Ms).toBe(10);
    expect(result.maxMs).toBe(50);
    expect(Math.max(...result.peaks)).toBe(50);
    expect(validFrameCapture(result)).toBe(true);
  });
  it('supports BOM, CRLF, quoted commas/newlines/escaped quotes and excludes only the initial unmeasured PresentMon event', () => {
    const row = '"game, ""test""\nname.exe",42,0xAB,10';
    const text = '\uFEFFApplication,ProcessID,SwapChainAddress,MsBetweenPresents\r\n' + row.replace(/10$/, '0') + '\r\n' + Array(100).fill(row).join('\r\n');
    const result = parseFrameCapture(text);
    expect(result.frames).toBe(100);
    expect(result.averageFps).toBe(100);
    expect(result.warnings[0]).toMatch(/first PresentMon event/);
    expect(JSON.stringify(result)).not.toContain('game,');
  });
  it('rounds the slowest frame count up and keeps long stalls visible in bounded chart buckets', () => {
    const result = parseFrameCapture(csv([...Array(1000).fill(10), 60_000]));
    expect(result.lowFps).toBeCloseTo(1000 / ((60_000 + 100) / 11));
    expect(result.peaks.length).toBeLessThanOrEqual(180);
    expect(Math.max(...result.peaks)).toBe(60_000);
    expect(result.warnings).toEqual([]);
  });
  it.each(['Application', 'ProcessID', 'SwapChainAddress'])('refuses a mixed %s rather than reporting combined FPS', identity => {
    expect(() => parseFrameCapture(`${identity},frame_time_ms\n${Array(100).fill('a,10').join('\n')}\nb,10`)).toThrow(/multiple processes or swap chains/);
  });
  it.each(['0', '-1', 'NaN', 'Infinity', '0x10', '=10', '', '0.001', '60001'])('rejects invalid or implausible interval %s without filtering it out', invalid => {
    expect(() => parseFrameCapture(`frame_time_ms,note\n${Array(100).fill('10,ok').join('\n')}\n${invalid},bad`)).toThrow(/CSV row/);
  });
  it('refuses zero events after the first PresentMon row', () => {
    expect(() => parseFrameCapture(`MsBetweenPresents\n${Array(100).fill('10').join('\n')}\n0`)).toThrow(/outside/);
  });
  it.each([
    ['time\n10', /exactly one/],
    ['frame_time_ms,MsBetweenPresents\n10,10', /exactly one/],
    ['frame_time_ms,frame_time_ms\n10,10', /duplicate/],
    ['frame_time_ms\n10,10', /different number/],
    ['frame_time_ms\n"10', /unfinished/],
    ['frame_time_ms\n"10"x', /Unexpected text/],
    ['frame_time_ms\n1"0', /Unexpected quote/],
    [csv(Array(99).fill(10)), /At least 100/],
  ])('refuses unsupported or malformed captures', (input, error) => {
    expect(() => parseFrameCapture(input)).toThrow(error);
  });
  it('enforces file, field, column and frame limits', () => {
    expect(() => parseFrameCapture('a'.repeat(MAX_CAPTURE_BYTES + 1))).toThrow(/8 MiB/);
    expect(() => parseFrameCapture('a'.repeat(1025))).toThrow(/too long/);
    expect(() => parseFrameCapture(Array(129).fill('x').join(','))).toThrow(/too many columns/);
    expect(() => parseFrameCapture(csv(Array(250_001).fill(10)))).toThrow(/250,000/);
  });
  it('rejects corrupted stored summaries', () => {
    const capture = parseFrameCapture(csv(Array(100).fill(10)));
    expect(validFrameCapture({ ...capture, peaks: [Infinity] })).toBe(false);
    expect(validFrameCapture({ ...capture, lowFps: 101 })).toBe(false);
    expect(validFrameCapture({ ...capture, warnings: ['x'.repeat(201)] })).toBe(false);
    expect(validFrameCapture(null)).toBe(false);
  });
});
