---
type: Handoff
name: W-29
description: "Arpit's plugin design brief of 2026-10-18 asked for every board in light and dark; this item adds a dark theme and the few tokens the plugin slots need to the grid's `--sp-*` set."
item: W-29
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-29 — A dark theme for the grid, and the tokens the plugin slots draw with

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Arpit accepts or changes the dark values, and says whether dark follows the computer's setting on its own | the dark colours are decided, not guessed | ✅ 2026-10-18 |
| 2 | Add the tokens the slots need to `tokens.ts`: cell, header, grid line, three reference colours, text-on-solid | plugin controls and marks draw from tokens, never from hex | ⏳ |
| 3 | Ship the dark set on both elements | a host app in dark mode gets a dark grid | ⏳ |
| 4 | Keep the file's own colours exactly as saved | a conditional fill or a styled cell is data, never re-themed | ⏳ |

**Arpit, 2026-10-18 (design brief):** *"Compact: toolbar 36 px, format row 32 px, cells 28 px at 100 %. Proof tokens only (--sp-*). Light and dark."*

**Model:** Sonnet — a token table, one attribute and a contrast check; the judgment is the decider's (step 1).

## Goal

`packages/grid/src/tokens.ts` holds Proof's light values only. The plugin boards (work/reference/design/boards/) draw a dark set and five more tokens; this item puts both into the package, so every slot control and mark is themed once, by the grid, as the plugins verdict promises ("`--sp-*` tokens applied once").

The proposed values are in [`sp-plugins.css`](../reference/design/boards/sp-plugins.css) (`.spx.spx-dark`): every dark colour is a mix of Proof's own ink `#16171A` and ground `#F6F6F4` with the existing status hues — no new hue.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · ruling | the decider's answer to step 1 is written here: the dark values as accepted, and `auto` (follow `prefers-color-scheme`) on or off by default | ✅ Arpit, 2026-10-18: **dark values accepted** as drawn in `sp-plugins.css` `.spx-dark`; **`auto` is off by default**: `theme` defaults to `light`, and a host opts in with `theme=\"auto\"` or `theme=\"dark\"` (the grid can't know the host page's theme) |
| 2 · tokens | `TOKENS` gains `cell`, `head`, `grid`, `ref-1`, `ref-2`, `ref-3`, `on-solid`; the grid's own CSS uses them instead of literals (`#FFFFFF`, `#F3F3F0`, `#E6E6E1`) | ⏳ |
| 3 · dark | a dark set for every token, applied by a `theme` attribute on both elements (`light` · `dark` · `auto`, **default `light`**); a host can still override any `--sp-*` on the element | ⏳ |
| 4 · file colours | colours that come from the workbook (styles, condfmt, chart fills) render as saved in both themes; only sheetpane's chrome and marks change | ⏳ |
| 5 · contrast | in both themes: text 4.5:1 on its ground, severity glyphs, pins, the changed mark and focus rings 3:1 against the cell — checked by a test over the token table | ⏳ |
| 6 · fallback | `color-mix()` is not required at runtime: the dark set ships as computed hex | ⏳ |
| 7 · tests | a snapshot of the no-plugin grid in each theme; the contrast test; L5's veto command stays clean (no font in any token) | ⏳ |
| 8 · record | W-01's component record gains the theme attribute and the token list | ⏳ |

## Blockers

None. The ruling is in (DoD 1); W-01 and W-14 have closed (SR-GRID).

## Record affected

W-01's component record (the theme attribute, the token list). Until it lands: **no SR affected**.

## Hazards

- **L5.** A theme is colour only; no token may carry a font.
- **Data is not chrome.** Re-theming a conditional fill would change what the reviewer is checking.
- **Scope.** Two themes. Anything more (high-contrast, brand themes) is the host's, through `--sp-*` overrides.

## Reference

- Design: [`../reference/design/boards/All-Plugins.dc.html`](../reference/design/boards/All-Plugins.dc.html) — the full grid in dark; [`Plugin-Styles`](../reference/design/boards/Plugin-Styles.dc.html) — the format-row states in both themes
- [`../../packages/grid/src/tokens.ts`](../../packages/grid/src/tokens.ts) — today's tokens
- [`../compare/grid-rendering.compare.md`](../compare/grid-rendering.compare.md) decision 3 — tokens
- [SR-LAW-5](../../records/0007_LAW-5-host-font.md)

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-29 in the sheetpane monorepo.

1. Explore. Read CLAUDE.md, work/INTERVIEW.md, docs/ARCHITECTURE.md,
   packages/grid/src/tokens.ts, work/reference/design/boards/sp-plugins.css
   and this file (work/open/W-29-dark-theme-and-slot-tokens.md).
2. Plan the token table (light + the dark values ruled in DoD 1) before writing code.
3. Implement in packages/grid/src/tokens.ts and the elements' theme attribute.
4. Verify: just check; every DoD row above. Then do what SR-WORK-DOCS
   decision 10 says every task owes.
```
