// Independent checks of the mathematics in content/configuration-spaces/confspaces.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simplicialBetti, MODELS } from './helpers/simplicial-conf.mjs';
import { discreteBetti, pathGraph, cycleGraph } from './helpers/discrete-conf.mjs';

const CS = globalThis.ConfSpaces;
// the surfaces, which have classes and complexes; the line and the circle are described directly
const IDS = Object.keys(CS.SURFACES).filter((id) => CS.dimOf(id) === 2);
const CURVES = Object.keys(CS.SURFACES).filter((id) => CS.dimOf(id) === 1);
const poly = (...factors) => factors.reduce((p, q) => {
  const r = new Array(p.length + q.length - 1).fill(0);
  p.forEach((x, i) => q.forEach((y, j) => { r[i + j] += x * y; }));
  return r;
}, [1]);
const binom = (n, r) => (r < 0 || r > n ? 0 : Array.from({ length: r }, (_, i) => (n - i) / (i + 1)).reduce((a, b) => a * b, 1));

test('the surfaces: cup products graded commutative and associative, twists add', () => {
  for (const id of IDS) {
    const s = CS.surface(id), n = s.classes.length, deg = (c) => s.classes[c][1], tw = (c) => s.classes[c][2];
    const times = (u, v) => { // vectors as arrays of coefficients
      const out = new Array(n).fill(0);
      u.forEach((x, i) => v.forEach((y, j) => { if (x && y) for (const [k, c] of s.mult[i][j]) out[k] += x * y * c; }));
      return out;
    };
    const e = (i) => Array.from({ length: n }, (_, j) => +(i === j));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (const [k, c] of s.mult[i][j]) {
          assert.equal(deg(k), deg(i) + deg(j), id + ': degrees add');
          if (!s.orientable) assert.equal(tw(k), (tw(i) + tw(j)) % 2, id + ': twists add');
          const back = s.mult[j][i].find((p) => p[0] === k);
          assert.ok(back && back[1] === c * (deg(i) * deg(j) % 2 ? -1 : 1), id + ': graded commutative');
        }
        for (let l = 0; l < n; l++) assert.deepEqual(times(times(e(i), e(j)), e(l)), times(e(i), times(e(j), e(l))), id + ': associative');
      }
    }
  }
});

test('one point: the Betti numbers of the surface itself', () => {
  const want = { plane: [1], cylinder: [1, 1], mobius: [1, 1], torus: [1, 2, 1], klein: [1, 1], projective: [1], sphere: [1, 0, 1] };
  for (const id of IDS) {
    assert.deepEqual(CS.bettiOrdered(id, 1), want[id], id);
    assert.deepEqual(CS.bettiUnordered(id, 1), want[id], id);
    assert.equal(CS.chiFromBetti(want[id]), CS.SURFACES[id].chi, id + ': χ');
    // the simplicial models are the right surfaces, with the right orientation characters
    assert.deepEqual(simplicialBetti(id, 1), want[id], id + ': simplicial model');
  }
});

test('ordered: the known closed forms', () => {
  for (let k = 1; k <= 5; k++) {
    // Arnold: Π_{j<k} (1 + jt); C minus a point: Π_{j≤k} (1 + jt), as Conf_{k+1}(C) ≅ C × Conf_k(C*)
    assert.deepEqual(CS.bettiOrdered('plane', k), poly(...Array.from({ length: k - 1 }, (_, j) => [1, j + 1])), 'plane ' + k);
    assert.deepEqual(CS.bettiOrdered('cylinder', k), poly(...Array.from({ length: k }, (_, j) => [1, j + 1])), 'cylinder ' + k);
    // Feichtner–Ziegler: Conf_k(S²) ≃ PSL_2(C) × M_{0,k} for k ≥ 3
    if (k >= 3) assert.deepEqual(CS.bettiOrdered('sphere', k), poly([1, 0, 0, 1], ...Array.from({ length: k - 3 }, (_, j) => [1, j + 2])), 'sphere ' + k);
  }
  // the torus is a group: Conf_k(T) ≅ T × Conf_{k−1}(T minus a point); for k = 3 the
  // Serre spectral sequence of Conf_2(T minus 0) → T minus 0, with its section, gives 1 + 4t + 5t²
  assert.deepEqual(CS.bettiOrdered('torus', 2), poly([1, 1], [1, 1], [1, 2]));
  assert.deepEqual(CS.bettiOrdered('torus', 3), poly([1, 1], [1, 1], [1, 4, 5]));
  // the Möbius band, by the same spectral sequence for Conf_2(M) → M
  assert.deepEqual(CS.bettiOrdered('mobius', 2), [1, 2, 1]);
});

test('unordered: Knudsen\'s examples', () => {
  for (let k = 2; k <= 8; k++) {
    assert.deepEqual(CS.bettiUnordered('plane', k), [1, 1], 'plane');
    // R² minus one point: 1 in degrees 0 and k, 2 in between
    assert.deepEqual(CS.bettiUnordered('cylinder', k), [1].concat(new Array(k - 1).fill(2), [1]), 'cylinder');
    assert.deepEqual(CS.bettiUnordered('mobius', k), [1, 1], 'open Möbius band');
    assert.deepEqual(CS.bettiUnordered('projective', k), [1, 0, 0, 1], 'RP²');
    // Remark 5.11: 1 in degrees 0, 1, 2 and k + 1, 2 from 3 to k
    assert.deepEqual(CS.bettiUnordered('klein', k), Array.from({ length: k + 2 }, (_, i) => (i <= 2 || i === k + 1 ? 1 : 2)), 'Klein bottle');
  }
  assert.deepEqual(CS.bettiUnordered('sphere', 2), [1]); // UConf_2(S²) ≃ RP²
  for (let k = 3; k <= 8; k++) assert.deepEqual(CS.bettiUnordered('sphere', k), [1, 0, 0, 1]);
});

test('Euler characteristics: the falling factorial of χ(Σ)', () => {
  for (const id of IDS) {
    for (let k = 1; k <= 5; k++) {
      assert.equal(CS.chiFromBetti(CS.bettiOrdered(id, k)), CS.chiOrdered(id, k), id + ' ordered ' + k);
      assert.equal(CS.chiFromBetti(CS.bettiUnordered(id, k)), CS.chiUnordered(id, k), id + ' unordered ' + k);
    }
  }
});

test('the complexes square to zero', () => {
  const check = (c) => {
    for (const keys of c.basis.values()) {
      for (const key of keys) {
        const dd = new Map();
        for (const [k2, x] of c.d(key)) for (const [k3, y] of c.d(k2)) dd.set(k3, (dd.get(k3) || 0) + x * y);
        for (const v of dd.values()) assert.equal(v, 0);
      }
    }
  };
  for (const id of IDS) {
    for (let k = 2; k <= 4; k++) { check(CS.orderedComplex(id, k)); check(CS.unorderedComplex(id, k)); }
  }
});

test('unordered = the invariants of ordered under the symmetric group', () => {
  for (const id of IDS) {
    for (let k = 2; k <= 4; k++) {
      const group = CS.groupOf(k, [[...Array(k).keys()]]);
      assert.equal(group.length, [1, 1, 2, 6, 24][k]);
      assert.deepEqual(CS.orderedComplex(id, k).invariantBetti(group), CS.bettiUnordered(id, k), id + ' ' + k);
    }
  }
});

test('the simplicial model agrees, up to three points', () => {
  for (const id of Object.keys(MODELS)) {
    for (let k = 2; k <= 3; k++) {
      assert.deepEqual(simplicialBetti(id, k), CS.bettiOrdered(id, k), id + ' ordered ' + k);
      assert.deepEqual(simplicialBetti(id, k, true), CS.bettiUnordered(id, k), id + ' unordered ' + k);
    }
  }
  // and for four unordered points on the torus and the Klein bottle
  for (const id of ['torus', 'klein']) assert.deepEqual(simplicialBetti(id, 4, true), CS.bettiUnordered(id, 4), id + ' unordered 4');
});

test('collision strata: counts, covering relations, Euler characteristics', () => {
  const bell = [1, 1, 2, 5, 15, 52], partitions = [1, 1, 2, 3, 5, 7];
  for (let k = 1; k <= 5; k++) {
    const o = CS.strata(k, true), u = CS.strata(k, false);
    assert.equal(o.nodes.length, bell[k]);
    assert.equal(u.nodes.length, partitions[k]);
    for (const { nodes, edges } of [o, u]) for (const [a, b] of edges) assert.equal(nodes[a].parts, nodes[b].parts + 1);
    // every stratum but the deepest lies in the closure of one more open
    for (const { nodes, edges } of [o, u]) nodes.forEach((n, i) => { if (n.parts < k) assert.ok(edges.some(([, b]) => b === i)); });
    // the strata of Σ^k are the Conf_{|π|}(Σ): Σ_π (χ)_{|π|} = χ^k; those of Sym^k Σ have
    // χ = (χ)_ℓ / Π m_i!, and add up to Macdonald's χ(Sym^k Σ) = binom(χ + k − 1, k)
    for (const id of IDS) {
      const chi = CS.SURFACES[id].chi;
      assert.equal(o.nodes.reduce((t, n) => t + CS.falling(chi, n.parts), 0), chi ** k, id);
      assert.equal(u.nodes.reduce((t, n) => t + CS.chiStratum(id, n.lambda), 0), binom(chi + k - 1, k), id);
    }
  }
  // the stratum of type (2, 1, 1): one double point and two simple ones, Conf_3/Σ_2
  assert.deepEqual(CS.groupsOf([2, 1, 1]), [[0], [1, 2]]);
  for (const id of IDS) {
    const b = CS.bettiQuotient(id, 3, [[0], [1, 2]]);
    assert.equal(CS.chiFromBetti(b), CS.chiStratum(id, [2, 1, 1]), id);
    assert.deepEqual(CS.bettiQuotient(id, 2, [[0], [1]]), CS.bettiOrdered(id, 2));
  }
});

test('the square model: wrapping and gluing', () => {
  const pts = [[0.2, 0.3], [0.05, 0.9], [0.7, 0.01], [0.99, 0.5]];
  for (const id of IDS.filter((x) => !CS.SURFACES[x].ball)) {
    for (const p of pts) {
      // each neighbouring square is glued back onto the square
      for (const n of CS.neighbours(id)) {
        const q = CS.wrap(id, n.f(p));
        assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-12, id + ' ' + n.dx + ',' + n.dy);
      }
      assert.ok(CS.dist(id, p, p) === 0);
    }
  }
  // the Möbius band: (0, y) ~ (1, 1 − y), and twice round is a translation
  assert.ok(CS.dist('mobius', [0, 0.3], [1, 0.7]) < 1e-12);
  assert.deepEqual(CS.wrap('mobius', [1.25, 0.2]), [0.25, 0.8]);
  assert.deepEqual(CS.wrap('mobius', [2.25, 0.2]), [0.25, 0.2]);
  // the Klein bottle: (x, 0) ~ (1 − x, 1)
  assert.ok(CS.dist('klein', [0.3, 0], [0.7, 1]) < 1e-12);
  // open directions are clamped
  assert.deepEqual(CS.wrap('cylinder', [1.5, 1.4], 0.05), [0.5, 0.95]);
  assert.deepEqual(CS.wrap('plane', [-1, 2], 0.05), [0.05, 0.95]);
  // the line and the circle: every point has y = ½; the circle's ends are glued, the line's open
  assert.deepEqual(CS.wrap('circle', [1.25, 0.9]), [0.25, 0.5]);
  assert.deepEqual(CS.wrap('circle', [-0.25, 0.1]), [0.75, 0.5]);
  assert.deepEqual(CS.wrap('line', [1.25, 0.9], 0.05), [0.95, 0.5]);
  assert.ok(CS.dist('circle', [0.02, 0.5], [0.98, 0.5]) < 0.05);
  assert.equal(CS.neighbours('line').length, 0);
});

test('the sphere models: unit vectors, the projective plane\'s opposite ones the same', () => {
  const close = (u, v, eps = 1e-12) => u.every((x, i) => Math.abs(x - v[i]) < eps);
  assert.deepEqual(CS.wrap('sphere', [0, 3, 4]), [0, 0.6, 0.8]);
  const p = [0.6, 0, 0.8], q = [0, 1, 0];
  // the distance is the angle; on RP² that to the nearer of q and −q
  assert.ok(Math.abs(CS.dist('sphere', p, q) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(CS.dist('sphere', p, p.map((x) => -x)) - Math.PI) < 1e-12);
  assert.ok(CS.dist('projective', p, p.map((x) => -x)) < 1e-12);
  assert.ok(close(CS.near('projective', p, [-0.6, 0, -0.8]), p));
  // the shortest way: along a great circle, on the sphere throughout, a fraction t of the angle
  for (const t of [0, 0.25, 0.5, 1]) {
    const r = CS.toward('sphere', p, q, t);
    assert.ok(Math.abs(Math.hypot(...r) - 1) < 1e-12);
    assert.ok(Math.abs(CS.dist('sphere', p, r) - t * Math.PI / 2) < 1e-12);
  }
  // on RP², towards the nearer copy
  assert.ok(close(CS.toward('projective', p, [-0.6, 0, -0.79].map((x) => x / Math.hypot(0.6, 0, 0.79)), 0), p));
  assert.ok(CS.dist('projective', CS.toward('projective', [1, 0, 0], [-0.8, 0.6, 0], 1), [0.8, -0.6, 0]) < 1e-12);
  assert.equal(CS.neighbours('sphere').length, 0);
  // the square models move in a straight line, across a glued edge the short way
  assert.ok(close(CS.toward('torus', [0.9, 0.5], [0.1, 0.5], 0.5), [0, 0.5], 1e-12));
  assert.ok(close(CS.toward('circle', [0.95, 0.5], [0.05, 0.5], 0.25), [0.975, 0.5], 1e-12));
});

/* ---------- the line and the circle ---------- */

const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

test('the line and the circle: a component for each order, or cyclic order, of the points', () => {
  for (let k = 1; k <= 6; k++) {
    // on the line, k! open simplices; the unordered space is one of them
    assert.deepEqual(CS.bettiOrdered('line', k), [fact(k)], 'line ' + k);
    assert.deepEqual(CS.bettiUnordered('line', k), [1], 'line, unordered ' + k);
    // on the circle, (k − 1)! circles times simplices; unordered, one
    assert.deepEqual(CS.bettiOrdered('circle', k), [fact(k - 1), fact(k - 1)], 'circle ' + k);
    assert.deepEqual(CS.bettiUnordered('circle', k), [1, 1], 'circle, unordered ' + k);
    for (const id of CURVES) {
      assert.equal(CS.chiFromBetti(CS.bettiOrdered(id, k)), CS.chiOrdered(id, k), id + ' χ ' + k);
      assert.equal(CS.chiFromBetti(CS.bettiUnordered(id, k)), CS.chiUnordered(id, k), id + ' χ, unordered ' + k);
    }
  }
  // χ by the fibrations: taking a point out of a curve raises χ by 1
  assert.deepEqual([1, 2, 3, 4].map((k) => CS.chiOrdered('line', k)), [1, 2, 6, 24]);
  assert.deepEqual([1, 2, 3, 4].map((k) => CS.chiOrdered('circle', k)), [0, 0, 0, 0]);
});

test('the line and the circle: Abrams\'s discretised configuration spaces agree', () => {
  for (let k = 1; k <= 4; k++) {
    // subdivided enough: the path with k + 1 edges, the cycle with k + 2
    assert.deepEqual(discreteBetti(pathGraph(k + 1), k), CS.bettiOrdered('line', k), 'line ' + k);
    assert.deepEqual(discreteBetti(pathGraph(k + 1), k, true), CS.bettiUnordered('line', k), 'line, unordered ' + k);
    assert.deepEqual(discreteBetti(cycleGraph(k + 2), k), CS.bettiOrdered('circle', k), 'circle ' + k);
    assert.deepEqual(discreteBetti(cycleGraph(k + 2), k, true), CS.bettiUnordered('circle', k), 'circle, unordered ' + k);
  }
});

test('the line and the circle: the strata, counted by Burnside\'s lemma', () => {
  // a stratum Conf_ℓ(M)/G has a component for each orbit of G on the (cyclic) orders:
  // on the line ℓ!/|G|, as G acts freely; on the circle the average number of cyclic orders a
  // relabelling keeps
  const cyclic = (o) => { const z = o.indexOf(0); return o.slice(z).concat(o.slice(0, z)).join(','); };
  for (let l = 1; l <= 5; l++) {
    for (const lambda of CS.intPartitions(l)) {
      // the stratum of type λ: Conf_n(M) divided by the relabellings of points of the same multiplicity
      const groups = CS.groupsOf(lambda), G = CS.groupOf(lambda.length, groups);
      const n = lambda.length, orders = CS.ONE.orders('circle', n);
      const fixed = G.reduce((t, g) => t + orders.filter((o) => cyclic(o.map((x) => g[x])) === o.join(',')).length, 0);
      assert.deepEqual(CS.bettiQuotient('line', n, groups), [fact(n) / G.length], 'line ' + lambda);
      assert.deepEqual(CS.bettiQuotient('circle', n, groups), [fixed / G.length, fixed / G.length], 'circle ' + lambda);
      for (const id of CURVES) assert.equal(CS.chiFromBetti(CS.bettiQuotient(id, n, groups)), CS.chiStratum(id, lambda), id + ' χ ' + lambda);
    }
  }
  // χ with compact supports adds up over the strata of M^k: Σ_π (−1)^{|π|} χ(Conf_{|π|} M) = (−χ(M))^k
  for (let k = 1; k <= 5; k++) {
    const o = CS.strata(k, true);
    for (const id of CURVES) assert.equal(o.nodes.reduce((t, n) => t + (-1) ** n.parts * CS.chiOrdered(id, n.parts), 0), (-CS.SURFACES[id].chi) ** k + 0, id + ' ' + k);
  }
});

test('the line and the circle: a picture for two, three and four points', () => {
  assert.deepEqual([1, 2, 3, 4].map((k) => CS.picture('line', k)), [null, 'square', 'cube', 'sphere']);
  assert.deepEqual([1, 2, 3, 4].map((k) => CS.picture('circle', k)), [null, 'square', 'cube', 'cube']);
  for (const id of CURVES) for (let k = 1; k <= 4; k++) assert.equal(CS.noPicture(id, k), null);
  const P = (...xs) => xs.map((x) => [x, 0.5]);
  // the cube: the points' places, on the circle taken mod 1; four on the circle relative to x₁
  assert.deepEqual(CS.cubePoint('line', P(0.2, 0.7, 0.4)), [0.2, 0.7, 0.4]);
  assert.deepEqual(CS.cubePoint('circle', P(0.9, 0.1, 0.5, 0.95)).map((x) => +x.toFixed(9)), [0.2, 0.6, 0.05]);
  // a collision lies on its plane: coordinates a and b agree
  for (const k of [3, 4]) {
    for (const [i, j, a, b] of CS.cubePlanes(k)) {
      const x = [0.13, 0.42, 0.66, 0.87];
      x[j] = x[i];
      const q = CS.cubePoint('circle', P(...x.slice(0, k)));
      assert.ok(Math.abs(q[a] - q[b]) < 1e-12, k + ': ' + i + j);
    }
  }
  // the sphere: centred and scaled; x_i = x_j lies on the great circle ij, and the circles are
  // orthogonal to the right normals; the 24 orders land in 24 different triangles
  const sign = (v, i, j) => Math.sign(CS.spherePoint(v.map((x) => [x, 0.5])).reduce((t, c, m) => t + c * ([[1, 1, -1, -1], [1, -1, 1, -1], [1, -1, -1, 1]][m][i] - [[1, 1, -1, -1], [1, -1, 1, -1], [1, -1, -1, 1]][m][j]), 0));
  const seen = new Set();
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p))));
  for (const p of perms([0.1, 0.35, 0.6, 0.9])) {
    const v = CS.spherePoint(p.map((x) => [x, 0.5]));
    assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12);
    const pattern = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      pattern.push(sign(p, i, j));
      assert.equal(sign(p, i, j), Math.sign(p[i] - p[j]), 'the side of the circle ij is the order of x_i and x_j');
    }
    seen.add(pattern.join(','));
  }
  assert.equal(seen.size, 24);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const x = [0.1, 0.35, 0.6, 0.9];
      x[j] = x[i];
      const v = CS.spherePoint(P(...x)), circle = CS.sphereCircle(i, j, 12);
      // on the circle: v is in the plane of two of its points
      const [a, b] = [circle[0], circle[3]], n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      assert.ok(Math.abs(n[0] * v[0] + n[1] * v[1] + n[2] * v[2]) < 1e-12, 'x' + (i + 1) + ' = x' + (j + 1));
    }
  }
  assert.equal(CS.spherePoint(P(0.4, 0.4, 0.4, 0.4)), null);
});

// the exact Gauss linking number of two closed polygons in R³ (Klenin and Langowski's
// formula: the signed solid angle of each pair of segments)
function linking(P, Q) {
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
  const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x)));
  let t = 0;
  for (let i = 0; i < P.length; i++) {
    const p1 = P[i], p2 = P[(i + 1) % P.length];
    for (let j = 0; j < Q.length; j++) {
      const p3 = Q[j], p4 = Q[(j + 1) % Q.length];
      const r13 = sub(p3, p1), r14 = sub(p4, p1), r23 = sub(p3, p2), r24 = sub(p4, p2);
      const n = [cross(r13, r14), cross(r14, r24), cross(r24, r23), cross(r23, r13)].map(unit);
      const omega = asin(dot(n[0], n[1])) + asin(dot(n[1], n[2])) + asin(dot(n[2], n[3])) + asin(dot(n[3], n[0]));
      t += omega * Math.sign(dot(cross(sub(p4, p3), sub(p2, p1)), r13));
    }
  }
  return t / (4 * Math.PI);
}

test('three points in the plane: S³ minus three Hopf circles, or minus a trefoil', () => {
  const circles = CS.collisionCurves(true, 160), knot = CS.collisionCurves(false, 320)[0].pts;
  // the collision configurations lie on the curves: a configuration with x_i = x_j is mapped onto circle ij
  for (const c of circles) {
    const pts = [[0.2, 0.3], [0.7, 0.6], [0.4, 0.9]];
    pts[c.pair[1]] = pts[c.pair[0]].slice();
    const p = CS.point3(pts, true), q = CS.point3(pts, false);
    assert.ok(Math.min(...c.pts.map((x) => Math.hypot(x[0] - p[0], x[1] - p[1], x[2] - p[2]))) < 0.05);
    assert.ok(Math.min(...knot.map((x) => Math.hypot(x[0] - q[0], x[1] - q[1], x[2] - q[2]))) < 0.05);
  }
  // any two circles form a Hopf link (fibres of the Hopf map)
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) assert.equal(Math.round(linking(circles[a].pts, circles[b].pts) * 1000) / 1000, 1);
  // unordered depends only on the set of points
  const base = [[0.3, 0.36], [0.92, 0.25], [0.57, 0.7]];
  assert.deepEqual(CS.point3(base, false).map((x) => x.toFixed(9)), CS.point3([base[2], base[0], base[1]], false).map((x) => x.toFixed(9)));
  // Loops of configurations, and their linking numbers with the collisions: the
  // winding number of x_j − x_i is the linking number with circle ij, and with
  // the trefoil that of the discriminant Π (x_i − x_j)², twice the sum.
  const loop = (f, n = 360) => Array.from({ length: n }, (_, s) => f(s / n));
  const rot = (c, p, th) => [c[0] + Math.cos(th) * (p[0] - c[0]) - Math.sin(th) * (p[1] - c[1]), c[1] + Math.sin(th) * (p[0] - c[0]) + Math.cos(th) * (p[1] - c[1])];
  const round = (a, b) => loop((t) => base.map((p, m) => (m === b ? [base[a][0] + 0.08 * Math.cos(2 * Math.PI * t), base[a][1] + 0.08 * Math.sin(2 * Math.PI * t)] : p)));
  const centre = [0, 1].map((d) => (base[0][d] + base[1][d] + base[2][d]) / 3);
  const cases = [
    [round(0, 1), [1, 0, 0]], [round(1, 2), [0, 0, 1]], [round(2, 0), [0, 1, 0]],
    [loop((t) => base.map((p) => rot(centre, p, 2 * Math.PI * t))), [1, 1, 1]], // the rotation: a Hopf fibre
  ];
  for (const [L, w] of cases) {
    const path = L.map((pts) => CS.point3(pts, true)), upath = L.map((pts) => CS.point3(pts, false));
    assert.deepEqual(circles.map((c) => Math.round(linking(path, c.pts)) + 0), w); // + 0: no −0
    assert.equal(Math.round(linking(upath, knot)) + 0, 2 * (w[0] + w[1] + w[2]));
  }
  // a swap, half a turn of x₁ and x₂ about their midpoint, is a loop of unordered
  // configurations once round the trefoil: a meridian, the braid generator σ₁
  const mid = [0, 1].map((d) => (base[0][d] + base[1][d]) / 2);
  const swap = loop((t) => base.map((p, m) => (m < 2 ? rot(mid, p, Math.PI * t) : p))).map((pts) => CS.point3(pts, false));
  assert.equal(Math.round(linking(swap, knot) * 1000) / 1000, 1);
});

test('two points: the relative position, on the surface minus the collision', () => {
  assert.equal(CS.picture('plane', 3), '3d');
  for (const id of ['plane', 'cylinder', 'torus']) assert.equal(CS.picture(id, 2), '2d');
  assert.equal(CS.picture('mobius', 2), 'mobius');
  assert.equal(CS.picture('klein', 2), null);
  assert.equal(CS.picture('projective', 2), 'quaternion');
  assert.equal(CS.picture('torus', 3), null);
  assert.deepEqual([1, 2, 3, 4, 5].map((k) => CS.picture('sphere', k)), [null, 'direction', 'rotation', null, null]);
  assert.deepEqual(CS.relative('torus', [0.9, 0.1], [0.1, 0.95]).map((x) => +x.toFixed(9)), [0.2, -0.15]);
  assert.deepEqual(CS.relative('cylinder', [0.9, 0.1], [0.1, 0.95]).map((x) => +x.toFixed(9)), [0.2, 0.85]);
  assert.deepEqual(CS.relative('plane', [0.9, 0.1], [0.1, 0.95]).map((x) => +x.toFixed(9)), [-0.8, 0.85]);
});

test('no picture: a reason exactly where none is drawn, from the Betti numbers where they suffice', () => {
  const drawn = ['plane', 'cylinder', 'mobius', 'torus', 'klein', 'sphere', 'projective'];
  for (const id of drawn) {
    for (let k = 2; k <= 4; k++) {
      const why = CS.noPicture(id, k), b = CS.bettiReduced(id, k);
      assert.equal(why === null, !!CS.picture(id, k), id + ' ' + k);
      // a picture is a manifold of dimension ≤ 3: nothing above degree 3, b₃ ≤ 1
      if (CS.picture(id, k)) assert.ok(b.length <= 4 && (b[3] || 0) <= 1, id + ' ' + k + ': drawn, so small');
      if (why && why.betti) {
        const [i, n] = why.betti;
        assert.equal(b[i], n);
        assert.ok(i >= 4 ? n > 0 : n >= 2);
      }
    }
  }
  // translations set aside: Conf_k Σ = Σ × Conf_{k−1}(Σ∖0), with χ(Σ∖0) = χ(Σ) − 1
  for (const id of CS.TRANSLATE) {
    for (let k = 2; k <= 5; k++) assert.equal(CS.chiFromBetti(CS.bettiReduced(id, k)), CS.falling(CS.SURFACES[id].chi - 1, k - 1), id + ' ' + k);
  }
  // the cylinder minus a point is C minus two points: Conf_{k−1} of it has Π_{j=2}^{k} (1 + jt)
  for (let k = 2; k <= 5; k++) assert.deepEqual(CS.bettiReduced('cylinder', k), poly(...Array.from({ length: k - 1 }, (_, j) => [1, j + 2])), 'cylinder ' + k);
  // three points on the torus or cylinder: aspherical with χ = 2; unordered, the sum fixed, 9·2/3! or 3·2/3!
  assert.deepEqual(CS.noPicture('torus', 3), { chi: 2, chiUnordered: 3 });
  assert.deepEqual(CS.noPicture('cylinder', 3), { chi: 2, chiUnordered: 1 });
  // where the Betti numbers do not decide: those of a closed 3-manifold, or of S³
  assert.deepEqual(CS.bettiReduced('klein', 2), [1, 2, 2, 1]);
  assert.deepEqual(CS.bettiReduced('projective', 2), [1, 0, 0, 1]);
  assert.deepEqual(CS.bettiReduced('projective', 3), [1, 0, 0, 1]);
  // the sphere: S² and RP³ have pictures; from four points on, b₄ ≠ 0
  assert.deepEqual(CS.bettiReduced('sphere', 3), [1, 0, 0, 1]);
  assert.deepEqual(CS.noPicture('sphere', 4), { betti: [4, 2] });
});

// the distance from the orbit qG to r, for G a group of unit quaternions (with q and −q the same rotation)
const orbitGap = (q, r, G) => Math.min(...G.map((g) => { const t = CS.qmul(q, g); return Math.min(Math.hypot(...t.map((x, i) => x - r[i])), Math.hypot(...t.map((x, i) => x + r[i]))); }));
const rot = (q, v) => CS.qmul(CS.qmul(q, [0, ...v]), [q[0], -q[1], -q[2], -q[3]]).slice(1);
const unitv = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
// a loop of configurations lifted to S³, continuously, through the orbits qG: where it ends, from where it began
function lift(loop, quat, G) {
  let first = null, prev = null;
  for (const pts of loop) {
    const q = quat(pts);
    let best = null, bd = Infinity;
    for (const g of G) for (const sg of [1, -1]) {
      const r = CS.qmul(q, g).map((x) => sg * x), d = prev ? Math.hypot(...r.map((x, i) => x - prev[i])) : 0;
      if (d < bd) { bd = d; best = r; }
    }
    first = first || best;
    prev = best;
  }
  return [first, prev];
}

test('prisms: S³ divided by the binary dihedral groups', () => {
  for (const n of [2, 3, 4]) {
    const G = CS.dicyclic(n), P = CS.prism(n);
    // a group of order 4n, closed under products
    assert.equal(G.length, 4 * n);
    for (const a of G) for (const b of G) assert.ok(orbitGap(CS.qmul(a, b), [1, 0, 0, 0], G) < 1e-9 || G.some((g) => Math.hypot(...g.map((x, i) => x - CS.qmul(a, b)[i])) < 1e-9));
    // the prism: |z| ≤ tan(π/2n), a 2n-gon of inradius 1; random orbits land in it
    for (let t = 0; t < 200; t++) {
      const q = unitv([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]), p = CS.toPrism(q, n);
      assert.ok(Math.abs(p[2]) <= P.h + 1e-9);
      for (let m = 0; m < 2 * n; m++) assert.ok(p[0] * Math.cos(m * Math.PI / n) + p[1] * Math.sin(m * Math.PI / n) <= 1 + 1e-9);
    }
    // its 6n edges are glued in threes
    assert.equal(P.edges.length, 6 * n);
    for (let c = 1; c <= 2 * n; c++) assert.equal(P.edges.filter((e) => e.n === c).length, 3, n + ': class ' + c);
  }
  // n = 2 is the quaternion group and the cube; the face X = 1 is glued to X = −1 after a quarter turn, by q ↦ q(−i)
  assert.ok(Math.abs(CS.prism(2).h - 1) < 1e-12);
  const face = CS.qmul([1, 1, 0.3, -0.6], [0, -1, 0, 0]);
  assert.ok(face.slice(1).map((x) => x / face[0]).every((x, i) => Math.abs(x - [-1, 0.6, 0.3][i]) < 1e-12));
  // and the top of a prism to its bottom after a 2n-th of a turn
  for (const n of [3, 4]) {
    const h = CS.prism(n).h, q = [1, 0.3, 0.2, h], g = CS.dicyclic(n).find((x) => x[0] < 1 - 1e-9 && Math.abs(CS.qmul(q, x)[0] - 1) < 1e-9), r = CS.qmul(q, g);
    const img = r.slice(1).map((x) => x / r[0]), a = Math.atan2(img[1], img[0]) - Math.atan2(0.2, 0.3);
    assert.ok(Math.abs(img[2] + h) < 1e-12 && Math.abs(Math.hypot(img[0], img[1]) - Math.hypot(0.3, 0.2)) < 1e-12);
    assert.ok(Math.abs(Math.abs(a) - Math.PI / n) < 1e-9, 'a turn by π/n');
  }
});

test('two points on the projective plane: S³/Q₈ as a cube, unordered S³/Q₁₆ as an octagonal prism', () => {
  const close = (u, v, eps = 1e-9) => u.every((x, i) => Math.abs(x - v[i]) < eps);
  const a0 = unitv([0.3, 0.4, 0.8]), b0 = unitv([-0.5, 0.6, 0.2]);
  for (const [a, b] of [[a0, b0], [[1, 0, 0], [0, 1, 0]], [unitv([0.2, 0.1, 0.9]), unitv([0.25, 0.1, 0.9])]]) {
    // the frame is orthonormal and right-handed, and its quaternion turns the axes onto it
    const F = CS.frameOf(a, b), q = CS.quatOf(F);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(F[i].reduce((t, x, c) => t + x * F[j][c], 0) - (i === j ? 1 : 0)) < 1e-9);
    for (let i = 0; i < 3; i++) assert.ok(close(rot(q, [0, 1, 2].map((c) => (c === i ? 1 : 0))), F[i]));
    // the lines are turned apart in their plane, equally: the frame's first two lines span it, each
    // as far from its line as the other
    const n = unitv(CS.SURFACES && [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
    assert.ok(Math.abs(Math.abs(F[2].reduce((t, x, c) => t + x * n[c], 0)) - 1) < 1e-9);
    const ang = (u, v) => Math.acos(Math.min(1, Math.abs(u.reduce((t, x, c) => t + x * v[c], 0))));
    assert.ok(Math.abs(ang(F[0], a) - ang(F[1], b)) < 1e-9);
    // the same point of the cube for either representative of each line; of the prism also in either order
    for (const [u, v] of [[a.map((x) => -x), b], [a, b.map((x) => -x)]]) assert.ok(orbitGap(CS.quatOf(CS.frameOf(u, v)), q, CS.Q8) < 1e-9);
    assert.ok(orbitGap(CS.quatOf(CS.frameOf(b, a)), q, CS.dicyclic(4)) < 1e-9);
    assert.ok(CS.projectivePair(a, b).every((x) => Math.abs(x) <= 1 + 1e-12), 'in the cube');
  }
  assert.equal(CS.projectivePair(a0, a0), null, 'a collision is not in the space');
  assert.equal(CS.projectivePair(a0, a0.map((x) => -x)), null, 'nor are opposite vectors, the same line');
  // x₂ once round x₁ is −1 in Q₈, of order two: lift the loop to S³ and see where it ends
  const e1 = unitv([0.4, -0.8, 0.1].map((x, i) => x - 0 * i)), t1 = unitv([e1[1], -e1[0], 0]), t2 = [e1[1] * t1[2] - e1[2] * t1[1], e1[2] * t1[0] - e1[0] * t1[2], e1[0] * t1[1] - e1[1] * t1[0]];
  const round = (turns) => Array.from({ length: 720 * turns + 1 }, (_, m) => {
    const th = m / 720 * 2 * Math.PI, r = 0.3;
    return [e1, unitv(e1.map((x, i) => Math.cos(r) * x + Math.sin(r) * (Math.cos(th) * t1[i] + Math.sin(th) * t2[i])))];
  });
  const quat = (pts) => CS.quatOf(CS.frameOf(pts[0], pts[1]));
  const [q0, q1] = lift(round(1), quat, CS.Q8), [p0, p1] = lift(round(2), quat, CS.Q8);
  assert.ok(close(q1, q0.map((x) => -x), 1e-6), 'once round: −1');
  assert.ok(close(p1, p0, 1e-6), 'twice round: 1');
});

test('two or three points on the sphere: S² and RP², SO(3) and S³/Dic₁₂', () => {
  const close = (u, v, eps = 1e-9) => u.every((x, i) => Math.abs(x - v[i]) < eps);
  const rnd = () => unitv([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p))));
  // two: the direction of the chord, which a swap takes to its opposite; unordered, in the upper half
  const a = rnd(), b = rnd(), d = CS.chordOf(a, b);
  assert.ok(close(CS.chordOf(b, a), d.map((x) => -x)));
  assert.ok(close(CS.chordOf(a, a.map((x) => -x)), a), 'x₁ itself, once x₂ is opposite');
  assert.ok(close(CS.chordDisc(a, b), CS.chordDisc(b, a)));
  assert.equal(CS.chordOf(a, a), null);
  // the disc: a line as far out as its angle from the vertical, of a right angle; across the rim,
  // the same line
  const lineAt = (x) => { const r = Math.hypot(...x), f = r * Math.PI / 2; return [Math.sin(f) * x[0] / r, Math.sin(f) * x[1] / r, Math.cos(f)]; };
  const sameLine = (u, v) => Math.abs(Math.abs(u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) - 1) < 1e-9;
  for (let t = 0; t < 50; t++) {
    const u = rnd(), v = rnd(), x = CS.chordDisc(u, v);
    assert.ok(Math.hypot(...x) <= 1 + 1e-12);
    assert.ok(sameLine(lineAt(x), CS.chordOf(u, v)), 'the disc point is the line of the chord');
    assert.ok(sameLine(lineAt(CS.across(x)), lineAt(x)), 'across the rim: the same line');
  }
  assert.ok(close(CS.chordDisc([0, 0, 1], [0, 0, -1]), [0, 0]));
  // three: an orthonormal right-handed frame, the identity for the equilateral triangle on the
  // equator with x₁ = (1, 0, 0), turning with the points, and turned on the right by D₃ when they
  // are relabelled
  const tri = [0, 1, 2].map((m) => [Math.cos(2 * Math.PI * m / 3), Math.sin(2 * Math.PI * m / 3), 0]);
  assert.ok(CS.frame3(tri).every((c, i) => close(c, [0, 1, 2].map((j) => +(i === j)))));
  for (let t = 0; t < 50; t++) {
    const x = [rnd(), rnd(), rnd()], F = CS.frame3(x), q = CS.quatOf(F);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(F[i].reduce((s2, v, c) => s2 + v * F[j][c], 0) - (i === j ? 1 : 0)) < 1e-9);
    const g = CS.quatOf(CS.frame3([rnd(), rnd(), rnd()])), y = x.map((p) => rot(g, p)), qy = CS.quatOf(CS.frame3(y));
    assert.ok(orbitGap(CS.qmul(g, q), qy, [[1, 0, 0, 0]]) < 1e-9, 'equivariant');
    for (const p of perms([0, 1, 2])) assert.ok(orbitGap(q, CS.quatOf(CS.frame3(p.map((i) => x[i]))), CS.dicyclic(3)) < 1e-9, 'relabelled: by D₃');
    // in the ball, and in the prism; across the boundary of the ball, the same rotation
    const bx = CS.rotationPoint(x), quatAt = (y) => { const r = Math.hypot(...y), f = r * Math.PI / 2; return [Math.cos(f)].concat(y.map((v) => Math.sin(f) * v / r)); };
    assert.ok(Math.hypot(...bx) <= 1 + 1e-12);
    assert.ok(orbitGap(quatAt(bx), q, [[1, 0, 0, 0]]) < 1e-9, 'the ball point is the frame');
    assert.ok(orbitGap(quatAt(CS.across(bx)), q, [[1, 0, 0, 0]]) < 1e-9, 'across the boundary: the same rotation');
    const r = CS.rotationPoint(x, true);
    assert.ok(Math.abs(r[2]) <= CS.prism(3).h + 1e-9);
  }
  assert.equal(CS.frame3([tri[0], tri[0], tri[1]]), null);
  // a half turn is on the boundary of the ball, and opposite points there are the same rotation
  assert.ok(close(CS.ballOf([0, 0, 0, 1]), [0, 0, 1]));
  assert.ok(close(CS.ballOf([0, 0, 0, -1]), [0, 0, -1]));
  assert.ok(close(CS.ballOf([-Math.cos(0.3), 0, 0, Math.sin(0.3)]), CS.ballOf([Math.cos(0.3), 0, 0, -Math.sin(0.3)])), 'q and −q: the same rotation');
  // x₂ once round x₁ is the loop of SO(3) that cannot be undone; twice round can
  const x3 = tri[2], c = tri[0], t1 = [0, 0, 1], t2 = [c[1] * t1[2] - c[2] * t1[1], c[2] * t1[0] - c[0] * t1[2], c[0] * t1[1] - c[1] * t1[0]];
  const round = (turns) => Array.from({ length: 720 * turns + 1 }, (_, m) => {
    const th = m / 720 * 2 * Math.PI, rho = 0.25;
    return [c, c.map((v, i) => Math.cos(rho) * v + Math.sin(rho) * (Math.cos(th) * t1[i] + Math.sin(th) * t2[i])), x3];
  });
  const quat = (pts) => CS.quatOf(CS.frame3(pts));
  const [q0, q1] = lift(round(1), quat, [[1, 0, 0, 0]]), [p0, p1] = lift(round(2), quat, [[1, 0, 0, 0]]);
  assert.ok(close(q1, q0.map((x) => -x), 1e-6), 'once round: −1');
  assert.ok(close(p1, p0, 1e-6), 'twice round: 1');
});

test('two points on the Möbius band: the mapping torus picture', () => {
  const close = (u, v) => u.every((x, i) => Math.abs(x - v[i]) < 1e-9);
  // the collisions go to the vertical line through the centre, at the height of x₁ along the band
  for (const a of [[0.2, 0.3], [0.7, 0.9], [0.01, 0.5], [0.99, 0.12]]) assert.ok(close(CS.mobiusPair(a, a), [0.5, 0.5, a[0]]));
  // continuous in x₂ across the glued edge, where (1, y) is (0, 1 − y): the two sides give one place
  for (const a of [[0.3, 0.4], [0.6, 0.8]]) {
    const p = CS.mobiusPair(a, [1 - 1e-7, 0.35]), q = CS.mobiusPair(a, [1e-7, 0.65]);
    assert.ok(p.every((x, i) => Math.abs(x - q[i]) < 1e-5), JSON.stringify([p, q]));
  }
  // x₁ across the glued edge: s goes from the top to the bottom and q is turned front to back
  for (const b of [[0.4, 0.27], [0.05, 0.6], [0.93, 0.5]]) {
    const top = CS.mobiusPair([1 - 1e-7, 0.3], b), bottom = CS.mobiusPair([1e-7, 0.7], b);
    assert.ok(top[2] > 0.99 && bottom[2] < 0.01);
    assert.ok(Math.abs(top[0] - bottom[0]) < 1e-5 && Math.abs(top[1] - (1 - bottom[1])) < 1e-5, JSON.stringify([top, bottom]));
  }
  // x₂ once round x₁, close to it, is a loop once round the line
  for (const a of [[0.3, 0.4], [0.04, 0.2], [0.5, 0.93]]) {
    let w = 0, prev = null;
    for (let i = 0; i <= 400; i++) {
      const t = 2 * Math.PI * i / 400, q = CS.mobiusPair(a, CS.wrap('mobius', [a[0] + 0.03 * Math.cos(t), a[1] + 0.03 * Math.sin(t)]));
      const v = [q[0] - 0.5, q[1] - 0.5];
      if (prev) w += Math.atan2(prev[0] * v[1] - prev[1] * v[0], prev[0] * v[0] + prev[1] * v[1]);
      prev = v;
    }
    assert.equal(Math.round(w / (2 * Math.PI)), 1, JSON.stringify(a));
  }
});
