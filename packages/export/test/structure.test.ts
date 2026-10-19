// W-52: the pure shift of one insert or delete — indexes, spans, A1 text, sqref lists and
// formulas (Excel's rules: a range widens on an insert inside it, a deleted target is #REF!).
import { describe, expect, it } from 'vitest';
import { inverseOp, movesRange, restructureFormula, shiftCount, shiftIndex, shiftRefText, shiftSpan, shiftSqref, splitsRange, type StructureOp } from '../src/index.js';

const ins = (at: number, count = 1, sheet = 'Data'): StructureOp => ({ sheet, op: 'insertRows', at, count });
const del = (at: number, count = 1, sheet = 'Data'): StructureOp => ({ sheet, op: 'deleteRows', at, count });
const insC = (at: number, count = 1, sheet = 'Data'): StructureOp => ({ sheet, op: 'insertCols', at, count });
const delC = (at: number, count = 1, sheet = 'Data'): StructureOp => ({ sheet, op: 'deleteCols', at, count });

describe('indexes, spans and counts', () => {
  it('an insert moves the index at and after it; a delete removes or moves it', () => {
    expect([0, 1, 2, 3].map((i) => shiftIndex(i, ins(2, 2)))).toEqual([0, 1, 4, 5]);
    expect([0, 1, 2, 3, 4].map((i) => shiftIndex(i, del(1, 2)))).toEqual([0, undefined, undefined, 1, 2]);
    expect(shiftIndex(1_048_575, ins(0))).toBeUndefined();
  });
  it('a span widens on an insert inside it and is clipped by a delete', () => {
    expect(shiftSpan(2, 5, ins(4, 3))).toEqual([2, 8]);
    expect(shiftSpan(2, 5, ins(2, 3))).toEqual([5, 8]);
    expect(shiftSpan(2, 5, ins(6))).toEqual([2, 5]);
    expect(shiftSpan(2, 5, del(3, 2))).toEqual([2, 3]);
    expect(shiftSpan(2, 5, del(0, 3))).toEqual([0, 2]);
    expect(shiftSpan(2, 5, del(4, 5))).toEqual([2, 3]);
    expect(shiftSpan(2, 5, del(2, 4))).toBeUndefined();
    expect(shiftSpan(2, 5, del(0, 1))).toEqual([1, 4]);
    expect(shiftSpan(0, 1_048_575, ins(3))).toEqual([0, 1_048_575]);
    expect(shiftSpan(1_048_575, 1_048_575, ins(3))).toBeUndefined();
  });
  it('a leading count (freeze) grows on an insert inside it and shrinks on a delete', () => {
    expect(shiftCount(3, ins(1, 2))).toBe(5);
    expect(shiftCount(3, ins(3, 2))).toBe(3);
    expect(shiftCount(3, del(2, 4))).toBe(2);
    expect(shiftCount(3, del(5))).toBe(3);
  });
  it('splits and moves', () => {
    const r = { top: 2, left: 0, bottom: 4, right: 3 };
    expect(splitsRange(r, del(3))).toBe(true);
    expect(splitsRange(r, del(2, 3))).toBe(false);
    expect(splitsRange(r, del(1, 5))).toBe(false);
    expect(splitsRange(r, ins(3))).toBe(true);
    expect(splitsRange(r, ins(2))).toBe(false);
    expect(splitsRange(r, delC(1))).toBe(true);
    expect(movesRange(r, ins(5))).toBe(false);
    expect(movesRange(r, ins(4))).toBe(true);
    expect(inverseOp(ins(3, 2))).toEqual(del(3, 2));
    expect(inverseOp(delC(3, 2))).toEqual(insC(3, 2));
  });
});

describe('A1 text and sqref', () => {
  it('cells, ranges, whole columns and rows keep their $ signs', () => {
    expect(shiftRefText('B3', ins(1))).toBe('B4');
    expect(shiftRefText('$B$3', ins(1))).toBe('$B$4');
    expect(shiftRefText('A2:$C$5', ins(3, 2))).toBe('A2:$C$7');
    expect(shiftRefText('C5:A2', ins(0))).toBe('C6:A3');
    expect(shiftRefText('A:C', ins(0))).toBe('A:C');
    expect(shiftRefText('A:C', insC(1))).toBe('A:D');
    expect(shiftRefText('3:5', del(0))).toBe('2:4');
    expect(shiftRefText('3:5', insC(0))).toBe('3:5');
    expect(shiftRefText('B3', del(2))).toBeUndefined();
    expect(shiftRefText('B3', delC(1))).toBeUndefined();
    expect(shiftRefText('B3', delC(0))).toBe('A3');
    expect(shiftRefText('not a ref', ins(0))).toBe('not a ref');
  });
  it('a sqref drops ranges wholly deleted', () => {
    expect(shiftSqref('A1:B5 D3 F9', del(2))).toEqual(['A1:B4', 'F8']);
    expect(shiftSqref(['A3'], del(2))).toEqual([]);
  });
});

describe('formulas', () => {
  it('moves references to the sheet, unqualified on the host', () => {
    expect(restructureFormula('A1+B5*$C$7', 'Data', ins(2))).toBe('A1+B6*$C$8');
    expect(restructureFormula('SUM(A2:A10)', 'Data', ins(4, 2))).toBe('SUM(A2:A12)');
    expect(restructureFormula('SUM(A2:A10)', 'Other', ins(4, 2))).toBe('SUM(A2:A10)');
    expect(restructureFormula('Data!A5+Other!A5', 'Other', ins(0))).toBe('Data!A6+Other!A5');
    expect(restructureFormula("'Q3 data'!B2:B9", 'Data', ins(0, 1, 'Q3 data'))).toBe("'Q3 data'!B3:B10");
    expect(restructureFormula("'It''s'!B2", undefined, ins(0, 1, "It's"))).toBe("'It''s'!B3");
    expect(restructureFormula('VLOOKUP(A2,Data!$A:$D,4,FALSE)', 'Other', delC(1))).toBe('VLOOKUP(A2,Data!$A:$C,4,FALSE)');
    expect(restructureFormula('SUM(3:5)', 'Data', ins(0))).toBe('SUM(4:6)');
    expect(restructureFormula('data!A1', 'X', ins(0))).toBe('data!A2'); // sheet names match ignoring case
  });
  it('a deleted target is #REF!, a range is clipped', () => {
    expect(restructureFormula('A3*2', 'Data', del(2))).toBe('#REF!*2');
    expect(restructureFormula('Data!A3*2', 'X', del(2))).toBe('Data!#REF!*2');
    expect(restructureFormula('SUM(A2:A5)', 'Data', del(2))).toBe('SUM(A2:A4)');
    expect(restructureFormula('SUM(A3:A3)', 'Data', del(2))).toBe('SUM(#REF!)');
  });
  it('leaves strings, names, functions, external, 3-D and structured references alone', () => {
    const same = ['"Data!A5"', 'LOG10(B1)', 'Sales2024*2', '[1]Data!A5', "'[Book.xlsx]Data'!A5", 'Data:Other!A5', 'SUM(Table1[[#This Row],[A5]])', 'Data!Rate', '1E5+2'];
    for (const f of same) expect(restructureFormula(f, 'Other', ins(0)), f).toBe(f);
    expect(restructureFormula('LOG10(A1)&"A1"', 'Data', ins(0))).toBe('LOG10(A2)&"A1"');
    expect(restructureFormula('Données!A5', undefined, ins(0, 1, 'Données'))).toBe('Données!A6');
    expect(restructureFormula('A1', undefined, ins(0))).toBe('A1'); // a defined name's unqualified reference
  });
});
