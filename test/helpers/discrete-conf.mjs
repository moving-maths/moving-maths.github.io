// An independent computation of the rational Betti numbers of configuration
// spaces of the line and the circle, for checking
// content/configuration-spaces/confspaces.js, which gets them from the
// orders of the points.
//
// Abrams's discretised configuration space D_k Γ of a graph Γ is the cube
// complex of the products of k cells of Γ (vertices and edges) whose closures
// are disjoint. When Γ is subdivided finely enough (every path between vertices
// of degree other than 2 with at least k − 1 edges, every cycle with at least
// k + 1: Abrams 2000, Prue and Scrimshaw 2014), it is a deformation retract of
// Conf_k Γ, and its quotient UD_k Γ by the symmetric group one of UConf_k Γ. A
// path of edges is the line (an open interval retracts onto a closed one), a
// cycle the circle.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../../content/configuration-spaces/confspaces.js');
const { rank } = globalThis.ConfSpaces;

// the path with n edges, and the cycle with n edges
export const pathGraph = (n) => ({ V: n + 1, E: Array.from({ length: n }, (_, i) => [i, i + 1]) });
export const cycleGraph = (n) => ({ V: n, E: Array.from({ length: n }, (_, i) => [i, (i + 1) % n]) });

// b_0, b_1, … of D_k Γ, or of UD_k Γ. A cell of Γ is a vertex v (index v) or an
// edge e (index V + e); a cube is a k-tuple of them (for UD_k, a set, kept in
// increasing order), oriented by the order of its edges in it. Its boundary
// replaces the j-th of its edges, from a to b, by b and by a, with signs
// (−1)^j and −(−1)^j.
export function discreteBetti(G, k, unordered = false) {
  const cells = [];
  for (let v = 0; v < G.V; v++) cells.push({ edge: false, verts: [v] });
  for (const [a, b] of G.E) cells.push({ edge: true, verts: [a, b], from: a, to: b });
  const cubes = [];
  (function rec(start, chosen, used) {
    if (chosen.length === k) { cubes.push(chosen.slice()); return; }
    for (let c = unordered ? start : 0; c < cells.length; c++) {
      if (chosen.includes(c) || cells[c].verts.some((v) => used.has(v))) continue;
      chosen.push(c);
      cells[c].verts.forEach((v) => used.add(v));
      rec(c + 1, chosen, used);
      chosen.pop();
      cells[c].verts.forEach((v) => used.delete(v));
    }
  })(0, [], new Set());
  const dim = (t) => t.filter((c) => cells[c].edge).length;
  const basis = new Map(), index = new Map();
  for (const t of cubes) {
    const n = dim(t);
    if (!basis.has(n)) basis.set(n, []);
    index.set(t.join(','), basis.get(n).length);
    basis.get(n).push(t);
  }
  const boundary = (t) => {
    const out = new Map();
    let j = 0;
    t.forEach((c, pos) => {
      if (!cells[c].edge) return;
      const sign = j++ % 2 ? -1 : 1;
      for (const [v, s] of [[cells[c].to, sign], [cells[c].from, -sign]]) {
        let u = t.slice();
        u[pos] = v;
        if (unordered) u = u.sort((x, y) => x - y);
        const i = index.get(u.join(','));
        out.set(i, (out.get(i) || 0) + s);
      }
    });
    return out;
  };
  const top = Math.max(...basis.keys()), rk = [];
  for (let n = 0; n <= top + 1; n++) rk.push(n === 0 || !basis.has(n) ? 0 : rank(basis.get(n).map(boundary)));
  const b = [];
  for (let n = 0; n <= top; n++) b.push((basis.get(n) || []).length - rk[n] - rk[n + 1]);
  while (b.length > 1 && !b[b.length - 1]) b.pop();
  return b;
}
