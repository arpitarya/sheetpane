// Writes packages/grid/dist/style.css from the built token module (W-04 DoD 2).
// Run from packages/grid after `tsc -p tsconfig.build.json`.
import { writeFileSync } from 'node:fs';
import { TOKENS_STYLESHEET } from '../packages/grid/dist/tokens.js';
writeFileSync(new URL('../packages/grid/dist/style.css', import.meta.url), TOKENS_STYLESHEET);
