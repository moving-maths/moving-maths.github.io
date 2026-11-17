// Loads pages and standalone pages and checks their front matter.
// Problems are collected as { file, line, message }, never thrown, so one run
// reports all of them.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { projectPaths, RESERVED_SLUGS, SLUG_RE, isUrl } from './config.mjs';
import { isoDate } from './html.mjs';

// Splits `---\nYAML\n---\nbody`. Returns { data, body, bodyLine, yaml } where
// bodyLine is the 1-based line on which the body starts; throws Error with a
// message (no file name) when the front matter is missing or unusable.
export function parseFrontMatter(src) {
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);
  const open = /^---[ \t]*\r?\n/.exec(src);
  if (!open) throw new Error('missing front matter (the file must start with a --- line)');
  const close = /^---[ \t]*$/m.exec(src.slice(open[0].length));
  if (!close) throw new Error('front matter is not closed (no second --- line)');
  const yaml = src.slice(open[0].length, open[0].length + close.index);
  const afterClose = open[0].length + close.index + close[0].length;
  const bodyStart = src[afterClose] === '\r' ? afterClose + 2 : src[afterClose] === '\n' ? afterClose + 1 : afterClose;
  checkDoubleQuotedTex(yaml, 2);
  let data;
  try {
    data = YAML.parse(yaml);
  } catch (err) {
    throw new Error(`front matter is not valid YAML: ${err.message.split('\n')[0]}`);
  }
  if (data == null) data = {};
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('front matter must be a list of `key: value` lines');
  const bodyLine = src.slice(0, bodyStart).split('\n').length;
  return { data, body: src.slice(bodyStart), bodyLine, yaml };
}

// In a double-quoted YAML string a backslash starts an escape: "\to" becomes a
// tab and "o", "\neq" a newline and "eq". TeX in front matter must therefore be
// single-quoted (or plain); catch the mistake rather than render nonsense.
function checkDoubleQuotedTex(yaml, firstLine) {
  const re = /"((?:[^"\\\n]|\\.)*)"/g;
  let m;
  while ((m = re.exec(yaml))) {
    // an odd run of backslashes before a letter is an escape; \xNN, \uNNNN and
    // \UNNNNNNNN are deliberate character escapes and pass
    const bad = /(?<!\\)(?:\\\\)*\\(?!x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})([A-Za-z]+)/.exec(m[1]);
    if (bad) {
      const line = firstLine + yaml.slice(0, m.index).split('\n').length - 1;
      throw new Error(`line ${line}: "\\${bad[1]}" inside double quotes is a YAML escape, not TeX; use single quotes: '…'`);
    }
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v) => {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  try { return isoDate(v) === v; } catch { return false; }
};
const isStr = (v) => typeof v === 'string';
const isStrList = (v) => Array.isArray(v) && v.every(isStr);

const KNOWN_KEYS = new Set([
  'title', 'heading', 'description', 'tags', 'date', 'updated', 'image', 'thumb',
  'references', 'styles', 'scripts', 'katex_runtime', 'macros', 'draft',
]);
// how `npm run thumbs` takes the card image (scripts/thumbs.mjs)
const THUMB_KEYS = ['selector', 'click', 'wait', 'trim', 'style'];

// Returns a list of problems (strings); empty when the front matter is fine.
export function validatePage(data, { tags, dir }) {
  const problems = [];
  for (const k of Object.keys(data)) if (!KNOWN_KEYS.has(k)) problems.push(`unknown front matter key "${k}"`);
  if (!isStr(data.title) || !data.title.trim()) problems.push('`title` is required (plain text)');
  else if (/[$\\<]/.test(data.title)) problems.push('`title` must be plain text; put TeX or HTML in `heading`');
  if (data.heading != null && !isStr(data.heading)) problems.push('`heading` must be text (HTML and TeX allowed)');
  if (!isStr(data.description) || !data.description.trim()) problems.push('`description` is required (text, with optional TeX)');
  else if (/</.test(data.description)) problems.push('`description` is text with optional TeX ($…$), not HTML');
  if (!isStrList(data.tags) || data.tags.length === 0) problems.push('`tags` must list at least one tag');
  else for (const t of data.tags) if (!tags[t]) problems.push(`unknown tag "${t}" (add it to site/tags.yml)`);
  if (!isDate(data.date)) problems.push('`date` is required: a real date, as YYYY-MM-DD');
  if (data.updated != null && !isDate(data.updated)) problems.push('`updated` must be a real date, as YYYY-MM-DD');
  for (const key of ['draft', 'katex_runtime']) {
    if (data[key] != null && typeof data[key] !== 'boolean') problems.push(`\`${key}\` must be true or false`);
  }
  if (data.image != null && (!isStr(data.image) || isUrl(data.image))) problems.push('`image` must be a file name in the folder');
  for (const key of ['styles', 'scripts']) {
    if (data[key] == null) continue;
    if (!isStrList(data[key])) { problems.push(`\`${key}\` must be a list of file names`); continue; }
    for (const f of data[key]) {
      if (isUrl(f)) continue;
      if (!fs.existsSync(path.join(dir, f))) problems.push(`\`${key}\` lists "${f}", which does not exist`);
    }
  }
  if (data.references != null) {
    if (!Array.isArray(data.references)) problems.push('`references` must be a list');
    else data.references.forEach((r, i) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) { problems.push(`references[${i}] must be a map with a \`title\``); return; }
      if (!isStr(r.title) || !r.title.trim()) problems.push(`references[${i}] needs a \`title\` (text)`);
      for (const k of ['authors', 'url', 'note']) if (r[k] != null && !isStr(r[k])) problems.push(`references[${i}].${k} must be text`);
      for (const k of Object.keys(r)) if (!['key', 'title', 'authors', 'url', 'note'].includes(k)) problems.push(`references[${i}] has an unknown key "${k}"`);
      // the name the text cites it by, as [@key]
      if (!isStr(r.key) || !/^[A-Za-z0-9][\w-]*$/.test(r.key)) problems.push(`references[${i}] needs a \`key\` (letters, digits, - and _), cited in the text as [@key]`);
      else if (data.references.findIndex((q) => q && q.key === r.key) !== i) problems.push(`references[${i}]: the key "${r.key}" is used twice`);
    });
  }
  if (data.macros != null) {
    if (typeof data.macros !== 'object' || Array.isArray(data.macros)) problems.push('`macros` must be a map like {\'\\foo\': \'\\mathrm{foo}\'}');
    else for (const [k, v] of Object.entries(data.macros)) {
      if (!/^\\[A-Za-z]+$/.test(k)) problems.push(`macro name "${k}" must be a backslash and letters`);
      if (!isStr(v)) problems.push(`macro ${k} must be text`);
    }
  }
  if (data.thumb != null) {
    const t = data.thumb;
    if (typeof t !== 'object' || Array.isArray(t)) problems.push('`thumb` must be a map (selector, click, wait, trim, style)');
    else {
      for (const k of Object.keys(t)) if (!THUMB_KEYS.includes(k)) problems.push(`\`thumb\` has an unknown key "${k}" (known: ${THUMB_KEYS.join(', ')})`);
      if (t.selector != null && !isStr(t.selector) && !(isStrList(t.selector) && t.selector.length)) problems.push('`thumb.selector` must be a selector or a list of them');
      if (t.wait != null && typeof t.wait !== 'number') problems.push('`thumb.wait` must be a number of milliseconds');
      if (t.click != null && !isStr(t.click) && !isStrList(t.click)) problems.push('`thumb.click` must be a selector or a list of them');
      if (t.trim != null && typeof t.trim !== 'boolean') problems.push('`thumb.trim` must be true or false');
      if (t.style != null && !isStr(t.style)) problems.push('`thumb.style` must be CSS (text)');
    }
  }
  return problems;
}

// Standalone pages: site/pages/<name>.html → /<name>/
export function loadPages(paths = projectPaths()) {
  const dir = path.join(paths.site, 'pages');
  const pages = [];
  const errors = [];
  if (!fs.existsSync(dir)) return { pages, errors };
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const file = path.join(dir, f);
    const rel = path.relative(paths.root, file);
    const name = f.replace(/\.html$/, '');
    try {
      const parsed = parseFrontMatter(fs.readFileSync(file, 'utf8'));
      const d = parsed.data;
      const problems = [];
      if (!isStr(d.title) || !d.title.trim()) problems.push('`title` is required');
      if (d.description != null && !isStr(d.description)) problems.push('`description` must be text');
      if (d.heading != null && !isStr(d.heading)) problems.push('`heading` must be text');
      for (const k of ['wide', 'dev_only']) if (d[k] != null && typeof d[k] !== 'boolean') problems.push(`\`${k}\` must be true or false`);
      if (!SLUG_RE.test(name)) problems.push(`"${name}" is not a valid page name`);
      for (const p of problems) errors.push({ file: rel, line: 1, message: p });
      if (!problems.length) pages.push({ name, file: rel, url: `/${name}/`, data: d, body: parsed.body, bodyLine: parsed.bodyLine });
    } catch (err) {
      errors.push({ file: rel, line: 1, message: err.message });
    }
  }
  return { pages, errors };
}

// Pages: content/<slug>/index.html → /<slug>/. `reserved` are the
// URL names already taken (fixed names and standalone pages).
// The day (UTC) of the last commit that touched a folder, or null outside a
// git checkout or for a folder not yet committed. CI must fetch the whole
// history for this (actions/checkout with fetch-depth: 0).
function lastCommitDay(dir) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', '.'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out ? new Date(out).toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

export function loadContent({ tags, includeDrafts, paths = projectPaths(), reserved = RESERVED_SLUGS }) {
  const items = [];
  const errors = [];
  if (!fs.existsSync(paths.content)) return { items, errors };
  for (const slug of fs.readdirSync(paths.content).sort()) {
    const dir = path.join(paths.content, slug);
    if (slug.startsWith('.') || slug.startsWith('_') || !fs.statSync(dir).isDirectory()) continue;
    const file = path.join(dir, 'index.html');
    const rel = path.relative(paths.root, file);
    if (!fs.existsSync(file)) { errors.push({ file: rel, line: 1, message: 'missing index.html' }); continue; }
    if (!SLUG_RE.test(slug)) {
      errors.push({ file: rel, line: 1, message: `"${slug}" is not a valid folder name (lowercase words joined by hyphens)` });
      continue;
    }
    if (reserved.has(slug)) {
      errors.push({ file: rel, line: 1, message: `"${slug}" is taken by the site (a standalone page or a fixed path); rename the folder` });
      continue;
    }
    let parsed;
    try {
      parsed = parseFrontMatter(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      errors.push({ file: rel, line: 1, message: err.message });
      continue;
    }
    const data = parsed.data;
    // Drafts are left out of production builds before they are checked, so an
    // unfinished draft never breaks a deploy (as long as its YAML parses).
    if (data.draft === true && !includeDrafts) continue;
    const problems = validatePage(data, { tags, dir });
    for (const p of problems) errors.push({ file: rel, line: 1, message: p });
    if (problems.length) continue;
    items.push({
      slug,
      dir,
      file: rel,
      url: `/${slug}/`,
      data: { image: 'thumb.png', styles: [], scripts: [], references: [], macros: {}, ...data },
      // last updated: front matter `updated` if set (it wins, earlier or later),
      // else the last commit to the folder, else `date`
      updated: data.updated || lastCommitDay(dir) || data.date,
      body: parsed.body,
      bodyLine: parsed.bodyLine,
    });
  }
  // most recently updated first, then by title
  items.sort((a, b) => b.updated.localeCompare(a.updated) || a.data.title.localeCompare(b.data.title));
  return { items, errors };
}
