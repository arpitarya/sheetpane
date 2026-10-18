import '@sheetpane/grid';
import type { ColumnRules, SheetpaneError, SheetpaneExcel } from '@sheetpane/grid';
import { useRef, useState } from 'react';
import { useCellEdit, useChanges, useColumnRules, useErrors, useSelection, useSheetpaneEvent, useWorkbook, type SheetRef } from './sheetpane-hooks';

const FONTS = { System: 'system-ui, sans-serif', Georgia: 'Georgia, serif', Courier: "'Courier New', monospace" } as const;
type View = 'both' | 'sheet' | 'errors';

/** The sample's own mistakes, found by column title (W-27): a mistyped account id, a negative unit count, a missing advisor. */
const RULES: ColumnRules = {
  'Account ID': { required: true, pattern: '^AC-\\d{5}$', message: 'Account IDs are AC- and five digits' },
  Units: { type: 'number', min: 0 },
  Advisor: { required: true, severity: 'warning' },
};
const NO_RULES: ColumnRules = {};

/** The hooks recipe (W-28), every hook in one strip under the sheet. */
function ReviewStrip({ sheet, rulesOn }: { sheet: SheetRef; rulesOn: boolean }) {
  const workbook = useWorkbook(sheet);
  const sel = useSelection(sheet);
  const edit = useCellEdit(sheet);
  const { count, canUndo } = useChanges(sheet);
  const { open } = useErrors(sheet);
  const rules = useColumnRules(sheet, rulesOn ? RULES : NO_RULES);
  const [refused, setRefused] = useState('');
  // a host check of its own: prices are never negative
  useSheetpaneEvent<{ column: { header: string }; now: unknown }>(sheet, 'sheetpane-beforechange', (e) => {
    if (e.detail.column.header === 'Price' && Number(e.detail.now) < 0) { e.preventDefault(); setRefused('A price cannot be negative'); } else setRefused('');
  });
  const parts = [
    sel && `${sel.column.header || sel.column.letter} (${sel.ref}): ${sel.text || '(blank)'}`,
    edit.editing && `typing “${edit.draft ?? ''}”`,
    `${count} change${count === 1 ? '' : 's'}${canUndo ? ' · undo available' : ''}`,
    `${open} open error${open === 1 ? '' : 's'}`,
    rules.checking && `checking columns ${Math.floor((100 * rules.done) / Math.max(1, rules.total))} %`,
    refused,
    workbook?.book && `${workbook.book.sheets.length} sheet${workbook.book.sheets.length === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return <div data-testid="review-strip" style={{ fontSize: 12, color: '#45484F', padding: '4px 0' }}>{parts.join(' · ')}</div>;
}

/** React 19 passes properties (`file`, `open`) and listens to custom events (`onsheetpane-…`) on custom elements natively. */
export function App() {
  const [view, setView] = useState<View>('both');
  const [font, setFont] = useState<keyof typeof FONTS>('System');
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState('/sample.xlsx');
  const [popup, setPopup] = useState(false);
  const [review, setReview] = useState<SheetpaneError[]>([]);
  const [last, setLast] = useState('');
  const [rulesOn, setRulesOn] = useState(false);
  const sheet = useRef<SheetpaneExcel>(null);

  return (
    <div style={{ fontFamily: FONTS[font], minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#16171A' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', minHeight: 56, background: '#fff', borderBottom: '1px solid #E5E7EB', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, border: '1.5px dashed #9CA3AF', padding: '6px 10px', borderRadius: 6 }}>Your React app</span>
        <nav role="tablist" aria-label="Views" style={{ display: 'flex', gap: 4 }}>
          {(['both', 'sheet', 'errors'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} style={{ font: 'inherit', padding: '10px 12px', border: 0, borderBottom: `2px solid ${view === v ? '#111827' : 'transparent'}`, background: 'none', cursor: 'pointer' }}>
              {v === 'both' ? 'Sheet + errors' : v === 'sheet' ? 'Sheet' : `Errors (${review.filter((e) => e.status === 'open').length})`}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
          <label>Font <select aria-label="Page font" value={font} onChange={(e) => setFont(e.target.value as keyof typeof FONTS)}>{Object.keys(FONTS).map((f) => <option key={f}>{f}</option>)}</select></label>
          <label>Open <input type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button onClick={() => { setFile(null); setSrc('/sample.csv'); }}>Load the CSV sample</button>
          <button onClick={() => setPopup(true)}>Open in a pop-up</button>
          <label><input type="checkbox" checked={rulesOn} onChange={(e) => setRulesOn(e.target.checked)} /> Check columns</label>
        </div>
      </header>
      <main style={{ flex: 1, display: 'flex', gap: 16, padding: '16px 24px' }}>
        <section hidden={view === 'errors'} style={{ flex: 1, minWidth: 0 }}>
          <sheetpane-excel ref={sheet} pane="react-demo" mode="edit" author="Demo reviewer" src={file ? undefined : src} file={file}
            header-row={!file && src.endsWith('.xlsx') ? '2' : '1'}
            style={{ height: 'calc(100vh - 160px)' }}
            onsheetpane-change={(e) => setLast(`${e.detail.sheet}!${e.detail.ref} → ${String(e.detail.now)}`)} />
          <ReviewStrip sheet={sheet} rulesOn={rulesOn} />
        </section>
        <aside hidden={view === 'sheet'} style={{ width: 360, flex: 'none' }}>
          <sheetpane-errors pane="react-demo" author="Demo reviewer" style={{ height: 'calc(100vh - 140px)' }}
            onsheetpane-errors={(e) => setReview(e.detail.errors)}
            onsheetpane-reveal={() => setView('both')} />
        </aside>
      </main>
      <footer style={{ padding: '6px 24px', fontSize: 12, color: '#63666E' }} data-testid="last-change">{last || 'No change yet'}</footer>
      <sheetpane-excel pane="react-demo" display="popup" mode="edit" open={popup} onsheetpane-close={() => setPopup(false)} style={{ fontFamily: FONTS[font] }} />
    </div>
  );
}
