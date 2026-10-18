---
type: Handoff
name: W-66
description: "Arpit, 2026-10-19: a `ref` attribute (`Sheet!B4`) for the first selection, an opt-in URL binding, and *Copy link* on a cell — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-66
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-66 — Open straight at a cell: a `ref` attribute and opt-in links in the URL

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `ref` attribute: the selection after load, scrolled into view | a host opens at the right place | ⏳ |
| 2 | `link="hash"`: read and write a namespaced fragment, `#sheetpane=<pane>:<Sheet>!<ref>`, off by default | links survive a reload and can be shared | ⏳ |
| 3 | *Copy link* beside *Copy ref* in the cell menu when `link` is on | a reviewer can send a cell | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 3 — a workbook's life over time.** **Where it lives:** **Existing package — core `@sheetpane/grid`.**

**Model:** Sonnet: an attribute and an opt-in URL binding.

## Goal

A `ref` attribute (`Sheet!B4`) for the first selection, an opt-in URL binding, and *Copy link* on a cell.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite)'s report.html names the cell behind every finding; *open F9* should land on F9 in the app.

**Why here and not elsewhere:** Selection is core state; the URL binding is an element behaviour.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · attribute | `ref` typed; invalid ref → SP warning, A1 | ⏳ |
| 2 · hash | namespaced; coexists with a host's own hash routing; back/forward | ⏳ |
| 3 · copy | menu action | ⏳ |
| 4 · tests · docs | SR-GRID; skill `sheetpane-embed`; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-GRID · SR-CODES.

## Hazards

- Hosts with hash routing (pdfsuite (arpitarya/pdf-testing-suite) W-35) — the namespace must not break their router; off by default.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-66 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-66-link-to-a-cell.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
