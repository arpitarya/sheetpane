// @sheetpane/export — a plain JavaScript object in, an .xlsx or .csv file out.
// No runtime dependencies. Spec: records/0103_EXPORT.md (SR-EXPORT).

export type { Cell, Change, Sheet, SheetState, Workbook } from './types.js';
export { ExportError, EXPORT_SP_CODES, type ExportErrorCode } from './errors.js';
// Stable error codes (W-40): the registry every package reads — docs/ERRORS.md.
export { CODES, ERRORS_DOC_URL, codeUrl, spMessage, spError, codeOf, detailOf, type CodeInfo, type SpCode, type SpCoded, type SpError } from './codes.js';
export { toXlsx, type ToXlsxOptions } from './xlsx.js';
export { patchXlsx, type PatchOptions, type PatchContext, type ExportPatchHook, type HiddenPatch } from './patch.js';
export { toCsv, type ToCsvOptions } from './csv.js';

// Shared with @sheetpane/import and the plugins — one implementation of each
// (reading verdict decision 5): the ZIP walk, CRC-32, XML and A1 helpers.
export { readZip, inflateEntry, rawData, writeZip, isZip, DEFAULT_LIMITS, type ZipEntry, type ZipLimits, type ZipInput, type WriteOptions } from './zip.js';
export { crc32 } from './crc32.js';
export { escapeText, escapeAttr, unescapeXml, encodeOoxmlString, decodeOoxmlString, cleanXmlChars, utf8, fromUtf8 } from './xml.js';
export { getAttr, setAttr, removeAttr, parseRels, resolveTarget, relsPathOf, setPane, setMergeCells, type Relationship } from './patch.js';
export { colName, colIndex, parseRef, cellRef, parseRange, rangeRef, rangesIntersect, MAX_ROWS, MAX_COLS, type CellPos, type RangePos } from './refs.js';
export { shiftFormula } from './formula.js';
// Inserting and deleting rows and columns (W-52): the one implementation of every shift.
export { restructureChartXml } from './restructure.js';
export { restructureFormula, shiftRefText, shiftSqref, shiftIndex, shiftSpan, shiftCount, shiftRangePos, splitsRange, movesRange, tableRefusal, inverseOp, isRowOp, isInsertOp, type StructureOp, type StructureOpName } from './structure.js';
export { checkSheetName } from './validate.js';

// Saving a file in the browser — SR-DOWNLOAD.
export { download, type DownloadOptions } from './download/index.js';
