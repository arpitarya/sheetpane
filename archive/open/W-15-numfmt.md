---
type: Handoff
name: W-15
description: "Arpit asked on 2026-10-18 for number formats as a separate package; this item builds the plugin on the `format` hook."
item: W-15
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-15 — Build `@sheetpane/numfmt`: every Excel number format, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Wrap the `numfmt` library behind the `format` hook | currency, fractions, `[h]:mm`, conditional sections, locales — every format Excel can store | ✅ |
| 2 | Honour the 1904 date system ourselves (the library does not) | Mac-origin workbooks show the right dates | ✅ |
| 3 | Ship the UI: a format dropdown and ± decimals in `format-row`, the raw value in `cellbar` | a reviewer can read and fix a formatted cell | ✅ |
| 4 | Compare against the core subset on the fixture set | the reopen-trigger: >1/100 cells differ | ✅ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Sonnet — one hook, one engine, a fixture table; the judgment was spent in the verdict.

## Goal

A plugin that replaces the core's small number-format subset with the full ECMA-376 format grammar through the [`numfmt`](https://www.npmjs.com/package/numfmt) library (4.0.1, MIT, zero dependencies). When installed, `text` for every numeric cell comes from it; when absent, nothing changes.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/numfmt/` builds to ESM with `.d.ts`; `numfmt` pinned exactly; `@sheetpane/grid` a peer at the lockstep version; `./ui` entry | ✅ ESM + `.d.ts`; `numfmt` pinned `4.0.1`; grid a peer; `./ui` entry; imports in Node; the headless entry never imports the UI — `package.test.ts` |
| 2 · format | `format(cell)` returns the library's text for every built-in id and custom format string in `numFmts`; `General` follows Excel's 11-significant-digit rule; the 1904 system is applied before the library sees the serial | ✅ every built-in id and 50 custom codes through load → `text`; General's 11-character rule; 1904 shifted by 1,462 days before the library sees a date serial — `format.test.ts` |
| 3 · fallback | a format the library rejects returns the core subset's text, and the cell is counted in `sheetpane-load`'s detail | ✅ with a deviation: a rejected code returns nothing, so the core subset's text shows, and the cell is counted in `fallbacks()`; not in `sheetpane-load`'s detail — a plugin cannot add to a core event (B-032) |
| 4 · ui | `format-row`: a dropdown (General · Number · Currency · Accounting · Date · Time · Percentage · Fraction · Scientific · Text · Custom…) and ± decimals; applying one is a change of kind `numFmt`; `cellbar` shows the raw value while editing | ✅ `format-row` dropdown (11 categories) and ± decimals; a choice is one `numFmt` undo step for the selection (`setChanges`); the cell bar shows the raw value — `ui.test.ts` |
| 5 · export | `exportPatch` adds new `numFmts` entries and `cellXfs` rows, deduplicated, and repoints each changed cell's `s` | ✅ deduplicated `<numFmt>` and `<xf>` entries appended, each changed cell's `s` repointed; read back by `@sheetpane/import` — `export.test.ts` |
| 6 · locale | the element's `lang` (or the document's) picks the library locale; the fixtures include `de-DE` and `en-IN` | ✅ the element's page `lang` (or an option) picks the locale; `de-DE` and `en-IN` covered — `locale.test.ts` |
| 7 · tests | a fixture table of (value, format, expected) from Excel for every built-in id and 40 custom formats; the subset-vs-library comparison over the W-13 fixture set | ✅ a table of every built-in id and 50 custom codes with values per Excel's documented output; the subset-vs-library comparison (it found five subset bugs: two fixed, three recorded in SR-IMPORT) — 42 tests; **values captured from Excel itself moved to W-30** |
| 8 · record | a component record (next free from `0101`); Ownership rows for `packages/numfmt/` | ✅ [SR-NUMFMT](../../records/0109_NUMFMT.md) (0109); Ownership `packages/numfmt/` → SR-NUMFMT |
## Blockers

None.

## Record affected

**[SR-NUMFMT](../../records/0109_NUMFMT.md)** — written by this item.

## Hazards

- **The library has no 1904 support** — we shift the serial by 1,462 days before calling it.
- **Accounting formats** use `_` and `*` padding that HTML collapses; render with `white-space: pre` in the cell.
- **`numfmt` is one of two runtime dependencies in the whole project** (the other is IronCalc). L2's licence check (B-008) must cover it.

## Reference

- Design: [`../reference/design/boards/Plugin-Numfmt.dc.html`](../reference/design/boards/Plugin-Numfmt.dc.html) — the format menu, ± decimals, the raw value in the cell bar, "Changed · was General", and View
- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `format` hook
- [`../compare/xlsx-csv-reading.compare.md`](../compare/xlsx-csv-reading.compare.md) decision 2 — the subset this replaces
- [numfmt](https://github.com/borgar/numfmt)
- [W-14](W-14-plugin-host.md) · W-13 (closed — [SR-IMPORT](../../records/0104_IMPORT.md))

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-15 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   work/compare/plugins.compare.md and this file (work/open/W-15-numfmt.md).
2. Plan the modules and the fixture list in this file's body before writing code.
3. Implement. Implement packages/numfmt/src/index.ts (the hook) and src/ui.ts (the descriptors). Build the fixture table from real Excel output, not from the library's own tests.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
