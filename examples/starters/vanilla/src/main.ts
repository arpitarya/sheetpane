// Registers <sheetpane-excel> and <sheetpane-errors>, then wires the page to them.
import '@sheetpane/grid';
import type { SheetpaneError, SheetpaneExcel } from '@sheetpane/grid';

const popup = document.querySelector<SheetpaneExcel>('#popup-sheet')!;
document.querySelector('#popup')!.addEventListener('click', () => { popup.open = true; });

// every element on the pane reports the review: count the open errors
const count = document.querySelector('#open-errors')!;
document.querySelector('sheetpane-errors')!.addEventListener('sheetpane-errors', (e) => {
  const open = (e as CustomEvent<{ errors: SheetpaneError[] }>).detail.errors.filter((x) => x.status === 'open').length;
  count.textContent = open === 0 ? 'no open errors' : `${open} open error${open === 1 ? '' : 's'}`;
});
