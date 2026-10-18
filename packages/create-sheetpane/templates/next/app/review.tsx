'use client';
// Registers <sheetpane-excel> and <sheetpane-errors>. React 19 sets their properties (`open`)
// and listens to their events (`onsheetpane-…`) natively.
import '@sheetpane/grid';
import { useState } from 'react';

export default function Review() {
  const [popup, setPopup] = useState(false);
  const [open, setOpen] = useState(0);
  return (
    <>
      <header className="bar">
        <strong>__SHEETPANE_NAME__</strong>
        <span className="count">{open === 0 ? 'no open errors' : `${open} open error${open === 1 ? '' : 's'}`}</span>
        <button type="button" onClick={() => setPopup(true)}>Open in a pop-up</button>
      </header>
      {/* One pane, three places: the sheet and its errors side by side, and the same sheet in a pop-up. */}
      <main className="review">
        <sheetpane-excel pane="review" mode="edit" author="You" src="/showcase.xlsx" rules-src="/showcase.rules.json" />
        <sheetpane-errors pane="review" author="You"
          onsheetpane-errors={(e) => setOpen(e.detail.errors.filter((x) => x.status === 'open').length)} />
      </main>
      <sheetpane-excel pane="review" mode="edit" author="You" display="popup" open={popup} onsheetpane-close={() => setPopup(false)} />
    </>
  );
}
