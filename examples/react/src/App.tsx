import '@sheetpane/grid';
import type { ColumnRules, SheetpaneError, SheetpaneExcel } from '@sheetpane/grid';
import { useEffect, useRef, useState } from 'react';
import { GalleryPanels, GalleryTabs } from './PluginGallery';
import { useCellEdit, useChanges, useColumnRules, useErrors, useSelection, useSheetpaneEvent, useWorkbook, type SheetRef } from './sheetpane-hooks';
import './demo.css';

const FONTS = { System: 'system-ui, sans-serif', Georgia: 'Georgia, serif', Courier: "'Courier New', monospace" } as const;
const THEMES = { Light: 'light', Dark: 'dark', Auto: 'auto' } as const;
export type Theme = (typeof THEMES)[keyof typeof THEMES];
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
  return (
    <div className="strip" data-testid="review-strip" aria-live="polite">
      <span className="tag">hooks</span>
      {parts.join(' · ')}
    </div>
  );
}

/** React 19 passes properties (`file`, `open`) and listens to custom events (`onsheetpane-…`) on custom elements natively. */
export function App() {
  const [view, setView] = useState<View>('both');
  const [font, setFont] = useState<keyof typeof FONTS>('System');
  const [theme, setTheme] = useState<Theme>('light');
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState('/sample.xlsx');
  const [popup, setPopup] = useState(false);
  const [review, setReview] = useState<SheetpaneError[]>([]);
  const [last, setLast] = useState('');
  const [exported, setExported] = useState('');
  const [rulesOn, setRulesOn] = useState(false);
  const sheet = useRef<SheetpaneExcel>(null);
  const [demo, setDemo] = useState('review');
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const openDemo = (id: string) => { setDemo(id); setOpened((o) => (o.has(id) ? o : new Set([...o, id]))); };
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const open = review.filter((e) => e.status === 'open').length;

  return (
    <div className="app" style={{ fontFamily: FONTS[font] }}>
      <header className="hostbar">
        <div className="brand">
          <span className="logo">Your React app</span>
          <span className="crumb">Holdings review<small>React 19</small></span>
          {import.meta.env.VITE_SHEETPANE_VERSION && <span className="ver" title="sheetpane version">sheetpane {import.meta.env.VITE_SHEETPANE_VERSION}</span>}
        </div>
        <div className="seg" role="tablist" aria-label="Views">
          {(['both', 'sheet', 'errors'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {v === 'both' ? 'Sheet + errors' : v === 'sheet' ? 'Sheet' : `Errors (${open})`}
            </button>
          ))}
        </div>
        <div className="tools">
          <label className="btn" title="Open an .xlsx or .csv — read in this tab, nothing is uploaded">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>Open file…
            <input type="file" accept=".xlsx,.csv" aria-label="Open" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" className="btn" onClick={() => { setFile(null); setSrc('/sample.csv'); }}>Load the CSV sample</button>
          <button type="button" className="btn" onClick={() => setPopup(true)}>Open in a pop-up</button>
          <span className="sep" aria-hidden="true" />
          <label className="switch" title="Column rules (W-27): checks the sample by column title">
            <input type="checkbox" checked={rulesOn} onChange={(e) => setRulesOn(e.target.checked)} /> Check columns
          </label>
          <label className="field">Font <select aria-label="Page font" value={font} onChange={(e) => setFont(e.target.value as keyof typeof FONTS)}>{Object.keys(FONTS).map((f) => <option key={f}>{f}</option>)}</select></label>
          <label className="field">Theme <select aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>{Object.entries(THEMES).map(([l, v]) => <option key={v} value={v}>{l}</option>)}</select></label>
        </div>
      </header>
      <GalleryTabs active={demo} onOpen={openDemo} />
      <div className="stage">
        <GalleryPanels active={demo} opened={opened} theme={theme} />
        <main className="review" hidden={demo !== 'review'}>
          <section className="sheet" hidden={view === 'errors'}>
            <sheetpane-excel ref={sheet} pane="react-demo" mode="edit" author="Demo reviewer" theme={theme} src={file ? undefined : src} file={file}
              header-row={!file && src.endsWith('.xlsx') ? '2' : '1'}
              onsheetpane-change={(e) => setLast(`${e.detail.sheet}!${e.detail.ref} → ${String(e.detail.now)}`)}
              onsheetpane-export={(e) => setExported(`${e.detail.name} · ${e.detail.format ?? e.detail.kind}${e.detail.converted ? ' (converted)' : ''}${e.detail.sha256 ? ` · sha256 ${e.detail.sha256.slice(0, 12)}…` : ''}`)} />
            <ReviewStrip sheet={sheet} rulesOn={rulesOn} />
          </section>
          <aside className="side" hidden={view === 'sheet'} style={view === 'errors' ? { width: 'auto', flex: 1 } : undefined}>
            <sheetpane-errors pane="react-demo" author="Demo reviewer" theme={theme}
              onsheetpane-errors={(e) => setReview(e.detail.errors)}
              onsheetpane-reveal={() => setView('both')} />
          </aside>
        </main>
      </div>
      <footer className="events" aria-live="polite">
        <b>Host events</b>
        <span><span className="ev">sheetpane-change</span> <span data-testid="last-change">{last || 'No change yet'}</span></span>
        <span><span className="ev">sheetpane-errors</span> {open} open of {review.length}</span>
        <span><span className="ev">sheetpane-export</span> {exported || '—'}</span>
      </footer>
      <sheetpane-excel pane="react-demo" display="popup" mode="edit" theme={theme} open={popup} onsheetpane-close={() => setPopup(false)} style={{ fontFamily: FONTS[font] }} />
    </div>
  );
}
