// validate: the file's notes and threaded comments as read-only `file` notes
// in the error store (W-22 DoD 2). One draft per commented cell — the store
// keys plugin errors by plugin, sheet, range and type — so a thread's replies
// fold into its message, one line per entry, each line led by its author.
import type { ErrorDraft, PluginContext } from '@sheetpane/grid';
import { parseCellRef } from './xml.js';

type Sheet = PluginContext['book']['sheets'][number];
type Thread = Sheet['threadedComments'][number];

const BLANK = '(blank)';

/** `R. Mehta: text` — unless the text already leads with the name, as Excel's notes do (`R. Mehta:\ntext`). */
function signed(name: string, text: string): string {
  const t = text.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  if (!name) return t;
  return t.startsWith(`${name}:`) ? t : `${name}: ${t}`;
}

const order = (a: string, b: string) => {
  const p = parseCellRef(a), q = parseCellRef(b);
  if (!p || !q) return p ? -1 : q ? 1 : a.localeCompare(b);
  return p.row - q.row || p.col - q.col;
};

/**
 * The drafts for one sheet. `ours` holds the thread ids this plugin writes for
 * the review now in the store — a file exported from this review and loaded
 * again does not list those threads twice.
 */
export function readComments(sheetName: string, ctx: PluginContext, ours: ReadonlySet<string>): ErrorDraft[] {
  const sheet = ctx.book?.sheets.find((s) => s.name === sheetName);
  if (!sheet) return [];
  const persons = new Map(ctx.book.persons.map((p) => [p.id, p.displayName]));
  const byRef = new Map<string, string[]>();
  const add = (ref: string, line: string) => {
    const p = parseCellRef(ref);
    if (!p || !line) return;
    const k = ref.replace(/\$/g, '').toUpperCase();
    (byRef.get(k) ?? byRef.set(k, []).get(k)!).push(line);
  };

  // Threads: each root, then its replies in file order.
  const tcs = sheet.threadedComments;
  const ids = new Set(tcs.map((t) => t.id));
  const isRoot = (t: Thread) => !t.parentId || !ids.has(t.parentId);
  const line = (t: Thread) => signed(persons.get(t.personId) ?? '', t.text);
  for (const root of tcs.filter(isRoot)) {
    const replies = tcs.filter((t) => t.parentId === root.id && !ours.has(t.id));
    const lines = ours.has(root.id) ? replies.map(line) : [line(root), ...replies.map(line)];
    for (const l of lines) add(root.ref, l);
  }
  // Notes — except the placeholder Excel writes for every thread (author `tc={id}`).
  for (const n of sheet.notes) if (!/^tc=/.test(n.author)) add(n.ref, signed(n.author, n.text));

  return [...byRef.keys()].sort(order).map((ref) => ({
    sheet: sheetName, range: ref, type: 'comment', severity: 'note', author: 'file',
    found: ctx.store.original(sheetName, ref).text || BLANK, expected: '',
    message: byRef.get(ref)!.join('\n'), status: 'open',
  }));
}
