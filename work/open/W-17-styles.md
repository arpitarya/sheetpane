---
type: Handoff
name: W-17
description: "Arpit asked on 2026-10-18 for cell styles as a separate package; this item builds the plugin on the `decorate` hook and its format row."
item: W-17
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-17 — Build `@sheetpane/styles`: fill, font weight, colour, borders, alignment, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Read `styles.xml` into an allow-listed CSS subset per cell | a cell looks the way Excel saved it — colour, weight, borders, alignment | ⏳ |
| 2 | Never a font family — weight, style, size, colour, decoration only (L5 ruling) | the host's font still wins | ⏳ |
| 3 | Ship the format row: B I U · colour · fill · borders · align · wrap · clear; merge / unmerge | a reviewer can correct formatting, not only values | ⏳ |
| 4 | Write new styles back through `exportPatch` | the exported file carries every style change (L6) | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Opus — the L5 boundary and the format-row UX are judged by use.

## Goal

A plugin that renders and edits the subset of cell styles a reviewer needs. Without it cells are plain text and merge-and-centre is the only format (the standing ruling); with it, `decorate(cell)` returns an allow-listed `StyleSubset` and the format row appears in Edit.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/styles/` builds to ESM, no runtime dependency; `@sheetpane/grid` a peer; `./ui` entry | ⏳ |
| 2 · decorate | `decorate(cell)` from `cellXfs` → `fonts`, `fills`, `borders`, `alignment`, with theme and indexed colours resolved; the subset is `background-color`, `color`, `font-weight`, `font-style`, `font-size`, `text-decoration`, `text-align`, `vertical-align`, `white-space`, `border-*`; nothing else, and **never `font-family`** | ⏳ |
| 3 · merges | merge / unmerge controls (`selbar` and `format-row`) produce changes of kind `merge`; the core still renders merges without this plugin | ⏳ |
| 4 · ui | `format-row` groups `text` · `colour` · `fill` · `border` · `align` · `wrap` · `clear`; `selbar`: Bold and Fill; every control toggles a change of kind `style` on the selection; the row is absent in View | ⏳ |
| 5 · undo | every style change is undoable through W-23; the row does not ship before W-23 lands | ⏳ |
| 6 · export | `exportPatch` appends deduplicated `<font>`, `<fill>`, `<border>` and `<xf>` entries and repoints `s` on every changed cell; untouched cells keep their original `s` | ⏳ |
| 7 · a11y | colour is never the only carrier of a sheetpane state (changed, flagged) on a coloured cell — the corner mark and pins keep their contrast | ⏳ |
| 8 · tests | a fixture of every fill, font and border combination saved by Excel, rendered and compared property by property; the L5 veto command stays clean over the package; a round-trip of a style edit | ⏳ |
| 9 · record | a component record; Ownership rows for `packages/styles/` | ⏳ |

## Blockers

Waiting on **W-14** (the `decorate` hook and `format-row`), **W-13** (style tables from the reader) and **W-23** (undo, before the format row).

## Record affected

A new component record on completion. Until then this item owns `packages/styles/`.

## Hazards

- **L5.** The plugin may set size and weight because the decider ruled it (verdict decision 9); a `font-family` in any output is a registration error, and the package's own CSS names none.
- **Theme colours** come from `theme1.xml`; the reader must expose it (W-13 grows).
- **A mini-Excel is one row away.** The format row holds only the groups above; anything more is a ruling.

## Reference

- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `decorate`, decision 9
- [SR-LAW-5](../../records/0007_LAW-5-host-font.md)
- [W-14](W-14-plugin-host.md) · [W-13](W-13-import-package.md) · [W-23](W-23-undo-redo.md)

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
