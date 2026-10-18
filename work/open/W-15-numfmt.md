---
type: Handoff
name: W-15
description: "Arpit asked on 2026-10-18 for number formats as a separate package; this item builds the plugin on the `format` hook."
item: W-15
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-fable-5-1)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-fable-5-1)"
ball: agent
---

# W-15 — Build `@sheetpane/numfmt`: every Excel number format, as a plugin

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Wrap the `numfmt` library behind the `format` hook | currency, fractions, `[h]:mm`, conditional sections, locales — every format Excel can store | ⏳ |
| 2 | Honour the 1904 date system ourselves (the library does not) | Mac-origin workbooks show the right dates | ⏳ |
| 3 | Ship the UI: a format dropdown and ± decimals in `format-row`, the raw value in `cellbar` | a reviewer can read and fix a formatted cell | ⏳ |
| 4 | Compare against the core subset on the fixture set | the reopen-trigger: >1/100 cells differ | ⏳ |

**Arpit, 2026-10-18:** *"Let's create separate packages, plugins for number format, formulas, styles. Merge cells, freeze panes, data validation, conditional formatting, images, charts, pivots, comments, notes. Decide, do some research and have them as separate packages or plugins."*

**Model:** Sonnet — one hook, one engine, a fixture table; the judgment was spent in the verdict.

## Goal

A plugin that replaces the core's small number-format subset with the full ECMA-376 format grammar through the [`numfmt`](https://www.npmjs.com/package/numfmt) library (4.0.1, MIT, zero dependencies). When installed, `text` for every numeric cell comes from it; when absent, nothing changes.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/numfmt/` builds to ESM with `.d.ts`; `numfmt` pinned exactly; `@sheetpane/grid` a peer at the lockstep version; `./ui` entry | ⏳ |
| 2 · format | `format(cell)` returns the library's text for every built-in id and custom format string in `numFmts`; `General` follows Excel's 11-significant-digit rule; the 1904 system is applied before the library sees the serial | ⏳ |
| 3 · fallback | a format the library rejects returns the core subset's text, and the cell is counted in `sheetpane-load`'s detail | ⏳ |
| 4 · ui | `format-row`: a dropdown (General · Number · Currency · Accounting · Date · Time · Percentage · Fraction · Scientific · Text · Custom…) and ± decimals; applying one is a change of kind `numFmt`; `cellbar` shows the raw value while editing | ⏳ |
| 5 · export | `exportPatch` adds new `numFmts` entries and `cellXfs` rows, deduplicated, and repoints each changed cell's `s` | ⏳ |
| 6 · locale | the element's `lang` (or the document's) picks the library locale; the fixtures include `de-DE` and `en-IN` | ⏳ |
| 7 · tests | a fixture table of (value, format, expected) from Excel for every built-in id and 40 custom formats; the subset-vs-library comparison over the W-13 fixture set | ⏳ |
| 8 · record | a component record (next free from `0101`); Ownership rows for `packages/numfmt/` | ⏳ |

## Blockers

Waiting on **W-14** (the `format` hook) and **W-13** (`numFmts` and each cell's `s` from the reader).

## Record affected

A new component record on completion. Until then this item owns `packages/numfmt/`.

## Hazards

- **The library has no 1904 support** — we shift the serial by 1,462 days before calling it.
- **Accounting formats** use `_` and `*` padding that HTML collapses; render with `white-space: pre` in the cell.
- **`numfmt` is one of two runtime dependencies in the whole project** (the other is IronCalc). L2's licence check (B-008) must cover it.

## Reference

- [`../compare/plugins.compare.md`](../compare/plugins.compare.md) — `format` hook
- [`../compare/xlsx-csv-reading.compare.md`](../compare/xlsx-csv-reading.compare.md) decision 2 — the subset this replaces
- [numfmt](https://github.com/borgar/numfmt)
- [W-14](W-14-plugin-host.md) · [W-13](W-13-import-package.md)

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
