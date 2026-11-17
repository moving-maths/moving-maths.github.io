// The order of topics and of the pages in each (build/order.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadOrder, arrange, orderWarnings } from '../build/order.mjs';

const tags = { algebra: { name: 'Algebra' }, geometry: { name: 'Geometry' }, topology: { name: 'Topology' } };
const ill = (slug, updated, ...t) => ({ slug, updated, data: { title: slug, tags: t } });
const items = [
  ill('b', '2026-03-01', 'algebra'),
  ill('a', '2026-01-01', 'algebra', 'geometry'),
  ill('c', '2026-02-01', 'algebra'),
  ill('d', '2026-02-01', 'topology'),
];

function load(yaml) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-order-'));
  try {
    fs.mkdirSync(path.join(root, 'site'));
    if (yaml != null) fs.writeFileSync(path.join(root, 'site', 'order.yml'), yaml);
    return loadOrder({ root, site: path.join(root, 'site') }, tags);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
const slugs = (rows) => rows.map((r) => `${r.slug}: ${r.items.map((i) => i.slug).join(' ')}`);

test('without site/order.yml: topics as in tags.yml, most recently updated first', () => {
  const { order, errors } = load(null);
  assert.deepEqual(errors, []);
  assert.deepEqual(slugs(arrange(items, tags, order)), ['algebra: b c a', 'geometry: a', 'topology: d']);
});

test('listed: topics and pages in the order given, the rest after', () => {
  const { order, errors } = load('topics:\n  topology:\n  algebra: [a, c]\n');
  assert.deepEqual(errors, []);
  // topology first, then algebra; geometry, not listed, after them
  assert.deepEqual(slugs(arrange(items, tags, order)), ['topology: d', 'algebra: a c b', 'geometry: a']);
});

test('updated: most recently updated first, everywhere or for one topic', () => {
  assert.deepEqual(slugs(arrange(items, tags, load('sort: updated\ntopics:\n  algebra: [a, c]\n').order)), ['algebra: b c a', 'geometry: a', 'topology: d']);
  const one = load('topics:\n  algebra: { pages: [a, c], sort: updated }\n  geometry: [a]\n');
  assert.deepEqual(one.errors, []);
  assert.deepEqual(slugs(arrange(items, tags, one.order)), ['algebra: b c a', 'geometry: a', 'topology: d']);
});

test('site/order.yml is checked, with lines', () => {
  const { errors } = load('sort: newest\ntopics:\n  algebra: [a, a]\n  analysis: [x]\n  geometry: { pages: [a], order: 1 }\n  topology: d\ncolour: blue\n');
  const msg = errors.map((e) => `${e.line}: ${e.message}`).join('\n');
  assert.match(msg, /^1: `sort` must be listed or updated, not "newest"/m);
  assert.match(msg, /^3: topic algebra lists "a" twice/m);
  assert.match(msg, /^4: unknown topic "analysis"/m);
  assert.match(msg, /^5: topic geometry has an unknown key "order"/m);
  assert.match(msg, /^6: topic topology takes a list of pages/m);
  assert.match(msg, /^7: unknown key "colour"/m);
  assert.match(load('topics: [algebra]\n').errors[0].message, /`topics` must be a map/);
  assert.match(load('topics:\n  algebra: [Not A Slug]\n').errors[0].message, /must be a list of folder names/);
  assert.match(load('topics: {\n').errors[0].message, /not valid YAML/);
});

test('warnings: unknown names, a missing topic, a page left out', () => {
  const { order } = load('topics:\n  algebra: [a, typo, d, draft]\n  geometry:\n');
  const warnings = orderWarnings(items, order, (s) => s === 'draft').map((w) => w.message);
  assert.deepEqual(warnings, [
    'topic algebra lists "typo", but there is no content/typo/',
    'topic algebra lists "d", which does not have that topic (add it to the page\'s tags, or remove it here)',
    'b is in topic algebra but not in its list; it is shown after the listed ones',
    'c is in topic algebra but not in its list; it is shown after the listed ones',
  ]);
  // sorted by update, a list leaves nothing out
  assert.deepEqual(orderWarnings(items, load('sort: updated\ntopics:\n  algebra: [a]\n').order, () => false), []);
});
