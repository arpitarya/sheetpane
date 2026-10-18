// The number-format subset (reading verdict decision 2): a typed cell's display
// text, computed once at load. Built-in ids 0–4, 9–22, 37–40, 45–49, and custom
// codes made only of `0 # , . % y m d h s AM/PM / - : space "literal"`. Any
// other format shows the raw stored text; @sheetpane/numfmt replaces all of this.

export const BUILTIN: Record<number, string> = {
  0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 12: '# ?/?', 13: '# ??/??',
  14: 'm/d/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'h:mm', 21: 'h:mm:ss', 22: 'm/d/yyyy h:mm',
  37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)',
  45: 'mm:ss', 46: '[h]:mm:ss', 47: 'mmss.0', 48: '##0.0E+0', 49: '@',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Is this custom code inside the subset? */
export function inSubset(code: string): boolean {
  const bare = code.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/AM\/PM/gi, '');
  return /^[0#,.%ymdhs/\-: ;]*$/i.test(bare);
}

/** The format code a cell's style names, when the subset covers it; undefined → show the raw text. */
export function subsetCode(numFmtId: number, custom: Record<number, string>): string | undefined {
  if (BUILTIN[numFmtId] !== undefined) return BUILTIN[numFmtId];
  const c = custom[numFmtId];
  return c !== undefined && inSubset(c) ? c : undefined;
}

/** Excel's General: up to 11 characters of digits, scientific past that. */
export function general(n: number): string {
  if (n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e11 || a < 1e-9) {
    const [m, e] = n.toExponential(5).split('e') as [string, string];
    const mant = m.replace(/\.?0+$/, '');
    const exp = Number(e);
    return `${mant}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  if (Number.isInteger(n)) return String(n);
  const intDigits = Math.max(1, Math.floor(Math.log10(a)) + 1);
  const s = n.toFixed(Math.max(0, 10 - Math.max(intDigits, 0)));
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Splits a code into its `;` sections, respecting quotes, escapes and brackets. */
function sections(code: string): string[] {
  const out: string[] = [];
  let cur = '', q = false, b = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '\\' && !q) { cur += ch + (code[i + 1] ?? ''); i++; continue; }
    if (ch === '"') q = !q;
    else if (!q && ch === '[') b = true;
    else if (!q && ch === ']') b = false;
    if (ch === ';' && !q && !b) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const isDateSection = (s: string) => /\[(h+|m+|s+)\]|[ydhs]|AM\/PM|^[^0#?]*m[^0#?]*$/i.test(s.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, (m) => (/^\[(h+|m+|s+)\]$/i.test(m) ? m : '')));

/** A serial date as calendar parts (UTC), honouring the 1900 leap-year bug and the 1904 system. */
export function serialToParts(serial: number, date1904: boolean) {
  let days = Math.floor(serial);
  let secs = Math.round((serial - days) * 86400 * 1000) / 1000;
  if (secs >= 86400) { days += 1; secs -= 86400; }
  let y: number, mo: number, d: number, wd: number;
  if (!date1904 && days === 60) { y = 1900; mo = 1; d = 29; wd = 3; }
  else if (!date1904 && days === 0) { y = 1900; mo = 0; d = 0; wd = 6; } // Excel shows serial 0 as 1/0/1900
  else {
    const base = date1904 ? Date.UTC(1904, 0, 1) : days < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
    const t = new Date(base + days * 86400000);
    y = t.getUTCFullYear(); mo = t.getUTCMonth(); d = t.getUTCDate(); wd = t.getUTCDay();
  }
  return { y, mo, d, wd, secs, days };
}

function formatDate(serial: number, sec: string, date1904: boolean): string {
  if (serial < 0) return '#'.repeat(8);
  const tokens: { t: string; v: string }[] = [];
  const s = sec.replace(/\[(?![hms]+\])[^\]]*\]/gi, '');
  for (let i = 0; i < s.length; ) {
    const rest = s.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^"([^"]*)"/.exec(rest))) { tokens.push({ t: 'lit', v: m[1]! }); i += m[0].length; continue; }
    if (rest[0] === '\\') { tokens.push({ t: 'lit', v: rest[1] ?? '' }); i += 2; continue; }
    if ((m = /^AM\/PM/i.exec(rest))) { tokens.push({ t: 'ampm', v: m[0] }); i += 5; continue; }
    if ((m = /^\[(h+|m+|s+)\]/i.exec(rest))) { tokens.push({ t: 'el' + m[1]![0]!.toLowerCase(), v: m[1]! }); i += m[0].length; continue; }
    if ((m = /^(y+|m+|d+|h+|s+)/i.exec(rest))) { tokens.push({ t: m[1]![0]!.toLowerCase(), v: m[1]! }); i += m[0].length; continue; }
    if ((m = /^\.0+/.exec(rest)) && tokens.some((x) => x.t === 's' || x.t === 'els')) { tokens.push({ t: 'frac', v: m[0] }); i += m[0].length; continue; }
    tokens.push({ t: 'lit', v: rest[0]! }); i++;
  }
  // `m` after an hour or before a second is minutes.
  const sig = tokens.filter((x) => x.t !== 'lit');
  sig.forEach((x, k) => {
    if (x.t !== 'm') return;
    const prev = sig[k - 1], next = sig[k + 1];
    if (prev?.t === 'h' || prev?.t === 'elh' || next?.t === 's' || next?.t === 'els') x.t = 'min';
  });
  const fracDigits = tokens.find((x) => x.t === 'frac')?.v.length ?? 1;
  const scale = 10 ** (fracDigits - 1);
  const p = serialToParts(serial, date1904);
  let secs = fracDigits > 1 ? Math.round(p.secs * scale) / scale : Math.round(p.secs);
  let { days } = p;
  if (secs >= 86400) { secs -= 86400; days += 1; }
  const parts = days === p.days ? p : serialToParts(days, date1904);
  const hh = Math.floor(secs / 3600), mi = Math.floor((secs % 3600) / 60), ss = Math.floor(secs % 60);
  const ampm = tokens.some((x) => x.t === 'ampm');
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const totalSecs = Math.round(serial * 86400 * scale) / scale;
  return tokens.map((x) => {
    const w = x.v.length;
    switch (x.t) {
      case 'lit': return x.v;
      case 'y': return w <= 2 ? pad(parts.y % 100, 2) : String(parts.y);
      case 'm': return w === 1 ? String(parts.mo + 1) : w === 2 ? pad(parts.mo + 1, 2) : w === 3 ? MONTHS[parts.mo]!.slice(0, 3) : w === 5 ? MONTHS[parts.mo]![0]! : MONTHS[parts.mo]!;
      case 'd': return w === 1 ? String(parts.d) : w === 2 ? pad(parts.d, 2) : w === 3 ? DAYS[parts.wd]!.slice(0, 3) : DAYS[parts.wd]!;
      case 'h': { const h = ampm ? ((hh + 11) % 12) + 1 : hh; return w >= 2 ? pad(h, 2) : String(h); }
      case 'min': return w >= 2 ? pad(mi, 2) : String(mi);
      case 's': return w >= 2 ? pad(ss, 2) : String(ss);
      case 'elh': return pad(Math.floor(totalSecs / 3600), w);
      case 'elm': return pad(Math.floor(totalSecs / 60), w);
      case 'els': return pad(Math.floor(totalSecs), w);
      case 'frac': return (secs % 1).toFixed(fracDigits - 1).slice(1);
      case 'ampm': return hh < 12 ? (x.v[0] === 'a' ? 'am' : 'AM') : (x.v[0] === 'a' ? 'pm' : 'PM');
      default: return x.v;
    }
  }).join('');
}

/** Rounds half away from zero to `d` decimals, as Excel does, without binary drift. */
function round(v: number, d: number): string {
  const r = Math.round(Number(`${Math.abs(v)}e${d}`));
  return (Number(`${r}e-${d}`)).toFixed(d);
}

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatNumber(n: number, sec: string, autoMinus: boolean): string {
  // Literals and the placeholder run.
  let pattern = '', before = '', after = '', seenPh = false, donePh = false;
  const s = sec.replace(/\[[^\]]*\]/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    let lit: string | undefined;
    if (ch === '"') { const j = s.indexOf('"', i + 1); lit = s.slice(i + 1, j < 0 ? s.length : j); i = j < 0 ? s.length : j; }
    else if (ch === '\\') { lit = s[i + 1] ?? ''; i++; }
    else if (ch === '_') { lit = ' '; i++; }
    else if (ch === '*') { lit = ''; i++; }
    else if (!donePh && /[0#?,.]/.test(ch)) { pattern += ch; seenPh = true; continue; }
    else if (!donePh && seenPh && /[eE]/.test(ch) && /[+-]/.test(s[i + 1] ?? '')) { pattern += ch + s[i + 1]; i++; while (/[0#]/.test(s[i + 1] ?? '')) pattern += s[++i]; continue; }
    else if (!donePh && seenPh && ch === ' ' && /^ *[0#?]+\/[0-9#?]+/.test(s.slice(i))) { const m = /^ *[0#?]+\/[0-9#?]+/.exec(s.slice(i))!; pattern += m[0]; i += m[0].length - 1; continue; }
    else if (!donePh && seenPh && ch === '/' ) { const m = /^\/[0-9#?]+/.exec(s.slice(i)); if (m) { pattern += m[0]; i += m[0].length - 1; continue; } lit = ch; }
    else lit = ch;
    if (seenPh) donePh = true;
    if (lit !== undefined) (donePh ? (after += lit) : (before += lit));
  }
  const pct = (sec.replace(/"[^"]*"/g, '').match(/%/g) ?? []).length;
  let v = Math.abs(n) * 100 ** pct;
  let body: string;
  const e = /[eE]([+-])(0+)/.exec(pattern);
  const frac = /([0#?]+)\/([0-9#?]+)$/.exec(pattern);
  if (!pattern) body = '';
  else if (e) {
    const [mantPat] = pattern.split(/[eE]/) as [string];
    const [ip = '', dp = ''] = mantPat.split('.');
    const intPh = ip.replace(/,/g, '').length || 1;
    const dec = dp.length;
    let exp = v === 0 ? 0 : Math.floor(Math.log10(v));
    if (intPh > 1 && ip.includes('#')) exp = Math.floor(exp / intPh) * intPh; else exp -= intPh - 1;
    let mant = v / 10 ** exp;
    let ms = round(mant, dec);
    if (Number(ms) >= 10 ** (intPh > 1 && ip.includes('#') ? intPh : intPh)) { exp += intPh > 1 && ip.includes('#') ? intPh : 1; mant = v / 10 ** exp; ms = round(mant, dec); }
    body = `${ms}E${exp < 0 ? '-' : e[1] === '+' ? '+' : ''}${String(Math.abs(exp)).padStart(e[2]!.length, '0')}`;
  } else if (frac) {
    const maxDen = frac[2]!.match(/^\d+$/) ? Number(frac[2]) : 10 ** frac[2]!.length - 1;
    const fixedDen = /^\d+$/.test(frac[2]!);
    const hasWhole = /^[#0?]+ /.test(pattern);
    let whole = hasWhole ? Math.floor(v) : 0;
    const f = v - whole;
    let bn = 0, bd = 1;
    if (fixedDen) { bd = maxDen; bn = Math.round(f * bd); }
    else for (let d = 1; d <= maxDen; d++) { const nn = Math.round(f * d); if (Math.abs(f - nn / d) < Math.abs(f - bn / bd) - 1e-12) { bn = nn; bd = d; } }
    if (bn === bd && hasWhole) { whole += 1; bn = 0; }
    const w = frac[2]!.length;
    const fracStr = bn === 0 && hasWhole ? ' '.repeat(frac[1]!.length + 1 + w) : `${String(bn).padStart(frac[1]!.length, ' ')}/${String(bd).padEnd(w, ' ')}`;
    body = hasWhole ? (whole === 0 && bn !== 0 ? fracStr : `${whole} ${fracStr}`.trimEnd()) : fracStr;
    if (hasWhole && whole === 0 && bn === 0) body = '0';
  } else {
    const dot = pattern.indexOf('.');
    let ip = dot < 0 ? pattern : pattern.slice(0, dot);
    const dp = dot < 0 ? '' : pattern.slice(dot + 1).replace(/,/g, '');
    const trailing = /,+$/.exec(ip)?.[0].length ?? 0;
    ip = ip.slice(0, ip.length - trailing);
    v = v / 1000 ** trailing;
    const grouped = ip.includes(',');
    const minInt = (ip.match(/0/g) ?? []).length;
    const decs = dp.length;
    const [i0, f0 = ''] = round(v, decs).split('.') as [string, string?];
    let intStr = i0 === '0' && minInt === 0 ? '' : i0.padStart(minInt, '0');
    if (grouped) intStr = group(intStr);
    const digits = f0.split('');
    for (let k = digits.length - 1; k >= 0 && digits[k] === '0' && dp[k] !== '0'; k--) digits[k] = dp[k] === '?' ? ' ' : '';
    const fracStr = digits.join('');
    body = intStr + (dot >= 0 ? '.' + fracStr : '');
  }
  const neg = n < 0 && autoMinus && Number(body.replace(/[^0-9]/g, '') || '0') !== 0;
  return (neg ? '-' : '') + before + body + after;
}

/** Formats a number by a code (any of the subset). */
export function formatCode(n: number, code: string, date1904 = false): string {
  if (code === 'General' || code === '') return general(n);
  const secs = sections(code);
  let sec: string, autoMinus = true;
  if (n > 0 || secs.length === 1 || (n === 0 && secs.length === 2)) sec = secs[0]!;
  else if (n < 0) { sec = secs[1]!; autoMinus = false; }
  else sec = secs[2] ?? secs[0]!;
  if (secs.length === 1 && n < 0) autoMinus = true;
  if (/^@$/.test(sec.trim())) return general(n);
  if (/^General$/i.test(sec.trim())) return (n < 0 && !autoMinus ? '' : n < 0 ? '-' : '') + general(Math.abs(n));
  if (isDateSection(sec)) return formatDate(n, sec, date1904);
  return formatNumber(n, sec, autoMinus);
}
