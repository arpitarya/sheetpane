// W-52 DoD 3: workbook rules read the moved validation table — a rule follows its cells.
import { describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { validation } from '../src/index.js';
import { structureBook } from '../../export/test/fixtures/structure.js';

describe('rows and columns inserted or deleted (W-52 DoD 3)', () => {
  it('a rule on B2:B5 is on B4:B7 after two rows above it; its error follows the cell', async () => {
    const store = createWorkbook({ plugins: [validation()] });
    await store.load(await structureBook(), 'items.xlsx');
    store.setCell('Data', 'B3', '100'); // between 0 and $D$6 (17): refused by the rule
    const e = store.getErrors().find((x) => x.author === 'workbook')!;
    expect(e.range).toBe('B3');
    store.insertRows('Data', 0, 2);
    expect(store.sheet('Data')!.dataValidations[0]).toMatchObject({ sqref: ['B4:B7'], formula2: '$D$8' });
    const moved = store.getErrors().filter((x) => x.author === 'workbook');
    expect(moved.map((x) => [x.id, x.range, x.status])).toEqual([[e.id, 'B5', 'open']]);
    store.setCell('Data', 'B4', '50');
    expect(store.getErrors().filter((x) => x.author === 'workbook' && x.status === 'open').map((x) => x.range).sort()).toEqual(['B4', 'B5']);
  });
});
