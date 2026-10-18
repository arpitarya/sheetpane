// The IronCalc model behind one module: nothing else in the package touches WASM.
// The model is a derived cache (SR-LAW-9): built from the JavaScript workbook,
// rebuilt when the workbook object changes, never read back as the truth.
//
// `@ironcalc/wasm` is reached only through a dynamic `import()` inside
// `loadEngine()`, so importing this package (in Node too) never touches
// `WebAssembly` — only the first `derive` that needs a formula does.
import type { InitInput, Model } from '@ironcalc/wasm';

type IronCalc = typeof import('@ironcalc/wasm');

/** Where the engine's `.wasm` comes from. Default: next to `@ironcalc/wasm`'s `wasm.js`, as the host's bundler emits it. */
export type WasmSource = InitInput | Promise<InitInput>;

let engine: Promise<IronCalc> | undefined;
let loaded = false;

/** Loads and initialises IronCalc once per page; a failed load is retried on the next call. */
export function loadEngine(wasm?: WasmSource): Promise<IronCalc> {
  engine ??= (async () => {
    const mod = await import('@ironcalc/wasm');
    await mod.default(wasm === undefined ? undefined : { module_or_path: wasm });
    loaded = true;
    return mod;
  })().catch((e: unknown) => {
    engine = undefined;
    throw e;
  });
  return engine;
}

/** Whether the WASM engine has been loaded in this page. */
export const engineLoaded = (): boolean => loaded;

/**
 * IronCalc 0.9 exposes no raw value getter, only `getFormattedCellValue`. Every
 * cell the model reads is given this format, so a number comes back with 15
 * significant digits — Excel's own display precision. (`E+00` breaks on
 * three-digit exponents in 0.9; `E+0` does not.)
 */
const SCI = '0.00000000000000E+0';
const MAX_ROWS = 1_048_576;

/** A value as the JavaScript workbook holds it (`@sheetpane/export`'s `Cell`). */
export type Value = string | number | boolean | null;

/** IronCalc's own error for a formula it could not parse, and its "not implemented". */
export const ENGINE_ERRORS = new Set(['#ERROR!', '#N/IMPL!', '#NIMPL!']);
export const CIRCULAR = '#CIRC!';

/** Turns a 15-digit scientific string back into a number (and works around 0.9's mantissa-rounds-to-10 print). */
export function parseSci(s: string): number | undefined {
  const m = /^(-?)(\d+(?:\.\d*)?)E([+-]?\d+)$/i.exec(s.trim());
  if (!m) {
    const n = Number(s.replace(/,/g, ''));
    return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
  }
  let mant = Number(m[2]);
  const exp = Number(m[3]);
  if (mant === 0 && exp !== 0) mant = 1; // "0.00000000000000E+100" is 9.99…E+99 rounded up to 1E+100
  const v = Number(`${mant}e${exp}`);
  return m[1] === '-' ? -v : v;
}

export class FormulaModel {
  private readonly m: Model;
  private paused = false;

  constructor(lib: IronCalc, sheetNames: readonly string[]) {
    this.m = new lib.Model('sheetpane', 'en', 'UTC', 'en');
    for (let i = 1; i < sheetNames.length; i++) this.m.newSheet();
    // Two passes: a file's "Sheet2" at index 0 would collide with IronCalc's default name for index 1.
    sheetNames.forEach((_, i) => this.m.renameSheet(i, `__sp_${i}`));
    sheetNames.forEach((n, i) => this.m.renameSheet(i, n));
  }

  defineName(name: string, scope: number | undefined, formula: string): boolean {
    try { this.m.newDefinedName(name, scope ?? null, engineFormula(formula)); return true; } catch { return false; }
  }

  pause(): void { if (!this.paused) { this.m.pauseEvaluation(); this.paused = true; } }
  evaluate(): void {
    if (this.paused) { this.m.resumeEvaluation(); this.paused = false; }
    this.m.evaluate();
  }

  /** Sets one cell (0-based row and column). `input` is what a user would type: `=…`, a number, `'text`. */
  set(sheet: number, row: number, col: number, input: string, restyle = true): void {
    if (row >= MAX_ROWS) return;
    if (input === '') this.m.rangeClearContents(sheet, row + 1, col + 1, row + 1, col + 1);
    else this.m.setUserInput(sheet, row + 1, col + 1, input);
    // IronCalc styles a cell from its input (DATE() → a date, 1e21 → 0.00E+00); reading needs SCI back.
    if (restyle) this.m.updateRangeStyle({ sheet, row: row + 1, column: col + 1, width: 1, height: 1 }, 'num_fmt', SCI);
  }

  /** After a bulk feed: SCI on whole columns 1…cols of a sheet, overriding every style the inputs set. */
  restyleColumns(sheet: number, cols: number): void {
    if (cols > 0) this.m.updateRangeStyle({ sheet, row: 1, column: 1, width: cols, height: MAX_ROWS }, 'num_fmt', SCI);
  }

  /** The evaluated value of one cell (0-based); an error is its Excel text, e.g. `#DIV/0!`. */
  read(sheet: number, row: number, col: number): Value {
    const r = row + 1, c = col + 1;
    const text = this.m.getFormattedCellValue(sheet, r, c);
    const type = this.m.getCellType(sheet, r, c);
    switch (type) {
      case 2: return text;
      case 4: return text.toUpperCase() === 'TRUE';
      case 16: return text;
      default: {
        if (text === '') return this.m.getCellContent(sheet, r, c) === '' ? null : 0;
        return parseSci(text) ?? text;
      }
    }
  }

  /** Drops the model's outgoing diff queue (IronCalc keeps every edit for collaboration; nothing here reads it). */
  trim(): void { this.m.flushSendQueue(); }

  free(): void { try { this.m.free(); } catch { /* already freed */ } }
}

/** A file's formula as IronCalc reads it: `_xlfn.` / `_xlws.` / `_xlpm.` prefixes dropped (outside string literals). */
export function engineFormula(f: string): string {
  return f.split(/("(?:[^"]|"")*")/).map((part, i) => (i % 2 ? part : part.replace(/_xl(?:fn|ws|pm)\./gi, ''))).join('');
}
