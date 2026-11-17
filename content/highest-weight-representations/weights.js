// Highest weight representations: the mathematics, with no drawing.
//
// Finite types of rank one to three (A1, A2, B2, G2, A3, B3, C3), and the
// untwisted affine algebras over A1, A2, B2 = C2 and G2.
//
// A weight of a finite type is written by its Dynkin labels, μ = Σ μ_i ϖ_i with
// μ_i integers. The Cartan matrix is Kac's, a_ij = <α_i^∨, α_j>, with Bourbaki's
// numbering, so the labels of α_j are the j-th column. A root is also written by
// its coordinates c in the simple roots, Σ c_j α_j. The form ( , ) gives the
// short roots square length 2; ip(x, y) is det(A) times it, an integer.
//
//   algebra(type)              roots, Weyl group, the form, coordinates in R^r for drawing
//   character(alg, λ)          the weights of V(λ) with their multiplicities (Freudenthal's formula)
//   dimension(alg, λ)          Weyl's dimension formula, with its factors
//   tensor(alg, λ, ν)          V(λ) ⊗ V(ν) by the Brauer–Klimyk rule
//   tableaux(λ, μ)             type A: the semistandard tableaux of shape λ and weight μ
//
// An affine weight of level k is written (μ, n): μ the labels of its finite
// part and n its depth, the multiple of δ below the highest weight, so that it
// is kΛ_0 + μ − nδ when the highest weight is kΛ_0 + λ. The highest weight is
// given by its affine labels (a_0, a_1, …, a_r).
//
//   affine(type)               'A1-1', 'A2-1', 'C2-1', 'G2-1': the extended Cartan matrix, marks, level
//   affineCharacter(aff, Λ, N) the weights of L(Λ) of depth at most N, with multiplicities
//
// Also used by test/highest-weight-representations.test.mjs, so it touches no DOM.
(function (G) {
  'use strict';

  const key = (v) => v.join(',');
  const add = (u, v) => u.map((x, i) => x + v[i]);
  const sub = (u, v) => u.map((x, i) => x - v[i]);
  const scale = (k, v) => v.map((x) => k * x);
  const dotp = (u, v) => { let s = 0; for (let i = 0; i < u.length; i++) s += u[i] * v[i]; return s; };
  const mat = (M, v) => M.map((row) => dotp(row, v));
  const mul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
  const sum = (v) => v.reduce((s, x) => s + x, 0);
  const ones = (r) => Array(r).fill(1);
  // numeric lexicographic order, largest first
  const lexDesc = (u, v) => { for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return v[i] - u[i]; return 0; };

  // Cartan matrix and (α_i, α_i)/2, with short roots of square length 2.
  const TYPES = {
    A1: { cartan: [[2]], d: [1] },
    A2: { cartan: [[2, -1], [-1, 2]], d: [1, 1] },
    B2: { cartan: [[2, -1], [-2, 2]], d: [2, 1] },                       // α_1 long, α_2 short
    G2: { cartan: [[2, -3], [-1, 2]], d: [1, 3] },                       // α_1 short, α_2 long
    A3: { cartan: [[2, -1, 0], [-1, 2, -1], [0, -1, 2]], d: [1, 1, 1] },
    B3: { cartan: [[2, -1, 0], [-1, 2, -1], [0, -2, 2]], d: [2, 2, 1] }, // α_3 short
    C3: { cartan: [[2, -1, 0], [-1, 2, -2], [0, -1, 2]], d: [1, 1, 2] }, // α_3 long
  };

  function det(M) {
    if (M.length === 1) return M[0][0];
    if (M.length === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
    return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
      + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  }
  // the adjugate, adj(M) M = det(M) I, for r ≤ 3
  function adjugate(M) {
    const r = M.length;
    if (r === 1) return [[1]];
    if (r === 2) return [[M[1][1], -M[0][1]], [-M[1][0], M[0][0]]];
    const minor = (i, j) => {
      const m = [0, 1, 2].filter((a) => a !== i).map((a) => [0, 1, 2].filter((b) => b !== j).map((b) => M[a][b]));
      return ((i + j) % 2 ? -1 : 1) * (m[0][0] * m[1][1] - m[0][1] * m[1][0]);
    };
    return [0, 1, 2].map((i) => [0, 1, 2].map((j) => minor(j, i)));
  }
  // a lower-triangular L with L Lᵀ = M (M positive definite)
  function cholesky(M) {
    const r = M.length, L = M.map(() => Array(r).fill(0));
    for (let i = 0; i < r; i++) {
      for (let j = 0; j <= i; j++) {
        let s = M[i][j];
        for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
        L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j];
      }
    }
    return L;
  }
  const unitv = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  const cache = {};
  function algebra(type) {
    if (cache[type]) return cache[type];
    const T = TYPES[type];
    if (!T) throw new Error('unknown type ' + type);
    const A = T.cartan, d = T.d, r = A.length, D = det(A), adj = adjugate(A);
    const idx = [...Array(r).keys()];
    const simple = idx.map((j) => idx.map((i) => A[i][j]));      // labels of α_j: the j-th column
    // det(A)·(ϖ_i, ϖ_j): from (ϖ_i, α_j) = δ_ij d_j and α_j = Σ_i a_ij ϖ_i, the
    // Gram matrix of the ϖ_i is D A^{-1}; times det A it is D adj(A), in integers.
    const F = idx.map((i) => idx.map((j) => d[i] * adj[i][j]));
    for (const i of idx) for (const j of idx) if (F[i][j] !== F[j][i]) throw new Error('not symmetric');
    const ip = (x, y) => { let s = 0; for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) s += x[i] * F[i][j] * y[j]; return s; };
    // labels → coordinates in the simple roots: c = A^{-1} x (exact when x is in the root lattice)
    const toSimple = (x) => mat(adj, x).map((v) => v / D);
    const fromSimple = (c) => idx.map((i) => dotp(A[i], c));

    // the simple reflections on labels, s_i μ = μ − μ_i α_i, and the Weyl group,
    // by length; each element with a reduced word (s_{w[0]} s_{w[1]} …, applied right to left)
    const S = idx.map((i) => idx.map((k) => idx.map((j) => (k === j ? 1 : 0) - (j === i ? simple[i][k] : 0))));
    const I = idx.map((i) => idx.map((j) => (i === j ? 1 : 0)));
    const W = [{ M: I, word: [] }], seen = new Set([I.flat().join(',')]);
    for (let at = 0; at < W.length; at++) {
      for (const i of idx) {
        const M = mul(S[i], W[at].M), k = M.flat().join(',');
        if (seen.has(k)) continue;
        seen.add(k);
        W.push({ M, word: [i].concat(W[at].word) });
      }
    }
    W.sort((u, v) => u.word.length - v.word.length || u.word.join('').localeCompare(v.word.join('')));
    W.forEach((w) => { w.sign = w.word.length % 2 ? -1 : 1; w.length = w.word.length; });

    // the roots: the images of the simple roots under W
    const roots = new Map();
    for (const w of W) for (const a of simple) { const x = mat(w.M, a); roots.set(key(x), x); }
    const positive = Array.from(roots.values()).map((labels) => ({ labels, c: toSimple(labels) }))
      .filter((x) => x.c.every((c) => c >= 0))
      .sort((u, v) => sum(u.c) - sum(v.c) || lexDesc(u.c, v.c));
    positive.forEach((x) => { x.norm = ip(x.labels, x.labels); x.height = sum(x.c); });
    const shortNorm = Math.min(...positive.map((x) => x.norm));
    positive.forEach((x) => { x.long = x.norm > shortNorm; });
    const all = positive.map((x) => x.labels).concat(positive.map((x) => scale(-1, x.labels)));
    // the highest root θ, its coordinates (the marks) and those of θ^∨ in the simple coroots (the comarks)
    const top = positive[positive.length - 1], theta = top.labels, marks = top.c;
    const comarks = marks.map((a, i) => a * d[i] * 2 * D / top.norm);
    if (!comarks.every(Number.isInteger)) throw new Error('comarks');

    // Coordinates in R^r, for drawing: vectors e_i for ϖ_i with the Gram matrix
    // F / det (short roots of length √2). In the plane, turned so that the
    // dominant chamber opens upwards, symmetric about the vertical axis; in
    // space, so that the chamber points up the third axis.
    let e = cholesky(F.map((row) => row.map((x) => x / D)));
    if (r === 2) {
      const u = e.map(unitv), bis = Math.atan2(u[0][1] + u[1][1], u[0][0] + u[1][0]), t = Math.PI / 2 - bis;
      const ct = Math.cos(t), st = Math.sin(t);
      e = e.map((p) => [ct * p[0] - st * p[1], st * p[0] + ct * p[1]]);
    } else if (r === 3) {
      const u = e.map(unitv), z = unitv(add(add(u[0], u[1]), u[2]));
      const x = unitv(sub(e[0], scale(dotp(e[0], z), z))), y = cross(z, x);
      e = e.map((p) => [dotp(p, x), dotp(p, y), dotp(p, z)]);
    }
    const pos = (x) => { const p = Array(r).fill(0); for (let i = 0; i < r; i++) for (let k = 0; k < r; k++) p[k] += x[i] * e[i][k]; return p; };
    // back from R^r to real labels (in rank one and two, for dragging)
    // back from R^r to real labels: p = Σ x_i e_i, so x = (Eᵀ)^{-1} p
    const Et = idx.map((k) => idx.map((i) => e[i][k])), Ed = det(Et), Ea = adjugate(Et);
    const fromPos = (p) => mat(Ea, p).map((v) => v / Ed);

    // In the plane: the cell of a weight in the root lattice, its Voronoi cell, whose
    // corners are the circumcentres of the triangles (0, u, v) for consecutive
    // shortest vectors u, v. The shortest vectors of the root lattice are the short roots.
    let cell = null;
    if (r === 2) {
      const shortest = Array.from(roots.values()).filter((x) => ip(x, x) === shortNorm).map(pos)
        .sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
      cell = shortest.map((u, i) => {
        const v = shortest[(i + 1) % shortest.length], Dn = 2 * (u[0] * v[1] - u[1] * v[0]);
        const uu = u[0] * u[0] + u[1] * u[1], vv = v[0] * v[0] + v[1] * v[1];
        return [(uu * v[1] - vv * u[1]) / Dn, (vv * u[0] - uu * v[0]) / Dn];
      });
    }

    const rho = ones(r);
    const alg = {
      type, rank: r, cartan: A, d, det: D, F, ip, toSimple, fromSimple, simple, W, positive, roots: all,
      order: W.length, N: positive.length, rho, theta, marks, comarks,
      h: 1 + sum(marks), hv: 1 + sum(comarks),      // the Coxeter and dual Coxeter numbers
      reflect: (i, x) => mat(S[i], x),
      act: (w, x) => mat(w.M, x),
      dot: (w, x) => sub(mat(w.M, add(x, rho)), rho),     // w·x = w(x + ρ) − ρ
      coroot: (x, b) => 2 * ip(x, b.labels) / b.norm,     // <x, β^∨>
      pos, fromPos, e, cell,
      longest: W[W.length - 1],
    };
    cache[type] = alg;
    return alg;
  }

  // The dominant weight in the W-orbit of x, and the simple reflections that
  // take x there, in the order they are applied.
  function toDominant(alg, x) {
    const steps = [];
    let y = x.slice();
    for (let guard = 0; guard < 256; guard++) {
      const i = y.findIndex((c) => c < 0);
      if (i < 0) return { dom: y, steps };
      y = alg.reflect(i, y);
      steps.push(i);
    }
    throw new Error('toDominant did not stop');
  }

  // the W-orbit of a weight
  function orbit(alg, x) {
    const out = [x], seen = new Set([key(x)]);
    for (let at = 0; at < out.length; at++) {
      for (let i = 0; i < alg.rank; i++) {
        const y = alg.reflect(i, out[at]), k = key(y);
        if (!seen.has(k)) { seen.add(k); out.push(y); }
      }
    }
    return out;
  }

  // λ − μ = Σ c_j α_j with all c_j ≥ 0 integers
  function below(alg, mu, lam) {
    const c = alg.toSimple(sub(lam, mu));
    return c.every((x) => Number.isInteger(x) && x >= 0);
  }

  // the edges of the polytope conv(Wλ), λ dominant: the segments [wλ, w s_i λ] with λ_i ≠ 0
  function hullEdges(alg, lam) {
    const out = [], seen = new Set();
    for (const w of alg.W) {
      const p = alg.act(w, lam);
      for (let i = 0; i < alg.rank; i++) {
        if (!lam[i]) continue;
        const q = alg.act(w, alg.reflect(i, lam)), a = key(p), b = key(q), k = a < b ? a + '|' + b : b + '|' + a;
        if (!seen.has(k)) { seen.add(k); out.push([p, q]); }
      }
    }
    return out;
  }

  // Weyl's dimension formula: dim V(λ) = Π_{β>0} <λ+ρ, β^∨> / <ρ, β^∨>.
  function dimension(alg, lam) {
    const lr = add(lam, alg.rho);
    const factors = alg.positive.map((b) => [alg.coroot(lr, b), alg.coroot(alg.rho, b)]);
    let num = 1n, den = 1n;
    for (const [p, q] of factors) { num *= BigInt(p); den *= BigInt(q); }
    if (num % den !== 0n) throw new Error('dimension not integral');
    return { dim: Number(num / den), factors };
  }

  // calls f(c) for every c with 0 ≤ c_i ≤ top_i
  function boxes(top, f) {
    const c = Array(top.length).fill(0);
    const rec = (i) => {
      if (i === top.length) { f(c.slice()); return; }
      for (let t = 0; t <= top[i]; t++) { c[i] = t; rec(i + 1); }
    };
    rec(0);
  }

  // The weights of V(λ) and their multiplicities. The dominant ones are the
  // dominant μ ≤ λ (Humphreys, §21.3); their multiplicities come from
  // Freudenthal's formula (Humphreys, §22.3),
  //   ((λ+ρ, λ+ρ) − (μ+ρ, μ+ρ)) m(μ) = 2 Σ_{β>0} Σ_{k≥1} (μ + kβ, β) m(μ + kβ),
  // taken in order of depth, with m(wμ) = m(μ) for the terms off the dominant
  // chamber. Every other weight is in the orbit of a dominant one.
  const charCache = new Map();
  function character(alg, lam) {
    const ck = alg.type + ':' + key(lam);
    if (charCache.has(ck)) return charCache.get(ck);
    if (lam.length !== alg.rank || !lam.every((x) => Number.isInteger(x) && x >= 0)) throw new Error('not a dominant weight: ' + lam);
    const top = alg.toSimple(lam).map((t) => Math.floor(t + 1e-9)), dominant = [];
    boxes(top, (c) => {
      const mu = sub(lam, alg.fromSimple(c));
      if (mu.every((x) => x >= 0)) dominant.push({ mu, c, depth: sum(c) });
    });
    dominant.sort((u, v) => u.depth - v.depth || lexDesc(u.c, v.c));
    const mult = new Map(), ip = alg.ip, lr = add(lam, alg.rho), top2 = ip(lam, lam), lrr = ip(lr, lr);
    const multOf = (x) => mult.get(key(toDominant(alg, x).dom)) || 0;
    for (const D of dominant) {
      if (D.depth === 0) { mult.set(key(D.mu), 1); D.mult = 1; continue; }
      let s = 0;
      for (const b of alg.positive) {
        for (let k = 1; ; k++) {
          const x = add(D.mu, scale(k, b.labels));
          if (ip(x, x) > top2) break; // every weight of V(λ) is no longer than λ, and μ is dominant: the norm only grows
          const m = multOf(x);
          if (m) s += ip(x, b.labels) * m;
        }
      }
      const mr = add(D.mu, alg.rho), den = lrr - ip(mr, mr);
      if (den <= 0 || (2 * s) % den !== 0) throw new Error('Freudenthal: not integral at ' + key(D.mu));
      D.mult = 2 * s / den;
      mult.set(key(D.mu), D.mult);
    }
    const weights = [], byKey = new Map();
    for (const D of dominant) {
      D.orbit = orbit(alg, D.mu);
      for (const mu of D.orbit) {
        const w = { mu, mult: D.mult, dom: D.mu, key: key(mu) };
        weights.push(w);
        byKey.set(w.key, w);
      }
    }
    const { dim, factors } = dimension(alg, lam);
    const total = weights.reduce((s, w) => s + w.mult, 0);
    if (total !== dim) throw new Error('multiplicities add up to ' + total + ', not ' + dim);
    const out = { lam: lam.slice(), dominant, weights, byKey, dim, factors, maxMult: Math.max(...weights.map((w) => w.mult)) };
    if (charCache.size > 400) charCache.clear();
    charCache.set(ck, out);
    return out;
  }
  const multiplicity = (alg, lam, mu) => { const w = character(alg, lam).byKey.get(key(mu)); return w ? w.mult : 0; };

  // V(λ) ⊗ V(ν) by the Brauer–Klimyk rule (Humphreys, Exercise 24.9): each weight
  // ν' of V(ν), of multiplicity m, gives ε(w) m copies of V(w·(λ+ν')) where
  // w·(λ+ν') is dominant, and nothing when λ + ν' + ρ lies on a mirror.
  function tensor(alg, lam, nu) {
    const ch = character(alg, nu), total = new Map(), moves = [];
    for (const wt of ch.weights) {
      const at = add(lam, wt.mu), x = add(at, alg.rho);
      const wall = alg.positive.find((b) => alg.ip(x, b.labels) === 0);
      if (wall) { moves.push({ from: wt.mu, at, mult: wt.mult, to: null, sign: 0, wall }); continue; }
      const { dom, steps } = toDominant(alg, x), to = sub(dom, alg.rho), sign = steps.length % 2 ? -1 : 1;
      moves.push({ from: wt.mu, at, mult: wt.mult, to, sign, steps });
      total.set(key(to), (total.get(key(to)) || 0) + sign * wt.mult);
    }
    const parts = [];
    for (const [k, n] of total) {
      if (!n) continue;
      if (n < 0) throw new Error('Brauer–Klimyk: negative multiplicity at ' + k);
      const kappa = k.split(',').map(Number);
      parts.push({ kappa, n, dim: dimension(alg, kappa).dim });
    }
    const hi = add(lam, nu);
    parts.sort((u, v) => {
      const cu = alg.toSimple(sub(hi, u.kappa)), cv = alg.toSimple(sub(hi, v.kappa));
      return sum(cu) - sum(cv) || lexDesc(cu, cv);
    });
    const dim = dimension(alg, lam).dim * ch.dim;
    if (parts.reduce((s, p) => s + p.n * p.dim, 0) !== dim) throw new Error('Brauer–Klimyk: dimensions do not add up');
    return { lam: lam.slice(), nu: nu.slice(), parts, moves, dim };
  }

  // Type A_r only: V(λ) is the representation of shape (λ_1 + … + λ_r, …, λ_r) in
  // the letters 1, …, r+1, and the weight of a tableau with n_k entries equal to k
  // is (n_1 − n_2, …, n_r − n_{r+1}). The semistandard tableaux of that shape and
  // weight, each as its rows (at most `limit` of them).
  function tableaux(lam, mu, limit) {
    const r = lam.length, n = r + 1, cap = limit || Infinity;
    const shape = lam.map((_, i) => sum(lam.slice(i)));
    let t = sum(shape);
    for (let j = 0; j < r; j++) t -= (j + 1) * mu[j];
    if (t < 0 || t % n) return [];
    const content = Array(n);
    content[n - 1] = t / n;
    for (let k = n - 2; k >= 0; k--) content[k] = content[k + 1] + mu[k];
    if (content.some((c) => c < 0)) return [];
    // the entries k fill a horizontal strip: shapes ∅ = ν⁰ ⊂ ν¹ ⊂ … ⊂ νⁿ = shape,
    // interlacing, with |ν^k| − |ν^{k−1}| = n_k
    const out = [], chain = [Array(r).fill(0)];
    const rec = (k) => {
      if (out.length >= cap) return;
      const prev = chain[k - 1];
      if (k > n) {
        if (prev.every((x, i) => x === shape[i])) {
          const rows = shape.map(() => []);
          for (let j = 1; j < chain.length; j++) for (let i = 0; i < r; i++) for (let c = chain[j - 1][i]; c < chain[j][i]; c++) rows[i].push(j);
          out.push(rows.filter((row) => row.length));
        }
        return;
      }
      // choose ν^k row by row: prev_i ≤ ν_i ≤ min(shape_i, prev_{i−1}), at most k nonzero rows
      const next = prev.slice();
      const fill = (i, left) => {
        if (i === r) { if (left === 0) { chain.push(next.slice()); rec(k + 1); chain.pop(); } return; }
        const hi = Math.min(shape[i], i ? prev[i - 1] : Infinity, i < k ? Infinity : prev[i]);
        for (let v = prev[i]; v <= hi && v - prev[i] <= left; v++) { next[i] = v; fill(i + 1, left - (v - prev[i])); }
        next[i] = prev[i];
      };
      fill(0, content[k - 1]);
    };
    rec(1);
    return out;
  }

  /* ---------- affine algebras ---------- */

  // The untwisted affine algebra over a finite type, with the normalized form
  // ( | ): (θ|θ) = 2, (δ|δ) = (Λ_0|Λ_0) = 0, (Λ_0|δ) = 1. On finite parts
  // Z·(x|y) = ip(x, y), with Z = ip(θ, θ)/2 an integer.
  const AFFINE = { 'A1-1': 'A1', 'A2-1': 'A2', 'C2-1': 'B2', 'G2-1': 'G2' };
  const affCache = {};
  function affine(type) {
    if (affCache[type]) return affCache[type];
    const fin = AFFINE[type];
    if (!fin) throw new Error('unknown affine type ' + type);
    const g = algebra(fin), r = g.rank, Z = g.ip(g.theta, g.theta) / 2;
    // the extended Cartan matrix, node 0 first: a_00 = 2, a_0j = −<θ^∨, α_j>, a_j0 = −<α_j^∨, θ>
    const n = r + 1, cartan = [...Array(n)].map(() => Array(n).fill(0));
    cartan[0][0] = 2;
    for (let j = 0; j < r; j++) {
      cartan[0][j + 1] = -2 * g.ip(g.theta, g.simple[j]) / g.ip(g.theta, g.theta);
      cartan[j + 1][0] = -g.theta[j];
      for (let i = 0; i < r; i++) cartan[i + 1][j + 1] = g.cartan[i][j];
    }
    const aff = {
      type, finite: fin, g, rank: r, Z, cartan,
      marks: [1].concat(g.marks), comarks: [1].concat(g.comarks), h: g.h, hv: g.hv,
      level: (labels) => labels[0] + dotp(g.comarks, labels.slice(1)),
      // the dominant weight in the orbit of (μ, n) under the affine Weyl group, at level k:
      // the finite reflections, and s_0, which takes (μ, n) to (μ + cθ, n + c), c = k − <μ, θ^∨>
      toDominant(mu, nn, k) {
        let x = mu.slice(), m = nn;
        for (let guard = 0; guard < 4096; guard++) {
          const i = x.findIndex((c) => c < 0);
          if (i >= 0) { x = g.reflect(i, x); continue; }
          const c = k - dotp(g.comarks, x);
          if (c >= 0) return { mu: x, n: m };
          x = add(x, scale(c, g.theta));
          m += c;
        }
        throw new Error('affine toDominant did not stop');
      },
    };
    affCache[type] = aff;
    return aff;
  }

  // the points x of the class of λ (mod the root lattice) with ip(x, x) ≤ B
  function ball(g, lam, B) {
    const r = g.rank, LL = g.ip(lam, lam);
    // the smallest eigenvalue of the form on simple-root coordinates bounds the coordinates
    const Gs = g.simple.map((a) => g.simple.map((b) => g.ip(a, b)));
    const emin = r === 1 ? Gs[0][0] : (Gs[0][0] + Gs[1][1]) / 2 - Math.sqrt(((Gs[0][0] - Gs[1][1]) / 2) ** 2 + Gs[0][1] ** 2);
    const C = Math.ceil((Math.sqrt(LL) + Math.sqrt(Math.max(B, 0))) / Math.sqrt(emin)) + 1, out = [];
    const c = Array(r).fill(-C);
    const rec = (i) => {
      if (i === r) { const x = sub(lam, g.fromSimple(c)); if (g.ip(x, x) <= B) out.push(x); return; }
      for (let t = -C; t <= C; t++) { c[i] = t; rec(i + 1); }
    };
    rec(0);
    return out;
  }

  // The weights of L(Λ), Λ = Σ a_i Λ_i of level k = Σ a_i^∨ a_i, down to depth N.
  // As for finite types, every weight is in the orbit of a dominant one, and
  // the dominant weights are the dominant μ ≤ Λ (Kac, Chapter 11): here the
  // (μ, n) with μ in the alcove, <μ, α_i^∨> ≥ 0 and <μ, θ^∨> ≤ k, and
  // Λ − (kΛ_0 + μ − nδ) in the positive root cone. Their multiplicities come
  // from Freudenthal's formula, which holds for affine algebras too,
  //   (|Λ+ρ|² − |μ+ρ|²) m(μ) = 2 Σ_{α>0} mult(α) Σ_{j≥1} (μ + jα | α) m(μ + jα),
  // over the real roots β + mδ (mult 1) and the imaginary roots mδ (mult r),
  // in order of the height of Λ − μ. With ρ = h^∨Λ_0 + ρ̄ the left side is
  // |λ+ρ̄|² − |μ+ρ̄|² + 2(k + h^∨)n. Every weight satisfies |μ|² ≤ |λ|² + 2kn,
  // that is |kΛ_0 + μ − nδ|² ≤ |Λ|² (for a dominant one, |Λ|² − |μ|² is the
  // pairing of Λ − μ ≥ 0 with the dominant Λ + μ): the weights lie in a paraboloid.
  const affCharCache = new Map();
  function affineCharacter(aff, labels, N) {
    const ck = aff.type + ':' + key(labels) + ':' + N;
    if (affCharCache.has(ck)) return affCharCache.get(ck);
    const g = aff.g, r = g.rank, ip = g.ip, Z = aff.Z, k = aff.level(labels), lam = labels.slice(1);
    if (labels.length !== r + 1 || !labels.every((x) => Number.isInteger(x) && x >= 0)) throw new Error('not a dominant weight: ' + labels);
    const LL = ip(lam, lam), lr = add(lam, g.rho), LRR = ip(lr, lr);
    const bound = (n) => LL + 2 * Z * k * n;          // Z|μ|² ≤ Z|λ|² + 2Zkn
    const wkey = (mu, n) => key(mu) + '|' + n;
    // the alcove points in the class of λ, with the least depth at which each is a weight
    const alcove = [];
    const cap = r === 1 ? [k] : [k, k];
    boxes(cap, (mu) => {
      if (dotp(g.comarks, mu) > k) return;
      const c = g.toSimple(sub(lam, mu));
      if (!c.every((x) => Math.abs(x - Math.round(x)) < 1e-9)) return;
      const ci = c.map(Math.round);
      const n0 = Math.max(0, ...ci.map((x, i) => Math.ceil(-x / g.marks[i])));
      alcove.push({ mu, c: ci, n0 });
    });
    const dominant = [];
    for (const P of alcove) for (let n = P.n0; n <= N; n++) dominant.push({ mu: P.mu, n, ht: n * aff.h + sum(P.c) });
    if (k === 0) dominant.length = 1;  // level 0: the trivial representation
    dominant.sort((u, v) => u.ht - v.ht || u.n - v.n);
    const mult = new Map();
    const M = (x, n) => {
      if (n < 0 || ip(x, x) > bound(n)) return 0;
      const D = aff.toDominant(x, n, k);
      return mult.get(wkey(D.mu, D.n)) || 0;
    };
    for (const D of dominant) {
      if (D.ht === 0) { D.mult = 1; mult.set(wkey(D.mu, D.n), 1); continue; }
      const mu = D.mu, n = D.n;
      let s = 0;
      // the finite positive roots: μ is dominant, so the norm of μ + jβ only grows
      for (const b of g.positive) {
        for (let j = 1; ; j++) {
          const x = add(mu, scale(j, b.labels));
          if (ip(x, x) > bound(n)) break;
          const m = M(x, n);
          if (m) s += ip(x, b.labels) * m;
        }
      }
      // the real roots β + mδ, m ≥ 1, β any finite root
      for (let m = 1; m <= n; m++) {
        for (const b of g.roots) {
          for (let j = 1; n - j * m >= 0; j++) {
            const x = add(mu, scale(j, b)), mm = M(x, n - j * m);
            if (mm) s += (ip(x, b) + Z * m * k) * mm;
          }
        }
        // the imaginary roots mδ, of multiplicity r
        for (let j = 1; n - j * m >= 0; j++) {
          const mm = M(mu, n - j * m);
          if (mm) s += r * Z * m * k * mm;
        }
      }
      const mr = add(mu, g.rho), den = LRR - ip(mr, mr) + 2 * Z * (k + aff.hv) * n;
      if (den <= 0 || (2 * s) % den !== 0 || s <= 0) throw new Error('affine Freudenthal: not a positive integer at ' + wkey(mu, n));
      D.mult = 2 * s / den;
      mult.set(wkey(mu, n), D.mult);
    }
    // all the weights down to depth N
    const weights = [], byKey = new Map();
    for (let n = 0; n <= N; n++) {
      for (const mu of ball(g, lam, bound(n))) {
        const D = aff.toDominant(mu, n, k), m = mult.get(wkey(D.mu, D.n));
        if (!m) continue;
        const w = { mu, n, mult: m, key: wkey(mu, n), dom: D };
        weights.push(w);
        byKey.set(w.key, w);
      }
    }
    // the maximal dominant weights, one for each alcove point, and the multiplicities down their strings
    const strings = alcove.filter((P) => P.n0 <= N).map((P) => ({
      mu: P.mu, n: P.n0, mults: [...Array(N - P.n0 + 1).keys()].map((j) => mult.get(wkey(P.mu, P.n0 + j)) || 0),
    })).sort((u, v) => u.n - v.n || lexDesc(u.mu, v.mu));
    const out = { labels: labels.slice(), k, lam, N, dominant, weights, byKey, strings, maxMult: Math.max(...weights.map((w) => w.mult)) };
    if (affCharCache.size > 200) affCharCache.clear();
    affCharCache.set(ck, out);
    return out;
  }

  /* ---------- Verma modules and their simple quotients ---------- */

  const TOL = 1e-7;
  const isInt = (x) => Math.abs(x - Math.round(x)) < TOL;
  const sameKey = (v) => v.map((x) => Math.round(x * 1e6) / 1e6).join(',');

  // Kostant's partition function P(c): the number of ways of writing Σ c_j α_j
  // as a sum of positive roots, tabulated for 0 ≤ c_j ≤ D.
  const partCache = new Map();
  function partitions(alg, D) {
    const ck = alg.type + ':' + D;
    if (partCache.has(ck)) return partCache.get(ck);
    const r = alg.rank, side = D + 1, P = new Float64Array(side ** r);
    const idx = (c) => c.reduce((s, x) => s * side + x, 0);
    P[0] = 1;
    // in lexicographic order c − β comes before c, so each root can be used again
    for (const b of alg.positive) boxes(Array(r).fill(D), (c) => { const d = sub(c, b.c); if (d.every((x) => x >= 0)) P[idx(c)] += P[idx(d)]; });
    const f = (c) => (c.every((x) => x >= 0 && x <= D) ? P[idx(c)] : 0);
    if (partCache.size > 40) partCache.clear();
    partCache.set(ck, f);
    return f;
  }

  // The weights λ − β of the Verma module M(λ), λ any real weight, for
  // β = Σ c_j α_j of height Σ c_j ≤ D; the multiplicity of λ − β is P(β).
  function verma(alg, lam, D) {
    const P = partitions(alg, D), points = [];
    boxes(Array(alg.rank).fill(D), (c) => {
      const h = sum(c);
      if (h <= D) points.push({ c, depth: h, mu: sub(lam, alg.fromSimple(c)), mult: P(c), key: 'b' + key(c) });
    });
    return { lam: lam.slice(), D, points, terms: [{ apex: lam.slice(), coef: 1, len: 0 }] };
  }

  // the multiplicities of Σ coef·ch M(apex) at the weights λ − β, height(β) ≤ D (each apex ≤ λ)
  function sumOfVermas(alg, lam, D, terms) {
    const P = partitions(alg, D), points = [];
    const shift = terms.map((t) => alg.toSimple(sub(lam, t.apex)));     // λ − apex, in the simple roots
    boxes(Array(alg.rank).fill(D), (c) => {
      const h = sum(c);
      if (h > D) return;
      let m = 0;
      terms.forEach((t, i) => {
        const d = sub(c, shift[i]);
        if (d.every((x) => isInt(x) && x > -TOL)) m += t.coef * P(d.map(Math.round));
      });
      if (m < 0) throw new Error('a negative multiplicity at ' + c);
      if (m) points.push({ c, depth: h, mu: sub(lam, alg.fromSimple(c)), mult: m, key: 'b' + key(c) });
    });
    return points;
  }

  // The simple quotient L(λ) of M(λ), for λ any real weight, in rank one and two.
  // The positive roots α with <λ+ρ, α^∨> an integer form the positive roots of a
  // root system Φ_λ; its Weyl group W_λ, the integral Weyl group, acts on λ by
  // the dot action w·λ = w(λ+ρ) − ρ. Let λ_0 be the antidominant weight of the
  // orbit (<λ_0+ρ, α^∨> ≤ 0 for α in Φ_λ⁺) and x the shortest element of W_λ with
  // x·λ_0 = λ. Kazhdan–Lusztig theory for the Coxeter group W_λ, with translation
  // to the walls when λ_0 is singular (Humphreys, Category O, Ch. 7–8), gives
  //   ch L(λ) = Σ_{y ≤ x} (−1)^{ℓ(x)−ℓ(y)} P_{y,x}(1) ch M(y·λ_0).
  // In rank two W_λ is dihedral (or smaller): every P_{y,x} is 1, and y ≤ x in
  // the Bruhat order when y = x or ℓ(y) < ℓ(x).
  function simpleQuotient(alg, lam, D) {
    if (alg.rank > 2) throw new Error('simpleQuotient: rank one and two only');
    const r = alg.rank, rho = alg.rho;
    const val = (x, b) => alg.coroot(add(x, rho), b);
    const integral = alg.positive.filter((b) => isInt(val(lam, b)));
    // the simple roots of Φ_λ⁺: the two outermost, seen from ρ
    let simple = integral;
    if (integral.length > 2) {
      const pr = alg.pos(rho), ang = (b) => { const p = alg.pos(b.labels); return Math.atan2(pr[0] * p[1] - pr[1] * p[0], pr[0] * p[0] + pr[1] * p[1]); };
      const s = integral.slice().sort((u, v) => ang(u) - ang(v));
      simple = [s[0], s[s.length - 1]];
    }
    const reflect = (b, x) => sub(x, scale(val(x, b), b.labels));         // s_β·x
    let lam0 = lam.slice();
    for (let guard = 0; guard < 64; guard++) {
      const b = simple.find((s) => val(lam0, s) > TOL);
      if (!b) break;
      lam0 = reflect(b, lam0);
    }
    // W_λ, by length, each element as the matrix of its linear action on labels
    const I = [...Array(r).keys()].map((i) => [...Array(r).keys()].map((j) => (i === j ? 1 : 0)));
    const refMat = (b) => I.map((row, i) => row.map((x, j) => x - b.labels[i] * alg.coroot(I[j], b)));
    const W = [{ M: I, len: 0 }], seen = new Set([I.flat().join(',')]);
    for (let at = 0; at < W.length; at++) {
      for (const b of simple) {
        const M = mul(refMat(b), W[at].M), k = M.flat().map(Math.round).join(',');
        if (!seen.has(k)) { seen.add(k); W.push({ M, len: W[at].len + 1 }); }
      }
    }
    const dotW = (w, x) => sub(mat(w.M, add(x, rho)), rho);
    const x = W.find((w) => sameKey(dotW(w, lam0)) === sameKey(lam));
    const byApex = new Map();
    for (const y of W) {
      if (y !== x && y.len >= x.len) continue;
      const apex = dotW(y, lam0), k = sameKey(apex), coef = (x.len - y.len) % 2 ? -1 : 1;
      const t = byApex.get(k) || { apex, coef: 0, len: y.len };
      t.coef += coef;
      byApex.set(k, t);
    }
    const terms = [...byApex.values()].filter((t) => t.coef).sort((u, v) => v.len - u.len);
    return { lam: lam.slice(), D, lam0, integral, simple, order: W.length, length: x.len, terms, points: sumOfVermas(alg, lam, D, terms) };
  }

  /* ---------- affine algebras: Verma modules, and L(Λ) away from the integrable case ---------- */

  // The affine partition function P̂(β), β = n_0 α_0 + Σ n_i α_i (n_0 the depth):
  // the ways of writing β as a sum of positive roots, the real roots β̄ + mδ
  // once each and the imaginary roots mδ r times. For n_0 ≤ N, n_i ≤ N a_i + H.
  const affPartCache = new Map();
  function affinePartitions(aff, N, H) {
    const ck = aff.type + ':' + N + ':' + H;
    if (affPartCache.has(ck)) return affPartCache.get(ck);
    const g = aff.g, r = g.rank, marks = g.marks;
    const top = [N].concat(marks.map((a) => N * a + H)), dims = top.map((x) => x + 1);
    const idx = (v) => v.reduce((s, x, i) => s * dims[i] + x, 0);
    const T = new Float64Array(dims.reduce((s, x) => s * x, 1));
    T[0] = 1;
    const roots = [];
    for (let m = 0; m <= N; m++) {
      for (const b of g.roots) {
        const c = g.toSimple(b).map(Math.round);
        if (m === 0 && c.some((x) => x < 0)) continue;
        roots.push([m].concat(c.map((x, i) => x + m * marks[i])));
      }
      if (m >= 1) for (let t = 0; t < r; t++) roots.push([m].concat(marks.map((a) => m * a)));
    }
    for (const v of roots) boxes(top, (c) => { const d = sub(c, v); if (d.every((x) => x >= 0)) T[idx(c)] += T[idx(d)]; });
    const f = (n0, nb) => (n0 >= 0 && n0 <= N && nb.every((x, i) => x >= 0 && x <= top[i + 1]) ? T[idx([n0].concat(nb))] : 0);
    if (affPartCache.size > 40) affPartCache.clear();
    affPartCache.set(ck, f);
    return f;
  }

  // The weights (μ, n) of Σ coef·ch M(apex), apex = (finite part, depth below Λ), for
  // Λ = kΛ_0 + λ: those of depth n ≤ N whose finite part is λ + nθ − Σ n_i α_i with
  // n_i ≤ n a_i + H (a window onto the infinitely many of each depth).
  function affineSum(aff, lam, N, H, terms) {
    const g = aff.g, P = affinePartitions(aff, N, H), points = [];
    for (let n = 0; n <= N; n++) {
      boxes(g.marks.map((a) => n * a + H), (nb) => {
        const mu = add(lam, sub(scale(n, g.theta), g.fromSimple(nb)));
        let m = 0;
        for (const t of terms) {
          // β = apex − (μ, n): n_0 = n − depth(apex), and Σ n_i α_i − n_0 θ = apex − μ in the finite part
          const n0 = n - t.apex[1];
          if (!isInt(n0) || n0 < -TOL) continue;
          const c = add(g.toSimple(sub(t.apex[0], mu)), scale(Math.round(n0), g.marks));
          if (c.every((x) => isInt(x) && x > -TOL)) m += t.coef * P(Math.round(n0), c.map(Math.round));
        }
        if (m < 0) throw new Error('a negative multiplicity');
        if (m) points.push({ mu, n, nb, mult: m, key: 'b' + n + ';' + key(nb) });
      });
    }
    return points;
  }

  // Kac–Kazhdan: M(Λ) is simple unless k = −h^∨, or <Λ+ρ, α^∨> is a positive integer
  // for a positive real root α = β + jδ; its singular vector then lies at depth j<Λ+ρ, α^∨>.
  // The roots of the latter kind whose singular vectors lie within depth N.
  function affineSpecial(aff, k, lam, N) {
    const g = aff.g, out = [], lr = add(lam, g.rho);
    for (let j = 0; j <= N; j++) {
      for (const b of j ? g.roots : g.positive.map((x) => x.labels)) {
        const v = g.coroot(lr, { labels: b, norm: g.ip(b, b) }) + j * (k + aff.hv) * 2 * aff.Z / g.ip(b, b);
        if (isInt(v) && Math.round(v) > 0 && j * Math.round(v) <= N) out.push({ root: b, j, v: Math.round(v) });
      }
    }
    return out;
  }

  // Affine sl2, Λ = kΛ_0 + mϖ_1 with k ≠ −2: L(Λ) by Kazhdan–Lusztig theory. A weight
  // is written (x, d), x its finite label and d its depth below Λ. The integral
  // real roots ±α_1 + jδ (<Λ+ρ, α^∨> = ±(m+1) + j(k+2) an integer) give the
  // integral Weyl group W_Λ: none, one reflection, or the infinite dihedral
  // group on the two simple ones, whose Kazhdan–Lusztig polynomials and their
  // inverses are all 1. At positive level k + 2 > 0 let Λ_0 be the dominant
  // weight of the orbit and w the longest element with w·Λ_0 = Λ; then
  //   ch L(Λ) = Σ_{y ≥ w} (−1)^{ℓ(y)−ℓ(w)} ch M(y·Λ_0);
  // at negative level, Λ_0 antidominant, w the shortest, and the sum over y ≤ w.
  // (Kashiwara–Tanisaki.) Returns null at the critical level.
  function sl2Affine(k, m, N, H) {
    const aff = affine('A1-1'), K2 = k + 2;
    if (Math.abs(K2) < TOL) return null;
    const val = (x, b) => b[0] * (x + 1) + b[1] * K2;
    const act = (p, b) => { const t = val(p[0], b); return [p[0] - 2 * b[0] * t, p[1] + b[1] * t]; };
    let bp = null, bm = null;
    for (let j = 0; j <= 400 && !bp; j++) if (isInt(val(m, [1, j]))) bp = [1, j];
    for (let j = 1; j <= 400 && !bm; j++) if (isInt(val(m, [-1, j]))) bm = [-1, j];
    const gens = [bp, bm].filter(Boolean), top = [m, 0];
    let raw;
    if (gens.length < 2) {
      const b = gens[0];
      raw = b && val(m, b) > TOL ? [[top, 1, 1], [act(top, b), -1, 0]] : [[top, 1, 0]];
    } else {
      const apply = (y, p) => { for (let i = y.len - 1; i >= 0; i--) p = act(p, gens[(y.first + i) % 2]); return p; };
      const up = K2 > 0;
      let p = top.slice();
      const word = [];
      for (let guard = 0; guard < 100000; guard++) {
        const i = [0, 1].find((t) => (up ? val(p[0], gens[t]) < -TOL : val(p[0], gens[t]) > TOL));
        if (i === undefined) break;
        p = act(p, gens[i]);
        word.push(i);
      }
      const lam0 = p;
      let w = { first: word.length ? word[0] : 0, len: word.length };
      const fix = [0, 1].find((t) => Math.abs(val(lam0[0], gens[t])) < TOL);
      if (fix !== undefined) {
        const last = w.len ? (w.first + w.len - 1) % 2 : -1;
        const ws = last === fix ? { first: w.first, len: w.len - 1 } : { first: w.len ? w.first : fix, len: w.len + 1 };
        if (up ? ws.len > w.len : ws.len < w.len) w = ws;
      }
      raw = [[apply(w, lam0), 1, w.len]];
      if (up) {
        for (let len = w.len + 1; ; len++) {
          let near = false;
          for (const f of [0, 1]) {
            const q = apply({ first: f, len }, lam0);
            if (q[1] <= N + TOL) near = true;
            raw.push([q, (len - w.len) % 2 ? -1 : 1, len]);
          }
          if (!near) break;
        }
      } else {
        for (let len = 0; len < w.len; len++) for (const f of len ? [0, 1] : [0]) raw.push([apply({ first: f, len }, lam0), (w.len - len) % 2 ? -1 : 1, len]);
      }
    }
    const byApex = new Map();
    for (const [apex, coef, len] of raw) {
      const kk = sameKey(apex), t = byApex.get(kk) || { apex: [[apex[0]], apex[1]], coef: 0, len };
      t.coef += coef;
      byApex.set(kk, t);
    }
    const terms = [...byApex.values()].filter((t) => t.coef && t.apex[1] <= N + TOL).sort((u, v) => u.apex[1] - v.apex[1] || u.len - v.len);
    return { k, lam: [m], N, H, gens, terms, points: affineSum(aff, [m], N, H, terms) };
  }

  // the Verma module M(Λ) of an affine algebra, Λ = kΛ_0 + λ, down to depth N
  function affineVerma(aff, k, lam, N, H) {
    const terms = [{ apex: [lam.slice(), 0], coef: 1, len: 0 }];
    return { k, lam: lam.slice(), N, H, terms, points: affineSum(aff, lam, N, H, terms) };
  }

  /* ---------- L(λ) from the Chevalley generators ---------- */

  // The simple module L(λ) of a Kac–Moody algebra with symmetrizable Cartan
  // matrix A, for rational labels λ(h_i) = p_i/q_i, built from its definition as
  // M(λ) modulo the largest proper submodule. L(λ)_{λ−β} is spanned by the f_i x,
  // x in L(λ)_{λ−β+α_i}, and a vector below the top is zero in L(λ) exactly when
  // every e_j kills it, where e_j f_i = f_i e_j + δ_ij h_i and h_i acts on the
  // weight λ − γ by λ(h_i) − Σ_k a_ik γ_k. So each weight space is the span of
  // the images (e_1 x, …, e_n x) of the f_i x, by Gaussian elimination, in order
  // of height. Exact, modulo a prime below 2^25 (products stay below 2^53).
  // A job: run(until) works until that time (performance.now()) and returns
  // true when every β is done; dims maps 'β' to dim L(λ)_{λ−β}.
  const PRIME = 33554393;
  const modp = (a) => ((a % PRIME) + PRIME) % PRIME;
  const mulp = (a, b) => (a * b) % PRIME;
  function invp(a) {
    let t = 0, nt = 1, r = PRIME, nr = modp(a);
    while (nr) { const q = Math.floor(r / nr); [t, nt] = [nt, t - q * nt]; [r, nr] = [nr, r - q * nr]; }
    return modp(t);
  }
  // x as p/q with q ≤ 2000, or null
  function toFraction(x) {
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, y = x;
    for (let i = 0; i < 30; i++) {
      const a = Math.floor(y), h = a * h1 + h0, kk = a * k1 + k0;
      if (kk > 2000) break;
      [h0, h1, k0, k1] = [h1, h, k1, kk];
      if (Math.abs(x - h1 / k1) < 1e-9) return [h1, k1];
      if (Math.abs(y - a) < 1e-12) break;
      y = 1 / (y - a);
    }
    return null;
  }
  function generatorJob(cartan, labels, betas) {
    const n = cartan.length, l = labels.map(([p, q]) => mulp(modp(p), invp(q))), kb = (b) => b.join(',');
    const order = betas.slice().sort((u, v) => sum(u) - sum(v)), data = new Map(), dims = new Map();
    const hval = (i, g) => modp(l[i] - g.reduce((s, x, k) => s + cartan[i][k] * x, 0));
    function build(beta) {
      if (beta.every((x) => !x)) { data.set(kb(beta), { dim: 1, E: [], F: [] }); dims.set(kb(beta), 1); return; }
      const at = (d) => { const b = beta.map((x, k) => x - (d[k] || 0)); return b.some((x) => x < 0) ? null : data.get(kb(b)); };
      const unit = (i, j) => { const d = Array(n).fill(0); d[i]++; if (j !== undefined) d[j]++; return d; };
      const js = [...Array(n).keys()].filter((j) => beta[j] > 0);
      const cands = [];
      for (const i of js) {
        const Di = at(unit(i));
        for (let t = 0; t < Di.dim; t++) {
          const img = [];
          for (const j of js) {
            const Dj = at(unit(j)), v = new Array(Dj.dim).fill(0), Dij = at(unit(i, j));
            // f_i e_j x: e_j x lies in L(λ)_{λ−β+α_i+α_j}, then f_i takes it into L(λ)_{λ−β+α_j}
            if (Dij && Di.E[j]) {
              const ej = Di.E[j][t], Fi = Dj.F[i];
              for (let a = 0; a < ej.length; a++) if (ej[a]) { const row = Fi[a]; for (let c = 0; c < Dj.dim; c++) if (row[c]) v[c] = (v[c] + mulp(ej[a], row[c])) % PRIME; }
            }
            if (i === j) v[t] = (v[t] + hval(i, beta.map((x, k) => x - (k === i ? 1 : 0)))) % PRIME;
            for (const x of v) img.push(x);
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
          for (const a of R.nz) v[a] = modp(v[a] - mulp(f, R.vec[a]));
          R.expr.forEach((x, b) => { if (x) expr[b] = ((expr[b] || 0) + mulp(f, x)) % PRIME; });
        }
        const pivot = v.findIndex((x) => x);
        if (pivot < 0) { c.coords = expr; continue; }
        const B = basis.length, s = invp(v[pivot]), rexpr = [];
        basis.push(c);
        rexpr[B] = 1;
        expr.forEach((x, b) => { if (x) rexpr[b] = modp(-x); });
        const vec = v.map((x) => mulp(x, s));
        rows.push({ pivot, vec, nz: vec.map((x, a) => (x ? a : -1)).filter((a) => a >= 0), expr: Array.from(rexpr, (x) => (x ? mulp(x, s) : 0)) });
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
      dims.set(kb(beta), dim);
    }
    let next = 0;
    return {
      dims,
      get done() { return next >= order.length; },
      run(until) {
        while (next < order.length) { build(order[next++]); if (performance.now() > until) break; }
        return next >= order.length;
      },
    };
  }

  // An affine L(Λ), Λ = kΛ_0 + λ, from the generators, down to depth N, within the
  // window n_i ≤ n a_i + H of the other pictures. Needs the labels to be rational.
  // A job as above; points() gives the weights found so far.
  function affineGeneratorJob(aff, k, lam, N, H) {
    const g = aff.g, labels = [k - dotp(g.comarks, lam)].concat(lam).map(toFraction);
    if (labels.some((x) => !x)) return null;
    const top = [N].concat(g.marks.map((a) => N * a + H)), betas = [];
    boxes(top, (c) => betas.push(c));
    const job = generatorJob(aff.cartan, labels, betas);
    job.points = () => {
      const out = [];
      for (let n = 0; n <= N; n++) {
        boxes(g.marks.map((a) => n * a + H), (nb) => {
          const m = job.dims.get(key([n].concat(nb)));
          if (m) out.push({ mu: add(lam, sub(scale(n, g.theta), g.fromSimple(nb))), n, nb, mult: m, key: 'b' + n + ';' + key(nb) });
        });
      }
      return out;
    };
    return job;
  }

  G.HighestWeight = {
    algebra, character, multiplicity, dimension, tensor, tableaux, toDominant, orbit, below, hullEdges,
    partitions, verma, simpleQuotient, affine, affineCharacter, affinePartitions, affineVerma, affineSpecial, sl2Affine,
    generatorJob, affineGeneratorJob, toFraction,
    key, add, sub, scale, isInt, TYPES: Object.keys(TYPES), AFFINE: Object.keys(AFFINE),
  };
})(globalThis);
