// W-37: the elements' machine-readable contract, and everything editors and frameworks read from it.
// Writes, from the element sources, their TSDoc and the built declarations (no dependencies — TypeScript 7
// has no stable compiler API, and the open-wc analyzer brings TypeScript 5; this reads our own files):
//   packages/grid/custom-elements.json          Custom Elements Manifest 2.1.0 (committed; `customElements` in package.json)
//   packages/grid/src/frameworks/*.d.ts         typings for React 19 (jsx), Vue 3, Svelte, Solid (committed)
//   packages/grid/dist/frameworks/*.{d.ts,js}   the same, published, each with an empty runtime module
//   packages/grid/dist/vscode.html-custom-data.json, vscode.css-custom-data.json, web-types.json
// Run by `pnpm --filter @sheetpane/grid build` after `tsc`; `generate({ dts })` is what test/manifest.test.ts
// compares with the committed files. Deterministic: the same sources give the same bytes.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const GRID = join(root, 'packages/grid');
const BLOB = 'https://github.com/arpitarya/sheetpane/blob/main';

/** The element sources, as `src/index.ts` registers them: `define('tag', Class)`. */
export function elementSources() {
  const index = readFileSync(join(GRID, 'src/index.ts'), 'utf8');
  const from = new Map([...index.matchAll(/export \{ (\w+) \} from '\.\/([\w/]+)\.js'/g)].map((m) => [m[1], m[2]]));
  return [...index.matchAll(/define\('([\w-]+)', (\w+)\)/g)].map((m) => ({ tag: m[1], name: m[2], path: from.get(m[2]) }));
}

// ── what the TSDoc cannot say: token descriptions and the event payloads' field types ──────────────
const TOKEN_DOC = {
  ground: 'The ground behind panels: toolbar, cell bar, status line.', surface: 'Panels, buttons and inputs.',
  sunken: 'Sunken fills: segmented controls, chips, tracks.', line: 'Hairline borders.', 'line-strong': 'Borders of controls.',
  cell: 'The cell background.', head: 'Row and column headers.', grid: 'Cell gridlines.',
  ink: 'Body text.', 'ink-2': 'Secondary text.', 'ink-3': 'Muted text and icons.',
  accent: 'Selection, focus ring and primary buttons.', 'accent-ink': 'Accent text and pressed primary buttons.', 'accent-soft': 'The selected range and active rows.',
  pass: 'Resolved, passing.', 'pass-soft': 'Resolved, passing — the tint.', fail: 'Errors.', 'fail-soft': 'Errors — the tint.',
  warn: 'Warnings.', 'warn-soft': 'Warnings — the tint.', changed: 'The changed-cell mark.', 'changed-soft': 'The changed-cell mark — the tint.',
  note: 'Notes.', 'ref-1': 'The first reference colour (formula ranges, plugins).', 'ref-2': 'The second reference colour.', 'ref-3': 'The third reference colour.',
  'on-solid': 'Text on solid fills: pins, badges, primary buttons.', hit: 'Find hits.', 'hit-current': 'The current find hit.',
  'r-sm': 'Small radius.', r: 'Radius.', 'r-lg': 'Large radius (panels).', 'r-xl': 'Extra-large radius (the pop-up).',
  shadow: 'Menus, callouts and pop-overs.', 'shadow-lg': 'The pop-up dialog.',
};
/** Custom properties read with a fallback (`var(--sp-x, default)`) rather than set as a token. */
const EXTRA_DOC = { 'cell-font-size': 'The cell text size (SR-GRID decision 15).' };
/** Field → type, for the payload literals in `@fires` lines; per-event entries win. */
const FIELD = {
  sheet: 'string', ref: 'string', range: 'string | undefined', axis: "'col' | 'row'", indexes: 'number[]', px: 'number | number[]', via: "'drag' | 'fit' | 'menu' | 'reset'", was: 'unknown', now: 'unknown', value: 'unknown', draft: 'string',
  column: '{ index: number; letter: string; header: string }', errors: 'SheetpaneError[]', plugins: 'string[]', error: 'SheetpaneError',
  mode: 'Mode', reason: "'undo' | 'redo' | 'cleared'", canUndo: 'boolean', canRedo: 'boolean',
  blob: 'Blob', name: 'string', guarded: 'string[] | false', format: "'xlsx' | 'csv'", converted: 'boolean', original: 'boolean',
  sheets: 'string[]', readMs: 'number', sha256: 'string | undefined', code: 'string', spCode: 'SpCode', message: 'string', detail: 'string',
};
const FIELD_BY_EVENT = { 'sheetpane-visibility': { axis: "'row' | 'col' | 'sheet'", via: "'menu' | 'key' | 'marker' | 'reveal'", hidden: 'boolean' }, 'sheetpane-change': { kind: 'ChangeKind' }, 'sheetpane-load': { kind: "'xlsx' | 'csv'" }, 'sheetpane-export': { kind: "'xlsx' | 'csv'" } };
/** The type names payloads use, all exported by `@sheetpane/grid`. */
const PAYLOAD_TYPES = ['ChangeKind', 'Mode', 'SheetpaneError', 'SpCode'];
const LIFECYCLE = new Set(['connectedCallback', 'disconnectedCallback', 'attributeChangedCallback', 'adoptedCallback']);

// ── reading ────────────────────────────────────────────────────────────────────────────────────────
const squash = (s) => s.replace(/\s+/g, ' ').replace(/;\s*\}/g, ' }').trim();
const docText = (raw) => raw.replace(/^\/\*\*|\*\/$/g, '').split('\n').map((l) => l.replace(/^\s*\* ?/, '')).join('\n').trim();

/** Splits text on `sep` at nesting depth 0 (braces, brackets, parentheses, generics; `=>` is not a bracket). */
function splitTop(text, sep) {
  const out = []; let depth = 0, quote = '', cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { cur += c; if (c === quote && text[i - 1] !== '\\') quote = ''; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if ('{[(<'.includes(c)) depth++;
    else if ('}])'.includes(c) || (c === '>' && text[i - 1] !== '=')) depth--;
    else if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** The class's TSDoc and its public members, from the built declaration file. */
function readDeclaration(dts, name) {
  const m = new RegExp(String.raw`(\/\*\*(?:(?!\*\/)[\s\S])*\*\/)\s*export declare class ${name} extends (\w+) \{\n([\s\S]*?)\n\}`).exec(dts);
  if (!m) throw new Error(`build-manifest: class ${name} not found in its .d.ts`);
  const [, rawDoc, , body] = m;
  // statements, each with the doc comment just before it
  const stmts = []; let doc, cur = '', depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('/**', i)) { const end = body.indexOf('*/', i); doc = docText(body.slice(i, end + 2)); i = end + 1; continue; }
    if (body.startsWith('//', i)) { i = body.indexOf('\n', i); if (i < 0) break; continue; }
    const c = body[i];
    if ('{[(<'.includes(c)) depth++;
    else if ('}])'.includes(c) || (c === '>' && body[i - 1] !== '=')) depth--;
    if (c === ';' && depth === 0) { stmts.push({ text: squash(cur), doc }); cur = ''; doc = undefined; continue; }
    cur += c;
  }
  const fields = new Map(), methods = [];
  for (const { text, doc } of stmts) {
    if (/^(private|protected|static)\b/.test(text)) continue;
    let a;
    if ((a = /^(get|set) (\w+)\((.*)\)(?:: (.*))?$/.exec(text))) {
      const [, kind, n, param, ret] = a;
      const f = fields.get(n) ?? { name: n };
      if (kind === 'get') { f.type = ret; f.getDoc = doc; } else { f.writable = true; f.setType ??= param.replace(/^\w+\??: /, ''); f.setDoc = doc; }
      fields.set(n, f);
    } else if ((a = /^(readonly )?(\w+)(\?)?: (.*)$/.exec(text))) {
      fields.set(a[2], { name: a[2], type: a[4], getDoc: doc, writable: !a[1] });
    } else if ((a = /^(\w+)(<.*?>)?\((.*)\): (.*)$/.exec(text))) {
      if (LIFECYCLE.has(a[1])) continue;
      const parameters = splitTop(a[3], ',').map((p) => {
        const pm = /^(\.\.\.)?(\w+)(\?)?: (.*)$/.exec(p);
        return { name: pm[2], ...(pm[3] ? { optional: true } : {}), ...(pm[1] ? { rest: true } : {}), type: { text: pm[4] } };
      });
      methods.push({ name: a[1], doc, parameters, returns: a[4] });
    } else throw new Error(`build-manifest: cannot read member "${text}" of ${name}`);
  }
  return { doc: docText(rawDoc), fields: [...fields.values()].map((f) => ({ ...f, type: f.type ?? f.setType, description: f.getDoc ?? f.setDoc })), methods };
}

/** The class TSDoc's parts: intro, the Attributes list, @fires, @slot, @csspart, @see. */
function readDoc(doc) {
  const intro = doc.split(/\n\s*\n/)[0].replace(/\s*\n\s*/g, ' ');
  const attrs = []; const lines = doc.split('\n');
  const at = lines.findIndex((l) => /^Attributes:\s*$/.test(l));
  if (at >= 0) for (let i = at + 1; i < lines.length && lines[i].trim(); i++) {
    const m = /^- `([\w-]+)` — (.*)$/.exec(lines[i]);
    if (m) attrs.push({ name: m[1], text: m[2] }); else if (attrs.length) attrs.at(-1).text += ` ${lines[i].trim()}`;
  }
  const tag = (t) => [...doc.matchAll(new RegExp(String.raw`^@${t} ([\w-]+) (?:- )?(.*)$`, 'gm'))].map((m) => ({ name: m[1], text: m[2].trim() }));
  const listed = (label) => [...(new RegExp(String.raw`^${label}: ([\s\S]*?)\.\n`, 'm').exec(doc)?.[1] ?? '').matchAll(/`(\w+)/g)].map((m) => m[1]);
  return { intro, attrs, fires: tag('fires'), slots: tag('slot'), parts: tag('csspart'), see: [...doc.matchAll(/^@see (\S+)/gm)].map((m) => m[1]), properties: listed('Properties'), methods: listed('Methods') };
}

/** An attribute's value type, from its TSDoc line: a leading list of `values` is an enum. */
function attrType(text, mirror) {
  const lead = /^((?:`[\w-]+`(?: \([^)]*\))?(?:,? (?:or )?)?)+)/.exec(text)?.[1] ?? '';
  const values = [...lead.replace(/\([^)]*\)/g, '').matchAll(/`([\w-]+)`/g)].map((m) => m[1]);
  const dflt = /`([\w-]+)` \(the default\)/.exec(text)?.[1] ?? /\(default (\w+)\)/.exec(text)?.[1];
  if (values.length > 1) return { text: values.map((v) => `'${v}'`).join(' | '), values, ...(dflt ? { default: `'${dflt}'` } : {}) };
  if (mirror?.type === 'boolean') return { text: 'boolean', boolean: true };
  if (dflt && /^\d+$/.test(dflt)) return { text: 'number', default: dflt };
  return { text: 'string' };
}

/** `{ a, b?, c: 'x' }` → `{ a: A; b?: B; c: 'x' }`, typed by FIELD. */
function payloadType(literal, event) {
  const inner = literal.trim().replace(/^\{|\}$/g, '').trim();
  if (!inner) return 'Record<string, never>';
  const parts = splitTop(inner, ',').map((p) => {
    const m = /^(\w+)(\?)?(?:: (.*))?$/.exec(p.trim());
    if (!m) throw new Error(`build-manifest: cannot read payload field "${p}" of ${event}`);
    const t = m[3] ?? FIELD_BY_EVENT[event]?.[m[1]] ?? FIELD[m[1]];
    if (!t) throw new Error(`build-manifest: no type for payload field "${m[1]}" of ${event} — add it to FIELD`);
    return `${m[1]}${m[2] ?? ''}: ${t}`;
  });
  return `{ ${parts.join('; ')} }`;
}

/** Every `--sp-*` token (tokens.ts) and every `var(--sp-x, default)` fallback in the element sources. */
export function cssProperties() {
  const src = readFileSync(join(GRID, 'src/tokens.ts'), 'utf8');
  const block = (n) => /\{([\s\S]*?)\}/.exec(src.slice(src.indexOf(`export const ${n}`)))[1];
  const pairs = (b) => new Map([...b.matchAll(/(?:'([\w-]+)'|(\w+)):\s*'([^']*)'/g)].map((m) => [m[1] ?? m[2], m[3]]));
  const light = pairs(block('TOKENS')), dark = pairs(block('DARK_TOKENS'));
  const out = [...light].map(([k, v]) => {
    if (!TOKEN_DOC[k]) throw new Error(`build-manifest: token "${k}" has no description — add it to TOKEN_DOC`);
    return { name: `--sp-${k}`, description: `${TOKEN_DOC[k]}${dark.has(k) ? ` Dark theme: \`${dark.get(k)}\`.` : ''}`, default: v };
  });
  const seen = new Set(out.map((p) => p.name));
  for (const f of ['excel/styles.ts', 'excel/element.ts', 'errors/element.ts']) {
    for (const m of readFileSync(join(GRID, 'src', f), 'utf8').matchAll(/var\(--sp-([\w-]+),\s*([^)]+)\)/g)) {
      if (seen.has(`--sp-${m[1]}`)) continue;
      if (!EXTRA_DOC[m[1]]) throw new Error(`build-manifest: --sp-${m[1]} has no description — add it to EXTRA_DOC`);
      seen.add(`--sp-${m[1]}`); out.push({ name: `--sp-${m[1]}`, description: EXTRA_DOC[m[1]], default: m[2].trim() });
    }
  }
  return out;
}

// ── the manifest ───────────────────────────────────────────────────────────────────────────────────
/** Custom Elements Manifest 2.1.0 for the elements, from their sources and declarations in `dts`. */
export function manifest(dts = join(GRID, 'dist')) {
  const css = cssProperties();
  const modules = elementSources().map(({ tag, name, path }) => {
    const src = readFileSync(join(GRID, 'src', `${path}.ts`), 'utf8');
    const decl = readDeclaration(readFileSync(join(dts, `${path}.d.ts`), 'utf8'), name);
    const doc = readDoc(decl.doc);
    const observed = JSON.parse(/static observedAttributes = (\[[^\]]*\])/.exec(src)[1].replace(/'/g, '"'));
    const record = doc.see.find((u) => /\/records\/\d{4}_/.test(u));
    const recordName = record ? `SR-${/\d{4}_([A-Z-]+)\.md/.exec(record)[1]}` : undefined;
    const fieldOf = (attr) => decl.fields.find((f) => f.name.toLowerCase() === attr.replace(/-/g, ''));
    const attrNames = [...doc.attrs.map((a) => a.name), ...observed.filter((a) => !doc.attrs.some((d) => d.name === a))];
    const attributes = attrNames.map((n) => {
      const text = doc.attrs.find((a) => a.name === n)?.text;
      if (!text) throw new Error(`build-manifest: <${tag}> observes "${n}" but its TSDoc Attributes list does not describe it`);
      const f = fieldOf(n), t = attrType(text, f);
      return { name: n, description: text[0].toUpperCase() + text.slice(1), type: { text: t.text }, ...(t.default ? { default: t.default } : {}), ...(f ? { fieldName: f.name } : {}) };
    });
    const members = [
      ...decl.fields.map((f) => {
        const attr = attributes.find((a) => a.fieldName === f.name);
        return { kind: 'field', name: f.name, privacy: 'public', type: { text: f.type }, ...(f.description ? { description: f.description } : {}), ...(f.writable ? {} : { readonly: true }), ...(attr ? { attribute: attr.name, reflects: true } : {}) };
      }),
      ...decl.methods.map((m) => ({ kind: 'method', name: m.name, privacy: 'public', ...(m.doc ? { description: m.doc } : {}), ...(m.parameters.length ? { parameters: m.parameters } : {}), return: { type: { text: m.returns } } })),
    ];
    const events = doc.fires.map((e) => {
      const literals = [...e.text.matchAll(/`(\{[^`]*\})`/g)].map((m) => payloadType(m[1], e.name));
      return { name: e.name, type: { text: `CustomEvent<${[...new Set(literals)].join(' | ') || 'unknown'}>` }, description: e.text };
    });
    const summary = /^(.*?\.)(?:\s|$)/.exec(doc.intro)?.[1] ?? doc.intro;
    return {
      kind: 'javascript-module',
      path: `dist/${path}.js`,
      declarations: [{
        kind: 'class', name, customElement: true, tagName: tag, summary,
        description: `${doc.intro}${record ? `\n\nSee ${recordName}: ${record}` : ''}`,
        superclass: { name: 'HTMLElement' },
        attributes, members, events,
        slots: doc.slots.map((s) => ({ name: s.name, description: s.text })),
        cssParts: doc.parts.map((p) => ({ name: p.name, description: p.text })),
        cssProperties: css,
      }],
      exports: [
        { kind: 'js', name, declaration: { name, module: `dist/${path}.js` } },
        { kind: 'custom-element-definition', name: tag, declaration: { name, module: `dist/${path}.js` } },
      ],
    };
  });
  return { schemaVersion: '2.1.0', readme: 'README.md', modules };
}

// ── from the manifest: editor data ─────────────────────────────────────────────────────────────────
const declarations = (m) => m.modules.flatMap((x) => x.declarations).filter((d) => d.customElement);
const refOf = (d) => { const r = /See (SR-[A-Z-]+): (\S+)$/.exec(d.description); return r ? [{ name: r[1], url: r[2] }] : []; };
const enumValues = (t) => (/^'/.test(t) ? t.split(' | ').map((v) => v.replace(/'/g, '')) : undefined);

function vscodeHtml(m) {
  return {
    version: 1.1,
    tags: declarations(m).map((d) => ({
      name: d.tagName, description: { kind: 'markdown', value: d.summary },
      attributes: d.attributes.map((a) => {
        const values = enumValues(a.type.text);
        return { name: a.name, description: { kind: 'markdown', value: a.description }, ...(values ? { values: values.map((name) => ({ name })) } : {}), ...(a.type.text === 'boolean' ? { valueSet: 'v' } : {}) };
      }),
      references: [...refOf(d), { name: 'README', url: `${BLOB}/packages/grid/README.md#${d.tagName}` }],
    })),
  };
}

function vscodeCss(m) {
  const props = new Map();
  for (const d of declarations(m)) for (const p of d.cssProperties) props.set(p.name, p);
  return { version: 1.1, properties: [...props.values()].map((p) => ({ name: p.name, description: `${p.description} Default: \`${p.default}\`.`, references: [{ name: 'SR-GRID decision 15a', url: `${BLOB}/records/0105_GRID.md` }] })) };
}

function webTypes(m, version) {
  const props = new Map();
  for (const d of declarations(m)) for (const p of d.cssProperties) props.set(p.name, p);
  return {
    $schema: 'https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json',
    name: '@sheetpane/grid', version, 'description-markup': 'markdown', 'js-types-syntax': 'typescript',
    contributions: {
      html: {
        elements: declarations(m).map((d) => ({
          name: d.tagName, description: d.summary, 'doc-url': refOf(d)[0]?.url ?? `${BLOB}/packages/grid/README.md`,
          attributes: d.attributes.map((a) => {
            const values = enumValues(a.type.text);
            return { name: a.name, description: a.description, ...(a.default ? { default: a.default.replace(/'/g, '') } : {}), value: a.type.text === 'boolean' ? { type: 'boolean', kind: 'no-value' } : { type: a.type.text, kind: 'plain' }, ...(values ? { values: values.map((name) => ({ name })) } : {}) };
          }),
          slots: d.slots.map((s) => ({ name: s.name, description: s.description })),
          js: {
            properties: d.members.filter((x) => x.kind === 'field').map((f) => ({ name: f.name, type: f.type.text, ...(f.description ? { description: f.description } : {}) })),
            events: d.events.map((e) => ({ name: e.name, type: e.type.text, description: e.description })),
          },
          css: { parts: d.cssParts.map((p) => ({ name: p.name, description: p.description })), properties: d.cssProperties.map((p) => ({ name: p.name, description: `${p.description} Default: \`${p.default}\`.` })) },
        })),
      },
      css: { properties: [...props.values()].map((p) => ({ name: p.name, description: `${p.description} Default: \`${p.default}\`.` })) },
    },
  };
}

// ── from the manifest: framework typings ───────────────────────────────────────────────────────────
const HEAD = '// Generated by scripts/build-manifest.mjs from custom-elements.json (W-37) — do not edit; run the grid build.\n';
const q = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
const jsdoc = (text, indent = '  ') => (text ? `${indent}/** ${text.replace(/\*\//g, '*\\/').replace(/\s*\n\s*/g, ' ')} */\n` : '');
const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
/** Writable fields a framework may set; an `on…` name is skipped (frameworks read it as a listener — use the attribute). */
const settable = (d) => d.members.filter((x) => x.kind === 'field' && !x.readonly && !/^on[A-Z]/.test(x.name));
const attrTs = (a) => (a.type.text === 'number' ? 'number | `${number}`' : a.type.text);

function elementsDts(m) {
  const blocks = declarations(m).map((d) => {
    const n = d.name;
    return `/** The events \`<${d.tagName}>\` dispatches, by name; each bubbles and is composed. */
export interface ${n}EventMap {
${d.events.map((e) => `${jsdoc(e.description)}  '${e.name}': ${e.type.text};`).join('\n')}
}

/** The attributes \`<${d.tagName}>\` reads, as markup writes them. */
export interface ${n}Attributes {
${d.attributes.map((a) => `${jsdoc(a.description)}  ${q(a.name)}?: ${attrTs(a)} | undefined;`).join('\n')}
}

/** The properties a framework may set on \`<${d.tagName}>\`, typed as the element declares them. */
export interface ${n}Properties {
${settable(d).map((f) => `${jsdoc(f.description)}  ${f.name}?: ${n}['${f.name}'] | undefined;`).join('\n')}
}
`;
  });
  return `${HEAD}import type { ${[...PAYLOAD_TYPES, ...declarations(m).map((d) => d.name)].sort().join(', ')} } from '../index.js';

${blocks.join('\n')}`;
}

const elementTypes = (m) => declarations(m).flatMap((d) => [`${d.name}Attributes`, `${d.name}EventMap`, `${d.name}Properties`]).sort().join(', ');
const importLines = (m) => `import type { ${declarations(m).map((d) => d.name).sort().join(', ')} } from '../index.js';
import type { ${elementTypes(m)} } from './elements.js';

export type { ${elementTypes(m)} } from './elements.js';
`;
const handlers = (d, key, evt = (e) => `${d.name}EventMap['${e.name}']`) => d.events.map((e) => `${jsdoc(e.description, '  ')}  ${q(key(e.name))}?: ((event: ${evt(e)}) => void) | undefined;`).join('\n');

function reactDts(m) {
  const props = declarations(m).map((d) => `/** \`<${d.tagName}>\` in React 19 JSX: attributes, properties and \`onsheetpane-…\` event props (React 19 sets properties and listens to custom events). */
export type ${d.name}ReactProps = ${d.name}Attributes & ${d.name}Properties & {
${handlers(d, (n) => `on${n}`)}
};
`).join('\n');
  return `${HEAD}// React 19: \`import type {} from '@sheetpane/grid/jsx';\` once, e.g. in a .d.ts of the app.
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
${importLines(m)}
${props}
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
${declarations(m).map((d) => `      '${d.tagName}': DetailedHTMLProps<HTMLAttributes<${d.name}>, ${d.name}> & ${d.name}ReactProps;`).join('\n')}
    }
  }
}
`;
}

function vueDts(m) {
  const props = declarations(m).map((d) => `/** \`<${d.tagName}>\` in a Vue 3 template: attributes, properties and \`@sheetpane-…\` listeners (\`onSheetpane…\` props). */
export type ${d.name}VueProps = ${d.name}Attributes & ${d.name}Properties & {
${handlers(d, (n) => camel(`on-${n}`))}
};
`).join('\n');
  return `${HEAD}// Vue 3: \`import type {} from '@sheetpane/grid/vue';\` once, and tell the compiler the tags are custom elements
// (\`compilerOptions.isCustomElement: (tag) => tag.startsWith('sheetpane-')\`).
import type { HTMLAttributes } from 'vue';
${importLines(m)}
${props}
/** A custom element as Vue's language tools read it: the element, with \`$props\` for template checking (the Vue docs' pattern). */
export type VueCustomElement<E extends HTMLElement, P> = new () => E & {
  /** @deprecated For template prop types only; not a property of the element. */
  $props: HTMLAttributes & P;
};

declare module 'vue' {
  interface GlobalComponents {
${declarations(m).map((d) => `    '${d.tagName}': VueCustomElement<${d.name}, ${d.name}VueProps>;`).join('\n')}
  }
}
`;
}

function svelteDts(m) {
  const props = declarations(m).map((d) => `/** \`<${d.tagName}>\` in Svelte: attributes, properties, \`on:sheetpane-…\` (Svelte 4) and \`onsheetpane-…\` (Svelte 5) listeners. */
export type ${d.name}SvelteProps = ${d.name}Attributes & ${d.name}Properties & {
${handlers(d, (n) => `on:${n}`, (e) => `${d.name}EventMap['${e.name}'] & { currentTarget: EventTarget & ${d.name} }`)}
${handlers(d, (n) => `on${n}`, (e) => `${d.name}EventMap['${e.name}'] & { currentTarget: EventTarget & ${d.name} }`)}
};
`).join('\n');
  return `${HEAD}// Svelte 4 and 5: \`import type {} from '@sheetpane/grid/svelte';\` once, e.g. in src/app.d.ts.
import type { HTMLAttributes } from 'svelte/elements';
${importLines(m)}
${props}
declare module 'svelte/elements' {
  interface SvelteHTMLElements {
${declarations(m).map((d) => `    '${d.tagName}': HTMLAttributes<${d.name}> & ${d.name}SvelteProps;`).join('\n')}
  }
}
`;
}

function solidDts(m) {
  const props = declarations(m).map((d) => `/** \`<${d.tagName}>\` in Solid JSX: attributes (also as \`attr:…\`), properties (also as \`prop:…\`) and \`on:sheetpane-…\` listeners. Solid sets a custom element's props as properties, so write an attribute with no property (\`pane\`, \`header-row\`) as \`attr:…\`. */
export type ${d.name}SolidProps = ${d.name}Attributes & ${d.name}Properties & {
${d.attributes.map((a) => `${jsdoc(a.description)}  'attr:${a.name}'?: ${attrTs(a)} | undefined;`).join('\n')}
${settable(d).map((f) => `${jsdoc(f.description)}  'prop:${f.name}'?: ${d.name}['${f.name}'] | undefined;`).join('\n')}
${handlers(d, (n) => `on:${n}`)}
};
`).join('\n');
  return `${HEAD}// Solid: \`import type {} from '@sheetpane/grid/solid';\` once, e.g. in src/env.d.ts.
${importLines(m)}
${props}
declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
${declarations(m).map((d) => `      '${d.tagName}': HTMLAttributes<${d.name}> & ${d.name}SolidProps;`).join('\n')}
    }
  }
}
`;
}

/** Every generated file, by path relative to packages/grid, from the declarations in `dts`. */
export function generate({ dts = join(GRID, 'dist') } = {}) {
  const m = manifest(dts);
  const version = JSON.parse(readFileSync(join(GRID, 'package.json'), 'utf8')).version;
  const json = (x) => `${JSON.stringify(x, null, 2)}\n`;
  const frameworks = { elements: elementsDts(m), jsx: reactDts(m), vue: vueDts(m), svelte: svelteDts(m), solid: solidDts(m) };
  return {
    'custom-elements.json': json(m),
    ...Object.fromEntries(Object.entries(frameworks).map(([k, v]) => [`src/frameworks/${k}.d.ts`, v])),
    'dist/vscode.html-custom-data.json': json(vscodeHtml(m)),
    'dist/vscode.css-custom-data.json': json(vscodeCss(m)),
    'dist/web-types.json': json(webTypes(m, version)),
  };
}

/** The framework entries the build publishes: `dist/frameworks/<name>.d.ts` and an empty `.js` beside it. */
export const FRAMEWORK_ENTRIES = ['jsx', 'vue', 'svelte', 'solid'];

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const files = generate();
  for (const [rel, text] of Object.entries(files)) {
    const p = join(GRID, rel);
    mkdirSync(dirname(p), { recursive: true });
    if (!existsSync(p) || readFileSync(p, 'utf8') !== text) writeFileSync(p, text);
  }
  mkdirSync(join(GRID, 'dist/frameworks'), { recursive: true });
  for (const f of ['elements', ...FRAMEWORK_ENTRIES]) copyFileSync(join(GRID, `src/frameworks/${f}.d.ts`), join(GRID, `dist/frameworks/${f}.d.ts`));
  for (const f of FRAMEWORK_ENTRIES) writeFileSync(join(GRID, `dist/frameworks/${f}.js`), '// Types only: see the .d.ts beside this file (W-37).\nexport {};\n');
}
