---
type: Handoff
name: W-65
description: "Arpit, 2026-10-19: `read()` and `sheetpane-load` give the SHA-256 of the bytes opened; `sheetpane-export` gives the hash of the bytes handed back — Group 3 of the features pdfsuite's spec work needs from sheetpane."
item: W-65
filed: 2026-10-19
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-19
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-65 — The file's SHA-256 on load and on export

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | `read()` result and `sheetpane-load` detail gain `sha256` (hex) | provenance from the first moment | ⏳ |
| 2 | `sheetpane-export` detail gains `sha256` of the blob | the saved file is identifiable | ⏳ |
| 3 | On an insecure page `crypto.subtle` is missing: `sha256` is `undefined` with an SP warning — never a substitute hash | no false provenance | ⏳ |

**Arpit, 2026-10-19:** *"look at PDF suite and think about what all features could be needed just from Excel point of view that can be added into sheet pane … consider it built and consider it published. What else?"* — then *"do some research. What can be created as plugin? What should be part of existing packages? Classify it into those and create work items for all of these. Group 1, Group 2, and Group 3."*

**Group 3 — a workbook's life over time.** **Where it lives:** **Existing packages — `@sheetpane/import` (hash the source bytes) and core `@sheetpane/grid` (event details).**

**Model:** Sonnet: one digest on bytes the reader already holds.

## Goal

`read()` and `sheetpane-load` give the SHA-256 of the bytes opened; `sheetpane-export` gives the hash of the bytes handed back.

**Why a host needs it:** pdfsuite (arpitarya/pdf-testing-suite) W-47 DoD 4: the report records the workbook's SHA-256 and says *edited in pdfsuite* when it was; SR-SPEC-INTAKE decision 14 puts the hash in the spec JSON.

**Why here and not elsewhere:** The reader already holds the bytes; the grid owns the events.

## Research (2026-10-19)

Web Crypto's `crypto.subtle.digest('SHA-256', …)` is in every modern browser (secure contexts only) and in Node ≥ 20 as `globalThis.crypto` — no dependency.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · import | hash in `read()` | ⏳ |
| 2 · events | load and export details; typed; manifest | ⏳ |
| 3 · insecure | SP code in `docs/ERRORS.md` | ⏳ |
| 4 · tests · docs | known-vector test; SR-IMPORT, SR-GRID; CHANGELOG | ⏳ |

## Blockers

None.

## Record affected

SR-IMPORT · SR-GRID · SR-CODES.

## Hazards

- Hashing a large file once is cheap; never re-hash on every edit.

## Reference

- The classification and grouping: this item's siblings W-50 – W-69, filed together on 2026-10-19.
- The host's side: pdfsuite (arpitarya/pdf-testing-suite) — `work/open/W-46-sheet-viewer.md`, `work/open/W-47-sheet-editor.md`, `records/0101_SPEC-intake.md`, `work/design/Spec-*.dc.html`, `Sheet-Editor.dc.html`.
- The plugin contract: `packages/grid/src/plugins/types.ts` (six hooks, six slots).

## The prompt to paste

```text
Build W-65 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-65-file-fingerprint.md and every record it names. Work through the
Definition of done in order, with a test before each next row. Update the
records, OPEN-WORK.md, IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md
in the same change. Close by moving the file to archive/open/.
```
