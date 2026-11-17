// Independent checks of the mathematics in content/hilbert-schemes/hilbert.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/hilbert-schemes/hilbert.js';

const HS = globalThis.Hilbert, Q = HS.Q, rat = HS.rat;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const point = (X, Y) => ({ p: [X, Y], dual: HS.pointDual() });

/* ---------- exact polynomials, as maps "a,b" → rational ---------- */

const key = (a, b) => a + ',' + b;
const unkey = (k) => k.split(',').map(Number);
function poly(terms) { const P = new Map(); for (const t of terms) add(P, t.m[0], t.m[1], t.c); return P; }
function add(P, a, b, c) {
  const k = key(a, b), v = P.has(k) ? Q.add(P.get(k), c) : c;
  if (Q.isZero(v)) P.delete(k); else P.set(k, v);
}
function mulMono(P, a, b, c) { const R = new Map(); for (const [k, v] of P) { const [i, j] = unkey(k); add(R, i + a, j + b, Q.mul(v, c)); } return R; }
function sub(P, R) { const S = new Map(P); for (const [k, v] of R) { const [i, j] = unkey(k); add(S, i, j, Q.neg(v)); } return S; }
function lead(P, cmp) { let best = null; for (const k of P.keys()) { const m = unkey(k); if (!best || cmp(m, best) > 0) best = m; } return best; }
// the remainder of P on division by the polynomials G (a list of maps) in the order cmp
function reduce(P, G, cmp) {
  let R = new Map(P);
  const rem = new Map();
  while (R.size) {
    const m = lead(R, cmp), c = R.get(key(...m));
    const g = G.find((h) => { const l = lead(h, cmp); return l[0] <= m[0] && l[1] <= m[1]; });
    if (!g) { rem.set(key(...m), c); R.delete(key(...m)); continue; }
    const l = lead(g, cmp), lc = g.get(key(...l));
    R = sub(R, mulMono(g, m[0] - l[0], m[1] - l[1], Q.div(c, lc)));
  }
  return rem;
}
// the Taylor coefficient [u^i v^j] of P at the rational point (x0, y0), worked out by expanding
function taylor(P, x0, y0, i, j) {
  let acc = rat(0);
  for (const [k, c] of P) {
    const [a, b] = unkey(k);
    if (a < i || b < j) continue;
    const binom = (n, r) => { let x = 1n; for (let t = 0; t < r; t++) x = (x * BigInt(n - t)) / BigInt(t + 1); return x; };
    let term = Q.mul(c, rat(binom(a, i) * binom(b, j)));
    for (let t = 0; t < a - i; t++) term = Q.mul(term, x0);
    for (let t = 0; t < b - j; t++) term = Q.mul(term, y0);
    acc = Q.add(acc, term);
  }
  return acc;
}
// the value of each functional of each cluster on P
function conditions(P, clusters) {
  const out = [];
  for (const c of clusters) {
    const x0 = rat(c.p[0], 100), y0 = rat(c.p[1], 100);
    for (const phi of c.dual) {
      let acc = rat(0);
      phi.forEach((cij, q) => { if (cij) acc = Q.add(acc, Q.mul(rat(cij), taylor(P, x0, y0, HS.LOC[q][0], HS.LOC[q][1]))); });
      out.push(acc);
    }
  }
  return out;
}

// a random configuration of total length n: points, and clusters made by points joining along random directions
function randomConfig(n) {
  const clusters = [], used = new Set();
  let left = n;
  while (left > 0) {
    const k = Math.min(left, rnd() < 0.6 ? 1 : rint(2, 3));
    let p;
    do p = [rint(-300, 300), rint(-300, 300)]; while (used.has(p.join(',')));
    used.add(p.join(','));
    let dual = HS.pointDual();
    const dirs = [];
    for (let t = 1; t < k; t++) {
      // sometimes along a direction already used, to reach straight and longer curvilinear points
      const w = dirs.length && rnd() < 0.5 ? dirs[0] : [rint(-9, 9) || 1, rint(-9, 9)];
      dirs.push(w);
      dual = HS.merge(dual, w);
    }
    clusters.push({ p, dual });
    left -= k;
  }
  return clusters;
}
const weights = [[1, 10], [10, 1], [1, 1.0001], [1.0001, 1], [2, 3], [Math.cos(0.4), Math.sin(0.4)]];

test('the generators meet every condition, and are a reduced Gröbner basis (Buchberger’s criterion)', () => {
  for (let trial = 0; trial < 120; trial++) {
    const n = rint(1, 6), cl = randomConfig(n), w = weights[trial % weights.length], cmp = HS.compare(w);
    const I = HS.ideal(cl, w);
    assert.equal(I.stair.length, n);
    // a staircase: with each monomial, its divisors
    const has = new Set(I.stair.map((m) => key(...m)));
    for (const [a, b] of I.stair) {
      if (a) assert.ok(has.has(key(a - 1, b)));
      if (b) assert.ok(has.has(key(a, b - 1)));
    }
    const G = I.gens.map((g) => poly(g.terms));
    G.forEach((g, i) => {
      // killed by every condition
      for (const v of conditions(g, cl)) assert.ok(Q.isZero(v), 'a condition fails');
      // monic, led by its corner, every other term standard
      const l = lead(g, cmp);
      assert.deepEqual(l, I.gens[i].lead);
      assert.ok(Q.num(g.get(key(...l))) === 1);
      for (const k of g.keys()) if (k !== key(...l)) assert.ok(has.has(k), 'a term outside the staircase');
    });
    // S-polynomials reduce to zero
    for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
      const a = lead(G[i], cmp), b = lead(G[j], cmp), L = [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      const S = sub(mulMono(G[i], L[0] - a[0], L[1] - a[1], rat(1)), mulMono(G[j], L[0] - b[0], L[1] - b[1], rat(1)));
      assert.equal(reduce(S, G, cmp).size, 0, 'an S-polynomial does not reduce to 0');
    }
  }
});

test('points with different x-coordinates and y heavy: I = (∏(x − x_i), y − a(x)) with a through the points', () => {
  for (let trial = 0; trial < 30; trial++) {
    const n = rint(2, 6), xs = new Set(), cl = [];
    while (cl.length < n) { const X = rint(-300, 300); if (xs.has(X)) continue; xs.add(X); cl.push(point(X, rint(-300, 300))); }
    const I = HS.ideal(cl, [1, n + 1]);
    assert.deepEqual(I.lambda, [n]);
    const sp = HS.splitUnivariate(I.gens[0].terms, cl.map((c) => rat(c.p[0], 100)));
    assert.ok(sp && sp.factors.length === n && sp.factors.every((f) => f.mult === 1));
    const g = poly(I.gens[1].terms);
    for (const c of cl) assert.ok(Q.isZero(taylor(g, rat(c.p[0], 100), rat(c.p[1], 100), 0, 0)));
    assert.deepEqual(I.gens[1].lead, [0, 1]);
  }
});

// The ideal of J at the origin and one more point at t·w, for a small rational t, and the limit the
// page predicts: their Gröbner bases are within O(t) of each other.
function nearLimit(dual, w, t) {
  const I = HS.ideal([{ p: [0, 0], dual: HS.merge(dual, w) }], [1, 1.0001]);
  // the point at t·w, t = 1/100 of a hundredth: coordinates scaled up so that they stay integers
  const far = HS.ideal([{ p: [0, 0], dual }, { p: [w[0] * t, w[1] * t], dual: HS.pointDual() }], [1, 1.0001]);
  return { I, far };
}
test('a point joining a cluster along a line: the page’s limit is the limit of the ideals', () => {
  const cases = [
    HS.pointDual(), HS.merge(HS.pointDual(), [1, 0]), HS.merge(HS.pointDual(), [2, 1]),
    HS.merge(HS.merge(HS.pointDual(), [1, 0]), [1, 0]), HS.monomialDual([2, 1]), HS.curveDual(3, [0, 1], [0, 0, 2]),
    HS.monomialDual([2, 2]), HS.monomialDual([3, 1]),
  ];
  for (const dual of cases) for (const w of [[1, 0], [0, 1], [1, 1], [3, -2], [2, 1]]) {
    // the approaching point must not land on the cluster: t·w in hundredths, t = 1, 2, 4, …
    const errs = [];
    for (const t of [1, 2, 4]) {
      const { I, far } = nearLimit(dual, w, t);
      assert.deepEqual(far.stair, I.stair, 'the same staircase near the limit');
      let e = 0;
      I.gens.forEach((g, i) => {
        const P = poly(g.terms), R = poly(far.gens[i].terms);
        for (const k of new Set([...P.keys(), ...R.keys()])) e = Math.max(e, Math.abs(Q.num(P.get(k) || rat(0)) - Q.num(R.get(k) || rat(0))));
      });
      errs.push(e);
    }
    // the difference shrinks with t (it is O(t))
    assert.ok(errs[0] < errs[2] + 1e-12 && errs[0] < 0.2, 'not converging: ' + errs.join(', '));
  }
});

test('the limits the text names: directions, straight and curved triple points, m²', () => {
  const lam = (dual) => HS.ideal([{ p: [0, 0], dual }], [1, 1.0001]).gens.map((g) => g.terms.map((t) => t.m.join('') + ':' + Q.num(t.c)).join(' '));
  const d = HS.merge(HS.pointDual(), [1, 0]);
  assert.deepEqual(lam(d), lam(HS.monomialDual([2])));                       // (y, x²)
  assert.deepEqual(lam(HS.merge(d, [0, 1])), lam(HS.monomialDual([2, 1])));  // m²
  assert.deepEqual(lam(HS.merge(d, [1, 0])), lam(HS.monomialDual([3])));     // (y, x³)
  // three points on y = c x² come together to (y − c x², x³)
  const cur = HS.curveDual(3, [0, 1], [0, 0, 3]);
  const I = HS.ideal([{ p: [0, 0], dual: cur }], [1, 10]);
  assert.deepEqual(I.gens.map((g) => g.terms.map((t) => [t.m, Q.num(t.c)])), [[[[3, 0], 1]], [[[0, 1], 1], [[2, 0], -3]]]);
  // and three points on that parabola already have it in their ideal: (x − 0.1)(x + 0.1)(x − 0.2), y − 3x²
  const near = HS.ideal([point(10, 3), point(-10, 3), point(20, 12)], [1, 10]);
  assert.deepEqual(near.gens[1].terms.map((t) => [t.m, Q.num(t.c)]), [[[0, 1], 1], [[2, 0], -3]]);
  // the structure: curvilinear with a tangent, or not
  assert.equal(HS.structure(HS.monomialDual([2, 1])).curvilinear, false);
  assert.deepEqual(HS.structure(cur).dir.map(Number), [1, 0]);
});

test('multiplication by x and y: commuting matrices whose joint eigenvalues are the points', () => {
  for (let trial = 0; trial < 40; trial++) {
    const n = rint(1, 6), cl = randomConfig(n), I = HS.ideal(cl, weights[trial % weights.length]);
    const { X, Y } = HS.multiplication(I);
    const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((acc, a, k) => Q.add(acc, Q.mul(a, B[k][j])), rat(0))));
    const XY = mul(X, Y), YX = mul(Y, X);
    XY.forEach((r, i) => r.forEach((q, j) => assert.ok(Q.isZero(Q.sub(q, YX[i][j])), 'X and Y commute')));
    // det(λ − (αX + βY)) = ∏ (λ − α x_c − β y_c)^{k_c} for a random combination, at a few λ
    const al = rat(rint(1, 7)), be = rat(rint(-7, 7));
    const M = X.map((r, i) => r.map((q, j) => Q.add(Q.mul(al, q), Q.mul(be, Y[i][j]))));
    for (const lamv of [rat(3, 7), rat(-11, 5), rat(17)]) {
      const A = M.map((r, i) => r.map((q, j) => Q.sub(i === j ? lamv : rat(0), q)));
      // the determinant by elimination
      let det = rat(1);
      for (let c = 0; c < n; c++) {
        let p = c;
        while (p < n && Q.isZero(A[p][c])) p++;
        if (p === n) { det = rat(0); break; }
        if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; det = Q.neg(det); }
        det = Q.mul(det, A[c][c]);
        for (let r = c + 1; r < n; r++) { const f = Q.div(A[r][c], A[c][c]); for (let q = c; q < n; q++) A[r][q] = Q.sub(A[r][q], Q.mul(f, A[c][q])); }
      }
      let want = rat(1);
      for (const c of cl) {
        const e = Q.sub(lamv, Q.add(Q.mul(al, rat(c.p[0], 100)), Q.mul(be, rat(c.p[1], 100))));
        for (let t = 0; t < c.dual.length; t++) want = Q.mul(want, e);
      }
      assert.ok(Q.isZero(Q.sub(det, want)), 'the characteristic polynomial');
    }
  }
});

test('the flow to the origin: the ideal of the flowed points is the generators scaled, and tends to in_w(I)', () => {
  for (let trial = 0; trial < 30; trial++) {
    const n = rint(2, 5), w = [rint(1, 3), rint(1, 3)], T = rint(2, 3), cl = [], flowed = [], used = new Set();
    // points whose images at t = 1/T, (x T^{−w1}, y T^{−w2}), are again in hundredths
    while (cl.length < n) {
      const a = rint(-9, 9), b = rint(-9, 9);
      if (used.has(a + ',' + b)) continue;
      used.add(a + ',' + b);
      cl.push(point(a * T ** w[0], b * T ** w[1]));
      flowed.push(point(a, b));
    }
    const I = HS.ideal(cl, w), J = HS.ideal(flowed, w), k = HS.weightKey(w);
    assert.deepEqual(J.stair, I.stair, 'the same staircase along the flow');
    J.gens.forEach((g, i) => {
      const top = k(g.lead), P = poly(I.gens[i].terms), R = poly(g.terms);
      // the coefficient of m at t = 1/T is c_m t^{w·lead − w·m}
      for (const kk of new Set([...P.keys(), ...R.keys()])) {
        const m = unkey(kk), c = P.get(kk) || rat(0), want = Q.mul(c, rat(1n, BigInt(T) ** BigInt(top - k(m))));
        assert.ok(Q.isZero(Q.sub(R.get(kk) || rat(0), want)), 'scaled generators');
      }
    });
  }
});

test('arms and legs give the weights of the tangent space, worked out from the definition', () => {
  for (let n = 1; n <= 7; n++) for (const lam of HS.partitions(n)) {
    const want = HS.homWeights(lam), got = new Map();
    for (const t of HS.tangentWeights(lam)) for (const w of t.w) got.set(w.join(','), (got.get(w.join(',')) || 0) + 1);
    assert.deepEqual([...got].sort(), [...want].sort(), 'λ = ' + lam);
    assert.equal([...want.values()].reduce((s, x) => s + x, 0), 2 * n, 'dimension 2n');
  }
});

test('Betti numbers: partitions by their number of rows, as in Göttsche’s product ∏ 1/(1 − t^{k−1} q^k)', () => {
  const N = 9;
  // the product, as coefficients c[n][i] of q^n t^i
  let c = Array.from({ length: N + 1 }, (_, n) => new Array(N + 1).fill(0));
  c[0][0] = 1;
  for (let k = 1; k <= N; k++) {
    // multiply by 1/(1 − t^{k−1} q^k) = Σ_m t^{m(k−1)} q^{mk}
    const d = c.map((r) => r.slice());
    for (let n = 0; n <= N; n++) for (let i = 0; i <= N; i++) {
      let s = 0;
      for (let m = 1; m * k <= n && m * (k - 1) <= i; m++) s += c[n - m * k][i - m * (k - 1)];
      d[n][i] += s;
    }
    c = d;
  }
  for (let n = 1; n <= N; n++) {
    const b = HS.betti(n);
    b.forEach((x, i) => assert.equal(x, c[n][i], 'b_' + 2 * i + ' of Hilb^' + n));
    assert.equal(b.reduce((s, x) => s + x, 0), HS.partitions(n).length);
  }
  assert.deepEqual(HS.betti(4), [1, 1, 2, 1]);
});

test('the walls: generic points have the corner cuts, the corners of a square only (x², y²)', () => {
  for (let trial = 0; trial < 10; trial++) {
    const n = rint(2, 6), cl = [], used = new Set();
    while (cl.length < n) { const p = [rint(-300, 300), rint(-300, 300)]; if (used.has(p.join(','))) continue; used.add(p.join(',')); cl.push(point(...p)); }
    const F = HS.fan(cl);
    for (const ch of F.chambers) {
      // the n monomials of least weight, for a weight inside the chamber
      const s = ch.to === Infinity ? ch.from * 2 + 1 : ch.from === 0 ? ch.to / 2 : Math.sqrt(ch.from * ch.to);
      const mons = HS.monomials(n).slice().sort(HS.compare([1, s])).slice(0, n);
      assert.deepEqual(HS.partitionOf(mons), ch.lambda);
    }
    // on a wall the initial ideal is not monomial, and the staircases either side differ
    for (let i = 0; i < F.walls.length; i++) assert.notDeepEqual(F.chambers[i].lambda, F.chambers[i + 1].lambda);
  }
  const sq = [point(-100, -100), point(100, -100), point(100, 100), point(-100, 100)];
  const F = HS.fan(sq);
  assert.equal(F.walls.length, 0);
  assert.deepEqual(F.chambers.map((c) => c.lambda), [[2, 2]]);
});

test('triple points at one place: a cone over a twisted cubic, and the real ones a projective plane', () => {
  // the Plücker coordinates of J/m³ in m/m³ (basis x, y, x², xy, y²) for curvilinear J: they lie on
  // the cone over the twisted cubic [1 : t : t² : t³] with vertex m²
  const plucker = (dual) => {
    const I = HS.ideal([{ p: [0, 0], dual }], [1, 1.0001]);
    // a basis of J/m³: the generators times 1, x, y, reduced mod m³ (terms of degree ≥ 3 dropped)
    const basis = ['1,0', '0,1', '2,0', '1,1', '0,2'];
    const rows = [];
    for (const g of I.gens) for (const [a, b] of [[0, 0], [1, 0], [0, 1]]) {
      const v = basis.map(() => 0);
      for (const t of g.terms) { const k = (t.m[0] + a) + ',' + (t.m[1] + b), q = basis.indexOf(k); if (q >= 0) v[q] += Q.num(t.c); }
      rows.push(v);
    }
    // three independent rows (J/m³ has dimension 3), by elimination
    const pick = [];
    for (const r of rows) {
      const cand = pick.concat([r]);
      const M = cand.map((x) => x.slice());
      let rank = 0;
      for (let c = 0; c < 5 && rank < M.length; c++) {
        let p = rank; while (p < M.length && Math.abs(M[p][c]) < 1e-9) p++;
        if (p === M.length) continue;
        [M[p], M[rank]] = [M[rank], M[p]];
        for (let q = rank + 1; q < M.length; q++) { const f = M[q][c] / M[rank][c]; for (let z = c; z < 5; z++) M[q][z] -= f * M[rank][z]; }
        rank++;
      }
      if (rank === cand.length) pick.push(r);
      if (pick.length === 3) break;
    }
    const minor = (i, j, k) => { const m = pick.map((r) => [r[i], r[j], r[k]]); return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]); };
    // the coordinates of the cone: (y;xy,y²), (y;x²,y²) = (x;xy,y²), (y;x²,xy) = (x;x²,y²), (x;x²,xy), (x²,xy,y²)
    const P = [minor(1, 3, 4), minor(1, 2, 4), minor(0, 3, 4), minor(1, 2, 3), minor(0, 2, 4), minor(0, 2, 3), minor(2, 3, 4)];
    return P;
  };
  for (let trial = 0; trial < 20; trial++) {
    const a = rint(-5, 5), c = rint(-5, 5) || 1;
    const P = plucker(HS.curveDual(3, [0, 1], [0, a, c]));
    const n = Math.max(...P.map(Math.abs));
    const [p0, p1, p1b, p2, p2b, p3, v] = P.map((x) => x / n);
    assert.ok(Math.abs(p1 - p1b) < 1e-9 && Math.abs(p2 - p2b) < 1e-9, 'the repeated coordinates agree');
    // a twisted cubic: the 2×2 minors of [[p0, p1, p2], [p1, p2, p3]] vanish
    for (const m of [p0 * p2 - p1 * p1, p0 * p3 - p1 * p2, p1 * p3 - p2 * p2]) assert.ok(Math.abs(m) < 1e-9);
    void v;
  }
  // m² is the vertex: only the last coordinate
  const V = plucker(HS.monomialDual([2, 1]));
  assert.ok(V.slice(0, 6).every((x) => Math.abs(x) < 1e-9) && Math.abs(V[6]) > 0);
  // the disc: the centre is m², the rim's opposite points are one, and the inside round-trips
  assert.equal(HS.structure(HS.tripleFromDisc(0, 1)).curvilinear, false);
  const same = (d1, d2) => HS.rank(d1.concat(d2)) === 3;
  for (const psi of [0.3, 1.2, 2.9]) assert.ok(same(HS.tripleFromDisc(1, psi), HS.tripleFromDisc(1, psi + Math.PI)));
  for (let trial = 0; trial < 20; trial++) {
    const rho = 0.05 + 0.9 * rnd(), psi = (rnd() - 0.5) * 2 * Math.PI, back = HS.discOfTriple(HS.tripleFromDisc(rho, psi));
    assert.ok(Math.abs(back.rho - rho) < 2e-3, 'radius');
    const dpsi = Math.abs(((back.psi - psi + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    assert.ok(dpsi < 3e-3, 'angle');
  }
});

test('germs: the frame of a turned germ is the same curve at the new angle', () => {
  for (let trial = 0; trial < 20; trial++) {
    const k = rint(2, 5), ang = (rnd() - 0.5) * 6, g = Array.from({ length: k - 2 }, () => Math.round((rnd() - 0.5) * 40) / 10);
    const d = HS.germDual(k, ang, g), f = HS.germFrame(d);
    // the same line; read the other way, the parameter and the normal both turn round: g_m ↦ (−1)^{m+1} g_m
    assert.ok(Math.abs(Math.sin(f.angle - ang)) < 2e-3, 'the tangent');
    const back = Math.cos(f.angle - ang) < 0;
    f.g.forEach((x, i) => {
      const m = i + 2, want = back ? g[i] * Math.pow(-1, m + 1) : g[i];
      assert.ok(Math.abs(x - want) < 1e-2 * (1 + Math.abs(want)), 'g_' + m + ': ' + x + ' vs ' + want);
    });
    // a rotation by tan(θ/2) = T/M turns the frame by θ and keeps the curve
    const T = rint(-5, 5), M = rint(1, 6), th = 2 * Math.atan2(T, M), r = HS.germFrame(HS.rotateDual(d, T, M));
    assert.ok(Math.abs(Math.sin(r.angle - f.angle - th)) < 1e-6, 'turned by θ');
    const back2 = Math.cos(r.angle - f.angle - th) < 0;
    r.g.forEach((x, i) => { const want = back2 ? f.g[i] * Math.pow(-1, i + 3) : f.g[i]; assert.ok(Math.abs(x - want) < 1e-6 * (1 + Math.abs(want))); });
  }
});

/* ---------- one more point at the same place: the editor of a multiple point ---------- */

// a local ideal at the origin as a configuration, and its ideal for a weight
const at0 = (dual) => [{ p: [0, 0], dual }];
const idealOf = (dual, w) => HS.ideal(at0(dual), w || [1, 10]);
// the largest difference between the coefficients of two ideals' generators (same staircase)
function gap(I, J) {
  if (I.lambda.join() !== J.lambda.join()) return Infinity;
  let d = 0;
  I.gens.forEach((g, i) => {
    const all = new Map();
    for (const t of g.terms) all.set(key(...t.m), [Q.num(t.c), 0]);
    for (const t of J.gens[i].terms) { const e = all.get(key(...t.m)) || [0, 0]; e[1] = Q.num(t.c); all.set(key(...t.m), e); }
    for (const [a, b] of all.values()) d = Math.max(d, Math.abs(a - b));
  });
  return d;
}
// the same, relative to the size of the coefficients
function relGap(I, J) {
  let big = 1;
  for (const g of I.gens) for (const t of g.terms) big = Math.max(big, Math.abs(Q.num(t.c)));
  return gap(I, J) / big;
}
// random local ideals: points joining along random directions, germs, monomial ideals
function randomLocal(k) {
  const pick = rnd();
  if (pick < 0.4) {
    let dual = HS.pointDual();
    const dirs = [];
    for (let t = 1; t < k; t++) { const w = dirs.length && rnd() < 0.5 ? dirs[0] : [rint(-9, 9) || 1, rint(-9, 9)]; dirs.push(w); dual = HS.merge(dual, w); }
    return dual;
  }
  if (pick < 0.7) return HS.germDual(k, (rnd() - 0.5) * 6, Array.from({ length: k - 2 }, () => Math.round((rnd() - 0.5) * 30) / 10));
  const parts = HS.partitions(k);
  return HS.monomialDual(parts[rint(0, parts.length - 1)]);
}

test('extensions: each functional of W makes a local ideal one longer, and their number is the number of generators', () => {
  // the number of generators: 2 for curvilinear ideals, the corners for monomial ones, 3 for m²
  for (const [dual, r] of [[HS.germDual(4, 0.7, [1.2, -0.4]), 2], [HS.monomialDual([2, 1]), 3], [HS.monomialDual([2, 2]), 2], [HS.monomialDual([3, 1]), 3], [HS.monomialDual([3, 2, 1]), 4], [HS.monomialDual([5]), 2]]) {
    assert.equal(HS.extensionSpace(dual).length - dual.length, r);
  }
  for (let trial = 0; trial < 40; trial++) {
    const k = rint(1, 5), dual = randomLocal(k), W = HS.extensionSpace(dual);
    assert.ok(HS.closed(dual), 'a local ideal');
    // W contains J^⊥, and every φ in W, alone or combined, extends it
    for (const phi of dual) assert.ok(HS.inSpan(W, phi));
    const extra = W.filter((phi) => !HS.inSpan(dual, phi));
    for (let t = 0; t < 4; t++) {
      const phi = W.reduce((acc, w) => { const c = BigInt(rint(-3, 3)); return acc.map((x, q) => x + c * w[q]); }, new Array(HS.LOC.length).fill(0n));
      if (HS.inSpan(dual, phi)) continue;
      assert.ok(HS.closed(dual.concat([phi])), 'an extension');
      assert.equal(idealOf(dual.concat([phi]), [1, 1.37]).n, k + 1);
    }
    // and a functional of degree ≤ k outside W does not
    const v = new Array(HS.LOC.length).fill(0n);
    HS.LOC.forEach((m, q) => { if (m[0] + m[1] <= k && m[0] + m[1] >= 1) v[q] = BigInt(rint(-5, 5)); });
    if (!HS.inSpan(W, v)) assert.ok(!HS.closed(dual.concat([v])), 'not an extension');
    assert.ok(extra.length >= 2);
  }
});

test('the editor: a curvilinear point’s next step adds tan(a/2)·s^k to its curve, and half a turn leaves the curve', () => {
  for (let trial = 0; trial < 12; trial++) {
    const rho = 0.15 + 0.8 * rnd(), psi = rnd() * 2 * Math.PI, a = rnd() * 2 * Math.PI, b = rnd() * 2 * Math.PI;
    const r = HS.editDual(5, { d: { rho, psi }, s: [{ a }, { a: b }] });
    const f = HS.germFrame(r.dual), kappa = (1 - rho) / rho;
    // the frame of the germ may be read the other way along the curve: g_m ↦ (−1)^{m+1} g_m
    const back = Math.cos(f.angle - (psi - Math.PI / 2)) < 0, sgn = (m) => (back ? Math.pow(-1, m + 1) : 1);
    [kappa / 2, Math.tan(a / 2), Math.tan(b / 2)].forEach((want, i) => {
      const got = f.g[i] * sgn(i + 2);
      assert.ok(Math.abs(got - want) < 2e-3 * (1 + Math.abs(want)), 'g_' + (i + 2) + ': ' + got + ' vs ' + want);
    });
  }
  // half a turn: the triple point along the x-axis and the derivative across it, (xy, y², x³)
  const sep = idealOf(HS.editDual(4, { d: { rho: 1, psi: Math.PI / 2 }, s: [{ a: Math.PI }] }).dual);
  assert.deepEqual(sep.gens.map((g) => g.terms.length === 1 && g.lead.join()), ['3,0', '1,1', '0,2']);
  // the same from a curved triple point: not curvilinear, Hilbert function 1, 2, 1
  const sep2 = HS.editDual(4, { d: { rho: 0.4, psi: 2 }, s: [{ a: Math.PI }] }).dual;
  assert.ok(!HS.structure(sep2).curvilinear);
});

test('the disc of D after m²: the Laplacian at its centre, the squares on a circle, (x², y²) on the rim', () => {
  const quad = (q) => idealOf(HS.editDual(4, { d: { rho: 0, psi: 0 }, s: [{ d: q }] }).dual);
  // the centre: D = ∂x² + ∂y², which x² − y² and xy satisfy
  const L = quad({ rho: 0, psi: 0 });
  for (const P of [poly([{ m: [2, 0], c: rat(1) }, { m: [0, 2], c: rat(-1) }]), poly([{ m: [1, 1], c: rat(1) }])]) assert.ok(conditions(P, at0(L.rows ? HS.editDual(4, { d: { rho: 0, psi: 0 }, s: [{ d: { rho: 0, psi: 0 } }] }).dual : [])).every(Q.isZero));
  // squares: D = (ℓ·∇)², whose ideal holds ℓ⊥·m: at ψ = 0 (ℓ = x) it is (xy, y², x³), at ψ = π (ℓ = y) (x², xy, y³)
  assert.deepEqual(quad({ rho: Math.SQRT1_2, psi: 0 }).lambda, [3, 1]);
  assert.ok(quad({ rho: Math.SQRT1_2, psi: 0 }).gens.every((g) => g.terms.length === 1));
  assert.deepEqual(quad({ rho: Math.SQRT1_2, psi: Math.PI }).lambda, [2, 1, 1]);
  // a square at another angle: its ideal contains ℓ⊥ times x and y, for ℓ along ψ/2
  for (let t = 0; t < 6; t++) {
    const psi = rnd() * 2 * Math.PI, dual = HS.editDual(4, { d: { rho: 0, psi: 0 }, s: [{ d: { rho: Math.SQRT1_2, psi } }] }).dual;
    const l = [Math.round(1000 * Math.cos(psi / 2)), Math.round(1000 * Math.sin(psi / 2))];
    // ℓ⊥(u, v) = −l2 u + l1 v
    for (const [a, b] of [[1, 0], [0, 1]]) {
      const P = poly([{ m: [1 + a, b], c: rat(-l[1]) }, { m: [a, 1 + b], c: rat(l[0]) }]);
      assert.ok(conditions(P, at0(dual)).every(Q.isZero), 'ℓ⊥ · m in the ideal');
    }
  }
  // the rim at ψ = π/2: D = ∂x∂y, the ideal (x², y²)
  const R = quad({ rho: 1, psi: Math.PI / 2 });
  assert.deepEqual(R.gens.map((g) => g.terms.length === 1 && g.lead.join()), ['2,0', '0,2']);
});

test('every monomial ideal of length 4 to 6 has an editor’s state, which gives it back exactly', () => {
  for (let k = 3; k <= 6; k++) for (const lam of HS.partitions(k)) {
    const dual = HS.monomialDual(lam);
    for (let j = 1; j <= k; j++) assert.ok(HS.closed(dual.slice(0, j)), 'each beginning is a local ideal');
    const st = HS.editState(dual), r = HS.editDual(k, st);
    for (const w of [[1, 10], [10, 1], [1, 1.37]]) {
      const I = idealOf(r.dual, w);
      assert.deepEqual(I.lambda, idealOf(dual, w).lambda, lam.join() + ' for ' + w);
      assert.ok(I.gens.every((g) => g.terms.length === 1), lam.join() + ': monomial');
    }
  }
});

test('the editor’s marks: each makes a monomial ideal, and every monomial ideal is made of them', () => {
  // the handles hold at the marks, so that a drag can make every monomial ideal: walk through
  // every choice of marks (a rim mark under both its names), up to length 6
  const M = HS.MARKS, at = (m) => ({ rho: m[0], psi: m[1] });
  const both = (marks) => marks.concat(marks.filter((m) => m[0] === 1).map((m) => [1, m[1] > 0 ? m[1] - Math.PI : m[1] + Math.PI]));
  const choices = (kind) => (kind === 'circle' ? M.circle.map((a) => ({ a }))
    : both(kind === 'quad' ? M.quad : [[0, 0]].concat(M.disc)).map((m) => ({ a: 0, d: at(m) })));
  const made = new Map();
  const walk = (st) => {
    const j = 3 + st.s.length, r = HS.editDual(j, st);
    for (const w of [[1, 10], [10, 1], [1, 1.37]]) {
      const I = idealOf(r.dual, w);
      assert.ok(I.gens.every((g) => g.terms.length === 1), JSON.stringify(st) + ': monomial');
      if (!made.has(j)) made.set(j, new Set());
      made.get(j).add(I.lambda.join('.'));
    }
    if (j === 6) return;
    const kind = HS.editDual(j + 1, { d: st.d, s: st.s.concat([{ a: 0 }]) }).steps[j - 3].kind;
    for (const c of choices(kind)) walk({ d: st.d, s: st.s.concat([c]) });
  };
  for (const m of both([[0, 0]].concat(M.triple))) walk({ d: at(m), s: [] });
  for (let k = 3; k <= 6; k++) assert.deepEqual([...made.get(k)].sort(), HS.partitions(k).map((l) => l.join('.')).sort(), 'all of length ' + k);
});

test('the editor’s states and local ideals correspond: every state gives one, and its state gives it back', () => {
  for (let trial = 0; trial < 40; trial++) {
    const k = rint(4, 6), centre = rnd() < 0.3;
    const st = { d: centre ? { rho: 0, psi: 0 } : { rho: 0.1 + 0.85 * rnd(), psi: rnd() * 2 * Math.PI }, s: [] };
    for (let j = 3; j < k; j++) st.s.push({ a: rnd() < 0.2 ? Math.PI : rnd() * 2 * Math.PI, d: { rho: [0, Math.SQRT1_2, 1, rnd()][rint(0, 3)], psi: rnd() * 2 * Math.PI } });
    const r = HS.editDual(k, st);
    assert.equal(r.dual.length, k);
    assert.ok(HS.closed(r.dual), 'a local ideal');
    // its state gives it again, up to the rounding of the disc's direction (to a thousandth): the
    // same staircases, and the coefficients near (a state is not unique: a rim point has two names)
    const back = HS.editDual(k, HS.editState(r.dual));
    for (const w of [[1, 10], [10, 1], [1, 1.37]]) {
      const I = idealOf(r.dual, w), J = idealOf(back.dual, w);
      assert.deepEqual(J.lambda, I.lambda);
      assert.ok(relGap(I, J) < 2e-2, 'near the same ideal: ' + relGap(I, J));
    }
  }
  // and from local ideals made otherwise (points joining, germs), approximately the same again
  for (let trial = 0; trial < 30; trial++) {
    const k = rint(4, 6), dual = randomLocal(k);
    const back = HS.editDual(k, HS.editState(dual)).dual;
    for (const w of [[1, 10], [10, 1], [1, 1.37]]) assert.deepEqual(idealOf(back, w).lambda, idealOf(dual, w).lambda, 'the same staircases');
  }
});

test('across the rim of the disc the steps after it are carried over, so that the point does not jump', () => {
  // the same triple point seen on either side of the rim; the fifth point's step changes sign there
  const st = { d: { rho: 1, psi: 1.1 }, s: [{ a: 1.2 }, { a: 0.7 }] };
  const r1 = HS.editDual(5, st);
  const flipped = { d: { rho: 1, psi: 1.1 + Math.PI }, s: st.s };
  const plain = HS.editDual(5, flipped), carried = HS.editDual(5, flipped, r1);
  const I = idealOf(r1.dual, [1, 1.37]);
  assert.ok(gap(I, idealOf(carried.dual, [1, 1.37])) < 1e-6, 'carried: the same point');
  assert.ok(gap(I, idealOf(plain.dual, [1, 1.37])) > 1e-2, 'not carried, the fifth point would jump');
  assert.ok(Math.abs(carried.state.s[0].a - 1.2) < 1e-9, 'the odd step keeps its angle');
  assert.ok(Math.abs(carried.state.s[1].a - (2 * Math.PI - 0.7)) < 1e-6, 'the even one turns the other way');
});
