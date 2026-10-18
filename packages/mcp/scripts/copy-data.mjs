// What the server answers from ships in dist/ (W-39): docs/ERRORS.md for explain_code (SR-CODES),
// the grid's custom-elements.json and a plugin table for describe_api (W-37).
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url);
copyFileSync(at('../../../docs/ERRORS.md'), at('../dist/ERRORS.md'));
if (existsSync(at('../../grid/custom-elements.json'))) copyFileSync(at('../../grid/custom-elements.json'), at('../dist/custom-elements.json'));
const RECORDS = { validation: '0108_VALIDATION', numfmt: '0109_NUMFMT', styles: '0110_STYLES', formulas: '0111_FORMULAS', comments: '0112_COMMENTS', charts: '0113_CHARTS', condfmt: '0114_CONDFMT', images: '0107_IMAGES' };
const plugins = Object.entries(RECORDS).sort(([a], [b]) => a.localeCompare(b)).map(([id, record]) => {
  const pkg = JSON.parse(readFileSync(at(`../../${id}/package.json`), 'utf8'));
  return { id, package: pkg.name, description: pkg.description, record: `records/${record}.md` };
});
writeFileSync(at('../dist/plugins.json'), JSON.stringify(plugins, null, 2) + '\n');
