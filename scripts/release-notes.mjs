// Prints one version's CHANGELOG section — the body of its GitHub Release (SR-BUILD decision 9).
// Fails when the section is missing or empty, so a release never goes out without notes.
// Usage: node scripts/release-notes.mjs 0.2.0 > notes.md
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(v ?? '')) { console.error('usage: release-notes.mjs <semver>'); process.exit(1); }
const text = readFileSync(fileURLToPath(new URL('../CHANGELOG.md', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const esc = v.replace(/[.]/g, '\\.');
const m = new RegExp(`^## ${esc}(?: —[^\\n]*)?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(text);
const body = m?.[1].trim();
if (!body) { console.error(`CHANGELOG.md has no "## ${v}" section with notes — write it before the release`); process.exit(1); }
process.stdout.write(`${body}\n`);
