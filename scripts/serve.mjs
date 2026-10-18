// A tiny static file server for the demos (no dependency): node scripts/serve.mjs <dir> [port]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv; charset=utf-8', '.xls': 'application/vnd.ms-excel' };

export function serve(dir, port = 0, spa = false, host = '127.0.0.1') {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { if (spa) file = join(root, 'index.html'); }
    try { statSync(file); } catch { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, host, () => ok({ server, url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}/` })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url } = await serve(process.argv[2] ?? '.', Number(process.argv[3] ?? 5173), process.argv.includes('--spa'), process.env.HOST ?? '127.0.0.1');
  console.log(`serving ${process.argv[2]} at ${url}`);
}
