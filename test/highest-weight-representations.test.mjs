// Independent checks of the mathematics in content/highest-weight-representations/weights.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/highest-weight-representations/weights.js';

const HW = globalThis.HighestWeight;
const TYPES = ['A1', 'A2', 'B2', 'G2', 'A3', 'B3', 'C3'];
const K = HW.key;
const close = (x, y, what) => assert.ok(Math.abs(x - y) < 1e-9, `${what}: ${x} vs ${y}`);
const zeros = (r) => Array(r).fill(0);
const dotp = (p, q) => p.reduce((s, x, i) => s + x * q[i], 0);
const sum = (v) => v.reduce((s, x) => s + x, 0);
const det = (M) => (M.length === 1 ? M[0][0] : M.length === 2 ? M[0][0] * M[1][1] - M[0][1] * M[1][0]
  : M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]));
// every c with 0 ≤ c_i ≤ top_i, or lo ≤ c_i ≤ hi
function* box(lo, hi) {
  const c = lo.slice();
  for (;;) {
    yield c.slice();
    let i = 0;
    while (i < c.length && c[i] === hi[i]) { c[i] = lo[i]; i++; }
    if (i === c.length) return;
    c[i]++;
  }
}
// small dominant weights of each rank
const smalls = (r, m) => [...box(zeros(r), Array(r).fill(m))];

test('Weyl groups and roots', () => {
  const order = { A1: 2, A2: 6, B2: 8, G2: 12, A3: 24, B3: 48, C3: 48 }, N = { A1: 1, A2: 3, B2: 4, G2: 6, A3: 6, B3: 9, C3: 9 };
  for (const t of TYPES) {
    const alg = HW.algebra(t), r = alg.rank, rho = Array(r).fill(1);
    assert.equal(alg.W.length, order[t], t);
    assert.equal(alg.positive.length, N[t], t);
    assert.equal(alg.longest.length, N[t], `${t}: the longest element has length N`);
    // ρ, the half sum of the positive roots, has labels (1, …, 1)
    assert.deepEqual(alg.positive.reduce((s, x) => HW.add(s, x.labels), zeros(r)), rho.map((x) => 2 * x), t);
    // the longest element sends ρ to −ρ
    assert.deepEqual(alg.act(alg.longest, rho), rho.map((x) => -x), t);
    // the sign is the determinant
    for (const w of alg.W) assert.equal(det(w.M), w.sign, t);
    // the form is W-invariant
    const xs = [...box(Array(r).fill(-1), Array(r).fill(1))];
    for (const w of alg.W) for (const x of xs) for (const y of [rho, xs[1]]) assert.equal(alg.ip(alg.act(w, x), alg.act(w, y)), alg.ip(x, y), t);
    // <α_j, α_i^∨> = a_ij, Kac's convention a_ij = <α_i^∨, α_j>
    const simple = alg.positive.filter((x) => x.height === 1).sort((u, v) => u.c.indexOf(1) - v.c.indexOf(1));
    for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) assert.equal(alg.coroot(simple[j].labels, simple[i]), alg.cartan[i][j], t);
    // the highest root, and the Coxeter numbers: h = N·2/r, and h^∨ from the comarks
    assert.equal(alg.h, 2 * alg.N / r, t);
    assert.equal(alg.hv, { A1: 2, A2: 3, B2: 3, G2: 4, A3: 4, B3: 5, C3: 4 }[t], t);
  }
});

test('coordinates for drawing', () => {
  for (const t of TYPES) {
    const alg = HW.algebra(t), r = alg.rank, e = alg.e;
    for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) close(dotp(e[i], e[j]), alg.F[i][j] / alg.det, t);
    const x = [3, -7, 2].slice(0, r);
    if (alg.fromPos) alg.fromPos(alg.pos(x)).forEach((y, i) => close(y, x[i], t));
    if (r === 2) {
      // the dominant chamber opens upwards, symmetric about the vertical
      close(e[0][0] / Math.hypot(...e[0]), -e[1][0] / Math.hypot(...e[1]), t);
      close(e[0][1] / Math.hypot(...e[0]), e[1][1] / Math.hypot(...e[1]), t);
      assert.ok(e[0][0] > 0 && e[0][1] > 0, t);
      // the Voronoi cell of the root lattice has the lattice's covolume
      const a = alg.pos(alg.simple[0]), b = alg.pos(alg.simple[1]);
      let area = 0;
      alg.cell.forEach((p, i) => { const q = alg.cell[(i + 1) % alg.cell.length]; area += p[0] * q[1] - p[1] * q[0]; });
      close(area / 2, Math.abs(a[0] * b[1] - a[1] * b[0]), t + ' cell');
    }
    // in space, the chamber points up the third axis
    if (r === 3) for (const p of e) assert.ok(p[2] > 0, t);
  }
});

test('Weyl dimension formula, against closed forms', () => {
  // B_3 and C_3 in the coordinates ε_i, from the product over the positive roots ε_i ± ε_j and ε_i (or 2ε_i)
  const eps = (l, short) => {
    let p = 1;
    for (let i = 0; i < 3; i++) { p *= l[i]; for (let j = i + 1; j < 3; j++) p *= (l[i] - l[j]) * (l[i] + l[j]); }
    return p;
  };
  const closed = {
    A1: ([a]) => a + 1,
    A2: ([a, b]) => (a + 1) * (b + 1) * (a + b + 2) / 2,
    B2: ([a, b]) => (a + 1) * (b + 1) * (a + b + 2) * (2 * a + b + 3) / 6,
    G2: ([a, b]) => (a + 1) * (b + 1) * (a + b + 2) * (a + 2 * b + 3) * (a + 3 * b + 4) * (2 * a + 3 * b + 5) / 120,
    A3: ([a, b, c]) => (a + 1) * (b + 1) * (c + 1) * (a + b + 2) * (b + c + 2) * (a + b + c + 3) / 12,
    B3: ([a, b, c]) => eps([a + b + c / 2 + 2.5, b + c / 2 + 1.5, c / 2 + 0.5]) / eps([2.5, 1.5, 0.5]),
    C3: ([a, b, c]) => eps([a + b + c + 3, b + c + 2, c + 1]) / eps([3, 2, 1]),
  };
  for (const t of TYPES) {
    const alg = HW.algebra(t), m = alg.rank === 3 ? 6 : 12;
    for (const lam of smalls(alg.rank, m)) close(HW.dimension(alg, lam).dim, closed[t](lam), `${t} (${lam})`);
  }
  // some well-known ones
  const dims = (t, list) => list.map((l) => HW.dimension(HW.algebra(t), l).dim);
  assert.deepEqual(dims('B3', [[1, 0, 0], [0, 1, 0], [0, 0, 1], [2, 0, 0], [1, 0, 1], [0, 0, 2]]), [7, 21, 8, 27, 48, 35]);
  assert.deepEqual(dims('C3', [[1, 0, 0], [0, 1, 0], [0, 0, 1], [2, 0, 0], [1, 1, 0], [1, 0, 1]]), [6, 14, 14, 21, 64, 70]);
});

test('Freudenthal: the multiplicities add up to the dimension', () => {
  // character() also checks this itself, and throws
  for (const t of TYPES) {
    const alg = HW.algebra(t);
    for (const lam of smalls(alg.rank, alg.rank === 3 ? 4 : 10)) {
      const ch = HW.character(alg, lam);
      assert.equal(ch.weights.reduce((s, w) => s + w.mult, 0), ch.dim);
      assert.ok(ch.weights.every((w) => w.mult >= 1 && Number.isInteger(w.mult)));
    }
  }
});

// μ lies in conv(Wλ) exactly when (wμ, ϖ_i) ≤ (λ, ϖ_i) for every w and i: the
// facets of the polytope are orthogonal to the W-images of the fundamental weights.
function inHull(alg, lam, mu) {
  const r = alg.rank, fund = [...Array(r).keys()].map((i) => { const v = zeros(r); v[i] = 1; return v; });
  return alg.W.every((w) => fund.every((f) => alg.ip(alg.act(w, mu), f) <= alg.ip(lam, f)));
}

test('the weights are the points of λ + Q in the convex hull of Wλ', () => {
  for (const t of TYPES) {
    const alg = HW.algebra(t), r = alg.rank;
    for (const lam of smalls(r, r === 3 ? 2 : 6)) {
      const ch = HW.character(alg, lam), top = alg.toSimple(lam), reach = 2 * Math.ceil(Math.max(...top)) + 2;
      for (const c of box(Array(r).fill(-2), Array(r).fill(reach))) {
        const mu = HW.sub(lam, alg.fromSimple(c));
        assert.equal(inHull(alg, lam, mu), ch.byKey.has(K(mu)), `${t} λ=(${lam}) μ=(${mu})`);
      }
    }
  }
});

test('the edges of the polytope conv(Wλ)', () => {
  const count = (t, lam) => { const alg = HW.algebra(t); return [HW.orbit(alg, lam).length, HW.hullEdges(alg, lam).length]; };
  // tetrahedron, cuboctahedron, permutohedron; octahedron, cube, truncated cuboctahedron
  assert.deepEqual(count('A3', [1, 0, 0]), [4, 6]);
  assert.deepEqual(count('A3', [1, 0, 1]), [12, 24]);
  assert.deepEqual(count('A3', [1, 1, 1]), [24, 36]);
  assert.deepEqual(count('B3', [1, 0, 0]), [6, 12]);
  assert.deepEqual(count('B3', [0, 0, 1]), [8, 12]);
  assert.deepEqual(count('B3', [1, 1, 1]), [48, 72]);
  assert.deepEqual(count('C3', [0, 0, 1]), [8, 12]);
  // in the plane, a polygon: as many edges as corners
  for (const t of ['A2', 'B2', 'G2']) for (const lam of [[1, 0], [0, 1], [2, 3]]) { const [v, e] = count(t, lam); assert.equal(e, v, t); }
});

// Kostant's partition function, by counting: the number of ways of writing c
// (in simple-root coordinates) as a sum of positive roots.
function partitions(alg, hi) {
  const r = alg.rank, idx = (c) => c.reduce((s, x, i) => s * (hi[i] + 1) + x, 0);
  const P = new Float64Array(hi.reduce((s, x) => s * (x + 1), 1));
  P[0] = 1;
  for (const b of alg.positive) {
    for (const c of box(zeros(r), hi)) {
      const d = HW.sub(c, b.c);
      if (d.every((x) => x >= 0)) P[idx(c)] += P[idx(d)];
    }
  }
  return (c) => (c.every((x, i) => Number.isInteger(x) && x >= 0 && x <= hi[i]) ? P[idx(c)] : 0);
}

test('Kostant\'s formula agrees with Freudenthal\'s, and vanishes off the weights', () => {
  for (const t of TYPES) {
    const alg = HW.algebra(t), r = alg.rank;
    for (const lam of smalls(r, r === 3 ? 2 : 5)) {
      const ch = HW.character(alg, lam), top = alg.toSimple(lam), reach = 2 * Math.ceil(Math.max(...top)) + 2;
      const apexes = alg.W.map((w) => alg.toSimple(HW.sub(alg.dot(w, lam), lam)));   // w·λ − λ ≤ 0
      const P = partitions(alg, Array(r).fill(reach + 1));
      let seen = 0;
      for (const c of box(Array(r).fill(-2), Array(r).fill(reach))) {
        const mu = HW.sub(lam, alg.fromSimple(c));
        // m_λ(μ) = Σ_w ε(w) P(w·λ − μ), and w·λ − μ = (w·λ − λ) + (λ − μ)
        const k = alg.W.reduce((s, w, i) => s + w.sign * P(HW.add(apexes[i], c)), 0);
        const wt = ch.byKey.get(K(mu));
        if (wt) seen++;
        assert.equal(k, wt ? wt.mult : 0, `${t} λ=(${lam}) μ=(${mu})`);
      }
      assert.equal(seen, ch.weights.length, `${t} λ=(${lam}): the box holds every weight`);
    }
  }
});

test('type A: the multiplicities are Kostka numbers', () => {
  for (const t of ['A1', 'A2', 'A3']) {
    const alg = HW.algebra(t), r = alg.rank;
    for (const lam of smalls(r, r === 3 ? 3 : 6)) {
      const ch = HW.character(alg, lam), shape = lam.map((_, i) => sum(lam.slice(i))).filter((x) => x);
      for (const w of ch.weights) {
        const T = HW.tableaux(lam, w.mu);
        assert.equal(T.length, w.mult, `${t} (${lam}) at ${w.key}`);
        for (const rows of T) {
          assert.deepEqual(rows.map((row) => row.length), shape);
          rows.forEach((row) => { for (let i = 1; i < row.length; i++) assert.ok(row[i - 1] <= row[i]); });
          for (let j = 1; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) assert.ok(rows[j - 1][i] < rows[j][i]);
          const n = [...Array(r + 1).keys()].map((k) => rows.flat().filter((x) => x === k + 1).length);
          assert.deepEqual(n.slice(0, r).map((x, i) => x - n[i + 1]), w.mu);
        }
      }
      // and nothing off the weights
      assert.equal(HW.tableaux(lam, lam.map((x) => x + 1)).length, 0);
    }
  }
  // A2: on the k-th hexagon inwards the multiplicity is k + 1, up to min(a, b) + 1
  assert.equal(HW.character(HW.algebra('A2'), [4, 2]).maxMult, 3);
});

// As the page's text says: for sl3 and λ = aϖ1 + bϖ2 the weights lie on min(a, b) nested
// hexagons, then on triangles; the multiplicity is 1 on the outer hexagon, one more on each
// hexagon further in, and min(a, b) + 1 on the triangles. A dominant μ with λ − μ = c1α1 + c2α2
// lies on the shell min(c1, c2) inwards (the hull of Wλ with each edge moved in by that many
// steps), a hexagon while that is less than min(a, b).
test('A2: the multiplicities grow by one on each hexagon inwards, and stay on the triangles', () => {
  const alg = HW.algebra('A2');
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    const ch = HW.character(alg, [a, b]), m = Math.min(a, b);
    for (const D of ch.dominant) {
      const [c1, c2] = D.c, shell = Math.min(c1, c2);
      assert.equal(D.mult, Math.min(shell, m) + 1, `(${a}, ${b}) at (${D.mu})`);
      // a shell before the min(a, b)-th is a hexagon: the orbit of λ − shell·(α1 + α2), which has 6 points
      if (shell < m) assert.equal(HW.orbit(alg, [a - shell, b - shell]).length, 6);
    }
  }
});

test('tensor products: when every λ + μ is dominant, nothing moves', () => {
  for (const t of TYPES) {
    const alg = HW.algebra(t), r = alg.rank;
    for (const nu of smalls(r, r === 3 ? 1 : 2)) {
      const ch = HW.character(alg, nu), lam = Array(r).fill(Math.max(...ch.weights.map((w) => Math.max(...w.mu.map((x) => -x)))));
      const T = HW.tensor(alg, lam, nu);
      assert.ok(T.moves.every((mv) => mv.to && !mv.steps.length), `${t} (${lam})⊗(${nu})`);
      assert.deepEqual(new Map(T.parts.map((p) => [K(p.kappa), p.n])), new Map(ch.dominant.flatMap((D) => D.orbit.map((mu) => [K(HW.add(lam, mu)), D.mult]))), `${t} (${lam})⊗(${nu})`);
    }
  }
});

test('known representations', () => {
  const zero = (t) => zeros(HW.algebra(t).rank);
  // the adjoint representations: the roots, once each, and 0 with multiplicity the rank
  for (const t of TYPES) {
    const alg = HW.algebra(t), ch = HW.character(alg, alg.theta);
    assert.equal(ch.dim, 2 * alg.N + alg.rank, t);
    assert.equal(HW.multiplicity(alg, alg.theta, zero(t)), alg.rank, t);
    const roots = new Set(alg.roots.map(K));
    for (const w of ch.weights) if (w.key !== K(zero(t))) { assert.ok(roots.has(w.key), t + ' ' + w.key); assert.equal(w.mult, 1); }
  }
  const shape = (t, lam) => { const ch = HW.character(HW.algebra(t), lam); return [ch.dim, ch.weights.length, ch.maxMult]; };
  assert.deepEqual(shape('G2', [1, 0]), [7, 7, 1]);      // the short roots and 0
  assert.deepEqual(shape('B2', [1, 0]), [5, 5, 1]);      // C^5
  assert.deepEqual(shape('B2', [0, 1]), [4, 4, 1]);      // the spin representation
  assert.deepEqual(shape('B3', [1, 0, 0]), [7, 7, 1]);   // C^7
  assert.deepEqual(shape('B3', [0, 0, 1]), [8, 8, 1]);   // the spin representation, the corners of a cube
  assert.deepEqual(shape('C3', [1, 0, 0]), [6, 6, 1]);   // C^6
  assert.deepEqual(shape('C3', [0, 1, 0]), [14, 13, 2]); // Λ²C^6 / C, with 0 twice
  assert.deepEqual(shape('A3', [0, 1, 0]), [6, 6, 1]);   // Λ²C^4, the vector representation of so_6
  for (const t of ['A1', 'A2', 'A3']) {
    const r = HW.algebra(t).rank, std = zeros(r); std[0] = 1;
    assert.deepEqual(shape(t, std), [r + 1, r + 1, 1], t);
  }
  // the trivial representation
  for (const t of TYPES) assert.deepEqual(HW.character(HW.algebra(t), zero(t)).weights.map((w) => [w.key, w.mult]), [[K(zero(t)), 1]]);
});

// The character of V(λ) ⊗ V(ν), decomposed by taking off the irreducible
// character of a highest remaining weight, over and over.
function peel(alg, lam, nu) {
  const left = new Map();
  const A = HW.character(alg, lam), B = HW.character(alg, nu);
  for (const x of A.weights) for (const y of B.weights) {
    const k = K(HW.add(x.mu, y.mu));
    left.set(k, (left.get(k) || 0) + x.mult * y.mult);
  }
  const out = new Map(), hi = HW.add(lam, nu);
  for (;;) {
    let best = null, bh = Infinity;
    for (const [k, m] of left) {
      if (!m) continue;
      const mu = k.split(',').map(Number), h = sum(alg.toSimple(HW.sub(hi, mu)));
      if (h < bh) { bh = h; best = mu; }
    }
    if (!best) return out;
    const m = left.get(K(best));
    assert.ok(best.every((x) => x >= 0) && m > 0, 'a highest remaining weight is dominant');
    out.set(K(best), m);
    for (const w of HW.character(alg, best).weights) left.set(w.key, (left.get(w.key) || 0) - m * w.mult);
  }
}

test('tensor products: Brauer–Klimyk against the characters', () => {
  for (const t of TYPES) {
    const alg = HW.algebra(t), r = alg.rank;
    for (const lam of smalls(r, r === 3 ? 1 : 3)) for (const nu of smalls(r, r === 3 ? 1 : 2)) {
      const T = HW.tensor(alg, lam, nu), P = peel(alg, lam, nu);
      assert.deepEqual(new Map(T.parts.map((p) => [K(p.kappa), p.n])), P, `${t} (${lam})⊗(${nu})`);
    }
  }
  const dec = (t, l, n) => HW.tensor(HW.algebra(t), l, n).parts.map((p) => (p.n > 1 ? p.n + '×' : '') + K(p.kappa)).sort();
  assert.deepEqual(dec('A1', [3], [2]), ['1', '3', '5']);  // Clebsch–Gordan
  assert.deepEqual(dec('A2', [1, 0], [0, 1]), ['0,0', '1,1']);
  assert.deepEqual(dec('A2', [1, 0], [1, 0]), ['0,1', '2,0']);
  assert.deepEqual(dec('A2', [1, 1], [1, 1]), ['0,0', '0,3', '2×1,1', '2,2', '3,0'].sort()); // 8 ⊗ 8 = 27 + 10 + 10* + 2·8 + 1
  assert.deepEqual(dec('G2', [1, 0], [1, 0]), ['0,0', '0,1', '1,0', '2,0']);
  assert.deepEqual(dec('B2', [0, 1], [0, 1]), ['0,0', '0,2', '1,0']);
  assert.deepEqual(dec('B3', [0, 0, 1], [0, 0, 1]), ['0,0,0', '0,0,2', '0,1,0', '1,0,0']); // 8 ⊗ 8 = 35 + 21 + 7 + 1
  assert.deepEqual(dec('A3', [1, 0, 0], [0, 0, 1]), ['0,0,0', '1,0,1']);
});

/* ---------- affine algebras ---------- */

// p_r(n): partitions of n into parts of r colours
function colouredPartitions(N, r) {
  const a = Array(N + 1).fill(0);
  a[0] = 1;
  for (let c = 0; c < r; c++) for (let k = 1; k <= N; k++) for (let m = k; m <= N; m++) a[m] += a[m - k];
  return a;
}

test('affine: the basic representation (Frenkel–Kac)', () => {
  // for a simply laced type of rank r, the multiplicity of t_β(Λ_0) − sδ = Λ_0 + β − (|β|²/2 + s)δ is p_r(s)
  for (const [t, N] of [['A1-1', 14], ['A2-1', 8]]) {
    const aff = HW.affine(t), g = aff.g, r = g.rank, ch = HW.affineCharacter(aff, [1].concat(zeros(r)), N), p = colouredPartitions(N, r);
    let seen = 0;
    for (const c of box(Array(r).fill(-4), Array(r).fill(4))) {
      const beta = g.fromSimple(c), d0 = g.ip(beta, beta) / (2 * aff.Z);
      for (let s = 0; d0 + s <= N; s++) {
        const w = ch.byKey.get(K(beta) + '|' + (d0 + s));
        assert.equal(w ? w.mult : 0, p[s], `${t} β=(${beta}) s=${s}`);
        seen++;
      }
    }
    // and these are all the weights: each lies on the string below a maximal one
    const onStrings = ch.weights.filter((w) => { const d0 = g.ip(w.mu, w.mu) / (2 * aff.Z); return Number.isInteger(d0) && w.n >= d0; });
    assert.equal(onStrings.length, ch.weights.length, t);
    assert.ok(seen >= ch.weights.length, t);
  }
});

// Weyl–Kac: ch L(Λ) · Π_{α>0} (1 − e^{−α})^{mult α} = Σ_{w∈Ŵ} ε(w) e^{w(Λ+ρ)−ρ},
// both sides down to depth N; Ŵ = W ⋉ t_M, M spanned by the (θ|θ)/(α_i|α_i) α_i, and
// t_β(x) = x + Kβ − ((x|β) + K|β|²/2)δ at level K.
function weylKac(t, labels, N) {
  const aff = HW.affine(t), g = aff.g, r = g.rank, Z = aff.Z;
  const ch = HW.affineCharacter(aff, labels, N), k = ch.k, lam = ch.lam;
  const kk = (mu, n) => K(mu) + '|' + n;
  let F = new Map(ch.weights.map((w) => [w.key, w.mult]));
  // times (1 − e^{−(β + mδ)})
  const times = (beta, m) => {
    const out = new Map(F);
    for (const [key, c] of F) {
      const [a, b] = key.split('|'), mu = a.split(',').map(Number), n = +b + m;
      if (n > N) continue;
      const k2 = kk(HW.sub(mu, beta), n);
      out.set(k2, (out.get(k2) || 0) - c);
    }
    F = out;
  };
  for (const b of g.positive) times(b.labels, 0);
  for (let m = 1; m <= N; m++) {
    for (const b of g.roots) times(b, m);
    for (let i = 0; i < r; i++) times(zeros(r), m);   // mδ has multiplicity r
  }
  const lhs = new Map([...F].filter(([, c]) => c));
  const rhs = new Map(), Kl = k + aff.hv, rho = Array(r).fill(1);
  const thetaNorm = g.ip(g.theta, g.theta), basis = g.simple.map((a) => HW.scale(thetaNorm / g.ip(a, a), a));
  for (const w of g.W) {
    const v = g.act(w, HW.add(lam, rho));
    for (const b of box(Array(r).fill(-8), Array(r).fill(8))) {
      const beta = b.reduce((s, x, i) => HW.add(s, HW.scale(x, basis[i])), zeros(r));
      const dz = g.ip(v, beta) + Kl * g.ip(beta, beta) / 2;            // Z times the depth
      if (dz > N * Z) continue;
      assert.ok(dz % Z === 0 && dz >= 0, 'an integral depth');
      const key = kk(HW.sub(HW.add(v, HW.scale(Kl, beta)), rho), dz / Z);
      rhs.set(key, (rhs.get(key) || 0) + w.sign);
    }
  }
  for (const [key, c] of [...rhs]) if (!c) rhs.delete(key);
  return [lhs, rhs];
}

test('affine: the weights lie in the paraboloid, and down each string the multiplicities never decrease', () => {
  const cases = [['A1-1', [1, 0], 12], ['A1-1', [2, 1], 10], ['A2-1', [1, 0, 0], 6], ['A2-1', [1, 1, 1], 5], ['C2-1', [1, 1, 0], 5], ['G2-1', [0, 1, 0], 4]];
  for (const [t, labels, N] of cases) {
    const aff = HW.affine(t), g = aff.g, ch = HW.affineCharacter(aff, labels, N);
    for (const w of ch.weights) {
      // |kΛ_0 + μ − nδ|² = |μ|² − 2kn ≤ |Λ|² = |λ|², in the normalized form (Z times it here)
      assert.ok(g.ip(w.mu, w.mu) - 2 * aff.Z * ch.k * w.n <= g.ip(ch.lam, ch.lam), `${t} (${labels}) at ${w.key}`);
      const below = ch.byKey.get(K(w.mu) + '|' + (w.n + 1));
      if (w.n < N) assert.ok(below && below.mult >= w.mult, `${t} (${labels}) below ${w.key}`);
    }
  }
});

test('affine: Freudenthal against the Weyl–Kac character formula', () => {
  const cases = [
    ['A1-1', [1, 0], 10], ['A1-1', [0, 1], 10], ['A1-1', [2, 0], 8], ['A1-1', [1, 1], 8], ['A1-1', [3, 2], 6],
    ['A2-1', [1, 0, 0], 5], ['A2-1', [1, 1, 0], 4], ['A2-1', [2, 1, 1], 3],
    ['C2-1', [1, 0, 0], 4], ['C2-1', [0, 1, 0], 4], ['C2-1', [0, 0, 1], 4], ['C2-1', [1, 1, 1], 3],
    ['G2-1', [1, 0, 0], 4], ['G2-1', [0, 1, 0], 3], ['G2-1', [0, 0, 1], 3],
  ];
  for (const [t, labels, N] of cases) {
    const [lhs, rhs] = weylKac(t, labels, N);
    assert.deepEqual(lhs, rhs, `${t} (${labels}) to depth ${N}`);
  }
});

test('affine: level, marks, and the trivial representation', () => {
  const marks = { 'A1-1': [1, 1], 'A2-1': [1, 1, 1], 'C2-1': [1, 1, 2], 'G2-1': [1, 3, 2] };
  const comarks = { 'A1-1': [1, 1], 'A2-1': [1, 1, 1], 'C2-1': [1, 1, 1], 'G2-1': [1, 1, 2] };
  for (const t of HW.AFFINE) {
    const aff = HW.affine(t);
    assert.deepEqual(aff.marks, marks[t], t);
    assert.deepEqual(aff.comarks, comarks[t], t);
    // δ = Σ a_i α_i is in the kernel of the extended Cartan matrix, and so is K = Σ a_i^∨ α_i^∨ on the other side
    for (let i = 0; i < aff.cartan.length; i++) assert.equal(dotp(aff.cartan[i], aff.marks), 0, t);
    for (let j = 0; j < aff.cartan.length; j++) assert.equal(dotp(aff.cartan.map((row) => row[j]), aff.comarks), 0, t);
    const zero = zeros(aff.rank + 1), ch = HW.affineCharacter(aff, zero, 5);
    assert.equal(ch.k, 0);
    assert.deepEqual(ch.weights.map((w) => [w.key, w.mult]), [[K(zeros(aff.rank)) + '|0', 1]], t);
  }
});

/* ---------- Verma modules and simple quotients, against the generators ---------- */

// L(λ) from the Chevalley generators alone, for a (generalized) Cartan matrix and
// rational labels λ(h_i): L(λ)_{λ−β} is spanned by the f_i x, x in L(λ)_{λ−β+α_i},
// and a vector below the top is zero exactly when every e_j kills it, where
// e_j f_i x = f_i e_j x + δ_ij h_i x. Over the field of p elements; the
// dimensions of the weight spaces for the given β (closed under going up).
const PRIME = 33554393;                       // below 2^25, so products stay exact
const md = (a) => ((a % PRIME) + PRIME) % PRIME;
const mm = (a, b) => (a * b) % PRIME;
function minv(a) {
  let t = 0, nt = 1, r = PRIME, nr = md(a);
  while (nr) { const q = Math.floor(r / nr); [t, nt] = [nt, t - q * nt]; [r, nr] = [nr, r - q * nr]; }
  return md(t);
}
const frac = (x) => (Array.isArray(x) ? mm(md(x[0]), minv(x[1])) : md(x));
function simpleByGenerators(cartan, labels, betas) {
  const n = cartan.length, l = labels.map(frac), data = new Map(), kb = (b) => b.join(',');
  const hval = (i, g) => md(l[i] - g.reduce((s, x, k) => s + cartan[i][k] * x, 0));
  for (const beta of betas.slice().sort((u, v) => sum(u) - sum(v))) {
    if (beta.every((x) => !x)) { data.set(kb(beta), { dim: 1, E: [], F: [] }); continue; }
    const at = (d) => { const b = beta.map((x, k) => x - (d[k] || 0)); return b.some((x) => x < 0) ? null : data.get(kb(b)); };
    const unit = (i, j) => { const d = Array(n).fill(0); d[i]++; if (j !== undefined) d[j]++; return d; };
    const js = [...Array(n).keys()].filter((j) => beta[j] > 0);
    const cands = [];
    for (const i of js) {
      const Di = at(unit(i));
      for (let t = 0; t < Di.dim; t++) {
        const img = [];
        for (const j of js) {
          const Dj = at(unit(j)), v = Array(Dj.dim).fill(0), Dij = at(unit(i, j));
          if (Dij && Di.E[j]) {
            const ej = Di.E[j][t], Fi = Dj.F[i];
            for (let a = 0; a < ej.length; a++) if (ej[a]) for (let c = 0; c < Dj.dim; c++) v[c] = md(v[c] + mm(ej[a], Fi[a][c]));
          }
          if (i === j) v[t] = md(v[t] + hval(i, beta.map((x, k) => x - (k === i ? 1 : 0))));
          img.push(...v);
        }
        cands.push({ i, t, img });
      }
    }
    // a basis among the candidates, and each candidate in it
    const rows = [], basis = [];
    for (const c of cands) {
      const v = c.img.slice(), expr = [];
      for (const R of rows) {
        const f = v[R.pivot];
        if (!f) continue;
        for (let a = 0; a < v.length; a++) if (R.vec[a]) v[a] = md(v[a] - mm(f, R.vec[a]));
        R.expr.forEach((x, b) => { if (x) expr[b] = md((expr[b] || 0) + mm(f, x)); });
      }
      const pivot = v.findIndex((x) => x);
      if (pivot < 0) { c.coords = expr; continue; }
      const B = basis.length, s = minv(v[pivot]), rexpr = [];
      basis.push(c);
      rexpr[B] = 1;
      expr.forEach((x, b) => { if (x) rexpr[b] = md(-x); });
      rows.push({ pivot, vec: v.map((x) => mm(x, s)), expr: rexpr.map((x) => (x ? mm(x, s) : 0)) });
      c.coords = [];
      c.coords[B] = 1;
    }
    const dim = basis.length, D = { dim, E: [], F: [] };
    for (const i of js) D.F[i] = cands.filter((c) => c.i === i).map((c) => Array.from({ length: dim }, (_, b) => c.coords[b] || 0));
    let off = 0;
    for (const j of js) {
      const len = at(unit(j)).dim;
      D.E[j] = basis.map((c) => c.img.slice(off, off + len));
      off += len;
    }
    data.set(kb(beta), D);
  }
  return new Map([...data].map(([k, d]) => [k, d.dim]));
}
// exact fractions [p, q]
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const fr = (x) => { const [p, q] = Array.isArray(x) ? x : [x, 1], g = gcd(p, q) || 1; return [p / g * Math.sign(q), Math.abs(q) / g]; };
const fsub = (a, b) => { const [p, q] = fr(a), [r, s] = fr(b); return fr([p * s - r * q, q * s]); };
const fmul = (c, a) => { const [p, q] = fr(a); return fr([c * p, q]); };
const allBelow = (r, H) => [...box(zeros(r), Array(r).fill(H))].filter((b) => sum(b) <= H);
const num = (x) => (Array.isArray(x) ? x[0] / x[1] : x);

test('the generators: dimensions of V(λ), and Verma modules at generic weights', () => {
  // dominant integral: the weight spaces of V(λ)
  for (const [t, lam] of [['A2', [2, 1]], ['B2', [1, 1]], ['G2', [1, 0]], ['A3', [1, 0, 1]]]) {
    const alg = HW.algebra(t), H = 5, dims = simpleByGenerators(alg.cartan, lam, allBelow(alg.rank, H)), ch = HW.character(alg, lam);
    for (const [k, d] of dims) assert.equal(d, HW.multiplicity(alg, lam, HW.sub(lam, alg.fromSimple(k.split(',').map(Number)))), `${t} (${lam}) at β=${k}`);
  }
  // generic: L(λ) = M(λ), of dimension P(β)
  const alg = HW.algebra('G2'), lam = [[3, 7], [-5, 11]], dims = simpleByGenerators(alg.cartan, lam, allBelow(2, 6)), P = HW.partitions(alg, 6);
  for (const [k, d] of dims) assert.equal(d, P(k.split(',').map(Number)), `G2 generic at ${k}`);
});

test('the simple quotient L(λ) at any weight, in rank one and two', () => {
  const cases = {
    A1: [[3], [0], [-1], [-2], [[1, 2]], [[-3, 2]], [[5, 3]]],
    A2: [[1, 1], [-2, 1], [1, -3], [-1, -1], [-3, -3], [[1, 2], [1, 2]], [[-1, 2], [-1, 2]], [[1, 3], [2, 3]], [[-4, 3], [1, 3]], [[1, 4], [2, 5]], [2, -2], [-1, 0], [0, -1]],
    B2: [[1, 0], [-2, 1], [1, -2], [-1, -1], [[1, 2], 0], [[-1, 2], 1], [[-1, 2], 0], [[-3, 2], [1, 2]], [[1, 2], [-3, 2]], [0, [1, 2]], [-3, 2], [[-5, 2], 3]],
    G2: [[0, 1], [-2, 1], [-3, 1], [1, -2], [-1, -1], [[1, 3], 0], [[-1, 3], [2, 3]], [[2, 3], -1], [0, [-1, 2]], [[1, 2], [1, 2]], [-4, 1], [3, -3]],
  };
  for (const t of Object.keys(cases)) {
    const alg = HW.algebra(t), r = alg.rank, H = r === 1 ? 10 : 6;
    for (const raw of cases[t]) {
      const lam = raw.map(num), dims = simpleByGenerators(alg.cartan, raw, allBelow(r, H));
      const L = HW.simpleQuotient(alg, lam, H), got = new Map(L.points.map((p) => [K(p.c), p.mult]));
      for (const [k, d] of dims) assert.equal(got.get(k) || 0, d, `${t} λ=(${lam}) at β=${k}`);
      // and nothing else
      for (const p of L.points) assert.ok(dims.has(K(p.c)), `${t} λ=(${lam}) beyond at ${p.c}`);
      // dominant integral: the weights of V(λ)
      if (lam.every((x) => Number.isInteger(x) && x >= 0)) for (const p of L.points) assert.equal(p.mult, HW.multiplicity(alg, lam, p.mu), `${t} λ=(${lam}) at ${p.c}`);
    }
  }
});

test('affine sl2: L(Λ) at any level, against the generators', () => {
  const aff = HW.affine('A1-1');
  // (k, m): integrable, positive and negative integral levels, fractional (admissible and not), generic
  const cases = [[1, 0], [2, 1], [1, 2], [2, -1], [0, 1], [-3, 0], [-3, 1], [-4, 2], [-5, -1], [[-1, 2], 0], [[-1, 2], -1], [[-4, 3], [-2, 3]], [[1, 2], [1, 2]], [[-3, 2], [1, 2]], [[2, 7], [3, 5]], [-1, 0], [-1, -1], [[-5, 2], [1, 2]]];
  const N = 4, H = 3;
  for (const [kr, mr] of cases) {
    const k = num(kr), m = num(mr), a0 = fsub(kr, mr);
    const betas = [...box([0, 0], [N, N + H])];                  // closed under going up
    const dims = simpleByGenerators(aff.cartan, [a0, mr], betas);
    const L = HW.sl2Affine(k, m, N, H), got = new Map(L.points.map((p) => [p.n + ',' + p.nb[0], p.mult]));
    for (const [kk, d] of dims) { const [n0, n1] = kk.split(',').map(Number); if (n1 <= n0 + H) assert.equal(got.get(kk) || 0, d, `k=${k} m=${m} at β=${kk}`); }
  }
  // the integrable ones agree with Freudenthal's formula too
  for (const labels of [[1, 0], [0, 1], [2, 1], [1, 3]]) {
    const k = labels[0] + labels[1], L = HW.sl2Affine(k, labels[1], 6, 6), ch = HW.affineCharacter(aff, labels, 6);
    const got = new Map(L.points.map((p) => [K(p.mu.map(Math.round)) + '|' + p.n, p.mult]));
    for (const w of ch.weights) if (got.has(w.key)) assert.equal(got.get(w.key), w.mult, `L(${labels}) at ${w.key}`);
  }
  assert.equal(HW.sl2Affine(-2, 0, 3, 3), null);   // the critical level
});

test('affine Verma modules: the partition function, against the generators', () => {
  // at a generic weight L(Λ) = M(Λ)
  for (const [t, k, lam] of [['A1-1', [3, 10], [[2, 7]]], ['A2-1', [5, 7], [[1, 3], [2, 9]]], ['C2-1', [-7, 4], [[1, 5], [3, 7]]], ['G2-1', [9, 7], [[2, 11], [1, 13]]]]) {
    const aff = HW.affine(t), r = aff.rank, N = r === 1 ? 4 : 2, H = r === 1 ? 4 : t === 'G2-1' ? 0 : 1;
    const lamv = lam.map(num), kv = num(k), a0 = aff.comarks.slice(1).reduce((s, c, i) => fsub(s, fmul(c, lam[i])), k);
    assert.deepEqual(HW.affineSpecial(aff, kv, lamv, N), [], t + ' is generic');
    const betas = [...box(zeros(r + 1), [N].concat(aff.g.marks.map((a) => N * a + H)))];   // closed under going up
    const dims = simpleByGenerators(aff.cartan, [a0].concat(lam), betas);
    const M = HW.affineVerma(aff, kv, lamv, N, H), got = new Map(M.points.map((p) => [p.n + ',' + K(p.nb), p.mult]));
    for (const [kk, d] of dims) {
      const [n0, ...nb] = kk.split(',').map(Number);
      if (nb.every((x, i) => x <= n0 * aff.g.marks[i] + H)) assert.equal(got.get(kk) || 0, d, `${t} at β=${kk}`);
    }
  }
});

test('affine: L(Λ) built from the generators in the page, against the other computations', () => {
  const run = (job) => { while (!job.run(Infinity)); return job.points(); };
  // integrable: Freudenthal's formula
  for (const [t, labels] of [['A1-1', [2, 1]], ['A2-1', [1, 0, 0]], ['A2-1', [0, 1, 1]], ['C2-1', [0, 1, 0]], ['G2-1', [1, 0, 0]]]) {
    const aff = HW.affine(t), k = aff.level(labels), N = 2, H = 1, ch = HW.affineCharacter(aff, labels, N);
    const got = new Map(run(HW.affineGeneratorJob(aff, k, labels.slice(1), N, H)).map((p) => [K(p.mu.map(Math.round)) + '|' + p.n, p.mult]));
    for (const [key, m] of got) assert.equal(m, ch.byKey.get(key).mult, `${t} (${labels}) at ${key}`);
    assert.ok(got.size > 0);
  }
  // affine sl2 away from the critical level: Kazhdan–Lusztig theory
  for (const [k, m] of [[1, 2], [2, -1], [-3, 1], [-0.5, 0], [-4 / 3, -2 / 3], [0.5, 0.5]]) {
    const aff = HW.affine('A1-1'), N = 4, H = 3;
    const got = new Map(run(HW.affineGeneratorJob(aff, k, [m], N, H)).map((p) => [p.key, p.mult]));
    const want = new Map(HW.sl2Affine(k, m, N, H).points.map((p) => [p.key, p.mult]));
    assert.deepEqual(got, want, `k=${k} m=${m}`);
  }
  // the critical level, and the rest: against the construction above, written separately
  for (const [t, labels, N, H] of [['A1-1', [-2, 0], 5, 4], ['A1-1', [-3, 1], 4, 3], ['A2-1', [-3, 0, 0], 2, 1], ['A2-1', [-1, 2, 0], 2, 1], ['C2-1', [-3, 0, 0], 2, 1], ['C2-1', [0, -1, 0], 2, 1], ['G2-1', [-4, 0, 0], 2, 0]]) {
    const aff = HW.affine(t), r = aff.rank, k = aff.level(labels);
    const got = run(HW.affineGeneratorJob(aff, k, labels.slice(1), N, H));
    const dims = simpleByGenerators(aff.cartan, labels, [...box(zeros(r + 1), [N].concat(aff.g.marks.map((a) => N * a + H)))]);
    for (const p of got) assert.equal(p.mult, dims.get([p.n].concat(p.nb).join(',')), `${t} (${labels}) at ${p.key}`);
    for (const [kk, d] of dims) {
      const [n0, ...nb] = kk.split(',').map(Number);
      if (d && nb.every((x, i) => x <= n0 * aff.g.marks[i] + H)) assert.ok(got.some((p) => p.key === 'b' + n0 + ';' + K(nb)), `${t} misses ${kk}`);
    }
  }
});
