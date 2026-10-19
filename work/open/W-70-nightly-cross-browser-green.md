---
type: Handoff
name: W-70
description: "Claude Code, 2026-10-19: the nightly Firefox + WebKit run (`just test-browsers`) has never been green — make it pass without weakening an assertion."
item: W-70
filed: 2026-10-19
filed_by: "Claude Code (claude-opus-5-5), after the 0.4.0 release"
updated: 2026-10-19
updated_by: "Claude Code (claude-opus-5-5)"
ball: agent
---

# W-70 — The nightly Firefox and WebKit run, green

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Reproduce each failure locally in WebKit (`SP_BROWSERS=webkit`) and, for Firefox, through `gh workflow run nightly` (Firefox does not start on the Mac — `work/MACHINE.md`) | each failure understood, engine by engine | ⏳ |
| 2 | Fix the test where the engine only words a value differently (font-family quoting); fix the code where the behaviour differs (paste, Delete over a range, text measurement, an axe violation) | the same behaviour in every engine | ⏳ |
| 3 | Nightly green on `main` | cross-browser regressions are caught the night they land | ⏳ |

## Goal

`.github/workflows/nightly.yml` runs the browser suites in Chromium, Firefox and WebKit. It has never passed: run 39225723693 (on `a95fc33`, before W-50–W-69 merged) and the run of 2026-10-18 both failed. CI (`ci.yml`) runs Chromium only, so the gap is invisible day to day.

**Failures seen (run 39225723693):**

- **grid (Firefox):** `events.test` — paste asks `beforechange` once per cell (got `['B3']`, expected B3, C3, B4, C4); `excel.test` — host font (`Courier New, monospace` vs `"Courier New", monospace`); `resize.test` — fit to data (71 vs 64 px); `rules-file.test` — the document's notes (order or content of 8 notes); `selection.test` — Delete clears a range, one pasted value fills a range (`[null, null, null, 21]` vs `[7, 7, 7, 21]`).
- **grid (WebKit):** the host-font quoting; `hidden.test` — an axe violation with hidden parts; `resize.test` fit (71 vs 64); `rules-file.test` notes.
- **testing (Firefox):** `dom.test` — paste writes tab-separated rows (`['', 'Inactive']` vs `['X1', 'Inactive']`).

The paste and range failures share a cause worth finding first: Firefox's synthetic clipboard/paste event path in the tests or in the grid.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · reproduce | every failure above reproduced or shown fixed since (W-50–W-69 merged after that run); a fresh nightly run's list | ⏳ |
| 2 · fix | each fixed at its cause: a test that compares an engine's spelling of the same value normalises it; a behaviour difference is fixed in the package, with its record updated | ⏳ |
| 3 · green | `gh workflow run nightly` passes on `main` | ⏳ |
| 4 · docs | SR-TESTING (or SR-BUILD decision 6) notes any per-engine allowance; `work/MACHINE.md` if a local-only quirk is found; CHANGELOG *Fixed* | ⏳ |

## Blockers

None.

## Record affected

SR-GRID (paste, range Delete, fit to data — if behaviour changes) · SR-TESTING (the DOM driver's paste) · SR-BUILD decision 6 (the nightly).

## Hazards

- **Never weaken an assertion to pass:** a pixel budget that differs by engine is measured per engine and recorded, not widened blindly.
- Firefox does not launch locally (Playwright 1.64.1 on macOS 27 — `work/MACHINE.md`); iterate through the nightly workflow.

## Reference

- Nightly runs: 39225723693 (2026-10-19), 39124283729 (2026-10-18).
- `.github/workflows/nightly.yml`, `just test-browsers`, `vitest.config.ts` (`SP_BROWSERS`).

## The prompt to paste

```text
Build W-70 in arpitarya/sheetpane. Read CLAUDE.md, work/INTERVIEW.md, then
work/open/W-70-nightly-cross-browser-green.md and every record it names. Run
`gh workflow run nightly` first for today's failure list. Work through the
Definition of done in order. Update the records, OPEN-WORK.md,
IMPLEMENTATION.md, CHANGELOG.md, WORKLOG.md and NOW.md in the same change.
Close by moving the file to archive/open/.
```
