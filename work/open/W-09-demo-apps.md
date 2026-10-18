---
type: Handoff
name: W-09
description: "Arpit asked on 2026-10-18 for a way to see sheetpane integrated into a React application and into a plain application with index.html, each taking the package as a dependency."
item: W-09
filed: 2026-10-18
filed_by: "Arpit (Cowork, claude-opus-5-5)"
updated: 2026-10-18
updated_by: "Arpit (Cowork, claude-opus-5-5)"
ball: agent
---

# W-09 — Show sheetpane inside a React app and a plain `index.html` app

## At a glance

| step | what we do | what it gives us | state |
|---|---|---|---|
| 1 | Wait for the two components and the export package | something real to embed | ⏳ W-01 · W-02 |
| 2 | A plain page — one `index.html`, no framework, no build step of its own | proof the web component works anywhere (L4) | ⏳ |
| 3 | A React app — the same elements used from React components | proof it drops into a React codebase like Arpit's | ⏳ |
| 4 | Both installed the way a consumer would: from the npm package, as a dependency | proof the published package is complete (L8) | ⏳ |

**Arpit, 2026-10-18:** *"Create a work item to view this component integrated
into React application and just a regular application with index.html. And
this package has a dependency."*

**Model:** Sonnet — every step has a definition of done a browser test can
check.

## Goal

Two small demo apps in the monorepo that **consume `@sheetpane/grid` as a
dependency** — the way a host application would — and show every placement
from the design:

| app | path | what it shows |
|---|---|---|
| **plain HTML** | `examples/html/` | one `index.html` with `<script type="module">`; a tab with `<sheetpane-excel>` and a side column with `<sheetpane-errors>`; a button that opens the pop-up |
| **React** | `examples/react/` | a small React app (Vite) with the same layout as React components rendering the custom elements; Export wired to a download |

**The dependency chain each app proves:** app → `@sheetpane/grid` → `@sheetpane/export`.

## Definition of done

| DoD | what | state |
|---|---|---|
| 1 · dependency | each app's `package.json` lists `@sheetpane/grid` under `dependencies`; nothing imports from `packages/*/src` directly — only the package's public `exports` | ⏳ |
| 2 · html | `examples/html/index.html` loads the package as a module (from the build or an import map), with no framework and no app build step; tab, side column and pop-up all work | ⏳ |
| 3 · react | `examples/react` renders `<sheetpane-excel>` and `<sheetpane-errors>` from React components; properties are set and DOM events handled the React 19 way (native custom-element support) | ⏳ |
| 4 · in sync | in both apps: flag an error in the sheet → it appears in the error list; resolve it in the list → the pin turns ✓; edit a cell → Export downloads a file with the change (L6, L7) | ⏳ |
| 5 · font | each app sets its own font on a parent element and the components render in it; a toggle switches the font live (L5) | ⏳ |
| 6 · as published | a script installs both apps from `npm pack` tarballs of the two packages, not from the workspace link, and the apps still work (L8) | ⏳ |
| 7 · files | both apps open the design's sample workbook and a `.csv`; dropping any other format shows the refusal state (L3) | ⏳ |
| 8 · run | `just demo-react` and `just demo-html` (W-10's justfile) are in the root README; a browser test opens each app and runs DoD 4 | ⏳ |
| 9 · record | **no SR affected** unless the apps become a maintained surface; the Ownership rows for `examples/` are added to the register in the change that creates the directory, owned by W-09 | ⏳ |
| 10 · iOS | open either demo on an iPhone and press Export (`.xlsx` and `.csv`); what iOS Safari does is recorded in SR-DOWNLOAD Consequences — moved from W-12 DoD 7 (Arpit, 2026-10-18) | ⏳ 🔴 Arpit, once the demo runs |

## Blockers

Waiting on **W-01** and **W-02** (the elements to embed); W-03 comes with W-01.
The apps can be scaffolded once **W-04** (toolchain) lands.

## Record affected

**No SR affected** — demos consume the components' contract and decide
nothing. A React 18 wrapper is ruled out for v1 (SR-LAW-4 Consequences);
the React demo targets React 19.

## Hazards

- **React 18 vs 19.** React 18 sets attributes only and does not wire custom
  events (L4 Consequences). The React app targets React 19; no React 18
  wrapper ships (ruled 2026-10-18) — show the `ref` pattern in the README
  instead.
- **Workspace links hide packaging bugs.** A demo that works against
  `packages/*/src` can still fail from npm — DoD 6 is the guard.
- **L2 applies to demo dependencies too.** React, Vite and every dev
  dependency must be FOSS.
- **No fonts in the demos' sheetpane styles** — the demo page may set a font;
  the package may not ship one (L5).

## Reference

- The design: [`../reference/design/README.md`](../reference/design/README.md) — boards
  `Host-Tab-View`, `Host-Tab-Edit`, `Host-Linked-Tabs`, `Host-Popup-View`, `Host-Popup-Edit`.
- Custom elements: [`../reference/specs/web/mdn-using-custom-elements.md`](../reference/specs/web/mdn-using-custom-elements.md).
- The laws: [SR-LAW-4](../../records/0006_LAW-4-web-component.md) ·
  [SR-LAW-5](../../records/0007_LAW-5-host-font.md) ·
  [SR-LAW-8](../../records/0010_LAW-8-npm-package.md).

## Prompt — paste into Claude Code once the blockers close

```text
You are building W-09 in the sheetpane monorepo: two demo apps that consume
the sheetpane package as a dependency.

1. Explore. Read CLAUDE.md and every law record it lists, this file
   (work/open/W-09-demo-apps.md), the records W-01 and W-02 wrote (the
   element names, attributes, methods and events), packages/grid's
   package.json exports, and the Host-* design boards.
2. Plan both apps and the browser test in this file's body.
3. Implement examples/html (one index.html, no framework) and
   examples/react (Vite + React 19). Add examples/* to the root workspaces.
   Each lists sheetpane as a dependency and imports only its public exports.
4. Verify. Run both apps; run DoD 4 by hand and in the browser test; run the
   npm pack install check (DoD 6). Tick DoD rows only with evidence, add the
   examples/ Ownership row, then do what SR-WORK-DOCS decision 10 says every
   task owes.
```
