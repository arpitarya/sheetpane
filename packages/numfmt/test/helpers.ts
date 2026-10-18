// Test helpers: workbooks with number formats, written as XML parts (no ExcelJS,
// no new dependency — the import package's tests already build packages this way).
import { pkg, XML } from '../../import/test/helpers.js';

export interface StyledCell { ref: string; value: number; /** a built-in id */ id?: number; /** a custom code */ code?: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** One sheet `Data`; each cell carries the xf its `id` or `code` names. `extraXfs` appends unused xfs (to test dedupe against existing ones). */
export function styledBook(cells: StyledCell[], o: { date1904?: boolean; sheetName?: string } = {}): Uint8Array {
  const codes = [...new Set(cells.flatMap((c) => (c.code !== undefined ? [c.code] : [])))];
  const idOfCode = new Map(codes.map((c, i) => [c, 164 + i] as const));
  const xfKeys = [...new Set(cells.map((c) => (c.code !== undefined ? idOfCode.get(c.code)! : c.id ?? 0)))];
  const xfIndex = new Map(xfKeys.map((k, i) => [k, i + 1] as const));
  const styles = `<?xml version="1.0"?><styleSheet xmlns="${XML.NS}">${codes.length ? `<numFmts count="${codes.length}">${codes.map((c) => `<numFmt numFmtId="${idOfCode.get(c)}" formatCode="${esc(c)}"/>`).join('')}</numFmts>` : ''}<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfKeys.length + 1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xfKeys.map((k) => `<xf numFmtId="${k}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const byRow = new Map<number, StyledCell[]>();
  for (const c of cells) {
    const r = Number(/\d+/.exec(c.ref)![0]);
    byRow.set(r, [...(byRow.get(r) ?? []), c]);
  }
  const rows = [...byRow].sort((a, b) => a[0] - b[0]).map(([r, cs]) => `<row r="${r}">${cs.map((c) => {
    const key = c.code !== undefined ? idOfCode.get(c.code)! : c.id ?? 0;
    const s = key === 0 ? '' : ` s="${xfIndex.get(key)}"`;
    return `<c r="${c.ref}"${s}><v>${c.value}</v></c>`;
  }).join('')}</row>`).join('');
  const sheet = `<?xml version="1.0"?><worksheet xmlns="${XML.NS}"><sheetData>${rows}</sheetData></worksheet>`;
  const name = o.sheetName ?? 'Data';
  return pkg(sheet, {
    'xl/styles.xml': styles,
    'xl/workbook.xml': `<workbook xmlns="${XML.NS}" xmlns:r="${XML.R}">${o.date1904 ? '<workbookPr date1904="1"/>' : ''}<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${XML.R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${XML.R}/styles" Target="styles.xml"/></Relationships>`,
  });
}
