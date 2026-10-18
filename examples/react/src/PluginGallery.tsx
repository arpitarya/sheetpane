// The plugin gallery (W-32): the same showcase workbook in every tab, each tab its own pane, so the
// only difference is the plugins. A tab's grid mounts when the tab is first opened and then stays
// (its edits are kept in memory). Importing a plugin registers it; `plugins` turns it on per element.
import '@sheetpane/numfmt/ui';
import '@sheetpane/styles/ui';
import '@sheetpane/formulas/ui';
import '@sheetpane/validation/ui';
import '@sheetpane/condfmt/ui';
import '@sheetpane/images';
import '@sheetpane/charts/ui';
import '@sheetpane/comments';
import type { SheetpaneExcel } from '@sheetpane/grid';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import showcase from '@sheetpane/fixtures/files/showcase.xlsx?url';
import rulesDoc from '@sheetpane/fixtures/files/showcase.rules.json';

export interface GalleryTab { id: string; label: string; plugins?: string; sheet?: string; blurb?: string; rules?: boolean }
export const TABS: readonly GalleryTab[] = [
  { id: 'review', label: 'Review' },
  { id: 'vanilla', label: 'Vanilla', plugins: '', sheet: 'Numbers', blurb: 'The grid alone: values as stored (Numbers!B6 reads 1.25), saved formula results marked stale after an edit, no fills, rules, pictures or charts.' },
  { id: 'numfmt', label: 'Number formats', plugins: 'numfmt', sheet: 'Numbers', blurb: 'numfmt — every Excel number format: B5 is red by its sign, B6 reads 1 1/4. In Edit, the format row sets a format.' },
  { id: 'styles', label: 'Styles', plugins: 'styles', sheet: 'Styles', blurb: 'styles — fills, fonts, borders and alignment from the file; in Edit, the format row restyles the selection.' },
  { id: 'formulas', label: 'Formulas', plugins: 'formulas', sheet: 'Formulas', blurb: 'formulas — edit B2 and the total in B6 and B7 recalculate (IronCalc, loaded on the first formula).' },
  { id: 'validation', label: 'Validation', plugins: 'validation', sheet: 'Validation', blurb: 'validation — the file’s own rules: B4 (Bogus) and C3 (-2) are listed as workbook-rule errors; Status cells get a list arrow.' },
  { id: 'condfmt', label: 'Conditional formats', plugins: 'styles condfmt', sheet: 'CondFmt', blurb: 'condfmt (needs styles) — a colour scale in A, data bars in B, a red fill over 50 in C; edit a number and the colours follow.' },
  { id: 'images', label: 'Images', plugins: 'images', sheet: 'Images', blurb: 'images — the picture anchored to B3:E9, scaled with zoom.' },
  { id: 'charts', label: 'Charts', plugins: 'images charts', sheet: 'Charts', blurb: 'charts (needs images) — a column and a line chart drawn at their anchors; Show source cells selects the data.' },
  { id: 'comments', label: 'Comments', plugins: 'comments', sheet: 'Comments', blurb: 'comments — the note on A2 and the thread on B3 arrive as file comments in the error list; Download writes the review back as comments.' },
  { id: 'all', label: 'All plugins', plugins: 'numfmt styles formulas validation condfmt images charts comments', sheet: 'Numbers', blurb: 'All eight plugins on one pane.' },
  { id: 'rules', label: 'Rules file', plugins: '', sheet: 'Validation', rules: true, blurb: 'A rules file (@sheetpane/fixtures’ showcase.rules.json, passed as the rules prop) checks the showcase on load: six cells fail and are listed in the errors panel. flagging="off": no Flag issue, no pop-up card — the panel is the one place errors are read.' },
];

/** The tab row (APG tabs: arrows move between tabs, Home/End to the ends). */
export function GalleryTabs({ active, onOpen }: { active: string; onOpen: (id: string) => void }) {
  const row = useRef<HTMLElement>(null);
  const key = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === active);
    const j = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    onOpen(TABS[j]!.id);
    requestAnimationFrame(() => row.current?.querySelector<HTMLElement>(`#tab-${TABS[j]!.id}`)?.focus());
  };
  return (
    <nav ref={row} role="tablist" aria-label="Plugin gallery" onKeyDown={key} style={{ display: 'flex', gap: 2, padding: '0 24px', background: '#fff', borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
      {TABS.map((t) => (
        <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={active === t.id} tabIndex={active === t.id ? 0 : -1} onClick={() => onOpen(t.id)}
          style={{ font: 'inherit', fontSize: 13, padding: '9px 10px', border: 0, borderBottom: `2px solid ${active === t.id ? '#2346C8' : 'transparent'}`, background: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

/** One gallery tab: its own pane, opened on the tab's sheet. */
function Panel({ tab, hidden }: { tab: GalleryTab; hidden: boolean }) {
  const sheet = useRef<SheetpaneExcel>(null);
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const open = () => el.select(tab.sheet ?? 'Numbers', 'A1');
    el.addEventListener('sheetpane-load', open, { once: true });
    return () => el.removeEventListener('sheetpane-load', open);
  }, [tab.sheet]);
  const plugins = tab.plugins ? { plugins: tab.plugins } : {};
  const rules = tab.rules ? { rules: rulesDoc, flagging: 'off' as const } : {};
  return (
    <div role="tabpanel" data-tab={tab.id} aria-labelledby={`tab-${tab.id}`} hidden={hidden} style={{ display: hidden ? 'none' : 'flex', gap: 16, padding: '12px 24px 16px' }}>
      <sheetpane-excel ref={sheet} pane={`gallery-${tab.id}`} mode="edit" author="Demo reviewer" src={showcase} {...plugins} {...rules} style={{ flex: 1, minWidth: 0, height: 'calc(100vh - 170px)' }} />
      <sheetpane-errors pane={`gallery-${tab.id}`} author="Demo reviewer" {...plugins} style={{ width: 340, flex: 'none', height: 'calc(100vh - 170px)' }} />
    </div>
  );
}

/** The panels opened so far; only `active` shows. */
export function GalleryPanels({ active, opened }: { active: string; opened: ReadonlySet<string> }) {
  const tab = TABS.find((t) => t.id === active);
  return (
    <>
      {tab?.blurb && <p style={{ margin: '10px 24px 0', fontSize: 13, color: '#45484F' }}>{tab.blurb}</p>}
      {TABS.filter((t) => t.id !== 'review' && opened.has(t.id)).map((t) => <Panel key={t.id} tab={t} hidden={t.id !== active} />)}
    </>
  );
}
