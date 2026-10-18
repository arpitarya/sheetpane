---
type: Handoff
name: W-17
description: "Arpit asked on 2026-10-18 for cell styles as a separate package; this item builds the plugin on the `decorate` hook and its format row."
item: W-17
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-17 — Build `@sheetpane/styles`: fill, font weight, colour, borders, alignment, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read `styles.xml` into an allow-listed CSS subset per cell | a cell looks the way Excel saved it — colour, weight, borders, alignment | ✅ |
| 2 | Never a font family — weight, style, size, colour, decoration only (L5 ruling) | the host's font still wins | ✅ |
| 3 | Ship the format row: B I U · colour · fill · borders · align · wrap · clear; merge / unmerge | a reviewer can correct formatting, not only values | ✅ |
| 4 | Write new styles back through `exportPatch` | the exported file carries every style change (L6) | ✅ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — the L5 boundary and the format-row UX are judged by use.

## Goal

A plugin that renders and edits the subset of cell styles a reviewer needs. Without it cells are plain text and merge-and-centre is the only format (the standing ruling); with it, `decorate(cell)` returns an allow-listed `StyleSubset` and the format row appears in Edit.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/styles/` builds to ESM, no runtime dependency; `@sheetpane/grid` a peer; `./ui` entry | ✅ ESM + `.d.ts`, no runtime dependency, grid a peer, `./ui` entry; the headless entry never imports the UI |
| 2 · decorate | `decorate(cell)` from `cellXfs` → `fonts`, `fills`, `borders`, `alignment`, with theme and indexed colours resolved; the subset is `background-color`, `color`, `font-weight`, `font-style`, `font-size`, `text-decoration`, `text-align`, `vertical-align`, `white-space`, `border-*`; nothing else, and **never `font-family`** | ✅ `cellXfs` → fonts, fills, borders, alignment; theme (with tint) and indexed colours resolved; only the allow-listed subset, never `font-family` (test over every result + the L5 veto over the package); the core now shows `text-align`, `vertical-align` and wrap (cells hold a text span — SR-GRID 15b) |
| 3 · merges | merge / unmerge controls (`selbar` and `format-row`) produce changes of kind `merge`; the core still renders merges without this plugin | ✅ Merge/Unmerge on `selbar` and `format-row` call the core's `setMerge` (kind `merge`), labelled by state, disabled on a CSV or one unmerged cell; the core renders merges without the plugin |
| 4 · ui | `format-row` groups `text` · `colour` · `fill` · `border` · `align` · `wrap` · `clear`; `selbar`: Bold and Fill; every control toggles a change of kind `style` on the selection; the row is absent in View; the format-row states — hover, pressed, active, disabled, keyboard focus, light and dark — are drawn once on the Plugin-Styles board and every plugin control reuses them; every tooltip names its shortcut | ✅ `format-row` groups text · colour · fill · border · align · wrap · clear; `selbar` Bold · Fill · Merge; each action one `style` change per cell; absent in View; buttons' `title` and `aria-label` name the shortcut; the states — hover, pressed, disabled, focus — come from the core's one control style, themed light and dark by W-29's tokens |
| 5 · undo | every style change is undoable through W-23; the row does not ship before W-23 lands | ✅ every action is one undo step through W-23 (`setChanges`) — tests |
| 6 · export | `exportPatch` appends deduplicated `<font>`, `<fill>`, `<border>` and `<xf>` entries and repoints `s` on every changed cell; untouched cells keep their original `s` | ✅ deduplicated `<font>`, `<fill>`, `<border>`, `<xf>` appended, `s` repointed, missing `<c>`/`<row>`/`styles.xml` added; untouched cells keep `s`; no change → byte for byte — tests |
| 7 · a11y | colour is never the only carrier of a sheetpane state (changed, flagged) on a coloured cell — the corner mark and pins keep their contrast | ✅ the changed mark keeps 3:1 against every default fill (test) and carries a cell-coloured outline; state tints sit above a fill, never replace it (core, SR-GRID 15b) |
| 8 · tests | a fixture of every fill, font and border combination saved by Excel, rendered and compared property by property; the L5 veto command stays clean over the package; a round-trip of a style edit | ✅ with a deviation: the ExcelJS fixture and hand-made `styles.xml` for every fill, font and border kind, compared property by property; the L5 veto; a style-edit round-trip — 46 tests; **a fixture saved by Excel moved to W-30** |
| 9 · record | a component record; Ownership rows for `packages/styles/` | ✅ [SR-STYLES](../../records/0110_STYLES.md) (0110); Ownership `packages/styles/` → SR-STYLES |
## Blockers

None. An Excel-saved fixture is W-30.

## Record affected

**[SR-STYLES](../../records/0110_STYLES.md)**; the core gaps it found landed in SR-GRID (decisions 3, 15, 15b, 19).

## Hazards

- **L5.** The plugin may set size and weight because the decider ruled it (verdict decision 9); a `font-family` in any output is a registration error, and the package's own CSS names none.
- **Theme colours** come from `theme1.xml`; the reader must expose it (W-13 grows).
- **A mini-Excel is one row away.** The format row holds only the groups above; anything more is a ruling.

## Reference

- Design: [`../reference/design/boards/Plugin-Styles.dc.html`](../reference/design/boards/Plugin-Styles.dc.html) — the format row's groups, selbar Bold · Fill · Merge, file styles, and the states table
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `decorate`, decision 9
- [SR-LAW-5](../../records/0007_LAW-5-host-font.md)
- [W-14](W-14-plugin-host.md) · W-13 (closed — [SR-IMPORT](../../records/0104_IMPORT.md)) · [W-23](W-23-undo-redo.md)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-17 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-17-styles.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Build the headless decorate first and prove it on the fixture; the format row is the second half and waits for W-23.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
