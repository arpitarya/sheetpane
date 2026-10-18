---
name: sheetpane
description: Use first for any sheetpane task in a host app - a decision table pointing to the right sheetpane skill (embedding, loading, errors, events, rules, plugins, theming, testing, frameworks, troubleshooting). Not needed once you know which skill applies.
license: MIT
metadata:
  audience: host
---

# sheetpane — which skill for which task

sheetpane shows `.xlsx` and `.csv` files in a web page as two web components,
`<sheetpane-excel>` (the sheet, View or Edit) and `<sheetpane-errors>` (the
review list), always in sync through one in-memory workbook per `pane`.
Nothing is uploaded; export carries every change.

| the task | skill |
|---|---|
| install, imports, versions | [sheetpane-setup](../sheetpane-setup/SKILL.md) |
| put the sheet and the errors list on a page; tab or pop-up | [sheetpane-embed](../sheetpane-embed/SKILL.md) |
| React 19 props, events, hooks | [sheetpane-react](../sheetpane-react/SKILL.md) |
| Vue, Angular, Svelte, Solid, Next.js | [sheetpane-frameworks](../sheetpane-frameworks/SKILL.md) |
| open a file, download it, save it yourself | [sheetpane-load-export](../sheetpane-load-export/SKILL.md) |
| the review: errors, persistence, Show in sheet | [sheetpane-errors](../sheetpane-errors/SKILL.md) |
| react to selection, typing, saving; refuse a value | [sheetpane-events](../sheetpane-events/SKILL.md) |
| check values by column title in code | [sheetpane-column-rules](../sheetpane-column-rules/SKILL.md) |
| ship valid/invalid values as a JSON file; no flagging | [sheetpane-rules-file](../sheetpane-rules-file/SKILL.md) |
| number formats, formulas, styles, charts, comments… | [sheetpane-plugins](../sheetpane-plugins/SKILL.md) |
| write a plugin | [sheetpane-plugin-author](../sheetpane-plugin-author/SKILL.md) |
| dark mode, colours | [sheetpane-theming](../sheetpane-theming/SKILL.md) |
| keyboard, focus, screen readers | [sheetpane-a11y](../sheetpane-a11y/SKILL.md) |
| big files | [sheetpane-performance](../sheetpane-performance/SKILL.md) |
| untrusted files, CSP, regexes | [sheetpane-security](../sheetpane-security/SKILL.md) |
| save the review on a server and restore it | [sheetpane-backend](../sheetpane-backend/SKILL.md) |
| test a host app | [sheetpane-testing](../sheetpane-testing/SKILL.md) |
| something is wrong, an SP-xxxx code | [sheetpane-troubleshoot](../sheetpane-troubleshoot/SKILL.md) |
| a newer version | [sheetpane-upgrade](../sheetpane-upgrade/SKILL.md) |
| coming from SheetJS, Handsontable, AG Grid | [sheetpane-migrate](../sheetpane-migrate/SKILL.md) |

Three of them also run as commands with an argument — `/sheetpane-embed
[framework]`, `/sheetpane-rules [workbook or rules file]` ([sheetpane-rules](../sheetpane-rules/SKILL.md)),
`/sheetpane-test [workbook]` ([sheetpane-test](../sheetpane-test/SKILL.md));
in Codex, `$sheetpane-embed …`.

## Three choices people mix up

- **View vs Edit:** `mode="view"` reads; `mode="edit"` edits and flags.
- **Column rules vs rules file vs the validation plugin:** rules in code ·
  rules in a JSON file · rules saved inside the workbook.
- **Tab vs pop-up:** `display="tab"` (default) fills its container;
  `display="popup"` is a modal opened with `open`.

The specs are the records: [`records/README.md`](https://github.com/arpitarya/sheetpane/blob/main/records/README.md).
