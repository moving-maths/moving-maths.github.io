// Independent checks of the mathematics in content/dynkin-diagrams/dynkin.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/dynkin-diagrams/dynkin.js';

const D = globalThis.Dynkin;
const FINITE = [];
for (let n = 1; n <= 8; n++) FINITE.push(['A', n]);
for (let n = 2; n <= 8; n++) FINITE.push(['B', n]);
for (let n = 3; n <= 8; n++) FINITE.push(['C', n]);
for (let n = 4; n <= 8; n++) FINITE.push(['D', n]);
FINITE.push(['E', 6], ['E', 7], ['E', 8], ['F', 4], ['G', 2]);
const label = ([t, n]) => t + n;
// a random relabelling of the nodes
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function shuffle(A) {
  const idx = A.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return D.sub(A, idx);
}
// the affine matrix got by adding α_0 = δ − θ to a finite one, θ a root given by its coefficients
function extend(A, theta) {
  const n = A.length, d = D.symmetrize(A), B = (u, v) => { let t = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) t += u[i] * v[j] * d[i] * A[i][j]; return t; };
  const e = (i) => A.map((_, j) => +(i === j)), tt = B(theta, theta);
  // a_0j = <α_0^∨, α_j> = −2(θ, α_j)/(θ, θ),  a_j0 = −2(α_j, θ)/(α_j, α_j)
  const row = A.map((_, j) => -2 * B(theta, e(j)) / tt), col = A.map((_, j) => -2 * B(e(j), theta) / B(e(j), e(j)));
  return [[2].concat(row)].concat(A.map((r, j) => [col[j]].concat(r)));
}

test('finite types: names, in any numbering of the nodes', () => {
  for (const [t, n] of FINITE) {
    const { A } = D.preset(t, n);
    for (let k = 0; k < 4; k++) {
      const c = D.describe(k ? shuffle(A) : A);
      assert.equal(c.parts.length, 1);
      assert.equal(c.family, 'finite', label([t, n]));
      assert.deepEqual(c.parts[0].name, [t, n], label([t, n]));
    }
  }
  // B and C differ by which root is short: the transpose of one is the other
  for (let n = 3; n <= 8; n++) assert.deepEqual(D.classify(D.transpose(D.preset('B', n).A)).name, ['C', n]);
});

test('finite types: roots, exponents, Coxeter number, order of the Weyl group', () => {
  const fact = (n) => { let p = 1n; for (let i = 2n; i <= BigInt(n); i++) p *= i; return p; };
  const expect = {
    E6: [72, [1, 4, 5, 7, 8, 11], 51840n], E7: [126, [1, 5, 7, 9, 11, 13, 17], 2903040n], E8: [240, [1, 7, 11, 13, 17, 19, 23, 29], 696729600n],
    F4: [48, [1, 5, 7, 11], 1152n], G2: [12, [1, 5], 12n],
  };
  for (const [t, n] of FINITE) {
    const f = D.finiteData(D.preset(t, n).A);
    let want;
    if (t === 'A') want = [n * (n + 1), Array.from({ length: n }, (_, i) => i + 1), fact(n + 1)];
    else if (t === 'B' || t === 'C') want = [2 * n * n, Array.from({ length: n }, (_, i) => 2 * i + 1), fact(n) * (1n << BigInt(n))];
    else if (t === 'D') want = [2 * n * (n - 1), Array.from({ length: n - 1 }, (_, i) => 2 * i + 1).concat(n - 1).sort((a, b) => a - b), fact(n) * (1n << BigInt(n - 1))];
    else want = expect[t + n];
    assert.equal(f.roots, want[0], label([t, n]) + ' roots');
    assert.deepEqual(f.exponents, want[1], label([t, n]) + ' exponents');
    assert.equal(f.order, want[2], label([t, n]) + ' order');
    // h = largest exponent + 1, and the roots number rank · h
    assert.equal(f.coxeter, f.exponents[n - 1] + 1);
    assert.equal(f.roots, n * f.coxeter);
    // the eigenvalues of the Cartan matrix are 4 sin²(π m / 2h), m the exponents
    const ev = D.signature(D.preset(t, n).A).eigenvalues, want2 = f.exponents.map((m) => 4 * Math.sin(Math.PI * m / (2 * f.coxeter)) ** 2).sort((a, b) => a - b);
    ev.forEach((x, i) => assert.ok(Math.abs(x - want2[i]) < 1e-9, `${label([t, n])}: eigenvalue ${x} vs ${want2[i]}`));
  }
});

test('affine types: adding δ − θ, for the highest root and the highest short root', () => {
  const twisted = { B: (l) => ['D', l + 1, 2], C: (l) => ['A', 2 * l - 1, 2], F: () => ['E', 6, 2], G: () => ['D', 4, 3] };
  for (const [t, n] of FINITE) {
    const { A } = D.preset(t, n), f = D.finiteData(A);
    for (const [theta, tier] of [[f.highest, 1], [f.highestShort, 2]]) {
      if (!theta) continue;
      const X = extend(A, theta);
      assert.ok(D.isCartan(X), label([t, n]));
      for (let k = 0; k < 3; k++) {
        const c = D.classify(k ? shuffle(X) : X);
        assert.equal(c.family, 'affine', label([t, n]));
        const want = tier === 1 ? [t === 'B' && n === 2 ? 'C' : t, n, 1] : twisted[t](n);
        assert.deepEqual(c.name, want, `${label([t, n])} tier ${tier}`);
        assert.equal(c.det, 0);
        assert.deepEqual([c.plus, c.minus, c.zero], [n, 0, 1]);
      }
      // δ = α_0 + θ, and A δ = 0
      const c = D.classify(X);
      assert.deepEqual(c.marks, [1].concat(theta));
      X.forEach((row) => assert.equal(row.reduce((s, x, j) => s + x * c.marks[j], 0), 0));
    }
  }
});

test('affine types: the transposed diagram is the dual one', () => {
  const dual = { B: (l) => ['A', 2 * l - 1, 2], C: (l) => ['D', l + 1, 2], F: () => ['E', 6, 2], G: () => ['D', 4, 3] };
  for (const [t, n] of FINITE) {
    const X = extend(D.preset(t, n).A, D.finiteData(D.preset(t, n).A).highest), name = D.classify(D.transpose(X)).name;
    if (t === 'B' && n === 2) assert.deepEqual(name, ['D', 3, 2]);
    else assert.deepEqual(name, dual[t] ? dual[t](n) : [t, n, 1], label([t, n]));
  }
  // A_2l^(2) is its own dual
  const a42 = [[2, -2, 0], [-1, 2, -2], [0, -1, 2]];
  assert.deepEqual(D.classify(a42).name, ['A', 4, 2]);
  assert.deepEqual(D.classify(D.transpose(a42)).name, ['A', 4, 2]);
});

test('the matrices of the root systems page get their names', () => {
  const known = [
    [[[2, -2], [-2, 2]], 'A1(1)'], [[[2, -4], [-1, 2]], 'A2(2)'],
    [[[2, -1, -1], [-1, 2, -1], [-1, -1, 2]], 'A2(1)'], [[[2, -1, 0], [-2, 2, -2], [0, -1, 2]], 'C2(1)'],
    [[[2, -1, 0], [-1, 2, -1], [0, -3, 2]], 'G2(1)'], [[[2, -1, 0], [-1, 2, -3], [0, -1, 2]], 'D4(3)'],
    [[[2, -1, 0], [-1, 2, -1], [0, -2, 2]], 'B3'], [[[2, -1, 0], [-1, 2, -2], [0, -1, 2]], 'C3'],
  ];
  for (const [A, name] of known) assert.equal(D.classify(A).plain, name);
  for (const A of [[[2, -2, 0], [-2, 2, -1], [0, -1, 2]], [[2, -2, -2], [-2, 2, -2], [-2, -2, 2]], [[2, -1, -2], [-1, 2, -2], [-1, -1, 2]], [[2, -2, 0], [-1, 2, -3], [0, -1, 2]], [[2, -3], [-3, 2]], [[2, -1], [-5, 2]]]) {
    const c = D.classify(A);
    assert.equal(c.family, 'hyperbolic');
    assert.ok(c.lorentzian);
  }
});

test('E_n: finite up to 8, affine at 9, hyperbolic at 10, indefinite after', () => {
  const family = { 6: 'finite', 7: 'finite', 8: 'finite', 9: 'affine', 10: 'hyperbolic', 11: 'indefinite', 12: 'indefinite' };
  for (let n = 6; n <= 12; n++) {
    const c = D.classify(D.preset('E', n).A);
    assert.equal(c.family, family[n], 'E' + n);
    assert.equal(c.det, 9 - n, 'det E' + n);
    if (n === 9) assert.deepEqual(c.name, ['E', 8, 1]); else assert.deepEqual(c.name, ['E', n]);
    if (n >= 10) assert.ok(c.lorentzian, 'E' + n + ' is Lorentzian');
    if (n === 11) assert.deepEqual(c.bad, [10]); // only removing the far end of the long leg leaves E_10, which is neither finite nor affine
  }
  assert.deepEqual(D.classify(D.preset('E', 9).A).marks, [2, 3, 4, 6, 5, 4, 3, 2, 1]);
});

test('past the finite and affine types: E_n, the trees T_{p,q,r} and the paths with a label, in any numbering', () => {
  const named = [[['E', 10], 'hyperbolic'], [['E', 11], 'indefinite'], [['T', 3, 3, 4], 'hyperbolic'], [['T', 2, 4, 5], 'hyperbolic'], [['T', 2, 5, 5], 'indefinite'], [['T', 3, 4, 4], 'indefinite'],
    [['[', 7, 3], 'hyperbolic'], [['[', 5, 3, 3, 3], 'hyperbolic'], [['[', 5, 3, 5], 'hyperbolic'], [['[', 5, 5], 'hyperbolic'], [['[', 5, 3, 3, 3, 3], 'indefinite']];
  for (const [name, family] of named) {
    const { A, pos } = D.preset(name);
    assert.equal(pos.length, A.length, D.plain(name));
    for (let k = 0; k < 3; k++) {
      const c = D.classify(k ? shuffle(A) : A);
      assert.equal(c.family, family, D.plain(name));
      assert.deepEqual(c.name, name, D.plain(name));
    }
  }
  // a path with a label is read from the end that gives the larger list: [5,3,3,3], not [3,3,3,5]
  const P = D.preset(['[', 5, 3, 3, 3]).A;
  assert.deepEqual(D.classify(P.map((_, i) => P[4 - i].slice().reverse())).name, ['[', 5, 3, 3, 3]);
  // E_6^(1), E_7^(1) and E_8^(1) with a node more on α_0 are T_{3,3,4}, T_{2,4,5} and E_10; H_4 with a node
  // more at the end away from its label is [5,3,3,3]
  const more = (A, at) => { const n = A.length, B = A.map((row) => row.concat([0])); B.push(Array.from({ length: n + 1 }, (_, j) => (j === n ? 2 : 0))); B[at][n] = B[n][at] = -1; return B; };
  assert.deepEqual(D.classify(more(D.preset(['E', 6, 1]).A, 0)).name, ['T', 3, 3, 4]);
  assert.deepEqual(D.classify(more(D.preset(['E', 7, 1]).A, 0)).name, ['T', 2, 4, 5]);
  assert.deepEqual(D.classify(more(D.preset(['E', 8, 1]).A, 0)).name, ['E', 10]);
  assert.deepEqual(D.classify(more(D.preset(['H', 4]).A, 3)).name, ['[', 5, 3, 3, 3]);
  assert.equal(D.tex(['T', 3, 3, 4]), '\\mathrm{T}_{3,3,4}');
  assert.equal(D.tex(['[', 5, 3, 3, 3]), '[5,3,3,3]');
});

test('diagrams with no symmetric form, and diagrams in several pieces', () => {
  const A = [[2, -1, -1], [-2, 2, -1], [-1, -1, 2]];
  assert.equal(D.symmetrize(A), null);
  const c = D.classify(A);
  assert.equal(c.family, 'indefinite');
  assert.equal(c.symmetrizable, false);
  const two = [[2, -1, 0, 0], [-1, 2, 0, 0], [0, 0, 2, -2], [0, 0, -2, 2]];
  const d = D.describe(two);
  assert.deepEqual(d.parts.map((p) => p.plain), ['A2', 'A1(1)']);
  assert.equal(d.family, 'affine');
  assert.deepEqual(D.symmetrize([[2, -1, 0], [-2, 2, 0], [0, 0, 2]]), [2, 1, 1]);
});

test('finite type exactly when the real roots are finitely many', () => {
  // random connected diagrams on up to four nodes
  for (let trial = 0; trial < 400; trial++) {
    const n = 2 + Math.floor(rnd() * 3), A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || rnd() < 0.2) { A[i][j] = -(1 + Math.floor(rnd() * 3 * rnd())); A[j][i] = -(1 + Math.floor(rnd() * 3 * rnd())); }
    }
    const c = D.classify(A), r = D.realRoots(A, 60, 400);
    assert.equal(c.family === 'finite', r.complete, JSON.stringify(A));
    // the determinant has the sign the signature gives it
    if (c.symmetrizable) assert.equal(Math.sign(c.det), c.zero ? 0 : c.minus % 2 ? -1 : 1, JSON.stringify(A));
    // affine X^(r): the real roots are translated to real roots by rδ, so their numbers by height repeat
    if (c.family === 'affine') {
      const period = c.name[2] * c.marks.reduce((s, x) => s + x, 0), h = D.realRoots(A, 3 * period + 2, 5000).heights;
      for (let k = 1; k + period < h.length; k++) if (k > period) assert.equal(h[k], h[k + period], JSON.stringify(A));
    }
  }
});

test('the Coxeter element: order h, free on the roots, a rotation by 2πm/h on each of its planes', () => {
  for (const [t, n] of FINITE) {
    const { A } = D.preset(t, n), f = D.finiteData(A), cx = D.coxeter(A), h = f.coxeter;
    const pos = D.realRoots(A, Infinity, 1000).levels.flat(), roots = pos.concat(pos.map((c) => c.map((x) => -x)));
    const keys = new Set(roots.map((c) => c.join(',')));
    // c permutes the roots, in orbits of exactly h
    for (const b of roots) {
      let c = b, size = 0;
      do { c = cx.apply(c); size++; assert.ok(keys.has(c.join(',')), label([t, n])); } while (c.join(',') !== b.join(',') && size <= h);
      assert.equal(size, h, `${label([t, n])}: orbit of ${b}`);
    }
    // its matrix is orthogonal
    const C = cx.matrix;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const t2 = C.reduce((s2, row) => s2 + row[i] * row[j], 0);
      assert.ok(Math.abs(t2 - (i === j ? 1 : 0)) < 1e-9, label([t, n]));
    }
    // one plane for each exponent below h/2, and one more when h/2 is an exponent twice
    const below = f.exponents.filter((m) => 2 * m < h), half = f.exponents.filter((m) => 2 * m === h).length;
    assert.deepEqual(cx.planes.map((P) => P.m), below.concat(half === 2 ? [h / 2] : []), label([t, n]));
    for (const P of cx.planes) {
      const th = 2 * Math.PI * P.m / h;
      let sense = 0;
      for (const b of roots) {
        const [x, y] = cx.project(P, b), [x1, y1] = cx.project(P, cx.apply(b));
        assert.ok(Math.abs(Math.hypot(x, y) - Math.hypot(x1, y1)) < 1e-9, label([t, n]));
        if (Math.hypot(x, y) < 1e-9) continue;
        const turn = Math.atan2(x * y1 - y * x1, x * x1 + y * y1); // the angle from the projection of β to that of c(β)
        assert.ok(Math.abs(Math.abs(turn) - th) < 1e-8, `${label([t, n])}, m = ${P.m}: turned by ${turn}, not ${th}`);
        if (2 * P.m < h) { if (!sense) sense = Math.sign(turn); assert.equal(Math.sign(turn), sense, label([t, n])); }
      }
      // in the Coxeter plane no root projects to the centre
      if (P.m === 1) for (const b of roots) assert.ok(Math.hypot(...cx.project(P, b)) > 1e-6, label([t, n]));
    }
  }
});

test('nearest roots, and a third direction for each plane of the Coxeter element', () => {
  const all = (A) => { const pos = D.realRoots(A, Infinity, 1000).levels.flat(); return pos.concat(pos.map((c) => c.map((x) => -x))); };
  const edges = (t, n) => { const A = D.preset(t, n).A; return D.nearest(A, all(A)).length; };
  // simply laced: each root has as many neighbours at 60° as there are roots β with (α, β) = 1
  assert.equal(edges('A', 2), 6);
  for (let n = 2; n <= 6; n++) assert.equal(edges('A', n), n * (n + 1) * (n - 1), 'A' + n); // 2(n − 1) neighbours each
  for (let n = 4; n <= 6; n++) assert.equal(edges('D', n), 2 * n * (n - 1) * 4 * (n - 2) / 2, 'D' + n); // 4(n − 2) each
  assert.equal(edges('E', 6), 72 * 20 / 2);
  assert.equal(edges('E', 7), 126 * 32 / 2);
  assert.equal(edges('E', 8), 240 * 56 / 2);
  assert.equal(edges('B', 2), 8);  // the octagon: short and long roots alternate
  assert.equal(edges('G', 2), 12 + 6);
  for (const [t, n] of FINITE) {
    if (n < 3) continue;
    const cx = D.coxeter(D.preset(t, n).A), dot = (u, v) => u.reduce((s2, x, i) => s2 + x * v[i], 0);
    for (const P of cx.planes) {
      assert.ok(P.w, label([t, n]));
      assert.ok(Math.abs(dot(P.w, P.w) - 1) < 1e-9 && Math.abs(dot(P.w, P.u)) < 1e-9 && Math.abs(dot(P.w, P.v)) < 1e-9, label([t, n]));
    }
  }
});

test('the picture of the roots in space keeps the symmetries it claims', () => {
  const close = (x, y) => Math.abs(x - y) < 1e-8;
  for (const [t, n] of FINITE) {
    if (n < 3) continue;
    const { A } = D.preset(t, n), cx = D.coxeter(A), h = cx.h;
    const pos = D.realRoots(A, Infinity, 1000).levels.flat(), roots = pos.concat(pos.map((c) => c.map((x) => -x)));
    const keys = new Set(roots.map((c) => c.join(',')));
    for (const P of cx.planes) {
      const at = (c) => { const x = cx.embed(c); return [P.u, P.v, P.w].map((e) => e.reduce((s2, y, i) => s2 + y * x[i], 0)); };
      // a is an involution of the roots, and a mirror of the picture: x ↦ −x, with z kept or reversed throughout
      let sz = 0;
      for (const b of roots) {
        const ab = cx.flip(b), p = at(b), q = at(ab);
        assert.ok(keys.has(ab.join(',')), label([t, n]));
        assert.equal(cx.flip(ab).join(','), b.join(','), label([t, n]));
        // (on the plane where c = −1, in D_n with n even, a may be ±1 instead of a mirror)
        if (2 * P.m === h) assert.ok(close(Math.abs(q[0]), Math.abs(p[0])) && close(Math.abs(q[1]), Math.abs(p[1])), `${label([t, n])}, m = ${P.m}`);
        else assert.ok(close(q[0], -p[0]) && close(q[1], p[1]), `${label([t, n])}, m = ${P.m}: the mirror`);
        if (Math.abs(p[2]) > 1e-6) { if (!sz) sz = Math.sign(q[2] / p[2]); assert.ok(close(q[2], sz * p[2]), `${label([t, n])}, m = ${P.m}: the mirror, in depth`); }
      }
      // a c a = c⁻¹
      for (const b of roots.slice(0, 12)) assert.equal(cx.apply(cx.flip(cx.apply(cx.flip(b)))).join(','), b.join(','), label([t, n]));
      // the powers of c in `turns` keep the depth up to one sign each; the others do not
      for (let k = 1; k < h; k++) {
        let sign = 0, kept = true;
        for (const b of roots) {
          let c = b;
          for (let r = 0; r < k; r++) c = cx.apply(c);
          const z0 = at(b)[2], z1 = at(c)[2];
          if (Math.abs(z0) < 1e-6 && Math.abs(z1) < 1e-6) continue;
          if (!sign) sign = Math.sign(z1 / z0) || 1;
          if (!close(z1, sign * z0)) { kept = false; break; }
        }
        assert.equal(kept, P.turns.includes(k), `${label([t, n])}, m = ${P.m}, depth ${P.depth}: c^${k}`);
      }
      if (P.depth === 'line') assert.equal(P.turns.length, h - 1);
    }
  }
  // E6: the Coxeter plane takes its depth from the plane for m = 4, where c³ is the identity: a fourfold axis
  const e6 = D.coxeter(D.preset('E', 6).A).planes[0];
  assert.equal(e6.depth, 4);
  assert.deepEqual(e6.turns, [3, 6, 9]);
  // with −1 an eigenvalue of c, the whole dihedral group keeps the picture
  for (const [t, n] of [['A', 3], ['A', 5], ['B', 3], ['C', 5], ['D', 4], ['D', 5], ['D', 6], ['E', 7]]) {
    const cx = D.coxeter(D.preset(t, n).A);
    assert.equal(cx.planes[0].turns.length, cx.h - 1, label([t, n]));
  }
});

test('D4: in the picture about the Coxeter plane no two roots come close', () => {
  const A = D.preset('D', 4).A, cx = D.coxeter(A), P = cx.planes[0];
  const pos = D.realRoots(A, Infinity, 1000).levels.flat(), roots = pos.concat(pos.map((c) => c.map((x) => -x)));
  const pts = roots.map((c) => { const x = cx.embed(c); return [P.u, P.v, P.w].map((e) => e.reduce((s2, y, i) => s2 + y * x[i], 0)); });
  let least = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) least = Math.min(least, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2]));
  // the roots have length √2; in the plane alone some are 0.52 apart
  assert.ok(least > 0.8, `least distance ${least}`);
  assert.equal(P.depth, 3); // the plane on which c = −1
  assert.equal(P.turns.length, cx.h - 1); // still the whole dihedral group
});

// Coxeter types: bonds labelled m, a_ij = a_ji = −2 cos(π/m)
const COXETER = [['H', 3], ['H', 4]].concat(D.LABELS.map((m) => ['I', 2, 0, m]));

test('Coxeter types: names, roots, exponents, order of the group, determinants', () => {
  const want = { H3: [30, [1, 5, 9], 120n, [4, -2]], H4: [120, [1, 11, 19, 29], 14400n, [5, -3]] };
  for (const name of COXETER) {
    const { A } = D.preset(name), n = A.length, f = D.finiteData(A), c = D.classify(A);
    assert.ok(D.isCartan(A) && !D.integral(A), D.plain(name));
    assert.equal(c.family, 'finite', D.plain(name));
    for (let k = 0; k < 3; k++) assert.deepEqual(D.classify(k ? shuffle(A) : A).name, name, D.plain(name));
    const m = name[3], [roots, exps, order] = m ? [2 * m, [1, m - 1], BigInt(2 * m)] : want[D.plain(name)];
    assert.equal(f.roots, roots, D.plain(name));
    assert.deepEqual(f.exponents, exps, D.plain(name));
    assert.equal(f.order, order, D.plain(name));
    assert.equal(f.coxeter, exps[n - 1] + 1);
    // the eigenvalues of A are 4 sin²(π m / 2h), m the exponents, as for the Weyl groups
    const ev = D.signature(A).eigenvalues, ev2 = f.exponents.map((e) => 4 * Math.sin(Math.PI * e / (2 * f.coxeter)) ** 2).sort((a, b) => a - b);
    ev.forEach((x, i) => assert.ok(Math.abs(x - ev2[i]) < 1e-9, D.plain(name)));
    // the determinant: exactly in Z[τ] when every label is 5, and 4 sin²(π/m) for I_2(m)
    if (m) assert.ok(Math.abs(c.det - 4 * Math.sin(Math.PI / m) ** 2) < 1e-12);
    if (!m) assert.deepEqual(c.detTau, want[D.plain(name)][3]);
    if (m === 5) assert.deepEqual(c.detTau, [3, -1]);
    // the roots: closed under the reflections, all of length √2 (the form has d_i = 1)
    const pos = D.positiveRoots(A), all = pos.concat(pos.map((r) => r.map((x) => -x))), keys = new Set(all.map(D.rootKey));
    for (const r of all) {
      let t = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) t += r[i] * r[j] * A[i][j];
      assert.ok(Math.abs(t - 2) < 1e-9, D.plain(name));
      for (let i = 0; i < n; i++) {
        let p = 0;
        for (let j = 0; j < n; j++) p += A[i][j] * r[j];
        const s = r.slice();
        s[i] -= p;
        assert.ok(keys.has(D.rootKey(s)), D.plain(name));
      }
    }
  }
  // the Z[τ] determinant agrees with the floating point one, here on a hyperbolic diagram
  const t = D.labelEntry(5), X = [[2, t, 0, 0], [t, 2, -1, 0], [0, -1, 2, t], [0, 0, t, 2]], c = D.classify(X);
  const tau = (1 + Math.sqrt(5)) / 2;
  assert.ok(Math.abs(c.detTau[0] + c.detTau[1] * tau - c.det) < 1e-12);
});

test('Coxeter types: the Coxeter element has orbits of h and turns its planes', () => {
  for (const name of COXETER) {
    const { A } = D.preset(name), f = D.finiteData(A), cx = D.coxeter(A), h = cx.h;
    assert.equal(h, f.coxeter);
    const pos = D.positiveRoots(A), roots = pos.concat(pos.map((r) => r.map((x) => -x))), keys = new Set(roots.map(D.rootKey));
    for (const b of roots) {
      let c = b, size = 0;
      do { c = cx.apply(c); size++; assert.ok(keys.has(D.rootKey(c)), D.plain(name)); } while (D.rootKey(c) !== D.rootKey(b) && size <= h);
      assert.equal(size, h, D.plain(name));
    }
    assert.deepEqual(cx.planes.map((P) => P.m), f.exponents.filter((m) => 2 * m < h), D.plain(name));
    for (const P of cx.planes) {
      for (const b of roots) {
        const [x, y] = cx.project(P, b), [x1, y1] = cx.project(P, cx.apply(b));
        if (Math.hypot(x, y) < 1e-9) continue;
        assert.ok(Math.abs(Math.abs(Math.atan2(x * y1 - y * x1, x * x1 + y * y1)) - 2 * Math.PI * P.m / h) < 1e-8, D.plain(name));
      }
    }
  }
  // nearest roots: the icosidodecahedron (H_3), the 600-cell (H_4), the 2m-gon (I_2(m))
  const edges = (name) => { const A = D.preset(name).A, pos = D.positiveRoots(A); return D.nearest(A, pos.concat(pos.map((r) => r.map((x) => -x)))).length; };
  assert.equal(edges(['H', 3]), 60);
  assert.equal(edges(['H', 4]), 720);
  assert.equal(edges(['I', 2, 0, 7]), 14);
});

test('diagrams with labels: never affine, and hyperbolic when every proper piece is finite', () => {
  const t = D.labelEntry(5), s7 = D.labelEntry(7);
  const path = (labels) => { const n = labels.length + 1, A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0))); labels.forEach((x, i) => { A[i][i + 1] = A[i + 1][i] = x; }); return A; };
  // [5,3,5], [7,3], [5,5], [5,3,4] and H_4 with a node more, [5,3,3,3], are hyperbolic; [5,3,3,3,3] is not
  for (const A of [path([t, -1, t]), path([s7, -1]), path([t, t]), path([t, -1, -1, -1])]) assert.equal(D.classify(A).family, 'hyperbolic');
  const B = path([t, -1, -1]); B[2][3] = -1; B[3][2] = -2; // [5,3,4]
  assert.equal(D.classify(B).family, 'hyperbolic');
  const C = D.classify(path([t, -1, -1, -1, -1]));
  assert.equal(C.family, 'indefinite');
  assert.deepEqual(C.bad, [5]);
  // random trees with a label: finite only as H_3, H_4, I_2(m), and never affine
  for (let trial = 0; trial < 300; trial++) {
    const n = 2 + Math.floor(rnd() * 4), A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));
    for (let i = 1; i < n; i++) {
      const j = Math.floor(rnd() * i), u = rnd();
      if (u < 0.3) A[i][j] = A[j][i] = D.labelEntry(D.LABELS[Math.floor(rnd() * D.LABELS.length)]);
      else { A[i][j] = -(1 + Math.floor(rnd() * 2 * rnd())); A[j][i] = u < 0.8 ? -1 : -(1 + Math.floor(rnd() * 3)); }
    }
    if (D.integral(A)) continue;
    const c = D.classify(A);
    assert.notEqual(c.family, 'affine', JSON.stringify(A));
    if (c.family === 'finite') assert.ok(['H', 'I'].includes(c.name[0]), JSON.stringify(A));
  }
});

test('the lists: every affine diagram gets its name, and every layout has bonds of one length', () => {
  const hyperbolic = [['T', 3, 3, 4], ['T', 2, 4, 5], ['E', 10], ['[', 7, 3], ['[', 5, 3, 3, 3]];
  const affine = [['A', 1, 1], ['A', 2, 1], ['A', 5, 1], ['B', 3, 1], ['B', 6, 1], ['C', 2, 1], ['C', 5, 1], ['D', 4, 1], ['D', 7, 1], ['E', 6, 1], ['E', 7, 1], ['E', 8, 1], ['F', 4, 1], ['G', 2, 1],
    ['A', 2, 2], ['A', 4, 2], ['A', 8, 2], ['A', 5, 2], ['A', 9, 2], ['D', 3, 2], ['D', 6, 2], ['E', 6, 2], ['D', 4, 3]];
  for (const name of FINITE.concat(affine, COXETER, hyperbolic)) {
    const { A, pos } = D.preset(name), parts = D.describe(A).parts;
    assert.equal(parts.length, 1, D.plain(name));
    assert.deepEqual(parts[0].name, name, D.plain(name));
    assert.equal(parts[0].family, affine.includes(name) ? 'affine' : hyperbolic.includes(name) ? 'hyperbolic' : 'finite', D.plain(name));
    assert.equal(pos.length, A.length);
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const d = Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]);
      if (A[i][j]) assert.ok(d > 0.95 && d < 1.1, `${D.plain(name)}: bond ${i}–${j} of length ${d}`);
      else assert.ok(d > 0.95, `${D.plain(name)}: nodes ${i}, ${j} at ${d}`);
    }
  }
});
