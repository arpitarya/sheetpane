// Copies the sample workbook and its rules file from @sheetpane/fixtures into public/, where the
// app loads them from (`src="/showcase.xlsx"`, `rules-src="/showcase.rules.json"`).
// When the app loads your own files, delete this script and its call in package.json.
import { copyFileSync, mkdirSync } from 'node:fs';
import { path } from '@sheetpane/fixtures';

mkdirSync('public', { recursive: true });
for (const name of ['showcase.xlsx', 'showcase.rules.json']) copyFileSync(path(name), `public/${name}`);
