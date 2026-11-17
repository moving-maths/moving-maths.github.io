// Knots: drawing a diagram that is given only by its crossings (knots.js: { n, seq,
// ov, sign, cut }). No DOM.
//
// First a circle packing. The diagram cuts the sphere into regions. Put a circle at
// every crossing, on every edge and in every region, tangent whenever the two
// things touch; such a packing exists and, with the circles of one chosen region's
// neighbours made as large as can be, is unique up to the motions of the
// hyperbolic plane (Koebe, Andreev, Thurston). The link is drawn through the
// centres of the circles of its crossings and edges.
//
// Then the drawing settles (relax): the curve is a rope that resists bending, keeps
// its length and pushes its strands apart, and is let go a step at a time, each
// step checked (Knots.advance, strict) to leave the diagram as it is.
//
//   KnotLayout.pack(D, outer)       the circles, in the unit disc
//   KnotLayout.control(D, outer)    the points to draw the link through
//   KnotLayout.through(D, Q, opts)  { pts, cut, over }: closed polygons through them
//   KnotLayout.relaxer(knot, opts)  a drawing settling, a step at a time
//   KnotLayout.spline(pts, cut, n)  closed cubic splines through polygons
//   KnotLayout.curve(D, opts)       all of it: a drawing of D
(function (G) {
  'use strict';
  const K = G.Knots;

  // The triangulation: a vertex for each crossing (0 … n − 1), edge (n … 3n − 1) and
  // region (3n …), and round each the vertices it touches, anticlockwise.
  function flowers(D) {
    const n = D.n, F = K.faces(D), { S, tail, head } = K.slots(D), C = (c) => c, E = (e) => n + e, R = (f) => 3 * n + f;
    const fl = [];
    for (let c = 0; c < n; c++) { const f = []; for (let k = 0; k < 4; k++) f.push(E(S[c][k]), R(F.corner[c][k])); fl[C(c)] = f; }
    for (let e = 0; e < 2 * n; e++) {
      const [c1, k1] = tail[e], c2 = head[e][0];
      fl[E(e)] = [C(c1), R(F.corner[c1][(k1 + 3) % 4]), C(c2), R(F.corner[c1][k1])];
    }
    F.list.forEach((cs, f) => { const out = []; for (const [c, j] of cs) out.push(C(c), E(S[c][j])); fl[R(f)] = out; });
    return { fl, F, n };
  }

  // The angle at a circle between two neighbours that touch each other, the three
  // having hyperbolic radii ρ with x = e^(−2ρ) (x = 0: a horocycle).
  function angle(x, y, z) {
    const c = ((1 + x * y) * (1 + x * z) - 2 * x * (1 + y * z)) / ((1 - x * y) * (1 - x * z));
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  // (each diagram's packings are kept: choosing the region outside makes several;
  // `rough` ones, to well within a thousandth, are enough to choose by)
  const PACKS = new WeakMap();
  function pack(D, outer, rough) {
    if (outer === undefined) { const F = K.faces(D); outer = 0; F.list.forEach((cs, f) => { if (cs.length > F.list[outer].length) outer = f; }); }
    let kept = PACKS.get(D);
    if (!kept) PACKS.set(D, (kept = new Map()));
    const key = outer + (rough ? 'r' : '');
    if (!kept.has(key)) { const { fl, F, n } = flowers(D); kept.set(key, packAgain(fl, F, n, fl.length, outer, rough ? 1e-3 : 1e-6)); }
    return kept.get(key);
  }
  function packAgain(fl, F, n, nv, outer, tol) {
    const out = 3 * n + outer, boundary = new Set(fl[out]), inner = [];
    for (let v = 0; v < nv; v++) if (v !== out && !boundary.has(v)) inner.push(v);
    const x = new Array(nv).fill(0.5);
    boundary.forEach((v) => { x[v] = 0; });
    // without the outer region, its neighbours' flowers are open
    const petals = fl.map((f, v) => {
      if (v === out) return [];
      const i = f.indexOf(out);
      return i < 0 ? f.concat([f[0]]) : f.slice(i + 1).concat(f.slice(0, i));
    });
    const sum = (v, xv) => { const f = petals[v]; let t = 0; for (let i = 0; i + 1 < f.length; i++) t += angle(xv, x[f[i]], x[f[i + 1]]); return t; };
    // (to well within what a drawing can show)
    for (let sweep = 0; sweep < 4000; sweep++) {
      let err = 0;
      for (const v of inner) {
        const t = sum(v, x[v]);
        err = Math.max(err, Math.abs(t - 2 * Math.PI));
        // the angle sum grows with x: bisect for 2π
        let lo = 0, hi = 1;
        for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (sum(v, mid) > 2 * Math.PI) hi = mid; else lo = mid; }
        x[v] = (lo + hi) / 2;
      }
      if (err < tol) break;
    }
    // lay the circles out: hyperbolic centres z (for a horocycle, its point at infinity)
    const z = new Array(nv).fill(null), placed = (v) => z[v] !== null;
    const far = (v, u) => { const s = Math.sqrt(x[v] * x[u]); return (1 - s) / (1 + s); };
    // start from the inner vertex farthest from the boundary
    const dist = new Array(nv).fill(-1);
    let queue = Array.from(boundary);
    queue.forEach((v) => { dist[v] = 0; });
    while (queue.length) { const next = []; for (const v of queue) for (const u of fl[v]) if (u !== out && dist[u] < 0) { dist[u] = dist[v] + 1; next.push(u); } queue = next; }
    let root = inner[0];
    for (const v of inner) if (dist[v] > dist[root]) root = v;
    z[root] = [0, 0];
    queue = [root];
    const seen = new Set([root]);
    while (queue.length) {
      const v = queue.shift(), f = petals[v], a = z[v], m = f.length - 1; // f is closed: f[m] = f[0]
      const to = (w) => { const dx = w[0] - a[0], dy = w[1] - a[1], ex = 1 - (a[0] * w[0] + a[1] * w[1]), ey = -(a[0] * w[1] - a[1] * w[0]), d = ex * ex + ey * ey; return [(dx * ex + dy * ey) / d, (dy * ex - dx * ey) / d]; };
      const back = (w) => { const dx = w[0] + a[0], dy = w[1] + a[1], ex = 1 + (a[0] * w[0] + a[1] * w[1]), ey = a[0] * w[1] - a[1] * w[0], d = ex * ex + ey * ey; return [(dx * ex + dy * ey) / d, (dy * ex - dx * ey) / d]; };
      let k = f.findIndex(placed), phi = 0;
      if (k < 0) k = 0; else { const w = to(z[f[k]]); phi = Math.atan2(w[1], w[0]); }
      for (let i = 0; i < m; i++) {
        const u = f[(k + i) % m];
        if (!placed(u)) { const r = far(v, u); z[u] = back([r * Math.cos(phi), r * Math.sin(phi)]); }
        if (!seen.has(u) && !boundary.has(u)) { seen.add(u); queue.push(u); }
        phi += angle(x[v], x[u], x[f[(k + i + 1) % m]]);
      }
    }
    // Move the picture, by a motion of the hyperbolic plane, to where the points at
    // infinity of the boundary circles balance (their centre of mass is the origin):
    // this is the most symmetric position, and does not depend on where the layout began.
    const ideal = Array.from(boundary);
    for (let it = 0; it < 200; it++) {
      let mx = 0, my = 0;
      for (const v of ideal) { mx += z[v][0]; my += z[v][1]; }
      mx /= ideal.length; my /= ideal.length;
      if (Math.hypot(mx, my) < 1e-13) break;
      const a = [mx / 2, my / 2];
      for (let v = 0; v < nv; v++) {
        if (!z[v]) continue;
        const w = z[v], dx = w[0] - a[0], dy = w[1] - a[1], ex = 1 - (a[0] * w[0] + a[1] * w[1]), ey = -(a[0] * w[1] - a[1] * w[0]), d = ex * ex + ey * ey;
        z[v] = [(dx * ex + dy * ey) / d, (dy * ex - dx * ey) / d];
      }
    }
    // as Euclidean circles
    const circles = new Array(nv).fill(null);
    for (const v of inner) {
      const s = (1 - Math.sqrt(x[v])) / (1 + Math.sqrt(x[v])), h = z[v], h2 = h[0] * h[0] + h[1] * h[1], d = 1 - s * s * h2;
      circles[v] = { x: h[0] * (1 - s * s) / d, y: h[1] * (1 - s * s) / d, r: s * (1 - h2) / d };
    }
    boundary.forEach((v) => {
      const u = fl[v].find((w) => circles[w]), c = circles[u], xi = z[v], dx = xi[0] - c.x, dy = xi[1] - c.y;
      const r = (dx * dx + dy * dy - c.r * c.r) / (2 * (dx * xi[0] + dy * xi[1] + c.r));
      circles[v] = { x: (1 - r) * xi[0], y: (1 - r) * xi[1], r };
    });
    return { circles, n, outer };
  }

  // The regions to leave outside, best first: the one that leaves the smallest circle
  // of a crossing or an edge largest, so that nothing is cramped, among the regions a
  // reflection of the shadow keeps, if there are any (then the drawing can be
  // symmetric in a line), and among all (of the five largest, for a diagram of more
  // than eight crossings).
  function outers(D) {
    const n = D.n, mir = mirrored(D), all = K.faces(D).list.map((cs, f) => [cs.length, f]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const best = (list) => {
      let top = -1, face = list.length ? list[0][1] : 0;
      for (const f of (n > 8 ? list.slice(0, 5) : list).map((s) => s[1]).sort((a, b) => a - b)) {
        const P = pack(D, f, true);
        let least = Infinity;
        for (let v = 0; v < 3 * n; v++) least = Math.min(least, P.circles[v].r);
        if (least > top * 1.0001) { top = least; face = f; }
      }
      return face;
    };
    const out = mir.size ? [best(all.filter((s) => mir.has(s[1])))] : [], any = best(all);
    if (!out.includes(any)) out.push(any);
    return out;
  }

  // Where to draw the diagram (in one piece): the centres of the circles of its
  // crossings and edges, in the order each component meets them (crossing, edge,
  // crossing, …), two points for each passage, each with the direction the curve
  // takes there: through a crossing, from where the circle of the edge coming in
  // touches the crossing's circle to where the edge going out does; along an edge,
  // from where its circle touches the crossing behind to where it touches the one
  // ahead. Returns { Q, T }.
  //   outer   the region left outside (by default the first of outers)
  function control(D, outer) {
    const n = D.n, m = 2 * n, cut = D.cut || [0, m];
    const packing = pack(D, outer === undefined ? outers(D)[0] : outer);
    const C = packing.circles, nx = new Array(m), pv = new Array(m);
    for (let c = 0; c + 1 < cut.length; c++) for (let k = cut[c]; k < cut[c + 1]; k++) { nx[k] = k + 1 < cut[c + 1] ? k + 1 : cut[c]; pv[k] = k > cut[c] ? k - 1 : cut[c + 1] - 1; }
    // where circle a touches circle b
    const touch = (a, b) => { const f = a.r / (a.r + b.r); return [a.x + f * (b.x - a.x), a.y + f * (b.y - a.y)]; };
    const unit = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const Q = [], T = [];
    for (let k = 0; k < m; k++) {
      const x = C[D.seq[k]], e = C[n + k], back = C[D.seq[k]], ahead = C[D.seq[nx[k]]];
      Q.push([x.x, x.y], [e.x, e.y]);
      T.push(unit(touch(x, C[n + pv[k]]), touch(x, e)), unit(touch(e, back), touch(e, ahead)));
    }
    return { Q, T };
  }

  // The link through those points: closed polygons along cubic curves through them
  // in those directions (Hermite's; the samples avoid the points themselves, where
  // two strands meet), with which strand is on top at each crossing. Throws if they
  // do not have the diagram D.
  const SUB = 8;
  function through(D, ctrl) {
    const cut = D.cut || [0, 2 * D.n], pts = [], vcut = [0];
    for (let c = 0; c + 1 < cut.length; c++) {
      const q = ctrl.Q.slice(2 * cut[c], 2 * cut[c + 1]), d = ctrl.T.slice(2 * cut[c], 2 * cut[c + 1]), M = q.length;
      for (let i = 0; i < M; i++) {
        const a = q[i], b = q[(i + 1) % M], da = d[i], db = d[(i + 1) % M], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let j = 0; j < SUB; j++) {
          const t = (j + 0.5) / SUB, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
          pts.push([h00 * a[0] + h10 * L * da[0] + h01 * b[0] + h11 * L * db[0], h00 * a[1] + h10 * L * da[1] + h01 * b[1] + h11 * L * db[1]]);
        }
      }
      vcut.push(pts.length);
    }
    // which strand is on top, for the crossings as the polygons have them; and which
    // passage of D each passage of the curve is
    const X = K.crossings(pts, vcut);
    if (X.length !== D.n) throw new Error('the points do not draw this diagram');
    const passage = (t) => { let c = 0; while (vcut[c + 1] <= t) c++; return cut[c] + Math.round((t - vcut[c]) / (2 * SUB)) % (cut[c + 1] - cut[c]); };
    const pass = X.map((x) => [passage(x.a), passage(x.b)]);
    const over = pass.map(([k, k2]) => {
      if (k === k2 || D.seq[k] !== D.seq[k2]) throw new Error('the points do not draw this diagram');
      return D.ov[k] ? 0 : 1;
    });
    return { pts, cut: vcut, over, pass, X };
  }

  // The twists of a diagram: crossings in a row, each joined to the next by a region
  // with two corners. Each is { list: the crossings in order, ring: it closes up }.
  function twists(D) {
    const F = K.faces(D), nb = Array.from({ length: D.n }, () => []);
    for (const f of F.list) if (f.length === 2 && f[0][0] !== f[1][0]) { nb[f[0][0]].push(f[1][0]); nb[f[1][0]].push(f[0][0]); }
    const seen = new Array(D.n).fill(false), out = [];
    for (let c0 = 0; c0 < D.n; c0++) {
      if (seen[c0] || !nb[c0].length) continue;
      // the crossings joined to c0, and an end of the row if it has one
      const group = [c0];
      seen[c0] = true;
      for (let i = 0; i < group.length; i++) for (const d of nb[group[i]]) if (!seen[d]) { seen[d] = true; group.push(d); }
      const ends = group.filter((c) => nb[c].length === 1), list = [ends.length ? ends[0] : c0];
      for (let prev = -1, cur = list[0]; ;) {
        const next = nb[cur].find((d) => d !== prev && !list.includes(d));
        if (next === undefined) break;
        list.push(next);
        prev = cur; cur = next;
      }
      out.push({ list, ring: !ends.length });
    }
    return out;
  }
  // The diagram with each long twist cut down to two or three crossings (as many as
  // it had, less pairs: taking two crossings out of a row is the second move, as far
  // as the drawing goes), and where the pairs were taken out: { E, gaps: [{ u, v,
  // extra }] }, u and v crossings of E either side of a region with two corners into
  // which `extra` crossings go back.
  function untwist(D) {
    const gone = new Set(), gaps = [];
    for (const { list, ring } of twists(D)) {
      const k = list.length;
      if (k < 4) continue;
      const t = k % 2 ? 3 : 2, R = k - t, g = ring ? t : t - 1, sizes = [];
      for (let i = 0; i < g; i++) sizes.push(2 * Math.floor(R / (2 * g)) + (i < (R / 2) % g ? 2 : 0));
      // keep list[0]; then each block of `sizes[i]` goes, and the next one stays
      const kept = [list[0]];
      let at = 1;
      for (let i = 0; i < g; i++) {
        for (let j = 0; j < sizes[i]; j++) gone.add(list[at++]);
        if (i < t - 1) kept.push(list[at++]);
      }
      for (let i = 0; i < g; i++) if (sizes[i]) gaps.push({ u: kept[i], v: kept[(i + 1) % t], extra: sizes[i] });
    }
    if (!gone.size) return { E: D, gaps: [] };
    // the crossings left, numbered in the order the new diagram meets them
    const id = new Array(D.n).fill(-1), E = { n: 0, seq: [], ov: [], sign: [], cut: [0] };
    for (let c = 0; c + 1 < D.cut.length; c++) {
      for (let p = D.cut[c]; p < D.cut[c + 1]; p++) {
        const x = D.seq[p];
        if (gone.has(x)) continue;
        if (id[x] < 0) { id[x] = E.n++; E.sign.push(D.sign[x]); }
        E.seq.push(id[x]); E.ov.push(D.ov[p]);
      }
      E.cut.push(E.seq.length);
    }
    return { E, gaps: gaps.map((q) => ({ u: id[q.u], v: id[q.v], extra: q.extra })) };
  }
  // A drawing of E (from through) with the crossings that untwist took out put back:
  // the two edges round each gap become a twisted pair, along the line between them.
  // Returns { pts, cut } (which strand is on top is for the caller to settle).
  function retwist(drawn, E, gaps) {
    const { pts, cut, X } = drawn, N = pts.length, R = K.ring(N, cut), m = 2 * E.n, param = new Array(m), nx = new Array(m);
    drawn.pass.forEach(([pa, pb], x) => { param[pa] = X[x].a; param[pb] = X[x].b; });
    for (let c = 0; c + 1 < E.cut.length; c++) for (let k = E.cut[c]; k < E.cut[c + 1]; k++) nx[k] = k + 1 < E.cut[c + 1] ? k + 1 : E.cut[c];
    const F = K.faces(E), used = new Set(), cuts = []; // cuts: { from: vertex, to: vertex, add: points }
    // the points of the curve from parameter t0 on to t1, both ends included
    const run = (t0, t1) => {
      const out = [K.pointAt(pts, R, t0)];
      let v = Math.floor(t0);
      if (v !== Math.floor(t1) || t1 < t0) { for (let s = 0; s < N; s++) { v = R.nx[v]; out.push(pts[v]); if (v === Math.floor(t1)) break; } }
      out.push(K.pointAt(pts, R, t1));
      return out;
    };
    // a polyline sampled at fractions s of its length
    const at = (P, s) => {
      const L = [0];
      for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      return s.map((f) => { const x = f * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < x) i++; const g = (x - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [P[i - 1][0] + g * (P[i][0] - P[i - 1][0]), P[i - 1][1] + g * (P[i][1] - P[i - 1][1])]; });
    };
    for (const gap of gaps) {
      const f = F.list.findIndex((cs, i) => !used.has(i) && cs.length === 2 && ((cs[0][0] === gap.u && cs[1][0] === gap.v) || (cs[0][0] === gap.v && cs[1][0] === gap.u)));
      if (f < 0) return null;
      used.add(f);
      const edges = F.list[f].map(([c, j]) => F.S[c][j]), A = edges[0], B = edges[1];
      const pa = run(param[A], param[nx[A]]), pb = run(param[B], param[nx[B]]), flip = E.seq[A] !== E.seq[B];
      const S = Math.max(10, 8 * (gap.extra + 1)), s = Array.from({ length: S + 1 }, (_, j) => j / S);
      const a = at(pa, s), b0 = at(pb, s), b = flip ? b0.slice().reverse() : b0;
      const M = a.map((p, j) => [(p[0] + b[j][0]) / 2, (p[1] + b[j][1]) / 2]), H = a.map((p, j) => [(p[0] - b[j][0]) / 2, (p[1] - b[j][1]) / 2]);
      let len = 0, wide = 0;
      for (let j = 1; j <= S; j++) len += Math.hypot(M[j][0] - M[j - 1][0], M[j][1] - M[j - 1][1]);
      for (const h of H) wide = Math.max(wide, Math.hypot(h[0], h[1]));
      const w = Math.min(0.9 * wide, 0.45 * len / (gap.extra + 1));
      // the normal to the middle line, and which side strand A starts on
      const nrm = (j) => { const p = M[Math.max(0, j - 1)], q = M[Math.min(S, j + 1)], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
      const n1 = nrm(1), side = Math.sign(H[1][0] * n1[0] + H[1][1] * n1[1]) || 1;
      const curve = (sg) => Array.from({ length: S }, (_, j) => {
        const u = (j + 0.5) / S, k = Math.min(S - 1, Math.floor(u * S)), g = u * S - k, mid = [M[k][0] + g * (M[k + 1][0] - M[k][0]), M[k][1] + g * (M[k + 1][1] - M[k][1])], n = nrm(k), h = sg * side * w * Math.sin(Math.PI * (gap.extra + 1) * u);
        return [mid[0] + h * n[0], mid[1] + h * n[1]];
      });
      const na = curve(1), nb = curve(-1);
      cuts.push({ t0: param[A], t1: param[nx[A]], add: na }, { t0: param[B], t1: param[nx[B]], add: flip ? nb.slice().reverse() : nb });
    }
    // the vertices of each edge replaced by its new points
    const drop = new Uint8Array(N), after = new Map();
    for (const c of cuts) {
      const v0 = Math.floor(c.t0), v1 = Math.floor(c.t1);
      if (v0 !== v1 || c.t1 < c.t0) for (let v = R.nx[v0], s = 0; s < N; v = R.nx[v], s++) { drop[v] = 1; if (v === v1) break; }
      after.set(v0, c.add);
    }
    const out = [], ocut = [0];
    for (let c = 0; c + 1 < cut.length; c++) {
      for (let v = cut[c]; v < cut[c + 1]; v++) { if (!drop[v]) out.push(pts[v]); if (after.has(v)) for (const p of after.get(v)) out.push(p); }
      ocut.push(out.length);
    }
    return { pts: out, cut: ocut };
  }

  // closed cubic splines through the vertices of each component, sampled at about
  // `n` points to a unit of length (by chord length along each)
  function spline(pts, cut, n) {
    cut = cut || [0, pts.length];
    const out = [], ocut = [0];
    for (let c = 0; c + 1 < cut.length; c++) {
      const P = pts.slice(cut[c], cut[c + 1]), m = P.length, s = [0];
      for (let i = 0; i < m; i++) { const q = P[(i + 1) % m]; s.push(s[i] + Math.hypot(q[0] - P[i][0], q[1] - P[i][1])); }
      const L = s[m], xs = s.slice(0, m), Mx = K.periodicSpline(xs, P.map((p) => p[0]), L), My = K.periodicSpline(xs, P.map((p) => p[1]), L);
      const N = Math.max(12, Math.round(L * n));
      let k = 0;
      for (let i = 0; i < N; i++) {
        const u = L * i / N;
        while (k + 1 < m && xs[k + 1] <= u) k++;
        const k1 = (k + 1) % m, h = (k + 1 < m ? xs[k + 1] : L) - xs[k], A = ((k + 1 < m ? xs[k + 1] : L) - u) / h, B = (u - xs[k]) / h;
        const val = (v, M) => A * v[k] + B * v[k1] + ((A ** 3 - A) * M[k] + (B ** 3 - B) * M[k1]) * h * h / 6;
        out.push([val(P.map((p) => p[0]), Mx), val(P.map((p) => p[1]), My)]);
      }
      ocut.push(out.length);
    }
    return { pts: out, cut: ocut };
  }

  /* ---------- symmetry ---------- */

  // The symmetries of the shadow of a diagram in one piece (the curve on the sphere,
  // without over and under): the maps of its crossings to crossings, and of their
  // ends to ends, that take every edge to an edge, keeping the order round each
  // crossing (rev false, a turn) or reversing it (rev true, a reflection). Each is
  // { rev, cmap, off }: crossing c goes to cmap[c] and its end j to endOf(s, c, j).
  // The identity comes first.
  const endOf = (s, c, j) => (s.rev ? (((s.off[c] - j) % 4) + 4) % 4 : (j + s.off[c]) % 4);
  function symmetries(D) {
    const n = D.n, out = [];
    if (!n) return out;
    const { S, tail, head } = K.slots(D), other = (c, j) => { const e = S[c][j], t = tail[e]; return t[0] === c && t[1] === j ? head[e] : t; };
    for (const rev of [false, true]) for (let c1 = 0; c1 < n; c1++) for (let j1 = 0; j1 < 4; j1++) {
      const s = { rev, cmap: new Int32Array(n).fill(-1), off: new Int32Array(n) }, used = new Uint8Array(n), queue = [0];
      s.cmap[0] = c1; s.off[0] = j1; used[c1] = 1;
      let ok = true;
      while (queue.length && ok) {
        const c = queue.shift();
        for (let j = 0; j < 4 && ok; j++) {
          const [d, k] = other(c, j), [d2, k2] = other(s.cmap[c], endOf(s, c, j));
          if (s.cmap[d] < 0) {
            if (used[d2]) ok = false;
            else { s.cmap[d] = d2; used[d2] = 1; s.off[d] = rev ? (k2 + k) % 4 : (k2 - k + 4) % 4; queue.push(d); }
          } else if (s.cmap[d] !== d2 || endOf(s, d, k) !== k2) ok = false;
        }
      }
      if (ok && s.cmap.every((c) => c >= 0)) out.push(s);
    }
    return out;
  }
  // where a symmetry takes each region (as faces lists them)
  function regionMap(s, F) {
    return F.list.map((cs) => { const [c, j] = cs[0]; return F.corner[s.cmap[c]][s.rev ? (((s.off[c] - j - 1) % 4) + 4) % 4 : (j + s.off[c]) % 4]; });
  }
  // where it takes each edge (edge k runs from passage k to the next), with 1 if it
  // keeps the edge's direction and −1 if it turns it round
  function edgeMap(s, D) {
    const { S, tail } = K.slots(D), out = [];
    for (let e = 0; e < 2 * D.n; e++) { const [c, j] = tail[e], c2 = s.cmap[c], j2 = endOf(s, c, j), e2 = S[c2][j2], t = tail[e2]; out.push([e2, t[0] === c2 && t[1] === j2 ? 1 : -1]); }
    return out;
  }
  // the regions that a reflection of the shadow leaves where they are
  function mirrored(D) {
    const F = K.faces(D), fixed = new Set();
    for (const s of symmetries(D)) if (s.rev) regionMap(s, F).forEach((g, f) => { if (g === f) fixed.add(f); });
    return fixed;
  }

  /* ---------- the drawing settling ---------- */

  // The drawing settling: an object with step(k), which takes k small steps and says
  // whether anything moved; result(n, turn), the drawing as it is, turned by `turn`,
  // smooth, with about n vertices to a unit of length, fitted to [−0.78, 0.78]²; and
  // turn(), the angle that puts an axis of symmetry upright.
  // The curve is a rope of edges of about unit length, at least six on each edge of
  // the diagram (from a crossing to the next along a strand) and more on the longer
  // ones, about `per` to a crossing in all. Its energy is
  //   Σ |p₋₁ − 2p + p₊₁|² (bending)  +  Σ (|edge| − 1)² (keeping its length)
  //   + Σ 1/|p − q| over pairs of vertices far apart along it, up to a range of
  //     twenty edges (strands pushing apart; not the two strands at a crossing)
  //   + Σ |p − c|² (a pull towards the middle c, which keeps the outer loops in)
  //   + Σ 1/|x − y| over pairs of crossings (crossings pushing apart)
  //   + Σ cos² of the angle at each crossing (strands crossing square on)
  //   + small regions pressing outwards,
  // and each step goes down it by at most a third of an edge, and is checked
  // (Knots.advance, strict) to leave the diagram as it is. The pushes reach far
  // enough to round the picture out; the pull keeps it compact, with its strands
  // evenly spread, and the six vertices on every edge let a twist open out. The rope
  // is stiff (bending weighted 2.5, the strands' push 2, the right angles only 0.05):
  // its bends are long and even and its straight parts straight, and three rings
  // come out nearly round; a softer rope wanders between the strands that push it.
  // Where the shadow has symmetries that keep the region outside where it is (a
  // reflection, or a turn), every step is made symmetric too, by averaging it over
  // them: the energy alone has no preferred direction and a drawing near a
  // symmetric one would settle anywhere near it.
  //   opts.steps (for piece and curve), per, minArc, bend, repel, range, gravity,
  //   cross, crossRange, square, press, small, smallTwo: the weights above;
  //   momentum, how much of each step carries on into the next (0.8)
  function relaxer(knot, opts) {
    opts = opts || {};
    const per = opts.per || 11, minArc = opts.minArc || 6, n = (knot.X || K.crossings(knot.pts, knot.cut)).length;
    let G = null; // the symmetries kept: { syms, edges: each one's edge map }
    // The drawing with its vertices spread along each edge of the diagram, about `m`
    // to a crossing in all, at least minArc on each and the same number on edges
    // that a symmetry swaps, in units of about an edge; null if that does not keep
    // the diagram. Each vertex knows its edge and its place along it (meta).
    function sample(src, m) {
      const cut0 = src.cut || [0, src.pts.length], X0 = src.X || K.crossings(src.pts, cut0), V = K.visits(X0), pts = [], cut = [0], meta = [], comps = [];
      let sumL = 0;
      for (let c = 0; c + 1 < cut0.length; c++) {
        const P = src.pts.slice(cut0[c], cut0[c + 1]), s = [0];
        for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; s.push(s[i] + Math.hypot(q[0] - P[i][0], q[1] - P[i][1])); }
        comps.push({ P, s, L: s[P.length] });
        sumL += s[P.length];
      }
      const u = sumL / Math.max(14 * comps.length, Math.round(m * n + 16 * comps.length)), edges = [];
      comps.forEach(({ s, L }, c) => {
        const lo = cut0[c], arc = (t) => { const k = Math.floor(t) - lo, f = t - Math.floor(t); return s[k] + f * (s[k + 1] - s[k]); };
        const ks = [];
        V.forEach((v, k) => { if (v.t >= lo && v.t < cut0[c + 1]) ks.push(k); });
        ks.forEach((k, i) => { const a = arc(V[k].t), b = i + 1 < ks.length ? arc(V[ks[i + 1]].t) : arc(V[ks[0]].t) + L; edges[k] = { c, a, len: b - a }; });
      });
      let count = edges.map((e) => Math.max(minArc, Math.round(e.len / u)));
      if (G) { const c2 = count.slice(); for (const map of G.edges) map.forEach(([e2], e) => { c2[e] = Math.max(c2[e], count[e2]); }); count = c2; }
      comps.forEach(({ P, s, L }, c) => {
        const at = (x) => { let k = 0; while (k + 1 < P.length && s[k + 1] <= x) k++; const f = (x - s[k]) / ((s[k + 1] - s[k]) || 1), q = P[(k + 1) % P.length]; return [(P[k][0] + f * (q[0] - P[k][0])) / u, (P[k][1] + f * (q[1] - P[k][1])) / u]; };
        // (from the first vertex of the component, as the curve has it, so that the crossings keep their order)
        const out = [];
        edges.forEach((e, k) => { if (e.c === c) for (let j = 0; j < count[k]; j++) out.push({ x: (((e.a + e.len * (j + 0.5) / count[k]) % L) + L) % L, k, j }); });
        out.sort((p, q) => p.x - q.x);
        for (const o of out) { pts.push(at(o.x)); meta.push([o.k, o.j]); }
        cut.push(pts.length);
      });
      const X = K.crossings(pts, cut);
      if (X.length !== n) return null;
      // the same crossings in the same order: the same bits
      const D0 = K.diagram(src.pts, src.over, X0, cut0), D1 = K.diagram(pts, src.over, X, cut);
      if (D1.seq.join() !== D0.seq.join() || D1.sign.join() !== D0.sign.join()) return null;
      return { pts, cut, over: src.over.slice(), X, meta, count };
    }
    const levels = [per, 1.5 * per, 2.2 * per, 3.3 * per, 5 * per];
    let state = null, level = 0;
    for (; level < levels.length && !state; level++) state = sample(knot, levels[level]);
    level--;
    if (!state) return null;
    let N = 0, R = null, cut = null, perm = null;
    // Each region as a loop of vertices (a crossing c as −1 − c) round it,
    // anticlockwise, and its area: the region outside runs clockwise, and its area
    // comes out negative.
    function regions(P, X) {
      const D = K.diagram(P, state.over, X, cut), Fc = K.faces(D), { tail } = K.slots(D), V = K.visits(X), nxp = new Int32Array(V.length);
      for (let c = 0; c + 1 < D.cut.length; c++) for (let k = D.cut[c]; k < D.cut[c + 1]; k++) nxp[k] = k + 1 < D.cut[c + 1] ? k + 1 : D.cut[c];
      const at = (q) => (q >= 0 ? P[q] : [X[-1 - q].x, X[-1 - q].y]);
      return { D, F: Fc, at, list: Fc.list.map((corners) => {
        const loop = [];
        for (const [c, j] of corners) {
          const e = Fc.S[c][j], fwd = tail[e][0] === c && tail[e][1] === j, t0 = V[fwd ? e : nxp[e]].t, t1 = V[fwd ? nxp[e] : e].t;
          loop.push(-1 - c);
          if (fwd) { for (let v = R.nx[Math.floor(t0)], s = 0; s < N && v !== R.nx[Math.floor(t1)]; v = R.nx[v], s++) loop.push(v); }
          else { for (let v = Math.floor(t0), s = 0; s < N && v !== Math.floor(t1); v = R.pv[v], s++) loop.push(v); }
        }
        let A = 0;
        for (let i = 0; i < loop.length; i++) { const p = at(loop[i]), q = at(loop[(i + 1) % loop.length]); A += p[0] * q[1] - q[0] * p[1]; }
        return { loop, A: A / 2, two: corners.length === 2 };
      }) };
    }
    // for each symmetry kept, where it takes each vertex
    function perms() {
      if (!G) return null;
      const idx = new Map();
      state.meta.forEach(([k, j], v) => idx.set(k * 4096 + j, v));
      const out = G.edges.map((map) => state.meta.map(([k, j]) => { const [k2, dir] = map[k]; return idx.get(k2 * 4096 + (dir > 0 ? j : state.count[k] - 1 - j)); }));
      return out.every((p) => p.every((v) => v !== undefined)) ? out : null;
    }
    const setup = () => { N = state.pts.length; cut = state.cut; R = K.ring(N, cut); perm = perms(); };
    setup();
    // the symmetries of the shadow that keep the region outside where it is
    {
      const rg = regions(state.pts, state.X), outer = rg.list.findIndex((r) => r.A < 0), keep = symmetries(rg.D).filter((s) => regionMap(s, rg.F)[outer] === outer);
      if (outer >= 0 && keep.length > 1) {
        G = { syms: keep, edges: keep.map((s) => edgeMap(s, rg.D)) };
        const again = sample(state, levels[level]);
        if (again) { state = again; setup(); }
        if (!perm) G = null;
      }
    }
    // The motions of the plane that the symmetries kept are, fitted to the points T
    // about their centre: for a turn, by the multiple of 2π/k (k the number of turns)
    // nearest the best fit; for a reflection, the reflection in the best-fitting line
    // through the first reflection, after a turn.
    function motions(T) {
      let cx = 0, cy = 0;
      for (const p of T) { cx += p[0]; cy += p[1]; }
      cx /= T.length; cy /= T.length;
      const q = T.map((p) => [p[0] - cx, p[1] - cy]), k = G.syms.filter((s) => !s.rev).length, out = new Array(G.syms.length);
      G.syms.forEach((s, g) => {
        if (s.rev) return;
        let a = 0, b = 0;
        q.forEach((p, v) => { const w = q[perm[g][v]]; a += p[0] * w[1] - p[1] * w[0]; b += p[0] * w[0] + p[1] * w[1]; });
        out[g] = { turn: 2 * Math.PI * Math.round(Math.atan2(a, b) * k / (2 * Math.PI)) / k };
      });
      const r = G.syms.findIndex((s) => s.rev);
      if (r >= 0) {
        let A = 0, B = 0;
        q.forEach((p, v) => { const w = q[perm[r][v]]; A += w[0] * p[0] - w[1] * p[1]; B += w[0] * p[1] + w[1] * p[0]; });
        const th = Math.atan2(B, A) / 2;
        G.syms.forEach((s, g) => {
          if (!s.rev) return;
          // g = h∘r for the turn h that takes v to g(r(v))
          const hp = perm[g].map((_, v) => perm[g][perm[r][v]]), h = G.syms.findIndex((t, i) => !t.rev && perm[i].every((x, v) => x === hp[v]));
          out[g] = { axis: th + (h >= 0 ? out[h].turn : 0) / 2 };
        });
      }
      return { cx, cy, q, out };
    }
    // the points T made symmetric: each the mean of the images of its images
    function symmetric(T) {
      const { cx, cy, q, out } = motions(T), acc = T.map(() => [0, 0]);
      out.forEach((m, g) => {
        // the inverse motion, on the image of each vertex
        const c = Math.cos(m.turn !== undefined ? m.turn : 2 * m.axis), s = Math.sin(m.turn !== undefined ? m.turn : 2 * m.axis);
        q.forEach((_, v) => {
          const w = q[perm[g][v]];
          if (m.turn !== undefined) { acc[v][0] += c * w[0] + s * w[1]; acc[v][1] += -s * w[0] + c * w[1]; }
          else { acc[v][0] += c * w[0] + s * w[1]; acc[v][1] += s * w[0] - c * w[1]; }
        });
      });
      return acc.map((a) => [cx + a[0] / out.length, cy + a[1] / out.length]);
    }
    const kb = opts.bend || 2.5, ks = 2.0, kr = opts.repel || 2, kc = opts.cross || 6, ka = opts.square || 0.05, kg = opts.gravity === undefined ? 0.006 : opts.gravity, kp = opts.press === undefined ? 1 : opts.press;
    const r0 = opts.range || 20, rc = opts.crossRange || 12, i0 = 1 / (r0 * r0), ic = 1 / (rc * rc), SOFT = 0.1;
    const far = (i, j) => { if (R.cp[i] !== R.cp[j]) return true; const L = cut[R.cp[i] + 1] - cut[R.cp[i]], d = Math.abs(i - j); return Math.min(d, L - d) > 3; };
    // the pairs of vertices at the ends of the two edges that cross at each crossing
    const crossPairs = (X) => { const skip = new Set(); for (const x of X) { const i = Math.floor(x.a), j = Math.floor(x.b); for (const u of [i, R.nx[i]]) for (const v of [j, R.nx[j]]) skip.add(Math.min(u, v) * N + Math.max(u, v)); } return skip; };
    function forces(P, X) {
      const F = P.map(() => [0, 0]);
      let cx = 0, cy = 0;
      for (const p of P) { cx += p[0]; cy += p[1]; }
      cx /= N; cy /= N;
      for (let i = 0; i < N; i++) {
        const a = P[R.pv[R.pv[i]]], b = P[R.pv[i]], p = P[i], c = P[R.nx[i]], d = P[R.nx[R.nx[i]]];
        F[i][0] -= kb * (a[0] - 4 * b[0] + 6 * p[0] - 4 * c[0] + d[0]);
        F[i][1] -= kb * (a[1] - 4 * b[1] + 6 * p[1] - 4 * c[1] + d[1]);
        const dx = c[0] - p[0], dy = c[1] - p[1], L = Math.hypot(dx, dy) || 1e-9, f = ks * (L - 1) / L;
        F[i][0] += f * dx; F[i][1] += f * dy;
        F[R.nx[i]][0] -= f * dx; F[R.nx[i]][1] -= f * dy;
        F[i][0] -= kg * (p[0] - cx); F[i][1] -= kg * (p[1] - cy);
      }
      // (both pushes reach only so far: 1/r² − 1/r₀² for r < r₀)
      const skip = crossPairs(X);
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], d2 = dx * dx + dy * dy + SOFT;
        if (d2 > r0 * r0 || !far(i, j) || skip.has(i * N + j)) continue;
        const f = kr * (1 / d2 - i0) / Math.sqrt(d2);
        F[i][0] += f * dx; F[i][1] += f * dy; F[j][0] -= f * dx; F[j][1] -= f * dy;
      }
      // a force on a crossing moves the four ends of its two edges
      const ends = X.map((x) => { const i = Math.floor(x.a), j = Math.floor(x.b); return [[i, (1 - (x.a - i)) / 2], [R.nx[i], (x.a - i) / 2], [j, (1 - (x.b - j)) / 2], [R.nx[j], (x.b - j) / 2]]; });
      const push = (k, fx, fy) => { for (const [v, w] of ends[k]) { F[v][0] += w * fx; F[v][1] += w * fy; } };
      for (let u = 0; u < X.length; u++) for (let v = u + 1; v < X.length; v++) {
        const dx = X[u].x - X[v].x, dy = X[u].y - X[v].y, d2 = dx * dx + dy * dy + 0.25;
        if (d2 > rc * rc) continue;
        const f = kc * (1 / d2 - ic) / Math.sqrt(d2);
        push(u, f * dx, f * dy); push(v, -f * dx, -f * dy);
      }
      // a region much smaller than the others presses outwards, the harder the
      // smaller it is: E = kp (A₀/A − 1)² for A < A₀, A₀ a quarter of the mean area
      // (for a region with two corners, the gap in a twist, a twenty-fifth: a twist
      // with round gaps looks like a coil)
      if (kp && X.length > 1) {
        const rg = regions(P, X), inside = rg.list.filter((r) => r.A > 0), mean = inside.reduce((t, r) => t + r.A, 0) / (inside.length || 1);
        for (const { loop, A, two } of inside) {
          const lim = (two ? (opts.smallTwo || 0.04) : (opts.small || 0.25)) * mean;
          if (A >= lim) continue;
          const f = kp * 2 * (lim / Math.max(A, 1e-3) - 1) * lim / (Math.max(A, 1e-3) ** 2) * mean / 2;
          for (let i = 0; i < loop.length; i++) {
            const v = loop[i];
            if (v < 0) continue;
            const a = rg.at(loop[(i + loop.length - 1) % loop.length]), b = rg.at(loop[(i + 1) % loop.length]);
            F[v][0] += f * (b[1] - a[1]); F[v][1] += f * (a[0] - b[0]);
          }
        }
      }
      // the strands at a crossing turn towards a right angle: E = cos² of the angle
      // between the chords two vertices either side of it
      for (const x of X) {
        const a0 = K.along(R, Math.floor(x.a), -2), a1 = K.along(R, Math.floor(x.a), 3), b0 = K.along(R, Math.floor(x.b), -2), b1 = K.along(R, Math.floor(x.b), 3);
        const u = [P[a1][0] - P[a0][0], P[a1][1] - P[a0][1]], v = [P[b1][0] - P[b0][0], P[b1][1] - P[b0][1]], uu = u[0] * u[0] + u[1] * u[1], vv = v[0] * v[0] + v[1] * v[1], c = u[0] * v[0] + u[1] * v[1];
        if (!uu || !vv) continue;
        const gu = [2 * ka * c * (v[0] / (uu * vv) - c * u[0] / (uu * uu * vv)), 2 * ka * c * (v[1] / (uu * vv) - c * u[1] / (uu * uu * vv))];
        const gv = [2 * ka * c * (u[0] / (uu * vv) - c * v[0] / (vv * vv * uu)), 2 * ka * c * (u[1] / (uu * vv) - c * v[1] / (vv * vv * uu))];
        F[a1][0] -= gu[0]; F[a1][1] -= gu[1]; F[a0][0] += gu[0]; F[a0][1] += gu[1];
        F[b1][0] -= gv[0]; F[b1][1] -= gv[1]; F[b0][0] += gv[0]; F[b0][1] += gv[1];
      }
      return F;
    }
    // How far each vertex may move in a step: a third of the distance from it to the
    // nearest edge not next to it, and from the edges it ends to the nearest vertex.
    // Two edges that do not meet are nearest at an end of one of them, so with every
    // vertex moving less than that, none come to meet, and no step changes the diagram.
    function room(P) {
      const out = new Float64Array(N).fill(Infinity);
      for (let s = 0; s < N; s++) {
        const s2 = R.nx[s], a = P[s], b = P[s2], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-12;
        for (let v = 0; v < N; v++) {
          if (v === s || v === s2 || v === R.pv[s] || v === R.nx[s2]) continue;
          const p = P[v], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)), d = Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
          if (d < out[v]) out[v] = d;
          if (d < out[s]) out[s] = d;
          if (d < out[s2]) out[s2] = d;
        }
      }
      return out;
    }
    // the drawing turned by t about its centre
    const turned = (P, t) => {
      if (!t) return P;
      let cx = 0, cy = 0;
      for (const p of P) { cx += p[0]; cy += p[1]; }
      cx /= P.length; cy /= P.length;
      const c = Math.cos(t), s = Math.sin(t);
      return P.map((p) => [cx + c * (p[0] - cx) - s * (p[1] - cy), cy + s * (p[0] - cx) + c * (p[1] - cy)]);
    };
    // (momentum: each step carries on MU of the last, as a ball rolling down would,
    // until the force turns against it; the stiff rope settles in far fewer steps)
    const MU = opts.momentum === undefined ? 0.8 : opts.momentum;
    let gain = 1, steps = 0, vel = null;
    return {
      step(k) {
        let moved = false;
        for (let s = 0; s < k; s++) {
          // coarser, once that keeps the diagram
          if (level > 0 && ++steps % 40 === 0) {
            const c2 = sample(state, levels[level - 1]);
            if (c2) { state = c2; level--; setup(); }
          }
          const F = forces(state.pts, state.X), cap = room(state.pts);
          // (a step small enough for the bending and the springs not to overshoot: their
          // largest rates are 16 kb and 4 ks; and each vertex moves at most a third of an
          // edge, and a third of its room)
          const eta = gain * 1.2 / (16 * kb + 4 * ks);
          if (vel && vel.length === N) { let power = 0; for (let i = 0; i < N; i++) power += F[i][0] * vel[i][0] + F[i][1] * vel[i][1]; if (power < 0) vel = null; } else vel = null;
          let most = 0;
          const to = state.pts.map((p, i) => {
            let dx = eta * F[i][0] + (vel ? MU * vel[i][0] : 0), dy = eta * F[i][1] + (vel ? MU * vel[i][1] : 0);
            const l = Math.hypot(dx, dy), c = Math.min(0.33, cap[i] / 3);
            if (l > c) { dx *= c / l; dy *= c / l; }
            most = Math.max(most, Math.min(l, c));
            return [p[0] + dx, p[1] + dy];
          });
          if (most < 1e-5) break;
          let r = K.advance(state, perm ? symmetric(to) : to, { strict: true, loose: true });
          if (perm && r.moved === 0) r = K.advance(state, to, { strict: true, loose: true });
          if (r.moved > 0) {
            const old = state.pts;
            state = { pts: r.pts, cut, over: r.over, X: r.X, meta: state.meta, count: state.count };
            vel = r.blocked ? null : r.pts.map((q, i) => [q[0] - old[i][0], q[1] - old[i][1]]);
            moved = true; gain = Math.min(1, gain * 1.25);
          } else { vel = null; if ((gain /= 2) < 1e-3) break; }
        }
        return moved;
      },
      // the angle to turn the drawing by to put an axis of symmetry upright, the
      // heavier side down (of the axes, the one with the most weight below; where
      // that is even, as in a drawing that turns into itself, the one widest at the
      // foot); null if the shadow has no reflection kept
      turn() {
        if (!perm || !G.syms.some((s) => s.rev)) return null;
        const { cx, cy, out } = motions(state.pts), ways = [];
        out.forEach((m) => {
          if (m.axis === undefined) return;
          for (const flip of [0, Math.PI]) {
            const t = Math.PI / 2 - m.axis + flip, c = Math.cos(t), s = Math.sin(t), Q = state.pts.map((p) => [c * (p[0] - cx) - s * (p[1] - cy), s * (p[0] - cx) + c * (p[1] - cy)]);
            let y0 = Infinity, y1 = -Infinity, my = 0, x0 = Infinity, x1 = -Infinity;
            for (const q of Q) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); my += q[1] / Q.length; }
            for (const q of Q) if (q[1] < y0 + 0.2 * (y1 - y0)) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
            ways.push({ low: -my / (y1 - y0), foot: (x1 - x0) / (y1 - y0), t });
          }
        });
        if (!ways.length) return null;
        const top = Math.max(...ways.map((w) => w.low));
        return ways.filter((w) => w.low > top - 0.01).sort((a, b) => b.foot - a.foot)[0].t;
      },
      // how far the drawing is from symmetric, as a part of its size (0 if no symmetry is kept)
      asymmetry() {
        if (!perm) return 0;
        const { q, out } = motions(state.pts);
        let worst = 0, size = 0;
        for (const p of q) size = Math.max(size, Math.hypot(p[0], p[1]));
        out.forEach((m, g) => {
          const c = Math.cos(m.turn !== undefined ? m.turn : 2 * m.axis), s = Math.sin(m.turn !== undefined ? m.turn : 2 * m.axis);
          q.forEach((p, v) => {
            const w = q[perm[g][v]], img = m.turn !== undefined ? [c * p[0] - s * p[1], s * p[0] + c * p[1]] : [c * p[0] + s * p[1], s * p[0] - c * p[1]];
            worst = Math.max(worst, Math.hypot(w[0] - img[0], w[1] - img[1]));
          });
        });
        return worst / (size || 1);
      },
      get symmetric() { return !!perm; },
      // the least distance between two strands away from the crossings, in edges
      clearance() {
        const P = state.pts, near = Array.from({ length: N }, () => []);
        state.X.forEach((x, c) => { for (const t of [x.a, x.b]) for (let d = -2; d <= 3; d++) near[K.along(R, Math.floor(t), d)].push(c); });
        let least = Infinity;
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          if (R.cp[i] === R.cp[j]) { const L = cut[R.cp[i] + 1] - cut[R.cp[i]], d = Math.abs(i - j); if (Math.min(d, L - d) <= 6) continue; }
          if (near[i].some((c) => near[j].includes(c))) continue;
          least = Math.min(least, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]));
        }
        return least;
      },
      // the polygon as it is, turned by t and fitted to [−0.78, 0.78]²
      polygon(t) {
        const P = turned(state.pts, t), f = fit(P);
        return { pts: P.map((p) => [(p[0] - f.cx) * f.scale, (p[1] - f.cy) * f.scale]), cut, over: state.over.slice() };
      },
      result(density, t) {
        const { pts: scaled } = this.polygon(t), want = K.diagram(scaled, state.over, null, cut);
        for (const d of [density, density * 1.5, density * 2.5]) {
          const s = spline(scaled, cut, d), X = K.crossings(s.pts, s.cut);
          if (X.length !== n) continue;
          const got = K.diagram(s.pts, state.over, X, s.cut);
          if (got.seq.join() === want.seq.join() && got.sign.join() === want.sign.join() && got.ov.join() === want.ov.join()) return { pts: s.pts, cut: s.cut, over: state.over.slice(), X };
        }
        // (the polygon itself, if no spline through it keeps the diagram)
        return { pts: scaled, cut, over: state.over.slice(), X: K.crossings(scaled, cut) };
      },
      // the energy as it is, per vertex, to compare drawings of one diagram (the
      // pressing of small regions is left out: it is there to keep them from closing)
      energy() {
        const P = state.pts, X = state.X;
        let E = 0, cx = 0, cy = 0;
        for (const p of P) { cx += p[0]; cy += p[1]; }
        cx /= N; cy /= N;
        for (let i = 0; i < N; i++) {
          const a = P[R.pv[i]], p = P[i], b = P[R.nx[i]], bx = a[0] - 2 * p[0] + b[0], by = a[1] - 2 * p[1] + b[1], L = Math.hypot(b[0] - p[0], b[1] - p[1]);
          E += 0.5 * kb * (bx * bx + by * by) + 0.5 * ks * (L - 1) ** 2 + 0.5 * kg * ((p[0] - cx) ** 2 + (p[1] - cy) ** 2);
        }
        const U = (k, d, r) => (d < r ? k * (1 / d + d / (r * r) - 2 / r) : 0), skip = crossPairs(X);
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (far(i, j) && !skip.has(i * N + j)) E += U(kr, Math.sqrt((P[i][0] - P[j][0]) ** 2 + (P[i][1] - P[j][1]) ** 2 + SOFT), r0);
        for (let u = 0; u < X.length; u++) for (let v = u + 1; v < X.length; v++) E += U(kc, Math.sqrt((X[u].x - X[v].x) ** 2 + (X[u].y - X[v].y) ** 2 + 0.25), rc);
        return E / N;
      },
      get coarse() { return state; },
    };
  }

  const circle = (r, N, cx, cy) => Array.from({ length: N }, (_, i) => [(cx || 0) + r * Math.cos(2 * Math.PI * i / N), (cy || 0) + r * Math.sin(2 * Math.PI * i / N)]);

  // A drawing of the diagram D: each piece by a circle packing (a piece without
  // crossings, or with fewer than two, as a round circle), the pieces side by side,
  // then settled. Returns { pts, cut, over, X } in [−0.78, 0.78]², with about
  // `density` vertices to a unit of length (opts.density, default 28).
  //   opts.outer   for a diagram in one piece, the region to leave outside
  //   opts.steps   how long it settles (default 400)
  // Drawings of a diagram in one piece to start from: by a circle packing; and, if
  // it has long twists, by a circle packing with them cut short and put back after
  // (they can come out tiny otherwise: the circles along a twist all touch the two
  // large regions beside it).
  function starts(E, outer) {
    const out = [];
    for (const f of outer === undefined ? outers(E) : [outer]) {
      try { out.push(through(E, control(E, f))); } catch (e) { /* none from this packing */ }
    }
    const { E: E2, gaps } = untwist(E);
    if (gaps.length) {
      try {
        const back = retwist(through(E2, control(E2)), E2, gaps), over = back && K.matchBits(back.pts, back.cut, E);
        if (over) out.push({ pts: back.pts, cut: back.cut, over });
      } catch (e) { /* (likewise) */ }
    }
    return out;
  }
  // A drawing of a diagram in one piece, settled: of the starts, those whose
  // strands keep at least half as far apart as in the best of them; of these, one
  // that comes out symmetric if any does, and the one that settles lowest. Returns
  // its relaxer. With opts.quick, the first that is symmetric (if the shadow can
  // be) with its strands two edges apart or more, without trying the others.
  function piece(E, opts) {
    const done = [], mirror = opts.quick && mirrored(E).size > 0;
    for (const s of starts(E, opts.outer)) {
      const r = relaxer(s, opts);
      if (!r) continue;
      r.step(opts.steps === undefined ? 1200 : opts.steps);
      const d = { r, e: r.energy(), sym: r.symmetric && r.asymmetry() < 1e-3 ? 1 : 0, gap: r.clearance() };
      done.push(d);
      if (opts.quick && d.gap >= 2 && (d.sym || !mirror)) return r;
    }
    if (!done.length) return null;
    const most = Math.max(...done.map((d) => d.gap));
    return done.filter((d) => d.gap >= 0.5 * most).sort((a, b) => b.sym - a.sym || a.e - b.e)[0].r;
  }
  // The angle to turn points by to bring the line through their centre in which they
  // are nearest to symmetric upright, the heavier half below (how far each reflected
  // point is from the nearest point, on the mean).
  function upright(pts) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    cx /= pts.length; cy /= pts.length;
    const P = pts.map((p) => [p[0] - cx, p[1] - cy]);
    const off = (deg) => {
      const th = deg * Math.PI / 180, c = Math.cos(2 * th), s = Math.sin(2 * th);
      let total = 0;
      for (const p of P) {
        const x = c * p[0] + s * p[1], y = s * p[0] - c * p[1];
        let best = Infinity;
        for (const q of P) best = Math.min(best, (q[0] - x) ** 2 + (q[1] - y) ** 2);
        total += Math.sqrt(best);
      }
      return total;
    };
    let best = 0, score = Infinity;
    for (let d = 0; d < 180; d += 2) { const a = off(d); if (a < score - 1e-12) { score = a; best = d; } }
    for (let d = best - 1.5; d <= best + 1.5; d += 0.5) { const a = off(d); if (a < score - 1e-12) { score = a; best = d; } }
    let turn = Math.PI / 2 - best * Math.PI / 180;
    if (P.reduce((t, p) => t + Math.sin(turn) * p[0] + Math.cos(turn) * p[1], 0) > 0) turn += Math.PI;
    return turn;
  }
  // the angle to turn a settled drawing by: an axis of symmetry upright, or else the
  // line it is nearest to symmetric in
  function orient(r) {
    const t = r.turn();
    if (t !== null) return t;
    const p = r.polygon(0);
    return upright(spline(p.pts, p.cut, 8).pts);
  }
  // A drawing of the diagram D, each piece drawn as above, turned upright (a piece
  // without crossings, or with fewer than two, as a round circle), the pieces side by
  // side. Returns { pts, cut, over, X, order } in [−0.78, 0.78]², with about
  // `density` vertices to a unit of length (opts.density, default 28); order lists
  // the components of D in the order the drawing has them.
  //   opts.outer   for a diagram in one piece, the region to leave outside
  //   opts.steps   how long each start settles (default 1200)
  //   opts.quick   the first good drawing (see piece)
  function curve(D, opts) {
    opts = opts || {};
    const density = opts.density || 28, parts = [], all = K.pieces(D);
    for (const comps of all) {
      const E = K.sub(D, comps);
      let t = null;
      if (E.n >= 2) { const r = piece(E, all.length === 1 ? opts : Object.assign({}, opts, { outer: undefined })); if (r) t = r.result(density, orient(r)); }
      // (a circle for each component, side by side, if there is no drawing)
      if (!t) { for (let q = 0; q < comps.length; q++) { const N = Math.round(4.9 * density); parts.push({ pts: circle(0.7, N), cut: [0, N], over: [], w: 1.4 }); } continue; }
      // each piece in a box whose side grows with the root of its crossings
      const side = Math.sqrt(E.n / 3), f = side / 0.78 / 2;
      parts.push({ pts: t.pts.map((p) => [p[0] * f, p[1] * f]), cut: t.cut, over: t.over, w: side });
    }
    // the pieces in a row
    const pts = [], cut = [0], over = [];
    let x = 0;
    for (const p of parts) {
      const shift = x + p.w / 2;
      for (const q of p.pts) pts.push([q[0] + shift, q[1]]);
      for (let c = 1; c < p.cut.length; c++) cut.push(cut[cut.length - 1] + p.cut[c] - p.cut[c - 1]);
      // the bits, in the order the joined curve meets its crossings: the pieces lie
      // apart, so piece by piece, each in its own order
      for (const b of p.over) over.push(b);
      x += p.w * 1.2;
    }
    const f = fit(pts), out = pts.map((p) => [(p[0] - f.cx) * f.scale, (p[1] - f.cy) * f.scale]);
    return { pts: out, cut, over, X: K.crossings(out, cut), order: all.flat() };
  }

  function fit(pts) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, scale: 1.56 / Math.max(x1 - x0, y1 - y0) };
  }

  G.KnotLayout = { pack, outers, control, through, twists, untwist, retwist, starts, piece, spline, relaxer, curve, fit, circle, symmetries, regionMap, edgeMap, mirrored, upright, orient };
})(typeof globalThis !== 'undefined' ? globalThis : this);
