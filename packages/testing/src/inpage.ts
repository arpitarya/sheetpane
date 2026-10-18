// Code that runs inside the page (Playwright serialises these functions into `evaluate`):
// it uses only the elements' public API — `workbook`, `select()`, `getAttribute` — no imports.
export interface At { sheet?: string; ref?: string; column?: string; row?: number }

/** `{ sheet, ref }` for a cell spec, read from the element's own store and `header-row`. */
export function resolveAt(el: Element, at: At): { sheet: string; ref: string } {
  const x = el as Element & { workbook: { getSnapshot(): { selection: { sheet: string } }; sheet(n: string): { rows: unknown[][] } | undefined; text(s: string, r: string): string } };
  const col = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  const store = x.workbook, sheet = at.sheet ?? store.getSnapshot().selection.sheet;
  if (at.ref) return { sheet, ref: at.ref };
  const hr = Math.max(1, Number(el.getAttribute('header-row') ?? 1) || 1);
  const width = Math.max(0, ...(store.sheet(sheet)?.rows ?? []).map((r) => r.length));
  for (let c = 0; c < width; c++) if (store.text(sheet, `${col(c)}${hr}`).trim().toLowerCase() === String(at.column).trim().toLowerCase()) return { sheet, ref: `${col(c)}${at.row}` };
  throw new Error(`@sheetpane/testing: no column titled "${at.column}" in row ${hr} of ${sheet}`);
}

/** A spec as plain data for `evaluate`: `"Sheet1!B3"` → `{ sheet, ref }`. */
export function toAt(at: string | { column: string; row: number; sheet?: string }): At {
  if (typeof at !== 'string') return at;
  const i = at.lastIndexOf('!');
  return i < 0 ? { ref: at.replace(/\$/g, '') } : { sheet: at.slice(0, i).replace(/^'(.*)'$/, '$1').replace(/''/g, "'"), ref: at.slice(i + 1).replace(/\$/g, '') };
}
