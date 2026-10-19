// W-54 DoD 3, the browser side: every case opened in `<sheetpane-excel>` — the plugins named by
// its `plugins` attribute, the rules set on the element, the file through `load()` — and, once
// its checks have finished, its errors equal golden/parity.json, the file `check()` in Node is
// held to (`parity.node.test.ts`). Both passing: the pane and `check()` give the same errors.
import { afterEach, describe, expect, it } from 'vitest';
import { registerPlugin, type SheetpaneExcel } from '@sheetpane/grid';
import '@sheetpane/comments';
import '@sheetpane/numfmt';
import '@sheetpane/validation';
import { formulas, type FormulasPlugin } from '@sheetpane/formulas';
import goldenText from './golden/parity.json?raw';
import { cases, outcome, validate, type Outcome } from './parity.js';

// the formula engine as the pane makes it, kept so the test can wait for its recalculation
const made: { engine?: FormulasPlugin | undefined } = {};
registerPlugin('parity-formulas', () => (made.engine = formulas()));
const engine = (): FormulasPlugin | undefined => made.engine; // read through a call: the factory sets it
const turn = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => document.body.replaceChildren());

describe('the pane in a browser gives what check() gives in Node (W-54 DoD 3)', () => {
  it('every fixture, and 20,000 generated rows, equal the golden', async () => {
    const got: Record<string, Outcome> = {};
    for (const c of await cases()) {
      made.engine = undefined;
      const el = document.createElement('sheetpane-excel') as SheetpaneExcel;
      el.setAttribute('plugins', 'numfmt validation comments parity-formulas');
      el.style.height = '400px';
      document.body.append(el);
      el.columns = c.columns;
      el.validate = validate;
      if (c.rules !== undefined) el.rules = c.rules;
      await el.load(await c.data(), c.name);
      const store = el.workbook!;
      const load = store.getSnapshot().load;
      if (load.status === 'error') { got[c.id] = { refused: load.spCode }; el.remove(); continue; }
      // the checks have finished: the engine idle, the rules' load phase done, then a turn for the store
      for (let i = 0; i < 3; i++) {
        await engine()?.ready();
        while (store.ruleProgress !== undefined) await turn();
        await turn();
      }
      got[c.id] = outcome(el.getErrors());
      el.remove();
    }
    expect(got).toEqual(JSON.parse(goldenText));
  }, 180_000);
});
