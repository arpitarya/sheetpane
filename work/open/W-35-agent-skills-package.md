---
type: Handoff
name: W-35
description: "Arpit asked on 2026-10-18 for a new package, @sheetpane/skills, carrying the whole agent-facing set for Claude, Kiro and Codex — 23 skills plus each tool's entry files — that grid, export, import and the plugins depend on."
item: W-35
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Claude Code, claude-opus-5-5)"
ball: agent
---

# W-35 — `@sheetpane/skills`: how to use sheetpane, for Claude, Kiro and Codex

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Create `packages/skills` — files only, no runtime code — and make every other package depend on it | installing any sheetpane package brings the agent docs along, at the same version | ⏳ |
| 2 | Write 23 skills in the one `SKILL.md` format all three tools read | one copy of each skill, three tools served | ⏳ |
| 3 | Add each tool's entry files: a `CLAUDE.md` block, an `AGENTS.md` block, a Kiro steering file, agent files | each tool knows the skills exist and when to reach for them | ⏳ |
| 4 | Ship an `install` command that copies them into the host repo's `.claude/`, `.kiro/` and `.agents/` folders | none of the three tools reads `node_modules`; this puts the files where they look | ⏳ |
| 5 | A check that every API name in every skill exists in the packages' exports | the skills can't drift from the code | ⏳ |

Skills 17–23 added the same day (*"File work item for everything else"*).

**Arpit, 2026-10-18:** *"Research and create a work item for all the skills listed here. Not just version one, even for should have, later, and the additional ones … all these skills will be part of a new package, a separate package … grid, export, import, all of them are going to use this package as a dependency."*
Scope answers, same session: **the whole agent-facing set** (not skills alone); **ship the two contributor skills in the package too.**

**Model:** Opus — 23 skills must match the records exactly, and the installer writes into other people's repos.

## Goal

`@sheetpane/skills` is a leaf package of Markdown and one Node CLI. Every sheetpane package lists it in `dependencies`, at the lockstep version. A host runs one command and its Claude, Kiro and Codex agents know how to embed, load, export, review, rule, theme, test and extend sheetpane — from the same text, cited back to the records.

## Research — how the three tools find these files

| | Claude Code | Kiro | Codex |
|---|---|---|---|
| repo skills folder | `.claude/skills/<name>/SKILL.md` (also every parent up to the repo root; nested folders load when a file there is touched) | `.kiro/skills/<name>/SKILL.md` (workspace beats global `~/.kiro/skills`) | `.agents/skills/<name>/SKILL.md` (every folder from CWD up to the repo root) |
| required frontmatter | none; `description` recommended | `name` (= folder name, ≤ 64 chars, `a-z0-9-`) and `description` (≤ 1,024) | `name` and `description` |
| loading | name + description at start; full file on use; `description` + `when_to_use` cut at 1,536 chars in the listing | name + description at start; full file on activation; `references/` on demand | name, description and path at start — whole list capped at ~2 % of context (8,000 chars default) |
| size advice | `SKILL.md` under 500 lines; detail in separate files | keep `SKILL.md` focused; detail in `references/` | `scripts/`, `references/`, `assets/` |
| entry / standing file | `CLAUDE.md` | steering files (`always` · `auto` · `fileMatch` · `manual`) | `AGENTS.md` |
| agent files | `.claude/agents/*.md` (subagents) | custom agents load **no** skills unless their `resources` list `skill://` URIs | `agents/openai.yaml` inside a skill (UI metadata, `allow_implicit_invocation`, tool dependencies) |
| reads `node_modules`? | not documented — assume no | no | no |

**What this forces:**
- **One source, the common subset:** frontmatter `name` (= folder name, `sheetpane-…`) and `description` only, plus optional `license` and `metadata`. Valid for all three.
- **Short descriptions:** ≤ 250 characters each — 23 × 250 = 5,750, leaving room in Codex's 8,000-character list for the host's own skills.
- **`SKILL.md` ≤ 200 lines;** API tables and long examples go in `references/`.
- **An installer is required.** No tool reads skills from `node_modules`. **No `postinstall`:** pnpm blocks lifecycle scripts by default, and writing into a repo without being asked is wrong.
- **The bin has to be reachable.** npm and pnpm link only direct dependencies' bins, and a host installs `@sheetpane/grid`, not `@sheetpane/skills`. So `@sheetpane/grid` also exposes `sheetpane-skills`, forwarding to the skills package.

## The package

```
packages/skills/
  package.json            name @sheetpane/skills · files: skills/, entry/, bin/ · bin: sheetpane-skills · no dependencies
  skills/<name>/SKILL.md  16 folders, + references/ and agents/openai.yaml where useful
  entry/claude.md         the block for CLAUDE.md (between <!-- sheetpane:start --> / <!-- sheetpane:end -->)
  entry/agents.md         the same block for AGENTS.md
  entry/kiro-steering.md  .kiro/steering/sheetpane.md — inclusion: fileMatch on files importing @sheetpane/*
  entry/claude-agent.md   .claude/agents/sheetpane-integrator.md — a subagent for embedding work
  entry/kiro-agent.json   a Kiro custom agent with skill:// resources for all sheetpane skills
  bin/sheetpane-skills.mjs
```

**`npx sheetpane-skills install [--claude] [--kiro] [--codex] [--all] [--skip contributor] [--dry-run] [--force]`**
- Copies the skills into each chosen tool's folder.
- Writes or refreshes only the marked block in `CLAUDE.md` and `AGENTS.md`; nothing outside the markers is touched.
- Writes the steering and agent files.
- Refuses to overwrite a changed file without `--force`; prints every path it wrote.
- `uninstall` removes exactly what `install` wrote.
- With no flag, it installs for the tools whose folders already exist.

## The 23 skills

| # | skill | covers | grounded in |
|---|---|---|---|
| 1 | `sheetpane-setup` | which packages to install; bundler import vs plain-HTML import map; the lockstep version | SR-BUILD · grid README |
| 2 | `sheetpane-embed` | tab vs pop-up (`display="popup"`, `open`); linking sheet and errors by `pane`; giving the element a height; the host's font | SR-GRID · SR-LAW-5 · SR-LAW-7 |
| 3 | `sheetpane-react` | React 19 props and `onsheetpane-…` events on custom elements; the hook recipes; `elements.d.ts` typing | W-28 · `examples/react` |
| 4 | `sheetpane-load-export` | `src` / `file` / `load()`; XLSX and CSV only; edits held in memory; the Download button; cancel `sheetpane-export` to save yourself | SR-LAW-3 · SR-LAW-6 · SR-DOWNLOAD · SR-EXPORT |
| 5 | `sheetpane-errors` | `<sheetpane-errors>`; `getErrors()` / `setErrors()` persistence; `sheetpane-errors` and `sheetpane-reveal`; error types | SR-ERRORS |
| 6 | `sheetpane-events` | the edit events in order; refusing with `sheetpane-beforechange` | SR-GRID · grid README §Following an edit |
| 7 | `sheetpane-plugins` | the eight plugins, what each adds, the `plugins` attribute, peers (condfmt→styles, charts→images), `createWorkbook({ plugins })` | the plugin records 0107–0114 |
| 8 | `sheetpane-column-rules` | `columns`, `validate`, `on-invalid`, `header-row`; the vocabulary; block vs flag | SR-GRID 22–22c |
| 9 | `sheetpane-rules-file` | the JSON rules file, its schema, `rules` / `rules-src`, `flagging="off"` | W-33 — **written after W-33 lands** |
| 10 | `sheetpane-theming` | `--sp-*` tokens, `style.css`, `theme="dark"`, slot tokens | W-29 · SR-GRID |
| 11 | `sheetpane-testing` | testing a host app: shadow DOM locators, waiting on `sheetpane-load`, reading a downloaded `.xlsx` back | `scripts/demo-check.mjs` · SR-BUILD |
| 12 | `sheetpane-troubleshoot` | blank grid (no height), SSR, CORS on `src`, refused file types, clipboard needs a secure context | `test/ssr.test.ts` · the records' Consequences |
| 13 | `sheetpane-plugin-author` | writing a plugin: the six hooks and six slots, descriptors, `selbar`, the frozen set | SR-GRID 17 · `work/compare/plugins.compare.md` |
| 14 | `sheetpane-upgrade` | reading `CHANGELOG.md`; breaking changes (e.g. W-31 removed the second download button) | `CHANGELOG.md` · `scripts/release.mjs` |
| 15 | `sheetpane-file-work-item` *(contributor)* | filing a `W-nn`: the next id, the file shape, the OPEN-WORK row and its ball, WORKLOG, NOW, re-deriving `git status` | SR-WORK-OPEN-QUEUE · `work/open/README.md` · SR-WORK-SESSION |
| 16 | `sheetpane-records` *(contributor)* | the SR records: laws, ownership, the commit guard, where a rule lives, archive-not-evidence | SR-LAW-0 · SR-WORK-* · `records/README.md` |
| 17 | `sheetpane` *(router)* | which skill for which task: View vs Edit, tab vs pop-up, column rules vs rules file vs the validation plugin, which plugin for which feature — a decision table pointing at skills 1–23 | all of the above |
| 18 | `sheetpane-frameworks` | Vue (`isCustomElement`), Angular (`CUSTOM_ELEMENTS_SCHEMA`), Svelte, Solid, Next.js (client-only import); the typed entries | [W-37](W-37-custom-elements-manifest.md) · [W-43](W-43-create-sheetpane.md) |
| 19 | `sheetpane-backend` | the server round trip: upload the exported blob, store the review JSON, restore with `setErrors()` after `sheetpane-load`, conflict when the file changed | SR-ERRORS · SR-LAW-6 · SR-LAW-9 |
| 20 | `sheetpane-performance` | large files: load-time slicing, lazy-mounting tabs, what to measure; the unmeasured memory ceiling (B-026) | SR-GRID 22b · SR-LAW-9 |
| 21 | `sheetpane-security` | untrusted uploads, regex from a rules file, CSP with shadow DOM and constructed styles, no network from the grid beyond `src` | SR-LAW-6 · SR-GRID · W-33 hazards |
| 22 | `sheetpane-a11y` | the keyboard contract, focus inside a modal or tabs, labelling the host's tab, the pop-up's focus return | SR-GRID · `work/reference/specs/a11y/` |
| 23 | `sheetpane-migrate` | from SheetJS, Handsontable, AG Grid: their concepts mapped to sheetpane's elements, events and plugins; what has no equivalent (formulas UI, pivots) | the grid README · `work/proposals/pivots.md` |

Each skill: a `description` naming when to use it **and when not**; steps or a decision table; one working example; the pitfalls; a `references/` link back to the record it summarises. **A skill points to a record; it never restates a rule as its own** (SR-LAW-0).

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · package | `packages/skills` in the workspace; `@sheetpane/skills` in `dependencies` of export, import, grid and all eight plugins; it depends on nothing; `pack-check` shows only `skills/`, `entry/`, `bin/` | ✅ `packages/skills` (no dependencies, no build); a dependency of export, import, grid and the eight plugins; `pack-check` shows `skills/`, `entry/`, `bin/` and the manifest only |
| 2 · skills 1–8, 10–17, 19–23 | written to the shape above; frontmatter `name` + `description` only (± `license`, `metadata`); name = folder; description ≤ 250 chars; `SKILL.md` ≤ 200 lines | ✅ written to the shape: frontmatter `name` = folder, `description` ≤ 250 with its "not for", `license`, `metadata.audience`; every `SKILL.md` ≤ 200 lines; records linked on GitHub |
| 3 · skills 9 and 18 | `sheetpane-rules-file` lands with or after W-33; `sheetpane-frameworks` with or after W-37; skill 12 cites W-40's codes once they exist | ⏳ skill 9 (rules file) ✅ (W-33 landed); skill 12 cites W-40's codes ✅; **skill 18 is a stub until W-37** |
| 4 · entry files | `CLAUDE.md` / `AGENTS.md` blocks (≤ 30 lines: what sheetpane is, the laws a host meets, which skill for what); Kiro steering with `fileMatch`; Claude subagent; Kiro custom agent with `skill://` resources; `agents/openai.yaml` on skills that need tools | ✅ `entry/claude.md`, `entry/agents.md` (20 lines between the markers), `entry/kiro-steering.md` (`fileMatch`), `entry/claude-agent.md` and `entry/kiro-agent.json` (`sheetpane-integrator`, `skill://` resources) |
| 5 · installer | `install` / `uninstall`, the flags above, marker-bounded edits, no `postinstall`, `--dry-run` lists every path; `@sheetpane/grid` exposes `sheetpane-skills` | ✅ `install` / `uninstall`, every flag, marked-block edits only, refusal without `--force`, `.sheetpane-skills.json`, no `postinstall`, `--dry-run` lists every path; `@sheetpane/grid` exposes `sheetpane-skills` (`dist/skills-bin.js`, runs `--help`) |
| 6 · drift check | a test reads every skill and fails on: an element attribute, property, method or event not in the packages' public types; a record link that doesn't resolve; a description over 250 chars; a `name` ≠ folder; a frontmatter key outside the common subset | ✅ `test/skills.test.ts`: frontmatter subset, name = folder, ≤ 250, a "not for", ≤ 200 lines, links resolve, events / attributes / members exist in the elements' source |
| 7 · installer tests | in a temp repo: install for each tool and for all; re-run is a no-op; a hand-edited file is refused without `--force`; the marked block is replaced and text outside it kept; uninstall leaves the repo as before; Windows paths | ✅ in temp repos: each tool and all, re-run no-op, hand-edit refused without `--force`, block replaced with the text around kept, uninstall restores the repo, `--dry-run`, `--skip contributor`, Windows paths |
| 8 · tried in each tool | from `demo-packed`'s tarballs, install into a scratch host; one real prompt per tool ("embed sheetpane in a React tab with an errors panel") picks the right skill — the prompt, tool version and result written here | ⏳ the decider's: one real prompt per tool from `demo-packed`'s tarballs (Claude Code, Kiro, Codex) |
| 9 · dogfood | the repo installs its own contributor skills (15–16) for Claude Code, Kiro and Codex, so the next filing uses `sheetpane-file-work-item` | ✅ the repo installs its contributor skills for all three tools (`--only contributor --skills-only`); the repo's `CLAUDE.md` is not written by the installer (SR-WORK-DOCS 6–8) |
| 10 · record + docs | new record **SR-SKILLS** (`records/0115_SKILLS.md`): the package, the common subset, the installer, the drift check; `records/README.md` ownership row for `packages/skills`; SR-BUILD (workspace member, dependency of every package); each package README gets one line pointing at `npx sheetpane-skills install` | ✅ [SR-SKILLS](../../records/0116_SKILLS.md) (0116, as 0115 went to SR-FIXTURES); Ownership; SR-BUILD 7; each package README points at `npx sheetpane-skills install`; glossary; CHANGELOG |
## Blockers

Skill 18 waits on **W-37**; DoD 8 (a real prompt in Claude Code, Kiro and Codex) is the decider's.

## Record affected

**[SR-SKILLS](../../records/0116_SKILLS.md)**; SR-BUILD decision 7.

## Hazards

- **Second source of truth.** A skill that restates a rule drifts the day the record changes. Every skill links its record, and DoD 6 fails on API names that don't exist. Coherence beyond names is still judgement (B-006's price).
- **Contributor skills ship to hosts** (Arpit's choice). They describe this repo's `work/` and `records/`, which a host app doesn't have. Their descriptions must say *"only in the sheetpane repo"* so they never trigger elsewhere; `--skip contributor` leaves them out.
- **Writing into a host's repo.** Only inside `.claude/`, `.kiro/`, `.agents/` and the marked blocks; never on install of the npm package; always listed.
- **Codex's list budget is shared** with the host's own skills; 23 long descriptions would crowd them out.
- **Tool formats move.** The table above is from the vendors' docs on 2026-10-18; re-check before building and record the date in SR-SKILLS.
- **The runtime allow-list test** (`test/packages.test.ts`) checks third-party names only; a workspace `@sheetpane/skills` passes. The SSR and lockstep tests must cover it.
- **Editing this repo's agent-steering files** (DoD 9) is governed by SR-WORK-DOCS decisions 6–8 — read them first.
- **Concurrent sessions** are building W-32 now (`examples/`, `scripts/demo-*.mjs`); re-derive `git status` before staging.

## Reference

- Claude Code — [Skills](https://code.claude.com/docs/en/skills)
- Kiro — [Skills](https://kiro.dev/docs/skills/) · [CLI skills](https://kiro.dev/docs/cli/skills/)
- Codex — [Agent Skills](https://developers.openai.com/codex/skills)
- [`../../packages/grid/README.md`](../../packages/grid/README.md) — the API the skills summarise
- Siblings filed the same day: [W-36](W-36-tsdoc-public-api.md) TSDoc · [W-37](W-37-custom-elements-manifest.md) manifest + types · [W-38](W-38-llms-txt.md) llms.txt · [W-39](W-39-mcp-server.md) MCP · [W-40](W-40-error-codes.md) codes · [W-41](W-41-testing-package.md) testing · [W-42](W-42-fixtures-package.md) fixtures · [W-43](W-43-create-sheetpane.md) create · [W-44](W-44-live-playground.md) playground · [W-45](W-45-agent-commands-hooks-plugin.md) commands, hooks, plugin
- [W-28](../../archive/open/W-28-react-hooks.md) · [W-29](../../archive/open/W-29-dark-theme-and-slot-tokens.md) · [W-33](W-33-rules-file.md)

## Prompt — paste into Claude Code

```text
You are building W-35 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, records/0102_BUILD.md, records/README.md (§Ownership),
   records/0055_WORK-docs.md (decisions 6–8), every package README, test/packages.test.ts,
   scripts/pack-check.mjs, scripts/release.mjs and this file (work/open/W-35-agent-skills-package.md).
   Re-check the three vendors' skills docs linked above; note anything that changed.
2. Plan: the package layout, the installer's write rules, the drift check, and the order of the 16 skills —
   before writing any of them.
3. Implement packages/skills (skills, entry files, bin), the dependency in every package, grid's forwarding bin.
4. Verify: just check; the drift check; the installer tests; DoD 8 in each tool; every DoD row above.
   Then do what SR-WORK-DOCS decision 10 says every task owes.
```
