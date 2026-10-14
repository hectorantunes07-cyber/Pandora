import { deflateSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
export const MAX_CURSOR_BYTES = 2 * 1024 * 1024;
export interface CursorImage { width: number; height: number; x: number; y: number; png: Buffer; frame: Buffer; }
export interface ValidCursor extends CursorImage { kind: 'cur' | 'ani'; hash: string; }
function fail(): never { throw new Error('Unsupported or invalid cursor. Choose a bounded Windows .cur or .ani file with valid images and hotspots.'); }
function crc(data: Buffer) { let c = 0xffffffff; for (const b of data) { c ^= b; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, bytes: Buffer) { const body = Buffer.concat([Buffer.from(type), bytes]), out = Buffer.alloc(bytes.length + 12); out.writeUInt32BE(bytes.length); body.copy(out, 4); out.writeUInt32BE(crc(body), out.length - 4); return out; }
export function rgbaPng(width: number, height: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const scan = Buffer.alloc(height * (width * 4 + 1)); for (let y = 0; y < height; y++) rgba.copy(scan, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(scan)), chunk('IEND', Buffer.alloc(0))]);
}
function image(data: Buffer, width: number, height: number): Buffer {
  if (data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    let at = 8, header = false, ended = false; const compressed: Buffer[] = [];
    while (at + 12 <= data.length) {
      const size = data.readUInt32BE(at), end = at + size + 12; if (end > data.length) fail();
      const type = data.toString('ascii', at + 4, at + 8), value = data.subarray(at + 8, end - 4);
      if (crc(data.subarray(at + 4, end - 4)) !== data.readUInt32BE(end - 4)) fail();
      if (!header && type !== 'IHDR') fail();
      if (type === 'IHDR') { if (header || size !== 13 || value.readUInt32BE() !== width || value.readUInt32BE(4) !== height || value[8] !== 8 || ![2, 6].includes(value[9]) || value[10] || value[11] || value[12]) fail(); header = true; }
      else if (type === 'IDAT') compressed.push(value);
      else if (type === 'IEND') { if (size || end !== data.length) fail(); ended = true; }
      else if (!['sRGB', 'gAMA', 'pHYs', 'tEXt'].includes(type)) fail();
      at = end;
    }
    if (!ended || !compressed.length || at !== data.length) fail();
    const channels = data[25] === 6 ? 4 : 3, expected = height * (1 + width * channels);
    const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
    if (raw.length !== expected) fail(); for (let y = 0; y < height; y++) if (raw[y * (1 + width * channels)] > 4) fail();
    return data;
  }
  if (data.length < 40 || data.readUInt32LE() !== 40 || data.readInt32LE(4) !== width || data.readInt32LE(8) !== height * 2 || data.readUInt16LE(12) !== 1 || data.readUInt32LE(16) !== 0) fail();
  const depth = data.readUInt16LE(14); if (![1, 4, 8, 24, 32].includes(depth)) fail();
  if (depth > 8 && data.readUInt32LE(32)) fail();
  const colors = depth <= 8 ? (data.readUInt32LE(32) || 2 ** depth) : 0; if (colors > 2 ** Math.min(depth, 8)) fail();
  const start = 40 + colors * 4, stride = Math.ceil(width * depth / 32) * 4, maskStride = Math.ceil(width / 32) * 4, mask = start + height * stride;
  if (mask + height * maskStride !== data.length) fail();
  const pixels = Buffer.alloc(width * height * 4);
  let hasAlpha = false; if (depth === 32) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[start + y * stride + x * 4 + 3]) hasAlpha = true;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const row = height - y - 1, dst = (y * width + x) * 4, source = start + row * stride;
    let color: number;
    if (depth <= 8) { const bit = x * depth, index = (data[source + (bit >> 3)] >> (8 - depth - bit % 8)) & (2 ** depth - 1); if (index >= colors) fail(); color = 40 + index * 4; }
    else color = source + x * depth / 8;
    pixels[dst] = data[color + 2]; pixels[dst + 1] = data[color + 1]; pixels[dst + 2] = data[color];
    const transparent = Boolean(data[mask + row * maskStride + (x >> 3)] & (128 >> (x % 8)));
    pixels[dst + 3] = hasAlpha ? data[color + 3] : transparent ? 0 : 255;
  }
  return rgbaPng(width, height, pixels);
}
function cur(data: Buffer, allowIcon = false): CursorImage {
  if (data.length < 22 || data.readUInt16LE() !== 0 || ![2, ...(allowIcon ? [1] : [])].includes(data.readUInt16LE(2))) fail();
  const count = data.readUInt16LE(4); if (!count || count > 64 || 6 + count * 16 > data.length) fail();
  let first: CursorImage | undefined; const spans: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16, width = data[entry] || 256, height = data[entry + 1] || 256, icon = data.readUInt16LE(2) === 1;
    const x = icon ? 0 : data.readUInt16LE(entry + 4), y = icon ? 0 : data.readUInt16LE(entry + 6), size = data.readUInt32LE(entry + 8), offset = data.readUInt32LE(entry + 12);
    if (data[entry + 3] || x >= width || y >= height || !size || offset < 6 + count * 16 || offset + size > data.length || spans.some(([a, b]) => offset < b && offset + size > a)) fail();
    spans.push([offset, offset + size]); const png = image(data.subarray(offset, offset + size), width, height);
    if (!first) { const frame = Buffer.alloc(22 + size); frame.writeUInt16LE(2, 2); frame.writeUInt16LE(1, 4); data.copy(frame, 6, entry, entry + 16); frame.writeUInt16LE(x, 10); frame.writeUInt16LE(y, 12); frame.writeUInt32LE(22, 18); data.copy(frame, 22, offset, offset + size); first = { width, height, x, y, png, frame }; }
  }
  return first!;
}
export function validateCursor(data: Buffer, extension: string): ValidCursor {
  if (!Buffer.isBuffer(data) || data.length < 22 || data.length > MAX_CURSOR_BYTES || !['.cur', '.ani'].includes(extension.toLowerCase())) fail();
  const kind = extension.toLowerCase() === '.ani' ? 'ani' : 'cur'; let first: CursorImage;
  if (kind === 'cur') first = cur(data);
  else {
    if (data.toString('ascii', 0, 4) !== 'RIFF' || data.readUInt32LE(4) + 8 !== data.length || data.toString('ascii', 8, 12) !== 'ACON') fail();
    let header: Buffer | undefined, sequence: Buffer | undefined, rate: Buffer | undefined; const frames: CursorImage[] = [];
    function chunks(start: number, end: number, nested: boolean) {
      let at = start;
      while (at + 8 <= end) {
        const id = data.toString('ascii', at, at + 4), size = data.readUInt32LE(at + 4), next = at + 8 + size, padded = next + (size & 1); if (padded > end) fail();
        const body = data.subarray(at + 8, next);
        if (nested) { if (id !== 'icon' || frames.length >= 64) fail(); frames.push(cur(body, true)); }
        else if (id === 'anih') { if (header || size !== 36) fail(); header = body; }
        else if (id === 'seq ') { if (sequence) fail(); sequence = body; }
        else if (id === 'rate') { if (rate) fail(); rate = body; }
        else if (id === 'LIST' && body.toString('ascii', 0, 4) === 'fram') chunks(at + 12, next, true);
        else if (id === 'LIST' && body.toString('ascii', 0, 4) === 'INFO') {
          let pos = 4; while (pos + 8 <= body.length) { const length = body.readUInt32LE(pos + 4); pos += 8 + length + (length & 1); if (pos > body.length) fail(); } if (pos !== body.length) fail();
        } else if (id !== 'JUNK') fail();
        at = padded;
      }
      if (at !== end) fail();
    }
    chunks(12, data.length, false);
    if (!header || header.readUInt32LE() !== 36 || header.readUInt32LE(4) !== frames.length || !frames.length || header.readUInt32LE(8) < 1 || header.readUInt32LE(8) > 1024 || header.readUInt32LE(12) > 256 || header.readUInt32LE(16) > 256 || ![0, 1, 4, 8, 24, 32].includes(header.readUInt32LE(20)) || header.readUInt32LE(24) > 1 || ![1, 3].includes(header.readUInt32LE(32))) fail();
    const steps = header.readUInt32LE(8), flags = header.readUInt32LE(32);
    if (Boolean(flags & 2) !== Boolean(sequence) || (!sequence && steps !== frames.length) || (sequence && sequence.length !== steps * 4) || (rate && rate.length !== steps * 4) || (!rate && !header.readUInt32LE(28))) fail();
    for (let i = 0; i < steps; i++) if ((sequence && sequence.readUInt32LE(i * 4) >= frames.length) || (rate && !rate.readUInt32LE(i * 4))) fail();
    first = frames[sequence ? sequence.readUInt32LE() : 0];
  }
  return { ...first, kind, hash: createHash('sha256').update(data).digest('hex') };
}
