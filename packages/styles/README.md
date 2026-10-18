# @sheetpane/styles

**Cell styles for sheetpane — fill, bold, italic, underline, strikethrough, colour, size, borders, alignment, wrap — as a plugin on the `decorate` hook. Never a font family (SR-LAW-5): the host's font is the font.**

A plugin: it registers against the one in-memory workbook of `@sheetpane/grid`,
so `<sheetpane-excel>` and `<sheetpane-errors>` both see its effect. Versioned in
lockstep with `@sheetpane/grid` (a peer). No runtime dependencies.

| entry | what it gives |
|---|---|
| `@sheetpane/styles` | `styles()` — the headless plugin: `decorate` draws each cell as the workbook formats it, plus the reviewer's changes; `exportPatch` writes those changes into the file |
| `@sheetpane/styles/ui` | `ui()` — the format row and selection-bar controls; opt-in, Edit mode only |

```js
import { createWorkbook } from '@sheetpane/grid';
import { styles } from '@sheetpane/styles';
import { ui } from '@sheetpane/styles/ui';

el.workbook = createWorkbook({ plugins: [styles(), ui()] });
```

Or by attribute: `import '@sheetpane/styles/ui'` (it registers `styles` with its
controls; `import '@sheetpane/styles'` alone registers the headless plugin), then
`<sheetpane-excel plugins="styles">`.

## What a cell shows

`decorate(cell)` reads `cellXfs[s]` → `fonts`, `fills`, `borders`, `alignment`
and returns only these CSS properties:
`background-color`, `color`, `font-weight`, `font-style`, `font-size`,
`text-decoration`, `text-align`, `vertical-align`, `white-space`,
`border-top` / `-right` / `-bottom` / `-left`. Nothing else, ever.

- **Colours:** `rgb` (ARGB), theme colours with Excel's tint, indexed colours
  (the default 64-colour palette, or the file's `<indexedColors>`), `auto`.
- **The default font's size and colour are the host's**: only a size or colour
  that differs from the workbook's default font is drawn, so a plain cell stays
  plain (and dark themes keep their ink). Size scales the grid's own size by
  `sz / default`.
- A filled cell with automatic text is drawn in the workbook's default ink.
- Patterns blend by density; a gradient shows its midpoint; diagonal borders,
  indent and rotation are not drawn.

`styles({ fileStyles: false })` draws only the reviewer's own changes.

## The format row (`ui()`)

Groups, in order: **text** (Bold `Mod+B`, Italic `Mod+I`, Underline `Mod+U`,
Strikethrough `Mod+5`) · **colour** · **fill** · **border** (all, outside, one
side, thick or double bottom, none) · **align** (left `Mod+Shift+L`, centre
`Mod+Shift+E`, right `Mod+Shift+R`; top, middle, bottom; Merge / Unmerge) ·
**wrap** · **clear** (`Mod+\`). The selection bar adds Bold, Fill and
Merge / Unmerge. Every control restyles the whole selection as **one** undo step.
Merges are core: the merge control only calls `store.setMerge()`.

`ui({ colours, fills, highlight })` picks the swatch sets (`{ value: 'RRGGBB', label }`).
The default fills each keep the grid's changed-corner mark at 3:1 contrast.

## The change it makes

A change of kind `style` at the key `sheet!#style:A1` (not `sheet!A1`, which a
value change owns). Its `now` is a plain object, `StylePatch`:

```ts
{ clear?: true; b?: boolean; i?: boolean; u?: boolean; strike?: boolean;
  color?: 'RRGGBB' | null; fill?: 'RRGGBB' | null;
  border?: { top?, right?, bottom?, left?: { style, color? } | null };
  align?: 'left' | 'center' | 'right' | null; valign?: 'top' | 'middle' | 'bottom' | null;
  wrap?: boolean }
```

Fields the file already shows are dropped; a cell back to its file look has no
change. `clear` drops the file's font, fill, border and alignment; the number
format stays.

## Export

`exportPatch` appends deduplicated `<font>`, `<fill>`, `<border>` and `<xf>`
entries to `xl/styles.xml` (counts updated, every existing entry and every other
byte kept) and repoints `s` on each style-changed cell — adding `<c r s/>` where
the cell had no element. Untouched cells keep their `s`. A CSV carries no
styles, so a CSV is never restyled.

## For `@sheetpane/condfmt`

Exported for reuse: `resolveColor`, `applyTint`, `paletteOf`, `DEFAULT_THEME`,
`DEFAULT_INDEXED`, `ALLOWED_PROPS`, `allowListed`, `fontCss`, `fillCss`
(`{ dxf: true }` reads a dxf's solid `bgColor`), `borderCss`, `alignmentCss`,
`dxfCss`.

Spec: [`work/open/W-17-styles.md`](../../work/open/W-17-styles.md).
How plugins plug in: [`work/compare/plugins.compare.md`](../../work/compare/plugins.compare.md).
