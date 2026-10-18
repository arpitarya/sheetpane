# @sheetpane/skills

**sheetpane's agent skills for Claude Code, Kiro and Codex — and the installer that puts them in your repository.**

```sh
npx sheetpane-skills install            # for every tool whose folder already exists here
npx sheetpane-skills install --all      # .claude/, .kiro/ and .agents/
npx sheetpane-skills uninstall          # removes exactly what install wrote
npx sheetpane-skills check-rules q3.rules.json   # a rules file checked as <sheetpane-excel> will
```

Every `@sheetpane/*` package depends on this one, and `@sheetpane/grid` exposes
the same `sheetpane-skills` command, so it is there once sheetpane is.

| what | where it lands |
|---|---|
| 25 skills — embed, react, load-export, errors, events, column-rules, rules-file, plugins, theming, testing, troubleshoot, … and the `sheetpane` router | `.claude/skills/`, `.kiro/skills/`, `.agents/skills/` |
| three of them run as commands with an argument: `/sheetpane-embed [framework]`, `/sheetpane-rules [workbook or rules file]`, `/sheetpane-test [workbook]` (in Codex `$sheetpane-embed …`) | the same skill folders |
| a hook that runs `check-rules` after the agent writes a `*.rules.json` and hands the `SP-60xx` problems back | a `PostToolUse` group in `.claude/settings.json` and `.codex/hooks.json`; `.kiro/hooks/sheetpane-rules.json` (`PostFileSave`) |
| the `@sheetpane/mcp` server | the `sheetpane` key of `.mcp.json` / `.kiro/settings/mcp.json`; a block in `.codex/config.toml` |
| a short block saying what sheetpane is and which skill to start with | between `<!-- sheetpane:start -->` and `<!-- sheetpane:end -->` in `CLAUDE.md` / `AGENTS.md` — nothing outside it is touched |
| a Kiro steering file and a `sheetpane-integrator` agent for Claude and Kiro | `.kiro/steering/`, `.claude/agents/`, `.kiro/agents/` |

- Nothing is written on `npm install` (no `postinstall`); only when you run it.
- A file you changed since it was installed is never overwritten without
  `--force`; `--dry-run` lists every path first. What was written is listed in
  `.sheetpane-skills.json`.
- `--skip contributor` leaves out the two skills for contributing to sheetpane
  itself; `--only`, `--skills-only`, `--no-mcp`, `--no-hooks` narrow further.
- In JSON configs the hook is found by its exact command, the MCP server by
  its `sheetpane` key; every other key stays, and `uninstall` puts the file
  back as it was. Codex runs a project hook only once you trust it in `/hooks`.
- Re-run it after upgrading `@sheetpane/*` so the skills match the version.

## check-rules

```sh
npx sheetpane-skills check-rules sheetpane.rules.json other.rules.json
```

One line per problem, `SP-60xx: message (file)` — the same checks and codes
`<sheetpane-excel>` applies when it loads the file (SP-6010 to SP-6021; a
sheet, title or cell the workbook lacks shows only once a workbook is loaded).
Exit 0 clean, 1 a problem, 2 a usage or read error. As a hook,
`--hook claude|codex|kiro` reads the edited path from the agent's hook input,
ignores every other file, and prints problems to stderr with exit 2 so the
agent reads them. It reads the one file, writes nothing, uses no network.

## Claude Code plugin

The same host skills, the `sheetpane-integrator` agent, the hook and the MCP
server, as one plugin from this repository's marketplace:

```text
/plugin marketplace add arpitarya/sheetpane
/plugin install sheetpane@sheetpane
```

Its files under `plugins/sheetpane/` are generated from this package by
`just plugin`; a test fails when they are stale.

Each skill points to the sheetpane record it summarises and never restates a
rule as its own; a test fails if a skill names an attribute, member or event
the elements do not have. The spec is the record
[SR-SKILLS](../../records/0116_SKILLS.md).
