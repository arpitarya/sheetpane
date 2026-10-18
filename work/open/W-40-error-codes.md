---
type: Handoff
name: W-40
description: "Arpit, 2026-10-18: every thrown error, console warning, note and refused load carries a stable code (SP-1xxx…) linked to a docs entry, so humans and agents can look it up."
item: W-40
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-40 — Stable error codes, each with a docs entry

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Give a code to every message a host can see: thrown errors, `console.warn`, `note` errors, `sheetpane-editcancel` reasons, refused loads | `SP-3012` is searchable; a sentence is not | ⏳ |
| 2 | One registry, one page: `docs/ERRORS.md`, an anchor per code with meaning, cause, fix | the message links straight to the answer | ⏳ |
| 3 | A test: every message in `src` uses a registered code; every code is documented; no code is ever reused | it stays complete | ⏳ |

**Arpit, 2026-10-18:** *"Other than codemods. File work item for everything else. Research and then file work items."* — answering the chat list (same session as [W-35](W-35-agent-skills-package.md)) of what helps a consumer beyond skills.

**Model:** Opus — touches every package's error paths; the codes become public API.

## Goal

A host or an agent sees `SP-3012: header row 2 not found — …/ERRORS.md#sp-3012` and knows what happened. Codes are permanent.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · ranges | 1xxx import · 2xxx export · 3xxx grid · 4xxx errors element · 5xxx plugins (5100 numfmt … 5800 comments) · 6xxx rules ([W-33](W-33-rules-file.md)) · 7xxx mcp | ⏳ |
| 2 · registry | `packages/export/src/codes.ts` (the leaf every package already depends on): `code → { title, severity }`; messages built by one `spError(code, detail)` helper | ⏳ |
| 3 · where codes appear | `Error.code` on thrown errors; `code` on `note` errors and on event details that carry a reason; console text starts with the code and ends with the docs link | ⏳ |
| 4 · docs | `docs/ERRORS.md`: per code — meaning, likely cause, fix, the record it comes from; generated index | ⏳ |
| 5 · check | a test scans `packages/*/src` for `throw`, `console.warn/error` and note creation without a registered code, codes without a docs entry, and codes removed from the registry (retired codes stay, marked retired) | ⏳ |
| 6 · consumers | the troubleshoot skill ([W-35](W-35-agent-skills-package.md)) and `explain_code` ([W-39](W-39-mcp-server.md)) read the registry | ⏳ |
| 7 · record | new record SR-CODES (ranges, never-reuse, the helper); SR-ERRORS for `code` on errors | ⏳ |

## Blockers

None.

## Record affected

New **SR-CODES** (next free number) · [SR-ERRORS](../../records/0106_ERRORS.md) · [SR-EXPORT](../../records/0103_EXPORT.md) (home of the registry).

## Hazards

- **Messages are asserted by text** in several suites — switch them to assert the code.
- **Bundle size:** long text lives in the docs; the registry holds titles only.
- **Concurrent sessions** edit these files; re-derive `git status` before staging.

## Research

- Precedent: Angular's `NG0xxx` runtime errors (a code plus a docs page per code) and React's numbered errors with a decoder page — both made errors searchable and stable across releases.

## Reference

- [SR-ERRORS](../../records/0106_ERRORS.md) · [W-39](W-39-mcp-server.md) · [W-35](W-35-agent-skills-package.md)

## Prompt — paste into Claude Code

```text
You are building W-40 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, every packages/*/src error path, records/0106_ERRORS.md and this file
   (work/open/W-40-error-codes.md). Check the state of: W-33, W-35, W-39.
2. Plan the code inventory (grep every throw/warn/note first) and the helper before writing code. Re-check the external formats linked under Research; note anything that changed.
3. Implement the registry, the helper, every call site, docs/ERRORS.md, the check.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS decision 10 says every task owes.
```
