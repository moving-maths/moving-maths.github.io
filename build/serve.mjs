// Development server: serves the site, rebuilds on change, reloads the browser.
// Each rebuild runs in a child process, so edits to build/ apply at once. The
// build goes to a fresh folder that is then swapped in, so a page never sees a
// half-written site.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, DEV_DIST_DIR } from './config.mjs';
import { serveStatic, TYPES } from './static.mjs';

const NEXT_DIR = DEV_DIST_DIR + '-next';
const OLD_DIR = DEV_DIST_DIR + '-old';

const RELOAD_JS = `(() => {
  const es = new EventSource('/__dev/events');
  es.addEventListener('reload', () => location.reload());
  fetch('/__dev/status').then(r => r.json()).then(s => {
    if (!s.errors.length) return;
    const box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:auto 12px 12px 12px;z-index:99999;max-height:50vh;overflow:auto;background:#fff4f2;color:#7a1a0a;border:1px solid #e5a596;border-radius:10px;padding:12px 16px;font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;box-shadow:0 8px 30px rgba(0,0,0,.2)');
    box.textContent = 'Build errors\\n\\n' + s.errors.map(e => e.file + ':' + e.line + ': ' + e.message).join('\\n');
    box.onclick = () => box.remove();
    document.body.appendChild(box);
  });
})();`;

// Swaps the freshly built folder into place.
function swapIn() {
  if (!fs.existsSync(NEXT_DIR)) return;
  fs.rmSync(OLD_DIR, { recursive: true, force: true });
  if (fs.existsSync(DEV_DIST_DIR)) fs.renameSync(DEV_DIST_DIR, OLD_DIR);
  fs.renameSync(NEXT_DIR, DEV_DIST_DIR);
  fs.rm(OLD_DIR, { recursive: true, force: true }, () => {});
}

// host defaults to localhost: drafts stay on this machine unless asked
// (npm run dev -- --host 0.0.0.0 to test from a phone on the same network).
export function serve({ port = 8080, host = '127.0.0.1' } = {}) {
  const clients = new Set();
  let status = { errors: [], warnings: [] };
  let building = false, again = false, timer = null;

  function rebuild() {
    if (building) { again = true; return; }
    building = true;
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, 'build', 'cli.mjs'), 'build', '--dev', '--json', '--out', NEXT_DIR], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('close', () => {
      building = false;
      try { status = JSON.parse(out); } catch { status = { errors: [{ file: 'build', line: 0, message: out.trim() || 'build crashed' }], warnings: [] }; }
      try { swapIn(); } catch (err) { status.errors.push({ file: 'build', line: 0, message: `could not swap in the new build: ${err.message}` }); }
      const msg = status.errors.length ? `${status.errors.length} error(s)` : 'ok';
      console.log(`[dev] rebuilt in ${Date.now() - t0} ms: ${msg}`);
      for (const e of status.errors) console.log(`  error ${e.file}:${e.line}: ${e.message}`);
      if (again) { again = false; rebuild(); return; } // reload once the last change is built
      for (const c of clients) c.write('event: reload\ndata: x\n\n');
    });
  }

  const notFound = (res) => {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    const page = path.join(DEV_DIST_DIR, '404.html');
    let html = '<!doctype html><title>Not found</title><p>Not found (the site may be rebuilding).</p><script src="/__dev/reload.js"></script>';
    try { html = fs.readFileSync(page); } catch { /* not built yet */ }
    res.end(html);
  };

  const server = http.createServer((req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/__dev/reload.js') { res.writeHead(200, { 'content-type': TYPES['.js'] }); return res.end(RELOAD_JS); }
    if (pathname === '/__dev/status') { res.writeHead(200, { 'content-type': TYPES['.json'] }); return res.end(JSON.stringify(status)); }
    if (pathname === '/__dev/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': hi\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    serveStatic(req, res, DEV_DIST_DIR, { notFound, headers: { 'cache-control': 'no-store' } });
  });
  server.on('error', (err) => {
    console.error(err.code === 'EADDRINUSE' ? `[dev] port ${port} is in use (is another npm run dev running?)` : `[dev] ${err.message}`);
    process.exit(1);
  });
  // claim the port first, so a second copy fails before touching the build
  server.listen(port, host, () => {
    console.log(`[dev] http://${host === '127.0.0.1' ? 'localhost' : host}:${port}/`);
    for (const dir of ['site', 'content', 'build']) {
      fs.watch(path.join(ROOT, dir), { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(rebuild, 120);
      });
    }
    rebuild();
  });
}
