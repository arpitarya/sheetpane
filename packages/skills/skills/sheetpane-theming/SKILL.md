---
name: sheetpane-theming
description: Use when matching sheetpane to a host's look - dark mode via theme, the --sp-* colour tokens, style.css, why no font is set. Not for a workbook's own colours (sheetpane-plugins: styles, condfmt).
license: MIT
metadata:
  audience: host
---

# Theming

## Light, dark, auto

```html
<sheetpane-excel theme="dark"></sheetpane-excel>   <!-- light (default) | dark | auto -->
<sheetpane-errors theme="dark"></sheetpane-errors>
```

`auto` follows the page's `prefers-color-scheme`; the default is `light`
because the grid cannot know the host's theme ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 15a). Set it
on both elements.

## Tokens

Every colour is a `--sp-*` custom property on the element: `ground`,
`surface`, `sunken`, `cell`, `head`, `grid`, `line`, `line-strong`, `ink`,
`ink-2`, `ink-3`, `accent`, `accent-ink`, `accent-soft`, `pass`, `fail`,
`warn`, `changed` (each with `-soft`), `note`, `ref-1`…`ref-3`, `on-solid`,
`hit`, `hit-current`, radii and shadows. A host override wins:

```css
sheetpane-excel, sheetpane-errors { --sp-accent: #0a7c55; --sp-r: 4px; }
```

`@sheetpane/grid/style.css` lists the defaults for light DOM use.

## Font

None is set or named ([SR-LAW-5](https://github.com/arpitarya/sheetpane/blob/main/records/0007_LAW-5-host-font.md)). Set your
font on the element or an ancestor; it applies at once.

## Pitfalls

- **The file's colours are data:** a workbook's fills and conditional colours
  render as saved in both themes — only sheetpane's chrome changes.
- Contrast is tested for the shipped tokens (text 4.5:1, marks 3:1); if you
  override, keep those ratios.
- Shadow DOM: style the element from outside with tokens, not by reaching in.

## Related

[sheetpane-embed](../sheetpane-embed/SKILL.md) · [sheetpane-a11y](../sheetpane-a11y/SKILL.md)
