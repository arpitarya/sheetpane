import { afterEach, describe, expect, it } from 'vitest';
import { createWorkbook, paneStore, registeredPluginIds, type SheetpaneErrors, type SheetpaneExcel } from '@sheetpane/grid';
import { comments } from '../src/index.js';
import { blobBytes, frame, unzip, workbook } from './helpers.js';

afterEach(() => document.body.replaceChildren());
const sh = (el: Element) => el.shadowRoot!;
let paneN = 0;

const P1 = '{11111111-1111-4111-8111-111111111111}', T1 = '{AAAAAAAA-0000-4000-8000-000000000001}', T2 = '{AAAAAAAA-0000-4000-8000-000000000002}';
const file = () => workbook({
  persons: [{ id: P1, displayName: 'R. Mehta' }],
  sheets: [{ name: 'Holdings', cells: { A1: 'Account', H3: 1200, D9: 'TIPS', I6: '7.5%' }, threads: [
    { id: T1, ref: 'H3', personId: P1, text: 'Includes 200 units transferred in on 28-Sep.' },
    { id: T2, ref: 'H3', personId: P1, parentId: T1, text: 'Custodian confirmed.' },
  ], notes: [{ ref: 'D9', author: 'R. Mehta', text: 'Inflation-linked; units revised quarterly.' }] }],
});

/** `<sheetpane-excel>` and `<sheetpane-errors>` on one store made with `createWorkbook({ plugins: [comments()] })`. */
async function mount() {
  const store = createWorkbook({ plugins: [comments()] });
  const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
  const errors = document.createElement('sheetpane-errors') as SheetpaneErrors;
  excel.workbook = store; errors.workbook = store;
  excel.setAttribute('mode', 'edit'); excel.setAttribute('author', 'Arpit');
  excel.style.height = '500px'; errors.style.height = '500px';
  document.body.append(excel, errors);
  await excel.load(await file(), 'review.xlsx');
  await frame();
  return { store, excel, errors };
}

describe('registration (DoD 1)', () => {
  it('importing the package registers "comments"; plugins="comments" on the element turns it on', async () => {
    expect(registeredPluginIds()).toContain('comments');
    const pane = `c${++paneN}`;
    const excel = document.createElement('sheetpane-excel') as SheetpaneExcel;
    excel.setAttribute('pane', pane); excel.setAttribute('plugins', 'comments');
    document.body.append(excel);
    await excel.load(await file(), 'review.xlsx');
    expect(paneStore(pane)!.pluginIds).toEqual(['comments']);
    expect(excel.getErrors().map((e) => [e.range, e.author])).toEqual([['H3', 'file'], ['D9', 'file']]);
  });
});

describe('file notes in <sheetpane-errors> (DoD 2)', () => {
  it('read-only (Show in sheet, no Resolve or Delete), labelled File comment, filterable as File comments', async () => {
    const { store, errors } = await mount();
    store.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', author: 'Arpit' });
    await frame();
    const rows = () => [...sh(errors).querySelectorAll('.list .item')].map((x) => (x as HTMLElement).dataset.id);
    expect(rows()).toHaveLength(3);
    const filters = [...sh(errors).querySelectorAll('[data-act=author]')] as HTMLButtonElement[];
    expect(filters.map((b) => b.textContent)).toEqual(['Anyone', 'People', 'File comments']);
    filters[2]!.click();
    await frame();
    const fileIds = store.getErrors().filter((e) => e.author === 'file').map((e) => e.id);
    expect(rows()).toEqual(fileIds);
    (sh(errors).querySelector('.list .item [data-act=pick]') as HTMLElement).click();
    await frame();
    const detail = sh(errors).querySelector('.detail')!;
    expect(detail.textContent).toContain('R. Mehta: Includes 200 units transferred in on 28-Sep.');
    expect(detail.textContent).toContain('R. Mehta: Custodian confirmed.');
    expect(detail.textContent).toContain('File comment');
    expect(detail.querySelector('[data-act=reveal]')).not.toBeNull();
    expect(detail.querySelector('[data-act=resolve]')).toBeNull();
    expect(detail.querySelector('[data-act=delete]')).toBeNull();
  });
});

describe('<sheetpane-excel>.export(options) (DoD 3a)', () => {
  it('export({ comments: false }) leaves the comment parts as they were; export() writes the review', async () => {
    const { store, excel } = await mount();
    store.addError({ sheet: 'Holdings', range: 'I6', type: 'wrong-value', severity: 'error', expected: '0.75%', author: 'Arpit' });
    const src = await unzip(await file());
    const off = await unzip(await blobBytes(await excel.export({ comments: false })));
    for (const k of ['xl/threadedComments/threadedComment1.xml', 'xl/comments1.xml', 'xl/drawings/vmlDrawing1.vml', 'xl/persons/person.xml']) expect(off.get(k), k).toBe(src.get(k));
    const on = await unzip(await blobBytes(await excel.export()));
    expect(on.get('xl/threadedComments/threadedComment1.xml')).toContain('ref="I6"');
    expect(on.get('xl/persons/person.xml')).toContain('displayName="Arpit"');
  });
});
