<!-- sheetpane:start -->
## sheetpane

This app embeds **sheetpane**: `.xlsx` and `.csv` files shown in the page as two
web components — `<sheetpane-excel>` (the sheet, View or Edit) and
`<sheetpane-errors>` (the review list) — kept in sync through one in-memory
workbook per `pane` id. Nothing is uploaded; export carries every change.

What a host must respect (sheetpane's laws, in its records):
- only `.xlsx` and `.csv`; give the sheet a definite height;
- the font is the host's — never set one inside sheetpane;
- the same `pane` string links the sheet and the errors list;
- edits stay in memory until `export()` / the Download button;
- every message carries an `SP-xxxx` code (see docs/ERRORS.md in the package repo).

Start with the `sheetpane` skill: it routes to the right one (embed, react,
load-export, errors, events, column-rules, rules-file, plugins, theming,
testing, troubleshoot, …). Skills were installed by `npx sheetpane-skills install`;
re-run it after upgrading `@sheetpane/*`.

Commands: `/sheetpane-embed [framework]`, `/sheetpane-rules [workbook or
rules file]`, `/sheetpane-test [workbook]`. The hook in `.claude/settings.json`
(if installed) checks each `*.rules.json` you write with `npx sheetpane-skills
check-rules`; fix every SP-60xx line it reports.
<!-- sheetpane:end -->
