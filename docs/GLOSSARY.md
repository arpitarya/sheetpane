---
type: Glossary
description: "Recurring terms, defined once."
---

# Glossary

| term | meaning |
|---|---|
| Standing Record (SR) | a maintained specification in `records/`, cited by name; see the register |
| Law | a rule that outranks every other record; `SR-LAW-n` |
| example | anything under `examples/` — the HTML and React demos and the StackBlitz starters; maintained with every package change, see SR-LAW-10 |
| memory | JavaScript objects held in the page; not IndexedDB, browser storage or a server — see SR-LAW-9 |
| error component | the review surface that marks incorrect data and states the correction; one of the three components SR-LAW-7 keeps in sync |
| web component | a custom element registered through the Custom Elements standard, usable from any framework or plain HTML; see SR-LAW-4 |
| FOSS | free and open source software — here, a licence on the OSI-approved list; see SR-LAW-2 |
| W-nn | an open work item — a queue row plus a detail file |
| B-nnn | a backlog row — named, unclaimed, no file |
| ball | the one marker every queue row opens with: 🔴 🟣 🟡 🟢 |
| blocker | `work/BLOCKED.json` with a decision other than `PROCEED` |
| veto condition | the checkable condition under which a decision reopens |
| pane | the one in-memory workbook a set of sheetpane elements share, named by their `pane` attribute; see `work/compare/workbook-and-error-contract.compare.md` |
| change (sheetpane) | one edited cell held in the workbook as `sheet!ref → { was, now }`; export applies every change, the file is never modified |
| sheetpane-excel | working name of the web component that is both the view and the edit component |
| sheetpane-errors | working name of the web component that is the error component |
| justfile | the root file of recipes for `just`, a command runner; `just --list` shows every repo command (W-10) |
| column rules | checks a host supplies per column header title (`columns`, `validate`); failures become errors with `author: "host"` that resolve themselves when the cell passes (SR-GRID decision 22) |
| check entry | a package's DOM-free `/check` sub-path (`@sheetpane/grid/check`, `@sheetpane/validation/check`): the checks the pane runs on load, callable from Node or a worker, giving the same errors (SR-GRID decision 22f) |
| skill | a Markdown file an AI coding agent reads to learn a task; `npx sheetpane-skills install` copies sheetpane's into a repository (SR-SKILLS) |
| SP code | a permanent `SP-xxxx` code on every error, warning, note and refusal sheetpane shows, listed in `docs/ERRORS.md` (SR-CODES) |
| rules file | a JSON document of column, cell and range rules per sheet (`"*"` for every sheet), given as `rules` or `rules-src`; checked by the same engine as column rules (SR-GRID decision 22d) |
| flagging | whether people can flag issues on the sheet; `flagging="off"` removes Flag issue, the composer and the callout card, leaving the errors panel as the one place errors are read (SR-GRID decision 22e) |
| Proof | the colour and spacing tokens sheetpane shares with PDF Suite — `work/reference/design/boards/proof.css`; its fonts do not ship (SR-LAW-5) |
| plugin (sheetpane) | a separate npm package that registers against the one in-memory workbook through named hooks and adds controls to named slots; enabled per `pane` by `createWorkbook({ plugins })` or the `plugins` attribute — `work/compare/plugins.compare.md` |
| hook | one of six named functions on the workbook store a plugin may provide: `format`, `decorate`, `derive`, `validate`, `overlay`, `exportPatch` |
| slot | one of six named places in the grid a plugin's control descriptor may target: `format-row`, `selbar`, `cellbar`, `status`, `cell`, `overlay`; the grid draws the control, the plugin describes it |
| derived cell | a cell whose value a plugin computed (`derive`) rather than the user typed; marked in the grid, never in the change map |
| rich text · run | a cell whose string mixes formatting (one word in italic); each differently formatted stretch is a run (`<r>`), read into a sheet's `runs` and drawn by `decorateRuns` — see SR-IMPORT decision 12 |
