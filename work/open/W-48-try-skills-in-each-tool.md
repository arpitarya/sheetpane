---
type: Handoff
name: W-48
description: "Arpit, 2026-10-18: trying the @sheetpane/skills package in Claude Code, Kiro and Codex is his to do later, as its own item (split from W-35 DoD 8, which no longer blocks W-35)."
item: W-48
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: arpit
---

# W-48 — Try the skills in Claude Code, Kiro and Codex

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Arpit packs the packages (`just demo-packed` builds the tarballs), makes a scratch host app and runs `npx sheetpane-skills install --all` | the skills where each tool looks for them | ⏳ Arpit, when convenient |
| 2 | One real prompt per tool: *"embed sheetpane in a React tab with an errors panel"* | proof each tool picks the right skill and writes working code | ⏳ |
| 3 | Write the prompt, the tool and its version, which skill it used, and whether the result ran, in the table below | a record of what was tried | ⏳ |
| 4 | Anything that misfired becomes a fix item (a description that didn't trigger, a wrong API name) | the skills improve from real use | ⏳ |

**Arpit, 2026-10-18:** *"The testing of skills create a separate work item for it. I'll do it later on. Do not block work item 35 for it. It is going to work. 80% it is going to work."*

**Model:** NONE for steps 1–3 (Arpit's machine, his Kiro and Codex sign-ins); Sonnet for any fix item from step 4.

**Also to try (W-45, 2026-10-18):** the Claude Code plugin with `claude --plugin-dir plugins/sheetpane` (or `/plugin marketplace add arpitarya/sheetpane`) — a skill fires, the MCP server answers, editing a `*.rules.json` runs the check — and the Kiro and Codex rules hooks after `npx sheetpane-skills install`.

## Goal

Confirm on real tools that the shipped skills, entry files and MCP entry are found and used. W-35 shipped without this check, on the decider's ruling.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · Claude Code | installed, prompt run, skill picked, result noted | ⏳ |
| 2 · Kiro | the same | ⏳ |
| 3 · Codex | the same | ⏳ |
| 4 · follow-ups | each misfire filed as its own `W-nn`, or "none" | ⏳ |

### Results

| tool | version | prompt | skill used | result |
|---|---|---|---|---|
| Claude Code | | | | |
| Kiro | | | | |
| Codex | | | | |

## Blockers

None. The decider's own time.

## Record affected

**No SR affected** unless a misfire changes a skill; then [SR-SKILLS](../../records/0116_SKILLS.md).

## Hazards

- **Install from the tarballs, not the workspace**, so the test sees what npm users get.
- **Codex's skill list is budgeted** (≈ 8,000 chars by default); if a skill isn't picked, check whether its description made the list.

## Reference

- [W-35](../../archive/open/W-35-agent-skills-package.md) — the package; its DoD 8 moved here
- [SR-SKILLS](../../records/0116_SKILLS.md)
