// A small static-file handler, shared by the dev server and the thumbnail
// script. Paths are decoded safely (400 on malformed ones) and must stay inside
// the root folder; read errors (a file deleted by a rebuild mid-request) end
// the response instead of crashing the process.
import fs from 'node:fs';
import path from 'node:path';

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

// Resolves a request path to a file inside root, or returns { status }.
export function resolvePath(root, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return { status: 400 }; }
  if (decoded.includes('\0')) return { status: 400 };
  const p = path.resolve(root, '.' + path.posix.normalize('/' + decoded));
  const rel = path.relative(root, p);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { status: 403 };
  return { file: p };
}

// Serves req from root. Directories get index.html (with a redirect to add the
// trailing slash); missing files get notFound(res) or a plain 404.
export function serveStatic(req, res, root, { notFound, headers = {} } = {}) {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
  const r = resolvePath(root, url.pathname);
  if (r.status) { res.writeHead(r.status); return res.end(); }
  let p = r.file;
  let stat;
  try { stat = fs.statSync(p); } catch { stat = null; }
  if (stat && stat.isDirectory()) {
    if (!url.pathname.endsWith('/')) { res.writeHead(301, { location: url.pathname + '/' + url.search }); return res.end(); }
    p = path.join(p, 'index.html');
    try { stat = fs.statSync(p); } catch { stat = null; }
  }
  if (!stat || !stat.isFile()) {
    if (notFound) return notFound(res);
    res.writeHead(404, { 'content-type': TYPES['.txt'] });
    return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', ...headers });
  const stream = fs.createReadStream(p);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
