// Shifting the relative references of an A1 formula by a row and column offset —
// what a shared formula means for each cell it covers (ECMA-376 §18.3.1.40).
import { colIndex, colName, MAX_COLS, MAX_ROWS } from './refs.js';

const CELL = /(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})(?![A-Za-z0-9_(.!])/y;
const COLS = /(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![A-Za-z0-9_(])/y;
const ROWS = /(\$?)([0-9]{1,7}):(\$?)([0-9]{1,7})(?![0-9A-Za-z_(])/y;

function col(abs: string, name: string, dc: number): string {
  if (abs) return abs + name.toUpperCase();
  const c = colIndex(name) + dc;
  return c < 0 || c >= MAX_COLS ? '#REF!' : colName(c);
}
function row(abs: string, n: string, dr: number): string {
  if (abs) return abs + n;
  const r = Number(n) + dr;
  return r < 1 || r > MAX_ROWS ? '#REF!' : String(r);
}

/** `shiftFormula('A1+$B2', 1, 2)` → `'C2+$B3'`. Strings and quoted sheet names are left alone. */
export function shiftFormula(f: string, dr: number, dc: number): string {
  let out = '';
  for (let i = 0; i < f.length; ) {
    const ch = f[i]!;
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      for (; j < f.length; j++) if (f[j] === ch) { if (f[j + 1] === ch) j++; else break; }
      out += f.slice(i, j + 1); i = j + 1; continue;
    }
    const prev = i > 0 ? f[i - 1]! : '';
    if (/[A-Za-z0-9_.$]/.test(prev)) { out += ch; i++; continue; } // inside a name, a number or a reference
    let m: RegExpExecArray | null;
    COLS.lastIndex = i;
    if ((m = COLS.exec(f))) { const a = col(m[1]!, m[2]!, dc), b = col(m[3]!, m[4]!, dc); out += a === '#REF!' || b === '#REF!' ? '#REF!' : `${a}:${b}`; i = COLS.lastIndex; continue; }
    CELL.lastIndex = i;
    if ((m = CELL.exec(f)) && colIndex(m[2]!) < MAX_COLS) {
      const c = col(m[1]!, m[2]!, dc), r = row(m[3]!, m[4]!, dr);
      out += c === '#REF!' || r === '#REF!' ? '#REF!' : c + r;
      i = CELL.lastIndex; continue;
    }
    ROWS.lastIndex = i;
    if ((m = ROWS.exec(f))) { const a = row(m[1]!, m[2]!, dr), b = row(m[3]!, m[4]!, dr); out += a === '#REF!' || b === '#REF!' ? '#REF!' : `${a}:${b}`; i = ROWS.lastIndex; continue; }
    out += ch; i++;
  }
  return out;
}
