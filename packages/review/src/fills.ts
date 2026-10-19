// Colouring flagged cells (W-59 DoD 3). Each flagged cell's own style (`xf`) is
// cloned with a solid fill and the cell points at the clone, so its number
// format, font, borders and alignment stay. Only the `s` of a flagged <c> is
// changed (or a styled empty <c> added where the file has none); every other row
// and cell is copied as the file has it, byte for byte.
import { cellRef, getAttr, parseRange, setAttr, spError, type RangePos } from '@sheetpane/export';
import { elementRe, openTag, prefixOf } from './xml.js';

/** The fill each problem severity gets by default (ARGB): Excel's *Bad*, *Neutral* and a pale blue. */
export const DEFAULT_FILLS: Readonly<Record<string, string>> = { error: 'FFFFC7CE', warning: 'FFFFEB9C', note: 'FFDDEBF7' };

/** The Review sheet's header fill (ARGB): a light grey. No font is written (SR-LAW-5). */
export const HEADER_FILL = 'FFD9D9D9';

/** An error's range larger than this many cells colours only the cells the file already has in it (SP-5903). */
export const MAX_FILL_CELLS = 10_000;

/**
 * A colour as ARGB: `#C00000`, `C00000` or `FFC00000` → `FFC00000`.
 *
 * @param c - The colour.
 * @returns The ARGB form, or undefined when it is not a hex colour.
 */
export function argb(c: string): string | undefined {
  const h = c.trim().replace(/^#/, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(h) ? `FF${h}` : /^[0-9A-F]{8}$/.test(h) ? h : undefined;
}

const block = (name: string) => new RegExp(`<(\\w+:)?${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</\\1${name}>)`);

/** The workbook's style tables, extended in memory: fills and cell formats are only ever appended. */
export class StyleBook {
  private readonly P: string;
  private readonly xfs: string[];
  private readonly fillCount: number;
  private readonly newFills: string[] = [];
  private readonly newXfs: string[] = [];
  private readonly fillOf = new Map<string, number>();
  private readonly xfOf = new Map<string, number>();

  constructor(private readonly xml: string) {
    this.P = prefixOf(xml, 'styleSheet');
    const xfs = block('cellXfs').exec(xml);
    if (!/<(?:\w+:)?styleSheet\b/.test(xml) || !xfs) throw spError('SP-5902', 'sheetpane review: the styles part has no <cellXfs>');
    this.xfs = [...(xfs[3] ?? '').matchAll(elementRe('xf'))].map((m) => m[0]);
    const fills = block('fills').exec(xml);
    this.fillCount = fills ? [...(fills[3] ?? '').matchAll(elementRe('fill'))].length : 2; // a missing <fills> is written with Excel's two required fills
  }

  /** Whether anything was added. */
  get changed(): boolean { return this.newXfs.length > 0; }

  /** The id of a solid fill in this colour, added once. */
  fill(color: string): number {
    let id = this.fillOf.get(color);
    if (id === undefined) {
      const P = this.P;
      id = this.fillCount + this.newFills.length;
      this.newFills.push(`<${P}fill><${P}patternFill patternType="solid"><${P}fgColor rgb="${color}"/><${P}bgColor indexed="64"/></${P}patternFill></${P}fill>`);
      this.fillOf.set(color, id);
    }
    return id;
  }

  /**
   * A cell format that is format `s` with a solid fill — cloned once per format and colour.
   *
   * @param s - The cell's style index (a missing or unknown one is format 0).
   * @param color - ARGB.
   * @returns The new format's index.
   */
  clone(s: number, color: string): number {
    const k = `${s}|${color}`;
    let id = this.xfOf.get(k);
    if (id === undefined) {
      const base = this.xfs[s] ?? this.xfs[0] ?? `<${this.P}xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`;
      const tag = openTag(base);
      id = this.xfs.length + this.newXfs.length;
      this.newXfs.push(base.replace(tag, setAttr(setAttr(tag, 'fillId', String(this.fill(color))), 'applyFill', '1')));
      this.xfOf.set(k, id);
    }
    return id;
  }

  /** The styles part with the new fills and formats appended and the counts set. */
  toXml(): string {
    const P = this.P;
    let out = this.xml;
    const grow = (name: string, items: string, count: number, missing: () => string) => {
      const m = block(name).exec(out);
      if (!m) { out = missing(); return; }
      const open = setAttr(openTag(m[0]).replace(/\s*\/>$/, '>'), 'count', String(count));
      out = out.replace(m[0], `${open}${m[3] ?? ''}${items}</${m[1] ?? ''}${name}>`);
    };
    grow('cellXfs', this.newXfs.join(''), this.xfs.length + this.newXfs.length, () => out);
    if (this.newFills.length) {
      grow('fills', this.newFills.join(''), this.fillCount + this.newFills.length, () => {
        // CT_Stylesheet: numFmts, fonts, fills, borders, cellStyleXfs, cellXfs …
        const at = out.search(/<(?:\w+:)?(?:borders|cellStyleXfs|cellXfs)\b/);
        const fills = `<${P}fills count="${this.fillCount + this.newFills.length}"><${P}fill><${P}patternFill patternType="none"/></${P}fill><${P}fill><${P}patternFill patternType="gray125"/></${P}fill>${this.newFills.join('')}</${P}fills>`;
        return out.slice(0, at) + fills + out.slice(at);
      });
    }
    return out;
  }
}

/** What to colour on one sheet: whole cells by zero-based row and column, and ranges too large to fill whole. */
export interface FillPlan {
  /** row → column → severity. */
  cells: Map<number, Map<number, string>>;
  /** Over {@link MAX_FILL_CELLS}: only the cells the file has inside are coloured. */
  wide: { range: RangePos; severity: string }[];
}

/** Adds a range to a plan; the worse severity wins on a cell. Returns false when the range was too large to fill whole. */
export function planRange(plan: FillPlan, r: RangePos, severity: string, rank: (s: string) => number): boolean {
  if ((r.bottom - r.top + 1) * (r.right - r.left + 1) > MAX_FILL_CELLS) { plan.wide.push({ range: r, severity }); return false; }
  for (let row = r.top; row <= r.bottom; row++) {
    const cols = plan.cells.get(row) ?? plan.cells.set(row, new Map()).get(row)!;
    for (let col = r.left; col <= r.right; col++) { const was = cols.get(col); if (was === undefined || rank(severity) < rank(was)) cols.set(col, severity); }
  }
  return true;
}

/** `<col min max style>` → the style a column gives a cell the file does not have. */
function colStyles(xml: string): (col: number) => number | undefined {
  const cols = block('cols').exec(xml)?.[3] ?? '';
  const spans = [...cols.matchAll(/<(?:\w+:)?col\b[^>]*>/g)].map((m) => ({ min: Number(getAttr(m[0], 'min')), max: Number(getAttr(m[0], 'max')), s: getAttr(m[0], 'style') }));
  return (col) => { const c = spans.find((x) => x.min <= col + 1 && col + 1 <= x.max && x.s !== undefined); return c ? Number(c.s) : undefined; };
}

const ROW = /<(\w+:)?row\b[^>]*?(?:\/>|>[\s\S]*?<\/\1row>)/g;
const CELL = /<(\w+:)?c\b[^>]*?(?:\/>|>[\s\S]*?<\/\1c>)/g;

/**
 * Colours one sheet's flagged cells. Rows and cells not flagged are copied unchanged; a flagged cell keeps everything
 * but its `s`; a flagged cell the file lacks is added empty, styled from its row (when `customFormat`) or column.
 *
 * @param xml - The worksheet part.
 * @param plan - What to colour.
 * @param rank - A severity's rank: lower is worse, and wins on a cell.
 * @param styleFor - The style index for a cell of style `s` coloured for `severity`.
 * @returns The worksheet part, coloured.
 */
export function fillSheet(xml: string, plan: FillPlan, rank: (s: string) => number, styleFor: (s: number, severity: string) => number): string {
  const sd = /<(\w+:)?sheetData\b[^>]*?(\/?)>/.exec(xml);
  if (!sd) throw spError('SP-5902', 'sheetpane review: the worksheet has no <sheetData>');
  const P = sd[1] ?? '';
  const start = sd.index + sd[0].length;
  const end = sd[2] === '/' ? start : xml.indexOf(`</${P}sheetData>`, start);
  if (end < 0) throw spError('SP-5902', 'sheetpane review: <sheetData> is not closed');
  const inner = xml.slice(start, end);
  const colStyle = colStyles(xml);
  let maxRow = -1, maxCol = -1;
  const made = (row: number, col: number) => { maxRow = Math.max(maxRow, row); maxCol = Math.max(maxCol, col); };
  const emptyCell = (row: number, col: number, base: number, sev: string) => { made(row, col); return `<${P}c r="${cellRef(row, col)}" s="${styleFor(base, sev)}"/>`; };
  const newRow = (row: number) => {
    const cols = [...plan.cells.get(row)!].sort(([a], [b]) => a - b);
    return `<${P}row r="${row + 1}">${cols.map(([col, sev]) => emptyCell(row, col, colStyle(col) ?? 0, sev)).join('')}</${P}row>`;
  };
  const wideSev = (row: number, col: number, sev: string | undefined) => {
    for (const w of plan.wide) if (w.range.top <= row && row <= w.range.bottom && w.range.left <= col && col <= w.range.right && (sev === undefined || rank(w.severity) < rank(sev))) sev = w.severity;
    return sev;
  };

  const pending = [...plan.cells.keys()].sort((a, b) => a - b);
  let pi = 0, last = 0, prev = 0;
  const out: string[] = [];
  for (const m of inner.matchAll(ROW)) {
    const tag = openTag(m[0]);
    const r = Number(getAttr(tag, 'r') ?? prev + 1);
    prev = r;
    const row = r - 1;
    out.push(inner.slice(last, m.index));
    while (pi < pending.length && pending[pi]! < row) out.push(newRow(pending[pi++]!));
    const targets = pending[pi] === row ? plan.cells.get(pending[pi++]!) : undefined;
    const wide = plan.wide.some((w) => w.range.top <= row && row <= w.range.bottom);
    out.push(targets || wide ? fillRow(m[0], tag, row, targets) : m[0]);
    last = m.index + m[0].length;
  }
  while (pi < pending.length) out.push(newRow(pending[pi++]!));
  out.push(inner.slice(last));

  function fillRow(rowXml: string, tag: string, row: number, targets: Map<number, string> | undefined): string {
    const self = /\/>$/.test(tag);
    const body = self ? '' : rowXml.slice(tag.length, rowXml.length - `</${P}row>`.length);
    const custom = getAttr(tag, 'customFormat');
    const rowStyle = custom === '1' || custom === 'true' ? Number(getAttr(tag, 's') ?? 0) : undefined;
    const todo = new Map(targets ?? []);
    const parts: string[] = [];
    let at = 0, prevCol = -1, minCol = Infinity, maxNew = -1;
    const addMissing = (before: number) => {
      for (const col of [...todo.keys()].filter((c) => c < before).sort((a, b) => a - b)) {
        parts.push(emptyCell(row, col, rowStyle ?? colStyle(col) ?? 0, todo.get(col)!));
        todo.delete(col);
        minCol = Math.min(minCol, col); maxNew = Math.max(maxNew, col);
      }
    };
    for (const c of body.matchAll(CELL)) {
      const ctag = openTag(c[0]);
      const ref = getAttr(ctag, 'r');
      const col = ref ? (parseRange(ref)?.left ?? prevCol + 1) : prevCol + 1;
      prevCol = col;
      parts.push(body.slice(at, c.index));
      addMissing(col);
      const sev = wideSev(row, col, todo.get(col));
      todo.delete(col);
      parts.push(sev === undefined ? c[0] : c[0].replace(ctag, setAttr(ctag, 's', String(styleFor(Number(getAttr(ctag, 's') ?? 0), sev)))));
      at = c.index + c[0].length;
    }
    parts.push(body.slice(at));
    addMissing(Infinity);
    let open = self ? tag.replace(/\s*\/>$/, '>') : tag;
    const spans = getAttr(open, 'spans');
    if (spans && maxNew >= 0) {
      const [a, b] = spans.split(':').map(Number);
      if (Number.isFinite(a) && Number.isFinite(b)) open = setAttr(open, 'spans', `${Math.min(a!, minCol + 1)}:${Math.max(b!, maxNew + 1)}`);
    }
    return `${open}${parts.join('')}</${P}row>`;
  }

  const data = sd[2] === '/' ? `${sd[0].replace(/\s*\/>$/, '>')}${out.join('')}</${P}sheetData>` : `${sd[0]}${out.join('')}`;
  let result = xml.slice(0, sd.index) + data + xml.slice(end);
  if (maxRow >= 0) result = widenDimension(result, maxRow, maxCol);
  return result;
}

/** `<dimension ref>` grown to take in a cell the fills added. */
function widenDimension(xml: string, row: number, col: number): string {
  const d = /<(?:\w+:)?dimension\b[^>]*>/.exec(xml);
  const ref = d && getAttr(d[0], 'ref');
  const r = ref ? parseRange(ref) : undefined;
  if (!d || !r || (row <= r.bottom && col <= r.right)) return xml;
  return xml.replace(d[0], setAttr(d[0], 'ref', `${cellRef(r.top, r.left)}:${cellRef(Math.max(r.bottom, row), Math.max(r.right, col))}`));
}
