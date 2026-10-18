// @sheetpane/export — a plain JavaScript object in, an .xlsx or .csv file out.
// No runtime dependencies. Spec: records/0103_EXPORT.md (SR-EXPORT).

export type { Cell, Change, Sheet, Workbook } from './types.js';
export { ExportError, type ExportErrorCode } from './errors.js';
export { toXlsx, type ToXlsxOptions } from './xlsx.js';
export { patchXlsx, type PatchOptions, type PatchContext, type ExportPatchHook } from './patch.js';
export { toCsv, type ToCsvOptions } from './csv.js';

// Shared with @sheetpane/import and the plugins — one implementation of each
// (reading verdict decision 5): the ZIP walk, CRC-32, XML and A1 helpers.
export { readZip, inflateEntry, rawData, writeZip, isZip, DEFAULT_LIMITS, type ZipEntry, type ZipLimits, type ZipInput, type WriteOptions } from './zip.js';
export { crc32 } from './crc32.js';
export { escapeText, escapeAttr, unescapeXml, encodeOoxmlString, decodeOoxmlString, cleanXmlChars, utf8, fromUtf8 } from './xml.js';
export { getAttr, setAttr, removeAttr, parseRels, resolveTarget, relsPathOf, type Relationship } from './patch.js';
export { colName, colIndex, parseRef, cellRef, parseRange, rangeRef, rangesIntersect, MAX_ROWS, MAX_COLS, type CellPos, type RangePos } from './refs.js';
export { shiftFormula } from './formula.js';
export { checkSheetName } from './validate.js';
