// An independent computation of the rational Betti numbers of ordered and
// unordered configuration spaces of surfaces, for checking
// content/configuration-spaces/confspaces.js.
//
// It uses no theorem about configuration spaces. A closed surface N is given
// as a Δ-complex K; the product K^k of simplicial sets realises N^k, and in it
// every diagonal {x_a = x_b} and every set {x_a = p} with p a vertex is a
// sub-simplicial set. For Σ = N minus some vertices,
//   H_c^*(Conf_k Σ; or) = H^*(N^k, collisions ∪ punctures; or^{⊠k}),
// computed from normalised cochains, and Poincaré duality on the 2k-manifold
// Conf_k Σ turns this into homology: b_j = dim H_c^{2k−j}(Conf_k Σ; or).
// The symmetric group acts freely on the simplices off the diagonals, so the
// unordered space is the same computation on orbits.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../../content/configuration-spaces/confspaces.js');
const { rank } = globalThis.ConfSpaces;

// Δ-complexes: E[e] = [v0, v1]; T[t] = [d0, d1, d2], the edges opposite each vertex;
// w[e] = ±1, the orientation character on the edge; punctures: vertices removed.
// The square models: corners P00, P10, P01, P11, a the bottom edge, b the left
// edge, c the diagonal from P00 to P11.
export const MODELS = {
  torus: { V: 1, E: [[0, 0], [0, 0], [0, 0]], T: [[1, 2, 0], [0, 2, 1]], w: [1, 1, 1], punctures: [] },
  // (x, 1) ~ (1 − x, 0): the vertical loop b crosses the flip
  klein: { V: 1, E: [[0, 0], [0, 0], [0, 0]], T: [[1, 2, 0], [0, 1, 2]], w: [1, -1, -1], punctures: [] },
  // both pairs of sides flipped: two vertices, v = {P00, P11} and u = {P10, P01}
  projective: { V: 2, E: [[0, 1], [0, 1], [0, 0]], T: [[1, 0, 2], [0, 1, 2]], w: [1, -1, -1], punctures: [] },
  mobius: { V: 2, E: [[0, 1], [0, 1], [0, 0]], T: [[1, 0, 2], [0, 1, 2]], w: [1, -1, -1], punctures: [0] },
  // two triangles glued along their boundary
  sphere: { V: 3, E: [[1, 2], [0, 2], [0, 1]], T: [[0, 1, 2], [0, 1, 2]], w: [1, 1, 1], punctures: [] },
  plane: { V: 3, E: [[1, 2], [0, 2], [0, 1]], T: [[0, 1, 2], [0, 1, 2]], w: [1, 1, 1], punctures: [0] },
  cylinder: { V: 3, E: [[1, 2], [0, 2], [0, 1]], T: [[0, 1, 2], [0, 1, 2]], w: [1, 1, 1], punctures: [0, 1] },
};

// the faces of a nondegenerate simplex: d_q of a triangle is an edge, of an edge a vertex
const faceOf = (K, p, t, q) => (p === 2 ? K.T[t][q] : K.E[t][1 - q]);
const count = (K, p) => (p === 0 ? K.V : p === 1 ? K.E.length : K.T.length);

// A simplex of K of dimension m is [p, t, f]: the nondegenerate p-simplex t and
// a monotone surjection f: [m] → [p], as the array of its values.
function face(K, s, i) {
  const [p, t, f] = s, g = f.slice(0, i).concat(f.slice(i + 1));
  if (p === 0 || g.includes(f[i])) return [p, t, g];
  return [p - 1, faceOf(K, p, t, f[i]), g.map((x) => (x > f[i] ? x - 1 : x))];
}
const keyOf = (s) => s[0] + '.' + s[1] + '.' + s[2].join('');
// the edge from vertex 0 to vertex 1, for the twisted coboundary
function twist(K, s) {
  const [p, t, f] = s;
  if (f[0] === f[1]) return 1;
  return p === 1 ? K.w[t] : K.w[K.T[t][2]];
}

// all monotone surjections [m] → [p]
function surjections(m, p) {
  const out = [];
  (function rec(f) {
    if (f.length === m + 1) { if (f[m] === p) out.push(f.slice()); return; }
    const last = f[f.length - 1];
    for (const v of [last, last + 1]) if (v <= p) { f.push(v); rec(f); f.pop(); }
  })([0]);
  return out;
}

// the nondegenerate m-simplices of K^k off the collisions and punctures
function simplices(K, k, m, sorted) {
  const per = [];
  for (let p = 0; p <= Math.min(2, m); p++) for (const f of surjections(m, p)) for (let t = 0; t < count(K, p); t++) per.push([p, t, f]);
  const keys = per.map(keyOf), out = [];
  (function rec(choice, from) {
    if (choice.length === k) {
      // nondegenerate: every step of [m] is a step of some factor
      for (let i = 0; i < m; i++) if (choice.every((c) => per[c][2][i] === per[c][2][i + 1])) return;
      out.push(choice.map((c) => per[c]));
      return;
    }
    for (let c = sorted ? from : 0; c < per.length; c++) {
      if (choice.includes(c)) continue; // a collision x_a = x_b
      if (per[c][0] === 0 && K.punctures.includes(per[c][1])) continue; // a point at a puncture
      choice.push(c);
      rec(choice, c + 1);
      choice.pop();
    }
  })([], 0);
  return { list: out, keys };
}

// Betti numbers b_0 … b_{2k} of Conf_k(Σ), or of UConf_k(Σ) if unordered
export function simplicialBetti(id, k, unordered = false) {
  const K = MODELS[id];
  const levels = [];
  for (let m = 0; m <= 2 * k; m++) levels.push(simplices(K, k, m, unordered).list);
  const name = (tuple) => {
    const ks = tuple.map(keyOf);
    return (unordered ? ks.slice().sort() : ks).join('|');
  };
  const index = levels.map((L) => new Map(L.map((s, i) => [name(s), i])));
  // rank of δ: C^{m} → C^{m+1}, from the rows: each (m+1)-simplex against its faces
  const rk = [];
  for (let m = 0; m < 2 * k; m++) {
    const rows = levels[m + 1].map((s) => {
      const v = new Map();
      for (let i = 0; i <= m + 1; i++) {
        const fs = s.map((c) => face(K, c, i));
        const at = index[m].get(name(fs)); // undefined if degenerate, on a collision or at a puncture
        if (at === undefined) continue;
        let sign = i % 2 ? -1 : 1;
        if (i === 0) for (const c of s) sign *= twist(K, c);
        v.set(at, (v.get(at) || 0) + sign);
      }
      return v;
    });
    rk.push(rank(rows));
  }
  const H = levels.map((L, m) => L.length - (rk[m] || 0) - (m ? rk[m - 1] : 0));
  const b = [];
  for (let j = 0; j <= 2 * k; j++) b.push(H[2 * k - j]);
  while (b.length > 1 && !b[b.length - 1]) b.pop();
  return b;
}
