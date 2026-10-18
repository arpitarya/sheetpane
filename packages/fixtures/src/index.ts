// @sheetpane/fixtures — known workbooks for testing a sheetpane host (W-42).
// No dependencies: `url()` for bundlers and browsers, `path()` for Node, `bytes()` for either.
// What each file holds — sheets, titles, features, the errors the rules sample
// produces — is `MANIFEST` (also `files/fixtures.json`).
import { MANIFEST } from './manifest.js';
import { URLS } from './urls.js';

export { MANIFEST };
/** The name of a shipped fixture, its path under `files/`, e.g. `'showcase.xlsx'` or `'csv/bom.csv'`. */
export type FixtureName = (typeof MANIFEST)['files'][number]['name'];
/** One manifest entry: a fixture's kind, the app that saved it, its sheets and titles, and its features. */
export type Fixture = (typeof MANIFEST)['files'][number];

/**
 * The fixture's URL — `new URL(…, import.meta.url)`, which bundlers copy as an asset.
 *
 * @param name - The fixture.
 * @returns Its URL: a `file:` URL in Node, the bundled asset's URL in a browser.
 * @example
 * ```ts
 * import { url } from '@sheetpane/fixtures';
 * excel.setAttribute('src', url('showcase.xlsx').href);
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0115_FIXTURES.md
 */
export function url(name: FixtureName): URL {
  return URLS[name]();
}

/**
 * The fixture's file path (Node). Throws where the fixture is not on disk; use `url()` or `bytes()` there.
 *
 * @param name - The fixture.
 * @returns The absolute path.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0115_FIXTURES.md
 */
export function path(name: FixtureName): string {
  const u = url(name);
  if (u.protocol !== 'file:') throw new Error(`@sheetpane/fixtures: ${name} is not on disk here (${u.href}); use url() or bytes()`);
  const p = decodeURIComponent(u.pathname);
  return /^\/[A-Za-z]:\//.test(p) ? p.slice(1) : p; // a Windows drive
}

/**
 * The fixture's bytes: read from disk in Node, fetched in a browser.
 *
 * @param name - The fixture.
 * @returns The file's bytes.
 * @example
 * ```ts
 * import * as fixtures from '@sheetpane/fixtures';
 * const showcase = await fixtures.bytes('showcase.xlsx');
 * ```
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0115_FIXTURES.md
 */
export async function bytes(name: FixtureName): Promise<Uint8Array> {
  const u = url(name);
  if (u.protocol === 'file:') {
    const fs = 'node:fs/promises';
    // typed by shape, so a browser-only consumer needs no Node types
    const { readFile } = (await import(/* @vite-ignore */ fs)) as { readFile(p: string): Promise<Uint8Array> };
    return new Uint8Array(await readFile(path(name)));
  }
  const res = await fetch(u);
  if (!res.ok) throw new Error(`@sheetpane/fixtures: ${name}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * What a fixture holds, from the manifest.
 *
 * @param name - The fixture.
 * @returns Its manifest entry.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0115_FIXTURES.md
 */
export function info(name: FixtureName): Fixture {
  return MANIFEST.files.find((f) => f.name === name)!;
}

/**
 * A large CSV made on demand (the 250,000-row case is a generator, not a file): Account, Email, Units, Status.
 *
 * @param rows - Data rows under the header; default 250,000.
 * @returns The CSV text, LF line endings, no BOM.
 * @see https://github.com/arpitarya/sheetpane/blob/main/records/0115_FIXTURES.md
 */
export function hugeCsv(rows = 250_000): string {
  const out = ['Account,Email,Units,Status'];
  for (let i = 0; i < rows; i++) out.push(`AC-${String(10000 + (i % 90000)).padStart(5, '0')},p${i}@x.io,${i % 500},${i % 1000 === 0 ? 'TBD' : 'Active'}`);
  return out.join('\n');
}
