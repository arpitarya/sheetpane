// The fixture table (W-15 DoD 7): (value, format, expected) for every built-in
// id Excel stores and for 40+ custom formats.
//
// PROVENANCE, stated plainly: there is no Excel on the build machine. These
// expectations are written from Excel's documented behaviour (Microsoft's
// "Review guidelines for customizing a number format", the ECMA-376 §18.8.30
// built-in table, and the TEXT() function's known output) — they are NOT
// captured from Excel, and they were written before the library was run over
// them. Where the library disagreed, the row was re-read against the
// documentation and kept as written; the disagreement is listed in
// `KNOWN_DIVERGENCES` below, not hidden. The "from Excel" half of DoD 7 is
// owed: the decider can regenerate `expected` from his own Excel with TEXT().
//
// Serial dates used: 45000 = 15 March 2023 (a Wednesday); a fraction is a time of day.

export interface Row { value: number; code: string; expected: string; note?: string }
export interface BuiltinRow { id: number; value: number; expected: string; note?: string }

/** en-US built-in ids, as a workbook stores them (no `<numFmt>` for these). */
export const BUILTIN_ROWS: BuiltinRow[] = [
  { id: 0, value: 1234.5678, expected: '1234.5678' },
  { id: 1, value: 1234.5678, expected: '1235' },
  { id: 2, value: 1234.5678, expected: '1234.57' },
  { id: 3, value: 1234.5678, expected: '1,235' },
  { id: 4, value: 1234.5678, expected: '1,234.57' },
  { id: 5, value: 1234.5, expected: '$1,235 ', note: '_) reserves the width of ")" — a trailing space' },
  { id: 6, value: -1234.5, expected: '($1,235)' },
  { id: 7, value: 1234.5, expected: '$1,234.50 ' },
  { id: 8, value: -1234.5, expected: '($1,234.50)' },
  { id: 9, value: 0.256, expected: '26%' },
  { id: 10, value: 0.256, expected: '25.60%' },
  { id: 11, value: 12345.678, expected: '1.23E+04' },
  { id: 12, value: 2.5, expected: '2 1/2' },
  { id: 13, value: 0.5, expected: '  1/2 ', note: 'integer part empty + the literal space + numerator " 1" + / + denominator "2 "' },
  { id: 14, value: 45000, expected: '3/15/2023' },
  { id: 15, value: 45000, expected: '15-Mar-23' },
  { id: 16, value: 45000, expected: '15-Mar' },
  { id: 17, value: 45000, expected: 'Mar-23' },
  { id: 18, value: 45000.5, expected: '12:00 PM' },
  { id: 19, value: 45000.75, expected: '6:00:00 PM' },
  { id: 20, value: 45000.75, expected: '18:00' },
  { id: 21, value: 45000.76, expected: '18:14:24' },
  { id: 22, value: 45000.76, expected: '3/15/2023 18:14' },
  { id: 37, value: 1234.5, expected: '1,235 ' },
  { id: 38, value: -1234.5, expected: '(1,235)' },
  { id: 39, value: -1234.5, expected: '(1,234.50)' },
  { id: 40, value: -1234.5, expected: '(1,234.50)' },
  { id: 41, value: 1234, expected: ' 1,234 ', note: 'the * fill is column-width dependent; as text it contributes nothing' },
  { id: 42, value: 1234, expected: ' $1,234 ' },
  { id: 43, value: 1234.5, expected: ' 1,234.50 ' },
  { id: 44, value: 1234.5, expected: ' $1,234.50 ' },
  { id: 45, value: 0.01, expected: '14:24' },
  { id: 46, value: 1.5, expected: '36:00:00' },
  { id: 47, value: 0.000123, expected: '00:10.6' },
  { id: 48, value: 12345.678, expected: '12.3E+3' },
  { id: 49, value: 5, expected: '5' },
];

/** Custom codes, as a workbook stores them in `<numFmts>`. 44 rows. */
export const CUSTOM_ROWS: Row[] = [
  { value: 3.14159, code: '0.000', expected: '3.142' },
  { value: 1234567.89, code: '#,##0.0', expected: '1,234,567.9' },
  { value: 42, code: '000000', expected: '000042' },
  { value: 3, code: '#.##', expected: '3.', note: 'Excel keeps the decimal point when no decimal digit shows' },
  { value: 0.12345, code: '0.0%', expected: '12.3%' },
  { value: 0.00012345, code: '0.00E+00', expected: '1.23E-04' },
  { value: 12345678, code: '0.0,,"M"', expected: '12.3M' },
  { value: 1234567, code: '#,##0,"K"', expected: '1,235K' },
  { value: 1234.5, code: '"$"#,##0.00', expected: '$1,234.50' },
  { value: 1234.5, code: '[$€-2] #,##0.00', expected: '€ 1,234.50', note: '[$€-2]: the symbol; separators stay the reader’s' },
  { value: -1234, code: '#,##0;[Red]-#,##0', expected: '-1,234' },
  { value: 0, code: '#,##0.00;(#,##0.00);"zero"', expected: 'zero' },
  { value: 150, code: '[>=100]"big";[<0]"neg";0.0', expected: 'big' },
  { value: -5, code: '[>=100]"big";[<0]"neg";0.0', expected: 'neg' },
  { value: 50, code: '[>=100]"big";[<0]"neg";0.0', expected: '50.0' },
  { value: 5, code: '[Blue]0.0', expected: '5.0' },
  { value: 12.345, code: '0.0 "units"', expected: '12.3 units' },
  { value: 7, code: '"Qty:" 0', expected: 'Qty: 7' },
  { value: 123456, code: '00-00-00', expected: '12-34-56' },
  { value: 123456789, code: '000-00-0000', expected: '123-45-6789' },
  { value: 5551234567, code: '(###) ###-####', expected: '(555) 123-4567' },
  { value: 3.25, code: '# ?/?', expected: '3 1/4' },
  { value: 2.3, code: '# ?/8', expected: '2 2/8', note: 'nearest eighth: 2/8 (0.25) beats 3/8 (0.375)' },
  { value: 45000, code: 'yyyy-mm-dd', expected: '2023-03-15' },
  { value: 45000, code: 'dd/mm/yyyy', expected: '15/03/2023' },
  { value: 45000, code: 'dddd, mmmm d, yyyy', expected: 'Wednesday, March 15, 2023' },
  { value: 45000, code: 'ddd', expected: 'Wed' },
  { value: 45000, code: 'mmmm', expected: 'March' },
  { value: 45000, code: 'mmmmm', expected: 'M' },
  { value: 45000, code: 'yy', expected: '23' },
  { value: 0.5, code: 'h:mm:ss.000', expected: '12:00:00.000' },
  { value: 0.25, code: 'hh:mm AM/PM', expected: '06:00 AM' },
  { value: 0.75, code: 'h:mm A/P', expected: '6:00 P' },
  { value: 1.5, code: '[h]:mm', expected: '36:00' },
  { value: 0.01, code: '[mm]:ss', expected: '14:24' },
  { value: 0.01, code: '[s]', expected: '864' },
  { value: 45000.75, code: 'yyyy-mm-dd hh:mm:ss', expected: '2023-03-15 18:00:00' },
  { value: 45000, code: '[$-409]mmmm d, yyyy;@', expected: 'March 15, 2023' },
  { value: -0.00005, code: '0.0000', expected: '-0.0001' },
  { value: 0, code: '0;-0;;@', expected: '', note: 'an empty zero section shows nothing' },
  { value: 12.5, code: 'General" kg"', expected: '12.5 kg' },
  { value: 1, code: '[=1]"yes";[=0]"no";General', expected: 'yes' },
  { value: 0, code: '[=1]"yes";[=0]"no";General', expected: 'no' },
  { value: 2500, code: '[<1000]0;[<1000000]0.0,"K";0.0,,"M"', expected: '2.5K' },
  { value: 3500000, code: '[<1000]0;[<1000000]0.0,"K";0.0,,"M"', expected: '3.5M' },
  { value: 0, code: 'm/d/yyyy', expected: '1/0/1900', note: 'serial 0 is "January 0, 1900"' },
  { value: 60, code: 'm/d/yyyy', expected: '2/29/1900', note: 'the Lotus 1-2-3 leap-year bug, kept by Excel and required by ECMA-376' },
  { value: 61, code: 'm/d/yyyy', expected: '3/1/1900' },
  { value: 2958465, code: 'yyyy-mm-dd', expected: '9999-12-31', note: 'the last day Excel can show' },
  { value: -1, code: 'yyyy-mm-dd', expected: '########', note: 'Excel shows #### for a negative date' },
  { value: 1234.5678, code: 'General', expected: '1234.5678' },
  { value: 123456789012, code: 'General', expected: '1.23457E+11', note: 'General is 11 characters wide' },
  { value: 0.1 + 0.2, code: 'General', expected: '0.3' },
];

/** (value, code) pairs where the library and the expectation above are known to differ. Empty unless a run says otherwise. */
export const KNOWN_DIVERGENCES: { value: number; code: string; excel: string; library: string; why: string }[] = [];
