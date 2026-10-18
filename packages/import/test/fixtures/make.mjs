// Writes the ExcelJS-made fixtures (see FIXTURES.md). Run: node packages/import/test/fixtures/make.mjs
import ExcelJS from 'exceljs';
import { writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
// A 2×2 red PNG, made by hand so no third-party image is committed.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');

async function features() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'sheetpane fixtures';
  wb.created = wb.modified = new Date(Date.UTC(2026, 9, 18));
  const s = wb.addWorksheet('Holdings', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
  s.mergeCells('A1:E1');
  s.getCell('A1').value = 'Client holdings — as of 30 Sep 2026';
  s.getCell('A1').alignment = { horizontal: 'center' };
  s.addRow(['Account ID', 'Units', 'Price', 'Market value', 'As of']);
  const data = [['AC-10021', 1200, 268.4, '30-Sep-2026'], ['AC-10037', 430, 74.85, '30-Sep-2026'], ['AC-1O044', 640, 52.3, '30-Sep-2026']];
  data.forEach(([id, u, p], i) => {
    const r = i + 3;
    s.getCell(`A${r}`).value = id;
    s.getCell(`B${r}`).value = u;
    s.getCell(`B${r}`).numFmt = '#,##0';
    s.getCell(`C${r}`).value = p;
    s.getCell(`C${r}`).numFmt = '0.00';
    s.getCell(`E${r}`).value = new Date(Date.UTC(2026, 8, 30));
    s.getCell(`E${r}`).numFmt = 'dd-mmm-yyyy';
  });
  s.getCell('D3').value = { formula: 'B3*C3', result: 322080, shareType: 'shared', ref: 'D3:D5' };
  s.getCell('D4').value = { sharedFormula: 'D3', result: 32185.5 };
  s.getCell('D5').value = { sharedFormula: 'D3', result: 33472 };
  for (const r of [3, 4, 5]) s.getCell(`D${r}`).numFmt = '#,##0.00';
  s.getCell('F3').value = 0.0075; s.getCell('F3').numFmt = '0.00%';
  s.getCell('G3').value = 1234.5; s.getCell('G3').numFmt = '[$€-407]#,##0.00';
  s.getCell('H3').value = true;
  s.getCell('I3').value = { error: '#DIV/0!' };
  s.getCell('A3').font = { bold: true, color: { argb: 'FF2346C8' } };
  s.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  s.getCell('A3').border = { bottom: { style: 'thin', color: { argb: 'FF000000' } } };
  s.getCell('A3').note = { texts: [{ text: 'Checked against the custodian file.' }] };
  s.getColumn(1).width = 14;
  s.getColumn(9).hidden = true;
  s.getRow(4).height = 30;
  s.getRow(6).hidden = true;
  s.getCell('A6').value = 'hidden row';
  s.dataValidations.add('B3:B5', { type: 'whole', operator: 'greaterThan', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'Units', error: 'Units must be positive' });
  s.dataValidations.add('J3:J5', { type: 'list', formulae: ['"Core,Income,Cap"'], allowBlank: true });
  s.addConditionalFormatting({ ref: 'C3:C5', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: [100], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFBE9E7' } } } }] });
  s.addConditionalFormatting({ ref: 'B3:B5', rules: [{ type: 'colorScale', priority: 2, cfvo: [{ type: 'min' }, { type: 'max' }], color: [{ argb: 'FFFFFFFF' }, { argb: 'FF2346C8' }] }] });
  const img = wb.addImage({ buffer: PNG, extension: 'png' });
  s.addImage(img, { tl: { col: 6, row: 5 }, ext: { width: 40, height: 20 } });
  const h = wb.addWorksheet('Hidden', { state: 'hidden' });
  h.addRow(['secret', 1]);
  writeFileSync(new URL('exceljs-features.xlsx', here), Buffer.from(await wb.xlsx.writeBuffer()));
}

async function date1904() {
  const wb = new ExcelJS.Workbook();
  wb.properties.date1904 = true;
  const s = wb.addWorksheet('Dates');
  s.getCell('A1').value = 46295 - 1462; s.getCell('A1').numFmt = 'yyyy-mm-dd';
  writeFileSync(new URL('exceljs-1904.xlsx', here), Buffer.from(await wb.xlsx.writeBuffer()));
}

await features();
await date1904();
