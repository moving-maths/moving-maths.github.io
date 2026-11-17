// Independent checks of the mathematics in content/root-systems/roots.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/root-systems/roots.js';
import '../content/root-systems/hyperbolic.js';

const RS = globalThis.RootSystems;
const rank2 = (a, b) => [[2, -a], [-b, 2]];
const KM2 = [[0, 0], [1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 2], [1, 4], [4, 1], [3, 3], [1, 5], [2, 3], [4, 4], [1, 6]].map(([a, b]) => rank2(a, b));
const KM3 = {
  A3: [[2, -1, 0], [-1, 2, -1], [0, -1, 2]],
  B3: [[2, -1, 0], [-1, 2, -1], [0, -2, 2]],
  C3: [[2, -1, 0], [-1, 2, -2], [0, -1, 2]],
  'A2(1)': [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]],
  'C2(1)': [[2, -1, 0], [-2, 2, -2], [0, -1, 2]],
  'G2(1)': [[2, -1, 0], [-1, 2, -1], [0, -3, 2]],
  'D4(3)': [[2, -1, 0], [-1, 2, -3], [0, -1, 2]],
  '23∞': [[2, -2, 0], [-2, 2, -1], [0, -1, 2]],
  '∞∞∞': [[2, -2, -2], [-2, 2, -2], [-2, -2, 2]],
  '344': [[2, -1, -2], [-1, 2, -2], [-1, -1, 2]],
  '246': [[2, -2, 0], [-1, 2, -3], [0, -1, 2]],
};
const FAMILY3 = { A3: 'finite', B3: 'finite', C3: 'finite', 'A2(1)': 'affine', 'C2(1)': 'affine', 'G2(1)': 'affine', 'D4(3)': 'affine', '23∞': 'hyperbolic', '∞∞∞': 'hyperbolic', '344': 'hyperbolic', '246': 'hyperbolic' };
const ALL = KM2.concat(Object.values(KM3));
const name = (A) => A.map((r) => r.join(' ')).join(' / ');
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const close = (x, y, what) => assert.ok(Math.abs(x - y) < 1e-9, `${what}: ${x} vs ${y}`);
const K = RS.key;

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// a random unit vector of the model space
function direction(n) {
  if (n === 2) { const t = rnd() * 2 * Math.PI; return [Math.cos(t), Math.sin(t)]; }
  for (;;) { const v = [2 * rnd() - 1, 2 * rnd() - 1, 2 * rnd() - 1], l = Math.hypot(...v); if (l > 0.1 && l <= 1) return v.map((x) => x / l); }
}
const modelForm = (sys, p, q) => sys.sign * (p.slice(0, -1).reduce((s, x, i) => s + x * q[i], 0) + sys.sig * p[p.length - 1] * q[q.length - 1]);

test('the model is an isometry: sign·(x² [+ y²] + sig·z²) is the norm', () => {
  const systems = ALL.map((A) => RS.kacMoody(A, { R: 12, H: 14, Him: 8 }))
    .concat(RS.SUPER_IDS.map((id) => RS.superSystem(id)), [RS.superSystem('d21', 0.37), RS.superSystem('d21', 2.5)]);
  for (const sys of systems) {
    assert.ok(sys.roots.length > 0);
    const B = RS.quad(sys.gram);
    for (const v of sys.roots) {
      close(modelForm(sys, v.p, v.p), v.norm, `${sys.id} root ${v.c}`);
      close(B(v.c, v.c), v.norm, `${sys.id} root ${v.c}, by the Gram matrix`);
    }
    sys.E.forEach((p, i) => sys.E.forEach((q, j) => close(modelForm(sys, p, q), sys.gram[i][j], `${sys.id} pairing ${i}${j}`)));
    // Kac–Moody: the height is the last coordinate, up to scale
    if (sys.family !== 'super') sys.E.forEach((p) => close(p[p.length - 1], sys.E[0][sys.rank - 1], `${sys.id} height`));
  }
});

test('Cartan integers come back from the form', () => {
  for (const A of ALL) {
    const { gram } = RS.kacMoody(A, { R: 6, H: 6, Him: 4 });
    A.forEach((row, i) => row.forEach((a, j) => assert.equal(2 * gram[i][j] / gram[i][i], a, name(A))));
  }
  assert.throws(() => RS.kacMoody([[2, -1, -1], [-1, 2, -2], [-1, -1, 2]]), /symmetrizable/);
});

test('finite types: the number of roots', () => {
  const count = { '0,0': 4, '1,1': 6, '1,2': 8, '2,1': 8, '1,3': 12, '3,1': 12 };
  for (const k of Object.keys(count)) {
    const sys = RS.kacMoody(rank2(...k.split(',').map(Number)));
    assert.equal(sys.family, 'finite');
    assert.equal(sys.roots.length, count[k]);
    assert.ok(sys.roots.every((v) => v.kind === 'real' && v.norm > 0));
  }
  for (const [k, n] of [['A3', 12], ['B3', 18], ['C3', 18]]) {
    const sys = RS.kacMoody(KM3[k]);
    assert.equal(sys.roots.length, n, k);
    assert.equal(sys.walls.length, n / 2, k);
  }
  // long and short roots of B3 and C3
  const lengths = (k) => { const c = {}; RS.kacMoody(KM3[k]).roots.forEach((v) => { c[v.norm] = (c[v.norm] || 0) + 1; }); return c; };
  assert.deepEqual(lengths('B3'), { 2: 6, 4: 12 });
  assert.deepEqual(lengths('C3'), { 2: 12, 4: 6 });
});

test('families', () => {
  for (const A of KM2) {
    const ab = A[0][1] * A[1][0];
    assert.equal(RS.kacMoody(A, { R: 6 }).family, ab < 4 ? 'finite' : ab === 4 ? 'affine' : 'hyperbolic');
  }
  for (const k of Object.keys(KM3)) assert.equal(RS.kacMoody(KM3[k], { H: 6, Him: 4 }).family, FAMILY3[k], k);
});

// the positive real roots in the box 0 ≤ c ≤ M, by the orbit of the simple roots
function realInBox(A, M) {
  const n = A.length, real = new Set(), todo = [];
  for (let i = 0; i < n; i++) { const c = A.map((_, j) => (i === j ? 1 : 0)); real.add(K(c)); todo.push(c); }
  while (todo.length) {
    const c = todo.pop();
    for (let i = 0; i < n; i++) {
      const d = c.slice();
      d[i] -= RS.dot(A[i], c);
      if (real.has(K(d)) || d.some((x, j) => x < 0 || x > M[j])) continue;
      real.add(K(d));
      todo.push(d);
    }
  }
  return real;
}
function box(M) {
  const out = [];
  const rec = (c) => { if (c.length === M.length) { if (c.some((x) => x)) out.push(c); return; } for (let x = 0; x <= M[c.length]; x++) rec(c.concat(x)); };
  rec([]);
  return out;
}

// Peterson's recursion, run on a whole box of the positive cone with no
// knowledge of which points are roots, must find: multiplicity 1 exactly on the
// Weyl orbit of the simple roots, positive multiplicity exactly on the nonzero
// points of norm ≤ 0 (Kac, Prop. 5.10), and 0 elsewhere.
test('Peterson multiplicities locate the roots (Kac, Proposition 5.10)', () => {
  for (const A of ALL) {
    const n = A.length, M = n === 2 ? [14, 14] : [6, 6, 6];
    const sys = RS.kacMoody(A, { R: 6, H: 6, Him: 4 }), B = RS.quad(sys.gram);
    const mult = RS.multiplicities(sys.gram, M), real = realInBox(A, M);
    for (const c of box(M)) {
      const norm = B(c, c), k = mult(c), id = `${name(A)} at ${c}`;
      if (real.has(K(c))) {
        assert.equal(k, 1n, id);
        assert.ok(norm > 0, id);
      } else if (norm <= 0) assert.ok(k > 0n, id + ' should be an imaginary root');
      else assert.equal(k, 0n, id);
      // Prop. 5.10 b: real ⇔ norm > 0 and k_j·|α_j|²/|α|² integral
      const crit = norm > 0 && c.every((x, j) => (x * sys.norms[j]) % norm === 0);
      assert.equal(crit, real.has(K(c)), id + ' criterion for real roots');
    }
  }
});

// Π_{β > 0} (1 − e^{−β})^{mult β} = Σ_w ε(w) e^{wρ − ρ}, truncated to a box.
// The identity determines the multiplicities, so this checks them completely.
test('multiplicities satisfy the denominator identity', () => {
  for (const A of ALL) {
    const n = A.length, M = n === 2 ? [13, 13] : [6, 6, 6];
    const sys = RS.kacMoody(A, { R: 6, H: 6, Him: 4 }), mult = RS.multiplicities(sys.gram, M);
    const pts = box(M).concat([M.map(() => 0)]);
    let poly = new Map([[K(M.map(() => 0)), 1n]]);
    for (const b of box(M)) {
      const k = mult(b);
      if (!k) continue;
      const J = Math.min(...b.map((x, i) => (x ? Math.floor(M[i] / x) : Infinity)));
      const bin = [1n];
      for (let j = 1; j <= J; j++) bin.push(-bin[j - 1] * (k - BigInt(j - 1)) / BigInt(j));
      const next = new Map();
      for (const [key, v] of poly) {
        const c = key.split(',').map(Number);
        for (let t = 0; t <= J; t++) {
          const d = c.map((x, i) => x + t * b[i]);
          if (d.some((x, i) => x > M[i])) break;
          next.set(K(d), (next.get(K(d)) || 0n) + bin[t] * v);
        }
      }
      poly = next;
    }
    // the other side: λ(w) = ρ − wρ, with λ(s_i w) = α_i + s_i λ(w)
    const seen = new Map([[K(M.map(() => 0)), 1n]]), todo = [M.map(() => 0)];
    while (todo.length) {
      const c = todo.shift(), sgn = seen.get(K(c));
      for (let i = 0; i < n; i++) {
        const d = c.slice();
        d[i] += 1 - RS.dot(A[i], c);
        if (seen.has(K(d)) || d.some((x, j) => x < 0 || x > M[j])) continue;
        seen.set(K(d), -sgn);
        todo.push(d);
      }
    }
    for (const c of pts) assert.equal(poly.get(K(c)) || 0n, seen.get(K(c)) || 0n, `${name(A)} at ${c}`);
  }
});

test('affine types: δ and the multiplicities of its multiples', () => {
  const cases = [
    [rank2(2, 2), [1, 1], [1, 1, 1, 1]], [rank2(1, 4), [1, 2], [1, 1, 1, 1]], [rank2(4, 1), [2, 1], [1, 1, 1, 1]],
    [KM3['A2(1)'], [1, 1, 1], [2, 2, 2, 2, 2, 2]], [KM3['C2(1)'], [1, 2, 1], [2, 2, 2, 2, 2, 2]], [KM3['G2(1)'], [1, 2, 3], [2, 2, 2, 2, 2, 2]],
    // Kac, Corollary 8.3: twisted, mult kδ = ℓ if r | k, else (N − ℓ)/(r − 1); here r = 3, N = 4, ℓ = 2
    [KM3['D4(3)'], [1, 2, 1], [1, 1, 2, 1, 1, 2]],
  ];
  for (const [A, delta, mults] of cases) {
    const sys = RS.kacMoody(A, { R: 14, H: 20 });
    assert.deepEqual(sys.delta, delta, name(A));
    const imag = sys.roots.filter((v) => v.kind === 'imag' && v.ht > 0).sort((u, v) => u.ht - v.ht);
    assert.ok(imag.length >= mults.length, name(A));
    imag.forEach((v, i) => {
      assert.deepEqual(v.c, delta.map((x) => (i + 1) * x));
      if (i < mults.length) assert.equal(v.mult, BigInt(mults[i]), `${name(A)}: mult ${i + 1}δ`);
    });
    // every real root is (a root of the finite part) + kδ
    for (const v of sys.roots.filter((u) => u.kind === 'real')) assert.match(RS.affineTex(sys, v.c), /^[^δ]*\\alpha_\d([+-]\d*\\delta)?$/);
  }
  assert.deepEqual(RS.kacMoody(rank2(1, 4), { R: 14 }).realNorms, [2, 8]);
});

test('A2(2): short roots ±α1 + nδ, long roots ±2α1 + (2n+1)δ', () => {
  const sys = RS.kacMoody(rank2(4, 1), { R: 14 }), names = new Set();
  for (const v of sys.roots.filter((u) => u.kind === 'real')) {
    const m = RS.affineTex(sys, v.c).match(/^(-?)(2?)\\alpha_1(?:([+-]\d*)\\delta)?$/);
    assert.ok(m, RS.affineTex(sys, v.c));
    const k = m[3] === undefined ? 0 : m[3] === '+' ? 1 : m[3] === '-' ? -1 : +m[3];
    assert.equal(v.norm, m[2] ? 8 : 2);
    if (m[2]) assert.equal(Math.abs(k) % 2, 1);
    names.add((m[1] || '+') + (m[2] || '1') + ':' + k);
  }
  for (let k = -3; k <= 3; k++) {
    assert.ok(names.has('+1:' + k) && names.has('-1:' + k));
    assert.equal(names.has('+2:' + k), Math.abs(k) % 2 === 1);
  }
});

/* ---------- positive systems ---------- */

// a base of the positive system {f > 0}: a Z-basis of the lattice, positive, such
// that every listed root is a combination with integer coefficients of one sign
function isBase(sys, f, simple) {
  const n = sys.rank;
  if (simple.length !== n || !simple.every((b) => f(b) > 0)) return false;
  // exactly, by Cramer's rule: c = Σ k_i simple[i], k_i = det(simple with row i replaced by c) / det(simple)
  const det = (M) => (n === 2 ? M[0][0] * M[1][1] - M[0][1] * M[1][0]
    : M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]));
  const D = det(simple);
  if (Math.abs(D) !== 1) return false;
  return sys.roots.every((v) => {
    const k = simple.map((_, i) => det(simple.map((b, j) => (j === i ? v.c : b))) / D);
    return f(v.c) > 0 ? k.every((x) => x >= 0) : k.every((x) => x <= 0);
  });
}

test('the simple roots found for a functional form a base of its positive system', () => {
  for (const A of ALL) {
    const n = A.length, sys = RS.kacMoody(A, { R: 30, H: 30, Him: 8 });
    const real = new Set(sys.roots.filter((v) => v.kind === 'real').map((v) => K(v.c)));
    let found = 0;
    for (let i = 0; i < 400; i++) {
      const nv = direction(n), res = RS.positive(sys, nv), f = RS.functional(sys, nv);
      if (sys.family === 'hyperbolic' && Math.hypot(...nv.slice(0, -1)) > Math.abs(nv[n - 1])) { assert.equal(res.why, 'timelike'); continue; }
      if (!res.ok) { assert.equal(res.why, 'limit', name(A)); continue; }
      found++;
      assert.ok(isBase(sys, f, res.simple), `${name(A)} at ${nv}`);
      for (const b of res.simple) if (Math.max(...b.map(Math.abs)) < 4) assert.ok(real.has(K(b)), `${name(A)}: ${b} is a root`);
      // the word is reduced: its length is the number of roots of Δ± on the wrong side
      if (res.word.length < (n === 2 ? 6 : 4)) {
        const flipped = sys.walls.filter((w) => res.sign * f(w.c) < 0).length;
        assert.equal(flipped, res.word.length, `${name(A)}: length at ${nv}`);
      }
      if (sys.family === 'finite') {
        assert.deepEqual(res.simple.map(K).sort(), RS.indecomposable(sys.roots, f).map((v) => K(v.c)).sort());
      }
    }
    assert.ok(found > (sys.family === 'hyperbolic' ? 60 : 150), `${name(A)} found ${found}`);
  }
});

test('finite types: one positive system for each element of the Weyl group', () => {
  const order = [[rank2(0, 0), 4], [rank2(1, 1), 6], [rank2(1, 2), 8], [rank2(3, 1), 12], [KM3.A3, 24], [KM3.B3, 48], [KM3.C3, 48]];
  for (const [A, size] of order) {
    const sys = RS.kacMoody(A), bases = new Set(), words = new Set();
    for (let i = 0; i < 20000; i++) {
      const res = RS.positive(sys, direction(A.length));
      if (res.ok) { bases.add(res.simple.map(K).join(';')); words.add(res.word.join('')); }
    }
    assert.equal(bases.size, size, name(A));
    assert.equal(words.size, size, name(A));
    // the longest word has as many letters as there are positive roots
    assert.equal(Math.max(...Array.from(words, (w) => w.length)), sys.walls.length, name(A));
  }
});

test('chambers: crossing walls reaches every chamber once, each with a base', () => {
  // finite types: all of them, as many as the Weyl group has elements
  const order = [[rank2(1, 1), 6], [rank2(1, 2), 8], [rank2(3, 1), 12], [KM3.A3, 24], [KM3.B3, 48], [KM3.C3, 48]];
  for (const [A, size] of order) {
    const sys = RS.kacMoody(A), list = RS.chambers(sys, sys.start);
    assert.equal(list.length, size, name(A));
    assert.equal(new Set(list.map((b) => b.map(K).join(';'))).size, size, name(A));
  }
  // infinite types: the chambers within reach are distinct, each base has the
  // Cartan matrix of the system, and a functional inside the chamber (the sum
  // of the dual basis) has that base as its simple roots
  for (const [label, A] of Object.entries(KM3)) {
    const sys = RS.kacMoody(A, { H: 12, Him: 6 });
    if (!sys.infinite) continue;
    const B = RS.quad(sys.gram), place = (c) => sys.E[0].map((_, k) => c.reduce((t, x, i) => t + x * sys.E[i][k], 0));
    const list = RS.chambers(sys, sys.start, (base) => Math.max(...base.flat().map(Math.abs)) < 40);
    assert.ok(list.length > 40, `${label}: ${list.length} chambers`);
    assert.equal(new Set(list.map((b) => b.map(K).join(';'))).size, list.length, label);
    for (const base of list) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.equal(2 * B(base[i], base[j]) / B(base[i], base[i]), A[i][j], `${label}: Cartan integer`);
      const rays = RS.dualBasis(base.map(place)), mid = [0, 1, 2].map((k) => rays[0][k] + rays[1][k] + rays[2][k]);
      // inside the Tits cone: positive on δ, or inside the upper light cone
      if (sys.family === 'affine') assert.ok(RS.functional(sys, mid)(sys.delta) > 0, label);
      else assert.ok(mid[2] > Math.hypot(mid[0], mid[1]), label);
      const l = Math.hypot(...mid), res = RS.positive(sys, mid.map((x) => x / l));
      assert.ok(res.ok, label);
      assert.deepEqual(res.simple, base, label);
    }
  }
});

test('hyperbolic types: every positive imaginary root is conjugate to a multiple of one in the standard chamber', () => {
  for (const [label, A] of Object.entries(KM3)) {
    if (FAMILY3[label] !== 'hyperbolic') continue;
    const sys = RS.kacMoody(A, { H: 12, Him: 9 }), B = RS.quad(sys.gram), anti = RS.antidominant(sys, 9), keys = new Set(anti.map(K));
    assert.ok(anti.length > 3, `${label}: ${anti.length}`);
    for (const a of anti) {
      assert.ok(B(a, a) <= 0 && a.reduce(gcd, 0) === 1, label);
      assert.ok(sys.mult(a) > 0n, `${label}: ${a} is a root`);
    }
    // descend: while (α, α_i) > 0 for some i, reflect in α_i; the height drops and the root stays positive
    for (const v of sys.roots) {
      if (v.kind !== 'imag' || v.ht < 0) continue;
      let c = v.c.slice();
      for (let guard = 0; guard < 1000; guard++) {
        const i = sys.gram.findIndex((row) => RS.dot(row, c) > 0);
        if (i < 0) break;
        c = c.map((x, j) => (j === i ? x - RS.dot(A[i], c) : x));
        assert.ok(c.every((x) => x >= 0), `${label}: ${v.c} stays positive`);
      }
      const g = c.reduce(gcd, 0);
      assert.ok(keys.has(K(c.map((x) => x / g))), `${label}: ${v.c} ends at ${c}`);
      assert.equal(sys.mult(c), v.mult, `${label}: multiplicity of ${v.c} and of ${c}`);
    }
    // the disc puts w(α) at the functional −(wα, ·): in the chamber of w, at the place of α in the standard one
    for (const base of RS.chambers(sys, sys.start, (b) => Math.max(...b.flat().map(Math.abs)) < 30)) {
      for (const a of anti.slice(0, 6)) {
        const c = [0, 1, 2].map((k) => a[0] * base[0][k] + a[1] * base[1][k] + a[2] * base[2][k]);
        for (let i = 0; i < 3; i++) assert.equal(B(c, base[i]), B(a, [0, 1, 2].map((k) => +(k === i))), label);
      }
    }
  }
});

test('B3 and C3: the same directions, so the same mirrors', () => {
  const frame = (sys) => {
    const rows = [];
    for (const e of sys.E) {
      let v = e.map((x) => x / Math.hypot(...e));
      for (const u of rows) { const t = RS.dot(v, u); v = v.map((x, k) => x - t * u[k]); }
      rows.push(v.map((x) => x / Math.hypot(...v)));
    }
    return rows;
  };
  const dirs = (sys) => { const F = frame(sys); return sys.roots.map((v) => F.map((row) => RS.dot(row, v.p) / Math.hypot(...v.p))); };
  const b = dirs(RS.kacMoody(KM3.B3)), c = dirs(RS.kacMoody(KM3.C3)), a = dirs(RS.kacMoody(KM3.A3));
  const same = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) < 1e-9;
  assert.equal(b.length, 18);
  for (const u of b) assert.ok(c.some((v) => same(u, v)), `no root of C3 along ${u}`);
  assert.ok(!a.every((u) => b.some((v) => same(u, v))), 'A3 is a different arrangement');
});

test('functionals with no positive system', () => {
  const a2 = RS.kacMoody(rank2(1, 1)), v = a2.roots[0];
  const res = RS.positive(a2, [-v.p[1], v.p[0]]);
  assert.equal(res.ok, false);
  assert.equal(res.why, 'root');
  assert.equal(RS.positive(RS.kacMoody(rank2(2, 2), { R: 10 }), [1, 0]).why, 'null');
  assert.equal(RS.positive(RS.kacMoody(rank2(3, 3), { R: 10 }), [Math.cos(0.3), Math.sin(0.3)]).why, 'timelike');
  assert.equal(RS.positive(RS.superSystem('sl21'), [0, 1]).why, 'root');
  assert.equal(RS.positive(RS.kacMoody(KM3['A2(1)'], { H: 10 }), [1, 0, 0]).why, 'null');
  assert.equal(RS.positive(RS.kacMoody(KM3['23∞'], { H: 10, Him: 4 }), [0.8, 0, 0.6]).why, 'timelike');
  // the standard positive system: the height
  for (const A of ALL) {
    const sys = RS.kacMoody(A, { R: 6, H: 6, Him: 4 }), r = RS.positive(sys, sys.start);
    assert.deepEqual([r.ok, r.word, r.sign], [true, [], 1], name(A));
  }
});

/* ---------- super ---------- */

test('super: the roots, by parity', () => {
  const expected = {
    sl21: [2, 4, 0], osp32: [4, 4, 2], osp14: [8, 0, 4],
    sl31: [6, 6, 0], osp52: [10, 8, 2], osp34: [10, 8, 4], d21: [6, 8, 0], g3: [14, 12, 2],
  };
  for (const id of RS.SUPER_IDS) {
    const sys = RS.superSystem(id), n = { even: 0, iso: 0, odd: 0 };
    sys.roots.forEach((v) => n[v.kind]++);
    assert.deepEqual([n.even, n.iso, n.odd], expected[id], id);
    assert.equal(new Set(sys.roots.map((v) => K(v.c))).size, sys.roots.length);
    // twice an odd root is a root exactly when it is not isotropic, and then it is even
    for (const v of sys.roots) {
      const dbl = sys.roots.find((u) => K(u.c) === K(v.c.map((x) => 2 * x)));
      assert.equal(!!dbl, v.kind === 'odd', `${id}: 2·(${v.c})`);
      if (dbl) assert.equal(dbl.kind, 'even');
    }
  }
});

// the axioms of a generalized root system in Serganova, On generalizations of root systems, Comm. Algebra 24 (1996)
test('super: Serganova’s axioms for a generalized root system', () => {
  const systems = RS.SUPER_IDS.map((id) => RS.superSystem(id)).concat([RS.superSystem('d21', 0.37), RS.superSystem('d21', 2.5)]);
  for (const sys of systems) {
    const B = RS.quad(sys.gram), has = (c) => sys.roots.some((u) => u.c.every((x, i) => Math.abs(x - c[i]) < 1e-6));
    for (const al of sys.roots) {
      assert.ok(has(al.c.map((x) => -x)));
      for (const be of sys.roots) {
        const ab = B(al.c, be.c);
        if (Math.abs(al.norm) > 1e-9) {
          const k = 2 * ab / al.norm;
          assert.ok(Math.abs(k - Math.round(k)) < 1e-9, `${sys.id}: Cartan integer`);
          assert.ok(has(be.c.map((x, i) => x - Math.round(k) * al.c[i])), `${sys.id}: reflection`);
        } else if (Math.abs(ab) > 1e-9) {
          assert.equal(has(be.c.map((x, i) => x + al.c[i])) + has(be.c.map((x, i) => x - al.c[i])), 1, `${sys.id}: odd reflection`);
        }
      }
    }
  }
});

test('super: positive systems, and their classes under the Weyl group', () => {
  // [positive systems, classes]. sl(m|n): (m+n)! orderings of the ε's and δ's;
  // osp(2m+1|2n): |W| times the (m+n choose m) shuffles; D(2,1;α): 8 · 4.
  const expected = { sl21: [6, 3], osp32: [8, 2], osp14: [8, 1], sl31: [24, 4], osp52: [48, 3], osp34: [48, 3], d21: [32, 4], g3: [96, 4] };
  for (const id of RS.SUPER_IDS) {
    const sys = RS.superSystem(id, 0.6), B = RS.quad(sys.gram);
    const systems = new Map(); // positive system → its simple roots
    for (let i = 0; i < (sys.rank === 2 ? 4000 : 60000); i++) {
      const nv = direction(sys.rank), res = RS.positive(sys, nv), f = RS.functional(sys, nv);
      if (!res.ok) continue;
      const id2 = sys.roots.filter((v) => f(v.c) > 0).map((v) => K(v.c)).sort().join(' ');
      if (systems.has(id2)) continue;
      assert.ok(isBase(sys, f, res.simple), id);
      systems.set(id2, res.simple);
    }
    // orbits under the reflections in the even roots
    const even = sys.roots.filter((v) => v.kind === 'even');
    const reflect = (al, k) => k.split(' ').map((s) => { const c = s.split(',').map(Number), t = Math.round(2 * B(al.c, c) / al.norm); return K(c.map((x, i) => x - t * al.c[i])); }).sort().join(' ');
    const classes = new Set();
    for (const k of systems.keys()) {
      const orbit = new Set([k]), todo = [k];
      while (todo.length) { const x = todo.pop(); for (const al of even) { const y = reflect(al, x); if (!orbit.has(y)) { assert.ok(systems.has(y), id); orbit.add(y); todo.push(y); } } }
      classes.add(Array.from(orbit).sort()[0]);
    }
    assert.deepEqual([systems.size, classes.size], expected[id], id);
    // the start is in the chamber of the distinguished simple roots
    const start = RS.positive(sys, sys.start);
    assert.deepEqual(start.simple.map(K).sort(), sys.E.map((_, i) => K(sys.E.map((__, j) => (i === j ? 1 : 0)))).sort(), id);
  }
});

/* ---------- diagrams and names ---------- */

test('Dynkin diagrams', () => {
  const bond = (b) => (b.heavy ? '~' : ['', '-', '=', '≡', '≣'][b.lines]) + ['', '<', '>', '<>'][b.arrow] + (b.label && !b.heavy ? '[' + b.label + ']' : '');
  const show = (d) => d.nodes.join('') + ' ' + d.bonds.map((b) => b.i + bond(b) + b.j).join(' ');
  const km = (A) => { const sys = RS.kacMoody(A, { R: 6, H: 6, Him: 4 }); return show(RS.diagram(sys, RS.positive(sys, sys.start).simple)); };
  assert.deepEqual([rank2(0, 0), rank2(1, 1), rank2(1, 2), rank2(3, 1), rank2(2, 2), rank2(4, 1), rank2(3, 3)].map(km),
    ['oo ', 'oo 0-1', 'oo 0=>1', 'oo 0≡<1', 'oo 0=<>1', 'oo 0≣<1', 'oo 0~1']);
  assert.equal(km(KM3.A3), 'ooo 0-1 1-2');
  assert.equal(km(KM3.B3), 'ooo 0-1 1=>2');
  assert.equal(km(KM3.C3), 'ooo 0-1 1=<2');
  assert.equal(km(KM3['A2(1)']), 'ooo 0-1 0-2 1-2');
  assert.equal(km(KM3['G2(1)']), 'ooo 0-1 1≡>2');
  assert.equal(km(KM3['23∞']), 'ooo 0=<>1 1-2');
  // every diagram a superalgebra shows, written from the lexicographically smaller end
  const all = (id, t) => {
    const sys = RS.superSystem(id, t), out = new Set();
    for (let i = 0; i < (sys.rank === 2 ? 2000 : 30000); i++) {
      const res = RS.positive(sys, direction(sys.rank));
      if (!res.ok) continue;
      const d = show(RS.diagram(sys, res.simple)), rev = show(RS.diagram(sys, res.simple.slice().reverse()));
      out.add(d < rev ? d : rev);
    }
    return Array.from(out).sort();
  };
  assert.deepEqual(all('sl21'), ['ox 0-1', 'xx 0-1']);        // ○—⊗ and ⊗—⊗
  assert.deepEqual(all('osp32'), ['bx 0=<1', 'ox 0=<1']);     // ⊗⇒● and ⊗⇒○
  assert.deepEqual(all('osp14'), ['bo 0=<1']);                // ○⇒●
  assert.deepEqual(all('sl31'), ['oox 0-1 1-2', 'oxx 0-1 1-2']); // δ at an end or inside, up to reversal
  // D(2,1;α) at α = 0.6: three diagrams with one odd root, and the triangle of odd roots with bonds 1, α, 1 + α
  const shape = (d) => d.split(' ')[0].split('').sort().join('') + ' ' + (d.match(/\[[^\]]*\]/g) || []).sort().join('') + ' ' + (d.split(' ').length - 1);
  assert.deepEqual(Array.from(new Set(all('d21', 0.6).map(shape))).sort(), ['oox [0.6] 2', 'oox [0.6][1.6] 2', 'oox [1.6] 2', 'xxx [0.6][1.6] 3']);
});

test('names', () => {
  assert.equal(RS.linear([3, -1], ['x', 'y']), '3x-y');
  assert.equal(RS.linear([0, 0], ['x', 'y']), '0');
  assert.equal(RS.linear([-1, 2], ['x', 'y']), '-x+2y');
  assert.equal(RS.wordTex([], 2), '1');
  assert.equal(RS.wordTex([2, 1, 2], 2), 's_2s_1s_2');
  assert.equal(RS.wordTex([1, 2, 1, 2, 1], 2), '(s_1s_2)^{2}s_1');
  assert.equal(RS.wordTex([1, 3, 2], 3), 's_1s_3s_2');
  const a11 = RS.kacMoody(rank2(2, 2), { R: 8 });
  assert.equal(RS.affineTex(a11, [3, 2]), '\\alpha_1+2\\delta');
  assert.equal(RS.affineTex(a11, [2, 2]), '2\\delta');
  const a21 = RS.kacMoody(KM3['A2(1)'], { H: 8 });
  assert.equal(RS.affineTex(a21, [2, 1, 1]), '\\alpha_1+\\delta');
  assert.equal(RS.rootTex(RS.superSystem('g3'), [1, 0, 0]), '\\varepsilon_1+\\delta');
  assert.equal(gcd(12, 18), 6);
});

test('G(3): roots are named ±ε_i, ε_i − ε_j, ±δ, ±2δ and ±ε_i ± δ, whatever the base', () => {
  const sys = RS.superSystem('g3'), names = new Set(sys.roots.map((v) => RS.rootTex(sys, v.c).replace(/\\varepsilon_/g, 'e').replace(/\\delta/g, 'd')));
  assert.equal(names.size, sys.roots.length);
  const want = ['2d', '-2d', 'd', '-d'];
  for (const i of [1, 2, 3]) {
    want.push('e' + i, '-e' + i, 'e' + i + '+d', 'e' + i + '-d', '-e' + i + '+d', '-e' + i + '-d');
    for (const j of [1, 2, 3]) if (i < j) want.push('e' + i + '-e' + j, '-e' + i + '+e' + j);
  }
  assert.deepEqual(Array.from(names).sort(), want.sort());
});

/* ---------- the disc: hyperbolic.js ---------- */
const HY = globalThis.Hyperbolic;
const mvec = (R, p) => R.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2]);
const mmul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const keepsForm = (L, tol, what) => {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const v = HY.lip([L[0][i], L[1][i], L[2][i]], [L[0][j], L[1][j], L[2][j]]);
    assert.ok(Math.abs(v - (i === j ? (i === 2 ? -1 : 1) : 0)) < tol, `${what}: column ${i}·${j} is ${v}`);
  }
};
const HYPERBOLIC = ['23∞', '∞∞∞', '344', '246'];

test('the disc: translations and their three numbers keep the form', () => {
  for (let k = 0; k < 50; k++) {
    const p = [rnd() * 1.6 - 0.8, rnd() * 1.6 - 0.8].map((x) => x * 0.7), q = [rnd() * 1.2 - 0.6, rnd() * 1.2 - 0.6];
    const T = HY.translation(p, q);
    keepsForm(T, 1e-9, 'translation');
    const at = HY.disc(mvec(T, HY.lift(p)));
    close(at[0], q[0], 'it takes p to q'); close(at[1], q[1], 'it takes p to q');
    const L = HY.fix(mmul(T, HY.fromParams([rnd() * 3, rnd() * 6 - 3, rnd() * 6 - 3]))), back = HY.fromParams(HY.params(L));
    L.forEach((r, i) => r.forEach((x, j) => assert.ok(Math.abs(x - back[i][j]) < 1e-9 * Math.max(1, Math.abs(x)), 'params round trip')));
  }
});

test('the disc: a polyline arc stays within its tolerance of the circle', () => {
  const g = { x: 3000, y: -200, r: 2950 }, pts = HY.arc(g, 2.9, 0.4, 0.1);
  for (let i = 1; i < pts.length; i++) {
    const m = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
    assert.ok(g.r - Math.hypot(m[0] - g.x, m[1] - g.y) <= 0.1 + 1e-9, 'a chord within 0.1 of the arc');
  }
});

test('the disc: big integer products are exact', () => {
  const M = [[144764107, -98485686, 66931182], [211949774, -144193332, 97994243], [24019028, -16340587, 11105115]];
  const c = [80852539, 148038206, 42956042];
  const want = M.map((r) => Number(r.reduce((s, x, i) => s + BigInt(x) * BigInt(c[i]), 0n)));
  assert.deepEqual(HY.imv(M, c), want);
  assert.deepEqual(HY.imv([[1, 2, 3], [4, 5, 6], [7, 8, 9]], [1, -1, 2]), [5, 11, 17]);
});

test('the disc: the Weyl group in integers and on functionals', () => {
  for (const k of HYPERBOLIC) {
    const sys = RS.kacMoody(KM3[k], { H: 6, Him: 4 }), W = HY.group(sys.cartan, sys.E);
    W.G.forEach((G, i) => { keepsForm(G, 1e-12, `${k}: s_${i + 1} keeps the form`); assert.deepEqual(mmul(W.R[i], W.R[i]), HY.I3); });
    // a word's frame: the chamber it names comes back, and the functionals agree
    for (let t = 0; t < 20; t++) {
      const word = Array.from({ length: 4 + Math.floor(rnd() * 30) }, () => 1 + Math.floor(rnd() * 3));
      const F = W.frame(word);
      assert.deepEqual(HY.imm(F.M, F.Mi), HY.I3, `${k}: M and Mi are inverse`);
      const res = RS.positive(sys, [0, 0, 1], { f: (c) => RS.height(HY.imv(F.M, c)) });
      assert.ok(res.ok);
      assert.deepEqual(HY.imm(W.frame(res.word).M, F.Mi), HY.I3, `${k}: the reduced word ${res.word.join('')} names the same chamber as ${word.join('')}`);
      const x = [0.1 * rnd() - 0.05, 0.1 * rnd() - 0.05, 1], f = W.exact(F, x), n = W.out(F, x), c = [1 + Math.floor(rnd() * 5), Math.floor(rnd() * 5), Math.floor(rnd() * 5)];
      const viaN = n.reduce((s, v, i) => s + v * sys.E.reduce((t, e, j) => t + c[j] * e[i], 0), 0);
      assert.ok(Math.abs(f(c) - viaN) < 1e-6 * Math.max(1, Math.abs(viaN)), `${k}: the exact functional is the functional of the model`);
      const back = W.into(F, n);
      back.forEach((v, i) => assert.ok(Math.abs(v - x[i]) < 1e-6, `${k}: into(out(x)) = x`));
    }
  }
});

test('the disc: a view far out is drawn exactly — a cusp is on the rim, and the mirrors through it meet there', () => {
  for (const k of ['23∞', '∞∞∞']) {
    const sys = RS.kacMoody(KM3[k], { H: 6, Him: 4 }), W = HY.group(sys.cartan, sys.E);
    const corner = RS.antidominant(sys, 6).find((a) => Math.abs(RS.quad(sys.gram)(a, a)) < 1e-9);
    const place = (c) => sys.E[0].map((_, j) => c.reduce((t, x, i) => t + x * sys.E[i][j], 0));
    let view = { L: HY.I3, F: W.origin };
    for (let step = 0; step < 400 && W.size(view.F) < 1e10; step++) {
      const t = 6.3 * step / 400 + 0.4, d = 0.6;
      view = W.recentre({ L: HY.fix(mmul(HY.translation([0, 0], [d * Math.cos(t), d * Math.sin(t)]), view.L)), F: view.F });
      keepsForm(view.L, 1e-9, k + ': the map of the view');
      assert.ok(view.L[2][2] < 1e3, `${k}: the map of the view stays small (${view.L[2][2]})`);
    }
    assert.ok(W.size(view.F) > 1e8, `${k}: the view went far out (${W.size(view.F)})`);
    // the chamber in the middle, in the frame; its ideal corner, and the walls through it
    const mid = RS.positive(sys, mvec(HY.inv(view.L), [0, 0, 1]));
    assert.ok(mid.ok);
    const b = mid.simple, delta = [0, 1, 2].map((j) => corner[0] * b[0][j] + corner[1] * b[1][j] + corner[2] * b[2][j]);
    const p = HY.disc(mvec(view.L, HY.flipZ(place(delta)).map((x) => -x)));
    // (a point on the rim comes through a square root near the light cone: rounding of 1e-15 in
    // the form moves it by 1e-6 of the radius, a thousandth of a pixel)
    assert.ok(Math.abs(Math.hypot(p[0], p[1]) - 1) < 1e-5, `${k}: the cusp is on the rim (${Math.hypot(p[0], p[1])})`);
    // the roots of the walls through it (those with (β, δ) = 0), and their images along the cusp
    const through = b.filter((beta) => Math.abs(RS.quad(sys.gram)(beta, delta)) < 1e-9);
    assert.ok(through.length >= 1);
    for (const beta of through) for (let m = 0; m < 20; m++) {
      const c = beta.map((x, i) => x + m * delta[i]);
      if (Math.abs(RS.quad(sys.gram)(c, c) - RS.quad(sys.gram)(beta, beta)) > 1e-9) continue;
      const g = HY.geodesic(mvec(view.L, HY.flipZ(place(c))));
      if (g.r === undefined) continue;
      assert.ok(Math.abs(Math.hypot(p[0] - g.x, p[1] - g.y) - g.r) < 1e-5, `${k}: the mirror of ${c} passes through the cusp`);
    }
  }
});
