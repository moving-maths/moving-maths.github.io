// Paths, shared helpers and site-wide data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { parseMacros } from './macros.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_DIR = path.join(ROOT, 'site');
export const CONTENT_DIR = path.join(ROOT, 'content');
export const DIST_DIR = path.join(ROOT, 'dist');
export const DEV_DIST_DIR = path.join(ROOT, '.dev-dist');
export const KATEX_DIR = path.join(ROOT, 'node_modules', 'katex', 'dist');

// The folders a build reads. `root` is the project (tests build fixture
// projects); KaTeX always comes from this repository's node_modules.
export function projectPaths(root = ROOT) {
  return { root, site: path.join(root, 'site'), content: path.join(root, 'content') };
}

// A page's folder name, and a tag's key: lowercase words joined by hyphens.
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// URL paths a page may not take. Standalone pages (site/pages/*.html)
// are added to these when the site is loaded.
export const RESERVED_SLUGS = new Set(['assets', 'tags', '404', 'feed.xml', 'sitemap.xml', 'robots.txt']);

// An absolute or protocol-relative URL, as opposed to a file in the folder.
export const isUrl = (s) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(String(s));

// lineOf(offset) → 1-based line, for any number of lookups in one text.
export function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

export function loadSiteData(paths = projectPaths()) {
  const read = (f) => fs.readFileSync(path.join(paths.site, f), 'utf8');
  const site = YAML.parse(read('site.yml'));
  const tags = YAML.parse(read('tags.yml')) || {};
  for (const [slug, t] of Object.entries(tags)) {
    if (!SLUG_RE.test(slug)) throw new Error(`site/tags.yml: bad tag slug "${slug}"`);
    if (!t || typeof t.name !== 'string') throw new Error(`site/tags.yml: tag "${slug}" needs a name`);
    t.slug = slug;
  }
  const macros = parseMacros(read('macros.tex'), 'site/macros.tex');
  return { site, tags, macros };
}
