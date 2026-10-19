// W-57 DoD 3: fast-check arbitraries for data validation, conditional formats and dxfs in the shapes
// @sheetpane/import reads — only values the reader can give back (no `false` where it reads presence, no -0).
import { expect } from 'vitest';
import fc from 'fast-check';
import { cellRef, patchXlsx, rangeRef, toXlsx, type CfRule, type Cfvo, type Color, type ConditionalFormat, type DataValidation, type Dxf } from '@sheetpane/export';
import { fromXlsx } from '../src/index.js';

const text = (max: number) => fc.string({ unit: fc.constantFrom('a', 'Z', '1', ' ', '<', '>', '&', '"', "'", '\n', '\r', '\t', 'é', '€', '_', '=', ','), maxLength: max });
const opt = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined });
/** Drops the keys whose value is undefined, so the object has only what the reader sets. */
const defined = <T extends object>(o: T): Strip<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Strip<T>;
/** `{ a: X | undefined }` → `{ a?: X }`, as `exactOptionalPropertyTypes` reads an optional key. */
type Strip<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & { [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined> };

const cell = fc.tuple(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 40 }));
const range = fc.tuple(cell, cell).map(([[r1, c1], [r2, c2]]) => rangeRef({ top: Math.min(r1, r2), left: Math.min(c1, c2), bottom: Math.max(r1, r2), right: Math.max(c1, c2) }));
const sqref = fc.array(fc.oneof(range, cell.map(([r, c]) => cellRef(r, c))), { minLength: 1, maxLength: 3 });

export const dataValidation: fc.Arbitrary<DataValidation> = fc.record({
  sqref,
  type: fc.constantFrom('none', 'whole', 'decimal', 'list', 'date', 'time', 'textLength', 'custom'),
  operator: opt(fc.constantFrom('between', 'notBetween', 'equal', 'notEqual', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual')),
  allowBlank: fc.boolean(),
  showErrorMessage: fc.boolean(),
  showDropDown: fc.boolean(),
  errorStyle: opt(fc.constantFrom('stop', 'warning', 'information')),
  errorTitle: opt(text(32)),
  error: opt(text(60)),
  promptTitle: opt(text(32)),
  prompt: opt(text(60)),
  formula1: opt(text(40)),
  formula2: opt(text(40)),
}).map(defined);

const tint = fc.integer({ min: -100, max: 100 }).map((n) => n / 100 || 0);
export const color: fc.Arbitrary<Color> = fc.record({
  rgb: opt(fc.stringMatching(/^[0-9A-F]{8}$/)),
  theme: opt(fc.integer({ min: 0, max: 11 })),
  tint: opt(tint),
  indexed: opt(fc.integer({ min: 0, max: 64 })),
  auto: opt(fc.constant(true)),
}).map(defined);

const yes = opt(fc.constant(true as const));
const font = fc.record({
  b: yes, i: yes, strike: yes,
  u: opt(fc.constantFrom('single', 'double', 'singleAccounting', 'doubleAccounting')),
  sz: opt(fc.integer({ min: 1, max: 72 })),
  color: opt(color),
  name: opt(fc.constantFrom('Calibri', 'Arial', 'Aptos Narrow')),
  vertAlign: opt(fc.constantFrom('superscript', 'subscript', 'baseline')),
}).map(defined);
const fill = fc.oneof(
  fc.record({ patternType: opt(fc.constantFrom('solid', 'none', 'gray125', 'darkGrid')), fgColor: opt(color), bgColor: opt(color) }).map(defined),
  fc.record({
    gradient: fc.record({
      type: opt(fc.constantFrom('linear', 'path')),
      degree: opt(fc.integer({ min: 0, max: 359 })),
      stops: fc.array(fc.record({ position: fc.integer({ min: 0, max: 100 }).map((n) => n / 100), color }), { maxLength: 3 }),
    }).map(defined),
  }),
);
const side = fc.record({ style: fc.constantFrom('thin', 'medium', 'dashed', 'double'), color: opt(color) }).map(defined);
const border = fc.record({ left: opt(side), right: opt(side), top: opt(side), bottom: opt(side), diagonal: opt(side) }).map(defined);
const alignment = fc.record({
  horizontal: opt(fc.constantFrom('left', 'center', 'right')), vertical: opt(fc.constantFrom('top', 'center', 'bottom')),
  wrapText: yes, indent: opt(fc.integer({ min: 1, max: 15 })), textRotation: opt(fc.integer({ min: 1, max: 180 })), shrinkToFit: yes,
}).map(defined);
export const dxf: fc.Arbitrary<Dxf> = fc.record({
  font: opt(font), fill: opt(fill), border: opt(border),
  numFmt: opt(fc.record({ id: fc.integer({ min: 0, max: 300 }), code: text(12) })), alignment: opt(alignment),
}).map(defined);

const cfvo: fc.Arbitrary<Cfvo> = fc.record({ type: fc.constantFrom('num', 'percent', 'max', 'min', 'formula', 'percentile'), val: opt(text(8)), gte: opt(fc.boolean()) }).map(defined);
const base = (dxfCount: number) => ({
  priority: fc.integer({ min: 1, max: 99 }),
  stopIfTrue: fc.boolean(),
  dxfId: dxfCount ? opt(fc.integer({ min: 0, max: dxfCount - 1 })) : fc.constant(undefined),
  operator: opt(fc.constantFrom('lessThan', 'equal', 'between', 'containsText', 'notContains', 'beginsWith', 'endsWith')),
  text: opt(text(12)),
  rank: opt(fc.integer({ min: 0, max: 100 })),
  percent: opt(fc.boolean()),
  bottom: opt(fc.boolean()),
  aboveAverage: opt(fc.boolean()),
  timePeriod: opt(fc.constantFrom('today', 'last7Days', 'nextMonth')),
  formulas: fc.array(text(20), { maxLength: 3 }),
});
export const cfRule = (dxfCount: number): fc.Arbitrary<CfRule> => fc.oneof(
  fc.record({ type: fc.constantFrom('expression', 'cellIs', 'top10', 'uniqueValues', 'duplicateValues', 'containsText', 'containsBlanks', 'timePeriod', 'aboveAverage'), ...base(dxfCount) }),
  fc.record({ type: fc.constant('colorScale'), ...base(dxfCount), colorScale: fc.integer({ min: 2, max: 3 }).chain((n) => fc.record({ cfvo: fc.array(cfvo, { minLength: n, maxLength: n }), colors: fc.array(color, { minLength: n, maxLength: n }) })) }),
  fc.record({ type: fc.constant('dataBar'), ...base(dxfCount), dataBar: fc.record({ cfvo: fc.array(cfvo, { minLength: 2, maxLength: 2 }), color, minLength: opt(fc.integer({ min: 0, max: 100 })), maxLength: opt(fc.integer({ min: 0, max: 100 })) }).map(defined) }),
  fc.record({ type: fc.constant('iconSet'), ...base(dxfCount), iconSet: fc.record({ iconSet: opt(fc.constantFrom('3Arrows', '4Rating', '5Quarters')), cfvo: fc.array(cfvo, { minLength: 2, maxLength: 5 }) }).map(defined) }),
).map(defined);
export const conditionalFormat = (dxfCount: number): fc.Arbitrary<ConditionalFormat> => fc.record({ sqref, rules: fc.array(cfRule(dxfCount), { minLength: 1, maxLength: 3 }) });

/** One sheet's two tables over a list of dxfs. */
export const tables = (dxfCount: number) => fc.record({ dataValidations: fc.array(dataValidation, { maxLength: 4 }), conditionalFormats: fc.array(conditionalFormat(dxfCount), { maxLength: 3 }) });

/** The two round trips the item names: `read(toXlsx(x))` and `read(patchXlsx(upload, x))` give `x` back. */
export async function roundTrips(): Promise<void> {
  await fc.assert(fc.asyncProperty(fc.array(dxf, { maxLength: 3 }).chain((dxfs) => fc.record({ dxfs: fc.constant(dxfs), a: tables(dxfs.length), b: tables(dxfs.length) })), async ({ dxfs, a, b }) => {
    const book = await fromXlsx(await toXlsx({ sheets: [{ name: 'A', rows: [[1]], ...a }, { name: 'B', rows: [], ...b }], dxfs }));
    expect(book.sheets.map((s) => [s.dataValidations, s.conditionalFormats])).toEqual([[a.dataValidations, a.conditionalFormats], [b.dataValidations, b.conditionalFormats]]);
    expect(book.styles.dxfs).toEqual(dxfs);
  }), { numRuns: 60, seed: 57 });

  const upload = fc.array(dxf, { maxLength: 2 }).chain((had) => fc.record({ had: fc.constant(had), keep: tables(had.length), added: fc.array(dxf, { maxLength: 2 }) }))
    .chain(({ had, keep, added }) => fc.record({ had: fc.constant(had), keep: fc.constant(keep), added: fc.constant(added), before: tables(had.length), after: tables(had.length + added.length) }));
  await fc.assert(fc.asyncProperty(upload, async ({ had, keep, added, before, after }) => {
    const orig = await toXlsx({ sheets: [{ name: 'Edit', rows: [['x']], ...before }, { name: 'Keep', rows: [[2]], ...keep }], dxfs: had });
    const out = await patchXlsx(orig, [], {
      dataValidations: [{ sheet: 'Edit', rules: after.dataValidations }],
      conditionalFormats: [{ sheet: 'Edit', formats: after.conditionalFormats }],
      dxfs: added,
    });
    const book = await fromXlsx(out);
    expect([book.sheets[0]!.dataValidations, book.sheets[0]!.conditionalFormats]).toEqual([after.dataValidations, after.conditionalFormats]);
    expect([book.sheets[1]!.dataValidations, book.sheets[1]!.conditionalFormats]).toEqual([keep.dataValidations, keep.conditionalFormats]);
    expect(book.styles.dxfs).toEqual([...had, ...added]);
  }), { numRuns: 40, seed: 58 });
}
