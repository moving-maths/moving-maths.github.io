// Checks that every internal link and asset reference in the built site points
// at a file that exists. Reads real start tags only: comments, the contents of
// <script>, <style>, <template> and <textarea>, and escaped text such as code
// samples are ignored. Attribute values may be double-, single- or unquoted.
import fs from 'node:fs';
import path from 'node:path';
import { lineIndex } from './config.mjs';

const URL_ATTRS = new Set(['href', 'src', 'poster', 'xlink:href', 'action', 'data']);

function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

function exists(outDir, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return false; }
  const p = path.join(outDir, decoded);
  if (urlPath.endsWith('/')) return fs.existsSync(path.join(p, 'index.html'));
  return (fs.existsSync(p) && fs.statSync(p).isFile()) || fs.existsSync(path.join(p, 'index.html'));
}

// Blank out comments and raw-text element contents, keeping offsets and lines.
function blankNonMarkup(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<(script|style|template|textarea)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, name, body, close) => open + blank(body) + close);
}

// [{ name, value, index }] for the attributes of the start tag at `tag`.
function attributes(tag, base) {
  const out = [];
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const body = tag.replace(/^<[a-zA-Z][\w:-]*/, (m) => ' '.repeat(m.length));
  let m;
  while ((m = re.exec(body))) {
    const value = m[2] ?? m[3] ?? m[4];
    if (value !== undefined) out.push({ name: m[1].toLowerCase(), value, index: base + m.index });
  }
  return out;
}

export function checkLinks(outDir) {
  const problems = [];
  for (const file of htmlFiles(outDir)) {
    const src = fs.readFileSync(file, 'utf8');
    const markup = blankNonMarkup(src);
    const lineOf = lineIndex(src);
    const pageUrl = '/' + path.relative(outDir, file).split(path.sep).join('/');
    const tagRe = /<[a-zA-Z][\w:-]*(?:\s+(?:[^"'>]|"[^"]*"|'[^']*')*)?\/?>/g;
    let t;
    while ((t = tagRe.exec(markup))) {
      for (const a of attributes(t[0], t.index)) {
        let urls;
        if (a.name === 'srcset') urls = a.value.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);
        else if (URL_ATTRS.has(a.name)) urls = [a.value];
        else continue;
        for (const raw of urls) {
          const url = raw.replace(/&amp;/g, '&').trim();
          if (!url || /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue;
          const pathPart = url.replace(/[?#].*$/, '');
          if (!pathPart) continue;
          const where = { file: path.relative(outDir, file), line: lineOf(a.index) };
          let resolved;
          try { resolved = new URL(pathPart, 'http://x' + pageUrl).pathname; } catch {
            problems.push({ ...where, message: `malformed link ${raw}` });
            continue;
          }
          if (!exists(outDir, resolved)) problems.push({ ...where, message: `broken link ${raw}` });
        }
      }
    }
  }
  return problems;
}
