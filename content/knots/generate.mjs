// Writes table.js: the prime knots with up to nine crossings and the prime links
// with up to seven, each with a diagram and a drawing of it. Run with
// `node content/knots/generate.mjs` (a few minutes).
//
// A knot is given by the Dowker–Thistlethwaite code of a diagram with the fewest
// crossings (the codes are those of the tables of Rolfsen and of the Knot Atlas). A
// code does not tell a knot from its mirror image; which of the two is meant is
// settled by the Jones polynomial and the signature that the Knot Atlas lists for
// the knot (test/helpers/knot-atlas.json). A link is given by the Knot Atlas's
// planar diagram code, which fixes it and the directions of its components
// (test/helpers/link-atlas.json). Each is drawn by KnotLayout.piece (a circle
// packing, then the rope settles, kept symmetric where the shadow has symmetries),
// turned so that its axis of symmetry, if it has one, is upright (* in the log).
import fs from 'node:fs';
import './knots.js';
import './layout.js';

const K = globalThis.Knots, L = globalThis.KnotLayout, P = K.poly;
const atlas = JSON.parse(fs.readFileSync(new URL('../../test/helpers/knot-atlas.json', import.meta.url)));
const links = JSON.parse(fs.readFileSync(new URL('../../test/helpers/link-atlas.json', import.meta.url))).links;

const DT = {
  '3_1': [4, 6, 2], '4_1': [4, 6, 8, 2], '5_1': [6, 8, 10, 2, 4], '5_2': [4, 8, 10, 2, 6],
  '6_1': [4, 8, 12, 10, 2, 6], '6_2': [4, 8, 10, 12, 2, 6], '6_3': [4, 8, 10, 2, 12, 6],
  '7_1': [8, 10, 12, 14, 2, 4, 6], '7_2': [4, 10, 14, 12, 2, 8, 6], '7_3': [6, 10, 12, 14, 2, 4, 8], '7_4': [6, 10, 12, 14, 4, 2, 8],
  '7_5': [4, 10, 12, 14, 2, 8, 6], '7_6': [4, 8, 12, 2, 14, 6, 10], '7_7': [4, 8, 10, 12, 2, 14, 6],
  '8_1': [4, 10, 16, 14, 12, 2, 8, 6], '8_2': [4, 10, 12, 14, 16, 2, 6, 8], '8_3': [6, 12, 10, 16, 14, 4, 2, 8], '8_4': [6, 10, 12, 16, 14, 4, 2, 8],
  '8_5': [6, 8, 12, 2, 14, 16, 4, 10], '8_6': [4, 10, 14, 16, 12, 2, 8, 6], '8_7': [4, 10, 12, 14, 2, 16, 6, 8], '8_8': [4, 8, 12, 2, 16, 14, 6, 10],
  '8_9': [6, 10, 12, 14, 16, 4, 2, 8], '8_10': [4, 8, 12, 2, 14, 16, 6, 10], '8_11': [4, 10, 12, 14, 16, 2, 8, 6], '8_12': [4, 8, 14, 10, 2, 16, 6, 12],
  '8_13': [4, 10, 12, 14, 2, 16, 8, 6], '8_14': [4, 8, 10, 14, 2, 16, 6, 12], '8_15': [4, 8, 12, 2, 14, 6, 16, 10], '8_16': [6, 8, 14, 12, 4, 16, 2, 10],
  '8_17': [6, 8, 12, 14, 4, 16, 2, 10], '8_18': [6, 8, 10, 12, 14, 16, 2, 4], '8_19': [4, 8, -12, 2, -14, -16, -6, -10], '8_20': [4, 8, -12, 2, -14, -6, -16, -10],
  '8_21': [4, 8, -12, 2, 14, -6, 16, 10],
  '9_1': [10, 12, 14, 16, 18, 2, 4, 6, 8], '9_2': [4, 12, 18, 16, 14, 2, 10, 8, 6], '9_3': [8, 12, 14, 16, 18, 2, 4, 6, 10], '9_4': [6, 12, 14, 18, 16, 2, 4, 10, 8],
  '9_5': [6, 12, 14, 18, 16, 4, 2, 10, 8], '9_6': [4, 12, 14, 16, 18, 2, 10, 6, 8], '9_7': [4, 12, 16, 18, 14, 2, 10, 8, 6], '9_8': [4, 8, 14, 2, 18, 16, 6, 12, 10],
  '9_9': [6, 12, 14, 16, 18, 2, 4, 10, 8], '9_10': [8, 12, 14, 16, 18, 2, 6, 4, 10], '9_11': [4, 10, 14, 16, 12, 2, 18, 6, 8], '9_12': [4, 10, 16, 14, 2, 18, 8, 6, 12],
  '9_13': [6, 12, 14, 16, 18, 4, 2, 10, 8], '9_14': [4, 10, 12, 16, 14, 2, 18, 8, 6], '9_15': [4, 8, 14, 10, 2, 18, 16, 6, 12], '9_16': [4, 12, 16, 18, 14, 2, 8, 10, 6],
  '9_17': [4, 10, 12, 14, 16, 2, 6, 18, 8], '9_18': [4, 12, 14, 16, 18, 2, 10, 8, 6], '9_19': [4, 8, 10, 14, 2, 18, 16, 6, 12], '9_20': [4, 10, 14, 16, 2, 18, 8, 6, 12],
  '9_21': [4, 10, 14, 16, 12, 2, 18, 8, 6], '9_22': [4, 8, 10, 14, 2, 16, 18, 6, 12], '9_23': [4, 10, 12, 16, 2, 8, 18, 6, 14], '9_24': [4, 8, 14, 2, 16, 18, 6, 12, 10],
  '9_25': [4, 8, 12, 2, 16, 6, 18, 10, 14], '9_26': [4, 10, 12, 14, 16, 2, 18, 8, 6], '9_27': [4, 10, 12, 14, 2, 18, 16, 6, 8], '9_28': [4, 8, 12, 2, 16, 14, 6, 18, 10],
  '9_29': [6, 10, 14, 18, 4, 16, 8, 2, 12], '9_30': [4, 8, 10, 14, 2, 16, 6, 18, 12], '9_31': [4, 10, 12, 14, 2, 18, 16, 8, 6], '9_32': [4, 8, 12, 14, 2, 16, 18, 10, 6],
  '9_33': [4, 8, 14, 12, 2, 16, 18, 10, 6], '9_34': [6, 8, 10, 16, 14, 18, 4, 2, 12], '9_35': [8, 12, 16, 14, 18, 4, 2, 6, 10], '9_36': [4, 8, 14, 10, 2, 16, 18, 6, 12],
  '9_37': [4, 10, 14, 12, 16, 2, 6, 18, 8], '9_38': [6, 10, 14, 18, 4, 16, 2, 8, 12], '9_39': [6, 10, 14, 18, 16, 2, 8, 4, 12], '9_40': [6, 16, 14, 12, 4, 2, 18, 10, 8],
  '9_41': [6, 10, 14, 12, 16, 2, 18, 4, 8], '9_42': [4, 8, 10, -14, 2, -16, -18, -6, -12], '9_43': [4, 8, 10, 14, 2, -16, 6, -18, -12], '9_44': [4, 8, 10, -14, 2, -16, -6, -18, -12],
  '9_45': [4, 8, 10, -14, 2, 16, -6, 18, 12], '9_46': [4, 10, -14, -12, -16, 2, -6, -18, -8], '9_47': [6, 8, 10, 16, 14, -18, 4, 2, -12], '9_48': [4, 10, -14, -12, 16, 2, -6, 18, 8],
  '9_49': [6, -10, -14, 12, -16, -2, 18, -4, -8],
};

// a drawing as text: each component's points, two base-36 digits a coordinate
// (0 … 1295 across [−0.8, 0.8]), components apart by spaces
const UNIT = 1295 / 1.6;
const encode = (pts, cut) => {
  const out = [];
  for (let c = 0; c + 1 < cut.length; c++) out.push(pts.slice(cut[c], cut[c + 1]).map((p) => p.map((v) => Math.round((v + 0.8) * UNIT).toString(36).padStart(2, '0')).join('')).join(''));
  return out.join(' ');
};
const decode = (text) => {
  const pts = [], cut = [0];
  for (const part of text.split(' ')) { for (let i = 0; i < part.length; i += 4) pts.push([parseInt(part.slice(i, i + 2), 36) / UNIT - 0.8, parseInt(part.slice(i + 2, i + 4), 36) / UNIT - 0.8]); cut.push(pts.length); }
  return { pts, cut };
};

// The drawing of D to keep: settled (KnotLayout.piece), turned upright
// (KnotLayout.orient), its polygon (the spline through which is the curve the page
// draws) in text, and the bits of its crossings.
function draw(name, D, want) {
  const r = L.piece(D, { steps: 2000 });
  if (!r) throw new Error(name + ': no drawing');
  // the settled polygon, turned, fitted, rounded, and the spline through it checked
  const poly = r.polygon(L.orient(r)), text = encode(poly.pts, poly.cut), back = decode(text);
  const curve = L.spline(back.pts, back.cut, 28), over = K.matchBits(curve.pts, curve.cut, D);
  if (!over) throw new Error(name + ': the drawing does not have the diagram');
  const E = K.diagram(curve.pts, over, null, curve.cut);
  if (!P.eq(K.jones(E), want)) throw new Error(name + ': the drawing is not the link');
  // (the bits are for the crossings of the polygon, which are those of the curve, in order)
  return { text, bits: over.join(''), symmetric: r.symmetric };
}

const rows = [];
for (const [name, code] of Object.entries(DT)) {
  const want = { lo: atlas[name].jones[0], c: atlas[name].jones[1] };
  let D = K.fromDT(code), flip = 0;
  // (the Knot Atlas gives the left-handed trefoil signature −2: the opposite sign to knots.js)
  const is = (E) => P.eq(K.jones(E), want) && K.signature(E) === -atlas[name].signature;
  if (!is(D)) { D = K.mirror(D); flip = 1; }
  if (!is(D)) throw new Error(name + ': neither the diagram nor its mirror image has the listed invariants');
  const d = draw(name, D, want);
  rows.push('  [' + [JSON.stringify(name), JSON.stringify(code), flip, JSON.stringify(d.text), JSON.stringify(d.bits)].join(', ') + '],');
  process.stdout.write(name + (d.symmetric ? '* ' : ' '));
}
for (const [name, Lk] of Object.entries(links)) {
  const D = K.fromPD(Lk.pd), V = K.jones(D), d = draw(name, D, V);
  rows.push('  [' + [JSON.stringify(name), JSON.stringify(Lk.pd), 0, JSON.stringify(d.text), JSON.stringify(d.bits), JSON.stringify(Lk.rolfsen), JSON.stringify(Lk.name || '')].join(', ') + '],');
  process.stdout.write(name + (d.symmetric ? '* ' : ' '));
}
fs.writeFileSync(new URL('./table.js', import.meta.url), `// The prime knots with up to nine crossings and the prime links with up to seven.
// Written by generate.mjs: do not edit.
// Each row: the name (Rolfsen's for a knot, Thistlethwaite's for a link); the code
// of a diagram (Dowker–Thistlethwaite's for a knot, the Knot Atlas's planar diagram
// code for a link); 1 if the knot is the mirror image of the diagram Knots.fromDT
// makes of the code; a drawing, the polygon through which KnotLayout.spline draws
// the curve (two base-36 digits a coordinate, 0 … 1295 across [−0.8, 0.8],
// components apart by spaces); and which strand is on top at each of its crossings
// (Knots's bits). For a link also its name in Rolfsen's table, and a common name.
globalThis.KnotTable = [
${rows.join('\n')}
];
`);
console.log('\n' + rows.length + ' rows');
