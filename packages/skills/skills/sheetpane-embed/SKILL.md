---
name: sheetpane-embed
description: Use when placing <sheetpane-excel> and <sheetpane-errors> on a page - tab or pop-up, linking them by pane, giving the sheet a height, the host's font. Not for React specifics (sheetpane-react) or loading and saving files (sheetpane-load-export).
license: MIT
metadata:
  audience: host
---

# Embedding the sheet and the errors panel

Two custom elements share **one in-memory workbook per `pane` id**
([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md)
decision 1). Whatever one shows, the other shows — that is a law
([SR-LAW-7](https://github.com/arpitarya/sheetpane/blob/main/records/0009_LAW-7-surfaces-always-in-sync.md)),
not something the host wires up.

## As a command: `/sheetpane-embed [framework]`

The argument: **$ARGUMENTS** (in a tool that does not fill that in, it is the
text typed after the command) — `html`, `react`, `vue`, `angular`, `svelte`,
`solid` or `next`; with none, read the app's `package.json`. Then: install as
[sheetpane-setup](../sheetpane-setup/SKILL.md) says; for React follow
[sheetpane-react](../sheetpane-react/SKILL.md), for the others
[sheetpane-frameworks](../sheetpane-frameworks/SKILL.md); place the sheet and
the errors list as below, on the page the user names (ask if none); run the
app's build or tests and say what you changed.

## The decision

| the host wants | write | spec |
|---|---|---|
| the sheet inside a page, a tab or a panel | `<sheetpane-excel>` — `display="tab"` is the default and fills its container | SR-GRID decision 14 |
| the sheet in a modal dialog | `<sheetpane-excel display="popup">`, shown by `open` | SR-GRID decision 14 |
| the review list beside it, in a side column, or in another tab | `<sheetpane-errors>` with the **same `pane`** | [SR-ERRORS](https://github.com/arpitarya/sheetpane/blob/main/records/0106_ERRORS.md) decisions 1–2 |
| read-only sign-off list | `<sheetpane-errors readonly>` | SR-ERRORS decision 7 |
| one sheet, nothing linked | omit `pane` — the element gets its own workbook | SR-GRID decision 1 |
| open the file at a cell | `ref="Data!F9"` (a cell or range, sheet optional) | SR-GRID decision 11d |
| a reload or a shared URL lands on the same cell; *Copy link* | `link="hash"` — off by default | SR-GRID decision 11d |

## Example — sheet and errors, side by side

```html
<script type="module">import '@sheetpane/grid';</script>

<div style="display:flex; gap:16px; height:640px">
  <sheetpane-excel pane="q3" src="/files/q3.xlsx" mode="edit" author="Asha" style="flex:1; min-width:0"></sheetpane-excel>
  <sheetpane-errors pane="q3" author="Asha" style="width:340px"></sheetpane-errors>
</div>
```

- **`pane`** is any string; the same string on both links them. Mount order
  does not matter, and they may live in different containers, tabs or
  dialogs.
- **`mode`** is `view` (default) or `edit`; `author` is written on errors
  flagged from that element.

## Pop-up

```html
<button id="open">Review file</button>
<sheetpane-excel id="sheet" pane="q3" display="popup" mode="edit"></sheetpane-excel>
<script type="module">
  const excel = document.getElementById('sheet');
  document.getElementById('open').onclick = () => { excel.open = true; };
  excel.addEventListener('sheetpane-close', () => { /* Esc or the close button: focus is already back */ });
</script>
```

Closing (Esc or the close button) removes `open`, fires `sheetpane-close` and
returns focus (SR-GRID decision 14). In React, mirror it into state from
`onsheetpane-close`, or the next `open={true}` is not a change.

## Opening at a cell, and links

```html
<sheetpane-excel pane="q3" src="/files/q3.xlsx" ref="Data!F9" link="hash"></sheetpane-excel>
```

- **`ref`** is the selection once the file is read, scrolled into view; set
  later, it selects then. A ref naming no cell warns `SP-3019` and opens at
  A1. **In React, Vue and Solid `ref` is the framework's** — the typings
  leave it out: `ref={(el) => el?.setAttribute('ref', 'Data!F9')}`, or call
  `select(sheet, ref)` from `sheetpane-load`.
- **`link="hash"`** keeps the selection in the fragment as
  `sheetpane=<pane>:<Sheet>!<ref>`, touching nothing else in it: a hash
  router's path keeps its place (`#/reports/12?sheetpane=q3:Data!F9`). It
  is written with `replaceState` (no history entry, no `hashchange` for the
  router) and read on load, back and forward; a link wins over `ref`.
  *Copy link* joins the cell menu. One `pane` per sheet when a page has two.
- The fragment is never sent to a server
  ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md)
  decision 11d).

## Height

The sheet's root is `height: 100%` with a 320 px minimum
([`excel/styles.ts`](https://github.com/arpitarya/sheetpane/blob/main/packages/grid/src/excel/styles.ts)):
**give the element a definite height** — a fixed `height`, a flex or grid
child with a sized parent, or `calc(100vh - …)`. The errors panel has a
240 px minimum. Only the visible rows are drawn (SR-GRID decision 11), so the
element's height, not the file's size, decides what is on screen.

## Font

**sheetpane ships no font and names none.** It renders in the browser's
default, or in whatever font the host sets on the element or any ancestor,
and follows a change at once
([SR-LAW-5](https://github.com/arpitarya/sheetpane/blob/main/records/0007_LAW-5-host-font.md);
SR-GRID decision 15). Set your app's font where you already set it; do not
try to style inside the shadow root. A workbook's own font family is never
used for display.

## Several sheets on one page

Use a different `pane` per file. Two sheets on the **same** `pane` show the
same workbook (a second view, e.g. a pop-up of the tab you already have);
selection and mode are shared, scroll and zoom are per element (SR-GRID
decision 2).

## Pitfalls

- **Different `pane` strings, or one element without `pane`** — the panel
  stays empty. Check both attributes first.
- **Flag issue opens the form in `<sheetpane-errors>`** when one is
  connected to the pane, else inline in the sheet (SR-GRID decision 13).
  Hiding the panel with `display:none` keeps it connected; remove it from the
  DOM if you want the inline form.
- **`flagging="off"`** turns flagging off entirely — see
  [sheetpane-rules-file](../sheetpane-rules-file/SKILL.md).
- **Sandboxed iframe:** Download needs `allow-downloads`
  ([SR-DOWNLOAD](https://github.com/arpitarya/sheetpane/blob/main/records/0101_DOWNLOAD.md)
  Consequences).
- A page with unsaved changes warns on `beforeunload` (SR-GRID decision 16).

## Related

[sheetpane-load-export](../sheetpane-load-export/SKILL.md) ·
[sheetpane-errors](../sheetpane-errors/SKILL.md) ·
[sheetpane-theming](../sheetpane-theming/SKILL.md) ·
[sheetpane-a11y](../sheetpane-a11y/SKILL.md)
