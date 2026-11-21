/* The mathematics of the Picard–Lefschetz page, with no DOM (loaded before main.js, and by
   test/picard-lefschetz-formula.test.mjs).

   f = p(x) + y_2^2 + ⋯ + y_n^2 is a morsification of the singularity A_mu, x^{mu+1}: p is monic of
   degree mu + 1, with distinct critical points c_1, …, c_mu and critical values z_i = p(c_i). The level
   set X_z = f^{-1}(z) lies over the plane of x, and its fibre over x degenerates where p(x) = z. A path
   in the plane of values from z to z_j lifts through c_j to an arc between two roots of p(x) = z, and
   the vanishing cycle along the path lies over that arc: the two roots (n = 1), the two points
   ±√(z − p(x)) over each point of the arc, joined at its ends (n = 2), or the circles of the quadric
   y_2^2 + ⋯ + y_n^2 = z − p(x) over its points, closed up at the ends (a sphere, n ≥ 3).

   Complex numbers are pairs [re, im]; paths and arcs are flat arrays [x0, y0, x1, y1, …]. */
(function (root) {
  'use strict';
  const TAU = 2 * Math.PI;

  /* ---------- complex numbers ---------- */
  function cdiv(a, b, c, d) { const q = c * c + d * d; return [(a * c + b * d) / q, (b * c - a * d) / q]; }
  function csqrt(x, y) {
    const r = Math.hypot(x, y);
    if (r === 0) return [0, 0];
    const s = Math.sqrt((r + Math.abs(x)) / 2);
    return x >= 0 ? [s, y / (2 * s)] : [Math.abs(y) / (2 * s), y >= 0 ? s : -s];
  }
  // the angle from u to v, in (−π, π]
  const turn = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

  /* ---------- the polynomial ---------- */

  // p, p' at x + iy, into out = [p re, p im, p' re, p' im]
  function evalPD(P, x, y, out) {
    const cr = P.r, ci = P.i, m = P.m;
    let ar = cr[m], ai = ci[m], br = 0, bi = 0;
    for (let k = m - 1; k >= 0; k--) {
      const nbr = br * x - bi * y + ar, nbi = br * y + bi * x + ai;
      br = nbr; bi = nbi;
      const nar = ar * x - ai * y + cr[k], nai = ar * y + ai * x + ci[k];
      ar = nar; ai = nai;
    }
    out[0] = ar; out[1] = ai; out[2] = br; out[3] = bi;
    return out;
  }

  // p monic of degree mu + 1 with the given critical points (p' = (mu + 1)∏(x − c_k)), the constant
  // chosen so that the critical values have mean shift (0 if not given). Also a_j = p''(c_j)/2, so
  // p(c_j + t) ≈ z_j + a_j t².
  function poly(crit, shift) {
    const mu = crit.length, m = mu + 1;
    let qr = [1], qi = [0];
    for (const c of crit) {
      const nr = new Array(qr.length + 1).fill(0), ni = new Array(qr.length + 1).fill(0);
      for (let k = 0; k < qr.length; k++) {
        nr[k + 1] += qr[k]; ni[k + 1] += qi[k];
        nr[k] -= qr[k] * c[0] - qi[k] * c[1]; ni[k] -= qr[k] * c[1] + qi[k] * c[0];
      }
      qr = nr; qi = ni;
    }
    const r = new Float64Array(m + 1), i = new Float64Array(m + 1);
    for (let k = 0; k <= mu; k++) { r[k + 1] = m * qr[k] / (k + 1); i[k + 1] = m * qi[k] / (k + 1); }
    const P = { mu, m, r, i, crit: crit.map((c) => [c[0], c[1]]) }, out = [0, 0, 0, 0];
    let sx = 0, sy = 0;
    const v = P.crit.map((c) => { evalPD(P, c[0], c[1], out); sx += out[0]; sy += out[1]; return [out[0], out[1]]; });
    r[0] = -sx / mu + (shift ? shift[0] : 0); i[0] = -sy / mu + (shift ? shift[1] : 0);
    P.vals = v.map((z) => [z[0] + r[0], z[1] + i[0]]);
    P.a = P.crit.map((c, j) => {
      let ar = m / 2, ai = 0;
      P.crit.forEach((d, k) => {
        if (k === j) return;
        const dx = c[0] - d[0], dy = c[1] - d[1], t = ar * dx - ai * dy;
        ai = ar * dy + ai * dx; ar = t;
      });
      return [ar, ai];
    });
    return P;
  }

  // The critical points and the shift (the mean of the critical values) for which the critical
  // values are vals, from crit and shift near them, with the critical points' mean kept: Newton's
  // method on p(c_j) = vals_j, which are holomorphic in the critical points and the shift and, while
  // they are distinct, coordinates on them up to a translation. Returns { crit, shift }, or null if
  // it does not settle.
  function critFor(crit, shift, vals) {
    const mu = crit.length, n = mu + 1;
    let c = crit.map((q) => [q[0], q[1]]), sh = [shift[0], shift[1]], scale = 0;
    vals.forEach((v) => { scale = Math.max(scale, Math.hypot(v[0], v[1])); });
    for (let it = 0; it < 40; it++) {
      const P = poly(c, sh);
      let err = 0;
      const F = P.vals.map((v, j) => { const e = [v[0] - vals[j][0], v[1] - vals[j][1]]; err = Math.max(err, Math.hypot(e[0], e[1])); return e; });
      if (err <= 1e-12 * (1 + scale)) return { crit: c, shift: sh };
      // the system [J 1; 1…1 0] (dc, dsh) = (−F, 0), J the derivatives of the values by the
      // critical points (by differences: they are holomorphic)
      const A = [];
      for (let j = 0; j < n; j++) A.push(new Array(2 * n + 2).fill(0));
      for (let k = 0; k < mu; k++) {
        let sep = Infinity;
        c.forEach((q, l) => { if (l !== k) sep = Math.min(sep, Math.hypot(q[0] - c[k][0], q[1] - c[k][1])); });
        const h = 1e-6 * Math.min(1, sep), cc = c.map((q) => q.slice());
        cc[k][0] += h;
        const Q = poly(cc, sh);
        for (let j = 0; j < mu; j++) { A[j][2 * k] = (Q.vals[j][0] - P.vals[j][0]) / h; A[j][2 * k + 1] = (Q.vals[j][1] - P.vals[j][1]) / h; }
      }
      for (let j = 0; j < mu; j++) { A[j][2 * mu] = 1; A[j][2 * n] = -F[j][0]; A[j][2 * n + 1] = -F[j][1]; }
      for (let k = 0; k < mu; k++) A[mu][2 * k] = 1;
      const x = csolve(A, n);
      if (!x) return null;
      // (a step at most a third of the distance between the critical points)
      let sep = Infinity, big = 0;
      c.forEach((q, k) => { big = Math.max(big, Math.hypot(x[k][0], x[k][1])); c.forEach((r, l) => { if (k < l) sep = Math.min(sep, Math.hypot(q[0] - r[0], q[1] - r[1])); }); });
      const f = big > sep / 3 ? sep / 3 / big : 1;
      c = c.map((q, k) => [q[0] + f * x[k][0], q[1] + f * x[k][1]]);
      sh = [sh[0] + f * x[mu][0], sh[1] + f * x[mu][1]];
    }
    return null;
  }
  // a complex linear system of n equations, rows [re, im of each coefficient …, re, im of the
  // right side]: Gaussian elimination with pivoting; the solution as pairs, or null
  function csolve(A, n) {
    const get = (r, k) => [A[r][2 * k], A[r][2 * k + 1]];
    for (let col = 0; col < n; col++) {
      let p = col, best = 0;
      for (let r = col; r < n; r++) { const v = get(r, col), m = Math.hypot(v[0], v[1]); if (m > best) { best = m; p = r; } }
      if (!(best > 1e-300)) return null;
      [A[col], A[p]] = [A[p], A[col]];
      const [pr, pi] = get(col, col), q = pr * pr + pi * pi;
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const [ar, ai] = get(r, col), fr = (ar * pr + ai * pi) / q, fi = (ai * pr - ar * pi) / q;
        if (!fr && !fi) continue;
        for (let k = col; k <= n; k++) { const [br, bi] = get(col, k); A[r][2 * k] -= fr * br - fi * bi; A[r][2 * k + 1] -= fr * bi + fi * br; }
      }
    }
    return Array.from({ length: n }, (_, k) => { const [pr, pi] = get(k, k), [br, bi] = get(k, n), q = pr * pr + pi * pi; return [(br * pr + bi * pi) / q, (bi * pr - br * pi) / q]; });
  }

  // The roots of p(x) = w (Aberth's method), from guess (the roots for a nearby w) if given.
  function roots(P, wx, wy, guess) {
    const m = P.m, out = [0, 0, 0, 0];
    let z = guess && guess.length === m ? guess.map((q) => [q[0], q[1]]) : null;
    if (!z) {
      let R = 0;
      for (let k = 0; k < m; k++) R = Math.max(R, Math.hypot(P.r[k] - (k ? 0 : wx), P.i[k] - (k ? 0 : wy)));
      R = Math.min(1 + R, 2 * Math.pow(1 + R, 1 / m));
      z = [];
      for (let k = 0; k < m; k++) { const t = TAU * k / m + 0.4; z.push([R * Math.cos(t), R * Math.sin(t)]); }
    }
    let scale = 0;
    z.forEach((q) => { scale = Math.max(scale, Math.hypot(q[0], q[1])); });
    for (let it = 0; it < 300; it++) {
      let worst = 0;
      for (let k = 0; k < m; k++) {
        evalPD(P, z[k][0], z[k][1], out);
        const fr = out[0] - wx, fi = out[1] - wy;
        if (fr === 0 && fi === 0) continue;
        let [nr, ni] = cdiv(fr, fi, out[2], out[3]);
        let sr = 0, si = 0;
        for (let j = 0; j < m; j++) {
          if (j === k) continue;
          const dx = z[k][0] - z[j][0], dy = z[k][1] - z[j][1], q = dx * dx + dy * dy || 1e-300;
          sr += dx / q; si -= dy / q;
        }
        let [or, oi] = cdiv(nr, ni, 1 - (nr * sr - ni * si), -(nr * si + ni * sr));
        if (!isFinite(or) || !isFinite(oi)) { or = 1e-7 * (1 + scale); oi = 0; }
        z[k][0] -= or; z[k][1] -= oi;
        worst = Math.max(worst, Math.hypot(or, oi));
      }
      if (worst <= 1e-14 * (1 + scale)) break;
    }
    return z;
  }

  // Newton's method for p(x) = w from x + iy; null if it does not settle
  function newton(P, x, y, wx, wy, out) {
    for (let it = 0; it < 8; it++) {
      evalPD(P, x, y, out);
      const [dx, dy] = cdiv(out[0] - wx, out[1] - wy, out[2], out[3]);
      if (!isFinite(dx) || !isFinite(dy)) return null;
      x -= dx; y -= dy;
      if (Math.hypot(dx, dy) <= 1e-13 * (1 + Math.hypot(x, y))) return [x, y];
    }
    evalPD(P, x, y, out);
    return Math.hypot(out[0] - wx, out[1] - wy) <= 1e-9 * (1 + Math.hypot(wx, wy)) ? [x, y] : null;
  }

  /* ---------- vanishing cycles: arcs over paths ----------
   * lift(P, j, s, dir, Y, h): the arc of the vanishing cycle along the path s, a flat array from
   * z = s[0] to z_j = s[n] (the last point): the two lifts of the path through c_j, each from c_j to
   * a root of p = z, with steps of at most about h in the plane of x.
   *   dir  the start of the half called '+' (a unit complex number): of the two halves, the one whose
   *        first step from c_j is nearest to it. The cycle runs from the end of the − half, through
   *        c_j, to the end of the + half; for n = 1 it is [end of +] − [end of −].
   *   Y    a square root of z − z_j: for n = 2 the cycle runs out on the branch of √(z − p(x)) that
   *        is Y at c_j, and back on the other.
   * Returns { plus, minus, ys, dir, e }: the halves (flat, from c_j), the values of √(z − p(x)) on
   * the outgoing branch at their points (the same on both halves: they lie over the same points of
   * the path), the start of the + half now, and e, the direction of √(z − p(x)) at the ends: there
   * the cycle passes through the branch point in the direction e at the − end and −e at the + end
   * (in the coordinate y of X_z there, for n = 2). */
  function lift(P, j, s, dir, Y, h) {
    const n = s.length / 2 - 1, c = P.crit[j], v = P.vals[j], a = P.a[j], out = [0, 0, 0, 0];
    const zx = s[0], zy = s[1];
    const res = { plus: [c[0], c[1]], minus: [c[0], c[1]], ys: [Y[0], Y[1]], dir: [dir[0], dir[1]], e: unit(Y), ok: true };
    if (n < 1) return res;
    const ux = s[2 * n - 2] - v[0], uy = s[2 * n - 1] - v[1], ul = Math.hypot(ux, uy);
    if (!(ul > 0)) return res;
    const al = Math.hypot(a[0], a[1]);
    // the first point, a short way along the last segment: |x − c_j| about h/5
    let wx, wy;
    {
      const e = Math.min(ul, 0.04 * al * h * h);
      wx = v[0] + ux / ul * e; wy = v[1] + uy / ul * e;
    }
    let [sr, si] = csqrt(...cdiv(wx - v[0], wy - v[1], a[0], a[1]));
    if (sr * dir[0] + si * dir[1] < 0) { sr = -sr; si = -si; }
    const sl = Math.hypot(sr, si);
    res.dir = [sr / sl, si / sl];
    let p = newton(P, c[0] + sr, c[1] + si, wx, wy, out), m = newton(P, c[0] - sr, c[1] - si, wx, wy, out);
    if (!p || !m) { res.ok = false; return res; }
    let yr = Y[0], yi = Y[1];
    const track = () => { // y = √(z − w), the branch nearest the last
      const [qr, qi] = csqrt(zx - wx, zy - wy);
      if (qr * yr + qi * yi < 0) { yr = -qr; yi = -qi; } else { yr = qr; yi = qi; }
    };
    track();
    let lpx = c[0], lpy = c[1];
    const keep = () => {
      res.plus.push(p[0], p[1]); res.minus.push(m[0], m[1]); res.ys.push(yr, yi);
      lpx = p[0]; lpy = p[1];
    };
    keep();
    let y1 = [yr, yi];
    for (let k = n - 1, guard = 0; k >= 0 && guard < 200000; guard++) {
      const tx = s[2 * k], ty = s[2 * k + 1], dx = tx - wx, dy = ty - wy, dl = Math.hypot(dx, dy);
      if (dl === 0) { if (k === 1) y1 = [yr, yi]; k--; continue; }
      evalPD(P, p[0], p[1], out); const dp = Math.hypot(out[2], out[3]);
      evalPD(P, m[0], m[1], out); const dm = Math.hypot(out[2], out[3]);
      // each half moves about h at most, and near z_j (where they move like a square root) by
      // steps that grow with the distance from z_j
      let lim = Math.min(h * Math.min(dp, dm), 0.5 * Math.hypot(wx - v[0], wy - v[1]) + 1e-300);
      let done = false;
      for (let tries = 0; tries < 30 && !done; tries++) {
        const f = dl <= lim ? 1 : lim / dl, nwx = wx + dx * f, nwy = wy + dy * f;
        const np = stepTo(P, p, nwx - wx, nwy - wy, nwx, nwy, out), nm = stepTo(P, m, nwx - wx, nwy - wy, nwx, nwy, out);
        if (!np || !nm) { lim *= 0.5; continue; }
        p = np; m = nm; wx = nwx; wy = nwy;
        if (f === 1) { wx = tx; wy = ty; }
        track();
        if (f === 1) { if (k === 1) y1 = [yr, yi]; k--; }
        done = true;
      }
      if (!done) { res.ok = false; break; }
      if (k < 0 || Math.hypot(p[0] - lpx, p[1] - lpy) > 0.7 * h) keep();
    }
    if (n === 1) y1 = [Y[0], Y[1]];
    res.e = unit(y1);
    return res;
  }
  // a step of one half: predicted by p', then settled by Newton; null if it seems to change sheets
  function stepTo(P, x, dwx, dwy, wx, wy, out) {
    evalPD(P, x[0], x[1], out);
    const [dx, dy] = cdiv(dwx, dwy, out[2], out[3]);
    if (!isFinite(dx) || !isFinite(dy)) return null;
    const q = newton(P, x[0] + dx, x[1] + dy, wx, wy, out);
    if (!q) return null;
    const pred = Math.hypot(dx, dy), corr = Math.hypot(q[0] - x[0] - dx, q[1] - x[1] - dy);
    return corr <= 0.3 * pred + 1e-12 * (1 + Math.hypot(wx, wy)) ? q : null;
  }
  function unit(q) { const l = Math.hypot(q[0], q[1]); return l > 0 ? [q[0] / l, q[1] / l] : [1, 0]; }

  // the arc as one polyline, from the − end through c_j to the + end, with the outgoing values of
  // √(z − p(x)) at its points
  function arcOf(L) {
    const k = L.minus.length / 2, pts = [], ys = [];
    for (let q = k - 1; q >= 1; q--) { pts.push(L.minus[2 * q], L.minus[2 * q + 1]); ys.push(L.ys[2 * q], L.ys[2 * q + 1]); }
    for (let q = 0; q < k; q++) { pts.push(L.plus[2 * q], L.plus[2 * q + 1]); ys.push(L.ys[2 * q], L.ys[2 * q + 1]); }
    return { pts, ys };
  }

  // the index of the root nearest to x + iy
  function nearest(rts, x, y) {
    let best = 0, d = Infinity;
    rts.forEach((q, k) => { const e = Math.hypot(q[0] - x, q[1] - y); if (e < d) { d = e; best = k; } });
    return best;
  }

  /* ---------- the intersection form ----------
   * cyc: for each cycle, { p, q, e }: the root at its + end and at its − end (indices), and the
   * direction e (from lift). For the arcs of a distinguished basis, which meet only at their ends:
   *   n = 1  ⟨a, b⟩ is the dot product of the 0-cycles [p] − [q];
   *   n = 2  two loops over arcs with a common end r meet once, at the branch point r, and the
   *          sign is that of the pair of their directions there in the coordinate y (e at a − end,
   *          −e at a + end);
   *   n = 3  −(n = 1): adding two squares changes the sign of the form, not the monodromy. */
  function gram(n, cyc) {
    const mu = cyc.length, S = [];
    for (let j = 0; j < mu; j++) {
      S.push([]);
      for (let k = 0; k < mu; k++) {
        const A = cyc[j], B = cyc[k];
        let v;
        if (n % 2) {
          v = (A.p === B.p) - (A.p === B.q) - (A.q === B.p) + (A.q === B.q);
          if (n % 4 === 3) v = -v || 0;
        } else if (j === k) v = 0;
        else {
          v = 0;
          for (const r of [A.p, A.q]) {
            if (r !== B.p && r !== B.q) continue;
            const da = r === A.p ? -1 : 1, db = r === B.p ? -1 : 1;
            const cr = da * db * (A.e[0] * B.e[1] - A.e[1] * B.e[0]);
            v += cr > 0 ? 1 : cr < 0 ? -1 : 0;
          }
          if (n % 4 === 0) v = -v || 0;
        }
        S[j].push(v);
      }
    }
    return S;
  }

  // Orientations that make the form look as in the books: along a tree of the cycles that meet,
  // ⟨Δ_j, Δ_k⟩ = −1 for n = 1 (so +1 for n = 3), and for n = 2 ⟨Δ_j, Δ_k⟩ = −(the value for n = 1)
  // when j < k. Returns, for each cycle, whether to swap its ends (f1 = −1) and whether to take the
  // other square root Y (f2 = −1). seeds[j], if given, fixes those of cycle j ({ f1, f2 }), and the
  // others follow from them; a part with no seed starts with a cycle whose + end is to the right.
  function niceSigns(cyc, rts, seeds) {
    const mu = cyc.length, S1 = gram(1, cyc), S2 = gram(2, cyc);
    const f1 = new Array(mu).fill(0), g = new Array(mu).fill(0), queue = [];
    if (seeds) seeds.forEach((sd, j) => { if (sd) { f1[j] = sd.f1; g[j] = sd.f1 * sd.f2; queue.push(j); } });
    const spread = () => {
      while (queue.length) {
        const j = queue.shift();
        for (let k = 0; k < mu; k++) {
          if (f1[k] || !S1[j][k] || j === k) continue;
          f1[k] = -f1[j] * S1[j][k];
          const s1 = f1[j] * f1[k] * S1[j][k], target = (j < k ? -1 : 1) * s1;
          g[k] = S2[j][k] ? target / (g[j] * S2[j][k]) : 1;
          queue.push(k);
        }
      }
    };
    spread();
    for (let start = 0; start < mu; start++) {
      if (f1[start]) continue;
      const A = cyc[start];
      f1[start] = rts[A.p][0] - rts[A.q][0] >= 0 ? 1 : -1;
      g[start] = 1;
      queue.push(start);
      spread();
    }
    return { f1, f2: g.map((x, k) => x * f1[k]) };
  }

  /* ---------- the Picard–Lefschetz operators ----------
   * h_i(a) = a + ε⟨a, Δ_i⟩Δ_i with ε = (−1)^{n(n+1)/2}, for the loop τ_i that goes from z_0 along the
   * path γ_i, once round z_i counterclockwise, and back. For odd n, h_i is a reflection (h_i² = 1);
   * for even n a transvection, with inverse a ↦ a − ε⟨a, Δ_i⟩Δ_i. */
  const eps = (n) => ((n * (n + 1) / 2) % 2 ? -1 : 1);
  function plApply(S, n, i, s, a) {
    let t = 0;
    for (let k = 0; k < a.length; k++) t += a[k] * S[k][i];
    const e = eps(n);
    a[i] += (s > 0 || n % 2 ? e : -e) * t;
    return a;
  }
  // The monodromy of a loop, a word [[i, ±1], …] in the loops τ_i read in the order travelled: the
  // matrix H with h(Δ_j) = Σ_k H[k][j] Δ_k (a loop travelled first acts first).
  function monodromy(S, n, word) {
    const mu = S.length, cols = [];
    for (let j = 0; j < mu; j++) { const a = new Array(mu).fill(0); a[j] = 1; cols.push(a); }
    for (const [i, s] of word) cols.forEach((a) => plApply(S, n, i, s, a));
    return S.map((_, k) => cols.map((a) => a[k]));
  }

  /* ---------- loops ----------
   * As z moves from a to b, the straight segment from z_0 to z sweeps the triangle z_0 a b. The loop
   * "the path z has travelled, then straight back to z_0" gains a loop τ_i (counterclockwise) or τ_i⁻¹
   * for each critical value z_i in it, in the order swept: sweep returns them, [[i, ±1], …]. */
  function sweep(z0, a, b, vals) {
    const ax = a[0] - z0[0], ay = a[1] - z0[1], bx = b[0] - z0[0], by = b[1] - z0[1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), hit = [], tiny = 1e-12 * (1 + Math.hypot(z0[0], z0[1]));
    // (a step from or to z_0 itself sweeps nothing)
    if (la <= tiny || lb <= tiny) return hit;
    vals.forEach((v, i) => {
      const qx = v[0] - z0[0], qy = v[1] - z0[1];
      // the side of the segment z_i is on, before and after (on it counts as clockwise of it, so
      // that a crossing at the end of one step is not counted again, or missed, by the next)
      // (with a margin far above rounding, so that a z_i on the segment stays on it)
      const lq = 1e-9 * Math.hypot(qx, qy), sa = ax * qy - ay * qx > lq * la, sb = bx * qy - by * qx > lq * lb;
      if (sa === sb) return;
      if ((ax / la + bx / lb) * qx + (ay / la + by / lb) * qy <= 0) return; // the other way from z_0
      const o = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax), oz = (bx - ax) * -ay - (by - ay) * -ax;
      if (o * oz <= 0) return;                                                // beyond the segment ab
      hit.push([i, sa ? 1 : -1, Math.abs(turn(ax, ay, qx, qy))]);
    });
    hit.sort((u, w) => u[2] - w[2]);
    return hit.map((q) => [q[0], q[1]]);
  }
  // w with the letter [i, s] appended, freely reduced
  function append(w, i, s) {
    const last = w[w.length - 1];
    if (last && last[0] === i && last[1] === -s) w.pop(); else w.push([i, s]);
    return w;
  }

  /* ---------- the basis of straight paths, and its jumps ----------
   * The straight paths from z to the critical values form a distinguished system, and their
   * vanishing cycles a basis that moves with z. It jumps where the path to z_j runs through
   * another critical value z_k: on the Stokes ray of z_k for z_j, the ray from z_k away from z_j.
   * crossings(vals, a, b) lists the rays that z crosses as it moves from a to b, in order:
   * [{ j, k, s, t }], s = +1 where it crosses counterclockwise round z_k, t where along a→b.
   * Across the ray the path to z_j changes by the loop τ_k, so (counterclockwise)
   * Δ_j ↦ h_k⁻¹(Δ_j), and clockwise Δ_j ↦ h_k(Δ_j): jump does this to the columns of B, the
   * coefficients of the moving basis in a fixed one with intersection matrix S. */
  function crossings(vals, a, b) {
    const out = [];
    vals.forEach((zj, j) => {
      for (const [k, s] of sweep(zj, a, b, vals)) {
        if (k === j) continue;
        // where along a→b the line from z_j through z_k is crossed
        const dx = vals[k][0] - zj[0], dy = vals[k][1] - zj[1];
        const fa = dx * (a[1] - zj[1]) - dy * (a[0] - zj[0]), fb = dx * (b[1] - zj[1]) - dy * (b[0] - zj[0]);
        out.push({ j, k, s, t: fa === fb ? 0 : fa / (fa - fb) });
      }
    });
    return out.sort((u, v) => u.t - v.t);
  }
  function jump(S, n, B, j, k, s) {
    const col = B.map((r) => r[j]), ck = B.map((r) => r[k]);
    let t = 0;
    for (let a = 0; a < col.length; a++) for (let b = 0; b < col.length; b++) t += col[a] * S[a][b] * ck[b];
    const e = eps(n), c = s < 0 || n % 2 ? e : -e;   // h_k clockwise, h_k⁻¹ counterclockwise
    B.forEach((r, a) => { r[j] = col[a] + c * t * ck[a]; });
    return B;
  }
  /* ---------- loops round a critical value ----------
   * teardrop(z, v, others, r, step): the loop from z once round v counterclockwise, as a teardrop:
   * along the tangent from z to the circle of radius r round v, round the circle's far side, and
   * back along the other tangent; r made smaller (to rMin = r/16 at least) until none of the points
   * others lies inside it or within margin of it. Points at most step apart, from z to z. */
  function teardrop(z, v, others, r, step, margin) {
    const dx = z[0] - v[0], dy = z[1] - v[1], d = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx);
    const inside = (q, rr) => {
      const R = rr + margin;
      if (Math.hypot(q[0] - v[0], q[1] - v[1]) < R) return true;
      // the cone from z to the circle of radius R: the angle at z within asin(R/d), nearer than
      // the tangent points
      if (R >= d) return true;
      const ux = -dx / d, uy = -dy / d, qx = q[0] - z[0], qy = q[1] - z[1], along = qx * ux + qy * uy;
      if (along <= -margin || along > d) return false;
      return Math.abs(qx * uy - qy * ux) < Math.max(0, along) * R / Math.sqrt(d * d - R * R) + margin;
    };
    let rr = Math.min(r, 0.8 * d);
    for (let k = 0; k < 4 && others.some((q) => inside(q, rr)); k++) rr *= 0.5;
    const g = Math.acos(rr / d), out = [[z[0], z[1]]];
    const at = (t) => [v[0] + rr * Math.cos(t), v[1] + rr * Math.sin(t)];
    const line = (A, B) => {
      const m = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / step));
      for (let k = 1; k <= m; k++) out.push([A[0] + (B[0] - A[0]) * k / m, A[1] + (B[1] - A[1]) * k / m]);
    };
    line(z, at(a0 + g));
    const sw = TAU - 2 * g, m = Math.max(12, Math.ceil(sw * rr / step));
    for (let k = 1; k <= m; k++) out.push(at(a0 + g + sw * k / m));
    line(out[out.length - 1], z);
    out[out.length - 1] = [z[0], z[1]];
    return out;
  }

  /* ---------- cycles carried along with z ----------
   * As z moves, the roots of p(x) = z move, and a cycle carried along with z lies over an arc that
   * the plane of x drags along with them. dragArcs moves the polylines arcs[a] (arrays of [x, y],
   * from the root ends[a][0] to the root ends[a][1]) by an isotopy of the plane that takes the roots
   * from to the roots to, in steps short next to the distances between the roots. In each step a
   * point x moves by the similarity x ↦ αx + β that best takes the roots where they go, weighted by
   * 1/|x − root|⁴ (moving least squares): near a root it moves with it, and round two roots that
   * turn about each other (as when z goes round a critical value) the plane turns with them, so that
   * arcs are carried round without twisting. The polylines are refined where they stretch, so that
   * each segment stays short next to its distance from the roots (and at most 8 unit long), and
   * thinned where they crowd (below unit/2). */
  function dragArcs(arcs, ends, from, to, unit) {
    const m = from.length;
    let disp = 0, sep = Infinity;
    for (let k = 0; k < m; k++) {
      disp = Math.max(disp, Math.hypot(to[k][0] - from[k][0], to[k][1] - from[k][1]));
      for (let l = k + 1; l < m; l++) sep = Math.min(sep, Math.hypot(from[k][0] - from[l][0], from[k][1] - from[l][1]), Math.hypot(to[k][0] - to[l][0], to[k][1] - to[l][1]));
    }
    if (!(disp > 0)) return arcs;
    const steps = Math.min(400, Math.max(1, Math.ceil(disp / (0.12 * sep))));
    const r = from.map((q) => [q[0], q[1]]);
    for (let s = 1; s <= steps; s++) {
      const d = r.map((q, k) => { const t = [from[k][0] + (to[k][0] - from[k][0]) * s / steps, from[k][1] + (to[k][1] - from[k][1]) * s / steps]; return [t[0] - q[0], t[1] - q[1]]; });
      const w = new Float64Array(m);
      for (const A of arcs) for (let i = 1; i < A.length - 1; i++) {
        const p = A[i];
        let W = 0, px = 0, py = 0, qx = 0, qy = 0, hit = -1;
        for (let k = 0; k < m; k++) {
          const dx = p[0] - r[k][0], dy = p[1] - r[k][1], q = dx * dx + dy * dy;
          if (q < 1e-300) { hit = k; break; }
          w[k] = 1 / (q * q); W += w[k];
          px += w[k] * r[k][0]; py += w[k] * r[k][1]; qx += w[k] * (r[k][0] + d[k][0]); qy += w[k] * (r[k][1] + d[k][1]);
        }
        if (hit >= 0) { p[0] += d[hit][0]; p[1] += d[hit][1]; continue; }
        px /= W; py /= W; qx /= W; qy /= W;
        // α = Σ w q̂ conj(p̂) / Σ w |p̂|², with p̂, q̂ the roots before and after less their centres
        let ar = 0, ai = 0, den = 0;
        for (let k = 0; k < m; k++) {
          const ux = r[k][0] - px, uy = r[k][1] - py, vx = r[k][0] + d[k][0] - qx, vy = r[k][1] + d[k][1] - qy;
          ar += w[k] * (vx * ux + vy * uy); ai += w[k] * (vy * ux - vx * uy); den += w[k] * (ux * ux + uy * uy);
        }
        if (den > 0) { ar /= den; ai /= den; } else { ar = 1; ai = 0; }
        const ex = p[0] - px, ey = p[1] - py;
        p[0] = qx + ar * ex - ai * ey; p[1] = qy + ar * ey + ai * ex;
      }
      r.forEach((q, k) => { q[0] += d[k][0]; q[1] += d[k][1]; });
      arcs.forEach((A, a) => { A[0] = r[ends[a][0]].slice(); A[A.length - 1] = r[ends[a][1]].slice(); });
      arcs.forEach((A, a) => tidyArc(A, ends[a], r, unit));
    }
    return arcs;
  }
  // The arcs pulled tight, like ropes round pegs at the roots: iters steps of smoothing (each point
  // towards the middle of its neighbours) in which no point comes nearer than a margin to a root,
  // the arc's own ends included but for the point next to each (a strand passing an end root must
  // not slide over it), the points spread evenly along each arc now and then. The margin is 12
  // unit, or less where roots are close; as no point jumps over a margin and segments stay shorter
  // than it, no arc crosses a root, and each keeps its class.
  // the margin round the roots of the ropes: 12 unit, or less where roots are close
  function ropeMargin(roots, unit) {
    let sep = Infinity;
    roots.forEach((a, k) => roots.forEach((b, l) => { if (k < l) sep = Math.min(sep, Math.hypot(a[0] - b[0], a[1] - b[1])); }));
    return Math.min(12 * unit, 0.35 * sep);
  }
  function tighten(arcs, ends, roots, unit, iters) {
    const mg = ropeMargin(roots, unit), sp = 0.8 * mg;
    arcs.forEach((A, a) => {
      const [e0, e1] = ends[a];
      // (free0, free1: the point is on the strand that ends at e0, at e1)
      const push = (p, free0, free1) => roots.forEach((r, k) => {
        if ((k === e0 && free0) || (k === e1 && free1)) return;
        const dx = p[0] - r[0], dy = p[1] - r[1], d = Math.hypot(dx, dy);
        if (d < mg) { const f = d > 0 ? mg / d : 1; p[0] = r[0] + (d > 0 ? dx * f : mg); p[1] = r[1] + dy * f; }
      });
      for (let i = 1; i < A.length - 1; i++) {
        // (the dragged arc: points near their own end roots, but on the strands that end there,
        // stay)
        const p = A[i], d0 = Math.hypot(p[0] - roots[e0][0], p[1] - roots[e0][1]), d1 = Math.hypot(p[0] - roots[e1][0], p[1] - roots[e1][1]);
        let along0 = 0, along1 = 0;
        for (let k = 1; k <= i; k++) along0 += Math.hypot(A[k][0] - A[k - 1][0], A[k][1] - A[k - 1][1]);
        for (let k = i + 1; k < A.length; k++) along1 += Math.hypot(A[k][0] - A[k - 1][0], A[k][1] - A[k - 1][1]);
        push(p, along0 <= 1.05 * d0 + 0.5 * mg, along1 <= 1.05 * d1 + 0.5 * mg);
      }
      let B = resample(A, sp);
      for (let it = 0; it < iters; it++) {
        if (it && it % 40 === 0) B = resample(B, sp);
        for (let i = 1; i < B.length - 1; i++) {
          const p = B[i];
          let dx = 0.5 * ((B[i - 1][0] + B[i + 1][0]) / 2 - p[0]), dy = 0.5 * ((B[i - 1][1] + B[i + 1][1]) / 2 - p[1]);
          const l = Math.hypot(dx, dy);
          if (l > 0.4 * mg) { dx *= 0.4 * mg / l; dy *= 0.4 * mg / l; }
          p[0] += dx; p[1] += dy;
          push(p, i <= 1, i >= B.length - 2);
        }
      }
      A.length = 0;
      B.forEach((q) => A.push(q));
    });
    return arcs;
  }
  // An arc pulled tight with the stretches where it lies round a root on the margin (the root's own
  // ends included, but for the strands that end there) drawn as exact circular arcs, a point every
  // 4°, from where it comes onto the circle to where it leaves, the way it goes round. A new array.
  function roundWraps(A, ends, roots, mg) {
    const n = A.length, at = new Array(n).fill(-1), acc = [0];
    for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(A[i][0] - A[i - 1][0], A[i][1] - A[i - 1][1]));
    for (let i = 1; i < n - 1; i++) roots.forEach((r, k) => {
      if (k === ends[0] && acc[i] < 2 * mg) return;
      if (k === ends[1] && acc[n - 1] - acc[i] < 2 * mg) return;
      if (Math.abs(Math.hypot(A[i][0] - r[0], A[i][1] - r[1]) - mg) < 0.15 * mg) at[i] = k;
    });
    const out = [];
    for (let i = 0; i < n;) {
      if (at[i] < 0) { out.push(A[i]); i++; continue; }
      let j = i;
      while (j + 1 < n - 1 && at[j + 1] === at[i]) j++;
      if (j === i) { out.push(A[i]); i++; continue; }
      const r = roots[at[i]];
      let ang = Math.atan2(A[i][1] - r[1], A[i][0] - r[0]), sweep = 0;
      for (let k = i + 1; k <= j; k++) sweep += turn(A[k - 1][0] - r[0], A[k - 1][1] - r[1], A[k][0] - r[0], A[k][1] - r[1]);
      const m = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 45)));
      for (let k = 0; k <= m; k++) { const a = ang + sweep * k / m; out.push([r[0] + mg * Math.cos(a), r[1] + mg * Math.sin(a)]); }
      i = j + 1;
    }
    return out;
  }
  // the polyline A with its points spread evenly, at most sp apart, ends kept
  function resample(A, sp) {
    let L = 0;
    for (let i = 1; i < A.length; i++) L += Math.hypot(A[i][0] - A[i - 1][0], A[i][1] - A[i - 1][1]);
    const n = Math.max(2, Math.min(400, Math.ceil(L / sp))), out = [A[0].slice()];
    let i = 1, acc = 0, prev = A[0];
    for (let k = 1; k < n; k++) {
      const want = L * k / n;
      while (i < A.length) {
        const seg = Math.hypot(A[i][0] - prev[0], A[i][1] - prev[1]);
        if (acc + seg >= want) { const t = seg > 0 ? (want - acc) / seg : 0; out.push([prev[0] + (A[i][0] - prev[0]) * t, prev[1] + (A[i][1] - prev[1]) * t]); break; }
        acc += seg; prev = A[i]; i++;
      }
    }
    out.push(A[A.length - 1].slice());
    return out;
  }
  // the length a segment of an arc may have at the point q: short next to its distance from the
  // roots (other than the arc's own ends, near them), between unit/2 and 8 unit
  function segLimit(q, roots, skip, unit) {
    let dm = Infinity;
    roots.forEach((r, k) => { if (k !== skip) dm = Math.min(dm, Math.hypot(q[0] - r[0], q[1] - r[1])); });
    return Math.max(0.5 * unit, Math.min(8 * unit, 0.3 * dm));
  }
  function tidyArc(A, ends, roots, unit) {
    const out = [A[0]];
    for (let i = 1; i < A.length && out.length < 6000; i++) {
      const a = out[out.length - 1], b = A[i], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const skip = i === 1 ? ends[0] : i === A.length - 1 ? ends[1] : -1;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), lim = segLimit(mid, roots, skip, unit);
      if (L > lim) {
        const n = Math.min(64, Math.ceil(L / lim));
        for (let k = 1; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
        out.push(b);
      } else if (i < A.length - 1 && out.length > 1 && Math.hypot(A[i + 1][0] - a[0], A[i + 1][1] - a[1]) < 0.5 * lim) {
        // (b dropped: its neighbours are close enough)
      } else out.push(b);
    }
    A.length = 0;
    out.forEach((q) => A.push(q));
    return A;
  }

  const eye = (m) => Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => +(i === j)));
  // the inverse of an integer matrix of determinant ±1 (Gauss–Jordan, rounded)
  function inverse(M) {
    const m = M.length, A = M.map((r, i) => r.concat(eye(m)[i]));
    for (let c = 0; c < m; c++) {
      let p = c;
      for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      const d = A[c][c];
      for (let k = 0; k < 2 * m; k++) A[c][k] /= d;
      for (let r = 0; r < m; r++) if (r !== c && A[r][c]) { const f = A[r][c]; for (let k = 0; k < 2 * m; k++) A[r][k] -= f * A[c][k]; }
    }
    return A.map((r) => r.slice(m).map((x) => Math.round(x) || 0));
  }
  const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0) || 0));
  const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));

  root.Lefschetz = { TAU, cdiv, csqrt, turn, evalPD, poly, critFor, roots, newton, lift, arcOf, nearest, unit, gram, niceSigns, eps, plApply, monodromy, sweep, append, crossings, jump, teardrop, dragArcs, tighten, ropeMargin, roundWraps, eye, inverse, matmul, transpose };
})(typeof globalThis !== 'undefined' ? globalThis : this);
