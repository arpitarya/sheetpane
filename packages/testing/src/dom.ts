// `sheetpane(element)` for Vitest browser mode (W-41): the test runs inside the page, so the driver
// works on the element directly — the same API as `@sheetpane/testing/playwright`, through the same
// committed hooks. Download is captured from `sheetpane-export` (and the browser's save prevented).
import { readFile } from './read.js';
import type { CellAt, Download, FlagDraft, SheetpaneDriver } from './driver.js';
import { resolveAt, toAt } from './inpage.js';

type Excel = HTMLElement & { workbook: { getSnapshot(): { load: { status: string } }; ruleProgress?: unknown; getErrors(): never; value(s: string, r: string): unknown; text(s: string, r: string): string }; select(s: string, r: string): void };
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
async function until<T>(get: () => T | null | undefined, ms = 5000): Promise<T> {
  const t0 = performance.now();
  for (;;) { const v = get(); if (v) return v; if (performance.now() - t0 > ms) throw new Error('@sheetpane/testing: timed out'); await new Promise((r) => setTimeout(r, 10)); }
}

/** The errors panel the DOM driver uses, when it is not the one on the sheet's pane. */
export interface DomOptions {
  /** Its errors panel (default: the `<sheetpane-errors>` on the same pane, if any). */
  errors?: HTMLElement;
}

/**
 * A driver for a `<sheetpane-excel>` in Vitest browser mode: it works on the element directly,
 * with the same API as the Playwright driver. Download is captured from `sheetpane-export`
 * and the browser's save prevented.
 *
 * @param el - The `<sheetpane-excel>` element.
 * @param o - Its errors panel, when not the `<sheetpane-errors>` on the same pane.
 * @returns The driver, plus `cell(ref)` for a cell's element.
 * @example
 * ```ts
 * import { sheetpane } from '@sheetpane/testing/dom';
 * const sp = sheetpane(excel);
 * await sp.waitForLoad();
 * await sp.edit('B2', '42');
 * const values = await sp.readDownload();
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0118_TESTING.md
 */
export function sheetpane(el: HTMLElement, o: DomOptions = {}): SheetpaneDriver & { cell(ref: string): HTMLElement | null } {
  const x = el as Excel;
  const root = () => el.shadowRoot!;
  const q = <T extends Element = HTMLElement>(sel: string) => root().querySelector<T & Element>(sel) as T | null;
  const panel = () => o.errors ?? (el.getAttribute('pane') ? document.querySelector<HTMLElement>(`sheetpane-errors[pane="${CSS.escape(el.getAttribute('pane')!)}"]`) : null);
  const cell = (ref: string) => q(`[data-sp-ref="${ref}"]`);
  const where = (at: CellAt) => resolveAt(el, toAt(at));
  const press = (target: Element, key: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
  const select = async (at: CellAt) => {
    const r = where(at);
    x.select(r.sheet, r.ref);
    await frame();
    const c = await until(() => cell(r.ref));
    c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
    await frame();
    return r;
  };
  const download = async (): Promise<Download> => {
    const got = new Promise<Download>((done) => el.addEventListener('sheetpane-export', async (e) => {
      const d = (e as CustomEvent<{ blob: Blob; name: string }>).detail;
      e.preventDefault(); // the test keeps the file; the browser saves nothing
      done({ name: d.name, bytes: new Uint8Array(await d.blob.arrayBuffer()) });
    }, { once: true }));
    q<HTMLButtonElement>('[data-sp="download"]')!.click();
    return got;
  };
  return {
    cell,
    async waitForLoad() {
      if (x.workbook?.getSnapshot().load.status !== 'ready') await new Promise((r) => el.addEventListener('sheetpane-load', r, { once: true }));
      await until(() => !x.workbook.ruleProgress, 60_000);
      await frame();
    },
    async ref(at) { const r = where(at); return `${r.sheet}!${r.ref}`; },
    async select(at) { await select(at); },
    async edit(at, value) {
      await select(at);
      const input = q<HTMLInputElement>('[data-sp="cell-input"]')!;
      input.focus(); input.value = value; input.dispatchEvent(new Event('input'));
      press(input, 'Enter');
      await frame();
    },
    async paste(at, rows) {
      await select(at);
      const dt = new DataTransfer(); dt.setData('text/plain', rows.map((r) => r.join('\t')).join('\n'));
      q('[role="grid"]')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true, composed: true }));
      await frame();
    },
    async flag(at, d: FlagDraft = {}) {
      await select(at);
      q<HTMLButtonElement>('[data-sp="flag"]')!.click();
      await frame();
      const p = panel();
      // choosing a type or a severity redraws the form: find it again after each
      const formNow = () => until(() => (p ? p.shadowRoot!.querySelector<HTMLElement>('[aria-label="New error"]') : q('[data-sp="composer"]')));
      let form = await formNow();
      if (d.type) {
        if (p) form.querySelector<HTMLElement>(`[data-act="type"][data-v="${d.type}"]`)?.click();
        else { const s = form.querySelector<HTMLSelectElement>('[data-field="type"]')!; s.value = d.type; s.dispatchEvent(new Event('change', { bubbles: true })); }
        await frame(); form = await formNow();
      }
      if (d.severity) { form.querySelector<HTMLElement>(p ? `[data-act="sev"][data-v="${d.severity}"]` : `[data-act="sev"][data-sev="${d.severity}"]`)?.click(); await frame(); form = await formNow(); }
      const fill = (field: string, v: string | undefined) => { if (v === undefined) return; const t = form.querySelector<HTMLTextAreaElement | HTMLInputElement>(`[data-field="${field}"]`)!; t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); };
      fill('message', d.message); fill('expected', d.expected);
      form.querySelector<HTMLButtonElement>('[data-sp="add-error"]')!.click();
      await until(() => !form.isConnected || !(p ? p.shadowRoot!.querySelector('[aria-label="New error"]') : q('[data-sp="composer"]'))); // the form closes once the error is stored
    },
    async resolve(which) {
      const p = panel();
      if (!p) throw new Error('@sheetpane/testing: resolve() needs a <sheetpane-errors> on the pane');
      const r = typeof which === 'number' ? undefined : where(which);
      const row = typeof which === 'number' ? p.shadowRoot!.querySelectorAll<HTMLElement>('[data-sp-error]')[which] : p.shadowRoot!.querySelector<HTMLElement>(`[data-sp-ref="${r!.sheet}!${r!.ref}"]`);
      row!.querySelector<HTMLElement>('[data-act="pick"]')!.click();
      await frame();
      const id = row!.dataset.spError!;
      (await until(() => p.shadowRoot!.querySelector<HTMLElement>(`[data-sp-error="${id}"] [data-sp="resolve"]`))).click();
      await frame();
    },
    async undo() { q<HTMLButtonElement>('[data-sp="undo"]')!.click(); await frame(); },
    async switchSheet(name) { q<HTMLButtonElement>(`[data-sp-sheet="${CSS.escape(name)}"]`)!.click(); await frame(); },
    download,
    async readDownload() { const f = await download(); return readFile(f.bytes, f.name); },
    async errors() { return x.workbook.getErrors(); },
    async value(at) { const r = where(at); return x.workbook.value(r.sheet, r.ref); },
    async text(at) { const r = where(at); return x.workbook.text(r.sheet, r.ref); },
  };
}
