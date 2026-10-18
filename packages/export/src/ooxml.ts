// The namespaces and content types the writers and the patcher name.
export const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
export const REL = {
  officeDocument: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  worksheet: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
  styles: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  calcChain: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain',
} as const;
export const CT = {
  rels: 'application/vnd.openxmlformats-package.relationships+xml',
  xml: 'application/xml',
  workbook: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
  worksheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml',
  styles: 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml',
} as const;
export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
