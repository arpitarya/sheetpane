---
inclusion: fileMatch
fileMatchPattern: ["**/*.{js,jsx,ts,tsx,vue,svelte,html}"]
---

# sheetpane

Applies to files that import `@sheetpane/*` or render `<sheetpane-excel>` /
`<sheetpane-errors>`.

sheetpane shows `.xlsx` and `.csv` files as two web components kept in sync
through one in-memory workbook per `pane` id. Respect its laws: only `.xlsx`
and `.csv`; a definite height on the sheet; the host's font (never set one
inside sheetpane); the same `pane` on the sheet and the errors list; edits stay
in memory until export; every message carries an `SP-xxxx` code.

Use the `sheetpane` skill first — it routes to the right one (embed, react,
load-export, errors, events, column-rules, rules-file, plugins, theming,
testing, troubleshoot, frameworks, …).
