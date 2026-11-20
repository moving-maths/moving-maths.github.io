// Independent checks of the mathematics in content/picard-lefschetz-formula/lefschetz.js: the
// polynomial and its roots, the vanishing cycles along straight paths, the intersection forms, the
// Picard–Lefschetz operators and the loop words, and the basis of straight paths as z moves: its
// jumps across Stokes rays, checked against the arcs themselves (for n = 1 by the roots at their
// ends, for n = 2 by intersection numbers counted on the curve y² = z − p(x)), and against the
// formula after z has gone round a critical value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/picard-lefschetz-formula/lefschetz.js';

const L = globalThis.Lefschetz, TAU = 2 * Math.PI;
// the page's critical points
const DEFAULTS = {
  2: [[-0.378, 0.655], [0.378, -0.655]],
  3: [[-0.918, -0.239], [0.1, -0.241], [0.818, 0.48]],
  4: [[-0.968, 0.263], [-0.444, -0.263], [0.444, -0.263], [0.968, 0.263]],
  5: [[-0.826, 0.596], [-0.709, 0.029], [-0.107, -0.399], [0.628, -0.33], [1.013, 0.103]],
};
const base = (P) => [0, -1.35 * Math.max(...P.vals.map((v) => Math.hypot(v[0], v[1])))];
const out = [0, 0, 0, 0];
const pAt = (P, x) => { L.evalPD(P, x[0], x[1], out); return [out[0], out[1]]; };

// The reference basis at z0, as the page makes it: the lifts of the straight paths, oriented.
function reference(P, z0, rts) {
  const raw = P.vals.map((v, j) => {
    const r = Math.sqrt(Math.hypot(z0[0] - v[0], z0[1] - v[1])), ph = Math.atan2(z0[1] - v[1], z0[0] - v[0]);
    const A = L.lift(P, j, [z0[0], z0[1], v[0], v[1]], [1, 0], [r * Math.cos(ph / 2), r * Math.sin(ph / 2)], 0.004);
    const kp = A.plus.length - 2, km = A.minus.length - 2;
    return { A, p: L.nearest(rts, A.plus[kp], A.plus[kp + 1]), q: L.nearest(rts, A.minus[km], A.minus[km + 1]) };
  });
  const f = L.niceSigns(raw.map((c) => ({ p: c.p, q: c.q, e: c.A.e })), rts);
  return raw.map((c, j) => ({ p: f.f1[j] > 0 ? c.p : c.q, q: f.f1[j] > 0 ? c.q : c.p, e: [c.A.e[0] * f.f2[j], c.A.e[1] * f.f2[j]], A: c.A, flip: f.f1[j] < 0, f2: f.f2[j] }));
}
const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
function det(M) {
  const A = M.map((r) => r.slice()), n = A.length;
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (!A[p][c]) return 0;
    if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; d = -d; }
    d *= A[c][c];
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; }
  }
  return Math.round(d);
}

test('the polynomial: critical points, critical values centred, a = p″/2, roots', () => {
  for (const mu of [2, 3, 4, 5]) {
    const P = L.poly(DEFAULTS[mu]);
    P.crit.forEach((c, j) => {
      L.evalPD(P, c[0], c[1], out);
      assert.ok(Math.hypot(out[2], out[3]) < 1e-12, 'p′(c) = 0');
      assert.ok(Math.hypot(out[0] - P.vals[j][0], out[1] - P.vals[j][1]) < 1e-12);
      // p(c + t) − p(c) ≈ a t²
      const t = 1e-4, v = pAt(P, [c[0] + t, c[1]]);
      const a = [(v[0] - P.vals[j][0]) / (t * t), (v[1] - P.vals[j][1]) / (t * t)];
      assert.ok(Math.hypot(a[0] - P.a[j][0], a[1] - P.a[j][1]) < 1e-3 * (1 + Math.hypot(...P.a[j])));
    });
    const m = P.vals.reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]);
    assert.ok(Math.hypot(...m) < 1e-12);
    for (const w of [[0.3, -0.7], [-1, 2], [2.5, 0.1]]) {
      const r = L.roots(P, w[0], w[1]);
      assert.equal(r.length, mu + 1);
      r.forEach((x) => { const y = pAt(P, x); assert.ok(Math.hypot(y[0] - w[0], y[1] - w[1]) < 1e-10); });
    }
  }
});

test('the reference basis: arcs through the critical points between roots, a tree, the forms of A_μ', () => {
  for (const mu of [2, 3, 4, 5]) {
    const P = L.poly(DEFAULTS[mu]), z0 = base(P), rts = L.roots(P, z0[0], z0[1]), cyc = reference(P, z0, rts);
    cyc.forEach((c, j) => {
      assert.notEqual(c.p, c.q);
      // the arc passes through c_j, and every point of it maps onto the straight path
      const pts = L.arcOf(c.A).pts;
      assert.ok(pts.some((_, k) => k % 2 === 0 && Math.hypot(pts[k] - P.crit[j][0], pts[k + 1] - P.crit[j][1]) < 1e-12));
      for (let k = 0; k < pts.length; k += 2) {
        const w = pAt(P, [pts[k], pts[k + 1]]), v = P.vals[j];
        const cr = (w[0] - z0[0]) * (v[1] - z0[1]) - (w[1] - z0[1]) * (v[0] - z0[0]);
        assert.ok(Math.abs(cr) < 1e-8, 'on the path');
      }
    });
    const S1 = L.gram(1, cyc), S2 = L.gram(2, cyc), S3 = L.gram(3, cyc);
    // n = 1: symmetric, 2 on the diagonal, the Gram matrix of a basis of the root lattice of A_μ
    assert.equal(det(S1), mu + 1);
    // the page's bases are chains, with −1 between neighbours (the Cartan matrix)
    for (let i = 0; i < mu; i++) for (let j = 0; j < mu; j++) assert.equal(S1[i][j], i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0);
    for (let i = 0; i < mu; i++) for (let j = 0; j < mu; j++) {
      // (=== takes −0 for 0)
      assert.ok(S3[i][j] === -S1[i][j]);
      assert.ok(S2[i][j] === -S2[j][i]);
      if (i < j) assert.ok(S2[i][j] === -S1[i][j]);
    }
  }
});

test('the Picard–Lefschetz operators preserve the forms; reflections for odd n', () => {
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const mu of [2, 3, 4, 5]) {
    const P = L.poly(DEFAULTS[mu]), z0 = base(P), cyc = reference(P, z0, L.roots(P, z0[0], z0[1]));
    for (const n of [1, 2, 3]) {
      const S = L.gram(n, cyc);
      for (let t = 0; t < 10; t++) {
        const w = [];
        for (let k = 0; k < 6; k++) L.append(w, Math.floor(rnd() * mu), rnd() < 0.5 ? 1 : -1);
        const H = L.monodromy(S, n, w);
        assert.deepEqual(mul(tr(H), mul(S, H)), S);
      }
      for (let i = 0; i < mu; i++) {
        assert.deepEqual(L.monodromy(S, n, [[i, 1], [i, -1]]), eye(mu));
        if (n % 2) assert.deepEqual(L.monodromy(S, n, [[i, 1], [i, 1]]), eye(mu));
        // h_i(Δ_i) = −Δ_i for odd n, Δ_i for even n
        const H = L.monodromy(S, n, [[i, 1]]);
        assert.equal(H[i][i], n % 2 ? -1 : 1);
      }
    }
  }
});

test('loops: the segment from z0 sweeps each critical value once per loop round it', () => {
  for (const mu of [2, 3, 4, 5]) {
    const P = L.poly(DEFAULTS[mu]), z0 = base(P);
    const travel = (pts) => { const w = []; let z = z0; for (const b of pts) { for (const [i, s] of L.sweep(z0, z, b, P.vals)) L.append(w, i, s); z = b; } return w; };
    P.vals.forEach((v, i) => {
      for (const s of [1, -1]) {
        const d = Math.hypot(v[0] - z0[0], v[1] - z0[1]), u = [(z0[0] - v[0]) / d, (z0[1] - v[1]) / d], a0 = Math.atan2(u[1], u[0]), r = 0.1;
        const pts = [[v[0] + u[0] * r, v[1] + u[1] * r]];
        for (let q = 1; q <= 40; q++) pts.push([v[0] + r * Math.cos(a0 + s * TAU * q / 40), v[1] + r * Math.sin(a0 + s * TAU * q / 40)]);
        pts.push(z0);
        assert.deepEqual(travel(pts), [[i, s]]);
      }
    });
    // a circle round all of them, counterclockwise from z0 at the bottom: τ_μ ⋯ τ_1
    const R = Math.hypot(...z0), all = [];
    for (let q = 1; q <= 200; q++) all.push([R * Math.cos(-Math.PI / 2 + TAU * q / 200), R * Math.sin(-Math.PI / 2 + TAU * q / 200)]);
    const w = travel(all);
    assert.deepEqual(w, P.vals.map((_, i) => [mu - 1 - i, 1]));
    // the classical monodromy: order μ + 1 for odd n (no fixed vector), order μ + 1 or 2(μ + 1) for n = 2
    const cyc = reference(P, z0, L.roots(P, z0[0], z0[1]));
    for (const n of [1, 2, 3]) {
      const H = L.monodromy(L.gram(n, cyc), n, w), order = n % 2 || (mu + 1) % 2 === 0 ? mu + 1 : 2 * (mu + 1);
      let Q = eye(mu);
      for (let k = 1; k <= order; k++) { Q = mul(Q, H); if (k < order) assert.notDeepEqual(Q, eye(mu)); }
      assert.deepEqual(Q, eye(mu));
    }
  }
});

/* ---------- the basis of straight paths as z moves ---------- */
// The page's bookkeeping: z in short steps; at each Stokes ray crossed, the jump; the roots followed.
function walker(mu) {
  const P = L.poly(DEFAULTS[mu]), z0 = base(P), rts = L.roots(P, z0[0], z0[1]), cyc = reference(P, z0, rts);
  const S = { 1: L.gram(1, cyc), 2: L.gram(2, cyc), 3: L.gram(3, cyc) };
  return { P, z0, z: z0.slice(), rts0: rts.map((q) => q.slice()), rts: rts.map((q) => q.slice()), cyc, S, B: { 1: L.eye(mu), 2: L.eye(mu), 3: L.eye(mu) } };
}
function follow(W, w) {
  const nw = L.roots(W.P, w[0], w[1], W.rts), used = new Set();
  W.rts = W.rts.map((q) => {
    let best = -1, d = Infinity;
    nw.forEach((r, k) => { if (!used.has(k)) { const e = Math.hypot(r[0] - q[0], r[1] - q[1]); if (e < d) { d = e; best = k; } } });
    used.add(best);
    return nw[best];
  });
}
function step(W, b) {
  const a = W.z;
  let k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
  W.P.vals.forEach((v) => { k = Math.max(k, Math.ceil(Math.abs(L.turn(a[0] - v[0], a[1] - v[1], b[0] - v[0], b[1] - v[1])) / (Math.PI / 6))); });
  for (let q = 1; q <= k; q++) {
    const c = q === k ? b.slice() : [a[0] + (b[0] - a[0]) * q / k, a[1] + (b[1] - a[1]) * q / k];
    for (const x of L.crossings(W.P.vals, W.z, c)) for (const n of [1, 2, 3]) L.jump(W.S[n], n, W.B[n], x.j, x.k, x.s);
    W.z = c;
    follow(W, c);
  }
}
// the roots at the ends of the j-th cycle of the basis, from its class for n = 1
function classEnds(W, j) {
  const v = new Map();
  W.B[1].forEach((row, k) => { const c = row[j]; if (!c) return; v.set(W.cyc[k].p, (v.get(W.cyc[k].p) || 0) + c); v.set(W.cyc[k].q, (v.get(W.cyc[k].q) || 0) - c); });
  let plus = null, minus = null;
  for (const [r, c] of v) { if (c === 1) plus = r; else if (c === -1) minus = r; else if (c) return null; }
  return { plus, minus };
}
// the ends of the arc of the straight path from z to z_j, as root identities
function arcEnds(W, j) {
  const v = W.P.vals[j], r = Math.sqrt(Math.hypot(W.z[0] - v[0], W.z[1] - v[1])), ph = Math.atan2(W.z[1] - v[1], W.z[0] - v[0]);
  const A = L.lift(W.P, j, [W.z[0], W.z[1], v[0], v[1]], [1, 0], [r * Math.cos(ph / 2), r * Math.sin(ph / 2)], 0.004);
  const kp = A.plus.length - 2, km = A.minus.length - 2;
  return new Set([L.nearest(W.rts, A.plus[kp], A.plus[kp + 1]), L.nearest(W.rts, A.minus[km], A.minus[km + 1])]);
}
// a loop round z_k: out to near it, once round counterclockwise (s = 1) or clockwise, back
function loopPts(W, k, s) {
  const v = W.P.vals[k], z0 = W.z0, d = Math.hypot(v[0] - z0[0], v[1] - z0[1]);
  let r = 0.3 * d;
  W.P.vals.forEach((w, j) => { if (j !== k) r = Math.min(r, 0.42 * Math.hypot(w[0] - v[0], w[1] - v[1])); });
  const u = [(z0[0] - v[0]) / d, (z0[1] - v[1]) / d], a0 = Math.atan2(u[1], u[0]), pts = [[v[0] + u[0] * r, v[1] + u[1] * r]];
  for (let q = 1; q <= 60; q++) pts.push([v[0] + r * Math.cos(a0 + s * TAU * q / 60), v[1] + r * Math.sin(a0 + s * TAU * q / 60)]);
  pts.push(z0.slice());
  return pts;
}

test('the basis of straight paths: its arcs end where its classes say, at every step', () => {
  for (const mu of [2, 3, 4, 5]) {
    const W = walker(mu);
    for (let k = 0; k < mu; k++) for (const s of [1, -1]) for (const b of loopPts(W, k, s)) {
      step(W, b);
      for (let j = 0; j < mu; j++) {
        const e = classEnds(W, j), ends = arcEnds(W, j);
        assert.ok(e && ends.has(e.plus) && ends.has(e.minus), `μ = ${mu}, Δ${j + 1} after part of a loop round z${k + 1}`);
      }
    }
  }
});

test('once round z_k and back: the cycles carried are h_k of those taken, for n = 1, 2, 3', () => {
  for (const mu of [2, 3, 4, 5]) for (let k = 0; k < mu; k++) for (const s of [1, -1]) {
    const W = walker(mu);
    for (const b of loopPts(W, k, s)) step(W, b);
    // back at z0, each cycle is the one taken there or its negative (for odd n, Δ_k has turned round)
    const D = W.cyc.map((c, j) => { const e = classEnds(W, j), at = W.rts[e.plus]; return Math.hypot(at[0] - W.rts0[c.q][0], at[1] - W.rts0[c.q][1]) < Math.hypot(at[0] - W.rts0[c.p][0], at[1] - W.rts0[c.p][1]) ? -1 : 1; });
    for (const n of [1, 2, 3]) {
      const Bn = W.B[n].map((r) => r.map((x, j) => (n % 2 ? x * D[j] : x) || 0));
      assert.deepEqual(L.inverse(Bn), L.monodromy(W.S[n], n, [[k, s]]), `μ = ${mu}, n = ${n}, round z${k + 1} ${s > 0 ? 'counterclockwise' : 'clockwise'}`);
    }
  }
});

// The cycle over an arc pushed off the branch points: the lift of a thin loop round the arc (out
// along its left side on the outgoing sheet, round the + end, back along the right side) with the
// values of y along it; two such loops meet where they cross on a common sheet.
function thinLoop(P, z, A, delta, sign = 1) { return thinLoopOf(P, z, L.arcOf(A), delta, sign); }
function thinLoopOf(P, z, arc, delta, sign = 1) {
  const a = arc.pts, n = a.length / 2, pts = [];
  const nrm = (k) => { const i = Math.max(0, k - 1), j = Math.min(n - 1, k + 1), dx = a[2 * j] - a[2 * i], dy = a[2 * j + 1] - a[2 * i + 1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  const cap = (k, from) => { for (let q = 1; q < 24; q++) { const t = from - Math.PI * q / 24; pts.push([a[2 * k] + delta * Math.cos(t), a[2 * k + 1] + delta * Math.sin(t)]); } };
  for (let k = 1; k < n - 1; k++) { const [x, y] = nrm(k); pts.push([a[2 * k] + delta * x, a[2 * k + 1] + delta * y]); }
  { const [x, y] = nrm(n - 1); cap(n - 1, Math.atan2(y, x)); }
  for (let k = n - 2; k >= 1; k--) { const [x, y] = nrm(k); pts.push([a[2 * k] - delta * x, a[2 * k + 1] - delta * y]); }
  { const [x, y] = nrm(0); cap(0, Math.atan2(-y, -x)); }
  const ys = [];
  let y = [sign * arc.ys[2], sign * arc.ys[3]];
  for (const q of pts) {
    const w = pAt(P, q), [qr, qi] = L.csqrt(z[0] - w[0], z[1] - w[1]);
    y = qr * y[0] + qi * y[1] < 0 ? [-qr, -qi] : [qr, qi];
    ys.push(y);
  }
  return { pts, ys };
}
function meetLoops(A, B) {
  let v = 0;
  for (let i = 0; i < A.pts.length; i++) {
    const p = A.pts[i], q = A.pts[(i + 1) % A.pts.length];
    for (let k = 0; k < B.pts.length; k++) {
      const r = B.pts[k], s = B.pts[(k + 1) % B.pts.length];
      if (Math.max(p[0], q[0]) < Math.min(r[0], s[0]) || Math.max(r[0], s[0]) < Math.min(p[0], q[0])) continue;
      const rx = q[0] - p[0], ry = q[1] - p[1], sx = s[0] - r[0], sy = s[1] - r[1], den = rx * sy - ry * sx;
      if (!den) continue;
      const t = ((r[0] - p[0]) * sy - (r[1] - p[1]) * sx) / den, u = ((r[0] - p[0]) * ry - (r[1] - p[1]) * rx) / den;
      if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
      if (A.ys[i][0] * B.ys[k][0] + A.ys[i][1] * B.ys[k][1] > 0) v += Math.sign(den);
    }
  }
  return v;
}

test('n = 2: the reference arcs reproduce the intersection matrix on the curve y² = z − p(x)', () => {
  for (const mu of [2, 3]) {
    const P = L.poly(DEFAULTS[mu]), z0 = base(P), cyc = reference(P, z0, L.roots(P, z0[0], z0[1])), S2 = L.gram(2, cyc);
    const loops = cyc.map((c, k) => thinLoop(P, z0, c.flip ? { ...c.A, plus: c.A.minus, minus: c.A.plus } : c.A, 0.004 * (1 + 0.35 * k), c.f2));
    for (let a = 0; a < mu; a++) for (let b = 0; b < mu; b++) if (a !== b) assert.equal(meetLoops(loops[a], loops[b]), S2[a][b]);
  }
});

test('n = 2: across a Stokes ray the arc that jumps is h_k^{∓1} of the old one, counted on the curve', () => {
  // μ = 2: z moves from the left of the ray of z_2 for z_1 (from z_2 away from z_1) to its right,
  // counterclockwise round z_2. Just across it, compare the new arc of Δ_1 with the old cycles
  // carried there: the old Δ_1 is the lift of the path that goes round z_2 the old way.
  const P = L.poly(DEFAULTS[2]), v1 = P.vals[0], v2 = P.vals[1], u = [(v2[0] - v1[0]), (v2[1] - v1[1])], l = Math.hypot(...u);
  const e = [u[0] / l, u[1] / l], nrm = [-e[1], e[0]];
  const onRay = [v2[0] + 0.8 * e[0], v2[1] + 0.8 * e[1]], before = [onRay[0] - 0.05 * nrm[0], onRay[1] - 0.05 * nrm[1]], after = [onRay[0] + 0.05 * nrm[0], onRay[1] + 0.05 * nrm[1]];
  // which way is counterclockwise round z_2 here
  const s = Math.sign((before[0] - v2[0]) * (after[1] - v2[1]) - (before[1] - v2[1]) * (after[0] - v2[0]));
  const rts = L.roots(P, after[0], after[1]), mk = (path, j, Yph) => {
    const r = Math.sqrt(Math.hypot(after[0] - P.vals[j][0], after[1] - P.vals[j][1]));
    return L.lift(P, j, path, [1, 0], [r * Math.cos(Yph / 2), r * Math.sin(Yph / 2)], 0.003);
  };
  const ph = (j) => Math.atan2(after[1] - P.vals[j][1], after[0] - P.vals[j][0]);
  // the old cycles at `after`: Δ_2 along the straight path, Δ_1 along the path bent round z_2 on the side `before` was
  const bend = [v2[0] - 0.15 * s * nrm[0], v2[1] - 0.15 * s * nrm[1]];
  const old1 = mk([after[0], after[1], bend[0], bend[1], v1[0], v1[1]], 0, ph(0)), old2 = mk([after[0], after[1], v2[0], v2[1]], 1, ph(1));
  const new1 = mk([after[0], after[1], v1[0], v1[1]], 0, ph(0));
  const ends = (A) => { const kp = A.plus.length - 2, km = A.minus.length - 2; return { p: L.nearest(rts, A.plus[kp], A.plus[kp + 1]), q: L.nearest(rts, A.minus[km], A.minus[km + 1]), e: A.e }; };
  const cOld = [ends(old1), ends(old2)], S2 = L.gram(2, cOld);
  const L1 = thinLoop(P, after, old1, 0.004), L2 = thinLoop(P, after, old2, 0.0054), N1 = thinLoop(P, after, new1, 0.0068);
  assert.equal(meetLoops(L1, L2), S2[0][1]);
  // the new Δ_1 = h_2^{-s}(old Δ_1) = old Δ_1 + c ⟨old Δ_1, Δ_2⟩ Δ_2, up to sign
  const c = s < 0 ? L.eps(2) : -L.eps(2), want = [1, c * S2[0][1]];
  const got = [meetLoops(N1, L2), meetLoops(N1, L1)];
  // ⟨new, Δ_2⟩ = ⟨old, Δ_2⟩ (S2[1][1] = 0), ⟨new, old⟩ = c S2[0][1] S2[1][0]
  const pred = [want[0] * S2[0][1] + want[1] * S2[1][1], want[0] * S2[0][0] + want[1] * S2[1][0]];
  assert.ok((got[0] === pred[0] && got[1] === pred[1]) || (got[0] === -pred[0] && got[1] === -pred[1]), `got ${got}, want ±${pred}`);
});

test('teardrop: from z once round v counterclockwise, round no other critical value', () => {
  for (const mu of [2, 3, 4, 5]) {
    const P = L.poly(DEFAULTS[mu]), z0 = base(P);
    P.vals.forEach((v, k) => {
      const others = P.vals.filter((_, j) => j !== k), pts = L.teardrop(z0, v, others, 0.5, 0.01, 0.05);
      assert.deepEqual(pts[0], z0);
      assert.deepEqual(pts[pts.length - 1], z0);
      const wind = (q) => { let t = 0; for (let i = 1; i < pts.length; i++) t += L.turn(pts[i - 1][0] - q[0], pts[i - 1][1] - q[1], pts[i][0] - q[0], pts[i][1] - q[1]); return Math.round(t / TAU) || 0; };
      P.vals.forEach((w, j) => assert.equal(wind(w), j === k ? 1 : 0, `μ = ${mu}, round z${k + 1}: winding round z${j + 1}`));
    });
  }
});

// a polyline arc (array of [x, y]) with the values of y = √(z − p(x)) along it, continued from
// the branch nearest y0 at its second point, as arcOf gives them
function polyArc(P, z, line, y0) {
  const pts = [], ys = [];
  let y = y0;
  line.forEach((q, i) => {
    const w = pAt(P, q), [qr, qi] = L.csqrt(z[0] - w[0], z[1] - w[1]);
    if (i === 0) { pts.push(q[0], q[1]); ys.push(0, 0); return; }
    y = !y || qr * y[0] + qi * y[1] >= 0 ? [qr, qi] : [-qr, -qi];
    pts.push(q[0], q[1]); ys.push(y[0], y[1]);
  });
  return { pts, ys };
}
const thinLoopArc = (P, z, arc, delta) => thinLoopOf(P, z, arc, delta, 1);

test('carried round z_k, the arcs dragged along with the roots are the cycles h_k(Δ_j) (n = 2, counted on the curve)', () => {
  for (const mu of [2, 3, 4]) for (let k = 0; k < mu; k++) for (const s of [1, -1]) {
    const W = walker(mu), v = W.P.vals[k];
    // the arcs of the basis at z0, from their − ends to their + ends
    const arcs = W.cyc.map((c) => {
      const a = L.arcOf(c.A).pts, line = [];
      for (let i = 0; i < a.length; i += 2) line.push([a[i], a[i + 1]]);
      if (c.flip) line.reverse();
      line[0] = W.rts[c.q].slice(); line[line.length - 1] = W.rts[c.p].slice();
      return line;
    });
    const ends = W.cyc.map((c) => [c.q, c.p]);
    let pts = L.teardrop(W.z0, v, W.P.vals.filter((_, j) => j !== k), 0.4, 0.02, 0.05);
    if (s < 0) pts = pts.reverse();
    for (const b of pts.slice(1)) {
      const old = W.rts.map((q) => q.slice());
      step(W, b);
      L.dragArcs(arcs, ends, old, W.rts, 0.002);
    }
    // each dragged arc keeps away from the roots other than its ends
    arcs.forEach((line, j) => line.slice(1, -1).forEach((q) => W.rts.forEach((r, i) => {
      if (i !== ends[j][0] && i !== ends[j][1]) assert.ok(Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-3, 'an arc ran into a root');
    })));
    // ⟨carried Δ_j, Δ_i⟩ on the curve against the formula, up to the sign of the carried cycle; and
    // again with the arcs pulled tight
    const S2 = W.S[2], H = L.monodromy(S2, 2, [[k, s]]);
    const straight = W.cyc.map((c, i) => thinLoop(W.P, W.z0, c.flip ? { ...c.A, plus: c.A.minus, minus: c.A.plus } : c.A, 0.0031 * (1 + 0.21 * i), c.f2));
    const tight = L.tighten(arcs.map((A) => A.map((q) => q.slice())), ends, W.rts, 0.004, 1500);
    for (const lines of [arcs, tight]) lines.forEach((line, j) => {
      const y0 = L.csqrt(W.z0[0] - pAt(W.P, line[1])[0], W.z0[1] - pAt(W.P, line[1])[1]);
      const loop = thinLoopArc(W.P, W.z0, polyArc(W.P, W.z0, line, y0), 0.0023);
      const got = straight.map((Lp) => meetLoops(loop, Lp)), want = S2.map((_, i) => H.reduce((t, row, l) => t + row[j] * S2[l][i], 0));
      const neg = want.map((x) => -x || 0);
      assert.ok(JSON.stringify(got) === JSON.stringify(want) || JSON.stringify(got) === JSON.stringify(neg), `μ = ${mu}, round z${k + 1} ${s > 0 ? '+' : '−'}: Δ${j + 1} meets the basis ${got}, want ±${want}`);
    });
  }
});

test('the basis at z oriented along the segment from z0 (odd n: −Δ_i where the segment sweeps z_i): after a loop, B⁻¹ = h_k anywhere near z0', () => {
  for (const mu of [2, 3, 4, 5]) for (let k = 0; k < mu; k++) for (const s of [1, -1]) for (const end of [[0, 0], [0.03, 0.02], [-0.04, -0.03]]) {
    const W = walker(mu);
    let pts = L.teardrop(W.z0, W.P.vals[k], W.P.vals.filter((_, j) => j !== k), 0.4, 0.02, 0.05);
    if (s < 0) pts = pts.reverse();
    pts.push([W.z0[0] + end[0], W.z0[1] + end[1]]);
    for (const b of pts.slice(1)) {
      const a = W.z.slice();
      step(W, b);
      for (const [i] of L.sweep(W.z0, a, b, W.P.vals)) for (const n of [1, 3]) W.B[n].forEach((r) => { r[i] = -r[i] || 0; });
    }
    for (const n of [1, 2, 3]) assert.deepEqual(L.inverse(W.B[n]), L.monodromy(W.S[n], n, [[k, s]]), `μ = ${mu}, n = ${n}, round z${k + 1} ${s > 0 ? '+' : '−'}, ending at z0 + ${end}`);
    // and its arcs end where its classes say
    for (let j = 0; j < mu; j++) { const e = classEnds(W, j), ends = arcEnds(W, j); assert.ok(e && ends.has(e.plus) && ends.has(e.minus)); }
  }
});

test('critFor: the critical points for given critical values, by small moves of one of them', () => {
  for (const mu of [2, 3, 4, 5]) {
    let crit = DEFAULTS[mu].map((c) => c.slice()), shift = [0, 0];
    const mean = (cs) => [cs.reduce((t, c) => t + c[0], 0) / mu, cs.reduce((t, c) => t + c[1], 0) / mu];
    const m0 = mean(crit);
    for (let j = 0; j < mu; j++) {
      const target = L.poly(crit, shift).vals.map((v) => v.slice());
      for (let k = 0; k < 10; k++) {
        target[j] = [target[j][0] + 0.02, target[j][1] - 0.015];
        const r = L.critFor(crit, shift, target);
        assert.ok(r, `μ = ${mu}, moving z${j + 1}`);
        crit = r.crit; shift = r.shift;
      }
      const P = L.poly(crit, shift);
      P.vals.forEach((v, i) => assert.ok(Math.hypot(v[0] - target[i][0], v[1] - target[i][1]) < 1e-10, 'the values are where they were sent'));
      P.crit.forEach((c) => { L.evalPD(P, c[0], c[1], out); assert.ok(Math.hypot(out[2], out[3]) < 1e-9); });
      const m = mean(crit);
      assert.ok(Math.hypot(m[0] - m0[0], m[1] - m0[1]) < 1e-12, 'the mean of the critical points is kept');
    }
  }
});

test('three times round z_k: the arcs dragged and pulled tight are h_k³(Δ_j) (n = 2, counted on the curve)', () => {
  for (const [mu, k] of [[2, 0], [3, 1], [4, 2]]) {
    const W = walker(mu), v = W.P.vals[k];
    const arcs = W.cyc.map((c) => {
      const a = L.arcOf(c.A).pts, line = [];
      for (let i = 0; i < a.length; i += 2) line.push([a[i], a[i + 1]]);
      if (c.flip) line.reverse();
      line[0] = W.rts[c.q].slice(); line[line.length - 1] = W.rts[c.p].slice();
      return line;
    });
    const ends = W.cyc.map((c) => [c.q, c.p]), one = L.teardrop(W.z0, v, W.P.vals.filter((_, j) => j !== k), 0.4, 0.02, 0.05).slice(1);
    for (const b of one.concat(one, one)) { const old = W.rts.map((q) => q.slice()); step(W, b); L.dragArcs(arcs, ends, old, W.rts, 0.002); }
    const S2 = W.S[2], H = L.monodromy(S2, 2, [[k, 1], [k, 1], [k, 1]]);
    const straight = W.cyc.map((c, i) => thinLoop(W.P, W.z0, c.flip ? { ...c.A, plus: c.A.minus, minus: c.A.plus } : c.A, 0.0031 * (1 + 0.21 * i), c.f2));
    const tight = L.tighten(arcs.map((A) => A.map((q) => q.slice())), ends, W.rts, 0.004, 3000);
    // (and with the wraps round the roots made circular arcs, as drawn)
    const round = tight.map((A, j) => L.roundWraps(A, ends[j], W.rts, L.ropeMargin(W.rts, 0.004)));
    for (const lines of [arcs, tight, round]) lines.forEach((line, j) => {
      const y0 = L.csqrt(W.z0[0] - pAt(W.P, line[1])[0], W.z0[1] - pAt(W.P, line[1])[1]);
      const loop = thinLoopArc(W.P, W.z0, polyArc(W.P, W.z0, line, y0), 0.0017);
      const got = straight.map((Lp) => meetLoops(loop, Lp)), want = S2.map((_, i) => H.reduce((t, row, l) => t + row[j] * S2[l][i], 0));
      const neg = want.map((x) => -x || 0);
      assert.ok(JSON.stringify(got) === JSON.stringify(want) || JSON.stringify(got) === JSON.stringify(neg), `μ = ${mu}, three times round z${k + 1} (${lines === arcs ? 'dragged' : lines === tight ? 'tight' : 'rounded'}): Δ${j + 1} meets the basis ${got}, want ±${want}`);
    });
  }
});

test('the monodromy builds up over the moves of z: round z_a, a nudge, round z_b gives h_b h_a (n = 1, 2, 3)', () => {
  for (const mu of [3, 4]) for (const [a, b] of [[0, 1], [1, 0], [0, 0], [mu - 1, 1]]) {
    const W = walker(mu), others = (k) => W.P.vals.filter((_, j) => j !== k);
    const go = (pts) => { for (const p of pts) { const q = W.z.slice(); step(W, p); for (const [i] of L.sweep(W.z0, q, p, W.P.vals)) for (const n of [1, 3]) W.B[n].forEach((r) => { r[i] = -r[i] || 0; }); } };
    go(L.teardrop(W.z, W.P.vals[a], others(a), 0.4, 0.02, 0.05).slice(1));
    go([[W.z[0] + 0.03, W.z[1] + 0.01]]);
    for (const n of [1, 2, 3]) assert.deepEqual(L.inverse(W.B[n]), L.monodromy(W.S[n], n, [[a, 1]]), `after the nudge, n = ${n}`);
    go(L.teardrop(W.z, W.P.vals[b], others(b), 0.4, 0.02, 0.05).slice(1));
    for (const n of [1, 2, 3]) assert.deepEqual(L.inverse(W.B[n]), L.monodromy(W.S[n], n, [[a, 1], [b, 1]]), `μ = ${mu}, n = ${n}, round z${a + 1} then z${b + 1}`);
  }
});

test('odd n, k times round z_a: B⁻¹ = h_aᵏ = h_a^{k mod 2}, and the arcs carried end where the classes say (n = 1, 3)', () => {
  for (const mu of [3, 4]) for (let a = 0; a < mu; a++) {
    const W = walker(mu), others = W.P.vals.filter((_, j) => j !== a);
    const arcs = W.cyc.map((c) => { const p = L.arcOf(c.A).pts, line = []; for (let i = 0; i < p.length; i += 2) line.push([p[i], p[i + 1]]); if (c.flip) line.reverse(); line[0] = W.rts[c.q].slice(); line[line.length - 1] = W.rts[c.p].slice(); return line; });
    const ends = W.cyc.map((c) => [c.q, c.p]);
    for (let k = 1; k <= 5; k++) {
      for (const b of L.teardrop(W.z, W.P.vals[a], others, 0.4, 0.02, 0.05).slice(1)) {
        const q = W.z.slice(), old = W.rts.map((r) => r.slice());
        step(W, b);
        for (const [i] of L.sweep(W.z0, q, b, W.P.vals)) for (const n of [1, 3]) W.B[n].forEach((r) => { r[i] = -r[i] || 0; });
        L.dragArcs(arcs, ends, old, W.rts, 0.002);
      }
      for (const n of [1, 3]) {
        const H = L.inverse(W.B[n]), word = Array.from({ length: k }, () => [a, 1]);
        assert.deepEqual(H, L.monodromy(W.S[n], n, word), `μ = ${mu}, n = ${n}, ${k} times round z${a + 1}`);
        assert.deepEqual(H, L.monodromy(W.S[n], n, k % 2 ? [[a, 1]] : []), `h² = 1 for odd n (μ = ${mu}, k = ${k})`);
      }
      // the class of each arc carried, [+ end] − [− end] in the roots followed, written in the basis
      // at z by its ends (classEnds), is what B⁻¹ says
      const H1 = L.inverse(W.B[1]);
      W.cyc.forEach((_, j) => {
        const want = new Map([[ends[j][1], 1], [ends[j][0], -1]]), got = new Map();
        H1.forEach((row, l) => { const c = row[j]; if (!c) return; const e = classEnds(W, l); got.set(e.plus, (got.get(e.plus) || 0) + c); got.set(e.minus, (got.get(e.minus) || 0) - c); });
        for (const [r, c] of got) if (!c) got.delete(r);
        assert.deepEqual([...got].sort(), [...want].sort(), `μ = ${mu}, ${k} times round z${a + 1}: the ends of Δ${j + 1} carried`);
      });
    }
  }
});
