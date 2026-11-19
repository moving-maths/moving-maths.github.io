// Knots: the diagram, its editor, the table, the readouts and the figures in the text.
// The mathematics is in knots.js, the automatic drawings in layout.js, the table of
// knots and links in table.js.
(function () {
  'use strict';
  const K = window.Knots, L = window.KnotLayout, P = K.poly, H2 = K.poly2, $ = (id) => document.getElementById(id);
  const stage = $('stage'), space = $('space'), sc = space.getContext('2d'), menu = $('menu');
  const H0 = 0.035;     // how far apart the vertices of the curve are; the frame is [−SPAN, SPAN]²
  const SPAN = 1.1;
  const MOST = 60;      // crossings (after tidying) up to which the invariants are worked out
  // the most crossings and components a link may have here: more takes too long to
  // work out (the HOMFLYPT polynomial of 30 crossings can take seconds), and makes a
  // dense tangle of the link in space
  const MAXX = 20, MAXC = 6;
  const START = '4_1';  // the page's own example

  // The single source of truth; draw() renders everything from it.
  const state = {
    pts: [], cut: [0, 0], over: [], X: [], // the link: closed polygons one after another (y upwards), where each begins, its crossings, which strand is on top at each
    name: null,          // the entry of the table it was loaded as, until it is changed
    colour: false,       // a colouring is shown
    p: 0,                // its modulus, when the reader has chosen one
    spin: !MM.reduceMotion(), // the link in space turns on its own
    tilt: 0.8, angle: 0.4, // how it is seen: tipped back from face on, turned about its axis
    drawing: false,      // drags on the frame draw new components
    drawHint: false,     // the hint over the picture shows (drawing, nothing drawn yet)
    stroke: null,        // the line being drawn
    caught: null,        // what the last pull was caught on, for a moment
    note: null,          // why the last step was refused, for a moment
    at: 0,               // the crossing that takes the keyboard focus
    menu: -1,            // the crossing whose four choices are open
    sel: -1,             // the component picked out by a click on its strand, to remove
    near: null,          // two strands a pull has brought together: { i, j, m }
    fusing: null,        // the same, with the ways to join them open
    loop: null,          // the generators' loops are shown, this one picked out: { a: its arc, key: of the diagram, name }
    anchors: null,       // where the loops sit on the curve, for the picture in space: [{ v: a vertex, name, chosen }]
    path: [], pathKey: null, // the steps of the working of the skein relation followed (see drawSkein)
    pick: 0,             // the crossing the figures in the text are about
    wpick: null,         // the crossing chosen in the working of the skein relation (else the one it switches next)
    tidied: null,        // the drawing Tidy made last: its points, and which strand is on top at each crossing
    smooth: null,        // the state (A or B at each crossing) of Kauffman's bracket figure
    w: 0, h: 0,          // the size of the frame
  };
  let example = null;    // links, reset and Save image (MM.example, at the end)
  const SCENE = ['pts', 'cut', 'over', 'X', 'name', 'colour', 'p', 'loop', 'anchors', 'tilt', 'angle', 'sel', 'pick', 'wpick', 'smooth', 'path', 'pathKey'];
  const history = [], future = []; // for Undo and Redo
  let press = null;      // the pointer, while it is down
  let morph = null;      // Tidy, while it moves the curve to its new place

  /* ---------- the table ---------- */

  // a drawing of the table: the polygon through which the spline goes
  const TUNIT = 1295 / 1.6;
  function decode(text) {
    const pts = [], cut = [0];
    for (const part of text.split(' ')) { for (let i = 0; i < part.length; i += 4) pts.push([parseInt(part.slice(i, i + 2), 36) / TUNIT - 0.8, parseInt(part.slice(i + 2, i + 4), 36) / TUNIT - 0.8]); cut.push(pts.length); }
    return { pts, cut };
  }
  const circle = (r, n) => Array.from({ length: n }, (_, i) => [r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n)]);
  // the unknot, the prime knots, the prime links: each with its diagram and its drawing
  const TABLE = [{ name: '0_1', link: false, c: 0, C: 1, D: { n: 0, seq: [], ov: [], sign: [], cut: [0, 0] } }].concat(window.KnotTable.map(([name, code, flip, text, bits, rolfsen, common]) => {
    const link = name[0] === 'L', D0 = link ? K.fromPD(code) : K.fromDT(code), D = flip ? K.mirror(D0) : D0;
    // (a common name as the Knot Atlas writes it, with a typographic apostrophe)
    return { name, link, rolfsen: rolfsen || null, common: common ? common.replace(/'/g, '’') : null, c: D.n, C: D.cut.length - 1, D, alt: K.isAlternating(D), text, bits };
  }));
  const byName = new Map(TABLE.map((t) => [t.name, t]));
  const KNOTS = TABLE.filter((t) => !t.link && t.c), LINKS = TABLE.filter((t) => t.link);
  const CAT = K.catalogue(KNOTS.map((t) => ({ name: t.name, c: t.c, D: t.D })));
  const LINKCAT = K.linkCatalogue(LINKS.map((t) => ({ name: t.name, c: t.c, D: t.D })), CAT);
  const place = new Map(TABLE.map((t, i) => [t.name, i]));
  // an entry of the table as a curve, with its vertices about `spacing` apart
  function tableCurve(t, spacing) {
    if (!t.c) { const n = Math.round(4.4 / spacing); return { pts: circle(0.7, n), cut: [0, n], over: [], X: [] }; }
    const poly = decode(t.text), s = L.spline(poly.pts, poly.cut, 1 / spacing), X = K.crossings(s.pts, s.cut);
    let over = t.bits.split('').map(Number);
    if (over.length !== X.length) over = K.matchBits(s.pts, s.cut, t.D, X);
    return { pts: s.pts, cut: s.cut, over, X };
  }
  const COMMON = { '3_1': ['Left-handed trefoil', 'Right-handed trefoil'], '4_1': ['Figure-eight knot'], '5_1': ['Cinquefoil knot'], '5_2': ['Three-twist knot'], '6_1': ['Stevedore knot'] };
  // a name of the tables in TeX, its numbers braced (9_25 is 9 with 25 below)
  const tex = (name) => name.replace(/_(\d+)/, '_{$1}').replace(/\^(\d+)/, '^{$1}');
  // (a link by its name in Rolfsen's table)
  const nameTex = (parts) => parts.map((q) => { const t = tex(byName.get(q.name).rolfsen || q.name); return q.mirror ? '\\overline{' + t + '}' : t; }).join('\\mathbin{\\#}');

  /* ---------- small tools ---------- */

  const el = MM.svg;
  const f1 = (v) => v.toFixed(1);
  const knot = () => ({ pts: state.pts, cut: state.cut, over: state.over, X: state.X });
  // a map from the frame [−SPAN, SPAN]² to pixels of a picture w × h
  function frame(w, h, span) {
    const s = Math.min(w, h) / (2 * (span || SPAN));
    return { s, px: (p) => [w / 2 + s * p[0], h / 2 - s * p[1]], back: (q) => [(q[0] - w / 2) / s, (h / 2 - q[1]) / s] };
  }
  // The two inner control points of the cubic Bézier from p1 to p2 on the centripetal
  // Catmull–Rom spline through p0, p1, p2, p3 (in the form of Yuksel, Schaefer and
  // Keyser): a smooth curve through every point, that does not overshoot where the
  // points are unevenly spaced.
  function bezier(p0, p1, p2, p3) {
    const d1 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])), d2 = Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])), d3 = Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]));
    let b1 = p1, b2 = p2;
    if (d1 > 1e-9 && d2 > 1e-9) { const a = d1 * d1, b = d2 * d2, c = 2 * a + 3 * d1 * d2 + b, m = 3 * d1 * (d1 + d2); b1 = [(a * p2[0] - b * p0[0] + c * p1[0]) / m, (a * p2[1] - b * p0[1] + c * p1[1]) / m]; }
    if (d3 > 1e-9 && d2 > 1e-9) { const a = d3 * d3, b = d2 * d2, c = 2 * a + 3 * d3 * d2 + b, m = 3 * d3 * (d3 + d2); b2 = [(a * p1[0] - b * p3[0] + c * p2[0]) / m, (a * p1[1] - b * p3[1] + c * p2[1]) / m]; }
    return [b1, b2];
  }
  // a smooth SVG path through points (pixels), its open ends going straight on, with `dig` decimals
  function smoothD(Q, closed, dig) {
    const n = Q.length, r = (v) => v.toFixed(dig === undefined ? 1 : dig);
    if (n < 3) return n ? 'M' + Q.map((q) => r(q[0]) + ' ' + r(q[1])).join('L') + (closed ? 'Z' : '') : '';
    const at = (i) => (closed ? Q[(i + n) % n] : i < 0 ? [2 * Q[0][0] - Q[1][0], 2 * Q[0][1] - Q[1][1]] : i >= n ? [2 * Q[n - 1][0] - Q[n - 2][0], 2 * Q[n - 1][1] - Q[n - 2][1]] : Q[i]);
    let d = 'M' + r(Q[0][0]) + ' ' + r(Q[0][1]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const [b1, b2] = bezier(at(i - 1), at(i), at(i + 1), at(i + 2)), p = at(i + 1);
      d += 'C' + r(b1[0]) + ' ' + r(b1[1]) + ' ' + r(b2[0]) + ' ' + r(b2[1]) + ' ' + r(p[0]) + ' ' + r(p[1]);
    }
    return d + (closed ? 'Z' : '');
  }
  const line = (F, pts, closed) => smoothD(pts.map(F.px), closed);

  /* ---------- the strands of a picture ---------- */

  // The pieces a picture of a link is drawn with. Each edge (from a passage through
  // a crossing to the next along its component) as a polyline, cut short at a
  // crossing where it passes under; a crossing can also be shown switched or opened
  // in one of its two ways (Kauffman's A and B), its four ends then joined in pairs.
  //   modes[c]  0 as it is, 1 switched, 'A' or 'B' opened
  //   gap       how far a strand stops short of a crossing (in units of the frame)
  // Returns { edges: [{ k, comp, pts }], loops: [{ comp, pts }], joins: [{ pts, ends }],
  // root }: root(k) names the loop of a state that edge k is on.
  function strands(kn, D, modes, gap) {
    const pts = kn.pts, R = K.ring(pts.length, kn.cut), X = kn.X, V = K.visits(X), m = V.length, nxp = new Int32Array(m);
    for (let k = 0; k < m;) {
      const c = R.cp[Math.floor(V[k].t)];
      let e = k;
      while (e + 1 < m && R.cp[Math.floor(V[e + 1].t)] === c) e++;
      for (let i = k; i <= e; i++) nxp[i] = i < e ? i + 1 : k;
      k = e + 1;
    }
    const rad = X.map((x, i) => { let d = Infinity; X.forEach((y, j) => { if (j !== i) d = Math.min(d, Math.hypot(x.x - y.x, x.y - y.y)); }); return Math.min(gap, 0.4 * d); });
    const opened = (c) => modes && (modes[c] === 'A' || modes[c] === 'B');
    const top = (k) => { const v = V[k]; return ((kn.over[v.c] ? 1 : 0) ^ (modes && modes[v.c] === 1 ? 1 : 0)) === v.w; };
    const cutAt = (k) => opened(V[k].c) || !top(k);
    // the polyline along a component from parameter t0 on to t1, cut short by r0 and r1
    function run(t0, t1, r0, r1) {
      const out = [K.pointAt(pts, R, t0)];
      let v = Math.floor(t0);
      const v1 = Math.floor(t1);
      if (v !== v1 || t1 <= t0) for (let s = 0; s < pts.length; s++) { v = R.nx[v]; out.push(pts[v]); if (v === v1) break; }
      out.push(K.pointAt(pts, R, t1));
      const L0 = [0];
      for (let i = 1; i < out.length; i++) L0.push(L0[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
      const len = L0[L0.length - 1], a = Math.min(r0, 0.45 * len), b = Math.min(r1, 0.45 * len), at = (x) => { let i = 1; while (i < L0.length - 1 && L0[i] < x) i++; const g = (x - L0[i - 1]) / ((L0[i] - L0[i - 1]) || 1); return [out[i - 1][0] + g * (out[i][0] - out[i - 1][0]), out[i - 1][1] + g * (out[i][1] - out[i - 1][1])]; };
      const res = [at(a)];
      for (let i = 1; i < out.length - 1; i++) if (L0[i] > a && L0[i] < len - b) res.push(out[i]);
      res.push(at(len - b));
      return res;
    }
    const edges = [];
    for (let k = 0; k < m; k++) {
      const k2 = nxp[k];
      edges.push({ k, comp: R.cp[Math.floor(V[k].t)], pts: run(V[k].t, V[k2].t, cutAt(k) ? rad[V[k].c] : 0, cutAt(k2) ? rad[V[k2].c] : 0) });
    }
    // components without crossings
    const loops = [], have = new Set(V.map((v) => R.cp[Math.floor(v.t)]));
    for (let c = 0; c + 1 < kn.cut.length; c++) if (!have.has(c) && kn.cut[c + 1] > kn.cut[c]) loops.push({ comp: c, pts: pts.slice(kn.cut[c], kn.cut[c + 1]) });
    // the loops of a state: edges joined straight through a crossing as it is, in pairs at one opened
    const up = Array.from({ length: m }, (_, i) => i), find = (x) => (up[x] === x ? x : (up[x] = find(up[x]))), join = (a, b) => { up[find(a)] = find(b); };
    const joins = [];
    if (m) {
      const S = K.slots(D).S;
      for (let c = 0; c < D.n; c++) {
        const s = S[c], pos = D.sign[c] > 0, inn = pos ? [true, false, false, true] : [true, true, false, false];
        if (!opened(c)) { join(s[0], s[2]); join(s[1], s[3]); continue; }
        const pairs = modes[c] === 'A' ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
        // the end of the edge at slot j, and the way into the crossing
        const end = (j) => {
          const e = edges[s[j]].pts, P0 = inn[j] ? e[e.length - 1] : e[0], P1 = inn[j] ? e[e.length - 2] || e[0] : e[1] || e[0], dx = P0[0] - P1[0], dy = P0[1] - P1[1], l = Math.hypot(dx, dy) || 1;
          return { p: P0, d: [dx / l, dy / l] };
        };
        for (const [i, j] of pairs) {
          join(s[i], s[j]);
          const a = end(i), b = end(j), r = rad[c] * 0.75, out = [];
          for (let q = 0; q <= 8; q++) {
            const t = q / 8, A = (1 - t) ** 3, B = 3 * (1 - t) ** 2 * t, Cc = 3 * (1 - t) * t * t, Dd = t ** 3;
            out.push([A * a.p[0] + B * (a.p[0] + r * a.d[0]) + Cc * (b.p[0] + r * b.d[0]) + Dd * b.p[0], A * a.p[1] + B * (a.p[1] + r * a.d[1]) + Cc * (b.p[1] + r * b.d[1]) + Dd * b.p[1]]);
          }
          joins.push({ pts: out, ends: [s[i], s[j]] });
        }
      }
    }
    return { edges, loops, joins, root: find, V, nxp };
  }
  const compColour = (c) => 'var(--k-' + (c % 6) + ')';

  /* ---------- the link ---------- */

  function setKnot(k, name) {
    state.pts = k.pts;
    state.cut = k.cut || [0, k.pts.length];
    state.over = k.over.slice();
    state.X = k.X || K.crossings(k.pts, state.cut);
    state.name = name || null;
    state.caught = null;
    state.near = null;
    closeMenu(false);
  }
  const snapshot = () => ({ pts: state.pts, cut: state.cut, over: state.over.slice(), name: state.name });
  // Each entry of the history also says what came after it: kind 'pull' or 'tidy' (a
  // move of the curve, which Undo and Redo play back as Tidy plays: sliding), with
  // Tidy's order of the components (order[i]: the component of the earlier curve that
  // the later one's i comes from); null for any other change, made at once.
  function remember(kind, order) {
    undoButtons.keep(history, Object.assign(snapshot(), { kind: kind || null, order: order || null }));
    future.length = 0;
  }
  const inverse = (order) => { const inv = []; order.forEach((o, i) => { inv[o] = i; }); return inv; };
  function undo() {
    const s = history.pop();
    if (!s) return;
    future.push(Object.assign(snapshot(), { kind: s.kind, order: s.order }));
    if (s.kind) slideTo(s, s.name, s.order && inverse(s.order), s.kind === 'pull'); else setKnot(s, s.name);
  }
  function redo() {
    const s = future.pop();
    if (!s) return;
    history.push(Object.assign(snapshot(), { kind: s.kind, order: s.order }));
    if (s.kind) slideTo(s, s.name, s.order, s.kind === 'pull'); else setKnot(s, s.name);
  }
  function load(name) { setKnot(tableCurve(byName.get(name), H0), name); }
  // Why the link k is too large to take (null if it is not): more than MAXC
  // components or MAXX crossings, and more than the link has now; with `count`, how
  // many crossings it would have.
  function tooBig(k, count) {
    const C = (k.cut || [0, k.pts.length]).length - 1, n = (k.X || K.crossings(k.pts, k.cut)).length;
    if (C > MAXC && C > state.cut.length - 1) return 'At most ' + MAXC + ' components here.';
    if (n > MAXX && n > state.X.length) return 'At most ' + MAXX + ' crossings here' + (count ? ': that would make ' + n + '.' : '.');
    return null;
  }
  // a note under the picture for a few seconds (why a step was refused)
  let noteTimer = 0;
  function say(text) {
    state.note = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { state.note = null; draw(); }, 4000);
  }

  // What is known of the link, from its diagram; worked out again only when the
  // diagram changes (moving the curve about does not change it).
  let known = { key: null };
  const keyOf = (D) => D.cut.join() + '|' + D.seq.join() + '|' + D.ov.map(Number).join('') + '|' + D.sign.join();
  function analyse() {
    const D = K.diagram(state.pts, state.over, state.X, state.cut), key = keyOf(D);
    if (known.key === key) return known;
    // (a generator's loop belongs to the diagram it was chosen on)
    if (state.loop && state.loop.key !== key) state.loop = null;
    const C = D.cut.length - 1;
    // (nothing drawn)
    if (!C) { state.smooth = null; known = { key, D, S: D, C: 0, n: 0, writhe: 0, lk: [], ok: false, empty: true }; return known; }
    const S = K.simplify(D), out = { key, D, S, C, n: D.n, writhe: K.writhe(D), lk: K.linking(D), ok: S.n <= MOST };
    if (out.ok) Object.assign(out, cachedInvariants(S, C));
    state.smooth = null;
    known = out;
    return out;
  }
  // (a pull changes the diagram at every move, but what is left after tidying it
  // seldom: the last few are kept)
  const kept = new Map();
  function cachedInvariants(S, C) {
    const key = keyOf(S);
    let inv = kept.get(key);
    if (!inv) { inv = invariants(S, C); kept.set(key, inv); if (kept.size > 24) kept.delete(kept.keys().next().value); }
    return inv;
  }
  // the invariants of a diagram S (with no crossing left to undo) of C components
  function invariants(S, C) {
    const out = { V: K.jones(S), s: K.signature(S), det: K.determinant(S) };
    out.H = S.n <= 30 ? K.homfly(S, 60000) : null;
    out.A = C === 1 ? K.alexander(S) : out.H ? K.conwayAlexander(K.homflyConway(out.H)) : null;
    out.id = nameOf(S, C, out);
    // the crossing number: known for an entry of the table, for a sum of alternating
    // ones (the crossings add up), and for a diagram that alternates with no crossing to
    // undo (in one piece, for a link); otherwise between the span of V and the crossings
    // left, or those of the sum
    const span = out.V.c.length - 1, one = out.id.entries && out.id.entries.length === 1 && out.id.sure ? out.id.entries[0] : null;
    const alt = K.isAlternating(S) && K.isReduced(S) && K.pieces(S).length === 1;
    if ((out.id.unknot || out.id.unlink) && out.id.sure) out.cross = [0, 0];
    else if (one && (one.parts.length === 1 || one.parts.every((q) => byName.get(q.name).alt))) out.cross = [one.c, one.c];
    else if (alt) out.cross = [S.n, S.n];
    else out.cross = [Math.min(S.n, Math.max(span, C === 1 && !out.id.entries.length && !out.id.unknot ? CAT.most + 1 : 0)), one ? Math.min(S.n, one.c) : S.n];
    // the primes that divide the determinant: the moduli of its colourings (any, if it is 0)
    out.primes = [];
    if (out.det === 0) out.primes = [3, 5, 7];
    for (let d = out.det, q = 3; d > 1 && q <= d; q += 2) if (d % q === 0) { out.primes.push(q); while (d % q === 0) d /= q; }
    out.pres = S.n <= 40 ? K.presentation(S) : null;
    out.onto = null;
    // Seifert's surface from S has genus (n − s + 1)/2 (s its Seifert circles), and Δ
    // has span at most twice the genus: both the genus for a diagram that alternates
    // (Crowell, Murasugi). The braid index is at least half the span of P in a, plus
    // one (Morton, Franks and Williams), and at most s (Yamada).
    const sc = K.seifertCircles(S);
    if (C === 1) out.genus = [out.A ? (out.A.c.length - 1) / 2 : 0, (S.n - sc + 1) / 2];
    if (out.H) { const as = H2.terms(out.H).map(([i]) => i); out.braid = [(Math.max(...as) - Math.min(...as)) / 2 + 1, sc]; }
    // the Arf invariant of a knot: 0 when its determinant is ±1 mod 8, 1 when ±3 (Levine)
    if (C === 1) out.arf = out.det % 8 === 1 || out.det % 8 === 7 ? 0 : 1;
    out.vol = undefined;
    return out;
  }
  // The knot or link of a diagram S with no crossing left to undo, from the tables
  // (inv: its invariants). Where S is visibly a sum, each part is named on its own: the
  // name is the sum of theirs, certain when theirs are. { unknot }, { unlink }, { split },
  // or { entries, sure }: each entry { parts: [{ name, mirror }], c }; { sum } where a
  // part is not in the table.
  function nameOf(S, C, inv) {
    if (!S.n) return C === 1 ? { unknot: true, sure: true, entries: [] } : { unlink: true, sure: true, entries: [] };
    if (C > 1 && K.pieces(S).length > 1) return { split: true, sure: true, entries: [] };
    const parts = K.summands(S);
    if (parts.length === 1) return lookUp(S, C, inv);
    const ids = [];
    let sure = true;
    for (const Q of parts) {
      const c = Q.cut.length - 1, id = lookUp(Q, c, c === 1 ? { V: K.jones(Q), s: K.signature(Q), A: K.alexander(Q) } : { V: K.jones(Q), H: Q.n <= 30 ? K.homfly(Q, 60000) : null });
      sure = sure && id.sure;
      if (id.unknot) continue;
      if (!id.entries.length) return { entries: [], sure: false, sum: true };
      ids.push(id);
    }
    if (!ids.length) return { unknot: true, sure, entries: [] };
    if (ids.length === 1) return { entries: ids[0].entries, sure };
    // every choice of an entry for each part (more than one where a part's invariants are shared)
    let sums = [[]];
    for (const id of ids) sums = sums.flatMap((s) => id.entries.map((e) => s.concat(e.parts)));
    const entries = new Map();
    for (const s of sums) {
      const ps = s.sort((p, q) => place.get(p.name) - place.get(q.name) || p.mirror - q.mirror), key = ps.map((q) => (q.mirror ? '-' : '') + q.name).join('#');
      if (!entries.has(key)) entries.set(key, { parts: ps, c: ps.reduce((t, q) => t + byName.get(q.name).c, 0) });
    }
    return { entries: Array.from(entries.values()), sure: sure && entries.size === 1 };
  }
  const lookUp = (S, C, inv) => (C === 1 ? K.identify(CAT, inv, S) : K.identifyLink(LINKCAT, inv, S));

  /* ---------- the diagram ---------- */

  const F = () => frame(state.w, state.h);
  function drawStage(info) {
    const active = document.activeElement, focus = active && stage.contains(active) ? active.dataset.key : null;
    stage.textContent = '';
    stage.setAttribute('viewBox', '0 0 ' + state.w + ' ' + state.h);
    stage.classList.toggle('is-drawing', state.drawing && !morph);
    stage.classList.toggle('is-pulling', !!(press && press.kind === 'pull' && press.moved));
    // (while Tidy moves the curve, the curve part of the way there)
    const Fr = F(), src = morph ? morph.now : state, D = morph ? K.diagram(src.pts, src.over, src.X, src.cut) : info.D, n = src.X.length, C = src.cut.length - 1;
    const loops = !morph && !state.drawing && state.loop && state.loop.key === info.key && info.pres;
    state.anchors = null;
    // the strands, in the colours of their components, or of the numbers of a colouring
    const col = !morph && !state.drawing && info.ok && state.colour && info.colouring, st = strands(src, D, null, 8 / Fr.s);
    // the component picked out: a band of the selection colour under it
    if (!morph && !state.drawing && state.sel >= 0 && state.sel < C) el('path', { class: 'kn-sel', d: line(Fr, state.pts.slice(state.cut[state.sel], state.cut[state.sel + 1]), true) }, stage);
    const colourOf = (e) => (col && col.p <= 7 ? 'var(--col-' + col.value[col.arc[e.k]] + ')' : col ? 'var(--ink-2)' : compColour(e.comp));
    for (const e of st.edges) el('path', { class: 'kn-strand', d: line(Fr, e.pts), style: 'stroke:' + colourOf(e) }, stage);
    for (const q of st.loops) el('path', { class: 'kn-strand', d: line(Fr, q.pts, true), style: 'stroke:' + compColour(q.comp) }, stage);
    if (morph) return;
    if (state.drawing) {
      if (C > 1) arrows(Fr, st, C, false);
      if (state.stroke && state.stroke.length > 1) el('path', { class: 'kn-strand is-new', d: line(Fr, state.stroke, false) }, stage);
      return;
    }
    // a colouring: the number of each arc, by the middle of its longest edge, on the side away from the middle of the picture
    if (col) {
      const best = new Map();
      for (const e of st.edges) { const a = col.arc[e.k], len = e.pts.length; if (!best.has(a) || len > best.get(a).pts.length) best.set(a, e); }
      best.forEach((e, a) => {
        const i = Math.floor(e.pts.length / 2), p = Fr.px(e.pts[i]), q = Fr.px(e.pts[Math.min(e.pts.length - 1, i + 1)]), dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
        const side = (p[0] - state.w / 2) * -dy + (p[1] - state.h / 2) * dx >= 0 ? 1 : -1;
        MM.svgLabel(el('text', { class: 'kn-num halo', x: f1(p[0] + side * -dy / len * 13), y: f1(p[1] + side * dx / len * 13 + 4.5) }, stage), '$' + col.value[a] + '$');
      });
    }
    // what the pointer takes hold of: the strands; over them the arrows and the crossings
    for (let c = 0; c < C; c++) el('path', { class: 'kn-hit draggable', d: line(Fr, state.pts.slice(state.cut[c], state.cut[c + 1]), true) }, stage);
    if (!col && C > 1 && !loops) arrows(Fr, st, C, true);
    state.X.forEach((x, k) => {
      const q = Fr.px([x.x, x.y]), sign = info.D.sign[k];
      const g = el('g', { class: 'kn-x draggable' + (state.menu === k ? ' is-open' : ''), 'data-k': k, 'data-key': 'x' + k, tabindex: k === Math.min(state.at, n - 1) ? 0 : -1, role: 'button', 'aria-haspopup': 'menu', 'aria-expanded': String(state.menu === k), 'aria-label': 'Crossing ' + (k + 1) + ' of ' + n + ', ' + (sign > 0 ? 'positive' : 'negative') + '. Switch or open it.' }, stage);
      el('circle', { class: 'pad', cx: f1(q[0]), cy: f1(q[1]), r: 13 }, g);
      el('circle', { class: 'ring', cx: f1(q[0]), cy: f1(q[1]), r: 11 }, g);
    });
    if (state.caught) for (const c of state.caught.at) { const q = Fr.px(c); el('circle', { class: 'kn-caught', cx: f1(q[0]), cy: f1(q[1]), r: 11 }, stage); }
    if (loops) drawLoops(Fr, st, info);
    // two strands brought together: where they would be joined
    const near = state.fusing || state.near;
    if (near) { const q = Fr.px(near.m); el('circle', { class: 'kn-near' + (state.fusing ? ' is-open' : ''), cx: f1(q[0]), cy: f1(q[1]), r: 12 }, stage); }
    if (focus) { const again = stage.querySelector('[data-key="' + focus + '"]'); if (again) again.focus(); }
  }
  // Which way each component of a link runs: an arrowhead in the middle of its
  // longest edge, which turns the component round when clicked (`live`). A knot has
  // none: turned round, its crossings keep their signs, and nothing on the page
  // changes (a knot and its reverse can differ, but no invariant here tells).
  function arrows(Fr, st, C, live) {
    const best = new Map();
    for (const e of st.edges) { const len = e.pts.reduce((t, p, i) => (i ? t + Math.hypot(p[0] - e.pts[i - 1][0], p[1] - e.pts[i - 1][1]) : 0), 0); if (!best.has(e.comp) || len > best.get(e.comp).len) best.set(e.comp, { e, len }); }
    for (const q of st.loops) best.set(q.comp, { e: { pts: q.pts.slice(0, Math.max(3, Math.floor(q.pts.length / 4))), comp: q.comp }, len: 1 });
    best.forEach(({ e }) => {
      const i = Math.floor(e.pts.length / 2), a = Fr.px(e.pts[Math.max(0, i - 1)]), b = Fr.px(e.pts[Math.min(e.pts.length - 1, i + 1)]), m = Fr.px(e.pts[i]);
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, s = 6.5;
      const g = el('g', live ? { class: 'kn-dir', 'data-c': e.comp, 'data-key': 'd' + e.comp, tabindex: 0, role: 'button', 'aria-label': 'Reverse component ' + (e.comp + 1) + ' of ' + C } : { class: 'kn-dir is-still', 'aria-hidden': 'true' }, stage);
      el('circle', { class: 'pad', cx: f1(m[0]), cy: f1(m[1]), r: 12 }, g);
      el('path', { class: 'kn-arrow', d: 'M' + f1(m[0] + s * ux) + ' ' + f1(m[1] + s * uy) + 'L' + f1(m[0] - s * ux - 0.8 * s * uy) + ' ' + f1(m[1] - s * uy + 0.8 * s * ux) + 'L' + f1(m[0] - s * ux + 0.8 * s * uy) + ' ' + f1(m[1] - s * uy - 0.8 * s * ux) + 'Z', style: 'fill:' + compColour(e.comp) }, g);
    });
  }
  // The loops the generators of the group are, each round its arc: from the left of
  // the arc (as it runs), under it to its right, and back over it (the convention of
  // the relations x_k = x_j x_i x_j⁻¹ at a positive crossing), drawn across the middle
  // of the arc's longest edge, with an arrow and the generator's name; the one picked
  // in the presentation darker. Where each sits on the curve (a vertex) is kept for
  // the picture in space.
  function drawLoops(Fr, st, info) {
    const A = K.arcs(info.D), names = genNames(info.pres);
    state.anchors = [];
    info.pres.gens.forEach((g, gi) => {
      let e = null;
      for (const x of st.edges) if (A.arc[x.k] === g - 1 && (!e || x.pts.length > e.pts.length)) e = x;
      if (!e || e.pts.length < 3) return;
      const chosen = g - 1 === state.loop.a, cls = chosen ? ' is-chosen' : '';
      const i = Math.floor(e.pts.length / 2), m = Fr.px(e.pts[i]), a = Fr.px(e.pts[Math.max(0, i - 2)]), b = Fr.px(e.pts[Math.min(e.pts.length - 1, i + 2)]);
      // along the arc (t) and to its left (n), in pixels (y downwards: left is (t_y, −t_x))
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], n = [t[1], -t[0]], R1 = 17, R2 = 9;
      const at = (th) => [m[0] + R1 * Math.cos(th) * n[0] + R2 * Math.sin(th) * t[0], m[1] + R1 * Math.cos(th) * n[1] + R2 * Math.sin(th) * t[1]];
      // the part that shows: all but a gap where it passes under the arc (at a quarter turn)
      const pts = [];
      for (let s2 = 0; s2 <= 40; s2++) pts.push(at(Math.PI / 2 + 0.5 + (2 * Math.PI - 1) * s2 / 40));
      const d = smoothD(pts, false);
      el('path', { class: 'kn-loop-gap', d }, stage);
      el('path', { class: 'kn-loop' + cls, d }, stage);
      // the arrow, on the right of the arc, the way the loop runs (back against the arc)
      const p = at(Math.PI), u = [-t[0], -t[1]], sz = 5;
      el('path', { class: 'kn-loop-arrow' + cls, d: 'M' + f1(p[0] + sz * u[0]) + ' ' + f1(p[1] + sz * u[1]) + 'L' + f1(p[0] - sz * u[0] - 0.8 * sz * u[1]) + ' ' + f1(p[1] - sz * u[1] + 0.8 * sz * u[0]) + 'L' + f1(p[0] - sz * u[0] + 0.8 * sz * u[1]) + ' ' + f1(p[1] - sz * u[1] - 0.8 * sz * u[0]) + 'Z' }, stage);
      const q = at(0);
      MM.svgLabel(el('text', { class: 'kn-num halo', x: f1(q[0] + 11 * n[0]), y: f1(q[1] + 11 * n[1] + 4.5) }, stage), '$' + names[gi] + '$');
      // the vertex of the curve there
      let v = -1, best = Infinity;
      for (let j = state.cut[e.comp]; j < state.cut[e.comp + 1]; j++) { const dd = (state.pts[j][0] - e.pts[i][0]) ** 2 + (state.pts[j][1] - e.pts[i][1]) ** 2; if (dd < best) { best = dd; v = j; } }
      if (v >= 0) state.anchors.push({ v, name: names[gi], chosen });
    });
  }
  // a component turned round: its points the other way, the same strands on top
  function turnRound(c) {
    const D = K.diagram(state.pts, state.over, state.X, state.cut), pts = state.pts.slice(), lo = state.cut[c], hi = state.cut[c + 1];
    for (let i = lo; i < hi; i++) pts[i] = state.pts[lo + hi - 1 - i];
    const X = K.crossings(pts, state.cut), over = X.length ? K.matchBits(pts, state.cut, K.reverse(D, [c]), X) : [];
    if (!over) return;
    remember();
    setKnot({ pts, cut: state.cut, over, X });
    draw();
    const again = stage.querySelector('[data-key="d' + c + '"]');
    if (again) again.focus();
  }

  /* ---------- the four things a crossing can be ---------- */

  // A small picture of four ends round a point, joined in two pairs: each end a
  // direction from the middle (y upwards) and a component; `top` is −1 if the pairs
  // do not cross (each drawn as a curve through the middle), or the pair on top
  // where they cross (straight lines, the other broken). Each half in the colour of
  // its end's component.
  function endsPicture(svg, ends, pairs, top) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 36 36');
    const c = [18, 18], R = 15, pt = (u, s) => [c[0] + s * R * u[0], c[1] - s * R * u[1]], xy = (p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    pairs.forEach(([i, j], k) => {
      const a = pt(ends[i].u, 1), b = pt(ends[j].u, 1);
      if (top < 0) {
        // a quadratic curve through the middle, in two halves
        const m = [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4];
        el('path', { d: 'M' + xy(a) + 'Q' + xy([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]) + ' ' + xy(m), style: 'stroke:' + compColour(ends[i].comp) }, svg);
        el('path', { d: 'M' + xy(m) + 'Q' + xy([(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]) + ' ' + xy(b), style: 'stroke:' + compColour(ends[j].comp) }, svg);
        return;
      }
      // straight through the middle, the lower pair stopping short of it
      const gap = k === top ? 0 : 0.3, m = (p, f) => [c[0] + f * (p[0] - c[0]), c[1] + f * (p[1] - c[1])];
      el('path', { d: 'M' + xy(a) + 'L' + xy(m(a, gap)), style: 'stroke:' + compColour(ends[i].comp) }, svg);
      el('path', { d: 'M' + xy(m(b, gap)) + 'L' + xy(b), style: 'stroke:' + compColour(ends[j].comp) }, svg);
    });
  }
  // The four ends of crossing k (in and out along the strand of the first passage,
  // then of the second), which component each is on, which strand is on top (0 or
  // 1) and the crossing's sign.
  function local(k) {
    const R = K.ring(state.pts.length, state.cut), x = state.X[k], dir = (t) => { const a = K.pointAt(state.pts, R, K.along(R, t, -1.5)), b = K.pointAt(state.pts, R, K.along(R, t, 1.5)), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const dA = dir(x.a), dB = dir(x.b), cA = R.cp[Math.floor(x.a)], cB = R.cp[Math.floor(x.b)];
    return { ends: [{ u: [-dA[0], -dA[1]], comp: cA }, { u: dA, comp: cA }, { u: [-dB[0], -dB[1]], comp: cB }, { u: dB, comp: cB }], top: state.over[k] ? 1 : 0, sign: state.over[k] ? -x.e : x.e };
  }
  // The choices: a crossing either way, and the two ways to open it (along the
  // strands, keeping their directions, and across); for two strands brought
  // together, the same four, as they are now among them.
  const CHOICES = [
    { kind: 'plus', name: 'Positive crossing' },
    { kind: 'minus', name: 'Negative crossing' },
    { kind: 'zero', name: 'Opened along the strands' },
    { kind: 'inf', name: 'Opened across the strands' },
  ];
  function crossingChoices(k) {
    const loc = local(k), topFor = (kind) => ((kind === 'plus') === (loc.sign > 0) ? loc.top : 1 - loc.top);
    return CHOICES.map((ch) => ({
      kind: ch.kind, name: ch.name, on: (ch.kind === 'plus' || ch.kind === 'minus') && (ch.kind === 'plus') === (loc.sign > 0),
      draw: (svg) => endsPicture(svg, loc.ends, ch.kind === 'zero' ? [[0, 3], [2, 1]] : ch.kind === 'inf' ? [[0, 2], [1, 3]] : [[0, 1], [2, 3]], ch.kind === 'zero' || ch.kind === 'inf' ? -1 : topFor(ch.kind)),
    }));
  }
  // Two strands brought together at vertices i and j: the four places round the
  // point between them where they leave a small circle (a₀, a₁ along the strand of
  // i, b₀, b₁ along that of j), and which way of joining them in pairs crosses.
  function fuseChoices(f) {
    const pts = state.pts, R = K.ring(pts.length, state.cut), m = f.m, r = Math.max(1.6 * Math.hypot(pts[f.i][0] - pts[f.j][0], pts[f.i][1] - pts[f.j][1]), 0.05);
    const leave = (v, d) => { let u = v; for (let s = 0; s < pts.length && Math.hypot(pts[u][0] - m[0], pts[u][1] - m[1]) < r; s++) u = d > 0 ? R.nx[u] : R.pv[u]; const dx = pts[u][0] - m[0], dy = pts[u][1] - m[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const ends = [{ u: leave(f.i, -1), comp: R.cp[f.i] }, { u: leave(f.i, 1), comp: R.cp[f.i] }, { u: leave(f.j, -1), comp: R.cp[f.j] }, { u: leave(f.j, 1), comp: R.cp[f.j] }];
    // two chords of a circle cross when the ends of one lie on either side of the other
    const ang = ends.map((e) => Math.atan2(e.u[1], e.u[0])), between = (x, a, b) => { const t = (v) => ((v - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); return t(x) < t(b); };
    const straightCrosses = between(ang[2], ang[0], ang[3]) !== between(ang[1], ang[0], ang[3]);
    const cross = straightCrosses ? [[0, 3], [2, 1]] : [[0, 2], [1, 3]], other = straightCrosses ? [[0, 2], [1, 3]] : [[0, 3], [2, 1]];
    return [
      { kind: 'top0', name: 'Crossing, one way', on: false, oriented: straightCrosses, top: 0, draw: (svg) => endsPicture(svg, ends, cross, 0) },
      { kind: 'top1', name: 'Crossing, the other way', on: false, oriented: straightCrosses, top: 1, draw: (svg) => endsPicture(svg, ends, cross, 1) },
      { kind: 'keep', name: 'Apart, as they are', on: true, draw: (svg) => endsPicture(svg, ends, [[0, 1], [2, 3]], -1) },
      { kind: 'swap', name: 'Joined the other way', on: false, oriented: !straightCrosses, top: 0, draw: (svg) => endsPicture(svg, ends, other, -1) },
    ];
  }
  let choices = [];
  // the menu at point p (in the frame), with these choices
  function showMenu(list, p, keyboard) {
    choices = list;
    menu.textContent = '';
    for (const ch of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.dataset.kind = ch.kind; b.tabIndex = ch.on ? 0 : -1;
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', String(ch.on));
      b.setAttribute('aria-label', ch.name);
      b.title = ch.name;
      ch.draw(el('svg', { 'aria-hidden': 'true' }, b));
      menu.appendChild(b);
    }
    menu.hidden = false;
    // beside the point, inside the frame
    const q = F().px(p), mw = menu.offsetWidth, mh = menu.offsetHeight;
    let top = q[1] + 18;
    if (top + mh > state.h - 4) top = q[1] - 18 - mh;
    menu.style.left = Math.max(4, Math.min(state.w - mw - 4, q[0] - mw / 2)) + 'px';
    menu.style.top = Math.max(4, top) + 'px';
    draw();
    if (keyboard) (menu.querySelector('[aria-checked="true"]') || menu.firstChild).focus();
  }
  function openMenu(k, keyboard) {
    closeMenu(false);
    state.menu = k;
    state.pick = k;
    menu.setAttribute('aria-label', 'The crossing');
    showMenu(crossingChoices(k), [state.X[k].x, state.X[k].y], keyboard);
  }
  function openFuse(f) {
    closeMenu(false);
    state.fusing = f;
    menu.setAttribute('aria-label', 'The two strands');
    showMenu(fuseChoices(f), f.m, false);
  }
  // A component picked out (its strand clicked at p): beside it, its tools. A link's
  // component can be turned round (a knot's direction changes nothing: see arrows),
  // and any can be removed.
  const TOOLS = {
    reverse: { title: 'Reverse', icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h9.5"/><path d="M10 3l2.5 2.5L10 8"/><path d="M13 10.5H3.5"/><path d="M6 8l-2.5 2.5L6 13"/></svg>' },
    remove: { title: 'Remove', icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7"/><path d="M11.5 4.5l-7 7"/></svg>' },
  };
  function openPicked(c, p) {
    closeMenu(false);
    state.sel = c;
    const C = state.cut.length - 1, name = C > 1 ? 'component ' + (c + 1) + ' of ' + C : 'the knot';
    choices = (C > 1 ? ['reverse', 'remove'] : ['remove']).map((kind) => ({ kind }));
    menu.textContent = '';
    menu.setAttribute('aria-label', name[0].toUpperCase() + name.slice(1));
    for (const { kind } of choices) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-sm btn-icon'; b.dataset.kind = kind;
      b.setAttribute('role', 'menuitem');
      b.setAttribute('aria-label', TOOLS[kind].title + ' ' + name);
      b.title = TOOLS[kind].title;
      b.innerHTML = TOOLS[kind].icon;
      menu.appendChild(b);
    }
    menu.hidden = false;
    const q = F().px(p), mw = menu.offsetWidth, mh = menu.offsetHeight;
    let top = q[1] + 16;
    if (top + mh > state.h - 4) top = q[1] - 16 - mh;
    menu.style.left = Math.max(4, Math.min(state.w - mw - 4, q[0] - mw / 2)) + 'px';
    menu.style.top = Math.max(4, top) + 'px';
    draw();
  }
  // The link without component c: the crossings among the others as they were (where
  // they are, the first passage still the first); with none left, ready to draw.
  function removeComponent(c) {
    finishMorph();
    const lo = state.cut[c], hi = state.cut[c + 1], len = hi - lo;
    if (!(len > 0)) return;
    const pts = state.pts.slice(0, lo).concat(state.pts.slice(hi)), cut = state.cut.slice(0, c + 1).concat(state.cut.slice(c + 2).map((v) => v - len));
    const X = K.crossings(pts, cut), over = X.map((x) => { const k = state.X.findIndex((y) => Math.abs(y.x - x.x) + Math.abs(y.y - x.y) < 1e-9); return k >= 0 ? state.over[k] : 0; });
    remember();
    setKnot({ pts, cut: pts.length ? cut : [0], over, X });
    if (!pts.length) { state.drawing = true; state.drawHint = true; state.stroke = null; }
    draw();
  }
  function closeMenu(focusBack) {
    if (state.menu < 0 && !state.fusing && state.sel < 0) return;
    const k = state.menu;
    state.menu = -1;
    state.fusing = null;
    state.sel = -1;
    menu.hidden = true;
    if (focusBack && k >= 0) { const t = stage.querySelector('[data-key="x' + k + '"]'); if (t) t.focus(); }
  }
  function choose(kind) {
    const ch = choices.find((c) => c.kind === kind), k = state.menu, f = state.fusing, sel = state.sel;
    closeMenu(false);
    if (!ch) return;
    if (kind === 'remove') { if (sel >= 0) removeComponent(sel); return; }
    if (kind === 'reverse') { if (sel >= 0) turnRound(sel); return; }
    let r = null;
    if (f) {
      if (kind === 'keep') { draw(); return; }
      r = K.reconnect(knot(), f.i, f.j, ch.oriented, ch.top);
    } else {
      if (kind === 'plus' || kind === 'minus') {
        if (!ch.on) { remember(); state.over[k] ^= 1; state.over = state.over.slice(); state.name = null; }
        draw();
        return;
      }
      r = K.smoothAt(knot(), k, kind === 'zero');
    }
    if (!r) { draw(); return; }
    const big = tooBig(r, false);
    if (big) { say(big); draw(); return; }
    remember();
    setKnot(K.respace(K.fair(K.respace(r, H0), 16), H0));
    state.pick = 0;
    draw();
  }
  menu.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) choose(b.dataset.kind); });
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('button')), i = items.indexOf(document.activeElement), step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (e.key === 'Escape') { closeMenu(true); draw(); e.preventDefault(); return; }
    if (e.key === 'Tab') { closeMenu(false); draw(); return; }
    if (!step && e.key !== 'Home' && e.key !== 'End') return;
    const to = items[e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + step + items.length) % items.length];
    items.forEach((b) => { b.tabIndex = b === to ? 0 : -1; });
    to.focus();
    e.preventDefault();
  });
  document.addEventListener('pointerdown', (e) => { if ((state.menu >= 0 || state.fusing || state.sel >= 0) && !menu.contains(e.target) && !e.target.closest('.kn-x')) { closeMenu(false); draw(); } });

  /* ---------- the link in space ---------- */

  // The link as a tube in space, seen tipped back by `tilt` from face on and turned
  // by `angle` about its own axis, lit from the upper left. It is drawn an edge at a
  // time, the farthest first: each edge a wider stroke of the ground (its rim), the
  // tube in its colour, paler the farther it is, and a paler line towards the light.
  // The edges end square, across the curve, just where the next begins (the curve
  // is smooth there), and run on a little into it, so that no seam shows: the tube
  // runs on farther than its rim and the light farther still, since where two soft
  // edges fall on one line the colour under them shows through. So wherever one
  // strand is in front of another, however they meet in the picture, the nearer
  // one's rim parts them, and nothing jumps as the picture turns. The heights come
  // from Knots.heights (in units of half the least gap at a crossing), scaled by
  // RELIEF, or less where crossings come so close together that a strand would
  // climb more steeply than STEEP: so that no strand darts up and down.
  let lifted = { pts: null };
  const TUBE = 6.2, RIM = 2, LX = -0.55, LY = -0.83, RELIEF = 0.1, STEEP = 0.8;
  function relief(pts, z, R) {
    let most = 0;
    for (let i = 0; i < pts.length; i++) { const j = R.nx[i], ds = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]); if (ds > 1e-9) most = Math.max(most, Math.abs(z[j] - z[i]) / ds); }
    return Math.max(0.03, Math.min(RELIEF, STEEP / (most || 1)));
  }
  function drawSpace() {
    const w = space.clientWidth, h = space.clientHeight;
    if (!w) return;
    sc.clearRect(0, 0, w + 2, h + 2);
    const src = morph ? morph.now : state;
    if (!src.pts.length) return;
    if (lifted.pts !== src.pts || lifted.over !== src.over) {
      const z = src.z || K.heights(src.pts, src.X, src.over, src.cut), R = K.ring(src.pts.length, src.cut), r = relief(src.pts, z, R);
      lifted = { pts: src.pts, over: src.over, cut: src.cut, P: src.pts.map((p, i) => [p[0], p[1], r * z[i]]), R };
    }
    const ca = Math.cos(state.angle), sa = Math.sin(state.angle), ct = Math.cos(state.tilt), st = Math.sin(state.tilt);
    const k = Math.min(w / 1.95, h / (1.95 * ct + 0.45)), R = lifted.R, P3 = lifted.P;
    const proj = (p) => {
      const x = ca * p[0] - sa * p[1], y = sa * p[0] + ca * p[1];
      const Y = ct * y + st * p[2], Z = -st * y + ct * p[2], f = 1 + 0.12 * Z; // a little nearer, a little larger
      return [w / 2 + k * x * f, h / 2 - k * Y * f, Z];
    };
    const Q = P3.map(proj), N = Q.length, depth = new Float64Array(N);
    for (let i = 0; i < N; i++) depth[i] = Q[i][2] + Q[R.nx[i]][2];
    // The generators' loops, while they show on the diagram (drawLoops): each a ring
    // round the tube, across it to its left, under it ahead, to its right and back
    // over it behind; drawn a piece at a time among the tube's edges, as thin tubes.
    const rings = [];
    if (state.anchors && !morph) for (const an of state.anchors) {
      if (an.v >= N) continue;
      const c = P3[an.v], a = P3[R.pv[an.v]], b = P3[R.nx[an.v]], unit = (u) => { const l = Math.hypot(u[0], u[1], u[2]) || 1; return u.map((x) => x / l); };
      const T = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), Nl = unit([-T[1], T[0], 0]), B = unit([-T[2] * T[0], -T[2] * T[1], 1 - T[2] * T[2]]);
      const r1 = 13 / k, r2 = 7 / k, up = 8 / k, at = (th) => { const cs = Math.cos(th), sn = Math.sin(th); return proj([0, 1, 2].map((j) => c[j] + r1 * cs * Nl[j] + r2 * sn * T[j] - up * sn * B[j])); };
      const pts = Array.from({ length: 29 }, (_, s2) => at(2 * Math.PI * s2 / 28));
      rings.push({ pts, an, label: proj([0, 1, 2].map((j) => c[j] + (r1 + 10 / k) * Nl[j])) });
    }
    // all the pieces, farthest first: the tube's edges (r < 0), the rings' pieces
    const order = Array.from({ length: N }, (_, i) => ({ r: -1, i, z: depth[i] }));
    rings.forEach((g, r) => { for (let s2 = 0; s2 < 28; s2++) order.push({ r, i: s2, z: g.pts[s2][2] + g.pts[s2 + 1][2] }); });
    order.sort((u, v) => u.z - v.z);
    // the colours: of each component, paler the farther (in 32 steps), and its light
    const rim = MM.color('surface'), ground = rgb(rim), white = [255, 255, 255];
    const mix = (a, b, f) => a.map((v, j) => b[j] + f * (v - b[j])), css = (a) => 'rgb(' + a.map(Math.round).join(',') + ')';
    const inks = [0, 1, 2, 3, 4, 5].map((c) => rgb(MM.color('tube-' + c))), paint = new Map();
    const colours = (c, z) => {
      const step = Math.round((Math.max(0.55, Math.min(1, 0.8 + 0.9 * z)) - 0.55) / 0.45 * 31), key = (c % 6) * 32 + step;
      if (!paint.has(key)) { const f = 0.55 + 0.45 * step / 31, ink = inks[c % 6]; paint.set(key, [css(mix(ink, ground, f)), css(mix(mix(ink, white, 0.5), ground, f))]); }
      return paint.get(key);
    };
    const shift = [0.2 * TUBE * LX, 0.2 * TUBE * LY], none = [0, 0], RUN = 1.5;
    // one edge, moved by o, run on by `run` at both ends; the light (moved by shift)
    // a pixel past the tube's ends, measured across, whichever way the edge runs
    const edge = (i, o, run) => {
      const j = R.nx[i], a = Q[i], d = Q[j], [b, c] = bezier(Q[R.pv[i]], a, d, Q[R.nx[j]]);
      let ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - c[0], vy = d[1] - c[1];
      const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
      ux /= lu; uy /= lu; vx /= lv; vy /= lv;
      const r0 = o === none ? run : RUN + 1 + Math.max(0, o[0] * ux + o[1] * uy), r1 = o === none ? run : RUN + 1 + Math.max(0, -(o[0] * vx + o[1] * vy));
      sc.beginPath();
      sc.moveTo(a[0] + o[0] - r0 * ux, a[1] + o[1] - r0 * uy);
      sc.lineTo(a[0] + o[0], a[1] + o[1]);
      sc.bezierCurveTo(b[0] + o[0], b[1] + o[1], c[0] + o[0], c[1] + o[1], d[0] + o[0], d[1] + o[1]);
      sc.lineTo(d[0] + o[0] + r1 * vx, d[1] + o[1] + r1 * vy);
    };
    // a piece of a ring, run on by `run` at both ends
    const piece = (g, s2, run) => {
      const a = g.pts[s2], d = g.pts[s2 + 1], l = Math.hypot(d[0] - a[0], d[1] - a[1]) || 1, ux = (d[0] - a[0]) / l, uy = (d[1] - a[1]) / l;
      sc.beginPath();
      sc.moveTo(a[0] - run * ux, a[1] - run * uy);
      sc.lineTo(d[0] + run * ux, d[1] + run * uy);
    };
    const loopInk = MM.color('ink-3'), loopPicked = MM.color('ink');
    sc.lineCap = 'butt';
    sc.lineJoin = 'round';
    for (const { r, i } of order) {
      if (r >= 0) {
        const g = rings[r];
        sc.strokeStyle = rim; sc.lineWidth = 4.6; piece(g, i, 0.4); sc.stroke();
        sc.strokeStyle = g.an.chosen ? loopPicked : loopInk; sc.lineWidth = 2; piece(g, i, 1.4); sc.stroke();
        continue;
      }
      const [body, light] = colours(R.cp[i], depth[i] / 2);
      sc.strokeStyle = rim; sc.lineWidth = TUBE + 2 * RIM; edge(i, none, 0.4); sc.stroke();
      sc.strokeStyle = body; sc.lineWidth = TUBE; edge(i, none, RUN); sc.stroke();
      sc.strokeStyle = light; sc.lineWidth = 0.32 * TUBE; edge(i, shift); sc.stroke();
    }
    // each ring's arrow, on the right of the arc, the way it runs; and its name, on the left
    for (const g of rings) {
      const p = g.pts[14], a = g.pts[13], b = g.pts[15], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], sz = 4.5;
      sc.fillStyle = g.an.chosen ? loopPicked : loopInk;
      sc.beginPath();
      sc.moveTo(p[0] + sz * u[0], p[1] + sz * u[1]);
      sc.lineTo(p[0] - sz * u[0] - 0.8 * sz * u[1], p[1] - sz * u[1] + 0.8 * sz * u[0]);
      sc.lineTo(p[0] - sz * u[0] + 0.8 * sz * u[1], p[1] - sz * u[1] - 0.8 * sz * u[0]);
      sc.fill();
      for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) MM.canvasLabel(sc, '$' + g.an.name + '$', g.label[0] + dx, g.label[1] + dy, { size: 12, align: 'center', baseline: 'middle', color: rim });
      MM.canvasLabel(sc, '$' + g.an.name + '$', g.label[0], g.label[1], { size: 12, align: 'center', baseline: 'middle', color: MM.color('ink') });
    }
  }
  // a colour of the theme as three numbers
  function rgb(c) {
    const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    const n = c.match(/[\d.]+/g) || [0, 0, 0];
    return [+n[0], +n[1], +n[2]];
  }
  function resizeSpace() {
    MM.fitCanvas(space);
    drawSpace();
  }
  // it turns on its own, at an even pace, while it can be seen
  let frameId = 0, last = 0;
  const seen = MM.whenVisible([space], () => tick());
  function tick() {
    if (frameId || !state.spin || !seen()) return;
    last = performance.now();
    frameId = requestAnimationFrame(function step(now) {
      frameId = 0;
      if (!state.spin || !seen()) return;
      if (!turning.active) state.angle += 0.3 * Math.min(0.1, (now - last) / 1000);
      last = now;
      drawSpace();
      frameId = requestAnimationFrame(step);
    });
  }
  const turning = MM.turnDrag(space, {
    move: (dx, dy) => {
      state.angle += dx / 110;
      state.tilt = Math.max(0, Math.min(1.45, state.tilt - dy / 130));
      drawSpace();
    },
    // the arrow keys: Left and Right turn it about its axis; Up tips it towards the plane, Down away
    keys: { turn: (a, b) => { state.angle += a; state.tilt = Math.max(0, Math.min(1.45, state.tilt + b)); drawSpace(); } },
  });

  /* ---------- readouts ---------- */

  const expTex = (e) => (Number.isInteger(e) ? String(e) : Math.round(2 * e) + '/2');
  // a Laurent polynomial, from the highest power down (the powers may be halves)
  function polyTex(p, v) {
    v = v || 't';
    if (!p || !p.c.length) return '0';
    let out = '';
    for (let i = p.c.length - 1; i >= 0; i--) {
      const c = p.c[i], e = p.lo + i;
      if (!c) continue;
      const a = Math.abs(c), mon = e === 0 ? '' : e === 1 ? v : v + '^{' + expTex(e) + '}';
      out += (c < 0 ? '-' : out ? '+' : '') + (a === 1 && mon ? '' : a) + mon;
    }
    return out;
  }
  // P(a, z), by the powers of z and then of a, from the highest down
  function homflyTex(Pz) {
    const terms = H2.terms(Pz).sort((x, y) => y[1] - x[1] || y[0] - x[0]);
    if (!terms.length) return '0';
    let out = '';
    for (const [i, j, c] of terms) {
      const mon = (i ? (i === 1 ? 'a' : 'a^{' + i + '}') : '') + (j ? (j === 1 ? 'z' : 'z^{' + j + '}') : '');
      out += (c < 0 ? '-' : out ? '+' : '') + (Math.abs(c) === 1 && mon ? '' : Math.abs(c)) + mon;
    }
    return out;
  }
  // a presentation of a group: generators x, y, z, w (or x₁, x₂, …) and each relation as u = v
  const genNames = (pres) => (pres.gens.length <= 4 ? ['x', 'y', 'z', 'w'] : pres.gens.map((_, i) => 'x_{' + (i + 1) + '}')).slice(0, pres.gens.length);
  // The presentation in HTML: with `loops`, each generator a button that shows the
  // generators as loops on the diagram and in space (state.loop), picking it out
  // (pressed); pressed again, it hides them.
  function groupHTML(pres, loops) {
    if (!loops) return '$' + groupTex(pres) + '$';
    const names = genNames(pres), body = groupTex(pres).replace(/^\\langle [^\\]*?(?=\\mid|\\rangle)/, '');
    const gens = pres.gens.map((g, i) => '<button type="button" class="kn-gen" data-a="' + (g - 1) + '" data-name="' + names[i] + '" aria-pressed="' + String(!!(state.loop && state.loop.a === g - 1)) + '" aria-label="Show the generators as loops, ' + names[i].replace(/[{}_]/g, '') + ' picked out">$' + names[i] + '$</button>');
    return '$\\langle$' + gens.join('$,\\,$') + '$' + (body.startsWith('\\mid') ? '\\;' + body : body) + '$';
  }
  function groupTex(pres) {
    const names = genNames(pres), idx = new Map(pres.gens.map((g, i) => [g, i]));
    const word = (w) => {
      if (!w.length) return '1';
      let out = '';
      for (let i = 0; i < w.length;) {
        let j = i;
        while (j < w.length && w[j] === w[i]) j++;
        const e = (j - i) * Math.sign(w[i]), nm = names[idx.get(Math.abs(w[i]))];
        out += e === 1 ? nm : nm + '^{' + e + '}';
        i = j;
      }
      return out;
    };
    const rel = (r) => {
      // as u = v, with as few inverses as can be: the best rotation and halving
      let best = null;
      const inv = (w) => w.slice().reverse().map((x) => -x);
      for (let rot = 0; rot < r.length; rot++) {
        const s = r.slice(rot).concat(r.slice(0, rot)), h = Math.ceil(s.length / 2), u = s.slice(0, h), v = inv(s.slice(h)), bad = u.concat(v).filter((x) => x < 0).length;
        if (!best || bad < best.bad) best = { u, v, bad };
      }
      return word(best.u) + '=' + word(best.v);
    };
    return '\\langle ' + names.slice(0, pres.gens.length).join(',') + (pres.rels.length ? '\\mid ' + pres.rels.map(rel).join(',\\ ') : '') + '\\rangle';
  }
  function naming(info) {
    if (info.empty) return ['Nothing drawn', 'Draw a component, or choose a knot or a link from the table.'];
    if (!info.ok) return ['A link with many crossings', 'Its diagram has more than ' + MOST + ' crossings, too many to work out its polynomials here.'];
    const id = info.id;
    if (info.C > 1) {
      if (id.unlink) return ['Unlink of ' + info.C + ' components', info.n ? 'Every crossing of the diagram can be undone.' : ''];
      if (id.split) return ['A split link', 'Its diagram can be pulled apart into separate pieces.'];
      if (id.sum) return ['Not in the table', 'Its diagram is visibly a sum, and a part of it is not in the table.'];
      if (!id.entries.length) return ['Not in the table', 'No link of the table, nor any sum of its links and knots with at most nine crossings, has these invariants.'];
      const title = id.entries.map((e) => '$' + nameTex(e.parts) + '$').join(' or ');
      if (id.entries.length > 1) return [title, 'These have the same invariants.'];
      // (a link that has its mirror image's invariants is one entry, with no mirror image)
      const e = id.entries[0];
      let sub = sumWords(e.parts);
      if (e.parts.length === 1) { const q = e.parts[0], t = byName.get(q.name); sub = t.common ? t.common + (q.mirror ? ', mirror image' : '') : q.mirror ? 'The mirror image of $' + tex(t.rolfsen) + '$' : ''; }
      if (!id.sure) return [title, (sub ? sub + '. ' : '') + 'If it is in the table: a link with more crossings may share its invariants.'];
      return [title, sub];
    }
    if (id.unknot) {
      if (info.S.n === 0) return ['Unknot', info.n ? 'Every crossing of the diagram can be undone.' : ''];
      if (id.sure) return ['Unknot', 'Its Jones polynomial is $1$, and no other knot with at most 24 crossings has that.'];
      return ['Jones polynomial $1$', 'The unknot has it, and no other knot is known to.'];
    }
    if (id.sum) return ['Not in the table', 'Its diagram is visibly a sum, and a part of it is not in the table.'];
    if (!id.entries.length) return ['Not in the table', 'No knot with at most nine crossings has these invariants: its crossing number is at least ten.'];
    const title = id.entries.map((e) => '$' + nameTex(e.parts) + '$').join(' or ');
    if (id.entries.length > 1) return [title, 'These have the same Jones polynomial, signature and Alexander polynomial.'];
    const e = id.entries[0];
    let sub = '';
    if (e.parts.length === 1) {
      const q = e.parts[0], common = COMMON[q.name];
      if (common) sub = common[q.mirror && common.length > 1 ? 1 : 0] + (e.same && common.length === 1 ? ', its own mirror image' : common.length === 1 && q.mirror ? ', mirror image of the one in the table' : '');
      else sub = e.same ? 'Its own mirror image' : q.mirror ? 'The mirror image of $' + tex(q.name) + '$' : '';
    } else if (e.parts.every((q) => q.name === '3_1') && e.parts.length === 2) sub = e.parts[0].mirror === e.parts[1].mirror ? 'Granny knot: a sum of two trefoils of the same hand' : 'Square knot: a sum of a trefoil and its mirror image';
    else sub = sumWords(e.parts);
    if (!id.sure) return [title, (sub ? sub + '. ' : '') + 'If it is in the table: a knot with more than nine crossings may share its invariants.'];
    return [title, sub];
  }
  // a sum in words: 'A sum of 3 knots', 'A sum of a knot and a link'
  function sumWords(parts) {
    const k = parts.filter((q) => !byName.get(q.name).link).length, l = parts.length - k, words = (m, w) => (m === 1 ? 'a ' + w : m + ' ' + w + 's');
    return 'A sum of ' + [k ? words(k, 'knot') : '', l ? words(l, 'link') : ''].filter(Boolean).join(' and ');
  }
  function readouts(info) {
    const [title, sub] = naming(info);
    MM.setHTML($('name'), title);
    MM.setHTML($('sub'), sub);
    if (info.empty) { MM.setHTML($('about-diagram'), ''); MM.setHTML($('about-knot'), ''); MM.setHTML($('about-group'), ''); return; }
    const rows = [['Crossings', '$' + info.n + '$'], ['Writhe', '$' + info.writhe + '$']];
    if (info.C > 1) {
      rows.push(['Components', '$' + info.C + '$']);
      const pairs = [];
      for (let i = 0; i < info.C; i++) for (let j = i + 1; j < info.C; j++) pairs.push(info.lk[i][j]);
      rows.push([info.C === 2 ? 'Linking number' : 'Linking numbers', '$' + pairs.join(',\\ ') + '$']);
    }
    MM.kv($('about-diagram'), rows);
    $('knot-h').textContent = info.C > 1 ? 'The link' : 'The knot';
    if (!info.ok) { MM.setHTML($('about-knot'), ''); MM.setHTML($('about-group'), ''); return; }
    const range = (r) => (r[0] === r[1] ? '$' + r[0] + '$' : 'from $' + r[0] + '$ to $' + r[1] + '$');
    const rows2 = [['Crossing number', range(info.cross)]];
    if (info.genus) rows2.push(['Genus', range(info.genus)]);
    if (info.braid) rows2.push(['Braid index', range(info.braid)]);
    rows2.push(['Hyperbolic volume', volumeText(info)], ['Determinant', '$' + info.det + '$'], ['Signature', '$' + info.s + '$']);
    if (info.arf !== undefined) rows2.push(['Arf invariant', '$' + info.arf + '$']);
    MM.kv($('about-knot'), rows2.concat([
      ['Alexander polynomial', info.A ? '$' + polyTex(info.A) + '$' : info.C > 1 ? 'too large to work out here' : 'too large'],
      ['Jones polynomial', '$' + polyTex(info.V) + '$'],
      ['HOMFLYPT polynomial', info.H ? '$' + homflyTex(info.H) + '$<br><a class="kn-how" href="#sec-polynomials">How it’s computed</a>' : 'too many crossings to work out here'],
    ]));
    const g = [];
    if (info.pres) {
      const size = info.pres.rels.reduce((t, r) => t + r.length, 0);
      // (its generators are arcs of the diagram in view when that has no crossing to undo)
      g.push(['Presentation', size <= 48 ? groupHTML(info.pres, info.S === info.D && !state.drawing) : info.pres.gens.length + ' generators, ' + info.pres.rels.length + ' relations']);
      const o = info.onto;
      g.push(['Onto $S_3$, $S_4$, $S_5$', o ? o.map((v) => (v === null ? '?' : '$' + v + '$')).join(', ') : '…']);
    }
    MM.kv($('about-group'), g);
  }
  // a generator clicked: the loop it is, drawn round its arc of the diagram (again: none)
  $('about-group').addEventListener('click', (e) => {
    const b = e.target.closest('.kn-gen');
    if (!b) return;
    const a = +b.dataset.a;
    state.loop = state.loop && state.loop.a === a ? null : { a, key: known.key, name: b.dataset.name };
    draw();
    const again = $('about-group').querySelector('.kn-gen[data-a="' + a + '"]');
    if (again) again.focus();
  });
  // The hyperbolic volume as shown: none for a torus knot or link of the table, a sum
  // or a split link; while it is being worked out, '…'; and if no hyperbolic structure
  // turns up, so.
  const TORUS = new Set(['3_1', '5_1', '7_1', '9_1', '8_19', 'L2a1', 'L4a1', 'L6a3', 'L6n1']);
  function notHyperbolic(info) {
    const id = info.id;
    if (!id || info.S.n === 0) return info.C === 1 ? 'none: the unknot' : 'none: an unlink';
    if (id.unknot && id.sure) return 'none: the unknot';
    if (id.split) return 'none: a split link';
    if (id.sure && id.entries && id.entries.length === 1) {
      const e = id.entries[0];
      if (e.parts.length > 1) return info.C === 1 ? 'none: a sum of knots' : 'none: a sum';
      if (TORUS.has(e.parts[0].name)) return info.C === 1 ? 'none: a torus knot' : 'none: a torus link';
    }
    return null;
  }
  function volumeText(info) {
    const not = notHyperbolic(info);
    if (not) return not;
    if (info.vol === undefined) return '…';
    return info.vol === null ? 'no hyperbolic structure found' : '$' + Math.abs(info.vol).toFixed(5) + '$';
  }
  // The slow invariants, the volume and the maps onto S₃, S₄, S₅, are worked out in
  // a worker (worker.js) for the diagram after tidying, once it has stayed the same
  // for a moment, and shown when they come; a worker still busy with a diagram that
  // has changed since is ended. (Where no worker can be started, the same work is
  // done here, between frames.)
  let worker = null, asked = null, askTimer = 0, sliceTimer = 0;
  function slowLater(info) {
    const vol = info.ok && info.vol === undefined && !notHyperbolic(info) && info.S.n <= 24, onto = info.ok && !info.onto && !!info.pres;
    if (!vol && !onto) return;
    // (the diagram after tidying already being worked on: its answers will do)
    const key = keyOf(info.S);
    if (asked && asked.key === key && asked.left) return;
    clearTimeout(askTimer);
    clearTimeout(sliceTimer);
    askTimer = setTimeout(() => {
      if (known !== info) return;
      if (worker && asked && asked.left) { worker.terminate(); worker = null; }
      if (!worker) {
        try { worker = new Worker('worker.js'); worker.onmessage = answer; } catch (err) { worker = null; }
      }
      asked = { key, id: asked ? asked.id + 1 : 1, left: (vol ? 1 : 0) + (onto ? 1 : 0) };
      if (worker) worker.postMessage({ id: asked.id, D: info.S, onto, volume: vol });
      else here(info, vol, onto);
    }, press ? 400 : 80);
  }
  // an answer: kept with the invariants of that diagram, and shown if it is still the one in view
  function answer(e) {
    const { id, task, value } = e.data, field = task === 'volume' ? 'vol' : 'onto';
    if (!asked || asked.id !== id) return;
    asked.left--;
    const inv = kept.get(asked.key);
    if (inv) inv[field] = value;
    if (known.S && keyOf(known.S) === asked.key) { known[field] = value; readouts(known); }
  }
  function here(info, vol, onto) {
    if (onto) answer({ data: { id: asked.id, task: 'onto', value: [3, 4, 5].map((n) => (info.S.n <= 20 ? K.onto(info.S, n, 60000) : null)) } });
    if (!vol) return;
    const run = window.KnotVolume.search(info.S), id = asked.id;
    const slice = () => {
      if (known !== info) return;
      const until = performance.now() + 20;
      let r;
      do r = run.step(); while (r === undefined && performance.now() < until);
      if (r === undefined) { sliceTimer = setTimeout(slice, press ? 120 : 0); return; }
      answer({ data: { id, task: 'volume', value: r } });
    };
    sliceTimer = setTimeout(slice, 0);
  }
  // the colouring to show: mod the prime the reader chose, or the least that divides the determinant
  function colouring(info) {
    info.colouring = null;
    if (!info.ok || !state.colour || !info.primes.length) return;
    const p = info.primes.includes(state.p) ? state.p : info.primes[0];
    if (!info.col || info.col.p !== p) { const c = K.colourings(info.D, p); info.col = { p, value: c.arcs, arc: c.arc }; }
    if (info.col.value) info.colouring = info.col;
  }
  function hint(info) {
    const arrowsShow = info.C > 1 && !(state.loop && state.loop.key === info.key);
    let text = 'Pull a strand to move it. Click a crossing to change it' + (arrowsShow ? ', an arrow to reverse its component.' : '.');
    if (state.note) text = state.note;
    else if (state.drawing) text = state.drawHint ? 'Choose Reshape to stop drawing.' : 'Draw another component, or choose Reshape to pull strands and change crossings.';
    else if (state.near && !state.fusing) text = 'Let go here to join these two strands.';
    else if (state.caught) text = state.caught.kind === 'clasp' ? 'Caught: these two strands are hooked on each other.' : 'Caught: the strand cannot slide across this crossing.';
    else if (state.colour && info.ok) {
      text = info.colouring ? 'A colouring mod $' + info.colouring.p + '$: at each crossing, twice the number on top is the sum of the two under it.'
        : 'The determinant is $1$: no colouring but the constant ones, for any modulus.';
    }
    MM.setHTML($('hint'), text);
  }

  /* ---------- the table, under the diagram ---------- */

  const minis = new Map();
  // The table in three parts, knots and links of two and of three components, one
  // shown at a time (Family); in each, a group for each number of crossings.
  const familyOf = (t) => t.C;
  let strip = null; // the table (MM.strip)
  function buildStrip() {
    const box = $('strip'), todo = [];
    let group = null, key = '';
    for (const t of TABLE) {
      const c = t.link ? t.c : Math.max(3, t.c), k = familyOf(t) + '|' + c;
      if (k !== key) {
        group = document.createElement('div');
        group.className = 'strip-group';
        group.dataset.family = familyOf(t);
        box.appendChild(group);
        key = k;
      }
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'strip-item kn-mini'; b.dataset.name = t.name;
      b.innerHTML = '<svg viewBox="-1.12 -1.12 2.24 2.24" aria-hidden="true"></svg><span class="strip-name"></span>';
      MM.setHTML(b.lastChild, '$' + tex(t.link ? t.rolfsen : t.name) + '$');
      b.setAttribute('aria-label', t.link ? 'The link ' + t.rolfsen.replace(/\^(\d+)_(\d+)/, ' with $1 components, number $2') + (t.common ? ', the ' + t.common : '') : t.c ? 'The knot ' + t.name.replace('_', ' ') : 'The unknot');
      group.appendChild(b);
      minis.set(t.name, b);
      todo.push(t);
    }
    strip = MM.strip(box, {
      control: $('family'),
      pick(b) {
        finishMorph();
        remember();
        load(b.dataset.name);
        state.drawing = false;
        state.pick = 0;
        draw();
      },
    });
    // the small pictures, a few at a time so that the page is not held up
    (function some() {
      const until = performance.now() + 8;
      while (todo.length && performance.now() < until) {
        const t = todo.shift(), k = tableCurve(t, 0.07), svg = minis.get(t.name).firstChild, Fm = { px: (p) => [p[0], -p[1]] };
        const st = strands(k, K.diagram(k.pts, k.over, k.X, k.cut), null, 0.11);
        const d = (pts, closed) => smoothD(pts.map(Fm.px), closed, 3);
        for (const e of st.edges) el('path', { d: d(e.pts) }, svg);
        for (const q of st.loops) el('path', { d: d(q.pts, true) }, svg);
      }
      if (todo.length) setTimeout(some, 0);
    })();
  }
  function light(info) {
    let name = null;
    if (info.ok) {
      const id = info.id;
      if (id.unknot) name = id.sure || info.S.n === 0 ? '0_1' : null;
      else if (id.entries && id.entries.length === 1) { const e = id.entries[0]; name = e.parts.length === 1 ? e.parts[0].name : null; }
    }
    // (a link that becomes one of another part: that part shown)
    strip.light(name ? minis.get(name) : null);
  }

  /* ---------- the figures in the text ---------- */

  const SIZE = 300; // the small figures are drawn in a box of this many units
  const SF = frame(SIZE, SIZE, 0.95);
  // A small picture of the link in view with each crossing as `modes` says; crossings
  // that can be clicked; colours by component of the link in view, by the loops of a
  // state (opts.loops), or (opts.comps) by component of the diagram the picture
  // shows: each in the colour of the first component of the link in view that it runs
  // along, or where two would take one colour (a component opened in two), the next.
  function smallPicture(svg, info, modes, opts) {
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + SIZE + ' ' + SIZE);
    const st = strands(knot(), info.D, modes, 7 / SF.s);
    let own = null;
    if (opts.comps) {
      const first = new Map(), used = new Set(st.loops.map((q) => q.comp));
      for (const e of st.edges) { const r = st.root(e.k); if (!first.has(r) || e.comp < first.get(r)) first.set(r, e.comp); }
      own = new Map();
      Array.from(first).sort((a, b) => a[1] - b[1]).forEach(([r, c]) => { let k = c; while (used.has(k)) k++; used.add(k); own.set(r, k); });
    }
    const colour = opts.loops ? (e) => 'var(--loop-' + (loopIndex(st, e) % 6) + ')' : own ? (e) => compColour(own.get(st.root(e.k))) : (e) => compColour(e.comp);
    if (opts.under) opts.under(svg, st);
    for (const e of st.edges) el('path', { class: 'kn-strand', d: line(SF, e.pts), style: 'stroke:' + colour(e) }, svg);
    for (const q of st.loops) el('path', { class: 'kn-strand', d: line(SF, q.pts, true), style: 'stroke:' + (opts.loops ? 'var(--loop-' + (st.edges.length % 6) + ')' : compColour(q.comp)) }, svg);
    for (const j of st.joins) el('path', { class: 'kn-strand', d: line(SF, j.pts), style: 'stroke:' + colour({ k: j.ends[0], comp: st.edges[j.ends[0]].comp }) }, svg);
    if (opts.over) opts.over(svg, st);
    if (opts.pick !== undefined) state.X.forEach((x, k) => {
      if (opts.skip && opts.skip.includes(k)) return;
      const q = SF.px([x.x, x.y]), g = el('g', { class: 'kn-x' + (opts.pick === k ? ' is-picked' : ''), 'data-k': k, tabindex: opts.pick === k || (opts.pick < 0 && k === 0) ? 0 : -1, role: 'button', 'aria-label': opts.label(k) }, svg), r = opts.ring || 10;
      el('circle', { class: 'pad', cx: f1(q[0]), cy: f1(q[1]), r: r + 3 }, g);
      el('circle', { class: 'ring', cx: f1(q[0]), cy: f1(q[1]), r }, g);
    });
    return st;
  }
  function loopIndex(st, e) {
    if (!st.names) { st.names = new Map(); for (const x of st.edges) { const r = st.root(x.k); if (!st.names.has(r)) st.names.set(r, st.names.size); } }
    return st.names.get(st.root(e.k));
  }
  // crossings of a small figure: clicked, or chosen from the keyboard (arrows go along)
  function pickable(svg, onPick) {
    svg.addEventListener('click', (e) => { const g = e.target.closest('.kn-x'); if (g) onPick(+g.dataset.k, false); });
    svg.addEventListener('keydown', (e) => {
      const g = e.target.closest('.kn-x'), n = state.X.length, step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!g || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = +g.dataset.k;
      if (step) { onPick((k + step + n) % n, true, step); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { onPick(k, true, 0); e.preventDefault(); }
    });
  }
  const refocus = (svg, k) => { const t = svg.querySelector('[data-k="' + k + '"]'); if (t) t.focus(); };

  // The skein relation, as a working to follow. A step of the working switches or
  // opens one crossing of the diagram in view; the diagram it has reached is the one
  // in view with its steps made (state.path), drawn on the same curve. The figure
  // shows L₊, L₋ and L₀ at a crossing of it: one of them is that diagram, and the
  // other two, whose polynomials it uses, can be worked out in turn, a step further.
  // The steps taken, above the figure, lead back.
  // (the diagrams in a row of their own, which Save image takes, and their names and polynomials
  // in a row under it, each under its diagram)
  const skein = $('skein'), skeinCaps = $('skein-caps'), skeinPath = $('skein-path'), skeinParts = ['L_+', 'L_-', 'L_0'].map((tex, i) => {
    const fig = document.createElement('figure'), svg = el('svg', { role: 'group', 'aria-label': 'The diagram with the crossing chosen made ' + tex.replace(/[_\\]/g, '') }, fig), nm = document.createElement('div'), val = document.createElement('div'), cap = document.createElement('div');
    nm.className = 'kn-pname'; val.className = 'kn-pval'; cap.className = 'kn-pcap';
    // (its diagram, shown as the main picture)
    const up = document.createElement('button');
    up.type = 'button'; up.className = 'btn btn-sm btn-icon kn-show'; up.title = 'Show in the main picture';
    up.setAttribute('aria-label', 'Show ' + tex.replace(/[_\\]/g, '') + ' in the main picture');
    up.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="9.5" cy="6.5" r="4"/><path d="M6.5 9.5l-4 4"/></svg>';
    fig.append(up);
    cap.append(nm, val);
    skein.appendChild(fig);
    skeinCaps.appendChild(cap);
    pickable(svg, (k, kb, step) => { state.wpick = liveFrom(k, step || 1); drawSkein(analyse()); if (kb) refocus(svg, state.wpick); });
    const part = { tex, fig, cap, svg, nm, val, i, up, steps: null };
    up.addEventListener('click', () => { if (part.steps) showAbove(part.steps); });
    return part;
  });
  // the steps of the working followed on each diagram met (Undo after showing one returns to it as it was)
  const paths = new Map();
  // The diagram reached by these steps, drawn: the curve in view with each step made
  // on it (a crossing switched, or opened as the main picture opens one), each
  // crossing found again where it was. Null if one cannot be opened in the room there.
  function drawnAt(steps) {
    let k = { pts: state.pts, cut: state.cut, over: state.over.slice(), X: state.X };
    for (const st of steps) {
      const at = state.X[st.k];
      let j = -1, best = Infinity;
      k.X.forEach((y, i) => { const d = Math.hypot(y.x - at.x, y.y - at.y); if (d < best) { best = d; j = i; } });
      if (j < 0 || best > 0.02) return null;
      if (st.op === 'switch') { k.over = k.over.slice(); k.over[j] ^= 1; continue; }
      const r = K.smoothAt(k, j, true);
      if (!r) return null;
      k = { pts: r.pts, cut: r.cut, over: r.over, X: K.crossings(r.pts, r.cut) };
    }
    return K.respace(K.fair(K.respace(k, H0), 16), H0);
  }
  // a diagram of the working, shown as the main picture (and worked out from there)
  function showAbove(steps) {
    finishMorph();
    const k = drawnAt(steps);
    if (!k) return;
    remember();
    setKnot(k);
    stopDrawing();
    draw();
    $('figure').scrollIntoView({ behavior: MM.reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  // the crossing k, or the next that is still a crossing in the diagram reached (going along `step`)
  let live = [];
  function liveFrom(k, step) {
    if (!live.length) return k;
    for (let s = 0; s < state.X.length; s++) { const j = ((k + step * s) % state.X.length + state.X.length) % state.X.length; if (live.includes(j)) return j; }
    return live[0];
  }
  // The diagram reached by the steps: info.D with each made, which crossing of info.D
  // each of its crossings is, and how each crossing of info.D is drawn (0 as it is,
  // 1 switched, 'A' or 'B' opened, the way that keeps the directions of the strands).
  function reached(info, steps) {
    let E = info.D, label = Array.from({ length: info.n }, (_, i) => i);
    const modes = new Array(info.n).fill(0);
    for (const s of steps) {
      const i = label.indexOf(s.k);
      if (i < 0) break;
      if (s.op === 'switch') { E = K.switched(E, i); modes[s.k] ^= 1; } else {
        modes[s.k] = E.sign[i] > 0 ? 'A' : 'B';
        const F2 = K.smoothed(E, i, true, true);
        label = F2.old.map((o) => label[o]);
        E = F2;
      }
    }
    return { E, label, modes };
  }
  // what is known of a diagram reached: its name and HOMFLYPT polynomial (cached)
  function partInfo(E) {
    const S = K.simplify(E), C = E.cut.length - 1;
    if (S.n > MOST) return null;
    return Object.assign({ C, S }, cachedInvariants(S, C));
  }
  const partName = (part) => (part ? naming(Object.assign({ ok: true, n: part.S.n }, part))[0] : 'too large');
  // (the names are in the captions, under the diagrams)
  skeinCaps.addEventListener('click', (e) => {
    const b = e.target.closest('.kn-into');
    if (!b) return;
    // a step to a diagram already on the way (a crossing switched back): back to it, not round again
    const info = analyse(), next = state.path.concat([{ k: +b.dataset.k, op: b.dataset.op, part: +b.dataset.part }]), key = keyOf(reached(info, next).E);
    let back = -1;
    for (let d = 0; d <= state.path.length && back < 0; d++) if (keyOf(reached(info, state.path.slice(0, d)).E) === key) back = d;
    state.path = back >= 0 ? state.path.slice(0, back) : next;
    state.wpick = null;
    drawSkein(info);
    const first = skeinPath.querySelector('[aria-current]');
    if (first) first.focus();
  });
  skeinPath.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.path = state.path.slice(0, +b.dataset.depth);
    state.wpick = null;
    drawSkein(analyse());
  });
  function drawSkein(info) {
    if (state.pathKey !== info.key) {
      if (state.pathKey !== null) { paths.set(state.pathKey, state.path); if (paths.size > 24) paths.delete(paths.keys().next().value); }
      state.path = paths.get(info.key) || [];
      state.pathKey = info.key;
      state.wpick = null;
    }
    const n = info.n;
    if (!n || !info.ok) {
      skeinParts.forEach((q) => { q.fig.classList.remove('is-current'); q.cap.classList.remove('is-current'); q.svg.textContent = ''; MM.setHTML(q.nm, ''); MM.setHTML(q.val, ''); q.steps = null; q.up.hidden = true; });
      MM.setHTML(skeinPath, '');
      MM.setHTML($('skein-cap'), 'This diagram has no crossings: draw or choose one that has.');
      return;
    }
    const node = reached(info, state.path), E = node.E;
    live = node.label.slice();
    // the steps so far
    const crumbs = ['<button type="button" class="kn-crumb" data-depth="0">This diagram</button>'];
    state.path.forEach((s, d) => {
      const part = partInfo(reached(info, state.path.slice(0, d + 1)).E), text = '$' + ['L_+', 'L_-', 'L_0'][s.part] + '$: ' + partName(part);
      crumbs.push(d + 1 < state.path.length ? '<button type="button" class="kn-crumb" data-depth="' + (d + 1) + '">' + text + '</button>' : '<span class="kn-crumb" aria-current="step" tabindex="-1">' + text + '</span>');
    });
    if (!state.path.length) crumbs[0] = '<span class="kn-crumb" aria-current="step" tabindex="-1">This diagram</span>';
    MM.setHTML(skeinPath, crumbs.join('<span class="kn-sep" aria-hidden="true">›</span>'));
    // The working ends at a diagram whose crossings are all gone, can all be undone
    // (by the first two moves), or are each met first from above on a walk along it
    // (a pile of loops, as the computation aims for): an unknot, or loops apart, whose
    // P is known. The diagram in view too: any step there would only complicate it.
    const sw = E.n ? K.toSwitch(E) : -1, part = E.n ? partInfo(E) : null;
    if (!E.n || sw < 0 || (part && part.S.n === 0)) {
      const c = E.cut.length - 1, P = c === 1 ? '$P=1$' : '$P=\\left(\\frac{a-a^{-1}}{z}\\right)^{' + (c - 1) + '}$';
      skeinParts.forEach((q, j) => {
        q.fig.classList.toggle('is-current', !j);
        q.cap.classList.toggle('is-current', !j);
        q.steps = j ? null : state.path.slice();
        q.up.hidden = !!j;
        q.up.disabled = !state.path.length;
        if (j) { q.svg.textContent = ''; MM.setHTML(q.nm, ''); MM.setHTML(q.val, ''); return; }
        smallPicture(q.svg, info, node.modes, { comps: true });
        MM.setHTML(q.nm, c === 1 ? 'Unknot' : 'Unlink of ' + c + ' components');
        MM.setHTML(q.val, P);
      });
      const why = !E.n ? 'No crossings are left' : part && part.S.n === 0 ? 'Its crossings can all be undone' : 'Walking along it, each crossing is met first from above (or each from below)';
      MM.setHTML($('skein-cap'), why + ': ' + (c === 1 ? 'the unknot, with $P=1$.' : 'an unlink of ' + c + ' components, with ' + P + '.'));
      return;
    }
    // the crossing: the one the reader chose here, or the one the computation switches
    // next (switching it brings the diagram a step nearer to a pile of loops)
    const k = state.wpick !== null && live.includes(state.wpick) ? state.wpick : sw >= 0 ? node.label[sw] : liveFrom(0, 1), i = node.label.indexOf(k), pos = E.sign[i] > 0;
    const flip = (mode) => { const a = node.modes.slice(); a[k] = mode; return a; };
    const parts = [
      { E: pos ? E : K.switched(E, i), modes: pos ? node.modes : flip(node.modes[k] ^ 1), step: pos ? null : 'switch' },
      { E: pos ? K.switched(E, i) : E, modes: pos ? flip(node.modes[k] ^ 1) : node.modes, step: pos ? 'switch' : null },
      { E: K.smoothed(E, i, true), modes: flip(pos ? 'A' : 'B'), step: 'smooth' },
    ];
    skeinParts.forEach((q, j) => {
      const p = parts[j], part = partInfo(p.E), text = partName(part);
      q.fig.classList.toggle('is-current', !p.step);
      q.cap.classList.toggle('is-current', !p.step);
      q.steps = p.step ? state.path.concat([{ k, op: p.step === 'smooth' ? 'smooth' : 'switch', part: j }]) : state.path.slice();
      q.up.hidden = false;
      q.up.disabled = !q.steps.length;
      smallPicture(q.svg, info, p.modes, { comps: true, pick: k, skip: node.modes.map((m, x) => (m === 'A' || m === 'B' ? x : -1)).filter((x) => x >= 0), ring: 17, label: (x) => 'Crossing ' + (x + 1) + (x === k ? ', chosen' : '') + '. Choose it.' });
      // its name in the picture, in a corner (so that an image of the figure says which is which)
      MM.svgLabel(el('text', { class: 'kn-plabel', x: 12, y: 34 }, q.svg), '$' + q.tex + '$');
      // the two that are not the diagram reached: to work out in turn
      MM.setHTML(q.nm, p.step ? '<button type="button" class="kn-into" data-k="' + k + '" data-op="' + p.step + '" data-part="' + j + '" aria-label="Work out ' + q.tex.replace(/[_\\]/g, '') + ', ' + partName(part).replace(/\$/g, '') + '">' + text + '</button>' : text);
      MM.setHTML(q.val, part && part.H ? '$P=' + homflyTex(part.H) + '$' : '');
    });
    MM.setHTML($('skein-cap'), 'At crossing ' + (k + 1) + ' we use ' + (pos ? '$P(L_+)=a^{-2}P(L_-)+a^{-1}z\\,P(L_0)$' : '$P(L_-)=a^{2}P(L_+)-a\\,z\\,P(L_0)$') + '. To work out $' + (pos ? 'L_-' : 'L_+') + '$ or $L_0$ in turn, click its name.');
  }

  // Kauffman's bracket: every crossing opened, A or B; click one to change it.
  const statesSvg = $('states');
  pickable(statesSvg, (k, kb) => { const s = state.smooth; s[k] = s[k] === 'A' ? 'B' : 'A'; drawStates(analyse()); if (kb) refocus(statesSvg, k); });
  $('all-a').addEventListener('click', () => { state.smooth = state.smooth.map(() => 'A'); drawStates(analyse()); });
  $('all-b').addEventListener('click', () => { state.smooth = state.smooth.map(() => 'B'); drawStates(analyse()); });
  function drawStates(info) {
    const n = info.n;
    if (!state.smooth || state.smooth.length !== n) state.smooth = new Array(n).fill('A');
    const st = smallPicture(statesSvg, info, state.smooth, { loops: true, pick: -1, label: (j) => 'Crossing ' + (j + 1) + ' of ' + n + ', opened the ' + state.smooth[j] + ' way. Open it the other way.' });
    // the loops: each edge is on one; a component without crossings is one more
    const roots = new Set(st.edges.map((e) => st.root(e.k))), loops = roots.size + st.loops.length, a = state.smooth.filter((s) => s === 'A').length, b = n - a;
    const term = (a - b ? 'A^{' + (a - b) + '}' : '') + (loops > 1 ? '(-A^2-A^{-2})' + (loops > 2 ? '^{' + (loops - 1) + '}' : '') : '') || '1';
    MM.setHTML($('states-cap'), '$a=' + a + '$, $b=' + b + '$, $\\ell=' + loops + '$: this state adds $' + term + '$ to $\\langle D\\rangle$, the sum of all $' + (n <= 30 ? 2 ** n : '2^{' + n + '}') + '$.');
    $('all-a').disabled = !n; $('all-b').disabled = !n;
  }

  // an arrowhead on a strand of a small figure, at its point i, the way it runs
  function head(svg, pts, i, fill) {
    const a = SF.px(pts[Math.max(0, i - 1)]), b = SF.px(pts[Math.min(pts.length - 1, i + 1)]), m = SF.px(pts[i]), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l, s = 5.5;
    el('path', { class: 'kn-arrow', d: 'M' + f1(m[0] + s * ux) + ' ' + f1(m[1] + s * uy) + 'L' + f1(m[0] - s * ux - 0.8 * s * uy) + ' ' + f1(m[1] - s * uy + 0.8 * s * ux) + 'L' + f1(m[0] - s * ux + 0.8 * s * uy) + ' ' + f1(m[1] - s * uy - 0.8 * s * ux) + 'Z', style: 'fill:' + fill }, svg);
  }
  // The group: the arcs named after their generators, each with an arrowhead the way
  // it runs (which way the strands run fixes the sign of each crossing, and the form
  // of its relation), and the relation at the crossing picked.
  const groupSvg = $('group');
  pickable(groupSvg, (k, kb) => { state.pick = k; drawGroup(analyse()); if (kb) refocus(groupSvg, k); });
  function drawGroup(info) {
    if (info.empty) { groupSvg.textContent = ''; MM.setHTML($('group-cap'), ''); return; }
    const n = info.n, A = K.arcs(info.D), k = Math.min(state.pick, Math.max(0, n - 1)), name = (a) => 'x_{' + (a + 1) + '}';
    smallPicture(groupSvg, info, null, {
      pick: n ? k : undefined, label: (j) => 'Crossing ' + (j + 1) + ' of ' + n + (j === k ? ', chosen' : '') + '. Show its relation.',
      over(svg, st2) {
        // each arc's name by the middle of its longest edge, on the outer side
        const best = new Map();
        for (const e of st2.edges) { const a = A.arc[e.k]; if (!best.has(a) || e.pts.length > best.get(a).pts.length) best.set(a, e); }
        best.forEach((e, a) => {
          const i = Math.floor(e.pts.length / 2), p = SF.px(e.pts[i]), q = SF.px(e.pts[Math.min(e.pts.length - 1, i + 1)]), dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
          const side = (p[0] - SIZE / 2) * -dy + (p[1] - SIZE / 2) * dx >= 0 ? 1 : -1;
          MM.svgLabel(el('text', { x: f1(p[0] + side * -dy / len * 14), y: f1(p[1] + side * dx / len * 14 + 4.5) }, svg), '$' + name(a) + '$');
          head(svg, e.pts, i, compColour(e.comp));
        });
        for (const q2 of st2.loops) { const p = SF.px(q2.pts[0]); MM.svgLabel(el('text', { x: f1(p[0] + 14), y: f1(p[1]) }, svg), '$' + name(A.comp.indexOf(q2.comp)) + '$'); head(svg, q2.pts, Math.floor(q2.pts.length / 4), compColour(q2.comp)); }
      },
    });
    if (!n) { MM.setHTML($('group-cap'), 'No crossings: one generator for each component, and no relations; the group is free.'); return; }
    // (one relation follows from the others in each part of the diagram that has crossings)
    const r = A.at[k], pos = info.D.sign[k] > 0, x = name(r.top), y = name(r.into), y2 = name(r.out), cut = info.D.cut;
    const parts = K.pieces(info.D).filter((g) => g.some((q) => cut[q] < cut[q + 1])).length;
    MM.setHTML($('group-cap'), 'Crossing ' + (k + 1) + ' (' + (pos ? 'positive' : 'negative') + '): $' + y2 + '=' + (pos ? x + y + x + '^{-1}' : x + '^{-1}' + y + x) + '$. ' + A.count + ' generators and ' + n + ' relations, one of which' + (parts > 1 ? ', in each separate part of the diagram,' : '') + ' follows from the others.');
  }

  // The chessboard: the regions of one colour (not the outer one) shaded.
  const chessSvg = $('chess');
  function drawChess(info) {
    const D = info.D, n = info.n;
    if (!n) { smallPicture(chessSvg, info, null, {}); MM.setHTML($('chess-cap'), 'No crossings: signature $0$.'); return; }
    const F2 = K.faces(D), colour = K.chess(D, F2), { tail } = K.slots(D);
    smallPicture(chessSvg, info, null, {
      under(svg, st) {
        // each region as a polygon along its edges, through the crossings at its corners
        const V = st.V, N = state.pts.length, R = K.ring(N, state.cut), area = [], polys = [];
        // the curve from parameter t0 to t1, forwards along its component or backwards
        const walk = (t0, t1, fwd) => {
          const out = [K.pointAt(state.pts, R, t0)], v1 = Math.floor(t1);
          let v = Math.floor(t0);
          if (fwd && (v !== v1 || t1 <= t0)) for (let s = 0; s < N; s++) { v = R.nx[v]; out.push(state.pts[v]); if (v === v1) break; }
          if (!fwd && (v !== v1 || t1 >= t0)) for (let s = 0; s < N; s++) { out.push(state.pts[v]); v = R.pv[v]; if (v === v1) break; }
          out.push(K.pointAt(state.pts, R, t1));
          return out;
        };
        F2.list.forEach((corners) => {
          const P2 = [];
          for (const [c, j] of corners) {
            const e = F2.S[c][j], fwd = tail[e][0] === c && tail[e][1] === j, t0 = V[fwd ? e : st.nxp[e]].t, t1 = V[fwd ? st.nxp[e] : e].t;
            for (const p of walk(t0, t1, fwd)) P2.push(p);
          }
          let a = 0;
          for (let i = 0; i < P2.length; i++) { const p = P2[i], q = P2[(i + 1) % P2.length]; a += p[0] * q[1] - q[0] * p[1]; }
          area.push(a); polys.push(P2);
        });
        // the outer region is the one that runs the other way round; shade the colour it is not
        let outer = 0;
        area.forEach((a, f) => { if (a < area[outer]) outer = f; });
        polys.forEach((P2, f) => { if (colour[f] !== colour[outer] && area[f] > 0) el('path', { class: 'kn-region', d: line(SF, P2, true) }, svg); });
      },
    });
    const g = K.pieces(D).length === 1 && n > 1 ? K.goeritz(D) : null;
    MM.setHTML($('chess-cap'), g ? 'Goeritz’s matrix of these regions is ' + g.matrix.length + ' by ' + g.matrix.length + '; the signature of the link is $' + K.signature(D) + '$.' : 'Signature $' + (info.ok ? info.s : '?') + '$.');
  }

  // the figures in the text are drawn only while they can be seen, and not on every step of a pull
  const textFigs = [{ el: $('skein-fig'), draw: drawSkein }, { el: $('states-fig'), draw: drawStates }, { el: $('group-fig'), draw: drawGroup }, { el: $('chess-fig'), draw: drawChess }];
  const inView = new Set(), watcher = new IntersectionObserver((list) => {
    for (const e of list) {
      const f = textFigs.find((q) => q.el === e.target);
      if (!e.isIntersecting) { inView.delete(f); continue; }
      inView.add(f);
      if (state.w) f.draw(analyse());
    }
  }, { rootMargin: '200px' });
  textFigs.forEach((f) => watcher.observe(f.el));
  let textTimer = 0, textAt = 0;
  function drawText(info) {
    const now = performance.now();
    clearTimeout(textTimer);
    if (press && now - textAt < 150) { textTimer = setTimeout(() => drawText(analyse()), 160); return; }
    textAt = now;
    for (const f of document.documentElement.classList.contains('is-dialog-open') ? textFigs : inView) f.draw(info);
  }
  // Save image may take any of them: as it opens, those out of view are drawn too
  document.addEventListener('mm:dialog', () => { if (state.w && document.documentElement.classList.contains('is-dialog-open')) { const info = analyse(); for (const f of textFigs) if (!inView.has(f)) f.draw(info); } });

  /* ---------- draw: everything from the state ---------- */

  function draw() {
    if (!state.w) return;
    // (while Tidy moves the curve, only the pictures)
    if (morph) { drawStage(null); drawSpace(); return; }
    const info = analyse();
    colouring(info);
    drawStage(info);
    drawSpace();
    readouts(info);
    hint(info);
    light(info);
    slowLater(info);
    drawText(info);
    // the bar
    // (the two modes: a drag reshapes the curve, or draws a new component)
    const mode = state.drawing ? 'draw' : 'reshape';
    if ($('mode').value !== mode) $('mode').value = mode;
    undoButtons.update();
    $('clear').disabled = !state.pts.length;
    $('tidy').disabled = !info.ok || !info.C;
    $('mirror').disabled = !info.n;
    // the hint over the picture, while drawing, until the first component is drawn
    $('draw-hint').hidden = !(state.drawing && state.drawHint) || !!morph;
    const many = state.colour && info.ok && info.primes.length > 1, seg = $('mod'), want = many ? info.primes.join() : '';
    $('mod-control').hidden = !many;
    if (seg.dataset.primes !== want) {
      seg.dataset.primes = want;
      seg.textContent = '';
      if (many) for (const q of info.primes) { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.p = q; b.textContent = q; seg.appendChild(b); }
    }
    if (many && info.colouring) seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.p === info.colouring.p)));
    if (example) example.changed();
  }

  /* ---------- the pointer on the diagram ---------- */

  const pointOf = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const inside = (p) => [Math.max(-SPAN + 0.04, Math.min(SPAN - 0.04, p[0])), Math.max(-SPAN + 0.04, Math.min(SPAN - 0.04, p[1]))];
  function nearest(p) {
    let best = 0, bd = Infinity;
    state.pts.forEach((q, i) => { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  let caughtTimer = 0;
  function catchAt(c) {
    state.caught = c;
    clearTimeout(caughtTimer);
    if (c) caughtTimer = setTimeout(() => { state.caught = null; draw(); }, 900);
  }
  // Two strands that a pull has brought together: of the vertices near the one held
  // (vertex `held`, pulled along `way`), the one nearest a vertex of another strand
  // (not one close by along the same component), if they are within FUSE pixels,
  // the pull went towards it, and no crossing is close. Returns { i, j, m }, m the
  // point between them, or null.
  const FUSE = 11;
  function contactAt(held, way) {
    const pts = state.pts, N = pts.length, R = K.ring(N, state.cut), lim = FUSE / F().s, wl = Math.hypot(way[0], way[1]);
    if (!N || wl < 1e-9) return null;
    let best = null;
    for (let d = -8; d <= 8; d++) {
      const i = K.along(R, held, d), p = pts[i];
      for (let j = 0; j < N; j++) {
        if (R.cp[j] === R.cp[i]) { const L = state.cut[R.cp[i] + 1] - state.cut[R.cp[i]], dd = Math.abs(j - i); if (Math.min(dd, L - dd) * H0 < 0.6) continue; }
        const q = pts[j], dist = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (dist < lim && (!best || dist < best.dist)) best = { i, j, dist };
      }
    }
    if (!best) return null;
    const p = pts[best.i], q = pts[best.j], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if ((q[0] - p[0]) * way[0] + (q[1] - p[1]) * way[1] < 0.2 * best.dist * wl) return null;
    if (state.X.some((x) => Math.hypot(x.x - m[0], x.y - m[1]) < 2.5 * lim)) return null;
    return { i: best.i, j: best.j, m };
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.button || press) return;
    finishMorph();
    const q = pointOf(e), p = F().back(q);
    if (state.drawing) { press = { kind: 'draw', id: e.pointerId }; state.stroke = [inside(p)]; }
    else {
      const x = e.target.closest('.kn-x'), dir = !x && e.target.closest('.kn-dir'), hit = x || dir || e.target.closest('.kn-hit');
      if (!hit) return;
      press = { kind: x ? 'cross' : dir ? 'dir' : 'pull', id: e.pointerId, k: x ? +x.dataset.k : -1, c: dir ? +dir.dataset.c : -1, q0: q, p0: p, moved: false };
      if (!x) press.i = nearest(p);
    }
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const q = pointOf(e), p = inside(F().back(q));
    if (press.kind === 'draw') {
      const lastP = state.stroke[state.stroke.length - 1];
      if (Math.hypot(p[0] - lastP[0], p[1] - lastP[1]) * F().s < 2.5) return;
      state.stroke.push(p);
      draw();
      return;
    }
    if (!press.moved) {
      if (Math.hypot(q[0] - press.q0[0], q[1] - press.q0[1]) < 5) return;
      // a crossing that is dragged: the strand on top there is pulled (an arrow: its strand)
      if (press.kind === 'cross') { const c = state.X[press.k]; press.i = Math.floor(state.over[press.k] ? c.b : c.a); }
      press.kind = 'pull';
      press.moved = true;
      // the strand is held where it was taken: the point pulled keeps its offset from the pointer
      // (from here on p0 is that point, where the pull started), so that it does not jump to it
      const g0 = state.pts[press.i];
      press.off = [press.p0[0] - g0[0], press.p0[1] - g0[1]];
      press.p0 = g0.slice();
      closeMenu(false);
      remember('pull');
      state.name = null;
    }
    const b = F().back(q), t = inside([b[0] - press.off[0], b[1] - press.off[1]]);
    const R = K.ring(state.pts.length, state.cut), c = R.cp[press.i], M = state.cut[c + 1] - state.cut[c], g = state.pts[press.i], far = Math.hypot(t[0] - press.p0[0], t[1] - press.p0[1]);
    const reach = Math.max(5, Math.min(Math.floor(M / 3), Math.round((0.25 + 0.7 * far) / H0)));
    let r = K.pull(knot(), press.i, t[0] - g[0], t[1] - g[1], reach);
    const big = tooBig(r, false);
    if (big) { say(big); draw(); return; }
    // stretched too far: the vertices are spaced evenly again, and the pull goes on from the nearest
    let longest = 0;
    const R2 = K.ring(r.pts.length, r.cut);
    for (let i = 0; i < r.pts.length; i++) { const a = r.pts[i], b = r.pts[R2.nx[i]]; longest = Math.max(longest, Math.hypot(b[0] - a[0], b[1] - a[1])); }
    if (longest > 2.2 * H0) { const held = r.pts[press.i], cc = r.caught; r = K.respace(r, H0); r.caught = cc; state.pts = r.pts; press.i = nearest(held); }
    state.pts = r.pts; state.cut = r.cut; state.over = r.over; state.X = r.X || K.crossings(r.pts, r.cut);
    catchAt(r.caught);
    state.near = contactAt(press.i, [t[0] - press.p0[0], t[1] - press.p0[1]]);
    draw();
  });
  function release(e, cancelled) {
    if (!press || e.pointerId !== press.id) return;
    const pr = press;
    press = null;
    if (pr.kind === 'draw') {
      const stroke = state.stroke;
      state.stroke = null;
      // the line drawn, closed up, is one more component
      if (!cancelled && stroke.length > 8) {
        const k = K.withStroke(knot(), stroke, H0);
        // (anything but a scribble: a ring about an eighth of the frame across will do)
        if (k && K.length(k.pts.slice(k.cut[k.cut.length - 2])) > 0.35) {
          const big = tooBig(k, true);
          if (big) say(big); else { remember(); setKnot(k); state.drawing = true; state.drawHint = false; }
        }
      }
    } else if (pr.kind === 'cross' && !cancelled) {
      if (state.menu === pr.k) { closeMenu(false); draw(); return; }
      openMenu(pr.k, false);
      return;
    } else if (pr.kind === 'dir' && !cancelled) {
      turnRound(pr.c);
      return;
    } else if (pr.kind === 'pull' && !pr.moved && !cancelled) {
      // a click: the strand's component picked out, to remove
      const R = K.ring(state.pts.length, state.cut);
      openPicked(R.cp[pr.i], pr.p0);
      return;
    } else if (pr.kind === 'pull' && pr.moved) {
      const held = state.pts[pr.i], way = [held[0] - pr.p0[0], held[1] - pr.p0[1]], r = K.respace(K.fair(knot(), 12), H0);
      state.pts = r.pts; state.cut = r.cut; state.over = r.over; state.X = r.X || K.crossings(r.pts, r.cut);
      // let go against another strand: the ways to join the two
      const f = !cancelled && state.near && contactAt(nearest(held), way);
      state.near = null;
      if (f) { openFuse(f); return; }
    }
    state.near = null;
    draw();
  }
  stage.addEventListener('pointerup', (e) => release(e, false));
  stage.addEventListener('pointercancel', (e) => release(e, true));
  // the keyboard: the crossings are one stop for Tab; the arrow keys go from one to
  // the next along the curve, and Enter or the space bar opens its four choices; on
  // an arrow, Enter or the space bar turns its component round
  stage.addEventListener('keydown', (e) => {
    const dir = e.target.closest('.kn-dir');
    if (dir && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); turnRound(+dir.dataset.c); return; }
    if (dir && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeComponent(+dir.dataset.c); return; }
    const x = e.target.closest('.kn-x');
    if (!x || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = +x.dataset.k, n = state.X.length, step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step || e.key === 'Home' || e.key === 'End') {
      state.at = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (k + step + n) % n;
      closeMenu(false);
      e.preventDefault();
      draw();
      const to = stage.querySelector('[data-key="x' + state.at + '"]');
      if (to) to.focus();
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    state.at = k;
    e.preventDefault();
    openMenu(k, true);
  });

  /* ---------- the bar ---------- */

  function stopDrawing() { state.drawing = false; state.stroke = null; press = null; }
  // Reshape or Draw: what a drag on the frame does. Drawing, each line drawn adds
  // a component to the link as it is.
  $('mode').addEventListener('change', (e) => {
    finishMorph();
    if (e.detail.value === 'draw') { state.drawing = true; state.drawHint = true; state.stroke = null; } else stopDrawing();
    closeMenu(false);
    catchAt(null);
    draw();
  });
  // Clear: nothing left, and ready to draw
  $('clear').addEventListener('click', () => {
    finishMorph();
    if (!state.pts.length) return;
    remember();
    setKnot({ pts: [], cut: [0], over: [], X: [] });
    state.drawing = true;
    state.drawHint = true;
    state.stroke = null;
    draw();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.drawing) { stopDrawing(); draw(); return; }
    if (state.sel >= 0 && !e.target.closest('input, textarea, [contenteditable]')) {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const c = state.sel; closeMenu(false); removeComponent(c); return; }
      if (e.key === 'Escape') { closeMenu(false); draw(); return; }
    }
  });
  $('mirror').addEventListener('click', () => { finishMorph(); remember(); state.over = state.over.map((b) => 1 - b); state.name = null; draw(); });
  // Undo and Redo, from the buttons and the keyboard: what moves or is drawn is finished first
  const undoButtons = MM.undoRedo({
    undo() { finishMorph(); if (press && press.kind === 'draw') stopDrawing(); undo(); draw(); },
    redo() { finishMorph(); if (press && press.kind === 'draw') stopDrawing(); redo(); draw(); },
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,
  });
  // Tidy: the diagram with the crossings that moves can undo removed, drawn afresh; an
  // entry of the table as the table draws it
  // The table's drawing of a link, as this link: its mirror image or not, each component
  // run one way or the other, whichever has the same HOMFLYPT polynomial and linking
  // numbers (the name does not say which). Null if none has.
  // (of those, the one nearest to the drawing in view, so that Tidy moves it least)
  function asThis(t, info) {
    const base = tableCurve(t, H0), lk = (D) => K.linking(D).flat().join(), want = info.H && H2.key(info.H), wantLk = lk(info.D);
    let best = null;
    for (const mir of [false, true]) for (let bits = 0; bits < 1 << t.C; bits++) {
      const comps = [];
      for (let q = 0; q < t.C; q++) if (bits >> q & 1) comps.push(q);
      const D = K.reverse(mir ? K.mirror(t.D) : t.D, comps), pts = [];
      for (let q = 0; q < t.C; q++) { const part = base.pts.slice(base.cut[q], base.cut[q + 1]); for (const p of comps.includes(q) ? part.reverse() : part) pts.push(p); }
      const X = K.crossings(pts, base.cut), over = K.matchBits(pts, base.cut, D, X);
      if (!over || lk(D) !== wantLk || (want && H2.key(K.homfly(D)) !== want)) continue;
      const k = { pts, cut: base.cut, over, X, same: !mir && !comps.length }, d = state.cut.length === base.cut.length ? distance(k) : 0;
      if (!best || d < best.d - 1e-9) best = { k, d };
    }
    return best && best.k;
  }
  $('tidy').addEventListener('click', () => {
    finishMorph();
    // (the drawing Tidy made last, unchanged since, its crossings too: Tidy leaves it, and adds nothing to
    // undo. Drawn afresh, a link with symmetries could come out another way each
    // time: the packings Tidy starts from are tried in an order that depends on how
    // the diagram happens to be numbered, and each drawing numbers it anew.)
    if (state.tidied && state.tidied.pts === state.pts && state.tidied.bits === state.over.join('')) return;
    const info = analyse(), id = info.id;
    let k = null, name = null;
    try {
      if (info.S.n === 0 && info.C === 1) { k = tableCurve(byName.get('0_1'), H0); name = '0_1'; }
      else if (id.sure && id.entries && id.entries.length === 1 && id.entries[0].parts.length === 1) {
        const q = id.entries[0].parts[0], t = byName.get(q.name);
        if (t.link) { k = asThis(t, info); if (k && k.same) name = t.name; }
        else { k = tableCurve(t, H0); if (q.mirror) k.over = k.over.map((b) => 1 - b); else name = t.name; }
      }
      if (!k) {
        // components that lie wholly above or below the others where they cross are
        // lifted clear and drawn apart (order: from the drawing's components to the link's)
        const groups = K.layers(info.S), flat = groups.flat();
        k = L.curve(groups.length > 1 ? K.apart(info.S, groups) : info.S, { density: 1 / H0, steps: 1000, quick: true });
        if (groups.length > 1) k.order = k.order.map((j) => flat[j]);
        // (a loop drawn without crossings runs the way its component ran, so that the slide does not turn it inside out)
        const area = (P) => P.reduce((t, p, i) => { const q = P[(i + 1) % P.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0), V = K.visits(k.X), crossed = new Set(V.map((v) => K.ring(k.pts.length, k.cut).cp[Math.floor(v.t)]));
        for (let c = 0; c + 1 < k.cut.length; c++) {
          const o = k.order ? k.order[c] : c, mine = k.pts.slice(k.cut[c], k.cut[c + 1]), was = state.pts.slice(state.cut[o], state.cut[o + 1]);
          if (!crossed.has(c) && mine.length && was.length && area(mine) * area(was) < 0) mine.reverse().forEach((p, i) => { k.pts[k.cut[c] + i] = p; });
        }
      }
    } catch (err) { k = null; }
    if (!k || !k.pts.length) return;
    k = nearestPose(k);
    // (already as Tidy would draw it: nothing to do, and nothing to undo)
    if (k.cut.length === state.cut.length && k.X.length === state.X.length && distance(k, k.order) < 1e-4) { state.tidied = { pts: state.pts, bits: state.over.join('') }; return; }
    closeMenu(false);
    moveTo(k, name, k.order);
  });
  // The drawing k as it is, turned half round, or mirrored left to right or top to
  // bottom with every crossing switched (the same link, turned over), and turned a
  // quarter round too where the drawing looks the same so: of these, the one nearest
  // to the drawing in view. A drawing with symmetries comes out of Tidy in any of
  // them, with its components in different places (which depends on how the diagram
  // happens to be numbered); taking the nearest, Tidy moves it least, and leaves a
  // drawing it has made as it is.
  function nearestPose(k) {
    if (state.cut.length !== k.cut.length || !state.pts.length) return k;
    const moves = [[1, 0, 0, 1, false], [-1, 0, 0, -1, false], [-1, 0, 0, 1, true], [1, 0, 0, -1, true]];
    if (looksSameTurned(k.pts)) moves.push([0, -1, 1, 0, false], [0, 1, -1, 0, false], [0, 1, 1, 0, true], [0, -1, -1, 0, true]);
    let best = null;
    for (const [a, b, c, d, flip] of moves) {
      const pts = k.pts.map((p) => [a * p[0] + b * p[1], c * p[0] + d * p[1]]);
      const pose = Object.assign({}, k, { pts, X: K.crossings(pts, k.cut), over: flip ? k.over.map((x) => 1 - x) : k.over.slice() });
      const far = distance(pose, k.order);
      if (!best || far < best.far - 1e-9) best = { pose, far };
    }
    return best.pose;
  }
  // whether points look the same turned a quarter round about the middle (each turned
  // point near one of them, on the mean)
  function looksSameTurned(pts) {
    const step = Math.max(1, Math.floor(pts.length / 160));
    let total = 0, count = 0;
    for (let i = 0; i < pts.length; i += step) {
      const x = -pts[i][1], y = pts[i][0];
      let near = Infinity;
      for (const q of pts) near = Math.min(near, (q[0] - x) ** 2 + (q[1] - y) ** 2);
      total += Math.sqrt(near); count++;
    }
    return total / count < 0.02;
  }

  /* ---------- Tidy, moving ---------- */

  // Tidy moves the curve to its new place in a moment (and Undo and Redo move it back
  // and forth after Tidy, or after a pull, the same way). Each component's points slide
  // to the new drawing's, matched by their place along it (turned round to where they
  // are nearest), each with a height that goes from what it had on the old curve to
  // what it has on the new (+1 where it passes over, −1 under, between in steps);
  // wherever strands cross on the way, the higher is drawn on top. At once where
  // motion is to be reduced. order[i] is the component of the old curve that the
  // new curve's component i comes from.
  const MORPH = 700;
  // How far the points of one closed polygon must move to land on another's, matched
  // by their place along them (turned round to where they are nearest): the mean
  // squared distance, and the turn, for m points on each.
  function evenly(P, m) {
    const s = [0];
    for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; s.push(s[i] + Math.hypot(q[0] - P[i][0], q[1] - P[i][1])); }
    const out = [];
    for (let j = 0, i = 0; j < m; j++) {
      const x = s[P.length] * j / m;
      while (i + 1 < P.length && s[i + 1] <= x) i++;
      const f = (x - s[i]) / ((s[i + 1] - s[i]) || 1), q = P[(i + 1) % P.length];
      out.push([P[i][0] + f * (q[0] - P[i][0]), P[i][1] + f * (q[1] - P[i][1]), f, i]);
    }
    return out;
  }
  function apart(A, B) {
    const m = A.length;
    let best = 0, low = Infinity;
    for (let s = 0; s < m; s++) {
      let t = 0;
      for (let i = 0; i < m && t < low; i++) { const a = A[i], b = B[(i + s) % m]; t += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; }
      if (t < low) { low = t; best = s; }
    }
    return { cost: low / m, shift: best };
  }
  // how far the drawing k is from the one in view, component by component (k's
  // component i against the view's order[i])
  function distance(k, order) {
    let t = 0;
    for (let c = 0; c + 1 < k.cut.length; c++) {
      const o = order ? order[c] : c;
      t += apart(evenly(state.pts.slice(state.cut[o], state.cut[o + 1]), 48), evenly(k.pts.slice(k.cut[c], k.cut[c + 1]), 48)).cost;
    }
    return t;
  }
  // A knot drawn turned round, if that is nearer to the one in view: the same knot
  // (its invariants do not see the direction), and Tidy then moves it less instead
  // of turning it inside out.
  function nearerWay(k) {
    if (k.cut.length !== 2 || state.cut.length !== 2 || !state.pts.length) return { k, turned: false };
    const back = { pts: k.pts.slice().reverse(), cut: k.cut };
    if (distance(back) >= distance(k)) return { k, turned: false };
    const X = K.crossings(back.pts, back.cut), D = K.diagram(k.pts, k.over, k.X || K.crossings(k.pts, k.cut), k.cut), over = X.length ? K.matchBits(back.pts, back.cut, K.reverse(D, [0]), X) : [];
    return over ? { k: { pts: back.pts, cut: back.cut, over, X }, turned: true } : { k, turned: false };
  }
  function moveTo(k, name, order) {
    k = { pts: k.pts, cut: k.cut, over: k.over, X: k.X || K.crossings(k.pts, k.cut) };
    const way = nearerWay(k);
    if (way.turned) { k = way.k; name = null; }
    remember('tidy', order);
    state.tidied = { pts: k.pts, bits: k.over.join('') };
    slideTo(k, name, order);
  }
  // the slide itself, to the curve k exactly (for Tidy, and for Undo and Redo of a
  // move; `quick` for a pull, played back faster)
  function slideTo(k, name, order, quick) {
    const old = { pts: state.pts, cut: state.cut, over: state.over, X: state.X }, C = old.cut.length - 1;
    k = { pts: k.pts, cut: k.cut, over: k.over, X: k.X || K.crossings(k.pts, k.cut) };
    if (MM.reduceMotion() || !old.pts.length || C !== k.cut.length - 1 || !state.w) { setKnot(k, name); state.pick = 0; draw(); return; }
    const za = K.heights(old.pts, old.X, old.over, old.cut), zb = K.heights(k.pts, k.X, k.over, k.cut), pairs = [];
    // each polygon as m points evenly spaced along it, with their heights
    const even = (P, Z, m) => evenly(P, m).map(([x, y, f, i]) => [x, y, Z[i] + f * (Z[(i + 1) % P.length] - Z[i])]);
    for (let c = 0; c < C; c++) {
      const o = order ? order[c] : c, P0 = old.pts.slice(old.cut[o], old.cut[o + 1]), P1 = k.pts.slice(k.cut[c], k.cut[c + 1]);
      const m = Math.max(16, Math.round(Math.max(K.length(P0), K.length(P1)) / H0)), A = even(P0, za.slice(old.cut[o], old.cut[o + 1]), m), B = even(P1, zb.slice(k.cut[c], k.cut[c + 1]), m), { shift } = apart(A, B);
      pairs.push({ A, B: B.slice(shift).concat(B.slice(0, shift)) });
    }
    // (how long: by how far the farthest point goes, in units of the frame, from a
    // fifth of a second for a small move to MORPH for a long one; a pull played back
    // from 0.15 s to 0.4 s)
    let far = 0;
    for (const { A, B } of pairs) for (let i = 0; i < A.length; i++) far = Math.max(far, Math.hypot(B[i][0] - A[i][0], B[i][1] - A[i][1]));
    const dur = quick ? Math.min(400, 150 + 300 * far) : Math.min(MORPH, 200 + 600 * far);
    morph = { k, name, pairs, t0: performance.now(), now: null, dur };
    morph.now = frameAt(0);
    requestAnimationFrame(morphStep);
  }
  // the curve part of the way there (e from 0 to 1)
  function frameAt(e) {
    const pts = [], z = [], cut = [0];
    for (const { A, B } of morph.pairs) {
      for (let i = 0; i < A.length; i++) { const a = A[i], b = B[i]; pts.push([a[0] + e * (b[0] - a[0]), a[1] + e * (b[1] - a[1])]); z.push(a[2] + e * (b[2] - a[2])); }
      cut.push(pts.length);
    }
    const X = K.crossings(pts, cut), R = K.ring(pts.length, cut), at = (t) => { const i = Math.floor(t), f = t - i; return z[i] * (1 - f) + z[R.nx[i]] * f; };
    return { pts, cut, X, over: X.map((x) => (at(x.a) >= at(x.b) ? 0 : 1)), z };
  }
  function morphStep(now) {
    if (!morph) return;
    const t = Math.min(1, (now - morph.t0) / morph.dur);
    if (t >= 1) { finishMorph(); return; }
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
    morph.now = frameAt(e);
    drawStage(null);
    drawSpace();
    requestAnimationFrame(morphStep);
  }
  // the move to the new drawing, done at once
  function finishMorph() {
    if (!morph) return;
    const m = morph;
    morph = null;
    setKnot(m.k, m.name);
    state.pick = 0;
    draw();
  }
  $('colour').addEventListener('change', (e) => { state.colour = e.detail.pressed; draw(); });
  $('mod').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.p = +b.dataset.p; draw(); } });
  $('spin').addEventListener('change', (e) => { state.spin = e.detail.pressed; tick(); });

  /* ---------- sizes ---------- */

  new ResizeObserver(() => {
    const r = stage.getBoundingClientRect();
    if (!r.width || (r.width === state.w && r.height === state.h)) return;
    const first = !state.w;
    state.w = r.width;
    state.h = r.height;
    if (first) start(); else { closeMenu(false); draw(); }
  }).observe(stage);
  new ResizeObserver(resizeSpace).observe(space);
  MM.onFonts(draw);

  /* ---------- links, reset and Save image ---------- */

  // A hand-made link in a link: for each component, points along it, each coordinate
  // as two digits in base 36 (0 … 1295 across the frame), the components apart by
  // underscores; then a full stop and, for each crossing in the order the curve first
  // meets them, 0 if the first passage is the upper one and 1 if the second. As few
  // points as draw the same diagram.
  const UNIT = 1295 / (2 * SPAN);
  const curveCodec = {
    write(k) {
      if (!k) return '';
      const D = K.diagram(k.pts, k.over, k.X, k.cut), want = P.key(K.bracket(D)) + '|' + K.writhe(D) + '|' + D.cut.length;
      const enc = (v) => Math.max(0, Math.min(1295, Math.round((v + SPAN) * UNIT)));
      for (let f = 0.09; ; f *= 0.75) {
        const parts = [], back = [], cut = [0];
        let all = true;
        for (let c = 0; c + 1 < k.cut.length; c++) {
          const comp = k.pts.slice(k.cut[c], k.cut[c + 1]), M = Math.max(8, Math.round(K.length(comp) / f)), use = M >= comp.length ? comp : K.resample(comp, M);
          if (M < comp.length) all = false;
          const q = use.map((p) => p.map(enc));
          parts.push(q.map((p) => p.map((v) => v.toString(36).padStart(2, '0')).join('')).join(''));
          for (const p of q) back.push(p.map((v) => v / UNIT - SPAN));
          cut.push(back.length);
        }
        const X = K.crossings(back, cut);
        let over = X.length === k.over.length ? K.matchBits(back, cut, D, X) : null;
        if (over) { const E = K.diagram(back, over, X, cut); if (P.key(K.bracket(E)) + '|' + K.writhe(E) + '|' + E.cut.length !== want) over = null; }
        if (over || all || f < 0.002) return parts.join('_') + '.' + (over || k.over).join('');
      }
    },
    read(text) {
      if (text === '') return null;
      const m = /^((?:[0-9a-z]{4}){3,}(?:_(?:[0-9a-z]{4}){3,})*)\.([01]*)$/.exec(text);
      if (!m) throw new Error('not a curve: ' + text);
      const pts = [], cut = [0];
      for (const part of m[1].split('_')) { for (let i = 0; i < part.length; i += 4) pts.push([parseInt(part.slice(i, i + 2), 36) / UNIT - SPAN, parseInt(part.slice(i + 2, i + 4), 36) / UNIT - SPAN]); cut.push(pts.length); }
      const X = K.crossings(pts, cut);
      if (X.length !== m[2].length) throw new Error('not a curve with these crossings');
      return { pts, cut, over: m[2].split('').map(Number), X };
    },
  };
  // the curve of a link, with its vertices as close as the page keeps them, its corners rounded
  function refine(k) {
    let r = K.respace(k, H0);
    for (let t = 0; t < 3; t++) {
      const Rg = K.ring(r.pts.length, r.cut), to = r.pts.map((p, i) => { const a = r.pts[Rg.pv[i]], b = r.pts[Rg.nx[i]]; return [p[0] + 0.5 * ((a[0] + b[0]) / 2 - p[0]), p[1] + 0.5 * ((a[1] + b[1]) / 2 - p[1])]; });
      const next = K.advance(r, to);
      if (next.blocked) break;
      r = next;
    }
    return K.respace(r, H0);
  }

  function start() {
    load(START);
    buildStrip();
    example = MM.example({
      fields: { k: 'text', d: curveCodec, c: 'flag', p: 'int' },
      get: () => ({ k: state.name || START, d: state.name ? null : knot(), c: state.colour, p: state.p }),
      set(x) {
        if (x.d ? x.d.pts.length < 4 : !byName.has(x.k)) return false;
        const k = x.d ? refine(x.d) : null;
        if (k && ((k.cut || [0]).length - 1 > MAXC || (k.X || K.crossings(k.pts, k.cut)).length > MAXX)) return false;
        if (state.pts.length) remember();
        if (k) setKnot(k); else load(x.k);
        state.colour = x.c;
        state.p = x.p;
        stopDrawing();
        $('colour').pressed = x.c;
        draw();
      },
      pictures: () => [
        { label: 'Diagram', element: stage },
        { label: 'In space', element: space, selected: false },
        { label: 'Skein relation', element: skein, selected: false },
        { label: 'Bracket state', element: statesSvg, selected: false },
        { label: 'Group', element: groupSvg, selected: false },
        { label: 'Chessboard', element: chessSvg, selected: false },
      ],
      // for Save image: the curve exactly (a link rounds a drawn one), the loops shown, the
      // picked component and crossings, and how the link in space is seen
      scene: {
        get: () => Object.fromEntries(SCENE.map((k) => [k, state[k]])),
        set(s) { Object.assign(state, s); draw(); },
      },
      redraw: resizeSpace,
    });
    history.length = 0; // (a link's example is where Undo starts)
    future.length = 0;
    $('spin').pressed = state.spin; // (off where motion is to be reduced)
    draw();
    tick();
  }
})();
