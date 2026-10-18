// The formatting core of @sheetpane/numfmt: pure functions over the `numfmt`
// library, no DOM and no sheetpane state, so Node can import it. The plugin
// (index.ts) and the controls (ui.ts) are thin callers of this file.
import { format, getFormatDateInfo, getFormatFromId, getFormatInfo, getLocale, isValidFormat } from 'numfmt';

/** What a format needs from outside the code itself. */
export interface FormatEnv {
  /** A BCP 47 tag (`de-DE`), or `''` for the library's English default. */
  locale: string;
  /** The workbook's date system (`<workbookPr date1904>`). */
  date1904: boolean;
}

/** Days between the 1900 and 1904 epochs: the library has no 1904 mode, so serials are shifted (W-15 hazard 1). */
export const DAYS_1900_TO_1904 = 1462;

// Excel shows `########` for a date it cannot (before 1900, after 9999); the library's
// defaults would print the bare number (Google Sheets' habit) or accept years 0–99999.
const BASE_OPTIONS = { overflow: '########', dateErrorNumber: false, dateSpanLarge: false } as const;

interface Resolved { tag: string; grouping: [number, number] | undefined }
const resolved = new Map<string, Resolved>();

/** A locale tag the library knows, normalised (`de_DE` → `de-DE`); anything else → `''`. */
export function resolveLocale(tag: string | undefined): Resolved {
  const key = tag ?? '';
  let r = resolved.get(key);
  if (r) return r;
  const t = key.trim().replace(/_/g, '-');
  let ok = '';
  try { if (t && getLocale(t) !== undefined) ok = t; } catch { ok = ''; }
  // Indian digit grouping (12,34,567) — Excel follows the region, the library only knows 3-3.
  const grouping: [number, number] | undefined = /-IN$/i.test(ok) ? [3, 2] : undefined;
  r = { tag: ok, grouping };
  resolved.set(key, r);
  return r;
}

/** The locale of the page, read when asked (never at import): `<html lang>`; `''` in Node or when unset. */
export function documentLocale(): string {
  try { return typeof document === 'undefined' ? '' : document.documentElement.lang || ''; } catch { return ''; }
}

const optionsCache = new Map<string, Parameters<typeof format>[2]>();
function optionsFor(locale: string) {
  let o = optionsCache.get(locale);
  if (!o) {
    const r = resolveLocale(locale);
    o = { ...BASE_OPTIONS, ...(r.tag ? { locale: r.tag } : {}), ...(r.grouping ? { grouping: r.grouping } : {}) };
    optionsCache.set(locale, o);
  }
  return o;
}

const shiftCache = new Map<string, boolean>();
/** Does this code show a calendar date (so a 1904 serial must be shifted)? `[h]:mm` elapsed time must not be. */
function showsCalendar(code: string): boolean {
  let s = shiftCache.get(code);
  if (s === undefined) {
    const i = getFormatDateInfo(code);
    s = i.year || i.month || i.day;
    if (shiftCache.size > 5000) shiftCache.clear();
    shiftCache.set(code, s);
  }
  return s;
}

/** Formats a number by a code. Throws when the library rejects the code — the caller falls back (W-15 DoD 3). */
export function formatValue(code: string, value: number, env: FormatEnv): string {
  const v = env.date1904 && showsCalendar(code) ? value + DAYS_1900_TO_1904 : value;
  return format(code, v, optionsFor(env.locale));
}

export function isValidCode(code: string): boolean {
  return isValidFormat(code);
}

/** The code for a built-in id in a locale (ids 5–8, 14–22, 41–44 are the system's), else `General`. */
export function builtinCode(id: number, locale: string): string {
  try {
    const r = resolveLocale(locale);
    return getFormatFromId(id, r.tag || undefined) || 'General';
  } catch { return 'General'; }
}

/** The code a style's `numFmtId` names: the file's own `<numFmt>` first (a file may redefine an id), then the built-in table. */
export function codeOfId(id: number, custom: Readonly<Record<number, string>>, locale: string): string {
  return custom[id] ?? builtinCode(id, locale);
}

// ── ids for export: an en-US built-in code is written as its id, anything else as a new custom <numFmt> ──
let idByCode: Map<string, number> | undefined;
/** The built-in id whose en-US code is exactly `code`, or undefined (lowest id wins: `m/d/yyyy` is 14, not 27). */
export function builtinIdOf(code: string): number | undefined {
  if (!idByCode) {
    idByCode = new Map();
    for (const id of [...Array(23).keys(), ...Array.from({ length: 13 }, (_, i) => 37 + i)]) {
      const c = builtinCode(id, '');
      if (!idByCode.has(c)) idByCode.set(c, id);
    }
  }
  return idByCode.get(code);
}

// ── the dropdown's categories ──
export type Category = 'general' | 'number' | 'currency' | 'accounting' | 'date' | 'time' | 'percentage' | 'fraction' | 'scientific' | 'text' | 'custom';
export const CATEGORIES: readonly { key: Category; label: string }[] = [
  { key: 'general', label: 'General' }, { key: 'number', label: 'Number' }, { key: 'currency', label: 'Currency' }, { key: 'accounting', label: 'Accounting' },
  { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'percentage', label: 'Percentage' }, { key: 'fraction', label: 'Fraction' },
  { key: 'scientific', label: 'Scientific' }, { key: 'text', label: 'Text' }, { key: 'custom', label: 'Custom…' },
];

/** The code a category stands for in a locale; `custom` has none (the user types it). */
export function presetCode(c: Exclude<Category, 'custom'>, locale: string): string {
  switch (c) {
    case 'general': return 'General';
    case 'number': return '0.00';
    case 'currency': return builtinCode(7, locale);
    case 'accounting': return builtinCode(44, locale);
    case 'date': return builtinCode(14, locale);
    case 'time': return builtinCode(19, locale);
    case 'percentage': return '0.00%';
    case 'fraction': return '# ?/?';
    case 'scientific': return '0.00E+00';
    case 'text': return '@';
  }
}

/** Which category a code belongs to (what the dropdown shows as current). */
export function categoryOf(code: string): Category {
  if (code === 'General') return 'general';
  try {
    switch (getFormatInfo(code).type) {
      case 'general': return 'general';
      case 'number': case 'grouped': return 'number';
      case 'currency': return /_\(\*|\*\s/.test(code) ? 'accounting' : 'currency';
      case 'date': case 'datetime': return 'date';
      case 'time': return 'time';
      case 'percent': return 'percentage';
      case 'fraction': return 'fraction';
      case 'scientific': return 'scientific';
      case 'text': return 'text';
      default: return 'custom';
    }
  } catch { return 'custom'; }
}

// ── ± decimals ──

/** `s` with every quoted, escaped, bracketed or padded stretch blanked (same length), so a scan sees only operators. */
function mask(s: string): string {
  return s.replace(/"[^"]*"|\\.|\[[^\]]*\]|[_*]./g, (m) => '\u0000'.repeat(m.length));
}

/**
 * Excel's Increase / Decrease Decimal on a code: one `0` more (or fewer) after the point of the first number in every
 * section. Dates, times, fractions and text are returned unchanged (`General` is handled from the cell's value).
 */
export function adjustDecimals(code: string, delta: 1 | -1): string {
  if (code === 'General' || code === '@') return code;
  const kind = categoryOf(code);
  if (kind === 'date' || kind === 'time' || kind === 'fraction' || kind === 'text') return code;
  const m = mask(code);
  const sections: string[] = [];
  for (let at = 0; at <= code.length; ) {
    const semi = m.indexOf(';', at);
    const end = semi < 0 ? code.length : semi;
    sections.push(code.slice(at, end));
    at = end + 1;
  }
  let changed = false;
  let offset = 0;
  const out = sections.map((sec) => {
    const ms = m.slice(offset, offset + sec.length);
    offset += sec.length + 1;
    // The first run of digit placeholders with its decimals: `#,##0.00` in `$#,##0.00_)`.
    const run = /[0#?][0#?,]*(?:\.([0#?]*))?/.exec(ms);
    if (!run) return sec;
    const end = run.index + run[0].length;
    const decimals = run[1]?.length ?? 0;
    if (delta === 1) { changed = true; return sec.slice(0, end) + (run[0].includes('.') ? '0' : '.0') + sec.slice(end); }
    if (decimals === 0) return sec;
    changed = true;
    return sec.slice(0, decimals === 1 ? end - 2 : end - 1) + sec.slice(end);
  });
  return changed ? out.join(';') : code;
}

/** The decimals General shows for a value (`1234.5` → 1), for the ± buttons on a General cell. */
export function generalDecimals(value: number, env: FormatEnv): number {
  const t = formatValue('General', value, env);
  if (/e/i.test(t)) return 0;
  const m = /[.,](\d+)$/.exec(t);
  return m ? m[1]!.length : 0;
}

/** `0`, `0.0`, `0.00` … */
export const fixedCode = (decimals: number): string => (decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0');
