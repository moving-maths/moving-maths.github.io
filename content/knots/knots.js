// Knots: knot and link diagrams and their invariants, with no drawing.
//
// A link is drawn as closed polygons in the plane, one after another in a single
// list of vertices (pts: [[x, y], …], y upwards), with cut = [0, N₁, N₁ + N₂, …, N]
// saying where each component begins (for a knot cut = [0, N], and it may be left
// out). Where two strands cross, one passes over: the crossings are listed in the
// order in which the curve, one component after another, first meets them, and
// over[k] is 0 when the strand that comes first there (the smaller parameter) is
// the upper one, 1 when the second is.
//
// From a curve comes a diagram, which is all the invariants need:
//   { n, seq, ov, sign, cut }   seq[k] the crossing met at the k-th passage (each
//                               twice), ov[k] whether that passage is the upper
//                               one, sign[c] the sign of crossing c (right-handed
//                               +1), and cut where each component's passages begin
//                               (a component with no crossings has none)
//
//   crossings(pts, cut)            where the curve crosses itself
//   diagram(pts, over, X, cut)     the diagram of a curve
//   fromDT(code), fromPD(code)     a diagram from a Dowker–Thistlethwaite code (of
//                                  a knot) or from a planar diagram code
//   mirror, sum, pieces, sub       the mirror image; a sum of knots; the pieces of a
//                                  diagram that falls apart, as diagrams
//   layers, apart                  the groups of components that lie wholly above or
//                                  below one another; the diagram with them apart
//   faces, writhe, linking, linkingList, isAlternating, isReduced, showsSum
//   summands(D)                    the parts of a diagram that is visibly a sum
//   bracket(D), jones(D)           Kauffman's bracket and the Jones polynomial
//   homfly(D)                      the HOMFLYPT polynomial; Conway's and the Jones
//                                  polynomial from it
//   toSwitch(D)                    the crossing it switches next on the way to a pile
//                                  of loops (−1 if the diagram is one)
//   alexander(D)                   the Alexander polynomial
//   signature, goeritz, determinant, colourings
//   wirtinger, presentation, onto  the group of the complement
//   switched, smoothed             a crossing switched, or opened in one of its two ways
//   seifertCircles(D)              the loops left with every crossing opened along the strands
//   simplify(D)                    fewer crossings by Reidemeister moves
//   advance, pull, fair, respace   moving the curve as a rope would move: every change
//                                  of the diagram on the way is a Reidemeister move,
//                                  or the move stops
//   smoothAt(knot, k, oriented)    the curve with a crossing opened
//   reconnect(knot, i, j, …)       two strands that come close joined across, with a
//                                  crossing between them or without
//   withStroke(knot, stroke, h)    one more component, drawn by hand
//   heights(pts, X, over, cut)     a curve in space with this diagram, as flat and
//                                  as little bent as it can be
//   catalogue, identify            a knot's name, from a table
//   linkCatalogue, identifyLink    a link's name, from a table
//
// Polynomials in one variable are Laurent polynomials { lo, c }: Σ c[k] x^(lo + k),
// where lo may be a half (the Jones polynomial of a link with an even number of
// components). Polynomials in a and z are Maps (poly2 below).
// Also used by test/knots.test.mjs and by generate.mjs, so it touches no DOM.
(function (G) {
  'use strict';

  /* ---------- Laurent polynomials in one variable ---------- */

  const ZERO = { lo: 0, c: [] }, ONE = { lo: 0, c: [1] };
  function trim(p) {
    let a = 0, b = p.c.length;
    while (a < b && p.c[a] === 0) a++;
    while (b > a && p.c[b - 1] === 0) b--;
    return a === b ? ZERO : { lo: p.lo + a, c: p.c.slice(a, b).map((x) => x + 0) }; // (and never −0)
  }
  function padd(p, q, s) {
    s = s === undefined ? 1 : s;
    if (!q.c.length) return p;
    if (!p.c.length) return s === 1 ? q : { lo: q.lo, c: q.c.map((x) => s * x) };
    const lo = Math.min(p.lo, q.lo), hi = Math.max(p.lo + p.c.length, q.lo + q.c.length);
    const c = new Array(Math.round(hi - lo)).fill(0);
    for (let i = 0; i < p.c.length; i++) c[Math.round(p.lo - lo) + i] += p.c[i];
    for (let i = 0; i < q.c.length; i++) c[Math.round(q.lo - lo) + i] += s * q.c[i];
    return trim({ lo, c });
  }
  function pmul(p, q) {
    if (!p.c.length || !q.c.length) return ZERO;
    const c = new Array(p.c.length + q.c.length - 1).fill(0);
    for (let i = 0; i < p.c.length; i++) if (p.c[i]) for (let j = 0; j < q.c.length; j++) c[i + j] += p.c[i] * q.c[j];
    return trim({ lo: p.lo + q.lo, c });
  }
  const pshift = (p, k, s) => (p.c.length ? { lo: p.lo + k, c: s === 1 || s === undefined ? p.c : p.c.map((x) => s * x) } : p);
  const peq = (p, q) => p.lo === q.lo && p.c.length === q.c.length && p.c.every((x, i) => x === q.c[i]);
  const pkey = (p) => p.lo + ':' + p.c.join(',');
  const pflip = (p) => (p.c.length ? { lo: -(p.lo + p.c.length - 1), c: p.c.slice().reverse() } : p); // x ↦ 1/x
  function peval(p, x) { let t = 0; for (let i = 0; i < p.c.length; i++) t += p.c[i] * Math.pow(x, p.lo + i); return t; }
  function ppow(p, k) { let r = ONE; for (let i = 0; i < k; i++) r = pmul(r, p); return r; }
  // p / q, where q divides p exactly
  function pdiv(p, q) {
    if (!p.c.length) return ZERO;
    const r = p.c.slice(), m = q.c.length, out = new Array(Math.max(0, r.length - m + 1)).fill(0), lead = q.c[m - 1];
    for (let i = r.length - m; i >= 0; i--) {
      const f = r[i + m - 1] / lead;
      out[i] = f;
      if (f) for (let j = 0; j < m; j++) r[i + j] -= f * q.c[j];
    }
    if (r.some((x) => Math.abs(x) > 1e-9)) throw new Error('not a factor');
    return trim({ lo: p.lo - q.lo, c: out.map((x) => Math.round(x)) });
  }
  // |p(−1)|, with t^(1/2) = i where the powers are halves
  function absAtMinusOne(p) {
    let re = 0, im = 0;
    p.c.forEach((x, i) => {
      const r = ((Math.round(2 * (p.lo + i)) % 4) + 4) % 4;
      if (r === 0) re += x; else if (r === 1) im += x; else if (r === 2) re -= x; else im -= x;
    });
    return Math.round(Math.hypot(re, im));
  }
  const LOOP = { lo: -2, c: [-1, 0, 0, 0, -1] }; // −A² − A⁻², a closed loop in the bracket
  const S_Z = { lo: -1, c: [-1, 0, 1] };          // s − 1/s

  /* ---------- polynomials in a and z ---------- */

  // A Map from a key for (i, j) to the coefficient of aⁱ zʲ.
  const HZ = 512, HB = 1024, HK = (i, j) => (i + HZ) * HB + (j + HZ), H00 = HK(0, 0);
  const hi_ = (k) => Math.floor(k / HB) - HZ, hj_ = (k) => (k % HB) - HZ;
  const poly2 = {
    mono: (i, j, c) => new Map([[HK(i, j), c === undefined ? 1 : c]]),
    add(P, Q, s) { const R = new Map(P); s = s === undefined ? 1 : s; Q.forEach((v, k) => { const w = (R.get(k) || 0) + s * v; if (w) R.set(k, w); else R.delete(k); }); return R; },
    shift(P, di, dj, s) { const d = di * HB + dj, R = new Map(); s = s === undefined ? 1 : s; P.forEach((v, k) => R.set(k + d, s * v)); return R; },
    mul(P, Q) {
      const R = new Map();
      P.forEach((v, k) => Q.forEach((w, l) => { const key = k + l - H00, x = (R.get(key) || 0) + v * w; if (x) R.set(key, x); else R.delete(key); }));
      return R;
    },
    terms: (P) => Array.from(P, ([k, v]) => [hi_(k), hj_(k), v]).sort((x, y) => x[0] - y[0] || x[1] - y[1]),
    key: (P) => poly2.terms(P).map((t) => t.join(',')).join(';'),
    eq: (P, Q) => poly2.key(P) === poly2.key(Q),
    // the mirror image: P(a, z) ↦ P(1/a, −z)
    mirror(P) { const R = new Map(); P.forEach((v, k) => { const j = hj_(k); R.set(HK(-hi_(k), j), j % 2 ? -v : v); }); return R; },
    of(list) { const R = new Map(); for (const [i, j, c] of list) if (c) R.set(HK(i, j), (R.get(HK(i, j)) || 0) + c); return R; },
  };

  /* ---------- the curve ---------- */

  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  // For each vertex: the next and the previous along its component, and which
  // component it is on.
  function ring(N, cut) {
    cut = cut || [0, N];
    const nx = new Int32Array(N), pv = new Int32Array(N), cp = new Int32Array(N);
    for (let c = 0; c + 1 < cut.length; c++) for (let i = cut[c]; i < cut[c + 1]; i++) {
      cp[i] = c;
      nx[i] = i + 1 < cut[c + 1] ? i + 1 : cut[c];
      pv[i] = i > cut[c] ? i - 1 : cut[c + 1] - 1;
    }
    return { nx, pv, cp, cut };
  }
  // the point at parameter t: a vertex and the fraction of the way to the next
  function pointAt(pts, R, t) { const k = Math.floor(t), f = t - k, a = pts[k], b = pts[R.nx[k]]; return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]; }
  // the parameter d further along the component than t (d may be negative)
  function along(R, t, d) {
    const c = R.cp[Math.floor(t)], lo = R.cut[c], len = R.cut[c + 1] - lo;
    let u = (t - lo + d) % len;
    if (u < 0) u += len;
    if (u >= len) u = 0; // (a step just short of the start, rounded up to it)
    return lo + u;
  }

  // Where the curve crosses itself: { a, b, x, y, e } with a < b the two parameters
  // (a vertex and the fraction along the edge after it), and e = ±1 the side to
  // which the second passage crosses the first (+1: from its right to its left).
  // A vertex that lies exactly on an edge counts as just to its left.
  function crossings(pts, cut) {
    const N = pts.length, out = [];
    if (N < 3) return out;
    const { nx } = ring(N, cut);
    const x0 = new Float64Array(N), x1 = new Float64Array(N), y0 = new Float64Array(N), y1 = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[nx[i]];
      x0[i] = Math.min(p[0], q[0]); x1[i] = Math.max(p[0], q[0]); y0[i] = Math.min(p[1], q[1]); y1[i] = Math.max(p[1], q[1]);
    }
    // the edges sorted by their left ends, swept from left to right
    const order = Array.from({ length: N }, (_, i) => i).sort((i, j) => x0[i] - x0[j]);
    for (let u = 0; u < N; u++) {
      const i = order[u], xi = x1[i];
      for (let v = u + 1; v < N; v++) {
        const j = order[v];
        if (x0[j] > xi) break;
        if (y0[j] > y1[i] || y0[i] > y1[j]) continue;
        if (nx[i] === j || nx[j] === i || nx[i] === i) continue;
        const lo = i < j ? i : j, hi = i < j ? j : i;
        const p = pts[lo], p2 = pts[nx[lo]], q = pts[hi], q2 = pts[nx[hi]];
        const dx = p2[0] - p[0], dy = p2[1] - p[1], ex = q2[0] - q[0], ey = q2[1] - q[1];
        const o1 = dx * (q[1] - p[1]) - dy * (q[0] - p[0]), o2 = dx * (q2[1] - p[1]) - dy * (q2[0] - p[0]);
        if ((o1 >= 0) === (o2 >= 0)) continue;
        const o3 = ex * (p[1] - q[1]) - ey * (p[0] - q[0]), o4 = ex * (p2[1] - q[1]) - ey * (p2[0] - q[0]);
        if ((o3 >= 0) === (o4 >= 0)) continue;
        const s = o3 / (o3 - o4);
        out.push({ a: lo + s, b: hi + o1 / (o1 - o2), x: p[0] + s * dx, y: p[1] + s * dy, e: dx * ey - dy * ex > 0 ? 1 : -1 });
      }
    }
    return out.sort((c, d) => c.a - d.a);
  }

  // The passages of the curve through its crossings, in order: { t, c, w } with w = 0
  // for the first passage through crossing c and 1 for the second.
  function visits(X) {
    const V = [];
    X.forEach((c, k) => { V.push({ t: c.a, c: k, w: 0 }); V.push({ t: c.b, c: k, w: 1 }); });
    return V.sort((u, v) => u.t - v.t);
  }

  function diagram(pts, over, X, cut) {
    cut = cut || [0, pts.length];
    X = X || crossings(pts, cut);
    const V = visits(X), pc = [0];
    let k = 0;
    for (let c = 1; c < cut.length; c++) { while (k < V.length && V[k].t < cut[c]) k++; pc.push(k); }
    return {
      n: X.length,
      seq: V.map((v) => v.c),
      ov: V.map((v) => (over[v.c] ? 1 : 0) === v.w),
      sign: X.map((c, i) => (over[i] ? -c.e : c.e)),
      cut: pc,
    };
  }

  /* ---------- the passages of a diagram ---------- */

  // For each passage: the next and the previous along its component, and its
  // component; for each crossing, its two passages.
  const CACHE = new WeakMap();
  function pas(D) {
    let r = CACHE.get(D);
    if (r) return r;
    const m = 2 * D.n, cut = D.cut || [0, m], nx = new Int32Array(m), pv = new Int32Array(m), cp = new Int32Array(m);
    for (let c = 0; c + 1 < cut.length; c++) for (let k = cut[c]; k < cut[c + 1]; k++) {
      cp[k] = c;
      nx[k] = k + 1 < cut[c + 1] ? k + 1 : cut[c];
      pv[k] = k > cut[c] ? k - 1 : cut[c + 1] - 1;
    }
    const pos = Array.from({ length: D.n }, () => [-1, -1]);
    D.seq.forEach((c, k) => { if (pos[c][0] < 0) pos[c][0] = k; else pos[c][1] = k; });
    r = { nx, pv, cp, cut, C: cut.length - 1, pos };
    CACHE.set(D, r);
    return r;
  }
  const copy = (D) => ({ n: D.n, seq: D.seq.slice(), ov: D.ov.slice(), sign: D.sign.slice(), cut: (D.cut || [0, 2 * D.n]).slice() });
  // A diagram from lists of passages of D, each list a component in its new order,
  // leaving out the crossings in `drop`. The passages in `turned` are walked the
  // other way than in D, so a crossing with one passage among them changes sign.
  // With `keep`, it also says which crossing of D each of its own is (old).
  function rebuild(D, comps, drop, turned, keep) {
    const flips = new Int8Array(D.n), id = new Int32Array(D.n).fill(-1), seq = [], ov = [], cut = [0], sign = [];
    if (turned) turned.forEach((k) => { flips[D.seq[k]]++; });
    let n = 0;
    for (const list of comps) {
      for (const k of list) {
        const c = D.seq[k];
        if (drop && drop.has(c)) continue;
        if (id[c] < 0) { id[c] = n++; sign.push(flips[c] === 1 ? -D.sign[c] : D.sign[c]); }
        seq.push(id[c]);
        ov.push(D.ov[k]);
      }
      cut.push(seq.length);
    }
    if (keep) { const old = new Array(n); id.forEach((j, c) => { if (j >= 0) old[j] = c; }); return { n, seq, ov, sign, cut, old }; }
    return { n, seq, ov, sign, cut };
  }
  const components = (D) => { const { cut, C } = pas(D); return range(0, C).map((q) => range(cut[q], cut[q + 1])); };
  const without = (D, gone) => rebuild(D, components(D), new Set(gone));

  // The crossings over and under in turn along every component: each crossing with
  // the regions its upper strand sweeps black (see faces).
  function alternatingBits(pts, X, cut) {
    const over = new Array(X.length).fill(0);
    if (!X.length) return over;
    const D = diagram(pts, over, X, cut), F = faces(D), col = chess(D, F);
    X.forEach((x, k) => { if (col[F.corner[k][1]] !== 1) over[k] = 1; });
    return over;
  }

  const mirror = (D) => ({ n: D.n, seq: D.seq.slice(), ov: D.ov.map((o) => !o), sign: D.sign.map((s) => -s), cut: (D.cut || [0, 2 * D.n]).slice() });
  const writhe = (D) => D.sign.reduce((t, s) => t + s, 0);
  function isAlternating(D) { const { nx } = pas(D); return D.ov.every((o, k) => o !== D.ov[nx[k]]); }
  // the linking number of each two components
  function linking(D) {
    const { cp, C, pos } = pas(D), lk = Array.from({ length: C }, () => new Array(C).fill(0));
    for (let c = 0; c < D.n; c++) {
      const i = cp[pos[c][0]], j = cp[pos[c][1]];
      if (i !== j) { lk[i][j] += D.sign[c] / 2; lk[j][i] += D.sign[c] / 2; }
    }
    return lk;
  }
  // the linking numbers of all the pairs of components, in increasing order
  function linkingList(D) {
    const lk = linking(D), out = [];
    for (let i = 0; i < lk.length; i++) for (let j = i + 1; j < lk.length; j++) out.push(lk[i][j]);
    return out.sort((a, b) => a - b);
  }

  // For each crossing, the edges at its four ends, anticlockwise from the under strand
  // coming in: edge k runs from passage k to the next along its component. Also
  // where each edge ends.
  function slots(D) {
    const { pv } = pas(D), m = 2 * D.n, under = new Array(D.n), upper = new Array(D.n);
    D.seq.forEach((c, k) => { if (D.ov[k]) upper[c] = k; else under[c] = k; });
    const S = [], tail = new Array(m), head = new Array(m);
    for (let c = 0; c < D.n; c++) {
      const p = under[c], q = upper[c], ui = pv[p], uo = p, oi = pv[q], oo = q;
      S.push(D.sign[c] > 0 ? [ui, oo, uo, oi] : [ui, oi, uo, oo]);
      head[ui] = [c, 0]; tail[uo] = [c, 2];
      if (D.sign[c] > 0) { tail[oo] = [c, 1]; head[oi] = [c, 3]; } else { head[oi] = [c, 1]; tail[oo] = [c, 3]; }
    }
    return { S, tail, head, under, upper };
  }

  // The regions of the plane round the diagram. corner[c][j] is the region in the
  // corner of crossing c between its ends j and j + 1; each region lists its corners
  // anticlockwise. A diagram drawn in the plane, in one piece, has n + 2 of them.
  // Corners 1 and 3 are the ones the upper strand sweeps, turned anticlockwise.
  function faces(D) {
    const { S, tail, head } = slots(D), corner = S.map(() => [-1, -1, -1, -1]), list = [];
    const other = (c, k) => { const e = S[c][k], t = tail[e], h = head[e]; return t[0] === c && t[1] === k ? h : t; };
    for (let c = 0; c < D.n; c++) {
      for (let k = 0; k < 4; k++) {
        if (corner[c][k] >= 0) continue;
        const f = list.length, cs = [];
        let a = c, b = k;
        do {
          corner[a][b] = f;
          cs.push([a, b]);
          const o = other(a, b);
          a = o[0]; b = (o[1] + 3) % 4;
        } while (corner[a][b] < 0);
        list.push(cs);
      }
    }
    return { corner, list, S };
  }
  // the regions coloured like a chessboard, 0 and 1, the two corners either side of
  // an end of a crossing apart
  function chess(D, F) {
    const colour = new Array(F.list.length).fill(-1);
    for (let f0 = 0; f0 < F.list.length; f0++) {
      if (colour[f0] >= 0) continue;
      colour[f0] = 0;
      const todo = [f0];
      while (todo.length) {
        const f = todo.pop();
        for (const [c, j] of F.list[f]) for (let k = 0; k < 4; k++) {
          const g = F.corner[c][k], want = (k - j) % 2 === 0 ? colour[f] : 1 - colour[f];
          if (colour[g] < 0) { colour[g] = want; todo.push(g); }
        }
      }
    }
    return colour;
  }
  // no crossing that a circle in the plane could cut off: none meets a region twice
  function isReduced(D) {
    if (!D.n) return true;
    const F = faces(D);
    return F.corner.every((q) => q[0] !== q[2] && q[1] !== q[3]);
  }
  // Is the diagram visibly a sum: is there a circle in the plane that meets it in two
  // points, with crossings on both sides? That is, two edges with the same two
  // regions beside them (sumCut gives two, or null). (A link with a diagram that
  // alternates and has no crossing to undo is a sum only if that diagram visibly is:
  // Menasco 1984.)
  function sumCut(D) {
    if (D.n < 2) return null;
    const F = faces(D), { tail } = slots(D), seen = new Map();
    for (let e = 0; e < 2 * D.n; e++) {
      const [c, k] = tail[e], a = F.corner[c][k], b = F.corner[c][(k + 3) % 4], key = Math.min(a, b) + '.' + Math.max(a, b);
      if (seen.has(key)) return [seen.get(key), e];
      seen.set(key, e);
    }
    return null;
  }
  const showsSum = (D) => sumCut(D) !== null;
  // The parts of a diagram in one piece that is visibly a sum: cut where such a circle
  // meets it, and each side closed up, until no part is visibly a sum. A part is the
  // piece of the cut component on one side, closed up, with the components on that
  // side; the link is the sum of the parts' links. (A diagram that is not visibly a
  // sum is its own one part.)
  function summands(D) {
    const e = sumCut(D);
    if (!e) return [D];
    const { nx, cp, cut, C, pos } = pas(D), q = cp[e[0]];
    if (cp[e[1]] !== q) return [D];
    // the passages from each cut on to the other, and the side of each crossing and
    // of each other component: that of the crossings it has
    const arcs = [[], []], side = new Int8Array(D.n).fill(-1), at = new Int8Array(C).fill(-1), todo = [];
    for (let s = 0; s < 2; s++) for (let k = nx[e[s]]; ; k = nx[k]) { arcs[s].push(k); if (k === e[1 - s]) break; }
    const put = (c, s) => {
      if (side[c] < 0) { side[c] = s; todo.push(c); }
      return side[c] === s;
    };
    for (let s = 0; s < 2; s++) for (const k of arcs[s]) if (!put(D.seq[k], s)) return [D];
    while (todo.length) {
      const c = todo.pop(), s = side[c];
      for (const k of pos[c]) {
        const r = cp[k];
        if (r === q || at[r] === s) continue;
        if (at[r] >= 0) return [D];
        at[r] = s;
        for (let j = cut[r]; j < cut[r + 1]; j++) if (!put(D.seq[j], s)) return [D];
      }
    }
    if (side.some((s) => s < 0)) return [D];
    const parts = [0, 1].map((s) => rebuild(D, [arcs[s]].concat(range(0, C).filter((r) => r !== q && at[r] === s).map((r) => range(cut[r], cut[r + 1])))));
    return summands(parts[0]).concat(summands(parts[1]));
  }
  // The pieces of the diagram: the sets of components joined by crossings (one with
  // no crossings is a piece of its own).
  function pieces(D) {
    const { cp, C, pos } = pas(D), up = range(0, C), find = (x) => (up[x] === x ? x : (up[x] = find(up[x])));
    for (let c = 0; c < D.n; c++) up[find(cp[pos[c][0]])] = find(cp[pos[c][1]]);
    const groups = new Map();
    for (let q = 0; q < C; q++) { const r = find(q); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(q); }
    return Array.from(groups.values());
  }
  // the diagram of some of the components (a piece, or a union of pieces)
  function sub(D, comps) { const { cut } = pas(D); return rebuild(D, comps.map((q) => range(cut[q], cut[q + 1]))); }
  // the diagram with groups of components lifted apart: their components in the
  // order of the groups, and the crossings between two groups gone
  function apart(D, groups) {
    const { cut, cp, pos } = pas(D), group = new Int32Array(cut.length - 1), drop = new Set();
    groups.forEach((g, i) => { for (const q of g) group[q] = i; });
    for (let c = 0; c < D.n; c++) if (group[cp[pos[c][0]]] !== group[cp[pos[c][1]]]) drop.add(c);
    return rebuild(D, groups.flat().map((q) => range(cut[q], cut[q + 1])), drop);
  }
  // The groups of components that can be pulled apart: wherever two groups cross, the
  // same one is on top, so it can be lifted clear of the other. They are the strongly
  // connected parts of the relation "passes over somewhere" between components.
  function layers(D) {
    const { cp, C, pos } = pas(D), above = Array.from({ length: C }, () => new Set());
    for (let c = 0; c < D.n; c++) {
      const a = cp[pos[c][0]], b = cp[pos[c][1]];
      if (a !== b) above[D.ov[pos[c][0]] ? a : b].add(D.ov[pos[c][0]] ? b : a);
    }
    const reach = above.map((_, q) => { const seen = new Set([q]), todo = [q]; while (todo.length) { const x = todo.pop(); for (const y of above[x]) if (!seen.has(y)) { seen.add(y); todo.push(y); } } return seen; });
    const groups = [], done = new Set();
    for (let q = 0; q < C; q++) {
      if (done.has(q)) continue;
      const g = [];
      for (let r = q; r < C; r++) if (!done.has(r) && reach[q].has(r) && reach[r].has(q)) { g.push(r); done.add(r); }
      groups.push(g);
    }
    return groups;
  }
  // the diagram with the components in `comps` walked the other way
  function reverse(D, comps) {
    const { cut, C } = pas(D), set = new Set(comps), lists = [], turned = new Set();
    for (let q = 0; q < C; q++) {
      const list = range(cut[q], cut[q + 1]);
      if (set.has(q)) { lists.push(list.slice().reverse()); for (const k of list) turned.add(k); } else lists.push(list);
    }
    return rebuild(D, lists, null, turned);
  }
  // the sum of two knots: one cut open and put into an edge of the other
  function sum(D, E) {
    return { n: D.n + E.n, seq: D.seq.concat(E.seq.map((c) => c + D.n)), ov: D.ov.concat(E.ov), sign: D.sign.concat(E.sign), cut: [0, 2 * (D.n + E.n)] };
  }

  /* ---------- from a code ---------- */

  // Number the passages 1, 2, …, 2n along the curve; each crossing gets an odd and an
  // even number, and the code lists the even partners of 1, 3, 5, …, negative where
  // the even passage is the upper one. The code does not say how the curve lies in
  // the plane; the signs of the crossings that make it planar are found by trying
  // them all. Of the two answers, mirror images of each other, this is the one in
  // which the first crossing is positive.
  function fromDT(code) {
    const n = code.length, seq = new Array(2 * n), ov = new Array(2 * n);
    code.forEach((v, m) => { const e = Math.abs(v) - 1; seq[2 * m] = m; seq[e] = m; ov[2 * m] = v > 0; ov[e] = !(v > 0); });
    for (let k = 0; k < 2 * n; k++) if (seq[k] === undefined) throw new Error('not a Dowker–Thistlethwaite code: ' + code);
    for (let bits = 0; bits < 1 << (n - 1); bits++) {
      const sign = Array.from({ length: n }, (_, c) => (c === 0 || !((bits >> (c - 1)) & 1) ? 1 : -1));
      const D = { n, seq, ov, sign, cut: [0, 2 * n] };
      if (faces(D).list.length === n + 2) return D;
    }
    throw new Error('no curve in the plane has the code ' + code);
  }
  // A planar diagram code, as the Knot Atlas writes it: X[i, j, k, l] for each
  // crossing, the edges round it anticlockwise from the under strand coming in (i);
  // the under strand goes on out along k, the upper one between j and l. Which way
  // the upper strand runs follows from where its edges come in and go out at the
  // other crossings. Each component is walked from its edge with the least label.
  function fromPD(pd) {
    const n = pd.length, occ = new Map();
    pd.forEach((X, x) => X.forEach((e, p) => { if (!occ.has(e)) occ.set(e, []); occ.get(e).push([x, p]); }));
    for (const [e, list] of occ) if (list.length !== 2) throw new Error('not a planar diagram code: edge ' + e);
    // +1 where an edge comes in to a crossing, −1 where it goes out
    const role = pd.map(() => [1, 0, -1, 0]);
    for (let changed = true; changed;) {
      changed = false;
      for (const [[x1, p1], [x2, p2]] of occ.values()) {
        const r1 = role[x1][p1], r2 = role[x2][p2];
        if (r1 && !r2) { role[x2][p2] = -r1; changed = true; } else if (r2 && !r1) { role[x1][p1] = -r2; changed = true; }
      }
      for (const r of role) {
        if (r[1] && !r[3]) { r[3] = -r[1]; changed = true; } else if (r[3] && !r[1]) { r[1] = -r[3]; changed = true; }
      }
    }
    if (role.some((r) => !r[1])) throw new Error('a component of this code is on top at every crossing');
    const into = new Map();
    for (const [e, list] of occ) for (const [x, p] of list) if (role[x][p] === 1) into.set(e, [x, p]);
    const comps = [], used = new Set();
    for (const e0 of Array.from(occ.keys()).sort((a, b) => a - b)) {
      if (used.has(e0)) continue;
      const list = [];
      let e = e0;
      do { used.add(e); const [x, p] = into.get(e); list.push([x, p % 2 === 1]); e = pd[x][(p + 2) % 4]; } while (e !== e0 && list.length <= 2 * n);
      comps.push(list);
    }
    const id = new Array(n).fill(-1), seq = [], ov = [], cut = [0], sign = [];
    let k = 0;
    for (const list of comps) {
      for (const [x, top] of list) { if (id[x] < 0) { id[x] = k++; sign.push(role[x][3] === 1 ? 1 : -1); } seq.push(id[x]); ov.push(top); }
      cut.push(seq.length);
    }
    return { n, seq, ov, sign, cut };
  }

  /* ---------- Kauffman's bracket and the Jones polynomial ---------- */

  // ⟨D⟩ in the variable A, with ⟨O⟩ = 1: each crossing is opened in its two ways,
  // A times the one that joins the regions the upper strand sweeps when turned
  // anticlockwise, plus 1/A times the other; a closed loop is worth −A² − A⁻².
  // The crossings are taken one at a time, and what is kept between them is how the
  // loose ends so far are joined up, with a polynomial for each way.
  function bracket(D) {
    const { C, cut } = pas(D);
    let free = 0;
    for (let q = 0; q < C; q++) if (cut[q] === cut[q + 1]) free++;
    if (!D.n) return ppow(LOOP, C - 1);
    const { S } = slots(D), done = new Array(D.n).fill(false), open = new Set();
    let terms = new Map([['', { m: new Map(), p: ONE }]]);
    const join = (m, x, y) => {
      if (x === y) return 1;
      const hx = m.has(x), hy = m.has(y);
      if (hx && hy) {
        const px = m.get(x), py = m.get(y);
        m.delete(x); m.delete(y);
        if (px === y) return 1;
        m.set(px, py); m.set(py, px);
      } else if (hx) { const px = m.get(x); m.delete(x); m.set(px, y); m.set(y, px); }
      else if (hy) { const py = m.get(y); m.delete(y); m.set(py, x); m.set(x, py); }
      else { m.set(x, y); m.set(y, x); }
      return 0;
    };
    const keyOf = (m) => { const out = []; m.forEach((v, k) => { if (k < v) out.push(k + '.' + v); }); return out.sort().join(','); };
    for (let step = 0; step < D.n; step++) {
      // next, the crossing with the most ends already loose
      let best = -1, score = -1;
      for (let c = 0; c < D.n; c++) {
        if (done[c]) continue;
        const sc = S[c].reduce((t, e) => t + (open.has(e) ? 1 : 0), 0);
        if (sc > score) { score = sc; best = c; }
      }
      done[best] = true;
      const s = S[best];
      s.forEach((e) => { if (open.has(e)) open.delete(e); else open.add(e); });
      const next = new Map();
      terms.forEach(({ m, p }) => {
        for (const [pairs, k] of [[[[s[0], s[1]], [s[2], s[3]]], 1], [[[s[0], s[3]], [s[1], s[2]]], -1]]) {
          const m2 = new Map(m);
          let q = pshift(p, k, 1);
          for (const [x, y] of pairs) if (join(m2, x, y)) q = pmul(q, LOOP);
          const key = keyOf(m2), had = next.get(key);
          if (had) had.p = padd(had.p, q); else next.set(key, { m: m2, p: q });
        }
      });
      terms = next;
    }
    // every loop was counted; the bracket of one loop is 1, so divide by −A² − A⁻²
    return pmul(pdiv(terms.get('').p, LOOP), ppow(LOOP, free));
  }
  // V(t) = (−A³)^(−w) ⟨D⟩ at A = t^(−1/4); for a link with an even number of
  // components the powers of t are halves
  function jones(D) {
    const w = writhe(D), f = pshift(bracket(D), -3 * w, w % 2 ? -1 : 1), hi = f.lo + f.c.length - 1;
    const c = [];
    for (let e = hi; e >= f.lo; e -= 4) c.push(f.c[e - f.lo]);
    return trim({ lo: -hi / 4, c });
  }
  // ⟨D⟩ up to a unit ±A^(3k): an invariant of the link with no orientation, which
  // tells it from its mirror image unless the two are the same
  function bracketClass(D) {
    const b = bracket(D);
    if (!b.c.length) return '0';
    const k = -Math.floor(b.lo / 3);
    return pkey(pshift(b, 3 * k, k % 2 ? -1 : 1));
  }

  /* ---------- the HOMFLYPT polynomial ---------- */

  // P(a, z), with P(O) = 1 and a P(L₊) − a⁻¹ P(L₋) = z P(L₀), as in Lickorish and
  // Millett's proof that it exists. Walk along the link, one component after another,
  // each from a base point; a diagram met on top at every crossing the first time
  // (or underneath at every one) is a pile of separate loops, with P = μ^(components
  // − 1), μ = (a − a⁻¹)/z. Otherwise switch a crossing that is met the other way, and
  // the skein relation adds the diagram with it opened, which has a crossing fewer.
  // Kinks and pairs of crossings that the second move removes are taken out first.
  // The base points, the order of the components and which of the two kinds of pile
  // to aim for are chosen to leave the fewest crossings to switch. Null if that takes
  // more than `budget` diagrams.
  const TOO_BIG = { tooBig: true };
  function homfly(D, budget) {
    budget = budget || 150000;
    const memo = new Map(), mu = poly2.add(poly2.mono(1, -1), poly2.mono(-1, -1), -1), muPow = [poly2.mono(0, 0)];
    const power = (k) => { while (muPow.length <= k) muPow.push(poly2.mul(muPow[muPow.length - 1], mu)); return muPow[k]; };
    let work = 0;
    function go(E) {
      E = tighten(E);
      const key = gkey(E), had = memo.get(key);
      if (had) return had;
      if (++work > budget) throw TOO_BIG;
      const x = toSwitch(E);
      let out;
      if (x < 0) out = power(pas(E).C - 1);
      else {
        const P1 = go(switched(E, x)), P0 = go(smoothed(E, x, true));
        out = E.sign[x] > 0 ? poly2.add(poly2.shift(P1, -2, 0), poly2.shift(P0, -1, 1)) : poly2.add(poly2.shift(P1, 2, 0), poly2.shift(P0, 1, 1), -1);
      }
      memo.set(key, out);
      return out;
    }
    try { return go(D); } catch (e) { if (e === TOO_BIG) return null; throw e; }
  }
  // kinks, and two crossings next to each other along both strands with the same
  // strand on top at both, taken out (which do not change P)
  function tighten(E) {
    for (;;) {
      if (!E.n) return E;
      const { nx, pos } = pas(E), m = 2 * E.n, other = (k) => (pos[E.seq[k]][0] === k ? pos[E.seq[k]][1] : pos[E.seq[k]][0]);
      let gone = null;
      for (let k = 0; k < m && !gone; k++) {
        const l = nx[k], x = E.seq[k], y = E.seq[l];
        if (x === y) gone = [x];
        else if (E.ov[k] === E.ov[l]) { const k2 = other(k), l2 = other(l); if (nx[k2] === l2 || nx[l2] === k2) gone = [x, y]; }
      }
      if (!gone) return E;
      E = without(E, gone);
    }
  }
  // the diagram as text, its crossings numbered in the order they are met
  function gkey(E) {
    const id = new Int32Array(E.n).fill(-1), parts = [], sg = new Array(E.n);
    let k = 0;
    for (let p = 0; p < 2 * E.n; p++) { const c = E.seq[p]; if (id[c] < 0) { id[c] = k++; sg[id[c]] = E.sign[c] > 0 ? '+' : '-'; } parts.push(id[c] * 2 + (E.ov[p] ? 1 : 0)); }
    return (E.cut || [0, 2 * E.n]).join(',') + '|' + parts.join(',') + '|' + sg.join('');
  }
  // a crossing to switch on the way to a pile of loops, or −1 if the diagram is one
  function toSwitch(E) {
    if (!E.n) return -1;
    const { nx, cp, cut, C, pos } = pas(E);
    const self = (c) => cp[pos[c][0]] === cp[pos[c][1]];
    let best = null;
    for (const up of [true, false]) {
      // for each component the base point that leaves the fewest of its own crossings met the wrong way
      const own = [];
      let ownBad = 0;
      for (let q = 0; q < C; q++) {
        let pick = [];
        if (cut[q] < cut[q + 1]) {
          pick = null;
          for (let b = cut[q]; b < cut[q + 1]; b++) {
            const seen = new Set(), bad = [];
            let k = b;
            do { const c = E.seq[k]; if (self(c) && !seen.has(c)) { seen.add(c); if (E.ov[k] !== up) bad.push(c); } k = nx[k]; } while (k !== b);
            if (!pick || bad.length < pick.length) pick = bad;
            if (!bad.length) break;
          }
        }
        own.push(pick);
        ownBad += pick.length;
      }
      // the components in an order: those earlier lie above (or below) those later
      const orders = C <= 5 ? perms(C) : [range(0, C)];
      for (const order of orders) {
        const rank = new Array(C);
        order.forEach((q, i) => { rank[q] = i; });
        const bad = [];
        for (let c = 0; c < E.n; c++) {
          if (self(c)) continue;
          const top = E.ov[pos[c][0]] ? cp[pos[c][0]] : cp[pos[c][1]], low = E.ov[pos[c][0]] ? cp[pos[c][1]] : cp[pos[c][0]];
          if ((rank[top] < rank[low]) !== up) bad.push(c);
        }
        const total = ownBad + bad.length;
        if (!best || total < best.total) best = { total, list: bad.length ? bad : own.find((o) => o.length) || [] };
        if (!total) return -1;
      }
    }
    return best.list.length ? best.list[0] : -1;
  }
  function perms(C) {
    if (C <= 1) return [range(0, C)];
    const out = [];
    for (const p of perms(C - 1)) for (let i = 0; i <= p.length; i++) out.push(p.slice(0, i).concat([C - 1], p.slice(i)));
    return out;
  }
  // P at a = 1/t, z = t^(1/2) − t^(−1/2): the Jones polynomial
  function homflyJones(P) {
    let J = 0;
    P.forEach((v, k) => { J = Math.max(J, -hj_(k)); });
    // in s = t^(1/2): a = s⁻², z = s − 1/s, with the negative powers of z cleared first
    let total = ZERO;
    for (const [i, j, c] of poly2.terms(P)) total = padd(total, pmul({ lo: -2 * i, c: [c] }, ppow(S_Z, j + J)));
    for (let r = 0; r < J; r++) total = pdiv(total, S_Z);
    return halve(total);
  }
  // P at a = 1: Conway's polynomial ∇(z)
  function homflyConway(P) {
    const by = new Map();
    for (const [, j, c] of poly2.terms(P)) by.set(j, (by.get(j) || 0) + c);
    let out = ZERO;
    by.forEach((c, j) => { if (c) out = padd(out, { lo: j, c: [c] }); });
    return out;
  }
  // Δ(t) = ∇(t^(1/2) − t^(−1/2))
  function conwayAlexander(N) {
    let total = ZERO;
    N.c.forEach((c, i) => { if (c) total = padd(total, pmul({ lo: 0, c: [c] }, ppow(S_Z, N.lo + i))); });
    return halve(total);
  }
  // a polynomial in s = t^(1/2) with only even or only odd powers, in t
  function halve(p) {
    if (!p.c.length) return ZERO;
    const c = [];
    for (let i = 0; i < p.c.length; i += 2) c.push(p.c[i]);
    return trim({ lo: p.lo / 2, c });
  }

  /* ---------- the Alexander polynomial ---------- */

  // The arcs of the diagram, from one under-passage to the next along a component
  // (a component on top everywhere, or with no crossings, is one arc): arc[k] is the
  // arc of edge k, and at each crossing, the arc on top and the two that end and
  // begin under it.
  function arcs(D) {
    const { pv, cut, C } = pas(D), m = 2 * D.n, arc = new Array(m), comp = [];
    let count = 0;
    for (let q = 0; q < C; q++) {
      const lo = cut[q], hi = cut[q + 1], unders = [];
      for (let k = lo; k < hi; k++) if (!D.ov[k]) unders.push(k);
      const r = Math.max(1, unders.length);
      for (let i = 0; i < r; i++) comp.push(q);
      // an edge belongs to the arc begun at the last under-passage at or before it
      let a = count + r - 1;
      for (let k = lo; k < hi; k++) { if (!D.ov[k]) a = k === unders[0] ? count : a + 1; arc[k] = a; }
      count += r;
    }
    const { under, upper } = slots(D);
    return { arc, count, comp, at: under.map((p, c) => ({ top: arc[upper[c]], into: arc[pv[p]], out: arc[p] })) };
  }

  const PRIMES = (() => { // four primes just under 2²⁶: products of two residues are exact
    const out = [];
    for (let p = (1 << 26) - 1; out.length < 4; p -= 2) { let ok = true; for (let d = 3; d * d <= p; d += 2) if (p % d === 0) { ok = false; break; } if (ok) out.push(p); }
    return out;
  })();
  const mulmod = (a, b, p) => { const hi = Math.floor(a / 8192), lo = a % 8192; return ((hi * b % p) * 8192 + lo * b) % p; };
  function powmod(a, e, p) { let r = 1; a %= p; while (e > 0) { if (e & 1) r = mulmod(r, a, p); a = mulmod(a, a, p); e = Math.floor(e / 2); } return r; }
  const invmod = (a, p) => powmod(((a % p) + p) % p, p - 2, p);
  // the determinant of a square matrix of residues mod p (destroys it)
  function detmod(M, p) {
    const n = M.length;
    let det = 1;
    for (let k = 0; k < n; k++) {
      let r = k;
      while (r < n && M[r][k] === 0) r++;
      if (r === n) return 0;
      if (r !== k) { const t = M[r]; M[r] = M[k]; M[k] = t; det = (p - det) % p; }
      det = mulmod(det, M[k][k], p);
      const inv = invmod(M[k][k], p);
      for (let i = k + 1; i < n; i++) {
        if (!M[i][k]) continue;
        const f = mulmod(M[i][k], inv, p);
        for (let j = k; j < n; j++) M[i][j] = (M[i][j] + p - mulmod(f, M[k][j], p)) % p;
      }
    }
    return det;
  }

  // Δ(t), from the presentation of the group by the arcs: a row for each crossing,
  // 1 − t on the arc on top and t, −1 on the two under it (which gets which depends
  // on the sign of the crossing); the determinant with a row and a column left out.
  // It is found at t = 0, 1, …, n − 1 modulo a few primes and put together, then
  // written symmetrically: for a knot with Δ(1) = 1; for a link Δ(1) = 0 and the
  // sign is not fixed by this (Conway's polynomial fixes it). 0 for a diagram that
  // falls apart. Null if a coefficient is too large to hold exactly.
  function alexander(D) {
    const n = D.n, { C } = pas(D), A = arcs(D);
    if (A.count !== n || pieces(D).length > 1) return C === 1 && !n ? ONE : ZERO;
    if (n < 2) return ONE;
    const { at } = A, size = n - 1, coef = [];
    for (const p of PRIMES) {
      const vals = [];
      for (let t = 0; t < n; t++) {
        const M = Array.from({ length: size }, () => new Array(size).fill(0));
        for (let c = 0; c < size; c++) {
          const r = at[c], pos = D.sign[c] > 0, add = (j, v) => { if (j < size) M[c][j] = (((M[c][j] + v) % p) + p) % p; };
          add(r.top, 1 - t); add(r.into, pos ? t : -1); add(r.out, pos ? -1 : t);
        }
        vals.push(detmod(M, p));
      }
      // Newton's interpolation through t = 0, …, n − 1, modulo p
      const dd = vals.slice();
      for (let k = 1; k < n; k++) { const inv = invmod(k, p); for (let i = n - 1; i >= k; i--) dd[i] = mulmod((dd[i] - dd[i - 1] + p) % p, inv, p); }
      let poly = [dd[n - 1]];
      for (let k = n - 2; k >= 0; k--) { // poly ← poly · (t − k) + dd[k]
        const next = new Array(poly.length + 1).fill(0);
        for (let i = 0; i < poly.length; i++) { next[i + 1] = (next[i + 1] + poly[i]) % p; next[i] = (next[i] + p - mulmod(poly[i], k % p, p)) % p; }
        next[0] = (next[0] + dd[k]) % p;
        poly = next;
      }
      coef.push(poly);
    }
    // the integers with these residues, the least in absolute value
    let mod = 1n;
    const big = new Array(n).fill(0n);
    PRIMES.forEach((p, k) => {
      const P = BigInt(p), inv = BigInt(invmod(Number(mod % P), p));
      for (let i = 0; i < n; i++) { const d = ((BigInt(coef[k][i]) - big[i]) % P + P) % P; big[i] += mod * ((d * inv) % P); }
      mod *= P;
    });
    const c = big.map((v) => (v > mod / 2n ? v - mod : v));
    if (c.some((v) => v > 9007199254740991n || v < -9007199254740991n)) return null;
    const q = trim({ lo: 0, c: c.map(Number) });
    if (!q.c.length) return ZERO;
    const lead = C === 1 ? q.c.reduce((a, b) => a + b, 0) : q.c[q.c.length - 1];
    return { lo: -(q.c.length - 1) / 2, c: lead < 0 ? q.c.map((x) => -x) : q.c };
  }

  /* ---------- the signature and the determinant ---------- */

  // Colour the regions like a chessboard; the black ones, joined by a half-twisted
  // band at each crossing, make a surface F spanned by the link. η = +1 at a crossing
  // whose band twists like a right-handed screw (the black regions are the ones the
  // upper strand sweeps, turned anticlockwise). Goeritz's matrix G has a row for each
  // white region but one: −Σ η over the crossings two regions share, and on the
  // diagonal what makes the rows (with the one left out) sum to zero. (A diagram in
  // one piece.)
  function goeritz(D) {
    const F = faces(D), nf = F.list.length, colour = chess(D, F);
    // white: the colour with fewer regions, for a smaller matrix
    const count = [0, 0];
    colour.forEach((x) => count[x]++);
    const white = count[0] <= count[1] ? 0 : 1, index = new Array(nf).fill(-1);
    let w = 0;
    colour.forEach((x, f) => { if (x === white) index[f] = w++; });
    const M = Array.from({ length: w }, () => new Array(w).fill(0)), eta = [];
    for (let c = 0; c < D.n; c++) {
      const q = F.corner[c], blackSwept = colour[q[1]] !== white; // corners 1 and 3 are the swept ones
      const h = blackSwept ? 1 : -1, a = index[blackSwept ? q[0] : q[1]], b = index[blackSwept ? q[2] : q[3]];
      eta.push(h);
      if (a !== b) { M[a][b] -= h; M[b][a] -= h; M[a][a] += h; M[b][b] += h; }
    }
    return { matrix: M.slice(1).map((row) => row.slice(1)), eta, colour, white, faces: F };
  }
  // the eigenvalues of a symmetric matrix (Jacobi's rotations)
  function eigenvalues(A) {
    const n = A.length, a = A.map((r) => r.slice());
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      }
    }
    return a.map((r, i) => r[i]).sort((x, y) => x - y);
  }
  // σ(L) = sign G − Σ η over the crossings where the surface F is not oriented by
  // the link (η equal to the sign of the crossing): Gordon and Litherland's formula,
  // with the convention that the right-handed trefoil has signature −2. Over the
  // pieces of a diagram that falls apart, the signatures add.
  function signature(D) {
    const P = pieces(D);
    if (P.length > 1) return P.reduce((t, comps) => t + signature(sub(D, comps)), 0);
    if (D.n < 2) return 0;
    const g = goeritz(D), ev = eigenvalues(g.matrix);
    let s = 0;
    for (const v of ev) s += v > 1e-9 ? 1 : v < -1e-9 ? -1 : 0;
    g.eta.forEach((h, c) => { if (h === D.sign[c]) s -= h; });
    return s;
  }
  // |V(−1)| = |Δ(−1)|
  const determinant = (D) => absAtMinusOne(jones(D));

  /* ---------- colourings ---------- */

  // The colourings of the arcs by numbers mod p with, at every crossing, twice the
  // arc on top equal to the sum of the two under it. Returns how many there are
  // (p to the power `dim`), how many of those are constant on each piece of the
  // diagram (p to the power `flat`), and one that is not, as a number for each
  // arc, if there is one.
  function colourings(D, p) {
    const A = arcs(D), n = A.count, rows = A.at.map((r) => {
      const row = new Array(n).fill(0);
      row[r.top] = (row[r.top] + 2) % p; row[r.into] = (row[r.into] + p - 1) % p; row[r.out] = (row[r.out] + p - 1) % p;
      return row;
    });
    const M = rows, pivot = [];
    let r = 0;
    for (let col = 0; col < n && r < M.length; col++) {
      let k = r;
      while (k < M.length && M[k][col] === 0) k++;
      if (k === M.length) continue;
      const t = M[k]; M[k] = M[r]; M[r] = t;
      const inv = invmod(M[r][col], p);
      for (let j = 0; j < n; j++) M[r][j] = (M[r][j] * inv) % p;
      for (let i = 0; i < M.length; i++) if (i !== r && M[i][col]) { const f = M[i][col]; for (let j = 0; j < n; j++) M[i][j] = (M[i][j] + (p - f) * M[r][j]) % p; }
      pivot.push(col);
      r++;
    }
    const free = [];
    for (let col = 0; col < n; col++) if (!pivot.includes(col)) free.push(col);
    // the piece of each arc
    const P = pieces(D), pieceOf = new Array(pas(D).C);
    P.forEach((comps, i) => comps.forEach((q) => { pieceOf[q] = i; }));
    let colour = null;
    for (const f of free) {
      const v = new Array(n).fill(0);
      v[f] = 1;
      pivot.forEach((col, i) => { v[col] = (p - M[i][f]) % p; });
      const seen = new Map();
      if (v.some((x, a) => { const i = pieceOf[A.comp[a]]; if (!seen.has(i)) seen.set(i, x); return seen.get(i) !== x; })) { colour = v; break; }
    }
    return { dim: free.length, flat: P.length, arcs: colour, arc: A.arc, count: n };
  }

  /* ---------- the group of the complement ---------- */

  // Wirtinger's presentation: a generator for each arc, the loop that goes once round
  // it, and a relation at each crossing between the arc on top (x), the arc that
  // ends under it (y) and the one that begins (y′): y′ = x y x⁻¹ at a positive
  // crossing, x⁻¹ y x at a negative one. Words are lists of ±(generator + 1).
  function wirtinger(D) {
    const A = arcs(D), rels = A.at.map((r, c) => {
      const x = r.top + 1, y = r.into + 1, y2 = r.out + 1;
      return D.sign[c] > 0 ? [x, y, -x, -y2] : [-x, y, x, -y2];
    });
    return { gens: A.count, rels, arcs: A };
  }
  function freeReduce(w) { const out = []; for (const x of w) { if (out.length && out[out.length - 1] === -x) out.pop(); else out.push(x); } return out; }
  function cyclicReduce(w) {
    w = freeReduce(w);
    let a = 0, b = w.length;
    while (b - a > 1 && w[a] === -w[b - 1]) { a++; b--; }
    return w.slice(a, b);
  }
  const invert = (w) => w.slice().reverse().map((x) => -x);
  // the least of the rotations of a word and of its inverse: one relation, however written
  function wordKey(w) {
    let best = null;
    for (const v of [w, invert(w)]) for (let r = 0; r < v.length; r++) { const s = v.slice(r).concat(v.slice(0, r)).join(','); if (best === null || s < best) best = s; }
    return best || '';
  }
  // A shorter presentation of the same group: Wirtinger's, less the relation of one
  // crossing in each piece of the diagram (it follows from the others), and then,
  // while some relation has a generator in it just once, that generator written in
  // terms of the others and put in wherever it occurs (Tietze's moves). Returns
  // { gens: [the generators left], rels: [words] }.
  function presentation(D) {
    const W = wirtinger(D), { cp, pos } = pas(D), skip = new Set();
    for (const comps of pieces(D)) { let last = -1; for (let c = 0; c < D.n; c++) if (comps.includes(cp[pos[c][0]])) last = c; if (last >= 0) skip.add(last); }
    let rels = W.rels.filter((_, c) => !skip.has(c)).map(cyclicReduce).filter((w) => w.length);
    const gens = new Set(range(1, W.gens + 1));
    const dedupe = (list) => { const seen = new Set(); return list.filter((w) => { const k = wordKey(w); if (seen.has(k)) return false; seen.add(k); return true; }); };
    rels = dedupe(rels);
    // of the generators that can go, the one that leaves the relations shortest
    for (;;) {
      let best = null;
      rels.forEach((r, ri) => {
        const count = new Map();
        for (const g of r) count.set(Math.abs(g), (count.get(Math.abs(g)) || 0) + 1);
        count.forEach((k, g) => {
          if (k !== 1) return;
          const i = r.findIndex((x) => Math.abs(x) === g), rot = r.slice(i).concat(r.slice(0, i));
          // rot = g^e w = 1, so g = w⁻¹ (e = 1) or w (e = −1)
          const value = rot[0] > 0 ? invert(rot.slice(1)) : rot.slice(1);
          const next = rels.filter((_, k2) => k2 !== ri).map((s) => cyclicReduce(s.flatMap((x) => (Math.abs(x) !== g ? [x] : x > 0 ? value : invert(value))))).filter((s) => s.length);
          const size = next.reduce((t, s) => t + s.length, 0);
          if (!best || size < best.size) best = { g, next, size };
        });
      });
      if (!best || best.next.some((s) => s.length > 600)) break;
      rels = dedupe(best.next);
      gens.delete(best.g);
    }
    return { gens: Array.from(gens), rels };
  }

  // The symmetric group S_n: its elements, products, inverses and the cycle type of each.
  const SYM = {};
  function sym(n) {
    if (SYM[n]) return SYM[n];
    const els = [], index = new Map();
    (function make(p, rest) { if (!rest.length) { index.set(p.join(), els.length); els.push(p); return; } rest.forEach((x, i) => make(p.concat([x]), rest.filter((_, j) => j !== i))); })([], range(0, n));
    const m = els.length, mul = new Int32Array(m * m), inv = new Int32Array(m), type = [];
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) mul[i * m + j] = index.get(els[j].map((x) => els[i][x]).join()); // first j, then i
    for (let i = 0; i < m; i++) {
      const q = new Array(n);
      els[i].forEach((x, k) => { q[x] = k; });
      inv[i] = index.get(q.join());
      const seen = new Array(n).fill(false), cyc = [];
      for (let k = 0; k < n; k++) if (!seen[k]) { let len = 0; for (let x = k; !seen[x]; x = els[i][x]) { seen[x] = true; len++; } cyc.push(len); }
      type.push(cyc.sort((a, b) => b - a).join('+'));
    }
    const classes = new Map();
    type.forEach((t, i) => { if (!classes.has(t)) classes.set(t, []); classes.get(t).push(i); });
    // odd: an even number of cycles of even length
    const odd = new Map(Array.from(classes.keys(), (t) => [t, t.split('+').filter((x) => +x % 2 === 0).length % 2 === 1]));
    SYM[n] = { n, m, els, mul, inv, type, classes, odd, id: index.get(range(0, n).join()) };
    return SYM[n];
  }
  // The homomorphisms of the group onto S_n, counted up to conjugation: each arc is
  // sent to a permutation, those of one component all of one cycle type, so that the
  // relation holds at every crossing, and the permutations generate S_n. (A
  // meridian of a knot sent to an even permutation cannot give all of S_n.) The arcs
  // are filled in as the relations force them, and tried in turn where they do not.
  // Null if that takes too long.
  function onto(D, n, budget) {
    const S = sym(n), m = S.m, W = wirtinger(D), A = W.arcs, g = A.count, C = pas(D).C;
    budget = budget || 400000;
    const rel = A.at.map((r, c) => ({ t: r.top, x: r.into, y: r.out, pos: D.sign[c] > 0 })), relsOf = Array.from({ length: g }, () => []);
    rel.forEach((r, i) => { relsOf[r.t].push(i); relsOf[r.x].push(i); relsOf[r.y].push(i); });
    const mul = (a, b) => S.mul[a * m + b], conj = (r, t, x) => (r.pos ? mul(mul(t, x), S.inv[t]) : mul(mul(S.inv[t], x), t)), back = (r, t, y) => (r.pos ? mul(mul(S.inv[t], y), t) : mul(mul(t, y), S.inv[t]));
    const val = new Int32Array(g).fill(-1), types = Array.from(S.classes.keys());
    // the next arc to try: the one on top at the most crossings where it would settle another arc
    const nextArc = () => {
      let a = -1, score = -1;
      for (let b = 0; b < g; b++) {
        if (val[b] >= 0) continue;
        let s = 0;
        for (const ri of relsOf[b]) { const r = rel[ri]; if (r.t === b && (val[r.x] >= 0) !== (val[r.y] >= 0)) s += 2; else if (r.t !== b && val[r.t] >= 0) s++; }
        if (s > score) { score = s; a = b; }
      }
      return a;
    };
    let want = null, work = 0, found = 0;
    function assign(a, v, trail) {
      if (val[a] >= 0) return val[a] === v;
      if (S.type[v] !== want[A.comp[a]]) return false;
      val[a] = v;
      trail.push(a);
      for (const ri of relsOf[a]) {
        const r = rel[ri], t = val[r.t], x = val[r.x], y = val[r.y];
        if (t < 0) continue;
        if (x >= 0 && y >= 0) { if (conj(r, t, x) !== y) return false; }
        else if (x >= 0) { if (!assign(r.y, conj(r, t, x), trail)) return false; }
        else if (y >= 0) { if (!assign(r.x, back(r, t, y), trail)) return false; }
      }
      return true;
    }
    function generatesAll() {
      const have = new Uint8Array(m), list = [], gens = Array.from(new Set(val));
      have[S.id] = 1; list.push(S.id);
      for (let i = 0; i < list.length; i++) for (const x of gens) { const y = mul(list[i], x); if (!have[y]) { have[y] = 1; list.push(y); } }
      return list.length === m;
    }
    function search() {
      if (++work > budget) throw TOO_BIG;
      const a = nextArc();
      if (a < 0) { if (generatesAll()) found++; return; }
      for (const v of S.classes.get(want[A.comp[a]])) { const trail = []; if (assign(a, v, trail)) search(); for (const b of trail) val[b] = -1; }
    }
    let total = 0;
    try {
      // a cycle type for each component, not all even
      const tuples = [[]];
      for (let q = 0; q < C; q++) { const next = []; for (const t of tuples) for (const ty of types) next.push(t.concat([ty])); tuples.length = 0; tuples.push(...next); }
      for (const t of tuples) {
        if (!t.some((ty) => S.odd.get(ty))) continue;
        want = t;
        // the first arc of the first component: one permutation of its type, the rest by conjugating
        const first = A.comp.indexOf(0), cls = S.classes.get(t[0]);
        found = 0;
        const trail = [];
        if (assign(first, cls[0], trail)) search();
        for (const b of trail) val[b] = -1;
        total += found * cls.length;
      }
    } catch (e) { if (e === TOO_BIG) return null; throw e; }
    let fact = 1;
    for (let k = 2; k <= n; k++) fact *= k;
    return Math.round(total / fact);
  }

  /* ---------- a crossing changed ---------- */

  // the diagram with crossing x switched
  function switched(E, x) {
    const F = copy(E), { pos } = pas(E);
    for (const k of pos[x]) F.ov[k] = !F.ov[k];
    F.sign[x] = -F.sign[x];
    return F;
  }
  // The diagram with crossing x opened: `oriented` the way that keeps the directions
  // of the strands (each strand coming in goes on out along the other), so that two
  // strands of one component make two components and two of different ones make
  // one; otherwise the other way, with a piece turned round. Of the two, the one that
  // joins the regions the upper strand sweeps when turned anticlockwise is the A way
  // of Kauffman's bracket: the oriented one at a positive crossing. With `keep`,
  // the diagram also says which crossing of E each of its own is (old).
  function smoothed(E, x, oriented, keep) {
    const { nx, cp, cut, C, pos } = pas(E), p = E.ov[pos[x][0]] ? pos[x][1] : pos[x][0], q = p === pos[x][0] ? pos[x][1] : pos[x][0];
    const walk = (from, until) => { const out = []; for (let k = from; k !== until; k = nx[k]) out.push(k); return out; };
    const A = cp[p], B = cp[q], comps = [];
    for (let c = 0; c < C; c++) if (c !== A && c !== B) comps.push(range(cut[c], cut[c + 1]));
    // the two runs either side of the crossing (one component) or the two components less it
    const P = A === B ? walk(nx[p], q) : walk(nx[p], p), Q = A === B ? walk(nx[q], p) : walk(nx[q], q);
    if (oriented) {
      if (A === B) comps.push(P, Q); else comps.push(P.concat(Q));
      return rebuild(E, comps, new Set([x]), null, keep);
    }
    // the other way: one run walked backwards after the other
    if (A === B) { comps.push(Q.concat(P.slice().reverse())); return rebuild(E, comps, new Set([x]), new Set(P), keep); }
    comps.push(P.concat(Q.slice().reverse()));
    return rebuild(E, comps, new Set([x]), new Set(Q), keep);
  }

  // The number of Seifert circles: the loops left when every crossing is opened the
  // way that keeps the directions of the strands.
  function seifertCircles(D) {
    let E = D;
    while (E.n) E = smoothed(E, 0, true);
    return E.cut.length - 1;
  }

  /* ---------- fewer crossings ---------- */

  // the crossings on the loop from c's first passage to its second, and on whatever
  // else lies on that side of c
  function sideOf(D, c) {
    const { nx, cp, cut, pos } = pas(D), side = new Set(), compsIn = new Set([cp[pos[c][0]]]), todo = [];
    for (let k = nx[pos[c][0]]; k !== pos[c][1]; k = nx[k]) { const y = D.seq[k]; if (y !== c && !side.has(y)) { side.add(y); todo.push(y); } }
    while (todo.length) {
      const y = todo.pop();
      for (const p of pos[y]) {
        const q = cp[p];
        if (compsIn.has(q)) continue;
        compsIn.add(q);
        for (let k = cut[q]; k < cut[q + 1]; k++) if (!side.has(D.seq[k])) { side.add(D.seq[k]); todo.push(D.seq[k]); }
      }
    }
    return side;
  }
  // One step that removes crossings, if there is one: untwisting at a crossing that
  // meets a region twice (the part of the link on one side is turned over, which
  // swaps over and under in it), or pulling apart two strands that cross twice in a
  // row with the same one on top.
  function reduceOnce(D) {
    if (!D.n) return null;
    const F = faces(D), { nx, cp, pos } = pas(D), m = 2 * D.n;
    for (let c = 0; c < D.n; c++) {
      const q = F.corner[c];
      if ((q[0] !== q[2] && q[1] !== q[3]) || cp[pos[c][0]] !== cp[pos[c][1]]) continue;
      const side = sideOf(D, c), E = copy(D);
      for (let k = 0; k < m; k++) if (side.has(D.seq[k])) E.ov[k] = !E.ov[k];
      return without(E, [c]);
    }
    for (const f of F.list) {
      if (f.length !== 2 || f[0][0] === f[1][0]) continue;
      const a = f[0][0], b = f[1][0];
      for (let k = 0; k < m; k++) {
        const k2 = nx[k];
        if (((D.seq[k] === a && D.seq[k2] === b) || (D.seq[k] === b && D.seq[k2] === a)) && D.ov[k] === D.ov[k2]) return without(D, [a, b]);
      }
    }
    return null;
  }
  // The triangles across which a strand can be slid (the third Reidemeister move):
  // regions with three corners at three crossings, one of the three strands on top
  // at both of its crossings. Each is given as the three edges of the triangle.
  function slides(D) {
    const F = faces(D), { nx } = pas(D), out = [];
    for (const f of F.list) {
      if (f.length !== 3) continue;
      if (new Set(f.map((x) => x[0])).size !== 3) continue;
      // the edge of the triangle leaving each corner: the end j of that crossing
      const edges = f.map(([c, j]) => F.S[c][j]);
      if (new Set(edges).size !== 3) continue;
      if (edges.some((e) => D.ov[e] && D.ov[nx[e]])) out.push(edges);
    }
    return out;
  }
  function slide(D, edges) {
    const E = copy(D), { nx } = pas(D);
    for (const e of edges) {
      const e2 = nx[e];
      [E.seq[e], E.seq[e2]] = [E.seq[e2], E.seq[e]];
      [E.ov[e], E.ov[e2]] = [E.ov[e2], E.ov[e]];
    }
    return E;
  }
  // A diagram of the same link with as few crossings as these moves reach: the two
  // above as long as they apply, and slides across triangles (up to `depth` in a
  // row) when they open the way to one.
  function simplify(D, depth) {
    depth = depth === undefined ? 2 : depth;
    let cur = D;
    for (;;) {
      let r;
      while ((r = reduceOnce(cur))) cur = r;
      if (cur.n < 3 || !depth) return cur;
      const seen = new Set([cur.seq.join() + cur.ov.join()]);
      let found = null, level = [cur];
      for (let d = 0; d < depth && !found; d++) {
        const next = [];
        for (const E of level) {
          for (const tri of slides(E)) {
            const S = slide(E, tri), key = S.seq.join() + S.ov.join();
            if (seen.has(key)) continue;
            seen.add(key);
            if (reduceOnce(S)) { found = S; break; }
            if (seen.size < 400) next.push(S);
          }
          if (found) break;
        }
        level = next;
      }
      if (!found) return cur;
      cur = found;
    }
  }

  /* ---------- moving the curve as a rope moves ---------- */

  // The curve moves in straight lines from where it is to `to` (the same vertices),
  // in small steps. After each step the crossings are compared with those before
  // it. A change is let through only when it is a Reidemeister move:
  //   a crossing born or lost on its own, in a small loop with nothing else on it;
  //   two born together between the same two strands (the strand that is moving
  //     more, by `lift`, goes on top), or two lost together where one strand was on
  //     top at both;
  //   a strand passing across a crossing, unless each of the three strands is on top
  //     at one crossing and under at the other.
  // Anything else, and the curve stops where it is: the strands are caught on each
  // other. Crossings that could not pass each other in such a move are also kept
  // SEP apart (two that a clasp holds, three round a triangle that cannot be
  // crossed), so that the picture always shows what holds what.
  // Returns { pts, cut, over, X, moved, blocked, caught }, `moved` the part of the
  // way made, `caught` what stopped it: { kind: 'clasp' | 'triangle', at: the
  // crossings, ts: the parameters of their passages }.
  //   opts.lift     how much each vertex is moving
  //   opts.strict   no change of the diagram at all
  //   opts.loose    crossings need not keep apart
  const TAU_MATCH = 1.5, SEP = 0.075;
  let caught = null; // where the last refused step was caught
  function gaussOK(X, R) {
    const V = visits(X), first = new Array(X.length);
    for (let k = 0; k < V.length; k++) {
      const v = V[k], x = X[v.c];
      if (R.cp[Math.floor(x.a)] !== R.cp[Math.floor(x.b)]) continue;
      if (v.w === 0) first[v.c] = k;
      else if ((k - first[v.c]) % 2 === 0) return false;
    }
    return true;
  }
  // for passages in order, the next along the same component
  function passNext(V, R) {
    const m = V.length, nx = new Int32Array(m);
    for (let k = 0; k < m;) {
      const c = R.cp[Math.floor(V[k].t)];
      let e = k;
      while (e + 1 < m && R.cp[Math.floor(V[e + 1].t)] === c) e++;
      for (let i = k; i <= e; i++) nx[i] = i < e ? i + 1 : k;
      k = e + 1;
    }
    return nx;
  }
  function transition(X0, over0, pts1, opts) {
    const N = pts1.length, R = ring(N, opts.cut), X1 = crossings(pts1, opts.cut), n0 = X0.length, n1 = X1.length;
    if (!gaussOK(X1, R)) return null;
    if (opts.strict && n1 !== n0) return null;
    const compOf = (t) => R.cp[Math.floor(t)];
    const cyc = (u, v) => { const c = compOf(u); if (c !== compOf(v)) return Infinity; const d = Math.abs(u - v), L = R.cut[c + 1] - R.cut[c]; return Math.min(d, L - d); };
    // which crossing is which: the nearest along the curve
    const cand = [];
    for (let i = 0; i < n0; i++) for (let j = 0; j < n1; j++) {
      const a = X0[i], b = X1[j];
      const d = a.e === b.e ? Math.max(cyc(a.a, b.a), cyc(a.b, b.b)) : Infinity, d2 = a.e !== b.e ? Math.max(cyc(a.a, b.b), cyc(a.b, b.a)) : Infinity;
      if (d < TAU_MATCH) cand.push([d, i, j, 0]); else if (d2 < TAU_MATCH) cand.push([d2, i, j, 1]);
    }
    cand.sort((u, v) => u[0] - v[0]);
    const to = new Array(n0).fill(-1), from = new Array(n1).fill(-1), swap = new Array(n0).fill(0);
    for (const [, i, j, s] of cand) if (to[i] < 0 && from[j] < 0) { to[i] = j; from[j] = i; swap[i] = s; }
    const over1 = new Array(n1).fill(0);
    for (let i = 0; i < n0; i++) if (to[i] >= 0) over1[to[i]] = over0[i] ^ swap[i];

    const V0 = visits(X0), V1 = visits(X1), nx0 = passNext(V0, R), nx1 = passNext(V1, R);
    const where = (V, n) => { const pos = Array.from({ length: n }, () => [0, 0]); V.forEach((v, k) => { pos[v.c][v.w] = k; }); return pos; };
    const pos0 = where(V0, n0), pos1 = where(V1, n1);
    const adj = (nx, k, l) => nx[k] === l || nx[l] === k;
    const hit = (list) => ({ at: list.map((x) => [x.x, x.y]), ts: list.flatMap((x) => [x.a, x.b]) });
    // the crossings that came or went, as single loops and as pairs
    function sort(list, pos, nx, pairOK, single) {
      const left = new Set(list);
      for (const i of list) {
        if (!left.has(i)) continue;
        left.delete(i);
        if (adj(nx, pos[i][0], pos[i][1])) { single(i); continue; }
        let done = false;
        for (const j of left) {
          for (const w of [0, 1]) {
            if (adj(nx, pos[i][0], pos[j][w]) && adj(nx, pos[i][1], pos[j][1 - w])) {
              if (!pairOK(i, j, w)) return false;
              left.delete(j); done = true; break;
            }
          }
          if (done) break;
        }
        if (!done) return false;
      }
      return true;
    }
    const dead = [], born = [];
    for (let i = 0; i < n0; i++) if (to[i] < 0) dead.push(i);
    for (let j = 0; j < n1; j++) if (from[j] < 0) born.push(j);
    if (opts.strict && (dead.length || born.length)) return null;
    // lost together: the strand through (i, first) and (j, w) was on top at both, or under at both
    if (!sort(dead, pos0, nx0, (i, j, w) => {
      const ok = (over0[i] === 0) === (over0[j] === w);
      if (!ok) caught = Object.assign({ kind: 'clasp' }, hit([X0[i], X0[j]]));
      return ok;
    }, () => {})) return null;
    const moving = (t) => { if (!opts.lift) return 0; const k = Math.floor(t), f = t - k; return opts.lift[k] * (1 - f) + opts.lift[R.nx[k]] * f; };
    if (!sort(born, pos1, nx1, (i, j, w) => {
      const a = X1[i], b = X1[j];
      // the strand of i's first passage, or the strand of its second: which moves more
      const firstUp = moving(a.a) + moving(w ? b.b : b.a) >= moving(a.b) + moving(w ? b.a : b.b);
      over1[i] = firstUp ? 0 : 1;
      over1[j] = firstUp ? w : 1 - w;
      return true;
    }, (i) => { over1[i] = 0; })) return null;

    // the crossings that stayed: in the same order along each component, or with a
    // strand slid across a crossing
    const C = R.cut.length - 1, keep0 = Array.from({ length: C }, () => []), keep1 = Array.from({ length: C }, () => []);
    V0.forEach((v) => { if (to[v.c] >= 0) keep0[compOf(v.t)].push(to[v.c] * 2 + (v.w ^ swap[v.c])); });
    V1.forEach((v) => { if (from[v.c] >= 0) keep1[compOf(v.t)].push(v.c * 2 + v.w); });
    const swaps = [];
    for (let c = 0; c < C; c++) {
      const s0 = keep0[c], s1 = keep1[c], L = s0.length;
      if (L !== s1.length) return null;
      if (!L) continue;
      let bestR = 0, bestMiss = Infinity;
      for (let r = 0; r < L; r++) {
        if (s0[r] !== s1[0] && bestMiss === 0) continue;
        let miss = 0;
        for (let k = 0; k < L && miss < bestMiss; k++) if (s0[(k + r) % L] !== s1[k]) miss++;
        if (miss < bestMiss) { bestMiss = miss; bestR = r; }
      }
      if (!bestMiss) continue;
      const P0 = s1.map((_, k) => s0[(k + bestR) % L]);
      // the places that differ come in pairs next to each other, swapped; start after a place that agrees
      let k0 = 0;
      while (k0 < L && P0[k0] !== s1[k0]) k0++;
      if (k0 === L) return null;
      for (let d = 1; d < L; d++) {
        const k = (k0 + d) % L, k2 = (k + 1) % L;
        if (P0[k] === s1[k]) continue;
        if (P0[k] !== s1[k2] || P0[k2] !== s1[k]) return null;
        swaps.push([s1[k], s1[k2]]);
        d++;
      }
    }
    if (swaps.length) {
      if (opts.strict || dead.length || born.length || swaps.length % 3) return null;
      const used = new Set();
      for (const s of swaps) {
        if (used.has(s)) continue;
        const x = s[0] >> 1, y = s[1] >> 1;
        if (x === y) return null;
        // the two other swaps of this triangle: x with z, and y with z
        const sx = swaps.find((u) => u !== s && !used.has(u) && (u[0] === (s[0] ^ 1) || u[1] === (s[0] ^ 1)));
        const sy = swaps.find((u) => u !== s && !used.has(u) && (u[0] === (s[1] ^ 1) || u[1] === (s[1] ^ 1)));
        if (!sx || !sy || sx === sy) return null;
        const zx = sx[0] === (s[0] ^ 1) ? sx[1] : sx[0], zy = sy[0] === (s[1] ^ 1) ? sy[1] : sy[0];
        if ((zx >> 1) !== (zy >> 1) || zx === zy || (zx >> 1) === x || (zx >> 1) === y) return null;
        used.add(s); used.add(sx); used.add(sy);
        // each pair must be next to each other along the curve, before and after
        const isTop = (tok) => over1[tok >> 1] === (tok & 1);
        let top = false;
        for (const u of [s, sx, sy]) {
          if (!adj(nx1, pos1[u[0] >> 1][u[0] & 1], pos1[u[1] >> 1][u[1] & 1])) return null;
          if (isTop(u[0]) && isTop(u[1])) top = true;
        }
        if (!top) { caught = Object.assign({ kind: 'triangle' }, hit([X1[x], X1[y], X1[zx >> 1]])); return null; }
      }
    }

    // crossings that cannot pass each other keep apart, while they come closer
    if (!opts.loose && n1 > 1) {
      const top1 = (c, w) => (over1[c] ? 1 : 0) === w, dist = (x, y) => Math.hypot(x.x - y.x, x.y - y.y), pv1 = new Int32Array(nx1.length);
      nx1.forEach((l, k) => { pv1[l] = k; });
      for (let k = 0; k < V1.length; k++) {
        const l = nx1[k], i = V1[k].c, j = V1[l].c;
        if (i === j) continue;
        const oi = pos1[i][1 - V1[k].w], oj = pos1[j][1 - V1[l].w];
        // a clasp: a bigon with a different strand on top at each end
        // (one just born as close as that is refused too)
        if (adj(nx1, oi, oj) && top1(i, V1[k].w) !== top1(j, V1[l].w)) {
          const d1 = dist(X1[i], X1[j]);
          if (d1 < SEP && (from[i] < 0 || from[j] < 0 || d1 < dist(X0[from[i]], X0[from[j]]) - 1e-9)) {
            caught = Object.assign({ kind: 'clasp' }, hit([X1[i], X1[j]]));
            return null;
          }
        }
        // a triangle: from j's other passage on to a crossing h whose other passage is next to i's
        for (const ph of [nx1[oj], pv1[oj]]) {
          const h = V1[ph].c;
          if (h === i || h === j) continue;
          const oh = pos1[h][1 - V1[ph].w];
          if (!adj(nx1, oh, oi)) continue;
          const tops = [top1(i, V1[k].w) + top1(j, V1[l].w), top1(j, V1[oj].w) + top1(h, V1[ph].w), top1(h, V1[oh].w) + top1(i, V1[oi].w)];
          if (tops.includes(2)) continue;
          const d1 = Math.max(dist(X1[i], X1[j]), dist(X1[j], X1[h]), dist(X1[h], X1[i]));
          if (d1 >= SEP) continue;
          const born = from[i] < 0 || from[j] < 0 || from[h] < 0;
          const d0 = born ? Infinity : Math.max(dist(X0[from[i]], X0[from[j]]), dist(X0[from[j]], X0[from[h]]), dist(X0[from[h]], X0[from[i]]));
          if (d1 < d0 - 1e-9) { caught = Object.assign({ kind: 'triangle' }, hit([X1[i], X1[j], X1[h]])); return null; }
        }
      }
    }
    return { X: X1, over: over1 };
  }

  function advance(knot, to, opts) {
    if (!opts || Array.isArray(opts) || ArrayBuffer.isView(opts)) opts = { lift: opts || null };
    const N = knot.pts.length, cut = knot.cut || [0, N], from = knot.pts, R = ring(N, cut);
    let dmax = 0, len = 0;
    for (let i = 0; i < N; i++) {
      dmax = Math.max(dmax, Math.hypot(to[i][0] - from[i][0], to[i][1] - from[i][1]));
      const q = from[R.nx[i]];
      len += Math.hypot(q[0] - from[i][0], q[1] - from[i][1]);
    }
    const X0 = knot.X || crossings(from, cut);
    if (dmax === 0) return { pts: from, cut, over: knot.over, X: X0, moved: 1, blocked: false, caught: null };
    const hmax = Math.min(1, 0.4 * (len / N) / dmax), lerp = (s) => from.map((p, i) => [p[0] + s * (to[i][0] - p[0]), p[1] + s * (to[i][1] - p[1])]);
    const o = { lift: opts.lift, cut, strict: opts.strict, loose: opts.loose };
    let pts = from, X = X0, over = knot.over, t = 0, h = hmax, blocked = false;
    caught = null;
    for (let guard = 0; t < 1 && guard < 600; guard++) {
      const s = Math.min(1, t + h), cand = s === 1 ? to : lerp(s), r = transition(X, over, cand, o);
      if (r) { pts = cand; X = r.X; over = r.over; t = s; h = Math.min(hmax, h * 2); caught = null; }
      else { h /= 2; if (h < hmax / 64) { blocked = true; break; } }
    }
    return { pts, cut, over, X, moved: t, blocked, caught: blocked ? caught : null };
  }

  // The curve with its sharp bends eased: wherever it turns more tightly than a
  // circle of radius RMIN, the vertices there move towards the middle of their
  // neighbours, by `advance`, up to `passes` times. A bend that is held tight by
  // another strand stays.
  const RMIN = 0.06;
  function fair(knot, passes, lift) {
    let r = knot;
    for (let pass = 0; pass < passes; pass++) {
      const Q = r.pts, N = Q.length, R = ring(N, r.cut), e = new Float64Array(N);
      let any = false;
      for (let k = 0; k < N; k++) {
        const a = Q[R.pv[k]], p = Q[k], b = Q[R.nx[k]], ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1];
        const turn = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)), x = turn / (0.5 * (Math.hypot(ux, uy) + Math.hypot(vx, vy)) + 1e-12) * RMIN - 1;
        if (x > 0) { e[k] = Math.min(1, x); any = true; }
      }
      if (!any) break;
      const to = Q.map((p, k) => {
        const n1 = R.nx[k], p1 = R.pv[k], w = Math.max(e[k], 0.6 * e[n1], 0.6 * e[p1], 0.3 * e[R.nx[n1]], 0.3 * e[R.pv[p1]]);
        if (!w) return p;
        const a = Q[p1], b = Q[n1];
        return [p[0] + 0.5 * w * ((a[0] + b[0]) / 2 - p[0]), p[1] + 0.5 * w * ((a[1] + b[1]) / 2 - p[1])];
      });
      const next = advance(r, to, { lift });
      if (next.moved === 0) break;
      r = { pts: next.pts, cut: r.cut, over: next.over, X: next.X };
    }
    return r;
  }

  // weights that fall off smoothly along the component, each way from vertex i
  function bump(w, R, i, reach, peak) {
    for (let d = -reach; d <= reach; d++) { const u = 1 - (d / (reach + 1)) ** 2, k = along(R, i, d); w[k] = Math.max(w[k], peak * u * u); }
  }
  // Pull the curve at vertex i by (dx, dy): the vertices within `reach` of it along
  // the curve (so many vertices each way) follow, less the farther they are. Where
  // that catches on another strand, the strand caught comes along too, as far as
  // the pulled one moves there, a few times over; then sharp bends are eased (fair).
  // All by `advance`, so the link does not change; the strand that is pulled passes
  // over what it meets.
  function pull(knot, i, dx, dy, reach) {
    const N = knot.pts.length, cut = knot.cut || [0, N], R = ring(N, cut), w = new Float64Array(N);
    bump(w, R, i, reach, 1);
    const weightAt = (t) => { const k = Math.floor(t), f = t - k; return w[k] * (1 - f) + w[R.nx[k]] * f; };
    let r = null, hold = null;
    for (let tries = 0; tries < 5; tries++) {
      const to = knot.pts.map((p, k) => (w[k] ? [p[0] + w[k] * dx, p[1] + w[k] * dy] : p));
      r = advance(knot, to, { lift: w });
      if (!r.blocked) { hold = null; break; }
      hold = r.caught;
      if (!hold || !hold.ts) break;
      const ws = hold.ts.map(weightAt), most = Math.max(...ws);
      if (most < 0.05) break;
      let grew = false;
      hold.ts.forEach((t, k) => {
        if (ws[k] > 0.6 * most) return;
        bump(w, R, Math.floor(t), Math.max(4, Math.round(0.6 * reach)), most);
        grew = true;
      });
      if (!grew) break;
    }
    const blocked = r.blocked;
    r = fair(r, 2, w);
    return { pts: r.pts, cut, over: r.over, X: r.X, blocked, caught: blocked ? hold : null };
  }

  // The same curve with its vertices evenly spaced, about `spacing` apart. The new
  // polygon cuts the corners of the old one a little; the old one is moved onto it by
  // `advance`, so the link does not change. Returns the link as it was if that stops.
  function respace(knot, spacing) {
    const A = knot.pts, cut = knot.cut || [0, A.length], from = [], to = [], B = [], fromCut = [0], bCut = [0];
    for (let c = 0; c + 1 < cut.length; c++) {
      const P = A.slice(cut[c], cut[c + 1]), NA = P.length, total = length(P), NB = Math.max(8, Math.round(total / spacing)), base = B.length;
      const acc = [0];
      for (let i = 0; i < NA; i++) { const q = P[(i + 1) % NA]; acc.push(acc[i] + Math.hypot(q[0] - P[i][0], q[1] - P[i][1])); }
      const Bc = resample(P, NB), all = [];
      for (let i = 0; i < NA; i++) all.push({ s: acc[i], old: i });
      for (let k = 1; k < NB; k++) all.push({ s: total * k / NB, fresh: k });
      all.sort((u, v) => u.s - v.s || (u.old !== undefined ? -1 : 1));
      // the old polygon with the new vertices put in on its edges, and where each goes:
      // a new vertex stays, an old one goes onto the chord between the new ones round it
      let last = 0;
      for (const v of all) {
        if (v.fresh !== undefined) { last = v.fresh; from.push(Bc[last]); to.push(Bc[last]); continue; }
        from.push(P[v.old]);
        if (v.old === 0) { to.push(Bc[0]); continue; }
        const b0 = Bc[last], b1 = Bc[(last + 1) % NB], s0 = total * last / NB, f = Math.max(0, Math.min(1, (v.s - s0) / (total / NB)));
        to.push([b0[0] + f * (b1[0] - b0[0]), b0[1] + f * (b1[1] - b0[1])]);
      }
      fromCut.push(from.length);
      for (const p of Bc) B.push(p);
      bCut.push(base + NB);
    }
    const r = advance({ pts: from, cut: fromCut, over: knot.over }, to, { loose: true });
    if (r.blocked) return knot;
    const XB = crossings(B, bCut);
    if (XB.length !== r.over.length) return knot;
    return { pts: B, cut: bCut, over: r.over, X: XB };
  }

  // A link from lines drawn by hand, one for each component: each closed up,
  // smoothed and evenly spaced (about `spacing` apart), over and under in turn.
  function fromStrokes(strokes, spacing) {
    const pts = [], cut = [0];
    for (const stroke of strokes) {
      if (stroke.length < 3) return null;
      let P = resample(stroke, Math.max(12, Math.round(length(stroke) / spacing)));
      P = resample(smooth(P, 6, 0.5), P.length);
      for (const p of P) pts.push(p);
      cut.push(pts.length);
    }
    const X = crossings(pts, cut);
    if (!gaussOK(X, ring(pts.length, cut))) return null;
    return { pts, cut, over: alternatingBits(pts, X, cut), X };
  }
  const fromStroke = (stroke, spacing) => fromStrokes([stroke], spacing);
  // The link with one more component, a line drawn by hand (closed up, smoothed and
  // spaced as by fromStrokes): along it, its crossings with itself and with the rest
  // go over and under in turn; the others stay as they were. Null if the line does
  // not make a curve.
  function withStroke(knot, stroke, spacing) {
    const fresh = fromStrokes([stroke], spacing);
    if (!fresh) return null;
    const base = knot.pts.length, pts = knot.pts.concat(fresh.pts), cut = (knot.cut && knot.cut.length > 1 ? knot.cut : [0]).concat([base + fresh.pts.length]);
    const X = crossings(pts, cut), old = knot.X || crossings(knot.pts, knot.cut), over = new Array(X.length).fill(-1);
    // the old crossings, where they were
    X.forEach((x, k) => { if (x.b < base) { const o = old.findIndex((y) => Math.abs(y.a - x.a) < 1e-9 && Math.abs(y.b - x.b) < 1e-9); if (o >= 0) over[k] = knot.over[o]; } });
    let up = true;
    for (const v of visits(X)) {
      if (v.t < base) continue;
      if (over[v.c] < 0) over[v.c] = up === (v.w === 0) ? 0 : 1;
      up = (over[v.c] === 0) !== (v.w === 0); // next time the other way from this time
    }
    return over.includes(-1) ? null : { pts, cut, over, X };
  }

  // The curve with its strands at parameters ta and tb cut where they leave the disc
  // of radius `room` round P, and the four ends joined in pairs by short curves
  // inside it. With a₀, a₁ the ends of the strand at ta before and after the disc and
  // b₀, b₁ those of the strand at tb: `oriented` joins a₀ to b₁ and b₀ to a₁, which
  // keeps the directions of the strands; otherwise a₀ to b₀ and b₁ to a₁, and the
  // strand from b₀ back to b₁ is walked the other way. Returns { out, outCut, oldOf }:
  // the new polygons, and the old vertex each new one is (−1 on the join from a₀, −2
  // on the other).
  function rejoin(knot, P, room, ta, tb, oriented) {
    const pts = knot.pts, N = pts.length, cut = knot.cut || [0, N], R = ring(N, cut);
    const dist = (p) => Math.hypot(p[0] - P[0], p[1] - P[1]);
    // the first vertex outside the disc, each way along each strand
    const exit = (t, dir) => {
      let v = dir > 0 ? R.nx[Math.floor(t)] : Math.floor(t);
      for (let s = 0; s < N && dist(pts[v]) < room; s++) v = dir > 0 ? R.nx[v] : R.pv[v];
      return v;
    };
    const a0 = exit(ta, -1), a1 = exit(ta, 1), b0 = exit(tb, -1), b1 = exit(tb, 1);
    // the vertices from u on to v, both included, along the component
    const piece = (u, v) => { const out = [u]; for (let s = 0; u !== v && s < N; s++) { u = R.nx[u]; out.push(u); } return out; };
    const dir = (i, back) => { const q = back ? pts[R.pv[i]] : pts[R.nx[i]], d = back ? [pts[i][0] - q[0], pts[i][1] - q[1]] : [q[0] - pts[i][0], q[1] - pts[i][1]], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l]; };
    // a join from the end of one run (vertex u, travelling along du) to the start of the next (v, along dv)
    const join = (u, du, v, dv) => {
      const p = pts[u], q = pts[v], c = 0.9 * room, out = [], n = Math.max(4, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / (0.3 * room)) + 3);
      for (let s = 1; s < n; s++) {
        const t = s / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, cc = 3 * (1 - t) * t * t, d = t ** 3;
        out.push([a * p[0] + b * (p[0] + c * du[0]) + cc * (q[0] - c * dv[0]) + d * q[0], a * p[1] + b * (p[1] + c * du[1]) + cc * (q[1] - c * dv[1]) + d * q[1]]);
      }
      return out;
    };
    const fwdEnd = (u) => dir(u, true), fwdStart = (v) => dir(v, false), neg = (d) => [-d[0], -d[1]];
    const same = R.cp[Math.floor(ta)] === R.cp[Math.floor(tb)];
    const runs = []; // each: a component as a list of [point, old vertex or join]
    const V = (list) => list.map((i) => [pts[i], i]), J = (list, tag) => list.map((p) => [p, tag]);
    if (same) {
      const P1 = piece(a1, b0), P2 = piece(b1, a0);
      if (oriented) {
        runs.push(V(P1).concat(J(join(b0, fwdEnd(b0), a1, fwdStart(a1)), -2)));
        runs.push(V(P2).concat(J(join(a0, fwdEnd(a0), b1, fwdStart(b1)), -1)));
      } else {
        const back = P1.slice().reverse();
        runs.push(V(P2).concat(J(join(a0, fwdEnd(a0), b0, neg(fwdEnd(b0))), -1), V(back), J(join(a1, neg(fwdStart(a1)), b1, fwdStart(b1)), -2)));
      }
    } else {
      const PA = piece(a1, a0), PB = piece(b1, b0);
      if (oriented) runs.push(V(PA).concat(J(join(a0, fwdEnd(a0), b1, fwdStart(b1)), -1), V(PB), J(join(b0, fwdEnd(b0), a1, fwdStart(a1)), -2)));
      else {
        const back = PB.slice().reverse();
        runs.push(V(PA).concat(J(join(a0, fwdEnd(a0), b0, neg(fwdEnd(b0))), -1), V(back), J(join(b1, neg(fwdStart(b1)), a1, fwdStart(a1)), -2)));
      }
    }
    // the other components as they were
    const ca = R.cp[Math.floor(ta)], cb = R.cp[Math.floor(tb)], out = [], oldOf = [], outCut = [0];
    for (let c = 0; c + 1 < cut.length; c++) if (c !== ca && c !== cb) runs.unshift(V(range(cut[c], cut[c + 1])));
    for (const run of runs) { for (const [p, i] of run) { out.push(p); oldOf.push(i); } outCut.push(out.length); }
    return { out, outCut, oldOf };
  }
  // Which strand is on top at each crossing of a curve made by rejoin: at an old
  // crossing (one at the same place as before), the same as before; at a new one,
  // between the two joins, the join `top` (−1 or −2). Null if a crossing is neither.
  function rejoinedBits(knot, made, Y, skip, top) {
    const pts = knot.pts, N = pts.length, R = ring(N, knot.cut || [0, N]), X = knot.X || crossings(pts, knot.cut), R2 = ring(made.out.length, made.outCut);
    const seg = (t, RR, old) => { const i = Math.floor(t), j = RR.nx[i]; return old ? [old[i], old[j]] : [i, j]; };
    const over = [];
    for (const y of Y) {
      const o = X.find((z) => z !== skip && Math.abs(z.x - y.x) < 1e-9 && Math.abs(z.y - y.y) < 1e-9);
      if (!o) {
        // between the joins: passage a is on the join on top, or it is not
        const sa = seg(y.a, R2, made.oldOf), sb = seg(y.b, R2, made.oldOf), on = (s, tag) => s[0] === tag || s[1] === tag;
        if (top === undefined || !((on(sa, -1) && on(sb, -2)) || (on(sa, -2) && on(sb, -1)))) return null;
        over.push(on(sa, top) ? 0 : 1);
        continue;
      }
      const topSeg = seg(knot.over[X.indexOf(o)] ? o.b : o.a, R), sa = seg(y.a, R2, made.oldOf);
      over.push((sa[0] === topSeg[0] && sa[1] === topSeg[1]) || (sa[0] === topSeg[1] && sa[1] === topSeg[0]) ? 0 : 1);
    }
    return over;
  }
  // The curve with crossing k opened (see smoothed), drawn: the two strands are cut
  // where they leave a small disc round the crossing, and the four ends joined in
  // pairs by short curves inside it. Returns { pts, cut, over } (the other
  // crossings as they were), or null if there is no room.
  function smoothAt(knot, k, oriented) {
    const pts = knot.pts, N = pts.length, cut = knot.cut || [0, N], R = ring(N, cut), X = knot.X || crossings(pts, cut), x = X[k], P = [x.x, x.y];
    // the radius of the disc: well inside anything else
    const near = (i, t) => { if (R.cp[i] !== R.cp[Math.floor(t)]) return false; const c = R.cp[i], L = R.cut[c + 1] - R.cut[c], d = Math.abs(i - Math.floor(t)); return Math.min(d, L - d) <= 3; };
    let room = 0.07;
    for (let i = 0; i < N; i++) {
      if (near(i, x.a) || near(i, x.b)) continue;
      const a = pts[i], b = pts[R.nx[i]], dx = b[0] - a[0], dy = b[1] - a[1], f = Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      room = Math.min(room, 0.45 * Math.hypot(a[0] + f * dx - P[0], a[1] + f * dy - P[1]));
    }
    for (const y of X) if (y !== x) room = Math.min(room, 0.45 * Math.hypot(y.x - P[0], y.y - P[1]));
    if (room < 0.008) return null;
    const made = rejoin({ pts, cut, over: knot.over, X }, P, room, x.a, x.b, oriented), Y = crossings(made.out, made.outCut);
    if (Y.length !== X.length - 1) return null;
    const over = rejoinedBits({ pts, cut, over: knot.over, X }, made, Y, x);
    return over ? { pts: made.out, cut: made.outCut, over, X: Y } : null;
  }
  // The curve with two strands that come close, at vertices i and j, joined across in
  // a small disc round the point between them, as rejoin does (`oriented` or not).
  // If the two joins cross, the join `top` is on top there (0: the one from the
  // strand of i before the disc, 1: the other). The other crossings stay as they
  // were. Returns { pts, cut, over, X, crossed }, or null if there is no room.
  function reconnect(knot, i, j, oriented, top) {
    const pts = knot.pts, N = pts.length, cut = knot.cut || [0, N], R = ring(N, cut), X = knot.X || crossings(pts, cut);
    const P = [(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2], gap = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    // the radius of the disc: a little more than the gap, well inside anything else
    const near = (v, w) => { if (R.cp[v] !== R.cp[w]) return false; const L = R.cut[R.cp[v] + 1] - R.cut[R.cp[v]], d = Math.abs(v - w); return Math.min(d, L - d) <= 6; };
    let room = Math.max(2.2 * gap, 0.06);
    for (let v = 0; v < N; v++) {
      if (near(v, i) || near(v, j)) continue;
      const a = pts[v], b = pts[R.nx[v]], dx = b[0] - a[0], dy = b[1] - a[1], f = Math.max(0, Math.min(1, ((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      room = Math.min(room, 0.8 * Math.hypot(a[0] + f * dx - P[0], a[1] + f * dy - P[1]));
    }
    for (const y of X) room = Math.min(room, 0.8 * Math.hypot(y.x - P[0], y.y - P[1]));
    if (room < 0.6 * gap + 0.004) return null;
    const made = rejoin({ pts, cut, over: knot.over, X }, P, room, i, j, oriented), Y = crossings(made.out, made.outCut);
    if (Y.length !== X.length && Y.length !== X.length + 1) return null;
    const over = rejoinedBits({ pts, cut, over: knot.over, X }, made, Y, null, top ? -2 : -1);
    if (!over) return null;
    // (the diagram must be one a curve in the plane can have)
    if (!gaussOK(Y, ring(made.out.length, made.outCut))) return null;
    return { pts: made.out, cut: made.outCut, over, X: Y, crossed: Y.length > X.length };
  }

  // Which strand is on top at each crossing of a curve, for it to have the diagram D:
  // the curve's components are D's, in order, each with the same crossings in the
  // same order as in D from some starting point, and the same signs. Null if the
  // curve's shadow is not D's.
  function matchBits(pts, cut, D, X) {
    cut = cut || [0, pts.length];
    X = X || crossings(pts, cut);
    const { cut: dc, C, pos } = pas(D);
    if (X.length !== D.n || C !== cut.length - 1) return null;
    const R = ring(pts.length, cut), V = visits(X), lists = Array.from({ length: C }, () => []), where = X.map(() => [null, null]);
    V.forEach((v, k) => { const q = R.cp[Math.floor(v.t)]; where[v.c][v.w] = [q, lists[q].length]; lists[q].push(k); });
    for (let q = 0; q < C; q++) if (lists[q].length !== dc[q + 1] - dc[q]) return null;
    const rot = new Array(C).fill(-1), dOf = (q, i) => dc[q] + ((i + rot[q]) % lists[q].length), dcomp = (p) => { let q = 0; while (dc[q + 1] <= p) q++; return q; };
    // with the starts chosen, the crossing of D at each crossing of the curve, and the bits
    function check() {
      const over = new Array(X.length);
      for (let x = 0; x < X.length; x++) {
        const [qa, ia] = where[x][0], [qb, ib] = where[x][1], pa = dOf(qa, ia), pb = dOf(qb, ib), c = D.seq[pa];
        if (D.seq[pb] !== c || pa === pb) return null;
        over[x] = D.ov[pa] ? 0 : 1;
        if ((over[x] ? -X[x].e : X[x].e) !== D.sign[c]) return null;
      }
      return over;
    }
    // choose the start of each component in turn; those met by a crossing follow from it
    function go(q) {
      while (q < C && (rot[q] >= 0 || !lists[q].length)) { if (rot[q] < 0) rot[q] = 0; q++; }
      if (q === C) return check();
      for (let r = 0; r < lists[q].length; r++) {
        const saved = rot.slice();
        rot[q] = r;
        // spread the choice along the crossings to other components
        let ok = true;
        for (let changed = true; changed && ok;) {
          changed = false;
          for (let x = 0; x < X.length && ok; x++) for (const w of [0, 1]) {
            const [qa, ia] = where[x][w], [qb, ib] = where[x][1 - w];
            if (rot[qa] < 0 || rot[qb] >= 0) continue;
            const pa = dOf(qa, ia), c = D.seq[pa], other = pos[c][0] === pa ? pos[c][1] : pos[c][0];
            if (dcomp(other) !== qb) { ok = false; break; }
            rot[qb] = ((other - dc[qb] - ib) % lists[qb].length + lists[qb].length) % lists[qb].length;
            changed = true;
          }
        }
        if (ok) { const out = go(q + 1); if (out) return out; }
        for (let i = 0; i < C; i++) rot[i] = saved[i];
      }
      return null;
    }
    return go(0);
  }

  /* ---------- the curve in space ---------- */

  // the periodic cubic spline through (x_k, y_k), 0 ≤ x₀ < x₁ < … < L: its second
  // derivatives at the x_k
  function periodicSpline(x, y, L) {
    const m = x.length;
    if (m < 2) return new Array(m).fill(0);
    const h = x.map((v, k) => (k + 1 < m ? x[k + 1] : x[0] + L) - v), d = x.map((_, k) => {
      const k0 = (k + m - 1) % m, k1 = (k + 1) % m;
      return 6 * ((y[k1] - y[k]) / h[k] - (y[k] - y[k0]) / h[k0]);
    });
    // the cyclic system h[k−1] M[k−1] + 2(h[k−1] + h[k]) M[k] + h[k] M[k+1] = d[k], solved densely when small
    const A = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let k = 0; k < m; k++) { const k0 = (k + m - 1) % m; A[k][k0] += h[k0]; A[k][k] += 2 * (h[k0] + h[k]); A[k][(k + 1) % m] += h[k]; }
    return solve(A, d);
  }
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      [M[k], M[p]] = [M[p], M[k]];
      for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; if (f) for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; }
    }
    const out = new Array(n).fill(0);
    for (let k = n - 1; k >= 0; k--) { let s = M[k][n]; for (let j = k + 1; j < n; j++) s -= M[k][j] * out[j]; out[k] = s / M[k][k]; }
    return out;
  }
  // A height for each vertex, so that the polygon with these heights is a smooth
  // curve in space with this diagram, as near the plane and as little bent as it can
  // be: the least ∫ (z² + ℓ⁴ z″²) ds along the curve (s its length), with the strand
  // that passes over at each crossing at least 2 above the one that passes under.
  // Such a curve is a sum of bumps, up at each over-passage and down at each
  // under-passage, all of one shape: G(s) = e^{−u}(cos u + sin u) with u = |s|/(ℓ√2),
  // the curve that z + ℓ⁴ z⁗ = 0 makes away from a point pushed up (wrapped round
  // its component). The bumps at a crossing are of one size μ ≥ 0, zero where the
  // strands are 2 apart anyway; the sizes are found on the dual problem by Hildreth's
  // method: each in turn made the best it can be with the others held. ℓ, how far
  // a bump reaches, grows with the room between passages: 0.35 of the mean length
  // of curve from one passage to the next (from 0.06 to 0.4). Where crossings are
  // far apart the bumps overlap into long even waves (narrow ones would leave the
  // strands level between crossings, with a kink at each); where they are close,
  // wide bumps would overshoot and the curve rise far above the plane.
  function heights(pts, X, over, cut, ell) {
    const N = pts.length, R = ring(N, cut), z = new Array(N).fill(0), m = X.length;
    if (!m) return z;
    // how far along its component each vertex is, and how long each component is
    const s = new Float64Array(N), len = [];
    for (let c = 0; c + 1 < R.cut.length; c++) {
      let acc = 0;
      for (let i = R.cut[c]; i < R.cut[c + 1]; i++) { s[i] = acc; const q = pts[R.nx[i]]; acc += Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]); }
      len.push(acc);
    }
    ell = ell || Math.max(0.06, Math.min(0.4, 0.35 * len.reduce((t, l) => t + l, 0) / (2 * m)));
    const place = (t) => { const i = Math.floor(t), c = R.cp[i], j = R.nx[i]; return { c, s: s[i] + (t - i) * ((j > i ? s[j] : len[c]) - s[i]) }; };
    // G wrapped round a component of length L, at x along it (0 ≤ x < L): with E(x) =
    // e^{−(1−i)bx}, b = 1/(ℓ√2), it is Re[(1 − i)(E(x) + E(L − x))/(1 − E(L))]
    const b = 1 / (ell * Math.SQRT2);
    const E = (x) => { const r = Math.exp(-b * x); return [r * Math.cos(b * x), r * Math.sin(b * x)]; };
    const G = (p, q) => {
      if (p.c !== q.c) return 0;
      const L = len[p.c], x = (((p.s - q.s) % L) + L) % L, e1 = E(x), e2 = E(L - x), eL = E(L);
      const nr = e1[0] + e2[0], ni = e1[1] + e2[1], dr = 1 - eL[0], di = -eL[1], dd = dr * dr + di * di;
      return ((nr * dr + ni * di) + (ni * dr - nr * di)) / dd;
    };
    const up = X.map((x, k) => place(over[k] ? x.b : x.a)), down = X.map((x, k) => place(over[k] ? x.a : x.b));
    // H[i][j]: the gap at crossing i that bumps of size 1 at crossing j make
    const H = up.map((u, i) => up.map((v, j) => G(u, v) - G(u, down[j]) - G(down[i], v) + G(down[i], down[j])));
    const mu = new Array(m).fill(0);
    for (let sweep = 0; sweep < 500; sweep++) {
      let moved = 0;
      for (let i = 0; i < m; i++) {
        let g = 2;
        for (let j = 0; j < m; j++) g -= H[i][j] * mu[j];
        const next = Math.max(0, mu[i] + g / H[i][i]);
        moved = Math.max(moved, Math.abs(next - mu[i]) * H[i][i]);
        mu[i] = next;
      }
      if (moved < 1e-6) break;
    }
    for (let i = 0; i < N; i++) {
      const p = { c: R.cp[i], s: s[i] };
      for (let k = 0; k < m; k++) if (mu[k]) z[i] += mu[k] * (G(p, up[k]) - G(p, down[k]));
    }
    return z;
  }

  /* ---------- curves: length, even spacing, smoothing ---------- */

  function length(pts) { let t = 0; for (let i = 0; i < pts.length; i++) { const q = pts[(i + 1) % pts.length]; t += Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]); } return t; }
  // n points evenly spaced along the closed polygon, starting at its first vertex
  function resample(pts, n) {
    const N = pts.length, total = length(pts), out = [];
    let i = 0, acc = 0, seg = Math.hypot(pts[1 % N][0] - pts[0][0], pts[1 % N][1] - pts[0][1]);
    for (let k = 0; k < n; k++) {
      const want = total * k / n;
      while (acc + seg < want && i < N - 1) { acc += seg; i++; const q = pts[(i + 1) % N]; seg = Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]); }
      const f = seg > 0 ? Math.min(1, (want - acc) / seg) : 0, q = pts[(i + 1) % N];
      out.push([pts[i][0] + f * (q[0] - pts[i][0]), pts[i][1] + f * (q[1] - pts[i][1])]);
    }
    return out;
  }
  // each vertex moved part of the way to the middle of its neighbours, `times` over
  function smooth(pts, times, k) {
    k = k === undefined ? 0.5 : k;
    let cur = pts;
    for (let t = 0; t < times; t++) {
      const N = cur.length;
      cur = cur.map((p, i) => { const a = cur[(i + N - 1) % N], b = cur[(i + 1) % N]; return [p[0] + k * ((a[0] + b[0]) / 2 - p[0]), p[1] + k * ((a[1] + b[1]) / 2 - p[1])]; });
    }
    return cur;
  }

  /* ---------- names ---------- */

  // A table of knots to name others by. `primes` lists { name, c, D }: a diagram of
  // each prime knot, c its crossing number. The catalogue holds them, their mirror
  // images, and the sums of these with at most `most` crossings in all, each with its
  // Jones polynomial, signature and Alexander polynomial, which add up over sums;
  // whether it alternates (all its parts do); and diagrams of its parts (Ds).
  function catalogue(primes, most) {
    most = most || 9;
    const base = [];
    for (const P of primes) {
      const V = jones(P.D), s = signature(P.D), A = alexander(P.D), same = peq(V, pflip(V)) && s === 0, alt = isAlternating(P.D);
      base.push({ parts: [{ name: P.name, mirror: false }], c: P.c, V, s, A, same, alt, Ds: [P.D] });
      if (!same) base.push({ parts: [{ name: P.name, mirror: true }], c: P.c, V: pflip(V), s: -s, A, same, alt, Ds: [mirror(P.D)] });
    }
    const all = base.slice();
    // sums: of knots in the order of `base`, so that each is made once
    const grow = (from, entry) => {
      for (let i = from; i < base.length; i++) {
        const b = base[i];
        if (entry.c + b.c > most) continue;
        const sum = { parts: entry.parts.concat(b.parts), c: entry.c + b.c, V: pmul(entry.V, b.V), s: entry.s + b.s, A: pmul(entry.A, b.A), same: false, alt: entry.alt && b.alt, Ds: entry.Ds.concat(b.Ds) };
        all.push(sum);
        grow(i, sum);
      }
    };
    base.forEach((b, i) => grow(i, b));
    for (const e of all) e.key = pkey(e.V) + '|' + e.s + '|' + pkey(e.A);
    const byKey = new Map(), byJones = new Map();
    for (const e of all) {
      if (!byKey.has(e.key)) byKey.set(e.key, []);
      byKey.get(e.key).push(e);
      const j = pkey(e.V);
      if (!byJones.has(j)) byJones.set(j, []);
      byJones.get(j).push(e);
    }
    return { all, byKey, byJones, most };
  }
  // The knot with these invariants (inv: { V, s, A }), S being a diagram of it.
  // { unknot } or { entries, sure }: the knots of the table with this Jones
  // polynomial, signature and Alexander polynomial. Where a prime knot and a sum
  // share them, a diagram that alternates and has no crossing to undo tells which,
  // and otherwise the numbers of maps of the group onto S₃, S₄ and S₅ may (9_12 has
  // one onto S₅, 4_1 # 5_2 fifteen). `sure` when one is left and the diagram is small
  // enough that the knot must be in the table (for the unknot: within the range in
  // which the Jones polynomial is known to detect it).
  function identify(cat, inv, S) {
    if (peq(inv.V, ONE)) return { unknot: true, sure: S.n <= 24, entries: [] };
    const key = pkey(inv.V) + '|' + inv.s + '|' + pkey(inv.A);
    let found = cat.byKey.get(key) || [];
    if (found.length > 1 && isAlternating(S) && isReduced(S)) { const isSum = showsSum(S); found = found.filter((e) => (e.parts.length > 1) === isSum); }
    if (found.length > 1) {
      const mine = mapsOnto(S);
      // (each entry's counted once, on the sum of the diagrams of its parts)
      if (mine) found = found.filter((e) => { if (e.maps === undefined) e.maps = mapsOnto(e.Ds.reduce((D, E) => sum(D, E))); return !e.maps || e.maps === mine; });
    }
    return { unknot: false, entries: found, sure: S.n <= cat.most && found.length === 1 };
  }
  // the numbers of maps of the group onto S₃, S₄ and S₅, or null if they take too long
  function mapsOnto(D) {
    const out = [3, 4, 5].map((n) => onto(D, n, 60000));
    return out.includes(null) ? null : out.join();
  }
  // A table of links of several components to name others by, like the catalogue of
  // knots. `primes` lists { name, c, D } for each prime link; `knots` is a catalogue of
  // knots. It holds the links, their mirror images, and the sums of these with each
  // other and with the knots, with at most `most` crossings in all. The Jones
  // polynomial and the linking numbers of a link depend on which way its components
  // run, so each entry has its forms: those of every way (turning all the components
  // round at once changes neither). A link and its mirror image with the same forms
  // are one entry. `full`: the most crossings of a prime link given, up to which the
  // table is taken to hold them all.
  function linkCatalogue(primes, knots, most) {
    most = most || 9;
    const unique = (forms) => {
      const m = new Map();
      for (const f of forms) { f.key = pkey(f.V) + '|' + f.lk.join(); if (!m.has(f.key)) m.set(f.key, f); }
      return Array.from(m.values());
    };
    const formsOf = (D) => {
      const C = D.cut.length - 1, out = [];
      for (let bits = 0; bits < 1 << (C - 1); bits++) { const E = reverse(D, range(1, C).filter((q) => (bits >> (q - 1)) & 1)); out.push({ V: jones(E), lk: linkingList(E), Ds: [E] }); }
      return unique(out);
    };
    const base = [];
    for (const P of primes) {
      const a = formsOf(P.D), b = formsOf(mirror(P.D)), same = a.length === b.length && a.every((f) => b.some((g) => g.key === f.key));
      const e = { parts: [{ name: P.name, mirror: false }], c: P.c, C: P.D.cut.length - 1, alt: isAlternating(P.D), same, forms: a };
      base.push(e);
      if (!same) base.push(Object.assign({}, e, { parts: [{ name: P.name, mirror: true }], forms: b }));
    }
    // the sum of two: each form of one with each of the other (the components of
    // different parts, but for the one joined, have linking number 0)
    const join = (x, y) => {
      const zeros = new Array((x.C - 1) * (y.C - 1)).fill(0), forms = [];
      for (const f of x.forms) for (const g of y.forms) forms.push({ V: pmul(f.V, g.V), lk: f.lk.concat(g.lk, zeros).sort((u, v) => u - v), Ds: f.Ds.concat(g.Ds) });
      return { parts: x.parts.concat(y.parts), c: x.c + y.c, C: x.C + y.C - 1, alt: x.alt && y.alt, same: false, forms: unique(forms) };
    };
    // sums of links, in the order of `base` so that each is made once; then each of
    // these with knots summed in
    const links = base.slice();
    const grow = (from, entry) => {
      for (let i = from; i < base.length; i++) {
        if (entry.c + base[i].c > most) continue;
        const sum = join(entry, base[i]);
        links.push(sum);
        grow(i, sum);
      }
    };
    base.forEach((b, i) => grow(i, b));
    const all = links.slice();
    for (const k of knots.all) for (const l of links) if (k.c + l.c <= most) all.push(join({ parts: k.parts, c: k.c, C: 1, alt: k.alt, forms: [{ V: k.V, lk: [], Ds: k.Ds }] }, l));
    const byKey = new Map();
    for (const e of all) for (const f of e.forms) {
      const k = e.C + '|' + f.key;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(e);
    }
    return { all, byKey, most, full: Math.max(...primes.map((P) => P.c)) };
  }
  // The link of several components with these invariants (inv: { V, H }, H the
  // HOMFLYPT polynomial or null), S a diagram of it in one piece whose components run
  // as they did when these were worked out. { entries, sure }: the links of the
  // catalogue with a form that has S's Jones polynomial and linking numbers, and its P
  // where that is known. Where S alternates and has no crossing to undo, the link
  // alternates, and it is a sum only if S visibly is one. `sure` when one is left and
  // S has at most cat.full crossings: the catalogue holds every link with so few that
  // does not fall apart, and one that falls apart has determinant 0, which none of the
  // catalogue has.
  function identifyLink(cat, inv, S) {
    const C = S.cut.length - 1, key = C + '|' + pkey(inv.V) + '|' + linkingList(S).join();
    let found = cat.byKey.get(key) || [];
    if (inv.H) found = found.filter((e) => e.forms.some((f) => C + '|' + f.key === key && hasP(f, inv.H)));
    if (isAlternating(S) && isReduced(S) && pieces(S).length === 1) { const isSum = showsSum(S); found = found.filter((e) => e.alt && (e.parts.length > 1) === isSum); }
    return { entries: found, sure: S.n <= cat.full && found.length === 1 };
  }
  // whether a form of the catalogue may have the HOMFLYPT polynomial P: its parts'
  // polynomials multiplied (each worked out once; where one is too large, it may)
  const PARTS_P = new WeakMap();
  function hasP(f, P) {
    if (f.H === undefined) {
      f.H = poly2.mono(0, 0);
      for (const D of f.Ds) {
        if (!PARTS_P.has(D)) PARTS_P.set(D, homfly(D));
        const h = PARTS_P.get(D);
        f.H = h && f.H && poly2.mul(f.H, h);
      }
    }
    return !f.H || poly2.eq(f.H, P);
  }

  G.Knots = {
    crossings, visits, diagram, alternatingBits, fromDT, fromPD, mirror, reverse, sum, pieces, sub, apart, layers, writhe, linking, linkingList, isAlternating, isReduced, showsSum, summands,
    slots, faces, chess, arcs, ring, pointAt, along,
    bracket, jones, bracketClass, homfly, toSwitch, homflyJones, homflyConway, conwayAlexander, alexander, goeritz, signature, determinant, colourings, eigenvalues,
    wirtinger, presentation, onto, freeReduce, cyclicReduce, switched, smoothed, seifertCircles,
    simplify, reduceOnce, slides, slide, transition, advance, pull, fair, respace, fromStroke, fromStrokes, withStroke, smoothAt, reconnect, matchBits, heights,
    length, resample, smooth, periodicSpline, catalogue, identify, linkCatalogue, identifyLink,
    poly: { add: padd, mul: pmul, eq: peq, key: pkey, flip: pflip, value: peval, trim, pow: ppow, div: pdiv, absAtMinusOne, ONE, ZERO },
    poly2, SEP,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
