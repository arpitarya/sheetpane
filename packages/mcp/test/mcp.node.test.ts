// W-39 DoD 2, 10: the server over stdio speaks MCP 2026-07-28 (and answers 2025 clients), and every
// tool gives the same answer for the same input — compared with golden files. A malformed input is
// a tool error, never a crash. `UPDATE_GOLDEN=1` rewrites the goldens; review the diff.
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { callTool, TOOLS } from '../src/index.js';

const root = join(import.meta.dirname, '../../..');
const BIN = join(root, 'packages/mcp/dist/bin.js');
const F = 'packages/fixtures/files';
const META = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };

/** Sends lines to the built server and collects one reply per line that has an id. */
function session(lines: string[]): Promise<any[]> {
  return new Promise((done, fail) => {
    const p = spawn(process.execPath, [BIN], { cwd: root });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? done(out.split('\n').filter(Boolean).map((l) => JSON.parse(l))) : fail(new Error(`exit ${code}: ${err}`))));
    p.stdin.end(lines.join('\n') + '\n');
  });
}

describe('the protocol over stdio (DoD 2)', () => {
  it.skipIf(!existsSync(BIN))('discover, legacy initialize, list, call, and every error', async () => {
    const req = (id: number, method: string, params: object = {}) => JSON.stringify({ jsonrpc: '2.0', id, method, params: { _meta: META, ...params } });
    const r = await session([
      req(1, 'server/discover'),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '1' } } }),
      JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      req(3, 'tools/list'),
      req(4, 'tools/call', { name: 'explain_code', arguments: { code: 'SP-1007' } }),
      req(5, 'tools/call', { name: 'no_such_tool', arguments: {} }),
      req(6, 'resources/list'),
      JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1999-01-01' } } }),
      'not json',
      '[{"jsonrpc":"2.0","id":8,"method":"tools/list"}]',
      JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }), // a 2025 client: no _meta
    ]);
    expect(r.map((x) => x.id)).toEqual([1, 2, 3, 4, 5, 6, 7, null, null, 9]); // the notification has no reply
    const [discover, init, list, call, unknownTool, unknownMethod, version, parse, batch, legacyList] = r;
    expect(discover.result).toMatchObject({ resultType: 'complete', supportedVersions: ['2026-07-28', '2025-11-25', '2025-06-18'], capabilities: { tools: {} }, cacheScope: 'public' });
    expect(discover.result._meta['io.modelcontextprotocol/serverInfo'].name).toBe('sheetpane-mcp');
    expect(init.result).toMatchObject({ protocolVersion: '2025-11-25', serverInfo: { name: 'sheetpane-mcp' } });
    expect(init.result.resultType).toBeUndefined();
    expect(list.result).toMatchObject({ resultType: 'complete', cacheScope: 'public' });
    expect(list.result.ttlMs).toBeGreaterThan(0);
    expect(list.result.tools.map((t: any) => t.name)).toEqual(['describe_api', 'inspect_workbook', 'draft_rules', 'check_rules', 'explain_code', 'find_skill']);
    expect(call.result.resultType).toBe('complete');
    expect(JSON.parse(call.result.content[0].text).code).toBe('SP-1007');
    expect(unknownTool.error.code).toBe(-32602);
    expect(unknownMethod.error.code).toBe(-32601);
    expect(version.error).toEqual({ code: -32022, message: 'Unsupported protocol version 1999-01-01', data: { supported: ['2026-07-28', '2025-11-25', '2025-06-18'], requested: '1999-01-01' } });
    expect(parse.error.code).toBe(-32700);
    expect(batch.error.code).toBe(-32600);
    expect(legacyList.result.tools).toHaveLength(6);
    expect(legacyList.result.resultType).toBeUndefined();
  });
});

describe('the tools\' input schemas (DoD 2)', () => {
  for (const t of TOOLS) {
    it(`${t.name}: JSON Schema 2020-12, an object, required names declared, nothing extra`, () => {
      const s = t.inputSchema as { $schema: string; type: string; properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(s.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(s.type).toBe('object');
      expect(s.required.every((k) => k in s.properties)).toBe(true);
      expect(s.additionalProperties).toBe(false);
      expect(t.description.length).toBeGreaterThan(40);
    });
  }
});

/** A tool's text answer, parsed; compared with test/golden/<file>.json. */
async function golden(file: string, name: string, args: Record<string, unknown>) {
  const r = await callTool(name, args);
  expect(r.isError, r.content[0]!.text).toBeUndefined();
  const got = JSON.parse(r.content[0]!.text);
  const p = join(import.meta.dirname, 'golden', `${file}.json`);
  if (process.env.UPDATE_GOLDEN || !existsSync(p)) writeFileSync(p, JSON.stringify(got, null, 2) + '\n');
  expect(got).toEqual(JSON.parse(readFileSync(p, 'utf8')));
}

describe('each tool on the showcase and the rules sample — golden outputs (DoD 3–8, 10)', () => {
  it('inspect_workbook: showcase.xlsx', () => golden('inspect-showcase', 'inspect_workbook', { path: `${F}/showcase.xlsx` }));
  it('inspect_workbook: a semicolon CSV', () => golden('inspect-semicolon', 'inspect_workbook', { path: `${F}/csv/semicolon.csv` }));
  it('inspect_workbook: merged and hidden sheets', async () => {
    await golden('inspect-merged', 'inspect_workbook', { path: `${F}/edge/merged.xlsx` });
    await golden('inspect-hidden', 'inspect_workbook', { path: `${F}/edge/hidden-sheet.xlsx` });
  });
  it('draft_rules: every sheet of the showcase, and one sheet', async () => {
    await golden('draft-showcase', 'draft_rules', { path: `${F}/showcase.xlsx` });
    await golden('draft-validation', 'draft_rules', { path: `${F}/showcase.xlsx`, sheet: 'Validation' });
  });
  it('check_rules: the rules sample against the showcase; a broken file against it', async () => {
    await golden('check-sample', 'check_rules', { rules: readFileSync(join(root, F, 'showcase.rules.json'), 'utf8'), path: `${F}/showcase.xlsx` });
    await golden('check-broken', 'check_rules', { rules: { version: 1, extra: 1, sheets: { Nope: { columns: { X: { type: 'nope', bogus: 1 } } }, '*': { columns: { 'No such title': { required: true } }, cells: { 'not a ref': {} } } } }, path: `${F}/showcase.xlsx` });
    await golden('check-not-json', 'check_rules', { rules: '{ version: 1' });
  });
  it('a drafted rules file checks clean against the file it came from', async () => {
    const d = JSON.parse((await callTool('draft_rules', { path: `${F}/showcase.xlsx` })).content[0]!.text);
    const c = JSON.parse((await callTool('check_rules', { rules: d.rules, path: `${F}/showcase.xlsx` })).content[0]!.text);
    expect(c.problems).toEqual([]);
  });
  it('explain_code: a live code and a retired one', async () => {
    await golden('explain-1002', 'explain_code', { code: 'SP-1002' });
    await golden('explain-1008', 'explain_code', { code: 'sp1008' });
  });
  it('find_skill: a task per kind of work', async () => {
    const top = async (task: string) => JSON.parse((await callTool('find_skill', { task })).content[0]!.text).matches[0]?.name;
    expect(await top('validate values from a JSON rules file per column')).toBe('sheetpane-rules-file');
    expect(await top('React 19 props and refs')).toBe('sheetpane-react');
    expect(await top('place the sheet on a page as a tab')).toBe('sheetpane-embed');
    expect(await top('dark theme and css tokens')).toBe('sheetpane-theming');
    expect(await top('write tests with playwright')).toBe('sheetpane-testing');
    await golden('find-skill-rules', 'find_skill', { task: 'validate values from a JSON rules file per column' });
  });
});

describe('bad input is a tool error, never a crash (DoD 10)', () => {
  const err = async (name: string, args: Record<string, unknown>) => {
    const r = await callTool(name, args);
    expect(r.isError).toBe(true);
    return r.content[0]!.text;
  };
  it('files', async () => {
    expect(await err('inspect_workbook', { path: `${F}/edge/not-a-zip.xlsx` })).toMatch(/^SP-100\d/);
    expect(await err('inspect_workbook', { path: `${F}/edge/legacy.xls` })).toMatch(/^SP-100\d/);
    expect(await err('inspect_workbook', { path: `${F}/nope.xlsx` })).toMatch(/^SP-7002: No file at that path — No file at /);
    expect(await err('inspect_workbook', {})).toMatch(/^SP-7001: .*“path” must be/);
    expect(await err('draft_rules', { path: `${F}/showcase.xlsx`, sheet: 'Nope' })).toMatch(/^SP-7005: .*No sheet is named “Nope”/);
  });
  it('codes, rules and tasks', async () => {
    expect(await err('explain_code', { code: 'SP-9999' })).toMatch(/^SP-7006: .*not a sheetpane code/);
    expect(await err('check_rules', {})).toMatch(/^SP-7001: .*“rules” is required/);
    expect(await err('find_skill', { task: 'the of a' })).toMatch(/^SP-7001: .*Describe the task/);
  });
});
