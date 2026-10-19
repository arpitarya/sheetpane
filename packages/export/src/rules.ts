// Data validation and conditional formatting (W-57): the rules a sheet carries,
// checked, then written as `<dataValidations>`, `<conditionalFormatting>` and
// the `<dxfs>` they apply — the shapes @sheetpane/import reads, so what is
// written is what is read back.
import { ExportError } from './errors.js';
import { parseRange } from './refs.js';
import type { Border, Cfvo, CfRule, Color, ConditionalFormat, DataValidation, Dxf, Fill, Font } from './types.js';
import { cleanXmlChars, escapeAttr, escapeText } from './xml.js';

const DV_TYPES = new Set(['none', 'whole', 'decimal', 'list', 'date', 'time', 'textLength', 'custom']);
const DV_OPERATORS = new Set(['between', 'notBetween', 'equal', 'notEqual', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual']);
const ERROR_STYLES = new Set(['stop', 'warning', 'information']);
const CF_TYPES = new Set(['expression', 'cellIs', 'colorScale', 'dataBar', 'iconSet', 'top10', 'uniqueValues', 'duplicateValues', 'containsText', 'notContainsText', 'beginsWith', 'endsWith', 'containsBlanks', 'notContainsBlanks', 'containsErrors', 'notContainsErrors', 'timePeriod', 'aboveAverage']);
const CF_OPERATORS = new Set([...DV_OPERATORS, 'containsText', 'notContains', 'beginsWith', 'endsWith']);
const TIME_PERIODS = new Set(['today', 'yesterday', 'tomorrow', 'last7Days', 'thisMonth', 'lastMonth', 'nextMonth', 'thisWeek', 'lastWeek', 'nextWeek']);
const CFVO_TYPES = new Set(['num', 'percent', 'max', 'min', 'formula', 'percentile']);
const ICON_SETS = new Set(['3Arrows', '3ArrowsGray', '3Flags', '3TrafficLights1', '3TrafficLights2', '3Signs', '3Symbols', '3Symbols2', '4Arrows', '4ArrowsGray', '4RedToBlack', '4Rating', '4TrafficLights', '5Arrows', '5ArrowsGray', '5Rating', '5Quarters']);
/** Excel's own limits on a rule's messages; past them Excel repairs the file. */
const TITLE_MAX = 32, MESSAGE_MAX = 255, LIST_MAX = 255;

// ── Checks ──────────────────────────────────────────────────────────────────

function refuse(sheet: string, ref: string | undefined, why: string): never {
  throw new ExportError('bad-rule', `sheet "${sheet}" ${why}`, ref === undefined ? { sheet } : { sheet, ref });
}

function checkSqref(sqref: unknown, sheet: string, what: string): string {
  if (!Array.isArray(sqref) || sqref.length === 0) refuse(sheet, undefined, `${what} covers no range (sqref is empty)`);
  for (const r of sqref) if (typeof r !== 'string' || !parseRange(r)) refuse(sheet, String(r), `${what} range "${String(r)}" is not a cell or range`);
  return sqref.join(' ');
}

function checkText(v: unknown, max: number, sheet: string, ref: string, what: string): void {
  if (v === undefined) return;
  if (typeof v !== 'string') refuse(sheet, ref, `${what} is not text`);
  if (v.length > max) refuse(sheet, ref, `${what} has ${v.length} characters; Excel allows ${max}`);
}

/**
 * Throws an `ExportError` (`bad-rule`, SP-2015) unless every rule can be written as Excel reads it: ranges,
 * known types and operators, Excel's length limits on titles, messages and a quoted list.
 *
 * @param rules - The sheet's data-validation rules.
 * @param sheet - The sheet's name, for the error.
 */
export function checkDataValidations(rules: unknown, sheet: string): asserts rules is DataValidation[] {
  if (!Array.isArray(rules)) refuse(sheet, undefined, 'dataValidations is not an array');
  for (const dv of rules as DataValidation[]) {
    const ref = checkSqref(dv?.sqref, sheet, 'a data-validation rule');
    if (!DV_TYPES.has(dv.type)) refuse(sheet, ref, `data validation type "${dv.type}" is not one of ${[...DV_TYPES].join(', ')}`);
    if (dv.operator !== undefined && !DV_OPERATORS.has(dv.operator)) refuse(sheet, ref, `data validation operator "${dv.operator}" is unknown`);
    if (dv.errorStyle !== undefined && !ERROR_STYLES.has(dv.errorStyle)) refuse(sheet, ref, `data validation errorStyle "${dv.errorStyle}" is not stop, warning or information`);
    checkText(dv.errorTitle, TITLE_MAX, sheet, ref, 'errorTitle');
    checkText(dv.promptTitle, TITLE_MAX, sheet, ref, 'promptTitle');
    checkText(dv.error, MESSAGE_MAX, sheet, ref, 'error');
    checkText(dv.prompt, MESSAGE_MAX, sheet, ref, 'prompt');
    checkText(dv.formula1, Infinity, sheet, ref, 'formula1');
    checkText(dv.formula2, Infinity, sheet, ref, 'formula2');
    if (dv.type === 'list' && dv.formula1?.startsWith('"') && dv.formula1.length - 2 > LIST_MAX) {
      refuse(sheet, ref, `a list's items are ${dv.formula1.length - 2} characters; Excel allows ${LIST_MAX} — put them on a sheet and name the range`);
    }
  }
}

function checkCfvos(list: unknown, sheet: string, ref: string, what: string, min: number, max: number): void {
  if (!Array.isArray(list) || list.length < min || list.length > max) refuse(sheet, ref, `a ${what} needs ${min === max ? min : `${min}–${max}`} thresholds (cfvo)`);
  for (const c of list as Cfvo[]) if (!CFVO_TYPES.has(c?.type)) refuse(sheet, ref, `cfvo type "${c?.type}" is not one of ${[...CFVO_TYPES].join(', ')}`);
}

/**
 * Throws an `ExportError` (`bad-rule`, SP-2015) unless every conditional format can be written as Excel reads it:
 * ranges, at least one rule, known types, a `dxfId` the workbook has, the thresholds each scale, bar and icon set needs.
 *
 * @param formats - The sheet's conditional formats.
 * @param sheet - The sheet's name, for the error.
 * @param dxfCount - How many differential formats the workbook will have; every `dxfId` must be below it.
 */
export function checkConditionalFormats(formats: unknown, sheet: string, dxfCount: number): asserts formats is ConditionalFormat[] {
  if (!Array.isArray(formats)) refuse(sheet, undefined, 'conditionalFormats is not an array');
  for (const cf of formats as ConditionalFormat[]) {
    const ref = checkSqref(cf?.sqref, sheet, 'a conditional format');
    if (!Array.isArray(cf.rules) || cf.rules.length === 0) refuse(sheet, ref, 'a conditional format needs at least one rule');
    for (const r of cf.rules) {
      if (!CF_TYPES.has(r?.type)) refuse(sheet, ref, `conditional-format type "${r?.type}" is not one of ${[...CF_TYPES].join(', ')}`);
      if (!Number.isInteger(r.priority)) refuse(sheet, ref, `a conditional-format rule's priority must be a whole number, not ${r.priority}`);
      if (r.dxfId !== undefined && !(Number.isInteger(r.dxfId) && r.dxfId >= 0 && r.dxfId < dxfCount)) {
        refuse(sheet, ref, `dxfId ${r.dxfId} names no differential format (the workbook has ${dxfCount})`);
      }
      if (r.operator !== undefined && !CF_OPERATORS.has(r.operator)) refuse(sheet, ref, `conditional-format operator "${r.operator}" is unknown`);
      if (r.timePeriod !== undefined && !TIME_PERIODS.has(r.timePeriod)) refuse(sheet, ref, `timePeriod "${r.timePeriod}" is unknown`);
      if (!Array.isArray(r.formulas) || r.formulas.length > 3 || r.formulas.some((f) => typeof f !== 'string')) refuse(sheet, ref, 'a conditional-format rule has up to three formulas, each text');
      if (r.type === 'colorScale' || r.colorScale) {
        checkCfvos(r.colorScale?.cfvo, sheet, ref, 'colour scale', 2, 3);
        if (r.colorScale!.colors?.length !== r.colorScale!.cfvo.length) refuse(sheet, ref, 'a colour scale needs one colour per threshold');
      }
      if (r.type === 'dataBar' || r.dataBar) {
        checkCfvos(r.dataBar?.cfvo, sheet, ref, 'data bar', 2, 2);
        if (!r.dataBar!.color) refuse(sheet, ref, 'a data bar needs a colour');
      }
      if (r.type === 'iconSet' || r.iconSet) {
        checkCfvos(r.iconSet?.cfvo, sheet, ref, 'icon set', 2, 5);
        if (r.iconSet!.iconSet !== undefined && !ICON_SETS.has(r.iconSet!.iconSet)) refuse(sheet, ref, `icon set "${r.iconSet!.iconSet}" is unknown`);
      }
    }
  }
}

// ── Writers ─────────────────────────────────────────────────────────────────

/** An attribute value: forbidden characters dropped, line breaks and tabs as references so they survive parsing. */
function av(v: string | number): string {
  return escapeAttr(cleanXmlChars(String(v)).text).replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
}
const at = (name: string, v: string | number | undefined) => (v === undefined ? '' : ` ${name}="${av(v)}"`);
const flag = (name: string, v: boolean | undefined) => (v === undefined ? '' : ` ${name}="${v ? 1 : 0}"`);
const on = (name: string, v: boolean | undefined) => (v ? ` ${name}="1"` : '');
/** Element text: a carriage return as a reference, or XML parsing would turn it into a line feed. */
const text = (v: string) => escapeText(cleanXmlChars(v).text).replace(/\r/g, '&#13;');

/**
 * One `<dataValidations>` element for a sheet's rules, `''` when there are none.
 *
 * @param rules - The rules, already checked.
 * @param P - The worksheet's namespace prefix, e.g. `x:` or `''`.
 * @returns The element's XML.
 */
export function dataValidationsXml(rules: DataValidation[], P = ''): string {
  if (!rules.length) return '';
  const one = (dv: DataValidation) => {
    const kids = (dv.formula1 !== undefined ? `<${P}formula1>${text(dv.formula1)}</${P}formula1>` : '') + (dv.formula2 !== undefined ? `<${P}formula2>${text(dv.formula2)}</${P}formula2>` : '');
    const attrs = (dv.type !== 'none' ? at('type', dv.type) : '') + at('errorStyle', dv.errorStyle) + at('operator', dv.operator)
      + on('allowBlank', dv.allowBlank) + on('showDropDown', dv.showDropDown)
      + on('showInputMessage', dv.prompt !== undefined || dv.promptTitle !== undefined) + on('showErrorMessage', dv.showErrorMessage)
      + at('errorTitle', dv.errorTitle) + at('error', dv.error) + at('promptTitle', dv.promptTitle) + at('prompt', dv.prompt)
      + at('sqref', dv.sqref.join(' '));
    return kids ? `<${P}dataValidation${attrs}>${kids}</${P}dataValidation>` : `<${P}dataValidation${attrs}/>`;
  };
  return `<${P}dataValidations count="${rules.length}">${rules.map(one).join('')}</${P}dataValidations>`;
}

function colorXml(c: Color | undefined, tag: string, P: string): string {
  if (!c) return '';
  return `<${P}${tag}${on('auto', c.auto)}${at('indexed', c.indexed)}${at('rgb', c.rgb)}${at('theme', c.theme)}${at('tint', c.tint)}/>`;
}
const cfvoXml = (c: Cfvo, P: string) => `<${P}cfvo${at('type', c.type)}${at('val', c.val)}${flag('gte', c.gte)}/>`;

function cfRuleXml(r: CfRule, P: string): string {
  const attrs = at('type', r.type) + at('dxfId', r.dxfId) + at('priority', r.priority) + on('stopIfTrue', r.stopIfTrue)
    + flag('aboveAverage', r.aboveAverage) + flag('percent', r.percent) + flag('bottom', r.bottom)
    + at('operator', r.operator) + at('text', r.text) + at('timePeriod', r.timePeriod) + at('rank', r.rank);
  let kids = r.formulas.map((f) => `<${P}formula>${text(f)}</${P}formula>`).join('');
  if (r.colorScale) kids += `<${P}colorScale>${r.colorScale.cfvo.map((c) => cfvoXml(c, P)).join('')}${r.colorScale.colors.map((c) => colorXml(c, 'color', P)).join('')}</${P}colorScale>`;
  if (r.dataBar) kids += `<${P}dataBar${at('minLength', r.dataBar.minLength)}${at('maxLength', r.dataBar.maxLength)}>${r.dataBar.cfvo.map((c) => cfvoXml(c, P)).join('')}${colorXml(r.dataBar.color, 'color', P)}</${P}dataBar>`;
  if (r.iconSet) kids += `<${P}iconSet${at('iconSet', r.iconSet.iconSet)}>${r.iconSet.cfvo.map((c) => cfvoXml(c, P)).join('')}</${P}iconSet>`;
  return kids ? `<${P}cfRule${attrs}>${kids}</${P}cfRule>` : `<${P}cfRule${attrs}/>`;
}

/**
 * The `<conditionalFormatting>` elements for a sheet's formats, one per format, `''` when there are none.
 *
 * @param formats - The formats, already checked.
 * @param P - The worksheet's namespace prefix, e.g. `x:` or `''`.
 * @returns The elements' XML.
 */
export function conditionalFormatsXml(formats: ConditionalFormat[], P = ''): string {
  return formats.map((cf) => `<${P}conditionalFormatting sqref="${av(cf.sqref.join(' '))}">${cf.rules.map((r) => cfRuleXml(r, P)).join('')}</${P}conditionalFormatting>`).join('');
}

function fontXml(f: Font, P: string): string {
  const v = (tag: string, x: string | number | undefined) => (x === undefined ? '' : `<${P}${tag} val="${av(x)}"/>`);
  const b = (tag: string, x: boolean | undefined) => (x === undefined ? '' : x ? `<${P}${tag}/>` : `<${P}${tag} val="0"/>`);
  return `<${P}font>${b('b', f.b)}${b('i', f.i)}${b('strike', f.strike)}${f.u === undefined ? '' : f.u === 'single' ? `<${P}u/>` : v('u', f.u)}${v('vertAlign', f.vertAlign)}${v('sz', f.sz)}${colorXml(f.color, 'color', P)}${v('name', f.name)}</${P}font>`;
}

function fillXml(f: Fill, P: string): string {
  if (f.gradient) {
    const g = f.gradient;
    return `<${P}fill><${P}gradientFill${at('type', g.type)}${at('degree', g.degree)}>${g.stops.map((s) => `<${P}stop position="${av(s.position)}">${colorXml(s.color, 'color', P)}</${P}stop>`).join('')}</${P}gradientFill></${P}fill>`;
  }
  const kids = colorXml(f.fgColor, 'fgColor', P) + colorXml(f.bgColor, 'bgColor', P);
  return `<${P}fill><${P}patternFill${at('patternType', f.patternType)}${kids ? `>${kids}</${P}patternFill>` : '/>'}</${P}fill>`;
}

function borderXml(b: Border, P: string): string {
  const side = (n: 'left' | 'right' | 'top' | 'bottom' | 'diagonal') => {
    const s = b[n];
    if (!s) return '';
    const c = colorXml(s.color, 'color', P);
    return c ? `<${P}${n}${at('style', s.style)}>${c}</${P}${n}>` : `<${P}${n}${at('style', s.style)}/>`;
  };
  return `<${P}border>${side('left')}${side('right')}${side('top')}${side('bottom')}${side('diagonal')}</${P}border>`;
}

/**
 * One `<dxf>`: font, number format, fill, alignment and border, in schema order.
 *
 * @param d - The differential format.
 * @param P - The style sheet's namespace prefix.
 * @returns The element's XML.
 */
export function dxfXml(d: Dxf, P = ''): string {
  const a = d.alignment;
  const align = a ? `<${P}alignment${at('horizontal', a.horizontal)}${at('vertical', a.vertical)}${a.textRotation ? at('textRotation', a.textRotation) : ''}${on('wrapText', a.wrapText)}${a.indent ? at('indent', a.indent) : ''}${on('shrinkToFit', a.shrinkToFit)}/>` : '';
  return `<${P}dxf>${d.font ? fontXml(d.font, P) : ''}${d.numFmt ? `<${P}numFmt numFmtId="${av(d.numFmt.id)}" formatCode="${av(d.numFmt.code)}"/>` : ''}${d.fill ? fillXml(d.fill, P) : ''}${align}${d.border ? borderXml(d.border, P) : ''}</${P}dxf>`;
}

/**
 * Throws an `ExportError` (`bad-rule`, SP-2015) unless `dxfs` is a list of objects.
 *
 * @param dxfs - The differential formats.
 */
export function checkDxfs(dxfs: unknown): asserts dxfs is Dxf[] | undefined {
  if (dxfs === undefined) return;
  if (!Array.isArray(dxfs) || dxfs.some((d) => !d || typeof d !== 'object')) throw new ExportError('bad-rule', 'dxfs must be a list of differential formats (objects)');
}
