// The host's rules written into the download as the workbook's own data validation
// (W-58): each rule of the rules file — and of the element's `columns` — mapped to one
// `<dataValidation>` and merged into its sheet's block on export, so a person working in
// Excel gets the same dropdowns and checks. What Excel cannot hold (a pattern, "none of",
// unique, two checks in one rule) is skipped and listed, each with its SP code.
// DOM-free: the rules come from the store's `columnRules`, read by the grid's
// `checkDocument`; the XML is @sheetpane/export's `setDataValidations`.
import { checkDocument, describeRule, type ColumnRule, type OnInvalid, type WorkbookStore } from '@sheetpane/grid';
import { cellRef, MAX_ROWS, parseRange, rangeRef, setDataValidations, spMessage, type DataValidation, type PatchContext, type SpCode } from '@sheetpane/export';
import { parseBox, type Book, type Box } from './rules.js';

/** The export option's key: `export({ rulesAsValidation: true })`, and the Download menu's switch. */
export const RULES_OPTION = 'rulesAsValidation';
/** The Download menu's label for {@link RULES_OPTION}. */
export const RULES_OPTION_LABEL = 'Write rules as Excel dropdowns';

/**
 * Why a rule is not written: a check Excel's data validation has none of (`pattern`, `noneOf`, `unique`), two checks
 * one Excel rule cannot hold together (`combination`), a list Excel cannot type out (`list`), a bound it cannot read
 * (`bound`), a column or sheet the workbook lacks (`column`, `sheet`), or a sheet whose own rules could not be
 * rewritten (`workbook`).
 */
export type UnwrittenReason = 'pattern' | 'noneOf' | 'unique' | 'combination' | 'list' | 'bound' | 'column' | 'sheet' | 'workbook';

/** A rule that is not in the download: where it is, why, and its SP code. */
export interface UnwrittenRule {
  code: SpCode;
  /** The sheet, or `*` for a rule meant for every sheet. */
  sheet: string;
  /** `column “Units”` or `cell B3` (a range: `cells A1:B4`). */
  where: string;
  reason: UnwrittenReason;
  detail: string;
}

/** Cells a written rule does not reach because a rule already holds them — the workbook's own, which wins, or another written one. */
export interface RuleConflict {
  code: SpCode;
  sheet: string;
  /** The cells the rule gave up, as an sqref: `C2:C5`. */
  cells: string;
  /** The rule that gave them up: `column “Units”`. */
  where: string;
  /** The rule that keeps them: `the workbook's own whole rule` or `cell B3`. */
  kept: string;
}

/** What writing the rules did. */
export interface RulesWriteReport {
  /** Rules written, in whole or in part (a part when a conflict took some of their cells). */
  written: number;
  /** Of those, how many joined a rule the workbook already had (the same check), instead of adding one. */
  merged: number;
  skipped: UnwrittenRule[];
  conflicts: RuleConflict[];
}

/** The rules to write: each changed sheet's whole `<dataValidations>` set, and the report. */
export interface RulesWritePlan extends RulesWriteReport {
  /** `written`: how many of the plan's written rules are on that sheet. */
  sheets: { sheet: string; rules: DataValidation[]; written: number }[];
}

/** One rule mapped: the Excel rule (without its range), a reason it cannot be written, or nothing to write. */
export type MappedRule =
  | { dv: Omit<DataValidation, 'sqref'>; skip?: undefined }
  | { dv?: undefined; skip: { code: SpCode; reason: UnwrittenReason; detail: string } }
  | undefined;

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const LIST_MAX = 255, TITLE_MAX = 32, MESSAGE_MAX = 255;
/** Excel's largest number: the bound of a "any number" rule. */
const BIG = '9.99E+307';
const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);
const skip = (code: SpCode, reason: UnwrittenReason, detail: string): MappedRule => ({ skip: { code, reason, detail } });

/** A number bound, or `NaN` when it is not one. */
const numberBound = (x: number | string) => (typeof x === 'number' ? x : NUM.test(x.trim()) ? Number(x.trim()) : NaN);
/** A date bound as Excel's operand (`DATE(2026,1,31)` or a serial) and a number to order it by; undefined when unreadable. */
function dateBound(x: number | string): { f: string; at: number } | undefined {
  if (typeof x === 'number') return Number.isFinite(x) ? { f: String(x), at: x * 864e5 + Date.UTC(1899, 11, 30) } : undefined;
  const m = ISO.exec(x.trim());
  if (!m) return undefined;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]), at = Date.UTC(y, mo - 1, d), t = new Date(at);
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return undefined;
  return { f: `DATE(${y},${mo},${d})`, at };
}
/** `between`, `≥` or `≤`, from the bounds a rule gives. */
function bounded(lo: string | undefined, hi: string | undefined, all: [string, string]): { operator: string; formula1: string; formula2?: string } {
  if (lo !== undefined && hi !== undefined) return { operator: 'between', formula1: lo, formula2: hi };
  if (lo !== undefined) return { operator: 'greaterThanOrEqual', formula1: lo };
  if (hi !== undefined) return { operator: 'lessThanOrEqual', formula1: hi };
  return { operator: 'between', formula1: all[0], formula2: all[1] };
}
const listText = (x: string | number | boolean) => (typeof x === 'boolean' ? (x ? 'TRUE' : 'FALSE') : String(x));

/**
 * One rule (a rules-file or column rule) as one Excel data-validation rule, without its range. `oneOf` and `equals`
 * are a typed-out list; `number` and `integer` (or `min` / `max` alone) a decimal or whole-number rule; `date` a date
 * rule; `minLength` / `maxLength` a text-length rule; `boolean` the list TRUE, FALSE; `required` alone a text length of
 * at least 1. `required` (and `equals`) clear "ignore blank". `onInvalid: 'block'` is Excel's Stop, a `note` its
 * Information, anything else its Warning; the message is the rule's own `message`, else the rule in words, which is
 * also the input prompt. A `pattern`, `noneOf`, `unique` or two checks Excel cannot hold in one rule skip it.
 *
 * @param rule - The rule.
 * @param o - The title Excel shows (a column's title or a cell; cut to 32 characters) and the pane's `onInvalid`.
 * @returns `{ dv }`, `{ skip }` with its SP code, or `undefined` when the rule checks nothing (`type: 'text'` alone).
 */
export function validationOf(rule: ColumnRule, o: { title?: string; onInvalid?: OnInvalid | undefined } = {}): MappedRule {
  if (rule.pattern !== undefined) return skip('SP-5401', 'pattern', `a pattern (/${rule.pattern}/): Excel's data validation has no regular expressions`);
  if (rule.noneOf !== undefined) return skip('SP-5401', 'noneOf', 'a list of values not allowed (noneOf): Excel has no "none of" rule');
  if (rule.unique) return skip('SP-5401', 'unique', 'unique in the column: Excel needs a formula rule for that');
  const required = !!rule.required || rule.equals !== undefined;
  const type = rule.type === 'text' ? undefined : rule.type;
  const bounds = rule.min !== undefined || rule.max !== undefined;
  const lengths = rule.minLength !== undefined || rule.maxLength !== undefined;
  const combo = (what: string) => skip('SP-5402', 'combination', `${what}: one Excel rule holds one check`);
  if (rule.equals !== undefined && rule.oneOf) return combo('equals and oneOf');
  const items = rule.equals !== undefined ? [rule.equals] : rule.oneOf;
  let core: Pick<DataValidation, 'type' | 'operator' | 'formula1' | 'formula2'>;
  if (items) {
    const fits = (x: string | number | boolean) => (type === undefined ? true : type === 'number' ? typeof x === 'number' : type === 'integer' ? Number.isInteger(x) : type === 'boolean' ? typeof x === 'boolean' : false);
    if (bounds || lengths || !items.every(fits)) return combo(`a list with ${bounds ? 'min or max' : lengths ? 'a length' : `type ${String(rule.type)}`}`);
    if (!items.length) return skip('SP-5403', 'list', 'an empty list');
    const texts = items.map(listText);
    const comma = texts.find((t) => t.includes(','));
    if (comma !== undefined) return skip('SP-5403', 'list', `“${comma}” holds a comma: Excel's typed-out list splits on commas`);
    const body = texts.map((t) => t.replace(/"/g, '""')).join(',');
    if (body.length > LIST_MAX) return skip('SP-5403', 'list', `the list is ${body.length} characters: Excel types out ${LIST_MAX}`);
    core = { type: 'list', formula1: `"${body}"` };
  } else if (type === 'boolean') {
    if (bounds || lengths) return combo('TRUE or FALSE with a bound');
    core = { type: 'list', formula1: '"TRUE,FALSE"' };
  } else if (type === 'number' || type === 'integer' || (type === undefined && bounds)) {
    if (lengths) return combo('a number with a length');
    const lo = rule.min === undefined ? undefined : numberBound(rule.min), hi = rule.max === undefined ? undefined : numberBound(rule.max);
    if (lo !== undefined && !Number.isFinite(lo)) return skip('SP-5404', 'bound', `min ${JSON.stringify(rule.min)} is not a number`);
    if (hi !== undefined && !Number.isFinite(hi)) return skip('SP-5404', 'bound', `max ${JSON.stringify(rule.max)} is not a number`);
    if (lo !== undefined && hi !== undefined && lo > hi) return skip('SP-5404', 'bound', `min ${lo} is above max ${hi}`);
    core = { type: type === 'integer' ? 'whole' : 'decimal', ...bounded(lo === undefined ? undefined : String(lo), hi === undefined ? undefined : String(hi), [`-${BIG}`, BIG]) };
  } else if (type === 'date') {
    if (lengths) return combo('a date with a length');
    const lo = rule.min === undefined ? undefined : dateBound(rule.min), hi = rule.max === undefined ? undefined : dateBound(rule.max);
    if (rule.min !== undefined && !lo) return skip('SP-5404', 'bound', `min ${JSON.stringify(rule.min)} is not a date Excel can read: write it as 2026-01-31 or a serial`);
    if (rule.max !== undefined && !hi) return skip('SP-5404', 'bound', `max ${JSON.stringify(rule.max)} is not a date Excel can read: write it as 2026-01-31 or a serial`);
    if (lo && hi && lo.at > hi.at) return skip('SP-5404', 'bound', `min ${String(rule.min)} is after max ${String(rule.max)}`);
    core = { type: 'date', ...bounded(lo?.f, hi?.f, ['DATE(1900,1,1)', 'DATE(9999,12,31)']) };
  } else if (lengths) {
    const ok = (n: unknown) => n === undefined || (typeof n === 'number' && Number.isInteger(n) && n >= 0);
    if (!ok(rule.minLength) || !ok(rule.maxLength)) return skip('SP-5404', 'bound', 'minLength and maxLength must be whole numbers from 0');
    if (rule.minLength !== undefined && rule.maxLength !== undefined && rule.minLength > rule.maxLength) return skip('SP-5404', 'bound', `minLength ${rule.minLength} is above maxLength ${rule.maxLength}`);
    core = { type: 'textLength', ...bounded(rule.minLength === undefined ? undefined : String(rule.minLength), rule.maxLength === undefined ? undefined : String(rule.maxLength), ['0', '32767']) };
  } else if (required) {
    core = { type: 'textLength', operator: 'greaterThanOrEqual', formula1: '1' };
  } else return undefined;
  const words = describeRule(rule);
  const title = cut(o.title ?? '', TITLE_MAX);
  const onInvalid = rule.onInvalid ?? o.onInvalid ?? 'flag';
  const dv: Omit<DataValidation, 'sqref'> = {
    ...core,
    allowBlank: !required,
    showErrorMessage: true,
    showDropDown: false,
    errorStyle: onInvalid === 'block' ? 'stop' : rule.severity === 'note' ? 'information' : 'warning',
    error: cut(rule.message ?? words, MESSAGE_MAX),
  };
  if (title) { dv.errorTitle = title; dv.promptTitle = title; }
  if (words) dv.prompt = cut(words, MESSAGE_MAX);
  return { dv };
}

// ── ranges ────────────────────────────────────────────────────────────────
const meets = (a: Box, b: Box) => a.top <= b.bottom && b.top <= a.bottom && a.left <= b.right && b.left <= a.right;
const overlap = (a: Box, b: Box): Box => ({ top: Math.max(a.top, b.top), left: Math.max(a.left, b.left), bottom: Math.min(a.bottom, b.bottom), right: Math.min(a.right, b.right) });
/** `a` without `b`: up to four boxes (above, below, left, right of the overlap). */
function minus(a: Box, b: Box): Box[] {
  if (!meets(a, b)) return [a];
  const out: Box[] = [];
  if (a.top < b.top) out.push({ ...a, bottom: b.top - 1 });
  if (a.bottom > b.bottom) out.push({ ...a, top: b.bottom + 1 });
  const top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom);
  if (a.left < b.left) out.push({ top, bottom, left: a.left, right: b.left - 1 });
  if (a.right > b.right) out.push({ top, bottom, left: b.right + 1, right: a.right });
  return out;
}
const sqrefOf = (boxes: readonly Box[]) => boxes.map((b) => rangeRef(b));

/** Two rules that check the same thing (their messages aside): the second joins the first instead of being added. */
function sameCheck(a: Omit<DataValidation, 'sqref'>, b: Omit<DataValidation, 'sqref'>): boolean {
  const f = (x: string | undefined) => (x ?? '').trim().replace(/^=/, '');
  const ordered = a.type !== 'list' && a.type !== 'custom' && a.type !== 'none';
  const two = (a.operator ?? 'between') === 'between' || a.operator === 'notBetween';
  return a.type === b.type && a.allowBlank === b.allowBlank && f(a.formula1) === f(b.formula1)
    && (!ordered || ((a.operator ?? 'between') === (b.operator ?? 'between') && (!two || f(a.formula2) === f(b.formula2))));
}

/** A rule placed on a sheet: the workbook's own (`own`) or a written one; `inBlock` when it is in the main `<dataValidations>`. */
interface Placed { dv: DataValidation; boxes: Box[]; own: boolean; inBlock: boolean; where: string }

/**
 * The host's rules as each sheet's whole `<dataValidations>` set: the workbook's own rules, kept as they are, plus
 * every rule of the rules file and the element's `columns` that Excel can hold. A column rule covers its column from
 * the row under the titles to the last row; a cell rule its cell or range. Where a rule already holds a cell the
 * workbook's own rule wins: the written rule leaves those cells (a conflict, SP-5406) or, when it checks the same thing,
 * joins the workbook's rule instead of repeating it. A cell rule wins over a column rule, a named sheet's over `*`'s.
 *
 * @param store - The workbook store: its workbook and its `columnRules`.
 * @param o - `inBlock(sheet)`: how many of the sheet's own rules (in the order read) are in the main block — the rest
 *   are Excel 2010 `x14` rules, left where they are and never repeated; all of them when absent.
 * @returns Each changed sheet's whole set, ready for `setDataValidations` or `patchXlsx`'s `dataValidations`, and the report.
 */
export function rulesAsValidations(store: WorkbookStore, o: { inBlock?: (sheet: string) => number | undefined } = {}): RulesWritePlan {
  const plan: RulesWritePlan = { sheets: [], written: 0, merged: 0, skipped: [], conflicts: [] };
  const book = store.book;
  if (!book) return plan;
  const cfg = store.columnRules;
  const doc = cfg.document === undefined ? undefined : checkDocument(cfg.document);
  const star = doc?.sheets.get('*');
  const names = new Set(book.sheets.map((s) => s.name));
  for (const name of doc?.sheets.keys() ?? []) if (name !== '*' && !names.has(name)) plan.skipped.push({ code: 'SP-5405', sheet: name, where: `sheet “${name}”`, reason: 'sheet', detail: `no sheet is named “${name}”: its rules are not written` });
  const general = new Map<string, string>(); // title (lower case) → as written, for the element's and "*"'s columns
  for (const t of [...Object.keys(cfg.columns ?? {}), ...Object.keys(star?.columns ?? {})]) general.set(t.trim().toLowerCase(), t);
  const foundGeneral = new Set<string>();
  for (const s of book.sheets) {
    const own = doc?.sheets.get(s.name);
    const headerRow = Math.max(1, Math.floor(own?.headerRow ?? star?.headerRow ?? cfg.headerRow ?? 1));
    // the columns, merged as the rules engine merges them: element < "*" < this sheet
    const byTitle = new Map<string, { title: string; rule: ColumnRule }>();
    for (const src of [cfg.columns ?? {}, star?.columns ?? {}, own?.columns ?? {}]) for (const [t, r] of Object.entries(src)) byTitle.set(t.trim().toLowerCase(), { title: t, rule: r });
    const seen = new Set<string>();
    const cols: { col: number; title: string; rule: ColumnRule }[] = [];
    const width = s.rows[headerRow - 1]?.length ?? 0;
    for (let c = 0; c < width; c++) {
      const t = store.text(s.name, cellRef(headerRow - 1, c)).trim(), k = t.toLowerCase();
      if (!t || seen.has(k)) continue;
      seen.add(k);
      const hit = byTitle.get(k);
      if (hit) { cols.push({ col: c, title: t, rule: hit.rule }); if (general.has(k)) foundGeneral.add(k); }
    }
    for (const t of Object.keys(own?.columns ?? {})) if (!seen.has(t.trim().toLowerCase())) plan.skipped.push({ code: 'SP-5405', sheet: s.name, where: `column “${t}”`, reason: 'column', detail: `no column is titled “${t}” in row ${headerRow} of “${s.name}”` });
    // the rules to write, the strongest first: this sheet's cells, "*"'s cells, then the columns
    const wanted: { where: string; title: string; box: Box; rule: ColumnRule }[] = [];
    for (const src of [own?.cells, star?.cells]) for (const [ref, r] of Object.entries(src ?? {})) { const box = parseRange(ref); if (box) wanted.push({ where: `${ref.includes(':') ? 'cells' : 'cell'} ${ref}`, title: ref, box, rule: r }); }
    for (const c of cols) wanted.push({ where: `column “${c.title}”`, title: c.title, box: { top: headerRow, left: c.col, bottom: MAX_ROWS - 1, right: c.col }, rule: c.rule });
    if (!wanted.length) continue;
    const n = o.inBlock?.(s.name) ?? s.dataValidations.length;
    const placed: Placed[] = s.dataValidations.map((dv, i) => ({ dv: { ...dv, sqref: [...dv.sqref] }, boxes: dv.sqref.map(parseBox).filter((b): b is Box => !!b), own: true, inBlock: i < n, where: '' }));
    let written = 0;
    for (const w of wanted) {
      const m = validationOf(w.rule, { title: w.title, onInvalid: cfg.onInvalid });
      if (!m) continue;
      if (m.skip) { plan.skipped.push({ ...m.skip, sheet: s.name, where: w.where }); continue; }
      let pieces = [w.box];
      for (const p of placed) {
        const hit = p.boxes.flatMap((b) => pieces.filter((x) => meets(x, b)).map((x) => overlap(x, b)));
        if (!hit.length) continue;
        if (!sameCheck(p.dv, m.dv)) plan.conflicts.push({ code: 'SP-5406', sheet: s.name, cells: sqrefOf(hit).join(' '), where: w.where, kept: p.own ? `the workbook's own ${p.dv.type} rule` : p.where });
        pieces = p.boxes.reduce((left, b) => left.flatMap((x) => minus(x, b)), pieces);
      }
      if (!pieces.length) continue;
      plan.written++;
      written++;
      const join = placed.find((p) => p.inBlock && sameCheck(p.dv, m.dv));
      if (join) { join.dv.sqref.push(...sqrefOf(pieces)); join.boxes.push(...pieces); if (join.own) plan.merged++; }
      else placed.push({ dv: { ...m.dv, sqref: sqrefOf(pieces) }, boxes: pieces, own: false, inBlock: true, where: w.where });
    }
    if (written) plan.sheets.push({ sheet: s.name, rules: placed.filter((p) => p.inBlock).map((p) => p.dv), written });
  }
  for (const [k, t] of general) if (!foundGeneral.has(k)) plan.skipped.push({ code: 'SP-5405', sheet: '*', where: `column “${t}”`, reason: 'column', detail: `no sheet has a column titled “${t}”` });
  return plan;
}

/**
 * How many `<dataValidation>`s a worksheet holds in its main block (Excel 2010's `x14:` ones, inside `<extLst>`, not counted).
 *
 * @param xml - The worksheet's XML.
 * @returns The count — the first that many of the sheet's rules, in the order `@sheetpane/import` reads them.
 */
export function mainBlockCount(xml: string): number {
  const body = xml.replace(/<((?:[\w.-]+:)?)extLst\b[\s\S]*?<\/\1extLst>/g, '');
  return (body.match(/<(?:[\w.-]+:)?dataValidation[\s/>]/g) ?? []).length;
}

const reports = new WeakMap<Book, RulesWriteReport>();

/**
 * The report of the last export that wrote the rules (the status line reads it).
 *
 * @param book - The workbook, or `undefined`.
 * @returns The report, or `undefined` before the first such export.
 */
export function lastRulesWrite(book: Book | undefined): RulesWriteReport | undefined {
  return book ? reports.get(book) : undefined;
}

/**
 * Writes the host's rules into an `.xlsx` being exported, from an `exportPatch` hook: each changed sheet's
 * `<dataValidations>` rewritten to its whole set ({@link rulesAsValidations}), `x14` rules left where they are. A
 * sheet whose own rules cannot be rewritten (SP-2015) keeps its block and its written rules are listed (SP-5407).
 * Every rule not written, and every conflict, is a console warning with its code.
 *
 * @param patch - The `exportPatch` context.
 * @param store - The workbook store.
 * @returns The report.
 */
export async function writeRules(patch: PatchContext, store: WorkbookStore): Promise<RulesWriteReport> {
  const book = store.book;
  const xml = new Map<string, string>(), count = new Map<string, number>();
  for (const s of book?.sheets ?? []) {
    if (!s.dataValidations.length) continue;
    const path = patch.sheetPath(s.name), text = path ? await patch.readText(path) : undefined;
    if (text === undefined) continue;
    xml.set(s.name, text);
    count.set(s.name, mainBlockCount(text));
  }
  const plan = rulesAsValidations(store, { inBlock: (sheet) => count.get(sheet) });
  const report: RulesWriteReport = { written: plan.written, merged: plan.merged, skipped: plan.skipped, conflicts: plan.conflicts };
  for (const { sheet, rules, written } of plan.sheets) {
    const path = patch.sheetPath(sheet);
    const text = xml.get(sheet) ?? (path ? await patch.readText(path) : undefined);
    let why = path && text !== undefined ? '' : `no worksheet part for “${sheet}”`;
    if (path && text !== undefined) {
      try { patch.write(path, setDataValidations(text, rules, sheet)); } catch (e) { why = (e as Error).message; }
    }
    if (why) {
      report.written -= written;
      report.skipped.push({ code: 'SP-5407', sheet, where: `sheet “${sheet}”`, reason: 'workbook', detail: `the sheet's own rules could not be rewritten, so none were written to it: ${why}` });
    }
  }
  if (book) reports.set(book, report);
  for (const x of report.skipped) console.warn(spMessage(x.code, `sheetpane validation: ${x.where}${x.sheet === '*' || x.where.startsWith('sheet') ? '' : ` on “${x.sheet}”`} not written to Excel: ${x.detail}`));
  for (const c of report.conflicts) console.warn(spMessage(c.code, `sheetpane validation: ${c.where} on “${c.sheet}” not written to ${c.cells}: ${c.kept} holds those cells`));
  return report;
}
