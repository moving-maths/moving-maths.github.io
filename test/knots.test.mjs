// Independent checks of the mathematics in content/knots/: the invariants
// (knots.js) against the values the Knot Atlas lists (test/helpers/knot-atlas.json,
// knot-homfly.json, link-atlas.json) and against definitions worked out here in
// other ways; the moves; the group; and the drawings (layout.js, table.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../content/knots/knots.js';
import '../content/knots/layout.js';
import '../content/knots/volume.js';
import '../content/knots/table.js';

const KV = globalThis.KnotVolume;
const K = globalThis.Knots, L = globalThis.KnotLayout, P = K.poly, H = K.poly2, TABLE = globalThis.KnotTable;
const read = (name) => JSON.parse(fs.readFileSync(new URL('./helpers/' + name, import.meta.url)));
const atlas = read('knot-atlas.json'), homfly = read('knot-homfly.json').knots, linkAtlas = read('link-atlas.json').links;
let seed = 5;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const poly = (lo, c) => ({ lo, c });
const UNIT = 1295 / 1.6;
const decode = (text) => { const pts = [], cut = [0]; for (const part of text.split(' ')) { for (let i = 0; i < part.length; i += 4) pts.push([parseInt(part.slice(i, i + 2), 36) / UNIT - 0.8, parseInt(part.slice(i + 2, i + 4), 36) / UNIT - 0.8]); cut.push(pts.length); } return { pts, cut }; };
const rows = TABLE.map(([name, code, flip, text, bits, rolfsen]) => {
  const link = name[0] === 'L', D0 = link ? K.fromPD(code) : K.fromDT(code);
  return { name, code, link, rolfsen, c: D0.n, D: flip ? K.mirror(D0) : D0, text, bits };
});
const knots = rows.filter((r) => !r.link), links = rows.filter((r) => r.link);
const byName = Object.fromEntries(rows.map((k) => [k.name, k]));
const invariants = (D) => P.key(K.jones(D)) + ' | ' + P.key(K.alexander(D)) + ' | ' + K.signature(D);
const drawing = (r, spacing) => { const poly = decode(r.text), s = L.spline(poly.pts, poly.cut, 1 / (spacing || 0.035)); return { pts: s.pts, cut: s.cut, over: r.bits.split('').map(Number), X: K.crossings(s.pts, s.cut) }; };
const diagramOf = (k) => K.diagram(k.pts, k.over, k.X || K.crossings(k.pts, k.cut), k.cut);

// Kauffman's bracket from its definition: every way of opening the crossings, the
// loops counted by joining edges up (a component with no crossings is a loop more).
function bracketByStates(D) {
  const { S } = K.slots(D), m = 2 * D.n, cut = D.cut || [0, m];
  let free = 0;
  for (let c = 0; c + 1 < cut.length; c++) if (cut[c] === cut[c + 1]) free++;
  let total = P.ZERO;
  for (let state = 0; state < 1 << D.n; state++) {
    const parent = Array.from({ length: m }, (_, i) => i), find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    let a = 0;
    for (let c = 0; c < D.n; c++) {
      const s = S[c], A = (state >> c) & 1;
      a += A ? 1 : -1;
      for (const [x, y] of A ? [[s[0], s[1]], [s[2], s[3]]] : [[s[0], s[3]], [s[1], s[2]]]) parent[find(x)] = find(y);
    }
    let loops = free;
    for (let e = 0; e < m; e++) if (find(e) === e) loops++;
    let term = { lo: a, c: [1] };
    for (let l = 1; l < loops; l++) term = P.mul(term, { lo: -2, c: [-1, 0, 0, 0, -1] });
    total = P.add(total, term);
  }
  return total;
}
// a closed curve r(θ) = a + cos(qθ) at angle pθ: with p = 2 the usual picture of the torus knot T(2, q)
function rose(p, q, a, n) {
  return Array.from({ length: n }, (_, i) => { const t = 2 * Math.PI * (i + 0.37) / n, r = a + Math.cos(q * t); return [r * Math.cos(p * t) / (a + 1), r * Math.sin(p * t) / (a + 1)]; });
}
// a wobbly closed curve with many crossings
function doodle(n, at) {
  const f = [1, 2, 3, 4, 5].map(() => [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), o = at || [0, 0];
  return Array.from({ length: n }, (_, i) => {
    const t = 2 * Math.PI * i / n;
    let x = 0, y = 0;
    f.forEach((c, k) => { x += (c[0] * Math.cos((k + 1) * t) + c[1] * Math.sin((k + 1) * t)) / (k + 1) ** 0.5; y += (c[2] * Math.cos((k + 1) * t) + c[3] * Math.sin((k + 1) * t)) / (k + 1) ** 0.5; });
    return [o[0] + x, o[1] + y];
  });
}
// two or three doodles overlapping: a link
function doodles(k, n) {
  const pts = [], cut = [0];
  for (let i = 0; i < k; i++) { for (const p of doodle(n, [0.35 * Math.cos(2 * Math.PI * i / k), 0.35 * Math.sin(2 * Math.PI * i / k)])) pts.push(p); cut.push(pts.length); }
  return { pts, cut };
}

test('the table: 84 knots, with the invariants the Knot Atlas lists', () => {
  assert.equal(knots.length, 84);
  assert.deepEqual([3, 4, 5, 6, 7, 8, 9].map((c) => knots.filter((k) => k.c === c).length), [1, 1, 2, 3, 7, 21, 49]);
  for (const k of knots) {
    const want = atlas[k.name], D = k.D;
    assert.ok(P.eq(K.jones(D), poly(...want.jones)), k.name + ': Jones polynomial');
    // the Atlas writes Δ up to sign; here Δ(1) = 1
    const sign = want.alexander[1].reduce((a, b) => a + b, 0);
    assert.ok(P.eq(K.alexander(D), poly(want.alexander[0], want.alexander[1].map((x) => x * sign))), k.name + ': Alexander polynomial');
    // the Atlas gives the left-handed trefoil signature −2; here it is the right-handed one
    assert.equal(K.signature(D) + want.signature, 0, k.name + ': signature');
    assert.equal(K.determinant(D), want.determinant, k.name + ': determinant');
    assert.ok(H.eq(K.homfly(D), H.of(homfly[k.name])), k.name + ': HOMFLYPT polynomial');
  }
});

test('the table: 18 links, with the diagrams, Jones and HOMFLYPT polynomials the Knot Atlas lists', () => {
  assert.equal(links.length, 18);
  for (const r of links) {
    const want = linkAtlas[r.name], D = r.D, V = K.jones(D);
    assert.equal(D.cut.length - 1, want.components, r.name + ': components');
    assert.equal(K.faces(D).list.length, D.n + 2, r.name + ': drawn in the plane, in one piece');
    assert.equal(r.rolfsen, want.rolfsen);
    // the Atlas's Jones polynomial with the powers doubled
    const doubled = new Map(want.jones.map(([e, c]) => [e, c]));
    V.c.forEach((c, i) => { assert.equal(c, doubled.get(2 * (V.lo + i)) || 0, r.name + ': Jones polynomial'); });
    assert.equal(V.c.filter((c) => c).length, want.jones.length, r.name + ': Jones polynomial');
    assert.ok(H.eq(K.homfly(D), H.of(want.homfly)), r.name + ': HOMFLYPT polynomial');
  }
});

test('the HOMFLYPT polynomial gives the Jones, Conway and Alexander polynomials', () => {
  for (const r of rows) {
    const Pz = K.homfly(r.D);
    assert.ok(P.eq(K.homflyJones(Pz), K.jones(r.D)), r.name + ': P(1/t, t^½ − t^−½) = V(t)');
    const A = K.conwayAlexander(K.homflyConway(Pz)), A2 = K.alexander(r.D);
    // for a knot Δ(1) = 1 fixes Δ; for a link the determinant does not fix its sign
    if (!r.link) assert.ok(P.eq(A, A2), r.name);
    else assert.ok(P.eq(A, A2) || P.eq(A, { lo: A2.lo, c: A2.c.map((x) => -x) }), r.name);
    // the mirror image: P(1/a, −z)
    assert.ok(H.eq(K.homfly(K.mirror(r.D)), H.mirror(Pz)), r.name + ': mirror image');
  }
});

test('the skein relations hold at every crossing: HOMFLYPT, and Kauffman’s bracket', () => {
  const all = knots.filter((_, i) => i % 3 === 0).map((k) => k.D).concat(links.map((l) => l.D));
  for (let trial = 0; trial < 12; trial++) {
    const d = doodles(2, 120), X = K.crossings(d.pts, d.cut);
    if (X.length && X.length <= 12) all.push(K.diagram(d.pts, X.map(() => (rnd() < 0.5 ? 0 : 1)), X, d.cut));
  }
  let n = 0;
  for (const D of all) {
    for (let x = 0; x < D.n; x++) {
      const Lp = D.sign[x] > 0 ? D : K.switched(D, x), Lm = D.sign[x] > 0 ? K.switched(D, x) : D, L0 = K.smoothed(D, x, true);
      // a P(L₊) − a⁻¹ P(L₋) = z P(L₀)
      assert.ok(H.eq(H.add(H.shift(K.homfly(Lp), 1, 0), H.shift(K.homfly(Lm), -1, 0), -1), H.shift(K.homfly(L0), 0, 1)), 'HOMFLYPT skein relation');
      // ⟨D⟩ = A ⟨D_A⟩ + A⁻¹ ⟨D_B⟩, the A way being the oriented one at a positive crossing
      const DA = K.smoothed(D, x, D.sign[x] > 0), DB = K.smoothed(D, x, D.sign[x] < 0), bA = K.bracket(DA), bB = K.bracket(DB);
      assert.ok(P.eq(K.bracket(D), P.add({ lo: bA.lo + 1, c: bA.c }, { lo: bB.lo - 1, c: bB.c })), 'bracket relation');
      // opening a crossing keeps the diagram planar
      for (const E of [L0, DA, DB]) for (const comps of K.pieces(E)) { const S = K.sub(E, comps); if (S.n) assert.equal(K.faces(S).list.length, S.n + 2, 'planar'); }
      n++;
    }
  }
  assert.ok(n > 150);
});

test('the bracket agrees with the sum over all states, for knots and links', () => {
  for (const k of knots.filter((_, i) => i % 3 === 0)) assert.ok(P.eq(K.bracket(k.D), bracketByStates(k.D)), k.name);
  for (const l of links) assert.ok(P.eq(K.bracket(l.D), bracketByStates(l.D)), l.name);
  for (let trial = 0; trial < 40; trial++) {
    const d = trial % 2 ? doodles(2, 120) : { pts: doodle(160), cut: undefined }, X = K.crossings(d.pts, d.cut);
    if (X.length > 11 || !X.length) continue;
    const D = K.diagram(d.pts, X.map(() => (rnd() < 0.5 ? 0 : 1)), X, d.cut);
    assert.ok(P.eq(K.bracket(D), bracketByStates(D)), 'a curve with ' + X.length + ' crossings');
  }
});

test('links: linking numbers, and the signature agrees with Conway’s polynomial', () => {
  // ∇(2i)/|∇(2i)| = i^(−σ), from a Seifert matrix V: ∇(2i) = det(−i(V + Vᵀ))
  const at2i = (N) => { let re = 0, im = 0; N.c.forEach((c, k) => { const e = N.lo + k, v = c * 2 ** e, r = ((e % 4) + 4) % 4; if (r === 0) re += v; else if (r === 1) im += v; else if (r === 2) re -= v; else im -= v; }); return [re, im]; };
  const ipow = (k) => [[1, 0], [0, 1], [-1, 0], [0, -1]][((k % 4) + 4) % 4];
  for (const r of rows) {
    const s = K.signature(r.D), [re, im] = at2i(K.homflyConway(K.homfly(r.D))), m = Math.hypot(re, im), want = ipow(-s);
    assert.ok(m > 0 && Math.abs(re / m - want[0]) < 1e-9 && Math.abs(im / m - want[1]) < 1e-9, r.name);
  }
  // the Hopf link of the Atlas is the negative one; the Whitehead and Borromean links have linking numbers 0
  assert.deepEqual(K.linking(byName.L2a1.D), [[0, -1], [-1, 0]]);
  assert.deepEqual(K.linking(byName.L5a1.D)[0][1], 0);
  assert.deepEqual(K.linking(byName.L6a4.D).flat().filter((x) => x), []);
  // turning components round: one component of the Hopf link changes the sign of the
  // linking number; all of them, nothing that these invariants see; twice, nothing at all
  const hopf = byName.L2a1.D, one = K.reverse(hopf, [1]);
  assert.deepEqual(K.linking(one), [[0, 1], [1, 0]]);
  assert.equal(K.faces(one).list.length, one.n + 2);
  for (const l of links) {
    const all = K.reverse(l.D, Array.from({ length: l.D.cut.length - 1 }, (_, i) => i));
    assert.ok(H.eq(K.homfly(all), K.homfly(l.D)), l.name);
    const twice = K.reverse(K.reverse(l.D, [0]), [0]);
    assert.ok(H.eq(K.homfly(twice), K.homfly(l.D)) && K.bracketClass(K.reverse(l.D, [0])) === K.bracketClass(l.D), l.name);
  }
  // a link that falls apart: the polynomials multiply, with a loop more
  const D = K.fromPD([[1, 4, 2, 5], [3, 6, 4, 1], [5, 2, 6, 3]]), E = K.sub({ n: 3, seq: D.seq, ov: D.ov, sign: D.sign, cut: [0, 6, 6] }, [0, 1]);
  assert.equal(E.cut.length - 1, 2);
  assert.ok(P.eq(K.jones(E), P.mul(K.jones(D), { lo: -0.5, c: [-1, -1] })));
  assert.equal(K.alexander(E).c.length, 0);
  assert.equal(K.determinant(E), 0);
});

test('the diagrams of the table: fewest crossings, alternating as their codes say', () => {
  for (const k of knots) {
    const alt = k.code.every((x) => x > 0), V = K.jones(k.D);
    assert.equal(K.isAlternating(k.D), alt, k.name);
    assert.ok(K.isReduced(k.D), k.name);
    assert.ok(!K.showsSum(k.D), k.name);
    assert.equal(K.faces(k.D).list.length, k.c + 2, k.name + ': regions');
    assert.equal(K.simplify(k.D).n, k.c, k.name + ': nothing to undo');
    // the span of V is the crossing number for an alternating knot, and less otherwise
    if (alt) assert.equal(V.c.length - 1, k.c, k.name); else assert.ok(V.c.length - 1 < k.c, k.name);
  }
  for (const l of links) {
    assert.ok(K.isReduced(l.D) && !K.showsSum(l.D), l.name);
    assert.equal(K.simplify(l.D).n, l.c, l.name);
    assert.equal(K.isAlternating(l.D), /a/.test(l.name), l.name);
    if (K.isAlternating(l.D)) assert.equal(K.jones(l.D).c.length - 1, l.c, l.name);
  }
});

test('mirror images and sums', () => {
  for (const k of knots) {
    const M = K.mirror(k.D);
    assert.ok(P.eq(K.jones(M), P.flip(K.jones(k.D))), k.name);
    assert.ok(P.eq(K.alexander(M), K.alexander(k.D)), k.name);
    assert.equal(K.signature(M) + K.signature(k.D), 0, k.name);
  }
  for (const [a, b] of [['3_1', '3_1'], ['3_1', '4_1'], ['4_1', '5_2'], ['5_1', '6_2'], ['8_19', '3_1']]) {
    const A = byName[a].D, B = byName[b].D;
    for (const Bm of [B, K.mirror(B)]) {
      const E = K.sum(A, Bm);
      assert.equal(K.faces(E).list.length, E.n + 2, 'planar');
      assert.ok(P.eq(K.jones(E), P.mul(K.jones(A), K.jones(Bm))), a + ' # ' + b);
      assert.ok(P.eq(K.alexander(E), P.mul(K.alexander(A), K.alexander(B))), a + ' # ' + b);
      assert.ok(H.eq(K.homfly(E), H.mul(K.homfly(A), K.homfly(Bm))), a + ' # ' + b);
      assert.equal(K.signature(E), K.signature(A) + K.signature(Bm), a + ' # ' + b);
      assert.ok(K.showsSum(E));
    }
  }
});

test('the catalogue: the three invariants tell its knots apart, but for one pair, which the maps onto S₅ tell apart', () => {
  const cat = K.catalogue(knots), name = (e) => e.parts.map((q) => (q.mirror ? 'm' : '') + q.name).join('#');
  assert.equal(cat.all.length, 193);
  assert.equal(cat.all.filter((e) => e.parts.length > 1).length, 32);
  // the knots that have their mirror image's invariants are the seven that are their own mirror images
  assert.deepEqual(cat.all.filter((e) => e.same).map(name), ['4_1', '6_3', '8_3', '8_9', '8_12', '8_17', '8_18']);
  const clash = [];
  for (const list of cat.byKey.values()) if (list.length > 1) clash.push(list.map(name).join(' = '));
  assert.deepEqual(clash, ['9_12 = 4_1#5_2', 'm9_12 = 4_1#m5_2']);
  // every knot is found again from a diagram of it
  for (const k of knots) {
    const id = K.identify(cat, { V: K.jones(k.D), s: K.signature(k.D), A: K.alexander(k.D) }, k.D);
    assert.ok(id.sure && name(id.entries[0]) === k.name, k.name);
  }
  const turned = (D) => ({ n: D.n, seq: D.seq.slice(1).concat(D.seq[0]), ov: D.ov.slice(1).concat(D.ov[0]), sign: D.sign, cut: D.cut });
  let S = K.sum(byName['4_1'].D, byName['5_2'].D);
  if (!K.isAlternating(S)) S = K.sum(byName['4_1'].D, turned(byName['5_2'].D));
  assert.ok(K.isAlternating(S) && K.isReduced(S));
  const id = K.identify(cat, { V: K.jones(S), s: K.signature(S), A: K.alexander(S) }, S);
  assert.ok(id.sure && name(id.entries[0]) === '4_1#5_2');
  // with a kink, so that the diagram has a crossing to undo, the pair are told apart by
  // the maps of their groups onto S₅: one for 9_12, fifteen for 4_1 # 5_2 (either hand)
  const kinked = (D) => ({ n: D.n + 1, seq: [D.n, D.n].concat(D.seq), ov: [true, false].concat(D.ov), sign: D.sign.concat([1]), cut: [0, 2 * D.n + 2] });
  for (const [D, want] of [[byName['9_12'].D, '9_12'], [K.mirror(byName['9_12'].D), 'm9_12'], [S, '4_1#5_2'], [K.mirror(S), '4_1#m5_2']]) {
    const E = kinked(D), id2 = K.identify(cat, { V: K.jones(E), s: K.signature(E), A: K.alexander(E) }, E);
    assert.equal(K.faces(E).list.length, E.n + 2);
    assert.ok(!K.isReduced(E));
    assert.deepEqual(id2.entries.map(name), [want]);
  }
  assert.deepEqual([3, 4, 5].map((n) => K.onto(byName['9_12'].D, n)), [0, 0, 1]);
  assert.deepEqual([3, 4, 5].map((n) => K.onto(S, n)), [0, 0, 15]);
});

test('the catalogue of links: V and the linking numbers, every way round, tell its links apart', () => {
  const cat = K.linkCatalogue(links.map((l) => ({ name: l.name, c: l.c, D: l.D })), K.catalogue(knots)), name = (e) => e.parts.map((q) => (q.mirror ? 'm' : '') + q.name).join('#');
  assert.equal(cat.full, 7);
  assert.equal(cat.all.length, 163);
  // the links with their mirror images' forms are the Hopf link, 6^2_2 and the Borromean rings, each its own mirror image
  assert.deepEqual(cat.all.filter((e) => e.same).map(name), ['L2a1', 'L6a2', 'L6a4']);
  // no two share a form, and none has determinant 0, as a link that falls apart has
  for (const list of cat.byKey.values()) assert.equal(list.length, 1, list.map(name).join(' = '));
  for (const e of cat.all) for (const f of e.forms) assert.ok(P.absAtMinusOne(f.V) > 0, name(e));
  // each link of the table is found again from a diagram of it, its components run any way, and so is its mirror image
  for (const l of links) for (const mir of [false, true]) {
    const C = l.D.cut.length - 1, E0 = mir ? K.mirror(l.D) : l.D, want = (mir && !['L2a1', 'L6a2', 'L6a4'].includes(l.name) ? 'm' : '') + l.name;
    for (let bits = 0; bits < 1 << C; bits++) {
      const E = K.reverse(E0, Array.from({ length: C }, (_, q) => q).filter((q) => (bits >> q) & 1)), id = K.identifyLink(cat, { V: K.jones(E), H: K.homfly(E) }, E);
      assert.ok(id.sure && id.entries.length === 1 && name(id.entries[0]) === want, want + ', run ' + bits);
    }
  }
});

test('a diagram that is visibly a sum falls into its parts, which name it', () => {
  // sums of knots: two parts in the plane, with the Jones polynomials of the knots
  // summed; a diagram of the table is its own one part
  for (const [a, b] of [['3_1', '4_1'], ['5_2', '8_19'], ['9_42', '3_1']]) {
    const parts = K.summands(K.sum(byName[a].D, byName[b].D));
    assert.equal(parts.length, 2, a + ' # ' + b);
    for (const Q of parts) assert.equal(K.faces(Q).list.length, Q.n + 2, a + ' # ' + b + ': planar');
    assert.deepEqual(parts.map((Q) => P.key(K.jones(Q))).sort(), [a, b].map((x) => P.key(K.jones(byName[x].D))).sort(), a + ' # ' + b);
  }
  for (const r of rows) assert.deepEqual(K.summands(r.D), [r.D], r.name);
  const cat = K.catalogue(knots), lcat = K.linkCatalogue(links.map((l) => ({ name: l.name, c: l.c, D: l.D })), cat), name = (e) => e.parts.map((q) => (q.mirror ? 'm' : '') + q.name).join('#');
  const look = (Q) => (Q.cut.length === 2 ? K.identify(cat, { V: K.jones(Q), s: K.signature(Q), A: K.alexander(Q) }, Q) : K.identifyLink(lcat, { V: K.jones(Q), H: K.homfly(Q) }, Q));
  // a small ring drawn round a strand of the figure-eight knot: the sum of 4_1 and the
  // Hopf link, with the bracket of 6^2_2 up to a unit, but not its linking number
  const t = drawing(byName['4_1']), ring = (p) => Array.from({ length: 41 }, (_, i) => [p[0] + 0.07 * Math.cos(Math.PI * i / 20), p[1] + 0.07 * Math.sin(Math.PI * i / 20)]);
  let S = null;
  for (let i = 0; !S && i < t.pts.length; i += 5) { const w = K.withStroke(t, ring(t.pts[i]), 0.035); if (w && w.X.length === t.X.length + 2) S = K.simplify(diagramOf(w)); }
  assert.equal(S.n, 6);
  assert.equal(K.bracketClass(S), K.bracketClass(byName.L6a2.D));
  const id = look(S);
  assert.ok(id.sure);
  assert.deepEqual(id.entries.map(name), ['4_1#L2a1']);
  assert.deepEqual(K.summands(S).map(look).map((p) => p.sure && name(p.entries[0])).sort(), ['4_1', 'L2a1']);
  // a chain of three rings: the sum of two Hopf links
  const circle = (cx) => Array.from({ length: 81 }, (_, i) => [cx + 0.3 * Math.cos(Math.PI * i / 40), 0.3 * Math.sin(Math.PI * i / 40)]);
  const k = K.withStroke(K.withStroke({ pts: circle(0).slice(0, 80), cut: [0, 80], over: [], X: [] }, circle(-0.45), 0.035), circle(0.45), 0.035), T = K.simplify(diagramOf(k));
  assert.equal(T.n, 4);
  assert.deepEqual(K.summands(T).map(look).map((p) => p.sure && name(p.entries[0])), ['L2a1', 'L2a1']);
  const chain = look(T);
  assert.ok(chain.sure);
  assert.deepEqual(chain.entries.map(name), ['L2a1#L2a1']);
});

test('the drawings of the table have the diagrams of the table', () => {
  for (const r of rows) {
    const d = drawing(r), D = diagramOf(d);
    assert.equal(d.X.length, r.c, r.name);
    assert.equal(D.cut.length, r.D.cut.length, r.name);
    assert.ok(H.eq(K.homfly(D), K.homfly(r.D)), r.name + ': HOMFLYPT polynomial of the drawing');
    assert.equal(K.signature(D), K.signature(r.D), r.name);
    assert.ok(d.pts.every((p) => Math.abs(p[0]) <= 0.82 && Math.abs(p[1]) <= 0.82), r.name + ': inside the frame');
  }
});

test('drawing a diagram from its crossings: circle packing, twists, settling', () => {
  // the circles: tangent where the diagram says, inside the unit disc
  const D = byName['5_2'].D, pk = L.pack(D);
  for (const c of pk.circles) if (c) assert.ok(Math.hypot(c.x, c.y) + c.r <= 1 + 1e-6);
  for (let k = 0; k < 2 * D.n; k++) {
    const a = pk.circles[D.seq[k]], b = pk.circles[D.n + k];
    assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r) < 1e-6, 'a crossing and its edge touch');
  }
  // twists: 9_6 has one of five crossings, and 5_1 is one twist that closes up
  assert.ok(L.twists(byName['9_6'].D).some((t) => t.list.length === 5 && !t.ring));
  assert.deepEqual(L.twists(byName['5_1'].D).map((t) => [t.list.length, t.ring]), [[5, true]]);
  // drawings of knots, links and a diagram in pieces have their diagrams
  const pieces = { n: 6, seq: byName['3_1'].D.seq.concat(byName['3_1'].D.seq.map((c) => c + 3)), ov: byName['3_1'].D.ov.concat(byName['3_1'].D.ov), sign: [1, 1, 1, -1, -1, -1], cut: [0, 6, 12, 12] };
  for (const E of [byName['4_1'].D, byName['7_2'].D, byName['9_6'].D, byName.L2a1.D, byName.L6a4.D, pieces]) {
    const c = L.curve(E, { steps: 150 }), F2 = diagramOf(c);
    assert.ok(H.eq(K.homfly(F2), K.homfly(E)), 'the drawing has the diagram');
    assert.equal(F2.cut.length, E.cut.length);
  }
});

test('symmetries of shadows; drawings kept symmetric and turned upright', () => {
  // the trefoil's shadow: a triangular prism's twelve symmetries, six reflections; the
  // figure-eight's eight; the Borromean rings', an octahedron's 48; 7_6 has none
  const count = (name) => { const s = L.symmetries(byName[name].D); return [s.length, s.filter((t) => t.rev).length]; };
  assert.deepEqual(count('3_1'), [12, 6]);
  assert.deepEqual(count('4_1'), [8, 4]);
  assert.deepEqual(count('L6a4'), [48, 24]);
  assert.deepEqual(count('7_6'), [1, 0]);
  // each takes regions to regions one to one, and edges to edges, and the identity comes first
  for (const name of ['3_1', '5_2', '8_18', 'L5a1']) {
    const D = byName[name].D, F = K.faces(D), syms = L.symmetries(D);
    assert.ok(!syms[0].rev && syms[0].cmap.every((c, i) => c === i));
    for (const s of syms) {
      assert.equal(new Set(L.regionMap(s, F)).size, F.list.length, name);
      const em = L.edgeMap(s, D);
      assert.equal(new Set(em.map(([e]) => e)).size, 2 * D.n, name);
      // a component goes to a component, all one way or all the other
      const { cut } = { cut: D.cut };
      for (let c = 0; c + 1 < cut.length; c++) assert.equal(new Set(em.slice(cut[c], cut[c + 1]).map(([, d]) => d)).size, 1, name);
    }
  }
  // a drawing settled with its symmetries is symmetric, and turned so that an axis is upright
  for (const name of ['4_1', '6_1', 'L5a1']) {
    const D = byName[name].D, r = L.piece(D, { steps: 300 });
    assert.ok(r.symmetric && r.asymmetry() < 1e-6, name + ' symmetric');
    const t = L.orient(r), c = r.result(28, t), F2 = diagramOf(c);
    assert.ok(H.eq(K.homfly(F2), K.homfly(D)), name + ': the drawing has the diagram');
    // reflected in the upright line through its middle, the curve falls on itself
    const P = c.pts, mx = (Math.min(...P.map((p) => p[0])) + Math.max(...P.map((p) => p[0]))) / 2;
    const off = P.reduce((m, p) => Math.max(m, Math.min(...P.map((q) => Math.hypot(2 * mx - p[0] - q[0], p[1] - q[1])))), 0);
    assert.ok(off < 0.03, name + ': upright mirror, ' + off);
  }
  // and so are the table's
  for (const name of ['4_1', '5_2', '6_1', '7_4', '8_18', '9_40', 'L5a1', 'L6a4']) {
    const P = drawing(byName[name]).pts, mx = (Math.min(...P.map((p) => p[0])) + Math.max(...P.map((p) => p[0]))) / 2;
    const off = P.reduce((m, p) => Math.max(m, Math.min(...P.map((q) => Math.hypot(2 * mx - p[0] - q[0], p[1] - q[1])))), 0);
    assert.ok(off < 0.03, name + ' in the table: upright mirror, ' + off);
  }
});

test('two strands joined across, and a component drawn onto a link', () => {
  // two circles side by side, run the same way round, touching: joined along their
  // directions they make one circle; the other way, one with a kink, either way up
  const circle = (cx, n) => Array.from({ length: n }, (_, i) => [cx + 0.3 * Math.cos(2 * Math.PI * i / n), 0.3 * Math.sin(2 * Math.PI * i / n)]);
  const pts = circle(-0.31, 60).concat(circle(0.31, 60)), two = { pts, cut: [0, 60, 120], over: [], X: K.crossings(pts, [0, 60, 120]) };
  const a = K.reconnect(two, 0, 90, true, 0);
  assert.ok(a && !a.crossed && a.cut.length === 2 && a.X.length === 0);
  const w = [0, 1].map((top) => { const r = K.reconnect(two, 0, 90, false, top); assert.ok(r && r.crossed && r.cut.length === 2); return K.writhe(diagramOf(r)); });
  assert.deepEqual(w.sort(), [-1, 1]);
  // a line drawn across a circle: one more component, crossings over and under in turn along it
  const base = { pts: circle(0, 80), cut: [0, 80], over: [], X: [] }, stroke = Array.from({ length: 120 }, (_, i) => [0.5 * Math.cos(2 * Math.PI * i / 120), 0.12 * Math.sin(2 * Math.PI * i / 120)]);
  const k = K.withStroke(base, stroke, 0.035), E = diagramOf(k);
  assert.equal(k.cut.length, 3);
  assert.equal(k.X.length, 4);
  assert.ok(K.isAlternating(E));
  // the crossings the link had keep their bits
  const t = drawing(byName['3_1']), more = K.withStroke(t, Array.from({ length: 60 }, (_, i) => [0.95 + 0.04 * Math.cos(2 * Math.PI * i / 60), 0.04 * Math.sin(2 * Math.PI * i / 60)]), 0.02);
  assert.ok(more && more.cut.length === 3 && P.eq(K.jones(diagramOf({ pts: more.pts.slice(0, t.pts.length), cut: t.cut, over: more.over.slice(0, 3), X: K.crossings(more.pts.slice(0, t.pts.length), t.cut) })), K.jones(diagramOf(t))));
  // (a step just short of the start of a component stays on it)
  const R2 = K.ring(80, [0, 80]);
  assert.equal(K.along(R2, 0, -1e-17), 0);
  assert.ok(K.along(R2, 0, -1e-15) < 80);
});

test('hyperbolic volume: the octahedral decomposition, squashed, simplified and solved', () => {
  // the regular ideal tetrahedron and octahedron, by Lobachevsky's function
  assert.ok(Math.abs(3 * KV.lobachevsky(Math.PI / 3) - 1.0149416064096536) < 1e-12);
  assert.ok(Math.abs(KV.bloch([0.5, Math.sqrt(3) / 2]) - 1.0149416064096536) < 1e-12);
  // the decomposition: every face glued back, orientations kept, 4n + 2 edges, and
  // three vertices for a knot (its cusp, and the two points added)
  for (const name of ['4_1', '8_19', 'L6a4']) {
    const D = byName[name].D, tri = KV.triangulate(D), cls = KV.classes(tri);
    tri.glue.forEach((g, t) => g.forEach((x, f) => {
      const back = tri.glue[x.t][x.f];
      assert.ok(back.t === t && back.f === f && [0, 1, 2, 3].every((i) => back.perm[x.perm[i]] === i), name);
      let inversions = 0;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (x.perm[i] > x.perm[j]) inversions++;
      assert.equal(inversions % 2, 1, name + ': gluings reverse orientation');
    }));
    assert.equal(cls.edges.length, 4 * D.n + 2, name);
    assert.equal(cls.verts.length, D.cut.length - 1 + 2, name);
    // squashed and simplified: an ideal triangulation, as many edges as tetrahedra
    const ideal = KV.simplify(KV.ideals(D, 1)[0]), c2 = KV.classes(ideal);
    assert.equal(c2.edges.length, ideal.T.length, name);
    assert.equal(c2.verts.length, D.cut.length - 1, name);
  }
  // the volumes of the figure-eight knot (two regular ideal tetrahedra), the Whitehead
  // link (a regular ideal octahedron) and the Borromean rings (two), and of 5_2, 6_1;
  // none for torus knots
  const want = { '4_1': 2.029883212819307, L5a1: 3.663862376708876, L6a4: 7.327724753417752, '5_2': 2.828122088330783, '6_1': 3.163963228883144 };
  for (const [name, v] of Object.entries(want)) {
    const got = KV.volume(byName[name].D);
    assert.ok(got !== null && Math.abs(Math.abs(got) - v) < 1e-8, name + ': ' + got);
  }
  for (const name of ['3_1', '5_1']) assert.equal(KV.volume(byName[name].D, { starts: 12 }), null, name);
  // a knot and its mirror image have the same volume
  assert.ok(Math.abs(Math.abs(KV.volume(K.mirror(byName['5_2'].D))) - want['5_2']) < 1e-8);
});

test('Seifert circles, genus and braid index bounds', () => {
  const s = (name) => K.seifertCircles(byName[name].D);
  assert.deepEqual(['3_1', '4_1', '5_1', '8_19', 'L2a1', 'L6a4'].map(s), [2, 3, 2, 3, 2, 3]);
  for (const r of knots) {
    const S = K.simplify(r.D), sc = K.seifertCircles(S), A = K.alexander(S), P = K.homfly(S, 60000);
    // half the span of Δ is at most the genus of Seifert's surface, and equal for an alternating diagram
    const lo = (A.c.length - 1) / 2, hi = (S.n - sc + 1) / 2;
    assert.ok(lo <= hi, r.name);
    if (K.isAlternating(S)) assert.equal(lo, hi, r.name + ': alternating');
    // the Morton–Franks–Williams bound is at most the number of Seifert circles
    if (P) { const as = H.terms(P).map(([i]) => i); assert.ok((Math.max(...as) - Math.min(...as)) / 2 + 1 <= sc, r.name); }
  }
});

test('descending curves are unlinks; curves drawn by hand alternate', () => {
  for (let trial = 0; trial < 25; trial++) {
    const d = trial % 2 ? doodles(2, 160) : { pts: doodle(240), cut: [0, 240] }, X = K.crossings(d.pts, d.cut);
    if (!X.length || X.length > 40) continue;
    // over at every crossing met the first time: the first component lies above the second,
    // and each goes only down, so it is a pile of loops
    const D = K.diagram(d.pts, X.map(() => 0), X, d.cut), C = d.cut.length - 1;
    assert.ok(H.eq(K.homfly(D), H.of(C === 1 ? [[0, 0, 1]] : [[1, -1, 1], [-1, -1, -1]])), 'HOMFLYPT of the unlink');
    assert.equal(K.signature(D), 0);
    const k = K.fromStrokes(d.cut.slice(1).map((e, i) => d.pts.slice(d.cut[i], e)), 0.035);
    if (k) assert.ok(K.isAlternating(diagramOf(k)));
  }
});

test('tidying keeps the link and never adds crossings', () => {
  for (let trial = 0; trial < 60; trial++) {
    const d = trial % 3 ? { pts: doodle(200), cut: undefined } : doodles(2, 140), X = K.crossings(d.pts, d.cut);
    if (!X.length || X.length > 22) continue;
    const D = K.diagram(d.pts, X.map(() => (rnd() < 0.5 ? 0 : 1)), X, d.cut), S = K.simplify(D);
    assert.ok(S.n <= D.n);
    for (const comps of K.pieces(S)) { const E = K.sub(S, comps); if (E.n) assert.equal(K.faces(E).list.length, E.n + 2, 'still planar'); }
    assert.ok(H.eq(K.homfly(S), K.homfly(D)));
    assert.equal(K.signature(S), K.signature(D));
    assert.ok(K.isReduced(S));
  }
});

test('pulling the curve about never changes the link; what it is hooked on comes along', () => {
  let changed = 0, caught = 0;
  for (const r of rows.filter((_, i) => i % 9 === 0 || i > 96)) {
    const want = P.key(K.jones(r.D)) + '|' + K.signature(r.D);
    let k = drawing(r);
    for (let step = 0; step < 20; step++) {
      const N = k.pts.length, i = Math.floor(rnd() * N), a = rnd() * 2 * Math.PI, d = 0.05 + 0.3 * rnd(), n0 = k.over.length;
      let cur = k;
      for (let e = 0; e < 6; e++) cur = K.pull(cur, i, d / 6 * Math.cos(a), d / 6 * Math.sin(a), 16);
      if (cur.blocked) caught++;
      cur = K.respace(K.fair(cur, 12), 0.035);
      const D = diagramOf(cur);
      if (D.n !== n0) changed++;
      assert.equal(P.key(K.jones(D)) + '|' + K.signature(D), want, r.name + ', pull ' + step);
      k = { pts: cur.pts, cut: cur.cut, over: cur.over };
    }
  }
  assert.ok(changed > 5, 'some pulls change the number of crossings');
  assert.ok(caught > 0, 'some pulls are caught');
  // every part of 9_6 can be pulled some way (the twist it has comes along when hooked)
  const k = drawing(byName['9_6']);
  for (let i = 0; i < k.pts.length; i += 15) {
    let free = 0;
    for (let d = 0; d < 8; d++) {
      let cur = k, moved = 0;
      for (let e = 0; e < 4; e++) { const g = cur.pts[i], r2 = K.pull(cur, i, 0.012 * Math.cos(d * Math.PI / 4), 0.012 * Math.sin(d * Math.PI / 4), 12); moved += Math.hypot(r2.pts[i][0] - g[0], r2.pts[i][1] - g[1]); cur = r2; }
      if (moved > 0.02) free++;
    }
    assert.ok(free >= 3, 'vertex ' + i + ' of 9_6 moves');
  }
});

test('a clasp holds, and its crossings stay apart', () => {
  // the lobe of the trefoil, reflected across the line through its two crossings, would lie
  // across the strand that closes it: it is caught there, the two crossings still apart
  const r = byName['3_1'], k = drawing(r), X = k.X, V = K.visits(X), N = k.pts.length;
  let top = 0;
  k.pts.forEach((p, i) => { if (p[1] > k.pts[top][1]) top = i; });
  let j = V.findIndex((v, i) => v.t <= top && V[(i + 1) % V.length].t > top);
  if (j < 0) j = V.length - 1;
  const v0 = V[j], v1 = V[(j + 1) % V.length], c0 = X[v0.c], c1 = X[v1.c], ux = c1.x - c0.x, uy = c1.y - c0.y, uu = ux * ux + uy * uy;
  const inLobe = (i) => (v0.t < v1.t ? i > v0.t && i <= v1.t : i > v0.t || i <= v1.t);
  const to = k.pts.map((p, i) => {
    if (!inLobe(i)) return p;
    const f = ((p[0] - c0.x) * ux + (p[1] - c0.y) * uy) / uu, fx = c0.x + f * ux, fy = c0.y + f * uy;
    return [2 * fx - p[0], 2 * fy - p[1]];
  });
  assert.ok(N > 20 && to.some((p, i) => p !== k.pts[i]));
  const res = K.advance(k, to);
  assert.ok(res.blocked && res.moved < 1);
  assert.ok(res.caught && res.caught.kind === 'clasp' && res.caught.at.length === 2);
  const D = diagramOf(res);
  assert.equal(P.key(K.jones(D)), P.key(K.jones(r.D)));
  // no clasp (two crossings next to each other along both strands, a different strand on
  // top at each) has its crossings closer than SEP; pairs that one more move would
  // remove (the same strand on top at both) may come together
  const clasps = (k2) => {
    const W = K.visits(k2.X), R = K.ring(k2.pts.length, k2.cut), nx = W.map((_, i) => { const c = R.cp[Math.floor(W[i].t)]; let j = (i + 1) % W.length; if (R.cp[Math.floor(W[j].t)] !== c) { j = i; while (j > 0 && R.cp[Math.floor(W[j - 1].t)] === c) j--; } return j; });
    const pos = k2.X.map(() => [0, 0]);
    W.forEach((w, i) => { pos[w.c][w.w] = i; });
    const top = (c, w) => (k2.over[c] ? 1 : 0) === w, adj = (a, b) => nx[a] === b || nx[b] === a, out = [];
    W.forEach((w, i) => {
      const l = nx[i], a = w.c, b = W[l].c;
      if (a === b || !adj(pos[a][1 - w.w], pos[b][1 - W[l].w]) || top(a, w.w) === top(b, W[l].w)) return;
      out.push(Math.hypot(k2.X[a].x - k2.X[b].x, k2.X[a].y - k2.X[b].y));
    });
    return out;
  };
  for (const dist of clasps(res)) assert.ok(dist > 0.8 * K.SEP, 'a clasp keeps apart: ' + dist.toFixed(3));
  // pulled hard against a clasp, a pair of strands stops short of it
  const four = drawing(byName['4_1']);
  let cur = four;
  for (let step = 0; step < 60; step++) {
    const i = (step * 37) % cur.pts.length, a = step * 2.4;
    cur = K.pull(cur, i, 0.02 * Math.cos(a), 0.02 * Math.sin(a), 14);
    for (const dist of clasps(cur)) assert.ok(dist > 0.8 * K.SEP || dist > 0.9 * Math.min(...clasps(four)), 'a clasp keeps apart: ' + dist.toFixed(3));
  }
});

test('opening a crossing of a drawing gives the diagram opened', () => {
  for (const name of ['4_1', '5_2', '8_19', 'L2a1', 'L6a4', 'L7n1']) {
    const k = drawing(byName[name]), D = diagramOf(k);
    for (let x = 0; x < D.n; x++) for (const oriented of [true, false]) {
      const r = K.smoothAt(k, x, oriented);
      if (!r) continue;
      const E = diagramOf(r), want = K.smoothed(D, x, oriented);
      assert.equal(E.n, D.n - 1, name);
      assert.equal(K.bracketClass(E), K.bracketClass(want), name + ' at ' + x);
      if (oriented) assert.ok(H.eq(K.homfly(E), K.homfly(want)), name + ' at ' + x + ': HOMFLYPT');
    }
  }
});

test('the bits that give a drawing its diagram are found again', () => {
  for (const r of rows.filter((_, i) => i % 5 === 0)) {
    const d = drawing(r), bits = K.matchBits(d.pts, d.cut, r.D, d.X);
    assert.ok(bits, r.name);
    assert.ok(H.eq(K.homfly(K.diagram(d.pts, bits, d.X, d.cut)), K.homfly(r.D)), r.name);
  }
  // a drawing whose shadow is not the diagram's has none
  const d = drawing(byName['5_1']);
  assert.equal(K.matchBits(d.pts, d.cut, byName['5_2'].D, d.X), null);
});

test('colourings: there are some exactly mod the primes that divide the determinant', () => {
  for (const k of knots) {
    const det = K.determinant(k.D);
    for (const p of [3, 5, 7, 11, 13]) {
      const c = K.colourings(k.D, p), A = K.arcs(k.D);
      assert.equal(c.dim > 1, det % p === 0, k.name + ' mod ' + p);
      if (!c.arcs) continue;
      assert.ok(new Set(c.arcs).size > 1, 'not constant');
      for (const at of A.at) assert.ok((2 * c.arcs[at.top] - c.arcs[at.into] - c.arcs[at.out]) % p === 0, k.name + ' mod ' + p);
    }
  }
  for (const l of links) {
    const det = K.determinant(l.D), c = K.colourings(l.D, 3);
    assert.equal(c.dim > c.flat, det % 3 === 0, l.name);
  }
});

// Fox's free calculus: the Alexander polynomial of a presentation whose generators
// all go to t, from the minor without the last column
function foxAlexander(pres) {
  const idx = new Map(pres.gens.map((g, i) => [g, i]));
  const M = pres.rels.map((w) => {
    const row = pres.gens.map(() => P.ZERO);
    let e = 0;
    for (const x of w) { const j = idx.get(Math.abs(x)); if (x > 0) { row[j] = P.add(row[j], { lo: e, c: [1] }); e++; } else { e--; row[j] = P.add(row[j], { lo: e, c: [-1] }); } }
    return row.slice(0, pres.gens.length - 1);
  });
  const det = (A) => { if (!A.length) return P.ONE; let s = P.ZERO; for (let j = 0; j < A.length; j++) { if (!A[0][j].c.length) continue; s = P.add(s, P.mul(A[0][j], det(A.slice(1).map((r) => r.filter((_, k) => k !== j)))), j % 2 ? -1 : 1); } return s; };
  return det(M);
}
const upToUnits = (p) => { if (!p.c.length) return '0'; const c = p.c[p.c.length - 1] < 0 ? p.c.map((x) => -x) : p.c; return c.join(','); };

test('the group: the shorter presentation gives the Alexander polynomial, and maps onto S₃ as the colourings say', () => {
  for (const k of knots) {
    const pres = K.presentation(k.D);
    assert.equal(pres.rels.length, pres.gens.length - 1, k.name + ': deficiency one');
    assert.equal(upToUnits(foxAlexander(pres)), upToUnits(K.alexander(k.D)), k.name + ': Fox calculus');
    // onto S₃, up to conjugation: (3^dim − 3)/6, from the colourings mod 3
    assert.equal(K.onto(k.D, 3), (3 ** K.colourings(k.D, 3).dim - 3) / 6, k.name);
  }
  // 2-bridge knots: two generators, one relation; the trefoil's ⟨x, y | xyx = yxy⟩ has a word of length 6
  for (const name of ['3_1', '4_1', '5_2', '6_1', '7_4', '8_12']) assert.equal(K.presentation(byName[name].D).gens.length, 2, name);
  assert.equal(K.presentation(byName['3_1'].D).rels[0].length, 6);
  // the Hopf link's group is ℤ²: one relation, a commutator
  const hopf = K.presentation(byName.L2a1.D);
  assert.equal(hopf.gens.length, 2);
  assert.equal(hopf.rels.length, 1);
  assert.deepEqual(hopf.rels[0].map(Math.abs).sort(), [hopf.gens[0], hopf.gens[0], hopf.gens[1], hopf.gens[1]].sort());
});

test('homomorphisms onto S₃, S₄ and S₅: counted again by brute force on two generators', () => {
  const perms = (n) => { const out = []; (function f(p, r) { if (!r.length) { out.push(p); return; } r.forEach((x, i) => f(p.concat([x]), r.filter((_, j) => j !== i))); })([], [...Array(n).keys()]); return out; };
  const groups = {};
  for (const n of [3, 4, 5]) {
    const els = perms(n), key = (p) => p.join(), idx = new Map(els.map((p, i) => [key(p), i])), m = els.length, M = new Int32Array(m * m);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) M[i * m + j] = idx.get(key(els[j].map((x) => els[i][x])));
    groups[n] = { m, M, inv: els.map((p) => { const q = []; p.forEach((x, k) => { q[x] = k; }); return idx.get(key(q)); }), id: idx.get(key([...Array(n).keys()])) };
  }
  let checked = 0;
  for (const k of knots) {
    const pres = K.presentation(k.D);
    if (pres.gens.length !== 2) continue;
    for (const n of [3, 4, 5]) {
      const G = groups[n], at = new Map(pres.gens.map((x, i) => [x, i]));
      let count = 0;
      for (let a = 0; a < G.m; a++) for (let b = 0; b < G.m; b++) {
        const v = [a, b], word = (w) => w.reduce((r, x) => G.M[r * G.m + (x > 0 ? v[at.get(x)] : G.inv[v[at.get(-x)]])], G.id);
        if (!pres.rels.every((w) => word(w) === G.id)) continue;
        const have = new Uint8Array(G.m), list = [G.id];
        have[G.id] = 1;
        for (let i = 0; i < list.length; i++) for (const e of v) { const y = G.M[list[i] * G.m + e]; if (!have[y]) { have[y] = 1; list.push(y); } }
        if (list.length === G.m) count++;
      }
      assert.equal(K.onto(k.D, n), count / G.m, k.name + ' onto S' + n);
    }
    checked++;
  }
  assert.ok(checked > 30);
});

test('a component lying above the rest wherever they cross is parted from them', () => {
  // a circle over the trefoil at all four of their crossings: two layers, which Tidy
  // draws apart, as the same link (the same Jones polynomial)
  const t = drawing(byName['3_1']), circ = Array.from({ length: 120 }, (_, i) => [0.25 + 0.42 * Math.cos(2 * Math.PI * i / 120), 0.1 + 0.42 * Math.sin(2 * Math.PI * i / 120)]);
  const pts = t.pts.concat(circ), cut = [0, t.pts.length, pts.length], X = K.crossings(pts, cut), R = K.ring(pts.length, cut);
  const over = X.map((x) => {
    if (R.cp[Math.floor(x.b)] === 1) return R.cp[Math.floor(x.a)] === 1 ? 0 : 1;
    return t.over[t.X.findIndex((y) => Math.hypot(y.x - x.x, y.y - x.y) < 1e-9)];
  });
  const D = K.diagram(pts, over, X, cut);
  assert.equal(D.n, 7);
  assert.deepEqual(K.layers(D), [[0], [1]]);
  const D2 = K.apart(D, K.layers(D));
  assert.equal(D2.n, 3);
  assert.equal(P.key(K.jones(D2)), P.key(K.jones(D)));
  const k = L.curve(D2, { density: 28, steps: 300, quick: true }), Rk = K.ring(k.pts.length, k.cut);
  assert.equal(k.X.filter((x) => Rk.cp[Math.floor(x.a)] !== Rk.cp[Math.floor(x.b)]).length, 0);
  // the Hopf link does not come apart
  assert.equal(K.layers(byName.L2a1.D).length, 1);
});

test('switching where the computation chooses leads to a pile of loops, and never round', () => {
  // (the working of the skein relation on the page follows these choices: every
  // switch must bring the diagram nearer to a pile of loops, so none undoes another)
  for (const r of rows) {
    let E = r.D;
    const seen = new Set();
    for (let s = 0; s <= r.D.n; s++) {
      const x = K.toSwitch(E);
      if (x < 0) break;
      const key = E.seq.join() + '|' + E.ov.map(Number).join('');
      assert.ok(!seen.has(key), r.name + ': a diagram met twice');
      seen.add(key);
      E = K.switched(E, x);
      assert.ok(s < r.D.n, r.name + ': more switches than crossings');
    }
    // a pile of loops: its HOMFLYPT polynomial is μ^(c − 1), as for c loops apart
    const c = E.cut.length - 1, mu = K.poly2.add(K.poly2.mono(1, -1), K.poly2.mono(-1, -1), -1);
    let want = K.poly2.mono(0, 0);
    for (let i = 1; i < c; i++) want = K.poly2.mul(want, mu);
    assert.equal(K.poly2.key(K.homfly(E)), K.poly2.key(want), r.name);
  }
});

test('the curve in space passes over where the diagram says, and stays near the plane', () => {
  for (const r of rows.filter((_, i) => i % 7 === 0)) {
    const d = drawing(r), z = K.heights(d.pts, d.X, d.over, d.cut), R = K.ring(d.pts.length, d.cut);
    const at = (t) => { const i = Math.floor(t), f = t - i; return z[i] + f * (z[R.nx[i]] - z[i]); };
    d.X.forEach((x, i) => { const first = at(x.a), second = at(x.b); assert.ok(d.over[i] ? second > first + 1.9 : first > second + 1.9, r.name); });
    // (the gap asked for is 2; the least bending alone would rise in long waves, far from the plane)
    assert.ok(Math.max(...z.map(Math.abs)) < 3, r.name);
  }
});

test('codes that no diagram has are refused', () => {
  assert.throws(() => K.fromDT([4, 4, 2]));
  // the word 1 2 3 4 5 3 4 1 2 5 meets Gauss's condition, yet no closed curve in the plane has it
  assert.throws(() => K.fromDT([8, 6, 10, 4, 2]));
  assert.throws(() => K.fromPD([[1, 2, 3, 4], [1, 2, 3, 5]]));
});
