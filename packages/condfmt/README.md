# @sheetpane/condfmt

**Conditional formatting for sheetpane — the file's own `<conditionalFormatting>` rules drawn as Excel draws them: value and text rules, duplicates, top / bottom, averages, colour scales, data bars and formula rules — as a plugin on the `decorate` hook, after `@sheetpane/styles`. Render only: nothing here writes a rule.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`,
so `<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid` and `@sheetpane/styles` (peers). No runtime
dependencies.

| entry | what it gives |
|---|---|
| `@sheetpane/condfmt` | `condfmt()` — the headless plugin: `decorate`, ordered after `styles`, draws each cell the rules hold for |
| `@sheetpane/condfmt/ui` | `ui()` — the legend and the count: the rule named on hover and in the cell bar, the rules counted in the status line |

```js
import { createWorkbook } from '@sheetpane/grid';
import { styles } from '@sheetpane/styles';
import { condfmt } from '@sheetpane/condfmt';
import { ui } from '@sheetpane/condfmt/ui';

el.workbook = createWorkbook({ plugins: [styles(), condfmt(), ui()] });
```

Or by attribute: `import '@sheetpane/condfmt/ui'` (it registers `condfmt` with
its UI; `import '@sheetpane/condfmt'` alone registers the headless plugin), then
`<sheetpane-excel plugins="styles condfmt">`.

## The rules it draws

| type | holds when |
|---|---|
| `cellIs` | the value compares to its operand(s) — `equal`, `notEqual`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `between`, `notBetween` (bounds in either order) |
| `containsText` · `notContainsText` · `beginsWith` · `endsWith` | the value as text, without case |
| `containsBlanks` · `notContainsBlanks` · `containsErrors` · `notContainsErrors` | the value is blank (or only spaces) / an error |
| `duplicateValues` · `uniqueValues` | the value appears more than once / once in the rule's range (text without case; blanks never count) |
| `top10` | in the top or bottom *n* (or *n* %) numbers of the range, ties included |
| `aboveAverage` | above (or, with `aboveAverage="0"`, below) the range's average |
| `colorScale` | 2 or 3 colours, interpolated in sRGB between thresholds |
| `dataBar` | a bar sized to the value |
| `expression` | its formula is TRUE or non-zero — with a formula engine only (below) |

Comparisons follow Excel: numbers < text < logicals, text without case, a blank
reads as 0 or empty text. Operands are numbers, `"text"`, `TRUE` / `FALSE`, or a
cell — absolute parts stay, relative parts shift with the cell from the
range's top-left. Any other operand is a formula, read through the engine.

**Priority** is one order per sheet, across every `<conditionalFormatting>`
block. A higher-priority rule wins each property it sets; a lower one fills in
the rest; a matching rule with `stopIfTrue` ends the walk. A rule with several
`sqref` areas is one range.

## What a cell shows

A rule's `dxf` goes through `@sheetpane/styles`' `dxfCss` and its allow-list:
`background-color`, `color`, `font-weight`, `font-style`, `font-size`,
`text-decoration`, the four borders. Because `condfmt` runs **after** `styles`,
the rule wins per property and the static style keeps the rest — a bold cell
with a yellow fill and a rule's red fill is bold and red.

- **Colour scale:** `background-color`. Thresholds: `min`, `max`, `num`,
  `percent` (of the range from min to max), `percentile` (`PERCENTILE.INC`),
  `formula`. Values beyond the end thresholds take the end colours; text and
  blanks take none.
- **Data bar:** `background-image`, a gradient from the bar's colour to a
  lighter tint, `minLength` (default 10 %) … `maxLength` (default 90 %) of the
  cell, linear between the low and high thresholds.
- A rule's fill with no text colour of its own takes the cell's static colour,
  else the workbook's default ink: the file's colours are data, drawn as saved
  in both themes.
- **Edit marks stay on top:** an error's ring is an inset shadow and its tint a
  `::before` overlay above the fill, so a flagged cell keeps its rule's fill.

Statistics a range rule needs (sorted numbers, sum, duplicate counts) are
computed once per range and kept; per-cell results are kept too. A change drops
only what depends on it: the changed cell, every cell of a range whose
statistics hold it, and — for rules that read other cells (a formula, a cell
operand) — their results. `evaluations(store)` counts both, for profiling.

## Formula rules

An `expression` rule — or a `cellIs` operand or a threshold that is a formula —
is read through the `derive` provider's synchronous `evaluate(formula, { sheet,
ref })`, which `@sheetpane/formulas` offers. Without one, the rule is **skipped
and counted**, never guessed. So are icon sets (`iconSet`, out of v1),
`timePeriod` and any other type outside the table above.

`skippedRules(storeOrWorkbook)` → `{ rules, shown, skipped: [{ sheet, sqref,
type, priority, reason, detail }] }`, `reason` one of `iconSet`, `formula`,
`type`, `malformed`.

## The legend and the count (`ui()`)

- **Hover:** a rule-coloured cell shows *Conditional: greater than 1000* and its
  range in a tooltip under the cell (an overlay that lets pointer events through
  to the cells).
- **Cell bar:** the selected cell's rules, in the same words — the legend a
  keyboard or a screen reader reaches.
- **Status:** *4 conditional rules from the file · 1 not shown*.

Colour never carries meaning alone.

## Also exported

`rulesOf(book, sheet)` (compiled, priority order), `ruleWords(rule, row, col)`,
`cellResult(store, sheet, row, col)`, `legendAt(store, sheet, row, col)`,
`shiftFormula`, `parseOperand`, `compareCells`, `percentile`, `scaleColor`,
`lerpColor`, `barLength`, `barImage`, `dxfStyle`.

Spec: [`work/open/W-19-condfmt.md`](../../work/open/W-19-condfmt.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).

**Using an AI coding agent?** `npx sheetpane-skills install` puts sheetpane's skills for Claude Code, Kiro and Codex into your repository.
