// Builds of a fixture project: this repository's site/ folder with
// pages written by the tests.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../build/build.mjs';
import { ROOT } from '../build/config.mjs';

let root;
const temps = [];
const tempDir = (name) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), name)); temps.push(d); return d; };

before(() => {
  root = tempDir('mm-fixture-');
  fs.cpSync(path.join(ROOT, 'site'), path.join(root, 'site'), { recursive: true });
});
beforeEach(() => {
  fs.rmSync(path.join(root, 'content'), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'content'));
});
after(() => { for (const d of temps) fs.rmSync(d, { recursive: true, force: true }); });

function addPage(slug, frontMatter, body = '<p>Body with $x$.</p>') {
  const dir = path.join(root, 'content', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), `---\n${frontMatter}\n---\n${body}\n`);
}
const fm = (extra = '') => `title: T\ndescription: 'About $x$'\ntags: [topology]\ndate: 2026-01-05${extra ? '\n' + extra : ''}`;

async function buildFixture(opts = {}) {
  const outDir = tempDir('mm-out-');
  const res = await build({ root, outDir, ...opts });
  return { res, has: (p) => fs.existsSync(path.join(outDir, p)), read: (p) => fs.readFileSync(path.join(outDir, p), 'utf8') };
}

test('drafts are built only when asked for', async () => {
  addPage('shown', fm());
  addPage('hidden', fm('draft: true'));
  const { res, has, read } = await buildFixture();
  assert.deepEqual(res.errors, []);
  assert.ok(has('shown/index.html'));
  assert.ok(!has('hidden/index.html'));
  assert.ok(!read('sitemap.xml').includes('/hidden/'));
  assert.ok(!read('index.html').includes('href="/hidden/"'));
  assert.ok(!read('index.html').includes('card-draft'));
  const dev = await buildFixture({ drafts: true });
  assert.ok(dev.has('hidden/index.html'));
  // in a dev build a draft's card is marked, and only a draft's
  const home = dev.read('index.html');
  assert.equal(home.match(/class="card-draft"/g)?.length, 1);
  assert.match(home, /<article class="card is-draft">\s*<a class="card-link" href="\/hidden\/"/);
});

test('a broken page is reported, and the others are still built', async () => {
  addPage('fine', fm());
  addPage('bad-yaml', 'title: [unclosed');
  addPage('bad-quotes', String.raw`title: T
description: "About $\alpha$"
tags: [topology]
date: 2026-01-05`);
  addPage('bad-tex', fm(), '<p>Fine $x$.</p>\n<p>Broken $\\frac{1$.</p>');
  const { res, has } = await buildFixture();
  const err = (slug) => res.errors.filter((e) => e.file === `content/${slug}/index.html`);
  assert.match(err('bad-yaml').map((e) => e.message).join(), /not valid YAML/);
  assert.match(err('bad-quotes').map((e) => e.message).join(), /line 3: "\\alpha" inside double quotes/);
  assert.equal(err('bad-tex').length, 1);
  assert.equal(err('bad-tex')[0].line, 8); // --- , four keys, --- , then the body: line 8 is the second paragraph
  assert.ok(has('fine/index.html'));
});

test('folder names the site uses, or that are not slugs, are refused', async () => {
  addPage('tags', fm());
  addPage('about', fm()); // a standalone page in site/pages
  addPage('Bad_Name', fm());
  const { res } = await buildFixture();
  const messages = res.errors.map((e) => `${e.file}: ${e.message}`).join('\n');
  assert.match(messages, /content\/tags\/index\.html: "tags" is taken by the site/);
  assert.match(messages, /content\/about\/index\.html: "about" is taken by the site/);
  assert.match(messages, /content\/Bad_Name\/index\.html: "Bad_Name" is not a valid folder name/);
});

test('the output folder is checked before anything in it is deleted', async () => {
  addPage('fine', fm());
  await assert.rejects(build({ root, outDir: root }), /contains the project/);
  await assert.rejects(build({ root, outDir: path.join(root, 'site', 'out') }), /inside site\//);
  const foreign = tempDir('mm-foreign-');
  fs.writeFileSync(path.join(foreign, 'precious.txt'), 'keep me');
  await assert.rejects(build({ root, outDir: foreign }), /not empty and not an earlier build output/);
  assert.equal(fs.readFileSync(path.join(foreign, 'precious.txt'), 'utf8'), 'keep me');
  // an earlier build output is replaced
  const out = tempDir('mm-again-');
  assert.deepEqual((await build({ root, outDir: out })).errors, []);
  fs.writeFileSync(path.join(out, 'stale.html'), '');
  assert.deepEqual((await build({ root, outDir: out })).errors, []);
  assert.ok(!fs.existsSync(path.join(out, 'stale.html')));
});

test('a designed card image, thumb.html, is built for npm run thumbs and in dev, never published', async () => {
  addPage('drawn', fm('styles: [style.css]'));
  fs.writeFileSync(path.join(root, 'content', 'drawn', 'style.css'), 'body { --mine: var(--c3); }\n');
  fs.writeFileSync(path.join(root, 'content', 'drawn', 'thumb.html'), '<p>$x^2$</p>\n<script>MMThumb.canvas();</script>\n');
  const prod = await buildFixture();
  assert.deepEqual(prod.res.errors, []);
  assert.ok(prod.has('drawn/index.html') && prod.has('drawn/style.css'));
  assert.ok(!prod.has('drawn/thumb.html'), 'not published');
  const { res, read } = await buildFixture({ thumbs: true });
  assert.deepEqual(res.errors, []);
  const page = read('drawn/thumb.html');
  assert.match(page, /<body class="mm-thumb">/);
  assert.match(page, /window\.MMThumb = /, 'the canvas helper');
  assert.match(page, /href="\/drawn\/style\.css\?v=/, "the page's own styles, for its colour names");
  assert.match(page, /class="katex"/, 'TeX rendered by the build');
  assert.ok(!page.includes('/__dev/reload.js'), 'live reload only in dev');
  assert.match((await buildFixture({ dev: true })).read('drawn/thumb.html'), /\/__dev\/reload\.js/);
});
