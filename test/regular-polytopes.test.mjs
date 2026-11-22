// Independent checks of the mathematics in content/regular-polytopes/: Wythoff's construction
// (polytopes.js) against the known counts of faces and Euler's formula, its duals, the vertex
// configurations and names of the uniform polyhedra and tilings (with angles π/∞ too), the
// honeycombs of rank four, Petrie polygons and the Coxeter plane, sections of the 4-polytopes, and
// the Penrose tilings by deflation (penrose.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/regular-polytopes/polytopes.js';
import '../content/regular-polytopes/penrose.js';

const P = globalThis.Polytopes, PEN = globalThis.Penrose, INF = Infinity;
const RINGS3 = [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]];
const PHI = (1 + Math.sqrt(5)) / 2;
const counts = (W) => [W.V, W.edges.length / 3, W.faces.length];
const at = (W, v, d) => Array.from(W.pos.subarray(d * v, d * v + d));
const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
// the lengths of the edges of a complex, as the model measures them
function lengths(M, W) {
  const out = [];
  for (let i = 0; i < W.edges.length; i += 3) out.push(M.far(at(W, W.edges[i], M.d), at(W, W.edges[i + 1], M.d)));
  return out;
}
const spread = (xs) => Math.max(...xs) - Math.min(...xs);
const conf = (c) => P.confKey(c.sizes);

test('the Platonic and Archimedean solids: counts, Euler, names, edges of one length', () => {
  // V, E, F of {p,q}, t{p,q}, r{p,q}, t{q,p}, {q,p}, rr{p,q}, tr{p,q}, and the snub
  const KNOWN = {
    '3,3': [[4, 6, 4], [12, 18, 8], [6, 12, 8], [12, 18, 8], [4, 6, 4], [12, 24, 14], [24, 36, 14], [12, 30, 20]],
    '4,3': [[8, 12, 6], [24, 36, 14], [12, 24, 14], [24, 36, 14], [6, 12, 8], [24, 48, 26], [48, 72, 26], [24, 60, 38]],
    '5,3': [[20, 30, 12], [60, 90, 32], [30, 60, 32], [60, 90, 32], [12, 30, 20], [60, 120, 62], [120, 180, 62], [60, 150, 92]],
  };
  const NAMES = { '4,3': ['Cube', 'Truncated cube', 'Cuboctahedron', 'Truncated octahedron', 'Octahedron', 'Rhombicuboctahedron', 'Truncated cuboctahedron', 'Snub cube'] };
  for (const key of Object.keys(KNOWN)) {
    const [p, q] = key.split(',').map(Number), M = P.model([p, q]), T = P.chambers(M);
    assert.equal(M.kind, 'sphere');
    assert.equal(T.N, { '3,3': 24, '4,3': 48, '5,3': 120 }[key], 'the order of the group');
    RINGS3.forEach((r, i) => {
      const x = P.uniform(M, r), W = P.wythoff(T, x), [V, E, F] = counts(W);
      assert.deepEqual([V, E, F], KNOWN[key][i], key + ' rings ' + r.join(''));
      assert.equal(V - E + F, 2);
      assert.ok(spread(lengths(M, W)) < 1e-9, 'uniform: edges of one length');
      // the configuration read off the chambers is the one the faces round x make
      assert.equal(conf(P.vertexConfig(M, P.wallsOf(M, x))), conf(P.configuration(W, 0)));
      if (NAMES[key]) assert.equal(P.nameByConfig('sphere', P.vertexConfig(M, P.wallsOf(M, x)).sizes), NAMES[key][i]);
    });
    const S = P.snub(T, P.snubPoint(M));
    assert.deepEqual(counts(S), KNOWN[key][7], key + ' snub');
    assert.ok(spread(lengths(M, S)) < 1e-9, 'the snub point makes every edge of one length');
    assert.equal(conf(P.vertexConfig(M, [false, false, false], true)), conf(P.configuration(S, 0)));
  }
  // the prisms and antiprisms of [p, 2]
  const M = P.model([7, 2]), T = P.chambers(M), W = P.wythoff(T, P.uniform(M, [1, 0, 1])), S = P.snub(T, P.snubPoint(M));
  assert.deepEqual(counts(W), [14, 21, 9]);
  assert.equal(P.nameByConfig('sphere', P.configuration(W, 0).sizes), 'Heptagonal prism');
  assert.deepEqual(counts(S), [14, 28, 16]);
  assert.equal(P.nameByConfig('sphere', P.configuration(S, 0).sizes), 'Heptagonal antiprism');
  assert.ok(spread(lengths(M, S)) < 1e-9);
});

test('the regular polygons and their truncations', () => {
  for (const p of [3, 5, 8, 12]) {
    const M = P.model([p]), T = P.chambers(M);
    assert.equal(T.N, 2 * p);
    const W = P.wythoff(T, P.uniform(M, [1, 0])), W2 = P.wythoff(T, P.uniform(M, [1, 1]));
    assert.deepEqual([W.V, W.faces[0].v.length], [p, p]);
    assert.deepEqual([W2.V, W2.faces[0].v.length], [2 * p, 2 * p]);
    assert.ok(spread(lengths(M, W2)) < 1e-12, 'x in the middle: a regular 2p-gon');
  }
});

test('the dual of a quasiregular polyhedron is a rhombic one', () => {
  for (const [p, ratio, n] of [[4, Math.SQRT2, 12], [5, PHI, 30]]) {
    const M = P.model([p, 3]), T = P.chambers(M), W = P.wythoff(T, P.uniform(M, [0, 1, 0])), D = P.polar(W);
    assert.equal(D.faces.length, n);
    for (const f of D.faces) {
      assert.equal(f.pts.length, 4, 'a quadrilateral');
      const sides = f.pts.map((a, i) => dist(a, f.pts[(i + 1) % 4]));
      assert.ok(spread(sides) < 1e-9, 'with equal sides');
      const d1 = dist(f.pts[0], f.pts[2]), d2 = dist(f.pts[1], f.pts[3]);
      assert.ok(Math.abs(Math.max(d1, d2) / Math.min(d1, d2) - ratio) < 1e-9, 'its diagonals in the ratio ' + ratio);
      // planar, and tangent to the unit sphere at the vertex of the cuboctahedron it stands for
      for (const q of f.pts) assert.ok(Math.abs(f.n.reduce((s, x, i) => s + x * q[i], 0) - 1) < 1e-9);
    }
    assert.deepEqual([...new Set(D.kinds)].sort(), [0, 2]);
    assert.equal(P.dualName(P.nameByConfig('sphere', P.configuration(W, 0).sizes)), p === 4 ? 'Rhombic dodecahedron' : 'Rhombic triacontahedron');
  }
});

test('the tilings of the plane: the eleven Archimedean tilings, and Laves’s duals', () => {
  const KNOWN = {
    '4,4,2': ['4.4.4.4', '4.8.8', '4.4.4.4', '4.8.8', '4.4.4.4', '4.4.4.4', '4.8.8', '3.3.4.3.4'],
    '6,3,2': ['6.6.6', '3.12.12', '3.6.3.6', '6.6.6', '3.3.3.3.3.3', '3.4.6.4', '4.6.12', '3.3.3.3.6'],
    '3,3,3': ['3.3.3.3.3.3', '3.6.3.6', '3.3.3.3.3.3', '3.6.3.6', '3.3.3.3.3.3', '3.6.3.6', '6.6.6', '3.3.3.3.3.3'],
  };
  const names = new Set();
  for (const key of Object.keys(KNOWN)) {
    const M = P.model(P.triangle(...key.split(',').map(Number))), T = P.chambers(M, 12);
    assert.equal(M.kind, 'plane');
    RINGS3.forEach((r, i) => {
      const x = P.uniform(M, r), W = P.wythoff(T, x);
      assert.equal(conf(P.configuration(W, 0)), KNOWN[key][i], key + ' rings ' + r.join(''));
      assert.equal(conf(P.vertexConfig(M, P.wallsOf(M, x))), KNOWN[key][i]);
      assert.ok(spread(lengths(M, W)) < 1e-9);
      names.add(P.nameByConfig('plane', P.configuration(W, 0).sizes));
    });
    const S = P.snub(T, P.snubPoint(M));
    assert.equal(conf(P.configuration(S, 0)), KNOWN[key][7]);
    assert.ok(spread(lengths(M, S)) < 1e-9);
    names.add(P.nameByConfig('plane', P.configuration(S, 0).sizes));
  }
  // the one that is not Wythoff's: rows of squares and triangles
  const E = P.elongated(6), mid = E.faces.flatMap((f) => f.v).find((v) => Math.hypot(E.pos[3 * v], E.pos[3 * v + 1]) < 1.5);
  const round = E.faces.filter((f) => f.v.includes(mid)).map((f) => f.v.length).sort();
  assert.deepEqual(round, [3, 3, 3, 4, 4]);
  for (let i = 0; i < E.edges.length; i += 3) assert.ok(Math.abs(dist(at(E, E.edges[i], 3), at(E, E.edges[i + 1], 3)) - 1) < 1e-9);
  names.add(P.nameByConfig('plane', [3, 3, 3, 4, 4]));
  assert.equal(names.size, 11, 'all eleven: ' + [...names].join(', '));
  // the dual of the snub square tiling: Cairo's pentagons
  const M = P.model([4, 4]), T = P.chambers(M, 12), S = P.snub(T, P.snubPoint(M)), D = P.laves(S);
  const near = D.faces.filter((f) => Math.hypot(S.pos[3 * f.at], S.pos[3 * f.at + 1]) < 4);
  assert.ok(near.length > 10 && near.every((f) => f.v.length === 5));
  assert.equal(P.dualName('Snub square tiling'), 'Cairo pentagonal tiling');
});

test('hyperbolic tilings: [7,3] and [5,4], the triangle (4 3 3), and angles π/∞', () => {
  for (const [p, q] of [[7, 3], [5, 4], [3, 8]]) {
    const M = P.model([p, q]), T = P.chambers(M, 4);
    assert.equal(M.kind, 'hyperbolic');
    const x = P.uniform(M, [1, 1, 1]);
    assert.ok(Math.abs(M.form(x, x) + 1) < 1e-12, 'the points are on the sheet ⟨x, x⟩ = −1');
    for (const r of RINGS3) {
      const W = P.wythoff(T, P.uniform(M, r));
      assert.equal(conf(P.vertexConfig(M, P.wallsOf(M, P.uniform(M, r)))), conf(P.configuration(W, 0)));
      assert.ok(spread(lengths(M, W)) < 1e-6 * Math.max(...lengths(M, W)), 'cosh of the edges, all one');
    }
  }
  const name = (m, r, snubbed) => { const M = P.model(m); return P.nameByConfig(M.kind, P.vertexConfig(M, P.wallsOf(M, P.uniform(M, r)), snubbed).sizes); };
  assert.equal(name([7, 3], [1, 0, 0]), 'Heptagonal tiling');
  assert.equal(name([7, 3], [0, 0, 1]), 'Order-7 triangular tiling');
  assert.equal(name([7, 3], [0, 1, 0]), 'Triheptagonal tiling');
  assert.equal(name([7, 3], [1, 0, 1]), 'Rhombitriheptagonal tiling');
  assert.equal(name([7, 3], [1, 1, 1]), 'Truncated triheptagonal tiling');
  assert.equal(name([7, 3], [1, 1, 1], true), 'Snub triheptagonal tiling');
  assert.equal(name([5, 4], [0, 1, 0]), 'Tetrapentagonal tiling');
  assert.equal(name([5, 5], [0, 1, 0]), 'Order-4 pentagonal tiling');
  assert.equal(name(P.triangle(4, 3, 3), [1, 1, 0]), 'Trioctagonal tiling'); // (4 3 3), x on one wall: 3.8.3.8 is r{8,3}
  assert.equal(name([INF, 3], [1, 0, 0]), 'Order-3 apeirogonal tiling');
  assert.equal(name([INF, 3], [0, 1, 0]), 'Triapeirogonal tiling');
  // a corner at infinity: x there is on the light cone, infinitely many faces at it; the faces
  // round a corner at infinity are open (apeirogons)
  const M = P.model([3, INF]), T = P.chambers(M, 6.5);
  assert.ok(M.ideal[0] && !M.ideal[2]);
  const W = P.wythoff(T, P.uniform(M, [1, 0, 0]));
  assert.ok(M.isIdeal(at(W, 0, 3)), 'the vertices of {3,∞} are at infinity');
  assert.ok(W.faces.length > 50 && W.faces.every((f) => f.v.length === 3 && !f.open));
  const c = P.vertexConfig(M, P.wallsOf(M, P.uniform(M, [1, 0, 0])));
  assert.ok(c.ideal && conf(c) === '3', 'triangles all round each vertex, for ever');
  const Mi = P.model([INF, 3]), A = P.wythoff(P.chambers(Mi, 6.5), P.uniform(Mi, [1, 0, 0]));
  assert.ok(A.faces.length > 3 && A.faces.every((f) => f.open), 'the faces of {∞,3} are apeirogons');
  assert.ok(A.faces.some((f) => f.v.length > 20));
  assert.equal(P.geometry(P.triangle(2, 2, INF)), null, 'the strip of (2 2 ∞) is not a triangle');
  assert.equal(P.geometry(P.triangle(INF, INF, INF)), 'hyperbolic');
});

test('the regular polytopes of four dimensions, their Wythoff relatives and duals', () => {
  const REGULAR = { '3,3,3': [5, 10, 10, 5], '4,3,3': [16, 32, 24, 8], '3,3,4': [8, 24, 32, 16], '3,4,3': [24, 96, 96, 24], '5,3,3': [600, 1200, 720, 120], '3,3,5': [120, 720, 1200, 600] };
  for (const key of Object.keys(REGULAR)) {
    const M = P.model(key.split(',').map(Number)), T = P.chambers(M), W = P.wythoff(T, P.uniform(M, [1, 0, 0, 0]));
    assert.deepEqual([W.V, W.edges.length / 3, W.faces.length, W.cells.length], REGULAR[key], key);
    // the dual: a vertex for each cell, an edge for each 2-face
    const D = P.dual4(W), dualKey = key.split(',').reverse().join(',');
    assert.deepEqual([D.V, D.edges.length / 3], REGULAR[dualKey].slice(0, 2), 'the dual of ' + key);
  }
  // every variant of [5,3,3]: Euler's formula V − E + F − C = 0, each face in two cells, edges alike
  const M = P.model([5, 3, 3]), T = P.chambers(M);
  assert.equal(T.N, 14400);
  for (let b = 1; b < 16; b++) {
    const r = [8, 4, 2, 1].map((m) => +!!(b & m)), W = P.wythoff(T, P.uniform(M, r));
    const E = W.edges.length / 3, F = W.faces.length, C = W.cells.length;
    assert.equal(W.V - E + F - C, 0, 'rings ' + r.join(''));
    const inCells = new Int32Array(F);
    for (const c of W.cells) for (const f of c.faces) inCells[f]++;
    assert.ok(inCells.every((n) => n === 2), 'each face in two cells');
    assert.ok(spread(lengths(M, W)) < 1e-9);
  }
  const W = P.wythoff(T, P.uniform(M, [1, 1, 1, 1]));
  assert.deepEqual([W.V, W.edges.length / 3, W.faces.length, W.cells.length], [14400, 28800, 17040, 2640]);
  // x moved on the same walls: the same polytope, its vertices moved
  const x2 = M.point([0.3, 1, 0.7, 0.2]), W2 = P.wythoff(T, x2);
  P.place(W, x2);
  assert.ok(Array.from(W.pos).every((v, i) => Math.abs(v - W2.pos[i]) < 1e-12));
  assert.equal(P.name4([4, 3, 3], [0, 0, 1, 0]), '24-cell');
  assert.equal(P.name4([5, 3, 3], [0, 1, 0, 0]), 'Rectified 120-cell');
});

test('honeycombs: the cubic honeycomb, four hyperbolic ones, and rhombic dodecahedra filling space', () => {
  const M = P.model([4, 3, 4]);
  assert.equal(M.kind, 'plane');
  const T = P.chambers(M, 9), W = P.wythoff(T, P.uniform(M, [1, 0, 0, 0]));
  // the cells are cubes, with edges of one length (2, as wall 3 is at distance 1 from the middle of a cube)
  assert.ok(W.cells.length > 100);
  for (const c of W.cells.slice(0, 40)) {
    assert.equal(c.faces.length, 6);
    assert.ok(c.faces.every((fi) => W.faces[fi].v.length === 4));
  }
  assert.ok(spread(lengths(M, W)) < 1e-9 && Math.abs(lengths(M, W)[0] - 2) < 1e-9);
  assert.equal(P.name4([4, 3, 4], [0, 1, 1, 0]), 'Bitruncated cubic honeycomb');
  for (const [key, cell, faces] of [['5,3,4', 12, 5], ['4,3,5', 6, 4], ['5,3,5', 12, 5], ['3,5,3', 20, 3]]) {
    const H = P.model(key.split(',').map(Number));
    assert.equal(H.kind, 'hyperbolic', key);
    const Wh = P.wythoff(P.chambers(H, 3.2), P.uniform(H, [1, 0, 0, 0]));
    assert.ok(Wh.cells.length > 0);
    for (const c of Wh.cells) {
      assert.equal(c.faces.length, cell, key + ': the faces of a cell');
      assert.ok(c.faces.every((fi) => Wh.faces[fi].v.length === faces));
    }
    assert.ok(spread(lengths(H, Wh)) < 1e-6 * Math.max(...lengths(H, Wh)));
  }
  // the tetrahedral-octahedral honeycomb, and its dual: a rhombic dodecahedron round each vertex
  const O = P.octet(3);
  assert.ok(O.cells.every((c) => c.faces.length === (c.l ? 8 : 4)));
  for (let i = 0; i < O.edges.length; i += 3) assert.ok(Math.abs(dist(at(O, O.edges[i], 4), at(O, O.edges[i + 1], 4)) - Math.SQRT2) < 1e-9);
  const D = P.dual4(O);
  let v0 = -1;
  for (let v = 0; v < O.V; v++) if (Math.hypot(O.pos[4 * v], O.pos[4 * v + 1], O.pos[4 * v + 2]) < 1e-9) v0 = v;
  const round = D.cells[v0];
  assert.equal(round.length, 14, 'a rhombic dodecahedron has 14 vertices');
  const edgesIn = [];
  for (let i = 0; i < D.edges.length; i += 3) if (round.includes(D.edges[i]) && round.includes(D.edges[i + 1])) edgesIn.push(dist(at(D, D.edges[i], 4), at(D, D.edges[i + 1], 4)));
  assert.equal(edgesIn.length, 24, 'and 24 edges');
  assert.ok(spread(edgesIn) < 1e-9, 'all of one length');
});

test('Penrose tilings: halves of tiles meet across their cuts, φ times as many of one tile, arcs run on', () => {
  const key = (p) => Math.round(p[0] * 1e6) + ',' + Math.round(p[1] * 1e6);
  const seg = (p, q) => { const a = key(p), b = key(q); return a < b ? a + '|' + b : b + '|' + a; };
  for (const kind of ['p3', 'p2']) {
    const levels = PEN.cover(kind, PEN.sun(kind, 100), [-50, 50, -50, 50], 8);
    for (let l = 1; l <= 8; l++) {
      const tris = levels[l], cuts = new Map();
      // the cut between the halves of a tile: P3 the base, P2 the axis
      tris.forEach((t) => { const k = kind === 'p3' ? seg(t[2], t[3]) : seg(t[1], t[3]); cuts.set(k, (cuts.get(k) || []).concat([t[0]])); });
      for (const kinds of cuts.values()) if (kinds.length === 2) assert.equal(kinds[0], kinds[1], 'two halves of one tile');
    }
    // over a large patch, the numbers of tiles are near the ratio φ
    const all = PEN.cover(kind, PEN.sun(kind, 1), [-2, 2, -2, 2], 10)[10];
    const n0 = all.filter((t) => t[0] === 0).length, n1 = all.length - n0;
    assert.ok(Math.abs((kind === 'p3' ? n1 / n0 : n0 / n1) - PHI) < 0.01, kind + ' ratio ' + n0 + ' : ' + n1);
    // the arcs: on each edge between two half-tiles, each colour crosses at one point from both sides
    const tris = levels[6], edges = new Map();
    tris.forEach((t, i) => { for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) { const ka = key(t[1 + a]), kb = key(t[1 + b]), k = ka < kb ? ka + '|' + kb : kb + '|' + ka; edges.set(k, (edges.get(k) || []).concat([[i, ka < kb ? a : b, ka < kb ? b : a]])); } });
    let crossings = 0;
    for (const sides of edges.values()) {
      if (sides.length !== 2) continue;
      for (const colour of [0, 1]) {
        const xs = sides.map(([i, a, b]) => {
          const t = tris[i], [v, r] = PEN.ARCS[kind][t[0]][colour], R = r * PEN.unit(kind, t), L = dist(t[1 + a], t[1 + b]);
          return v === a ? R : v === b ? L - R : null;
        });
        assert.equal(xs[0] === null, xs[1] === null);
        if (xs[0] !== null) { assert.ok(Math.abs(xs[0] - xs[1]) < 1e-9); crossings++; }
      }
    }
    assert.ok(crossings > 100);
  }
});

test('Penrose tilings: a larger tile’s edges run along the edges and axes of the tiles below, never across them', () => {
  const onSeg = (p, [a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    return u > -1e-9 && u < 1 + 1e-9 && Math.hypot(a[0] + u * dx - p[0], a[1] + u * dy - p[1]) < 1e-7;
  };
  for (const kind of ['p3', 'p2']) {
    const L = 9, levels = PEN.cover(kind, PEN.sun(kind, Math.pow(PHI, L)), [-5, 5, -5, 5], L);
    const fine = levels[L], edges = fine.flatMap((t) => PEN.sides(kind, t)), axes = fine.map((t) => (kind === 'p3' ? [t[2], t[3]] : [t[1], t[3]]));
    for (const up of [1, 2, 4]) {
      let alongAxis = 0;
      for (const t of levels[L - up]) for (const [a, b] of PEN.sides(kind, t)) for (let s = 1; s < 24; s++) {
        const u = s / 24, p = [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])];
        if (Math.abs(p[0]) > 3 || Math.abs(p[1]) > 3 || edges.some((e) => onSeg(p, e))) continue;
        assert.ok(axes.some((e) => onSeg(p, e)), kind + ' up ' + up + ': a larger edge crosses a tile at ' + p);
        alongAxis++;
      }
      // (so some tiles below are cut into halves by it: the larger tiles are made of tiles and halves)
      assert.ok(alongAxis > 0);
    }
  }
});

test('a snub shown across a wall: its faces’ middles reflected with it (the Cairo pentagonal tiling)', () => {
  const M = P.model([4, 4]), T = P.chambers(M, 8), W = P.snub(T, P.snubPoint(M));
  const S = M.S[1];
  for (let v = 0; v < W.V; v++) W.pos.set(P.apply(S, Array.from(W.pos.subarray(3 * v, 3 * v + 3)), 3), 3 * v);
  W.flip = S;
  // every face of the snub square tiling is regular: its middle is as far from all its vertices
  for (const f of W.faces) {
    const m = P.faceMiddle(W, f), d = f.v.map((v) => Math.hypot(W.pos[3 * v] / W.pos[3 * v + 2] - m[0] / m[2], W.pos[3 * v + 1] / W.pos[3 * v + 2] - m[1] / m[2]));
    assert.ok(Math.max(...d) - Math.min(...d) < 1e-9, 'face of ' + f.v.length);
  }
  // the dual: pentagons round the vertices near the middle, each through the middles of its five faces
  const D = P.laves(W), near = D.faces.filter((f) => Math.hypot(W.pos[3 * f.at], W.pos[3 * f.at + 1]) < 3);
  assert.ok(near.length > 10 && near.every((f) => f.v.length === 5));
});

// the vertices, edges and cells (as sets of vertices) of a polytope of Wythoff's construction
function structure(M, W) {
  const d = M.d, key = (p) => p.map((x) => Math.round(x * 1e6)).join(','), vid = new Map();
  for (let v = 0; v < W.V; v++) vid.set(key(at(W, v, d)), v);
  const edges = new Set();
  for (let i = 0; i < W.edges.length; i += 3) edges.add(Math.min(W.edges[i], W.edges[i + 1]) + ',' + Math.max(W.edges[i], W.edges[i + 1]));
  const cells = (W.cells || []).map((c) => { const s = new Set(); c.faces.forEach((fi) => W.faces[fi].v.forEach((v) => s.add(v))); return s; });
  return { id: (p) => vid.get(key(p)), isEdge: (a, b) => edges.has(Math.min(a, b) + ',' + Math.max(a, b)), cells };
}

test('Petrie polygons: their sides, the zigzag, how many there are, and the Coxeter plane', () => {
  const H = { '3,3': 4, '4,3': 6, '5,3': 10, '3,3,3': 5, '4,3,3': 8, '3,4,3': 12, '5,3,3': 30 };
  for (const key of Object.keys(H)) {
    const ms = key.split(',').map(Number), M = P.model(ms), T = P.chambers(M), n = M.n, d = M.d, cp = P.coxeterPlane(M);
    assert.equal(cp.h, H[key], key + ': h');
    if (n === 3) {
      // cos²(π/h) = cos²(π/p) + cos²(π/q)
      const c2 = (m) => Math.cos(Math.PI / m) ** 2;
      assert.ok(Math.abs(c2(H[key]) - c2(ms[0]) - c2(ms[1])) < 1e-12);
    }
    for (const k of [0, n - 1]) {
      const W = P.wythoff(T, M.corners[k]), S = structure(M, W), pr = P.petrie(M, k), h = pr.h, ids = pr.pts.map(S.id);
      assert.equal(h, H[key]);
      assert.ok(ids.every((v) => v !== undefined) && new Set(ids).size === h, 'distinct vertices');
      assert.ok(ids.every((a, i) => S.isEdge(a, ids[(i + 1) % h])), 'sides are edges');
      // n consecutive vertices (n − 1 sides) lie in a face or a cell, n + 1 do not
      const run = (i, m) => Array.from({ length: m }, (_, t) => ids[(i + t) % h]);
      const sets = n === 3 ? W.faces.map((f) => new Set(f.v)) : S.cells;
      const inOne = (vs) => sets.some((F) => vs.every((v) => F.has(v)));
      assert.ok(ids.every((_, i) => inOne(run(i, n))), key + ': ' + n + ' consecutive vertices in one ' + (n === 3 ? 'face' : 'cell'));
      assert.ok(!ids.some((_, i) => inOne(run(i, n + 1))), key + ': never ' + (n + 1));
      // the group's images of it: g/2h of them
      const sides = (vs) => vs.map((a, i) => { const b = vs[(i + 1) % vs.length]; return Math.min(a, b) + ',' + Math.max(a, b); }).sort().join('|');
      const orbit = new Set();
      for (let e = 0; e < T.N; e++) { const G = T.mat(e); orbit.add(sides(pr.pts.map((p) => S.id(P.apply(G, p, d))))); }
      assert.equal(orbit.size, T.N / (2 * h), key + ': the number of Petrie polygons');
      // projected to the Coxeter plane: a regular h-gon, each vertex the last turned through ±2π/h
      const pj = pr.pts.map((p) => [p.reduce((s, x, i) => s + x * cp.a[i], 0), p.reduce((s, x, i) => s + x * cp.b[i], 0)]);
      pj.forEach((p, i) => {
        const q = pj[(i + 1) % h], ang = Math.atan2(p[0] * q[1] - p[1] * q[0], p[0] * q[0] + p[1] * q[1]);
        assert.ok(Math.abs(Math.hypot(...q) - Math.hypot(...pj[0])) < 1e-9 && Math.abs(Math.abs(ang) - 2 * Math.PI / h) < 1e-9, key + ': a regular h-gon');
      });
    }
  }
});

test('Petrie polygons from the definition alone: one way on from each start, g/2h of them', () => {
  // In rank 3, every two consecutive sides but no three lie in one face; in rank 4, every three
  // but no four lie in a Petrie polygon of one cell. Walk from every path that starts one, trying
  // every way on: there is always exactly one, so a polygon is fixed by its start (a flag).
  const H = { '3,3': 4, '4,3': 6, '3,4': 6, '5,3': 10, '3,5': 10, '3,3,3': 5, '4,3,3': 8, '3,3,4': 8, '3,4,3': 12, '5,3,3': 30, '3,3,5': 30 };
  for (const key of Object.keys(H)) {
    const ms = key.split(',').map(Number), M = P.model(ms), T = P.chambers(M), n = M.n, m = n - 1;
    const W = P.wythoff(T, M.corners[0]);
    const nb = Array.from({ length: W.V }, () => new Set());
    for (let i = 0; i < W.edges.length; i += 3) { nb[W.edges[i]].add(W.edges[i + 1]); nb[W.edges[i + 1]].add(W.edges[i]); }
    // the faces in which a, b, c are consecutive corners, and the cells of each face
    const corner = new Map();
    W.faces.forEach((f, fi) => f.v.forEach((b, i, v) => {
      const a = v[(i + v.length - 1) % v.length], c = v[(i + 1) % v.length];
      for (const k of [a + ',' + b + ',' + c, c + ',' + b + ',' + a]) corner.set(k, [...(corner.get(k) || []), fi]);
    }));
    const fo = (a, b, c) => corner.get(a + ',' + b + ',' + c) || [];
    const cellsOf = W.faces.map(() => []);
    if (n === 4) W.cells.forEach((c, ci) => c.faces.forEach((f) => cellsOf[f].push(ci)));
    // the cells in which a-b-c-d is a Petrie path: a, b, c in one face of it, b, c, d in another
    const cp = (a, b, c, d) => {
      const out = new Set();
      for (const f1 of fo(a, b, c)) for (const f2 of fo(b, c, d)) if (f1 !== f2) for (const k of cellsOf[f1]) if (cellsOf[f2].includes(k)) out.add(k);
      return out;
    };
    // does the path's last side keep to the definition with the sides before it?
    const ok = (s) => {
      const L = s.length;
      if (n === 3) { const [a, b, c] = s.slice(L - 3); return fo(a, b, c).length > 0 && (L < 4 || !fo(s[L - 4], a, b).some((f) => fo(a, b, c).includes(f))); }
      const [a, b, c, d] = s.slice(L - 4), K = cp(a, b, c, d);
      if (!K.size || L < 5) return K.size > 0;
      const K0 = cp(s[L - 5], a, b, c);
      return ![...K].some((k) => K0.has(k));
    };
    let starts = [...Array(W.V).keys()].map((v) => [v]);
    for (let L = 1; L <= m; L++) starts = starts.flatMap((s) => [...nb[s[L - 1]]].filter((w) => w !== s[L - 2]).map((w) => [...s, w]));
    starts = starts.filter(ok);
    assert.equal(starts.length, T.N, key + ': one start for each flag');
    const polygons = new Set();
    for (const s of starts) {
      const path = s.slice();
      for (;;) {
        const on = [...nb[path[path.length - 1]]].filter((w) => w !== path[path.length - 2] && ok([...path.slice(-m - 1), w]));
        assert.equal(on.length, 1, key + ': one way on');
        path.push(on[0]);
        const L = path.length;
        if (s.every((v, i) => path[L - m - 1 + i] === v)) break;
        assert.ok(L < 100);
      }
      const cyc = path.slice(0, path.length - m - 1);
      assert.equal(cyc.length, H[key]);
      assert.equal(new Set(cyc).size, H[key], key + ': distinct vertices');
      polygons.add(cyc.map((v, i) => [v, cyc[(i + 1) % cyc.length]].sort((x, y) => x - y).join('-')).sort().join(' '));
    }
    assert.equal(polygons.size, T.N / (2 * H[key]), key + ': g/2h polygons');
  }
});

test('sections of the 4-polytopes: their volumes add up to the 4-volume, and the first is the element', () => {
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  // 4-volumes with circumradius 1: edges √(5/2), 1, √2, 1
  const KNOWN = { '3,3,3': Math.sqrt(5) / 96 * 6.25, '4,3,3': 1, '3,3,4': 2 / 3, '3,4,3': 2 };
  const FIRST = { '3,3,3': [3, 4], '4,3,3': [4, 6], '3,3,4': [3, 4], '3,4,3': [3, 8], '5,3,3': [5, 12], '3,3,5': [3, 4] };
  for (const key of Object.keys(FIRST)) {
    const M = P.model(key.split(',').map(Number)), W = P.wythoff(P.chambers(M), M.corners[0]);
    const cells = W.cells.map((c) => {
      const vs = new Set(); c.faces.forEach((fi) => W.faces[fi].v.forEach((v) => vs.add(v)));
      return { normal: unit([0, 1, 2, 3].map((a) => [...vs].reduce((s, v) => s + W.pos[4 * v + a], 0))), faces: c.faces.map((fi) => W.faces[fi].v), vs: [...vs] };
    });
    // the 4-volume from the cells: a pyramid on each from the centre
    let byCells = 0;
    for (const c of cells) {
      const m = [0, 1, 2, 3].map((a) => c.vs.reduce((s, v) => s + W.pos[4 * v + a], 0) / c.vs.length), r = dot(m, c.normal);
      let vol3 = 0;
      for (const f of c.faces) {
        const p = f.map((v) => at(W, v, 4).map((x, a) => x - m[a]));
        for (let i = 1; i + 1 < p.length; i++) {
          // the tetrahedron (centre of the cell, p0, pi, pi+1): its volume by the Gram determinant
          const A = [p[0], p[i], p[i + 1]], G = A.map((u) => A.map((v) => dot(u, v)));
          vol3 += Math.sqrt(Math.max(0, G[0][0] * (G[1][1] * G[2][2] - G[1][2] ** 2) - G[0][1] * (G[1][0] * G[2][2] - G[1][2] * G[2][0]) + G[0][2] * (G[1][0] * G[2][1] - G[1][1] * G[2][0]))) / 6;
        }
      }
      byCells += vol3 * r / 4;
    }
    if (KNOWN[key]) assert.ok(Math.abs(byCells - KNOWN[key]) < 1e-9, key + ': the 4-volume from the cells');
    for (let j = 0; j < 4; j++) {
      const u = M.corners[j].map((x) => -x), E = [];
      for (const v of [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) {
        let x = v.slice();
        for (const b of [u, ...E]) { const c = dot(x, b); x = x.map((y, i) => y - c * b[i]); }
        if (Math.hypot(...x) > 1e-6 && E.length < 3) E.push(unit(x));
      }
      const S = P.sections(W.pos, 4, cells, u, E);
      // Simpson's rule between the levels is exact: the volume is a cubic there
      let I = 0;
      for (let i = 0; i + 1 < S.levels.length; i++) { const a = S.levels[i], b = S.levels[i + 1]; I += (b - a) / 6 * (S.at(a) + 4 * S.at((a + b) / 2) + S.at(b)); }
      assert.ok(Math.abs(I - byCells) < 1e-9 * byCells, key + ' from corner ' + j + ': ∫ volume dt = ' + I + ', not ' + byCells);
      // the first section: the vertex, the edge, the face (a p-gon), the cell (its faces)
      const first = S.at(S.lo, true);
      if (j === 0) assert.deepEqual([first.faces.length, first.onVerts.length], [0, 1]);
      if (j === 1) assert.deepEqual([first.faces.length, first.onVerts.length], [0, 2]);
      if (j === 2) assert.deepEqual([first.faces.length, first.faces[0].ids.length, Math.abs(first.vol) < 1e-12], [1, FIRST[key][0], true]);
      if (j === 3) assert.equal(first.faces.length, FIRST[key][1]);
    }
  }
});

test('sections recognised as Wythoff’s polyhedra or their duals, and Coxeter’s simplified sections', () => {
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  // the section of {p,q,r} (x at corner 0) at t from corner j, with the walls other than j in that order
  function section(ms, j, order, t) {
    const M = P.model(ms), W = P.wythoff(P.chambers(M), M.corners[0]);
    const cells = W.cells.map((c) => { const vs = new Set(); c.faces.forEach((fi) => W.faces[fi].v.forEach((v) => vs.add(v))); return { normal: unit([0, 1, 2, 3].map((a) => [...vs].reduce((s, v) => s + W.pos[4 * v + a], 0))), faces: c.faces.map((fi) => W.faces[fi].v) }; });
    const u = M.corners[j].map((x) => -x), E = [];
    for (const v of [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) { let x = v.slice(); for (const b of [u, ...E]) { const c = dot(x, b); x = x.map((y, i) => y - c * b[i]); } if (Math.hypot(...x) > 1e-6 && E.length < 3) E.push(unit(x)); }
    // (t: 'mid', a level's index, or [i]: between levels i and i + 1)
    const S = P.sections(W.pos, 4, cells, u, E), sec = S.at(t === 'mid' ? (S.lo + S.hi) / 2 : Array.isArray(t) ? (S.levels[t[0]] + S.levels[t[0] + 1]) / 2 : S.levels[t], true);
    const walls = order.map((i) => E.map((e) => dot(e, M.r[i])));
    const pts = [...sec.pts.values()], faces = sec.faces.map((f) => ({ n: f.n, d: dot(f.n, sec.pts.get(f.ids[0])) }));
    return { full: P.recognise(walls, pts, faces), simple: P.recognise(walls, sec.onVerts.map((v) => sec.pts.get(v)), []), n: pts.length };
  }
  const near = (r, w, dual) => r && r.dual === dual && r.w.every((x, i) => Math.abs(x - w[i]) < 1e-9);
  // the tesseract from a vertex: the middle section is the octahedron, r{3,3}
  assert.ok(near(section([4, 3, 3], 0, [1, 2, 3], 'mid').full, [0, 1, 0], false));
  // the tesseract from a cell: a cube
  assert.ok(near(section([4, 3, 3], 3, [0, 1, 2], 'mid').full, [1, 0, 0], false));
  // the 24-cell from a vertex, in the middle: the rhombic dodecahedron, the dual of the cuboctahedron
  const m24 = section([3, 4, 3], 0, [3, 2, 1], 'mid');
  assert.ok(near(m24.full, [0, 1, 0], true));
  // the 24-cell from a cell, in the middle: the cuboctahedron
  assert.ok(near(section([3, 4, 3], 3, [0, 1, 2], 'mid').full, [0, 1, 0], false));
  // the 600-cell from a vertex, at the middle level: 42 points, not one of Wythoff's, but its 30
  // vertices there are those of an icosidodecahedron [Coxeter, §13.1]
  const m600 = section([3, 3, 5], 0, [3, 2, 1], 4);
  assert.equal(m600.full, null);
  assert.equal(m600.n, 42);
  assert.ok(near(m600.simple, [0, 1, 0], false));
  // two kinds of vertex: the 24-cell's sections from a vertex between its second and third levels
  const two = section([3, 4, 3], 0, [3, 2, 1], [1]);
  assert.equal(two.n, 32);
  assert.equal(two.full, null);
});

test('sections of the polyhedra: their areas add up to the volume, and the polygons by name', () => {
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  function slices(pq, j) {
    const M = P.model(pq), W = P.wythoff(P.chambers(M), M.corners[0]), at = (v) => Array.from(W.pos.subarray(3 * v, 3 * v + 3)), edges = [];
    for (let i = 0; i < W.edges.length; i += 3) edges.push([at(W.edges[i]), at(W.edges[i + 1])]);
    const u = M.corners[j].map((x) => -x), E = [];
    for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) { let x = v.slice(); for (const b of [u, ...E]) { const c = dot(x, b); x = x.map((y, i) => y - c * b[i]); } if (Math.hypot(...x) > 1e-6 && E.length < 2) E.push(unit(x)); }
    return { M, W, S: P.slices(edges, u, E), walls: [0, 1, 2].filter((i) => i !== j).map((i) => E.map((e) => dot(e, M.r[i]))) };
  }
  for (const pq of [[3, 3], [4, 3], [3, 4], [5, 3], [3, 5]]) {
    // the volume from the faces, a pyramid on each from the centre
    const { W } = slices(pq, 0);
    let vol = 0;
    for (const f of P.planes(W)) {
      const A = f.pts.reduce((s, a, i) => { const b = f.pts[(i + 1) % f.pts.length]; return s.map((x, k) => x + [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]][k] / 2); }, [0, 0, 0]);
      vol += Math.abs(dot(A, f.n)) * dot(f.n, f.pts[0]) / 3;
    }
    for (let j = 0; j < 3; j++) {
      const { S } = slices(pq, j);
      // Simpson's rule between the levels is exact: the area is a quadratic there
      let I = 0;
      for (let i = 0; i + 1 < S.levels.length; i++) { const a = S.levels[i], b = S.levels[i + 1]; I += (b - a) / 6 * (S.at(a) + 4 * S.at((a + b) / 2) + S.at(b)); }
      assert.ok(Math.abs(I - vol) < 1e-9 * vol, pq + ' from corner ' + j + ': ∫ area dt = ' + I + ', not ' + vol);
    }
  }
  const mid = (pq, j) => { const { S, walls } = slices(pq, j), sec = S.at((S.lo + S.hi) / 2, true); return { n: sec.flat.length, r: P.recognise(walls, sec.flat, sec.sides) }; };
  // the cube: a regular hexagon from a vertex, a rectangle from an edge, a square from a face
  const a = mid([4, 3], 0), b = mid([4, 3], 1), c = mid([4, 3], 2);
  assert.deepEqual([a.n, a.r.w, a.r.dual], [6, [1, 1], false]);
  assert.ok(b.n === 4 && !b.r.dual && Math.abs(b.r.w[0] - Math.SQRT1_2) < 1e-9 && b.r.w[1] === 1);
  assert.deepEqual([c.n, c.r.w, c.r.dual], [4, [1, 0], false]);
  // the octahedron from an edge: a rhomb, the dual of a rectangle
  const d = mid([3, 4], 1);
  assert.ok(d.n === 4 && d.r.dual);
});
