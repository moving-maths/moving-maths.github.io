import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontMatter, validatePage } from '../build/content.mjs';

const fm = (yaml, body = '<p>x</p>') => parseFrontMatter(`---\n${yaml}\n---\n${body}`);
const ctx = { tags: { a: {} }, dir: '.' };
const base = { title: 'T', description: 'D', tags: ['a'], date: '2026-01-05' };
const problems = (extra) => validatePage({ ...base, ...extra }, ctx).join('\n');

test('front matter: a BOM, empty front matter, and what is not front matter', () => {
  assert.equal(parseFrontMatter('\uFEFF---\ntitle: X\n---\nbody').data.title, 'X');
  assert.deepEqual(parseFrontMatter('---\n---\nbody').data, {});
  assert.throws(() => parseFrontMatter('<p>no front matter</p>'), /missing front matter/);
  assert.throws(() => parseFrontMatter('---\ntitle: X\n'), /not closed/);
  assert.throws(() => parseFrontMatter('---\ntitle: [x\n---\n'), /not valid YAML/);
  assert.throws(() => parseFrontMatter('---\n- a\n- b\n---\n'), /`key: value` lines/);
});

test('front matter: TeX in double quotes is an error, with its line', () => {
  // YAML reads "\mathbb" as an escape sequence and fails or garbles it
  assert.throws(() => fm(String.raw`title: X
description: "the group $\mathbb{Z}$"`), /line 3: "\\mathbb" inside double quotes/);
  assert.throws(() => fm(String.raw`description: "rotate by $\theta$"`), /"\\theta" inside double quotes/);
  // single quotes keep backslashes; YAML's own escapes and doubled backslashes are fine
  assert.equal(fm(String.raw`description: 'the group $\mathbb{Z}$'`).data.description, String.raw`the group $\mathbb{Z}$`);
  assert.equal(fm(String.raw`description: "doubled $\\mathbb{Z}$, \x41, \u00e9"`).data.description, String.raw`doubled $\mathbb{Z}$, A, é`);
});

test('validation: dates must be real dates', () => {
  assert.equal(problems({}), '');
  assert.equal(validatePage(fm('title: T\ndescription: D\ntags: [a]\ndate: 2026-01-05').data, ctx).join('\n'), '');
  assert.match(problems({ date: '2026-02-30' }), /`date` is required: a real date/);
  assert.match(problems({ date: '5 Jan 2026' }), /`date` is required: a real date/);
  assert.match(problems({ updated: 'soon' }), /`updated` must be a real date/);
});

test('validation: every key has a type', () => {
  assert.match(problems({ draft: 'yes' }), /`draft` must be true or false/);
  assert.match(problems({ katex_runtime: 1 }), /`katex_runtime` must be true or false/);
  assert.match(problems({ heading: ['x'] }), /`heading` must be text/);
  assert.match(problems({ description: '<b>x</b>' }), /not HTML/);
  assert.match(problems({ image: 'https://example.com/a.png' }), /`image` must be a file name/);
  assert.match(problems({ styles: 'style.css' }), /`styles` must be a list of file names/);
  assert.match(problems({ scripts: ['missing.js'] }), /`scripts` lists "missing.js", which does not exist/);
  assert.match(problems({ references: { title: 'R' } }), /`references` must be a list/);
  assert.match(problems({ references: [{ authors: 'A' }] }), /references\[0\] needs a `title`/);
  assert.match(problems({ references: [{ title: 'R', year: 2020 }] }), /references\[0\] has an unknown key "year"/);
  assert.match(problems({ references: [{ title: 'R' }] }), /references\[0\] needs a `key`/);
  assert.match(problems({ references: [{ key: 'a b', title: 'R' }] }), /references\[0\] needs a `key`/);
  assert.match(problems({ references: [{ key: 'a', title: 'R' }, { key: 'a', title: 'S' }] }), /references\[1\]: the key "a" is used twice/);
  assert.equal(problems({ references: [{ key: 'kac1990', title: 'R' }] }), '');
  assert.match(problems({ macros: { foo: 'x' } }), /macro name "foo"/);
  assert.match(problems({ macros: { '\\foo': 1 } }), /macro \\foo must be text/);
  assert.match(problems({ thumb: { wait: '1s' } }), /`thumb.wait` must be a number/);
  assert.match(problems({ thumb: { click: [1] } }), /`thumb.click` must be a selector/);
  assert.equal(problems({ thumb: { selector: ['#a', '#b'], trim: true, style: '#a { box-shadow: none; }' } }), '');
  assert.match(problems({ thumb: { selector: [] } }), /`thumb.selector` must be a selector or a list/);
  assert.match(problems({ thumb: { trim: 'yes' } }), /`thumb.trim` must be true or false/);
  assert.match(problems({ thumb: { style: ['a'] } }), /`thumb.style` must be CSS/);
  assert.match(problems({ thumb: { selecter: '#a' } }), /`thumb` has an unknown key "selecter"/);
});
