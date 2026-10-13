// Capture imports are local data, never commands or inferred hardware readings.
export const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;
const MAX_FRAMES = 250_000;
export interface FrameCapture {
  source: 'frame_time_ms' | 'MsBetweenPresents';
  frames: number;
  durationMs: number;
  averageFps: number;
  lowFps: number;
  p99Ms: number;
  maxMs: number;
  peaks: number[];
  warnings: string[];
}

// Strict RFC-style comma-separated fields, including escaped quotes and CRLF.
// Bounds apply even to ignored columns so malformed files cannot grow unchecked.
function* csvRows(text: string): Generator<string[], void, unknown> {
  let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === undefined) throw new Error('The CSV contains an unfinished quoted field.');
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += c;
    } else if (c === ',' || c === '\r' || c === '\n' || c === undefined) {
      row.push(cell); cell = ''; closed = false;
      if (row.length > 128) throw new Error('The CSV has too many columns.');
      if (c !== ',') {
        if (row.some(value => value.trim() !== '')) yield row;
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (closed) {
      if (c !== ' ' && c !== '\t') throw new Error('Unexpected text after a quoted CSV field.');
    } else if (c === '"') {
      if (cell.length) throw new Error('Unexpected quote inside a CSV field.');
      quoted = true;
    } else cell += c;
    if (cell.length > 1024) throw new Error('A CSV field is too long.');
  }
}

export function parseFrameCapture(text: string): FrameCapture {
  if (text.length > MAX_CAPTURE_BYTES) throw new Error('Choose a capture no larger than 8 MiB.');
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const first = rows.next();
  if (first.done) throw new Error('The capture is empty.');
  const header = first.value.map(value => value.trim().toLowerCase());
  if (new Set(header).size !== header.length) throw new Error('The CSV has duplicate column names.');
  const supported = ['frame_time_ms', 'msbetweenpresents'];
  const metrics = header.filter(name => supported.includes(name));
  if (metrics.length !== 1) throw new Error('Use exactly one frame_time_ms or MsBetweenPresents column, with frame intervals in milliseconds.');
  const column = header.indexOf(metrics[0]);
  const identityColumns = ['application', 'processid', 'swapchainaddress'].map(name => header.indexOf(name)).filter(index => index >= 0);
  let identity: string | undefined, skippedFirst = false, rowNumber = 1;
  const intervals: number[] = [];
  for (const row of rows) {
    rowNumber++;
    if (row.length !== header.length) throw new Error(`CSV row ${rowNumber} has a different number of columns. No results were imported.`);
    const stream = JSON.stringify(identityColumns.map(index => row[index].trim()));
    if (identity !== undefined && stream !== identity) throw new Error('This capture contains multiple processes or swap chains. Export one game process and one swap chain before importing.');
    identity = stream;
    const raw = row[column].trim();
    // PresentMon's first event may have no previous present. Never discard other
    // zeros, dropped frames, stalls or outliers to make a capture look faster.
    if (rowNumber === 2 && metrics[0] === 'msbetweenpresents' && (raw === '' || raw === '0' || /^0\.0+$/.test(raw))) {
      skippedFirst = true; continue;
    }
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) throw new Error(`CSV row ${rowNumber} needs a positive numeric frame interval in milliseconds.`);
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0.01 || value > 60_000) throw new Error(`CSV row ${rowNumber} has a frame interval outside 0.01–60,000 ms. Check the units; no results were imported.`);
    intervals.push(value);
    if (intervals.length > MAX_FRAMES) throw new Error('Choose a capture with no more than 250,000 frames.');
  }
  if (intervals.length < 100) throw new Error('At least 100 valid frame intervals are required to calculate a 1% low.');
  const ordered = [...intervals].sort((a, b) => b - a);
  const durationMs = intervals.reduce((total, ms) => total + ms, 0);
  const slowCount = Math.ceil(intervals.length * 0.01);
  const slowMean = ordered.slice(0, slowCount).reduce((total, ms) => total + ms, 0) / slowCount;
  const peaks: number[] = [];
  const bucketSize = Math.ceil(intervals.length / 180);
  for (let start = 0; start < intervals.length; start += bucketSize) {
    let peak = 0;
    for (let i = start; i < Math.min(start + bucketSize, intervals.length); i++) peak = Math.max(peak, intervals[i]);
    peaks.push(peak);
  }
  const averageFps = intervals.length * 1000 / durationMs;
  return {
    source: metrics[0] === 'msbetweenpresents' ? 'MsBetweenPresents' : 'frame_time_ms',
    frames: intervals.length, durationMs, averageFps,
    lowFps: Math.min(averageFps, 1000 / slowMean), p99Ms: ordered[intervals.length - Math.ceil(intervals.length * 0.99)], maxMs: ordered[0], peaks,
    warnings: [
      ...(skippedFirst ? ['The first PresentMon event had no previous interval and was excluded.'] : []),
      ...(intervals.length < 1000 ? ['This short capture has fewer than 1,000 frames; repeat with a longer run for a more stable 1% low.'] : []),
    ],
  };
}

export function validFrameCapture(value: unknown): value is FrameCapture {
  if (!value || typeof value !== 'object') return false;
  const v = value as FrameCapture;
  return ['frame_time_ms', 'MsBetweenPresents'].includes(v.source) && Number.isInteger(v.frames) && v.frames >= 100 && v.frames <= MAX_FRAMES
    && [v.durationMs, v.averageFps, v.lowFps, v.p99Ms, v.maxMs].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)
    && v.averageFps <= 100_000 && v.lowFps <= v.averageFps && v.maxMs <= 60_000 && v.p99Ms <= v.maxMs
    && Array.isArray(v.peaks) && v.peaks.length > 0 && v.peaks.length <= 180 && v.peaks.every(n => Number.isFinite(n) && n > 0 && n <= v.maxMs)
    && Array.isArray(v.warnings) && v.warnings.length <= 2 && v.warnings.every(w => typeof w === 'string' && w.length <= 200);
}
