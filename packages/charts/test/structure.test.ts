// W-52 DoD 3: a chart follows its rows — the anchor moves with the drawing table, and the series
// read from the chart part the moved workbook serves (its `c:f` references moved).
import { describe, expect, it } from 'vitest';
import { createWorkbook } from '@sheetpane/grid';
import { chartModel, charts, chartsOn } from '../src/index.js';
import { structureBook } from '../../export/test/fixtures/structure.js';

describe('rows and columns inserted or deleted (W-52 DoD 3)', () => {
  it('the anchor and the series ranges move; deleted source cells are #REF! and drop out', async () => {
    const store = createWorkbook({ plugins: [charts()] });
    await store.load(await structureBook(), 'items.xlsx');
    store.insertRows('Data', 0, 2);
    const [c] = chartsOn(store.book, 'Data');
    expect(c!.drawing.from).toMatchObject({ row: 3, col: 5 });
    const m = (await chartModel(store.book!, c!.path))!;
    expect(m.series[0]!.val!.ranges[0]).toMatchObject({ sheet: 'Data', range: 'D4:D7' });
    expect(m.series[0]!.cat!.ranges[0]).toMatchObject({ range: 'A4:A7' });
    store.deleteCols('Data', 3);
    const after = (await chartModel(store.book!, chartsOn(store.book, 'Data')[0]!.path))!;
    expect(after.series[0]!.val!.f).toBe('Data!#REF!');
    expect(after.series[0]!.val!.ranges).toEqual([]);
    store.undo();
    const back = (await chartModel(store.book!, chartsOn(store.book, 'Data')[0]!.path))!;
    expect(back.series[0]!.val!.ranges[0]).toMatchObject({ range: 'D4:D7' });
  });
});
