// W-37: `@sheetpane/grid/jsx` in React 19 — the real @types/react, the usage from examples/react.
import type {} from '@sheetpane/grid/jsx';
import type { SheetpaneError, SheetpaneExcel } from '@sheetpane/grid';
import { useRef, useState } from 'react';

export function Review({ file, src }: { file: File | null; src: string }) {
  const sheet = useRef<SheetpaneExcel>(null);
  const [, setLast] = useState('');
  const [, setReview] = useState<SheetpaneError[]>([]);
  return (
    <>
      <sheetpane-excel ref={sheet} pane="q3" mode="edit" author="Reviewer" src={file ? undefined : src} file={file} header-row="2" theme="dark"
        flagging="off" on-invalid="block" plugins="numfmt" rules={{ version: 1, sheets: {} }} columns={{ Age: { type: 'integer', min: 18 } }}
        style={{ height: 600 }}
        onsheetpane-change={(e) => setLast(`${e.detail.sheet}!${e.detail.ref} → ${String(e.detail.now)} (${e.detail.kind})`)}
        onsheetpane-beforechange={(e) => { if (e.detail.column.header === 'Age' && Number(e.detail.now) < 0) e.preventDefault(); }}
        onsheetpane-load={(e) => { if (e.detail.status === 'error') console.log(e.detail.spCode); else console.log(e.detail.sheets.length); }}
        onsheetpane-export={(e) => console.log(e.detail.blob.size, e.detail.format)} />
      <sheetpane-errors pane="q3" author="Reviewer" readonly onsheetpane-errors={(e) => setReview(e.detail.errors)} onsheetpane-reveal={(e) => console.log(e.detail.error.id)} />
      <sheetpane-excel pane="q3" display="popup" open onsheetpane-close={() => undefined} />
      {/* W-66: `ref` stays React's; the attribute is set from a ref callback */}
      <sheetpane-excel pane="q3" link="hash" ref={(el) => el?.setAttribute('ref', 'Data!F9')} />
      {/* @ts-expect-error — `link` is `none` or `hash` */}
      <sheetpane-excel link="query" />
      {/* @ts-expect-error — not a mode */}
      <sheetpane-excel mode="write" />
      {/* @ts-expect-error — a change's detail has no `value` */}
      <sheetpane-excel onsheetpane-change={(e) => e.detail.value} />
      {/* @ts-expect-error — a reveal's detail is `{ error }` (JSX never rejects an unknown dashed name, so the payload is what is checked) */}
      <sheetpane-errors onsheetpane-reveal={(e) => e.detail.errors} />
    </>
  );
}
