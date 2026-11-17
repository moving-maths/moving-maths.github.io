#!/usr/bin/env node
// npm run import -- <artifact.html> <slug>
//
// Turns a self-contained HTML page (for example a Claude artifact) into a
// draft page in content/<slug>/:
//   - removes the document shell, the <title>, font and KaTeX <link>s and
//     <script src> tags, and any inlined KaTeX stylesheet with its fonts
//   - turns already-rendered KaTeX back into TeX ($…$, $$…$$) using the TeX
//     that KaTeX keeps in each <annotation encoding="application/x-tex">
//   - moves <style> blocks to style.css, large `window.X = …` data scripts to
//     data.js and the other inline scripts to main.js
//   - writes front matter with TODOs and `draft: true`
// It then lists what still needs doing by hand (docs/porting-an-artifact.md).
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR, RESERVED_SLUGS, SLUG_RE } from '../build/config.mjs';
import { decodeEntities } from '../build/tex-scan.mjs';

const [input, slug] = process.argv.slice(2);
if (!input || !slug || !SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
  console.error('Usage: npm run import -- <artifact.html> <slug>');
  process.exit(2);
}
const dir = path.join(CONTENT_DIR, slug);
if (fs.existsSync(dir)) {
  console.error(`content/${slug} already exists`);
  process.exit(1);
}

let src = fs.readFileSync(input, 'utf8');
const notes = [];

// Index just past the element that opens at `start` (balanced by tag name).
function elementEnd(s, start, name) {
  const re = new RegExp(`<(/?)${name}(?=[\\s>/])[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(s))) {
    if (m[1]) { depth--; if (depth === 0) return re.lastIndex; }
    else if (!m[0].endsWith('/>')) depth++;
  }
  return s.length;
}

// 1. Rendered KaTeX → TeX. Display first, since it wraps an inline .katex.
function unrender(s, cls, open, close) {
  const re = new RegExp(`<span class="${cls}"[^>]*>`, 'g');
  let out = '', last = 0, m, n = 0;
  while ((m = re.exec(s))) {
    const end = elementEnd(s, m.index, 'span');
    const chunk = s.slice(m.index, end);
    const ann = /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/.exec(chunk);
    if (!ann) continue;
    let tex = decodeEntities(ann[1]).trim();
    if (open === '$') tex = tex.replace(/\n+/g, ' ');
    out += s.slice(last, m.index) + open + tex.replace(/</g, '&lt;') + close;
    last = end;
    re.lastIndex = end;
    n++;
  }
  return { s: out + s.slice(last), n };
}
let r = unrender(src, 'katex-display', '$$', '$$');
src = r.s;
let r2 = unrender(src, 'katex', '$', '$');
src = r2.s;
if (r.n + r2.n) notes.push(`Turned ${r.n} display and ${r2.n} inline rendered KaTeX expressions back into TeX.`);

// 2. Title.
const titleM = /<title>([\s\S]*?)<\/title>/i.exec(src);
const title = titleM ? decodeEntities(titleM[1]).replace(/\s*\(Copy\)\s*$/, '').trim() : slug;

// 3. Styles.
const styles = [];
let droppedKatexCss = 0;
src = src.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => {
  if (/font-family:\s*KaTeX_/.test(css) && /\.katex\b/.test(css)) { droppedKatexCss++; return ''; }
  if (/safe-area-inset/.test(css) && css.length < 600) return ''; // artifact shell
  styles.push(css.trim());
  return '';
});
if (droppedKatexCss) notes.push('Dropped an inlined copy of the KaTeX stylesheet and its fonts (the site provides KaTeX).');

// 4. Scripts. Classic scripts go to main.js; module scripts to main.mjs;
// anything that is not JavaScript (JSON, import maps, shader sources) stays inline.
const scripts = [];
const modules = [];
let usesKatex = false;
src = src.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
  if (/\bsrc\s*=/.test(attrs)) {
    if (/katex/i.test(attrs)) usesKatex = true;
    else notes.push(`Removed <script${attrs}>; add it back to \`scripts:\` if it is needed.`);
    return '';
  }
  const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [, ''])[1].toLowerCase();
  if (type === 'module') { modules.push(body.trim()); return ''; }
  if (type && !/^(text|application)\/(javascript|ecmascript)$/.test(type)) {
    notes.push(`Kept a <script type="${type}"> inline in index.html.`);
    return m;
  }
  scripts.push(body.trim());
  return '';
});
const jsAll = scripts.concat(modules).join('\n');
if (/\bkatex\s*\.\s*(renderToString|render)\b/.test(jsAll)) usesKatex = true;

// 5. Document shell and head-only tags.
src = src
  .replace(/<!doctype[^>]*>/gi, '')
  .replace(/<\/?(html|head|body)\b[^>]*>/gi, '')
  .replace(/<title>[\s\S]*?<\/title>/gi, '')
  .replace(/<meta\b[^>]*>/gi, '')
  .replace(/<link\b[^>]*>/gi, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// 6. Write the files.
fs.mkdirSync(dir, { recursive: true });
const files = { styles: [], scripts: [] };
if (styles.length) {
  fs.writeFileSync(path.join(dir, 'style.css'), styles.join('\n\n') + '\n');
  files.styles.push('style.css');
}
const data = [], main = [];
for (const s of scripts) (/^window\.[A-Za-z_$][\w$]*\s*=/.test(s) && s.length > 20000 ? data : main).push(s);
if (data.length) { fs.writeFileSync(path.join(dir, 'data.js'), data.join('\n') + '\n'); files.scripts.push('data.js'); }
if (main.length) { fs.writeFileSync(path.join(dir, 'main.js'), main.join('\n\n') + '\n'); files.scripts.push('main.js'); }
if (modules.length) {
  fs.writeFileSync(path.join(dir, 'main.mjs'), modules.join('\n\n') + '\n');
  files.scripts.push('main.mjs');
  notes.push('Module scripts went to main.mjs, which loads as a module after main.js.');
}

const today = new Date().toISOString().slice(0, 10);
const yamlList = (a) => `[${a.join(', ')}]`;
fs.writeFileSync(path.join(dir, 'index.html'), `---
title: ${JSON.stringify(title)}
description: 'TODO: one or two sentences for cards and link previews (TeX allowed).'
tags: [TODO]
date: ${today}
draft: true
katex_runtime: ${usesKatex}
styles: ${yamlList(files.styles)}
scripts: ${yamlList(files.scripts)}
references: []
---
${src}
`);

// 7. Report what is left to do.
const css = styles.join('\n');
const hex = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
const hexJs = (jsAll.match(/['"]#[0-9a-fA-F]{3,8}['"]/g) || []).length;
const fonts = new Set((css.match(/font-family\s*:[^;}]+/g) || []).map((s) => s.trim()));
if (/<h1\b/i.test(src)) notes.push('The page has its own <h1>: move it to `title`/`heading` in front matter (the layout draws the heading).');
if (/prefers-color-scheme|data-theme/.test(css)) notes.push('The CSS has dark-mode rules; the site is light-only, so remove them.');
if (hex) notes.push(`style.css has ${hex} hard-coded colours; map them to theme tokens (--ink, --c1…--c8, …).`);
if (hexJs) notes.push(`The scripts have ${hexJs} hard-coded colours; use MM.color('c1') etc. instead.`);
if (fonts.size) notes.push(`style.css sets font-family ${fonts.size} times; use var(--serif), var(--sans) or var(--mono).`);
if (/:root\s*\{/.test(css)) notes.push('style.css defines :root variables; replace them with the theme tokens.');
if (usesKatex) notes.push('The scripts call KaTeX directly; switch them to MM.tex / MM.rich / MM.setHTML.');

console.log(`Created content/${slug}/ (draft): ${['index.html', ...files.styles, ...files.scripts].join(', ')}`);
console.log('\nStill to do (see docs/porting-an-artifact.md):');
for (const n of notes) console.log(`  - ${n}`);
console.log('  - Fill in description, tags, references and thumb.selector; remove draft: true when done.');
