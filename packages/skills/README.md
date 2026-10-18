# @sheetpane/skills

**sheetpane's agent skills for Claude Code, Kiro and Codex — and the installer that puts them in your repository.**

```sh
npx sheetpane-skills install            # for every tool whose folder already exists here
npx sheetpane-skills install --all      # .claude/, .kiro/ and .agents/
npx sheetpane-skills uninstall          # removes exactly what install wrote
```

Every `@sheetpane/*` package depends on this one, and `@sheetpane/grid` exposes
the same `sheetpane-skills` command, so it is there once sheetpane is.

| what | where it lands |
|---|---|
| 23 skills — embed, react, load-export, errors, events, column-rules, rules-file, plugins, theming, testing, troubleshoot, … and the `sheetpane` router | `.claude/skills/`, `.kiro/skills/`, `.agents/skills/` |
| a short block saying what sheetpane is and which skill to start with | between `<!-- sheetpane:start -->` and `<!-- sheetpane:end -->` in `CLAUDE.md` / `AGENTS.md` — nothing outside it is touched |
| a Kiro steering file and a `sheetpane-integrator` agent for Claude and Kiro | `.kiro/steering/`, `.claude/agents/`, `.kiro/agents/` |

- Nothing is written on `npm install` (no `postinstall`); only when you run it.
- A file you changed since it was installed is never overwritten without
  `--force`; `--dry-run` lists every path first. What was written is listed in
  `.sheetpane-skills.json`.
- `--skip contributor` leaves out the two skills for contributing to sheetpane
  itself; `--only`, `--skills-only` narrow further.
- Re-run it after upgrading `@sheetpane/*` so the skills match the version.

Each skill points to the sheetpane record it summarises and never restates a
rule as its own; a test fails if a skill names an attribute, member or event
the elements do not have. The spec is the record
[SR-SKILLS](../../records/0116_SKILLS.md).
