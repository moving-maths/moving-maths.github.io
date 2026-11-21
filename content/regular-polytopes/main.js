// Regular polytopes: the picture, the chamber with its point x, and the readouts. The
// mathematics is in polytopes.js (Coxeter groups, Wythoff's construction, snubs, duals and
// names) and penrose.js.
//
// The picture shows the polytope or tiling whose vertices are the images of a point x of the
// chamber C under the reflections: in rank two a polygon; in rank three a polyhedron (turning
// in space, or its tiling of the sphere projected stereographically to the plane), a tiling of
// the plane or of the hyperbolic plane (in the Poincaré disc); in rank four a 4-polytope (its
// boundary in space: stereographically, in perspective or in parallel) or a honeycomb of
// Euclidean or hyperbolic space (the latter in the Poincaré ball). Beside it, the chamber
// itself with x as a handle (in rank three with the three chambers beside it, where x's images
// under the rotations alone make a snub), the Coxeter diagram and the readouts. And Penrose's
// tilings. Everything is drawn in outline on a 2D canvas.
(function () {
  'use strict';
  const P = window.Polytopes, PEN = window.Penrose, INF = Infinity;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), canvas = $('flat'), handle = $('handle'), chamberSvg = $('chamber');
  MM.handle(handle);
  const TAU = 2 * Math.PI, FOV = 30 * Math.PI / 180, PHI = PEN.phi;
  const coarse = () => matchMedia('(pointer: coarse)').matches;

  /* ---------- small linear algebra (matrices as rows) ---------- */
  const I = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => +(i === j)));
  const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
  const mv = (A, v) => A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));
  const tr = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => { const l = Math.hypot(...v); return l ? v.map((x) => x / l) : v; };
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // a matrix made orthonormal again, rows by Gram–Schmidt (rotations drift as they are multiplied)
  function ortho(R) {
    const out = [];
    for (const r of R) {
      let v = r.slice();
      for (const u of out) { const d = dot(v, u); v = v.map((x, i) => x - d * u[i]); }
      out.push(norm(v));
    }
    return out;
  }
  // flat n×n matrices of polytopes.js as rows
  const rows = (F, n) => Array.from({ length: n }, (_, i) => Array.from(F.subarray ? F.subarray(i * n, i * n + n) : F.slice(i * n, i * n + n)));
  // the rotation of R⁴ in the plane of the unit vectors a and b, by t from a towards b
  function turn4(a, b, t) {
    const c = dot(a, b);
    let u = b.map((x, i) => x - c * a[i]);
    const l = Math.hypot(...u), R = I(4);
    if (l < 1e-12) return R;
    u = u.map((x) => x / l);
    const ct = Math.cos(t) - 1, st = Math.sin(t);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) R[i][j] += ct * (a[i] * a[j] + u[i] * u[j]) + st * (u[i] * a[j] - a[i] * u[j]);
    return R;
  }
  // the Lorentz form of R^{n−1,1}, its points normalized, half-turns and translations
  const lor = (a, b) => { const n = a.length - 1; let s = -a[n] * b[n]; for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; };
  const lnorm = (v) => { const q = -lor(v, v), t = v[v.length - 1]; return q > 1e-14 * t * t ? v.map((x) => x / (Math.sqrt(q) * (t < 0 ? -1 : 1))) : v.map((x) => x / Math.abs(t)); };
  const halfTurn = (X) => { const n = X.length - 1, Y = X.map((x, i) => (i === n ? -x : x)); return X.map((x, i) => Y.map((y, j) => (i === j ? -1 : 0) - 2 * x * y)); };
  function translation(a, b) { const m = lnorm(a.map((x, i) => x + b[i])); return mm(halfTurn(m), halfTurn(a)); }
  const sgn = (n) => (k) => (k === n ? -1 : 1);
  const linv = (L) => { const s = sgn(L.length - 1); return L.map((_, i) => L.map((__, j) => s(i) * s(j) * L[j][i])); };
  // a Lorentz matrix made to keep the form again (its columns, by Gram–Schmidt in the form)
  function fixL(L) {
    const n = L.length, last = n - 1, col = (j) => L.map((r) => r[j]), out = new Array(n);
    let t = col(last);
    t = t.map((x) => x / Math.sqrt(-lor(t, t)));
    out[last] = t;
    const done = [t];
    for (let j = 0; j < last; j++) {
      let v = col(j);
      for (const u of done) { const s = lor(v, u) / lor(u, u); v = v.map((x, k) => x - s * u[k]); }
      out[j] = v.map((x) => x / Math.sqrt(lor(v, v)));
      done.push(out[j]);
    }
    return L.map((_, i) => out.map((c) => c[i]));
  }
  // an affine map of space (4×4, last row 0 0 0 1) with its turn made orthonormal again
  function fixAffine(A) {
    const R = ortho(A.slice(0, 3).map((r) => r.slice(0, 3)));
    return [[...R[0], A[0][3]], [...R[1], A[1][3]], [...R[2], A[2][3]], [0, 0, 0, 1]];
  }
  const invAffine4 = (A) => {
    const R = A.slice(0, 3).map((r) => r.slice(0, 3)), Rt = tr(R), t = [A[0][3], A[1][3], A[2][3]], u = mv(Rt, t).map((x) => -x);
    return [[...Rt[0], u[0]], [...Rt[1], u[1]], [...Rt[2], u[2]], [0, 0, 0, 1]];
  };

  /* ---------- colours ---------- */
  // a face takes the colour of the corner of the chamber it lies round (kind k: the corner off
  // wall k: 2 the faces of {p, q}, 0 its vertices, 1 its edges); 3 the triangles of a snub
  const FACE = ['face-2', 'face-3', 'face-1', 'face-4'];
  const fill = (k) => (k < 0 ? 'dual-face-fill' : FACE[k] + '-fill');

  /* ---------- what can be shown ---------- */
  const S3 = (id, p, q, w, extra) => Object.assign({ id, rank: 3, p, q, r: 2, w: w || [1, 0, 0] }, extra || {});
  const T3 = (id, p, q, r, w, extra) => Object.assign({ id, rank: 3, p, q, r, w }, extra || {});
  const Q4 = (id, ms, w, extra) => Object.assign({ id, rank: 4, ms, w: w || [1, 0, 0, 0] }, extra || {});
  const LISTS = {
    polygons: [[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => ({ id: 'polygon-' + p, rank: 2, p, w: [1, 0] }))],
    polyhedra: [
      [S3('tetrahedron', 3, 3), S3('cube', 4, 3), S3('octahedron', 3, 4), S3('dodecahedron', 5, 3), S3('icosahedron', 3, 5)],
      [S3('truncated-tetrahedron', 3, 3, [1, 1, 0]), S3('cuboctahedron', 4, 3, [0, 1, 0]), S3('truncated-cube', 4, 3, [1, 1, 0]), S3('truncated-octahedron', 4, 3, [0, 1, 1]),
        S3('rhombicuboctahedron', 4, 3, [1, 0, 1]), S3('truncated-cuboctahedron', 4, 3, [1, 1, 1]), S3('snub-cube', 4, 3, null, { snub: true }),
        S3('icosidodecahedron', 5, 3, [0, 1, 0]), S3('truncated-dodecahedron', 5, 3, [1, 1, 0]), S3('truncated-icosahedron', 5, 3, [0, 1, 1]),
        S3('rhombicosidodecahedron', 5, 3, [1, 0, 1]), S3('truncated-icosidodecahedron', 5, 3, [1, 1, 1]), S3('snub-dodecahedron', 5, 3, null, { snub: true })],
      [S3('rhombic-dodecahedron', 4, 3, [0, 1, 0], { dual: true }), S3('rhombic-triacontahedron', 5, 3, [0, 1, 0], { dual: true })],
      [S3('pentagonal-prism', 5, 2, [1, 0, 1]), S3('pentagonal-antiprism', 5, 2, null, { snub: true })],
    ],
    plane: [
      [S3('square-tiling', 4, 4), S3('triangular-tiling', 3, 6), S3('hexagonal-tiling', 6, 3)],
      [S3('truncated-square-tiling', 4, 4, [1, 1, 0]), S3('snub-square-tiling', 4, 4, null, { snub: true }), S3('trihexagonal-tiling', 6, 3, [0, 1, 0]),
        S3('truncated-hexagonal-tiling', 6, 3, [1, 1, 0]), S3('rhombitrihexagonal-tiling', 6, 3, [1, 0, 1]), S3('truncated-trihexagonal-tiling', 6, 3, [1, 1, 1]),
        S3('snub-trihexagonal-tiling', 6, 3, null, { snub: true }), { id: 'elongated-triangular-tiling', rank: 3, special: 'elongated' }],
      [S3('rhombille-tiling', 6, 3, [0, 1, 0], { dual: true }), S3('cairo-pentagonal-tiling', 4, 4, null, { snub: true, dual: true }), S3('kisrhombille-tiling', 6, 3, [1, 1, 1], { dual: true })],
      [{ id: 'penrose', kind: 'penrose' }],
    ],
    hyperbolic: [
      [S3('heptagonal-tiling', 7, 3), S3('order-7-triangular-tiling', 3, 7), S3('order-4-pentagonal-tiling', 5, 4), S3('order-5-square-tiling', 4, 5),
        S3('order-4-hexagonal-tiling', 6, 4), S3('octagonal-tiling', 8, 3), S3('order-5-pentagonal-tiling', 5, 5),
        S3('order-3-apeirogonal-tiling', INF, 3), S3('infinite-order-triangular-tiling', 3, INF)],
      [S3('triheptagonal-tiling', 7, 3, [0, 1, 0]), S3('rhombitetrapentagonal-tiling', 5, 4, [1, 0, 1]), S3('truncated-triheptagonal-tiling', 7, 3, [1, 1, 1]), S3('snub-triheptagonal-tiling', 7, 3, null, { snub: true })],
      [T3('t433', 4, 3, 3, [1, 0, 0]), T3('t433b', 4, 3, 3, [0, 1, 1]), T3('t444', 4, 4, 4, [0, 1, 0]), T3('tiii', INF, INF, INF, [1, 0, 0])],
    ],
    'space-sphere': [[Q4('5-cell', [3, 3, 3]), Q4('tesseract', [4, 3, 3]), Q4('16-cell', [3, 3, 4]), Q4('24-cell', [3, 4, 3]), Q4('120-cell', [5, 3, 3]), Q4('600-cell', [3, 3, 5])]],
    'space-plane': [[Q4('cubic-honeycomb', [4, 3, 4]), Q4('bitruncated-cubic-honeycomb', [4, 3, 4], [0, 1, 1, 0]), { id: 'rhombic-dodecahedral-honeycomb', rank: 4, special: 'octet', dual: true }]],
    'space-hyperbolic': [[Q4('order-4-dodecahedral-honeycomb', [5, 3, 4]), Q4('order-5-cubic-honeycomb', [4, 3, 5]), Q4('order-5-dodecahedral-honeycomb', [5, 3, 5]), Q4('icosahedral-honeycomb', [3, 5, 3])]],
  };
  const ITEMS = new Map();
  for (const fam of Object.keys(LISTS)) for (const g of LISTS[fam]) for (const it of g) { it.fam = fam; ITEMS.set(it.id, it); }

  // the page's state: one source for every picture and readout
  const state = {
    kind: 'sphere',            // polygon, sphere, plane, hyperbolic (rank three, by the group), penrose, space (rank four)
    two: { p: 5, w: [1, 0], dual: false },
    // rank three: the triangle (p q r), x by its walls w (in C), the chamber beside C it is
    // shown in (−1: in C), the dual, or a tiling that is not Wythoff's
    three: { p: 5, q: 3, r: 2, w: [1, 0, 0], flap: -1, dual: false, special: null, from: 0, t: 0 },  // (from, t: its sections, as for rank four)
    // rank four: the group, x, the dual or the honeycomb that is not Wythoff's; the view: a map
    // of the space (a rotation of R⁴, an affine map, a Lorentz map), the turn of the picture in
    // space, the projection of the 3-sphere, and the turn of the chamber's picture
    four: { ms: [5, 3, 3], w: [1, 0, 0, 0], dual: false, special: null, rot: I(4), R3: I(3), turn: { th: -0.45, ph: 0.3 }, m: null, proj: 'stereo', wR: I(3), wt: { th: 1, ph: 0.3 }, zoom: 1,
      // how a polytope (not a honeycomb) is shown: its boundary in space, its projection to the
      // Coxeter plane, or its sections by the hyperplanes u·y = t perpendicular to the direction of
      // the corner `from` of C (t in [−1, 1], the vertices at distance at most 1)
      view: 'space', from: 0, t: 0 },
    colours: false, mirrors: false, view3: 'solid', rotate: !MM.reduceMotion(), petrie: false,
    upFlip: false,             // the solid stands on the Petrie polygon's or the sections' axis the other way up
    mirrorHi: null,            // the mirror picked on the sphere: { g: the group's key, key: the mirror's (mirrorKey) }
    // the solid turns like a turntable about an axis kept upright (see upFrame): th about it, ph
    // tipping it towards the eye
    turn: { th: -0.45, ph: 0.3 },
    R3: mm(rotX(0.3), rotY(-0.45)),   // the sphere's turn (the solid's from turn; the stereographic picture's own)
    L: I(3),                          // the hyperbolic plane's view: a Lorentz map, then the disc
    V: null,                          // the Euclidean plane's view: an affine map to pixels (3×3)
    span: 3.2,                        // … showing this far from the middle
    pen: { tiles: 'p3', span: 73, c: [0, 0], arcs: false, larger: false },
  };

  /* ---------- rank two ---------- */
  const groups2 = new Map();
  function group2(p) {
    let g = groups2.get(p);
    if (!g) { const M = P.model([p]); g = { p, M, T: P.chambers(M) }; groups2.set(p, g); }
    return g;
  }
  let c2 = null;
  function complex2() {
    const s = state.two, g = group2(s.p), key = s.p + '|' + s.w.join(',');
    if (c2 && c2.key === key) return c2;
    const x = g.M.point(s.w), W = P.wythoff(g.T, x);
    c2 = { key, g, M: g.M, x, W, on: P.wallsOf(g.M, x) };
    return c2;
  }

  /* ---------- rank three: the group, the point, the complex ---------- */
  const PLANE_R = 24, RINGS3 = [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]];
  const groups3 = new Map();
  function group3(p, q, r) {
    const key = [p, q, r].join(',');
    let g = groups3.get(key);
    if (!g) {
      const M = P.model(P.triangle(p, q, r));
      let R = 0;
      if (M.kind === 'plane') R = PLANE_R;
      else if (M.kind === 'hyperbolic') {
        // near the middle all of them (farther for large chambers, so that its faces are whole),
        // and beyond, as long as they are more than a pixel or two across in the disc
        const far = M.corners.filter((c, k) => !M.ideal[k]).map((c) => Math.acosh(Math.max(1, -M.form(c, M.rho))));
        R = Math.min(7, Math.max(3.5, 2 * Math.max(0, ...far) + 1));
      }
      g = { key, p, q, r, M, T: P.chambers(M, R, 140000, M.kind === 'hyperbolic' ? 0.007 : 0), special: RINGS3.map((ri) => P.uniform(M, ri)), snubX: null };
      if (groups3.size > 24) groups3.delete(groups3.keys().next().value);
      groups3.set(key, g);
    }
    return g;
  }
  const snubPoint = (g) => g.snubX || (g.snubX = P.snubPoint(g.M));
  const specials3 = new Map();
  function special3(id) {
    let W = specials3.get(id);
    if (!W) {
      // the elongated triangular tiling, its edges 2 long as the square tiling's
      W = P.elongated(PLANE_R / 2);
      for (let i = 0; i < W.pos.length; i += 3) { W.pos[i] *= 2; W.pos[i + 1] *= 2; }
      specials3.set(id, W);
    }
    return W;
  }
  let c3 = null; // the complex shown: { key, g, M, x, xe (x where it is shown), W, kind, snubbed, uniform }
  function complex3() {
    const s = state.three;
    if (s.special) {
      const key = 'special|' + s.special;
      if (c3 && c3.key === key) return c3;
      const W = special3(s.special);
      c3 = { key, special: s.special, W, M: W.M, kind: 'plane', uniform: true, on: [false, false, false] };
      return c3;
    }
    const g = group3(s.p, s.q, s.r), M = g.M, x = M.point(s.w), on = P.wallsOf(M, x);
    const snubbed = s.flap >= 0 && !on.some(Boolean);
    const shape = g.key + '|' + (snubbed ? 's' + s.flap : on.map(Number).join(''));
    const key = shape + '|' + s.w.map((v) => v.toFixed(13)).join(',');
    if (c3 && c3.key === key) return c3;
    let W;
    if (c3 && c3.shape === shape && c3.g === g) W = P.place(c3.W, x);
    else W = snubbed ? P.snub(g.T, x) : P.wythoff(g.T, x);
    let xe = x;
    if (snubbed) {
      // the snub of the point across wall i: every vertex reflected in it
      const Sf = M.S[s.flap];
      for (let v = 0; v < W.V; v++) W.pos.set(P.apply(Sf, Array.from(W.pos.subarray(3 * v, 3 * v + 3)), 3), 3 * v);
      W.flip = Sf;
      xe = P.apply(Sf, x, 3);
    }
    // uniform: every edge of one length (over the edges near the middle)
    let lo = Infinity, hi = 0;
    for (let i = 0; i < W.edges.length && i < 3 * 400; i += 3) {
      const a = W.edges[i], b = W.edges[i + 1];
      if (M.isIdeal(W.pos.subarray(3 * a, 3 * a + 3)) || M.isIdeal(W.pos.subarray(3 * b, 3 * b + 3))) continue;
      const l = M.far(W.pos.subarray(3 * a, 3 * a + 3), W.pos.subarray(3 * b, 3 * b + 3));
      lo = Math.min(lo, l); hi = Math.max(hi, l);
    }
    c3 = { key, shape, g, M, x, xe, W, kind: M.kind, snubbed, on, uniform: hi === 0 || hi - lo < 1e-6 * Math.max(1, hi) };
    return c3;
  }
  // the vertex configuration of the complex (as a list of sizes, possibly repeating for ever)
  function config3(c) {
    if (c.special) return { sizes: [3, 3, 3, 4, 4], ideal: false };
    return P.vertexConfig(c.M, c.on, c.snubbed);
  }

  /* ---------- rank four ---------- */
  const HYP4_R = { '5,3,4': 3.3, '4,3,5': 3.2, '5,3,5': 3.6, '3,5,3': 3.1 };
  const groups4 = new Map();
  function group4(ms) {
    const key = ms.join(',');
    let g = groups4.get(key);
    if (!g) {
      const M = P.model(ms);
      const R = M.kind === 'sphere' ? 0 : M.kind === 'plane' ? 9 : HYP4_R[key] || 4;
      g = { key, ms, M, R, T: P.chambers(M, R, 220000), Ts: [] };
      groups4.set(key, g);
    }
    return g;
  }
  // A honeycomb of hyperbolic space drawn only so deep that it has at most EDGE_BUDGET edges: with
  // x off more walls each chamber gives more edges (inside C, 16 times those of the regular one),
  // and the number of chambers within R grows like e^{2R}. The chambers within R less `level`
  // steps; the deepest level whose edges, estimated from a shallow one (edges per chamber stay
  // nearly the same), are within the budget.
  const HYP4_STEP = 0.35, HYP4_LEVELS = 5, EDGE_BUDGET = 12000;
  const chambers4 = (g, level) => (level ? g.Ts[level] || (g.Ts[level] = P.chambers(g.M, g.R - level * HYP4_STEP, 220000)) : g.T);
  function budgeted(g, x) {
    const top = HYP4_LEVELS - 1, Ws = P.wythoff(chambers4(g, top), x), per = Ws.edges.length / 3 / chambers4(g, top).N;
    let level = top;
    while (level > 0 && per * chambers4(g, level - 1).N <= EDGE_BUDGET) level--;
    return { W: level === top ? Ws : P.wythoff(chambers4(g, level), x), level };
  }
  let s4 = null, s4s = null; // what is drawn, and its structure, kept while x moves on the same walls
  // The polytope or honeycomb of rank four, as drawn: its points (the dual's, if shown), edges,
  // and cells (each with its vertices and middle), and how large it is.
  function space4() {
    const f = state.four;
    let key, W, M, g = null, x = null, shape, level = 0;
    if (f.special) {
      shape = 'special|' + f.special;
      key = shape + '|' + f.dual;
      if (s4 && s4.key === key) return s4;
      W = s4 && s4.shape === shape ? s4.W : P.octet(4.6);
      M = W.M;
    } else {
      g = group4(f.ms);
      M = g.M;
      x = M.point(f.w);
      shape = g.key + '|' + P.wallsOf(M, x).map(Number).join('');
      key = shape + '|' + f.w.map((v) => v.toFixed(13)).join(',') + '|' + f.dual;
      if (s4 && s4.key === key) return s4;
      if (s4 && s4.shape === shape && s4.g === g) { W = P.place(s4.W, x); level = s4.level; }
      else if (M.kind === 'hyperbolic') ({ W, level } = budgeted(g, x));
      else W = P.wythoff(g.T, x);
    }
    const d = M.d, kind = M.kind;
    // the structure: each cell's vertices; for the dual, a vertex for each cell, an edge for each
    // 2-face (joining the two cells on it) and a cell for each vertex (the cells round it)
    if (!s4s || s4s.shape !== shape || s4s.dual !== f.dual) {
      const cellVerts = W.cells.map((c) => { const st = new Set(); c.faces.forEach((fi) => W.faces[fi].v.forEach((v) => st.add(v))); return [...st]; });
      let V, edges, cells, dualOf = null;
      if (f.dual) {
        const onFace = Array.from({ length: W.faces.length }, () => []), round = Array.from({ length: W.V }, () => []), e2 = [];
        W.cells.forEach((c, ci) => c.faces.forEach((fi) => onFace[fi].push(ci)));
        onFace.forEach((cs) => { if (cs.length === 2) e2.push(cs[0], cs[1], 0); });
        cellVerts.forEach((vs, ci) => vs.forEach((v) => round[v].push(ci)));
        V = W.cells.length; edges = Int32Array.from(e2); cells = round.map((cs, v) => ({ verts: cs, v, l: -1 })).filter((c) => c.verts.length > 3);
        dualOf = { onFace, facesAt: Array.from({ length: W.V }, () => []) };
        W.faces.forEach((fc, fi) => fc.v.forEach((v) => dualOf.facesAt[v].push(fi)));
      } else { V = W.V; edges = W.edges; cells = W.cells.map((c, i) => ({ verts: cellVerts[i], l: c.l, faces: c.faces.map((fi) => W.faces[fi].v) })); }
      const edgeKey = new Map();
      for (let i = 0; i < edges.length; i += 3) edgeKey.set(Math.min(edges[i], edges[i + 1]) * 1e7 + Math.max(edges[i], edges[i + 1]), i / 3);
      s4s = { shape, dual: f.dual, cellVerts, V, edges, cells, edgeKey, dualOf };
    }
    const S = s4s, mean = (vs) => { const c = new Array(d).fill(0); for (const v of vs) for (let a = 0; a < d; a++) c[a] += W.pos[d * v + a] / vs.length; return c; };
    let pos;
    if (f.dual) {
      // the dual's vertices: the poles of the cells' hyperplanes on the sphere (scaled into it, for
      // the projections that keep straight lines), the cells' middles in the other spaces
      pos = new Float64Array(4 * S.V);
      S.cellVerts.forEach((vs, ci) => { const c = mean(vs), l2 = dot(c, c); pos.set(kind === 'sphere' ? c.map((t) => t / l2) : M.normalize(c), 4 * ci); });
      if (kind === 'sphere') {
        let top = 0;
        for (let v = 0; v < S.V; v++) top = Math.max(top, Math.hypot(pos[4 * v], pos[4 * v + 1], pos[4 * v + 2], pos[4 * v + 3]));
        for (let i = 0; i < pos.length; i++) pos[i] /= top;
      }
      for (const cell of S.cells) cell.mid = Array.from(W.pos.subarray(d * cell.v, d * cell.v + d));
    } else {
      pos = W.pos;
      S.cells.forEach((cell, i) => { const c = mean(S.cellVerts[i]); cell.mid = kind === 'sphere' ? norm(c) : M.normalize(c); });
    }
    // the size of the picture: the angle (or distance) between neighbouring cells' middles
    let c0 = null, best = -Infinity;
    for (const c of S.cells) { const v = closeness(kind, c.mid); if (v > best) { best = v; c0 = c; } }
    let adj = Infinity;
    for (const c of S.cells) {
      if (c === c0) continue;
      const a = kind === 'sphere' ? Math.acos(clamp(dot(c0.mid, c.mid), -1, 1)) : kind === 'plane' ? Math.hypot(c.mid[0] - c0.mid[0], c.mid[1] - c0.mid[1], c.mid[2] - c0.mid[2]) : Math.acosh(Math.max(1, -lor(c.mid, c0.mid)));
      if (a > 1e-6 && a < adj) adj = a;
    }
    const cellEdges = (cell) => {
      if (cell.edgeList) return cell.edgeList;
      const vs = cell.verts, list = [];
      for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) { const e = S.edgeKey.get(Math.min(vs[a], vs[b]) * 1e7 + Math.max(vs[a], vs[b])); if (e !== undefined) list.push(e); }
      return (cell.edgeList = list);
    };
    // a cell's faces as cycles of its vertices; a cell of the dual has a face for each edge of W
    // at its vertex v, through the cells round that edge in turn
    const cellFaces = (cell) => {
      if (cell.faces) return cell.faces;
      const D = S.dualOf, v = cell.v, byEdge = new Map();
      for (const fi of D.facesAt[v]) {
        const vs = W.faces[fi].v, i = vs.indexOf(v), n = vs.length;
        for (const u of [vs[(i + 1) % n], vs[(i + n - 1) % n]]) { if (!byEdge.has(u)) byEdge.set(u, []); byEdge.get(u).push(fi); }
      }
      const out = [];
      for (const fs of byEdge.values()) {
        const ring = [];
        let fc = fs[0], c = D.onFace[fc][0];
        for (let t = 0; t < fs.length + 1 && c !== undefined; t++) {
          ring.push(c);
          const next = fs.find((g2) => g2 !== fc && D.onFace[g2].includes(c));
          if (next === undefined) break;
          fc = next;
          c = D.onFace[fc].find((c2) => c2 !== c);
          if (c === ring[0]) break;
        }
        if (ring.length > 2) out.push(ring);
      }
      return (cell.faces = out);
    };
    // (the ball's fade: from the middle out to where the chambers drawn end)
    const lose = level * HYP4_STEP, fade = [Math.tanh((1.9 - 0.6 * lose) / 2), Math.tanh((3.9 - lose) / 2)];
    s4 = { key, shape, g, M, W, x, d, kind, adj, pos, V: S.V, edges: S.edges, cells: S.cells, cellEdges, cellFaces, level, fade };
    return s4;
  }
  // how near a point of the space is to the middle of the picture, before the view (larger: nearer)
  function closeness(kind, p) { return kind === 'sphere' ? -p[3] : kind === 'plane' ? -Math.hypot(p[0], p[1], p[2]) : -p[3]; }

  /* ---------- the camera of the pictures in space ---------- */
  let cam3 = null; // the last frame's camera: { R, D, w, h, f, s }
  const camera = (R, rho, w, h, room, fov) => { const a = fov || FOV; return { R, D: rho / Math.sin(a / 2) * (room || 1.07), w, h, rho, f: 1 / Math.tan(a / 2), s: Math.min(w, h) / 2 }; };
  const SOLID_FOV = 15 * Math.PI / 180; // the solids seen from farther off, so that perspective bends them less
  // a point of space on the canvas: [x, y, depth]
  function onScreen(C, p) {
    const R = C.R, x = R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], y = R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], z = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2];
    const d = C.D - z, k = C.f / d * C.s;
    return [C.w / 2 + x * k, C.h / 2 - y * k, d];
  }
  // the ray from the eye through a point of the canvas: origin and direction, in space
  function ray(C, x, y) {
    const Rt = tr(C.R), dir = norm([(x - C.w / 2) / C.s / C.f, (C.h / 2 - y) / C.s / C.f, -1]);
    return { o: mv(Rt, [0, 0, C.D]), d: mv(Rt, dir) };
  }
  function frameCanvas() {
    const { ctx, w, h } = MM.fitCanvas(canvas, stage.clientWidth, stage.clientHeight);
    MM.clearCanvas(ctx);
    ctx.lineJoin = ctx.lineCap = 'round';
    return { ctx, w, h };
  }
  const thin = () => (stage.clientWidth < 500 ? 0.85 : 1);

  /* ---------- rank two: the polygon ---------- */
  function dual2(pts) {
    // the polar of each edge's line, in order
    return pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length], n = [b[1] - a[1], a[0] - b[0]], d = n[0] * a[0] + n[1] * a[1];
      return [n[0] / d, n[1] / d];
    });
  }
  function drawPolygon() {
    const { ctx, w, h } = frameCanvas(), c = complex2(), W = c.W, M = c.M, T = c.g.T;
    // (a digon has no face: its two vertices)
    let pts = (W.faces[0] ? W.faces[0].v : [0, 1].slice(0, W.V)).map((v) => [W.pos[2 * v], W.pos[2 * v + 1]]);
    if (state.two.dual) pts = dual2(pts);
    const top = Math.max(1, ...pts.map((p) => Math.hypot(p[0], p[1])));
    const K = Math.min(w, h) * 0.38 / top, ox = w / 2, oy = h / 2, at = (p) => [ox + K * p[0], oy - K * p[1]];
    const outline = () => { ctx.beginPath(); pts.forEach((p, i) => { const q = at(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); };
    if (state.colours) { outline(); ctx.fillStyle = MM.color(state.two.dual ? 'dual-face-fill' : 'face-1-fill'); ctx.fill(); }
    if (state.mirrors) {
      // the circle of the vertices, the mirrors through the middle, and C shaded
      ctx.strokeStyle = MM.rgba('wall', 0.42);
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(ox, oy, K, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      const seen = new Set(), L = Math.min(w, h) * 0.48;
      for (let e = 0; e < T.N; e++) for (const k of [0, 1]) {
        const p = P.apply(T.mat(e), M.corners[k], 2), a = Math.atan2(p[1], p[0]), key = Math.round(((a % Math.PI) + Math.PI) % Math.PI * 1e6);
        if (seen.has(key)) continue;
        seen.add(key);
        ctx.beginPath(); ctx.moveTo(ox - L * Math.cos(a), oy + L * Math.sin(a)); ctx.lineTo(ox + L * Math.cos(a), oy - L * Math.sin(a)); ctx.stroke();
      }
    }
    outline();
    ctx.strokeStyle = MM.color('edge');
    ctx.lineWidth = 2 * thin();
    ctx.stroke();
    handle.hidden = true;
  }

  /* ---------- rank three on the sphere: the solid ---------- */
  // the solid as drawn, cached with the complex: its faces (as planes), its edges with the faces
  // on each, and the dual's vertices (for the dual, in the colours of the faces they stand for)
  const ends = (a, b) => { const ka = a.map((x) => Math.round(x * 1e6)).join(','), kb = b.map((x) => Math.round(x * 1e6)).join(','); return ka < kb ? ka + '|' + kb : kb + '|' + ka; };
  function solidShape(c) {
    const dualOn = state.three.dual;
    if (c.solid && c.solid.dual === dualOn) return c.solid;
    const W = c.W;
    let faces, verts = [], rho = 1;
    if (!dualOn) faces = P.planes(W);
    else {
      const D = c.D || (c.D = P.polar(W));
      faces = D.faces;
      D.pos.forEach((p, i) => verts.push({ p, k: D.kinds[i] }));
      rho = Math.max(...D.pos.map((p) => Math.hypot(...p)));
    }
    const at = new Map(), edges = [];
    faces.forEach((f, fi) => f.v.forEach((a, i) => {
      const b = f.v[(i + 1) % f.v.length], key = Math.min(a, b) + ',' + Math.max(a, b);
      let e = at.get(key);
      if (!e) { e = { a: f.pts[i], b: f.pts[(i + 1) % f.pts.length], faces: [] }; at.set(key, e); edges.push(e); }
      e.faces.push(fi);
    }));
    // (a polyhedron without faces, as the hosohedra: its edges as they are)
    if (!faces.length) for (let i = 0; i < W.edges.length; i += 3) edges.push({ a: Array.from(W.pos.subarray(3 * W.edges[i], 3 * W.edges[i] + 3)), b: Array.from(W.pos.subarray(3 * W.edges[i + 1], 3 * W.edges[i + 1] + 3)), faces: [] });
    const edgeAt = new Map(edges.map((e) => [ends(e.a, e.b), e]));
    c.solid = { dual: dualOn, faces, edges, verts, rho, edgeAt };
    return c.solid;
  }
  function drawSolid() {
    const { ctx, w, h } = frameCanvas(), c = complex3(), sh = solidShape(c), C = cam3 = camera(state.R3, sh.rho, w, h, 1.16, SOLID_FOV);
    const eye = mv(tr(C.R), [0, 0, C.D]);
    const front = sh.faces.map((f) => dot(f.n, eye.map((e, i) => e - f.c[i])) > 1e-9);
    const edgeFront = (e) => !e.faces.length || e.faces.length === 1 || e.faces.some((fi) => front[fi]);
    const path = (list) => { const p = new Path2D(); for (const e of list) { const a = onScreen(C, e.a), b = onScreen(C, e.b); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); } return p; };
    const k = thin();
    // the mirrors: their segments on the surface, each on one face, and the one picked
    const lines = mirrorsShown(c) ? wallLines(c) : [], hi = mirrorHi(c);
    // the Petrie polygon's sides, each with whether it is on the near side
    const pet = state.petrie ? petrie3(c) : null;
    const petSides = pet ? pet.pts.map((A, i) => { const B = pet.pts[(i + 1) % pet.h], e = sh.edgeAt.get(ends(A, B)); return { a: A, b: B, near: !e || edgeFront(e) }; }) : [];
    const near = (sg) => dot(sg[2], eye.map((e, i) => e - sg[0][i])) > 1e-9;
    const segs = (list) => { const p = new Path2D(); for (const sg of list) { const A = onScreen(C, sg[0]), B = onScreen(C, sg[1]); p.moveTo(A[0], A[1]); p.lineTo(B[0], B[1]); } return p; };
    // the far side: dashed
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = MM.rgba('edge', 0.42);
    ctx.lineWidth = 1 * k;
    ctx.stroke(path(sh.edges.filter((e) => !edgeFront(e))));
    if (lines.length) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = MM.rgba('wall', 0.32);
      ctx.lineWidth = 0.8;
      ctx.stroke(segs(lines.filter((sg) => !near(sg) && sg[3] !== hi)));
      if (hi) {
        ctx.strokeStyle = MM.rgba('highlight', 0.75);
        ctx.lineWidth = 1.3;
        ctx.stroke(segs(lines.filter((sg) => !near(sg) && sg[3] === hi)));
      }
    }
    if (pet) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = MM.rgba('highlight', 0.7);
      ctx.lineWidth = 1.5 * k;
      ctx.stroke(path(petSides.filter((e) => !e.near)));
    }
    ctx.setLineDash([]);
    // the near faces, lightly coloured (the dashes show through)
    if (state.colours) {
      ctx.globalAlpha = 0.78;
      sh.faces.forEach((f, fi) => {
        if (!front[fi]) return;
        ctx.beginPath();
        f.pts.forEach((p, i) => { const q = onScreen(C, p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
        ctx.closePath();
        ctx.fillStyle = MM.color(fill(f.k));
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    // the picked mirror's plane: where it cuts the solid, lightly shaded
    if (hi) {
      const sec = mirrorSection(c, hi);
      if (sec) {
        ctx.beginPath();
        sec.forEach((p, i) => { const q = onScreen(C, p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
        ctx.closePath();
        ctx.fillStyle = MM.rgba('highlight', 0.1);
        ctx.fill();
      }
    }
    // the mirrors on the near faces
    if (lines.length) {
      ctx.strokeStyle = MM.rgba('wall', 0.42);
      ctx.lineWidth = 0.8;
      ctx.stroke(segs(lines.filter((sg) => near(sg) && sg[3] !== hi)));
      if (hi) {
        ctx.strokeStyle = MM.color('highlight');
        ctx.lineWidth = 1.8;
        ctx.stroke(segs(lines.filter((sg) => near(sg) && sg[3] === hi)));
      }
    }
    ctx.strokeStyle = MM.color('edge');
    ctx.lineWidth = 1.7 * k;
    ctx.stroke(path(sh.edges.filter(edgeFront)));
    if (pet) {
      ctx.strokeStyle = MM.color('highlight');
      ctx.lineWidth = 2.6 * k;
      ctx.stroke(path(petSides.filter((e) => e.near)));
    }
    // the dual's vertices, near ones, in the colours of the faces they stand for
    if (state.three.dual) for (const v of sh.verts) {
      if (dot(v.p, eye) - dot(v.p, v.p) < 0) continue;
      const q = onScreen(C, v.p);
      ctx.fillStyle = MM.color(state.colours ? FACE[v.k] : 'edge');
      ctx.beginPath(); ctx.arc(q[0], q[1], 3.2 * k, 0, TAU); ctx.fill();
    }
    handle.hidden = true;
  }
  // the kaleidoscope's walls on the surface: in each chamber gC the segments from the middles
  // of the faces round its corners to the points where the edges cross its walls, each with the
  // normal of the face it lies on (the corner's direction; for the dual, the vertex's) and the
  // key of its mirror
  function wallLines(c) {
    if (c.walls && c.wallsDual === state.three.dual) return c.walls;
    c.wallsDual = state.three.dual;
    c.sections = new Map();
    const { g, x } = c, T = g.T, M = g.M, out = [], dualOn = state.three.dual;
    const sel = (k) => { const ck = M.corners[k]; return dualOn ? ck.map((v) => v / dot(ck, x)) : ck.map((v) => v * dot(ck, x)); };
    const P3 = [0, 1, 2].map(sel), mids = [0, 1, 2].map((i) => { const s = P.apply(M.S[i], x, 3); return x.map((v, j) => (v + s[j]) / 2); });
    for (let e = 0; e < T.N; e++) {
      const G = T.mat(e), pts = P3.map((p) => P.apply(G, p, 3)), xe = norm(P.apply(G, x, 3));
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3, k = (i + 2) % 3;           // wall i joins the corners j and k
        if (!dualOn && T.right[e * 3 + i] < e) continue;  // each wall once
        const key = mirrorKey(norm(P.apply(G, M.r[i], 3)));
        if (dualOn) out.push([pts[j], pts[k], xe, key]);
        else { const m = P.apply(G, mids[i], 3); out.push([pts[j], m, norm(pts[j]), key], [m, pts[k], norm(pts[k]), key]); }
      }
    }
    return (c.walls = out);
  }
  // A mirror (a plane through the middle) by its unit normal, whichever way round. On the sphere
  // a click on a mirror picks it (and another click on it lets it go): it is drawn in the
  // highlight's red (the edges are blue), and on the solid with the polygon where its plane cuts
  // the solid.
  const mirrorKey = (n) => { const sg = (n.find((v) => Math.abs(v) > 1e-6) || 1) < 0 ? -1 : 1; return n.map((v) => Math.round(sg * v * 1e5)).join(','); };
  const mirrorsShown = (c) => state.mirrors && !c.snubbed && !c.special;
  const mirrorHi = (c) => (state.mirrorHi && mirrorsShown(c) && state.mirrorHi.g === c.g.key ? state.mirrorHi.key : null);
  // the polygon where the plane of a mirror cuts the solid: the ends of its segments in order round it
  function mirrorSection(c, key) {
    const lines = wallLines(c);
    if (c.sections.has(key)) return c.sections.get(key);
    const n = key.split(',').map((v) => +v / 1e5), u = norm(cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), v = cross(norm(n), u);
    const pts = [];
    for (const sg of lines) if (sg[3] === key) pts.push(sg[0], sg[1]);
    const at = pts.map((p) => ({ p, a: Math.atan2(dot(p, v), dot(p, u)) })).sort((a, b) => a.a - b.a);
    const out = [];
    for (const q of at) if (!out.length || Math.hypot(...q.p.map((t, i) => t - out[out.length - 1][i])) > 1e-9) out.push(q.p);
    const sec = out.length >= 3 ? out : null;
    c.sections.set(key, sec);
    return sec;
  }
  // the mirror under the point (x, y) of the picture, within tol pixels (on the solid, a near one
  // before a far one), or null
  function mirrorAt(x, y, tol) {
    const c = complex3();
    if (state.kind !== 'sphere' || state.view3 === 'sections' || !mirrorsShown(c)) return null;
    const dSeg = (A, B) => { const dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy, t = l2 ? clamp(((x - A[0]) * dx + (y - A[1]) * dy) / l2, 0, 1) : 0; return Math.hypot(x - A[0] - t * dx, y - A[1] - t * dy); };
    let best = null, bd = tol;
    if (state.view3 === 'solid') {
      if (!cam3) return null;
      const C = cam3, eye = mv(tr(C.R), [0, 0, C.D]);
      for (const sg of wallLines(c)) {
        const far = dot(sg[2], eye.map((e, i) => e - sg[0][i])) <= 1e-9, d = dSeg(onScreen(C, sg[0]), onScreen(C, sg[1])) + (far ? 3 : 0);
        if (d < bd) { bd = d; best = sg[3]; }
      }
      return best;
    }
    const V = stereoView(stage.clientWidth, stage.clientHeight), T = c.g.T, M = c.g.M, seen = new Set();
    for (let e = 0; e < T.N; e++) for (let i = 0; i < 3; i++) {
      const mn = norm(P.apply(T.mat(e), M.r[i], 3)), key = mirrorKey(mn);
      if (seen.has(key)) continue;
      seen.add(key);
      const n = V.cam(mn);
      let d;
      if (Math.abs(n[2]) < 1e-6) d = Math.abs((x - V.cx) * n[0] - (V.cy - y) * n[1]) / Math.hypot(n[0], n[1]);
      else d = Math.abs(Math.hypot(x - (V.cx + V.K * n[0] / n[2]), y - (V.cy - V.K * n[1] / n[2])) - V.K / Math.abs(n[2]));
      if (d < bd) { bd = d; best = key; }
    }
    return best;
  }

  /* ---------- rank three on the sphere: stereographic ---------- */
  // the sphere turned (R3), then projected to the plane from the point opposite the eye: the near
  // hemisphere inside the unit circle (radius K), the far one outside it
  function stereoView(w, h) {
    const K = Math.min(w, h) * 0.3 * (state.stereoZoom || 1), cx = w / 2, cy = h / 2, R = state.R3;
    return {
      w, h, K, cx, cy,
      cam: (v) => mv(R, v),
      at(u) { const k = 1 / (1 + u[2]); return [cx + K * u[0] * k, cy - K * u[1] * k]; },
      // the point of the sphere (in the camera's coordinates) under a point of the canvas
      back(x, y) { const a = (x - cx) / K, b = (cy - y) / K, s = a * a + b * b; return [2 * a / (1 + s), 2 * b / (1 + s), (1 - s) / (1 + s)]; },
    };
  }
  // the arc of the image of the great circle through the camera points A and B, from A to B the
  // way that passes the image of their middle, added to a path (a line where the circle is huge)
  function stereoArc(path, V, A, B) {
    const a = V.at(A), b = V.at(B);
    let n = cross(A, B);
    const l = Math.hypot(...n);
    if (l < 1e-12) { path.lineTo(b[0], b[1]); return; }
    n = n.map((x) => x / l);
    if (Math.abs(n[2]) < 1e-6) { path.lineTo(b[0], b[1]); return; }
    const gx = V.cx + V.K * n[0] / n[2], gy = V.cy - V.K * n[1] / n[2], R = V.K / Math.abs(n[2]);
    const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (chord * chord / (8 * R) < 0.15) { path.lineTo(b[0], b[1]); return; }
    const m = V.at(norm(A.map((x, i) => x + B[i])));
    const a0 = Math.atan2(a[1] - gy, a[0] - gx), wrap = (t) => t - TAU * Math.round(t / TAU);
    let d = wrap(Math.atan2(b[1] - gy, b[0] - gx) - a0);
    const dm = wrap(Math.atan2(m[1] - gy, m[0] - gx) - a0);
    if (!(dm * d > 0 && Math.abs(dm) < Math.abs(d))) d -= Math.sign(d || 1) * TAU;
    if (R < 4 * V.K) path.arc(gx, gy, R, a0, a0 + d, d < 0);
    else { const N = Math.max(2, Math.ceil(Math.abs(d) * Math.sqrt(R / 0.6))); for (let i = 1; i <= N; i++) { const t = a0 + d * i / N; path.lineTo(gx + R * Math.cos(t), gy + R * Math.sin(t)); } }
  }
  // the faces and edges of the sphere's complex (or its dual) for the stereographic picture: the
  // points as unit vectors of the model
  function sphereParts(c) {
    const dualOn = state.three.dual;
    if (c.parts && c.parts.dual === dualOn) return c.parts;
    let pos, faces, edges = [];
    if (!dualOn) {
      pos = (v) => Array.from(c.W.pos.subarray(3 * v, 3 * v + 3));
      faces = c.W.faces;
      for (let i = 0; i < c.W.edges.length; i += 3) edges.push([c.W.edges[i], c.W.edges[i + 1]]);
    } else {
      const D = c.D || (c.D = P.polar(c.W));
      pos = (v) => norm(D.pos[v]);
      faces = D.faces;
      const seen = new Set();
      D.faces.forEach((f) => f.v.forEach((a, i) => { const b = f.v[(i + 1) % f.v.length], k = Math.min(a, b) + ',' + Math.max(a, b); if (!seen.has(k)) { seen.add(k); edges.push([a, b]); } }));
    }
    return (c.parts = { dual: dualOn, pos, faces, edges });
  }
  function drawStereo() {
    const { ctx, w, h } = frameCanvas(), c = complex3(), V = stereoView(w, h), dualOn = state.three.dual, { pos, faces, edges } = sphereParts(c);
    const cam = new Map(), U = (v) => { let u = cam.get(v); if (!u) { u = V.cam(pos(v)); cam.set(v, u); } return u; };
    const near = (u) => u[2] > -0.985;   // away from the point at infinity
    // a point of the canvas taken far out along the ray from the middle through it
    const far = (q) => { const dx = q[0] - V.cx, dy = q[1] - V.cy, l = Math.hypot(dx, dy) || 1, k = 3 * (V.w + V.h) / l; return [V.cx + dx * k, V.cy + dy * k]; };
    const mid2 = (A, B) => norm(A.map((x, i) => x + B[i]));
    // whether the arc from A to B passes near the point at infinity
    const nearPole = (A, B) => { for (let t = 1; t < 8; t++) { const u = norm(A.map((x, i) => x + (B[i] - x) * t / 8)); if (u[2] < -0.97) return true; } return false; };
    // the arc from A to B as a polyline of its points, cut where it passes the point at infinity
    function sampled(path, A, B) {
      let prev = null;
      for (let t = 0; t <= 64; t++) {
        const u = norm(A.map((x, i) => x + (B[i] - x) * t / 64));
        if (u[2] < -0.999) { prev = null; continue; }
        const q = V.at(u);
        if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) > 4 * (V.w + V.h)) prev = null;
        if (prev) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]);
        prev = q;
      }
    }
    // the faces: a face round the point at infinity is everything outside its outline; one with a
    // vertex there runs out to infinity along the two edges at it (rays from the middle)
    if (state.colours) {
      for (const f of faces) {
        const us = f.v.map(U), n = us.length, md = norm(us.reduce((t, u) => t.map((x, i) => x + u[i]), [0, 0, 0]));
        const inside = (() => { for (let i = 0; i < n; i++) { const a = us[i], b = us[(i + 1) % n], nn = cross(a, b); if (dot(nn, [0, 0, -1]) * dot(nn, md) <= 0) return false; } return true; })();
        const p = new Path2D();
        if (inside) p.rect(-10, -10, w + 20, h + 20);
        const i0 = us.findIndex(near);
        if (i0 < 0) continue;
        const a0 = V.at(us[i0]);
        p.moveTo(a0[0], a0[1]);
        for (let t = 1; t <= n; t++) {
          const i = (i0 + t) % n, pr = (i + n - 1) % n;
          if (near(us[i])) {
            if (near(us[pr])) { if (nearPole(us[pr], us[i])) { const q = V.at(us[i]); p.lineTo(q[0], q[1]); } else stereoArc(p, V, us[pr], us[i]); }
            else { const q = V.at(us[i]); p.lineTo(q[0], q[1]); }
          } else {
            const fp = far(V.at(us[pr])), fn = far(V.at(us[(i + 1) % n]));
            p.lineTo(fp[0], fp[1]); p.lineTo(fn[0], fn[1]);
          }
        }
        ctx.fillStyle = MM.color(fill(dualOn ? -1 : f.k));
        ctx.fill(p, 'evenodd');
      }
    }
    // the mirrors: great circles, whole
    if (state.mirrors && !c.snubbed) drawStereoMirrors(ctx, V, c);
    // the equator of the view: the near hemisphere's rim
    ctx.strokeStyle = MM.color('ink-3');
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(V.cx, V.cy, V.K, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // the edges (an edge to the point at infinity: a ray out from its other end)
    const edgeTo = (path, A, B) => {
      const nA = near(A), nB = near(B);
      if (!nA && !nB) return;
      if (!nA || !nB) { const q = V.at(nA ? A : B), fq = far(q); path.moveTo(q[0], q[1]); path.lineTo(fq[0], fq[1]); return; }
      if (!near(mid2(A, B)) || nearPole(A, B)) { sampled(path, A, B); return; }
      const p0 = V.at(A);
      path.moveTo(p0[0], p0[1]);
      stereoArc(path, V, A, B);
    };
    const path = new Path2D();
    for (const [a, b] of edges) edgeTo(path, U(a), U(b));
    ctx.strokeStyle = MM.color('edge');
    ctx.lineWidth = 1.6 * thin();
    ctx.stroke(path);
    const pet = state.petrie ? petrie3(c) : null;
    if (pet) {
      const pp = new Path2D();
      pet.pts.forEach((A, i) => edgeTo(pp, V.cam(norm(A)), V.cam(norm(pet.pts[(i + 1) % pet.h]))));
      ctx.strokeStyle = MM.color('highlight');
      ctx.lineWidth = 2.4 * thin();
      ctx.stroke(pp);
    }
    if (dualOn && state.colours) {
      const D = c.D;
      D.pos.forEach((p, i) => { const u = V.cam(norm(p)); if (!near(u)) return; const q = V.at(u); if (q[0] < -4 || q[0] > w + 4 || q[1] < -4 || q[1] > h + 4) return; ctx.fillStyle = MM.color(FACE[D.kinds[i]]); ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, TAU); ctx.fill(); });
    }
    handle.hidden = true;
  }
  // The face of the sphere's complex under a point of the canvas (in the stereographic picture, or
  // a near face of the solid), as the direction of its middle in the model; null if none.
  function faceAt(x, y) {
    const c = complex3(), w = stage.clientWidth, h = stage.clientHeight, inPoly = (pts) => {
      let inn = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inn = !inn; }
      return inn;
    };
    if (state.view3 === 'stereo') {
      const V = stereoView(w, h), { pos, faces } = sphereParts(c);
      let best = null;
      for (const f of faces) {
        const us = f.v.map((v) => V.cam(pos(v)));
        if (us.some((u) => u[2] < -0.9)) continue;
        // the outline through points along its arcs
        const pts = [];
        us.forEach((u, i) => { const b = us[(i + 1) % us.length]; for (let t = 0; t < 6; t++) pts.push(V.at(norm(u.map((q, k) => q + (b[k] - q) * t / 6)))); });
        if (inPoly(pts)) { best = norm(f.v.map(pos).reduce((t, p) => t.map((q, k) => q + p[k]), [0, 0, 0])); break; }
      }
      return best;
    }
    const sh = solidShape(c), C = cam3, eye = mv(tr(C.R), [0, 0, C.D]);
    for (const f of sh.faces) {
      if (dot(f.n, eye.map((e, i) => e - f.c[i])) <= 0) continue;
      if (inPoly(f.pts.map((p) => onScreen(C, p)))) return norm(f.c);
    }
    return null;
  }
  // The axis a solid stands on, as most pictures show it: the axis of its group's turn of highest
  // order (the corner of C with the smallest angle; the vertex's corner where two tie), so that a
  // vertex of the tetrahedron, octahedron and icosahedron points up, the cube and the dodecahedron
  // and the prisms lie on a face, and the view stays as x moves; but a 3-fold axis for the
  // rhombic duals, so that a vertex where three faces meet points up. As the rows of a turn taking
  // that axis upright (y) and the normal of wall 0 towards the eye.
  function upFrame(M, ms3, dual, rings) {
    const m = [ms3[1], ms3[2], ms3[0]];      // the bonds at corners 0, 1, 2: q, r, p
    let k = m.indexOf(Math.max(...m.map((x) => (x === INF ? 0 : x))));
    if (dual && rings.join('') === '010' && m.includes(3) && Math.max(...m) > 3) k = m.indexOf(3);
    if (k < 0) k = 0;
    const u = M.corners[k], r0 = M.r[0], d = dot(r0, u);
    let f = r0.map((x, i) => x - d * u[i]);
    if (Math.hypot(...f) < 1e-6) { const r1 = M.r[1], d1 = dot(r1, u); f = r1.map((x, i) => x - d1 * u[i]); }
    f = norm(f);
    return [cross(u, f), u.slice(), f];
  }
  function upNow() {
    const c = complex3();
    if (c.special || c.kind !== 'sphere') return I(3);
    const s = state.three, slicing = state.view3 === 'sections', pet = state.petrie && !slicing ? petrie3(c) : null, kind = pet ? 'p' : slicing ? 's' + s.from : '', key = s.dual + '|' + kind + (state.upFlip ? '|f' : '');
    if (c.up && c.upKey === key) return c.up;
    c.upKey = key;
    c.upKind = kind;
    // (the Petrie polygon's axis and the sections' stand either way up: see followUp)
    const U = pet ? pet.up : slicing ? sliceFrame(c.M, s.from) : null;
    return (c.up = U ? (state.upFlip ? flipFrame(U) : U) : upFrame(c.M, [s.p, s.q, s.r], s.dual, c.on.map((o) => +!o)));
  }
  // a frame turned upside down (a half-turn about the axis towards the eye)
  const flipFrame = (U) => [U[0].map((v) => -v), U[1].map((v) => -v), U[2].slice()];
  // The solid as its sections show it: upright along u, from the corner j of C through the centre
  // (the first section at the bottom and the planes rising with t; or, turned over, the other way)
  function sliceFrame(M, j) {
    const u = norm(M.corners[j].map((v) => -v));
    let f = [0, 0, 0];
    for (const v of [M.r[j], M.corners[(j + 1) % 3], [1, 0, 0], [0, 1, 0]]) { const d = dot(v, u); f = v.map((x, i) => x - d * u[i]); if (Math.hypot(...f) > 1e-6) break; }
    f = norm(f);
    return [cross(u, f), u, f];
  }
  // The solid's turn: about the upright axis by a, tipped by b (never past looking straight down
  // or up); its matrix; and the turn nearest a matrix (from the stereographic picture, or a link).
  const turnR3 = () => mm(mm(rotX(state.turn.ph), rotY(state.turn.th)), upNow());
  function turnBy(a, b) { const t = state.turn; t.th += a; t.ph = clamp(t.ph + b, -1.55, 1.55); state.R3 = turnR3(); }
  function turnOf(R, up) {
    const Rb = mm(R, tr(up)), ph = clamp(Math.atan2(Rb[2][1], Rb[1][1]), -1.55, 1.55), m = mm(rotX(-ph), Rb);
    return { th: Math.atan2(m[0][2], m[0][0]), ph };
  }
  function turnFrom(R) { state.turn = turnOf(R, upNow()); state.R3 = turnR3(); }
  // Rank four on a turntable too, upright along the middle cell's axis of highest order (by the
  // group, so that the view stays as x moves): through a face of a cube or dodecahedron, a vertex
  // of a tetrahedron, octahedron or icosahedron. The picture starts with corner 3 of C (the
  // middle of a cell) in its middle, where the projections all keep directions: the axis is the
  // way from there to corner 0 (a vertex) or corner 2 (the middle of a face).
  function upFrame4() {
    const f = state.four;
    if (f.special) return I(3);
    const g = group4(f.ms);
    if (g.up) return g.up;
    const M = g.M, k = f.ms[0] > f.ms[1] ? 2 : 0, R0 = startRot(f.ms), at = (v) => mv(R0, v).slice(0, 3);
    const u = norm(at(M.corners[k]));
    let fr = [0, 0, 0];
    for (const r of [M.r[0], M.r[1], M.r[2]]) { const v = at(r), d = dot(v, u); fr = v.map((x, i) => x - d * u[i]); if (Math.hypot(...fr) > 1e-6) break; }
    fr = norm(fr);
    return (g.up = [cross(u, fr), u, fr]);
  }
  const turnR3_4 = () => mm(mm(rotX(state.four.turn.ph), rotY(state.four.turn.th)), upFrame4());
  function turnBy4(a, b) { const t = state.four.turn; t.th += a; t.ph = clamp(t.ph + b, -1.55, 1.55); state.four.R3 = turnR3_4(); }
  // the sphere turned so that the direction u of the model faces the eye (the middle of the
  // stereographic picture), in steps; the solid by its turntable
  function centreSphere(u) {
    if (state.view3 === 'solid') {
      const ub = mv(upNow(), u), t0 = Object.assign({}, state.turn), th1 = Math.atan2(-ub[0], ub[2]), ph1 = Math.atan2(ub[1], Math.hypot(ub[0], ub[2]));
      let dth = th1 - t0.th;
      dth -= TAU * Math.round(dth / TAU);
      const far = Math.hypot(dth, ph1 - t0.ph);
      if (far < 1e-3) return;
      flight = { step: (e) => { state.turn = { th: t0.th + e * dth, ph: t0.ph + e * (ph1 - t0.ph) }; state.R3 = turnR3(); }, t0: performance.now(), dur: MM.reduceMotion() ? 0 : 450 + 350 * far };
      tick();
      return;
    }
    const R0 = state.R3, a = norm(mv(R0, u)), z = [0, 0, 1], ax = cross(a, z), l = Math.hypot(...ax), th = Math.atan2(l, dot(a, z));
    if (th < 1e-3) return;
    const n = l > 1e-9 ? ax.map((v) => v / l) : [1, 0, 0];
    const rot = (t) => { const C = Math.cos(t), S = Math.sin(t), k = 1 - C; return [[C + n[0] * n[0] * k, n[0] * n[1] * k - n[2] * S, n[0] * n[2] * k + n[1] * S], [n[1] * n[0] * k + n[2] * S, C + n[1] * n[1] * k, n[1] * n[2] * k - n[0] * S], [n[2] * n[0] * k - n[1] * S, n[2] * n[1] * k + n[0] * S, C + n[2] * n[2] * k]]; };
    flight = { step: (e) => { state.R3 = ortho(mm(rot(e * th), R0)); }, t0: performance.now(), dur: MM.reduceMotion() ? 0 : 450 + 350 * th };
    tick();
  }
  function drawStereoMirrors(ctx, V, c) {
    const T = c.g.T, M = c.g.M, seen = new Set(), all = new Path2D(), picked = new Path2D(), hi = mirrorHi(c);
    for (let e = 0; e < T.N; e++) for (let i = 0; i < 3; i++) {
      // the mirror of wall i of gC: the great circle orthogonal to G r_i
      const mn = norm(P.apply(T.mat(e), M.r[i], 3)), key = mirrorKey(mn), nrm = norm(V.cam(mn));
      if (seen.has(key)) continue;
      seen.add(key);
      const path = key === hi ? picked : all;
      if (Math.abs(nrm[2]) < 1e-6) {
        const L = 2 * (V.w + V.h), dx = -nrm[1], dy = -nrm[0];
        path.moveTo(V.cx - L * dx, V.cy - L * dy); path.lineTo(V.cx + L * dx, V.cy + L * dy);
        continue;
      }
      const gx = V.cx + V.K * nrm[0] / nrm[2], gy = V.cy - V.K * nrm[1] / nrm[2], R = V.K / Math.abs(nrm[2]);
      if (R < 4 * V.K) { path.moveTo(gx + R, gy); path.arc(gx, gy, R, 0, TAU); continue; }
      // a large circle (nearly straight across the picture): the part of it near the picture, as a
      // polyline (canvases draw large circles pixels off)
      const ac = Math.atan2(V.cy - gy, V.cx - gx), span = Math.min(Math.PI, 1.5 * (V.w + V.h) / R), m = 96;
      for (let t = 0; t <= m; t++) { const a = ac - span + 2 * span * t / m, x = gx + R * Math.cos(a), y = gy + R * Math.sin(a); if (t) path.lineTo(x, y); else path.moveTo(x, y); }
    }
    ctx.strokeStyle = MM.rgba('wall', 0.42);
    ctx.lineWidth = 0.8;
    ctx.stroke(all);
    if (hi) { ctx.strokeStyle = MM.color('highlight'); ctx.lineWidth = 1.8; ctx.stroke(picked); }
  }

  /* ---------- rank three: the planes ---------- */
  // the Poincaré disc: a point of the sheet, or at infinity on the cone, to the unit disc
  const toDisc = (v) => { const q = Math.sqrt(Math.max(0, v[2] * v[2] - v[0] * v[0] - v[1] * v[1])), k = 1 / (v[2] + q); return [v[0] * k, v[1] * k]; };
  const lift = (p) => { const q = p[0] * p[0] + p[1] * p[1]; return [2 * p[0] / (1 - q), 2 * p[1] / (1 - q), (1 + q) / (1 - q)]; };
  // The geodesic through two points of the sheet (or at infinity): the circle orthogonal to the
  // rim with its centre at the pole of the line (or, very nearly straight, a line).
  function geodesic(U, V) {
    const c = cross(U, V), m = [c[0], c[1], -c[2]], l = Math.hypot(m[0], m[1]);
    if (l < 1e-14 || Math.abs(m[2]) < 1e-9 * l) return null;
    const k = l / Math.abs(m[2]);
    return { x: m[0] / m[2], y: m[1] / m[2], r: Math.sqrt(Math.max(0, k * k - 1)) };
  }
  // the plane's view: the points of the model to the canvas
  function planeView(w, h) {
    if (state.kind === 'hyperbolic') {
      const K = Math.min(w, h) / 2 - 6, cxp = w / 2, cyp = h / 2, L = state.L;
      return {
        w, h, K, cx: cxp, cy: cyp, disc: true,
        to(v) {
          const x = L[0][0] * v[0] + L[0][1] * v[1] + L[0][2] * v[2], y = L[1][0] * v[0] + L[1][1] * v[1] + L[1][2] * v[2], z = L[2][0] * v[0] + L[2][1] * v[1] + L[2][2] * v[2];
          const q = Math.sqrt(Math.max(0, z * z - x * x - y * y)), d = 1 / (z + q);
          return [cxp + K * x * d, cyp - K * y * d];
        },
        from(x, y) { let a = (x - cxp) / K, b = (cyp - y) / K; const r = Math.hypot(a, b); if (r > 0.985) { a *= 0.985 / r; b *= 0.985 / r; } return mv(linv(L), lift([a, b])); },
      };
    }
    const V = state.V || (state.V = baseView(w, h));
    return {
      w, h, disc: false,
      to: (v) => [V[0][0] * v[0] / v[2] + V[0][1] * v[1] / v[2] + V[0][2], V[1][0] * v[0] / v[2] + V[1][1] * v[1] / v[2] + V[1][2]],
      from(x, y) {
        const det = V[0][0] * V[1][1] - V[0][1] * V[1][0], X = x - V[0][2], Y = y - V[1][2];
        return [(V[1][1] * X - V[0][1] * Y) / det, (V[0][0] * Y - V[1][0] * X) / det, 1];
      },
    };
  }
  function baseView(w, h) { const s = Math.min(w, h) / 2 / state.span; return [[s, 0, w / 2], [0, -s, h / 2], [0, 0, 1]]; }

  // The tiling's faces, edges and mirrors on the canvas.
  function drawPlane() {
    const { ctx, w, h } = frameCanvas(), c = complex3(), W = c.W, V = planeView(w, h), disc = V.disc, dualOn = state.three.dual;
    const src = dualOn ? dualOf2(c) : { all: W.pos, polys: W.faces, edges: W.edges };
    const pos = src.all, nP = pos.length / 3, scr = new Float64Array(2 * nP), done = new Uint8Array(nP), lv = disc ? new Float64Array(3 * nP) : null, L = state.L;
    // a point on the canvas (and in the disc, moved by the view, for its geodesics), worked out once
    const at = (v) => {
      if (done[v]) return v;
      const x = pos[3 * v], y = pos[3 * v + 1], z = pos[3 * v + 2];
      if (disc) {
        const a = L[0][0] * x + L[0][1] * y + L[0][2] * z, b = L[1][0] * x + L[1][1] * y + L[1][2] * z, t = L[2][0] * x + L[2][1] * y + L[2][2] * z;
        lv[3 * v] = a; lv[3 * v + 1] = b; lv[3 * v + 2] = t;
        const q = t * t - a * a - b * b, k = 1 / (t + Math.sqrt(q > 0 ? q : 0));
        scr[2 * v] = V.cx + V.K * a * k; scr[2 * v + 1] = V.cy - V.K * b * k;
      } else { const q = V.to([x, y, z]); scr[2 * v] = q[0]; scr[2 * v + 1] = q[1]; }
      done[v] = 1;
      return v;
    };
    ctx.save();
    if (disc) { ctx.beginPath(); ctx.arc(V.cx, V.cy, V.K, 0, TAU); ctx.clip(); }
    // an edge from vertex a to b (on the canvas a polyline or an arc of its geodesic), added to a path
    function edgeTo(path, a, b) {
      const ax = scr[2 * a], ay = scr[2 * a + 1], bx = scr[2 * b], by = scr[2 * b + 1];
      if (!disc) { path.lineTo(bx, by); return; }
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      if (L2 < 9) { path.lineTo(bx, by); return; }
      const u0 = lv[3 * a], u1 = lv[3 * a + 1], u2 = lv[3 * a + 2], v0 = lv[3 * b], v1 = lv[3 * b + 1], v2 = lv[3 * b + 2];
      const m0 = u1 * v2 - u2 * v1, m1 = u2 * v0 - u0 * v2, m2 = -(u0 * v1 - u1 * v0), l = Math.hypot(m0, m1);
      if (l < 1e-14 || Math.abs(m2) < 1e-9 * l) { path.lineTo(bx, by); return; }
      const kk = l / Math.abs(m2), gx = V.cx + V.K * m0 / m2, gy = V.cy - V.K * m1 / m2, R = V.K * Math.sqrt(Math.max(0, kk * kk - 1));
      if (L2 / (8 * R) < 0.15) { path.lineTo(bx, by); return; } // the sagitta: less than a sixth of a pixel
      const a0 = Math.atan2(ay - gy, ax - gx);
      let d = Math.atan2(by - gy, bx - gx) - a0;
      d -= TAU * Math.round(d / TAU);
      if (R < 4 * V.K) { path.arc(gx, gy, R, a0, a0 + d, d < 0); return; }
      const n = Math.max(2, Math.ceil(Math.abs(d) * Math.sqrt(R / 0.8)));
      for (let i = 1; i <= n; i++) { const t = a0 + d * i / n; path.lineTo(gx + R * Math.cos(t), gy + R * Math.sin(t)); }
    }
    const inView = (x0, x1, y0, y1) => x1 >= -2 && x0 <= w + 2 && y1 >= -2 && y0 <= h + 2;
    // the faces, by colour (in the disc over a ground of their mean colour, which the faces too
    // small to draw would show near the rim)
    if (state.colours) {
      if (disc) { ctx.fillStyle = meanColour(c); ctx.fillRect(0, 0, w, h); }
      const fills = new Map();
      for (const f of src.polys) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const v of f.v) { at(v); const x = scr[2 * v], y = scr[2 * v + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (!inView(x0, x1, y0, y1) || (x1 - x0 < 1.2 && y1 - y0 < 1.2 && !f.open)) continue;
        const key = f.k;
        if (!fills.has(key)) fills.set(key, new Path2D());
        const path = fills.get(key);
        // (no closePath: fill closes each piece, and closePath is slow on a path of thousands)
        path.moveTo(scr[2 * f.v[0]], scr[2 * f.v[0] + 1]);
        const n = f.v.length;
        for (let i = 0; i < (f.open ? n - 1 : n); i++) edgeTo(path, f.v[i], f.v[(i + 1) % n]);
        // an apeirogon: closed through its middle at infinity
        if (f.open) { const m = V.to(f.centre || (f.centre = openCentre(c, f))); path.lineTo(m[0], m[1]); }
      }
      for (const [k, path] of fills) { ctx.fillStyle = MM.color(fill(k)); ctx.fill(path); }
    }
    // the mirrors, under the edges
    if (state.mirrors && !c.snubbed && !c.special) drawWalls(ctx, c, V);
    // the edges: thinner towards the rim of the disc, as the hyperbolic plane shrinks there
    const edgeList = src.edges, buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < edgeList.length; i += 3) {
      const a = edgeList[i], b = edgeList[i + 1];
      at(a); at(b);
      const ax = scr[2 * a], ay = scr[2 * a + 1], bx = scr[2 * b], by = scr[2 * b + 1];
      if (!inView(Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by))) continue;
      let k = 0;
      if (disc) {
        const mx = ((ax + bx) / 2 - V.cx) / V.K, my = ((ay + by) / 2 - V.cy) / V.K, room = 1 - mx * mx - my * my;
        if (Math.abs(bx - ax) + Math.abs(by - ay) < 1.4) continue;
        k = room > 0.5 ? 0 : room > 0.25 ? 1 : room > 0.1 ? 2 : 3;
      }
      buckets[k].moveTo(ax, ay);
      edgeTo(buckets[k], a, b);
    }
    const kk = thin();
    buckets.forEach((path, k) => { ctx.strokeStyle = MM.rgba('edge', [1, 0.92, 0.8, 0.66][k]); ctx.lineWidth = [1.5, 1.2, 0.95, 0.7][k] * kk; ctx.stroke(path); });
    // the dual's vertices, in the colours of the faces they stand for
    if (dualOn && state.colours) {
      const D = dualOf2(c);
      D.pos.forEach((p, i) => {
        const q = V.to(p);
        if (q[0] < -4 || q[0] > w + 4 || q[1] < -4 || q[1] > h + 4) return;
        let r = 3.2;
        if (disc) { const dx = (q[0] - V.cx) / V.K, dy = (q[1] - V.cy) / V.K; r *= Math.min(1, 2 * (1 - dx * dx - dy * dy)); if (r < 0.6) return; }
        ctx.fillStyle = MM.color(FACE[D.kinds[i]] || 'edge');
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, TAU); ctx.fill();
      });
    }
    ctx.restore();
    if (disc) {
      ctx.strokeStyle = MM.color('ink-3');
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(V.cx, V.cy, V.K, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = MM.color('rule');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0.5, 0.5, w - 1, h - 1, 6); ctx.stroke();
    }
    handle.hidden = true;
  }
  // the middle of an apeirogon of the complex: the corner at infinity it lies round
  function openCentre(c, f) {
    if (f.k === -1) return Array.from(c.W.pos.subarray(3 * f.at, 3 * f.at + 3));
    return P.faceMiddle(c.W, f);
  }
  // The colour the faces of a hyperbolic tiling make on average: each kind's fill, weighted by
  // the part of the plane it covers. In Wythoff's construction a face of kind k covers, in each
  // chamber, the quadrilateral of the corner k, x and the feet of x on the two walls there.
  function meanColour(c) {
    if (c.mean) return c.mean;
    const M = c.M, weights = new Map();
    const add = (k, a) => { if (a > 0 && Number.isFinite(a)) weights.set(k, (weights.get(k) || 0) + a); };
    if (state.three.dual) add(-1, 1);
    else if (!c.snubbed && !c.special) {
      const x = c.x;
      for (let k = 0; k < 3; k++) {
        const [i, j] = [0, 1, 2].filter((t) => t !== k), foot = (t) => M.normalize(P.apply(M.S[t], x, 3).map((v, a) => (v + x[a]) / 2));
        add(k, hypArea([M.corners[k], foot(i), x, foot(j)]));
      }
    } else {
      // a snub: each kind by the faces of it near the middle
      for (const f of c.W.faces) {
        if (f.open) continue;
        const pts = f.v.map((v) => Array.from(c.W.pos.subarray(3 * v, 3 * v + 3)));
        if (pts.some((p) => p[2] > 4)) continue;
        add(f.k, hypArea(pts));
      }
    }
    let tot = 0, rgb = [0, 0, 0];
    for (const [k, a] of weights) {
      const m = MM.color(fill(k)).match(/[\d.]+/g).map(Number);
      for (let t = 0; t < 3; t++) rgb[t] += a * m[t];
      tot += a;
    }
    rgb = tot ? rgb.map((v) => Math.round(v / tot)) : [255, 255, 255];
    return (c.mean = 'rgb(' + rgb.join(',') + ')');
  }
  // the area of a geodesic polygon of the hyperbolic plane: (n − 2)π minus its angles (0 at a
  // point at infinity); repeated points are dropped
  function hypArea(pts) {
    const ps = [];
    for (const p of pts) if (!ps.length || -lor(p, ps[ps.length - 1]) > 1 + 1e-9) ps.push(p);
    if (ps.length > 2 && -lor(ps[0], ps[ps.length - 1]) <= 1 + 1e-9) ps.pop();
    const n = ps.length;
    if (n < 3) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const a = ps[i], b = ps[(i + n - 1) % n], c = ps[(i + 1) % n];
      if (Math.abs(lor(a, a)) < 1e-9 * a[2] * a[2]) continue; // at infinity: no angle
      const tb = b.map((x, t) => x + lor(a, b) * a[t]), tc = c.map((x, t) => x + lor(a, c) * a[t]);
      sum += Math.acos(clamp(lor(tb, tc) / Math.sqrt(lor(tb, tb) * lor(tc, tc)), -1, 1));
    }
    return (n - 2) * Math.PI - sum;
  }
  // the dual tiling (Laves), with its vertices after the complex's in one array, and its faces
  // and edges indexing that array
  function dualOf2(c) {
    if (c.D2) return c.D2;
    const W = c.W, D = P.laves(W), nV = W.V, all = new Float64Array(3 * (nV + D.pos.length)), seen = new Set(), edges = [];
    all.set(W.pos.subarray(0, 3 * nV));
    D.pos.forEach((p, i) => all.set(p, 3 * (nV + i)));
    D.faces.forEach((f) => {
      const n = f.v.length;
      for (let i = 0; i < (f.open ? n - 1 : n); i++) {
        const a = f.v[i], b = f.v[(i + 1) % n], key = Math.min(a, b) * 1e6 + Math.max(a, b);
        if (!seen.has(key)) { seen.add(key); edges.push(nV + a, nV + b, 0); }
      }
    });
    c.D2 = { pos: D.pos, kinds: D.kinds, all, polys: D.faces.map((f) => ({ v: f.v.map((i) => nV + i), k: -1, open: f.open, at: f.at })), edges };
    return c.D2;
  }
  // The walls: the sides of the chambers, thin and grey, fainter towards the rim of the disc.
  // The chambers' corners are found once for the group; each frame they are only moved by the
  // view. A wall less than a pixel long is left out, and one of a few pixels drawn straight (near
  // a corner at infinity there are thousands of them).
  function wallData(g) {
    if (g.walls) return g.walls;
    const T = g.T, M = g.M, N = T.N, pts = new Float64Array(9 * N), list = [];
    for (let e = 0; e < N; e++) {
      const G = T.mat(e);
      for (let k = 0; k < 3; k++) pts.set(M.normalize(P.apply(G, M.corners[k], 3)), 9 * e + 3 * k);
      for (let i = 0; i < 3; i++) if (T.right[e * 3 + i] < 0 || T.right[e * 3 + i] > e) list.push(9 * e + 3 * ((i + 1) % 3), 9 * e + 3 * ((i + 2) % 3));
    }
    return (g.walls = { pts, list: Int32Array.from(list) });
  }
  function drawWalls(ctx, c, V) {
    const { pts, list } = wallData(c.g), n = pts.length / 3, scr = new Float64Array(2 * n), lv = V.disc ? new Float64Array(pts.length) : null;
    const L = state.L, w = V.w, h = V.h;
    for (let p = 0, o = 0; p < n; p++, o += 3) {
      const x = pts[o], y = pts[o + 1], z = pts[o + 2];
      if (V.disc) {
        const a = L[0][0] * x + L[0][1] * y + L[0][2] * z, b = L[1][0] * x + L[1][1] * y + L[1][2] * z, t = L[2][0] * x + L[2][1] * y + L[2][2] * z;
        lv[o] = a; lv[o + 1] = b; lv[o + 2] = t;
        const q = t * t - a * a - b * b, k = 1 / (t + Math.sqrt(q > 0 ? q : 0));
        scr[2 * p] = V.cx + V.K * a * k; scr[2 * p + 1] = V.cy - V.K * b * k;
      } else { const q = V.to([x, y, z]); scr[2 * p] = q[0]; scr[2 * p + 1] = q[1]; }
    }
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let t = 0; t < list.length; t += 2) {
      const oa = list[t], ob = list[t + 1], pa = oa / 3, pb = ob / 3;
      const ax = scr[2 * pa], ay = scr[2 * pa + 1], bx = scr[2 * pb], by = scr[2 * pb + 1];
      if ((ax < 0 && bx < 0) || (ax > w && bx > w) || (ay < 0 && by < 0) || (ay > h && by > h)) continue;
      const len = Math.abs(bx - ax) + Math.abs(by - ay);
      if (len < 1) continue;
      let k = 0;
      if (V.disc) { const mx = ((ax + bx) / 2 - V.cx) / V.K, my = ((ay + by) / 2 - V.cy) / V.K, room = 1 - mx * mx - my * my; k = room > 0.5 ? 0 : room > 0.25 ? 1 : room > 0.1 ? 2 : 3; }
      const path = paths[k];
      path.moveTo(ax, ay);
      if (!V.disc || len < 8) { path.lineTo(bx, by); continue; }
      // the geodesic: the circle with its centre at the pole of the line through the two points
      const u0 = lv[oa], u1 = lv[oa + 1], u2 = lv[oa + 2], v0 = lv[ob], v1 = lv[ob + 1], v2 = lv[ob + 2];
      const m0 = u1 * v2 - u2 * v1, m1 = u2 * v0 - u0 * v2, m2 = -(u0 * v1 - u1 * v0), l = Math.hypot(m0, m1);
      if (l < 1e-14 || Math.abs(m2) < 1e-9 * l) { path.lineTo(bx, by); continue; }
      const kk = l / Math.abs(m2), gx = V.cx + V.K * m0 / m2, gy = V.cy - V.K * m1 / m2, R = V.K * Math.sqrt(Math.max(0, kk * kk - 1));
      if (len * len / (8 * R) < 0.25) { path.lineTo(bx, by); continue; }
      const a0 = Math.atan2(ay - gy, ax - gx);
      let d = Math.atan2(by - gy, bx - gx) - a0;
      d -= TAU * Math.round(d / TAU);
      if (R < 4 * V.K) { path.arc(gx, gy, R, a0, a0 + d, d < 0); continue; }
      const m = Math.max(2, Math.ceil(Math.abs(d) * Math.sqrt(R / 0.8)));
      for (let i = 1; i <= m; i++) { const th = a0 + d * i / m; path.lineTo(gx + R * Math.cos(th), gy + R * Math.sin(th)); }
    }
    ctx.lineWidth = 0.8;
    paths.forEach((path, k) => { ctx.strokeStyle = MM.rgba('wall', [0.42, 0.34, 0.24, 0.15][k]); ctx.stroke(path); });
  }

  /* ---------- Penrose ---------- */
  const PEN_LEVELS = 30; // the sun's edges are φ^30 times the finest tiles': as far as the picture can go
  function drawPenrose() {
    const { ctx, w, h } = frameCanvas();
    const pen = state.pen, s = Math.min(w, h) / 2 / pen.span;   // pixels per unit (the finest tiles' edge)
    // The level whose tiles' edges are TILE pixels long, as a real number λ (the sun is level 0):
    // the level below it is drawn, and the one above it comes in as λ grows (0 ≤ t < 1).
    const TILE = w < 500 ? 22 : 28, lam = Math.max(1, Math.min(PEN_LEVELS - 1e-6, PEN_LEVELS + Math.log(s / TILE) / Math.log(PHI)));
    const fine = Math.floor(lam) + 1, t = lam - Math.floor(lam);
    const box = [pen.c[0] - w / 2 / s - 1, pen.c[0] + w / 2 / s + 1, pen.c[1] - h / 2 / s - 1, pen.c[1] + h / 2 / s + 1];
    const kind = pen.tiles, top = PEN.sun(kind, Math.pow(PHI, PEN_LEVELS));
    const levels = PEN.cover(kind, top, box, fine);
    const at = (p) => [w / 2 + (p[0] - pen.c[0]) * s, h / 2 - (p[1] - pen.c[1]) * s];
    const fineT = levels[fine] || [], coarseT = levels[fine - 1] || [];
    const colours = [MM.color(kind === 'p3' ? 'tile-thin' : 'tile-kite'), MM.color(kind === 'p3' ? 'tile-thick' : 'tile-dart')];
    // fills: the coarser level's, and the finer level's over them as it comes in
    const fillT = (list, alpha) => {
      if (alpha <= 0.002 || !state.colours) return;
      ctx.globalAlpha = alpha;
      for (const k of [0, 1]) {
        const path = new Path2D();
        for (const tri of list) {
          if (tri[0] !== k) continue;
          const a = at(tri[1]), b = at(tri[2]), cc = at(tri[3]);
          path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]); path.lineTo(cc[0], cc[1]); path.lineTo(a[0], a[1]);
        }
        ctx.fillStyle = colours[k];
        ctx.fill(path);
        // (the two halves of a tile meet without a seam: the same colour drawn over the cut)
        ctx.strokeStyle = colours[k];
        ctx.lineWidth = 0.7;
        ctx.stroke(path);
      }
      ctx.globalAlpha = 1;
    };
    // edges: a tile's edges, not the cut between its halves (P3: apex–b and apex–c; P2: apex–b and b–c)
    const edges = (list, width, alpha, light) => {
      if (alpha <= 0.002) return;
      const path = new Path2D();
      for (const tri of list) {
        const a = at(tri[1]), b = at(tri[2]), cc = at(tri[3]);
        if (kind === 'p3') { path.moveTo(b[0], b[1]); path.lineTo(a[0], a[1]); path.lineTo(cc[0], cc[1]); }
        else { path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]); path.lineTo(cc[0], cc[1]); }
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = MM.rgba('edge', light || 1);
      ctx.lineWidth = width;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
    };
    // the finer level comes in over the last part of the step: the coarser tiles' edges cut
    // across the finer tiles, so the two are not shown together for long
    const u = smooth(0.7, 1, t);
    fillT(coarseT, 1);
    fillT(fineT, u);
    if (pen.larger) {
      // The tiles two and four levels up, in lighter, wider lines under the tiles' edges: they are
      // made of tiles and halves of tiles, so where one of their edges passes through a tile it
      // runs along its axis, and the tile still shows whole.
      ctx.lineCap = ctx.lineJoin = 'round';
      for (const [up, width, col] of [[4, 7, 'pen-larger-4'], [2, 3.6, 'pen-larger-2']]) {
        for (const [base, alpha] of [[fine - 1, 1 - u], [fine, u]]) {
          if (alpha <= 0.002 || base - up < 0) continue;
          const path = new Path2D();
          for (const tri of levels[base - up]) for (const [A, B] of PEN.sides(kind, tri)) { const a = at(A), b = at(B); path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]); }
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = MM.color(col);
          ctx.lineWidth = width;
          ctx.stroke(path);
          ctx.globalAlpha = 1;
        }
      }
    }
    const faint = pen.arcs ? 0.45 : 1;
    edges(coarseT, 1.1, 1 - u, faint);
    edges(fineT, 1.1, u, faint);
    if (pen.arcs) { drawArcs(ctx, kind, coarseT, at, s, 1 - u); drawArcs(ctx, kind, fineT, at, s, u); }
    ctx.strokeStyle = MM.color('rule');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(0.5, 0.5, w - 1, h - 1, 6); ctx.stroke();
    handle.hidden = true;
  }
  function drawArcs(ctx, kind, list, at, s, alpha) {
    if (alpha <= 0.002) return;
    ctx.globalAlpha = alpha;
    for (const colour of [0, 1]) {
      const path = new Path2D();
      for (const tri of list) {
        const [v, r] = PEN.ARCS[kind][tri[0]][colour], u = PEN.unit(kind, tri), Vt = tri.slice(1), c = Vt[v];
        const o = Vt.filter((_, i) => i !== v), R = r * u;
        const a0 = Math.atan2(-(o[0][1] - c[1]), o[0][0] - c[0]), a1 = Math.atan2(-(o[1][1] - c[1]), o[1][0] - c[0]);
        let d = a1 - a0;
        d -= TAU * Math.round(d / TAU);
        const C = at(c);
        path.moveTo(C[0] + R * s * Math.cos(a0), C[1] + R * s * Math.sin(a0));
        path.arc(C[0], C[1], R * s, a0, a0 + d, d < 0);
      }
      ctx.strokeStyle = MM.color(colour ? 'arc-2' : 'arc-1');
      ctx.lineWidth = 1.3;
      ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- rank four: in space ---------- */
  const D4 = 2; // the perspective's eye, at (0, 0, 0, D4)
  // the size of the picture in space
  function frameOf(X) {
    if (X.kind === 'hyperbolic') return 1.02;
    if (X.kind === 'plane') return 2 * X.adj;
    const f = state.four.proj;
    if (f === 'parallel') return 1.0;
    if (f === 'persp') return (D4 + 1) / (D4 - 1) * 0.92;
    return Math.tan(clamp(2.4 * X.adj, 0.9, 2.0) / 2);
  }
  // a viewed point of the space (the view applied) into space: [x, y, z], or null where it is far off
  function projector(X) {
    const kind = X.kind, f = state.four.proj;
    if (kind === 'plane') return (q) => [q[0], q[1], q[2]];
    if (kind === 'hyperbolic') return (q) => { const s = Math.sqrt(Math.max(0, q[3] * q[3] - q[0] * q[0] - q[1] * q[1] - q[2] * q[2])), k = 1 / (q[3] + s); return [q[0] * k, q[1] * k, q[2] * k]; };
    if (f === 'parallel') return (q) => [q[0], q[1], q[2]];
    if (f === 'persp') return (q) => { const k = (D4 + 1) / (D4 - q[3]); return [q[0] * k, q[1] * k, q[2] * k]; };
    return (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]), d = 1 - q[3] / l; if (d < 0.004) return null; const k = 1 / (l * d); return [q[0] * k, q[1] * k, q[2] * k]; };
  }
  // the view: a point of the model to its viewed place (4 coordinates)
  const viewOf = (X) => { const R = state.four.rot; return (p) => [0, 1, 2, 3].map((i) => R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2] + R[i][3] * p[3]); };
  // whether edges are curved in the picture: on the 3-sphere stereographically, and in the ball
  const curved = (X) => (X.kind === 'sphere' && state.four.proj === 'stereo') || X.kind === 'hyperbolic';
  // a point along the edge from the viewed points A to B (the great circle or the geodesic)
  function along(X, A, B, t) {
    const v = A.map((a, i) => a + t * (B[i] - a));
    if (X.kind === 'hyperbolic') return lnorm(v);
    return v;
  }
  // the cell nearest the middle of the picture
  function midCell(X, view) {
    let best = null, bv = -Infinity;
    for (const c of X.cells) { const v = closeness(X.kind, view(c.mid)); if (v > bv) { bv = v; best = c; } }
    return best;
  }
  function drawSpace() {
    const { ctx, w, h } = frameCanvas(), X = space4(), f = state.four, V = X.V, pos = X.pos, edges = X.edges;
    f.R3 = turnR3_4();
    const frame = frameOf(X), C = cam3 = camera(f.R3, frame, w, h), Rv = f.rot, view = viewOf(X);
    C.s *= f.zoom; // (the zoom: the 3D picture larger, seen from where it was)
    const [r0, r1, r2, r3] = Rv, cr = C.R, Dc = C.D, F = C.f * C.s, w2 = w / 2, h2 = h / 2, K2 = D4 + 1;
    // 0: as it is (parallel, the Euclidean honeycomb), 1: stereographic, 2: perspective, 3: the ball
    const mode = X.kind === 'plane' ? 0 : X.kind === 'hyperbolic' ? 3 : f.proj === 'stereo' ? 1 : f.proj === 'persp' ? 2 : 0;
    const CAP = 60 * frame; // (points near the point at infinity of the stereographic picture: this far out)
    // a viewed point to the canvas: out[o…o+3] = x, y, depth, distance from the middle in space; false at infinity
    function scr(x, y, z, t, out, o) {
      let k = 1;
      if (mode === 1) {
        const l = Math.sqrt(x * x + y * y + z * z + t * t), dd = 1 - t / l, r = Math.sqrt(x * x + y * y + z * z);
        if (dd < 1e-9 || r < 1e-12) return false;
        k = Math.min(1 / (l * dd), CAP / r);
      } else if (mode === 2) k = K2 / (D4 - t);
      else if (mode === 3) { const q = t * t - x * x - y * y - z * z; k = 1 / (t + Math.sqrt(q > 0 ? q : 0)); }
      const X3 = x * k, Y3 = y * k, Z3 = z * k;
      const cx = cr[0][0] * X3 + cr[0][1] * Y3 + cr[0][2] * Z3, cy = cr[1][0] * X3 + cr[1][1] * Y3 + cr[1][2] * Z3, cz = cr[2][0] * X3 + cr[2][1] * Y3 + cr[2][2] * Z3;
      const dd2 = Math.max(Dc - cz, 0.05 * Dc), kk = F / dd2;
      out[o] = w2 + cx * kk; out[o + 1] = h2 - cy * kk; out[o + 2] = dd2; out[o + 3] = Math.sqrt(X3 * X3 + Y3 * Y3 + Z3 * Z3);
      return true;
    }
    // each vertex viewed, and on the canvas (ok: 1 there, 2 at the point at infinity)
    const Q = new Float64Array(4 * V), Sx = new Float64Array(4 * V), ok = new Uint8Array(V);
    for (let v = 0, o = 0; v < V; v++, o += 4) {
      const x0 = pos[o], x1 = pos[o + 1], x2 = pos[o + 2], x3 = pos[o + 3];
      const a = r0[0] * x0 + r0[1] * x1 + r0[2] * x2 + r0[3] * x3, b = r1[0] * x0 + r1[1] * x1 + r1[2] * x2 + r1[3] * x3;
      const c = r2[0] * x0 + r2[1] * x1 + r2[2] * x2 + r2[3] * x3, e = r3[0] * x0 + r3[1] * x1 + r3[2] * x2 + r3[3] * x3;
      Q[o] = a; Q[o + 1] = b; Q[o + 2] = c; Q[o + 3] = e;
      ok[v] = scr(a, b, c, e, Sx, o) ? 1 : mode === 1 ? 2 : 0;
    }
    const bend = mode === 1 || mode === 3, tmp = new Float64Array(4);
    const at = (oa, ob, u) => scr(Q[oa] + u * (Q[ob] - Q[oa]), Q[oa + 1] + u * (Q[ob + 1] - Q[oa + 1]), Q[oa + 2] + u * (Q[ob + 2] - Q[oa + 2]), Q[oa + 3] + u * (Q[ob + 3] - Q[oa + 3]), tmp, 0);
    // how strongly a point shows: nearer the eye darker; far out (in the stereographic picture, the
    // Euclidean honeycomb, the ball) fading away
    const near = Dc - frame, radial = mode === 3 ? X.fade : X.kind === 'plane' ? [0.7 * frame, 1.25 * frame] : mode === 1 ? [1.15 * frame, 2.4 * frame] : null;
    const alpha = (depth, r) => (1 - 0.62 * clamp((depth - near) / (2 * frame), 0, 1)) * (radial ? 1 - smooth(radial[0], radial[1], r) : 1);
    // the points of the edge from a to b on the canvas, into pts (a polyline along it where it is
    // curved, finer where it is long; out to the edge of the picture towards a point at infinity)
    function edgePts(a, b, pts) {
      const oa = 4 * a, ob = 4 * b;
      if (ok[a] === 2 && ok[b] === 2) return;
      if (ok[a] === 2) { edgePts(b, a, pts); pts.reverse(); return; }
      pts.push([Sx[oa], Sx[oa + 1]]);
      const inf = ok[b] === 2, L = inf ? 1e4 : Math.hypot(Sx[ob] - Sx[oa], Sx[ob + 1] - Sx[oa + 1]);
      if (bend && L >= 3) {
        const n = inf ? 96 : Math.min(96, Math.ceil(L / 3));
        for (let t = 1; t < n; t++) {
          // (towards a point at infinity the steps shrink, as the picture grows there)
          const u = inf ? 1 - Math.pow(1 - t / n, 2) * 0.999 : t / n;
          if (!at(oa, ob, u)) break;
          pts.push([tmp[0], tmp[1]]);
        }
      }
      if (!inf) pts.push([Sx[ob], Sx[ob + 1]]);
    }
    const addPts = (path, pts) => { if (pts.length < 2) return; path.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]); };
    // the cell in the middle: the region its faces enclose on the canvas, light blue; the lines
    // behind it are drawn first and veiled by it, the ones in front over it
    const mid = midCell(X, view), midEdges = new Set(mid ? X.cellEdges(mid) : []);
    let cellDepth = Infinity;
    if (mid) { const q = view(mid.mid); if (scr(q[0], q[1], q[2], q[3], tmp, 0)) cellDepth = tmp[2]; }
    const LEVELS = [1, 0.74, 0.5, 0.3, 0.14], back = LEVELS.map(() => new Path2D()), front = LEVELS.map(() => new Path2D()), midPath = new Path2D();
    for (let i = 0, e = 0; i < edges.length; i += 3, e++) {
      const a = edges[i], b = edges[i + 1];
      if (!ok[a] || !ok[b] || (ok[a] === 2 && ok[b] === 2)) continue;
      const oa = 4 * a, ob = 4 * b, inf = ok[a] === 2 || ok[b] === 2;
      if (!inf) {
        const ax = Sx[oa], ay = Sx[oa + 1], bx = Sx[ob], by = Sx[ob + 1];
        if ((ax < -20 && bx < -20) || (ax > w + 20 && bx > w + 20) || (ay < -20 && by < -20) || (ay > h + 20 && by > h + 20)) continue;
        if (Math.hypot(bx - ax, by - ay) < 0.6) continue;
      }
      const pts = [];
      if (midEdges.has(e)) { edgePts(a, b, pts); addPts(midPath, pts); continue; }
      if (inf) { const o = ok[a] === 1 ? oa : ob; tmp[0] = Sx[o]; tmp[2] = Sx[o + 2]; tmp[3] = Sx[o + 3]; }
      else if (!at(oa, ob, 0.5)) continue;
      const al = alpha(tmp[2], tmp[3]), behind = tmp[2] > cellDepth;
      if (al < 0.07) continue;
      let k = 0;
      while (k < LEVELS.length - 1 && al < (LEVELS[k] + LEVELS[k + 1]) / 2) k++;
      edgePts(a, b, pts);
      addPts((behind ? back : front)[k], pts);
    }
    const kw = thin();
    const strokes = (paths) => {
      // (round joins on thousands of short pieces are slow to draw, and do not show at this width)
      ctx.lineJoin = 'bevel';
      ctx.lineCap = 'butt';
      LEVELS.forEach((al, i) => { ctx.strokeStyle = MM.rgba('edge', al); ctx.lineWidth = [1.5, 1.3, 1.1, 0.95, 0.85][i] * kw; ctx.stroke(paths[i]); });
      ctx.lineJoin = ctx.lineCap = 'round';
    };
    strokes(back);
    if (mid) {
      // Each face of the cell cut into small triangles from its middle, their corners placed as the
      // face's points are (on the 3-sphere or the hyperboloid where the picture is curved, so that
      // the faces are the pieces of spheres the edges bound), all filled together: their union is
      // the cell's outline, edges and the rims of its faces' spheres.
      const region = new Path2D(), pt = new Float64Array(4);
      const tri = (a, b, c) => {
        const cr2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(cr2) < 1e-9) return;
        const [p, q] = cr2 > 0 ? [b, c] : [c, b];
        region.moveTo(a[0], a[1]); region.lineTo(p[0], p[1]); region.lineTo(q[0], q[1]); // (fill closes it: closePath is slow on thousands)
      };
      for (const face of X.cellFaces(mid)) {
        const n = face.length, o = face.map((v) => 4 * v);
        if (face.some((v) => ok[v] !== 1)) continue;
        const m = [0, 1, 2, 3].map((k) => o.reduce((t, oo) => t + Q[oo + k], 0) / n);
        let N = 1;
        if (bend) {
          // (fine enough for the face's image, which bulges past its corners: a large face's
          // rim, where it curves away, smooth rather than a polygon)
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          const box = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
          for (const oo of o) box(Sx[oo], Sx[oo + 1]);
          if (scr(m[0], m[1], m[2], m[3], tmp, 0)) box(tmp[0], tmp[1]);
          for (let i = 0; i < n; i++) { const A = o[i], B = o[(i + 1) % n]; if (scr((Q[A] + Q[B]) / 2, (Q[A + 1] + Q[B + 1]) / 2, (Q[A + 2] + Q[B + 2]) / 2, (Q[A + 3] + Q[B + 3]) / 2, tmp, 0)) box(tmp[0], tmp[1]); }
          N = clamp(Math.ceil(Math.max(x1 - x0, y1 - y0) / 9), 3, 40);
        }
        for (let i = 0; i < n; i++) {
          const A = o[i], B = o[(i + 1) % n], grid = [];
          for (let r = 0; r <= N; r++) {
            const row = [];
            for (let t = 0; t <= N - r; t++) {
              const u = r / N, v = t / N;
              for (let k = 0; k < 4; k++) pt[k] = m[k] + u * (Q[A + k] - m[k]) + v * (Q[B + k] - m[k]);
              row.push(scr(pt[0], pt[1], pt[2], pt[3], tmp, 0) ? [tmp[0], tmp[1]] : null);
            }
            grid.push(row);
          }
          for (let r = 0; r < N; r++) for (let t = 0; t < N - r; t++) {
            const g00 = grid[r][t], g10 = grid[r + 1][t], g01 = grid[r][t + 1];
            if (g00 && g10 && g01) tri(g00, g10, g01);
            if (r + t + 1 < N) { const g11 = grid[r + 1][t + 1]; if (g10 && g11 && g01) tri(g10, g11, g01); }
          }
        }
      }
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = MM.color('cell-mid');
      ctx.fill(region, 'nonzero');
      ctx.globalAlpha = 1;
    }
    strokes(front);
    ctx.strokeStyle = MM.color('edge');
    ctx.lineWidth = 1.9 * kw;
    ctx.stroke(midPath);
    const pet = state.petrie ? petrie4(X) : null;
    if (pet) {
      const pp = new Path2D();
      for (let i = 0; i < pet.h; i++) { const a = pet.idx[i], b = pet.idx[(i + 1) % pet.h], pts = []; if (!ok[a] || !ok[b]) continue; edgePts(a, b, pts); addPts(pp, pts); }
      ctx.strokeStyle = MM.color('highlight');
      ctx.lineWidth = 2.4 * kw;
      ctx.stroke(pp);
    }
    // the ball's rim
    if (X.kind === 'hyperbolic') {
      const R = F / Math.sqrt(Dc * Dc - 1);
      ctx.strokeStyle = MM.color('ink-3');
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(w2, h2, R, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    placeHandle4(X, C, view, projector(X));
  }
  // the convex hull of points of the canvas (Andrew's monotone chain)
  function convexHull(pts) {
    if (pts.length < 3) return pts;
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) { while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }
  // The handle: the point of the space in the middle of the picture, and while it is held, the
  // point m taken there, which the drag pulls along (let go, the handle goes back to the middle).
  const ORIGIN4 = { sphere: [0, 0, 0, -1], plane: [0, 0, 0, 1], hyperbolic: [0, 0, 0, 1] };
  function inverseView(X) {
    const R = state.four.rot;
    return X.kind === 'sphere' ? tr(R) : X.kind === 'plane' ? invAffine4(R) : linv(R);
  }
  function placeHandle4(X, C, view, proj) {
    const f = state.four;
    if (!dragging || !f.m) f.m = mv(inverseView(X), ORIGIN4[X.kind]);
    const s = proj(view(f.m)) || [0, 0, 0], sp = onScreen(C, s);
    showHandle(sp[0], sp[1]);
  }
  function showHandle(x, y) {
    handle.hidden = false;
    handle.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }
  // The space pulled along with the handle to the point (x, y) of the canvas: the point of space
  // there (in the plane through the handle facing the eye), back in the model's space, and the
  // motion that takes m there: a rotation of R⁴, a translation, a hyperbolic translation.
  function pull(x, y) {
    const f = state.four, X = space4(), C = cam3, view = viewOf(X), proj = projector(X), a = view(f.m), ph = proj(a) || [0, 0, 0];
    const r = ray(C, x, y), n = mv(tr(C.R), [0, 0, 1]), t0 = dot(ph.map((v, i) => v - r.o[i]), n) / dot(r.d, n);
    let t = r.o.map((o, i) => o + t0 * r.d[i]);
    const frame = frameOf(X), lt = Math.hypot(...t), cap = (lim) => { if (lt > lim) t = t.map((v) => v * lim / lt); };
    let b;
    if (X.kind === 'plane') {
      cap(0.8 * frame);
      const T = [[1, 0, 0, t[0] - a[0]], [0, 1, 0, t[1] - a[1]], [0, 0, 1, t[2] - a[2]], [0, 0, 0, 1]];
      f.rot = fixAffine(mm(T, f.rot));
      return;
    }
    if (X.kind === 'hyperbolic') {
      cap(0.9);
      b = lift3(t);
      f.rot = fixL(mm(translation(a, b), f.rot));
      return;
    }
    if (f.proj === 'stereo') { cap(0.75 * frame); const s2 = dot(t, t); b = [2 * t[0] / (s2 + 1), 2 * t[1] / (s2 + 1), 2 * t[2] / (s2 + 1), (s2 - 1) / (s2 + 1)]; }
    else if (f.proj === 'parallel') { cap(0.97); const ww = Math.sqrt(Math.max(0, 1 - dot(t, t))); b = [t[0], t[1], t[2], a[3] > 0 ? ww : -ww]; }
    else {
      const k = D4 + 1;
      let s = dot(t, t) / (k * k);
      const smax = 0.97 / (D4 * D4 - 1);
      if (s > smax) { t = t.map((v) => v * Math.sqrt(smax / s)); s = smax; }
      const ww = (s * D4 - Math.sqrt(Math.max(0, 1 + s * (1 - D4 * D4)))) / (s + 1), m = (D4 - ww) / k;
      b = [t[0] * m, t[1] * m, t[2] * m, ww];
    }
    b = norm(b);
    const an = norm(a);
    f.rot = ortho(mm(turn4(an, b, Math.acos(clamp(dot(an, b), -1, 1))), f.rot));
  }
  const lift3 = (p) => { const q = dot(p, p); return [2 * p[0] / (1 - q), 2 * p[1] / (1 - q), 2 * p[2] / (1 - q), (1 + q) / (1 - q)]; };
  // the view's middle brought back near C by an element of the group (the picture is the same):
  // the Euclidean and hyperbolic honeycombs, whose part drawn is near C
  function recentre4() {
    const X = space4();
    if (X.kind === 'sphere' || !X.g) return;
    const M = X.M, c = mv(inverseView(X), ORIGIN4[X.kind]), r = M.reduce(X.kind === 'plane' ? c.map((v) => v / c[3]) : lnorm(c));
    if (!r.word.length) return;
    const G = rows(r.G, 4);
    state.four.rot = X.kind === 'plane' ? fixAffine(mm(state.four.rot, G)) : fixL(mm(state.four.rot, G));
  }
  // the cell whose middle is nearest a point of the canvas, among those near the middle
  function cellAt(x, y) {
    const X = space4(), C = cam3, view = viewOf(X), proj = projector(X), m = midCell(X, view);
    if (!m) return null;
    const mq = view(m.mid);
    let best = null, bd = Infinity;
    for (const cell of X.cells) {
      const q = view(cell.mid);
      const far = X.kind === 'sphere' ? Math.acos(clamp(dot(norm(q), norm(mq)), -1, 1)) / X.adj : X.kind === 'plane' ? Math.hypot(q[0] - mq[0], q[1] - mq[1], q[2] - mq[2]) / X.adj : Math.acosh(Math.max(1, -lor(lnorm(q), lnorm(mq)))) / X.adj;
      if (far > 2.6) continue;
      const s = proj(q);
      if (!s) continue;
      const o = onScreen(C, s), dd = Math.hypot(o[0] - x, o[1] - y);
      if (dd < bd) { bd = dd; best = cell; }
    }
    return bd < 0.22 * Math.min(C.w, C.h) ? best : null;
  }
  // a cell to the middle: the motion that takes its middle there, in steps
  let flight = null;
  function flyTo(cell) {
    const X = space4(), q = viewOf(X)(cell.mid), rot0 = state.four.rot;
    let dist, at;
    if (X.kind === 'sphere') {
      const from = norm(q), S = ORIGIN4.sphere;
      dist = Math.acos(clamp(dot(from, S), -1, 1));
      at = (e) => ortho(mm(turn4(from, S, e * dist), rot0));
    } else if (X.kind === 'plane') {
      dist = Math.hypot(q[0], q[1], q[2]) / X.adj;
      at = (e) => fixAffine(mm([[1, 0, 0, -e * q[0]], [0, 1, 0, -e * q[1]], [0, 0, 1, -e * q[2]], [0, 0, 0, 1]], rot0));
    } else {
      const from = lnorm(q), o = [0, 0, 0, 1];
      dist = Math.acosh(Math.max(1, -lor(from, o)));
      at = (e) => {
        if (dist < 1e-9) return rot0;
        const s = Math.sinh(dist), g = from.map((v, i) => (Math.sinh((1 - e) * dist) * v + Math.sinh(e * dist) * o[i]) / s);
        return fixL(mm(translation(from, g), rot0));
      };
    }
    if (dist < 1e-3) return;
    flight = { step: (e) => { state.four.rot = at(e); }, end: recentre4, t0: performance.now(), dur: MM.reduceMotion() ? 0 : 650 + 500 * Math.min(dist, 2) };
    tick();
  }

  /* ---------- Petrie polygons ---------- */
  // The regular polytope shown, when its Petrie polygons are drawn: a polyhedron {p, q} (p, q ≥ 3)
  // or a polytope of rank four, with x at the first or the last corner of C; its group's model
  // and the corner its vertices are at (the other one for the dual).
  function petrieCorner() {
    const k = state.kind;
    if (k === 'sphere') {
      const c = complex3(), s = state.three;
      if (c.special || c.snubbed || s.r !== 2 || s.p === 2 || s.q === 2) return null;
      const at = c.on[1] && c.on[2] ? 0 : c.on[0] && c.on[1] ? 2 : -1;
      return at < 0 ? null : { M: c.M, g: c.g, k: s.dual ? 2 - at : at };
    }
    if (k === 'space') {
      const X = space4(), f = state.four;
      if (f.special || X.kind !== 'sphere') return null;
      const on = P.wallsOf(X.M, X.x), at = on[1] && on[2] && on[3] ? 0 : on[0] && on[1] && on[2] ? 3 : -1;
      return at < 0 ? null : { M: X.M, g: X.g, k: f.dual ? 3 - at : at };
    }
    return null;
  }
  const coxPlane = (g) => g.cp || (g.cp = P.coxeterPlane(g.M));
  // The Petrie polygon through the vertex nearest the corner of C, among the points drawn: its
  // vertices (each the image of the one before under the product of the generating reflections)
  // and their indices among the points; how many sides, and how many such polygons there are
  function petrieThrough(pc, pts) {
    const ck = pc.M.corners[pc.k];
    let best = -Infinity, i0 = 0;
    pts.forEach((p, i) => { const d = dot(p, ck) / Math.hypot(...p); if (d > best) { best = d; i0 = i; } });
    const pr = P.petrie(pc.M, pc.k, pts[i0]);
    const idx = pr.pts.map((u) => {
      let bi = 0, bd = Infinity;
      pts.forEach((p, i) => { let e = 0; for (let a = 0; a < p.length; a++) e += (p[a] - u[a]) ** 2; if (e < bd) { bd = e; bi = i; } });
      return bi;
    });
    return { pts: pr.pts, idx, h: pr.h, count: pc.g.T.N / (2 * pr.h) };
  }
  // rank three: the polygon among the solid's vertices (the dual's, if shown), and the frame the
  // solid stands in while it is shown: upright along the axis of s₀s₁s₂, a rotation through 2π/h
  // followed by the reflection in the plane perpendicular to it (seen along it, the Petrie
  // polygon is a regular h-gon), with the first vertex towards the eye
  function petrie3(c) {
    const pc = petrieCorner();
    if (!pc) return null;
    const dualOn = state.three.dual;
    if (c.pet && c.pet.dual === dualOn) return c.pet;
    const pts = dualOn ? solidShape(c).verts.map((v) => v.p) : Array.from({ length: c.W.V }, (_, v) => Array.from(c.W.pos.subarray(3 * v, 3 * v + 3)));
    const pet = petrieThrough(pc, pts), cp = coxPlane(c.g), up = norm(cross(cp.a, cp.b)), p0 = pet.pts[0];
    const fw = norm(cp.a.map((x, i) => x * dot(p0, cp.a) + cp.b[i] * dot(p0, cp.b)));
    pet.up = [cross(up, fw), up, fw];
    pet.axis = up;
    pet.dual = dualOn;
    return (c.pet = pet);
  }
  // rank four: among the vertices drawn
  function petrie4(X) {
    if (X.pet !== undefined) return X.pet;
    const pc = petrieCorner();
    return (X.pet = pc ? petrieThrough(pc, Array.from({ length: X.V }, (_, v) => Array.from(X.pos.subarray(4 * v, 4 * v + 4)))) : null);
  }
  // a Petrie polygon's sides, its words: 4 skew hexagons
  const skewWords = (h, n) => '$' + n + '$ skew ' + (/^\d/.test(P.gon(h)) ? '<span class="tex-nowrap">$' + h + '$-gons</span>' : plural(P.gon(h), n));
  // the turn about the unit axis n through t (Rodrigues)
  function axisTurn(n, t) {
    const C = Math.cos(t), S = Math.sin(t), k = 1 - C;
    return [[C + n[0] * n[0] * k, n[0] * n[1] * k - n[2] * S, n[0] * n[2] * k + n[1] * S], [n[1] * n[0] * k + n[2] * S, C + n[1] * n[1] * k, n[1] * n[2] * k - n[0] * S], [n[2] * n[0] * k - n[1] * S, n[2] * n[1] * k + n[0] * S, C + n[2] * n[2] * k]];
  }
  // the turn the fraction e of the way from A to B (by the turn B Aᵀ about its axis)
  function slerp3(A, B, e) {
    const Q = mm(B, tr(A)), th = Math.acos(clamp((Q[0][0] + Q[1][1] + Q[2][2] - 1) / 2, -1, 1));
    if (th < 1e-9) return B;
    let n = [Q[2][1] - Q[1][2], Q[0][2] - Q[2][0], Q[1][0] - Q[0][1]];
    if (Math.hypot(...n) < 1e-6) n = Q.map((r, i) => r.map((x, j) => (x + (i === j)) / 2)).reduce((b, r) => (Math.hypot(...r) > Math.hypot(...b) ? r : b), [0, 0, 0]);
    return mm(axisTurn(norm(n), e * th), A);
  }
  // The solid stands on its Petrie polygon's axis while the polygon is shown, and on the axis of
  // its sections while they are: when that changes, it turns into its new frame smoothly, and
  // the shortest way. On the turntable the turn about the upright axis is free, and the tilt
  // within a range (in the new frames seen from a little above, so that a section is not seen
  // edge on): those of the two nearest to the turn shown.
  let shownUp = null;
  function nearestTurn(R0, U, lo, hi) {
    let best = null;
    for (let ph = lo; ph <= hi + 1e-9; ph += 0.025) {
      // the trace of R0ᵀ·rotX(ph)·rotY(th)·U, largest at this th
      const A = mm(mm(U, tr(R0)), rotX(ph)), th = Math.atan2(A[2][0] - A[0][2], A[0][0] + A[2][2]);
      const v = Math.cos(th) * (A[0][0] + A[2][2]) + Math.sin(th) * (A[2][0] - A[0][2]) + A[1][1];
      if (!best || v > best.v) best = { v, th, ph };
    }
    return best;
  }
  function followUp() {
    const c = complex3(), R0 = state.R3, U = upNow();
    const now = { g: c.g ? c.g.key : '', kind: c.upKind || '' };
    if (shownUp && shownUp.g === now.g && shownUp.kind !== now.kind && R0) {
      let best;
      if (now.kind) {
        // the axis of the Petrie polygon or of the sections, whichever way up is nearer
        if (state.upFlip) { state.upFlip = false; c.upKey = null; }
        const U0 = upNow(), a = nearestTurn(R0, U0, 0.2, 0.75), b = nearestTurn(R0, flipFrame(U0), 0.2, 0.75);
        best = b.v > a.v + 1e-9 ? b : a;
        if (best === b) { state.upFlip = true; c.upKey = null; upNow(); }
      } else best = nearestTurn(R0, U, 0.05, 0.8);
      state.turn = { th: best.th, ph: best.ph };
      flight = { step: (e) => { state.R3fly = e >= 1 ? null : slerp3(R0, turnR3(), e); }, t0: performance.now(), dur: MM.reduceMotion() ? 0 : 750 };
      state.R3fly = R0;
      tick();
    }
    shownUp = now;
  }

  /* ---------- rank four: the Coxeter plane ---------- */
  // The polytope projected orthogonally to the plane in which s₀s₁s₂s₃ turns through 2π/h, its
  // edges light, turned so that the projection of the corner 0 of C is straight up (an axis of
  // the picture's symmetry), and its Petrie polygon, a regular h-gon, when shown.
  function drawCoxeter() {
    const { ctx, w, h } = frameCanvas(), X = space4(), f = state.four, cp = coxPlane(X.g), pos = X.pos, V = X.V, edges = X.edges;
    const A = cp.a, B = cp.b, c0 = X.M.corners[0], rot = Math.PI / 2 - Math.atan2(dot(c0, B), dot(c0, A)), cr = Math.cos(rot), sr = Math.sin(rot);
    const pr = (p, o) => { const a = A[0] * p[o] + A[1] * p[o + 1] + A[2] * p[o + 2] + A[3] * p[o + 3], b = B[0] * p[o] + B[1] * p[o + 1] + B[2] * p[o + 2] + B[3] * p[o + 3]; return [cr * a - sr * b, sr * a + cr * b]; };
    const xy = new Float64Array(2 * V);
    let R = 0;
    for (let v = 0; v < V; v++) { const q = pr(pos, 4 * v); xy[2 * v] = q[0]; xy[2 * v + 1] = q[1]; R = Math.max(R, Math.hypot(q[0], q[1])); }
    const s = 0.46 * Math.min(w, h) / (R || 1) * f.zoom, cx = w / 2, cy = h / 2, kw = thin();
    const path = new Path2D();
    for (let i = 0; i < edges.length; i += 3) {
      const a = edges[i], b = edges[i + 1];
      path.moveTo(cx + s * xy[2 * a], cy - s * xy[2 * a + 1]);
      path.lineTo(cx + s * xy[2 * b], cy - s * xy[2 * b + 1]);
    }
    ctx.lineCap = 'round';
    const E = edges.length / 3;
    ctx.strokeStyle = MM.rgba('edge', clamp(18 / Math.sqrt(E), 0.34, 0.8));
    ctx.lineWidth = (E > 2000 ? 0.85 : 1.1) * kw;
    ctx.stroke(path);
    const pet = state.petrie && petrie4(X);
    if (pet) {
      ctx.beginPath();
      pet.pts.forEach((u, i) => { const q = pr(u, 0); if (i) ctx.lineTo(cx + s * q[0], cy - s * q[1]); else ctx.moveTo(cx + s * q[0], cy - s * q[1]); });
      ctx.closePath();
      ctx.strokeStyle = MM.color('highlight');
      ctx.lineWidth = 2.2 * kw;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    handle.hidden = true;
  }

  /* ---------- rank four: sections ---------- */
  // The sections by the hyperplanes u·y = t, u the unit vector from the corner `from` of C (the
  // middle of the flag's vertex, edge, face or cell) through the centre, so that t runs from that
  // element to the far side; in a frame of u⊥ upright along the axis of the turn of highest order
  // among the symmetries that fix the element (through another corner of C). With the volume
  // of the section at the levels where it passes through vertices and between them.
  let secData = null;
  function sectionData(X) {
    const f = state.four, key = X.key + '|' + f.from;
    if (secData && secData.key === key) return secData;
    const M = X.M, j = f.from, u = M.corners[j].map((v) => -v), others = [0, 1, 2, 3].filter((k) => k !== j);
    const order = (k) => { const [a, b] = others.filter((t) => t !== k); return M.m[a][b]; };
    const top = others.reduce((b, k) => (order(k) > order(b) ? k : b), others[0]);
    const E = [];
    for (const v of [M.corners[top], M.corners[others.find((k) => k !== top)], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) {
      let x = v.slice();
      for (const b of [u, ...E]) { const d = dot(x, b); x = x.map((y, i) => y - d * b[i]); }
      const l = Math.hypot(...x);
      if (l > 1e-6 && E.length < 3) E.push(x.map((y) => y / l));
    }
    const E3 = [E[2], E[0], E[1]], S = P.sections(X.pos, 4, X.cells.map((cell) => ({ normal: norm(cell.mid), faces: X.cellFaces(cell) })), u, E3);
    // the symmetries that fix the element, the reflections in the walls other than j: a group
    // [p, q] of the page (walls a, b, c with a and c perpendicular), and its walls in the
    // section's coordinates, for naming the sections that are its polyhedra
    let grp = null;
    for (const a of others) for (const b of others) for (const c of others) {
      if (a === b || b === c || a === c || M.m[a][c] !== 2) continue;
      if (!grp || M.m[a][b] > grp.p || (M.m[a][b] === grp.p && M.m[b][c] > grp.q)) grp = { order: [a, b, c], p: M.m[a][b], q: M.m[b][c] };
    }
    grp.walls = grp.order.map((i) => E3.map((e) => dot(e, M.r[i])));
    const ts = [], N = 96;
    for (let i = 0; i <= N; i++) ts.push(S.lo + (S.hi - S.lo) * i / N);
    if (S.levels.length <= 400) ts.push(...S.levels);
    ts.sort((a, b) => a - b);
    const curve = [];
    ts.forEach((t) => { if (!curve.length || t - curve[curve.length - 1][0] > 1e-9) curve.push([t, Math.max(0, S.at(t))]); });
    return (secData = { key, S, curve, grp, vmax: Math.max(...curve.map((c) => c[1])) });
  }
  // the sections shown (of a polyhedron, or of a polytope of rank four), and what holds their t
  const slicing = () => state.kind === 'sphere' && state.view3 === 'sections';
  const sectionsShown = () => slicing() || view4() === 'sections';
  const secHolder = () => (state.kind === 'sphere' ? state.three : state.four);
  // t, within the range of the polytope's sections
  const secT = (sd) => { const t = clamp(secHolder().t, sd.S.lo, sd.S.hi), L = sd.S.levels.find((x) => Math.abs(x - t) < 6e-5); return L === undefined ? t : L; };
  // The polyhedron of the page a section is, if any: Wythoff's for the symmetries fixing the
  // element, or the dual of one; its spec and name
  function sectionIs(sd, pts, faces) {
    const r = P.recognise(sd.grp.walls, pts, faces);
    if (!r) return null;
    const spec = { rank: 3, p: sd.grp.p, q: sd.grp.q, r: 2, w: r.w, dual: r.dual };
    return { spec, name: polyName3(spec) };
  }
  // the name the page gives the polyhedron of a spec (as about3 does)
  function polyName3(spec) {
    const M = group3(spec.p, spec.q, 2).M, conf = P.vertexConfig(M, P.wallsOf(M, M.point(spec.w)), false);
    const nz = spec.w.filter((v) => v > 1e-9), uni = nz.every((v) => Math.abs(v - nz[0]) < 1e-6 * nz[0]);
    let name = P.nameByConfig('sphere', conf.sizes);
    name = name ? named(name, uni) : (uni ? 'Uniform polyhedron ' : 'Polyhedron ') + confTex(conf);
    if (spec.dual) name = (uni && P.dualName(name)) || 'Dual of the ' + lower(name);
    return lower(name);
  }
  // whether points span space (not all in a plane)
  function solid3(pts) {
    if (pts.length < 4) return false;
    const a = pts[0], b = pts.find((p) => Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) > 1e-6);
    if (!b) return false;
    const ab = b.map((x, i) => x - a[i]), c = pts.find((p) => Math.hypot(...cross(ab, p.map((x, i) => x - a[i]))) > 1e-6);
    if (!c) return false;
    const n = cross(ab, c.map((x, i) => x - a[i]));
    return pts.some((p) => Math.abs(dot(n, p.map((x, i) => x - a[i]))) > 1e-6);
  }
  // a face of the section takes the colour of the cell it lies in, by its kind as a face of the
  // solid does (the cells of {p, q, r}; those from its vertices, edges, faces); the dual's alike
  const CELL4 = { 3: 'face-1', 0: 'face-2', 1: 'face-3', 2: 'face-4', '-1': 'dual-face' };
  let shownSection = null; // the section drawn, for the readouts: { sides, kinds, flat, verts }
  function drawSections() {
    const { ctx, w, h } = frameCanvas(), X = space4(), f = state.four, sd = sectionData(X), t = secT(sd), sec = sd.S.at(t, true);
    f.R3 = mm(rotX(f.turn.ph), rotY(f.turn.th));
    const C = cam3 = camera(f.R3, 1, w, h, 1.1, SOLID_FOV);
    C.s *= f.zoom;
    const eye = mv(tr(C.R), [0, 0, C.D]), k = thin();
    const faces = sec.faces.map((fc) => { const pts = fc.ids.map((id) => sec.pts.get(id)), c = [0, 1, 2].map((a) => pts.reduce((x, p) => x + p[a], 0) / pts.length); return { pts, ids: fc.ids, n: fc.n, c, cell: fc.cell }; });
    const front = faces.map((fc) => dot(fc.n, eye.map((e, i) => e - fc.c[i])) > 1e-9);
    const at = new Map(), edges = [];
    faces.forEach((fc, fi) => fc.ids.forEach((a, i) => {
      const b = fc.ids[(i + 1) % fc.ids.length], key = Math.min(a, b) + ',' + Math.max(a, b);
      let e = at.get(key);
      if (!e) { e = { a: fc.pts[i], b: fc.pts[(i + 1) % fc.pts.length], faces: [] }; at.set(key, e); edges.push(e); }
      e.faces.push(fi);
    }));
    // (a section that is a vertex or an edge of the polytope: its edges in the hyperplane)
    if (!faces.length) {
      const on = new Set(sec.onVerts);
      for (let i = 0; i < X.edges.length; i += 3) if (on.has(X.edges[i]) && on.has(X.edges[i + 1])) edges.push({ a: sec.pts.get(X.edges[i]), b: sec.pts.get(X.edges[i + 1]), faces: [] });
    }
    const edgeFront = (e) => e.faces.length < 2 || e.faces.some((fi) => front[fi]);
    const path = (list) => { const p = new Path2D(); for (const e of list) { const a = onScreen(C, e.a), b = onScreen(C, e.b); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); } return p; };
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = MM.rgba('edge', 0.42);
    ctx.lineWidth = 1 * k;
    ctx.stroke(path(edges.filter((e) => !edgeFront(e))));
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.78;
    faces.forEach((fc, fi) => {
      if (!front[fi]) return;
      ctx.beginPath();
      fc.pts.forEach((p, i) => { const q = onScreen(C, p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath();
      ctx.fillStyle = MM.color(CELL4[X.cells[fc.cell].l] + '-fill');
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = MM.color('edge');
    ctx.lineWidth = 1.7 * k;
    ctx.stroke(path(edges.filter(edgeFront)));
    // the polytope's vertices in the hyperplane
    ctx.fillStyle = MM.color('edge');
    for (const v of sec.onVerts) {
      const p = sec.pts.get(v), q = onScreen(C, p);
      if (faces.length && dot(p, eye) - dot(p, p) < -1e-9 && !edges.some((e) => edgeFront(e) && (e.a === p || e.b === p))) continue;
      ctx.beginPath(); ctx.arc(q[0], q[1], 3 * k, 0, TAU); ctx.fill();
    }
    const sides = new Map(), kinds = new Set();
    faces.forEach((fc) => { sides.set(fc.ids.length, (sides.get(fc.ids.length) || 0) + 1); kinds.add(X.cells[fc.cell].l); });
    const flat = sec.vol < 1e-9 * (sd.vmax || 1), pts = faces.length ? [...sec.pts.values()] : [];
    const is = faces.length >= 4 && !flat ? sectionIs(sd, pts, faces.map((fc) => ({ n: fc.n, d: dot(fc.n, fc.pts[0]) }))) : null;
    // (through vertices of the polytope that span space, and more points: the polyhedron of those vertices, Coxeter's simplified section)
    const onPts = sec.onVerts.map((v) => sec.pts.get(v)), simp = sec.onVerts.length < pts.length && solid3(onPts) ? sectionIs(sd, onPts, []) : null;
    // (a flat section: a face of the polytope, regular when its sides are equal)
    let regularFace = false;
    if (flat && faces.length) { const ps = faces[0].pts, ls = ps.map((p, i) => Math.hypot(...p.map((x, a) => x - ps[(i + 1) % ps.length][a]))); regularFace = Math.max(...ls) - Math.min(...ls) < 1e-6; }
    shownSection = { sides, kinds, flat, verts: sec.onVerts.length, faces: faces.length, is, simp, regularFace };
    handle.hidden = true;
    drawSecChart(sd, t, sec.vol);
  }

  /* ---------- rank three: sections ---------- */
  // The sections of the solid by the planes u·y = t, u from the corner `from` of C through the
  // centre (the solid scaled so that its farthest vertices are at distance 1, as in rank four), in
  // the frame the solid stands in while they are shown; with the area at the levels and between
  // them, and the symmetries that fix the element: the reflections in the two other walls, the
  // group [m] of a polygon.
  let sliceCache = null;
  function sliceData(c) {
    const s = state.three, sh = solidShape(c), key = '3|' + c.key + '|' + s.dual + '|' + s.from;
    if (sliceCache && sliceCache.key === key) return sliceCache;
    const M = c.M, j = s.from, u = M.corners[j].map((v) => -v), F = sliceFrame(M, j), E = [F[0], F[2]], k = 1 / sh.rho;
    const S = P.slices(sh.edges.map((e) => [e.a.map((x) => x * k), e.b.map((x) => x * k)]), u, E);
    const ts = [];
    for (let i = 0; i <= 96; i++) ts.push(S.lo + (S.hi - S.lo) * i / 96);
    ts.push(...S.levels);
    ts.sort((a, b) => a - b);
    const curve = [];
    ts.forEach((t) => { if (!curve.length || t - curve[curve.length - 1][0] > 1e-9) curve.push([t, Math.max(0, S.at(t))]); });
    const [a, b] = [0, 1, 2].filter((i) => i !== j);
    return (sliceCache = { key, S, curve, vmax: Math.max(...curve.map((x) => x[1])), scale: sh.rho, label: 'Area of the section', m: M.m[a][b], walls: [a, b].map((i) => E.map((e) => dot(e, M.r[i]))) });
  }
  // the name the page gives the polygon of a spec of rank two (as about2 does)
  function polyName2(spec) {
    const on = spec.w.some((v) => v < 1e-9), sides = on ? spec.p : 2 * spec.p, uni = on || Math.abs(spec.w[0] - spec.w[1]) < 1e-9;
    if (uni) return sides === 3 ? 'equilateral triangle' : sides === 4 ? 'square' : 'regular ' + P.gon(sides);
    if (spec.dual) return sides === 4 ? 'rhomb' : P.gon(sides) + ' with equal sides';
    return lower(named(cap(P.gon(sides)), false));
  }
  let shownSlice = null; // the section drawn, for the readouts
  function drawSlices() {
    const { ctx, w, h } = frameCanvas(), c = complex3(), sh = solidShape(c), sd = sliceData(c), t = secT(sd), sec = sd.S.at(t, true);
    const C = cam3 = camera(state.R3, sh.rho, w, h, 1.16, SOLID_FOV), eye = mv(tr(C.R), [0, 0, C.D]), k = thin(), sc = sd.scale;
    const front = sh.faces.map((f) => dot(f.n, eye.map((e, i) => e - f.c[i])) > 1e-9);
    const edgeFront = (e) => !e.faces.length || e.faces.length === 1 || e.faces.some((fi) => front[fi]);
    const path = (list) => { const p = new Path2D(); for (const e of list) { const a = onScreen(C, e.a), b = onScreen(C, e.b); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); } return p; };
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = MM.rgba('edge', 0.42);
    ctx.lineWidth = 1 * k;
    ctx.stroke(path(sh.edges.filter((e) => !edgeFront(e))));
    ctx.setLineDash([]);
    // the section, shaded, with its outline (a vertex or an edge of the solid at the ends)
    const poly = sec.corners.map((p) => onScreen(C, p.map((x) => x * sc)));
    if (poly.length >= 2) {
      ctx.beginPath();
      poly.forEach((q, i) => { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath();
      if (poly.length >= 3) { ctx.globalAlpha = 0.85; ctx.fillStyle = MM.color('cell-mid'); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = MM.color('edge');
      ctx.lineWidth = 2.4 * k;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.strokeStyle = MM.color('edge');
    ctx.lineWidth = 1.7 * k;
    ctx.stroke(path(sh.edges.filter(edgeFront)));
    // the solid's vertices on the plane
    ctx.fillStyle = MM.color('edge');
    for (const p of sec.on) { const q = onScreen(C, p.map((x) => x * sc)); ctx.beginPath(); ctx.arc(q[0], q[1], 3.2 * k, 0, TAU); ctx.fill(); }
    // the polygon of the page it is: Wythoff's for [m], or the dual of one
    let is = null;
    if (sec.flat.length >= 3 && !c.snubbed) {
      const r = P.recognise(sd.walls, sec.flat, sec.sides);
      if (r) { const spec = { rank: 2, p: sd.m, w: r.w, dual: r.dual }; is = { spec, name: polyName2(spec) }; }
    }
    shownSlice = { n: sec.flat.length >= 3 ? sec.flat.length : sec.all.length, is, on: sec.on.length };
    handle.hidden = true;
    drawSecChart(sd, t, sec.area);
  }

  /* ---------- the sections' chart: the volume against t, with t's handle ---------- */
  const secBlock = $('sec-block'), secSvg = $('sec-chart');
  const secBody = MM.svg('g', {}, secSvg), secGuide = MM.svg('path', { class: 'rp-sec-guide' }, secSvg);
  const secKnob = MM.svg('g', { class: 'rp-sec-handle draggable', tabindex: '0', role: 'slider', 'aria-label': 'The hyperplane: t' }, secSvg);
  MM.svg('circle', { class: 'rp-sec-hit', r: 18 }, secKnob);
  MM.handle(secKnob, 5.1);
  let secMap = null, secShown = '';
  const secWidth = () => Math.round(Math.min(560, secSvg.getBoundingClientRect().width || 320));
  // a round step for about n intervals over the range x
  const niceStep = (x, n) => { const r = x / n, e = Math.pow(10, Math.floor(Math.log10(r))); return [1, 2, 2.5, 5, 10].map((m) => m * e).find((s) => s >= r) || 10 * e; };
  const numTex = (x) => '$' + (+x.toFixed(6)).toString().replace('-', '{-}') + '$';
  let shownSd = null; // the sections the chart is of
  function drawSecChart(sd, t, vol) {
    shownSd = sd;
    const W = secWidth(), key = [W, sd.key, t.toFixed(9)].join('|');
    if (secShown === key) return;
    secShown = key;
    const H = 150, left = 44, right = 16, top = 24, bottom = 36, lo = sd.S.lo, hi = sd.S.hi;
    // (t over [−1, 1] for every polytope: its sections lie between lo and hi there)
    const step = niceStep(sd.vmax || 1, 3), vtop = Math.max(step, Math.ceil((sd.vmax || 1) / step - 1e-9) * step);
    const X = (x) => left + (x + 1) / 2 * (W - left - right), Y = (v) => top + (1 - v / vtop) * (H - top - bottom);
    secMap = { lo, hi, left, right, W, X, levels: sd.S.levels.length <= 60 ? sd.S.levels : [] };
    const el = (name, attrs) => MM.svg(name, attrs, secBody), label = (text, x, y, anchor) => MM.svgLabel(el('text', { class: 'rp-sec-num', x, y, 'text-anchor': anchor || 'middle' }), text);
    secBody.textContent = '';
    secSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    // the volume up the side, t along the bottom
    for (let v = step; v <= vtop + 1e-9; v += step) el('path', { class: 'rp-sec-grid', d: 'M' + left + ' ' + (Math.round(Y(v)) + 0.5) + 'H' + (W - right) });
    el('path', { class: 'rp-sec-axis', d: 'M' + left + ' ' + (Math.round(Y(0)) + 0.5) + 'H' + (W - right) });
    for (let v = 0; v <= vtop + 1e-9; v += step) label(numTex(v), left - 8, Y(v) + 4, 'end');
    MM.svgLabel(el('text', { class: 'rp-sec-num', x: 2, y: 12, 'text-anchor': 'start' }), sd.label || 'Volume of the section');
    for (let x = -1; x <= 1 + 1e-9; x += 0.5) {
      el('path', { class: 'rp-sec-axis', d: 'M' + (Math.round(X(x)) + 0.5) + ' ' + Y(0) + 'v4' });
      label(numTex(x), X(x), Y(0) + 17);
    }
    label('$t$', X(0), Y(0) + 33);
    // the volume, up from 0 at the first section (a cell's volume, starting with a cell) and down to 0 at the last
    const c0 = sd.curve[0], c1 = sd.curve[sd.curve.length - 1];
    let d = 'M' + X(c0[0]).toFixed(1) + ' ' + Y(0).toFixed(1);
    sd.curve.forEach(([x, v]) => { d += 'L' + X(x).toFixed(1) + ' ' + Y(v).toFixed(1); });
    d += 'L' + X(c1[0]).toFixed(1) + ' ' + Y(0).toFixed(1);
    el('path', { class: 'rp-sec-curve', d });
    // the levels where the hyperplane passes through vertices: the handle holds there
    for (const x of secMap.levels) { const v = sd.curve.find((c) => Math.abs(c[0] - x) < 1e-9); el('circle', { class: 'rp-sec-level', cx: X(x), cy: Y(v ? v[1] : 0), r: 2.6 }); }
    const hx = X(t), hy = Y(Math.max(0, vol));
    secKnob.setAttribute('transform', 'translate(' + hx.toFixed(1) + ' ' + hy.toFixed(1) + ')');
    secGuide.setAttribute('d', 'M' + (Math.round(hx) + 0.5) + ' ' + Y(0) + 'V' + (hy + 7).toFixed(1));
    secKnob.setAttribute('aria-valuemin', String(+lo.toFixed(4)));
    secKnob.setAttribute('aria-valuemax', String(+hi.toFixed(4)));
    secKnob.setAttribute('aria-valuenow', String(+t.toFixed(4)));
    secKnob.setAttribute('aria-valuetext', 't = ' + t.toFixed(3) + ', volume ' + Math.max(0, vol).toFixed(3));
  }
  new ResizeObserver(() => { if (!secBlock.hidden) { secShown = ''; if (sectionsShown()) draw(); } }).observe(secBlock);
  // t from a point of the chart (the handle holding at the levels within a few pixels)
  function secAt(clientX) {
    const r = secSvg.getBoundingClientRect(), m = secMap, x = (clientX - r.left) * m.W / (r.width || 1);
    let t = clamp(-1 + 2 * (x - m.left) / (m.W - m.left - m.right), m.lo, m.hi);
    for (const L of m.levels) if (Math.abs(m.X(L) - m.X(t)) < 6) { t = L; break; }
    return t;
  }
  const setSecT = (t) => { secHolder().t = clamp(t, secMap.lo, secMap.hi); draw(); };
  let secHeld = null;
  secKnob.addEventListener('pointerdown', (e) => {
    if (e.button || !secMap) return;
    e.preventDefault();
    e.stopPropagation();
    secKnob.setPointerCapture(e.pointerId);
    const m = secMap, t = clamp(secHolder().t, m.lo, m.hi), r = secSvg.getBoundingClientRect();
    secHeld = { id: e.pointerId, off: (e.clientX - r.left) * m.W / (r.width || 1) - m.X(t) };
    secKnob.focus({ preventScroll: true });
  });
  secKnob.addEventListener('pointermove', (e) => {
    if (!secHeld || secHeld.id !== e.pointerId) return;
    const r = secSvg.getBoundingClientRect(), m = secMap, px = (e.clientX - r.left) * m.W / (r.width || 1) - secHeld.off;
    setSecT(secAt(r.left + px * (r.width || 1) / m.W));
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => secKnob.addEventListener(type, (e) => {
    if (!secHeld || secHeld.id !== e.pointerId) return;
    secHeld = null;
    MM.moved();
  }));
  // the keyboard: the arrows move t a little, Page Up and Down to the levels, Home and End to the ends
  secKnob.addEventListener('keydown', (e) => {
    if (!secMap || e.altKey || e.ctrlKey || e.metaKey) return;
    const m = secMap, t = clamp(secHolder().t, m.lo, m.hi), lv = shownSd ? shownSd.S.levels : [];
    let to = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = t + (e.shiftKey ? 0.004 : 0.02);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = t - (e.shiftKey ? 0.004 : 0.02);
    else if (e.key === 'PageUp') to = lv.find((L) => L > t + 1e-9);
    else if (e.key === 'PageDown') to = [...lv].reverse().find((L) => L < t - 1e-9);
    else if (e.key === 'Home') to = m.lo;
    else if (e.key === 'End') to = m.hi;
    else return;
    e.preventDefault();
    if (to === undefined) return;
    setSecT(clamp(to, m.lo, m.hi));
    MM.moved();
  });
  // a click on the chart puts t there; a tap does not (on a touch screen t moves by its handle)
  let secTouch = false;
  secSvg.addEventListener('pointerdown', (e) => { secTouch = e.pointerType === 'touch'; });
  secSvg.addEventListener('click', (e) => {
    if (!secMap || secTouch || e.target.closest('.rp-sec-handle')) return;
    setSecT(secAt(e.clientX));
    MM.moved();
  });
  // the view of a polytope of rank four: its boundary in space for the honeycombs
  const view4 = () => (state.kind === 'space' && !state.four.special && space4().kind === 'sphere' ? state.four.view : 'space');

  /* ---------- the chamber: x as a handle ---------- */
  // An SVG picture of C (rank two: an arc of the circle between the two walls; rank three: the
  // triangle, in a conformal chart round ρ, with the three chambers across its walls, where x
  // gives the snub; rank four: the tetrahedron in a chart where it is straight, turning), x
  // on it as the handle, and dots at the special points, where the handle holds.
  const SVGNS = 'http://www.w3.org/2000/svg';
  let ch = null; // the chamber as drawn: { key, rank, M, toPx, fromPx, ... }
  function chamberKey() {
    if (state.kind === 'polygon') return '2|' + state.two.p;
    if (state.kind === 'space') return state.four.special ? '' : '4|' + state.four.ms.join(',');
    if (state.kind === 'penrose' || state.three.special) return '';
    return '3|' + [state.three.p, state.three.q, state.three.r].join(',');
  }
  // a label beside the point q of the chamber's picture, on the side away from `mid`, clear of a
  // handle at q (its size measured once drawn)
  function labelAt(q, mid, text) {
    const t = el('text', { x: q[0].toFixed(1), y: q[1].toFixed(1), class: 'rp-ch-label' }, ch.gLabels);
    MM.svgLabel(t, text);
    let w = 30, h = 14;
    try { const b = t.getBBox(); if (b.width) { w = b.width; h = b.height; } } catch (err) { /* not laid out */ }
    const dx = q[0] - mid[0], dy = q[1] - mid[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const off = 16 + Math.abs(ux) * w / 2 + Math.abs(uy) * h / 2;
    // (kept inside the picture; if that brings it over the point, then above or below it)
    const cx = clamp(q[0] + off * ux, w / 2 + 2, ch.W - w / 2 - 2);
    let cy = clamp(q[1] + off * uy, h / 2 + 1, ch.H - h / 2 - 1);
    if (Math.hypot(Math.max(0, Math.abs(cx - q[0]) - w / 2), Math.max(0, Math.abs(cy - q[1]) - h / 2)) < 13) cy = clamp(q[1] + (uy >= 0 ? 1 : -1) * (14 + h / 2), h / 2 + 1, ch.H - h / 2 - 1);
    t.setAttribute('x', cx.toFixed(1));
    t.setAttribute('y', (cy + h * 0.32).toFixed(1));
  }
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const ptsAttr = (pts) => pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  // the points of the geodesic from a to b in the model
  const geoPts = (M, a, b, n) => Array.from({ length: n + 1 }, (_, i) => M.normalize(a.map((x, k) => x + (b[k] - x) * i / n)));
  function buildChamber() {
    const key = chamberKey(), rank4 = key[0] === '4';
    chamberSvg.classList.toggle('is-turnable', rank4);
    const box = chamberSvg.getBoundingClientRect(), W = Math.max(160, Math.round(box.width || 220)), H = Math.round(W * (rank4 ? 0.92 : key[0] === '2' ? 0.5 : 0.8));
    $('chamber-block').hidden = !key;
    if (!key) { ch = null; return; }
    const fullKey = key + '|' + W;
    if (ch && ch.fullKey === fullKey) return;
    chamberSvg.textContent = '';
    chamberSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    chamberSvg.style.height = H + 'px';
    const rank = +key[0];
    ch = { key, fullKey, rank, W, H };
    const gShapes = el('g', {}, chamberSvg), gDots = el('g', {}, chamberSvg), gRings = el('g', {}, chamberSvg), gLabels = el('g', {}, chamberSvg);
    Object.assign(ch, { gShapes, gDots, gRings, gLabels });
    const hd = el('g', { class: 'rp-chamber-handle draggable', tabindex: '0', role: 'slider', 'aria-label': 'The point x in the chamber', 'aria-valuetext': '' }, chamberSvg);
    MM.handle(hd, 9);
    ch.handle = hd;
    if (rank === 2) build2(); else if (rank === 3) build3(); else build4();
  }
  function fitTo(pts2, pad, padY = pad) {
    const xs = pts2.map((p) => p[0]), ys = pts2.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const s = Math.min((ch.W - 2 * pad) / (x1 - x0 || 1), (ch.H - 2 * padY) / (y1 - y0 || 1));
    const ox = ch.W / 2 - s * (x0 + x1) / 2, oy = ch.H / 2 + s * (y0 + y1) / 2;
    return { s, ox, oy, px: (u) => [ox + s * u[0], oy - s * u[1]], un: (x, y) => [(x - ox) / s, (oy - y) / s] };
  }
  function build2() {
    const g = group2(state.two.p), M = g.M;
    // the arc of the unit circle from corner 0 to corner 1, and the two walls (rays)
    const a0 = Math.atan2(M.corners[0][1], M.corners[0][0]), a1 = Math.atan2(M.corners[1][1], M.corners[1][0]);
    // turned so that the arc is on top, level
    const turn = Math.PI / 2 - (a0 + a1) / 2, tw = (u) => [Math.cos(turn) * u[0] - Math.sin(turn) * u[1], Math.sin(turn) * u[0] + Math.cos(turn) * u[1]];
    const pts = [[0, 0]];
    for (let i = 0; i <= 24; i++) { const t = a0 + (a1 - a0) * i / 24; pts.push([Math.cos(t), Math.sin(t)]); }
    const F0 = fitTo(pts.slice(1).map(tw), 34);
    const F = { px: (u) => F0.px(tw(u)), un: (x, y) => { const v = F0.un(x, y); return [Math.cos(-turn) * v[0] - Math.sin(-turn) * v[1], Math.sin(-turn) * v[0] + Math.cos(-turn) * v[1]]; } };
    Object.assign(ch, { M, F, a0, a1 });
    const arc = pts.slice(1).map(F.px);
    el('polyline', { points: ptsAttr(arc), class: 'rp-ch-arc' }, ch.gShapes);
    ch.specials = [[1, 0], [1, 1], [0, 1]].map((w) => M.point(w));
    for (const sp of ch.specials) { const q = F.px(sp); el('circle', { cx: q[0], cy: q[1], r: 2.6, class: 'rp-ch-dot' }, ch.gDots); }
    ch.same = { w: [[1, 0], [1, 1], [0, 1]], key: ['1', '2', '1'], orbit: ['0', '1', '2'], at: (i) => F.px(ch.specials[i]) };
    const p = state.two.p, o = F.px([0, 0]);
    const lab = (u, text) => labelAt(F.px(u), o, text);
    lab(M.corners[0], '$\\{' + p + '\\}$');
    lab(M.corners[1], '$\\{' + p + '\\}$');
    lab(M.point([1, 1]), '$\\{' + 2 * p + '\\}$');
  }
  // Rank three: a Euclidean triangle for C, corner 0 at the left, 1 at the right, 2 above (wall 2
  // level at the bottom), with angles near C's (π/q, π/r, π/p, made to add up to π, and a corner
  // at infinity or a very sharp one opened up), so that x has room in every case; x placed by its
  // distances to the walls (exactly so for the Euclidean groups), and in the three chambers
  // across its walls, where x gives the snub, by reflection.
  function build3() {
    const s = state.three, g = group3(s.p, s.q, s.r), M = g.M;
    const raw = [s.q, s.r, s.p].map((m) => Math.max(Math.PI / m, 0.6)), sum = raw.reduce((t, x) => t + x, 0), ang = raw.map((x) => x * Math.PI / sum);
    const c0 = 1 / Math.tan(ang[0]), c1 = 1 / Math.tan(ang[1]), hgt = 1 / (c0 + c1);
    const A = [[0, 0], [1, 0], [hgt * c0, hgt]];
    // side k: the line through the corners other than k, with its inward unit normal
    const sides = [0, 1, 2].map((k) => {
      const P0 = A[(k + 1) % 3], P1 = A[(k + 2) % 3], d = [P1[0] - P0[0], P1[1] - P0[1]], l = Math.hypot(d[0], d[1]);
      let n = [-d[1] / l, d[0] / l];
      if (n[0] * (A[k][0] - P0[0]) + n[1] * (A[k][1] - P0[1]) < 0) n = [-n[0], -n[1]];
      return { P0, n };
    });
    const dist = (P, k) => sides[k].n[0] * (P[0] - sides[k].P0[0]) + sides[k].n[1] * (P[1] - sides[k].P0[1]);
    const alt = [0, 1, 2].map((k) => dist(A[k], k));
    const reflect = (P, k) => { const d = dist(P, k); return [P[0] - 2 * d * sides[k].n[0], P[1] - 2 * d * sides[k].n[1]]; };
    const posOf = (w, flap) => {
      const l = w.map((x, k) => x / alt[k]), t = l.reduce((u, x) => u + x, 0);
      const P = [0, 1].map((i) => l.reduce((u, x, k) => u + x * A[k][i], 0) / t);
      return flap >= 0 ? reflect(P, flap) : P;
    };
    const flapCorner = [0, 1, 2].map((k) => reflect(A[k], k));
    // fitted to C and the three chambers beside it
    const F = fitTo(A.concat(flapCorner), 48, 26);
    Object.assign(ch, { M, g, F, A, dist, reflect, posOf, px: F.px, toPx: (w, flap) => F.px(posOf(w, flap)) });
    // the ground: flaps grey, C light blue (and, with colours, each corner in its faces' colour)
    [0, 1, 2].forEach((k) => el('polygon', { points: ptsAttr([A[(k + 1) % 3], flapCorner[k], A[(k + 2) % 3]].map(F.px)), class: 'rp-ch-flap' }, ch.gShapes));
    el('polygon', { points: ptsAttr(A.map(F.px)), class: 'rp-ch-c' }, ch.gShapes);
    ch.cornerTint = el('g', {}, ch.gShapes);
    el('polygon', { points: ptsAttr(A.map(F.px)), class: 'rp-ch-side' }, ch.gShapes);
    // the special points: the uniform points in C, the snub's in each flap, and the far corner of
    // each flap (x there gives the same as at the corner of C it mirrors)
    const snubW = weights(M.walls(snubPoint(g)));
    ch.specials = RINGS3.map((r) => ({ w: r.slice(), flap: -1 })).concat([0, 1, 2].map((i) => ({ w: snubW, flap: i })), [0, 1, 2].map((k) => ({ w: [0, 1, 2].map((j) => +(j === k)), flap: k })));
    for (const sp of ch.specials) { const q = ch.toPx(sp.w, sp.flap); el('circle', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 2.6, class: sp.flap >= 0 && sp.w === snubW ? 'rp-ch-dot snub' : 'rp-ch-dot' }, ch.gDots); }
    ch.same = {
      w: ch.specials.map((sp) => sp.w), flap: ch.specials.map((sp) => sp.flap), at: (i) => ch.toPx(ch.specials[i].w, ch.specials[i].flap),
      key: ch.specials.map((sp) => { const on = sp.w.map((v) => v === 0), c = P.vertexConfig(M, on, sp.flap >= 0 && !on.some(Boolean)); return P.confKey(c.sizes) + (c.ideal ? '|i' : ''); }),
      // the points with the same images under the group: a far corner of a flap and the corner of
      // C it mirrors, and the snub's points (images of each other under the rotations)
      orbit: ch.specials.map((sp) => (sp.w === snubW ? 'snub' : sp.w.join())),
    };
    // the corners named by the regular polytopes there (for [p, q])
    if (s.r === 2) {
      const mid = F.px([(A[0][0] + A[1][0] + A[2][0]) / 3, (A[0][1] + A[1][1] + A[2][1]) / 3]), tx = (m) => (m === INF ? '\\infty' : m);
      labelAt(F.px(A[0]), mid, '$\\{' + tx(s.p) + ',' + tx(s.q) + '\\}$');
      labelAt(F.px(A[2]), mid, '$\\{' + tx(s.q) + ',' + tx(s.p) + '\\}$');
    }
    tintCorners();
  }
  // with colours on, a little sector at each corner of C in the colour of the faces round it
  function tintCorners() {
    if (!ch || ch.rank !== 3 || !ch.cornerTint) return;
    ch.cornerTint.textContent = '';
    if (!state.colours) return;
    const A = ch.A;
    for (let k = 0; k < 3; k++) {
      const a = A[k], u = A[(k + 1) % 3], v = A[(k + 2) % 3], r = 0.22 * Math.min(Math.hypot(u[0] - a[0], u[1] - a[1]), Math.hypot(v[0] - a[0], v[1] - a[1]));
      const t0 = Math.atan2(u[1] - a[1], u[0] - a[0]);
      let dt = Math.atan2(v[1] - a[1], v[0] - a[0]) - t0;
      dt -= TAU * Math.round(dt / TAU);
      const pts = [a];
      for (let n = 0; n <= 10; n++) { const t = t0 + dt * n / 10; pts.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]); }
      el('polygon', { points: ptsAttr(pts.map(ch.F.px)), class: 'rp-ch-tint', style: 'fill: var(--' + fill(k) + ')' }, ch.cornerTint);
    }
  }
  // Rank four: a regular tetrahedron for C, x at the mean of its corners weighted by x's walls,
  // turning (a drag on it turns it)
  const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((x) => x / Math.sqrt(3)));
  const tetraAt = (w) => { const t = w.reduce((u, x) => u + x, 0); return [0, 1, 2].map((i) => w.reduce((u, x, k) => u + x * TETRA[k][i], 0) / t); };
  // the weights of a point of space in the tetrahedron's corners (adding up to 1)
  const TETRA_M = [0, 1, 2].map((i) => TETRA.map((c) => c[i])).concat([[1, 1, 1, 1]]);
  const tetraWeights = (Q) => P.solve(TETRA_M, [Q[0], Q[1], Q[2], 1]);
  function build4() {
    const g = group4(state.four.ms), M = g.M;
    Object.assign(ch, { M, g, corners3: TETRA });
    ch.specials = [];
    for (let b = 1; b < 16; b++) { const r = [8, 4, 2, 1].map((m) => +!!(b & m)); ch.specials.push({ w: r }); }
    ch.u = ch.specials.map((sp) => tetraAt(sp.w));
    ch.same = { w: ch.specials.map((sp) => sp.w), orbit: ch.specials.map((sp) => sp.w.join()), at: (i) => ch.px3(ch.u[i]), key: ch.specials.map((sp) => String(P.name4(state.four.ms, sp.w) || sp.w.join(''))) };
    placeTetra();
  }
  // the tetrahedron's picture for its present turn: edges, the corners' names, the dots
  function placeTetra() {
    const R = state.four.wR = tetraTurn(), u = ch.corners3;
    // fitted by the sphere round its corners (so that turning it does not change its size), with
    // room for the names beside them
    const s = Math.min(ch.W / 2 - 46, ch.H / 2 - 28), ox = ch.W / 2, oy = ch.H / 2;
    ch.px3 = (p) => { const q = mv(R, p); return [ox + s * q[0], oy - s * q[1], q[2]]; };
    ch.s3 = s;
    ch.gShapes.textContent = '';
    ch.gDots.textContent = '';
    ch.gLabels.textContent = '';
    const P2 = u.map(ch.px3);
    // the faces, faint, and the edges (behind dashed)
    const faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
    faces.forEach((f) => el('polygon', { points: ptsAttr(f.map((i) => P2[i])), class: 'rp-ch-face' }, ch.gShapes));
    const centre = [0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      // an edge is behind when both faces on it face away
      const others = [0, 1, 2, 3].filter((k) => k !== i && k !== j), back = others.every((k) => {
        const f = [i, j, k], a = mv(R, u[f[0]]), b = mv(R, u[f[1]]), c = mv(R, u[f[2]]), n = cross(b.map((x, t) => x - a[t]), c.map((x, t) => x - a[t])), m = [0, 1, 2].map((t) => (a[t] + b[t] + c[t]) / 3);
        const out = dot(n, m.map((x, t) => x - centre[t])) > 0 ? n : n.map((x) => -x);
        return out[2] < 0;
      });
      el('line', { x1: P2[i][0].toFixed(1), y1: P2[i][1].toFixed(1), x2: P2[j][0].toFixed(1), y2: P2[j][1].toFixed(1), class: back ? 'rp-ch-side back' : 'rp-ch-side' }, ch.gShapes);
    }
    ch.u.forEach((p) => { const q = ch.px3(p); el('circle', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 2.4, class: 'rp-ch-dot' }, ch.gDots); });
    const ms = state.four.ms, t = (m) => m, mid = [ch.W / 2, ch.H / 2];
    const names = ['$\\{' + ms.map(t).join(',') + '\\}$', '$\\mathrm r\\{' + ms.join(',') + '\\}$', '$\\mathrm r\\{' + ms.slice().reverse().join(',') + '\\}$', '$\\{' + ms.slice().reverse().join(',') + '\\}$'];
    u.forEach((p, k) => labelAt(ch.px3(p), mid, names[k]));
    ringSame();
  }
  // The tetrahedron on a turntable, as the solids are: corner 0 (the regular polytope) up, turned
  // about the upright by th and tipped by ph.
  const TETRA_UP = (() => { const u = TETRA[0], d = dot(TETRA[1], u), f = norm(TETRA[1].map((x, i) => -(x - d * u[i]))); return [cross(u, f), u.slice(), f]; })();
  const tetraTurn = () => mm(mm(rotX(state.four.wt.ph), rotY(state.four.wt.th)), TETRA_UP);
  // The special points that give the same picture as the one x is at, ringed in blue (a far
  // corner of a flap and the corner of C it mirrors, the snub's points), and those that give the
  // same shape moved, turned or scaled, in grey (the ends of a symmetric diagram, the corners of
  // [4,4]).
  function ringSame() {
    if (!ch || !ch.same || !ch.gRings) return;
    ch.gRings.textContent = '';
    const S = ch.same, w = ch.rank === 2 ? state.two.w : ch.rank === 3 ? state.three.w : state.four.w, flap = ch.rank === 3 ? state.three.flap : -1;
    const at = S.w.findIndex((v, i) => (!S.flap || S.flap[i] === flap) && v.every((x, j) => Math.abs(x - w[j]) < 1e-6));
    if (at < 0) return;
    S.key.forEach((k, i) => {
      if (i === at || k !== S.key[at]) return;
      const q = S.at(i);
      el('circle', { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 6, class: S.orbit[i] === S.orbit[at] ? 'rp-ch-ring same' : 'rp-ch-ring like' }, ch.gRings);
    });
  }
  // the handle where x is
  function placeChamberHandle() {
    if (!ch) return;
    let q;
    if (ch.rank === 2) q = ch.F.px(complex2().x);
    else if (ch.rank === 3) q = ch.toPx(state.three.w, state.three.flap);
    else q = ch.px3(tetraAt(state.four.w));
    ch.handle.setAttribute('transform', 'translate(' + q[0].toFixed(1) + ',' + q[1].toFixed(1) + ')');
    ch.handle.setAttribute('aria-valuetext', valueText());
    ringSame();
  }
  function valueText() {
    const w = state.kind === 'polygon' ? state.two.w : state.kind === 'space' ? state.four.w : state.three.w;
    const off = w.map((v, i) => (v > 1e-9 ? i : -1)).filter((i) => i >= 0);
    return 'off the walls ' + off.join(', ') + (state.kind === 'sphere' || state.kind === 'plane' || state.kind === 'hyperbolic' ? (state.three.flap >= 0 ? ', in the chamber across wall ' + state.three.flap + ' (the snub)' : '') : '');
  }
  // x to the point of the chamber's picture at (x, y): held at the special points, then on the walls
  const HOLD_PT = () => (coarse() ? 15 : 9), HOLD_WALL = () => (coarse() ? 6 : 4);
  function chamberTo(x, y) {
    if (!ch) return;
    if (ch.rank === 2) {
      const u = ch.F.un(x, y), M = ch.M, a = clamp(Math.atan2(u[1], u[0]), Math.min(ch.a0, ch.a1), Math.max(ch.a0, ch.a1));
      let v = [Math.cos(a), Math.sin(a)];
      for (const sp of ch.specials) { const q = ch.F.px(sp); if (Math.hypot(q[0] - x, q[1] - y) < HOLD_PT()) { v = sp; break; } }
      state.two.w = weights(M.walls(v));
      return;
    }
    if (ch.rank === 3) {
      const s = state.three, P = ch.F.un(x, y), inC = (Q) => [0, 1, 2].every((k) => ch.dist(Q, k) >= -1e-9);
      const where = (Q) => {
        if (inC(Q)) return { flap: -1, P: Q };
        for (let i = 0; i < 3; i++) if (ch.dist(Q, i) < 0) { const R = ch.reflect(Q, i); if (inC(R)) return { flap: i, P: R }; }
        return null;
      };
      let at = where(P);
      if (!at) {
        // beyond the flaps: back towards the middle of C, to the edge of where x may be
        const m = [0, 1].map((i) => (ch.A[0][i] + ch.A[1][i] + ch.A[2][i]) / 3);
        let lo = 0, hi = 1;
        for (let t = 0; t < 30; t++) { const h = (lo + hi) / 2; if (where([m[0] + h * (P[0] - m[0]), m[1] + h * (P[1] - m[1])])) lo = h; else hi = h; }
        at = where([m[0] + lo * (P[0] - m[0]), m[1] + lo * (P[1] - m[1])]) || { flap: -1, P: m };
      }
      let w = weights([0, 1, 2].map((k) => Math.max(0, ch.dist(at.P, k))));
      // the special points, then the walls, within a few pixels
      let held = false;
      for (const sp of ch.specials) {
        const q = ch.toPx(sp.w, sp.flap);
        if (Math.hypot(q[0] - x, q[1] - y) < HOLD_PT()) { w = weights(sp.w); at.flap = sp.flap; held = true; break; }
      }
      if (!held) {
        const k0 = ch.F.s;
        for (let k = 0; k < 3; k++) if (ch.dist(at.P, k) * k0 < HOLD_WALL() && w.some((v, j) => j !== k && v > 1e-9)) { w[k] = 0; if (k === at.flap) at.flap = -1; }
        w = weights(w);
      }
      s.w = w;
      s.flap = at.flap;
      return;
    }
    // rank four: in the plane facing the eye through the handle, then into C (towards its middle
    // until every weight is ≥ 0), held at the special points
    const f = state.four, R = f.wR, s3 = ch.s3, ox = ch.W / 2, oy = ch.H / 2;
    const cur = mv(R, tetraAt(f.w)), Pn = mv(tr(R), [(x - ox) / s3, (oy - y) / s3, cur[2]]), lam = tetraWeights(Pn);
    let t = 1;
    lam.forEach((l) => { if (l < 0) t = Math.min(t, 0.25 / (0.25 - l)); });
    let w = lam.map((l) => Math.max(0, 0.25 + t * (l - 0.25)));
    for (const sp of ch.specials) { const q = ch.px3(tetraAt(sp.w)); if (Math.hypot(q[0] - x, q[1] - y) < HOLD_PT()) { w = sp.w.slice(); break; } }
    f.w = weights(w);
  }
  // the walls of x, scaled to a largest of 1, the small ones 0
  function weights(wv) {
    const p = wv.map((v) => Math.max(0, v)), top = Math.max(...p);
    return p.map((v) => (v < 1e-7 * top ? 0 : v / top));
  }
  let chDrag = null;
  chamberSvg.addEventListener('pointerdown', (e) => {
    if (!ch) return;
    const r = chamberSvg.getBoundingClientRect(), sx = ch.W / r.width, x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sx;
    const onHandle = ch.handle.contains(e.target);
    if (ch.rank === 4 && !onHandle) {
      chDrag = { turn: true, x: e.clientX, y: e.clientY };
    } else {
      chDrag = { turn: false, gx: 0, gy: 0, left: r.left + scrollX, top: r.top + scrollY };
      if (onHandle) { const b = ch.handle.getBoundingClientRect(); chDrag.gx = (e.clientX - (b.left + b.width / 2)) * sx; chDrag.gy = (e.clientY - (b.top + b.height / 2)) * sx; }
      else { morphing = null; chamberTo(x, y); draw(); }
    }
    try { chamberSvg.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
    e.preventDefault();
  });
  chamberSvg.addEventListener('pointermove', (e) => {
    if (!chDrag || !ch) return;
    if (chDrag.turn) {
      const dx = e.clientX - chDrag.x, dy = e.clientY - chDrag.y;
      chDrag.x = e.clientX; chDrag.y = e.clientY;
      const wt = state.four.wt;
      wt.th += dx / 80; wt.ph = clamp(wt.ph + dy / 80, -1.55, 1.55);
      placeTetra();
      placeChamberHandle();
      return;
    }
    // from where the chamber was when it was pressed: if the name above grows and moves it
    // down, x does not jump
    const r = chamberSvg.getBoundingClientRect(), sx = ch.W / r.width;
    morphing = null;
    chamberTo((e.clientX + scrollX - chDrag.left) * sx - chDrag.gx, (e.clientY + scrollY - chDrag.top) * sx - chDrag.gy);
    draw();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => chamberSvg.addEventListener(t, () => { if (chDrag) { chDrag = null; MM.moved(); } }));
  // the keyboard: the arrow keys move x a few pixels in the picture of C
  chamberSvg.addEventListener('keydown', (e) => {
    const step = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step || !ch || !ch.handle.contains(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(ch.handle.getAttribute('transform') || '');
    if (!m) return;
    const d = e.shiftKey ? 1 : 4;
    chamberTo(+m[1] + d * step[0], +m[2] + d * step[1]);
    draw();
  });

  /* ---------- the Coxeter diagram ---------- */
  // A node for each wall, joined with the angle's number between walls at π/m with m > 2 (written
  // for m > 3), ringed where x is off the wall. A click on a node rings it or takes its ring off;
  // x then goes to the point of the new rings.
  function coxeter() {
    const svg = $('coxeter'), k = state.kind;
    const show = k === 'polygon' || ((k === 'sphere' || k === 'plane' || k === 'hyperbolic') && !state.three.special) || (k === 'space' && !state.four.special);
    svg.hidden = !show;
    if (!show) return;
    let ms, w, tri = false, snubbed = false;
    if (k === 'polygon') { ms = [state.two.p]; w = state.two.w; }
    else if (k === 'space') { ms = state.four.ms; w = state.four.w; }
    else { const s = state.three; ms = [s.p, s.q]; w = s.w; tri = s.r !== 2; snubbed = complex3().snubbed; if (tri) ms = [s.p, s.q, s.r]; }
    const n = w.length, rings = w.map((v) => v > 1e-9), key = ms.join(',') + '|' + rings.map(Number).join('') + '|' + snubbed + '|' + tri;
    // the same diagram in Dynkin diagrams
    const link = $('dynkin-link'), code = dynkinCode(k === 'polygon' ? [[1, ms[0]], [ms[0], 1]] : k === 'space' ? P.linear(ms) : P.triangle(state.three.p, state.three.q, state.three.r));
    link.hidden = !code;
    if (code && link.getAttribute('href') !== '/dynkin-diagrams/?t=' + code) link.setAttribute('href', '/dynkin-diagrams/?t=' + code);
    if (svg.dataset.key === key) return;
    svg.dataset.key = key;
    const step = 46, r = 6;
    let pos, bonds;
    if (tri) { pos = [[22, 54], [22 + step / 2, 54 - step * 0.87], [22 + step, 54]]; bonds = [[0, 1, ms[0]], [1, 2, ms[1]], [0, 2, ms[2]]]; }
    else { pos = Array.from({ length: n }, (_, i) => [22 + i * step, 26]); bonds = ms.map((m, i) => [i, i + 1, m]); }
    const Wd = Math.max(...pos.map((p) => p[0])) + 22, Ht = tri ? 70 : 42;
    svg.setAttribute('viewBox', '0 0 ' + Wd + ' ' + Ht);
    svg.style.width = Wd + 'px';
    svg.style.height = Ht + 'px';
    svg.textContent = '';
    const mid = [pos.reduce((s, p) => s + p[0], 0) / n, pos.reduce((s, p) => s + p[1], 0) / n];
    for (const [a, b, m] of bonds) {
      if (m === 2) continue;
      const A = pos[a], B = pos[b], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy);
      MM.svg('line', { x1: A[0] + r * dx / l, y1: A[1] + r * dy / l, x2: B[0] - r * dx / l, y2: B[1] - r * dy / l, class: 'cx-bond' }, svg);
      if (m > 3) {
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ox = mx - mid[0], oy = my - mid[1], ol = Math.hypot(ox, oy);
        const t = MM.svg('text', tri ? { x: mx + 10 * ox / ol, y: my + 10 * oy / ol + 4, class: 'cx-label' } : { x: mx, y: my - 7, class: 'cx-label' }, svg);
        MM.svgLabel(t, '$' + (m === INF ? '\\infty' : m) + '$');
      }
    }
    for (let i = 0; i < n; i++) {
      const g = MM.svg('g', { class: 'cx-node', tabindex: '0', role: 'checkbox', 'aria-checked': String(rings[i]), 'aria-label': 'Wall ' + i + (rings[i] ? ': x is off it' : ': x is on it'), 'data-i': i }, svg);
      MM.svg('circle', { cx: pos[i][0], cy: pos[i][1], r: 11, class: 'cx-hit' }, g);
      if (rings[i] && !snubbed) MM.svg('circle', { cx: pos[i][0], cy: pos[i][1], r: r + 3.2, class: 'cx-ring' }, g);
      MM.svg('circle', { cx: pos[i][0], cy: pos[i][1], r: snubbed ? r : r - 2.2, class: snubbed ? 'cx-dot hollow' : 'cx-dot' }, g);
      MM.svg('circle', { cx: pos[i][0], cy: pos[i][1], r: 13, class: 'focus-ring' }, g);
    }
  }
  // A Coxeter matrix as Dynkin diagrams writes a diagram in a link: as a Cartan matrix (its size,
  // then each bond i–j with |a_ij| and |a_ji| unless both are 1: m = 3, 4, 6, ∞ give products 1, 2,
  // 3, 4), then its bonds with a number (5, 7–12) as ijm5. The bonds 4 and 6 point alternately
  // one way and the other along the diagram (the cubic honeycomb's is C₃⁽¹⁾), so that round a
  // triangle the matrix is symmetrizable, which it can be only with an even number of each:
  // null otherwise (Dynkin diagrams would not see the group in it).
  function dynkinCode(m) {
    const n = m.length, b36 = (i) => i.toString(36), out = [], labels = [], seen = { 4: 0, 6: 0 };
    const cyc = n === 3 && m[0][2] !== 2, order = cyc ? [[0, 1], [1, 2], [2, 0]] : Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
    for (const [i, j] of order) {
      const x = m[i][j];
      if (x === 2) continue;
      const lo = Math.min(i, j), hi = Math.max(i, j), id = b36(lo) + b36(hi);
      if (x === 3) out.push(id);
      else if (x === INF) out.push(id + '22');
      else if (x === 4 || x === 6) {
        const big = x === 4 ? 2 : 3, k = seen[x]++;
        // which node's row has the larger entry: round a triangle, the first of a kind's and then
        // the other's; along a line, the end node's for a single bond (B₃, B₄, G₂⁽¹⁾), the inner
        // node's for two (C₂⁽¹⁾, C₃⁽¹⁾)
        let onI;
        if (cyc) onI = k % 2 === 0;
        else { const two = m.flat().filter((y) => y === x).length > 2, end = i === 0 ? i : j === n - 1 ? j : i; onI = two ? end !== i : end === i; }
        out.push(id + (onI === (i < j) ? big + '1' : '1' + big));
      } else labels.push(id + 'm' + x);
    }
    if (cyc && (seen[4] % 2 || seen[6] % 2)) return null;
    return [String(n)].concat(out, labels).join('.');
  }
  function toggleRing(i) {
    const k = state.kind;
    const cur = k === 'polygon' ? state.two.w : k === 'space' ? state.four.w : state.three.w;
    const w = cur.map((v) => +(v > 1e-9));
    // (rings name a point of C itself: not a snub)
    if (k !== 'polygon' && k !== 'space') state.three.flap = -1;
    w[i] = 1 - w[i];
    if (!w.some(Boolean)) return;
    morph(w);
  }
  $('coxeter').addEventListener('click', (e) => { const g = e.target.closest('.cx-node'); if (g) toggleRing(+g.dataset.i); });
  $('coxeter').addEventListener('keydown', (e) => {
    const g = e.target.closest('.cx-node');
    if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    toggleRing(+g.dataset.i);
    requestAnimationFrame(() => { const n = $('coxeter').querySelector('.cx-node[data-i="' + g.dataset.i + '"]'); if (n) n.focus(); });
  });

  /* ---------- the readouts ---------- */
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  // (names that begin with a proper name keep their capital: the Cairo pentagonal tiling)
  const lower = (s) => (/^\d/.test(s) || /^[A-Z][a-z]*[A-Z]/.test(s) || /^(Cairo|Penrose|Platonic|Archimedean|Catalan|Laves)\b/.test(s) ? s : s[0].toLowerCase() + s.slice(1));
  const plural = (s, n) => (n === 1 ? s : /hedron$/.test(s) ? s.slice(0, -2) + 'a' : /x$/.test(s) ? s + 'es' : /(ss|sh|ch)$/.test(s) ? s + 'es' : s + 's');
  const tex = (n) => (n === INF ? '\\infty' : n);
  const confTex = (c) => '$' + c.sizes.map(tex).join('.') + (c.ideal ? '\\ldots' : '') + '$';
  // a link in the readouts to another example of the page
  function go(spec, text) {
    return '<a href="' + linkFor(spec) + '" data-go="' + MM.esc(JSON.stringify(spec, (k, v) => (v === INF ? 'inf' : v))) + '">' + text + '</a>';
  }
  // a polygon of a face: of kind on walls i, j, from x's walls (a regular one where it is)
  function faceGo(m, wi, wj, sides) {
    if (m === INF) return { rank: 2, p: 0 };
    if (wi < 1e-9 || wj < 1e-9 || Math.abs(wi - wj) < 1e-9 * Math.max(wi, wj)) return { rank: 2, p: sides, w: [1, 0] };
    return { rank: 2, p: m, w: [wi, wj] };
  }
  // the names that say all edges are equal, for a polytope of the same kind whose edges are not
  const UNEQUAL = { Square: 'Rectangle', Cube: 'Rectangular cuboid', 'Square tiling': 'Tiling by squares and rectangles' };
  const named = (nm, uniform) => (!uniform && UNEQUAL[nm]) || nm;
  function polygonWords(sides, regular, n) { const g = P.gon(sides); return (regular || sides === 3 ? g : sides === 4 ? 'rectangle' : g); }
  function about() {
    const k = state.kind;
    if (k === 'polygon') return about2();
    if (k === 'space') return about4();
    return about3();
  }
  function about2() {
    const s = state.two, c = complex2(), sides = c.W.faces[0] ? c.W.faces[0].v.length : 2, uniform = c.on.some(Boolean) || Math.abs(s.w[0] - s.w[1]) < 1e-9;
    // (a rectangle's dual is a rhomb)
    const name = named(cap(P.gon(sides)), uniform), dualOf = uniform ? name : sides === 4 ? 'Rhomb' : 'Dual of the ' + lower(name);
    const rowsOut = [['Edges', '$' + sides + '$'], ['Vertices', '$' + sides + '$']];
    rowsOut.push(['Dual', go({ rank: 2, p: s.p, w: s.w, dual: !s.dual }, s.dual ? 'the ' + lower(name) : uniform ? 'itself' : sides === 4 ? 'a rhomb' : 'a ' + P.gon(sides) + ' with equal sides')]);
    rowsOut.push(['Symmetry', '$[' + s.p + ']$, order $' + 2 * s.p + '$']);
    return { name: s.dual ? dualOf : name, what: s.dual ? (uniform ? 'regular polygon' : 'polygon with equal sides') : uniform ? 'regular polygon' : 'polygon with its vertices alike', rows: rowsOut, legend: [] };
  }
  function about3() {
    const s = state.three, c = complex3(), conf = config3(c), kind = c.kind, W = c.W;
    let name = c.special ? 'Elongated triangular tiling' : P.nameByConfig(kind, conf.sizes);
    if (!name && conf.ideal && conf.sizes.length === 1) name = P.regName(conf.sizes[0], INF);
    if (!name && !conf.sizes.length) name = cap(P.adj(s.p === 2 ? s.q : s.p)) + ' hosohedron';
    const generic = !name, uni = c.uniform;
    if (name) name = named(name, uni);
    // (no name of its own: called by its vertex configuration)
    if (generic) name = (uni ? 'Uniform ' + (kind === 'sphere' ? 'polyhedron ' : 'tiling ') : kind === 'sphere' ? 'Polyhedron ' : 'Tiling ') + confTex(conf);
    const regular = !c.snubbed && (conf.ideal ? conf.sizes.length === 1 : new Set(conf.sizes).size === 1) && uni;
    let what;
    if (kind === 'sphere') what = regular ? 'Platonic solid' : /prism|antiprism/.test(name) ? (uni ? 'uniform polyhedron' : 'polyhedron with its vertices alike') : uni ? (generic ? 'uniform polyhedron' : 'Archimedean solid') : 'polyhedron with its vertices alike';
    else if (kind === 'plane') what = regular ? 'regular tiling' : uni ? 'Archimedean tiling' : 'tiling with its vertices alike';
    else what = regular ? 'regular hyperbolic tiling' : uni ? 'uniform hyperbolic tiling' : 'hyperbolic tiling with its vertices alike';
    const primal = name;
    if (s.dual) {
      const dn = uni ? P.dualName(name) : null;
      name = dn || 'Dual of the ' + lower(name);
      what = kind === 'sphere' ? (regular ? 'Platonic solid' : uni && dn ? 'Catalan solid' : 'polyhedron with its faces alike') : kind === 'plane' ? (regular ? 'regular tiling' : uni ? 'Laves tiling' : 'tiling with its faces alike') : regular ? 'regular hyperbolic tiling' : 'hyperbolic tiling with its faces alike';
      if (regular && kind === 'hyperbolic' && !generic) name = P.regName(...dualPQ(conf));
    }
    // the faces by kind: each a polygon of the dihedral group of two walls
    const rowsOut = [], M = c.M;
    const kinds = new Map();
    for (const f of W.faces) { const e = kinds.get(f.k) || { n: 0, sides: f.open ? INF : f.v.length, f }; e.n++; kinds.set(f.k, e); }
    const finite = kind === 'sphere';
    if (!s.dual) {
      const order = [2, 0, 1, 3].filter((kk) => kinds.has(kk)), merged = new Map();
      order.forEach((kk) => {
        const e = kinds.get(kk);
        let link;
        if (c.special) link = { rank: 2, p: e.sides, w: [1, 0] };
        else if (kk === 3) link = { rank: 2, p: 3, w: [1, 0] };
        else {
          const [i, j] = [0, 1, 2].filter((t) => t !== kk), m = M.m[i][j];
          link = c.snubbed ? { rank: 2, p: m, w: [1, 0] } : faceGo(m, s.w[i], s.w[j], e.sides);
        }
        const regularFace = link.w && (link.w[1] === 0 || link.p === e.sides);
        const word = e.sides === INF ? 'apeirogon' : polygonWords(e.sides, regularFace || c.snubbed || c.special), key = word + JSON.stringify(link);
        const m = merged.get(key) || { n: 0, word, link };
        m.n += e.n;
        merged.set(key, m);
      });
      const parts = [...merged.values()].map((m) => {
        const words = m.word === 'apeirogon' ? 'apeirogons' : plural(m.word, finite ? m.n : 2);
        return (finite ? '$' + m.n + '$ ' : '') + (m.link.p ? go(m.link, words) : words);
      });
      rowsOut.push([finite ? 'Faces' : 'Tiles', parts.join(', ')]);
      if (finite) rowsOut.push(['Edges', '$' + W.edges.length / 3 + '$'], ['Vertices', '$' + W.V + '$']);
    } else {
      const sides = conf.sizes.length, quad = !uni ? 'quadrilaterals' : conf.sizes[0] === conf.sizes[2] && conf.sizes[1] === conf.sizes[3] ? 'rhombs' : 'kites';
      const words = conf.ideal ? 'apeirogons' : { 3: 'triangles', 4: quad, 5: 'pentagons', 6: 'hexagons' }[sides] || sides + '-gons';
      if (finite) rowsOut.push(['Faces', '$' + W.V + '$ ' + words], ['Edges', '$' + W.edges.length / 3 + '$'], ['Vertices', '$' + W.faces.length + '$']);
      else rowsOut.push(['Tiles', words]);
    }
    if (!conf.sizes.length && !c.special) {
      // a hosohedron: n digons (lunes) between two opposite vertices, drawn as their n edges
      const n = s.p === 2 ? s.q : s.p;
      rowsOut.length = 0;
      rowsOut.push(['Faces', '$' + n + '$ digons'], ['Edges', '$' + n + '$'], ['Vertices', '$2$'], ['At each vertex', '$2^{' + n + '}$']);
    } else rowsOut.push([s.dual ? 'Each face' : 'At each vertex', s.dual ? '$\\mathrm V' + confTex(conf).slice(1) : confTex(conf)]);
    const pet = kind === 'sphere' ? petrie3(c) : null;
    if (pet) rowsOut.push(['Petrie polygons', skewWords(pet.h, pet.count)]);
    const degenerate = !c.special && (!conf.sizes.length || conf.sizes.length === 2);
    let dualWords = uni ? P.dualName(primal) : null;
    if (!dualWords && regular && kind === 'hyperbolic' && !generic) dualWords = P.regName(...dualPQ(conf));
    if (!degenerate) rowsOut.push(['Dual', go(Object.assign(specOf3(), { dual: !s.dual }), s.dual ? lower(primal) : dualWords ? lower(dualWords) + (dualWords === primal ? ' (itself)' : '') : 'its dual')]);
    if (!c.special) {
      const order = kind === 'sphere' ? c.g.T.N / (c.snubbed ? 2 : 1) : null;
      const sym = s.r === 2 ? '[' + tex(s.p) + ',' + tex(s.q) + ']' : '(' + tex(s.p) + '\\;' + tex(s.q) + '\\;' + tex(s.r) + ')';
      rowsOut.push(['Symmetry', '$' + sym + (c.snubbed ? '^+' : '') + '$' + (order ? ', order $' + order + '$' : '')]);
    }
    return { name, what, rows: rowsOut, kinds: [...kinds.keys()], primal };
  }
  // the dual {q, p} of a regular tiling {p, q} from its vertex configuration (q = ∞: its vertices at infinity)
  function dualPQ(conf) { return conf.ideal ? [INF, conf.sizes[0]] : [conf.sizes.length, conf.sizes[0]]; }
  function about4() {
    const f = state.four, X = space4(), W = X.W;
    if (f.special) {
      const tetra = !f.dual;
      return {
        name: f.dual ? 'Rhombic dodecahedral honeycomb' : 'Tetrahedral-octahedral honeycomb', what: f.dual ? 'honeycomb with its cells alike' : 'uniform honeycomb',
        rows: f.dual ? [['Cells', go({ rank: 3, p: 4, q: 3, r: 2, w: [0, 1, 0], dual: true }, 'rhombic dodecahedra')], ['Dual', go({ item: 'octet' }, 'tetrahedral-octahedral honeycomb')]]
          : [['Cells', go({ rank: 3, p: 3, q: 3, r: 2, w: [1, 0, 0] }, 'tetrahedra') + ', ' + go({ rank: 3, p: 3, q: 4, r: 2, w: [1, 0, 0] }, 'octahedra')], ['Faces', go({ rank: 2, p: 3, w: [1, 0] }, 'triangles')], ['Dual', go({ item: 'rhombic-dodecahedral-honeycomb' }, 'rhombic dodecahedral honeycomb')]],
        tetra,
      };
    }
    const rings = f.w.map((v) => +(v > 1e-9)), ms = f.ms, M = X.M, finite = X.kind === 'sphere';
    let name = P.name4(ms, rings);
    const regular = rings.filter(Boolean).length === 1 && (rings[0] || rings[3]);
    const uni = uniform4(X);
    const honey = X.kind !== 'sphere';
    let what = (regular && uni ? 'regular ' : uni ? 'uniform ' : '') + (honey ? (X.kind === 'plane' ? 'honeycomb' : 'hyperbolic honeycomb') : '4-polytope') + (uni ? '' : ' with its vertices alike');
    const primal = name;
    // the dual of {p, q, r} is {r, q, p}
    const dualReg = !regular ? null : rings[0] ? P.name4(ms.slice().reverse(), [1, 0, 0, 0]) : P.name4(ms, [1, 0, 0, 0]);
    if (f.dual) {
      name = dualReg || (uni && P.dualName(name)) || 'Dual of the ' + lower(name);
      what = regular ? what : (honey ? 'honeycomb' : '4-polytope') + ' with its cells alike';
    }
    const rowsOut = [], cellNames = {};
    if (!f.dual) {
      // the cells by type: the polyhedra of the three walls other than l (prisms where they fall apart)
      const byType = new Map();
      W.cells.forEach((cl) => byType.set(cl.l, (byType.get(cl.l) || 0) + 1));
      const parts = [3, 0, 1, 2].filter((l) => byType.has(l)).map((l) => {
        const J = [0, 1, 2, 3].filter((i) => i !== l), sub = [J.map((a) => J.map((b) => M.m[a][b]))][0];
        const t = [sub[0][1], sub[1][2], sub[0][2]], wJ = J.map((i) => f.w[i]);
        const Ms = P.model(P.triangle(...t)), on = P.wallsOf(Ms, Ms.point(wJ)), conf = P.vertexConfig(Ms, on);
        const ringed = wJ.filter((v) => v > 1e-9), nm = named(P.nameByConfig('sphere', conf.sizes) || 'Polyhedron', ringed.every((v) => Math.abs(v - ringed[0]) < 1e-6));
        cellNames[l] = lower(nm);
        const n = byType.get(l), words = lower(plural(nm, finite ? n : 2));
        return (finite ? '$' + n + '$ ' : '') + go({ rank: 3, p: t[0], q: t[1], r: t[2], w: wJ }, words);
      });
      rowsOut.push(['Cells', parts.join(', ')]);
      const fk = new Map();
      for (const fc of W.faces) { const key = fc.i + ',' + fc.j; const e = fk.get(key) || { n: 0, sides: fc.v.length, i: fc.i, j: fc.j }; e.n++; fk.set(key, e); }
      const fparts = [...fk.values()].map((e) => {
        const m = M.m[e.i][e.j], link = faceGo(m, f.w[e.i], f.w[e.j], e.sides), reg = link.w[1] === 0 || link.p === e.sides;
        return (finite ? '$' + e.n + '$ ' : '') + go(link, plural(polygonWords(e.sides, reg), finite ? e.n : 2));
      });
      rowsOut.push(['Faces', fparts.join(', ')]);
      if (finite) rowsOut.push(['Edges', '$' + W.edges.length / 3 + '$'], ['Vertices', '$' + W.V + '$']);
    } else if (regular) {
      // the dual of {p, q, r} is {r, q, p}: its cells {r, q}, its faces r-gons
      const d = rings[0] ? ms.slice().reverse() : ms.slice(), cellNm = P.nameByConfig('sphere', Array(d[1]).fill(d[0])) || 'cells';
      cellNames[-1] = lower(cellNm);
      rowsOut.push(['Cells', (finite ? '$' + W.V + '$ ' : '') + go({ rank: 3, p: d[0], q: d[1], r: 2, w: [1, 0, 0] }, lower(plural(cellNm, 2)))]);
      rowsOut.push(['Faces', (finite ? '$' + W.edges.length / 3 + '$ ' : '') + go({ rank: 2, p: d[0], w: [1, 0] }, plural(P.gon(d[0]), 2))]);
      if (finite) rowsOut.push(['Edges', '$' + W.faces.length + '$'], ['Vertices', '$' + W.cells.length + '$']);
    } else if (finite) {
      rowsOut.push(['Cells', '$' + W.V + '$, all alike'], ['Faces', '$' + W.edges.length / 3 + '$'], ['Edges', '$' + W.faces.length + '$'], ['Vertices', '$' + W.cells.length + '$']);
    } else rowsOut.push(['Cells', 'all alike']);
    const pet = petrie4(X);
    if (pet) rowsOut.push(['Petrie polygons', skewWords(pet.h, pet.count)]);
    const dualWords = dualReg || (uni && P.dualName(primal));
    rowsOut.push(['Dual', go(Object.assign(specOf4(), { dual: !f.dual }), f.dual ? lower(primal) : dualWords ? lower(dualWords) + (dualWords === primal ? ' (itself)' : '') : 'its dual')]);
    rowsOut.push(['Symmetry', '$[' + ms.join(',') + ']$' + (finite ? ', order $' + X.g.T.N + '$' : '')]);
    return { name, what, rows: rowsOut, cellNames };
  }
  function uniform4(X) {
    const W = X.W, M = X.M;
    let lo = Infinity, hi = 0;
    for (let i = 0; i < Math.min(W.edges.length, 3 * 300); i += 3) {
      const a = W.edges[i], b = W.edges[i + 1], l = M.far(W.pos.subarray(4 * a, 4 * a + 4), W.pos.subarray(4 * b, 4 * b + 4));
      lo = Math.min(lo, l); hi = Math.max(hi, l);
    }
    return hi - lo < 1e-6 * Math.max(1, hi);
  }
  // While the reader works in the side column (drags x, moves a slider, rings a node), the name
  // and the legend at its head keep the tallest height they have had there: what is under them
  // moves down at most once, and never back up under the finger.
  const nameBlock = $('name-block');
  let lastAbout = '', lastHead = '', sideActive = false, sideHold = 0;
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, (e) => {
    const side = !!(e.target.closest && e.target.closest('.split-side'));
    if (side && !sideActive) sideHold = nameBlock.offsetHeight;
    sideActive = side;
  }, true));
  function readouts() {
    const head = $('name'), legend = $('legend');
    let html, leg = [], kv = [];
    if (state.kind === 'penrose') {
      const p3 = state.pen.tiles === 'p3';
      html = 'Penrose tiling <span class="side-kind">aperiodic tiling</span>';
      if (state.colours) leg = [['swatch', p3 ? 'tile-thick' : 'tile-kite', p3 ? 'thick rhombs' : 'kites'], ['swatch', p3 ? 'tile-thin' : 'tile-dart', p3 ? 'thin rhombs' : 'darts']];
      if (state.pen.arcs) leg.push(['arcs', '', 'arcs of the matching rules']);
      if (state.pen.larger) leg.push(['line', 'pen-larger-2', 'tiles two deflations larger', 3.2], ['line', 'pen-larger-4', 'four deflations larger', 5]);
      if (state.pen.larger) kv.push([p3 ? 'Thick to thin' : 'Kites to darts', '$\\varphi = \\tfrac{1+\\sqrt5}2$']);
    } else {
      const a = about();
      html = MM.rich(a.name) + ' <span class="side-kind">' + a.what + '</span>';
      kv = a.rows;
      const v4 = view4();
      if (state.kind === 'space' && v4 === 'sections' && shownSection) {
        const sc = shownSection, word = (n) => (n === 4 ? 'quadrilateral' : /^\d/.test(P.gon(n)) ? '<span class="tex-nowrap">$' + n + '$-gon</span>' : P.gon(n)), art = (wd) => (/^[aeiou]/.test(wd) ? 'an ' : 'a ') + wd;
        const n0 = [...sc.sides.keys()][0], parts = [...sc.sides.entries()].sort((x, y) => x[0] - y[0]).map(([n, m]) => '$' + m + '$ ' + plural(word(n), m));
        const counts = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
        const linked = (it) => (/^[aeiou]/.test(it.name) ? 'an ' : 'a ') + go(it.spec, it.name);
        const what = !sc.faces ? (sc.verts === 1 ? 'a vertex' : 'an edge')
          : sc.flat ? (sc.regularFace ? 'a ' + go({ rank: 2, p: n0, w: [1, 0] }, P.gon(n0)) : art(word(n0))) + ' of the polytope'
            : sc.is ? linked(sc.is) + ', with ' + counts : counts;
        kv = [['Section', what]].concat(sc.simp ? [['In the hyperplane', '$' + sc.verts + '$ of its vertices, those of ' + linked(sc.simp)]] : [], kv);
        leg = [...sc.kinds].sort((x, y) => (x === 3 ? -1 : y === 3 ? 1 : x - y)).map((l) => ['swatch', CELL4[l], 'where it cuts ' + (/^[aeiou]/.test(a.cellNames[l] || 'c') ? 'an ' : 'a ') + (a.cellNames[l] || 'cell')]);
        if (sc.verts && sc.faces) leg.push(['dot', 'edge', 'its vertices in the hyperplane']);
      } else if (state.kind === 'space' && v4 === 'coxeter') leg = [];
      else if (state.kind === 'space') leg = [['swatch', 'cell-mid', 'the cell in the middle', 'accent']];
      else if (slicing() && shownSlice) {
        const sc = shownSlice, word = (n) => (n === 4 ? 'quadrilateral' : /^\d/.test(P.gon(n)) ? '<span class="tex-nowrap">$' + n + '$-gon</span>' : P.gon(n));
        const what = sc.n === 1 ? 'a vertex' : sc.n === 2 ? 'an edge' : sc.is ? (/^[aeiou]/.test(sc.is.name) ? 'an ' : 'a ') + go(sc.is.spec, sc.is.name) : (/^[aeiou]/.test(word(sc.n)) ? 'an ' : 'a ') + word(sc.n);
        kv = [['Section', what]].concat(kv);
        leg = [['swatch', 'cell-mid', 'the section', 'accent']];
        if (sc.on && sc.n >= 3) leg.push(['dot', 'edge', 'its vertices in the plane']);
      }
      if (state.petrie && petrieCorner() && v4 !== 'sections' && !slicing()) leg.push(['line', 'highlight', 'a Petrie polygon']);
      else if (state.kind !== 'polygon' && state.colours && !slicing()) {
        const s = state.three, kinds = new Set(a.kinds || []);
        if (s.special) leg = [['swatch', 'face-2', 'squares'], ['swatch', 'face-3', 'triangles']];
        else if (!s.dual) {
          const reg = s.r === 2 ? lower((s.q !== INF && P.nameByConfig(complex3().kind, Array(s.q).fill(s.p))) || P.regName(s.p, s.q)) : null;
          const ang = (m) => '$\\pi/' + tex(m) + '$';
          const words = s.r === 2
            ? { 2: (state.kind === 'sphere' ? 'faces of the ' : 'tiles of the ') + reg, 0: 'at its vertices', 1: 'at its edges', 3: 'the snub’s triangles' }
            : { 2: 'round the corners at ' + ang(s.p), 0: 'round the corners at ' + ang(s.q), 1: 'round the corners at ' + ang(s.r), 3: 'the snub’s triangles' };
          leg = [2, 0, 1, 3].filter((kk) => kinds.has(kk)).map((kk) => ['swatch', FACE[kk], words[kk]]);
        } else leg = [['swatch', 'dual-face', 'a face for each vertex of the ' + lower(a.primal)], ['dots', [2, 0, 1].filter((kk) => kinds.has(kk)).map((kk) => FACE[kk]), 'a vertex for each of its faces, in the face’s colour']];
      }
      if (state.mirrors && state.kind !== 'space' && !slicing() && !(state.kind !== 'polygon' && (complex3().snubbed || state.three.special))) leg.push(['line', 'wall-line', 'mirrors']);
    }
    let changed = html !== lastHead;
    lastHead = html;
    MM.setHTML(head, html);
    const legHtml = leg.map(([t, col, words, lw]) => {
      if (t === 'swatch') return '<span class="legend-item"><span class="swatch" style="--c: var(--' + (col === 'cell-mid' ? 'accent' : col) + '); --c-soft: var(--' + (col === 'cell-mid' ? 'cell-mid' : col + '-fill') + ')"></span>' + words + '</span>';
      if (t === 'dot') return '<span class="legend-item"><span class="dot" style="--c: var(--' + col + ')"></span>' + words + '</span>';
      if (t === 'dots') return '<span class="legend-item"><span class="rp-dots">' + col.map((c) => '<span class="dot" style="--c: var(--' + c + ')"></span>').join('') + '</span>' + words + '</span>';
      if (t === 'arcs') return '<span class="legend-item"><svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 9 Q 6 1 11 5" style="stroke: var(--arc-1)"/><path d="M11 5 Q 16 9 21 1" style="stroke: var(--arc-2)"/></svg>' + words + '</span>';
      return '<span class="legend-item"><svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="--c: var(--' + col + ')' + (typeof lw === 'number' ? '; --line-width: ' + lw : '') + '"><path d="M3 5 H19"/></svg>' + words + '</span>';
    }).join('');
    const key = legHtml + JSON.stringify(kv);
    if (key !== lastAbout) {
      lastAbout = key;
      MM.setHTML(legend, legHtml);
      legend.hidden = !legHtml;
      MM.kv($('about'), kv);
      changed = true;
    }
    if (changed) {
      nameBlock.style.minHeight = '';
      if (sideActive) { sideHold = Math.max(sideHold, nameBlock.offsetHeight); nameBlock.style.minHeight = sideHold + 'px'; }
    }
    coxeter();
    seeAlso();
  }
  // a line under the panel to the same group on the other pages
  function seeAlso() {
    const elx = $('see-also'), k = state.kind;
    let key = '';
    if (k === 'space' && !state.four.special) key = state.four.ms.join(',');
    else if ((k === 'sphere' || k === 'plane') && !state.three.special && state.three.r === 2) key = state.three.p + ',' + state.three.q;
    const RS = { '3,3': ['a3', 'A_3'], '4,3': ['b3', 'B_3'], '3,4': ['b3', 'B_3'], '4,4': ['c21', 'C_2^{(1)}'], '3,6': ['g21', 'G_2^{(1)}'], '6,3': ['g21', 'G_2^{(1)}'] };
    const links = [];
    if (RS[key]) links.push('its root system in <a href="/root-systems/?t=' + RS[key][0] + '">Root systems</a>');
    elx.hidden = !links.length;
    const html = links.length ? 'The group $[' + key + ']$: ' + links[0] + '.' : '';
    if (elx.dataset.html !== html) { elx.dataset.html = html; MM.setHTML(elx, html); }
  }
  // the readouts' links: in the page, without loading it again
  $('about').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-go]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    applySpec(JSON.parse(a.dataset.go, (k, v) => (v === 'inf' ? INF : v)));
  });

  /* ---------- examples as specs: what a link, a readout or the strip shows ---------- */
  const specOf3 = () => { const s = state.three; return s.special ? { item: 'elongated-triangular-tiling', dual: s.dual } : { rank: 3, p: s.p, q: s.q, r: s.r, w: s.w.slice(), flap: s.flap, dual: s.dual }; };
  const specOf4 = () => { const f = state.four; return f.special ? { item: f.dual ? 'rhombic-dodecahedral-honeycomb' : 'octet' } : { rank: 4, ms: f.ms.slice(), w: f.w.slice(), dual: f.dual }; };
  const codeOf = (m) => (m === INF ? 'i' : String(m));
  function tOf(spec) {
    if (spec.item) return spec.item;
    if (spec.rank === 2) return 'p' + spec.p;
    if (spec.rank === 3) return 'p' + [spec.p, spec.q].concat(spec.r !== 2 ? [spec.r] : []).map(codeOf).join('.');
    return 'q' + spec.ms.join('.');
  }
  function linkFor(spec) {
    const parts = ['t=' + tOf(spec)];
    if (spec.w) parts.push('w=' + spec.w.map((x) => +x.toFixed(4)).join(','));
    if (spec.dual) parts.push('d=1');
    return '?' + parts.join('&');
  }
  // show what a spec names
  function applySpec(spec) {
    morphing = flight = null;
    if (spec.item === 'octet') { state.kind = 'space'; Object.assign(state.four, { special: 'octet', dual: false, rot: I(4), m: null }); }
    else if (spec.item) { choose(spec.item); if (spec.dual && state.three.special) { state.three.dual = true; draw(); } return; }
    else if (spec.rank === 2) {
      state.kind = 'polygon';
      state.two.p = spec.p;
      state.two.w = (spec.w || [1, 0]).slice();
      state.two.dual = !!spec.dual;
    } else if (spec.rank === 3) {
      const s = state.three, was = state.kind;
      Object.assign(s, { p: spec.p, q: spec.q, r: spec.r === undefined ? 2 : spec.r, special: null, dual: !!spec.dual, t: 0 });
      s.flap = spec.flap === undefined ? -1 : spec.flap;
      const g = group3(s.p, s.q, s.r);
      s.w = spec.w ? spec.w.slice() : weights(g.M.walls(snubPoint(g)));
      state.kind = g.M.kind;
      if (state.kind !== was) { state.L = I(3); state.V = null; }
    } else if (spec.rank === 4) {
      const f = state.four, same = f.ms.join() === spec.ms.join() && !f.special;
      Object.assign(f, { ms: spec.ms.slice(), w: (spec.w || [1, 0, 0, 0]).slice(), dual: !!spec.dual, special: null, m: null, t: 0 });
      if (!same) f.rot = startRot(spec.ms);
      state.kind = 'space';
    }
    syncControls();
    syncZoom();
    draw();
    tick();
  }

  /* ---------- drawing everything ---------- */
  let example = null;
  function draw() {
    const k = state.kind;
    if (k === 'polygon') drawPolygon();
    else if (k === 'sphere') {
      if (state.view3 === 'stereo') drawStereo();
      else {
        if (!flight) state.R3fly = null;
        followUp();
        state.R3 = state.R3fly || turnR3();
        if (state.view3 === 'sections') drawSlices(); else drawSolid();
      }
    } else if (k === 'plane' || k === 'hyperbolic') drawPlane();
    else if (k === 'penrose') drawPenrose();
    else if (view4() === 'coxeter') drawCoxeter();
    else if (view4() === 'sections') drawSections();
    else drawSpace();
    buildChamber();
    placeChamberHandle();
    tintCorners();
    readouts();
    chrome();
    if (example) example.changed();
  }
  // which controls apply
  function chrome() {
    const k = state.kind, three = k === 'sphere' || k === 'plane' || k === 'hyperbolic';
    const v4 = view4(), finite4 = k === 'space' && !state.four.special && space4().kind === 'sphere';
    $('view3-c').hidden = k !== 'sphere';
    $('view4-c').hidden = !finite4;
    $('proj4-c').hidden = !finite4 || v4 !== 'space';
    $('from4-c').hidden = v4 !== 'sections';
    $('from3-c').hidden = !slicing();
    secBlock.hidden = !sectionsShown();
    $('figure').classList.toggle('rp-sections', sectionsShown());
    $('petrie').hidden = !petrieCorner() || v4 === 'sections' || slicing();
    $('mirrors').hidden = k === 'penrose' || k === 'space' || (three && state.three.special) || slicing();
    $('colours').hidden = k === 'space' || slicing();
    $('arcs').hidden = $('larger').hidden = $('tiles-c').hidden = k !== 'penrose';
    $('zoom').hidden = !(k === 'plane' || k === 'penrose' || k === 'space');
    $('pq').hidden = !three || !!state.three.special;
    $('p2-c').hidden = k !== 'polygon';
    // what the sliders set: the Schläfli symbol, or for r > 2 the triangle group
    const sch = $('sch'), tx = (m) => (m === INF ? '\\infty' : m), t3 = state.three;
    sch.hidden = $('pq').hidden && $('p2-c').hidden;
    const schText = k === 'polygon' ? 'Schläfli symbol $\\{p\\} = \\{' + state.two.p + '\\}$'
      : t3.r === 2 ? 'Schläfli symbol $\\{p,q\\} = \\{' + tx(t3.p) + ',' + tx(t3.q) + '\\}$'
        : 'Triangle group $(p\\;q\\;r) = (' + [t3.p, t3.q, t3.r].map(tx).join('\\;') + ')$';
    if (!sch.hidden && sch.dataset.text !== schText) { sch.dataset.text = schText; MM.setHTML(sch, schText); }
    $('rotate').hidden = !((k === 'sphere' && state.view3 !== 'stereo') || (k === 'space' && v4 !== 'coxeter'));
    canvas.setAttribute('aria-label', {
      polygon: 'The polygon', sphere: state.view3 === 'stereo' ? 'The tiling of the sphere, projected stereographically to the plane' : state.view3 === 'sections' ? 'The polyhedron, turning in space, with its section by a plane' : 'The polyhedron, turning in space',
      plane: 'The tiling of the plane', hyperbolic: 'The tiling of the hyperbolic plane, in the Poincaré disc', penrose: 'A Penrose tiling',
      space: k !== 'space' ? '' : v4 === 'coxeter' ? 'The polytope projected to its Coxeter plane' : v4 === 'sections' ? 'The section of the polytope by a hyperplane, turning in space'
        : space4().kind === 'sphere' ? 'The polytope’s boundary in space' : space4().kind === 'plane' ? 'The honeycomb, in space' : 'The honeycomb, in the Poincaré ball',
    }[k]);
    handle.setAttribute('aria-label', 'A point of the space: moving it moves the space');
    if (drag) drag.update();
    light();
  }

  /* ---------- animation ---------- */
  let raf = 0, lastT = 0, morphing = null;
  const visible = MM.whenVisible([stage], (on) => { if (on) tick(); });
  const turning = () => state.rotate && ((state.kind === 'sphere' && state.view3 !== 'stereo') || (state.kind === 'space' && view4() !== 'coxeter'));
  function animating() { return morphing || flight || turning(); }
  function tick() {
    if (raf || !visible()) return;
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    if (morphing) {
      const m = morphing, t = m.dur ? Math.min(1, (now - m.t0) / m.dur) : 1, e = t * t * (3 - 2 * t);
      const w = m.from.map((a, i) => a + e * (m.to[i] - a));
      m.set(t >= 1 ? m.to.slice() : w);
      if (t >= 1) morphing = null;
    }
    if (flight) {
      const f = flight, t = f.dur ? Math.min(1, (now - f.t0) / f.dur) : 1, e = t * t * (3 - 2 * t);
      f.step(e);
      if (t >= 1) { flight = null; if (f.end) f.end(); }
    }
    if (turning() && dt && !dragging && !(drag && drag.active)) {
      // (about the screen's upright axis: the picture turns level, whatever the drags have done)
      if (state.kind === 'sphere') state.turn.th += 0.16 * dt;
      else state.four.turn.th += 0.1 * dt;
    }
    draw();
    if (animating()) tick(); else lastT = 0;
  }
  // x to the point of the rings w, smoothly
  function morph(w) {
    const k = state.kind, target = k === 'polygon' ? state.two : k === 'space' ? state.four : state.three;
    morphing = { from: target.w.slice(), to: w.map(Number), t0: performance.now(), dur: MM.reduceMotion() ? 0 : k === 'space' ? 900 : 520, set: (v) => { target.w = v; } };
    tick();
  }

  /* ---------- choosing what to show ---------- */
  function choose(id) {
    const it = ITEMS.get(id);
    if (!it) return;
    morphing = flight = null;
    if (it.kind === 'penrose') state.kind = 'penrose';
    else if (it.rank === 2) { state.kind = 'polygon'; Object.assign(state.two, { p: it.p, w: it.w.slice(), dual: false }); }
    else if (it.rank === 3 && it.special) { state.kind = 'plane'; state.three.special = it.special; state.three.dual = false; state.V = null; }
    else if (it.rank === 3) {
      const s = state.three, g = group3(it.p, it.q, it.r);
      Object.assign(s, { p: it.p, q: it.q, r: it.r, special: null, dual: !!it.dual, flap: it.snub ? 0 : -1, t: 0 });
      s.w = it.snub ? weights(g.M.walls(snubPoint(g))) : it.w.slice();
      state.kind = g.M.kind;
      state.L = I(3); state.V = null;
    } else {
      const f = state.four;
      // (another polytope: its sections from the middle, t = 0)
      if (it.special) Object.assign(f, { special: it.special, dual: !!it.dual, rot: I(4), m: null, t: 0 });
      else Object.assign(f, { ms: it.ms.slice(), w: it.w.slice(), dual: false, special: null, rot: startRot(it.ms), m: null, t: 0 });
      state.kind = 'space';
    }
    syncControls();
    syncZoom();
    draw();
    tick();
  }
  // the 4D view a polytope starts with: a cell of the regular polytope in the middle
  function startRot(ms) {
    const g = group4(ms);
    if (g.M.kind !== 'sphere') return I(4);
    const c = g.M.corners[3];
    return ortho(turn4(c, [0, 0, 0, -1], Math.acos(clamp(-c[3], -1, 1))));
  }
  function syncControls() {
    $('colours').pressed = state.colours;
    $('mirrors').pressed = state.mirrors;
    $('rotate').pressed = state.rotate;
    $('arcs').pressed = state.pen.arcs;
    $('larger').pressed = state.pen.larger;
    $('view3').value = state.view3;
    $('tiles').value = state.pen.tiles;
    $('proj4').value = state.four.proj;
    $('view4').value = state.four.view;
    $('from4').value = String(state.four.from);
    $('from3').value = String(state.three.from);
    $('petrie').pressed = state.petrie;
    const s = state.three;
    setSlider('p', s.p); setSlider('q', s.q); setSlider('r', s.r);
    setSlider('p2', state.two.p);
    allowSliders();
  }
  // the sliders of p, q, r: 13 stands for ∞
  const toSlider = (m) => (m === INF ? 13 : m), fromSlider = (v) => (+v >= 13 ? INF : +v);
  function setSlider(id, m) { const s = $(id); s.value = toSlider(m); showSlider(s); }
  function showSlider(s) { if (+s.value >= 13) s.show('∞'); }
  function allowSliders() {
    const s = state.three;
    const ok = (p, q, r) => P.geometry(P.triangle(p, q, r)) !== null;
    $('p').allow = (v) => ok(fromSlider(v), s.q, s.r);
    $('q').allow = (v) => ok(s.p, fromSlider(v), s.r);
    $('r').allow = (v) => ok(s.p, s.q, fromSlider(v));
  }

  /* ---------- the strip ---------- */
  const minis = new Map(), drawnFamilies = new Set();
  function itemName(it) {
    if (it.kind === 'penrose') return ['Penrose', 'Penrose tiling'];
    if (it.rank === 2) return ['$\\{' + it.p + '\\}$', cap(P.gon(it.p))];
    if (it.rank === 4) {
      if (it.special) return ['Rhombic', 'Rhombic dodecahedral honeycomb'];
      const nm = P.name4(it.ms, it.w.map(Number));
      return [it.w.join('') === '1000' ? '$\\{' + it.ms.join(',') + '\\}$' : '$\\mathrm{2t}\\{' + it.ms.join(',') + '\\}$', nm];
    }
    if (it.special) return ['$3^3.4^2$', 'Elongated triangular tiling'];
    const M = { m: P.triangle(it.p, it.q, it.r) };
    const on = it.snub ? [false, false, false] : it.w.map((v) => v === 0), conf = P.vertexConfig(M, on, !!it.snub), kind = P.geometry(M.m);
    let nm = P.nameByConfig(kind, conf.sizes) || (conf.ideal ? P.regName(conf.sizes[0], INF) : 'Tiling ' + conf.sizes.join('.'));
    if (it.dual) nm = P.dualName(nm) || 'Dual of the ' + lower(nm);
    let short;
    if (it.r !== 2) short = '$(' + [it.p, it.q, it.r].map(tex).join('\\,') + ')$';
    else if (it.dual) short = '$\\mathrm V' + conf.sizes.map(tex).join('.') + '$';
    else short = '$' + P.symbol3(it.p, it.q, it.w.map((v) => +(v > 0)), !!it.snub) + '$';
    return [short, nm];
  }
  function buildStrip() {
    const box = $('strip');
    for (const fam of Object.keys(LISTS)) for (const ids of LISTS[fam]) {
      const group = document.createElement('div');
      group.className = 'strip-group';
      group.dataset.family = fam;
      box.appendChild(group);
      for (const it of ids) {
        const [short, words] = itemName(it), b = document.createElement('button');
        b.type = 'button'; b.className = 'strip-item'; b.dataset.key = it.id;
        b.setAttribute('aria-label', words);
        b.innerHTML = '<svg aria-hidden="true" viewBox="0 0 44 44" style="width:44px"></svg><span class="strip-name" aria-hidden="true"></span>';
        MM.setHTML(b.lastChild, short);
        group.appendChild(b);
        minis.set(it.id, b);
      }
    }
    const s = MM.strip(box, { pick: (b) => choose(b.dataset.key) });
    $('dim').addEventListener('change', () => { setKindLabels(); showFamily(familyOfControls()); });
    $('geo').addEventListener('change', () => showFamily(familyOfControls()));
    return s;
  }
  // the list's two controls: the rank (2, 3, 4: the number of mirrors) and the kind, named for the rank
  const KINDS = { 3: ['Polyhedra', 'Tilings', 'Hyperbolic'], 4: ['Polytopes', 'Honeycombs', 'Hyperbolic'] };
  function setKindLabels() {
    const d = $('dim').value, geo = $('geo');
    geo.hidden = d === '2';
    if (KINDS[d]) [...geo.querySelectorAll('button')].forEach((b, i) => { if (b.textContent !== KINDS[d][i]) b.textContent = KINDS[d][i]; });
  }
  const familyOfControls = () => { const d = $('dim').value, g = $('geo').value; return d === '2' ? 'polygons' : d === '3' ? { sphere: 'polyhedra', plane: 'plane', hyperbolic: 'hyperbolic' }[g] : 'space-' + g; };
  function showFamily(fam) {
    if (strip.family() !== fam) strip.show(fam);
    drawMinis(fam);
  }
  // the family of what is shown, and the controls set to it
  function familyOfState() {
    const k = state.kind;
    return k === 'polygon' ? 'polygons' : k === 'sphere' ? 'polyhedra' : k === 'plane' || k === 'penrose' ? 'plane' : k === 'hyperbolic' ? 'hyperbolic' : 'space-' + space4().kind;
  }
  function controlsTo(fam) {
    const [d, g] = fam === 'polygons' ? ['2', null] : fam.startsWith('space-') ? ['4', fam.slice(6)] : ['3', { polyhedra: 'sphere', plane: 'plane', hyperbolic: 'hyperbolic' }[fam]];
    if ($('dim').value !== d) $('dim').value = d;
    if (g && $('geo').value !== g) $('geo').value = g;
    setKindLabels();
  }
  // the small pictures of a family, drawn when it is first shown
  function drawMinis(fam) {
    if (drawnFamilies.has(fam)) return;
    drawnFamilies.add(fam);
    for (const ids of LISTS[fam]) for (const it of ids) { try { miniPicture(minis.get(it.id).firstChild, it); } catch (err) { console.warn('Regular polytopes: ' + it.id + ': ' + err.message); } }
  }
  // the item shown, if one is
  function current() {
    const k = state.kind;
    if (k === 'penrose') return ITEMS.get('penrose');
    if (k === 'polygon') return state.two.w.join() === '1,0' && !state.two.dual ? ITEMS.get('polygon-' + state.two.p) : null;
    if (k === 'space') {
      const f = state.four;
      if (f.special) return f.dual ? ITEMS.get('rhombic-dodecahedral-honeycomb') : null;
      return [...ITEMS.values()].find((it) => it.rank === 4 && !it.special && it.ms.join() === f.ms.join() && it.w.join() === f.w.join() && !f.dual) || null;
    }
    const s = state.three;
    if (s.special) return ITEMS.get('elongated-triangular-tiling');
    const c = complex3();
    return [...ITEMS.values()].find((it) => it.rank === 3 && !it.special && it.p === s.p && it.q === s.q && it.r === s.r && !!it.dual === s.dual
      && (it.snub ? c.snubbed && isAt(s.w, snubPoint(group3(s.p, s.q, s.r))) : !c.snubbed && it.w.join() === s.w.join())) || null;
  }
  const isAt = (w, x) => { const g = group3(state.three.p, state.three.q, state.three.r), v = weights(g.M.walls(x)); return v.every((t, i) => Math.abs(t - w[i]) < 1e-6); };
  let litKey = null;
  function light() {
    if (!strip) return;
    const k = state.kind, key = k + '|' + JSON.stringify(k === 'polygon' ? state.two : k === 'space' ? [state.four.ms, state.four.w, state.four.dual, state.four.special] : k === 'penrose' ? state.pen.tiles : [state.three.p, state.three.q, state.three.r, state.three.w, state.three.flap, state.three.dual, state.three.special]);
    if (key === litKey) return;
    litKey = key;
    const it = current(), fam = familyOfState();
    strip.light(it ? minis.get(it.id) : null);
    controlsTo(fam);
    showFamily(fam);
  }
  // Small line pictures of the items, in currentColor.
  function miniPicture(svg, it) {
    const S = 44, elx = MM.svg;
    const path = (d, attrs) => elx('path', Object.assign({ d, fill: 'none', stroke: 'currentColor', 'stroke-width': 1, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, attrs || {}), svg);
    const f2 = (x) => x.toFixed(2);
    if (it.kind === 'penrose') {
      const lv = PEN.cover('p3', PEN.sun('p3', 1), [-1, 1, -1, 1], 3), k = 19;
      let d = '';
      for (const t of lv[3]) {
        const [a, b, c] = t.slice(1).map((p) => [S / 2 + k * p[0], S / 2 - k * p[1]]);
        d += 'M' + f2(b[0]) + ' ' + f2(b[1]) + 'L' + f2(a[0]) + ' ' + f2(a[1]) + 'L' + f2(c[0]) + ' ' + f2(c[1]);
      }
      path(d, { 'stroke-width': 0.8 });
      return;
    }
    if (it.rank === 2) {
      const n = it.p, pts = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + Math.PI / n + TAU * i / n; return [S / 2 + 17 * Math.cos(a), S / 2 - 17 * Math.sin(a)]; });
      path('M' + pts.map((p) => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z', { 'stroke-width': 1.1 });
      return;
    }
    if (it.rank === 3 && it.special) {
      const W = special3(it.special), k = 3.1;
      let d = '';
      for (let i = 0; i < W.edges.length; i += 3) {
        const a = W.edges[i], b = W.edges[i + 1], pa = [S / 2 + k * W.pos[3 * a], S / 2 - k * W.pos[3 * a + 1]], pb = [S / 2 + k * W.pos[3 * b], S / 2 - k * W.pos[3 * b + 1]];
        if (Math.min(Math.hypot(pa[0] - S / 2, pa[1] - S / 2), Math.hypot(pb[0] - S / 2, pb[1] - S / 2)) > 21) continue;
        d += 'M' + f2(pa[0]) + ' ' + f2(pa[1]) + 'L' + f2(pb[0]) + ' ' + f2(pb[1]);
      }
      clipCircle(svg, it.id);
      path(d, { 'stroke-width': 0.9, 'clip-path': 'url(#rp-mini-' + it.id + ')' });
      return;
    }
    if (it.rank === 3) {
      const g = group3(it.p, it.q, it.r), M = g.M, x = it.snub ? snubPoint(g) : M.point(it.w);
      const W = it.snub ? P.snub(g.T, x) : P.wythoff(g.T, x);
      if (M.kind === 'sphere') {
        // the solid, seen a little from above and from the side: the edges of its faces towards the eye
        const faces = it.dual ? P.polar(W).faces : P.planes(W);
        const R = mm(mm(rotX(0.3), rotY(-0.45)), upFrame(M, [it.p, it.q, it.r], !!it.dual, it.snub ? [1, 1, 1] : it.w.map((v) => +(v > 0)))), rho = Math.max(...faces.flatMap((f) => f.pts.map((p) => Math.hypot(...p))));
        const k = 18 / rho, pr = (p) => { const q = mv(R, p); return [S / 2 + k * q[0], S / 2 - k * q[1]]; };
        let d = '';
        const seen = new Set();
        for (const f of faces) {
          if (mv(R, f.n)[2] <= 0.02) continue;
          f.pts.forEach((p, i) => {
            const q = f.pts[(i + 1) % f.pts.length], key = [p, q].map((u) => u.map((v) => v.toFixed(4)).join()).sort().join('|');
            if (seen.has(key)) return;
            seen.add(key);
            const a = pr(p), b = pr(q);
            d += 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'L' + f2(b[0]) + ' ' + f2(b[1]);
          });
        }
        path(d);
        return;
      }
      const disc = M.kind === 'hyperbolic';
      let pos = W.pos, edges = W.edges;
      if (it.dual) {
        const D = P.laves(W), nV = W.V, all = new Float64Array(3 * (nV + D.pos.length)), e2 = [], seen = new Set();
        all.set(W.pos.subarray(0, 3 * nV));
        D.pos.forEach((p, i) => all.set(p, 3 * (nV + i)));
        D.faces.forEach((f) => { for (let i = 0; i < (f.open ? f.v.length - 1 : f.v.length); i++) { const a = f.v[i], b = f.v[(i + 1) % f.v.length], k2 = Math.min(a, b) * 1e6 + Math.max(a, b); if (!seen.has(k2)) { seen.add(k2); e2.push(nV + a, nV + b, 0); } } });
        pos = all; edges = e2;
      }
      const k = disc ? 19 : 5.2, pr = (v) => { if (disc) { const q = toDisc(v); return [S / 2 + k * q[0], S / 2 - k * q[1]]; } return [S / 2 + k * v[0] / v[2], S / 2 - k * v[1] / v[2]]; };
      let d = '';
      for (let i = 0; i < edges.length; i += 3) {
        const a = edges[i], b = edges[i + 1], A = [pos[3 * a], pos[3 * a + 1], pos[3 * a + 2]], B = [pos[3 * b], pos[3 * b + 1], pos[3 * b + 2]];
        const pa = pr(A), pb = pr(B);
        if (disc ? Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) < 0.8 : Math.min(Math.hypot(pa[0] - S / 2, pa[1] - S / 2), Math.hypot(pb[0] - S / 2, pb[1] - S / 2)) > 21) continue;
        d += 'M' + f2(pa[0]) + ' ' + f2(pa[1]);
        const geo = disc && geodesic(A, B);
        if (geo && geo.r * k < 400) {
          const sweep = ((pa[0] - S / 2 - k * geo.x) * (pb[1] - S / 2 + k * geo.y) - (pa[1] - S / 2 + k * geo.y) * (pb[0] - S / 2 - k * geo.x)) > 0 ? 1 : 0;
          d += 'A' + f2(geo.r * k) + ' ' + f2(geo.r * k) + ' 0 0 ' + sweep + ' ' + f2(pb[0]) + ' ' + f2(pb[1]);
        } else d += 'L' + f2(pb[0]) + ' ' + f2(pb[1]);
      }
      if (disc) elx('circle', { cx: S / 2, cy: S / 2, r: 19, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.8, opacity: 0.55 }, svg);
      else clipCircle(svg, it.id);
      path(d, disc ? { 'stroke-width': it.p === 3 || it.q === INF || it.r !== 2 ? 0.4 : 0.6 } : { 'stroke-width': 0.9, 'clip-path': 'url(#rp-mini-' + it.id + ')' });
      return;
    }
    // rank four: the edges in the picture of the space, a cell in the middle, seen from the side
    let pos, edges, kind, frame;
    if (it.special) { const O = P.octet(2.2), D = P.dual4(O); pos = D.pos; edges = D.edges; kind = 'plane'; frame = 2.4; }
    else {
      const ms = it.ms, gk = ms.join(','), M = P.model(ms);
      const T = M.kind === 'sphere' ? group4(ms).T : P.chambers(M, M.kind === 'plane' ? 5 : 2.6, 40000);
      const W = P.wythoff(T, M.point(it.w));
      pos = W.pos; edges = W.edges; kind = M.kind; frame = kind === 'plane' ? 4.2 : 1;
      void gk;
    }
    const R4 = kind === 'sphere' ? mm([[...rotX(0.5)[0], 0], [...rotX(0.5)[1], 0], [...rotX(0.5)[2], 0], [0, 0, 0, 1]], startRot(it.ms)) : null;
    const R3m = mm(rotX(0.45), rotY(-0.4)), k = kind === 'sphere' ? 8.5 : 19 / frame;
    let d = '';
    for (let i = 0; i < edges.length; i += 3) {
      const a = edges[i], b = edges[i + 1], A = [0, 1, 2, 3].map((j) => pos[4 * a + j]), B = [0, 1, 2, 3].map((j) => pos[4 * b + j]);
      const n = kind === 'plane' ? 1 : 6, pts = [];
      let out = false;
      for (let s = 0; s <= n; s++) {
        const v = A.map((x, j) => x + (B[j] - x) * s / n);
        let q;
        if (kind === 'sphere') { const p = mv(R4, norm(v)), dd = 1 - p[3]; q = [p[0] / dd, p[1] / dd]; if (Math.hypot(q[0], q[1]) > 2.4) out = true; }
        else if (kind === 'plane') { const p = mv(R3m, [v[0], v[1], v[2]]); q = [p[0], p[1]]; if (Math.hypot(p[0], p[1], p[2]) > frame) out = true; }
        else { const l = lnorm(v), sq = 1 / (l[3] + 1), p = mv(R3m, [l[0] * sq, l[1] * sq, l[2] * sq]); q = [p[0], p[1]]; if (l[3] > 4) out = true; }
        pts.push([S / 2 + k * q[0], S / 2 - k * q[1]]);
      }
      if (out) continue;
      d += 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
    }
    if (kind === 'hyperbolic') elx('circle', { cx: S / 2, cy: S / 2, r: 19, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.8, opacity: 0.55 }, svg);
    path(d, { 'stroke-width': kind === 'sphere' ? (it.ms.includes(5) ? 0.35 : 0.7) : 0.5 });
  }
  function clipCircle(svg, id) { MM.svg('circle', { cx: 22, cy: 22, r: 19.5 }, MM.svg('clipPath', { id: 'rp-mini-' + id }, MM.svg('defs', {}, svg))); }

  /* ---------- turning, moving and zooming the picture ---------- */
  let dragging = false, grab = [0, 0];
  handle.addEventListener('pointerdown', (e) => {
    const b = handle.getBoundingClientRect();
    grab = [e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)];
    try { handle.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
    dragging = true;
    flight = null;
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging || state.kind !== 'space') return;
    const r = stage.getBoundingClientRect();
    pull(e.clientX - grab[0] - r.left, e.clientY - grab[1] - r.top);
    draw();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => handle.addEventListener(t, () => {
    if (!dragging) return;
    dragging = false;
    recentre4();
    // (the handle glides back to the middle)
    if (!MM.reduceMotion()) { handle.classList.add('rp-return'); setTimeout(() => handle.classList.remove('rp-return'), 300); }
    MM.moved();
    draw();
    tick();
  }));
  // the keyboard: the arrow keys pull the space a few pixels
  handle.addEventListener('keydown', (e) => {
    const step = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step || e.altKey || e.ctrlKey || e.metaKey || state.kind !== 'space' || view4() !== 'space') return;
    e.preventDefault();
    const b = handle.getBoundingClientRect(), r = stage.getBoundingClientRect(), d = e.shiftKey ? 2 : 10;
    dragging = true;
    pull(b.left + b.width / 2 - r.left + d * step[0], b.top + b.height / 2 - r.top + d * step[1]);
    dragging = false;
    recentre4();
    draw();
  });
  let hold = null;
  const drag = MM.turnDrag(stage, {
    when: (e) => !(e && e.target && handle.contains(e.target)) && state.kind !== 'polygon' && !(state.kind === 'space' && view4() === 'coxeter'),
    start: () => { hold = null; },
    end: () => { hold = null; tick(); },
    move(dx, dy, e) {
      const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (state.kind === 'sphere' && state.view3 !== 'stereo') { const K = Math.min(r.width, r.height) / 2; turnBy(dx / K, dy / K); }
      else if (state.kind === 'space') {
        const K = Math.min(r.width, r.height) / 2;
        turnBy4(dx / K, dy / K);
      } else if (state.kind === 'sphere') moveSphere(x - dx, y - dy, x, y);
      else if (state.kind === 'hyperbolic') moveDisc(x - dx, y - dy, x, y);
      else if (state.kind === 'plane') pan(dx, dy);
      else if (state.kind === 'penrose') panPenrose(dx, dy);
      draw();
    },
    keys: {
      turn(a, b) {
        if (state.kind === 'sphere' && state.view3 !== 'stereo') turnBy(a, b);
        else if (state.kind === 'space') turnBy4(a, b);
        else if (state.kind === 'sphere') { const w = stage.clientWidth / 2, h = stage.clientHeight / 2; moveSphere(w, h, w + a * 60, h + b * 60); }
        else if (state.kind === 'hyperbolic') { const w = stage.clientWidth / 2, h = stage.clientHeight / 2, k = 60; moveDisc(w, h, w + a * k, h + b * k); }
        else if (state.kind === 'plane') pan(a * 60, b * 60);
        else if (state.kind === 'penrose') panPenrose(a * 60, b * 60);
        draw();
      },
    },
  });
  // the sphere turned under its stereographic picture: the point under (x0, y0) to (x1, y1)
  function moveSphere(x0, y0, x1, y1) {
    const V = stereoView(stage.clientWidth, stage.clientHeight), a = V.back(x0, y0), b = V.back(x1, y1);
    const c = dot(a, b), ax = cross(a, b), l = Math.hypot(...ax);
    if (l < 1e-12) return;
    const u = ax.map((v) => v / l), th = Math.atan2(l, c), C = Math.cos(th), S = Math.sin(th), t = 1 - C;
    const Rm = [[C + u[0] * u[0] * t, u[0] * u[1] * t - u[2] * S, u[0] * u[2] * t + u[1] * S], [u[1] * u[0] * t + u[2] * S, C + u[1] * u[1] * t, u[1] * u[2] * t - u[0] * S], [u[2] * u[0] * t - u[1] * S, u[2] * u[1] * t + u[0] * S, C + u[2] * u[2] * t]];
    state.R3 = ortho(mm(Rm, state.R3));
  }
  // How far the middle of the view is from the corners of C at infinity, compared with ρ's
  // (−⟨c, p⟩ for the point c in C and the corner p on the light cone: it falls to 0 as c goes into
  // the corner). The view is not let in further than CUSP, where the picture is nothing but lines.
  const CUSP = 0.4;
  function cuspRoom(L) {
    if (state.three.special) return Infinity;
    const M = group3(state.three.p, state.three.q, state.three.r).M;
    if (!M.ideal.some(Boolean)) return Infinity;
    const x = M.reduce(lnorm(mv(linv(L), [0, 0, 1]))).x;
    return Math.min(...M.corners.filter((_, k) => M.ideal[k]).map((p) => lor(x, p) / lor(M.rho, p)));
  }
  // the hyperbolic plane moved: the point under (x0, y0) to (x1, y1), as far as the corners at infinity allow
  function moveDisc(x0, y0, x1, y1) {
    const w = stage.clientWidth, h = stage.clientHeight, K = Math.min(w, h) / 2 - 6, cxp = w / 2, cyp = h / 2;
    const toU = (x, y) => { let a = (x - cxp) / K, b = (cyp - y) / K; const rr = Math.hypot(a, b); if (rr > 0.9) { a *= 0.9 / rr; b *= 0.9 / rr; } return [a, b]; };
    const p = toU(x0, y0), q = toU(x1, y1), L0 = state.L, now = cuspRoom(L0);
    const by = (t) => fixL(mm(translation(lift(p), lift([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])), L0));
    const fine = (L) => L.every((row) => row.every(Number.isFinite)) && (cuspRoom(L) >= CUSP || cuspRoom(L) > now);
    let L = by(1);
    if (!fine(L)) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (fine(by(m))) lo = m; else hi = m; }
      L = by(lo);
    }
    state.L = L;
    recentre();
  }
  // the view's middle brought back into C (or the chamber beside it across wall 0) by an element
  // of the group, which does not change the picture: the view stays a small map
  function recentre() {
    if (state.three.special) return;
    if (state.kind === 'hyperbolic') {
      const g = group3(state.three.p, state.three.q, state.three.r), r = g.M.reduce(mv(linv(state.L), [0, 0, 1]));
      if (!r.word.length) return;
      let G = rows(r.G, 3);
      if (r.word.length % 2 && complex3().snubbed) G = mm(G, rows(g.M.S[0], 3));
      state.L = fixL(mm(state.L, G));
    } else if (state.kind === 'plane') {
      const g = group3(state.three.p, state.three.q, state.three.r), V = planeView(stage.clientWidth, stage.clientHeight), mid = V.from(stage.clientWidth / 2, stage.clientHeight / 2), r = g.M.reduce(mid);
      if (!r.word.length) return;
      let G = rows(r.G, 3);
      if (r.word.length % 2 && complex3().snubbed) G = mm(G, rows(g.M.S[0], 3));
      state.V = mm(state.V, G);
    }
  }
  function pan(dx, dy) { state.V = mm([[1, 0, dx], [0, 1, dy], [0, 0, 1]], state.V || baseView(stage.clientWidth, stage.clientHeight)); recentre(); }
  function panPenrose(dx, dy) {
    const pen = state.pen, s = Math.min(stage.clientWidth, stage.clientHeight) / 2 / pen.span, lim = 0.3 * Math.pow(PHI, PEN_LEVELS);
    pen.c = [clamp(pen.c[0] - dx / s, -lim, lim), clamp(pen.c[1] + dy / s, -lim, lim)];
  }
  // zoom by f about the point (x, y) of the canvas
  const PLANE_SPAN = { min: 1.2, max: 14 }, PEN_SPAN = { min: 11, max: 6e4 }, ZOOM4 = 6, ZOOM4_OUT = 0.25; // (rank four: down to a quarter, to see the 5-cell's large cells whole)
  function zoomAt(f, x, y) {
    if (state.kind === 'space') state.four.zoom = clamp(state.four.zoom * f, ZOOM4_OUT, ZOOM4); // (about the middle)
    else if (state.kind === 'plane') {
      const V = state.V || baseView(stage.clientWidth, stage.clientHeight), span = clamp(state.span / f, PLANE_SPAN.min, PLANE_SPAN.max), k = state.span / span;
      state.span = span;
      state.V = mm([[k, 0, x - k * x], [0, k, y - k * y], [0, 0, 1]], V);
      recentre();
    } else if (state.kind === 'penrose') {
      const pen = state.pen, w = stage.clientWidth, h = stage.clientHeight, s0 = Math.min(w, h) / 2 / pen.span;
      const span = clamp(pen.span / f, PEN_SPAN.min, PEN_SPAN.max), s1 = Math.min(w, h) / 2 / span;
      const P0 = [pen.c[0] + (x - w / 2) / s0, pen.c[1] - (y - h / 2) / s0];
      pen.c = [P0[0] - (x - w / 2) / s1, P0[1] + (y - h / 2) / s1];
      pen.span = span;
    } else return;
    syncZoom();
    draw();
  }
  // the zoom slider: a magnification, 1 at the farthest the picture goes out (rank four: 1 as it starts)
  function syncZoom() {
    if (state.kind === 'space') { const z = $('zoom'); z.setAttribute('min', String(ZOOM4_OUT)); z.setAttribute('max', String(ZOOM4)); z.value = state.four.zoom; return; }
    if (state.kind !== 'plane' && state.kind !== 'penrose') return;
    const z = $('zoom'), R = state.kind === 'plane' ? PLANE_SPAN : PEN_SPAN, span = state.kind === 'plane' ? state.span : state.pen.span;
    z.setAttribute('min', '1');
    z.setAttribute('max', String(R.max / R.min));
    z.value = R.max / span;
  }
  $('zoom').addEventListener('input', () => {
    if (state.kind === 'space') { state.four.zoom = clamp(+$('zoom').value, ZOOM4_OUT, ZOOM4); draw(); return; }
    const z = $('zoom'), span = state.kind === 'plane' ? PLANE_SPAN.max / z.value : PEN_SPAN.max / z.value, now = state.kind === 'plane' ? state.span : state.pen.span;
    zoomAt(now / span, stage.clientWidth / 2, stage.clientHeight / 2);
  });
  MM.pinchZoom(stage, {
    zoom: zoomAt,
    pan: (dx, dy) => {
      if (state.kind === 'plane') pan(dx, dy);
      else if (state.kind === 'penrose') panPenrose(dx, dy);
      else if (state.kind === 'hyperbolic') { const w = stage.clientWidth / 2, h = stage.clientHeight / 2; moveDisc(w, h, w + dx, h + dy); }
      else return;
      draw();
    },
  });
  // a mirror under the mouse shows the pointer: a click picks it
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    stage.classList.toggle('on-mirror', !e.buttons && !!mirrorAt(e.clientX - r.left, e.clientY - r.top, 7));
  });
  stage.addEventListener('pointerleave', () => stage.classList.remove('on-mirror'));
  // a click on a mirror picks it; on a cell (rank four), or on a face of a polyhedron, brings it to the middle
  stage.addEventListener('click', (e) => {
    if (drag.moved || handle.contains(e.target)) return;
    const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (state.kind === 'space' && cam3) { if (view4() !== 'space') return; const cell = cellAt(x, y); if (cell) { flyTo(cell); MM.moved(); } }
    else if (state.kind === 'sphere' && state.view3 !== 'sections' && (state.view3 === 'stereo' || cam3)) {
      const m = mirrorAt(x, y, e.pointerType === 'touch' ? 14 : 7), g = complex3().g;
      if (m) { state.mirrorHi = state.mirrorHi && state.mirrorHi.key === m && state.mirrorHi.g === g.key ? null : { g: g.key, key: m }; draw(); return; }
      const u = faceAt(x, y);
      if (u) { centreSphere(u); MM.moved(); }
      else if (state.mirrorHi) { state.mirrorHi = null; draw(); }
    }
  });

  /* ---------- the controls ---------- */
  $('colours').addEventListener('change', (e) => { state.colours = e.detail.pressed; draw(); });
  $('mirrors').addEventListener('change', (e) => { state.mirrors = e.detail.pressed; draw(); });
  $('rotate').addEventListener('change', (e) => { state.rotate = e.detail.pressed; lastT = 0; tick(); draw(); });
  $('arcs').addEventListener('change', (e) => { state.pen.arcs = e.detail.pressed; draw(); });
  $('larger').addEventListener('change', (e) => { state.pen.larger = e.detail.pressed; draw(); });
  $('tiles').addEventListener('change', (e) => { state.pen.tiles = e.detail.value; draw(); });
  $('view3').addEventListener('change', (e) => {
    const was = state.view3;
    state.view3 = e.detail.value;
    if (state.view3 === 'solid' && was === 'stereo') turnFrom(state.R3);
    draw();
    tick();
  });
  $('from3').addEventListener('change', (e) => { state.three.from = +e.detail.value; draw(); tick(); });
  $('proj4').addEventListener('change', (e) => { state.four.proj = e.detail.value; state.four.m = null; draw(); });
  $('view4').addEventListener('change', (e) => { state.four.view = e.detail.value; state.four.m = null; draw(); tick(); });
  $('from4').addEventListener('change', (e) => { state.four.from = +e.detail.value; draw(); });
  // the Petrie polygon: on the solid, which then stands on its axis; in the stereographic
  // picture, with that axis brought to the middle
  $('petrie').addEventListener('change', (e) => {
    state.petrie = e.detail.pressed;
    if (state.petrie && state.kind === 'sphere') {
      const pet = petrie3(complex3());
      if (pet && state.view3 === 'stereo') centreSphere(pet.axis);
    }
    draw();
    tick();
  });
  // p, q, r: another group, x kept by its walls (the same rings, the same proportions)
  ['p', 'q', 'r'].forEach((k) => $(k).addEventListener('input', (e) => {
    const v = fromSlider($(k).value), s = state.three;
    showSlider($(k));
    if (s[k] === v) return;
    const was = state.kind, snub = complex3().snubbed;
    s[k] = v;
    const g = group3(s.p, s.q, s.r);
    if (snub) s.w = weights(g.M.walls(snubPoint(g)));
    state.kind = g.M.kind;
    if (state.kind !== was) { state.L = I(3); state.V = null; }
    if (state.kind === 'hyperbolic') state.L = I(3);
    allowSliders();
    draw();
    tick();
  }));
  $('p2').addEventListener('input', () => { state.two.p = +$('p2').value; draw(); });

  let lastWidth = 0;
  function resize() {
    if (stage.clientWidth !== lastWidth) { lastWidth = stage.clientWidth; nameBlock.style.minHeight = ''; sideActive = false; }
    if (ch) ch.fullKey = '';
    draw();
  }
  new ResizeObserver(resize).observe(stage);
  const strip = buildStrip();
  syncControls();
  syncZoom();
  draw();
  tick();
  MM.onFonts(() => { $('coxeter').dataset.key = ''; if (ch) ch.fullKey = ''; draw(); });

  /* ---------- links, reset and Save image ---------- */
  // a rotation of R⁴ as a pair of unit quaternions (a, b): v ↦ a v b, eight numbers
  const QL = (a) => [[a[0], -a[1], -a[2], -a[3]], [a[1], a[0], -a[3], a[2]], [a[2], a[3], a[0], -a[1]], [a[3], -a[2], a[1], a[0]]];
  const QR = (b) => [[b[0], -b[1], -b[2], -b[3]], [b[1], b[0], b[3], -b[2]], [b[2], -b[3], b[0], b[1]], [b[3], b[2], -b[1], b[0]]];
  const BASIS = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const e = (k) => [0, 1, 2, 3].map((t) => +(t === k)); BASIS.push(mm(QL(e(i)), QR(e(j))).flat()); }
  const rotation4 = {
    write(R) {
      // R = Σ A_ij L(e_i) R(e_j) with A = a bᵀ: solve for A, then a from a column, b from a row
      const A = P.solve(Array.from({ length: 16 }, (_, r) => BASIS.map((col) => col[r])), R.flat());
      let bi = 0;
      for (let t = 1; t < 16; t++) if (Math.abs(A[t]) > Math.abs(A[bi])) bi = t;
      const i = bi >> 2, j = bi & 3;
      let a = norm([0, 1, 2, 3].map((t) => A[4 * t + j])), b = norm([0, 1, 2, 3].map((t) => A[4 * i + t]));
      if (a[i] * b[j] * A[bi] < 0) b = b.map((x) => -x);
      // (−a, −b) is the same rotation: a's first part that is not 0 made positive
      const s = (a.find((x) => Math.abs(x) > 1e-9) || 1) < 0 ? -1 : 1;
      return MM.example.numbers().write(a.concat(b).map((x) => x * s));
    },
    read(str) {
      const q = MM.example.numbers().read(str);
      if (q.length !== 8 || q.some((x) => !Number.isFinite(x))) throw new Error('not a rotation of R⁴: "' + str + '"');
      const a = norm(q.slice(0, 4)), b = norm(q.slice(4));
      return mm(QL(a), QR(b));
    },
  };
  const nums = MM.example.numbers(4);
  example = MM.example({
    fields: { t: 'text', w: nums, f: 'int', d: 'flag', c: 'flag', m: 'flag', r: 'flag', p: 'flag', j: 'text', k: 'int', s: 'number', v: 'rotation', u: rotation4, z: 'number' },
    view: ['v', 'u', 'z'],
    get() {
      const it = current(), k = state.kind;
      let t, w = [1, 0, 0], fl = -1, dd = false;
      if (it) t = it.id;
      else if (k === 'polygon') { t = tOf({ rank: 2, p: state.two.p }); w = state.two.w; dd = state.two.dual; }
      else if (k === 'space') { const sp = specOf4(); t = tOf(sp); w = sp.w || [1, 0, 0, 0]; dd = !!sp.dual && !sp.item; }
      else if (k === 'penrose') t = 'penrose';
      else if (state.three.special) t = 'elongated-triangular-tiling';
      else { const sp = specOf3(); t = tOf(sp); w = sp.w; fl = complex3().snubbed ? sp.flap : -1; dd = sp.dual; }
      if (it && k === 'polygon') w = state.two.w;
      if (it && (k === 'sphere' || k === 'plane' || k === 'hyperbolic') && !state.three.special) { w = state.three.w; fl = complex3().snubbed ? state.three.flap : -1; dd = state.three.dual; }
      if (it && k === 'space') { w = state.four.w; dd = state.four.dual; }
      return {
        t, w, f: fl, d: dd, c: state.colours, m: state.mirrors, r: state.rotate, p: state.petrie,
        j: k === 'sphere' ? state.view3 : k === 'space' ? (state.four.view !== 'space' ? state.four.view : state.four.proj) : k === 'penrose' ? (state.pen.tiles === 'p2' ? 'kites' : 'rhombs') : 'solid',
        k: k === 'sphere' ? state.three.from : state.four.from, s: +(k === 'sphere' ? state.three.t : state.four.t).toFixed(4),
        v: k === 'space' ? state.four.R3 : state.R3, u: state.four.rot,
        z: k === 'plane' ? state.span : k === 'penrose' ? state.pen.span : k === 'space' ? 3.2 * state.four.zoom : 3.2,
      };
    },
    set(x, named) {
      const it = ITEMS.get(x.t);
      const m = /^([pq])([0-9i]+(?:\.[0-9i]+)*)$/.exec(x.t);
      if (!it && !m) return false;
      const num = (s) => (s === 'i' ? INF : +s);
      if (it) choose(it.id);
      else {
        const ns = m[2].split('.').map(num);
        if (m[1] === 'q') {
          if (ns.length !== 3) return false;
          try { group4(ns); } catch (err) { return false; }
          applySpec({ rank: 4, ms: ns, w: [1, 0, 0, 0] });
        } else if (ns.length === 1) {
          if (!(ns[0] >= 2 && ns[0] <= 24)) return false;
          applySpec({ rank: 2, p: ns[0], w: [1, 0] });
        } else {
          if (ns.length > 3 || ns.some((v) => !(v >= 2))) return false;
          const [p, q, r] = [ns[0], ns[1], ns[2] === undefined ? 2 : ns[2]];
          if (!P.geometry(P.triangle(p, q, r))) return false;
          applySpec({ rank: 3, p, q, r, w: [1, 0, 0] });
        }
      }
      const k = state.kind;
      if (named.has('w')) {
        const n = k === 'polygon' ? 2 : k === 'space' ? 4 : 3;
        if (k !== 'penrose' && !(k === 'space' && state.four.special) && !(state.three.special && k === 'plane')) {
          if (x.w.length !== n || x.w.some((v) => !(v >= 0)) || !x.w.some((v) => v > 0)) return false;
          const w = weights(x.w);
          if (k === 'polygon') state.two.w = w; else if (k === 'space') state.four.w = w; else state.three.w = w;
        }
      }
      if (k === 'sphere' || k === 'plane' || k === 'hyperbolic') {
        if (named.has('f')) state.three.flap = x.f >= 0 && x.f <= 2 ? x.f : -1;
        if (named.has('d') || !it) state.three.dual = x.d;
        if (state.three.flap >= 0 && !named.has('w')) { const g = group3(state.three.p, state.three.q, state.three.r); state.three.w = weights(g.M.walls(snubPoint(g))); }
      }
      if (k === 'polygon' && (named.has('d') || !it)) state.two.dual = x.d;
      if (k === 'space' && !state.four.special && (named.has('d') || !it)) state.four.dual = x.d;
      state.colours = x.c;
      state.mirrors = x.m;
      state.rotate = x.r && !MM.reduceMotion();
      if (k === 'sphere') {
        state.view3 = ['stereo', 'sections'].includes(x.j) ? x.j : 'solid';
        state.three.from = x.k >= 0 && x.k <= 2 ? x.k : 0;
        state.three.t = Number.isFinite(x.s) ? clamp(x.s, -1, 1) : 0;
      }
      state.petrie = x.p;
      if (k === 'space') {
        state.four.view = ['coxeter', 'sections'].includes(x.j) ? x.j : 'space';
        state.four.proj = ['stereo', 'persp', 'parallel'].includes(x.j) ? x.j : 'stereo';
        state.four.from = x.k >= 0 && x.k <= 3 ? x.k : 0;
        state.four.t = Number.isFinite(x.s) ? clamp(x.s, -1, 1) : 0;
      }
      if (k === 'penrose') state.pen.tiles = x.j === 'kites' ? 'p2' : 'p3';
      if (named.has('v')) { if (k === 'space') { state.four.turn = turnOf(x.v, upFrame4()); state.four.R3 = turnR3_4(); } else { state.R3 = x.v; if (state.view3 !== 'stereo') turnFrom(x.v); } }
      if (named.has('u') && k === 'space') state.four.rot = x.u;
      if (k === 'space') state.four.zoom = named.has('z') ? clamp(x.z / 3.2, ZOOM4_OUT, ZOOM4) : 1;
      if (named.has('z')) { if (k === 'plane') { state.span = clamp(x.z, PLANE_SPAN.min, PLANE_SPAN.max); state.V = null; } else if (k === 'penrose') state.pen.span = clamp(x.z, PEN_SPAN.min, PEN_SPAN.max); }
      syncControls();
      syncZoom();
      draw();
      tick();
    },
    pictures: () => [{ label: 'The picture', element: stage }].concat(ch ? [{ label: 'The chamber', element: chamberSvg }] : []),
    // for Save image: the views the link does not name
    scene: {
      get: () => ({ L: state.L, V: state.V, span: state.span, c: state.pen.c, wt: Object.assign({}, state.four.wt) }),
      set(sc) {
        Object.assign(state, { L: sc.L, V: sc.V, span: sc.span });
        state.pen.c = sc.c;
        state.four.wt = Object.assign({}, sc.wt);
        draw();
      },
    },
    redraw: () => draw(),
  });
})();
