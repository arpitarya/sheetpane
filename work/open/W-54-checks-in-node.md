---
type: Handoff
name: W-54
description: "Arpit, 2026-10-19: the same checks the pane runs on load, callable from Node and workers with no DOM, giving the same errors — Group 1 of the features pdfsuite's spec work needs from sheetpane."
item: W-54
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-54 — Run the rules file, column rules and the workbook's validation in Node, with no page

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Split the DOM-free rule engine (`pane/rules.ts`) and the validation evaluator from the elements | one engine, two entry points | ⏳ |
| 2 | `check(book, { rules, columns, plugins })` returns the `SheetpaneError[]` the pane would hold after load | a CLI gets the browser's answer | ⏳ |
| 3 | Parity test on every `@sheetpane/fixtures` workbook: pane in a browser vs `check` in Node, deep-equal | proof, not a promise | ⏳ |
| 4 | `@sheetpane/mcp` uses the same entry | no third copy | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 1 — the host's review flow cannot work without it.** **Where it lives:** **Existing packages — new sub-path entries `@sheetpane/grid/check` and `@sheetpane/validation/check`.**

**Model:** Opus: it splits engine code from the element without changing a single result, and proves it with parity.

## Goal

The same checks the pane runs on load, callable from Node and workers with no DOM, giving the same errors.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) L3: the UI and the CLI run the same functions. `pdfsuite spec --validate-only` must produce the tab's validation without a browser.

**Why here and not elsewhere:** It is the same code the browser runs, so it stays in the packages that own it; a separate package would be a second copy. Importing the grid today registers custom elements, so Node needs a DOM-free entry.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · entries | `@sheetpane/grid/check`, `@sheetpane/validation/check` in `exports`; typed; TSDoc | ⏳ |
| 2 · no DOM | a test walks each entry's import graph: no `customElements`, `document`, `window` | ⏳ |
| 3 · parity | browser vs Node deep-equal on every fixture (ids and timestamps excluded) | ⏳ |
| 4 · mcp | the MCP server's rules tools call `check` | ⏳ |
| 5 · docs | skills `sheetpane-setup`, `sheetpane-backend`; SR-BUILD exports table; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-GRID · SR-VALIDATION · SR-BUILD (package exports) · SR-MCP.

## Hazards

- Column rules take host functions (`validate(ctx, signal)`) — the Node entry must accept the same signature.
- Async regex/timeout slicing in the browser must give identical results in Node.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-54 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-54-checks-in-node.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
