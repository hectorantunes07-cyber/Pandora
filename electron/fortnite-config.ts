import { TextDecoder } from 'node:util';
import type { FortniteValues, FortniteField } from '../shared/fortnite-settings';
import { FORTNITE_FIELDS, FORTNITE_QUALITY, validFortniteValues } from '../shared/fortnite-settings';

export const MAX_FORTNITE_CONFIG = 128 * 1024;
const section = '/script/fortnitegame.fortgameusersettings';
const fields: Record<string, FortniteField> = { frameratelimit: 'frameRateLimit', busevsync: 'vsync', busedynamicresolution: 'dynamicResolution' };
const qualityFields = Object.fromEntries(FORTNITE_QUALITY.map(v => [v.key.toLowerCase(), v.id])) as Record<string, FortniteField>;
type Range = { start: number; end: number; raw: string };

/** Edit existing, unambiguous scalar values only. Never create keys or sections. */
export function parseFortniteConfig(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_FORTNITE_CONFIG) throw new Error('The Fortnite configuration is empty or too large.');
  const utf16 = bytes[0] === 0xff && bytes[1] === 0xfe;
  const bom = utf16 ? 2 : bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) ? 3 : 0;
  if ((utf16 && (bytes.length - 2) % 2) || (bytes[0] === 0xfe && bytes[1] === 0xff)) throw new Error('Unsupported Fortnite configuration encoding.');
  let text: string;
  try { text = new TextDecoder(utf16 ? 'utf-16le' : 'utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(bom)); }
  catch { throw new Error('Unsupported Fortnite configuration encoding.'); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufeff]/.test(text)) throw new Error('Unrecognized Fortnite configuration contents.');
  const matches = new Map<FortniteField, Range>();
  const optional = new Map<FortniteField, Range>(), invalid = new Set<FortniteField>();
  let active: 'base' | 'quality' | null = null, sections = 0, qualitySections = 0, offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    const plain = line.replace(/\r?\n$/, '');
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(plain);
    if (header) {
      const name = header[1].trim().toLowerCase();
      active = name === section ? 'base' : name === 'scalabilitygroups' ? 'quality' : null;
      if (active === 'base') sections++;
      if (active === 'quality') qualitySections++;
    } else if (active && !/^\s*[;#]/.test(plain)) {
      if (/^\s*\[/.test(plain)) {
        if (active === 'base') throw new Error('Unrecognized Fortnite section header.');
        qualitySections = -100; active = null;
      } else {
        const pair = /^(\s*)([^=\s]+)(\s*=\s*)([^\r\n]*?)([ \t]*)$/.exec(plain);
        const dictionary = active === 'base' ? fields : qualityFields;
        if (pair) {
          const key = pair[2].toLowerCase(), cleanKey = key.replace(/^[+.!-]+/, '');
          if (Object.hasOwn(dictionary, cleanKey)) {
            const field = dictionary[cleanKey];
            const ranges = active === 'base' ? matches : optional;
            if (key !== cleanKey || ranges.has(field)) {
              if (active === 'base') throw new Error(key !== cleanKey ? 'Unsupported Fortnite setting operator.' : 'Duplicate Fortnite setting; use the in-game menu instead.');
              invalid.add(field);
            }
            const start = offset + pair[1].length + pair[2].length + pair[3].length;
            ranges.set(field, { start, end: start + pair[4].length, raw: pair[4] });
          }
        } else if (active === 'quality') {
          // Malformed assignments to a recognized key are ambiguous, not defaults.
          const key = plain.trim().split(/\s|=/)[0].toLowerCase().replace(/^[+.!-]+/, '');
          if (Object.hasOwn(qualityFields, key)) invalid.add(qualityFields[key]);
        }
      }
    }
    offset += line.length;
  }
  if (sections !== 1 || matches.size !== 3) throw new Error('Supported Fortnite display settings were not found. Start the game once and save its video settings, or use the in-game menu.');
  const cap = matches.get('frameRateLimit')!.raw;
  const bool = (key: FortniteField) => { const raw = matches.get(key)!.raw; if (!/^(true|false)$/i.test(raw)) throw new Error('Unrecognized Fortnite Boolean value.'); return raw.toLowerCase() === 'true'; };
  if (!/^\d{1,4}(?:\.\d{1,6})?$/.test(cap)) throw new Error('Unrecognized Fortnite frame cap.');
  const values: FortniteValues = { frameRateLimit: Number(cap), vsync: bool('vsync'), dynamicResolution: bool('dynamicResolution') };
  if (qualitySections === 1) for (const [field, range] of optional) {
    if (!invalid.has(field) && /^[0-4]$/.test(range.raw)) { Object.assign(values, { [field]: Number(range.raw) }); matches.set(field, range); }
  }
  if (!validFortniteValues(values)) throw new Error('Unsupported Fortnite display values.');
  return {
    values,
    rawValues: Object.fromEntries([...matches].map(([key, value]) => [key, value.raw])) as Partial<Record<FortniteField, string>>,
    patch(next: FortniteValues, rawOriginals?: Partial<Record<FortniteField, string>>): Buffer {
      if (!validFortniteValues(next)) throw new Error('Invalid Fortnite display values.');
      if (FORTNITE_FIELDS.some(key => Object.hasOwn(next, key) !== Object.hasOwn(values, key))) throw new Error('An unavailable Fortnite quality setting cannot be added or removed. Refresh the configuration.');
      let updated = text;
      for (const [field, range] of [...matches].sort((a, b) => b[1].start - a[1].start)) {
        if (next[field] === values[field]) continue;
        const target = next[field]!;
        const value = rawOriginals?.[field] ?? (typeof target === 'boolean' ? target ? 'True' : 'False' : field === 'frameRateLimit' ? target.toFixed(6) : String(target));
        updated = updated.slice(0, range.start) + value + updated.slice(range.end);
      }
      const output = Buffer.concat([bytes.subarray(0, bom), Buffer.from(updated, utf16 ? 'utf16le' : 'utf8')]);
      if (output.length > MAX_FORTNITE_CONFIG) throw new Error('Updated Fortnite configuration is too large.');
      return output;
    },
  };
}
