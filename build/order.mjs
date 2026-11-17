// The order of topics, and of the pages in each: the rows of the home
// page, the topic pages and the topics index. Set in site/order.yml (optional):
//
//   sort: listed          # or updated: how to order the cards within a topic
//   topics:               # topics in this order; the rest follow, as in tags.yml
//     representation-theory: [root-systems, dynkin-diagrams]   # cards in this order
//     topology:                                                # just its place
//     number-theory: { sort: updated }                         # its own sort
//
// `listed`: the pages named under the topic first, in that order, then
// the topic's others, most recently updated first. `updated`: most recently
// updated first. Problems are collected as { file, line, message }.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { projectPaths, lineIndex, SLUG_RE } from './config.mjs';

export const SORTS = ['listed', 'updated'];
const FILE = 'site/order.yml';

// Reads site/order.yml. Returns { order: { sort, topics: Map(slug → { pages, sort }) }, errors }.
export function loadOrder(paths = projectPaths(), tags = {}) {
  const order = { sort: 'listed', topics: new Map() };
  const errors = [];
  const file = path.join(paths.site, 'order.yml');
  if (!fs.existsSync(file)) return { order, errors };
  const src = fs.readFileSync(file, 'utf8');
  const lineOf = lineIndex(src);
  // the first line that names `word` (a key or a list item), for messages
  const line = (word) => {
    const m = new RegExp(`(^|[\\s\\[,{])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s,\\]}:]|$)`, 'm').exec(src);
    return m ? lineOf(m.index + m[1].length) : 1;
  };
  const err = (message, word) => errors.push({ file: FILE, line: word ? line(word) : 1, message });
  let data;
  try {
    data = YAML.parse(src);
  } catch (e) {
    err(`not valid YAML: ${e.message.split('\n')[0]}`);
    return { order, errors };
  }
  if (data == null) return { order, errors };
  if (typeof data !== 'object' || Array.isArray(data)) {
    err('must be a map with `sort` and `topics`');
    return { order, errors };
  }
  for (const k of Object.keys(data)) if (!['sort', 'topics'].includes(k)) err(`unknown key "${k}" (known: sort, topics)`, k);
  const checkSort = (s, where, word) => {
    if (s == null) return null;
    if (SORTS.includes(s)) return s;
    err(`${where} must be ${SORTS.join(' or ')}, not "${s}"`, word);
    return null;
  };
  order.sort = checkSort(data.sort, '`sort`', 'sort') || 'listed';
  const topics = data.topics ?? {};
  if (typeof topics !== 'object' || Array.isArray(topics)) {
    err('`topics` must be a map from topic to its pages, like `topology: [configuration-spaces]`', 'topics');
    return { order, errors };
  }
  for (const [slug, value] of Object.entries(topics)) {
    if (!tags[slug]) { err(`unknown topic "${slug}" (the topics are the keys of site/tags.yml)`, slug); continue; }
    // a list is short for { pages: list }; nothing, for no list
    const conf = value == null ? {} : Array.isArray(value) ? { pages: value } : value;
    if (typeof conf !== 'object') { err(`topic ${slug} takes a list of pages, or a map with \`pages\` and \`sort\``, slug); continue; }
    for (const k of Object.keys(conf)) if (!['pages', 'sort'].includes(k)) err(`topic ${slug} has an unknown key "${k}" (known: pages, sort)`, k);
    const list = conf.pages ?? [];
    if (!Array.isArray(list) || !list.every((s) => typeof s === 'string' && SLUG_RE.test(s))) {
      err(`the pages of topic ${slug} must be a list of folder names`, slug);
      continue;
    }
    for (const s of list.filter((s, i) => list.indexOf(s) !== i)) err(`topic ${slug} lists "${s}" twice`, s);
    order.topics.set(slug, { pages: list, sort: checkSort(conf.sort, `the sort of topic ${slug}`, slug) });
  }
  return { order, errors };
}

const byUpdate = (a, b) => b.updated.localeCompare(a.updated) || a.data.title.localeCompare(b.data.title);

// The topics that have pages, in order, each with its pages in
// order: [{ slug, items }]. `items` are pages ({ slug, updated,
// data: { title, tags } }); `tags` is site/tags.yml, whose order is used for
// topics not in site/order.yml.
export function arrange(items, tags, order) {
  const used = Object.keys(tags).filter((t) => items.some((it) => it.data.tags.includes(t)));
  const first = [...order.topics.keys()].filter((t) => used.includes(t));
  return [...first, ...used.filter((t) => !first.includes(t))].map((slug) => {
    const mine = items.filter((it) => it.data.tags.includes(slug)).sort(byUpdate);
    const conf = order.topics.get(slug);
    if (!conf || (conf.sort || order.sort) === 'updated') return { slug, items: mine };
    const listed = conf.pages.map((s) => mine.find((it) => it.slug === s)).filter(Boolean);
    return { slug, items: [...listed, ...mine.filter((it) => !listed.includes(it))] };
  });
}

// Warnings about site/order.yml against the pages: a name with no
// folder (a typo), one without the topic it is listed under, and, in a topic
// sorted as listed, a page left out of its list (it goes last).
// `exists(slug)` says whether content/<slug>/ exists (drafts are not in
// `items` in a production build, and are not warned about).
export function orderWarnings(items, order, exists) {
  const warnings = [];
  const warn = (message) => warnings.push({ file: FILE, line: 1, message });
  for (const [topic, conf] of order.topics) {
    for (const s of conf.pages) {
      const it = items.find((i) => i.slug === s);
      if (!it && !exists(s)) warn(`topic ${topic} lists "${s}", but there is no content/${s}/`);
      else if (it && !it.data.tags.includes(topic)) warn(`topic ${topic} lists "${s}", which does not have that topic (add it to the page's tags, or remove it here)`);
    }
    if ((conf.sort || order.sort) !== 'listed' || !conf.pages.length) continue;
    for (const it of items) {
      if (it.data.tags.includes(topic) && !conf.pages.includes(it.slug)) {
        warn(`${it.slug} is in topic ${topic} but not in its list; it is shown after the listed ones`);
      }
    }
  }
  return warnings;
}
