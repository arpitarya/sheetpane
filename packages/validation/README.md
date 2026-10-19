# @sheetpane/validation

**The workbook's own data-validation rules, checked when the file loads and after every edit. Each cell that breaks a rule shows up as a warning in `<sheetpane-errors>`.**

A plugin for `@sheetpane/grid`. It reads the `<dataValidations>` the file's
author saved, including the x14 form Excel uses for lists on another sheet,
and runs them through the `validate` hook. `<sheetpane-excel>` and
`<sheetpane-errors>` on the same pane both see the result. On export it can
also write the host's rules file into the `.xlsx` as Excel's own dropdowns
and checks. No third-party runtime dependencies (`@sheetpane/export` writes
the rules and gives `shiftFormula`); `@sheetpane/grid` is a peer. Versioned in lockstep with it.

- `@sheetpane/validation`: the headless plugin (`validate`, and `exportPatch` for the rules file).
- `@sheetpane/validation/ui`: opt-in. Adds the list arrow and the status-line count.
- `@sheetpane/validation/check`: the same plugin with no registration, no
  element and no Download switch (checking only — `exportPatch` is the page
  entry's), and `check(bytes, options)` — `@sheetpane/grid/check`'s check with
  this plugin on: the workbook's own validation from Node or a worker.

  ```js
  import { check } from '@sheetpane/validation/check';
  const errors = await check(await readFile('budget.xlsx'), { name: 'budget.xlsx', severity: 'error' });
  ```

## Use

```html
<script type="module">
  import '@sheetpane/grid';
  import '@sheetpane/validation/ui'; // registers "validation" = rules + controls
</script>

<sheetpane-excel pane="q3" plugins="validation" src="/files/holdings.xlsx" mode="edit"></sheetpane-excel>
<sheetpane-errors pane="q3"></sheetpane-errors>
```

Without a page, or without the controls:

```ts
import { createWorkbook } from '@sheetpane/grid';
import { validation, skippedRules } from '@sheetpane/validation';

const store = createWorkbook({ plugins: [validation({ severity: 'warning' })] });
await store.load(bytes, 'holdings.xlsx');
store.getErrors();      // one error per failing cell
skippedRules(store);    // { rules, checked, skipped: [{ sheet, sqref, type, reason, detail }] }
```

Importing `@sheetpane/validation` registers `validation` as the rules plugin
alone. Importing `/ui` re-registers it as the rules plus the controls.

## What a broken rule looks like

One error per failing cell. If a cell breaks two rules, the first one counts.

| field | value |
|---|---|
| `type` | `validation` |
| `severity` | `warning` (set another with `validation({ severity })`) |
| `author` | `workbook` |
| `range` | the cell, e.g. `B4` |
| `found` | the cell's current display text, or `(blank)` |
| `expected` | the rule in words (table below) |
| `message` | the rule's own `errorTitle: error`, or either one alone; otherwise the rule in words |

A workbook error resolves itself when its cell passes again and reopens if
the cell fails again (it keeps the same id). This is the only automatic
resolve in sheetpane; the store does it. `showErrorMessage="0"` rules are
still checked, because that flag only turns off Excel's popup.

## The rules, and the words a reviewer reads

| rule | passes when | `expected` |
|---|---|---|
| `whole` | the value is an integer and the operator holds | `whole number > 0` |
| `decimal` | the value is a number and the operator holds | `decimal between 0.00% and 2.00%` (operands in the cell's own number format) |
| `date` | the value is a date serial and the operator holds | `date between 01-Jul-2026 and 30-Sep-2026` |
| `time` | the value is a number (a fraction of a day) and the operator holds | `time between 09:00 and 18:00` |
| `textLength` | the length of the text holds against the operator | `text length ≤ 5 characters` |
| `list` | the text matches a choice (case-insensitive; a number also matches its number) | `list — Core, Income, Cap` (the first 8, then `… (n more)`) |
| `custom` | the formula is true at the cell | `custom — =A1>0` |

Operators: `between` (the default), `notBetween`, `equal` (`=`), `notEqual`
(`≠`), `greaterThan` (`>`), `lessThan` (`<`), `greaterThanOrEqual` (`≥`),
`lessThanOrEqual` (`≤`). `between` includes both ends.

What an operand can be:

- a number
- `DATE(y,m,d)` or `TIME(h,m,s)` with number arguments
- a quoted string
- a cell: `$G$1`, `Sheet2!B1`, or a relative `D1`, which shifts with each cell the same way it does in Excel
- a defined name that resolves to one of these
- `INDIRECT(<cell>)`: the cell named by that cell's text (see dependent lists below)

A cell operand is read live, so changing the limit re-checks the rule. An
empty operand cell reads as 0.

A `list` source can be:

- a literal list: `"a,b,c"`
- a range: `$H$1:$H$9`, `Lists!$A$1:$A$9`, `$A:$A`
- a defined name that resolves to a range
- an Excel table's column: `Units[Unit]` or `Units[[#Data],[Unit]]`, directly or
  through a defined name — the column's data rows, as the file stores the table

- `INDIRECT($A2)` — a **dependent list** (W-60): each row reads its parent
  cell's text and lists what it names — a defined name (any case; the sheet's
  own name before a global one), a table or table column (`Units[Unit]`), or
  an A1 range (`Lists!$B$2:$B$5`). `INDIRECT("Turbidity")` (quoted text) and
  `INDIRECT($A2, TRUE)` work too.

A range source is read live from the store, and the arrow's menu re-reads it
each time it opens.

### Dependent lists

Excel's pattern for *Unit depends on Parameter*: one defined name per
parameter (`Turbidity` → `Lists!$B$2:$B$3`) and `=INDIRECT($A2)` as the Unit
column's list source. The parent's text is read per row, live: change the
Parameter and the Unit is checked again in the same edit — a unit the new
parameter does not allow (an orphan) is a warning, and the arrow offers the
new parameter's units.

A parent that names nothing (blank, or text that is no name, such as
`Flow Rate`) gives no list. As in Excel, the child then passes under
`allowBlank` ("Ignore blank") and fails without it (`expected`:
`list — (A7 "Flow Rate" names no list)`). Names cannot hold spaces, so
workbooks wrap the parent in `SUBSTITUTE`; that, `&` and R1C1
(`INDIRECT($A2, FALSE)`) are not emulated — the rule is skipped (`source`).

Blank cells pass when the rule has `allowBlank`. Without it, they fail.
Cells are checked only inside the sheet's used range: its data plus any cell
the user changed. A rule on `B:B` therefore does not produce a million rows.

## What is not checked, and why (`skippedRules`)

| reason | what |
|---|---|
| `custom` | a `custom` rule when no formula plugin offers `evaluate()` (see below) |
| `operand` | an operand the subset above does not cover, e.g. `SUM(...)` or `INDIRECT(SUBSTITUTE(...))` |
| `operator` | an operator outside the eight above |
| `type` | an unknown rule type |
| `source` | a list source that is neither a list, a range, a name nor `INDIRECT` of one cell or quoted text (`OFFSET(...)`, `INDIRECT(SUBSTITUTE(...))`), or that names a missing sheet |

`skippedRules(store)` counts `custom` as checked when the pane has a formula
evaluator. `skippedRules(book)` has only the workbook to go on, so it counts
every `custom` rule as skipped. The status line adds `· n rules not checked`.

### Custom rules need a formula engine

`custom` rules run only when the pane's `derive` plugin (`@sheetpane/formulas`)
also exposes:

```ts
evaluate(formula: string, at: { sheet: string; ref: string }): boolean | number | string | null | undefined
```

The plugin passes the formula with its relative references already shifted to
the cell. `true` or a non-zero number passes. `false` or `0` fails. Anything
else counts as unknown, and the cell is not flagged.

## The rules file as Excel dropdowns (`rulesAsValidation`)

A host that checks its sheets with a rules file (`rules-src`, or
`excel.rules`) can hand the same rules to people who work in Excel. The
Download menu shows **Write rules as Excel dropdowns** while the pane has a
rules file or column rules; turned on, the `.xlsx` carries them as the
workbook's own data validation.

```ts
validation({ rulesAsValidation: true });          // the switch on at first (default: off)
await excel.export({ rulesAsValidation: true });  // or for one export
lastRulesWrite(excel.workbook?.book);             // { written, merged, skipped, conflicts }
rulesAsValidations(store);                        // the plan, without writing
```

| the rule says | Excel gets | skipped (code) |
|---|---|---|
| `oneOf`, `equals` | a dropdown list | a value with a comma, an empty list, over 255 characters (SP-5403) |
| `integer` / `number`, `min` / `max` | whole number / decimal | a bound that is not a number (SP-5404) |
| `date`, `min` / `max` | date | a bound not written `2026-01-31` or as a serial (SP-5404) |
| `minLength` / `maxLength` | text length | (SP-5404) |
| `boolean` | the list TRUE, FALSE | |
| `required` | "ignore blank" off (alone: text length ≥ 1) | |
| `pattern`, `noneOf`, `unique` | — | always (SP-5401) |
| two checks in one rule | — | always (SP-5402) |

A column rule covers its column from the row under the titles to the last
row; a cell rule its range. The rule's `message` is Excel's error text, the
rule in words its input prompt; `onInvalid: 'block'` is Excel's Stop, a
`note` its Information, anything else its Warning.

**The workbook's own rule wins.** Where the file already has a rule, the
written one leaves those cells and the conflict is listed (SP-5406); a rule
that checks the same thing joins the file's own instead of repeating it.
Excel 2010 `x14` rules stay where they are. A rules-file title the workbook
lacks is SP-5405. Every rule not written is a console warning with its code,
and the status line adds `· k rules not written to Excel`. `.xlsx` only.

## The controls (`/ui`)

- **List arrow** (`cell` slot, Edit only): appears in every cell a `list` rule
  covers. It opens the rule's current choices, and picking one sets the cell
  with `store.setCell`, which can be undone.
- **Status** (`status` slot, View and Edit): `3 validation warnings`, plus
  `· 1 rule not checked` when rules were skipped, plus `· 2 rules not written
  to Excel` after an export that wrote the rules file.

`<sheetpane-errors>` lists the rule rows with the reviewer's own errors. Its
author filter (Anyone · People · Workbook rules · File comments) shows only
the rule rows when you need them.

## Known limits

- A list whose source is on another sheet is re-checked when its own sheet
  changes, not when the source sheet changes. The arrow's menu is always
  current.
- A cell holding a formula is checked against its saved value. If the user
  typed the formula, the plugin uses the value the formula plugin derived. The
  check runs on the edit, before the formula plugin has finished deriving.
- `found` is fixed when the error is first made. If an error reopens, it shows
  the first failing value.

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
