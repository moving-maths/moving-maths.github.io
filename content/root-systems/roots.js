// Root systems of rank two and three: the mathematics, with no drawing.
//
// A system is a lattice Z^n (n = 2 or 3) with a symmetric form (its Gram
// matrix), a list of roots in lattice coordinates, and a linear map E to the
// model space R^n under which the form becomes
//     sign · (x² [+ y²] + sig · z²),   z the last coordinate,
// with sig = 1 (definite), 0 (degenerate) or -1 (Lorentzian).
//
//   kacMoody(A, opts)     the root system of the Cartan matrix A (a_ij = <α_i^∨, α_j>)
//   superSystem(id, t)    some basic classical Lie superalgebras
//   positive(sys, n)      the positive system of the functional v ↦ n · E(v)
//
// Also used by test/root-systems.test.mjs, so it touches no DOM.
(function (G) {
  'use strict';

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  const key = (c) => c.join(',');
  const dot = (u, v) => { let t = 0; for (let i = 0; i < u.length; i++) t += u[i] * v[i]; return t; };
  const height = (c) => c.reduce((s, x) => s + x, 0);
  const apply = (E, c) => E[0].map((_, k) => c.reduce((s, x, i) => s + x * E[i][k], 0)); // Σ c_i E_i
  const quad = (Gm) => (u, v) => { let t = 0; for (let i = 0; i < u.length; i++) for (let j = 0; j < v.length; j++) t += Gm[i][j] * u[i] * v[j]; return t; };
  const unitVec = (n, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0));

  function det(M) {
    if (M.length === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
    return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  }
  // Solves M x = b by elimination with pivoting.
  function solve(M, b) {
    const n = b.length, a = M.map((row, i) => row.concat(b[i]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      [a[c], a[p]] = [a[p], a[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = a[r][c] / a[c][c];
        for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
      }
    }
    return a.map((row, i) => row[n] / row[i]);
  }
  // The basis dual to the rows of B for the dot product: d_i · b_j = δ_ij.
  const dualBasis = (B) => B.map((_, i) => solve(B, unitVec(B.length, i)));

  /* ---------- Kac–Moody systems ---------- */

  const AFFINE_STEP = 0.7;   // rank 2: drawn height of a simple root in affine type, where the form says nothing about it
  const AFFINE_DELTA = 0.75; // rank 3: drawn height of δ

  // (α_i, α_i): the smallest even integers with (α_i, α_i) a_ij = (α_j, α_j) a_ji.
  function symmetrize(A) {
    const n = A.length, num = new Array(n).fill(0), den = new Array(n).fill(1);
    for (let s = 0; s < n; s++) {
      if (num[s]) continue;
      num[s] = 1;
      const todo = [s];
      while (todo.length) {
        const i = todo.pop();
        for (let j = 0; j < n; j++) {
          if (j === i || !A[i][j]) continue;
          // (α_j, α_j) = (α_i, α_i) a_ij / a_ji
          const p = num[i] * A[i][j], q = den[i] * A[j][i], g = gcd(p, q) * Math.sign(q);
          if (!num[j]) { num[j] = p / g; den[j] = q / g; todo.push(j); }
          else if (num[j] * q !== den[j] * p) throw new Error('not symmetrizable');
        }
      }
    }
    const L = den.reduce((l, d) => l * d / gcd(l, d), 1), ints = num.map((x, i) => x * L / den[i]);
    const g = ints.reduce(gcd);
    return ints.map((x) => 2 * x / g);
  }

  // Peterson's recursion for root multiplicities (Kac, Infinite-dimensional Lie
  // algebras, Exercise 11.11): with c(β) = Σ_{k≥1} mult(β/k)/k,
  //   (β | β − 2ρ) c(β) = Σ_{β' + β'' = β} (β' | β'') c(β') c(β''),
  // the sum over nonzero β', β'' in the positive cone. Exact, in BigInt: C = L·c
  // with L = lcm(1..max M). Returns β ↦ mult(β) for 0 ≤ β_i ≤ M_i (null outside).
  // Nothing is assumed about which lattice points are roots.
  function multiplicities(Gm, M) {
    const n = M.length, M3 = [M[0], M[1], n > 2 ? M[2] : 0];
    const g = (i, j) => (i < n && j < n ? Gm[i][j] : 0);
    let L = 1n;
    for (let k = 2; k <= Math.max(...M3); k++) { const K = BigInt(k); let a = L, b = K; while (b) { const t = a % b; a = b; b = t; } L = L / a * K; }
    const W1 = M3[1] + 1, W2 = M3[2] + 1, size = (M3[0] + 1) * W1 * W2;
    const at = (a, b, c) => (a * W1 + b) * W2 + c;
    const C = new Array(size).fill(0n), mult = new Array(size).fill(0n);
    const g00 = g(0, 0), g11 = g(1, 1), g22 = g(2, 2), g01 = g(0, 1), g02 = g(0, 2), g12 = g(1, 2);
    const ip = (a, b, c, a2, b2, c2) => g00 * a * a2 + g11 * b * b2 + g22 * c * c2
      + g01 * (a * b2 + b * a2) + g02 * (a * c2 + c * a2) + g12 * (b * c2 + c * b2);
    const pts = [];
    for (let a = 0; a <= M3[0]; a++) for (let b = 0; b <= M3[1]; b++) for (let c = 0; c <= M3[2]; c++) if (a + b + c) pts.push([a, b, c]);
    pts.sort((u, v) => (u[0] + u[1] + u[2]) - (v[0] + v[1] + v[2]));
    for (const [a, b, c] of pts) {
      const i = at(a, b, c);
      if (a + b + c === 1) { C[i] = L; mult[i] = 1n; continue; }
      let rhs = 0n;
      for (let a1 = 0; a1 <= a; a1++) for (let b1 = 0; b1 <= b; b1++) for (let c1 = 0; c1 <= c; c1++) {
        const x = C[at(a1, b1, c1)];
        if (x === 0n) continue;
        const y = C[at(a - a1, b - b1, c - c1)];
        if (y === 0n) continue;
        const v = ip(a1, b1, c1, a - a1, b - b1, c - c1);
        if (v) rhs += BigInt(v) * x * y;
      }
      let lower = 0n; // L · Σ_{k ≥ 2} mult(β/k)/k
      const d = gcd(gcd(a, b), c);
      for (let k = 2; k <= d; k++) if (d % k === 0) lower += mult[at(a / k, b / k, c / k)] * (L / BigInt(k));
      const coef = ip(a, b, c, a, b, c) - (g00 * a + g11 * b + g22 * c); // (β | β − 2ρ)
      const where = () => key([a, b, c].slice(0, n));
      if (coef !== 0) {
        const den = L * BigInt(coef);
        if (rhs % den !== 0n) throw new Error('Peterson: not integral at ' + where());
        C[i] = rhs / den;
        if ((C[i] - lower) % L !== 0n) throw new Error('Peterson: multiplicity not integral at ' + where());
        mult[i] = (C[i] - lower) / L;
        if (mult[i] < 0n) throw new Error('Peterson: negative multiplicity at ' + where());
      } else {
        // (β | β − 2ρ) = 0 only for β = kγ, γ a real root, k = ht γ^∨: not a root
        if (rhs !== 0n) throw new Error('Peterson: inconsistent at ' + where());
        C[i] = lower;
      }
    }
    return (c) => {
      for (let i = 0; i < n; i++) if (c[i] < 0 || c[i] > M[i]) return null;
      return mult[at(c[0], c[1], n > 2 ? c[2] : 0)];
    };
  }

  // The model: E_i = image of α_i, with the height as the last coordinate.
  // Finite and hyperbolic type: u with (u, α_i) = 1 for all i spans the axis of
  // the height, and its orthogonal complement is positive definite.
  function model(Gm, sig, delta) {
    const n = Gm.length, B = quad(Gm);
    let h, proj;
    if (sig === 0) {
      h = n === 2 ? AFFINE_STEP : AFFINE_DELTA / height(delta);
      proj = (v) => v;
    } else {
      const u = solve(Gm, Gm.map(() => 1)), q = height(u); // q = (u, u)
      if (Math.sign(q) !== sig) throw new Error('unexpected signature');
      h = 1 / Math.sqrt(Math.abs(q));
      proj = (v) => { const t = B(v, u) / q; return v.map((x, i) => x - t * u[i]); };
    }
    // Gram–Schmidt on the projections of α_1 (and α_2), for the form
    const frame = [];
    for (let i = 0; i < n - 1; i++) {
      let w = proj(unitVec(n, i));
      for (const e of frame) { const t = B(w, e); w = w.map((x, k) => x - t * e[k]); }
      const len = Math.sqrt(B(w, w));
      frame.push(w.map((x) => x / len));
    }
    return Gm.map((_, i) => frame.map((e) => B(unitVec(n, i), e)).concat(h));
  }

  // opts: R (rank 2: the window |x|, |y| ≤ R), H (rank 3: real roots up to this
  // height), Him (rank 3: imaginary roots up to this height).
  function kacMoody(A, opts) {
    const n = A.length, o = Object.assign({ R: 20, H: 30, Him: 12 }, opts);
    if (n !== 2 && n !== 3) throw new Error('rank 2 or 3 only');
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (!Number.isInteger(A[i][j]) || (i === j ? A[i][j] !== 2 : A[i][j] > 0) || (A[i][j] === 0) !== (A[j][i] === 0)) throw new Error('not a Cartan matrix');
    }
    const norms = symmetrize(A), Gm = A.map((row, i) => row.map((a) => norms[i] * a / 2)), B = quad(Gm);
    const minors = [Gm[0][0], det(Gm.slice(0, 2).map((r) => r.slice(0, 2)))].concat(n === 3 ? [det(Gm)] : []);
    let family, delta = null;
    if (minors.every((m) => m > 0)) family = 'finite';
    else {
      // affine: a positive vector in the radical, the smallest one
      const lim = 6;
      for (let t = n; t <= n * lim && !delta; t++) {
        for (let a = 1; a <= lim && !delta; a++) for (let b = 1; b <= lim && !delta; b++) {
          const v = n === 2 ? [a, b] : [a, b, t - a - b];
          if (height(v) === t && v.every((x) => x >= 1) && Gm.every((row) => dot(row, v) === 0)) delta = v;
        }
      }
      family = delta ? 'affine' : 'hyperbolic';
      if (!delta && det(Gm) >= 0) throw new Error('neither finite, affine nor Lorentzian');
      if (!delta && n === 3) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (A[i][j] * A[j][i] > 4) throw new Error('not of hyperbolic type');
    }
    const sig = family === 'finite' ? 1 : family === 'affine' ? 0 : -1;
    const E = model(Gm, sig, delta);
    const sys = {
      id: 'km' + A.map((r) => r.map((a) => Math.abs(a)).join('')).join('_'), rank: n, family, cartan: A, gram: Gm, norms,
      sig, sign: 1, E, infinite: family !== 'finite', names: A.map((_, i) => '\\alpha_' + (i + 1)), delta,
    };
    if (delta) sys.affineNode = delta.lastIndexOf(1); // a simple root with coefficient 1 in δ; the others span the finite part
    const reflect = (i, c) => { const d = c.slice(); d[i] -= dot(A[i], c); return d; }; // s_i
    const roots = new Map();
    const add = (c, kind, mult) => roots.set(key(c), { c, p: apply(E, c), norm: B(c, c), kind, mult, ht: height(c) });
    const neg = (c) => c.map((x) => -x);

    // positive real roots: the orbit of the simple roots, climbing by height
    const keep = !sys.infinite ? () => true
      : n === 3 ? (c) => height(c) <= o.H
        : family === 'affine' ? (c) => height(c) <= 1000 : (c) => Math.max(...c) <= 1e7;
    const real = [], seen = new Set(), queue = A.map((_, i) => unitVec(n, i));
    queue.forEach((c) => seen.add(key(c)));
    while (queue.length) {
      const c = queue.pop();
      real.push(c);
      for (let i = 0; i < n; i++) {
        const d = reflect(i, c), k = key(d);
        if (seen.has(k) || d.some((x) => x < 0) || !keep(d)) continue;
        seen.add(k);
        queue.push(d);
      }
    }
    real.sort((u, v) => height(u) - height(v));
    // the walls {f : f(α) = 0}, one for each positive real root
    sys.walls = real.map((c) => ({ c, p: apply(E, c), kind: 'real', ht: height(c) }));

    const inWindow = (c) => { const p = apply(E, c); return Math.abs(p[0]) <= o.R + 1e-9 && Math.abs(p[1]) <= o.R + 1e-9; };
    for (const c of real) if (!sys.infinite || n === 3 || inWindow(c)) { add(c, 'real', 1n); add(neg(c), 'real', 1n); }

    if (sys.infinite) {
      // imaginary roots: every nonzero lattice point with (α, α) ≤ 0 (Kac, Proposition 5.10 c)
      const imag = [];
      if (n === 2) {
        const h = E[0][1], dx = E[0][0] - E[1][0];
        for (let t = 1; t <= Math.floor(o.R / h + 1e-9); t++) {
          for (let m = Math.ceil((-o.R - t * E[1][0]) / dx - 1e-9); m <= Math.floor((o.R - t * E[1][0]) / dx + 1e-9); m++) {
            if (B([m, t - m], [m, t - m]) <= 0) imag.push([m, t - m]);
          }
        }
      } else {
        const top = family === 'affine' ? 6 * height(delta) : o.Him; // affine: δ, …, 6δ
        for (let a = 0; a <= top; a++) for (let b = 0; a + b <= top; b++) for (let c = 0; a + b + c <= top; c++) {
          if (a + b + c && B([a, b, c], [a, b, c]) <= 0) imag.push([a, b, c]);
        }
      }
      // multiplicities, on a box no larger than is quick to fill
      const cap = n === 3 && family === 'hyperbolic' ? 10 : Infinity;
      const M = A.map((_, i) => Math.min(cap, Math.max(1, ...imag.map((c) => c[i]))));
      const mult = multiplicities(Gm, M);
      sys.mult = mult;
      for (const c of imag) { const k = mult(c); add(c, 'imag', k); add(neg(c), 'imag', k); }
    }
    sys.roots = Array.from(roots.values());
    sys.realNorms = Array.from(new Set(norms)).sort((x, y) => x - y);
    // where the handle starts, in the standard chamber: the height in rank 2; in
    // rank 3 a point off the axis, so that it does not sit on the ray of δ
    sys.start = unitVec(n, n - 1);
    if (n === 3) {
      const rays = dualBasis(E).map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
      const mix = [0.44, 0.33, 0.23], v = [0, 1, 2].map((k) => rays.reduce((t, r, i) => t + mix[i] * r[k], 0)), l = Math.hypot(...v);
      sys.start = v.map((x) => x / l);
    }
    return sys;
  }

  /* ---------- Lie superalgebras ---------- */

  // Roots in Kac's coordinates. `vec` sends each coordinate vector to the model
  // space, where the form is sign · (x² [+ y²] + sig · z²); `basis` is the
  // distinguished system of simple roots; `even` and `odd` list the roots up to sign.
  const H = Math.SQRT1_2, S6 = 1 / Math.sqrt(6), S2 = Math.SQRT2, R3 = Math.sqrt(3);
  const SUPER = {
    sl21: () => ({
      name: '\\mathfrak{sl}(2|1)', coords: ['\\varepsilon_1', '\\varepsilon_2', '\\delta_1'],
      vec: [[H, -H], [-H, -H], [0, -S2]], sig: -1, sign: 1,
      basis: [[1, -1, 0], [0, 1, -1]], even: [[1, -1, 0]], odd: [[1, 0, -1], [0, 1, -1]],
    }),
    osp32: () => ({
      name: '\\mathfrak{osp}(3|2)', coords: ['\\varepsilon_1', '\\delta_1'],
      vec: [[1, 0], [0, 1]], sig: -1, sign: 1,
      basis: [[-1, 1], [1, 0]], even: [[1, 0], [0, 2]], odd: [[0, 1], [1, 1], [1, -1]],
    }),
    osp14: () => ({
      name: '\\mathfrak{osp}(1|4)', coords: ['\\delta_1', '\\delta_2'],
      vec: [[1, 0], [0, 1]], sig: 1, sign: -1,
      basis: [[1, -1], [0, 1]], even: [[2, 0], [0, 2], [1, 1], [1, -1]], odd: [[1, 0], [0, 1]],
    }),
    sl31: () => ({
      name: '\\mathfrak{sl}(3|1)', coords: ['\\varepsilon_1', '\\varepsilon_2', '\\varepsilon_3', '\\delta_1'],
      vec: [[H, S6, -S6], [-H, S6, -S6], [0, -2 * S6, -S6], [0, 0, -3 * S6]], sig: -1, sign: 1,
      basis: [[1, -1, 0, 0], [0, 1, -1, 0], [0, 0, 1, -1]],
      even: [[1, -1, 0, 0], [0, 1, -1, 0], [1, 0, -1, 0]], odd: [[1, 0, 0, -1], [0, 1, 0, -1], [0, 0, 1, -1]],
    }),
    osp52: () => ({
      name: '\\mathfrak{osp}(5|2)', coords: ['\\varepsilon_1', '\\varepsilon_2', '\\delta_1'],
      vec: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], sig: -1, sign: 1,
      basis: [[-1, 0, 1], [1, -1, 0], [0, 1, 0]], // δ1 − ε1, ε1 − ε2, ε2
      even: [[1, 1, 0], [1, -1, 0], [1, 0, 0], [0, 1, 0], [0, 0, 2]], odd: [[0, 0, 1], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1]],
    }),
    osp34: () => ({
      name: '\\mathfrak{osp}(3|4)', coords: ['\\varepsilon_1', '\\delta_1', '\\delta_2'],
      vec: [[0, 0, 1], [1, 0, 0], [0, 1, 0]], sig: -1, sign: -1,
      basis: [[0, 1, -1], [-1, 0, 1], [1, 0, 0]], // δ1 − δ2, δ2 − ε1, ε1
      even: [[1, 0, 0], [0, 1, 1], [0, 1, -1], [0, 2, 0], [0, 0, 2]], odd: [[0, 1, 0], [0, 0, 1], [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1]],
    }),
    // D(2,1;α), α > 0: (ε1, ε1) = −(1 + α), (ε2, ε2) = 1, (ε3, ε3) = α (twice Kac's form)
    d21: (t) => ({
      name: 'D(2,1;\\alpha)', coords: ['\\varepsilon_1', '\\varepsilon_2', '\\varepsilon_3'], param: t,
      vec: [[0, 0, Math.sqrt(1 + t)], [1, 0, 0], [0, Math.sqrt(t), 0]], sig: -1, sign: 1,
      basis: [[0, 2, 0], [1, -1, -1], [0, 0, 2]], // 2ε2, ε1 − ε2 − ε3, 2ε3
      even: [[2, 0, 0], [0, 2, 0], [0, 0, 2]], odd: [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1]],
    }),
    // G(3): ε1 + ε2 + ε3 = 0, (ε_i, ε_j) = 1 − 3δ_ij, (δ, δ) = 2
    g3: () => ({
      name: 'G(3)', coords: ['\\varepsilon_1', '\\varepsilon_2', '\\varepsilon_3', '\\delta'], relation: [0, 1, 2],
      vec: [[0, S2, 0], [-S2 * R3 / 2, -S2 / 2, 0], [S2 * R3 / 2, -S2 / 2, 0], [0, 0, S2]], sig: -1, sign: -1,
      basis: [[1, 0, 0, 1], [0, 1, 0, 0], [0, -1, 1, 0]], // δ + ε1, ε2, ε3 − ε2
      even: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [1, -1, 0, 0], [0, 1, -1, 0], [1, 0, -1, 0], [0, 0, 0, 2]],
      odd: [[0, 0, 0, 1], [1, 0, 0, 1], [1, 0, 0, -1], [0, 1, 0, 1], [0, 1, 0, -1], [0, 0, 1, 1], [0, 0, 1, -1]],
    }),
  };

  function superSystem(id, param) {
    if (!SUPER[id]) throw new Error('unknown system ' + id);
    const d = SUPER[id](param === undefined ? 1 : param), n = d.vec[0].length;
    const pos = (u) => apply(d.vec, u);
    const formP = (p, q) => d.sign * (p.slice(0, n - 1).reduce((s, x, i) => s + x * q[i], 0) + d.sig * p[n - 1] * q[n - 1]);
    const clean = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : x);
    const E = d.basis.map(pos), Et = E[0].map((_, k) => E.map((row) => row[k]));
    const sys = {
      id, rank: n, family: 'super', name: d.name, coords: d.coords, basis: d.basis, param: d.param, relation: d.relation,
      gram: E.map((p) => E.map((q) => clean(formP(p, q)))), sig: d.sig, sign: d.sign, E, infinite: false,
    };
    sys.roots = [];
    const add = (u, parity) => {
      for (const s of [1, -1]) {
        const v = u.map((x) => s * x), p = pos(v), nm = clean(formP(p, p));
        const c = solve(Et, p).map(clean); // lattice coordinates: p = Σ c_i E_i
        if (!c.every(Number.isInteger)) throw new Error('not in the root lattice: ' + v);
        sys.roots.push({ c, p, norm: nm, kind: parity === 0 ? 'even' : Math.abs(nm) < 1e-9 ? 'iso' : 'odd', mult: 1n, ht: height(c), ambient: v });
      }
    };
    d.even.forEach((u) => add(u, 0));
    d.odd.forEach((u) => add(u, 1));
    // one wall for each line of roots; an odd root α and the even root 2α share theirs
    sys.walls = [];
    for (const v of sys.roots) {
      const same = sys.walls.find((w) => { const a = dot(w.p, v.p); return Math.abs(a * a - dot(w.p, w.p) * dot(v.p, v.p)) < 1e-9; });
      if (!same) sys.walls.push({ c: v.c, p: v.p, kind: v.kind, ht: 1 });
      else if (same.kind === 'odd' && v.kind === 'even') same.kind = 'even';
    }
    // start in the middle of the chamber of the distinguished simple roots
    const duals = dualBasis(E).map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
    const mid = duals[0].map((_, k) => duals.reduce((s, v) => s + v[k], 0)), len = Math.hypot(...mid);
    sys.start = mid.map((x) => x / len);
    return sys;
  }

  /* ---------- positive systems ---------- */

  // The functional of a vector nv of the model space: v ↦ nv · E(v).
  function functional(sys, nv) {
    const w = sys.E.map((e) => dot(e, nv));
    return (c) => dot(w, c);
  }

  const EPS = 1e-9;

  // The roots on which the functional of nv is positive and, when they have
  // one, their base. Returns { ok, simple: [c, …], … } or { ok: false, why },
  // why = 'root' (the functional vanishes on a root, `on`), 'null' (affine: it
  // vanishes on δ), 'timelike' (hyperbolic: its kernel meets the inside of the
  // light cone), 'limit' (too close to one of those to compute).
  // For a Kac–Moody system the positive roots are w(Δ±), ± = sign, with
  // `word` a reduced word for w, and simple[i] = ± w(α_i).
  // opts.f: the functional itself, worked out exactly (far out in the hyperbolic plane the
  // functional of nv is not: Hyperbolic.group's exact()); nv then gives only the sign.
  function positive(sys, nv, opts) {
    const exact = !!(opts && opts.f), f = exact ? opts.f : functional(sys, nv), n = sys.rank;
    if (sys.family === 'super') {
      const on = sys.roots.filter((v) => Math.abs(f(v.c)) < EPS);
      if (on.length) return { ok: false, why: 'root', on: on.map((v) => v.c) };
      return { ok: true, simple: orderSimple(sys, indecomposable(sys.roots, f), nv).map((v) => v.c) };
    }
    let sign = 1;
    if (sys.family === 'affine') {
      const fd = f(sys.delta);
      if (Math.abs(fd) < EPS) return { ok: false, why: 'null' };
      sign = Math.sign(fd);
    } else if (sys.family === 'hyperbolic') {
      const space = Math.hypot(...nv.slice(0, n - 1)), time = nv[n - 1];
      if (space >= Math.abs(time) - EPS) return { ok: false, why: 'timelike' };
      sign = Math.sign(time);
    }
    // walk to the chamber of f: while f is negative on a member of the base,
    // reflect the base in it
    const A = sys.cartan;
    let base = A.map((_, i) => unitVec(n, i).map((x) => sign * x));
    const word = [];
    for (let step = 0; step < 20000; step++) {
      const size = Math.max(...base.map((b) => Math.max(...b.map(Math.abs))));
      const tol = exact ? EPS : EPS * Math.max(1, size), vals = base.map(f);
      const zero = vals.findIndex((v) => Math.abs(v) < tol);
      if (zero >= 0) return size > 1e6 && !exact ? { ok: false, why: 'limit' } : { ok: false, why: 'root', on: [base[zero]] };
      const i = vals.findIndex((v) => v < 0);
      if (i < 0) return { ok: true, simple: base, word, sign };
      if (size > (exact ? 1e14 : 1e12)) break;
      // s_{β_i}(β_j) = β_j − a_ij β_i
      const bi = base[i];
      base = base.map((b, j) => (j === i ? b.map((x) => -x) : b.map((x, k) => x - A[i][j] * bi[k])));
      word.push(i + 1);
    }
    return { ok: false, why: 'limit' };
  }

  // Kac–Moody systems: the chambers reached from the chamber of the functional
  // of nv by crossing walls, through chambers for which keep(base) holds. Each
  // is given by its base (β_1, …, β_n), with β_i = ± w(α_i); crossing the wall
  // of β_i replaces the base by its image under s_{β_i}. Returns null when nv
  // is in no chamber. At most `max` chambers.
  function chambers(sys, nv, keep, max) {
    const first = positive(sys, nv);
    if (!first.ok) return null;
    const A = sys.cartan, id = (base) => base.map(key).join('|');
    const out = [], seen = new Set([id(first.simple)]), queue = [first.simple];
    for (let q = 0; q < queue.length && out.length < (max || 5000); q++) {
      const base = queue[q];
      if (keep && !keep(base) && q) continue; // the first chamber is kept in any case
      out.push(base);
      for (let i = 0; i < base.length; i++) {
        const bi = base[i], next = base.map((b, j) => (j === i ? b.map((x) => -x) : b.map((x, k) => x - A[i][j] * bi[k])));
        const k = id(next);
        if (!seen.has(k)) { seen.add(k); queue.push(next); }
      }
    }
    return out;
  }

  // The primitive α > 0 of height at most H with (α, α_i) ≤ 0 for all i. In
  // hyperbolic type these are imaginary roots, and every positive imaginary
  // root is w(kα) for one such α, some k ≥ 1 and some w in W (Kac, Chapter 5:
  // the positive imaginary roots are the W-orbit of the set K).
  function antidominant(sys, H) {
    const n = sys.rank, out = [];
    const walk = (c, i, left) => {
      if (i === n) {
        if (c.some((x) => x) && c.reduce(gcd, 0) === 1 && sys.gram.every((row) => dot(row, c) <= 0)) out.push(c.slice());
        return;
      }
      for (let x = 0; x <= left; x++) { c[i] = x; walk(c, i + 1, left - x); }
    };
    walk(new Array(n).fill(0), 0, H);
    return out.sort((u, v) => height(u) - height(v));
  }

  // The positive roots that are not sums of two positive roots.
  function indecomposable(roots, f) {
    const pos = roots.filter((v) => f(v.c) > 0);
    const has = new Set(pos.map((v) => key(v.c)));
    return pos.filter((v) => !pos.some((u) => has.has(key(v.c.map((x, i) => x - u.c[i])))));
  }

  // A steady order for the simple roots of a superalgebra. Rank 2: as the
  // functional's line meets them turning anticlockwise. Rank 3: a root joined
  // to both others goes in the middle; otherwise even roots first.
  function orderSimple(sys, simple, nv) {
    if (sys.rank === 2) {
      const t = Math.atan2(nv[1], nv[0]) - Math.PI / 2;
      const turn = (v) => { const d = Math.atan2(v.p[1], v.p[0]) - t; return d - 2 * Math.PI * Math.floor(d / (2 * Math.PI)); };
      return simple.slice().sort((u, v) => turn(u) - turn(v));
    }
    const B = quad(sys.gram), joined = (u, v) => Math.abs(B(u.c, v.c)) > 1e-9;
    const rank = (v) => ({ even: 0, odd: 1, iso: 2 })[v.kind] * 100 + Math.atan2(v.p[1], v.p[0]);
    const s = simple.slice().sort((u, v) => rank(u) - rank(v));
    if (s.length !== 3) return s;
    const deg = s.map((v) => s.filter((u) => u !== v && joined(u, v)).length);
    const mid = deg.indexOf(2);
    if (mid < 0 || deg.every((x) => x === 2)) return s;
    const ends = s.filter((_, i) => i !== mid);
    return [ends[0], s[mid], ends[1]];
  }

  /* ---------- Dynkin diagrams ---------- */

  // The diagram of a base: { nodes, bonds: [{ i, j, lines, arrow, heavy, label }] }.
  // nodes: 'o' even, 'x' odd isotropic, 'b' odd non-isotropic. arrow: 0 none,
  // 1 towards i, 2 towards j (the shorter root), 3 both ways (a_ij = a_ji = −2).
  // A bond with a_ij a_ji > 4 is one heavy line labelled |a_ij|, |a_ji| (Kac's
  // convention). In D(2,1;α) every bond is one line with a numerical label.
  function diagram(sys, simple) {
    const n = simple.length, bonds = [];
    if (sys.family !== 'super') {
      const A = sys.cartan;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = -A[i][j], b = -A[j][i];
        if (!a) continue;
        if (a * b > 4) bonds.push({ i, j, lines: 1, heavy: true, arrow: 0, label: a + ', ' + b });
        else bonds.push({ i, j, lines: Math.max(a, b), arrow: a === b ? (a === 2 ? 3 : 0) : a < b ? 2 : 1 });
      }
      return { nodes: simple.map(() => 'o'), bonds };
    }
    const B = quad(sys.gram), byKey = new Map(sys.roots.map((v) => [key(v.c), v]));
    const nodes = simple.map((c) => ({ even: 'o', iso: 'x', odd: 'b' })[byKey.get(key(c)).kind]);
    const iso = (x) => Math.abs(x) < 1e-9;
    const show = (k) => String(Math.round(k * 100) / 100);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const uv = B(simple[i], simple[j]), uu = B(simple[i], simple[i]), vv = B(simple[j], simple[j]);
      if (iso(uv)) continue;
      let k, arrow = 0;
      if (!iso(uu) && !iso(vv)) {
        k = Math.max(Math.abs(2 * uv / uu), Math.abs(2 * uv / vv));
        if (k > 1 + 1e-9) arrow = Math.abs(uu) > Math.abs(vv) ? 2 : 1;
      } else if (iso(uu) && iso(vv)) k = Math.abs(uv);
      else { k = Math.abs(2 * uv / (iso(uu) ? vv : uu)); if (k > 1 + 1e-9) arrow = iso(uu) ? 2 : 1; } // read off the root that has a length
      // D(2,1;α): one line, labelled |(β_i, β_j)| in Kac's form (half of ours) when that is not 1
      if (sys.param !== undefined) bonds.push({ i, j, lines: 1, arrow: 0, label: Math.abs(Math.abs(uv) - 2) < 1e-9 ? '' : show(Math.abs(uv) / 2) });
      else bonds.push({ i, j, lines: Math.round(k), arrow });
    }
    return { nodes, bonds };
  }

  /* ---------- names, as TeX ---------- */

  // Σ c_i x_i, e.g. [3, -1], ['\\alpha_1', '\\alpha_2'] → 3\alpha_1-\alpha_2
  function linear(coefs, names) {
    let out = '';
    coefs.forEach((c, i) => {
      if (!c) return;
      const mag = Math.abs(c) === 1 && names[i] ? '' : String(Math.abs(c));
      out += (c < 0 ? '-' : out ? '+' : '') + mag + names[i];
    });
    return out || '0';
  }

  function rootTex(sys, c) {
    if (sys.family !== 'super') return linear(c, sys.names);
    const v = sys.coords.map((_, k) => c.reduce((s, x, i) => s + x * sys.basis[i][k], 0));
    // G(3): ε1 + ε2 + ε3 = 0, so a multiple of it can be taken off; taking the
    // middle coefficient gives the usual names ±ε_i and ε_i − ε_j
    if (sys.relation) {
      const mid = sys.relation.map((k) => v[k]).sort((x, y) => x - y)[1];
      sys.relation.forEach((k) => { v[k] -= mid; });
    }
    return linear(v, sys.coords);
  }

  // affine type: the root as (finite part) + kδ
  function affineTex(sys, c) {
    const j = sys.affineNode, k = c[j];
    const rest = c.map((x, i) => x - k * sys.delta[i]);
    return linear(rest.filter((_, i) => i !== j).concat(k), sys.names.filter((_, i) => i !== j).concat('\\delta'));
  }

  // a reduced word, e.g. [1, 2, 1, 2, 1] → (s_1s_2)^2s_1 in rank two
  function wordTex(word, rank) {
    const len = word.length, s = (list) => list.map((k) => 's_' + k).join('');
    if (!len) return '1';
    if (rank === 3) return len <= 9 ? s(word) : s(word.slice(0, 4)) + '\\cdots ' + s(word.slice(-3));
    const i = word[0], j = 3 - i;
    if (len <= 4) return s(word);
    return '(s_' + i + 's_' + j + ')^{' + Math.floor(len / 2) + '}' + (len % 2 ? 's_' + i : '');
  }

  G.RootSystems = {
    kacMoody, superSystem, positive, functional, chambers, antidominant, indecomposable, multiplicities, diagram, dualBasis, symmetrize,
    linear, rootTex, affineTex, wordTex, key, height, dot, quad, SUPER_IDS: Object.keys(SUPER),
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
