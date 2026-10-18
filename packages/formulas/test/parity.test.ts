// Parity (W-16 DoD 7): IronCalc's value against the value saved in the file.
//
// What this measures honestly:
//  1. The W-13 fixture set (`packages/import/test/fixtures`) — made by ExcelJS,
//     whose cached `<v>` were written by make.mjs, not calculated by Excel. Three
//     formula cells in all. Excel-saved files are owed by the decider (W-30).
//  2. A function probe: one formula per function with the answer Excel gives,
//     as documented by Microsoft for these arguments — written here by hand, not
//     saved by Excel. It names the functions where IronCalc 0.9 disagrees; a
//     change in that list (an IronCalc upgrade) fails the test so it is seen.
import { describe, expect, it } from 'vitest';
import features from '../../import/test/fixtures/exceljs-features.xlsx?inline';
import d1904 from '../../import/test/fixtures/exceljs-1904.xlsx?inline';
import freeze from '../../import/test/fixtures/exceljs-freeze.xlsx?inline';
import { formulas, type FormulasPlugin } from '../src/index.js';
import { book, fromDataUrl, loaded, type C } from './helpers.js';
import type { WorkbookStore } from '@sheetpane/grid';

/** Formula cells, and those whose IronCalc value differs from the saved one (recalculated on load, or not calculable). */
function tally(store: WorkbookStore, f: FormulasPlugin): { total: number; differ: string[] } {
  const b = store.book!;
  let total = 0;
  const differ: string[] = [];
  for (const s of b.sheets) for (const ref of Object.keys(s.formulas)) {
    total++;
    if (store.getSnapshot().derived.has(`${s.name}!${ref}`) || f.stateOf(s.name, ref) === 'unsupported') differ.push(`${s.name}!${ref} =${s.formulas[ref]}`);
  }
  return { total, differ };
}

describe('parity on the W-13 fixture set (ExcelJS-made)', () => {
  it('≥ 99 % of formula cells equal their saved value', async () => {
    let total = 0;
    const differ: string[] = [];
    for (const [name, url] of [['exceljs-features.xlsx', features], ['exceljs-1904.xlsx', d1904], ['exceljs-freeze.xlsx', freeze]] as const) {
      const f = formulas();
      const store = await loaded(fromDataUrl(url), [f], name);
      await f.ready();
      const t = tally(store, f);
      total += t.total;
      differ.push(...t.differ.map((d) => `${name} ${d}`));
    }
    const pct = total ? (100 * (total - differ.length)) / total : 100;
    console.info(`parity, W-13 fixtures (ExcelJS cached values): ${total - differ.length}/${total} formula cells = ${pct.toFixed(1)} %${differ.length ? `; differ: ${differ.join('; ')}` : ''}`);
    expect(total).toBe(3);
    expect(pct).toBeGreaterThanOrEqual(99);
  });
});

/** [formula, Excel's answer] over A1:A5 = 1…5 and B1:B5 = x y x y x. */
const PROBE: [string, string | number | boolean][] = [
  ['SUM(A1:A5)', 15], ['AVERAGE(A1:A5)', 3], ['MEDIAN(1,2,3,4)', 2.5], ['MAX(A1:A5)', 5], ['MIN(A1:A5)', 1], ['PRODUCT(2,3,4)', 24],
  ['ROUND(2.675,2)', 2.68], ['ROUND(1234.5678,-2)', 1200], ['ROUNDDOWN(-2.5,0)', -2], ['ROUNDUP(2.1,0)', 3], ['MROUND(10,3)', 9],
  ['INT(-2.5)', -3], ['TRUNC(-4.7)', -4], ['MOD(-3,2)', 1], ['QUOTIENT(7,2)', 3], ['ABS(-3)', 3], ['SIGN(-3)', -1], ['POWER(2,10)', 1024], ['SQRT(16)', 4],
  ['CEILING(4.3,2)', 6], ['FLOOR(4.3,2)', 4], ['FACT(5)', 120], ['COMBIN(5,2)', 10], ['GCD(12,18)', 6], ['LCM(4,6)', 12],
  ['LOG(100)', 2], ['LN(EXP(1))', 1], ['LOG10(1000)', 3], ['PI()', Math.PI],
  ['COUNT(A1:B5)', 5], ['COUNTA(A1:B5)', 10], ['COUNTBLANK(C1:C5)', 5], ['COUNTIF(A1:A5,">2")', 3], ['COUNTIFS(B1:B5,"x",A1:A5,">1")', 2],
  ['SUMIF(B1:B5,"x",A1:A5)', 9], ['SUMIFS(A1:A5,B1:B5,"y",A1:A5,">2")', 4], ['AVERAGEIF(B1:B5,"x",A1:A5)', 3], ['AVERAGEIFS(A1:A5,B1:B5,"x")', 3],
  ['MAXIFS(A1:A5,B1:B5,"x")', 5], ['MINIFS(A1:A5,B1:B5,"y")', 2], ['SUMPRODUCT(A1:A5,A1:A5)', 55], ['LARGE(A1:A5,2)', 4], ['SMALL(A1:A5,2)', 2], ['RANK(4,A1:A5)', 2],
  ['SUBTOTAL(9,A1:A5)', 15], ['AGGREGATE(9,0,A1:A5)', 15],
  ['STDEV.S(1,2,3,4)', 1.2909944487358056], ['VAR.P(1,2,3,4)', 1.25],
  ['IF(1>2,"a","b")', 'b'], ['IFS(1>2,"a",TRUE,"b")', 'b'], ['SWITCH(2,1,"a",2,"b")', 'b'], ['IFERROR(1/0,"x")', 'x'], ['AND(TRUE,FALSE)', false], ['OR(TRUE,FALSE)', true], ['NOT(FALSE)', true], ['CHOOSE(2,"a","b","c")', 'b'],
  ['VLOOKUP(2,{1,"a";2,"b"},2,FALSE)', 'b'], ['HLOOKUP(2,{1,2;"a","b"},2,FALSE)', 'b'], ['INDEX({1,2;3,4},2,1)', 3], ['MATCH(3,{1,2,3},0)', 3],
  ['XLOOKUP(3,A1:A5,B1:B5)', 'x'], ['XLOOKUP(2,{1;2},{"x";"y"})', 'y'], ['ROWS(A1:A5)', 5], ['COLUMNS(A1:B5)', 2],
  ['LEN("hello")', 5], ['LEFT("hello",2)', 'he'], ['RIGHT("hello",3)', 'llo'], ['MID("hello",2,3)', 'ell'], ['UPPER("ab")', 'AB'], ['LOWER("AB")', 'ab'], ['PROPER("hello world")', 'Hello World'],
  ['TRIM("  a  b ")', 'a b'], ['SUBSTITUTE("a-b-c","-","+")', 'a+b+c'], ['REPLACE("abcdef",2,3,"X")', 'aXef'], ['FIND("c","abc")', 3], ['SEARCH("B","abc")', 2],
  ['CONCATENATE("a","b")', 'ab'], ['CONCAT("a","b")', 'ab'], ['TEXTJOIN("-",TRUE,"a","","b")', 'a-b'], ['TEXTJOIN(",",TRUE,B1:B3)', 'x,y,x'], ['REPT("ab",3)', 'ababab'], ['EXACT("a","A")', false], ['CHAR(65)', 'A'], ['CODE("A")', 65],
  ['TEXT(1234.5,"#,##0.00")', '1,234.50'], ['TEXT(0.5,"0%")', '50%'], ['VALUE("12.5")', 12.5], ['FIXED(1234.567,1)', '1,234.6'], ['NUMBERVALUE("1,234.5")', 1234.5],
  ['DATE(2024,1,1)', 45292], ['YEAR(45292)', 2024], ['MONTH(45292)', 1], ['DAY(45292)', 1], ['EDATE(45292,1)', 45323], ['EOMONTH(45292,0)', 45322], ['WEEKDAY(45292)', 2], ['WEEKNUM(45292)', 1],
  ['WORKDAY(45292,5)', 45299], ['NETWORKDAYS(DATE(2024,1,1),DATE(2024,1,31))', 23], ['DATEDIF(DATE(2020,1,1),DATE(2024,3,1),"m")', 50], ['DAYS(DATE(2024,3,1),DATE(2024,1,1))', 60],
  ['YEARFRAC(DATE(2024,1,1),DATE(2024,7,1))', 0.5], ['TIME(12,30,0)', 0.5208333333333334], ['HOUR(0.75)', 18],
  ['PMT(0.05/12,360,200000)', -1073.6432460242781], ['FV(0.05,10,-100)', 1257.7892535548839], ['PV(0.05,10,-100)', 772.1734929184818], ['NPV(0.1,100,100)', 173.55371900826447], ['IRR({-100,60,60})', 0.13066238629180732],
  ['ISNUMBER(A1)', true], ['ISTEXT(B1)', true], ['ISBLANK(C1)', true],
  ['1/0', '#DIV/0!'], ['NA()', '#N/A'], ['"a"*1', '#VALUE!'], ['SQRT(-1)', '#NUM!'],
];

describe('function probe (Excel answers written by hand, not Excel-saved)', () => {
  it('names where IronCalc 0.9 disagrees', async () => {
    const rows: C[][] = [1, 2, 3, 4, 5].map((n, i) => [n, ['x', 'y', 'x', 'y', 'x'][i]!, null, null]);
    PROBE.forEach(([f, v], i) => { (rows[i] ??= [null, null, null, null])[3] = { f, v, ...(typeof v === 'string' && v.startsWith('#') ? { t: 'e' as const } : {}) }; });
    const f = formulas();
    const store = await loaded(await book({ Probe: rows }), [f]);
    await f.ready();
    const differ = PROBE.map(([formula], i) => ({ formula, ref: `D${i + 1}` }))
      .filter(({ ref }) => store.getSnapshot().derived.has(`Probe!${ref}`) || f.stateOf('Probe', ref) === 'unsupported')
      .map(({ formula, ref }) => `${formula} → ${JSON.stringify(store.getSnapshot().derived.get(`Probe!${ref}`)?.value ?? f.stateOf('Probe', ref))}`);
    const pct = (100 * (PROBE.length - differ.length)) / PROBE.length;
    console.info(`function probe: ${PROBE.length - differ.length}/${PROBE.length} = ${pct.toFixed(1)} % agree; IronCalc 0.9 differs on: ${differ.join('; ')}`);
    expect(differ).toEqual(KNOWN_DIFFERENCES);
  });
});

/** IronCalc 0.9.0's known disagreements with Excel on the probe. Update with the IronCalc version, and tell the decider. */
const KNOWN_DIFFERENCES: string[] = [
  'AGGREGATE(9,0,A1:A5) → "unsupported"', // #NAME?: not implemented
  'XLOOKUP(2,{1;2},{"x";"y"}) → "#N/A"', // array constants as lookup arrays; ranges work (the row above)
  'TEXTJOIN("-",TRUE,"a","","b") → "a--b"', // ignore_empty skips empty cells but not an empty literal
];
