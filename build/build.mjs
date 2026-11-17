// The build: reads site/ and content/, writes a static site to dist/.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIST_DIR, DEV_DIST_DIR, KATEX_DIR, ROOT, RESERVED_SLUGS, projectPaths, loadSiteData, isUrl, lineIndex } from './config.mjs';
import { loadContent, loadPages } from './content.mjs';
import { loadOrder, arrange, orderWarnings } from './order.mjs';
import { renderTex } from './tex.mjs';
import { citeRefs } from './cite.mjs';
import { esc, isoDate } from './html.mjs';
import * as L from './layouts.mjs';
import { faviconSvg } from './logo.mjs';
import { texToPlain } from './plain.mjs';
import { lintPage } from './lint.mjs';
import { rewriteTex } from './tex-scan.mjs';

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

// A file the build writes into an output folder it owns; see prepareOutDir.
const MARKER = '.mm-build';

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p));
  }
  return out;
}

const inside = (child, parent) => {
  const r = path.relative(parent, child);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};

// The output folder is deleted and rewritten, so refuse anything that could
// hold sources: the project itself or a folder containing it, a source folder,
// or a non-empty folder that is not an earlier build output.
function prepareOutDir(outDir, root) {
  const out = path.resolve(outDir);
  if (inside(root, out)) throw new Error(`refusing to build into ${out}: it contains the project`);
  for (const d of ['site', 'content', 'build', 'scripts', 'test', 'docs', 'tools', 'node_modules', '.git']) {
    if (inside(out, path.join(root, d))) throw new Error(`refusing to build into ${out}: it is inside ${d}/`);
  }
  if (fs.existsSync(out)) {
    const known = out === DIST_DIR || out === DEV_DIST_DIR || path.basename(out).startsWith('.dev-dist');
    const entries = fs.readdirSync(out);
    if (entries.length && !entries.includes(MARKER) && !known) {
      throw new Error(`refusing to build into ${out}: it is not empty and not an earlier build output`);
    }
  }
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, MARKER), '');
  return out;
}

// Writes files into the output folder, refusing to write one path twice (two
// pages claiming the same URL).
function makeWriter(out, errors) {
  const written = new Map();
  return (rel, content, owner) => {
    const key = rel.split(path.sep).join('/');
    if (written.has(key)) {
      errors.push({ file: owner, line: 1, message: `writes ${key}, which ${written.get(key)} also writes` });
      return;
    }
    written.set(key, owner);
    const file = path.join(out, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
}

// Adds ?v=<hash> to the relative url()s of a stylesheet, so fonts and images
// it refers to are fetched again when they change.
function hashCssUrls(css, cssFile) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => {
    if (isUrl(u) || u.startsWith('#')) return m;
    const target = path.resolve(path.dirname(cssFile), u.split(/[?#]/)[0]);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return m;
    return `url(${q}${u}${u.includes('?') ? '&' : '?'}v=${hash(fs.readFileSync(target))}${q})`;
  });
}

// The browser runtime, one file: site.js with tex-scan.mjs, plain-core.mjs and
// cite.mjs (without `export`)
// and components.js inlined where their placeholders are.
const RUNTIME_PARTS = new Set(['js/components.js']);
function buildSiteJs(paths) {
  const part = (file) => fs.readFileSync(path.join(ROOT, 'build', file), 'utf8').replace(/^export /gm, '');
  const components = fs.readFileSync(path.join(paths.site, 'assets', 'js', 'components.js'), 'utf8');
  const site = fs.readFileSync(path.join(paths.site, 'assets', 'js', 'site.js'), 'utf8');
  return site
    .replace('/* @tex-scan */', () => part('tex-scan.mjs'))
    .replace('/* @plain-core */', () => part('plain-core.mjs'))
    .replace('/* @cite */', () => part('cite.mjs'))
    .replace('/* @components */', () => components);
}

// Copies site assets and KaTeX; returns { key: '/assets/key?v=hash' }.
function copyAssets(write, paths) {
  const assets = {};
  const srcDir = path.join(paths.site, 'assets');
  for (const rel of walk(srcDir)) {
    const key = rel.split(path.sep).join('/');
    if (RUNTIME_PARTS.has(key)) continue; // inlined into site.js
    const src = path.join(srcDir, rel);
    let content = key === 'js/site.js' ? buildSiteJs(paths) : fs.readFileSync(src);
    if (key.endsWith('.css')) content = hashCssUrls(content.toString(), src);
    write(path.join('assets', rel), content, `site/assets/${key}`);
    assets[key] = `/assets/${key}?v=${hash(content)}`;
  }
  // the favicon in the theme's accents, read from theme.css so the two cannot drift
  let theme = '';
  try { theme = fs.readFileSync(path.join(srcDir, 'css', 'theme.css'), 'utf8'); } catch { /* a site without a theme: the defaults */ }
  const token = (name) => (new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\b`).exec(theme) || [])[1];
  const favicon = faviconSvg({ ink: token('accent'), dot: token('accent-2') });
  write(path.join('assets', 'img', 'favicon.svg'), favicon, 'build/logo.mjs');
  assets['img/favicon.svg'] = `/assets/img/favicon.svg?v=${hash(favicon)}`;
  for (const f of ['katex.min.css', 'katex.min.js']) {
    const content = fs.readFileSync(path.join(KATEX_DIR, f));
    write(path.join('assets', 'katex', f), content, 'katex');
    assets[`katex/${f}`] = `/assets/katex/${f}?v=${hash(content)}`;
  }
  for (const f of fs.readdirSync(path.join(KATEX_DIR, 'fonts')).filter((f) => f.endsWith('.woff2'))) {
    write(path.join('assets', 'katex', 'fonts', f), fs.readFileSync(path.join(KATEX_DIR, 'fonts', f)), 'katex');
  }
  return assets;
}

// Up to `limit` other pages, most shared tags first, then newest.
function relatedTo(item, items, limit = 3) {
  return items
    .filter((o) => o !== item)
    .map((o) => {
      const shared = o.data.tags.filter((t) => item.data.tags.includes(t));
      return { item: o, score: shared.length, via: shared[0] };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updated.localeCompare(a.item.updated))
    .slice(0, limit);
}

// A page's designed card image, if it has one: a 1200×630 page that
// `npm run thumbs` photographs. It is never published.
export const THUMB_PAGE = 'thumb.html';

// Renders a page's TeX, checks its CSS and scripts and copies its
// files. Throws only on unexpected failures (caught by the caller).
function preparePage(it, { siteMacros, errors, warnings, write, root }) {
  const d = it.data;
  // Macro bodies get the same rewrites as formulas (\mathbb{1} → 𝟙), so the
  // runtime, which receives them as JSON, agrees with the build.
  it.macros = Object.fromEntries(Object.entries({ ...siteMacros, ...d.macros }).map(([k, v]) => [k, rewriteTex(String(v))]));
  const opts = { macros: it.macros, file: it.file, errors, warnings };
  // [@key] → numbered links to the reference list; a reference the text never
  // cites is a warning (the list keeps only works the text cites)
  const cited = citeRefs(it.body, d.references);
  const bodyLineOf = lineIndex(it.body);
  for (const p of cited.problems) errors.push({ file: it.file, line: it.bodyLine + bodyLineOf(p.offset) - 1, message: p.message });
  // scripts may write citations too (MM.setHTML numbers them in the browser)
  const keys = new Set(d.references.map((r) => r.key));
  for (const f of d.scripts) {
    if (isUrl(f) || !fs.existsSync(path.join(it.dir, f))) continue;
    const js = fs.readFileSync(path.join(it.dir, f), 'utf8');
    for (const m of js.matchAll(/\[(@[^\]\n'"`]*)\]/g)) for (const k of m[1].matchAll(/@([A-Za-z0-9][\w-]*)/g)) {
      if (keys.has(k[1])) cited.used.add(k[1]);
      else warnings.push({ file: path.join(path.dirname(it.file), f), line: lineIndex(js)(m.index), message: `citation of "${k[1]}", which is not a key in \`references\`` });
    }
  }
  for (const r of d.references) if (!cited.used.has(r.key)) warnings.push({ file: it.file, line: 1, message: `reference "${r.key}" is never cited in the text (as [@${r.key}])` });
  it.bodyHtml = renderTex(cited.html, { ...opts, line: it.bodyLine });
  // headings and descriptions end up inside headings and card links
  it.headingHtml = renderTex(d.heading || esc(d.title), { ...opts, name: true });
  it.descriptionHtml = renderTex(esc(d.description), { ...opts, name: true });
  it.descriptionText = texToPlain(d.description, it.macros);
  for (const r of d.references) {
    r.titleHtml = renderTex(r.title, { ...opts, name: !!r.url });
    if (r.note) r.noteHtml = renderTex(r.note, opts);
  }
  warnings.push(...lintPage(it, root));
  // the page's own stylesheets and scripts, with a content hash for caching
  const fileUrl = (f) => (isUrl(f) ? f : `${it.url}${f}?v=${hash(fs.readFileSync(path.join(it.dir, f)))}`);
  it.styleUrls = d.styles.map(fileUrl);
  it.scriptUrls = d.scripts.map((f) => ({ src: fileUrl(f), module: f.endsWith('.mjs') }));
  if (fs.existsSync(path.join(it.dir, d.image))) it.imageUrl = it.url + d.image;
  else warnings.push({ file: it.file, line: 1, message: `no image "${d.image}" yet (run npm run thumbs -- ${it.slug})` });
  for (const rel of walk(it.dir)) {
    if (rel === 'index.html' || rel === THUMB_PAGE) continue;
    const src = path.join(it.dir, rel);
    const content = rel.endsWith('.css') ? hashCssUrls(fs.readFileSync(src, 'utf8'), src) : fs.readFileSync(src);
    write(path.join(it.slug, rel), content, it.file);
  }
}

// thumbs: also write each page's thumb.html, as /<slug>/thumb.html (in
// dev builds, to work on it, and for npm run thumbs).
export async function build({ outDir = DIST_DIR, dev = false, drafts = dev, thumbs = dev, root = ROOT } = {}) {
  const errors = [];
  const warnings = [];
  const paths = projectPaths(root);
  const { site, tags, macros: siteMacros } = loadSiteData(paths);
  const { order, errors: orderErrors } = loadOrder(paths, tags);
  errors.push(...orderErrors);
  const { pages, errors: pageErrors } = loadPages(paths);
  errors.push(...pageErrors);
  for (const p of pages) {
    if (RESERVED_SLUGS.has(p.name)) errors.push({ file: p.file, line: 1, message: `"${p.name}" is taken by the site; rename the page` });
  }
  const reserved = new Set([...RESERVED_SLUGS, ...pages.map((p) => p.name)]);
  const { items: loaded, errors: loadErrors } = loadContent({ tags, includeDrafts: drafts, paths, reserved });
  errors.push(...loadErrors);

  const out = prepareOutDir(outDir, root);
  const write = makeWriter(out, errors);
  const assets = copyAssets(write, paths);
  const ctx = { site, tags, assets, dev, macros: siteMacros };

  const items = [];
  for (const it of loaded) {
    try {
      preparePage(it, { siteMacros, errors, warnings, write, root });
      items.push(it);
    } catch (err) {
      errors.push({ file: it.file, line: 1, message: `could not be built: ${err.message}` });
    }
  }

  // topics in order (site/order.yml), each with its pages in order
  const topics = arrange(items, tags, order);
  warnings.push(...orderWarnings(items, order, (slug) => fs.existsSync(path.join(paths.content, slug, 'index.html'))));
  const urls = [{ url: '/' }];

  for (const it of items) {
    write(path.join(it.slug, 'index.html'), L.contentPage(ctx, it, relatedTo(it, items)), it.file);
    urls.push({ url: it.url, lastmod: isoDate(it.updated) });
  }
  write('index.html', L.homePage(ctx, topics), 'home page');
  write(path.join('tags', 'index.html'), L.tagsIndexPage(ctx, topics), 'topics page');
  urls.push({ url: '/tags/' });
  for (const t of topics) {
    write(path.join('tags', t.slug, 'index.html'), L.tagPage(ctx, t), `topic ${t.slug}`);
    urls.push({ url: `/tags/${t.slug}/` });
  }
  for (const p of pages) {
    if (p.data.dev_only && !dev) continue; // e.g. the component gallery
    try {
      const opts = { macros: siteMacros, file: p.file, errors, warnings };
      p.bodyHtml = renderTex(p.body, { ...opts, line: p.bodyLine });
      p.headingHtml = renderTex(p.data.heading || esc(p.data.title), { ...opts, name: true });
      write(path.join(p.name, 'index.html'), L.simplePage(ctx, p), p.file);
      if (!p.data.dev_only) urls.push({ url: p.url });
    } catch (err) {
      errors.push({ file: p.file, line: 1, message: `could not be built: ${err.message}` });
    }
  }
  if (thumbs) {
    for (const it of items) {
      const src = path.join(it.dir, THUMB_PAGE);
      if (!fs.existsSync(src)) continue;
      const file = path.relative(root, src);
      try {
        const body = renderTex(fs.readFileSync(src, 'utf8'), { macros: it.macros, file, errors, warnings });
        write(path.join(it.slug, THUMB_PAGE), L.thumbPage(ctx, it, body), file);
      } catch (err) {
        errors.push({ file, line: 1, message: `could not be built: ${err.message}` });
      }
    }
  }
  write('404.html', L.notFoundPage(ctx), '404 page');
  write('feed.xml', L.feed(ctx, items), 'feed');
  write('sitemap.xml', L.sitemap(ctx, urls), 'sitemap');
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`, 'robots.txt');
  write('.nojekyll', '', '.nojekyll');

  return { errors, warnings, outDir: out, count: items.length };
}

export function formatMessages(list, label) {
  return list.map((m) => `${label} ${m.file}:${m.line}: ${m.message}`).join('\n');
}
