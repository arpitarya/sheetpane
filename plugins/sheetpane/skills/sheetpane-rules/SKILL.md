---
name: sheetpane-rules
description: The /sheetpane-rules [workbook or rules file] command - drafts a rules file for a workbook, or fixes one, then runs sheetpane-skills check-rules until it is clean. Not for learning the format (sheetpane-rules-file) or rules in code.
license: MIT
metadata:
  audience: host
---

# /sheetpane-rules — write or fix a rules file, then check it

The argument: **$ARGUMENTS** (in a tool that does not fill that in, it is the
text typed after the command).

| the argument | do |
|---|---|
| a `.xlsx` / `.csv` path | draft `<name>.rules.json` next to it for that workbook |
| a `.rules.json` path | check it and fix what the check reports |
| nothing | look for `*.rules.json` in the repository; if there is none, ask which workbook |

## Steps

1. Read [sheetpane-rules-file](../sheetpane-rules-file/SKILL.md): the shape,
   the rule words, how the element loads the file (`rules-src`). Use no word
   it does not list — the check reports an unknown one as SP-6016.
2. For a workbook, find each sheet's name and header row. With the sheetpane
   MCP server connected, its `inspect_workbook` and `draft_rules` tools do
   this; otherwise ask, or read the file with `@sheetpane/import`.
3. Write the rules: a `"*"` sheet for titles every sheet shares, a named
   sheet for the rest, `cells` only for fixed cells (an A1 cell or range).
   Start with `"$schema": "https://unpkg.com/@sheetpane/grid/rules.schema.json"`
   and `"version": 1`.
4. Check it:

   ```sh
   npx sheetpane-skills check-rules path/to/name.rules.json
   ```

   One line per problem, `SP-60xx: message (file)`; exit 0 means clean. Fix
   each line and run it again. In Claude Code, Kiro and Codex the hook that
   `npx sheetpane-skills install` adds runs the same check after each save.
5. Wire it up if it is not yet: `rules-src="./name.rules.json"` on
   `<sheetpane-excel>` (see sheetpane-rules-file), and say which file you
   wrote.

## What the check cannot know

It reads the file alone. A sheet, column title or cell the workbook does not
have (SP-6022 to SP-6025) shows only once the element loads the workbook —
open it and read the errors panel ([sheetpane-errors](../sheetpane-errors/SKILL.md)).
Each code is explained in
[docs/ERRORS.md](https://github.com/arpitarya/sheetpane/blob/main/docs/ERRORS.md).
