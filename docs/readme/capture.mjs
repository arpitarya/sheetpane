// Regenerates the README's screenshots and demo GIF from the real HTML demo:
//   just build && node docs/readme/capture.mjs
// Needs Playwright's Chromium (PW_CHROMIUM=<path> to use another) and, for the GIF, ffmpeg on PATH.
// The page is examples/html's import map + the two elements on sample.xlsx, checked by holdings.rules.json.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../../scripts/serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const demo = join(here, '../../examples/html');
const importMap = readFileSync(join(demo, 'index.html'), 'utf8').match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const page = (theme) => `<!doctype html><html><head><meta charset="utf-8">${importMap}
<style>body{margin:0;background:${theme === 'dark' ? '#0F1115' : '#F6F6F4'};font-family:-apple-system,"Segoe UI",system-ui,sans-serif}
.pair{display:flex;gap:16px;padding:20px}sheetpane-excel{flex:1;min-width:0;height:660px}sheetpane-errors{width:400px;flex:none;height:660px}</style></head>
<body><div class="pair"></div><script type="module">
import '@sheetpane/grid'; import '@sheetpane/numfmt/ui';
// created after the plugin import, so numfmt is registered before the element connects (SP-3002)
document.querySelector('.pair').innerHTML = '<sheetpane-excel id="x" pane="h" mode="edit" theme="${theme}" plugins="numfmt" rules-src="./.readme-rules.json" flagging="off" src="./sample.xlsx"></sheetpane-excel><sheetpane-errors pane="h" theme="${theme}"></sheetpane-errors>';
</script></body></html>`;

const temp = ['.readme-light.html', '.readme-dark.html', '.readme-rules.json'].map((f) => join(demo, f));
writeFileSync(temp[0], page('light')); writeFileSync(temp[1], page('dark'));
writeFileSync(temp[2], readFileSync(join(here, 'holdings.rules.json')));
const { server, url } = await serve(demo, 0);
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const select = (p, ref) => p.evaluate((r) => document.getElementById('x').select('Holdings', r), ref);
try {
  for (const theme of ['light', 'dark']) {
    const p = await browser.newPage({ viewport: { width: 1640, height: 700 }, deviceScaleFactor: 2, colorScheme: theme });
    await p.goto(`${url}.readme-${theme}.html`);
    await p.waitForTimeout(3000);
    await select(p, 'I6'); await p.waitForTimeout(800);
    await p.screenshot({ path: join(here, `screenshot-${theme}.png`) });
    await p.close();
  }
  // the GIF: fix three errors in the cell bar and watch the panel resolve them
  const frames = join(here, '.frames'); rmSync(frames, { recursive: true, force: true }); mkdirSync(frames);
  const p = await browser.newPage({ viewport: { width: 1800, height: 700 }, deviceScaleFactor: 1.5 });
  const list = []; let n = 0;
  const snap = async (s) => { const f = join(frames, `${String(n++).padStart(4, '0')}.png`); await p.screenshot({ path: f }); list.push(`file '${f}'\nduration ${s}`); };
  await p.goto(`${url}.readme-light.html`); await p.waitForTimeout(3000);
  await select(p, 'A3'); await p.waitForTimeout(400); await snap(1.8);
  for (const [ref, text] of [['C11', 'A. Rao'], ['F10', '150'], ['I6', '0.75%']]) {
    await select(p, ref); await p.waitForTimeout(400); await snap(0.9);
    const input = p.locator('#x [data-sp="cell-input"]'); await input.click(); await input.fill('');
    for (const ch of text) { await input.press(ch === ' ' ? 'Space' : ch); await p.waitForTimeout(60); await snap(0.09); }
    await input.press('Enter'); await p.evaluate(() => document.activeElement?.blur()); await p.waitForTimeout(700); await snap(1.4);
  }
  await select(p, 'J13'); await p.waitForTimeout(400); await snap(2.5);
  list.push(list.at(-1).split('\n')[0]);
  writeFileSync(join(frames, 'list.txt'), list.join('\n'));
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(frames, 'list.txt'), '-vf',
      'scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
      '-vsync', 'vfr', join(here, 'demo.gif')]);
  } catch { console.warn('ffmpeg not found — screenshots written, demo.gif skipped'); }
  rmSync(frames, { recursive: true, force: true });
} finally {
  await browser.close(); server.close();
  for (const f of temp) rmSync(f, { force: true });
}
console.log('docs/readme: screenshot-light.png, screenshot-dark.png, demo.gif');
