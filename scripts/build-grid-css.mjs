// Writes packages/grid/dist/style.css from the built token module (W-04 DoD 2),
// and copies the rules-file JSON Schema (W-33) and llms.txt / llms-full.txt (W-38) beside it.
// Run from packages/grid after `tsc -p tsconfig.build.json`.
import { copyFileSync, writeFileSync } from 'node:fs';
import { TOKENS_STYLESHEET } from '../packages/grid/dist/tokens.js';
writeFileSync(new URL('../packages/grid/dist/style.css', import.meta.url), TOKENS_STYLESHEET);
copyFileSync(new URL('../packages/grid/rules.schema.json', import.meta.url), new URL('../packages/grid/dist/rules.schema.json', import.meta.url));
// llms.txt and llms-full.txt ship in the grid too, so node_modules/@sheetpane/grid/dist has them (W-38)
for (const f of ['llms.txt', 'llms-full.txt']) copyFileSync(new URL(`../${f}`, import.meta.url), new URL(`../packages/grid/dist/${f}`, import.meta.url));
