---
type: Handoff
name: W-71
description: "Arpit, 2026-10-20: the README made consumer- and marketing-grade, plus the files a public repo needs."
item: W-71
filed: 2026-10-20
filed_by: "Arpit (Cowork, Opus 5.5)"
updated: 2026-10-20
updated_by: "Arpit (Cowork, Opus 5.5)"
ball: agent
---

# W-71 — Finish the README and the public-repo files

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Check the README against npm, the playground and 0.5.0 in a real browser | the landing page says only what is true today | ✅ 2026-10-20 |
| 2 | Add a plain-words section, who it is for, a roadmap and an FAQ; drop the stale "0.1.0 is about to ship" note | a page that sells and answers the first questions | ✅ 2026-10-20 |
| 3 | Write `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` | a repo a consumer can trust and contribute to | ✅ 2026-10-20 |
| 4 | Place the `.github/` issue and PR templates (file issue, bug, feature, PR) | structured reports, and the README's `?template=` links work | 🔴 decider places them — `.github/` is protected from remote writes |

**Arpit, 2026-10-20:** *"i like the files that got created for codelaw add/create/update similar kind of file for sheetpane and fux"*

**Model:** Opus — public copy whose accuracy against the published packages is the deliverable.

## Definition of done

- The README's three-line snippet runs against `@sheetpane/grid@0.5.0` from npm (done: Chromium, `sample.xlsx` + `holdings.rules.json`, four errors listed, only the `src` and `rules-src` GETs made).
- Roadmap rows match `OPEN-WORK.md` and `BACKLOG.md`.
- The four templates are in `.github/` (the decider).

**Closes when** the decider has placed the templates sent in the 2026-10-20 session.

**Record affected:** SR-WORK-REGISTRY §3 (rows for the three new docs; README and CHANGELOG bumped). No other SR affected.
