import { TextDecoder } from 'node:util';
import type { FortniteValues, FortniteField } from '../shared/fortnite-settings';
import { validFortniteValues } from '../shared/fortnite-settings';

export const MAX_FORTNITE_CONFIG = 128 * 1024;
const section = '/script/fortnitegame.fortgameusersettings';
const fields = { frameratelimit: 'frameRateLimit', busevsync: 'vsync', busedynamicresolution: 'dynamicResolution' } as const;
type Key = keyof typeof fields;

/** Preserve all bytes outside the three existing scalar values. Never create keys or sections. */
export function parseFortniteConfig(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_FORTNITE_CONFIG) throw new Error('The Fortnite configuration is empty or too large.');
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
  const bom = utf16 ? 2 : bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? 3 : 0;
  if ((utf16 && (bytes.length - 2) % 2) || (bytes[0] === 0xfe && bytes[1] === 0xff)) throw new Error('Unsupported Fortnite configuration encoding.');
  let text: string;
  try { text = new TextDecoder(utf16 ? 'utf-16le' : 'utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(bom)); }
  catch { throw new Error('Unsupported Fortnite configuration encoding.'); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufeff]/.test(text)) throw new Error('Unrecognized Fortnite configuration contents.');
  const matches = new Map<Key, { start: number; end: number; raw: string }>();
  let active = false, sections = 0, offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    const plain = line.replace(/\r?\n$/, '');
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(plain);
    if (header) { active = header[1].trim().toLowerCase() === section; if (active) sections++; }
    else if (active && !/^\s*[;#]/.test(plain)) {
      if (/^\s*\[/.test(plain)) throw new Error('Unrecognized Fortnite section header.');
      const pair = /^(\s*)([^=\s]+)(\s*=\s*)([^\r\n]*?)([ \t]*)$/.exec(plain);
      if (pair) {
        const key = pair[2].toLowerCase() as Key;
        if (Object.hasOwn(fields, key)) {
          if (matches.has(key)) throw new Error('Duplicate Fortnite setting; use the in-game menu instead.');
          const start = offset + pair[1].length + pair[2].length + pair[3].length;
          matches.set(key, { start, end: start + pair[4].length, raw: pair[4] });
        } else if (Object.hasOwn(fields, key.replace(/^[+.!-]+/, ''))) throw new Error('Unsupported Fortnite setting operator.');
      }
    }
    offset += line.length;
  }
  if (sections !== 1 || matches.size !== 3) throw new Error('Supported Fortnite display settings were not found. Start the game once and save its video settings, or use the in-game menu.');
  const cap = matches.get('frameratelimit')!.raw;
  const bool = (key: Key) => { const raw = matches.get(key)!.raw; if (!/^(true|false)$/i.test(raw)) throw new Error('Unrecognized Fortnite Boolean value.'); return raw.toLowerCase() === 'true'; };
  if (!/^\d{1,4}(?:\.\d{1,6})?$/.test(cap)) throw new Error('Unrecognized Fortnite frame cap.');
  const values: FortniteValues = { frameRateLimit: Number(cap), vsync: bool('busevsync'), dynamicResolution: bool('busedynamicresolution') };
  if (!validFortniteValues(values)) throw new Error('Unsupported Fortnite display values.');
  return {
    values,
    rawValues: Object.fromEntries([...matches].map(([key, value]) => [fields[key], value.raw])) as Record<FortniteField, string>,
    patch(next: FortniteValues, rawOriginals?: Partial<Record<FortniteField, string>>): Buffer {
      if (!validFortniteValues(next)) throw new Error('Invalid Fortnite display values.');
      let updated = text;
      for (const [key, range] of [...matches].sort((a, b) => b[1].start - a[1].start)) {
        const field = fields[key];
        if (next[field] === values[field]) continue;
        const value = rawOriginals?.[field] ?? (typeof next[field] === 'boolean' ? next[field] ? 'True' : 'False' : next.frameRateLimit.toFixed(6));
        updated = updated.slice(0, range.start) + value + updated.slice(range.end);
      }
      const output = Buffer.concat([bytes.subarray(0, bom), Buffer.from(updated, utf16 ? 'utf16le' : 'utf8')]);
      if (output.length > MAX_FORTNITE_CONFIG) throw new Error('Updated Fortnite configuration is too large.');
      return output;
    },
  };
}
