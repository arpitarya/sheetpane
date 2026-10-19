// One version's GitHub Release, from its CHANGELOG section (SR-BUILD decision 9): the body, or with
// --title the title `v<version> — <summary>` from the heading `## <version> — <summary> (<date>)`.
// Fails when the section, its notes or its summary is missing, so no release goes out bare.
// Usage: node scripts/release-notes.mjs 0.2.0 > notes.md · node scripts/release-notes.mjs 0.2.0 --title
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(v ?? '')) { console.error('usage: release-notes.mjs <semver>'); process.exit(1); }
const text = readFileSync(fileURLToPath(new URL('../CHANGELOG.md', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const esc = v.replace(/[.]/g, '\\.');
const m = new RegExp(`^## ${esc}(?: — ([^\\n]*?))?(?: \\((\\d{4}-\\d{2}-\\d{2})\\))?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(text);
const summary = m?.[1]?.trim(), body = m?.[3].trim();
if (process.argv.includes('--title')) {
  if (!summary) { console.error(`CHANGELOG.md's "## ${v}" heading has no summary — write "## ${v} — <what this release is> (<date>)"`); process.exit(1); }
  process.stdout.write(`v${v} — ${summary}\n`);
  process.exit(0);
}
if (!body) { console.error(`CHANGELOG.md has no "## ${v}" section with notes — write it before the release`); process.exit(1); }
process.stdout.write(`${body}\n`);
