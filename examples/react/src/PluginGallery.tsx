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
import '@sheetpane/visibility/ui';
import '@sheetpane/tables';
import { compareWith } from '@sheetpane/compare/ui';
import type { SheetpaneExcel } from '@sheetpane/grid';
import { Fragment, useEffect, useRef, type KeyboardEvent } from 'react';
import showcase from '@sheetpane/fixtures/files/showcase.xlsx?url';
import compareNow from '@sheetpane/fixtures/files/compare/now.xlsx?url';
import compareBase from '@sheetpane/fixtures/files/compare/base.xlsx?url';
import rulesDoc from '@sheetpane/fixtures/files/showcase.rules.json';
import type { Theme } from './App';

export interface GalleryTab { id: string; label: string; plugins?: string; sheet?: string; blurb?: string; rules?: boolean; src?: string; base?: string }
export const TABS: readonly GalleryTab[] = [
  { id: 'review', label: 'Review' },
  { id: 'vanilla', label: 'Vanilla', plugins: '', sheet: 'Numbers', blurb: 'The grid alone: values as stored (Numbers!B6 reads 1.25), saved formula results marked stale after an edit, no fills, rules, pictures or charts.' },
  { id: 'numfmt', label: 'Number formats', plugins: 'numfmt', sheet: 'Numbers', blurb: 'Every Excel number format: B5 is red by its sign, B6 reads 1 1/4. In Edit, the format row sets a format.' },
  { id: 'styles', label: 'Styles', plugins: 'styles', sheet: 'Styles', blurb: 'Fills, fonts, borders and alignment from the file; in Edit, the format row restyles the selection.' },
  { id: 'formulas', label: 'Formulas', plugins: 'formulas', sheet: 'Formulas', blurb: 'Edit B2 and the total in B6 and B7 recalculate (IronCalc, loaded on the first formula).' },
  { id: 'validation', label: 'Validation', plugins: 'validation', sheet: 'Validation', blurb: 'The file’s own rules: B4 (Bogus) and C3 (-2) are listed as workbook-rule errors; Status cells get a list arrow.' },
  { id: 'condfmt', label: 'Conditional formats', plugins: 'styles condfmt', sheet: 'CondFmt', blurb: 'Needs styles. A colour scale in A, data bars in B, a red fill over 50 in C; edit a number and the colours follow.' },
  { id: 'images', label: 'Images', plugins: 'images', sheet: 'Images', blurb: 'The picture anchored to B3:E9, scaled with zoom.' },
  { id: 'charts', label: 'Charts', plugins: 'images charts', sheet: 'Charts', blurb: 'Needs images. A column and a line chart drawn at their anchors; Show source cells selects the data.' },
  { id: 'comments', label: 'Comments', plugins: 'comments', sheet: 'Comments', blurb: 'The note on A2 and the thread on B3 arrive as file comments in the error list; Download writes the review back as comments.' },
  { id: 'all', label: 'All plugins', plugins: 'numfmt styles formulas validation condfmt images charts comments', sheet: 'Numbers', blurb: 'All eight plugins on one pane.' },
  { id: 'visibility', label: 'Hide and show', plugins: 'visibility', sheet: 'Numbers', blurb: 'Right-click a row or column header (or select and press Ctrl+Alt+9 / Ctrl+Alt+0) to hide; the ◂▸ / ▴▾ marker shows where, and a click unhides. Hidden parts download hidden; a file’s own hidden rows, columns and sheets are marked in every tab.' },
  { id: 'tables', label: 'Tables', plugins: 'tables validation', sheet: 'Tables', blurb: 'Excel tables drawn by their own style — Units in blue (Medium 2), Readings in green (Medium 7) with its first column and totals row. Readings’ Unit column is a list over Units[Unit] (the defined name UnitList): type “furlong” in C9 and it fails; add it to Units and it passes.' },
  { id: 'compare', label: 'Compare', plugins: 'compare', sheet: 'Holdings', src: compareNow, base: compareBase, blurb: 'This file against its earlier version (base.xlsx, read in the page), keyed by Account: the changed price is amber, the added row green, the moved row blue, a red line where a row was removed; the status line sums it up and each change is in the errors list. Alt+F5 / Alt+Shift+F5 step through them; Compare… picks another base.' },
  { id: 'rules', label: 'Rules file', plugins: '', sheet: 'Validation', rules: true, blurb: 'A rules file (@sheetpane/fixtures’ showcase.rules.json, passed as the rules prop) checks the showcase on load: six cells fail and are listed in the errors panel. flagging="off": no Flag issue, no pop-up card — the panel is the one place errors are read.' },
];
/** Review · the plugins one by one · together. */
const SEP_AFTER = new Set(['review', 'comments']);

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
    <div className="demos">
      <span className="demos-lbl" aria-hidden="true">Demo</span>
      <nav ref={row} className="gallery" role="tablist" aria-label="Plugin gallery" onKeyDown={key}>
        {TABS.map((t) => (
          <Fragment key={t.id}>
            <button id={`tab-${t.id}`} type="button" role="tab" aria-selected={active === t.id} tabIndex={active === t.id ? 0 : -1} onClick={() => onOpen(t.id)}>
              {t.label}
            </button>
            {SEP_AFTER.has(t.id) && <span className="gsep" aria-hidden="true" />}
          </Fragment>
        ))}
      </nav>
    </div>
  );
}

/** One gallery tab: its own pane, opened on the tab's sheet. */
function Panel({ tab, hidden, theme }: { tab: GalleryTab; hidden: boolean; theme: Theme }) {
  const sheet = useRef<SheetpaneExcel>(null);
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const open = () => {
      el.select(tab.sheet ?? 'Numbers', 'A1');
      // W-63: the host hands the plugin the earlier version — fetched by the host, read in the page
      if (tab.base) void fetch(tab.base).then((r) => r.arrayBuffer()).then((b) => compareWith(el.workbook!, b, { name: 'base.xlsx', key: 'Account' }));
    };
    el.addEventListener('sheetpane-load', open, { once: true });
    return () => el.removeEventListener('sheetpane-load', open);
  }, [tab.sheet, tab.base]);
  const plugins = tab.plugins ? { plugins: tab.plugins } : {};
  const rules = tab.rules ? { rules: rulesDoc, flagging: 'off' as const } : {};
  return (
    <div className="pair" role="tabpanel" data-tab={tab.id} aria-labelledby={`tab-${tab.id}`} hidden={hidden}>
      <sheetpane-excel ref={sheet} pane={`gallery-${tab.id}`} mode="edit" author="Demo reviewer" theme={theme} src={tab.src ?? showcase} {...plugins} {...rules} />
      <sheetpane-errors pane={`gallery-${tab.id}`} author="Demo reviewer" theme={theme} {...plugins} />
    </div>
  );
}

/** What the open demo shows and the attribute that turns it on, then the panels opened so far; only `active` shows. */
export function GalleryPanels({ active, opened, theme }: { active: string; opened: ReadonlySet<string>; theme: Theme }) {
  const tab = TABS.find((t) => t.id === active);
  return (
    <>
      {tab?.blurb && (
        <p className="blurb">
          <code>{tab.rules ? 'rules · flagging="off"' : `plugins="${tab.plugins ?? ''}"`}</code>
          <span>{tab.blurb}</span>
        </p>
      )}
      {TABS.filter((t) => t.id !== 'review' && opened.has(t.id)).map((t) => <Panel key={t.id} tab={t} hidden={t.id !== active} theme={theme} />)}
    </>
  );
}
