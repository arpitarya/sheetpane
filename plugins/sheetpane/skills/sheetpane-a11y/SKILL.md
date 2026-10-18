---
name: sheetpane-a11y
description: Use when making a host's sheetpane page accessible - the grid's keyboard contract, labelling the host tab or dialog, focus when the pop-up closes, colour never alone. Not for the grid's own internals.
license: MIT
metadata:
  audience: host
---

# Accessibility

The grid follows the APG grid pattern ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 12): focus stays on
the `role="grid"` element and `aria-activedescendant` names the active cell.

| key | does |
|---|---|
| arrows, Shift+arrows | move, select a range |
| Home/End, Ctrl+Home/End, PageUp/PageDown | jump |
| Enter or F2, a printable key | edit (Edit mode) |
| Delete | clear (Edit) |
| F | Flag issue (Edit; not with `flagging="off"`) |
| Shift+F10 or the Menu key | the selection actions under the cell |
| Ctrl/⌘+Z, Ctrl+Y, ⌘+Shift+Z | undo, redo |
| Esc | cancel the innermost thing or close the pop-up |

The `?` button lists them with every plugin's shortcuts.

## What the host owns

- **Label the place the sheet sits:** the host's tab or region needs a name
  (`aria-label` on the tab panel, a heading).
- **Pop-up:** `display="popup"` is a modal `<dialog>`; Esc or the close
  button closes it and returns focus to where it was ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 14).
  Listen for `sheetpane-close` to sync your state.
- **Tabs:** when "Show in sheet" fires `sheetpane-reveal`, switch to the tab
  holding the sheet so focus lands somewhere visible.
- **Colour is never alone:** severities have glyphs (✕ ! i); contrast is
  tested in light and dark ([SR-GRID](https://github.com/arpitarya/sheetpane/blob/main/records/0105_GRID.md) decision 15a) — keep the ratios if you
  override tokens.

## Related

[sheetpane-embed](../sheetpane-embed/SKILL.md) · [sheetpane-theming](../sheetpane-theming/SKILL.md) · [the APG grid pattern](https://github.com/arpitarya/sheetpane/blob/main/work/reference/specs/a11y/)
