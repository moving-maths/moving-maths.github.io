// Knots: the hyperbolic volume of a link's complement, from a diagram (knots.js). No
// DOM.
//
// The complement of the link, less two points p and q (far above and far below the
// plane of the diagram), falls into tetrahedra, four at each crossing (D. Thurston's
// octahedral decomposition). At a crossing, the short vertical segment from the
// strand on top (o) down to the strand underneath (u) is an edge of all four; in
// each corner of the crossing, between a half-strand on top and one underneath, is
// the tetrahedron with corners o, u, p and q. Two of them meet across each
// half-strand at the crossing (in the face o u p across one underneath, o u q across
// one on top), and each meets the tetrahedron in the corner at the other end of each
// of its two sides along the region (in the face o p q, or u p q).
//
// An edge from p to the link, and then one from q, is squashed to a point, which
// takes p and q into the link and leaves an ideal triangulation of its complement;
// that is made smaller by 2-0 and 3-2 moves. Each tetrahedron is given a shape, a
// complex number z (its edges 0 1 and 2 3 have z, the others 1/(1 − z) and
// 1 − 1/z), and Thurston's equations ask that round each edge the shapes multiply to
// 1 and that the cusp of each component be complete. They are solved by Newton's
// method (damped, in the logarithms of the shapes) from every tetrahedron regular;
// a solution with every tetrahedron positively oriented is the complete hyperbolic
// structure, and the sum of the Bloch–Wigner dilogarithms of its shapes is the
// volume. If Newton's method fails, other triangulations are tried (2-3 moves).
//
//   KnotVolume.triangulate(D)        the octahedral decomposition
//   KnotVolume.ideals(D, k)          ideal triangulations from it
//   KnotVolume.search(D), volume(D)  the volume, a try at a time or at once
//   KnotVolume.lobachevsky(θ), KnotVolume.bloch(z)
(function (G) {
  'use strict';
  const K = G.Knots;

  /* ---------- complex numbers, as [re, im] ---------- */

  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const cexp = (a) => { const r = Math.exp(a[0]); return [r * Math.cos(a[1]), r * Math.sin(a[1])]; };
  const clog = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
  const abs = (a) => Math.hypot(a[0], a[1]);
  const ONE = [1, 0];

  /* ---------- the volume of an ideal tetrahedron ---------- */

  // Lobachevsky's function Λ(θ) = −∫₀^θ log|2 sin t| dt = ½ Cl₂(2θ), with Clausen's
  // Cl₂(x) = x − x log|x| + Σ |B₂ₙ| x^(2n+1) / (2n (2n+1)!) for |x| ≤ π (and odd, of period 2π)
  const BERNOULLI = [1 / 6, 1 / 30, 1 / 42, 1 / 30, 5 / 66, 691 / 2730, 7 / 6, 3617 / 510, 43867 / 798, 174611 / 330, 854513 / 138, 236364091 / 2730, 8553103 / 6, 23749461029 / 870, 8615841276005 / 14322, 7709321041217 / 510, 2577687858367 / 6, 26315271553053477373 / 1919190, 2929993913841559 / 6, 261082718496449122051 / 13530];
  const CL = BERNOULLI.map((b, i) => { let f = 1; for (let k = 2; k <= 2 * i + 3; k++) f *= k; return b / ((2 * i + 2) * f); });
  function clausen(x) {
    x = x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
    if (Math.abs(x) < 1e-15) return 0;
    let s = x - x * Math.log(Math.abs(x)), p = x, x2 = x * x;
    for (const c of CL) { p *= x2; s += c * p; }
    return s;
  }
  const lobachevsky = (t) => 0.5 * clausen(2 * t);
  // the Bloch–Wigner dilogarithm D(z): the volume of the ideal tetrahedron of shape z,
  // signed (negative below the real line), Λ of its three angles
  function bloch(z) {
    if (Math.abs(z[1]) < 1e-14) return 0;
    const z1 = div(ONE, sub(ONE, z)), z2 = sub(ONE, div(ONE, z));
    return lobachevsky(Math.atan2(z[1], z[0])) + lobachevsky(Math.atan2(z1[1], z1[0])) + lobachevsky(Math.atan2(z2[1], z2[0]));
  }

  /* ---------- the tetrahedra ---------- */

  // The tetrahedra of the octahedral decomposition of a diagram in one piece. Each is
  // { c, k, role }: crossing c, corner k (between its ends k and k + 1, as
  // Knots.slots numbers them, anticlockwise; ends 1 and 3 are on top), and the roles
  // 'o', 'u', 'p', 'q' of its corners 0 … 3, in an order that orients it (o first
  // where the corner has the end on top first, going anticlockwise). glue[t][f] =
  // { t, f, perm }: the face of t without corner f is glued to that of t2 without
  // corner f2, corner i of t to corner perm[i] of t2.
  function triangulate(D) {
    const n = D.n, { S, tail, head } = K.slots(D);
    const other = (c, j) => { const e = S[c][j], t = tail[e]; return t[0] === c && t[1] === j ? head[e] : t; };
    const T = [];
    for (let c = 0; c < n; c++) for (let k = 0; k < 4; k++) T.push({ c, k, role: k % 2 ? ['o', 'u', 'p', 'q'] : ['u', 'o', 'p', 'q'] });
    const at = (t, r) => T[t].role.indexOf(r), id = (c, k) => 4 * c + ((k % 4) + 4) % 4;
    const glue = T.map(() => new Array(4));
    // the face of t without its corner `without` glued to t2, roles going to roles as roleMap says
    const setFace = (t, without, t2, roleMap) => {
      const perm = [0, 1, 2, 3].map((i) => at(t2, roleMap[T[t].role[i]]));
      glue[t][at(t, without)] = { t: t2, f: perm[at(t, without)], perm };
    };
    const same = { o: 'o', u: 'u', p: 'p', q: 'q' }, swap = { o: 'u', u: 'o', p: 'p', q: 'q' };
    for (let c = 0; c < n; c++) {
      for (let k = 0; k < 4; k++) {
        const t = id(c, k);
        // across the half-strand underneath (end 0 between corners 3 and 0, end 2 between 1 and 2): face o u p
        setFace(t, 'q', id(c, k % 2 ? k + 1 : k - 1), same);
        // across the half-strand on top (end 1 between corners 0 and 1, end 3 between 2 and 3): face o u q
        setFace(t, 'p', id(c, k % 2 ? k - 1 : k + 1), same);
        // along the region: the side on top (end k or k + 1, whichever is odd) and the
        // one underneath, each to the corner at its other end
        for (const [mine, end] of [['o', k % 2 ? k : k + 1], ['u', k % 2 ? k + 1 : k]]) {
          const first = (end % 4) === k % 4;
          const [c2, s2] = other(c, end % 4), k2 = first ? s2 - 1 : s2, theirs = s2 % 2 ? 'o' : 'u';
          setFace(t, mine === 'o' ? 'u' : 'o', id(c2, k2), mine === theirs ? same : swap);
        }
      }
    }
    return { T, glue };
  }

  // The edges of the triangulation (as lists of [tetrahedron, corner i, corner j]),
  // and its vertices (lists of [tetrahedron, corner]), found by following the gluings.
  const EDGES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  function classes(tri) {
    const { T, glue } = tri, m = T.length, up = new Int32Array(6 * m).map((_, i) => i), vup = new Int32Array(4 * m).map((_, i) => i);
    const find = (u, x) => { while (u[x] !== x) { u[x] = u[u[x]]; x = u[x]; } return x; };
    const eid = (t, i, j) => 6 * t + EDGES.findIndex((e) => (e[0] === Math.min(i, j) && e[1] === Math.max(i, j)));
    for (let t = 0; t < m; t++) for (let f = 0; f < 4; f++) {
      const g = glue[t][f];
      for (let i = 0; i < 4; i++) if (i !== f) { const a = find(vup, 4 * t + i), b = find(vup, 4 * g.t + g.perm[i]); if (a !== b) vup[a] = b; }
      for (const [i, j] of EDGES) if (i !== f && j !== f) { const a = find(up, eid(t, i, j)), b = find(up, eid(g.t, g.perm[i], g.perm[j])); if (a !== b) up[a] = b; }
    }
    const edges = new Map(), verts = new Map();
    for (let t = 0; t < m; t++) {
      EDGES.forEach(([i, j], e) => { const r = find(up, 6 * t + e); if (!edges.has(r)) edges.set(r, []); edges.get(r).push([t, i, j]); });
      for (let i = 0; i < 4; i++) { const r = find(vup, 4 * t + i); if (!verts.has(r)) verts.set(r, []); verts.get(r).push([t, i]); }
    }
    return { edges: Array.from(edges.values()), verts: Array.from(verts.values()) };
  }

  /* ---------- the equations ---------- */

  // the shape of edge (i, j) of a tetrahedron of shape z, and its derivative by log z
  function shape(z, i, j) {
    const a = Math.min(i, j), b = Math.max(i, j);
    if ((a === 0 && b === 1) || (a === 2 && b === 3)) return [z, ONE];
    if ((a === 0 && b === 2) || (a === 1 && b === 3)) { const w = div(ONE, sub(ONE, z)); return [w, mul(z, w)]; } // 1/(1 − z); d log/d log z = z/(1 − z)
    return [sub(ONE, div(ONE, z)), div(ONE, sub(z, ONE))]; // 1 − 1/z; d log/d log z = 1/(z − 1)
  }
  // the order of the other three corners round corner v, anticlockwise as seen from v
  const ROUND = [[1, 2, 3], [0, 3, 2], [3, 0, 1], [2, 1, 0]];

  // The equations, for shapes z: for each edge, the log of the product of its shapes
  // (2πi taken off as often as it fits), with its derivatives by the log z; and, for
  // each cusp, the holonomies of the sides of the cusp's triangulation that the
  // development by a tree of its triangles leaves twice (each h − 1, which must be 0).
  function system(tri, cls) {
    const { T, glue } = tri, m = T.length;
    // the cusps: vertices where the link is (o or u), not p or q
    const cusps = cls.verts.filter((list) => list.some(([t, i]) => T[t].role[i] === 'o' || T[t].role[i] === 'u'));
    function edgeRows(z) {
      return cls.edges.map((list) => {
        let s = [0, 0];
        const d = new Map();
        for (const [t, i, j] of list) {
          const [w, dw] = shape(z[t], i, j);
          s = add(s, clog(w));
          d.set(t, add(d.get(t) || [0, 0], dw));
        }
        s[1] -= 2 * Math.PI * Math.round(s[1] / (2 * Math.PI));
        return { r: s, d };
      });
    }
    // the cusp triangles laid out in the plane, a tree of them at a time, and the
    // holonomies of the sides met twice
    function holonomies(z) {
      const out = [];
      for (const list of cusps) {
        const index = new Map(list.map(([t, v], i) => [t * 4 + v, i])), pos = list.map(() => null), seen = new Uint8Array(list.length);
        const ratio = (t, v, w) => shape(z[t], v, w)[0];
        const [t0, v0] = list[0], [a, b, c] = ROUND[v0];
        pos[0] = new Array(4);
        pos[0][a] = [0, 0]; pos[0][b] = [1, 0]; pos[0][c] = ratio(t0, v0, a);
        seen[0] = 1;
        const queue = [0];
        while (queue.length) {
          const i = queue.shift(), [t, v] = list[i];
          for (let f = 0; f < 4; f++) {
            if (f === v) continue;
            const g = glue[t][f], j = index.get(g.t * 4 + g.perm[v]), [w1, w2] = [0, 1, 2, 3].filter((x) => x !== v && x !== f);
            if (!seen[j]) {
              seen[j] = 1;
              queue.push(j);
              const v2 = g.perm[v], p = new Array(4);
              p[g.perm[w1]] = pos[i][w1]; p[g.perm[w2]] = pos[i][w2];
              // the third corner: with the corners round v2 as (x, y, unknown), at x + r_x (y − x)
              const r = ROUND[v2], u = r.findIndex((x) => p[x] === undefined), x = r[(u + 1) % 3], y = r[(u + 2) % 3];
              p[r[u]] = add(p[x], mul(ratio(g.t, v2, x), sub(p[y], p[x])));
              pos[j] = p;
            } else if (i < j || (i === j && f < g.f)) {
              // a side met again: the motion taking its first copy to its second
              out.push(div(sub(pos[j][g.perm[w2]], pos[j][g.perm[w1]]), sub(pos[i][w2], pos[i][w1])));
            }
          }
        }
      }
      return out;
    }
    return { m, edgeRows, holonomies };
  }

  // the residuals at log-shapes w
  function residual(sys, w) {
    const z = w.map(cexp);
    return { r: sys.edgeRows(z).map((x) => x.r).concat(sys.holonomies(z).map((h) => sub(h, ONE))), z };
  }
  // the residuals and the Jacobian (by log z) at log-shapes w
  function evaluate(sys, w) {
    const z = w.map(cexp), rows = sys.edgeRows(z), h0 = sys.holonomies(z), m = sys.m;
    const r = rows.map((x) => x.r).concat(h0.map((h) => sub(h, ONE)));
    const J = r.map(() => Array.from({ length: m }, () => [0, 0]));
    rows.forEach((x, e) => x.d.forEach((v, t) => { J[e][t] = v; }));
    // the holonomies' derivatives, by differences (they are holomorphic in w)
    const eps = 1e-7;
    for (let t = 0; t < m; t++) {
      const w2 = w.slice();
      w2[t] = [w[t][0] + eps, w[t][1]];
      const h1 = sys.holonomies(w2.map(cexp));
      h1.forEach((h, k) => { J[rows.length + k][t] = [(h[0] - h0[k][0]) / eps, (h[1] - h0[k][1]) / eps]; });
    }
    return { r, J, z };
  }
  const norm = (r) => Math.sqrt(r.reduce((t, x) => t + x[0] * x[0] + x[1] * x[1], 0));

  // the complex system A x = b (A Hermitian, positive definite), by elimination
  function solve(A, b) {
    const n = b.length, M = A.map((row, i) => row.concat([b[i]]));
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (abs(M[i][k]) > abs(M[p][k])) p = i;
      [M[k], M[p]] = [M[p], M[k]];
      if (abs(M[k][k]) < 1e-300) return null;
      for (let i = k + 1; i < n; i++) {
        const f = div(M[i][k], M[k][k]);
        if (!f[0] && !f[1]) continue;
        for (let j = k; j <= n; j++) M[i][j] = sub(M[i][j], mul(f, M[k][j]));
      }
    }
    const x = new Array(n);
    for (let k = n - 1; k >= 0; k--) {
      let s = M[k][n];
      for (let j = k + 1; j < n; j++) s = sub(s, mul(M[k][j], x[j]));
      x[k] = div(s, M[k][k]);
    }
    return x;
  }

  // Newton's method, damped (Levenberg and Marquardt), from log-shapes w: the shapes
  // of a solution, or null
  function newton(sys, w) {
    let cur = evaluate(sys, w), err = norm(cur.r), lambda = 1e-3;
    for (let it = 0; it < 80 && err > 1e-11; it++) {
      const { r, J } = cur, m = sys.m;
      // JᴴJ and −Jᴴr
      const A = Array.from({ length: m }, () => Array.from({ length: m }, () => [0, 0])), g = Array.from({ length: m }, () => [0, 0]);
      for (let e = 0; e < r.length; e++) {
        const row = J[e];
        for (let i = 0; i < m; i++) {
          if (!row[i][0] && !row[i][1]) continue;
          const ci = [row[i][0], -row[i][1]];
          g[i] = sub(g[i], mul(ci, r[e]));
          for (let j = 0; j < m; j++) if (row[j][0] || row[j][1]) A[i][j] = add(A[i][j], mul(ci, row[j]));
        }
      }
      let better = false;
      for (let tries = 0; tries < 8 && !better; tries++) {
        const B = A.map((row, i) => row.map((x, j) => (i === j ? [x[0] * (1 + lambda) + lambda * 1e-6, x[1]] : x)));
        const d = solve(B, g);
        if (!d) { lambda *= 10; continue; }
        const w2 = w.map((x, i) => add(x, d[i]));
        if (w2.some((x) => !isFinite(x[0]) || !isFinite(x[1]) || Math.abs(x[0]) > 30)) { lambda *= 10; continue; }
        const e2 = norm(residual(sys, w2).r);
        if (e2 < err) { w = w2; cur = evaluate(sys, w2); err = e2; lambda = Math.max(1e-12, lambda / 5); better = true; } else lambda *= 10;
      }
      if (!better) break;
    }
    if (err > 1e-9) return null;
    // (not where a tetrahedron flattens out)
    if (cur.z.some((z) => abs(z) < 1e-7 || abs(sub(z, ONE)) < 1e-7 || abs(z) > 1e7)) return null;
    return cur.z;
  }

  /* ---------- an ideal triangulation ---------- */

  // The triangulation with an edge squashed to a point: each tetrahedron with a copy of
  // it (one copy each, from its corner i to its corner j) is flattened onto a
  // triangle, and the two tetrahedra beside it, across its faces without i and
  // without j, glued to each other instead. Null if that does not leave a
  // triangulation (a face glued to itself).
  function collapse(tri, copies) {
    const { T, glue } = tri, gone = new Map(copies.map(([t, i, j]) => [t, [i, j]]));
    if (gone.size !== copies.length || gone.size >= T.length) return null;
    const keep = T.map((_, t) => t).filter((t) => !gone.has(t)), index = new Map(keep.map((t, k) => [t, k]));
    // out through face f of t, through flattened tetrahedra, to a kept one
    function follow(t, f) {
      let g = glue[t][f], perm = g.perm.slice();
      for (let steps = 0; gone.has(g.t); steps++) {
        if (steps > T.length) return null;
        const [i, j] = gone.get(g.t);
        if (g.f !== i && g.f !== j) return null;
        const out = g.f === i ? j : i, g2 = glue[g.t][out], through = [0, 1, 2, 3].map((x) => (x === i ? j : x === j ? i : x));
        perm = perm.map((x) => g2.perm[through[x]]);
        g = g2;
      }
      return { t: g.t, f: perm[f], perm };
    }
    const glue2 = keep.map((t) => [0, 1, 2, 3].map((f) => {
      const g = follow(t, f);
      return g && { t: index.get(g.t), f: g.f, perm: g.perm };
    }));
    if (glue2.some((faces, k) => faces.some((g, f) => !g || (g.t === k && g.f === f)))) return null;
    return { T: keep.map((t) => T[t]), glue: glue2 };
  }
  // The octahedral decomposition with p and q squashed into the link: ideal
  // triangulations of the complement of the link, from the ways to squash an edge
  // from p to the link and then one from q (each edge met once in each of its
  // tetrahedra), those squashing fewest tetrahedra first (up to `most` of them).
  function ideals(D, most) {
    const out = [], start = triangulate(D);
    // the edges from the point to the link that squash cleanly, fewest copies first
    const ways = (tri, point) => {
      const cls = classes(tri), role = (t, i) => tri.T[t].role[i], other = point === 'p' ? 'q' : 'p', res = [];
      for (const copies of cls.edges) {
        const ends = copies.map(([t, i, j]) => (role(t, i) === point && role(t, j) !== point && role(t, j) !== other ? [t, i, j] : role(t, j) === point && role(t, i) !== point && role(t, i) !== other ? [t, j, i] : null));
        if (ends.some((e) => !e)) continue;
        const next = collapse(tri, ends);
        if (next) res.push({ n: copies.length, next });
      }
      return res.sort((a, b) => a.n - b.n);
    };
    for (const a of ways(start, 'p')) {
      for (const b of ways(a.next, 'q')) {
        out.push({ n: a.n + b.n, tri: b.next });
        if (out.length >= 4 * most) break;
      }
      if (out.length >= 4 * most) break;
    }
    return out.sort((x, y) => x.n - y.n).slice(0, most).map((x) => x.tri);
  }
  /* ---------- moves ---------- */

  // A triangulation copied, with tetrahedra left out (drop) and others put in (add:
  // { role, glue: four { t, f, perm } }, where t may be 'new0', 'new1', …), every
  // gluing to a dropped tetrahedron replaced as redirect(t, f) says. Null unless every
  // gluing comes back.
  function rebuildTri(tri, drop, add, redirect) {
    const keep = tri.T.map((_, t) => t).filter((t) => !drop.has(t)), index = new Map(keep.map((t, k) => [t, k]));
    add.forEach((_, i) => index.set('new' + i, keep.length + i));
    const T = keep.map((t) => tri.T[t]).concat(add.map((a) => ({ role: a.role })));
    const glue = keep.map((t) => [0, 1, 2, 3].map((f) => {
      let g = tri.glue[t][f];
      if (drop.has(g.t)) g = redirect(t, f);
      return g && { t: index.get(g.t), f: g.f, perm: g.perm };
    })).concat(add.map((a) => a.glue.map((g) => g && { t: index.get(g.t), f: g.f, perm: g.perm })));
    if (glue.some((faces) => faces.some((g) => !g || g.t === undefined))) return null;
    for (let t = 0; t < glue.length; t++) for (let f = 0; f < 4; f++) {
      const g = glue[t][f], back = glue[g.t][g.f];
      if ((g.t === t && g.f === f) || back.t !== t || back.f !== f || [0, 1, 2, 3].some((x) => back.perm[g.perm[x]] !== x)) return null;
    }
    return { T, glue };
  }
  const inv = (p) => { const q = [0, 0, 0, 0]; p.forEach((x, i) => { q[x] = i; }); return q; };
  // The copies of an edge in order round it, from copy (t, a, b): states { t, a, b,
  // keep, exit }, the walk leaving t across its face without corner exit. Null if it
  // does not close up the right way round.
  function around(tri, t, a, b) {
    const others = [0, 1, 2, 3].filter((x) => x !== a && x !== b), out = [];
    let s = { t, a, b, keep: others[0], exit: others[1] };
    for (let n = 0; n <= 4 * tri.T.length; n++) {
      out.push(s);
      const g = tri.glue[s.t][s.exit], next = { t: g.t, a: g.perm[s.a], b: g.perm[s.b], keep: g.f, exit: g.perm[s.keep] };
      if (next.t === t && ((next.a === a && next.b === b) || (next.a === b && next.b === a))) return next.a === a ? out : null;
      s = next;
    }
    return null;
  }
  // 2-0: the two tetrahedra round an edge of degree two taken out, and the faces
  // round them glued to each other
  function move20(tri, cyc) {
    if (cyc.length !== 2 || cyc[0].t === cyc[1].t) return null;
    const { t, a, b, keep: C, exit: Dv } = cyc[0], t2 = cyc[1].t, g = tri.glue[t][Dv], h = tri.glue[t][C];
    if (g.t !== t2 || h.t !== t2 || g.perm[a] !== h.perm[a] || g.perm[b] !== h.perm[b]) return null;
    const psi = [0, 1, 2, 3];
    psi[a] = g.perm[a]; psi[b] = g.perm[b]; psi[C] = g.perm[C]; psi[Dv] = h.perm[Dv];
    // across the face of t without a and that of t2 without ψa; likewise for b
    const pair = new Map();
    for (const x of [a, b]) {
      const gx = tri.glue[t][x], gy = tri.glue[t2][psi[x]];
      if (gx.t === t || gx.t === t2 || gy.t === t || gy.t === t2) return null;
      if (gx.t === gy.t && gx.f === gy.f) return null;
      const gxi = inv(gx.perm), toY = [0, 1, 2, 3].map((y) => gy.perm[psi[gxi[y]]]);
      pair.set(gx.t + ':' + gx.f, { t: gy.t, f: gy.f, perm: toY });
      pair.set(gy.t + ':' + gy.f, { t: gx.t, f: gx.f, perm: inv(toY) });
    }
    return rebuildTri(tri, new Set([t, t2]), [], (u, f) => pair.get(u + ':' + f) || null);
  }
  // 3-2: the three tetrahedra round an edge of degree three made two, across the
  // triangle of their other corners. NA keeps t0's corners with Y2 in B's place, NB
  // with Y2 in A's place (so both are oriented as t0 is).
  function move32(tri, cyc) {
    if (cyc.length !== 3 || new Set(cyc.map((s) => s.t)).size !== 3) return null;
    const [s0, s1, s2] = cyc, t0 = s0.t, A = s0.a, B = s0.b, Y1 = s0.keep, Y0 = s0.exit, inside = new Set([t0, s1.t, s2.t]);
    for (const s of cyc) for (const x of [s.a, s.b]) if (inside.has(tri.glue[s.t][x].t)) return null;
    const role0 = tri.T[t0].role, roleA = role0.slice(), roleB = role0.slice();
    roleA[B] = tri.T[s1.t].role[s1.keep]; roleB[A] = tri.T[s1.t].role[s1.keep];
    const via = (s, opp, of) => { const g = tri.glue[s.t][opp]; return { t: g.t, f: g.f, perm: [0, 1, 2, 3].map((x) => g.perm[of[x]]) }; };
    const swapAB = [0, 1, 2, 3].map((x) => (x === A ? B : x === B ? A : x));
    const ofA1 = []; ofA1[A] = s1.a; ofA1[Y1] = s1.exit; ofA1[B] = s1.keep; ofA1[Y0] = s1.b;
    const ofA2 = []; ofA2[A] = s2.a; ofA2[B] = s2.exit; ofA2[Y0] = s2.keep; ofA2[Y1] = s2.b;
    const ofB1 = []; ofB1[B] = s1.b; ofB1[Y1] = s1.exit; ofB1[A] = s1.keep; ofB1[Y0] = s1.a;
    const ofB2 = []; ofB2[B] = s2.b; ofB2[A] = s2.exit; ofB2[Y0] = s2.keep; ofB2[Y1] = s2.a;
    const gA = [], gB = [];
    gA[B] = tri.glue[t0][B]; gA[Y0] = via(s1, s1.b, ofA1); gA[Y1] = via(s2, s2.b, ofA2); gA[A] = { t: 'new1', f: B, perm: swapAB };
    gB[A] = tri.glue[t0][A]; gB[Y0] = via(s1, s1.a, ofB1); gB[Y1] = via(s2, s2.a, ofB2); gB[B] = { t: 'new0', f: A, perm: swapAB };
    const back = new Map();
    [gA, gB].forEach((g, k) => g.forEach((x, f) => { if (typeof x.t === 'number') back.set(x.t + ':' + x.f, { t: 'new' + k, f, perm: inv(x.perm) }); }));
    return rebuildTri(tri, inside, [{ role: roleA, glue: gA }, { role: roleB, glue: gB }], (u, f) => back.get(u + ':' + f) || null);
  }
  // 2-3: two tetrahedra across a face made three, round a new edge between their far
  // corners. Each new one keeps t's corners but one of the face's, whose place holds
  // the far corner of t2.
  function move23(tri, t, f) {
    const g = tri.glue[t][f];
    if (g.t === t) return null;
    const t2 = g.t, a = f, face = [0, 1, 2, 3].filter((i) => i !== f), inside = new Set([t, t2]);
    for (const i of face) if (inside.has(tri.glue[t][i].t) || inside.has(tri.glue[t2][g.perm[i]].t)) return null;
    const swapP = (p, q) => [0, 1, 2, 3].map((i) => (i === p ? q : i === q ? p : i));
    const add = face.map((gone) => {
      const role = tri.T[t].role.slice();
      role[gone] = tri.T[t2].role[g.f];
      const gl = [];
      gl[gone] = tri.glue[t][gone];
      const of = [0, 1, 2, 3].map((i) => (i === a ? g.perm[gone] : i === gone ? g.f : g.perm[i])), h = tri.glue[t2][g.perm[gone]];
      gl[a] = { t: h.t, f: h.f, perm: [0, 1, 2, 3].map((i) => h.perm[of[i]]) };
      for (const keep of face) if (keep !== gone) gl[keep] = { t: 'new' + face.indexOf(keep), f: gone, perm: swapP(keep, gone) };
      return { role, glue: gl };
    });
    const back = new Map();
    add.forEach((m, k) => m.glue.forEach((x, i) => { if (typeof x.t === 'number') back.set(x.t + ':' + x.f, { t: 'new' + k, f: i, perm: inv(x.perm) }); }));
    return rebuildTri(tri, inside, add, (u, i) => back.get(u + ':' + i) || null);
  }
  // A move kept only if it keeps what it must: as many vertices, and as many more
  // edges than tetrahedra (none, for an ideal triangulation of the complement).
  function sound(before, after) {
    if (!after) return null;
    const a = classes(before), b = classes(after);
    return a.verts.length === b.verts.length && a.edges.length - before.T.length === b.edges.length - after.T.length ? after : null;
  }
  // fewer tetrahedra: 2-0 and 3-2 moves, while there are any to make
  function simplify(tri) {
    for (let guard = 0; guard < 400; guard++) {
      const cls = classes(tri);
      let next = null;
      for (const want of [2, 3]) {
        for (const copies of cls.edges) {
          if (copies.length !== want) continue;
          const cyc = around(tri, copies[0][0], copies[0][1], copies[0][2]);
          if (!cyc) continue;
          next = sound(tri, want === 2 ? move20(tri, cyc) : move32(tri, cyc));
          if (next) break;
        }
        if (next) break;
      }
      if (!next) return tri;
      tri = next;
    }
    return tri;
  }

  // The hyperbolic volume of the complement, by Thurston's equations on an ideal
  // triangulation (ideals, simplified), solved from every tetrahedron regular. After
  // a failure, the triangulation is changed by a few 2-3 moves and simplified again
  // (a walk through triangulations of the same complement), and after a while the
  // next triangulation is tried. Only a solution with every tetrahedron positively
  // oriented counts: the triangulation is then geometric and the volume the
  // hyperbolic one (Thurston). The search goes a try at a time: step() returns the
  // volume when found, null when there are no tries left (as for a link that is not
  // hyperbolic: opts.starts tries, default 60), and undefined meanwhile.
  function search(D, opts) {
    opts = opts || {};
    const starts = opts.starts || 60;
    let tris = null, tri = null, s = 0, per = 1, seed = 4242, done = !D.n || K.pieces(D).length > 1 ? null : undefined;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return {
      step() {
        if (done !== undefined) return done;
        if (!tris) { tris = ideals(D, 3).map(simplify); per = Math.ceil(starts / Math.max(1, tris.length)); if (!tris.length) return (done = null); }
        if (s >= starts) return (done = null);
        if (s % per === 0) tri = tris[s / per] || tri;
        else {
          for (let k = 0; k < 1 + (s % 4); k++) { const m = sound(tri, move23(tri, Math.floor(rnd() * tri.T.length), Math.floor(rnd() * 4))); if (m) tri = m; }
          tri = simplify(tri);
        }
        s++;
        const z = newton(system(tri, classes(tri)), tri.T.map(() => [0.02 * (2 * rnd() - 1), Math.PI / 3 + 0.02 * (2 * rnd() - 1)]));
        if (z && z.every((x) => x[1] > 0)) return (done = z.reduce((t, x) => t + bloch(x), 0));
        return undefined;
      },
    };
  }
  // the same, all at once (within opts.ms milliseconds, default 3000)
  function volume(D, opts) {
    const run = search(D, opts), until = Date.now() + ((opts && opts.ms) || 3000);
    for (;;) { const r = run.step(); if (r !== undefined) return r; if (Date.now() > until) return null; }
  }

  G.KnotVolume = { triangulate, classes, collapse, ideals, simplify, around, move20, move32, move23, search, volume, lobachevsky, bloch };
})(typeof globalThis !== 'undefined' ? globalThis : this);
