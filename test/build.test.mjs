import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from '../build/build.mjs';
import { checkLinks } from '../build/check.mjs';
import { parseFrontMatter, validatePage } from '../build/content.mjs';
import { renderTex } from '../build/tex.mjs';

test('the site builds without errors and with no broken links', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-build-'));
  try {
    const res = await build({ outDir });
    assert.deepEqual(res.errors, []);
    assert.deepEqual(checkLinks(outDir), []);
    for (const f of ['index.html', 'tags/index.html', 'about/index.html', '404.html', 'feed.xml', 'sitemap.xml', 'assets/js/site.js']) {
      assert.ok(fs.existsSync(path.join(outDir, f)), f);
    }
    assert.match(fs.readFileSync(path.join(outDir, 'assets/js/site.js'), 'utf8'), /function transformMath/);
    const runtime = fs.readFileSync(path.join(outDir, 'assets/js/site.js'), 'utf8');
    assert.match(runtime, /customElements\.define\('mm-seg'/);
    assert.ok(!runtime.includes('/* @components */') && !runtime.includes('/* @tex-scan */') && !runtime.includes('/* @plain-core */') && !runtime.includes('/* @cite */'));
    assert.ok(runtime.includes('function citeRefs('));
    assert.match(runtime, /function labelKatex/);
    assert.doesNotThrow(() => new Function(runtime));
    assert.ok(!/\(\?<[=!]/.test(runtime), 'no regex lookbehind: Safari before 16.4 rejects the whole file');
    const home = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.match(home, /<section class="shelf" id="representation-theory"/, 'a row of cards per topic');
    assert.match(home, /<h3 class="card-title">/, 'card titles are h3 under their row\'s h2');
    assert.ok(home.indexOf('href="/root-systems/"') < home.indexOf('href="/dynkin-diagrams/"'), 'cards in the order of site/order.yml');
    const topic = fs.readFileSync(path.join(outDir, 'tags/representation-theory/index.html'), 'utf8');
    assert.match(topic, /<h2 class="card-title">/, 'on a topic page, card titles are h2 under the page h1');
    const ill = fs.readFileSync(path.join(outDir, 'root-systems', 'index.html'), 'utf8');
    const hw = fs.readFileSync(path.join(outDir, 'highest-weight-representations', 'index.html'), 'utf8');
    assert.match(hw, /role="math" aria-label="𝔰𝔩₃"/, 'maths in a button has a plain-text name');
    assert.match(ill, /<h3 class="card-title">/, 'related cards are h3 under their h2');
    assert.match(ill, /id="mm-macros"/, 'pages carry the macros, for labels');
    assert.ok(/example\.js\?v=/.test(ill) && ill.indexOf('example.js?v=') < ill.indexOf('main.js?v='), 'example.js loads before the page\'s scripts');
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(ill + home), 'the fonts are served with the site');
    assert.ok(!fs.existsSync(path.join(outDir, 'components')), 'the gallery is built only in dev');
    assert.ok(!fs.existsSync(path.join(outDir, 'assets/js/components.js')), 'components.js is inlined, not copied');
    assert.deepEqual(res.warnings.filter((w) => !/no image/.test(w.message)), [], 'no design-lint warnings');
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('front matter: parsing and validation', () => {
  const { data, bodyLine } = parseFrontMatter('---\ntitle: X\ntags: [a]\n---\n<p>hi</p>', 'f');
  assert.equal(data.title, 'X');
  assert.equal(bodyLine, 5);
  const problems = validatePage({ title: 'A $x$', tags: ['nope'], date: '2026-1-1', colour: 1 }, { tags: { a: {} }, dir: '.' });
  assert.ok(problems.some((p) => /unknown front matter key "colour"/.test(p)));
  assert.ok(problems.some((p) => /`title` must be plain text/.test(p)));
  assert.ok(problems.some((p) => /`description` is required/.test(p)));
  assert.ok(problems.some((p) => /unknown tag "nope"/.test(p)));
  assert.ok(problems.some((p) => /`date` is required/.test(p)));
});

test('renderTex: macros and error locations', () => {
  const errors = [];
  const out = renderTex('<p>\n$\\RR$\n$\\frac{1$</p>', { macros: { '\\RR': '\\mathbb{R}' }, file: 'f.html', line: 10, errors });
  assert.match(out, /mathbb/);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 12);
});

test('logo: the whole trefoil, with a band and an upper strand at each crossing', async () => {
  const { knotPaths, logoSvg, faviconSvg } = await import('../build/logo.mjs');
  const p = knotPaths();
  assert.equal((p.curve.match(/M/g) || []).length, 1);
  assert.match(p.curve, /Z$/, 'the curve is closed');
  assert.equal((p.bands.match(/M/g) || []).length, 3);
  assert.equal((p.overs.match(/M/g) || []).length, 3);
  for (const d of Object.values(p)) assert.ok(!/NaN/.test(d));
  const ids = (s) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const a = logoSvg(), b = logoSvg({ point: false });
  assert.equal(new Set([...ids(a), ...ids(b)]).size, ids(a).length + ids(b).length, 'mask ids differ between logos on a page');
  assert.match(a, /<circle class="logo-point"[^>]* mask="url\(#/);
  assert.ok(!b.includes('logo-point'));
  const fav = faviconSvg();
  assert.match(fav, /^<svg [^>]*viewBox="0 0 32 32"/);
  assert.match(fav, /<circle class="logo-point"[^>]* fill="#f2b51e"/, 'the favicon has the point');
});
