#!/usr/bin/env node
// `npx sheetpane-skills …` for a host that installed @sheetpane/grid (W-35): npm and pnpm link only
// direct dependencies' bins, and hosts install the grid, not @sheetpane/skills — so the grid forwards.
// Node only; nothing here runs in a browser, and the grid's index never imports it.
const { main } = await import('@sheetpane/skills/bin');
const proc = (globalThis as unknown as { process: { argv: string[]; exitCode?: number } }).process;
proc.exitCode = await main(proc.argv.slice(2));

export {};
