// Amoebas of plane curves and their tropical limits: the mathematics, with no drawing.
//
// A curve is f(z, w) = Σ a_α z^i w^j over the lattice points α = (i, j) of the
// triangle dΔ = {i, j ≥ 0, i + j ≤ d}, with real coefficients a_α = σ_α t^{v_α}:
// a sign σ_α = ±1 and a height v_α. Its amoeba is drawn in the coordinates
//     Log_t(z, w) = (log|z|, log|w|) / log t,
// in which, as t → ∞, it shrinks onto the tropical curve of the heights: the
// corner locus of y ↦ max_α (v_α + ⟨α, y⟩), dual to the subdivision of dΔ that
// the upper faces of the lifted points (α, v_α) project to.
//
//   triangle(d)                 the lattice points of dΔ, as [i, j]
//   honeycomb(d, c)             heights that give a smooth tropical curve, centred
//   harnackSigns(d)             signs that make the curve a simple Harnack curve
//   subdivision(pts, v)         the upper faces of the lifted points, projected
//   tropical(pts, v, sub)       the dual tropical curve: vertices, edges, rays
//   region(pts, v, k, box)      where the monomial k dominates, clipped to a box
//   slices(pts, a, s, ys, N)    the amoeba row by row: for each y₂, the intervals
//                               of log|z| / log t over the roots of f(·, w)
//   roots(...)                  the roots of a polynomial (Aberth's method)
//   areaRatio(pts, v, sg, s)    the area of the amoeba, as a fraction of the largest
//   sampler(base, tol, min, max) where to work out a curve for a chart, finer where it bends
//
// Also used by test/amoebas.test.mjs, so it touches no DOM.
(function (G) {
  'use strict';

  const TAU = 2 * Math.PI;
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }

  /* ---------- the Newton polygon ---------- */

  function triangle(d) {
    const pts = [];
    for (let j = 0; j <= d; j++) for (let i = 0; i + j <= d; i++) pts.push([i, j]);
    return pts;
  }
  const isInterior = (p, d) => p[0] > 0 && p[1] > 0 && p[0] + p[1] < d;
  const interiorCount = (d) => (d > 2 ? (d - 1) * (d - 2) / 2 : 0);

  // c·(d(i + j) − (i² + ij + j²)): strictly concave, so its upper hull is the
  // triangulation of dΔ into d² unit triangles; symmetric under the triangle's
  // symmetries, with the corners at height 0.
  function honeycomb(d, c) {
    return triangle(d).map(([i, j]) => c * (d * (i + j) - (i * i + i * j + j * j)));
  }

  // Harnack's distribution of signs: −1 where i and j are both even, +1 otherwise.
  // With a convex triangulation, patchworking with it gives a simple Harnack
  // curve (Itenberg; Mikhalkin 2000), whose amoeba has the largest area.
  function harnackSigns(d) {
    return triangle(d).map(([i, j]) => (i % 2 === 0 && j % 2 === 0 ? -1 : 1));
  }

  /* ---------- the subdivision: upper faces of the lifted points ---------- */

  // 2D convex hull, counter-clockwise, of the indices `ids` of points `pts`,
  // without points in the middle of an edge.
  function hull2(pts, ids) {
    const P = ids.slice().sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
    if (P.length < 3) return P;
    const cross = (o, a, b) => (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
    const lower = [], upper = [];
    for (const p of P) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let k = P.length - 1; k >= 0; k--) { const p = P[k]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  // The faces of the upper hull of {(α, v_α)}: each face is the plane
  // v = c₀ + c₁ i + c₂ j that lies on or above every lifted point, the points on
  // it (`on`) and the vertices of its polygon (`poly`, counter-clockwise).
  // Points that are a vertex of no face lie below the roof: their monomial
  // dominates nowhere, tropically.
  function subdivision(pts, v, eps) {
    eps = eps || 1e-9;
    const n = pts.length, faces = [], seen = new Set();
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) {
      const [ia, ja] = pts[a], [ib, jb] = pts[b], [ic, jc] = pts[c];
      const det = (ib - ia) * (jc - ja) - (ic - ia) * (jb - ja);
      if (det === 0) continue;
      // the plane through the three lifted points
      const c1 = ((v[b] - v[a]) * (jc - ja) - (v[c] - v[a]) * (jb - ja)) / det;
      const c2 = ((ib - ia) * (v[c] - v[a]) - (ic - ia) * (v[b] - v[a])) / det;
      const c0 = v[a] - c1 * ia - c2 * ja;
      let ok = true;
      const on = [];
      for (let p = 0; p < n; p++) {
        const r = v[p] - (c0 + c1 * pts[p][0] + c2 * pts[p][1]);
        if (r > eps) { ok = false; break; }
        if (r > -eps) on.push(p);
      }
      if (!ok) continue;
      const k = on.join(',');
      if (seen.has(k)) continue;
      seen.add(k);
      faces.push({ plane: [c0, c1, c2], on, poly: hull2(pts, on) });
    }
    const isVertex = new Array(n).fill(false);
    for (const f of faces) for (const p of f.poly) isVertex[p] = true;
    // edges of the subdivision, each with the faces on either side
    const edges = new Map();
    faces.forEach((f, fi) => {
      for (let k = 0; k < f.poly.length; k++) {
        const p = f.poly[k], q = f.poly[(k + 1) % f.poly.length];
        const key = p < q ? p + '-' + q : q + '-' + p;
        if (!edges.has(key)) edges.set(key, { a: Math.min(p, q), b: Math.max(p, q), faces: [] });
        edges.get(key).faces.push(fi);
      }
    });
    return { faces, edges: Array.from(edges.values()), isVertex };
  }

  /* ---------- the tropical curve ---------- */

  // The corner locus of y ↦ max_α (v_α + ⟨α, y⟩). A face with plane
  // v = c₀ + c₁ i + c₂ j is dual to the vertex y = −(c₁, c₂), where all its
  // monomials tie; an inner edge of the subdivision to the segment between the
  // vertices of its two faces, an edge on the boundary of dΔ to a ray leaving
  // its face's vertex in the outward normal direction. Each edge has the
  // lattice length of its dual as its weight.
  function tropical(pts, v, sub) {
    sub = sub || subdivision(pts, v);
    const vertices = sub.faces.map((f) => [-f.plane[1], -f.plane[2]]);
    const edges = [], rays = [];
    // the centre of the polygon, to tell outward normals
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    cx /= pts.length; cy /= pts.length;
    for (const e of sub.edges) {
      const [ia, ja] = pts[e.a], [ib, jb] = pts[e.b];
      const w = gcd(ib - ia, jb - ja);
      if (e.faces.length === 2) {
        edges.push({ from: vertices[e.faces[0]], to: vertices[e.faces[1]], weight: w, dual: e, faces: e.faces.slice() });
      } else {
        // the outward normal of the edge (a, b) of the polygon
        let nx = jb - ja, ny = -(ib - ia);
        if (nx * ((ia + ib) / 2 - cx) + ny * ((ja + jb) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
        const l = Math.hypot(nx, ny);
        rays.push({ from: vertices[e.faces[0]], dir: [nx / l, ny / l], weight: w, dual: e, faces: e.faces.slice() });
      }
    }
    return { vertices, edges, rays, sub };
  }

  // the monomial that dominates at y (the index of the lattice point), among
  // the vertices of the subdivision
  function dominant(pts, v, isVertex, y) {
    let best = -1, bv = -Infinity;
    for (let k = 0; k < pts.length; k++) {
      if (isVertex && !isVertex[k]) continue;
      const val = v[k] + pts[k][0] * y[0] + pts[k][1] * y[1];
      if (val > bv) { bv = val; best = k; }
    }
    return best;
  }

  // The region where monomial k dominates, {y : v_k + ⟨α_k, y⟩ ≥ v_m + ⟨α_m, y⟩ ∀m},
  // clipped to the box [x0, x1] × [y0, y1]: a convex polygon (possibly empty).
  function region(pts, v, k, box) {
    let poly = [[box[0], box[2]], [box[1], box[2]], [box[1], box[3]], [box[0], box[3]]];
    for (let m = 0; m < pts.length && poly.length; m++) {
      if (m === k) continue;
      // keep a·y ≥ b with a = α_k − α_m, b = v_m − v_k
      const a0 = pts[k][0] - pts[m][0], a1 = pts[k][1] - pts[m][1], b = v[m] - v[k];
      if (a0 === 0 && a1 === 0) { if (b > 0) poly = []; continue; }
      const out = [];
      for (let q = 0; q < poly.length; q++) {
        const P = poly[q], Q = poly[(q + 1) % poly.length];
        const fp = a0 * P[0] + a1 * P[1] - b, fq = a0 * Q[0] + a1 * Q[1] - b;
        if (fp >= 0) out.push(P);
        if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); }
      }
      poly = out;
    }
    return poly;
  }

  function polygonArea(poly) {
    let s = 0;
    for (let k = 0; k < poly.length; k++) { const P = poly[k], Q = poly[(k + 1) % poly.length]; s += P[0] * Q[1] - P[1] * Q[0]; }
    return s / 2;
  }

  /* ---------- roots of a polynomial ---------- */

  // p'(z)/p(z) for p(z) = Σ_{i ≤ n} (pr[i] + i·pi[i]) z^i, evaluated by Horner's
  // rule in z where |z| ≤ 1 and in 1/z beyond, so that nothing overflows.
  function logDeriv(n, pr, pi, xr, xi, out) {
    const m2 = xr * xr + xi * xi;
    if (m2 <= 1) {
      let br = pr[n], bi = pi[n], cr = 0, ci = 0;
      for (let i = n - 1; i >= 0; i--) {
        const tcr = cr * xr - ci * xi + br, tci = cr * xi + ci * xr + bi;
        cr = tcr; ci = tci;
        const tbr = br * xr - bi * xi + pr[i], tbi = br * xi + bi * xr + pi[i];
        br = tbr; bi = tbi;
      }
      const m = br * br + bi * bi;
      if (m === 0) { out[0] = 1e300; out[1] = 0; return; }
      out[0] = (cr * br + ci * bi) / m; out[1] = (ci * br - cr * bi) / m;
    } else {
      // q(y) = Σ p_i y^{n−i} at y = 1/z; p'/p = y (n − y q'/q)
      const yr = xr / m2, yi = -xi / m2;
      let br = pr[0], bi = pi[0], cr = 0, ci = 0;
      for (let i = 1; i <= n; i++) {
        const tcr = cr * yr - ci * yi + br, tci = cr * yi + ci * yr + bi;
        cr = tcr; ci = tci;
        const tbr = br * yr - bi * yi + pr[i], tbi = br * yi + bi * yr + pi[i];
        br = tbr; bi = tbi;
      }
      const m = br * br + bi * bi;
      if (m === 0) { out[0] = 1e300; out[1] = 0; return; }
      const hr = (cr * br + ci * bi) / m, hi = (ci * br - cr * bi) / m;
      const tr = yr * hr - yi * hi, ti = yr * hi + yi * hr;
      const ur = n - tr, ui = -ti;
      out[0] = yr * ur - yi * ui; out[1] = yr * ui + yi * ur;
    }
  }

  // Starting points for the roots: on circles whose radii come from the Newton
  // polygon of the moduli of the coefficients (the upper hull of (i, log|p_i|)).
  function startRoots(n, pr, pi, zr, zi) {
    const L = [];
    for (let i = 0; i <= n; i++) L.push(Math.log(Math.hypot(pr[i], pi[i])));
    const hull = [];
    for (let i = 0; i <= n; i++) {
      if (!isFinite(L[i])) continue;
      while (hull.length >= 2) {
        const a = hull[hull.length - 2], b = hull[hull.length - 1];
        if ((L[b] - L[a]) * (i - a) <= (L[i] - L[a]) * (b - a)) hull.pop(); else break;
      }
      hull.push(i);
    }
    let k = 0;
    // a zero constant term: roots at 0, nudged apart
    for (let i = 0; i < hull[0]; i++, k++) { zr[k] = 1e-300 * (k + 1); zi[k] = 0; }
    for (let e = 0; e + 1 < hull.length; e++) {
      const a = hull[e], b = hull[e + 1], m = b - a;
      const r = Math.exp(-(L[b] - L[a]) / m);
      for (let q = 0; q < m; q++, k++) {
        const ang = TAU * q / m + 0.4 + 0.7 * e;
        zr[k] = r * Math.cos(ang); zi[k] = r * Math.sin(ang);
      }
    }
  }

  // Aberth's method, from the estimates in zr, zi. Returns the number of
  // sweeps, or −1 if it has not converged.
  const G2 = [0, 0];
  function aberth(n, pr, pi, zr, zi, maxIt) {
    for (let it = 0; it < maxIt; it++) {
      let done = true;
      for (let k = 0; k < n; k++) {
        const xr = zr[k], xi = zi[k];
        logDeriv(n, pr, pi, xr, xi, G2);
        let sr = 0, si = 0;
        for (let j = 0; j < n; j++) {
          if (j === k) continue;
          const dr = xr - zr[j], di = xi - zi[j], m = dr * dr + di * di;
          if (m === 0) continue;
          sr += dr / m; si -= di / m;
        }
        const ar = G2[0] - sr, ai = G2[1] - si, m = ar * ar + ai * ai;
        if (m === 0 || !isFinite(m)) continue;
        const wr = ar / m, wi = -ai / m;
        zr[k] = xr - wr; zi[k] = xi - wi;
        if (wr * wr + wi * wi > 1e-24 * (xr * xr + xi * xi)) done = false;
      }
      if (done) return it;
    }
    return -1;
  }

  function roots(n, pr, pi, zr, zi, warm) {
    if (!warm) startRoots(n, pr, pi, zr, zi);
    let it = aberth(n, pr, pi, zr, zi, warm ? 40 : 200);
    if (it < 0 && warm) { startRoots(n, pr, pi, zr, zi); it = aberth(n, pr, pi, zr, zi, 200); }
    return it;
  }

  /* ---------- the amoeba, slice by slice ---------- */

  // The amoeba's slices at heights y₂ ∈ ys (in Log_t units, s = log t): for
  // w = t^{y₂} e^{iθ}, θ = 2πk/N, the n roots z of f(·, w) = Σ_i p_i(w) z^i are
  // followed round the circle; each root's log|z| / s sweeps an interval, and
  // the slice of the amoeba is their union. A point x of the row outside every
  // interval has #{roots with |z| < t^x} = ν₁, the first coordinate of the
  // order of its complement component (Forsberg–Passare–Tsikh).
  //
  // terms: [{i, j, sign, h}] with a = sign · t^h; the roots in z, so `i` is the
  // degree. Swap i and j for the slices in the other direction.
  //
  // Returns { n, lo, hi, real }: lo, hi Float64Arrays of length ys.length·n, and
  // real: a list per row of [x, sign z, sign w] for the real roots at θ = 0, π.
  function slices(terms, s, ys, N, opts) {
    opts = opts || {};
    const n = terms.reduce((m, t) => Math.max(m, t.i), 0);
    const R = ys.length, lo = new Float64Array(R * n), hi = new Float64Array(R * n);
    const real = opts.real ? [] : null;
    const maxJ = terms.reduce((m, t) => Math.max(m, t.j), 0);
    // cos jθ, sin jθ
    const cs = new Float64Array(N * (maxJ + 1)), sn = new Float64Array(N * (maxJ + 1));
    for (let k = 0; k < N; k++) for (let j = 0; j <= maxJ; j++) { cs[k * (maxJ + 1) + j] = Math.cos(TAU * k * j / N); sn[k * (maxJ + 1) + j] = Math.sin(TAU * k * j / N); }
    const pr = new Float64Array(n + 1), pi = new Float64Array(n + 1);
    const zr = new Float64Array(n), zi = new Float64Array(n);
    const z0r = new Float64Array(n), z0i = new Float64Array(n);
    const A = new Float64Array(terms.length);
    let warmRow = false, fails = 0;
    const half = N % 2 === 0 ? N / 2 : -1;
    for (let r = 0; r < R; r++) {
      const y2 = ys[r];
      // the coefficients' sizes, scaled so that the largest is 1
      let S = -Infinity;
      for (const t of terms) S = Math.max(S, s * (t.h + t.j * y2));
      for (let q = 0; q < terms.length; q++) { const t = terms[q]; A[q] = t.sign * Math.exp(s * (t.h + t.j * y2) - S); }
      const lr = lo.subarray(r * n, r * n + n), hr = hi.subarray(r * n, r * n + n);
      lr.fill(Infinity); hr.fill(-Infinity);
      const realRow = real ? [] : null;
      for (let k = 0; k <= N; k++) {
        const kk = k % N;
        pr.fill(0); pi.fill(0);
        for (let q = 0; q < terms.length; q++) {
          const t = terms[q], c = kk * (maxJ + 1) + t.j;
          pr[t.i] += A[q] * cs[c]; pi[t.i] += A[q] * sn[c];
        }
        if (k === 0) {
          if (warmRow) { zr.set(z0r); zi.set(z0i); }
          if (roots(n, pr, pi, zr, zi, warmRow) < 0) fails++;
          z0r.set(zr); z0i.set(zi);
          warmRow = true;
        } else if (roots(n, pr, pi, zr, zi, true) < 0) fails++;
        for (let q = 0; q < n; q++) {
          const x = 0.5 * Math.log(zr[q] * zr[q] + zi[q] * zi[q]) / s;
          if (x < lr[q]) lr[q] = x;
          if (x > hr[q]) hr[q] = x;
        }
        if (realRow && (kk === 0 || kk === half) && k < N) {
          for (let q = 0; q < n; q++) {
            if (Math.abs(zi[q]) <= 1e-7 * Math.hypot(zr[q], zi[q])) {
              realRow.push([0.5 * Math.log(zr[q] * zr[q]) / s, Math.sign(zr[q]) || 1, kk === 0 ? 1 : -1]);
            }
          }
        }
      }
      if (real) real.push(realRow);
    }
    return { n, lo, hi, real, fails };
  }

  // The terms of f with coefficients σ t^h, from the points, heights and signs;
  // `swap` exchanges z and w.
  function terms(pts, v, sg, swap) {
    return pts.map((p, k) => ({ i: swap ? p[1] : p[0], j: swap ? p[0] : p[1], sign: sg[k], h: v[k] }));
  }

  // The union of the intervals [lo_q, hi_q] of one slice, sorted and merged.
  function merged(lo, hi, off, n) {
    const iv = [];
    for (let q = 0; q < n; q++) iv.push([lo[off + q], hi[off + q]]);
    iv.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const I of iv) {
      if (out.length && I[0] <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], I[1]);
      else out.push(I.slice());
    }
    return out;
  }

  // ν: the number of roots of the slice below x (meaningful outside the amoeba)
  function below(lo, hi, off, n, x) {
    let c = 0;
    for (let q = 0; q < n; q++) if (hi[off + q] < x) c++;
    return c;
  }
  function inside(lo, hi, off, n, x) {
    for (let q = 0; q < n; q++) if (lo[off + q] <= x && x <= hi[off + q]) return true;
    return false;
  }

  // The complement of the amoeba on the grid of the slices: rows at ys (roots in
  // z), columns at xs (roots in w). A grid point is in the amoeba if its row's or
  // its column's slice holds it; otherwise its order is (ν₁, ν₂), the numbers of
  // roots below it in its row and in its column. Returns an Int16Array (row by
  // row) of the index in `pts` of the order, or −1 in the amoeba, and the
  // indices that occur, each with a grid point of its component.
  function orders(rows, cols, ys, xs, pts) {
    const R = ys.length, C = xs.length, n1 = rows.n, n2 = cols.n;
    const idx = new Map();
    pts.forEach((p, k) => idx.set(p[0] + ',' + p[1], k));
    const raster = new Int16Array(R * C).fill(-1), seen = new Map();
    for (let r = 0; r < R; r++) {
      const ro = r * n1;
      for (let c = 0; c < C; c++) {
        const x = xs[c], y = ys[r], co = c * n2;
        if (inside(rows.lo, rows.hi, ro, n1, x) || inside(cols.lo, cols.hi, co, n2, y)) continue;
        const k = idx.get(below(rows.lo, rows.hi, ro, n1, x) + ',' + below(cols.lo, cols.hi, co, n2, y));
        if (k === undefined) continue;
        raster[r * C + c] = k;
        if (!seen.has(k)) seen.set(k, [x, y]);
      }
    }
    return { raster, seen };
  }

  // The area of the amoeba in the coordinates (log|z|, log|w|), from its slices
  // at rows ys (equally spaced), counting only x0 ≤ x ≤ x1 (in Log_t units).
  function area(rows, ys, s, x0, x1) {
    const R = ys.length, dy = R > 1 ? (ys[R - 1] - ys[0]) / (R - 1) : 0;
    let a = 0;
    for (let r = 0; r < R; r++) for (const I of merged(rows.lo, rows.hi, r * rows.n, rows.n)) a += Math.max(0, Math.min(I[1], x1) - Math.max(I[0], x0));
    return Math.abs(a * dy) * s * s;
  }

  // The area of the whole amoeba of the curve on the triangle dΔ, in the
  // coordinates (log|z|, log|w|), as a fraction of π² Area(dΔ), the largest it
  // can be. A row along a tentacle would count a band of the row's height where
  // the tentacle is thinner, so each part is measured across its tentacles: the
  // rows (roots in z) right of a line x = L left of the tropical curve, where the
  // tentacles run down or up and to the right, and the columns (roots in w)
  // left of it, where they run off to the left. `margin` (in units of log) is
  // how far beyond the tropical curve's vertices the window reaches; `n` rows
  // (by default the same for every log t, so that the area does not jump as
  // log t changes) and `N` arguments per circle (by default more for large log t,
  // where the amoeba is thinner).
  // areaPlan says which slices to take (rows at ys, columns at xs, with the
  // terms for each and N arguments per circle), areaFrom adds them up; a page
  // can take the slices a few at a time in between.
  // At log t = 0 (t = 1) every coefficient is ±1: the curve is the one with all
  // heights 0, at any log t, and is taken at log t = 1.
  function areaPlan(pts, v, sg, s, opts) {
    opts = opts || {};
    if (!(s > 0)) { v = v.map(() => 0); s = 1; }
    const margin = opts.margin || 14, n = opts.n || 1600, N = opts.N || (s > 5 ? 256 : 128);
    const d = pts.reduce((m, p) => Math.max(m, p[0] + p[1]), 0);
    const T = tropical(pts, v);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of T.vertices) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const m = margin / s, L = x0 - Math.min(m, 3 / s);
    const X0 = x0 - m, X1 = x1 + m, Y0 = y0 - m, Y1 = y1 + m;
    const grid = (a, b, k) => { const g = new Float64Array(k); for (let i = 0; i < k; i++) g[i] = a + (i + 0.5) * (b - a) / k; return g; };
    return {
      s, N, L, X1, Y0, Y1, full: Math.PI * Math.PI * d * d / 2,
      ys: grid(Y0, Y1, n), rowTerms: terms(pts, v, sg, false),
      xs: grid(X0, L, Math.max(8, Math.round(n * (L - X0) / (X1 - X0)))), colTerms: terms(pts, v, sg, true),
    };
  }
  function areaFrom(plan, rows, cols) {
    const a = area(rows, plan.ys, plan.s, plan.L, plan.X1) + area(cols, plan.xs, plan.s, plan.Y0, plan.Y1);
    return a / plan.full;
  }
  function areaRatio(pts, v, sg, s, opts) {
    const plan = areaPlan(pts, v, sg, s, opts);
    return areaFrom(plan, slices(plan.rowTerms, plan.s, plan.ys, plan.N), slices(plan.colTerms, plan.s, plan.xs, plan.N));
  }

  /* ---------- where to sample a curve ---------- */

  // The values of x at which to work out y = F(x) for a chart: first those of
  // `base`, then the midpoints of the intervals between them, and of the halves of
  // any interval whose midpoint lies more than `tol` off the chord, down to
  // intervals of width `min`, `max` values in all. (The area against log t rises
  // steeply to corners where the real curve changes, which a fixed grid would
  // round off.) next() gives the next x, or null when there is none; put(x, y)
  // gives F there, for the x that next() gave.
  function sampler(base, tol, min, max) {
    const y = new Map(), queue = base.slice(), checks = new Map();
    let asked = 0;
    const halve = (a, b) => {
      if (b - a <= 2 * min) return;
      const m = (a + b) / 2;
      queue.push(m);
      checks.set(m, [a, b]);
    };
    return {
      next: () => (queue.length && asked < max ? queue[0] : null),
      put(x, value) {
        if (queue[0] !== x) return;
        queue.shift();
        asked++;
        y.set(x, value);
        if (asked === base.length) for (let k = 0; k + 1 < base.length; k++) halve(base[k], base[k + 1]);
        const c = checks.get(x);
        if (c && Math.abs(value - (y.get(c[0]) + y.get(c[1])) / 2) > tol) { halve(c[0], x); halve(x, c[1]); }
      },
    };
  }

  G.Amoeba = {
    triangle, isInterior, interiorCount, honeycomb, harnackSigns,
    subdivision, tropical, dominant, region, polygonArea, gcd,
    roots, startRoots, aberth, logDeriv,
    slices, terms, merged, below, inside, orders, area, areaPlan, areaFrom, areaRatio, sampler,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
