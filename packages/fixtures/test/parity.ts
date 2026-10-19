// W-54 DoD 3, shared by both sides: the cases, the pane's settings for each, and how a result is
// compared. `parity.test.ts` runs every case in `<sheetpane-excel>` in a real browser,
// `parity.node.test.ts` through `check()` in Node; both must equal `golden/parity.json`, so the
// browser and Node agree. The settings mirror a host: the rules sample, column rules over the
// element's `columns`, an async `validate`, and the four plugins that check or change what is checked.
import type { ColumnRules, SheetpaneError, ValidateFn } from '@sheetpane/grid/check';
import { bytes, hugeCsv, MANIFEST, type FixtureName } from '../src/index.js';

/** Element columns: a title most files lack (one note each), a type rule per kind, and one the rules sample overrides (SP-6025). */
const COLUMNS: ColumnRules = {
  Account: { required: true },
  Price: { type: 'number', min: 0, max: 400 },
  Date: { type: 'date', max: '2026-09-30' }, // date1904.xlsx holds 1 Oct 2026: one failure read through the 1904 system
  'Größe': { required: true },
};

/** The host's own check, async as a server lookup would be: a value naming "TBD" or starting with "=" is a warning. */
export const validate: ValidateFn = async (ctx, signal) => {
  await null;
  if (signal.aborted || typeof ctx.value !== 'string') return null;
  if (/TBD/.test(ctx.value)) return { severity: 'warning', message: `${ctx.column.header}: still to be decided`, expected: 'a decided value' };
  if (ctx.value.startsWith('=')) return { severity: 'note', message: `${ctx.column.header}: text that looks like a formula` };
  return null;
};

/** One case: a file, its name and the pane's settings. */
export interface Case { id: string; name: string; data(): Promise<Uint8Array>; rules?: unknown; columns: ColumnRules; headerRow?: number }

/** The rules sample, read as `rules-src` would hand it over. */
export const rulesSample = async (): Promise<unknown> => JSON.parse(new TextDecoder().decode(await bytes('showcase.rules.json')));

/** Every workbook in the manifest (the refused ones too), and 20,000 generated rows so the load phase slices. */
export async function cases(): Promise<Case[]> {
  const rules = await rulesSample();
  const files = MANIFEST.files.filter((f) => f.kind !== 'rules').map((f): Case => ({ id: f.name, name: f.name.split('/').pop()!, data: () => bytes(f.name as FixtureName), rules, columns: COLUMNS }));
  const huge: Case = {
    id: 'hugeCsv(20000)', name: 'huge.csv', data: async () => new TextEncoder().encode(hugeCsv(20_000)),
    columns: { Account: { pattern: '^AC-\\d{5}$' }, Units: { type: 'integer', min: 0, max: 498 } }, // Status is the async validate's ("TBD")
  };
  return [...files, huge];
}

/** What is compared: a refusal's code, or the errors without `id` and `createdAt`, in one order. */
export type Outcome = { refused: string } | { errors: Omit<SheetpaneError, 'id' | 'createdAt'>[] };

/**
 * The comparable form of a run's errors.
 * @param errors - The errors as the pane or `check()` gave them.
 * @returns Each without its per-run `id` and `createdAt`, sorted by what it says (key order aside).
 */
export function outcome(errors: readonly SheetpaneError[]): Outcome {
  const strip = errors.map(({ id: _id, createdAt: _at, ...rest }) => rest);
  const key = (e: (typeof strip)[number]) => JSON.stringify([e.sheet, e.range, e.type, e.author, e.severity, e.message, e.found, e.expected, e.code ?? '', e.status]);
  return { errors: strip.map((e) => [key(e), e] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, e]) => e) };
}
