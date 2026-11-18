// Lefschetz thimbles, the Stokes phenomenon and resurgence: the mathematics, with no drawing.
//
// The integrals are
//     I_Γ(ħ) = ∫_Γ e^{−S(x)/ħ} dx,
// of a polynomial S of degree m = n + 1 with S'(x) = (x − p_1)⋯(x − p_n) and S(0) = 0, along
// a path Γ that comes in from infinity in one valley and goes out in another. With φ = arg ħ
// (a real number, not reduced mod 2π: the valleys turn with it), the valleys are the sectors
// round the directions θ_k = (φ + 2πk)/m, k mod m, where Re(S/ħ) → +∞ and the integrand dies.
//
// The thimble J_i of a critical point p_i is the path of steepest descent through it: the
// points where (S(x) − S(p_i))/ħ is real and ≥ 0, two branches leaving p_i in opposite
// directions and running out to two valleys. S maps it onto the ray S(p_i) + ħ·[0, ∞). For
// ħ off the Stokes rays the thimbles join the m valleys as the edges of a tree, so a path Γ
// from valley a to valley b is the sum, with signs, of the thimbles on the path from a to b
// in that tree: Γ = Σ n_i J_i. A thimble jumps where its ray runs into another critical value
// S(p_j), at arg ħ = arg(S(p_j) − S(p_i)), by ±J_j (Picard–Lefschetz).
//
// Each thimble has the asymptotic expansion
//     I_i(ħ) ~ e^{−S(p_i)/ħ} √(2πħ/S''(p_i)) Σ a_k ħ^k,   a_0 = 1,
// with a_k = (2k−1)!!/(2s₂)^k · [y^{2k}] (1 + T(y))^{−(2k+1)/2}, where
// S(p_i + y) − S(p_i) = s₂y²(1 + T(y)). Its Borel transform is singular at the critical
// values S(p_j) − S(p_i) that the thimble runs into, and the large orders follow
//     a_k ≈ Σ_j κ_ij/(2πi) Σ_l a^{(j)}_l Γ(k − l)/A_ij^{k−l},   A_ij = S(p_j) − S(p_i),
// with κ_ij = μ_ij · x'_j(0)/x'_i(0), μ_ij the coefficient of the jump J_i → J_i + μ_ij J_j as
// arg ħ grows through arg A_ij, and x'_i(0) = √(2ħ/S''(p_i)) the direction J_i leaves p_i in.
//
// Complex numbers are pairs [re, im].
//
//   action(crit)                  S from its critical points: coefficients, values, S''
//   evalS, evalDS                 S(x), S'(x)
//   directions(act, phi, prev)    the unit direction each thimble leaves its point in,
//                                 continued from prev (the orientation of the thimbles)
//   branch(act, i, phi, d, opts)  one half of a thimble, traced: its points, its valley, or
//                                 the critical point it runs into
//   thimbles(act, phi, dirs, R)   both halves of every thimble, and the valleys they join
//   decompose(m, ends, a, b)      the coefficients n_i of the path from valley a to valley b
//   stokesRays(act, i, dirs, phi) where J_i jumps: the angles, the points it runs into, μ, κ
//   series(act, i, K)             the coefficients a_0 … a_K of the series of J_i
//   localInverse(act, i, K)       the coefficients b_k of y(w), S(p_i + y) − S(p_i) = w²
//   integral(act, i, hbar, d)     the integral over J_i: { e: −S(p_i)/ħ, v } with I = e^e·v
//   predict(...)                  the large orders of the series from the other series
//   borelRay(...)                 the Borel transform of the series along a ray
//   flowPath(...)                 a path pushed along the upward flow of Re(S/ħ)
//
// Also used by test/stokes-phenomenon.test.mjs, so it touches no DOM.
(function (G) {
  'use strict';

  const TAU = 2 * Math.PI;

  /* ---------- complex numbers ---------- */

  const C = (re, im) => [re, im || 0];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const scl = (a, s) => [a[0] * s, a[1] * s];
  const conj = (a) => [a[0], -a[1]];
  const abs = (a) => Math.hypot(a[0], a[1]);
  const arg = (a) => Math.atan2(a[1], a[0]);
  function div(a, b) {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  }
  const cis = (t) => [Math.cos(t), Math.sin(t)];
  const cexp = (a) => scl(cis(a[1]), Math.exp(a[0]));
  // the square root with a cut along the negative axis
  function csqrt(a) {
    const r = abs(a);
    if (r === 0) return [0, 0];
    const re = Math.sqrt((r + a[0]) / 2), im = Math.sqrt((r - a[0]) / 2);
    return [re, a[1] < 0 ? -im : im];
  }
  // log Γ(x) for x > 0 (Lanczos)
  const LG = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = 0.99999999999980993;
    const t = x + 7.5;
    for (let i = 0; i < 8; i++) a += LG[i] / (x + i + 1);
    return 0.5 * Math.log(TAU) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  // erf, to about 1e-7 (Abramowitz and Stegun 7.1.26 is too coarse; this is Numerical Recipes' erfc)
  function erf(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? 1 - r : r - 1;
  }

  /* ---------- the action ---------- */

  // the coefficients of a polynomial with these roots and leading coefficient 1, from x^0 up
  function fromRoots(roots) {
    let p = [C(1)];
    for (const r of roots) {
      const q = Array.from({ length: p.length + 1 }, () => C(0));
      for (let k = 0; k < p.length; k++) {
        q[k + 1] = add(q[k + 1], p[k]);
        q[k] = sub(q[k], mul(p[k], r));
      }
      p = q;
    }
    return p;
  }
  function horner(cf, x) {
    let re = 0, im = 0;
    for (let k = cf.length - 1; k >= 0; k--) {
      const t = re * x[0] - im * x[1] + cf[k][0];
      im = re * x[1] + im * x[0] + cf[k][1];
      re = t;
    }
    return [re, im];
  }
  // S from its critical points p_1 … p_n: S'(x) = Π (x − p_j), S(0) = 0
  function action(crit) {
    const n = crit.length, m = n + 1;
    const ds = fromRoots(crit);                                         // S', from x^0 to x^n
    const s = [C(0)].concat(ds.map((c, k) => scl(c, 1 / (k + 1))));    // S, from x^0 to x^m
    const d2 = ds.slice(1).map((c, k) => scl(c, k + 1));                // S''
    const act = { n, m, crit: crit.map((p) => C(p[0], p[1])), ds, s, d2 };
    act.values = act.crit.map((p) => horner(s, p));
    act.second = act.crit.map((p) => horner(d2, p));
    act.centre = scl(act.crit.reduce(add, C(0)), 1 / n);
    // the length scale of the configuration: how far the critical points spread
    let r = 0;
    for (const p of act.crit) r = Math.max(r, abs(sub(p, act.centre)));
    act.scale = Math.max(r, 0.25);
    return act;
  }
  const evalS = (act, x) => horner(act.s, x);
  const evalDS = (act, x) => horner(act.ds, x);
  // the Taylor coefficients of S at the point q: S(q + y) = Σ c_k y^k
  function taylorAt(act, q) {
    let cf = act.s.map((c) => c.slice());
    const out = [];
    for (let k = 0; k < act.s.length; k++) {
      // synthetic division by (x − q): the remainder is the next Taylor coefficient
      const r = [];
      let acc = C(0);
      for (let j = cf.length - 1; j >= 0; j--) {
        acc = add(mul(acc, q), cf[j]);
        r.unshift(acc);
      }
      out.push(r[0]);
      cf = r.slice(1);
    }
    return out;
  }

  /* ---------- valleys ---------- */

  const valleyAngle = (m, phi, k) => (phi + TAU * k) / m;
  const mod = (k, m) => ((k % m) + m) % m;
  // the valley whose direction, seen from c, is nearest that of x
  function valleyOf(m, phi, x, c) {
    const a = Math.atan2(x[1] - c[1], x[0] - c[0]);
    return mod(Math.round((m * a - phi) / TAU), m);
  }

  /* ---------- orientations ---------- */

  // The unit direction in which the + half of each thimble leaves its critical point: ±√(ħ/S''),
  // with the sign that keeps closest to prev (or, with no prev, the one pointing right).
  function directions(act, phi, prev) {
    return act.second.map((s2, i) => {
      const a = (phi - arg(s2)) / 2;
      let d = cis(a);
      const p = prev && prev[i];
      if (p ? d[0] * p[0] + d[1] * p[1] < 0 : d[0] < -1e-12 || (Math.abs(d[0]) <= 1e-12 && d[1] < 0)) d = scl(d, -1);
      return d;
    });
  }

  /* ---------- tracing a thimble ---------- */

  // One half of the thimble of p_i at φ = arg ħ, leaving p_i in the unit direction d: the path
  // along which F = (S − S(p_i))e^{−iφ} is real and grows. It is followed by arc length, each
  // step corrected back onto Im F = 0, with steps that shrink near the other critical points,
  // until it is R from the centre of the critical points, or runs into one of them.
  //   opts.R      how far to follow it (default: far enough to read its valley)
  //   opts.hit    how close to another critical point counts as running into it (× scale)
  //   opts.step   the longest step (× scale)
  // Returns { pts: [x, y, x, y, …], valley, hit: j or −1, steps }.
  function branch(act, i, phi, d, opts) {
    opts = opts || {};
    const sc = act.scale, c = act.centre, m = act.m;
    const R = opts.R || 24 * sc;
    const hitTol = (opts.hit || 1e-7) * sc, hmax = (opts.step || 0.04) * sc;
    const p = act.crit[i], Si = act.values[i], rot = cis(-phi);
    const F = (x) => mul(sub(evalS(act, x), Si), rot);
    const dF = (x) => mul(evalDS(act, x), rot);
    // the unit tangent along which F grows: conj(F')/|F'|
    const tangent = (x) => { const g = conj(dF(x)), r = abs(g); return r > 0 ? scl(g, 1 / r) : d; };
    const pts = [p[0], p[1]];
    let x = add(p, scl(d, 1e-4 * sc)), steps = 0, hit = -1;
    pts.push(x[0], x[1]);
    const maxSteps = opts.maxSteps || 6000;
    while (steps++ < maxSteps) {
      // distance to the nearest other critical point, and to the start
      let near = Infinity, nearJ = -1;
      for (let j = 0; j < act.n; j++) {
        if (j === i) continue;
        const r = abs(sub(x, act.crit[j]));
        if (r < near) { near = r; nearJ = j; }
      }
      if (near < hitTol) { hit = nearJ; pts.push(act.crit[nearJ][0], act.crit[nearJ][1]); break; }
      const rc = abs(sub(x, c));
      if (rc > R) break;
      const fromP = abs(sub(x, p));
      let h = Math.min(hmax * (1 + rc / sc) , 0.25 * near, 0.5 * fromP + 1e-4 * sc);
      // RK4 on dx/dσ = tangent(x)
      const k1 = tangent(x), k2 = tangent(add(x, scl(k1, h / 2))), k3 = tangent(add(x, scl(k2, h / 2))), k4 = tangent(add(x, scl(k3, h)));
      let y = add(x, scl(add(add(k1, scl(k2, 2)), add(scl(k3, 2), k4)), h / 6));
      // back onto Im F = 0: y ← y − i Im F(y) / F'(y)
      for (let it = 0; it < 2; it++) {
        const f = F(y), g = dF(y);
        if (abs(g) === 0) break;
        y = sub(y, div([0, f[1]], g));
      }
      x = y;
      pts.push(x[0], x[1]);
    }
    return { pts, valley: hit >= 0 ? -1 : valleyOf(m, phi, x, c), hit, steps };
  }

  // Both halves of every thimble at φ: for each critical point, its direction d (the + half),
  // the halves, and the valleys the thimble runs from (− half) and to (+ half).
  function thimbles(act, phi, dirs, opts) {
    return act.crit.map((p, i) => {
      const d = dirs[i];
      const plus = branch(act, i, phi, d, opts), minus = branch(act, i, phi, scl(d, -1), opts);
      return { i, d, plus, minus, from: minus.valley, to: plus.valley, hit: plus.hit >= 0 ? plus.hit : minus.hit };
    });
  }

  /* ---------- the decomposition of a path ---------- */

  // The thimbles join valleys: ends[i] = [from, to]. If they make a tree on the m valleys, the
  // path from valley a to valley b is the sum of the thimbles on the path between them in the
  // tree, each with +1 when it is run from its `from` to its `to` and −1 the other way. Returns
  // the coefficients, or null when the thimbles do not make a tree (on a Stokes ray).
  function decompose(m, ends, a, b) {
    const adj = Array.from({ length: m }, () => []);
    let edges = 0;
    for (let i = 0; i < ends.length; i++) {
      const [f, t] = ends[i];
      if (f < 0 || t < 0 || f === t) return null;
      adj[f].push([t, i, 1]);
      adj[t].push([f, i, -1]);
      edges++;
    }
    if (edges !== m - 1) return null;
    // the path from a by depth-first search, remembering how each valley was reached
    const how = new Array(m).fill(null), seen = new Array(m).fill(false);
    const stack = [a];
    seen[a] = true;
    let count = 1;
    while (stack.length) {
      const v = stack.pop();
      for (const [w, i, s] of adj[v]) if (!seen[w]) { seen[w] = true; how[w] = [v, i, s]; stack.push(w); count++; }
    }
    if (count !== m) return null;                  // not connected: not a tree
    const n = new Array(ends.length).fill(0);
    for (let v = b; v !== a; v = how[v][0]) n[how[v][1]] += how[v][2];
    return n;
  }

  /* ---------- the asymptotic series of a thimble ---------- */

  // the coefficients of (1 + T)^α up to y^N, T = Σ_{k≥1} t[k] y^k (t[0] unused)
  function powSeries(t, alpha, N) {
    const P = [C(1)];
    for (let n = 1; n <= N; n++) {
      let acc = C(0);
      for (let k = 1; k <= Math.min(n, t.length - 1); k++) acc = add(acc, scl(mul(t[k], P[n - k]), alpha * k - (n - k)));
      P.push(scl(acc, 1 / n));
    }
    return P;
  }
  // T(y) at p_i: S(p_i + y) − S(p_i) = s₂ y² (1 + T(y)), t_k = s_{k+2}/s₂
  function tAt(act, i) {
    const tc = taylorAt(act, act.crit[i]);
    const s2 = tc[2], t = [C(0)];
    for (let k = 3; k < tc.length; k++) t.push(div(tc[k], s2));
    return { s2, t };
  }
  // the coefficients a_0 … a_K of the series Σ a_k ħ^k of J_i (a_0 = 1)
  function series(act, i, K) {
    const { s2, t } = tAt(act, i);
    const out = [C(1)];
    let dfac = 1;                                       // (2k − 1)!!
    const inv2s2 = div(C(1), scl(s2, 2));
    let pw = C(1);                                      // (2 s₂)^{−k}
    for (let k = 1; k <= K; k++) {
      dfac *= 2 * k - 1;
      pw = mul(pw, inv2s2);
      const P = powSeries(t, -(2 * k + 1) / 2, 2 * k);
      out.push(scl(mul(pw, P[2 * k]), dfac));
    }
    return out;
  }
  // the coefficients b_1 … b_K of the inverse y(w) of S(p_i + y) − S(p_i) = w², with b_1 = 1/√s₂
  // for the root √s₂ given (beta): b_k = β^{−k}/k · [y^{k−1}] (1 + T)^{−k/2}
  function localInverse(act, i, K, beta) {
    const { s2, t } = tAt(act, i);
    const b = beta || csqrt(s2), ib = div(C(1), b), out = [C(0)];
    let pw = C(1);
    for (let k = 1; k <= K; k++) {
      pw = mul(pw, ib);
      const P = powSeries(t, -k / 2, k - 1);
      out.push(scl(mul(pw, P[k - 1]), 1 / k));
    }
    return out;
  }

  /* ---------- the integral over a thimble ---------- */

  // Gauss–Legendre nodes and weights on [0, 1], 10 points
  const GL = (function () {
    const x = [0.1488743389816312, 0.4333953941292472, 0.6794095682990244, 0.8650633666889845, 0.9739065285171717];
    const w = [0.2955242247147529, 0.2692667193099963, 0.2190863625159820, 0.1494513491505806, 0.0666713443086881];
    const nodes = [], weights = [];
    for (let k = 0; k < 5; k++) {
      nodes.push((1 - x[k]) / 2, (1 + x[k]) / 2);
      weights.push(w[k] / 2, w[k] / 2);
    }
    return { nodes, weights };
  })();

  // ∫_0^U e^{−u²} x'(u) du along one half of the thimble of p_i at ħ, x(0) = p_i, x'(0) = v0,
  // where S(x(u)) = S(p_i) + ħu². The path is followed by steps in u, each predicted along the
  // tangent and corrected by Newton, short near the other critical points (and halved when the
  // midpoint strays from the Hermite cubic: the path turns sharply there); Gauss–Legendre on
  // each step, its nodes found by Newton from the cubic.
  function halfIntegral(act, i, hbar, v0, U) {
    const p = act.crit[i], Si = act.values[i];
    const solve = (x, u) => {
      const tg = add(Si, scl(hbar, u * u));
      for (let it = 0; it < 40; it++) {
        const dx = div(sub(evalS(act, x), tg), evalDS(act, x));
        x = sub(x, dx);
        if (abs(dx) < 1e-15 * (1 + abs(x))) break;
      }
      return x;
    };
    const deriv = (x, u) => (u === 0 ? v0 : div(scl(hbar, 2 * u), evalDS(act, x)));
    const hermite = (xa, da, xb, db, h, s) => {
      const s2 = s * s, s3 = s2 * s;
      return add(add(scl(xa, 2 * s3 - 3 * s2 + 1), scl(da, (s3 - 2 * s2 + s) * h)), add(scl(xb, -2 * s3 + 3 * s2), scl(db, (s3 - s2) * h)));
    };
    let u = 0, x = p, dx = v0, total = C(0);
    while (u < U - 1e-12) {
      let near = Infinity;
      for (let j = 0; j < act.n; j++) if (j !== i) near = Math.min(near, abs(sub(x, act.crit[j])));
      let h = Math.min(0.2, U - u, 0.12 * near / Math.max(abs(dx), 1e-300));
      let x1, dx1;
      for (;;) {
        x1 = solve(add(x, scl(dx, h)), u + h);
        dx1 = deriv(x1, u + h);
        const guess = hermite(x, dx, x1, dx1, h, 0.5), xm = solve(guess, u + h / 2);
        if (abs(sub(xm, guess)) <= 1e-3 * abs(sub(x1, x)) + 1e-14 || h < 1e-10) break;
        h /= 2;
      }
      for (let k = 0; k < GL.nodes.length; k++) {
        const s = GL.nodes[k], uu = u + h * s;
        const xg = solve(hermite(x, dx, x1, dx1, h, s), uu);
        total = add(total, scl(deriv(xg, uu), GL.weights[k] * h * Math.exp(-uu * uu)));
      }
      x = x1; dx = dx1; u += h;
    }
    return total;
  }
  // The integral of e^{−S/ħ} over J_i, run in the direction d (unit; the + half leaves p_i
  // that way). Returns { e, v } with I = e^{e} · v, e = −S(p_i)/ħ (kept apart: it may be large).
  function integral(act, i, hbar, d, U) {
    U = U || 7.5;
    const s2 = act.second[i];
    let v0 = csqrt(div(scl(hbar, 2), s2));
    if (v0[0] * d[0] + v0[1] * d[1] < 0) v0 = scl(v0, -1);
    const vp = halfIntegral(act, i, hbar, v0, U), vm = halfIntegral(act, i, hbar, scl(v0, -1), U);
    return { e: scl(div(act.values[i], hbar), -1), v: sub(vp, vm), v0 };
  }

  /* ---------- Stokes rays ---------- */

  // the directions dirs (at φ) turned on to φ' along the shorter way round, as ħ turns
  const turnDirs = (dirs, phi, phi2) => dirs.map((d) => mul(d, cis((phi2 - phi) / 2)));
  // the lift of the angle t nearest phi
  const liftNear = (t, phi) => t + TAU * Math.round((phi - t) / TAU);
  // x'(0) of J_k for |ħ| = 1, in the direction dirs[k]: √(2/|S''|) d
  const v0Of = (act, dirs, k) => scl(dirs[k], Math.sqrt(2 / abs(act.second[k])));

  // Where J_i jumps. Each critical value S(p_j) ≠ S(p_i) gives a candidate, arg ħ = arg A_ij,
  // A_ij = S(p_j) − S(p_i) (critical values in the same direction from S(p_i) go together).
  // Just before and just after it the thimbles are traced; J_i after is written in the
  // thimbles before, J_i^+ = J_i^- + Σ μ_ij J_j^-. Candidates with every μ_ij = 0 are not
  // Stokes rays of J_i (its ray passes S(p_j) on another sheet). The orientations are
  // those of dirs at φ, carried round to each ray. Returns, by increasing angle in (−π, π],
  //   { theta, js: [j…], mu: [μ_ij by j], kappa: [κ_ij by j], A: [A_ij by j] }
  // with κ_ij = μ_ij x'_j(0)/x'_i(0), the Stokes constant of the series.
  function stokesRays(act, i, dirs, phi, opts) {
    opts = opts || {};
    const delta = opts.delta || 1e-6, vs = act.values;
    let span = 0;
    for (const a of vs) for (const b of vs) span = Math.max(span, abs(sub(a, b)));
    const groups = [];
    for (let j = 0; j < act.n; j++) {
      if (j === i) continue;
      const A = sub(vs[j], vs[i]);
      if (abs(A) <= 1e-10 * span) continue;
      const t = arg(A);
      const g = groups.find((q) => Math.abs(Math.atan2(Math.sin(q.theta - t), Math.cos(q.theta - t))) < 1e-9);
      if (g) g.cand.push(j); else groups.push({ theta: t, cand: [j] });
    }
    const out = [];
    for (const g of groups) {
      const th = liftNear(g.theta, phi);
      const dm = turnDirs(dirs, phi, th - delta), dp = turnDirs(dirs, phi, th + delta);
      const before = thimbles(act, th - delta, dm, opts);
      const after = branch(act, i, th + delta, dp[i], opts), afterM = branch(act, i, th + delta, scl(dp[i], -1), opts);
      if (after.hit >= 0 || afterM.hit >= 0) continue;
      // the valleys are labelled alike on both sides (the lift is continuous across th)
      const n = decompose(act.m, before.map((t) => [t.from, t.to]), afterM.valley, after.valley);
      if (!n) continue;
      n[i] -= 1;
      const js = [];
      n.forEach((c, j) => { if (c && j !== i) js.push(j); });
      if (!js.length || n[i] !== 0) continue;
      const mu = new Array(act.n).fill(0), kappa = new Array(act.n).fill(null), A = new Array(act.n).fill(null);
      const vi = v0Of(act, dirs, i);
      for (const j of js) {
        mu[j] = n[j];
        kappa[j] = scl(div(v0Of(act, dirs, j), vi), n[j]);
        A[j] = sub(vs[j], vs[i]);
      }
      out.push({ theta: g.theta, js, mu, kappa, A });
    }
    out.sort((a, b) => a.theta - b.theta);
    return out;
  }

  /* ---------- the large orders ---------- */

  // The coefficients a_k of the series of J_i, k = 0 … K, as the series of the critical points
  // its Borel transform is singular at predict them, from their first L terms:
  //     â_k = Σ_rays Σ_j κ_ij/(2πi) Σ_{l<min(L,k)} a^{(j)}_l Γ(k − l)/A_ij^{k−l}.
  // ser(j) gives the coefficients of J_j.
  function predict(rays, K, L, ser) {
    const out = [];
    for (let k = 0; k <= K; k++) {
      let s = C(0);
      for (const r of rays) {
        for (const j of r.js) {
          const A = r.A[j], la = Math.log(abs(A)), ta = arg(A), aj = ser(j);
          const pre = div(r.kappa[j], C(0, TAU));
          for (let l = 0; l < Math.min(L, k); l++) {
            // Γ(k − l) / A^{k−l}
            const e = k - l, g = cexp(C(lgamma(e) - e * la, -e * ta));
            s = add(s, mul(pre, mul(aj[l], g)));
          }
        }
      }
      out.push(s);
    }
    return out;
  }

  /* ---------- the Borel transform ---------- */

  // The Borel transform of the series of J_i, in the form
  //     β(ζ) = (√ζ / b₁) (1/S'(x₊) − 1/S'(x₋)),   S(x±) = S(p_i) + ζ,   x± ≈ p_i ± b₁√ζ,
  // so that β(0) = 1, β(ζ) = Σ a_k ζ^k / (½)_k, and Σ a_k ħ^k = (πħ)^{−1/2} ∫_0^∞ e^{−ζ/ħ} β(ζ) ζ^{−1/2} dζ.
  // It is followed out along the ray ζ = ρe^{iα}, ρ = ρmax·k/nR (k = 0 … nR), the two roots
  // continued from the local series near ζ = 0; out, a Float64Array of re, im for each radius.
  // On the principal sheet it is singular where the ray meets a critical value that J_i runs
  // into; there |β| grows without bound, and the values beyond it on the two sides differ.
  function borelRay(act, i, alpha, rhoMax, nR, inv, out) {
    const p = act.crit[i], Si = act.values[i], b1 = inv[1];
    const e = cis(alpha), sq = cis(alpha / 2);
    out = out || new Float64Array(2 * (nR + 1));
    out[0] = 1; out[1] = 0;
    // start on the local series, at a radius well inside its circle of convergence
    let near = Infinity;
    for (let j = 0; j < act.n; j++) if (j !== i) near = Math.min(near, abs(sub(act.crit[j], p)));
    const yOf = (w) => { let y = C(0), pw = C(1); for (let k = 1; k < inv.length; k++) { pw = mul(pw, w); y = add(y, mul(inv[k], pw)); } return y; };
    let rho = Math.min(rhoMax / nR, Math.pow(0.05 * near / abs(b1), 2));
    let w = scl(sq, Math.sqrt(rho));
    let xp = add(p, yOf(w)), xm = add(p, yOf(scl(w, -1)));
    const solve = (x, z) => {
      const tg = add(Si, z);
      for (let it = 0; it < 30; it++) {
        const dx = div(sub(evalS(act, x), tg), evalDS(act, x));
        x = sub(x, dx);
        if (abs(dx) < 1e-14 * (1 + abs(x))) break;
      }
      return x;
    };
    const value = (r) => {
      const a = div(C(1), evalDS(act, xp)), b = div(C(1), evalDS(act, xm));
      return mul(div(scl(sq, Math.sqrt(r)), b1), sub(a, b));
    };
    for (let k = 1; k <= nR; k++) {
      const goal = rhoMax * k / nR;
      while (rho < goal) {
        // a step that moves each root by at most a tenth of its distance to the other critical points
        let lim = Infinity;
        for (const x of [xp, xm]) {
          let dmin = Infinity;
          for (let j = 0; j < act.n; j++) dmin = Math.min(dmin, abs(sub(x, act.crit[j])));
          const speed = 1 / Math.max(abs(evalDS(act, x)), 1e-300);
          lim = Math.min(lim, 0.1 * dmin / speed);
        }
        const h = Math.min(goal - rho, Math.max(lim, 1e-12 * rhoMax));
        // predict along dx/dρ = e^{iα}/S'(x), correct
        const r1 = rho + h, z = scl(e, r1);
        xp = solve(add(xp, scl(div(e, evalDS(act, xp)), h)), z);
        xm = solve(add(xm, scl(div(e, evalDS(act, xm)), h)), z);
        rho = r1;
      }
      const v = value(rho);
      out[2 * k] = v[0]; out[2 * k + 1] = v[1];
    }
    return out;
  }

  /* ---------- the integrals along a ray of ħ ---------- */

  // The integrals over the thimbles for many ħ at once. Written as a Laplace integral along a ray
  // of the plane of values (substituting ζ = S(x) − S(p_i) = e^{iα}v²),
  //     ∫_{J_i} e^{−S/ħ} dx = e^{−S(p_i)/ħ} ∫ e^{−e^{iα}v²/ħ} x'(v) dv,   S(x(v)) = S(p_i) + e^{iα}v²,
  // which holds for every α in the sector of arg ħ between two singular directions of J_i (within a
  // quarter turn of arg ħ): the halves of J_i followed out along the ray of α do not depend on ħ.
  // Near a singular direction the path passes close to another critical point and the integrand
  // is nearly singular, so α is taken a little away from it: then the trapezoid rule (which
  // converges fast for this integrand) is accurate for every ħ in the sector.
  //
  // thimbleRay(act, i, α, dir, targets) follows the two halves of J_i out along the ray of α, the
  // + half leaving p_i along the unit direction dir, and records 1/S'(x) at ζ = e^{iα}σ for the
  // targets σ (sorted); then on until it can read the valleys they end in (relative to α).
  // rayTargets(rhos, U, h) gives the targets σ = ρ w² for the nodes w = kh ≤ U of each ρ.
  // rayCombine(act, i, ray, θ) gives, for ħ = ρe^{iθ} with each ρ, T_i/√ρ, where the integral over
  // J_i is e^{−S(p_i)/ħ} T_i: a Float64Array of (re, im).
  function rayTargets(rhos, U, h) {
    const K = Math.floor(U / h + 1e-9), list = [];
    for (let r = 0; r < rhos.length; r++) for (let k = 1; k <= K; k++) list.push({ s: rhos[r] * (k * h) * (k * h), r, k });
    list.sort((a, b) => a.s - b.s);
    return { list, rhos, U, h, K };
  }
  function thimbleRay(act, i, alpha, dir, tg) {
    const p = act.crit[i], Si = act.values[i], inv = localInverse(act, i, 16);
    const e = cis(alpha), half = cis(alpha / 2), c = act.centre, far = 12 * act.scale, targets = tg.list;
    let near = Infinity;
    for (let j = 0; j < act.n; j++) if (j !== i) near = Math.min(near, abs(sub(act.crit[j], p)));
    const lead = mul(inv[1], half), sg = lead[0] * dir[0] + lead[1] * dir[1] >= 0 ? 1 : -1;
    const yOf = (w) => { let y = C(0), pw = C(1); for (let k = 1; k < inv.length; k++) { pw = mul(pw, w); y = add(y, mul(inv[k], pw)); } return y; };
    const solve = (x, z) => {
      const tz = add(Si, z);
      for (let it = 0; it < 30; it++) {
        const dx = div(sub(evalS(act, x), tz), evalDS(act, x));
        x = sub(x, dx);
        if (abs(dx) < 1e-14 * (1 + abs(x))) break;
      }
      return x;
    };
    const inv1 = [new Float64Array(2 * targets.length), new Float64Array(2 * targets.length)], valley = [0, 0];
    [1, -1].forEach((side, q) => {
      let s = Math.pow(0.04 * near / abs(inv[1]), 2);
      if (targets.length) s = Math.min(s, targets[0].s);
      let x = add(p, yOf(scl(half, side * sg * Math.sqrt(s))));
      const go = (s1) => {
        while (s < s1) {
          let dmin = Infinity;
          for (let j = 0; j < act.n; j++) dmin = Math.min(dmin, abs(sub(x, act.crit[j])));
          const g = evalDS(act, x);
          const step = Math.min(s1 - s, Math.max(0.1 * dmin * abs(g), 1e-12 * (1 + s1)));
          x = solve(add(x, scl(div(e, g), step)), scl(e, s + step));
          s += step;
        }
      };
      targets.forEach((t, n) => {
        go(t.s);
        const v = div(C(1), evalDS(act, x));
        inv1[q][2 * n] = v[0]; inv1[q][2 * n + 1] = v[1];
      });
      for (let guard = 0; guard < 200 && abs(sub(x, c)) < far; guard++) go(Math.max(2 * s, s + 1e-6));
      valley[q] = valleyOf(act.m, alpha, x, c);
    });
    return { i, alpha, dir, inv1, ends: [valley[1], valley[0]], tg };
  }
  function rayCombine(act, i, ray, theta) {
    const tg = ray.tg, nR = tg.rhos.length, h = tg.h, out = new Float64Array(2 * nR);
    const v0 = scl(ray.dir, Math.sqrt(2 / abs(act.second[i]))), e = cis(ray.alpha), tilt = cis(ray.alpha - theta);
    for (let r = 0; r < nR; r++) { out[2 * r] = h * v0[0]; out[2 * r + 1] = h * v0[1]; }
    tg.list.forEach((t, n) => {
      const w = t.k * h, g = cexp(scl(tilt, -w * w)), f = 2 * w * Math.sqrt(tg.rhos[t.r]);
      const d = mul(mul(e, g), [ray.inv1[0][2 * n] - ray.inv1[1][2 * n], ray.inv1[0][2 * n + 1] - ray.inv1[1][2 * n + 1]]);
      out[2 * t.r] += h * f * d[0];
      out[2 * t.r + 1] += h * f * d[1];
    });
    return out;
  }
  // The direction of the ray to follow for arg ħ = θ, for J_i whose singular directions are
  // sing (angles): θ itself, or nearer the middle of its sector, at least margin from either end.
  function rayAngle(theta, sing, margin) { return rayPlan(theta, sing, margin).alpha; }
  // the same, with how far the ray keeps from the nearest singular direction: in a narrow sector
  // that is less than the margin, and the trapezoid rule needs a finer step (rayStep)
  function rayPlan(theta, sing, margin) {
    if (!sing.length) return { alpha: theta, clear: Infinity };
    let lo = -Infinity, hi = Infinity;
    for (const a0 of sing) {
      const a = a0 + TAU * Math.round((theta - a0) / TAU);
      for (const b of [a - TAU, a, a + TAU]) { if (b <= theta && b > lo) lo = b; if (b > theta && b < hi) hi = b; }
    }
    const m = Math.min(margin, (hi - lo) / 2), alpha = Math.max(lo + m, Math.min(hi - m, theta));
    return { alpha, clear: Math.min(alpha - lo, hi - alpha) };
  }
  // the step for a ray that keeps clear of the singular directions by `clear`: 0.15 from half a
  // radian on, finer below (one of a few, so that the targets can be shared); in a sector so
  // narrow that every ray passes close to a singularity, none (0): integrate over the thimble itself
  function rayStep(clear) { return clear >= 0.45 ? 0.15 : clear >= 0.3 ? 0.1 : clear >= 0.15 ? 0.05 : 0; }

  /* ---------- the flow ---------- */

  // The upward flow of Re(S/ħ), dx/dt = conj(S'(x)) e^{iφ}, slowed where S' is large so that
  // no point runs off to infinity in a finite time: speed at most cap. Along it Im(S/ħ) stays
  // the same and Re(S/ħ) grows; points on the ascending path of p_i run into p_i, and the rest
  // run out to the valleys. Returns x after time t (RK4, steps of at most dt).
  function flowPoint(act, phi, x, t, cap, dt) {
    const rot = cis(phi);
    const v = (y) => { const g = mul(conj(evalDS(act, y)), rot), r = abs(g); return scl(g, 1 / (1 + r / cap)); };
    const n = Math.max(1, Math.ceil(t / dt)), h = t / n;
    for (let k = 0; k < n; k++) {
      const k1 = v(x), k2 = v(add(x, scl(k1, h / 2))), k3 = v(add(x, scl(k2, h / 2))), k4 = v(add(x, scl(k3, h)));
      x = add(x, scl(add(add(k1, scl(k2, 2)), add(scl(k3, 2), k4)), h / 6));
    }
    return x;
  }

  G.Stokes = {
    C, add, sub, mul, div, scl, conj, abs, arg, cis, cexp, csqrt, lgamma, erf,
    fromRoots, horner, action, evalS, evalDS, taylorAt,
    valleyAngle, valleyOf, mod, directions, branch, thimbles, decompose,
    powSeries, series, localInverse, integral,
    turnDirs, liftNear, stokesRays, predict, borelRay, rayTargets, thimbleRay, rayCombine, rayAngle, rayPlan, rayStep, flowPoint,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
