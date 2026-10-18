// `sheetpane(page)` for Playwright (W-41): drives <sheetpane-excel> as a person would — clicks,
// typing, the Download button — through the grid's committed hooks (`data-sp-*`, roles, labels).
// Playwright's CSS locators pierce the open shadow roots. No runtime import of Playwright:
// the page and locators are typed by the few methods used.
import { readFile } from './read.js';
import type { CellAt, Download, FlagDraft, SheetpaneDriver } from './driver.js';
import { resolveAt, toAt } from './inpage.js';

// Typed by the few methods used, loosely, so Playwright's own Page and Locator fit without importing them.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface Locator {
  first(): Locator; nth(i: number): Locator; locator(selector: string): Locator;
  click(): Promise<void>; fill(value: string): Promise<void>; press(key: string): Promise<void>; selectOption(value: string): Promise<unknown>;
  waitFor(o?: any): Promise<void>; count(): Promise<number>;
  evaluate<R = any, A = any>(fn: (el: any, arg: A) => R | Promise<R>, arg?: A): Promise<R>;
}
interface Download_ { suggestedFilename(): string; path(): Promise<string | null> }
interface PageLike { locator(selector: string): any; waitForEvent(event: 'download'): Promise<any> }

export interface PlaywrightOptions {
  /** Which sheet: a CSS selector (default `sheetpane-excel`, the first). */
  excel?: string;
  /** Its errors panel (default `sheetpane-errors[pane="<the sheet's pane>"]`). */
  errors?: string;
}

export function sheetpane(page: PageLike, o: PlaywrightOptions = {}): SheetpaneDriver & { excel: Locator; cell(ref: string): Locator } {
  const excel: Locator = page.locator(o.excel ?? 'sheetpane-excel').first();
  const panel = async () => { const pane = await excel.evaluate((el) => el.getAttribute('pane'), null); return page.locator(o.errors ?? (pane ? `sheetpane-errors[pane="${pane}"]` : 'sheetpane-errors')).first(); };
  // resolveAt is self-contained, so Playwright can send its source to the page as is
  const where = (at: CellAt): Promise<{ sheet: string; ref: string }> => excel.evaluate(resolveAt, toAt(at));
  const cell = (ref: string) => excel.locator(`[data-sp-ref="${ref}"]`);
  const select = async (at: CellAt) => {
    const r = await where(at);
    await excel.evaluate((el, a) => (el as Element & { select(s: string, r: string): void }).select(a.sheet, a.ref), r);
    await cell(r.ref).click();
    return r;
  };
  const download = async (): Promise<Download> => {
    const [dl] = (await Promise.all([page.waitForEvent('download'), excel.locator('[data-sp="download"]').click()])) as [Download_, void];
    const p = await dl.path();
    const fs = 'node:fs'; // Playwright's test process is Node; typed by shape so no Node types are needed
    const { readFileSync } = (await import(/* @vite-ignore */ fs)) as { readFileSync(p: string): Uint8Array };
    return { name: dl.suggestedFilename(), bytes: new Uint8Array(readFileSync(p!)) };
  };
  return {
    excel, cell,
    async waitForLoad() {
      await excel.evaluate((el) => new Promise<void>((done) => {
        const s = (el as Element & { workbook?: { getSnapshot(): { load: { status: string } }; ruleProgress?: unknown } }).workbook;
        const settled = () => { const w = (el as Element & { workbook?: { ruleProgress?: unknown } }).workbook; if (!w?.ruleProgress) done(); else setTimeout(settled, 25); };
        if (s?.getSnapshot().load.status === 'ready') settled(); else el.addEventListener('sheetpane-load', () => settled(), { once: true });
      }), null);
    },
    async ref(at) { const r = await where(at); return `${r.sheet}!${r.ref}`; },
    async select(at) { await select(at); },
    async edit(at, value) { await select(at); const input = excel.locator('[data-sp="cell-input"]'); await input.fill(value); await input.press('Enter'); },
    async paste(at, rows) {
      await select(at);
      await excel.evaluate((el, tsv) => {
        const dt = new DataTransfer(); dt.setData('text/plain', tsv);
        el.shadowRoot!.querySelector('[role="grid"]')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true, composed: true }));
      }, rows.map((r) => r.join('\t')).join('\n'));
    },
    async flag(at, d: FlagDraft = {}) {
      await select(at);
      await excel.locator('[data-sp="flag"]').click();
      // the form opens in a connected <sheetpane-errors>, else inline in the sheet (SR-GRID decision 13)
      const errors = await panel();
      const inPanel = (await errors.count()) > 0;
      const form = inPanel ? errors.locator('[aria-label="New error"]') : excel.locator('[data-sp="composer"]');
      await form.waitFor();
      if (d.type) { if (inPanel) await form.locator(`[data-act="type"][data-v="${d.type}"]`).click(); else await form.locator('[data-field="type"]').selectOption(d.type); }
      if (d.severity) await form.locator(inPanel ? `[data-act="sev"][data-v="${d.severity}"]` : `[data-act="sev"][data-sev="${d.severity}"]`).click();
      if (d.message !== undefined) await form.locator('[data-field="message"]').fill(d.message);
      if (d.expected !== undefined) await form.locator('[data-field="expected"]').fill(d.expected);
      await form.locator('[data-sp="add-error"]').click();
      await form.waitFor({ state: 'detached' }); // the form closes once the error is stored
    },
    async resolve(which) {
      const errors = await panel();
      const row = typeof which === 'number' ? errors.locator('[data-sp-error]').nth(which) : errors.locator(`[data-sp-ref="${(await where(which)).sheet}!${(await where(which)).ref}"]`).first();
      await row.locator('[data-act="pick"]').click();
      await row.locator('[data-sp="resolve"]').click();
    },
    async undo() { await excel.locator('[data-sp="undo"]').click(); },
    async switchSheet(name) { await excel.locator(`[data-sp-sheet="${name}"]`).click(); },
    download,
    async readDownload() { const f = await download(); return readFile(f.bytes, f.name); },
    errors: () => excel.evaluate((el) => (el as Element & { workbook: { getErrors(): never } }).workbook.getErrors(), null),
    async value(at) { const r = await where(at); return excel.evaluate((el, a) => (el as Element & { workbook: { value(s: string, r: string): unknown } }).workbook.value(a.sheet, a.ref), r); },
    async text(at) { const r = await where(at); return excel.evaluate((el, a) => (el as Element & { workbook: { text(s: string, r: string): string } }).workbook.text(a.sheet, a.ref), r); },
  };
}
