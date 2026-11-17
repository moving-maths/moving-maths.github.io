// Hilbert schemes of points in the plane: the mathematics, with no DOM.
// Loaded before main.js (and by thumb.html); checked by test/hilbert-schemes.test.mjs.
//
// A point of Hilb^n(C²) is an ideal I ⊂ C[x,y] with dim C[x,y]/I = n. The page
// holds one as its clusters: each a place p = (X, Y)/100 with integer X, Y, and
// a local ideal J at p of length k, kept as its dual J^⊥: k linear functionals
// on polynomials in the local coordinates u = x − p_x, v = y − p_y, each a vector
// of integer coefficients c_ij over the monomials u^i v^j (the functional takes f
// to Σ c_ij [u^i v^j] f, a sum of its Taylor coefficients at p). I is the set of
// polynomials that all the functionals of all the clusters kill.
//
// From that: the standard monomials and the reduced Gröbner basis of I for a
// weight order (the weight w = (w1, w2) > 0 of x and y, ties broken by the power
// of y), by exact elimination over the integers (BigInt); the limit of a cluster
// as one more point comes into it along a straight line; rotations and germs of
// curves; the weights where the initial ideal changes; partitions, arms and legs.
(function (root) {
  'use strict';

  const H = 100n;            // coordinates are integers in hundredths
  const KMAX = 7;            // local monomials u^i v^j up to this total degree (a cluster has length ≤ 6)

  /* ---------- exact arithmetic ---------- */

  const B = (x) => (typeof x === 'bigint' ? x : BigInt(x));
  const absB = (a) => (a < 0n ? -a : a);
  function gcd(a, b) { a = absB(a); b = absB(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  // rationals: [numerator, denominator], the denominator positive, in lowest terms
  function rat(n, d) {
    n = B(n); d = d === undefined ? 1n : B(d);
    if (d === 0n) throw new Error('division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d);
    return g > 1n ? [n / g, d / g] : [n, d];
  }
  const Q = {
    of: rat,
    add: (a, b) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]),
    sub: (a, b) => rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1]),
    mul: (a, b) => rat(a[0] * b[0], a[1] * b[1]),
    div: (a, b) => rat(a[0] * b[1], a[1] * b[0]),
    neg: (a) => [-a[0], a[1]],
    isZero: (a) => a[0] === 0n,
    // as a double, also when numerator and denominator are too large for one
    num(a) {
      let [n, d] = a;
      const bits = (x) => absB(x).toString(2).length;
      const shift = Math.max(0, Math.max(bits(n), bits(d)) - 1000);
      if (shift) { n >>= BigInt(shift); d >>= BigInt(shift); if (d === 0n) return n < 0n ? -Infinity : Infinity; }
      return Number(n) / Number(d);
    },
  };
  const binom = (() => {
    const C = [];
    for (let n = 0; n <= 16; n++) { C[n] = []; for (let k = 0; k <= n; k++) C[n][k] = k === 0 || k === n ? 1n : C[n - 1][k - 1] + C[n - 1][k]; }
    return (n, k) => (k < 0 || k > n ? 0n : C[n][k]);
  })();
  // a vector of integers divided by the gcd of its entries (and made to start positive)
  function primitive(v) {
    let g = 0n;
    for (const x of v) if (x !== 0n) g = gcd(g, x);
    if (g === 0n) return v.slice();
    const first = v.find((x) => x !== 0n);
    if (first < 0n) g = -g;
    return v.map((x) => x / g);
  }

  /* ---------- monomials ---------- */

  // the monomials x^a y^b of total degree ≤ D, by degree and then by the power of y
  const monoCache = [];
  function monomials(D) {
    if (!monoCache[D]) {
      const list = [];
      for (let d = 0; d <= D; d++) for (let b = 0; b <= d; b++) list.push([d - b, b]);
      monoCache[D] = list;
    }
    return monoCache[D];
  }
  const LOC = monomials(KMAX);                       // the local monomials u^i v^j
  const lidx = (i, j) => ((i + j) * (i + j + 1)) / 2 + j; // the index of u^i v^j in LOC
  const zeroVec = () => new Array(LOC.length).fill(0n);

  // the weight order: by w·(a, b), ties broken by the power of y, then of x
  function weightKey(w) { return (m) => w[0] * m[0] + w[1] * m[1]; }
  function compare(w) {
    const key = weightKey(w);
    return (m1, m2) => key(m1) - key(m2) || m1[1] - m2[1] || m1[0] - m2[0];
  }

  /* ---------- local functionals ---------- */

  // evaluation at p: f ↦ f(p)
  function pointDual() { const v = zeroVec(); v[0] = 1n; return [v]; }
  // f ↦ the degree-k part of f (its Taylor polynomial at p) at the vector w
  function psi(k, w) {
    const v = zeroVec(), w1 = B(w[0]), w2 = B(w[1]);
    for (let i = 0; i <= k; i++) v[lidx(i, k - i)] = w1 ** B(i) * w2 ** B(k - i);
    return v;
  }
  // the monomial ideal of the partition lam at p: its dual is the coefficients of the boxes
  function monomialDual(lam) {
    const out = [];
    lam.forEach((len, j) => { for (let i = 0; i < len; i++) { const v = zeroVec(); v[lidx(i, j)] = 1n; out.push(v); } });
    return out;
  }
  // the curvilinear germ along the curve s ↦ (gx(s), gy(s)) (polynomials with gx(0) = gy(0) = 0,
  // integer coefficients by power of s): the functionals f ↦ [s^m] f(gx(s), gy(s)) for m < k
  function curveDual(k, gx, gy) {
    const out = [];
    for (let m = 0; m < k; m++) out.push(zeroVec());
    // powers of gx and gy, truncated at s^k
    const mulTrunc = (p, q) => { const r = new Array(k).fill(0n); for (let i = 0; i < k; i++) if (p[i]) for (let j = 0; i + j < k; j++) if (q[j]) r[i + j] += p[i] * q[j]; return r; };
    const pad = (p) => { const r = new Array(k).fill(0n); p.forEach((c, i) => { if (i < k) r[i] = B(c); }); return r; };
    const X = [pad([1])], Y = [pad([1])], gxp = pad(gx), gyp = pad(gy);
    for (let e = 1; e < k; e++) { X.push(mulTrunc(X[e - 1], gxp)); Y.push(mulTrunc(Y[e - 1], gyp)); }
    for (let i = 0; i < k; i++) for (let j = 0; i + j < k; j++) {
      const prod = mulTrunc(X[i], Y[j]);
      for (let m = 0; m < k; m++) if (prod[m]) out[m][lidx(i, j)] += prod[m];
    }
    return out.map(primitive);
  }

  // the rank of a list of integer vectors, and whether phi lies in their span
  function rank(vecs) {
    if (!vecs.length) return 0;
    const cols = Array.from({ length: vecs[0].length }, (_, c) => c);
    return echelon(vecs, cols).rank;
  }
  const inSpan = (dual, phi) => rank(dual.concat([phi])) === rank(dual);

  // The limit of J ∩ m_{p + t w} as t → 0: a point coming into the cluster along
  // the line through p in the direction w. With k0 the least degree k for which
  // "the degree-k part at w" does not vanish on J, the limit is the part of J on
  // which it does vanish: its dual is J^⊥ and that functional.
  function k0(dual, w) {
    for (let k = 0; k < KMAX; k++) if (!inSpan(dual, psi(k, w))) return k;
    throw new Error('no limit within the degrees held');
  }
  function merge(dual, w) { return dual.concat([psi(k0(dual, w), w)]); }

  // A rotation of the local structure about p, by the angle with tan(θ/2) = T/M:
  // J ↦ R(J) = { f : f ∘ R ∈ J }, so each functional φ becomes φ ∘ (f ↦ f ∘ R).
  function rotateDual(dual, T, M) {
    T = B(T); M = B(M);
    const den = M * M + T * T, c = M * M - T * T, s = 2n * T * M; // cos = c/den, sin = s/den
    // (u^a v^b) ∘ R = (c u − s v)^a (s u + c v)^b / den^(a+b), as integer coefficients over u^i v^j
    const top = dual.reduce((m, v) => Math.max(m, ...v.map((x, q) => (x ? LOC[q][0] + LOC[q][1] : 0))), 0);
    return dual.map((phi) => {
      const out = zeroVec();
      for (let q = 0; q < LOC.length; q++) {
        const [a, b] = LOC[q], d = a + b;
        if (d > top) continue;
        // the coefficients of (c u − s v)^a (s u + c v)^b
        let poly = [[0, 0, 1n]];
        const times = (lin) => {
          const next = new Map();
          for (const [i, j, k] of poly) for (const [di, dj, kk] of lin) {
            const key = (i + di) + ',' + (j + dj);
            next.set(key, (next.get(key) || 0n) + k * kk);
          }
          poly = [...next].map(([key, k]) => { const [i, j] = key.split(',').map(Number); return [i, j, k]; });
        };
        for (let e = 0; e < a; e++) times([[1, 0, c], [0, 1, -s]]);
        for (let e = 0; e < b; e++) times([[1, 0, s], [0, 1, c]]);
        // φ'(u^a v^b) = Σ φ_ij [u^i v^j]((u^a v^b) ∘ R), scaled by den^(top − d) to stay integral
        let acc = 0n;
        for (const [i, j, k] of poly) acc += phi[lidx(i, j)] * k;
        out[q] = acc * den ** B(top - d);
      }
      return primitive(out);
    });
  }
  // a direction turned by the same rotation (as integers)
  function rotateDir(w, T, M) {
    T = B(T); M = B(M);
    const den = M * M + T * T, c = M * M - T * T, s = 2n * T * M, w1 = B(w[0]), w2 = B(w[1]);
    return primitive([c * w1 - s * w2, s * w1 + c * w2]);
  }

  /* ---------- the local structure: curvilinear or not, its tangent, its germ ---------- */

  // the functionals of the span supported in degree ≤ 1 (from an echelon form with the higher
  // degrees first): for a curvilinear J of length ≥ 2 the evaluation and one derivative ∂_d
  function lowPart(dual) {
    const order = LOC.map((m, q) => q).sort((a, b) => (LOC[b][0] + LOC[b][1]) - (LOC[a][0] + LOC[a][1]) || b - a);
    const E = echelon(dual, order);
    const low = [];
    for (let r = 0; r < E.rank; r++) { const c = E.piv[r]; if (LOC[c][0] + LOC[c][1] <= 1) low.push(E.A[r]); }
    return low;
  }
  // { k, curvilinear, dir } where dir is the tangent direction [a, b] (integers) of a curvilinear J of length ≥ 2
  function structure(dual) {
    const k = dual.length;
    if (k === 1) return { k, curvilinear: true, dir: null };
    const low = lowPart(dual);
    if (low.length >= 3) return { k, curvilinear: false, dir: null };
    // the derivative among them, with the evaluation removed
    const d = low.find((v) => v[1] !== 0n || v[2] !== 0n);
    return { k, curvilinear: true, dir: primitive([d[1], d[2]]) };
  }
  // A curvilinear J of length k, as the germ of a polynomial graph: { swap, h } with h the
  // coefficients (doubles) of h(s), of degree < k, such that v − h(u) ∈ J (or u − h(v) when
  // swap, for a tangent nearer the vertical). Null for J that is not curvilinear.
  function germ(dual) {
    const st = structure(dual);
    if (!st.curvilinear) return null;
    if (st.k === 1) return { swap: false, h: [0] };
    const [a, b] = st.dir, swap = absB(b) > absB(a), k = st.k;
    // φ(v − Σ h_m u^m) = 0 for every φ: Σ h_m φ(u^m) = φ(v); exact, then as doubles
    const rows = dual.map((phi) => {
      const r = [];
      for (let m = 0; m < k; m++) r.push(rat(phi[swap ? lidx(0, m) : lidx(m, 0)]));
      r.push(rat(phi[swap ? lidx(1, 0) : lidx(0, 1)]));
      return r;
    });
    const h = solveRat(rows, k);
    return { swap, h: h.map(Q.num) };
  }
  // the solution of a square system of rationals (rows: k coefficients, then the right-hand side)
  function solveRat(rows, k) {
    const A = rows.map((r) => r.slice());
    for (let c = 0; c < k; c++) {
      let p = c;
      while (p < A.length && Q.isZero(A[p][c])) p++;
      if (p === A.length) throw new Error('singular system');
      [A[p], A[c]] = [A[c], A[p]];
      for (let r = 0; r < A.length; r++) {
        if (r === c || Q.isZero(A[r][c])) continue;
        const f = Q.div(A[r][c], A[c][c]);
        for (let q = c; q <= k; q++) A[r][q] = Q.sub(A[r][q], Q.mul(f, A[c][q]));
      }
    }
    return Array.from({ length: k }, (_, c) => Q.div(A[c][k], A[c][c]));
  }

  // The germ of a curvilinear J (length k ≥ 2) in the frame of its tangent: with d = (a, b) its
  // direction, s = (a u + b v)/|d| and t = (−b u + a v)/|d|, the coefficients g_m (m ≥ 2, doubles)
  // with t − Σ g_m s^m ∈ J. Null for J that is not curvilinear.
  function germFrame(dual) {
    const st = structure(dual);
    if (!st.curvilinear || st.k < 2) return null;
    const [a, b] = st.dir, k = st.k;
    // φ(t) = Σ_m G_m φ(s^m) for every φ, with s = a u + b v and t = −b u + a v unnormalised
    const sPow = (m) => { const v = zeroVec(); for (let i = 0; i <= m; i++) v[lidx(i, m - i)] = binom(m, i) * a ** B(i) * b ** B(m - i); return v; };
    const apply = (phi, v) => phi.reduce((acc, c, q) => acc + c * v[q], 0n);
    const tVec = zeroVec(); tVec[lidx(1, 0)] = -b; tVec[lidx(0, 1)] = a;
    const S = Array.from({ length: k }, (_, m) => sPow(m));
    const rows = dual.map((phi) => S.map((v) => rat(apply(phi, v))).concat([rat(apply(phi, tVec))]));
    const G = solveRat(rows, k), len = Math.hypot(Number(a), Number(b));
    const g = [];
    for (let m = 2; m < k; m++) g.push(Q.num(G[m]) * Math.pow(len, m - 1));
    return { dir: [Number(a), Number(b)], angle: Math.atan2(Number(b), Number(a)), g };
  }
  // the curvilinear germ of length k with its tangent at the angle ang (exact on the axes) and the
  // coefficients g (as from germFrame): the curve σ ↦ σ d̂ + Σ g_m σ^m d̂⊥, with integer data
  function germDual(k, ang, g) {
    const S = 1000, c = Math.cos(ang), s = Math.sin(ang);
    const d = [Math.round(S * c), Math.round(S * s)], len = Math.hypot(d[0], d[1]);
    // s ↦ s·d + Σ e_m s^m d⊥ with d⊥ = (−d2, d1) and e_m = g_m |d|^(m−1)
    const gx = [0, d[0]], gy = [0, d[1]];
    for (let m = 2; m < k; m++) {
      const e = Math.round((g[m - 2] || 0) * Math.pow(len, m - 1));
      gx.push(-e * d[1]);
      gy.push(e * d[0]);
    }
    return curveDual(k, gx, gy);
  }

  // The real triple points at one place form a projective plane, drawn as a disc whose
  // opposite rim points are the same: its centre is m², each other point (ρ, ψ) the germ
  // through p whose centre of curvature lies in the direction ψ at the distance R = ρ/(1 − ρ),
  // and the rim (ρ = 1) the straight germs, at right angles to ψ.
  function tripleFromDisc(rho, psiAng) {
    if (rho < 0.02) return monomialDual([2, 1]);
    const th = psiAng - Math.PI / 2, S = 1000;
    const d = [Math.round(S * Math.cos(th)), Math.round(S * Math.sin(th))];
    const curv = rho >= 0.995 ? 0 : (1 - rho) / rho; // κ = 1/R
    // the germ s ↦ s·d + (κ|d|/2) s²·d⊥, d⊥ = (−d2, d1): curvature κ, its centre in the direction d⊥;
    // with s ↦ 1000 s, integral: s ↦ 1000 s·d + c s²·d⊥ with c = 10⁶ κ|d|/2
    const len = Math.hypot(d[0], d[1]), c = Math.round(curv * len / 2 * 1e6);
    return curveDual(3, [0, 1000 * d[0], -c * d[1]], [0, 1000 * d[1], c * d[0]]);
  }
  function discOfTriple(dual) {
    if (dual.length !== 3) return null;
    const st = structure(dual);
    if (!st.curvilinear) return { rho: 0, psi: 0 };
    const g = germ(dual), h1 = g.h[1] || 0, h2 = g.h[2] || 0;
    // the graph t = h1 s + h2 s² (s = u, t = v, or swapped): curvature 2h2 / (1 + h1²)^{3/2}
    const kappa = 2 * h2 / Math.pow(1 + h1 * h1, 1.5);
    // the unit normal towards positive t, in (u, v)
    let n = [-h1, 1].map((x) => x / Math.hypot(h1, 1));
    if (g.swap) n = [n[1], n[0]];
    // with the graph swapped the orientation of the normal flips; the centre lies along the normal times sign κ
    const side = Math.sign(kappa) || 1, R = Math.abs(kappa) < 1e-12 ? Infinity : 1 / Math.abs(kappa);
    const psiAng = Math.atan2(side * n[1], side * n[0]);
    return { rho: R === Infinity ? 1 : R / (1 + R), psi: psiAng };
  }

  /* ---------- one more point at the same place ---------- */

  // The contraction of a functional by u or by v, (u·φ)(f) = φ(u f): it lowers the power of u in
  // each coefficient. A span of functionals is the dual of a local ideal when contraction keeps it.
  function contract(phi, dir) {
    const out = zeroVec();
    for (let q = 0; q < LOC.length; q++) {
      if (!phi[q]) continue;
      const [i, j] = LOC[q];
      if (dir === 0 ? i : j) out[dir === 0 ? lidx(i - 1, j) : lidx(i, j - 1)] = phi[q];
    }
    return out;
  }
  const degOf = (phi) => phi.reduce((m, c, q) => (c ? Math.max(m, LOC[q][0] + LOC[q][1]) : m), -1);
  const closed = (dual) => dual.every((phi) => inSpan(dual, contract(phi, 0)) && inSpan(dual, contract(phi, 1)));
  const lcm = (a, b) => absB(a / gcd(a, b) * b);

  // Reduced row echelon form of integer rows, the pivots taken in the given order of columns; each
  // row kept primitive, with its pivot positive. Rows that vanish are dropped.
  function rref(rows, order) {
    const A = rows.map((r) => r.slice()), piv = [];
    let r = 0;
    for (const c of order) {
      if (r === A.length) break;
      let s = r;
      while (s < A.length && A[s][c] === 0n) s++;
      if (s === A.length) continue;
      [A[s], A[r]] = [A[r], A[s]];
      if (A[r][c] < 0n) A[r] = A[r].map((x) => -x);
      A[r] = primitivePos(A[r]);
      const R = A[r], pv = R[c];
      for (let i = 0; i < A.length; i++) {
        if (i === r || A[i][c] === 0n) continue;
        const f = A[i][c];
        A[i] = primitivePos(A[i].map((x, q) => x * pv - R[q] * f));
      }
      piv.push(c);
      r++;
    }
    return { A: A.slice(0, r), piv, rank: r };
  }
  // divided by the gcd of its entries, keeping the signs
  function primitivePos(v) {
    let g = 0n;
    for (const x of v) if (x !== 0n) g = gcd(g, x);
    return g > 1n ? v.map((x) => x / g) : v;
  }
  // a basis of the integer vectors x (ncols long) with row · x = 0 for every row
  function nullspace(rows, ncols) {
    const cols = Array.from({ length: ncols }, (_, c) => c);
    const { A, piv } = rref(rows, cols), isPiv = new Set(piv), out = [];
    for (let f = 0; f < ncols; f++) {
      if (isPiv.has(f)) continue;
      let L = 1n;
      A.forEach((row, i) => { if (row[f]) L = lcm(L, row[piv[i]]); });
      const x = new Array(ncols).fill(0n);
      x[f] = L;
      A.forEach((row, i) => { if (row[f]) x[piv[i]] = -row[f] * (L / row[piv[i]]); });
      out.push(primitive(x));
    }
    return out;
  }

  // The extensions of a local ideal J of length j (its dual) to one of length j + 1 at the same
  // place are the lines of W / J^⊥, where W = { φ of degree ≤ j : u·φ, v·φ ∈ J^⊥ } (the dual of mJ
  // up to degree j): dim W/J^⊥ is the number of generators of J, 2 for a curvilinear J, 3 for m².
  // W is found as the functionals killing u·g and v·g for the g of degree < j that J^⊥ kills.
  function extensionSpace(dual) {
    const j = dual.length;
    const low = [], all = [];
    LOC.forEach((m, q) => { const d = m[0] + m[1]; if (d <= j) all.push(q); if (d < j) low.push(q); });
    const ann = nullspace(dual.map((phi) => low.map((q) => phi[q])), low.length);
    const conds = [];
    for (const g of ann) for (const dir of [0, 1]) {
      const row = zeroVec();
      g.forEach((x, i) => { if (x) { const [a, b] = LOC[low[i]]; row[dir ? lidx(a, b + 1) : lidx(a + 1, b)] = x; } });
      conds.push(all.map((q) => row[q]));
    }
    return nullspace(conds, all.length).map((x) => { const v = zeroVec(); x.forEach((c, i) => { v[all[i]] = c; }); return v; });
  }

  // A functional in the frame of the direction d = (p, q) (integers): with X = p u + q v and
  // Y = −q u + p v, its coefficient on X^i Y^j is φ((p u + q v)^i (−q u + p v)^j). (A rotation
  // and a scaling by |d|, with no denominators.)
  function toFrame(phi, d) {
    const p = B(d[0]), q = B(d[1]), out = zeroVec(), top = degOf(phi);
    for (let deg = 0; deg <= top; deg++) for (let j = 0; j <= deg; j++) {
      let poly = [1n]; // poly[t]: the coefficient of u^(e − t) v^t
      const times = (a, b) => { const r = new Array(poly.length + 1).fill(0n); poly.forEach((c, t) => { r[t] += c * a; r[t + 1] += c * b; }); poly = r; };
      for (let e = 0; e < deg - j; e++) times(p, q);
      for (let e = 0; e < j; e++) times(-q, p);
      let acc = 0n;
      poly.forEach((c, t) => { if (c) acc += c * phi[lidx(deg - t, t)]; });
      out[lidx(deg - j, j)] = acc;
    }
    return out;
  }
  // the logarithm of |x| for a BigInt x ≠ 0
  function bigLog(x) {
    x = absB(x);
    const s = x.toString(2).length, sh = Math.max(0, s - 60);
    return Math.log(Number(x >> BigInt(sh))) + sh * Math.LN2;
  }
  // log of the size of the part of top degree t of a functional, the same in every orthonormal
  // frame: √(Σ_i C(t, i) c_{i, t−i}²) (the norm in which (cos θ ∂_u + sin θ ∂_v)^t / t! has size 1)
  function topLog(phi) {
    const t = degOf(phi);
    let big = 0n;
    for (let i = 0; i <= t; i++) { const c = absB(phi[lidx(i, t - i)]); if (c > big) big = c; }
    let s = 0;
    for (let i = 0; i <= t; i++) { const r = Q.num([phi[lidx(i, t - i)], big]); s += Number(binom(t, i)) * r * r; }
    return bigLog(big) + 0.5 * Math.log(s);
  }

  // The extensions of J with a basis chosen in the frame of the direction d: W/J^⊥ in reduced echelon
  // form there, the monomials X^i Y^j taken by degree from the top, then by the power of Y; so for a
  // curvilinear J along d, the next term of its curve (with nothing across it), then the derivative
  // across it. { r, basis (in the plane's coordinates, each ≡ its echelon row), logn (log of the size
  // of each echelon row's top part, undoing the frame's scaling), and what coords() needs }.
  function extensions(dual, d) {
    const j = dual.length, E = extensionSpace(dual), nE = E.length;
    const order = LOC.map((m, q) => q).filter((q) => LOC[q][0] + LOC[q][1] <= j)
      .sort((a, b) => (LOC[b][0] + LOC[b][1]) - (LOC[a][0] + LOC[a][1]) || LOC[a][1] - LOC[b][1]);
    const EV = rref(dual.map((phi) => toFrame(phi, d)), order);
    // W in the frame, each row carrying which combination of E it is; reduced modulo J^⊥ there
    const rows = E.map((phi, l) => {
      let v = toFrame(phi, d).concat(new Array(nE).fill(0n));
      v[LOC.length + l] = 1n;
      EV.A.forEach((R, i) => { const c = EV.piv[i], f = v[c]; if (f) v = v.map((x, qq) => (qq < LOC.length ? x * R[c] - R[qq] * f : x * R[c])); });
      return primitivePos(v);
    });
    const EB = rref(rows, order);
    const len2 = Number(B(d[0]) * B(d[0]) + B(d[1]) * B(d[1]));
    const out = { r: EB.rank, d: d.slice(), EV, frameRows: [], piv: EB.piv, basis: [], logn: [], degs: [] };
    EB.A.forEach((row) => {
      const f = row.slice(0, LOC.length), comb = row.slice(LOC.length), t = degOf(f);
      const phi = zeroVec();
      comb.forEach((c, l) => { if (c) for (let q = 0; q < LOC.length; q++) if (E[l][q]) phi[q] += c * E[l][q]; });
      out.frameRows.push(f);
      out.basis.push(phi); // (not divided down: it must stay the same multiple of its echelon row)
      out.degs.push(t);
      out.logn.push(topLog(f) - 0.5 * t * Math.log(len2));
    });
    return out;
  }
  // The extension x_1 B_1/|B_1| + … (x real, not all zero) as an integer combination of the basis:
  // the smallest coefficient about 2^40, the others in proportion (BigInt, so that sizes of the B
  // far apart do not matter); exact for the x_i that are 0.
  function combine(ext, x) {
    const l = x.map((xi, i) => (Math.abs(xi) > 1e-12 ? Math.log(Math.abs(xi)) - ext.logn[i] : null));
    const lo = Math.min(...l.filter((v) => v !== null)), out = zeroVec();
    x.forEach((xi, i) => {
      if (l[i] === null) return;
      const bits = (l[i] - lo) / Math.LN2, whole = Math.floor(bits);
      const X = BigInt(Math.round(Math.sign(xi) * 2 ** 40 * 2 ** (bits - whole))) << BigInt(whole);
      ext.basis[i].forEach((c, q) => { if (c) out[q] += X * c; });
    });
    return primitive(out);
  }
  // the coordinates x of an extension φ in that basis (as combine takes them), up to scale
  function coords(ext, phi) {
    let v = toFrame(phi, ext.d);
    ext.EV.A.forEach((R, i) => { const c = ext.EV.piv[i], f = v[c]; if (f) v = v.map((x, q) => x * R[c] - R[q] * f); });
    // (the echelon rows' pivots are positive)
    const l = ext.piv.map((c, i) => (v[c] ? bigLog(v[c]) - bigLog(ext.frameRows[i][c]) + ext.logn[i] : -Infinity));
    const top = Math.max(...l);
    return ext.piv.map((c, i) => (v[c] ? (v[c] > 0n ? 1 : -1) * Math.exp(l[i] - top) : 0));
  }

  // After m² (the triple point at the disc's centre) the fourth point adds a second-order term
  // D = a ∂x² + b ∂x∂y + c ∂y², up to scale: a point of a projective plane, drawn as a disc with
  // (a − c, b, a + c) ∝ (X, Y, Z), (X, Y) = ρ(cos ψ, sin ψ), Z = √(1 − ρ²) (a hemisphere seen from
  // above, in the norm that turns with the plane). Its centre is the Laplacian, its rim the D with
  // a + c = 0, and the circle ρ = 1/√2 the squares (ℓ·∇)² (at ψ twice the angle of ℓ).
  function quadFromDisc(rho, psiAng) {
    const v = zeroVec();
    if (Math.abs(rho - Math.SQRT1_2) < 1e-9) {
      // a square, exactly: (l1 ∂x + l2 ∂y)², of coefficients (l1², l1 l2, l2²) on u², uv, v²
      const t = psiAng / 2, l1 = BigInt(Math.round(1000 * Math.cos(t))), l2 = BigInt(Math.round(1000 * Math.sin(t)));
      v[lidx(2, 0)] = l1 * l1; v[lidx(1, 1)] = l1 * l2; v[lidx(0, 2)] = l2 * l2;
      return primitive(v);
    }
    const X = rho * Math.cos(psiAng), Y = rho * Math.sin(psiAng), Z = Math.sqrt(Math.max(0, 1 - rho * rho));
    // D(f) = a f_xx + b f_xy + c f_yy takes 2a, b, 2c of the coefficients of u², uv, v²
    v[lidx(2, 0)] = BigInt(Math.round(1e6 * (Z + X)));
    v[lidx(1, 1)] = BigInt(Math.round(1e6 * Y));
    v[lidx(0, 2)] = BigInt(Math.round(1e6 * (Z - X)));
    return primitive(v);
  }
  function quadOf(phi) {
    const big = [lidx(2, 0), lidx(1, 1), lidx(0, 2)].reduce((m, q) => (absB(phi[q]) > m ? absB(phi[q]) : m), 1n);
    const al = Q.num([phi[lidx(2, 0)], big]), be = Q.num([phi[lidx(1, 1)], big]), ga = Q.num([phi[lidx(0, 2)], big]);
    let X = (al - ga) / 2, Y = be, Z = (al + ga) / 2;
    const s = Math.hypot(X, Y, Z) * (Z < 0 ? -1 : 1);
    X /= s; Y /= s; Z /= s;
    const rho = Math.hypot(X, Y);
    if (rho < 1e-7) return { rho: 0, psi: 0 };
    return { rho: Math.abs(rho - Math.SQRT1_2) < 1e-7 ? Math.SQRT1_2 : rho > 1 - 1e-9 ? 1 : rho, psi: Math.atan2(Y, X) };
  }
  // the direction of a frame for what comes after D: a line of D where it has real ones (the one at
  // ψ/2 + Δ/2, Δ the angle between them), else its long axis
  function thetaOfD(rho, psiAng) {
    if (rho < 1e-7) return 0; // the Laplacian: no direction of its own, so the x-axis
    const c2 = 1 / (rho * rho) - 1;
    return psiAng / 2 + (rho > Math.SQRT1_2 ? Math.acos(Math.min(1, Math.sqrt(Math.max(0, c2)))) / 2 : 0);
  }
  const dirOf = (th) => [Math.round(1000 * Math.cos(th)), Math.round(1000 * Math.sin(th))];

  // A point of multiplicity k ≥ 3 at one place, from an editor's state { d: { rho, psi }, s: [steps] }:
  // the triple point of the disc d, then a step for each further point, s[i] = { a, d }. After m², the
  // first step is D (quadFromDisc of its d). Otherwise each step chooses an extension in the frame of
  // the curve's tangent (or of D): with two independent ones the angle a gives cos(a/2) B1 + sin(a/2) B2
  // (each B of size 1), with three the disc point d gives Z B1 + X B2 + Y B3, as for D. For a
  // curvilinear point B1 continues its curve and B2 is the derivative across it, so a = 0 adds nothing
  // to the curve, a = π leaves it, and in between the next coefficient is tan(a/2).
  // With `carry` (the result of an earlier call), a step whose frame has turned by more than 45°
  // since then (across the rim of a disc, say) is set to stay as near as it can to what it was.
  // Returns { dual, state, steps: [{ kind: 'quad' | 'circle' | 'disc', ext, frame }] }.
  function editDual(k, st, carry) {
    const s = (st.s || []).map((x) => ({ a: x.a || 0, d: { rho: x.d ? x.d.rho : 0, psi: x.d ? x.d.psi : 0 } }));
    const state = { d: { rho: st.d.rho, psi: st.d.psi }, s };
    let dual = tripleFromDisc(state.d.rho, state.d.psi);
    const m2 = state.d.rho < 0.02;
    let frame = m2 ? null : dirOf(state.d.psi - Math.PI / 2);
    const steps = [];
    for (let j = 3; j < k; j++) {
      if (!s[j - 3]) s[j - 3] = { a: 0, d: { rho: 0, psi: 0 } };
      const step = s[j - 3];
      if (j === 3 && m2) {
        dual = dual.concat([quadFromDisc(step.d.rho, step.d.psi)]);
        steps.push({ kind: 'quad', frame: null });
        frame = dirOf(thetaOfD(step.d.rho, step.d.psi));
        continue;
      }
      const ext = extensions(dual, frame), kind = ext.r === 2 ? 'circle' : 'disc';
      const old = carry && carry.steps[j - 3];
      if (old && old.kind === kind && old.frame) {
        const cosT = (old.frame[0] * frame[0] + old.frame[1] * frame[1]) / (Math.hypot(...old.frame) * Math.hypot(...frame));
        if (cosT < Math.SQRT1_2) {
          const x = coords(ext, carry.dual[j]);
          if (kind === 'circle') step.a = angleOf(x); else step.d = discOf(x);
        }
      }
      const x = kind === 'circle' ? [Math.cos(step.a / 2), Math.sin(step.a / 2)] : discXYZ(step.d);
      dual = dual.concat([combine(ext, x.slice(0, ext.r).concat(new Array(Math.max(0, ext.r - x.length)).fill(0)))]);
      steps.push({ kind, ext, frame: frame.slice() });
    }
    return { dual, state, steps };
  }
  // The special points of the editor, where a handle holds when near: in each disc (ρ, ψ) its
  // centre and these marks (a rim mark stands also for its opposite), on a circle these angles a.
  // The triple point's are m², (x, y³) and (y, x³); after m², ∂x², ∂y² and ∂x∂y; in a later disc
  // and on a circle, the extensions B_i of the basis. With the triple point and the steps before
  // at marks, the frames lie on the axes, the B_i are monomial, and every mark makes a monomial
  // ideal: they are all made so (checked in the tests).
  const MARKS = {
    triple: [[1, 0], [1, Math.PI / 2]],
    quad: [[Math.SQRT1_2, 0], [Math.SQRT1_2, Math.PI], [1, Math.PI / 2]],
    disc: [[1, 0], [1, Math.PI / 2]],
    circle: [0, Math.PI],
  };
  const discXYZ = (p) => [Math.sqrt(Math.max(0, 1 - p.rho * p.rho)), p.rho * Math.cos(p.psi), p.rho * Math.sin(p.psi)];
  // a pair of coordinates as the angle a (in [0, 2π), the line through them: cos(a/2), sin(a/2)),
  // the special ones exact
  function angleOf(x) {
    let t = Math.atan2(x[1], x[0]);
    if (t > Math.PI / 2) t -= Math.PI; else if (t <= -Math.PI / 2) t += Math.PI;
    let a = 2 * t;
    if (a < 0) a += 2 * Math.PI;
    if (Math.abs(a) < 1e-9 || Math.abs(a - 2 * Math.PI) < 1e-9) a = 0;
    if (Math.abs(a - Math.PI) < 1e-9) a = Math.PI;
    return a;
  }
  // three coordinates as a point of the disc (the line through them, Z ≥ 0), the centre and rim exact
  function discOf(x) {
    let [Z, X, Y] = x;
    const s = Math.hypot(X, Y, Z) * (Z < 0 || (Z === 0 && (X < 0 || (X === 0 && Y < 0))) ? -1 : 1);
    X /= s; Y /= s; Z /= s;
    let rho = Math.hypot(X, Y);
    if (rho < 1e-9) rho = 0; else if (rho > 1 - 1e-9) rho = 1;
    return { rho, psi: rho ? Math.atan2(Y, X) : 0 };
  }
  // the editor's state of a point of multiplicity k ≥ 3 (its dual, each beginning of it closed)
  function editState(dual) {
    const k = dual.length, d = discOfTriple(dual.slice(0, 3)), st = { d, s: [] };
    let frame = d.rho < 0.02 ? null : dirOf(d.psi - Math.PI / 2);
    for (let j = 3; j < k; j++) {
      if (j === 3 && d.rho < 0.02) {
        const q = quadOf(dual[3]);
        st.s.push({ a: 0, d: q });
        frame = dirOf(thetaOfD(q.rho, q.psi));
        continue;
      }
      const ext = extensions(dual.slice(0, j), frame), x = coords(ext, dual[j]);
      st.s.push(ext.r === 2 ? { a: angleOf(x), d: { rho: 0, psi: 0 } } : { a: 0, d: discOf(x.concat([0, 0, 0]).slice(0, 3)) });
    }
    return st;
  }

  /* ---------- the ideal: standard monomials and the reduced Gröbner basis ---------- */

  // Row echelon form of an integer matrix by fraction-free (Bareiss) elimination, taking the
  // columns in the given order. The pivot columns are the first independent columns in that order.
  function echelon(rows, order) {
    const A = rows.map((r) => r.slice()), m = A.length, ncol = A.length ? A[0].length : 0, piv = [];
    let r = 0, prev = 1n;
    for (const c of order) {
      if (r === m) break;
      let s = r;
      while (s < m && A[s][c] === 0n) s++;
      if (s === m) continue;
      if (s !== r) { const t = A[s]; A[s] = A[r]; A[r] = t; }
      const pv = A[r][c], R = A[r];
      for (let i = r + 1; i < m; i++) {
        const Ai = A[i], f = Ai[c];
        for (let q = 0; q < ncol; q++) Ai[q] = (Ai[q] * pv - R[q] * f) / prev;
      }
      prev = pv;
      piv.push(c);
      r++;
    }
    return { A, piv, rank: r };
  }

  // the rows of the functionals over the global monomials of degree ≤ D, each column x^a y^b
  // scaled by 100^(a+b) to keep it integral
  function functionalRows(clusters, D) {
    const mons = monomials(D), rows = [];
    for (const c of clusters) {
      const X = B(c.p[0]), Y = B(c.p[1]);
      const px = [1n], py = [1n], ph = [1n];
      for (let e = 1; e <= D + KMAX; e++) { px.push(px[e - 1] * X); py.push(py[e - 1] * Y); ph.push(ph[e - 1] * H); }
      for (const phi of c.dual) {
        const row = new Array(mons.length).fill(0n);
        phi.forEach((cij, q) => {
          if (cij === 0n) return;
          const [i, j] = LOC[q];
          mons.forEach(([a, b], col) => {
            if (i > a || j > b) return;
            row[col] += cij * binom(a, i) * binom(b, j) * px[a - i] * py[b - j] * ph[i + j];
          });
        });
        rows.push(row);
      }
    }
    return rows;
  }

  // the corners of a staircase: the monomials outside it whose divisors x^{a−1}y^b, x^a y^{b−1} are in it
  function corners(stair) {
    const has = new Set(stair.map((m) => m[0] + ',' + m[1])), out = [];
    const width = Math.max(...stair.map((m) => m[0])) + 1, height = Math.max(...stair.map((m) => m[1])) + 1;
    for (let b = 0; b <= height; b++) for (let a = 0; a <= width; a++) {
      if (has.has(a + ',' + b)) continue;
      if ((a === 0 || has.has((a - 1) + ',' + b)) && (b === 0 || has.has(a + ',' + (b - 1)))) out.push([a, b]);
    }
    return out.sort((m1, m2) => m2[0] - m1[0]); // from the x-axis to the y-axis
  }
  // the staircase as a partition: the lengths of its rows (row j: x^i y^j)
  function partitionOf(stair) {
    const lam = [];
    for (const [a, b] of stair) lam[b] = Math.max(lam[b] || 0, a + 1);
    return lam;
  }

  // The ideal of the clusters for the weight w = [w1, w2] (positive numbers): its standard
  // monomials (a staircase of n boxes, a basis of C[x,y]/I) and its reduced Gröbner basis,
  // a generator for each corner: the corner minus a combination of standard monomials.
  function ideal(clusters, w, rowsCache) {
    const n = clusters.reduce((s, c) => s + c.dual.length, 0);
    const D = Math.max(1, n), mons = monomials(D);
    const rows = rowsCache || functionalRows(clusters, D);
    const cmp = compare(w);
    const order = mons.map((m, q) => q).sort((a, b) => cmp(mons[a], mons[b]));
    const E = echelon(rows, order);
    if (E.rank !== n) throw new Error('the functionals are not independent');
    const stair = E.piv.map((q) => mons[q]);
    const cs = corners(stair);
    const scale = (m) => H ** B(m[0] + m[1]);
    // the normal form of a monomial of degree ≤ D: its coefficients on the standard monomials
    // (in the order of stair), which the echelon block on the pivot columns, upper triangular, gives
    const nf = (mm) => {
      const col = mons.findIndex((m) => m[0] === mm[0] && m[1] === mm[1]);
      if (col < 0) throw new Error('a monomial beyond the degrees held');
      const z = new Array(n);
      for (let r = n - 1; r >= 0; r--) {
        let acc = rat(E.A[r][col]);
        for (let s = r + 1; s < n; s++) acc = Q.sub(acc, Q.mul(rat(E.A[r][E.piv[s]]), z[s]));
        z[r] = Q.div(acc, rat(E.A[r][E.piv[r]]));
      }
      // undo the scaling of the columns: the coefficient of s in mm is z · 100^(deg s − deg mm)
      return z.map((zr, r) => (Q.isZero(zr) ? zr : Q.mul(zr, rat(scale(stair[r]), scale(mm)))));
    };
    const gens = cs.map((cm) => {
      const z = nf(cm), terms = [{ m: cm, c: rat(1) }];
      z.forEach((zr, r) => { if (!Q.isZero(zr)) terms.push({ m: stair[r], c: Q.neg(zr) }); });
      terms.sort((t1, t2) => cmp(t2.m, t1.m)); // the leading term first
      return { lead: cm, terms };
    });
    return { n, w: w.slice(), stair, lambda: partitionOf(stair), corners: cs, gens, rows, nf };
  }
  // multiplication by x and by y on C[x,y]/I, as matrices (rationals) on the basis of standard monomials:
  // column j is the normal form of x·s_j (or y·s_j)
  function multiplication(I) {
    const mat = (dx, dy) => {
      const cols = I.stair.map((s) => I.nf([s[0] + dx, s[1] + dy]));
      return I.stair.map((_, r) => cols.map((col) => col[r]));
    };
    return { X: mat(1, 0), Y: mat(0, 1) };
  }

  // a polynomial (terms of rationals) as doubles: [{a, b, c}]
  function toFloat(terms) { return terms.map((t) => ({ a: t.m[0], b: t.m[1], c: Q.num(t.c) })); }

  // the value of a polynomial (rational terms) at a point with rational coordinates
  function evalAt(terms, x, y) {
    let acc = rat(0);
    for (const t of terms) acc = Q.add(acc, Q.mul(t.c, Q.mul(qpow(x, t.m[0]), qpow(y, t.m[1]))));
    return acc;
  }
  function qpow(a, e) { let r = rat(1); for (let i = 0; i < e; i++) r = Q.mul(r, a); return r; }

  // A polynomial in one variable among the generators (all its terms in x alone, or in y alone),
  // split into linear factors at the given rational candidates: [{root, mult}] when it splits, else null.
  function splitUnivariate(terms, candidates) {
    const varIdx = terms.every((t) => t.m[1] === 0) ? 0 : terms.every((t) => t.m[0] === 0) ? 1 : -1;
    if (varIdx < 0) return null;
    let deg = Math.max(...terms.map((t) => t.m[varIdx]));
    let p = new Array(deg + 1).fill(null).map(() => rat(0));
    for (const t of terms) p[t.m[varIdx]] = Q.add(p[t.m[varIdx]], t.c);
    const out = [];
    const seen = new Set();
    for (const r of candidates) {
      const key = r[0] + '/' + r[1];
      if (seen.has(key)) continue;
      seen.add(key);
      let mult = 0;
      for (;;) {
        // synthetic division by (s − r)
        const qn = new Array(p.length - 1);
        let acc = rat(0);
        for (let i = p.length - 1; i >= 1; i--) { acc = Q.add(Q.mul(acc, r), p[i]); qn[i - 1] = acc; }
        const rem = Q.add(Q.mul(acc, r), p[0]);
        if (!Q.isZero(rem) || p.length < 2) break;
        p = qn;
        mult++;
      }
      if (mult) out.push({ root: r, mult });
    }
    if (p.length !== 1) return null;
    return { variable: varIdx, factors: out, unit: p[0] };
  }

  /* ---------- the torus: weights where the initial ideal changes ---------- */

  // The slopes w2/w1 at which the initial ideal in_w(I) is not monomial (the walls), with what
  // it is there, and the staircases between them. Walls lie among the ratios p/q with p, q ≤ n.
  function fan(clusters) {
    const n = clusters.reduce((s, c) => s + c.dual.length, 0);
    const rows = functionalRows(clusters, Math.max(1, n));
    const slopes = [];
    for (let p = 1; p <= n; p++) for (let q = 1; q <= n; q++) if (gcd(B(p), B(q)) === 1n) slopes.push([p, q]);
    slopes.sort((s, t) => s[0] / s[1] - t[0] / t[1]);
    const walls = [];
    for (const [p, q] of slopes) {
      const I = ideal(clusters, [q, p], rows), key = weightKey([q, p]);
      const tie = I.gens.some((g) => g.terms.filter((t) => key(t.m) === key(g.lead)).length > 1);
      if (tie) walls.push({ slope: p / q, w: [q, p], ideal: I });
    }
    // the chambers between the walls (and beyond the first and last), each with its staircase
    const cuts = [0, ...walls.map((x) => x.slope), Infinity], chambers = [];
    for (let i = 0; i + 1 < cuts.length; i++) {
      const lo = cuts[i], hi = cuts[i + 1];
      const mid = hi === Infinity ? Math.max(2 * lo, n + 1) : lo === 0 ? Math.min(hi / 2, 1 / (n + 1)) : Math.sqrt(lo * hi);
      const I = ideal(clusters, [1, mid], rows);
      chambers.push({ from: lo, to: hi, lambda: I.lambda, ideal: I });
    }
    return { walls, chambers };
  }

  /* ---------- partitions, arms and legs ---------- */

  function partitions(n, max) {
    if (max === undefined) max = n;
    if (n === 0) return [[]];
    const out = [];
    for (let k = Math.min(n, max); k >= 1; k--) for (const rest of partitions(n - k, k)) out.push([k].concat(rest));
    return out;
  }
  const conjugate = (lam) => { const c = []; lam.forEach((len) => { for (let i = 0; i < len; i++) c[i] = (c[i] || 0) + 1; }); return c; };
  // the arm (boxes to the right, along x) and the leg (boxes above, along y) of the box x^i y^j
  function armLeg(lam, i, j) { return { arm: lam[j] - i - 1, leg: conjugate(lam)[i] - j - 1 }; }
  // The tangent space to Hilb^n at the monomial ideal of lam, as the weights (d1, d2) of a basis of
  // Hom(I, C[x,y]/I) (a homomorphism of weight (d1, d2) takes x^a y^b to a multiple of x^{a+d1} y^{b+d2}):
  // two for each box, (−a − 1, l) and (a, −l − 1) from its arm a and leg l (checked in the tests
  // against homWeights, which works them out from the definition).
  function tangentWeights(lam) {
    const out = [];
    lam.forEach((len, j) => { for (let i = 0; i < len; i++) { const { arm, leg } = armLeg(lam, i, j); out.push({ box: [i, j], w: [[-arm - 1, leg], [arm, -leg - 1]] }); } });
    return out;
  }
  // the same from the definition: the dimension of each weight space of Hom(I, C[x,y]/I)
  function homWeights(lam) {
    const n = lam.reduce((s, x) => s + x, 0), boxes = new Set();
    lam.forEach((len, j) => { for (let i = 0; i < len; i++) boxes.add(i + ',' + j); });
    const inBox = (a, b) => a >= 0 && b >= 0 && boxes.has(a + ',' + b);
    const gensI = corners([].concat(...lam.map((len, j) => Array.from({ length: len }, (_, i) => [i, j]))));
    const out = new Map();
    for (let d1 = -n - 1; d1 <= n + 1; d1++) for (let d2 = -n - 1; d2 <= n + 1; d2++) {
      // unknowns: φ(g) = c_g x^{a+d1} y^{b+d2}, where that monomial is a box
      const vars = gensI.filter((g) => inBox(g[0] + d1, g[1] + d2));
      if (!vars.length) continue;
      // relations: for generators g, h with lcm L, (L/g) φ(g) = (L/h) φ(h) in C[x,y]/I
      const rel = [];
      for (let s = 0; s < gensI.length; s++) for (let t = s + 1; t < gensI.length; t++) {
        const g = gensI[s], h = gensI[t], L = [Math.max(g[0], h[0]), Math.max(g[1], h[1])];
        const target = [L[0] + d1, L[1] + d2];
        if (!inBox(target[0], target[1])) continue;
        const row = vars.map((v) => (v === g ? 1n : v === h ? -1n : 0n));
        if (row.some((x) => x)) rel.push(row);
      }
      const dim = vars.length - rank(rel.length ? rel : []);
      if (dim > 0) out.set(d1 + ',' + d2, dim);
    }
    return out;
  }
  // Betti numbers of Hilb^n(C²): b_{2i} is the number of partitions of n into n − i parts
  function betti(n) {
    const b = new Array(n).fill(0);
    for (const lam of partitions(n)) b[n - lam.length]++;
    return b;
  }

  root.Hilbert = {
    H: Number(H), KMAX, Q, rat, monomials, LOC, lidx, compare, weightKey,
    pointDual, psi, monomialDual, curveDual, rank, inSpan, k0, merge, rotateDual, rotateDir,
    structure, germ, tripleFromDisc, discOfTriple,
    germFrame, germDual,
    contract, closed, nullspace, extensionSpace, toFrame, extensions, combine, coords,
    quadFromDisc, quadOf, thetaOfD, editDual, editState, angleOf, discOf, MARKS,
    echelon, functionalRows, corners, partitionOf, ideal, multiplication, toFloat, evalAt, splitUnivariate, fan,
    partitions, conjugate, armLeg, tangentWeights, homWeights, betti,
  };
})(globalThis);
