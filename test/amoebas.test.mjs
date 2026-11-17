// Independent checks of the mathematics in content/amoebas/amoeba.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/amoebas/amoeba.js';

const A = globalThis.Amoeba;
const TAU = 2 * Math.PI;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const grid = (a, b, k) => Array.from({ length: k }, (_, i) => a + (i + 0.5) * (b - a) / k);

// f(z, w) for complex z, w given as [re, im], from the terms σ t^h z^i w^j
function evalF(pts, v, sg, s, z, w) {
  let re = 0, im = 0;
  const lz = Math.log(Math.hypot(...z)), az = Math.atan2(z[1], z[0]), lw = Math.log(Math.hypot(...w)), aw = Math.atan2(w[1], w[0]);
  pts.forEach((p, k) => {
    const m = sg[k] * Math.exp(s * v[k] + p[0] * lz + p[1] * lw), a = p[0] * az + p[1] * aw;
    re += m * Math.cos(a); im += m * Math.sin(a);
  });
  return [re, im];
}
// the winding number of θ ↦ g(θ) round 0, by summing the changes of argument
function winding(g, n) {
  let total = 0, prev = Math.atan2(...g(0).slice().reverse());
  for (let k = 1; k <= n; k++) {
    const q = g(TAU * k / n), a = Math.atan2(q[1], q[0]);
    let da = a - prev;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    total += da;
    prev = a;
  }
  return Math.round(total / TAU) + 0; // not −0
}

test('Aberth’s method finds roots of moduli far apart', () => {
  for (let trial = 0; trial < 300; trial++) {
    const n = 1 + Math.floor(rnd() * 4);
    // roots with log-moduli spread over ±40, and the polynomial they make
    const want = Array.from({ length: n }, () => { const r = Math.exp((rnd() - 0.5) * 80), a = rnd() * TAU; return [r * Math.cos(a), r * Math.sin(a)]; });
    let pr = [1], pi = [0];
    for (const [a, b] of want) {
      const nr = new Array(pr.length + 1).fill(0), ni = new Array(pr.length + 1).fill(0);
      for (let i = 0; i < pr.length; i++) {
        // (z − root) · Σ p_i z^i
        nr[i + 1] += pr[i]; ni[i + 1] += pi[i];
        nr[i] -= pr[i] * a - pi[i] * b; ni[i] -= pr[i] * b + pi[i] * a;
      }
      pr = nr; pi = ni;
    }
    const zr = new Float64Array(n), zi = new Float64Array(n);
    assert.ok(A.roots(n, Float64Array.from(pr), Float64Array.from(pi), zr, zi, false) >= 0, 'converges');
    for (const [a, b] of want) {
      const best = Math.min(...Array.from(zr, (x, k) => Math.hypot(x - a, zi[k] - b) / Math.hypot(a, b)));
      assert.ok(best < 1e-6, `root ${a}, ${b} found to ${best}`);
    }
  }
});

test('the amoeba of a line: each slice is [log|1 − t^y|, log(1 + t^y)] / log t', () => {
  const pts = A.triangle(1), v = [0, 0, 0], sg = [1, 1, 1];
  for (const s of [0.7, 1, 3, 8]) {
    const ys = [-2.3, -0.4, 0.31, 1.7], res = A.slices(A.terms(pts, v, sg, false), s, ys, 64);
    ys.forEach((y, r) => {
      const x = y * s;
      assert.ok(Math.abs(res.lo[r] - Math.log(Math.abs(1 - Math.exp(x))) / s) < 1e-9);
      assert.ok(Math.abs(res.hi[r] - Math.log(1 + Math.exp(x)) / s) < 1e-9);
    });
  }
});

test('a point is off the amoeba exactly when f has no zero over it', () => {
  // the slices say whether f(·, w) has a root with |z| = t^x for some arg w; check
  // against the torus over the point: zeros of f there change the winding number
  const d = 3, pts = A.triangle(d), v = A.honeycomb(d, 1), sg = A.harnackSigns(d), s = 2.5;
  const ys = grid(-3, 3, 11), rows = A.slices(A.terms(pts, v, sg, false), s, ys, 256);
  for (let r = 0; r < ys.length; r++) {
    for (const x of grid(-3, 3, 11)) {
      if (A.inside(rows.lo, rows.hi, r * rows.n, rows.n, x)) continue;
      // off the amoeba: the number of zeros inside |z| = t^x is the same for every arg w
      const counts = new Set();
      for (const aw of grid(0, TAU, 12)) {
        const w = [Math.exp(s * ys[r]) * Math.cos(aw), Math.exp(s * ys[r]) * Math.sin(aw)];
        counts.add(winding((a) => evalF(pts, v, sg, s, [Math.exp(s * x) * Math.cos(a), Math.exp(s * x) * Math.sin(a)], w), 2048));
      }
      assert.equal(counts.size, 1, `one count at (${x}, ${ys[r]})`);
      assert.equal([...counts][0], A.below(rows.lo, rows.hi, r * rows.n, rows.n, x), 'it is the number of roots below');
    }
  }
});

test('the orders of the complement are those of Forsberg, Passare and Tsikh, from the argument principle', () => {
  const d = 3, pts = A.triangle(d), v = A.honeycomb(d, 1), sg = A.harnackSigns(d), s = 3;
  const ys = grid(-3.5, 3.5, 70), xs = grid(-3.5, 3.5, 70);
  const rows = A.slices(A.terms(pts, v, sg, false), s, ys, 128), cols = A.slices(A.terms(pts, v, sg, true), s, xs, 128);
  const { raster, seen } = A.orders(rows, cols, ys, xs, pts);
  // every lattice point is an order here (a smooth Harnack curve with its hole open)
  assert.equal(seen.size, pts.length);
  for (const [k, [x, y]] of seen) {
    const nu1 = winding((a) => evalF(pts, v, sg, s, [Math.exp(s * x) * Math.cos(a), Math.exp(s * x) * Math.sin(a)], [Math.exp(s * y), 0]), 4096);
    const nu2 = winding((a) => evalF(pts, v, sg, s, [Math.exp(s * x), 0], [Math.exp(s * y) * Math.cos(a), Math.exp(s * y) * Math.sin(a)]), 4096);
    assert.deepEqual([nu1, nu2], pts[k], `the order at (${x}, ${y})`);
  }
  // the components of interior orders are bounded: they do not reach the edge of the window
  const C = xs.length;
  for (let q = 0; q < raster.length; q++) {
    const r = Math.floor(q / C), c = q % C, k = raster[q];
    if (k >= 0 && A.isInterior(pts[k], d)) assert.ok(r > 0 && c > 0 && r < ys.length - 1 && c < C - 1);
  }
});

test('terms taken out (height −∞): a conic without its terms in 1, w, w² is z times a line', () => {
  const pts = A.triangle(2), O = -Infinity, s = 2;
  // (0,0) (1,0) (2,0) (0,1) (1,1) (0,2); the line 1 − t^{1/2} z + t w, moved by z
  const v = [O, 0, 0.5, O, 1, O], sg = [1, 1, -1, 1, 1, 1];
  const line = A.triangle(1), lv = [0, 0.5, 1], lsg = [1, -1, 1];
  const N = A.newton(pts, v);
  assert.equal(N.area, 0.5);
  assert.deepEqual(N.inside, pts.map(() => false));
  assert.deepEqual(A.offset(pts, v), [1, 0]);
  assert.deepEqual(A.tropical(pts, v).vertices, A.tropical(line, lv).vertices);
  assert.ok(Math.abs(A.areaRatio(pts, v, sg, s) - A.areaRatio(line, lv, lsg, s)) < 1e-9);
  // the orders of the complement are the line's, moved by (1, 0), and agree with the argument principle
  const ys = grid(-3, 3, 40), xs = grid(-3, 3, 40);
  const rows = A.slices(A.terms(pts, v, sg, false), s, ys, 128), cols = A.slices(A.terms(pts, v, sg, true), s, xs, 128);
  const { seen } = A.orders(rows, cols, ys, xs, pts, v);
  assert.deepEqual([...seen.keys()].map((k) => pts[k]).sort(), [[1, 0], [1, 1], [2, 0]]);
  for (const [k, [x, y]] of seen) {
    const nu1 = winding((a) => evalF(pts, v, sg, s, [Math.exp(s * x) * Math.cos(a), Math.exp(s * x) * Math.sin(a)], [Math.exp(s * y), 0]), 4096);
    const nu2 = winding((a) => evalF(pts, v, sg, s, [Math.exp(s * x), 0], [Math.exp(s * y) * Math.cos(a), Math.exp(s * y) * Math.sin(a)]), 4096);
    assert.deepEqual([nu1, nu2], pts[k], `the order at (${x}, ${y})`);
  }
  // a cubic without its interior term keeps its Newton polygon, and the point inside it
  const p3 = A.triangle(3), v3 = A.honeycomb(3, 1), k = p3.findIndex((p) => p[0] === 1 && p[1] === 1);
  v3[k] = O;
  const N3 = A.newton(p3, v3);
  assert.equal(N3.area, 4.5);
  assert.ok(N3.inside[k] && N3.inside.filter(Boolean).length === 1);
  assert.ok(!A.subdivision(p3, v3).isVertex[k]);
  // terms on a line: no polygon
  assert.equal(A.newton(line, [0, 0, O]).area, 0);
});

test('the amoeba lies within log_t(n − 1) of the tropical curve, and where one term outweighs the rest it is absent', () => {
  for (const d of [2, 3, 4]) {
    const pts = A.triangle(d), n = pts.length, sg = A.harnackSigns(d);
    const v = A.honeycomb(d, 1).map((h) => h + 0.6 * (rnd() - 0.5));
    for (const s of [1.5, 4]) {
      const ys = grid(-5, 5, 41), rows = A.slices(A.terms(pts, v, sg, false), s, ys, 128);
      const vals = (x, y) => pts.map((p, k) => v[k] + p[0] * x + p[1] * y).sort((a, b) => b - a);
      for (let r = 0; r < ys.length; r++) {
        for (const I of A.merged(rows.lo, rows.hi, r * rows.n, rows.n)) {
          for (const x of [I[0], (I[0] + I[1]) / 2, I[1]]) {
            if (Math.abs(x) > 50) continue;
            const t = vals(x, ys[r]);
            assert.ok(t[0] - t[1] <= Math.log(n - 1) / s + 1e-6, `d ${d}, s ${s}: (${x}, ${ys[r]}) is ${t[0] - t[1]} from tying`);
          }
        }
        // a point where the largest term beats the next by more than log_t(n − 1) is off the amoeba
        for (const x of grid(-5, 5, 41)) {
          const t = vals(x, ys[r]);
          if (t[0] - t[1] > Math.log(n - 1) / s + 1e-9) assert.ok(!A.inside(rows.lo, rows.hi, r * rows.n, rows.n, x));
        }
      }
    }
  }
});

test('honeycomb heights: a triangulation into d² unit triangles, and a smooth tropical curve dual to it', () => {
  for (const d of [1, 2, 3, 4]) {
    const pts = A.triangle(d), v = A.honeycomb(d, 1), sub = A.subdivision(pts, v), T = A.tropical(pts, v, sub);
    assert.equal(sub.faces.length, d * d);
    for (const f of sub.faces) {
      assert.equal(f.on.length, 3);
      assert.equal(Math.abs(A.polygonArea(f.poly.map((k) => pts[k]))), 0.5);
    }
    assert.ok(sub.isVertex.every(Boolean));
    assert.equal(T.vertices.length, d * d);
    assert.equal(T.rays.length, 3 * d);
    assert.equal(T.edges.length, (3 * d * d - 3 * d) / 2);
    // the genus: the cycles are the interior points
    assert.equal(pts.filter((p) => A.isInterior(p, d)).length, A.interiorCount(d));
  }
});

test('the tropical curve: its vertices are where the monomials of a face tie for the maximum, its edges cross their duals at right angles', () => {
  for (let trial = 0; trial < 40; trial++) {
    const d = 1 + (trial % 4), pts = A.triangle(d);
    const v = pts.map(() => Math.round((rnd() * 6 - 3) * 4) / 4);
    const sub = A.subdivision(pts, v), T = A.tropical(pts, v, sub);
    // the faces tile the triangle
    const total = sub.faces.reduce((a, f) => a + Math.abs(A.polygonArea(f.poly.map((k) => pts[k]))), 0);
    assert.ok(Math.abs(total - d * d / 2) < 1e-9, 'the faces cover dΔ once');
    sub.faces.forEach((f, i) => {
      const y = T.vertices[i], val = (k) => v[k] + pts[k][0] * y[0] + pts[k][1] * y[1];
      const max = Math.max(...pts.map((_, k) => val(k)));
      for (const k of f.on) assert.ok(Math.abs(val(k) - max) < 1e-9, 'the face’s monomials reach the maximum');
      pts.forEach((_, k) => { if (!f.on.includes(k)) assert.ok(val(k) < max - 1e-9, 'and no other does'); });
    });
    for (const e of T.edges) {
      const a = pts[e.dual.a], b = pts[e.dual.b], dx = e.to[0] - e.from[0], dy = e.to[1] - e.from[1];
      assert.ok(Math.abs(dx * (b[0] - a[0]) + dy * (b[1] - a[1])) < 1e-9, 'perpendicular');
      assert.equal(e.weight, A.gcd(b[0] - a[0], b[1] - a[1]));
    }
    for (const r of T.rays) {
      const a = pts[r.dual.a], b = pts[r.dual.b];
      assert.ok(Math.abs(r.dir[0] * (b[0] - a[0]) + r.dir[1] * (b[1] - a[1])) < 1e-9, 'the ray is normal to its edge');
      // and points away from the triangle: towards a side where some coordinate decreases or i + j grows
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], c = d / 3;
      assert.ok(r.dir[0] * (mid[0] - c) + r.dir[1] * (mid[1] - c) > 0, 'outward');
    }
    // the region of a vertex of the subdivision contains its dominating points
    const box = [-30, 30, -30, 30];
    pts.forEach((p, k) => {
      const poly = A.region(pts, v, k, box);
      if (!sub.isVertex[k]) { assert.ok(poly.length < 3 || Math.abs(A.polygonArea(poly)) < 1e-9, 'a point under the roof has no region'); return; }
      let cx = 0, cy = 0;
      for (const q of poly) { cx += q[0]; cy += q[1]; }
      cx /= poly.length; cy /= poly.length;
      assert.equal(A.dominant(pts, v, null, [cx, cy]), k);
    });
  }
});

test('the area: π²/2 for a line, at most π² Area(dΔ), reached with Harnack’s signs', () => {
  const pts1 = A.triangle(1);
  assert.ok(Math.abs(A.areaRatio(pts1, [0, 0, 0], [1, 1, 1], 1) - 1) < 3e-3);
  for (const d of [2, 3]) {
    const pts = A.triangle(d), v = A.honeycomb(d, 1);
    const harnack = A.areaRatio(pts, v, A.harnackSigns(d), 3), positive = A.areaRatio(pts, v, pts.map(() => 1), 3);
    assert.ok(Math.abs(harnack - 1) < 0.01, `d ${d}: Harnack ${harnack}`);
    assert.ok(positive < 0.8, `d ${d}: all positive ${positive}`);
  }
});

test('the area at log t = 0, where every coefficient is ±1: that of the curve with heights 0, and the limit as log t → 0', () => {
  const d = 3, pts = A.triangle(d), v = A.honeycomb(d, 1), sg = A.harnackSigns(d);
  const at0 = A.areaRatio(pts, v, sg, 0);
  assert.equal(at0, A.areaRatio(pts, pts.map(() => 0), sg, 1));
  assert.ok(at0 > 0.05 && at0 < 1 && Math.abs(A.areaRatio(pts, v, sg, 0.01) - at0) < 0.01, String(at0));
});

test('where to sample a curve for a chart: the grid and its midpoints where it is straight, finer near a corner', () => {
  const run = (F, base) => {
    const at = A.sampler(base, 0.005, 0.01, 80), xs = [];
    for (let x = at.next(); x !== null; x = at.next()) { at.put(x, F(x)); xs.push(x); }
    return xs.sort((a, b) => a - b);
  };
  const base = [0.5, 1, 1.5, 2, 3, 4];
  assert.deepEqual(run((x) => 0.1 * x, base), [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4], 'a straight line: the grid and its midpoints');
  // a steep rise to a corner, then flat, as the area rises to its largest
  const c = 0.83, xs = run((x) => (x < c ? 0.5 + 0.4 * Math.sqrt((x - 0.5) / (c - 0.5)) : 0.9), base);
  assert.ok(xs.some((x) => x < c && c - x < 0.04) && xs.some((x) => x > c && x - c < 0.04), 'values close to the corner on both sides: ' + xs.join(' '));
  assert.deepEqual(xs.filter((x) => x > 2), [2.5, 3, 3.5, 4], 'and none more where the curve is flat');
  // a curve that bends everywhere stops at the limit
  assert.equal(run((x) => Math.sin(40 * x), base).length, 80);
});
