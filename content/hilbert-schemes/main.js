// Hilbert schemes of points: the figure, its readouts and the figures in the text.
// The mathematics is in hilbert.js, the drawing of curves in curves.js.
//
// The configuration is a list of clusters: each a place (integers, in hundredths), a local
// structure (its dual, see hilbert.js), a recipe that builds it (a base, then the directions
// in which points joined it; links store recipes), and what it was before each point joined
// it, so that a drag pulls the last point out again. Its ideal, for the weight w on the dial
// beside the staircase, is worked out exactly on every change. The plane shows the points and
// the zero sets of the generators; beside it are the ideal, its staircase and the dial; under
// it the monomial ideals. A click on a multiple point opens its menu, an editor of its local
// structure. Each section of text after the figure has a figure of the ideal in view: the
// monomials in order and multiplication on the staircase, the triple points at one place, the
// flow to the origin under the torus, and the tangent space at the monomial ideal it flows to
// (or at another, chosen there).
(function () {
  'use strict';
  const HS = window.Hilbert, Q = HS.Q, CV = window.Curves;
  const $ = (id) => document.getElementById(id);
  const TAU = 2 * Math.PI, DEG = Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const el = MM.svg;

  /* ---------- constants ---------- */

  const SPAN = 300;       // points stay within [−3, 3]², in hundredths
  const VIEW = 3.45;      // the plane shows [−VIEW, VIEW]²
  const SNAP = 15;        // px: a point let go this close to another collides with it
  const ALIGN = 5;        // px: a point dragged this close to the x or the y of another takes it
  const R = 6, RF = 8.5;  // the radii of a point and of a collision
  const GERM = 26;        // px: how far the curve of a collision reaches each way
  const AXIS_SNAP = 6 * DEG, DIR_SNAP = 12 * DEG, KNOB_SNAP = 4 * DEG, WALL_SNAP = 2.5 * DEG;
  const HOLD_PT = 8, HOLD_LINE = 3, HOLD_TURN = 6; // px: how near a special point, line or angle holds a handle in a disc
  const PHI0 = 84;        // the weight's angle at first, in degrees: y much heavier than x
  const COUNT = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
  const START = {
    1: [[100, 60]],
    2: [[-120, -60], [100, 90]],
    3: [[-160, -40], [30, 130], [170, -90]],
    4: [[-200, 60], [-60, -120], [80, 140], [210, -30]],
    5: [[-220, -80], [-110, 130], [20, -150], [120, 90], [230, -10]],
    6: [[-230, 40], [-140, -140], [-40, 150], [60, -60], [150, 120], [240, -110]],
  };

  /* ---------- clusters ---------- */

  // A recipe: { base, merges } with base 'p' (a point), { mono: λ } (the monomial ideal of the
  // partition λ), { germ: [k, angle, g] } (the curvilinear germ of length k along the curve
  // t = Σ g_m s^m in the frame of the tangent at that angle) or { edit: state } (a point of
  // multiplicity 3 + state.s.length from the menu's editor: HS.editDual), then the directions
  // [w1, w2] in which points joined it, in turn.
  let nextId = 1;
  // the base and what it is built from, from length 1 up: their duals and bases
  function baseChain(base) {
    if (base === 'p') return [{ dual: HS.pointDual(), base: 'p' }];
    if (base.edit) {
      // its triple point, then each further point in turn
      const st = base.edit, dual = HS.editDual(3 + st.s.length, st).dual;
      return dual.map((_, i) => ({
        dual: dual.slice(0, i + 1),
        base: i === 0 ? 'p' : i === 1 ? (st.d.rho < 0.02 ? { mono: [2] } : { germ: [2, st.d.psi - Math.PI / 2, []] })
          : i === 2 ? discRecipe(st.d).base : { edit: { d: st.d, s: st.s.slice(0, i - 2) } },
      }));
    }
    if (base.germ) {
      const [k, ang, g] = base.germ, out = [{ dual: HS.pointDual(), base: 'p' }];
      for (let i = 2; i <= k; i++) {
        const gi = g.slice(0, i - 2);
        out.push({ dual: HS.germDual(i, ang, gi), base: { germ: [i, ang, gi] } });
      }
      return out;
    }
    // a monomial ideal: its boxes added by degree, then by the power of y (always a staircase)
    const boxes = [];
    base.mono.forEach((len, j) => { for (let i = 0; i < len; i++) boxes.push([i, j]); });
    boxes.sort((a, b) => a[0] + a[1] - b[0] - b[1] || a[1] - b[1]);
    return boxes.map((_, t) => {
      const lam = HS.partitionOf(boxes.slice(0, t + 1));
      return { dual: HS.monomialDual(lam), base: t ? { mono: lam } : 'p' };
    });
  }
  function build(c, recipe) {
    const chain = baseChain(recipe.base);
    const hist = chain.slice(0, -1).map((s) => ({ dual: s.dual, recipe: { base: s.base, merges: [] } }));
    let dual = chain[chain.length - 1].dual;
    recipe.merges.forEach((w, i) => {
      hist.push({ dual, recipe: { base: recipe.base, merges: recipe.merges.slice(0, i) } });
      dual = HS.merge(dual, w);
    });
    c.dual = dual;
    c.recipe = recipe;
    c.hist = hist;
    return c;
  }
  const makeCluster = (p, recipe) => build({ id: nextId++, p: p.slice() }, recipe || { base: 'p', merges: [] });
  const len = (c) => c.dual.length;
  const fresh = (n) => START[n].map((p) => makeCluster(p));

  // the single source of truth; draw() renders everything from it
  const state = {
    n: 3,
    cases: {},        // by n: its clusters
    phi: PHI0,        // the weight's angle, in degrees: w = (cos φ, sin φ)
    wall: null,       // [w1, w2], integers, when the weight sits on a wall of the ideal in view
    pick: null,       // the leading term ('a,b') of the generator picked in the formula
    drag: null,       // what is being dragged
    target: null,     // the cluster a dragged point would collide with if let go now
    guides: [],       // the x or y of another point that a dragged point has taken
    tau: 0,           // the flow, from 0 (t = 1) to 1 (t = 0)
    box: [0, 0],      // the box chosen in the tangent figure
    tlam: null,       // the partition chosen there (null: the one the ideal flows to)
    disc: { rho: 0.55, psi: 2.1 }, // the triple point of the disc figure, when the configuration has none
    sel: new Set(),   // the points picked out together (their ids): a drag moves them as one
    marquee: null,    // the box being drawn to pick out points, in the picture's pixels
    menu: null,       // the multiple point whose menu is open (its id)
    tips: 0,          // the hints the reader no longer needs: 1 has made points collide, 2 has opened a menu, 3 has selected points
    out: null,        // the monomial outside the staircase chosen in the figure of multiplication ('a,b')
  };
  for (let n = 1; n <= 6; n++) state.cases[n] = fresh(n);
  const cur = () => state.cases[state.n];
  const byId = (id) => cur().find((c) => c.id === id);

  // Undo and Redo, for each n: the configurations before each change, and after for Redo. Arrow
  // keys held on one thing make a single step.
  const hist = {};
  for (let n = 1; n <= 6; n++) hist[n] = { past: [], future: [] };
  const copyRecipe = (r) => JSON.parse(JSON.stringify(r)); // (plain data)
  const snapshot = () => cur().map((c) => ({ id: c.id, p: c.p.slice(), recipe: copyRecipe(c.recipe) }));
  let lastRecord = null;
  function record(key) {
    const now = performance.now();
    if (key && lastRecord && lastRecord.key === key && now - lastRecord.t < 1200) { lastRecord.t = now; return; }
    lastRecord = key ? { key, t: now } : null;
    const h = hist[state.n];
    undoButtons.keep(h.past, snapshot());
    h.future.length = 0;
  }
  function restore(snap) {
    state.cases[state.n] = snap.map((d) => build({ id: d.id, p: d.p.slice() }, copyRecipe(d.recipe)));
    for (const id of [...state.sel]) if (!byId(id)) state.sel.delete(id);
    state.target = null;
    lastRecord = null;
  }
  function undo() { const h = hist[state.n], s = h.past.pop(); if (!s) return; h.future.push(snapshot()); restore(s); changed(true); }
  function redo() { const h = hist[state.n], s = h.future.pop(); if (!s) return; h.past.push(snapshot()); restore(s); changed(true); }
  const undoButtons = MM.undoRedo({ undo, redo, canUndo: () => hist[state.n].past.length > 0, canRedo: () => hist[state.n].future.length > 0 });

  // While the reader works on the figure (a drag, the dial, the menu open), the readouts beside the
  // picture only grow: an ideal that took a line fewer would move what is under it, and on a wide
  // screen the picture too, which stays in view while the panel scrolls, down to the panel's end.
  // And if the picture moves all the same (a line more), the page is scrolled to keep it still
  // (draw); pinned counts how far, for the drags that keep to where their picture was.
  const locks = new Set();
  let pinned = 0;
  function lock(why) { locks.add(why); holdLayout(); }
  function unlock(why) {
    if (!locks.delete(why) || locks.size) return;
    for (const e of [$('formula'), $('side')]) e.style.minHeight = '';
  }
  function holdLayout() {
    if (!locks.size) return;
    for (const e of [$('formula'), $('side')]) e.style.minHeight = Math.max(parseFloat(e.style.minHeight) || 0, e.offsetHeight) + 'px';
  }

  let example = null; // links, reset and Save image (MM.example, at the end)

  /* ---------- the ideal ---------- */

  const weight = () => (state.wall ? state.wall.slice() : [Math.cos(state.phi * DEG), Math.sin(state.phi * DEG)]);
  const wAngle = () => (state.wall ? Math.atan2(state.wall[1], state.wall[0]) / DEG : state.phi);
  let model = null;
  function rebuild() {
    const cl = cur(), I = HS.ideal(cl, weight()), F = HS.fan(cl);
    const gens = I.gens.map((g, i) => ({ lead: g.lead, terms: g.terms, idx: i, key: g.lead.join(','), float: HS.toFloat(g.terms) }));
    model = { I, F, gens, lam: I.lambda, n: I.n };
    if (state.pick && !gens.some((g) => g.key === state.pick)) state.pick = null;
  }

  /* ---------- numbers and formulas ---------- */

  function trim(s) { return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); }
  // a number as TeX, to two decimals (two significant figures when small, whole when large)
  function texNum(x) {
    const a = Math.abs(x);
    let s;
    if (a === 0) s = '0';
    else if (a >= 1000) s = String(Math.round(a));
    else if (a >= 0.0995) s = trim(a.toFixed(2));
    else if (a >= 1e-4) s = trim(a.toFixed(Math.max(2, 1 - Math.floor(Math.log10(a)))));
    else { const e = Math.floor(Math.log10(a)); return (x < 0 ? '-' : '') + trim((a / Math.pow(10, e)).toFixed(1)) + '\\cdot10^{' + e + '}'; }
    return (x < 0 ? '-' : '') + s;
  }
  const plainNum = (x) => texNum(x).replace(/\\cdot10\^\{(-?\d+)\}/, '·10^$1').replace(/-/g, '−');
  function texMono(m) {
    const p = (v, e) => (e ? v + (e > 1 ? '^{' + e + '}' : '') : '');
    return p('x', m[0]) + p('y', m[1]);
  }
  const plainMono = (m) => (m[0] ? 'x' + (m[0] > 1 ? '^' + m[0] : '') : '') + (m[1] ? 'y' + (m[1] > 1 ? '^' + m[1] : '') : '') || '1';
  // The factors x − r and y − s that a polynomial (exact terms) has at the coordinates of the
  // points, taken out: { factors: [{ v, root, mult }], rest } with rest the exact terms left.
  function takeFactors(terms) {
    let P = terms.map((t) => ({ m: t.m.slice(), c: t.c }));
    const factors = [];
    for (const v of [0, 1]) {
      const seen = new Set();
      for (const c of cur()) {
        const root = HS.rat(c.p[v], 100), key = root.join('/');
        if (seen.has(key)) continue;
        seen.add(key);
        let mult = 0;
        for (;;) {
          const q = divLinear(P, v, root);
          if (!q) break;
          P = q;
          mult++;
        }
        if (mult) factors.push({ v, root, mult });
      }
    }
    return { factors, rest: P };
  }
  // P divided by (x − r) (v = 0) or (y − r) (v = 1), when it divides exactly; else null
  function divLinear(P, v, r) {
    const o = 1 - v, rows = new Map();
    for (const t of P) {
      const k = t.m[o];
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k).push(t);
    }
    const out = [];
    for (const [k, list] of rows) {
      const deg = Math.max(...list.map((t) => t.m[v]));
      if (deg === 0) return null;
      const a = new Array(deg + 1).fill(null).map(() => HS.rat(0));
      for (const t of list) a[t.m[v]] = Q.add(a[t.m[v]], t.c);
      // synthetic division by (s − r), from the top
      let acc = HS.rat(0);
      const qn = new Array(deg);
      for (let i = deg; i >= 1; i--) { acc = Q.add(Q.mul(acc, r), a[i]); qn[i - 1] = acc; }
      if (!Q.isZero(Q.add(Q.mul(acc, r), a[0]))) return null;
      qn.forEach((c, i) => { if (!Q.isZero(c)) { const m = [0, 0]; m[v] = i; m[o] = k; out.push({ m, c }); } });
    }
    const cmp = HS.compare(weight());
    return out.sort((t1, t2) => cmp(t2.m, t1.m));
  }
  // a polynomial (exact terms, the leading one first) as TeX, or as plain text: its factors x − r
  // and y − s at the coordinates of the points first, then what is left, term by term
  function texPoly(terms, plain) {
    const { factors, rest } = takeFactors(terms);
    const one = rest.length === 1 && !rest[0].m[0] && !rest[0].m[1] && Q.num(rest[0].c) === 1;
    const s = factors.map(({ v, root, mult }) => {
      const r = Q.num(root), name = v ? 'y' : 'x', e = mult > 1 ? (plain ? '^' + mult : '^{' + mult + '}') : '';
      if (r === 0) return name + e;
      const f = '(' + name + (r > 0 ? (plain ? ' − ' : '-') : (plain ? ' + ' : '+')) + (plain ? plainNum(Math.abs(r)) : texNum(Math.abs(r))) + ')';
      return f + e;
    }).join('');
    // a single linear factor needs no brackets of its own
    if (one && factors.length === 1 && factors[0].mult === 1 && s[0] === '(') return s.slice(1, -1);
    if (one && s) return s;
    const body = expand(rest, plain);
    return s ? s + (rest.length > 1 ? '(' + body + ')' : body) : body;
  }
  function expand(terms, plain) {
    let s = '';
    terms.forEach((t, i) => {
      const c = Q.num(t.c), a = Math.abs(c), m = plain ? (t.m[0] || t.m[1] ? plainMono(t.m) : '') : texMono(t.m);
      const num = m && Math.abs(a - 1) < 1e-12 ? '' : plain ? plainNum(a) : texNum(a);
      const sign = c < 0 ? (i ? (plain ? ' − ' : '-') : (plain ? '−' : '-')) : (i ? (plain ? ' + ' : '+') : '');
      s += sign + num + m;
    });
    return s || '0';
  }

  /* ---------- the plane ---------- */

  const plane = $('plane'), canvas = $('canvas'), ctx = canvas.getContext('2d'), stage = $('stage');
  const curveCv = document.createElement('canvas'), curveCtx = curveCv.getContext('2d');
  // the view of a square box of side W: plane coordinates to pixels and back
  function viewOf(W, H) {
    const k = Math.min(W, H) / (2 * VIEW);
    return { W, H, k, X: (x) => W / 2 + x * k, Y: (y) => H / 2 - y * k, x: (px) => (px - W / 2) / k, y: (py) => (H / 2 - py) / k };
  }
  let V = viewOf(1, 1);

  // a token's colour as [r, g, b]
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgbCache = new Map();
  function rgbOf(name) {
    if (rgbCache.has(name)) return rgbCache.get(name);
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = MM.color(name);
    probe.fillRect(0, 0, 1, 1);
    const v = Array.from(probe.getImageData(0, 0, 1, 1).data.slice(0, 3));
    rgbCache.set(name, v);
    return v;
  }
  const genColor = (i) => 'gen-' + (i % 6), curveColor = (i) => 'curve-' + (i % 6);

  // the grid at the integers and the axes, for a view
  function grid(c2, v) {
    c2.lineWidth = 1;
    c2.strokeStyle = MM.color('rule-2');
    c2.beginPath();
    for (let i = -3; i <= 3; i++) {
      if (!i) continue;
      const X = Math.round(v.X(i)) + 0.5, Y = Math.round(v.Y(i)) + 0.5;
      c2.moveTo(X, 0); c2.lineTo(X, v.H);
      c2.moveTo(0, Y); c2.lineTo(v.W, Y);
    }
    c2.stroke();
    c2.strokeStyle = MM.color('rule');
    c2.beginPath();
    const X0 = Math.round(v.X(0)) + 0.5, Y0 = Math.round(v.Y(0)) + 0.5;
    c2.moveTo(X0, 0); c2.lineTo(X0, v.H);
    c2.moveTo(0, Y0); c2.lineTo(v.W, Y0);
    c2.stroke();
  }
  // the zero sets of polynomials (float terms) on a canvas, over what is there
  function curves(c2, v, polys, buffer) {
    const cw = c2.canvas.width, ch = c2.canvas.height;
    if (!buffer.img || buffer.img.width !== cw || buffer.img.height !== ch) {
      buffer.img = new ImageData(cw, ch);
      buffer.cv.width = cw;
      buffer.cv.height = ch;
    }
    buffer.img.data.fill(0);
    const kd = v.k * (cw / v.W);
    CV.draw(polys.map((p) => ({ terms: p.terms, rgb: p.rgb, alpha: p.alpha, width: p.width * (cw / v.W) })),
      { W: cw, H: ch, x0: -v.W / (2 * v.k), y0: v.H / (2 * v.k), k: kd }, buffer.img.data);
    buffer.ctx.putImageData(buffer.img, 0, 0);
    c2.drawImage(buffer.cv, 0, 0, v.W, v.H);
  }
  const mainBuffer = { cv: curveCv, ctx: curveCtx, img: null };
  // the curves of the generators: those with a repeated factor, drawn wider, first, so that the
  // others show over them; the one picked in the formula last
  function genPolys() {
    return model.gens.map((g) => {
      const picked = state.pick === g.key, dim = state.pick && !picked;
      const wide = takeFactors(g.terms).factors.some((f) => f.mult > 1);
      return { terms: g.float, rgb: rgbOf(curveColor(g.idx)), alpha: dim ? 0.3 : 1, width: picked ? 3.2 : 2.3, picked, wide };
    }).sort((a, b) => a.picked - b.picked || b.wide - a.wide);
  }
  function drawCanvas() {
    MM.clearCanvas(ctx, MM.color('surface'));
    grid(ctx, V);
    curves(ctx, V, genPolys(), mainBuffer);
  }

  // the germ of a curvilinear cluster in the frame of its tangent: from its recipe when it is a
  // germ (so that its handle stays at the same end), else from its dual
  function frameOf(c) {
    if (len(c) < 2) return null;
    const b = c.recipe.base;
    if (b.germ && !c.recipe.merges.length) return { angle: b.germ[1], g: b.germ[2] };
    return HS.germFrame(c.dual);
  }
  // points along the germ, each way from its place, up to GERM pixels: [−side…, +side…]
  function germPath(c, v, frame, reach) {
    const P = [c.p[0] / 100, c.p[1] / 100], ca = Math.cos(frame.angle), sa = Math.sin(frame.angle);
    const at = (s) => {
      let t = 0;
      frame.g.forEach((g, i) => { t += g * Math.pow(s, i + 2); });
      return [v.X(P[0] + s * ca - t * sa), v.Y(P[1] + s * sa + t * ca)];
    };
    const side = (dir) => {
      const out = [];
      let s = 0, q = at(0), run = 0;
      const ds = 1.5 / v.k;
      for (let i = 0; i < 400 && run < reach; i++) {
        s += dir * ds;
        const p2 = at(s);
        run += Math.hypot(p2[0] - q[0], p2[1] - q[1]);
        q = p2;
        out.push(p2);
      }
      return out;
    };
    return { minus: side(-1).reverse(), centre: at(0), plus: side(1) };
  }
  const pathD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');

  function drawStage() {
    const active = document.activeElement;
    const focusKey = active && stage.contains(active) ? active.dataset.key : null;
    stage.textContent = '';
    stage.setAttribute('viewBox', '0 0 ' + V.W + ' ' + V.H);
    // the axes' names and their numbers
    const tx = el('text', { class: 'hs-axis-name', x: V.W - 8, y: V.Y(0) - 7, 'text-anchor': 'end' }, stage);
    MM.svgLabel(tx, '$x$');
    const ty = el('text', { class: 'hs-axis-name', x: V.X(0) + 7, y: 15 }, stage);
    MM.svgLabel(ty, '$y$');
    for (let i = -3; i <= 3; i++) {
      if (!i) continue;
      el('text', { class: 'hs-tick', x: V.X(i), y: V.Y(0) + 13, 'text-anchor': 'middle' }, stage).textContent = String(i).replace('-', '−');
      el('text', { class: 'hs-tick', x: V.X(0) - 5, y: V.Y(i) + 3.5, 'text-anchor': 'end' }, stage).textContent = String(i).replace('-', '−');
    }
    // the x or y of another point that a dragged one has taken
    for (const g of state.guides) {
      if (g.x !== undefined) el('line', { class: 'hs-guide', x1: V.X(g.x), y1: 0, x2: V.X(g.x), y2: V.H }, stage);
      else el('line', { class: 'hs-guide', x1: 0, y1: V.Y(g.y), x2: V.W, y2: V.Y(g.y) }, stage);
    }
    const cl = cur().slice();
    if (state.drag && state.drag.kind === 'point') cl.sort((a, b) => (a.id === state.drag.id) - (b.id === state.drag.id));
    // the curves the collisions remember, with the handles that turn them
    for (const c of cl) {
      const f = len(c) > 1 && HS.structure(c.dual).curvilinear ? frameOf(c) : null;
      if (!f) continue;
      const path = germPath(c, V, f, GERM);
      el('path', { class: 'hs-germ', d: pathD(path.minus.concat([path.centre], path.plus)) }, stage);
      if (hideHandles) continue;
      const end = path.plus[path.plus.length - 1];
      const kn = el('g', { class: 'hs-knob draggable', tabindex: 0, role: 'slider', 'data-key': 'k' + c.id, 'data-id': c.id }, stage);
      const deg = ((Math.round(f.angle / DEG) % 180) + 180) % 180;
      kn.setAttribute('aria-label', 'The direction of the ' + kindName(len(c)) + ' at ' + where(c));
      kn.setAttribute('aria-valuemin', '0');
      kn.setAttribute('aria-valuemax', '180');
      kn.setAttribute('aria-valuenow', String(deg));
      kn.setAttribute('aria-valuetext', deg + '°');
      el('circle', { class: 'hs-pad', cx: end[0], cy: end[1], r: 12 }, kn);
      el('circle', { class: 'focus-ring', cx: end[0], cy: end[1], r: 8 }, kn);
      el('circle', { class: 'handle-point', cx: end[0], cy: end[1], r: 4.2 }, kn);
    }
    // where a dragged point would collide
    if (state.target !== null) {
      const t = byId(state.target);
      if (t) el('circle', { class: 'snap-ring', cx: V.X(t.p[0] / 100), cy: V.Y(t.p[1] / 100), r: (len(t) > 1 ? RF : R) + 7 }, stage);
    }
    // the box that picks out points
    if (state.marquee) {
      const [x0, y0, x1, y1] = state.marquee;
      el('rect', { class: 'hs-box', x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }, stage);
    }
    // the points; those selected on a halo of the selection's colour
    for (const c of cl) {
      const X = V.X(c.p[0] / 100), Y = V.Y(c.p[1] / 100), k = len(c), r = k > 1 ? RF : R, picked = state.sel.has(c.id);
      const g = el('g', { class: 'hs-pt draggable', tabindex: 0, role: 'button', 'data-key': 'p' + c.id, 'data-id': c.id, 'aria-pressed': String(picked) }, stage);
      g.setAttribute('aria-label', (k > 1 ? 'A ' + kindName(k) : 'A point') + ' at ' + where(c) + (picked ? ', selected' : '') + '. '
        + (k > 1 ? (picked ? 'Arrow keys move it' : 'Arrow keys pull out the last point to join it') + '; Enter opens its menu' : 'Arrow keys move it, onto another point to collide with it') + '; Space selects it with others.');
      el('circle', { class: 'hs-pad', cx: X, cy: Y, r: r + 8 }, g);
      if (picked) el('circle', { class: 'hs-sel', cx: X, cy: Y, r: r + 7 }, g);
      el('circle', { class: 'focus-ring', cx: X, cy: Y, r: r + 4 }, g);
      el('circle', { class: 'handle-point', cx: X, cy: Y, r }, g);
      if (k > 1) el('text', { class: 'handle-num', x: X, y: Y + 3.8 }, g).textContent = k;
    }
    if (focusKey) {
      const again = stage.querySelector('[data-key="' + focusKey + '"]');
      if (again) again.focus({ preventScroll: true });
    }
  }
  const where = (c) => '(' + plainNum(c.p[0] / 100) + ', ' + plainNum(c.p[1] / 100) + ')';
  const kindName = (k) => (k === 2 ? 'double point' : k === 3 ? 'triple point' : 'point of multiplicity ' + k);

  /* ---------- moving the points ---------- */

  function stageXY(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  const pxOf = (c) => [V.X(c.p[0] / 100), V.Y(c.p[1] / 100)];
  // the cluster within SNAP pixels of c that it would collide with
  function snapTarget(c) {
    const p = pxOf(c);
    let best = null, bd = SNAP;
    for (const o of cur()) {
      if (o.id === c.id) continue;
      const q = pxOf(o), d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < bd) { bd = d; best = o.id; }
    }
    return best;
  }
  // put c at the pixel (px, py): in hundredths, inside the square, taking the x or the y of
  // another point when within ALIGN pixels of it, never on top of another
  function place(c, px, py) {
    let X = clamp(Math.round(V.x(px) * 100), -SPAN, SPAN), Y = clamp(Math.round(V.y(py) * 100), -SPAN, SPAN);
    state.guides = [];
    for (const o of cur()) {
      if (o.id === c.id) continue;
      // (not near a point it may collide with: the direction it comes in from is its own)
      if (Math.hypot(V.X(o.p[0] / 100) - px, V.Y(o.p[1] / 100) - py) < 2.5 * SNAP) continue;
      if (Math.abs(V.X(o.p[0] / 100) - px) < ALIGN) { X = o.p[0]; state.guides.push({ x: X / 100 }); }
      if (Math.abs(V.Y(o.p[1] / 100) - py) < ALIGN) { Y = o.p[1]; state.guides.push({ y: Y / 100 }); }
    }
    if (cur().some((o) => o.id !== c.id && o.p[0] === X && o.p[1] === Y)) X += X < SPAN ? 1 : -1;
    c.p = [X, Y];
  }
  // pull the last point to join a cluster out of it, as a point of its own at p
  function pullOut(c, p) {
    const h = c.hist.pop();
    c.dual = h.dual;
    c.recipe = h.recipe;
    const out = makeCluster(p);
    cur().push(out);
    return out;
  }
  // the points of a multiple point set apart: one stays, the others go round it
  function separate(c) {
    const q = pxOf(c), k = len(c);
    for (let i = 1; i < k; i++) cur().push(makeCluster(freeSpot(q)));
    build(c, { base: 'p', merges: [] });
  }
  // the angle between two lines through the origin, along u and v
  function lineAngle(u, v) {
    const a = Math.abs(Math.atan2(u[1], u[0]) - Math.atan2(v[1], v[0])) % Math.PI;
    return Math.min(a, Math.PI - a);
  }
  // The direction in which a point joins the cluster t, from where it was let go: snapped to the
  // axes when near them, and to the directions in which joining gives something else than from
  // the directions nearby (the tangent of a germ, say) when near those.
  function joinDirection(t, w) {
    let best = null, bd = Infinity;
    for (const a of [[1, 0], [0, 1]]) { const d = lineAngle(w, a); if (d < AXIS_SNAP && d < bd) { best = a; bd = d; } }
    if (len(t) > 1) {
      const kg = HS.k0(t.dual, [9973, 6131]), st = HS.structure(t.dual);
      const cands = t.recipe.merges.concat(st.dir ? [st.dir.map(Number)] : [], [[1, 0], [0, 1]]);
      for (const c of cands) {
        const d = lineAngle(w, c);
        if (d < DIR_SNAP && d < bd && HS.k0(t.dual, c) > kg) { best = c; bd = d; }
      }
    }
    return best || w;
  }
  function collide(c, t) {
    let w = [c.p[0] - t.p[0], c.p[1] - t.p[1]];
    if (!w[0] && !w[1]) w = [1, 0];
    w = joinDirection(t, w);
    t.hist.push({ dual: t.dual, recipe: t.recipe });
    t.dual = HS.merge(t.dual, w);
    t.recipe = { base: t.recipe.base, merges: t.recipe.merges.concat([w.map(Number)]) };
    const list = cur();
    list.splice(list.indexOf(c), 1);
    state.sel.delete(c.id);
    tipDone(1);
  }
  // The points picked out together move as one, by d (in hundredths): as far as the square lets
  // all of them go, and never onto another point.
  function moveGroup(from, d) {
    const ids = [...from.keys()];
    let lo = [-Infinity, -Infinity], hi = [Infinity, Infinity];
    for (const id of ids) {
      const p = from.get(id);
      for (let q = 0; q < 2; q++) { lo[q] = Math.max(lo[q], -SPAN - p[q]); hi[q] = Math.min(hi[q], SPAN - p[q]); }
    }
    let dx = clamp(d[0], lo[0], hi[0]);
    const dy = clamp(d[1], lo[1], hi[1]), others = cur().filter((c) => !from.has(c.id));
    for (let tries = 0; tries < 4; tries++) {
      if (!ids.some((id) => others.some((o) => o.p[0] === from.get(id)[0] + dx && o.p[1] === from.get(id)[1] + dy))) break;
      dx += dx < hi[0] ? 1 : -1;
    }
    for (const id of ids) { const c = byId(id), p = from.get(id); if (c) c.p = [p[0] + dx, p[1] + dy]; }
  }
  // the points inside a box drawn on the picture (in its pixels), with those picked out before
  function boxPick(box, keep) {
    const x0 = Math.min(box[0], box[2]), x1 = Math.max(box[0], box[2]), y0 = Math.min(box[1], box[3]), y1 = Math.max(box[1], box[3]);
    state.sel = new Set(keep);
    for (const c of cur()) { const q = pxOf(c); if (q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1) state.sel.add(c.id); }
  }

  // A press on the picture. On a point a drag moves it (out of a multiple point, the last point
  // to join it), or, if it is selected, all the points selected, a multiple point whole; a click
  // on a multiple point opens its menu. With Shift, or on the empty plane, a drag draws a box that
  // selects the points in it, and a click with Shift selects a point or puts it back. On a touch
  // screen a press held still does the same: a box from where it is, or the point selected;
  // elsewhere a touch on the empty plane scrolls the page.
  const HOLD = 450; // ms
  stage.addEventListener('pointerdown', (e) => {
    if (e.button || state.drag) return;
    if (gliding) gliding.finish();
    const kn = e.target.closest('.hs-knob'), g = e.target.closest('.hs-pt'), m = stageXY(e);
    const touch = e.pointerType === 'touch', shift = e.shiftKey && !touch;
    const c = g ? byId(+g.dataset.id) : kn ? byId(+kn.dataset.id) : null;
    const d = { pid: e.pointerId, x: e.clientX, y: e.clientY, s: m, moved: false, touch, shift, id: c ? c.id : null, onPoint: !!g };
    if (kn && !shift) {
      const P = [c.p[0] / 100, c.p[1] / 100];
      Object.assign(d, { kind: 'knob', frame: frameOf(c), a0: Math.atan2(V.y(m[1]) - P[1], V.x(m[0]) - P[0]) });
    } else if (shift) d.kind = 'box';
    else if (g) {
      if (state.sel.has(c.id) && (state.sel.size > 1 || len(c) > 1)) d.kind = 'group';
      else { d.kind = 'point'; const q = pxOf(c); d.off = [m[0] - q[0], m[1] - q[1]]; }
    } else d.kind = touch ? 'wait' : 'box';
    state.drag = d;
    // (a touch on the empty plane may still scroll the page: it is not held until it is held still)
    if (d.kind !== 'wait') {
      e.preventDefault();
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
      if (kn || g) (kn || g).focus({ preventScroll: true });
    }
    if (touch && d.kind !== 'knob') d.timer = setTimeout(() => { if (state.drag === d && !d.moved) hold(d); }, HOLD);
  });
  function hold(d) {
    d.kind = 'box';
    d.held = true;
    d.keep = new Set(state.sel);
    try { stage.setPointerCapture(d.pid); } catch (err) { /* the pointer is already gone */ }
    state.marquee = [d.s[0], d.s[1], d.s[0], d.s[1]];
    closeMenu(false);
    drawStage();
  }
  stage.addEventListener('pointermove', (e) => {
    const d = state.drag;
    if (!d || e.pointerId !== d.pid) return;
    const m = stageXY(e);
    if (d.kind === 'knob') {
      const c = byId(d.id), P = [c.p[0] / 100, c.p[1] / 100];
      if (!d.moved) { d.moved = true; record(); lock('drag'); }
      turnGerm(c, d.frame, d.frame.angle + (Math.atan2(V.y(m[1]) - P[1], V.x(m[0]) - P[0]) - d.a0));
      changed();
      return;
    }
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < (d.touch && !d.held ? 8 : 3)) return;
      d.moved = true;
      clearTimeout(d.timer);
      if (d.kind === 'wait') { state.drag = null; return; } // a touch that moves at once scrolls the page
      closeMenu(false);
      stage.classList.add('is-dragging');
      if (d.kind === 'point' || d.kind === 'group') { record(); lock('drag'); }
      if (d.kind === 'box' && !d.held) d.keep = d.shift ? new Set(state.sel) : new Set();
      if (d.kind === 'group') d.from = new Map([...state.sel].map((id) => [id, byId(id).p.slice()]));
      if (d.kind === 'point') {
        state.sel.clear();
        let c = byId(d.id);
        // out of a multiple point comes the last point to join it
        if (len(c) > 1) { c = pullOut(c, c.p); d.id = c.id; d.off = [0, 0]; }
      }
    }
    if (d.kind === 'box') {
      state.marquee = [d.s[0], d.s[1], m[0], m[1]];
      boxPick(state.marquee, d.keep);
      drawStage();
      return;
    }
    if (d.kind === 'group') {
      moveGroup(d.from, [Math.round((m[0] - d.s[0]) / V.k * 100), -Math.round((m[1] - d.s[1]) / V.k * 100)]);
      changed();
      return;
    }
    const c = byId(d.id);
    place(c, m[0] - d.off[0], m[1] - d.off[1]);
    state.target = snapTarget(c);
    changed();
  });
  // while a press on the picture is being followed, a touch does not scroll the page
  stage.addEventListener('touchmove', (e) => { const d = state.drag; if (d && d.kind !== 'wait' && e.cancelable) e.preventDefault(); }, { passive: false });
  function endPress(e, cancelled) {
    const d = state.drag;
    if (!d || e.pointerId !== d.pid) return;
    clearTimeout(d.timer);
    state.drag = null;
    stage.classList.remove('is-dragging');
    state.guides = [];
    unlock('drag');
    const c = d.id !== null ? byId(d.id) : null;
    if (d.kind === 'box') {
      state.marquee = null;
      if (!d.moved && !cancelled) {
        // a click with Shift, or a touch held, on a point: selected, or put back
        if (c && d.onPoint) { if (state.sel.has(c.id)) state.sel.delete(c.id); else state.sel.add(c.id); }
        else if (!d.shift) { state.sel.clear(); closeMenu(false); }
      }
      if (state.sel.size > 1) tipDone(3);
    } else if (d.kind === 'wait') {
      // a tap on the empty plane: nothing is selected any more
      if (!cancelled) { state.sel.clear(); closeMenu(false); }
    } else if (d.kind === 'point' && d.moved && !cancelled && state.target !== null) {
      const t = byId(state.target);
      if (c && t) { glide(c, t); return; }
    } else if (!d.moved && !cancelled && (d.kind === 'point' || d.kind === 'group') && c) {
      // a click on a point: a multiple point's menu opens (or closes)
      if (d.kind === 'point') state.sel.clear();
      if (len(c) > 1 && state.menu !== c.id) openMenu(c, false);
      else closeMenu(false);
    }
    state.target = null;
    changed(true);
  }
  stage.addEventListener('pointerup', (e) => endPress(e, false));
  stage.addEventListener('pointercancel', (e) => endPress(e, true));

  // A point let go near another glides into it along the straight line from where it was let go
  // (at once where motion is to be reduced), and then they collide.
  let gliding = null;
  function glide(c, t) {
    const from = c.p.slice(), d = [from[0] - t.p[0], from[1] - t.p[1]], dist = Math.hypot(d[0], d[1]);
    // the direction it joins along is fixed now, from where it was let go
    const finish = () => {
      if (!gliding) return;
      gliding = null;
      c.p = from;
      collide(c, t);
      state.target = null;
      changed(true);
    };
    gliding = { finish };
    if (MM.reduceMotion() || dist < 3) { finish(); return; }
    const t0 = performance.now(), dur = 170;
    const step = () => {
      if (!gliding) return;
      const u = Math.min(1, (performance.now() - t0) / dur), e = u * u * (3 - 2 * u);
      // stop a little short of it, where the ideals are already close to their limit
      const k = Math.min(e, 1 - 2 / dist);
      const p = [Math.round(t.p[0] + d[0] * (1 - k)), Math.round(t.p[1] + d[1] * (1 - k))];
      if ((p[0] !== t.p[0] || p[1] !== t.p[1]) && cur().every((o) => o === c || o.p[0] !== p[0] || o.p[1] !== p[1])) c.p = p;
      if (u >= 1) { finish(); return; }
      changed(true);
      requestAnimationFrame(step);
    };
    // (in a page whose frames are not drawn, it ends all the same)
    setTimeout(() => { if (gliding && gliding.finish === finish) finish(); }, dur + 250);
    step();
  }

  // a curvilinear cluster turned so that its tangent is at the angle ang (snapped to the axes when near, for a drag)
  function turnGerm(c, frame, ang, snap = true) {
    const q = Math.round(ang / (Math.PI / 2));
    if (snap && Math.abs(ang - q * Math.PI / 2) < KNOB_SNAP) ang = q * Math.PI / 2;
    ang = Math.round(ang / DEG * 100) / 100 * DEG;
    const g = frame.g.map((x) => Math.round(x * 1e4) / 1e4);
    build(c, { base: { germ: [len(c), ang, g] }, merges: [] });
  }

  // The arrow keys move a point, or the last point to join a multiple point out of it, or all the
  // points selected with it (a selected multiple point whole); moving towards another point, a
  // point collides with it once close. Space selects a point (or puts it back), Enter opens a
  // multiple point's menu, Escape closes the menu or clears the selection.
  const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  stage.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      if (state.menu !== null) closeMenu(true);
      else if (state.sel.size) { state.sel.clear(); changed(true); } else return;
      e.preventDefault();
      return;
    }
    const kn = e.target.closest('.hs-knob'), g = e.target.closest('.hs-pt');
    if (kn) {
      const a = ARROWS[e.key];
      if (!a) return;
      e.preventDefault();
      // a few degrees at a time, stopping at an axis on the way
      const c = byId(+kn.dataset.id), f = frameOf(c), dir = a[0] || a[1], to = f.angle + dir * (e.shiftKey ? 0.5 : 3) * DEG;
      const axis = (dir > 0 ? Math.floor : Math.ceil)(to / (Math.PI / 2)) * Math.PI / 2;
      record('k' + c.id);
      turnGerm(c, f, (axis - f.angle) * dir > 1e-9 ? axis : to, false);
      changed(true);
      return;
    }
    if (!g) return;
    let c = byId(+g.dataset.id);
    const a = ARROWS[e.key];
    if (a) {
      e.preventDefault();
      const step = e.shiftKey ? 2 : 8;
      if (state.sel.has(c.id) && (state.sel.size > 1 || len(c) > 1)) {
        record('g');
        moveGroup(new Map([...state.sel].map((id) => [id, byId(id).p.slice()])), [Math.round(a[0] * step / V.k * 100), Math.round(a[1] * step / V.k * 100)]);
        changed(true);
        return;
      }
      record(len(c) > 1 ? null : 'p' + c.id);
      if (len(c) > 1) { closeMenu(false); c = pullOut(c, c.p); }
      const from = c.p.slice(), q = pxOf(c);
      place(c, q[0] + a[0] * step, q[1] - a[1] * step);
      state.guides = [];
      const t = snapTarget(c) !== null ? byId(snapTarget(c)) : null;
      // towards another point and close to it: they collide
      if (t && Math.hypot(c.p[0] - t.p[0], c.p[1] - t.p[1]) < Math.hypot(from[0] - t.p[0], from[1] - t.p[1])) collide(c, t);
      focusAfter = 'p' + (cur().includes(c) ? c.id : t.id);
      changed(true);
    } else if (e.key === ' ') {
      e.preventDefault();
      if (state.sel.has(c.id)) state.sel.delete(c.id); else state.sel.add(c.id);
      if (state.sel.size > 1) tipDone(3);
      changed(true);
    } else if (e.key === 'Enter') {
      if (len(c) < 2) return;
      e.preventDefault();
      openMenu(c, true);
    }
  });
  let focusAfter = null;
  // a place for a point set apart: about 40 pixels away, clear of the others
  function freeSpot(q) {
    for (let t = 0; t < 24; t++) {
      const a = Math.PI / 4 + t * Math.PI / 8 * (t % 2 ? -1 : 1), r = 40 + 8 * Math.floor(t / 6);
      const X = clamp(Math.round(V.x(q[0] + r * Math.cos(a)) * 100), -SPAN, SPAN), Y = clamp(Math.round(V.y(q[1] - r * Math.sin(a)) * 100), -SPAN, SPAN);
      if (cur().every((o) => Math.hypot(V.X(o.p[0] / 100) - V.X(X / 100), V.Y(o.p[1] / 100) - V.Y(Y / 100)) > SNAP + 4)) return [X, Y];
    }
    return [clamp(Math.round(V.x(q[0] + 40) * 100), -SPAN, SPAN), Math.round(V.y(q[1]) * 100)];
  }

  /* ---------- the menu of a multiple point ---------- */

  // Opened by a click on a multiple point, beside it: for a triple point the disc of all triple
  // points at one place (as in the text); for a point of multiplicity four or more the same disc,
  // for the triple point it holds, with a small handle for each further point (HS.editDual): on a
  // circle round the handle before it when the ways to add that point form a projective line, in a
  // small disc when they form a plane; for any, the monomial ideals of its multiplicity, made at its
  // place; and Split, which sets its points apart.
  const menu = $('menu');
  let menuFor = '', ed = null; // the editor of the point whose menu is open: { id, key, st, chain }
  const recipeKey = (r) => JSON.stringify(r);
  function editorOf(c) {
    const key = recipeKey(c.recipe);
    if (ed && ed.id === c.id && ed.key === key) return ed;
    const b = c.recipe.base, st = b.edit && !c.recipe.merges.length ? b.edit : HS.editState(c.dual);
    const chain = HS.editDual(len(c), st);
    ed = { id: c.id, key, st: chain.state, chain };
    return ed;
  }
  // the point as the editor's state st makes it (the steps after a frame that has turned carried over)
  function setEditor(c, st) {
    const k = len(c), chain = HS.editDual(k, st, ed && ed.id === c.id ? ed.chain : null);
    build(c, k === 3 ? discRecipe(chain.state.d) : { base: { edit: chain.state }, merges: [] });
    ed = { id: c.id, key: recipeKey(c.recipe), st: chain.state, chain };
  }
  function openMenu(c, keyboard) {
    state.menu = c.id;
    delete menu.dataset.placed;
    tipDone(2);
    buildMenu(c);
    menu.hidden = false;
    lock('menu');
    drawMenu();
    if (keyboard) { const f = menu.querySelector('.dc-handle, button'); if (f) f.focus(); }
  }
  function closeMenu(focusBack) {
    if (state.menu === null) return;
    const id = state.menu;
    state.menu = null;
    menu.hidden = true;
    unlock('menu');
    if (focusBack) { const t = stage.querySelector('[data-key="p' + id + '"]'); if (t) t.focus({ preventScroll: true }); }
  }
  function miniDiagram(lam, cm) {
    const w = lam[0] * cm, h = lam.length * cm;
    const svg = el('svg', { width: w + 2, height: h + 2, viewBox: '-1 -1 ' + (w + 2) + ' ' + (h + 2), 'aria-hidden': 'true' });
    lam.forEach((l2, j) => { for (let i = 0; i < l2; i++) el('rect', { x: i * cm, y: h - (j + 1) * cm, width: cm, height: cm }, svg); });
    return svg;
  }
  function buildMenu(c) {
    const k = len(c);
    menu.textContent = '';
    menu.setAttribute('aria-label', 'The ' + kindName(k) + ' at ' + where(c));
    if (k >= 3) {
      const svg = el('svg', { class: 'hs-mdisc' + (k > 3 ? ' is-wide' : ''), role: 'group', 'aria-label': (k > 3 ? 'Its triple point, in the disc of all triple points at its place, and a small handle for each further point. ' : 'All triple points at its place: a disc whose opposite rim points are the same, m² at the centre and the straight ones on the rim. ') + 'The arrow keys move the handles.' });
      menu.appendChild(svg);
      wireEditor(svg);
    }
    const row = document.createElement('div');
    row.className = 'hs-mrow';
    for (const lam of HS.partitions(k)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'strip-item hs-mini';
      b.dataset.lam = lam.join('.');
      b.appendChild(miniDiagram(lam, 7));
      b.setAttribute('aria-label', 'Make it the monomial ideal of the partition (' + lam.join(', ') + ')');
      b.title = 'The monomial ideal of (' + lam.join(', ') + ')';
      b.addEventListener('click', () => { const cc = byId(state.menu); if (cc) { record(); build(cc, { base: { mono: lam.slice() }, merges: [] }); changed(true); } });
      row.appendChild(b);
    }
    const sep = document.createElement('button');
    sep.type = 'button';
    sep.className = 'btn btn-sm btn-icon hs-sep';
    sep.setAttribute('aria-label', 'Split');
    sep.title = 'Split';
    sep.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 6.2L2.5 2.5M2.5 5.3V2.5h2.8"/><path d="M9.8 6.2l3.7-3.7M10.7 2.5h2.8v2.8"/><path d="M6.2 9.8l-3.7 3.7M2.5 10.7v2.8h2.8"/><path d="M9.8 9.8l3.7 3.7M13.5 10.7v2.8h-2.8"/></svg>';
    sep.addEventListener('click', () => { const cc = byId(state.menu); closeMenu(false); if (cc) { record(); separate(cc); focusAfter = 'p' + cc.id; } changed(true); });
    row.appendChild(sep);
    menu.appendChild(row);
    menuFor = c.id + ':' + k;
  }
  // the menu, while it is open, in step with its point: beside it, inside the picture
  function drawMenu() {
    if (state.menu === null) return;
    const c = byId(state.menu);
    if (!c || len(c) < 2) { closeMenu(false); return; }
    if (menuFor !== c.id + ':' + len(c)) buildMenu(c);
    const svg = menu.querySelector('.hs-mdisc');
    if (svg) { const E = editorOf(c); discPicture(svg, E.st.d, true, len(c) > 3 ? E : null); }
    for (const b of menu.querySelectorAll('.hs-mini')) b.setAttribute('aria-pressed', String(HS.rank(c.dual.concat(HS.monomialDual(b.dataset.lam.split('.').map(Number)))) === len(c)));
    // Below it, above, to the right or to the left: the first side with room, clear of the point,
    // inside the picture and on the screen (under the bar); else on the screen, reaching past the
    // picture (on a phone the menu is nearly as tall as the picture); else beside the point on its
    // roomier side, pushed into the picture across and onto the screen up and down, even if it
    // then covers the point; and only where the window is too short for it, in the picture. Placed
    // when it opens or its point moves, not while the reader works in it, so that it stays put
    // under the pointer.
    const q = pxOf(c), mw = menu.offsetWidth, mh = menu.offsetHeight, gap = 20;
    const key = c.id + ':' + c.p.join(',') + ':' + mw + 'x' + mh + ':' + V.W;
    if (menu.dataset.placed === key) return;
    menu.dataset.placed = key;
    const pr = plane.getBoundingClientRect(), bar = document.querySelector('.control-bar');
    const vis = [(bar ? bar.getBoundingClientRect().bottom : 0) - pr.top + 4, window.innerHeight - pr.top - 4];
    const cx = (x) => clamp(x, 4, Math.max(4, V.W - mw - 4));
    const sides = ([lo, hi]) => [
      [cx(q[0] - mw / 2), q[1] + gap], [cx(q[0] - mw / 2), q[1] - gap - mh],
      [q[0] + gap, clamp(q[1] - mh / 2, lo, Math.max(lo, hi - mh))], [q[0] - gap - mw, clamp(q[1] - mh / 2, lo, Math.max(lo, hi - mh))],
    ].filter(([x, y]) => x >= 4 && x + mw <= V.W - 4 && y >= lo && y + mh <= hi);
    const both = [Math.max(4, vis[0]), Math.min(V.H - 4, vis[1])], range = both[1] - both[0] >= mh ? both : vis;
    const beside = () => [V.W - q[0] >= q[0] ? cx(q[0] + gap) : cx(q[0] - gap - mw), clamp(q[1] - mh / 2, range[0], range[1] - mh)];
    const [x, y] = sides(both)[0] || sides(vis)[0] || (vis[1] - vis[0] >= mh ? beside() : null) || sides([4, V.H - 4])[0]
      || [cx(q[0] + gap), clamp(q[1] + gap, 4, Math.max(4, V.H - mh - 4))];
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    // where the screen shows too little of the picture for it (a phone, the picture half below the
    // window), the page is scrolled as it opens, just enough to show it all under the bar
    // (the bar scrolls with the page until it sticks under the navigation, at its `top`)
    const r = menu.getBoundingClientRect(), br = bar ? bar.getBoundingClientRect() : null;
    const top = (br ? br.bottom : 0) + 4, stuck = br ? (parseFloat(getComputedStyle(bar).top) || 0) + br.height + 4 : 4;
    const dy = r.bottom > window.innerHeight - 4 ? Math.min(r.bottom - window.innerHeight + 4, r.top - stuck) : r.top < top ? r.top - top : 0;
    if (Math.abs(dy) >= 1) window.scrollBy({ top: dy, behavior: 'instant' });
  }
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); } });
  // a press anywhere else closes it (on its own point, the click there does; Undo and Redo keep it)
  document.addEventListener('pointerdown', (e) => {
    if (state.menu === null || menu.contains(e.target)) return;
    const g = e.target.closest && e.target.closest('.hs-pt');
    if (g && +g.dataset.id === state.menu) return;
    if (e.target.closest && e.target.closest('#undo, #redo')) return;
    closeMenu(false);
  }, true);
  // and Save image, whose picture it must not be in; which may take any figure in the text,
  // so those not drawn since they were last in view are drawn now
  document.addEventListener('mm:dialog', () => {
    closeMenu(false);
    if (document.documentElement.classList.contains('is-dialog-open') && model) for (const sec of SECTIONS) if (sec.dirty) { sec.dirty = false; sec.draw(); }
  });

  // The small handles of the editor, in the disc's units: each step's kind, the place it hangs from
  // (the handle before it; after m², the centre), the centre of its circle or disc, its own place,
  // the direction of its zero and its radius. The chain runs outwards (from the disc's centre
  // through the main handle, then from each handle to the next); a circle's zero is at right
  // angles to it, so that neither marked place points back at the handle before, and a small disc
  // hangs beyond the handle before it, so as not to cover it.
  const ORBIT = [34, 25, 19], SDISC = [30, 24, 19], QDISC = 66;
  function stepPlaces(E) {
    const out = [], d = E.st.d;
    let anchor = [DR * d.rho * Math.cos(d.psi), -DR * d.rho * Math.sin(d.psi)], way = d.rho > 1e-6 ? d.psi : Math.PI / 2;
    const at = (C, R, a, r) => [C[0] + R * r * Math.cos(a), C[1] - R * r * Math.sin(a)];
    E.chain.steps.forEach((step, i) => {
      const s = E.st.s[i];
      if (step.kind === 'quad') {
        const pos = at([0, 0], QDISC, s.d.psi, s.d.rho);
        out.push({ kind: 'quad', anchor: [0, 0], centre: [0, 0], pos, zero: 0, R: QDISC });
        anchor = pos;
        if (s.d.rho > 1e-6) way = s.d.psi;
      } else if (step.kind === 'circle') {
        const R = ORBIT[Math.min(i, 2)], zero = way + Math.PI / 2, pos = at(anchor, R, zero + s.a, 1);
        out.push({ kind: 'circle', anchor, centre: anchor, pos, zero, R });
        anchor = pos;
        way = zero + s.a;
      } else {
        const R = SDISC[Math.min(i, 2)], centre = at(anchor, R + 9, way, 1), pos = at(centre, R, way + s.d.psi, s.d.rho);
        out.push({ kind: 'disc', anchor, centre, pos, zero: way, R });
        anchor = pos;
        if (s.d.rho > 1e-6) way += s.d.psi;
      }
    });
    return out;
  }
  const ORD = ['fourth', 'fifth', 'sixth'];
  // the editor's small handles over the disc: first what they hang on (under the main handle), then
  // the handles themselves (over it)
  function drawChain(svg, E, front, focusStep) {
    const places = stepPlaces(E);
    places.forEach((P, i) => {
      const s = E.st.s[i], j = i + 3, curvy = P.kind === 'circle' && HS.structure(E.chain.dual.slice(0, j)).curvilinear;
      if (front) { drawStepHandle(svg, P, s, i, curvy, focusStep); return; }
      if (P.kind === 'circle') {
        el('circle', { class: 'ed-orbit', cx: P.anchor[0], cy: P.anchor[1], r: P.R }, svg);
        // where the step adds nothing to the curve, and where the point leaves it (or the two pure extensions)
        for (const a of [0, Math.PI]) el('circle', { class: 'ed-mark', cx: P.anchor[0] + P.R * Math.cos(P.zero + a), cy: P.anchor[1] - P.R * Math.sin(P.zero + a), r: 2.6 }, svg);
      } else {
        el('line', { class: 'ed-stick', x1: P.anchor[0], y1: P.anchor[1], x2: P.centre[0], y2: P.centre[1] }, svg);
        el('circle', { class: 'ed-disc', cx: P.centre[0], cy: P.centre[1], r: P.R }, svg);
        // the squares on the dashed circle; the marks (each on the rim twice, its opposite points
        // being one), which hold the handle: after m² ∂x², ∂y² and ∂x∂y, else the centre and two more
        if (P.kind === 'quad') el('circle', { class: 'ed-conic', cx: 0, cy: 0, r: P.R * Math.SQRT1_2 }, svg);
        for (const [r, a0] of (P.kind === 'quad' ? [] : [[0, 0]]).concat(HS.MARKS[P.kind])) {
          for (const a of r === 1 ? [a0, a0 + Math.PI] : [a0]) el('circle', { class: 'ed-mark', cx: P.centre[0] + P.R * r * Math.cos(P.zero + a), cy: P.centre[1] - P.R * r * Math.sin(P.zero + a), r: 2.6 }, svg);
        }
        // near the rim, the handle's mirror image beyond the opposite rim point
        if (s.d.rho > 0.8) {
          const f = Math.min(1, (s.d.rho - 0.8) / 0.2), a = (P.kind === 'quad' ? 0 : P.zero) + s.d.psi + Math.PI;
          const g = [P.centre[0] + P.R * (2 - s.d.rho) * Math.cos(a), P.centre[1] - P.R * (2 - s.d.rho) * Math.sin(a)];
          el('line', { class: 'dc-link', x1: P.pos[0], y1: P.pos[1], x2: g[0], y2: g[1], style: 'opacity:' + (0.25 + 0.5 * f).toFixed(2) }, svg);
          // (it can be dragged too: the same point, seen across the rim)
          const gg = el('g', { class: 'dc-ghost draggable', 'data-step': i }, svg);
          el('circle', { class: 'hs-pad', cx: g[0], cy: g[1], r: 10 }, gg);
          el('circle', { class: 'handle-point', cx: g[0], cy: g[1], r: 4.5, style: 'opacity:' + (0.25 + 0.3 * f).toFixed(2) }, gg);
        }
      }
      if (P.kind === 'circle') el('line', { class: 'ed-stick', x1: P.anchor[0], y1: P.anchor[1], x2: P.pos[0], y2: P.pos[1] }, svg);
    });
  }
  function drawStepHandle(svg, P, s, i, curvy, focusStep) {
    {
      if (hideHandles) return;
      const what = 'The ' + ORD[i] + ' point';
      const label = P.kind === 'circle'
        ? (curvy ? (Math.abs(s.a - Math.PI) < 1e-9 ? what + ': it leaves the curve' : what + ': the next coefficient of the curve, ' + plainNum(Math.tan(s.a / 2))) : what + ': ' + Math.round(s.a / DEG) + '° round')
        : P.kind === 'quad' ? what + ': the second-order condition, ' + quadText(s.d) : what + ': in its disc, ' + (s.d.rho < 1e-6 ? 'at the centre' : 'at ' + plainNum(s.d.rho) + ', ' + Math.round(s.d.psi / DEG) + '°');
      const h = el('g', { class: 'ed-handle draggable', tabindex: 0, 'data-step': i, role: P.kind === 'circle' ? 'slider' : 'button', 'aria-label': label + '. Arrow keys move it.' }, svg);
      if (P.kind === 'circle') { h.setAttribute('aria-valuemin', '0'); h.setAttribute('aria-valuemax', '360'); h.setAttribute('aria-valuenow', String(Math.round(s.a / DEG))); }
      el('circle', { class: 'hs-pad', cx: P.pos[0], cy: P.pos[1], r: 11 }, h);
      el('circle', { class: 'focus-ring', cx: P.pos[0], cy: P.pos[1], r: 8 }, h);
      el('circle', { class: 'handle-point', cx: P.pos[0], cy: P.pos[1], r: 4.8 }, h);
      if (focusStep === String(i)) h.focus({ preventScroll: true });
    }
  }
  // the D after m², in words: a square, the Laplacian, or two lines (or none)
  function quadText(q) {
    if (q.rho < 1e-6) return 'the Laplacian';
    if (Math.abs(q.rho - Math.SQRT1_2) < 1e-9) return 'a square';
    return q.rho > Math.SQRT1_2 ? 'two real lines' : 'no real lines';
  }
  // A point of a disc whose opposite rim points are the same, from (x, y) in its radius, held by its
  // special points when near: within tol.pt of its centre or a mark ([ρ, ψ], HS.MARKS; a rim mark
  // stands also for its opposite), within tol.line of its rim or of the circle of radius ring.
  // Past the rim (and clear of it) it comes back in on the opposite side.
  const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function discPoint(x, y, tol, marks, ring) {
    const near = (px, py) => {
      let best = null, bd = tol.pt;
      for (const [mr, ma] of [[0, 0]].concat(marks)) {
        for (const a of mr === 1 ? [ma, ma > 0 ? ma - Math.PI : ma + Math.PI] : [ma]) {
          const d = Math.hypot(px - mr * Math.cos(a), py - mr * Math.sin(a));
          if (d < bd) { bd = d; best = { rho: mr, psi: mr ? a : 0 }; }
        }
      }
      return best;
    };
    // (a rim mark first from where the pointer is, so that the handle stays on its side)
    let hit = near(x, y), r = Math.hypot(x, y), psi = Math.atan2(y, x);
    if (hit) return hit;
    if (Math.abs(r - 1) < tol.line) return { rho: 1, psi };
    if (r > 1) {
      r = Math.max(0, 2 - r);
      psi = norm(psi + Math.PI);
      if ((hit = near(r * Math.cos(psi), r * Math.sin(psi)))) return hit;
    }
    if (ring && Math.abs(r - ring) < tol.line) r = ring;
    return r < 1e-9 ? { rho: 0, psi: 0 } : { rho: Math.min(1, r), psi };
  }
  // how near holds, in a disc of radius R (in the units of an svg with upp of them to a pixel): a
  // few pixels, more under a finger, and never so far that the places held run into each other
  // (or leave little room between two circles, as after m²: the squares, and the rim)
  function holdTol(e, upp, R) {
    const k = (e && e.pointerType === 'touch' ? 1.6 : 1) * upp / R;
    return { pt: Math.min(0.3, HOLD_PT * k), line: Math.min(0.07, HOLD_LINE * k) };
  }
  // for the arrow keys, a step of `by` in a disc's radius: less than a step, so that the next one leaves
  const keyTol = (by) => ({ pt: 0.6 * by, line: 0.6 * by });
  // the angle a on a circle round (0, 0) of radius R from (dx, dy), held by the marks HS.MARKS.circle
  // (measured from zero) when the pointer is within `hold` of the line through one, and at most 20°
  function circleAngle(dx, dy, zero, R, hold) {
    const ang = Math.atan2(dy, dx), r = Math.max(R, Math.hypot(dx, dy));
    for (const m of HS.MARKS.circle) {
      const d = norm(ang - zero - m);
      if (Math.abs(d) < 20 * DEG && r * Math.abs(Math.sin(d)) < hold) return m;
    }
    const a = ang - zero;
    return ((a % TAU) + TAU) % TAU;
  }

  // Dragging the editor's handles: the main one (the triple point, in the disc) or a small one; the
  // picture's place on the screen is taken when a drag starts, so that the page moving under it
  // does not move the handle. The special points hold a handle when near.
  function wireEditor(svg) {
    let ref = null;
    const local = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX + (window.scrollX - ref.sx);
      pt.y = e.clientY + (window.scrollY - ref.sy) - (pinned - ref.pin);
      return pt.matrixTransform(ref.ctm);
    };
    function stateAt(c, step, q, e) {
      const E = editorOf(c), st = { d: E.st.d, s: E.st.s.map((x) => ({ a: x.a, d: { rho: x.d.rho, psi: x.d.psi } })) };
      const upp = Math.hypot(ref.ctm.a, ref.ctm.b);
      if (step < 0) {
        const p = discPoint(q.x / DR, -q.y / DR, holdTol(e, upp, DR), HS.MARKS.triple), was = st.d;
        st.d = p;
        // into m²: the fourth point's D is where the curve's goes, ∂_θ∂_⊥ (∂_θ² when it had left the curve)
        if (st.s.length && was.rho >= 0.02 && p.rho < 0.02) {
          const th = was.psi - Math.PI / 2, off = Math.abs(st.s[0].a - Math.PI) < 1e-9;
          st.s[0].d = off ? { rho: Math.SQRT1_2, psi: norm(2 * th) } : { rho: 1, psi: norm(2 * th + Math.PI / 2) };
        }
        return st;
      }
      const P = ref.places[step], s = st.s[step], dx = q.x - P.centre[0], dy = -(q.y - P.centre[1]);
      if (P.kind === 'circle') s.a = circleAngle(dx, dy, P.zero, P.R, HOLD_TURN * (e && e.pointerType === 'touch' ? 1.6 : 1) * upp);
      else {
        // (the quad's dashed circle holds it too: the squares)
        const rot = P.kind === 'quad' ? 0 : P.zero, u = (dx * Math.cos(rot) + dy * Math.sin(rot)) / P.R, v = (-dx * Math.sin(rot) + dy * Math.cos(rot)) / P.R;
        s.d = discPoint(u, v, holdTol(e, upp, P.R), HS.MARKS[P.kind], P.kind === 'quad' ? Math.SQRT1_2 : 0);
      }
      return st;
    }
    svg.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      const c = state.menu !== null ? byId(state.menu) : null;
      if (!c) return;
      e.preventDefault();
      const h = e.target.closest('[data-step]');
      ref = { id: e.pointerId, ctm: svg.getScreenCTM().inverse(), sx: window.scrollX, sy: window.scrollY, pin: pinned, step: h ? +h.dataset.step : -1, places: len(c) > 3 ? stepPlaces(editorOf(c)) : [] };
      record();
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
      // (the handle itself takes the focus, when the drag starts on its mirror image too)
      const f = ref.step >= 0 ? svg.querySelector('.ed-handle[data-step="' + ref.step + '"]') : svg.querySelector('.dc-handle');
      if (f) f.focus({ preventScroll: true });
      setEditor(c, stateAt(c, ref.step, local(e), e));
      changed();
    });
    svg.addEventListener('pointermove', (e) => {
      if (!ref || ref.id !== e.pointerId) return;
      const c = state.menu !== null ? byId(state.menu) : null;
      if (!c) return;
      setEditor(c, stateAt(c, ref.step, local(e), e));
      changed();
    });
    const end = (e) => { if (ref && ref.id === e.pointerId) { ref = null; changed(true); } };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('keydown', (e) => {
      const a = ARROWS[e.key], h = e.target.closest('.dc-handle, .ed-handle');
      const c = state.menu !== null ? byId(state.menu) : null;
      if (!a || !h || !c) return;
      e.preventDefault();
      const E = editorOf(c), st = { d: E.st.d, s: E.st.s.map((x) => ({ a: x.a, d: { rho: x.d.rho, psi: x.d.psi } })) };
      const step = h.dataset.step !== undefined ? +h.dataset.step : -1, by = e.shiftKey ? 0.01 : 0.05;
      // a disc's point moved on the screen by the arrow, in the disc's own turn, held by its marks
      const nudge = (p, rot, marks, ring) => {
        const u = p.rho * Math.cos(p.psi) + by * (a[0] * Math.cos(rot) + a[1] * Math.sin(rot));
        const v = p.rho * Math.sin(p.psi) + by * (-a[0] * Math.sin(rot) + a[1] * Math.cos(rot));
        return discPoint(u, v, keyTol(by), marks, ring);
      };
      if (step < 0) st.d = nudge(st.d, 0, HS.MARKS.triple);
      else {
        const P = stepPlaces(E)[step], s = st.s[step];
        if (P.kind === 'circle') {
          // a few degrees round, stopping at the two marks on the way
          const dir = a[0] || a[1], to = s.a + dir * (e.shiftKey ? 1 : 5) * DEG, stop = (dir > 0 ? Math.floor : Math.ceil)(to / Math.PI) * Math.PI;
          s.a = ((((stop - s.a) * dir > 1e-9 ? stop : to) % TAU) + TAU) % TAU;
        } else s.d = nudge(s.d, P.kind === 'quad' ? 0 : P.zero, HS.MARKS[P.kind], P.kind === 'quad' ? Math.SQRT1_2 : 0);
      }
      record('e' + c.id + ':' + step);
      setEditor(c, st);
      changed(true);
    });
  }

  /* ---------- the readouts: name, legend, the ideal ---------- */

  const lengths = () => cur().map(len).sort((a, b) => b - a);
  const isMonomialAtOrigin = () => cur().length === 1 && cur()[0].p[0] === 0 && cur()[0].p[1] === 0 && cur()[0].recipe.base.mono && !cur()[0].recipe.merges.length;

  function titleText() {
    const ks = lengths(), counts = new Map();
    for (const k of ks) counts.set(k, (counts.get(k) || 0) + 1);
    const parts = [...counts].map(([k, m]) => {
      const noun = k === 1 ? 'point' : k === 2 ? 'double point' : k === 3 ? 'triple point' : 'point of multiplicity ' + k;
      const plural = k === 1 ? 'points' : k === 2 ? 'double points' : k === 3 ? 'triple points' : 'points of multiplicity ' + k;
      return m === 1 ? (ks.length === 1 && k === 1 ? 'One point' : 'a ' + noun) : COUNT[m] + ' ' + plural;
    });
    const s = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function subText() {
    const n = model.n;
    if (isMonomialAtOrigin()) return 'The monomial ideal of the partition $(' + cur()[0].recipe.base.mono.join(',') + ')$ at the origin, fixed by the torus: a point of $\\Hilb^{' + n + '}(\\CC^2)$.';
    const ks = lengths();
    if (ks[0] === 1) return 'Their ideal is a point of $\\Hilb^{' + n + '}(\\CC^2)$' + (n > 1 ? ', over $' + n + '$ distinct points of $\\Sym^{' + n + '}(\\CC^2)$.' : '.');
    const local = cur().filter((c) => len(c) > 1).map((c) => {
      const st = HS.structure(c.dual);
      if (len(c) === 3 && !st.curvilinear) return 'the triple point is $\\mathfrak m^2$, with every direction';
      if (!st.curvilinear) return 'the point of multiplicity ' + len(c) + ' is not curvilinear';
      return null;
    }).filter(Boolean);
    return 'A point of $\\Hilb^{' + n + '}(\\CC^2)$' + (local.length ? '; ' + local.join('; ') : '') + '.';
  }
  function legendHTML() {
    const key = (svg) => '<svg class="hs-key" viewBox="0 0 22 16" aria-hidden="true">' + svg + '</svg>';
    const item = (mark, text) => '<span class="legend-item">' + mark + text + '</span>';
    let s = item(key('<circle class="handle-point" cx="11" cy="8" r="5"/>'), 'a point');
    const fat = cur().filter((c) => len(c) > 1);
    if (fat.length) s += item(key('<circle class="handle-point" cx="11" cy="8" r="7"/><text class="handle-num" x="11" y="11.3">2</text>'), 'a point with multiplicity');
    if (fat.some((c) => HS.structure(c.dual).curvilinear)) s += item(key('<path class="hs-germ" d="M2 12Q11 1 20 6"/>'), 'the curve along which its points collided');
    s += item(key('<path d="M1 13C7 3 13 3 21 9" style="stroke: var(--curve-0); stroke-width: 2.2"/><path d="M1 4C8 14 14 12 21 3" style="stroke: var(--curve-1); stroke-width: 2.2"/>'),
      'curves cut out by the generators of $I$');
    return s;
  }
  // the limit of the ideal as t → 0 under the torus: the terms of greatest weight of its generators
  function limitGens() {
    const key = HS.weightKey(weight());
    return model.gens.map((g) => g.terms.filter((tm) => Math.abs(key(tm.m) - key(g.lead)) < 1e-12));
  }
  function limitText() {
    const L = limitGens(), mono = L.every((t) => t.length === 1);
    return '$\\init_w(I)=(' + L.map((t) => expand(t)).join(',\\ ') + ')$' + (mono ? ', a monomial ideal' : ', not monomial');
  }
  // the fibre of Hilb^n → Sym^n through the ideal: the product of the spaces of points of each
  // multiplicity at one place; with a link to the text when it says why (double points, a triple point)
  function fibreText() {
    const ks = lengths().filter((k) => k > 1), why = '<br><a class="hs-how" href="#sec-collide">Why</a>';
    if (!ks.length) return 'a point';
    const dim = ks.reduce((s, k) => s + k - 1, 0);
    if (ks.every((k) => k === 2)) return (ks.length === 1 ? '$\\PP^1$, the directions' : '$' + ks.map(() => '\\PP^1').join('\\times') + '$') + why;
    if (ks.length === 1 && ks[0] === 3) return 'the triple points at one place, of dimension 2' + why;
    return 'of dimension ' + dim;
  }

  const formulaEl = $('formula');
  let genButtons = [], shownGens = '';
  function drawFormula() {
    const texts = model.gens.map((g) => texPoly(g.terms));
    const sig = texts.join('|');
    if (sig !== shownGens) {
      shownGens = sig;
      formulaEl.textContent = '';
      const open = document.createElement('span');
      MM.setHTML(open, '$I=\\bigl($');
      formulaEl.appendChild(open);
      genButtons = model.gens.map((g, i) => {
        if (i) {
          const comma = document.createElement('span');
          MM.setHTML(comma, '$,\\:$');
          formulaEl.appendChild(comma);
          formulaEl.appendChild(document.createElement('wbr'));
        }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hs-gen';
        b.style.setProperty('--c', 'var(--' + genColor(i) + ')');
        MM.setHTML(b, '$' + texts[i] + '$');
        b.setAttribute('aria-label', 'The generator ' + texPoly(g.terms, true) + ', with leading term ' + plainMono(g.lead) + '; picks out its curve');
        b.addEventListener('click', () => { state.pick = state.pick === g.key ? null : g.key; changed(true); });
        formulaEl.appendChild(b);
        return b;
      });
      const close = document.createElement('span');
      MM.setHTML(close, '$\\bigr)$');
      formulaEl.appendChild(close);
    }
    model.gens.forEach((g, i) => { if (genButtons[i]) genButtons[i].setAttribute('aria-pressed', String(state.pick === g.key)); });
  }

  /* ---------- the staircase and the weight ---------- */

  const stair = $('stair');
  const ST = { c: 30, pad: 26 };
  function stairGeom() {
    const n = model.n, E = n + 1, c = ST.c, rd = E * c + 20;
    const ox = ST.pad + 6, oy = 18 + rd;
    return { n, E, c, rd, ox, oy, W: ox + rd + 34, H: oy + ST.pad };
  }
  function drawStair() {
    const G = stairGeom(), { c, ox, oy, rd } = G;
    const active = document.activeElement, hadFocus = active && stair.contains(active);
    stair.textContent = '';
    // at its own size, a box 30 pixels wide whatever n (narrower only where the column is)
    stair.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    stair.setAttribute('width', G.W);
    stair.setAttribute('height', G.H);
    const P = (a, b) => [ox + a * c, oy - b * c];
    // the quarter of the plane of exponents, with the dial of weights round it
    el('path', { class: 'st-axis', d: 'M' + (ox + rd) + ' ' + oy + 'H' + ox + 'V' + (oy - rd) }, stair);
    el('path', { class: 'st-dial', d: 'M' + (ox + rd) + ' ' + oy + 'A' + rd + ' ' + rd + ' 0 0 0 ' + ox + ' ' + (oy - rd) }, stair);
    const ax = el('text', { class: 'st-axis-name', x: ox + rd - 4, y: oy + 16, 'text-anchor': 'middle' }, stair);
    MM.svgLabel(ax, '$x$');
    const ay = el('text', { class: 'st-axis-name', x: ox - 12, y: oy - rd + 8, 'text-anchor': 'middle' }, stair);
    MM.svgLabel(ay, '$y$');
    // the walls: weights where the initial ideal is not monomial
    for (const wl of model.F.walls) {
      const a = Math.atan2(wl.w[1], wl.w[0]);
      const p1 = [ox + (rd - 6) * Math.cos(a), oy - (rd - 6) * Math.sin(a)], p2 = [ox + (rd + 6) * Math.cos(a), oy - (rd + 6) * Math.sin(a)];
      el('line', { class: 'st-wall', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] }, stair);
    }
    // the weight: an arrow from the origin to its handle on the dial, under the boxes
    const a = wAngle() * DEG, hx = ox + rd * Math.cos(a), hy = oy - rd * Math.sin(a);
    el('line', { class: 'st-w', x1: ox, y1: oy, x2: ox + (rd - 9) * Math.cos(a), y2: oy - (rd - 9) * Math.sin(a) }, stair);
    // the standard monomials
    for (const m of model.I.stair) {
      const [x, y] = P(m[0], m[1] + 1);
      el('rect', { class: 'st-box', x, y, width: c, height: c }, stair);
      const t = el('text', { class: 'st-text', x: x + c / 2, y: y + c / 2 + 4.5 }, stair);
      MM.svgLabel(t, '$' + (texMono(m) || '1') + '$');
    }
    // the corners: the leading terms of the generators, in their colours
    model.gens.forEach((g) => {
      const [x, y] = P(g.lead[0], g.lead[1] + 1), col = 'var(--' + genColor(g.idx) + ')';
      el('rect', { class: 'st-corner', x: x + 2, y: y + 2, width: c - 4, height: c - 4, style: 'stroke:' + col }, stair);
      const t = el('text', { class: 'st-text', x: x + c / 2, y: y + c / 2 + 4.5, style: 'fill:' + col }, stair);
      MM.svgLabel(t, '$' + texMono(g.lead) + '$');
    });
    // its handle: the weight itself, part of the picture (so Save image keeps it, and offers no
    // choice to leave it out)
    const h = el('g', { class: 'st-handle draggable', tabindex: 0, role: 'button', 'aria-label': 'The weight w = ' + wText(true) + ', at ' + Math.round(wAngle()) + '° from the x axis. Arrow keys turn it.' }, stair);
    el('circle', { class: 'hs-pad', cx: hx, cy: hy, r: 14 }, h);
    el('circle', { class: 'focus-ring', cx: hx, cy: hy, r: 10 }, h);
    el('circle', { class: 'handle-point', cx: hx, cy: hy, r: 6.5 }, h);
    const wn = el('text', { class: 'st-wname', x: hx + 13 * Math.cos(a) + 2, y: hy - 13 * Math.sin(a) + 4 }, stair);
    MM.svgLabel(wn, '$w$');
    if (hadFocus) h.focus({ preventScroll: true });
  }
  // the weight as (1, w2/w1), or as integers on a wall
  function wText(plain) {
    const w = weight();
    if (state.wall) return plain ? '(' + w[0] + ', ' + w[1] + ')' : '(' + w[0] + ',\\,' + w[1] + ')';
    const r = w[1] / w[0];
    return plain ? '(1, ' + plainNum(r) + ')' : '(1,\\,' + texNum(r) + ')';
  }
  function stairCaption() {
    const onWall = state.wall && model.F.walls.some((x) => x.w[0] === state.wall[0] && x.w[1] === state.wall[1]);
    return 'The coloured boxes are the leading terms of the generators. The solid boxes are monomials not in $I$ that form a basis of $\\CC[x,y]/I$, chosen to have the least weight for $w=' + wText() + '$, where $x^ay^b$ weighs $w_1a+w_2b$.'
      + (model.F.walls.length ? ' The ticks on the dial are the weights at which two terms of a generator weigh the same' + (onWall ? '; $w$ is on one.' : '.') : '');
  }
  // dragging the handle round the dial, snapped to the walls
  function setAngle(deg) {
    deg = clamp(deg, 1, 89);
    let best = null, bd = WALL_SNAP / DEG;
    for (const wl of model.F.walls) {
      const d = Math.abs(Math.atan2(wl.w[1], wl.w[0]) / DEG - deg);
      if (d < bd) { bd = d; best = wl.w.slice(); }
    }
    state.wall = best;
    state.phi = best ? Math.atan2(best[1], best[0]) / DEG : deg;
  }
  // The handle is dragged round the dial. The ideal above it may take more lines as the order
  // changes, moving the picture: the drag keeps to where the picture was when it started, and the
  // readouts only grow meanwhile (lock).
  let dial = null;
  function dialAngle(e) {
    const G = stairGeom(), pt = stair.createSVGPoint();
    pt.x = e.clientX + (window.scrollX - dial.sx);
    pt.y = e.clientY + (window.scrollY - dial.sy) - (pinned - dial.pin);
    const q = pt.matrixTransform(dial.ctm);
    return Math.atan2(G.oy - q.y, q.x - G.ox) / DEG;
  }
  stair.addEventListener('pointerdown', (e) => {
    if (e.button || !e.target.closest('.st-handle')) return;
    e.preventDefault();
    dial = { id: e.pointerId, ctm: stair.getScreenCTM().inverse(), sx: window.scrollX, sy: window.scrollY, pin: pinned };
    lock('dial');
    try { stair.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
    e.target.closest('.st-handle').focus({ preventScroll: true });
  });
  stair.addEventListener('pointermove', (e) => {
    if (!dial || dial.id !== e.pointerId) return;
    setAngle(dialAngle(e));
    changed();
  });
  const endDial = (e) => {
    if (!dial || dial.id !== e.pointerId) return;
    dial = null;
    unlock('dial');
    changed(true);
  };
  stair.addEventListener('pointerup', endDial);
  stair.addEventListener('pointercancel', endDial);
  stair.addEventListener('keydown', (e) => {
    if (!e.target.closest('.st-handle')) return;
    const step = { ArrowRight: -1, ArrowDown: -1, ArrowLeft: 1, ArrowUp: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    // one degree at a time; a wall is a stop of its own
    const now = wAngle(), walls = model.F.walls.map((x) => Math.atan2(x.w[1], x.w[0]) / DEG);
    const next = walls.filter((a) => (step > 0 ? a > now + 1e-6 && a < now + 1 + 1e-6 : a < now - 1e-6 && a > now - 1 - 1e-6));
    if (next.length) {
      const a = step > 0 ? Math.min(...next) : Math.max(...next), wl = model.F.walls.find((x) => Math.abs(Math.atan2(x.w[1], x.w[0]) / DEG - a) < 1e-9);
      state.wall = wl.w.slice();
      state.phi = a;
    } else {
      state.wall = null;
      state.phi = clamp(Math.round(now + step), 1, 89);
    }
    changed(true);
  });

  /* ---------- the strip of monomial ideals ---------- */

  // (one stop for Tab, the arrow keys along it: MM.strip)
  const stripEl = $('strip'), strip = MM.strip(stripEl, { pick: (b) => loadMonomial(b.dataset.lam.split('.').map(Number)) });
  let stripFor = 0;
  function buildStrip() {
    const n = state.n;
    stripFor = n;
    stripEl.textContent = '';
    const parts = HS.partitions(n), byRows = new Map();
    for (const lam of parts) { const r = lam.length; if (!byRows.has(r)) byRows.set(r, []); byRows.get(r).push(lam); }
    [...byRows.keys()].sort((a, b) => a - b).forEach((r) => {
      const group = document.createElement('div');
      group.className = 'strip-group';
      for (const lam of byRows.get(r)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'strip-item hs-mini';
        b.dataset.lam = lam.join('.');
        const cm = 8, w = lam[0] * cm, h = lam.length * cm;
        const svg = el('svg', { width: w + 2, height: h + 2, viewBox: '-1 -1 ' + (w + 2) + ' ' + (h + 2), 'aria-hidden': 'true' });
        lam.forEach((len2, j) => { for (let i = 0; i < len2; i++) el('rect', { x: i * cm, y: h - (j + 1) * cm, width: cm, height: cm }, svg); });
        b.appendChild(svg);
        const gens = HS.corners([].concat(...lam.map((l2, j) => Array.from({ length: l2 }, (_, i) => [i, j])))).map(plainMono);
        b.setAttribute('aria-label', 'The monomial ideal (' + gens.join(', ') + ')');
        b.title = '(' + gens.join(', ') + ')';
        group.appendChild(b);
      }
      stripEl.appendChild(group);
    });
  }
  function drawStrip() {
    if (stripFor !== state.n) buildStrip();
    const mono = isMonomialAtOrigin() ? cur()[0].recipe.base.mono.join('.') : null, lim = model.lam.join('.');
    let on = null;
    for (const b of stripEl.querySelectorAll('.strip-item')) {
      if (b.dataset.lam === mono) on = b;
      b.classList.toggle('is-limit', b.dataset.lam === lim);
    }
    strip.light(on);
  }
  function loadMonomial(lam) {
    record();
    state.cases[state.n] = [makeCluster([0, 0], { base: { mono: lam.slice() }, merges: [] })];
    state.pick = null;
    state.sel.clear();
    closeMenu(false);
    changed(true);
  }

  /* ---------- the monomials in order, and multiplication on the staircase (the first section) ---------- */

  // The monomials row by row, as in the staircase (row b: the monomials x^a y^b), from the top: in
  // each row the kept ones (grey, under a bracket: not in I), then the monomial that ends the row,
  // the leading term of a generator (dashed, in its colour, with a small picture of its curve through
  // the points beside it) or a multiple of one (dotted); the top row is y to the number of rows,
  // a leading term. One SVG, the small pictures canvases over it placed in proportion, so that the
  // figure narrows as a whole where the column is narrow (and Save image takes both).
  const stepsEl = $('steps'), stepsSvg = $('steps-svg'), stepsList = $('steps-list');
  let shownOrder = '';
  const orderBuffer = { cv: document.createElement('canvas'), ctx: null, img: null };
  orderBuffer.ctx = orderBuffer.cv.getContext('2d');
  const keyOf = (m) => m[0] + ',' + m[1];
  const MONO_H = 34, PLOT = 84;
  function drawOrder() {
    const n = model.n, lam = model.lam, R = lam.length;
    const leads = new Map(model.gens.map((g) => [keyOf(g.lead), g]));
    const sig = lam.join('.') + '|' + model.gens.map((g) => g.key + ':' + g.idx).join(';');
    if (sig !== shownOrder) {
      shownOrder = sig;
      stepsSvg.textContent = '';
      for (const cv of stepsEl.querySelectorAll('canvas')) cv.remove();
      stepsList.textContent = '';
      const rows = [];
      for (let b = R; b >= 0; b--) {
        const k = b < R ? lam[b] : 0, end = [k, b];
        rows.push({ kept: Array.from({ length: k }, (_, a) => [a, b]), end, g: leads.get(keyOf(end)) || null });
      }
      // the names first, measured (in the page): every box as wide as the widest
      const names = new Map();
      let bw = 38;
      for (const r of rows) for (const m of r.kept.concat([r.end])) {
        const t = el('text', { class: 'hs-mtext', x: 0, y: 0 }, stepsSvg);
        MM.svgLabel(t, '$' + (texMono(m) || '1') + '$');
        names.set(keyOf(m), t);
        try { bw = Math.max(bw, Math.ceil(t.getBBox().width) + 16); } catch (err) { /* not laid out */ }
      }
      const probe = el('text', { class: 'hs-ntext', x: 0, y: 0 }, stepsSvg);
      MM.svgLabel(probe, 'not in $I$');
      let nw = 52;
      try { nw = probe.getBBox().width; } catch (err) { /* not laid out */ }
      probe.remove();
      const step = bw + 6, ox = Math.max(1, Math.ceil((nw - bw) / 2) + 1), plots = [];
      const box = (m, x, y, kind, col) => {
        const t = names.get(keyOf(m));
        t.setAttribute('x', x + bw / 2);
        t.setAttribute('y', y + MONO_H / 2 + 5.5);
        if (kind) t.classList.add(kind);
        const rc = el('rect', { class: 'hs-mbox' + (kind ? ' ' + kind : ''), x: x + 0.75, y: y + 0.75, width: bw - 1.5, height: MONO_H - 1.5, rx: 4 });
        stepsSvg.insertBefore(rc, t);
        if (col) { rc.style.stroke = col; t.style.fill = col; }
      };
      let y = 1, W = 0;
      for (const r of rows) {
        const k = r.kept.length, ex = ox + r.end[0] * step;
        r.kept.forEach((m) => box(m, ox + m[0] * step, y, ''));
        box(r.end, ex, y, r.g ? 'is-lead' : 'is-multiple', r.g ? 'var(--' + genColor(r.g.idx) + ')' : null);
        if (k) {
          // the bracket under the kept ones, and its label
          const x0 = ox + 3, x1 = ox + (k - 1) * step + bw - 3, y0 = y + MONO_H + 4, y1 = y + MONO_H + 9;
          el('path', { class: 'hs-bracket', d: 'M' + x0 + ' ' + y0 + 'V' + (y1 - 2) + 'Q' + x0 + ' ' + y1 + ' ' + (x0 + 2) + ' ' + y1 + 'H' + (x1 - 2) + 'Q' + x1 + ' ' + y1 + ' ' + x1 + ' ' + (y1 - 2) + 'V' + y0 }, stepsSvg);
          const t = el('text', { class: 'hs-ntext', x: (x0 + x1) / 2, y: y + MONO_H + 25 }, stepsSvg);
          MM.svgLabel(t, 'not in $I$');
        }
        let right = ex + bw;
        if (r.g) { plots.push({ g: r.g, x: right + 8, y }); right += 8 + PLOT; }
        W = Math.max(W, right + 1, ox + ((k ? (k - 1) * step + bw : 0) + nw) / 2 + 1);
        y += Math.max(k ? MONO_H + 30 : MONO_H, r.g ? PLOT : 0) + 12;
        const li = document.createElement('li');
        li.textContent = (k ? r.kept.map(plainMono).join(', ') + ': not in I; then ' : '') + plainMono(r.end) + (r.g ? ': the leading term of the generator ' + texPoly(r.g.terms, true) : ': a multiple of a leading term');
        stepsList.appendChild(li);
      }
      const H = y - 12 + 1;
      W = Math.ceil(W);
      stepsSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      stepsSvg.setAttribute('width', W);
      stepsSvg.setAttribute('height', H);
      stepsEl.style.width = W + 'px';
      for (const p of plots) {
        const cv = document.createElement('canvas');
        cv.setAttribute('aria-hidden', 'true');
        cv.dataset.gen = p.g.key;
        Object.assign(cv.style, { left: (100 * p.x / W) + '%', top: (100 * p.y / H) + '%', width: (100 * PLOT / W) + '%', height: (100 * PLOT / H) + '%' });
        stepsEl.appendChild(cv);
      }
    }
    for (const cv of stepsEl.querySelectorAll('canvas')) {
      const g = model.gens.find((h) => h.key === cv.dataset.gen);
      if (g) miniPlane(cv, g);
    }
    MM.setHTML($('steps-cap'), 'The monomials as in the staircase, and the generators of $I$ plotted next to their leading terms.');
    // the shape of a row or a column of a staircase
    let note = '';
    const row = (v) => (n <= 4 ? Array.from({ length: n }, (_, i) => (i ? v + (i > 1 ? '^{' + i + '}' : '') : '1')).join(',') : '1,' + v + ',\\dots,' + v + '^{' + (n - 1) + '}');
    if (n > 1 && lam.length === 1) note = 'Here the staircase is $' + row('x') + '$, and $I=\\bigl(b(x),\\,y-a(x)\\bigr)$: $b(x)$ vanishes at the $x$-coordinates of the points, with their multiplicities, and $y=a(x)$ is the curve of degree less than $' + n + '$ through the points.';
    else if (n > 1 && lam.every((x) => x === 1)) note = 'Here the staircase is $' + row('y') + '$, and $I=\\bigl(b(y),\\,x-a(y)\\bigr)$: $b(y)$ vanishes at the $y$-coordinates of the points, with their multiplicities, and $x=a(y)$ is the curve of degree less than $' + n + '$ through the points.';
    else note = 'When the points have distinct $x$-coordinates and $w_2>(n-1)w_1$, the staircase is $1,x,\\dots,x^{n-1}$ and $I=\\bigl(b(x),\\,y-a(x)\\bigr)$, with $b(x)=\\prod_i(x-x_i)$ and $y=a(x)$ the curve of degree less than $n$ through the points.';
    MM.setHTML($('shape-note'), note);
  }
  // the points and one generator's curve, small
  function miniPlane(cv, g) {
    const W = cv.getBoundingClientRect().width || PLOT, v = viewOf(W, W), c2 = MM.fitCanvas(cv, W, W).ctx;
    // a rounded square, drawn in the canvas (so that Save image takes it too)
    const frame = () => {
      const a = 0.5, b = W - 0.5, r = 4;
      c2.beginPath();
      c2.moveTo(a + r, a); c2.arcTo(b, a, b, b, r); c2.arcTo(b, b, a, b, r); c2.arcTo(a, b, a, a, r); c2.arcTo(a, a, b, a, r);
      c2.closePath();
    };
    c2.save();
    frame();
    c2.clip();
    MM.clearCanvas(c2, MM.color('surface'));
    c2.strokeStyle = MM.color('rule');
    c2.lineWidth = 1;
    const X0 = Math.round(v.X(0)) + 0.5, Y0 = Math.round(v.Y(0)) + 0.5;
    c2.beginPath(); c2.moveTo(X0, 0); c2.lineTo(X0, W); c2.moveTo(0, Y0); c2.lineTo(W, Y0); c2.stroke();
    curves(c2, v, [{ terms: g.float, rgb: rgbOf(curveColor(g.idx)), alpha: 1, width: 1.8 }], orderBuffer);
    for (const c of cur()) {
      c2.beginPath();
      c2.arc(v.X(c.p[0] / 100), v.Y(c.p[1] / 100), len(c) > 1 ? 3.6 : 2.6, 0, TAU);
      c2.fillStyle = MM.color('handle');
      c2.fill();
      c2.lineWidth = 1;
      c2.strokeStyle = MM.color('accent-2-strong');
      c2.stroke();
    }
    c2.restore();
    frame();
    c2.lineWidth = 1;
    c2.strokeStyle = MM.color('rule-2');
    c2.stroke();
  }

  // Multiplication by x and by y on the basis of the staircase: an arrow from each box one step
  // right (x) and one step up (y), to a box, or to a monomial outside the staircase (dashed; a
  // leading term in its generator's colour), which can be chosen to show what it is in C[x,y]/I.
  const multSvg = $('mult');
  function drawMult() {
    const I = model.I, has = new Set(I.stair.map(keyOf)), leads = new Map(model.gens.map((g) => [keyOf(g.lead), g]));
    const outs = [], seen = new Set();
    for (const s of I.stair) for (const t of [[s[0] + 1, s[1]], [s[0], s[1] + 1]]) { const k = keyOf(t); if (!has.has(k) && !seen.has(k)) { seen.add(k); outs.push(t); } }
    outs.sort((m1, m2) => m1[1] - m2[1] || m1[0] - m2[0]);
    if (!state.out || !seen.has(state.out)) state.out = keyOf(outs.find((t) => leads.has(keyOf(t))) || outs[0]);
    const active = document.activeElement, hadFocus = active && multSvg.contains(active);
    const c = 44, pad = 24, cols = Math.max(...outs.map((t) => t[0])) + 1, rows = Math.max(...outs.map((t) => t[1])) + 1;
    const W = cols * c + 2 * pad, H = rows * c + 2 * pad;
    multSvg.textContent = '';
    multSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    multSvg.setAttribute('width', W);
    multSvg.setAttribute('height', H);
    const P = (m) => [pad + m[0] * c, H - pad - (m[1] + 1) * c], mid = (m) => { const [x, y] = P(m); return [x + c / 2, y + c / 2]; };
    for (const m of I.stair) {
      const [x, y] = P(m);
      el('rect', { class: 'st-box', x, y, width: c, height: c }, multSvg);
      MM.svgLabel(el('text', { class: 'ml-text', x: x + c / 2, y: y + c / 2 + 5 }, multSvg), '$' + (texMono(m) || '1') + '$');
    }
    for (const m of outs) {
      const [x, y] = P(m), k = keyOf(m), g = leads.get(k), picked = state.out === k;
      const r = el('rect', { class: 'ml-out' + (g ? ' ml-lead' : '') + (picked ? ' is-picked' : ''), x: x + 2, y: y + 2, width: c - 4, height: c - 4, tabindex: picked ? 0 : -1, role: 'button', 'data-key': k, 'aria-pressed': String(picked), 'aria-label': plainMono(m) + (g ? ', a leading term' : '') + ', outside the staircase: shows what it is modulo I' }, multSvg);
      if (g) r.style.stroke = 'var(--' + genColor(g.idx) + ')';
      r.addEventListener('click', () => { state.out = k; drawMult(); });
      MM.svgLabel(el('text', { class: 'ml-text is-out', x: x + c / 2, y: y + c / 2 + 5 }, multSvg), '$' + texMono(m) + '$');
    }
    // the arrows, from each box to where x and y take it
    for (const s of I.stair) for (const t of [[s[0] + 1, s[1]], [s[0], s[1] + 1]]) {
      const a = mid(s), b = mid(t), u = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
      const p0 = [a[0] + u[0] * c * 0.3, a[1] + u[1] * c * 0.3], p1 = [b[0] - u[0] * c * 0.36, b[1] - u[1] * c * 0.36];
      el('line', { class: 'ml-arrow', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] }, multSvg);
      const tip = [p1[0] + u[0] * 4, p1[1] + u[1] * 4], back = (sg) => [tip[0] - u[0] * 7 + sg * u[1] * 3.5, tip[1] - u[1] * 7 - sg * u[0] * 3.5];
      el('path', { class: 'ml-head', d: 'M' + tip.join(' ') + 'L' + back(1).join(' ') + 'L' + back(-1).join(' ') + 'Z' }, multSvg);
    }
    if (hadFocus) { const f = multSvg.querySelector('[data-key="' + state.out + '"]'); if (f) f.focus({ preventScroll: true }); }
    // what the chosen monomial is in C[x,y]/I
    const m = state.out.split(',').map(Number), z = I.nf(m), cmp = HS.compare(weight());
    const terms = I.stair.map((st, r) => ({ m: st, c: z[r] })).filter((t) => !Q.isZero(t.c)).sort((t1, t2) => cmp(t2.m, t1.m));
    const from = I.stair.filter((st) => (st[0] + 1 === m[0] && st[1] === m[1]) || (st[0] === m[0] && st[1] + 1 === m[1]))
      .map((st) => (st[0] + 1 === m[0] ? 'x' : 'y') + '\\cdot ' + (texMono(st) || '1'));
    MM.setHTML($('mult-cap'), 'Arrows to the right multiply by $x$, arrows up by $y$. $' + texMono(m) + '=' + from.join('=') + '$, and in $\\CC[x,y]/I$ it is '
      + (terms.length ? '$' + expand(terms) + '$.' : '$0$: it lies in $I$.'));
  }
  multSvg.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || !e.target.closest('.ml-out')) return;
    e.preventDefault();
    const list = [...multSvg.querySelectorAll('.ml-out')].map((r) => r.dataset.key), i = list.indexOf(state.out);
    state.out = list[(i + step + list.length) % list.length];
    drawMult();
  });

  /* ---------- the triple points at one place (the second section) ---------- */

  const disc = $('disc'), germSvg = $('germ');
  const DR = 100; // the disc's radius in its own units
  // the triple point the disc in the text shows: the first of the configuration, if any
  const discCluster = () => cur().find((c) => len(c) === 3);
  function discPos() {
    const c = discCluster();
    return c ? HS.discOfTriple(c.dual) : state.disc;
  }
  // The real triple points at one place, as a disc whose opposite rim points are the same, with
  // a dot at p = { rho, psi }; near the rim, the dot's mirror image across the opposite rim point,
  // outside the disc, joined to it through the centre. Its fixed points and the curves of the
  // torus are marked, and named unless small. With an editor E (a point of multiplicity four or
  // more), its small handles over it.
  function discPicture(svg, p, small, E) {
    const active = document.activeElement, hadFocus = active && svg.contains(active) && active.classList.contains('dc-handle');
    const focusStep = active && svg.contains(active) && active.dataset && active.dataset.step !== undefined ? active.dataset.step : null;
    svg.textContent = '';
    const mx = E ? 62 : small ? 50 : 66, my = E ? 62 : 50;
    svg.setAttribute('viewBox', (-DR - mx) + ' ' + (-DR - my) + ' ' + (2 * DR + 2 * mx) + ' ' + (2 * DR + 2 * my));
    el('circle', { class: 'dc-disc', cx: 0, cy: 0, r: DR }, svg);
    // the curves the torus keeps: the straight germs (the rim) and the germs along the axes (the diameters)
    el('line', { class: 'dc-curve', x1: -DR, y1: 0, x2: DR, y2: 0 }, svg);
    el('line', { class: 'dc-curve', x1: 0, y1: -DR, x2: 0, y2: DR }, svg);
    // its fixed points: m² at the centre, (y, x³) and (x, y³) on the rim (each twice: the rim's opposite points are one)
    const fixed = [[0, 0, '$\\mathfrak m^2$', 12, 17, 'start'], [0, -DR, '$(y,x^3)$', 0, -11, 'middle'], [0, DR, '$(y,x^3)$', 0, 22, 'middle'],
      [DR, 0, '$(x,y^3)$', 9, 4.5, 'start'], [-DR, 0, '$(x,y^3)$', -9, 4.5, 'end']];
    for (const [x, y, name, dx, dy, anchor] of fixed) {
      el('circle', { class: 'dc-fixed', cx: x, cy: y, r: small ? 5 : 3.6 }, svg);
      if (small) continue;
      const t = el('text', { class: 'dc-label', x: x + dx, y: y + dy, 'text-anchor': anchor }, svg);
      MM.svgLabel(t, name);
    }
    const X = DR * p.rho * Math.cos(p.psi), Y = -DR * p.rho * Math.sin(p.psi), r = small ? 9 : 6.5;
    if (p.rho > 0.55) {
      // the same point seen across the rim: at 2 − ρ, on the other side
      const f = Math.min(1, (p.rho - 0.55) / 0.45), gx = -DR * (2 - p.rho) * Math.cos(p.psi), gy = DR * (2 - p.rho) * Math.sin(p.psi);
      el('line', { class: 'dc-link', x1: X, y1: Y, x2: gx, y2: gy, style: 'opacity:' + (0.25 + 0.5 * f).toFixed(2) }, svg);
      // (it can be dragged too: the same point, seen across the rim)
      const gh = el('g', { class: 'dc-ghost draggable' }, svg);
      el('circle', { class: 'hs-pad', cx: gx, cy: gy, r: r + 8 }, gh);
      el('circle', { class: 'handle-point', cx: gx, cy: gy, r, style: 'opacity:' + (0.25 + 0.3 * f).toFixed(2) }, gh);
    }
    if (E) drawChain(svg, E, false, focusStep);
    const h = el('g', { class: 'dc-handle draggable', tabindex: 0, role: 'button', 'aria-label': (E ? 'Its triple point: ' : 'The triple point: ') + discText(p, true) + '. Arrow keys move it.' }, svg);
    el('circle', { class: 'hs-pad', cx: X, cy: Y, r: r + 8 }, h);
    el('circle', { class: 'focus-ring', cx: X, cy: Y, r: r + 4 }, h);
    el('circle', { class: 'handle-point', cx: X, cy: Y, r }, h);
    if (hadFocus) h.focus({ preventScroll: true });
    if (E) drawChain(svg, E, true, focusStep);
  }
  // dragging the dot of a disc (the picture's place on the screen taken when the drag starts, so
  // that the page moving under it does not move the dot), and the arrow keys
  function wireDisc(svg, target) {
    let ref = null;
    // past the rim the dot comes back in across the disc, on the opposite side; the fixed points
    // and the rim hold it when near
    const at = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX + (window.scrollX - ref.sx);
      pt.y = e.clientY + (window.scrollY - ref.sy);
      const q = pt.matrixTransform(ref.ctm);
      return discPoint(q.x / DR, -q.y / DR, holdTol(e, Math.hypot(ref.ctm.a, ref.ctm.b), DR), HS.MARKS.triple);
    };
    const set = (p) => {
      const c = target();
      if (c) build(c, discRecipe(p));
      else if (svg === disc) state.disc = p;
      changed();
    };
    svg.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.preventDefault();
      if (target()) record();
      ref = { id: e.pointerId, ctm: svg.getScreenCTM().inverse(), sx: window.scrollX, sy: window.scrollY };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
      const h = svg.querySelector('.dc-handle');
      if (h) h.focus({ preventScroll: true });
      set(at(e));
    });
    svg.addEventListener('pointermove', (e) => { if (ref && ref.id === e.pointerId) set(at(e)); });
    const end = (e) => { if (ref && ref.id === e.pointerId) { ref = null; changed(true); } };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('keydown', (e) => {
      const a = ARROWS[e.key];
      if (!a || !e.target.closest('.dc-handle')) return;
      e.preventDefault();
      const c = target(), p = c ? HS.discOfTriple(c.dual) : state.disc, step = e.shiftKey ? 0.01 : 0.05;
      if (c) record('d' + c.id);
      set(discPoint(p.rho * Math.cos(p.psi) + a[0] * step, p.rho * Math.sin(p.psi) + a[1] * step, keyTol(step), HS.MARKS.triple));
      changed(true);
    });
  }
  wireDisc(disc, discCluster);
  // When the configuration has a triple point, the disc changes it, in the figure at the top, by
  // then out of view: beside the disc, a copy of that figure, its curves and its points.
  const copyPlane = MM.copyPicture($('plane-copy'), [canvas, stage]);
  function drawDisc() {
    const p = discPos();
    discPicture(disc, p, false);
    drawGerm(p);
    const c = discCluster();
    $('plane-copy').hidden = !c;
    if (c) copyPlane();
    MM.setHTML($('disc-cap'), (c ? 'The triple point at $(' + texNum(c.p[0] / 100) + ',\\,' + texNum(c.p[1] / 100) + ')$' : 'A triple point at the origin') + ': ' + discText(p) + '.');
  }
  // the germ the disc's point stands for, and its ideal at the origin
  function discText(p, plain) {
    if (p.rho < 0.02) return plain ? 'm squared, every direction' : '$\\mathfrak m^2=(x^2,xy,y^2)$, from every direction';
    // as a graph over its tangent: y = h(x) for a tangent nearer the x-axis, x = h(y) for one nearer the y-axis
    const steep = Math.abs(Math.cos(p.psi)) > Math.SQRT1_2;
    const J = HS.ideal([{ p: [0, 0], dual: discDual(p) }], steep ? [10, 1] : [1, 10]);
    // the curve's equation first; in coordinates at the triple point, so no factors to take out
    const txt = J.gens.slice().sort((a, b) => a.lead[0] + a.lead[1] - b.lead[0] - b.lead[1]).map((g) => expand(g.terms, plain)).join(plain ? ', ' : ',\\ ');
    const R = p.rho / (1 - p.rho), kind = p.rho > 0.995 ? 'straight' : 'curved, of radius ' + (plain ? plainNum(R) : '$' + texNum(R) + '$');
    return plain ? kind + ', the ideal (' + txt + ')' : kind + ', $(' + txt + ')$';
  }
  function discRecipe(p) {
    if (p.rho < 0.02) return { base: { mono: [2, 1] }, merges: [] };
    const kappa = p.rho > 0.995 ? 0 : (1 - p.rho) / p.rho;
    const ang = Math.round((p.psi - Math.PI / 2) / DEG * 100) / 100 * DEG;
    return { base: { germ: [3, ang, [Math.round(kappa / 2 * 1e4) / 1e4]] }, merges: [] };
  }
  const discDual = (p) => build({}, discRecipe(p)).dual;
  function drawGerm(p) {
    germSvg.textContent = '';
    const S = 90;
    germSvg.setAttribute('viewBox', (-S) + ' ' + (-S) + ' ' + (2 * S) + ' ' + (2 * S));
    el('line', { class: 'gm-axis', x1: -S, y1: 0, x2: S, y2: 0 }, germSvg);
    el('line', { class: 'gm-axis', x1: 0, y1: -S, x2: 0, y2: S }, germSvg);
    const v = { k: 60, X: (x) => x * 60, Y: (y) => -y * 60 };
    if (p.rho < 0.02) {
      el('circle', { class: 'gm-ring', cx: 0, cy: 0, r: 26 }, germSvg);
    } else {
      const kappa = p.rho > 0.995 ? 0 : (1 - p.rho) / p.rho;
      const path = germPath({ p: [0, 0] }, v, { angle: p.psi - Math.PI / 2, g: [kappa / 2] }, 70);
      el('path', { class: 'gm-curve', d: pathD(path.minus.concat([path.centre], path.plus)) }, germSvg);
    }
    el('circle', { class: 'handle-point', cx: 0, cy: 0, r: 7 }, germSvg);
    el('text', { class: 'handle-num', x: 0, y: 3.8 }, germSvg).textContent = '3';
  }

  /* ---------- the flow to the origin (the third section) ---------- */

  const flowCv = $('flow'), fctx = flowCv.getContext('2d');
  const flowBuffer = { cv: document.createElement('canvas'), ctx: null, img: null };
  flowBuffer.ctx = flowBuffer.cv.getContext('2d');
  function drawFlow() {
    const W = flowCv.clientWidth, H = flowCv.clientHeight;
    if (!W) return;
    // the weight scaled so that its smaller part is 1: the points move as (t^{w1} x, t^{w2} y)
    const v = viewOf(W, H), t = 1 - state.tau, w0 = weight(), w = w0.map((x) => x / Math.min(w0[0], w0[1]));
    MM.clearCanvas(fctx, MM.color('surface'));
    grid(fctx, v);
    // the generators of I_t: each term scaled by t to the weight it lacks from the leading term's
    const key = HS.weightKey(w);
    const polys = model.gens.map((g) => {
      const top = key(g.lead);
      const terms = g.float.map((tm) => {
        const e = top - key([tm.a, tm.b]);
        return { a: tm.a, b: tm.b, c: e < 1e-12 ? tm.c : t > 0 ? tm.c * Math.pow(t, e) : 0 };
      }).filter((tm) => tm.c !== 0);
      return { terms, rgb: rgbOf(curveColor(g.idx)), alpha: 1, width: 2.2 };
    });
    curves(fctx, v, polys, flowBuffer);
    // the paths of the points to the origin, and the points at t
    fctx.save();
    fctx.setLineDash([1.5, 3.5]);
    fctx.lineCap = 'round';
    fctx.strokeStyle = MM.color('ink-3');
    fctx.lineWidth = 1.3;
    for (const c of cur()) {
      const P = [c.p[0] / 100, c.p[1] / 100];
      fctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const s = 1 - i / 80, X = v.X(P[0] * Math.pow(s, w[0])), Y = v.Y(P[1] * Math.pow(s, w[1]));
        if (i) fctx.lineTo(X, Y); else fctx.moveTo(X, Y);
      }
      fctx.stroke();
    }
    fctx.restore();
    const dots = t > 0 ? cur().map((c) => ({ p: [c.p[0] / 100 * Math.pow(t, w[0]), c.p[1] / 100 * Math.pow(t, w[1])], k: len(c) })) : [{ p: [0, 0], k: model.n }];
    for (const d of dots) {
      const X = v.X(d.p[0]), Y = v.Y(d.p[1]), r = d.k > 1 ? RF : R;
      fctx.beginPath();
      fctx.arc(X, Y, r, 0, TAU);
      fctx.fillStyle = MM.color('handle');
      fctx.fill();
      fctx.lineWidth = 1.3;
      fctx.strokeStyle = MM.color('accent-2-strong');
      fctx.stroke();
      if (d.k > 1) {
        fctx.fillStyle = MM.color('ink');
        fctx.font = MM.font('mono', 11, 600);
        fctx.textAlign = 'center';
        fctx.fillText(String(d.k), X, Y + 3.8);
      }
    }
    // the limit
    const mono = limitGens().every((tm) => tm.length === 1);
    MM.setHTML($('flow-cap'), 'At $t=' + texNum(Math.round(t * 100) / 100) + '$. The limit as $t\\to0$ is ' + limitText().replace(/, (a monomial ideal|not monomial)$/, '') + (mono ? ', a monomial ideal.' : ', not monomial, since $w$ is on a tick.'));
  }
  // the slider runs from t = 1 to t = 0, and shows t
  const flowSlider = $('flow-t');
  const showT = () => { if (flowSlider.show) flowSlider.show((1 - state.tau).toFixed(2)); };
  let flowPending = 0;
  flowSlider.addEventListener('input', (e) => {
    state.tau = +e.target.value;
    showT();
    if (!flowPending) flowPending = requestAnimationFrame(() => { flowPending = 0; drawFlow(); });
    setTimeout(() => { if (flowPending) { cancelAnimationFrame(flowPending); flowPending = 0; drawFlow(); } }, 60);
  });

  /* ---------- the tangent space at the fixed point (the fourth section) ---------- */

  // The partition is the one of the fixed point the ideal flows to, until one is chosen in the row
  // above the figure (that one shaded, as in the strip); a new n goes back to it.
  const young = $('young'), tpick = $('tpick');
  let tpickFor = 0;
  function buildTPick(n) {
    tpickFor = n;
    tpick.textContent = '';
    for (const lam of HS.partitions(n)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'strip-item hs-mini';
      b.dataset.lam = lam.join('.');
      b.appendChild(miniDiagram(lam, 8));
      b.setAttribute('aria-label', 'The fixed point of the partition (' + lam.join(', ') + ')');
      b.title = '(' + lam.join(', ') + ')';
      b.addEventListener('click', () => { state.tlam = lam.join() === model.lam.join() ? null : lam.slice(); drawYoung(); });
      tpick.appendChild(b);
    }
  }
  function drawYoung() {
    const n = model.n, c = 52, own = state.tlam && state.tlam.reduce((a, b) => a + b, 0) === n && state.tlam.join() !== model.lam.join();
    const lam = own ? state.tlam : model.lam;
    if (tpickFor !== n) buildTPick(n);
    for (const b of tpick.querySelectorAll('.hs-mini')) {
      b.setAttribute('aria-pressed', String(b.dataset.lam === lam.join('.')));
      b.classList.toggle('is-limit', b.dataset.lam === model.lam.join('.'));
    }
    if (!(state.box[1] < lam.length && state.box[0] < lam[state.box[1]])) state.box = [0, 0];
    const [bi, bj] = state.box, { arm, leg } = HS.armLeg(lam, bi, bj);
    const Wd = (lam[0] + 1) * c + 72, Hd = (lam.length + 1.6) * c + 44, ox = 36, oy = Hd - 30;
    const active = document.activeElement, focusKey = active && young.contains(active) ? active.dataset.key : null;
    young.textContent = '';
    young.setAttribute('viewBox', '0 0 ' + Wd + ' ' + Hd);
    young.setAttribute('width', Wd);
    young.setAttribute('height', Hd);
    const P = (i, j) => [ox + i * c, oy - (j + 1) * c];
    // the cells just outside, where the arrows start
    const outA = [bi + arm + 1, bj], outL = [bi, bj + leg + 1];
    for (const [i, j] of [outA, outL]) { const [x, y] = P(i, j); el('rect', { class: 'yg-out', x, y, width: c, height: c }, young); }
    lam.forEach((l2, j) => {
      for (let i = 0; i < l2; i++) {
        const [x, y] = P(i, j);
        const cls = 'yg-box' + (i === bi && j === bj ? ' is-picked' : j === bj && i > bi ? ' is-arm' : i === bi && j > bj ? ' is-leg' : '');
        const r = el('rect', { class: cls, x, y, width: c, height: c, tabindex: i === bi && j === bj ? 0 : -1, role: 'button', 'data-key': i + ',' + j, 'aria-label': 'The box ' + plainMono([i, j]) + ': arm ' + HS.armLeg(lam, i, j).arm + ', leg ' + HS.armLeg(lam, i, j).leg, 'aria-pressed': String(i === bi && j === bj) }, young);
        r.addEventListener('click', () => { state.box = [i, j]; drawYoung(); });
        const t = el('text', { class: 'yg-text', x: x + c / 2, y: y + c / 2 + 5 }, young);
        MM.svgLabel(t, '$' + (texMono([i, j]) || '1') + '$');
      }
    });
    // the two weights, as arrows: from just past the arm to the top of the leg, and from just past
    // the leg to the end of the arm, each bowed to the right of its way, ending at its box; each
    // weight right by the arrow's tail, on the side away from the diagram and from the way the
    // arrow leaves (right of the tail past the arm, above the one past the leg), so that it never
    // covers a box, whatever the shape
    const centre = (i, j) => { const [x, y] = P(i, j); return [x + c / 2, y + c / 2]; };
    const arrow = (from, to, w, beyond) => {
      const a = centre(...from), b = centre(...to), dx = b[0] - a[0], dy = b[1] - a[1];
      const m = [(a[0] + b[0]) / 2 + 0.25 * dy, (a[1] + b[1]) / 2 - 0.25 * dx];
      const q = (u) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * m[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * m[1] + u * u * b[1]];
      const inside = (pt) => Math.hypot(pt[0] - b[0], pt[1] - b[1]) < c * 0.3;
      const pts = [];
      for (let k = 0; k <= 80; k++) { const pt = q(k / 80); if (k > 8 && inside(pt)) break; pts.push(pt); }
      el('path', { class: 'yg-arrow', d: pathD(pts) }, young);
      const e1 = pts[pts.length - 1], e0 = pts[pts.length - 3], ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]);
      const tip = [e1[0] + 4 * Math.cos(ang), e1[1] + 4 * Math.sin(ang)], back = (sgn) => [tip[0] - 9 * Math.cos(ang) + sgn * 4.5 * Math.sin(ang), tip[1] - 9 * Math.sin(ang) - sgn * 4.5 * Math.cos(ang)];
      el('path', { class: 'yg-arrowhead', d: 'M' + tip.join(' ') + 'L' + back(1).join(' ') + 'L' + back(-1).join(' ') + 'Z' }, young);
      const t = el('text', beyond === 'right' ? { class: 'yg-weight halo', x: a[0] + 8, y: a[1] + 5, 'text-anchor': 'start' } : { class: 'yg-weight halo', x: a[0], y: a[1] - 10, 'text-anchor': 'middle' }, young);
      MM.svgLabel(t, '$(' + w[0] + ',' + w[1] + ')$');
    };
    arrow(outA, [bi, bj + leg], [-arm - 1, leg], 'right');
    arrow(outL, [bi + arm, bj], [arm, -leg - 1], 'up');
    if (focusKey) { const again = young.querySelector('[data-key="' + focusKey + '"]'); if (again) again.focus({ preventScroll: true }); }
    MM.setHTML($('young-cap'), (own ? 'The fixed point $I_\\lambda$, $\\lambda=(' + lam.join(',') + ')$ ($I$ flows to the one shaded above).' : 'The fixed point $I_\\lambda$ that $I$ flows to, $\\lambda=(' + lam.join(',') + ')$.') + ' The box $' + (texMono([bi, bj]) || '1') + '$ has arm $' + arm + '$ and leg $' + leg + '$ (grey) and weights $(' + (-arm - 1) + ',' + leg + ')$ and $(' + arm + ',' + (-leg - 1) + ')$.');
  }
  young.addEventListener('keydown', (e) => {
    const a = ARROWS[e.key];
    if (!a || !e.target.closest('.yg-box')) return;
    e.preventDefault();
    const lam = state.tlam && state.tlam.reduce((x, y) => x + y, 0) === model.n ? state.tlam : model.lam, i = state.box[0] + a[0], j = state.box[1] + a[1];
    if (j >= 0 && j < lam.length && i >= 0 && i < lam[j]) { state.box = [i, j]; drawYoung(); }
  });

  function drawBetti() {
    const b = HS.betti(model.n).map((x, i) => '$b_{' + 2 * i + '}=' + x + '$');
    MM.setHTML($('betti'), 'For $n=' + model.n + '$, ' + (b.length > 1 ? b.slice(0, -1).join(', ') + ' and ' + b[b.length - 1] : b[0]) + '.');
  }

  /* ---------- drawing ---------- */

  // The hints over the picture, one after another, each until the reader has done what it says.
  const TOUCHY = window.matchMedia('(hover: none)').matches;
  const TIPS = [
    'Drop a point on another to collide them; drag it off to pull it out.',
    (TOUCHY ? 'Tap' : 'Click') + ' a point with multiplicity to change it.',
    (TOUCHY ? 'Hold and drag' : 'Shift-drag') + ' to select several points; drag one to move them all.',
  ];
  function tipDone(k) { if (state.tips < k) state.tips = k; }
  function hint() {
    const t = state.tips, el2 = $('drop-hint');
    const show = state.menu === null && (t === 0 ? cur().length > 1 : t === 1 ? cur().some((c) => len(c) > 1) : t === 2 ? cur().length > 1 : false);
    el2.hidden = !show;
    if (show && el2.textContent !== TIPS[t]) el2.textContent = TIPS[t];
  }
  function readouts() {
    MM.setHTML($('title'), titleText());
    MM.setHTML($('sub'), subText());
    MM.setHTML($('legend'), legendHTML());
    drawFormula();
    MM.setHTML($('stair-cap'), stairCaption());
    MM.kv($('about'), [
      ['Limit under the torus', limitText() + '<br><a class="hs-how" href="#sec-torus">How it’s found</a>'],
      ['Fibre of $\\Hilb^{' + model.n + '}\\to\\Sym^{' + model.n + '}$', fibreText()],
    ]);
    MM.setHTML($('strip-h'), 'The monomial ideals in $\\Hilb^{' + model.n + '}(\\CC^2)$, by their number of rows');
  }
  function draw() {
    if (!plane.clientWidth) return;
    const pin = locks.size ? plane.getBoundingClientRect().top : null;
    drawCanvas();
    drawStage();
    readouts();
    drawStair();
    drawStrip();
    drawMenu();
    hint();
    undoButtons.update();
    holdLayout();
    if (pin !== null) {
      const d = plane.getBoundingClientRect().top - pin;
      if (Math.abs(d) >= 1) { const y0 = window.scrollY; window.scrollBy({ top: d, behavior: 'instant' }); pinned += window.scrollY - y0; }
    }
    // the figures in the text, those in view (the others when they come into view), or all of
    // them while Save image is open, which may take any
    const all = document.documentElement.classList.contains('is-dialog-open');
    for (const sec of SECTIONS) { if (sec.seen || all) { sec.dirty = false; sec.draw(); } else sec.dirty = true; }
    if (focusAfter) {
      const again = stage.querySelector('[data-key="' + focusAfter + '"]');
      if (again) again.focus({ preventScroll: true });
      focusAfter = null;
    }
    if (example) example.changed();
  }
  // The figures in the text are drawn while they are in view, or about to be.
  const SECTIONS = [
    { el: $('sec-basis').parentElement, draw: () => { drawOrder(); drawMult(); } },
    { el: $('sec-collide').parentElement, draw: drawDisc },
    { el: $('sec-torus').parentElement, draw: () => { drawFlow(); drawBetti(); } },
    { el: $('sec-tangent').parentElement, draw: drawYoung },
  ];
  for (const sec of SECTIONS) { sec.seen = true; sec.dirty = true; }
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const sec = SECTIONS.find((x) => x.el === e.target);
        sec.seen = e.isIntersecting;
        if (sec.seen && sec.dirty && model && plane.clientWidth) { sec.dirty = false; sec.draw(); }
      }
    }, { rootMargin: '300px 0px' });
    for (const sec of SECTIONS) io.observe(sec.el);
  }
  // at most once a frame (or soon, if frames are not drawn)
  let pending = null;
  function schedule() {
    if (pending) return;
    const run = () => {
      if (!pending) return;
      cancelAnimationFrame(pending.raf);
      clearTimeout(pending.timer);
      pending = null;
      draw();
    };
    pending = { raf: requestAnimationFrame(run), timer: setTimeout(run, 50) };
  }
  // the configuration or the weight has changed: the ideal again, and the picture
  function changed(now) {
    rebuild();
    if (now) { if (pending) { cancelAnimationFrame(pending.raf); clearTimeout(pending.timer); pending = null; } draw(); } else schedule();
  }

  let hideHandles = false;
  function resize(options) {
    hideHandles = !!(options && options.handles === false);
    for (const cv of [canvas, flowCv]) MM.fitCanvas(cv);
    const r = plane.getBoundingClientRect();
    V = viewOf(r.width, r.height);
    draw();
  }

  /* ---------- the controls ---------- */

  $('count').addEventListener('change', (e) => {
    state.n = +e.detail.value;
    state.pick = null;
    state.box = [0, 0];
    state.tlam = null;
    state.sel.clear();
    closeMenu(false);
    changed(true);
  });

  rebuild();
  const ro = new ResizeObserver(() => resize());
  ro.observe(plane);
  ro.observe(flowCv);
  resize();
  MM.onFonts(() => { shownGens = ''; shownOrder = ''; draw(); });
  showT();

  /* ---------- links, reset and Save image ---------- */

  // The clusters as text: "X,Y" and the recipe, the clusters joined by "_". A base is m and a
  // partition, g and a germ (length/angle/coefficients), or e and an editor's state: its disc's
  // ρ/ψ, then each step, a and its angle or d and its disc's ρ/ψ (angles in degrees).
  const r2 = (x) => Math.round(x * 100) / 100, r4 = (x) => Math.round(x * 1e4) / 1e4;
  const NUM = '-?\\d+(?:\\.\\d+)?', BASE = new RegExp('^(m[1-6](?:\\.[1-6])*|g[2-6](?:/' + NUM + ')+|e' + NUM + '/' + NUM + '(?:a' + NUM + '|d' + NUM + '/' + NUM + ')*)$');
  const discOfText = (rho, psiDeg) => ({ rho: Math.abs(rho - Math.SQRT1_2) < 6e-5 ? Math.SQRT1_2 : rho, psi: psiDeg * DEG });
  const clusterCodec = {
    write(list) {
      return list.map((c) => {
        const b = c.recipe.base;
        let s = c.p[0] + ',' + c.p[1];
        if (b.mono) s += 'm' + b.mono.join('.');
        else if (b.germ) s += 'g' + b.germ[0] + '/' + r2(b.germ[1] / DEG) + (b.germ[2].length ? '/' + b.germ[2].join('/') : '');
        else if (b.edit) {
          const st = b.edit, kinds = HS.editDual(3 + st.s.length, st).steps.map((x) => x.kind);
          s += 'e' + r4(st.d.rho) + '/' + r2(st.d.psi / DEG);
          st.s.forEach((x, i) => { s += kinds[i] === 'circle' ? 'a' + r2(x.a / DEG) : 'd' + r4(x.d.rho) + '/' + r2(x.d.psi / DEG); });
        }
        for (const w of c.recipe.merges) s += '~' + w[0] + '/' + w[1];
        return s;
      }).join('_');
    },
    read(text) {
      return text.split('_').map((part) => {
        const m = /^(-?\d+),(-?\d+)([meg][^~]*)?((?:~-?\d+\/-?\d+)*)$/.exec(part);
        if (!m || (m[3] && !BASE.test(m[3]))) throw new Error('not a cluster: ' + part);
        let base = 'p';
        if (m[3] && m[3][0] === 'm') base = { mono: m[3].slice(1).split('.').map(Number) };
        else if (m[3] && m[3][0] === 'g') {
          const v = m[3].slice(1).split('/').map(Number);
          base = { germ: [v[0], v[1] * DEG, v.slice(2)] };
        } else if (m[3]) {
          const [, rho, psi, rest] = /^e([^/]+)\/([^ad]+)(.*)$/.exec(m[3]), steps = [];
          for (const t of rest.match(/[ad][^ad]*/g) || []) {
            if (t[0] === 'a') steps.push({ a: (((+t.slice(1) * DEG) % TAU) + TAU) % TAU, d: { rho: 0, psi: 0 } });
            else { const [r, q] = t.slice(1).split('/').map(Number); steps.push({ a: 0, d: discOfText(r, q) }); }
          }
          base = { edit: { d: discOfText(+rho, +psi), s: steps } };
        }
        const merges = m[4] ? m[4].slice(1).split('~').map((w) => w.split('/').map(Number)) : [];
        return { p: [+m[1], +m[2]], recipe: { base, merges } };
      });
    },
  };
  const weightCodec = {
    write: (x) => (x.wall ? x.wall.join('/') : String(r2(x.phi))),
    read(text) {
      const m = /^(\d+)\/(\d+)$/.exec(text);
      if (m) return { wall: [+m[1], +m[2]], phi: Math.atan2(+m[2], +m[1]) / DEG };
      const v = Number(text);
      if (!Number.isFinite(v)) throw new Error('not a weight: ' + text);
      return { wall: null, phi: v };
    },
  };
  const validPartition = (lam) => lam.every((x, i) => Number.isInteger(x) && x >= 1 && (!i || x <= lam[i - 1]));
  example = MM.example({
    fields: { n: 'int', c: clusterCodec, w: weightCodec },
    get: () => ({ n: state.n, c: cur(), w: { wall: state.wall, phi: state.phi } }),
    set(x, named) {
      if (!Number.isInteger(x.n) || x.n < 1 || x.n > 6) return false;
      let list;
      if (named.has('c')) {
        try {
          list = x.c.map((d) => {
            if (Math.abs(d.p[0]) > SPAN || Math.abs(d.p[1]) > SPAN) throw new Error('outside');
            const b = d.recipe.base;
            if (b.mono && !validPartition(b.mono)) throw new Error('not a partition');
            if (b.germ && (b.germ[2].length !== b.germ[0] - 2 || b.germ[2].some((g) => !Number.isFinite(g) || Math.abs(g) > 1e4))) throw new Error('not a germ');
            if (b.edit && (b.edit.s.length > 3 || [b.edit.d].concat(b.edit.s.map((x) => x.d)).some((q) => !(q.rho >= 0 && q.rho <= 1) || !Number.isFinite(q.psi)) || b.edit.s.some((x) => !Number.isFinite(x.a)))) throw new Error('not a state');
            if (d.recipe.merges.some((w) => !w[0] && !w[1])) throw new Error('no direction');
            return makeCluster(d.p, d.recipe);
          });
          const total = list.reduce((s, c) => s + len(c), 0), places = new Set(list.map((c) => c.p.join(',')));
          if (total !== x.n || places.size !== list.length) return false;
          HS.ideal(list, [1, 1.0001]); // the conditions must be independent
        } catch (err) { return false; }
      } else list = fresh(x.n);
      const w = x.w;
      if (!(w.phi >= 1 && w.phi <= 89) || (w.wall && (w.wall[0] < 1 || w.wall[1] < 1))) return false;
      if (x.n === state.n) record();
      for (let n = 1; n <= 6; n++) {
        state.cases[n] = n === x.n ? list : fresh(n);
        if (n !== x.n || n !== state.n) { hist[n].past.length = 0; hist[n].future.length = 0; }
      }
      Object.assign(state, { n: x.n, wall: w.wall, phi: w.phi, pick: null, box: [0, 0], tau: 0, tlam: null, out: null });
      state.sel.clear();
      closeMenu(false);
      $('count').value = String(x.n);
      $('flow-t').value = '0';
      changed(true);
    },
    pictures: () => [
      { label: 'Points', element: plane },
      { label: 'Staircase', element: stair, selected: false },
      { label: 'Monomials', element: stepsEl, selected: false },
      { label: 'Multiplication', element: multSvg, selected: false },
      { label: 'Triple points', element: disc.parentElement, selected: false },
      { label: 'Flow to the origin', element: flowCv, selected: false },
      { label: 'Tangent weights', element: young, selected: false },
    ],
    redraw: resize,
    // what the pictures show beyond the link: the generator picked in the formula, the points
    // selected (by their place in the list), the flow's t, the box and the partition chosen in
    // the tangent figure, the dot of the disc in the text, and the monomial chosen in the figure
    // of multiplication
    scene: {
      get: () => ({ pick: state.pick, sel: cur().map((c, i) => (state.sel.has(c.id) ? i : -1)).filter((i) => i >= 0), tau: state.tau, box: state.box, tlam: state.tlam, disc: state.disc, out: state.out }),
      set(sc) {
        const mono = (k) => typeof k === 'string' && /^\d+,\d+$/.test(k);
        state.pick = mono(sc.pick) ? sc.pick : null;
        state.sel = new Set((Array.isArray(sc.sel) ? sc.sel : []).map((i) => cur()[i] && cur()[i].id).filter((id) => id !== undefined));
        state.tau = clamp(Number(sc.tau) || 0, 0, 1);
        $('flow-t').value = String(state.tau);
        showT();
        state.box = Array.isArray(sc.box) && sc.box.length === 2 && sc.box.every(Number.isInteger) ? sc.box.slice() : [0, 0];
        state.tlam = Array.isArray(sc.tlam) && sc.tlam.length && validPartition(sc.tlam) ? sc.tlam.slice() : null;
        if (sc.disc && sc.disc.rho >= 0 && sc.disc.rho <= 1 && Number.isFinite(sc.disc.psi)) state.disc = { rho: sc.disc.rho, psi: sc.disc.psi };
        state.out = mono(sc.out) ? sc.out : null;
        changed(true);
      },
    },
  });
  // (a link's example is where Undo starts)
  for (let n = 1; n <= 6; n++) { hist[n].past.length = 0; hist[n].future.length = 0; }
  changed(true);
})();
