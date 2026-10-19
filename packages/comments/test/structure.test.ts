// W-52 DoD 3: the file's notes read from the moved notes table — a note's error follows its cell,
// and a note on a deleted row goes with it.
import { describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { comments } from '../src/index.js';
import { structureBook } from '../../export/test/fixtures/structure.js';

describe('rows and columns inserted or deleted (W-52 DoD 3)', () => {
  it('a note and a thread move with their cells; deleted, they are resolved', async () => {
    const store = createWorkbook({ plugins: [comments()] });
    await store.load(await structureBook(), 'items.xlsx');
    const file = () => store.getErrors().filter((x) => x.author === 'file').map((x) => [x.range, x.status]).sort();
    expect(file()).toEqual([['B4', 'open'], ['C3', 'open']]);
    const ids = store.getErrors().map((x) => x.id);
    store.insertRows('Data', 0);
    expect(file()).toEqual([['B5', 'open'], ['C4', 'open']]);
    expect(store.getErrors().map((x) => x.id)).toEqual(ids);
    store.deleteRows('Data', 3);
    expect(store.getErrors().find((x) => x.range === 'C4')).toMatchObject({ status: 'resolved', message: 'row deleted' });
  });
});
