// Amoebas and tropical curves: the figure and its readouts.
// The mathematics (roots, the amoeba's slices and the orders of its complement,
// the subdivision and the tropical curve, the area) is in amoeba.js.
//
// The curve is f = Σ a_ij z^i w^j over the lattice points (i, j) of the
// triangle dΔ, with a_ij = ±t^{v_ij}. The main picture is its amoeba in the
// coordinates Log_t = (log|z|, log|w|) / log t, with the tropical curve of the
// heights v. Beside it the polynomial is written out term by term, and edited in
// place: a drag on a term changes its height, a click on its sign the sign; under
// it t, and the height of the term clicked, each with a slider, and beside the
// height a button that takes the term out (its coefficient 0, its height −∞): it
// stays in the formula, grey, as 0 z^i w^j, and a click on it puts it back.
// The text after the figure has two pictures of its own: in "The curve and
// its amoeba", the Newton polygon with each point lifted to its height, the roof
// over them (their upper hull) and, on the floor, the subdivision the roof
// projects to, where dragging a lifted point changes its height; in "Area", the
// area of the amoeba against log t, where dragging the handle changes t. Each
// changes the amoeba at the top of the page, out of view, so each has a small
// copy of it beside it.
//
// The window zooms with <mm-zoom> in the bar (a mouse), by pinching (a touch
// screen or a trackpad) and with + and −. Undo and Redo go back through the
// changes of the curve: its degree, t, the heights, the signs and the terms taken out.
//
// The amoeba is computed roughly at once (a slice every 3 pixels) and then, a
// few slices a frame, at the resolution of the screen, with its area. The area
// against log t is worked out in a worker (worker.js).
(function () {
  'use strict';
  const AM = window.Amoeba;
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d'), plane = $('plane'), zoomEl = $('zoom');
  const liftCv = $('lift-cv'), lctx = liftCv.getContext('2d'), lift = $('lift');
  const TAU = 2 * Math.PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const NAMES = { 1: 'Line', 2: 'Conic', 3: 'Cubic', 4: 'Quartic' };
  const DEGREES = [1, 2, 3, 4];
  const VMIN = -2;                                    // the lowest height: the floor of the lifted picture
  const VMAX = { 1: 3, 2: 4, 3: 6, 4: 8 };            // the highest
  const KH = { 1: 0.8, 2: 0.6, 3: 0.45, 4: 0.34 };    // the lifted picture: lattice units per unit of height
  const S0 = 2.5, SMIN = 0.05, SMAX = 6;              // log t (to the end of the chart of the area)
  const RMIN = 0.5, RMAX = 14;                        // the half-width of the amoeba's window
  const TURN = 30;                                    // the lifted picture turns once round in this many seconds
  const AMOEBA_ALPHA = 0.42;                          // how strongly the amoeba is filled

  // the coefficients of a curve as the page starts it: honeycomb heights (a
  // smooth tropical curve) and Harnack's signs (a curve of the largest area); none
  // taken out, none chosen
  function fresh(d) {
    const v = AM.honeycomb(d, 1);
    return { v, sg: AM.harnackSigns(d), off: v.map(() => false), sel: null };
  }

  // The single source of truth; draw() renders everything from it.
  const state = {
    d: 3,              // the degree: the Newton polygon is the triangle dΔ
    s: S0,             // log t
    cases: {},         // each degree: heights v, signs sg, the terms taken out off, the chosen lattice point sel (or null)
    trop: true,        // the tropical curve is shown
    real: false,       // the real points are shown
    spin: !MM.reduceMotion(), // the lifted picture turns on its own
    frame: null,       // the amoeba's window: {c, R}, its centre and half-width in Log_t units
    panned: false,     // the reader has moved or zoomed the window
    az: 0.25, el: 0.55, // the lifted picture: its turn about the vertical, and the elevation of the eye
                        // (at first i runs to the right and j away, the axes' labels clear of the points)
    hover: null,       // the lattice point pointed at
  };
  for (const d of DEGREES) state.cases[d] = fresh(d);
  const cur = () => state.cases[state.d];

  let example = null; // links, reset and Save image (MM.example, at the end)

  /* ---------- names ---------- */

  const SUP = ['', '', '²', '³', '⁴'];
  const monoPlain = (p) => (p[0] ? 'z' + SUP[p[0]] : '') + (p[1] ? 'w' + SUP[p[1]] : '') || '1';
  const monoTex = (p) => (p[0] ? 'z' + (p[0] > 1 ? '^{' + p[0] + '}' : '') : '') + (p[1] ? 'w' + (p[1] > 1 ? '^{' + p[1] + '}' : '') : '') || '1';
  const round2 = (x) => Math.round(x * 100) / 100;
  const fmt = (x) => { const r = round2(x); return (r < 0 ? '−' : '') + String(Math.abs(r)); };
  const coefPlain = (k) => { const c = cur(), r = round2(c.v[k]); return c.off[k] ? '0' : (c.sg[k] < 0 ? '−' : '') + (r === 0 ? '1' : 't^' + fmt(r)); };

  /* ---------- the curve: its subdivision and tropical curve ---------- */

  // The heights v of the model are the curve's, with −∞ for the terms taken out; its
  // Newton polygon is the hull of the others (`newton`: its corners, area and inside).
  let model = null;
  function rebuild() {
    const d = state.d, pts = AM.triangle(d), c = cur(), v = c.v.map((h, k) => (c.off[k] ? -Infinity : h));
    const sub = AM.subdivision(pts, v), trop = AM.tropical(pts, v, sub), newton = AM.newton(pts, v);
    model = { d, pts, v, sg: c.sg, off: c.off, sub, trop, newton, key: d + ':' + v.join(',') };
    // smooth: the roof's faces are triangles of area 1/2 with no other points on them
    model.smooth = sub.faces.every((f) => f.on.length === 3 && Math.abs(AM.polygonArea(f.poly.map((k) => pts[k]))) === 0.5);
    model.cycles = pts.filter((p, k) => sub.isVertex[k] && newton.inside[k]).length;
    // the degree of the curve: of f divided by the highest z^a w^b that divides it, which is
    // the same curve in (ℂ^×)²; less than d when terms are taken out
    const [a, b] = AM.offset(pts, v);
    model.degree = pts.reduce((m, p, k) => (c.off[k] ? m : Math.max(m, p[0] + p[1])), 0) - a - b;
  }
  const isOff = (k) => cur().off[k];
  // whether the term k can be taken out: the terms left must not lie on a line
  function canTakeOut(k) {
    const v = model.v.slice();
    v[k] = -Infinity;
    return AM.newton(model.pts, v).area > 0;
  }

  /* ---------- the amoeba's window ---------- */

  // how far from the origin the window may reach, so that the sizes of the
  // terms of f stay within what a double can hold
  const yLimit = () => 380 / (state.s * state.d);
  function clampFrame(f) {
    const L = yLimit(), R = clamp(f.R, RMIN, Math.min(RMAX, 0.9 * L));
    return { c: f.c.map((x) => clamp(x, R - L, L - R)), R };
  }
  function tropBox() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of model.trop.vertices) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    return [x0, x1, y0, y1];
  }
  function fit() {
    const [x0, x1, y0, y1] = tropBox(), half = Math.max(x1 - x0, y1 - y0) / 2;
    state.frame = clampFrame({ c: [(x0 + x1) / 2, (y0 + y1) / 2], R: Math.max(2, 1.3 * half + 1.2) });
    state.panned = false;
  }
  // after a change of the heights: refit when a vertex of the tropical curve has left the window
  function keepInView() {
    const f = state.frame, m = 0.92 * f.R;
    if (!model.trop.vertices.some((q) => Math.abs(q[0] - f.c[0]) > m || Math.abs(q[1] - f.c[1]) > m)) return false;
    fit();
    return true;
  }
  function view() {
    const W = canvas.clientWidth, H = canvas.clientHeight, f = state.frame, k = Math.min(W, H) / (2 * f.R);
    return {
      W, H, k,
      X: (x) => W / 2 + (x - f.c[0]) * k, Y: (y) => H / 2 - (y - f.c[1]) * k,
      x: (px) => f.c[0] + (px - W / 2) / k, y: (py) => f.c[1] - (py - H / 2) / k,
    };
  }

  /* ---------- computing the amoeba ---------- */

  let amo = null;                      // the amoeba in view: its grid, slices, orders
  let job = null, fineTimer = 0;       // the computation at full resolution under way
  let area = { key: '', value: null }; // the area, as a fraction of the largest possible
  const amoKey = () => { const f = state.frame; return [model.key, model.sg.join(','), state.s, f.c[0], f.c[1], f.R, canvas.clientWidth, canvas.clientHeight].join('|'); };
  const areaKey = () => [model.key, model.sg.join(','), state.s].join('|');

  // the rows and columns of the slices: every 3 pixels roughly, every device pixel in full
  function grid(level) {
    const V = view(), fine = level === 'fine', dpr = Math.min(2, Math.max(1, MM.pixelRatio()));
    const step = fine ? 1 / dpr : 3;
    const nR = Math.max(2, Math.round(V.H / step)), nC = Math.max(2, Math.round(V.W / step));
    const sy = V.H / nR, sx = V.W / nC, ys = new Float64Array(nR), xs = new Float64Array(nC);
    for (let r = 0; r < nR; r++) ys[r] = V.y((r + 0.5) * sy);
    for (let c = 0; c < nC; c++) xs[c] = V.x((c + 0.5) * sx);
    return { level, V, nR, nC, sy, sx, ys, xs, N: fine ? 256 : 96 };
  }
  function computeNow(level) {
    const g = grid(level), m = model;
    const rows = AM.slices(AM.terms(m.pts, m.v, m.sg, false), state.s, g.ys, g.N, { real: true });
    const cols = AM.slices(AM.terms(m.pts, m.v, m.sg, true), state.s, g.xs, g.N, { real: true });
    settle(g, rows, cols, amoKey());
  }
  function settle(g, rows, cols, key) {
    const o = AM.orders(rows, cols, g.ys, g.xs, model.pts, model.v);
    amo = { key, level: g.level, g, rows, cols, raster: o.raster, seen: o.seen, hl: null };
    paintAmoeba();
  }
  // the slices at ys a batch at a time, so that a long computation can be spread over frames
  function runner(terms, s, ys, N) {
    const n = terms.reduce((m, t) => Math.max(m, t.i), 0), R = ys.length;
    const lo = new Float64Array(R * n), hi = new Float64Array(R * n), real = [];
    let r = 0;
    return {
      done: () => r >= R,
      step(batch) {
        const e = Math.min(R, r + batch), res = AM.slices(terms, s, ys.subarray(r, e), N, { real: true });
        lo.set(res.lo, r * n);
        hi.set(res.hi, r * n);
        for (const x of res.real) real.push(x);
        r = e;
      },
      result: () => ({ n, lo, hi, real }),
    };
  }
  function scheduleFine(delay) {
    clearTimeout(fineTimer);
    if (job) job.cancelled = true;
    job = null;
    fineTimer = setTimeout(startFine, delay === undefined ? 140 : delay);
  }
  function startFine() {
    if (!canvas.clientWidth) return;
    const m = model, key = amoKey(), aKey = areaKey();
    let g = null, rr = null, cr = null, plan = null, ar = null, ac = null;
    if (!(amo && amo.key === key && amo.level === 'fine')) {
      g = grid('fine');
      rr = runner(AM.terms(m.pts, m.v, m.sg, false), state.s, g.ys, g.N);
      cr = runner(AM.terms(m.pts, m.v, m.sg, true), state.s, g.xs, g.N);
    }
    if (area.key !== aKey) {
      plan = AM.areaPlan(m.pts, m.v, m.sg, state.s);
      ar = runner(plan.rowTerms, state.s, plan.ys, plan.N);
      ac = runner(plan.colTerms, state.s, plan.xs, plan.N);
    }
    if (!rr && !ar) return;
    const me = job = { cancelled: false };
    const tick = () => {
      if (me.cancelled) return;
      // a few milliseconds at a time; all at once in a hidden page, whose timers are slowed down
      const t0 = performance.now(), budget = document.hidden ? Infinity : 10;
      while (performance.now() - t0 < budget) {
        const next = [rr, cr, ar, ac].find((x) => x && !x.done());
        if (!next) break;
        next.step(next === rr || next === cr ? 12 : 32);
      }
      if (rr && rr.done() && cr.done()) {
        settle(g, rr.result(), cr.result(), key);
        rr = cr = null;
        draw();
      }
      if (ar && ar.done() && ac.done()) {
        area = { key: aKey, value: AM.areaFrom(plan, ar.result(), ac.result()) };
        ar = ac = null;
        readouts();
      }
      if (rr || ar) setTimeout(tick, 0);
      else if (job === me) job = null;
    };
    setTimeout(tick, 0);
  }
  // the curve, log t or the window has changed: the amoeba again, roughly at
  // once (at most once a frame, or soon if frames are not drawn), in full a
  // moment after the changes stop
  let pending = null;
  function invalidate() {
    if (pending) return;
    const run = () => {
      if (!pending) return;
      cancelAnimationFrame(pending.raf);
      clearTimeout(pending.timer);
      pending = null;
      if (!canvas.clientWidth) return;
      computeNow('coarse');
      scheduleFine();
      draw();
    };
    pending = { raf: requestAnimationFrame(run), timer: setTimeout(run, 60) };
  }

  /* ---------- drawing the amoeba ---------- */

  // The amoeba is painted once per computation, opaque, on a canvas of its own,
  // and laid over the picture with some transparency: each slice of a row or a
  // column is a thin rectangle.
  const amoCv = document.createElement('canvas'), actx = amoCv.getContext('2d');
  function paintAmoeba() {
    if (!amo) return;
    const g = amo.g, V = g.V;
    MM.fitCanvas(amoCv, V.W, V.H);
    actx.fillStyle = MM.color('amoeba');
    const rows = amo.rows, cols = amo.cols;
    for (let r = 0; r < g.nR; r++) {
      for (const I of AM.merged(rows.lo, rows.hi, r * rows.n, rows.n)) {
        const a = Math.max(-2, V.X(I[0])), b = Math.min(V.W + 2, V.X(I[1]));
        if (b > a) actx.fillRect(a, r * g.sy, b - a, g.sy);
      }
    }
    for (let c = 0; c < g.nC; c++) {
      for (const I of AM.merged(cols.lo, cols.hi, c * cols.n, cols.n)) {
        const a = Math.max(-2, V.Y(I[1])), b = Math.min(V.H + 2, V.Y(I[0]));
        if (b > a) actx.fillRect(c * g.sx, a, g.sx, b - a);
      }
    }
  }

  // a token's colour as [r, g, b], for painting pixels
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  function rgbOf(name) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = MM.color(name);
    probe.fillRect(0, 0, 1, 1);
    return Array.from(probe.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }
  // The components of the complement of the selected and the pointed-at
  // coefficient's order, tinted, from the grid of orders.
  const hlCv = document.createElement('canvas'), hctx = hlCv.getContext('2d');
  function highlight() {
    const sel = cur().sel, hov = state.hover, want = sel + ':' + hov;
    if (amo.hl === want) return hlCv;
    const { nR, nC } = amo.g, ras = amo.raster;
    hlCv.width = nC;
    hlCv.height = nR;
    const img = hctx.createImageData(nC, nR), D = img.data, cs = rgbOf('accent-soft'), ch = rgbOf('red-soft');
    for (let q = 0; q < ras.length; q++) {
      const k = ras[q], c = k < 0 ? null : k === hov ? ch : k === sel ? cs : null;
      if (!c) continue;
      D[4 * q] = c[0]; D[4 * q + 1] = c[1]; D[4 * q + 2] = c[2]; D[4 * q + 3] = 255;
    }
    hctx.putImageData(img, 0, 0);
    amo.hl = want;
    return hlCv;
  }

  // a label with a halo of the background round it, where it may cross the amoeba
  function haloLabel(text, x, y, size, color) {
    const bg = MM.color('surface');
    for (const [dx, dy] of [[-1.2, 0], [1.2, 0], [0, -1.2], [0, 1.2], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      MM.canvasLabel(ctx, text, x + dx, y + dy, { size, align: 'center', baseline: 'middle', color: bg });
    }
    MM.canvasLabel(ctx, text, x, y, { size, align: 'center', baseline: 'middle', color });
  }

  function drawAmoeba() {
    const V = view();
    MM.clearCanvas(ctx, MM.color('surface'));
    if (!amo) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(highlight(), 0, 0, V.W, V.H);
    // the axes
    const X0 = V.X(0), Y0 = V.Y(0);
    ctx.strokeStyle = MM.color('rule');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(X0) + 0.5, 0); ctx.lineTo(Math.round(X0) + 0.5, V.H);
    ctx.moveTo(0, Math.round(Y0) + 0.5); ctx.lineTo(V.W, Math.round(Y0) + 0.5);
    ctx.stroke();
    // the amoeba
    ctx.save();
    ctx.globalAlpha = AMOEBA_ALPHA;
    ctx.drawImage(amoCv, 0, 0, V.W, V.H);
    ctx.restore();
    if (state.real) drawReal(V);
    if (state.trop) drawTropical(V);
    drawRegionLabels(V);
    // the axes' names, at their ends
    const lc = MM.color('ink-3');
    if (X0 > 30 && X0 < V.W - 30) MM.canvasLabel(ctx, '$\\log_t|w|$', X0 + 6, 16, { size: 13, color: lc });
    if (Y0 > 24 && Y0 < V.H - 10) MM.canvasLabel(ctx, '$\\log_t|z|$', V.W - 6, Y0 - 7, { size: 13, align: 'right', color: lc });
  }

  // the edges and rays of the tropical curve on c2, through X and Y, each as wide as width(its weight)
  function strokeTropical(c2, X, Y, width) {
    const T = model.trop, f = state.frame;
    c2.save();
    c2.strokeStyle = MM.color('trop');
    c2.lineCap = 'round';
    c2.lineJoin = 'round';
    const seg = (a, b, w) => {
      c2.lineWidth = width(w);
      c2.beginPath();
      c2.moveTo(X(a[0]), Y(a[1]));
      c2.lineTo(X(b[0]), Y(b[1]));
      c2.stroke();
    };
    const far = 4 * (f.R + Math.hypot(f.c[0], f.c[1])) + 10;
    for (const e of T.edges) seg(e.from, e.to, e.weight);
    for (const r of T.rays) seg(r.from, [r.from[0] + r.dir[0] * far, r.from[1] + r.dir[1] * far], r.weight);
    c2.restore();
  }
  function drawTropical(V) {
    const T = model.trop, f = state.frame;
    strokeTropical(ctx, V.X, V.Y, (w) => 1.6 + 1.1 * (w - 1));
    // weights above 1, beside their edges, each in a small ring
    const wc = MM.color('ink');
    const weight = (p, dir, w) => {
      const x = V.X(p[0]) - dir[1] * 15, y = V.Y(p[1]) - dir[0] * 15;
      if (x < 10 || x > V.W - 10 || y < 10 || y > V.H - 10) return;
      ctx.beginPath();
      ctx.arc(x, y, 8.5, 0, TAU);
      ctx.fillStyle = MM.color('surface');
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = MM.color('trop');
      ctx.stroke();
      MM.canvasLabel(ctx, String(w), x, y + 0.5, { size: 11, align: 'center', baseline: 'middle', color: wc });
    };
    for (const e of T.edges) {
      if (e.weight < 2) continue;
      const dx = e.to[0] - e.from[0], dy = e.to[1] - e.from[1], l = Math.hypot(dx, dy) || 1;
      weight([(e.from[0] + e.to[0]) / 2, (e.from[1] + e.to[1]) / 2], [dx / l, dy / l], e.weight);
    }
    for (const r of T.rays) {
      if (r.weight < 2) continue;
      // a little way along the ray, within the window
      let t = 1.2 * f.R / 2;
      for (let q = 0; q < 2; q++) if (r.dir[q]) t = Math.min(t, Math.max(0.2, ((r.dir[q] > 0 ? f.c[q] + f.R : f.c[q] - f.R) - r.from[q]) / r.dir[q] - 0.4));
      weight([r.from[0] + r.dir[0] * t, r.from[1] + r.dir[1] * t], r.dir, r.weight);
    }
  }

  // The copies beside the figures in "The tropical limit" and "Area": the window of the
  // amoeba at the top, at their size, with its tinted components and the tropical curve
  // (shown whatever the bar says: the text is about it), but no labels. The amoeba is not
  // worked out again: its picture is laid in smaller.
  const copies = ['copy-lift', 'copy-area'].map((id) => { const cv = $(id); return { cv, c2: cv.getContext('2d') }; });
  function drawCopy({ cv, c2 }) {
    const w = cv.clientWidth;
    MM.clearCanvas(c2, MM.color('surface'));
    if (!w || !amo) return;
    const V = view(), k = w / V.W, h = V.H * k, X = (x) => V.X(x) * k, Y = (y) => V.Y(y) * k;
    c2.save();
    c2.imageSmoothingEnabled = true;
    c2.drawImage(highlight(), 0, 0, w, h);
    const X0 = Math.round(X(0)) + 0.5, Y0 = Math.round(Y(0)) + 0.5;
    c2.strokeStyle = MM.color('rule');
    c2.lineWidth = 1;
    c2.beginPath();
    c2.moveTo(X0, 0); c2.lineTo(X0, h);
    c2.moveTo(0, Y0); c2.lineTo(w, Y0);
    c2.stroke();
    c2.globalAlpha = AMOEBA_ALPHA;
    c2.drawImage(amoCv, 0, 0, w, h);
    c2.restore();
    strokeTropical(c2, X, Y, (wt) => 1.2 + 0.8 * (wt - 1));
  }

  // the real points: the real roots of the rows at arg w = 0, π and of the columns at arg z = 0, π
  function drawReal(V) {
    const g = amo.g, rad = 1.15;
    ctx.fillStyle = MM.color('real');
    ctx.beginPath();
    for (let r = 0; r < g.nR; r++) {
      const y = (r + 0.5) * g.sy;
      for (const p of amo.rows.real[r]) {
        const x = V.X(p[0]);
        if (x < -2 || x > V.W + 2) continue;
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, TAU);
      }
    }
    for (let c = 0; c < g.nC; c++) {
      const x = (c + 0.5) * g.sx;
      for (const p of amo.cols.real[c]) {
        const y = V.Y(p[0]);
        if (y < -2 || y > V.H + 2) continue;
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, TAU);
      }
    }
    ctx.fill();
  }

  // each monomial that dominates somewhere, named in its region
  function drawRegionLabels(V) {
    const box = [V.x(0), V.x(V.W), V.y(V.H), V.y(0)], { pts, v, sub } = model, sel = cur().sel;
    labelBoxes = [];
    for (let k = 0; k < pts.length; k++) {
      if (!sub.isVertex[k]) continue;
      const poly = AM.region(pts, v, k, box);
      if (poly.length < 3) continue;
      const a = AM.polygonArea(poly);
      if (Math.abs(a) * V.k * V.k < 1600) continue;
      let cx = 0, cy = 0;
      for (let q = 0; q < poly.length; q++) {
        const P = poly[q], Q = poly[(q + 1) % poly.length], w = P[0] * Q[1] - Q[0] * P[1];
        cx += (P[0] + Q[0]) * w;
        cy += (P[1] + Q[1]) * w;
      }
      cx /= 6 * a; cy /= 6 * a;
      const color = k === state.hover ? MM.color('highlight') : k === sel ? MM.color('accent-ink') : MM.color('ink-2');
      const text = '$' + monoTex(pts[k]) + '$', x = V.X(cx), y = V.Y(cy), w = MM.measureLabel(ctx, text, 14);
      haloLabel(text, x, y, 14, color);
      labelBoxes.push({ k, x0: x - w / 2 - 6, x1: x + w / 2 + 6, y0: y - 13, y1: y + 13 });
    }
  }
  let labelBoxes = []; // where the labels of the regions are, to be pointed at

  /* ---------- the lifted Newton polygon ---------- */

  let L = null; // its layout: the size, the scale u (pixels per lattice unit), the origin
  // The axes: the exponents i and j along the two legs of the Newton polygon,
  // numbered just outside them, with their names beside their middles.
  const AX = { tick: 0.42, name: 0.85 };
  // What the picture takes up through a whole turn, in lattice units across and up:
  // the floor, the lifted points (with a little room above for raising them) and the
  // axes' labels.
  const ROOM = 0.4, EL0 = 0.55;
  function liftExtent(d, v, el) {
    const kh = KH[d], se = Math.sin(el), ce = Math.cos(el), Q = [];
    AM.triangle(d).forEach((p, k) => Q.push([p[0], p[1], VMIN], [p[0], p[1], Math.max(v[k], 0) + ROOM]));
    Q.push([d / 2, -AX.name, VMIN], [-AX.name, d / 2, VMIN]);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let q = 0; q < 36; q++) {
      const az = TAU * q / 36, ca = Math.cos(az), sa = Math.sin(az);
      for (const [i, j, h] of Q) {
        const x = i - d / 3, y = j - d / 3, xr = x * ca - y * sa, yr = x * sa + y * ca, up = yr * se + (h - VMIN) * kh * ce;
        x0 = Math.min(x0, xr); x1 = Math.max(x1, xr); y0 = Math.min(y0, up); y1 = Math.max(y1, up);
      }
    }
    return [x0, x1, y0, y1];
  }
  // The canvas has the shape of the picture of the curve's own heights through a whole
  // turn (no taller than 0.9 of its width), so that the picture fills it; it keeps that
  // shape while the heights change.
  function shapeLift() {
    const e = liftExtent(state.d, AM.honeycomb(state.d, 1), EL0);
    liftCv.style.aspectRatio = Math.max(1.1, (e[1] - e[0]) / (e[3] - e[2])).toFixed(3);
  }
  // The scale and the origin fit the picture of the heights in view into the canvas.
  function layoutLift() {
    const W = liftCv.clientWidth, H = liftCv.clientHeight, d = state.d, pad = 14;
    if (!W) { L = null; return; }
    const [x0, x1, y0, y1] = liftExtent(d, cur().v, state.el);
    const u = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
    L = { W, H, u, cx: d / 3, cy: d / 3, ox: W / 2 - u * (x0 + x1) / 2, oy: H / 2 + u * (y0 + y1) / 2 };
  }
  // the projection of the lattice point (i, j) at height v: [x, y, depth towards the eye]
  function liftView() {
    const az = state.az, kh = KH[state.d];
    const ca = Math.cos(az), sa = Math.sin(az), se = Math.sin(state.el), ce = Math.cos(state.el);
    const P = (i, j, v) => {
      const x = i - L.cx, y = j - L.cy, z = (v - VMIN) * kh;
      const xr = x * ca - y * sa, yr = x * sa + y * ca;
      return [L.ox + L.u * xr, L.oy - L.u * (yr * se + z * ce), -yr * ce + z * se];
    };
    return { P, perHeight: L.u * kh * ce };
  }

  let handles = [];
  function buildHandles() {
    for (const h of handles) h.remove();
    handles = model.pts.map((p, k) => {
      const el = document.createElement('div');
      el.className = 'handle draggable am-handle';
      el.tabIndex = k === (cur().sel === null ? 0 : cur().sel) ? 0 : -1;
      el.setAttribute('role', 'slider');
      el.setAttribute('aria-label', 'The height of the coefficient of ' + monoPlain(p));
      el.setAttribute('aria-keyshortcuts', 'Space');
      MM.handle(el);
      wire(el, k);
      lift.appendChild(el);
      return el;
    });
  }

  function drawLift() {
    if (!L) return;
    const { P } = liftView(), { pts, v, sub, off } = model, d = state.d, sel = cur().sel;
    MM.clearCanvas(lctx);
    const at = (k, h) => P(pts[k][0], pts[k][1], h === undefined ? v[k] : h);
    const path = (Q) => { lctx.beginPath(); Q.forEach((q, i) => (i ? lctx.lineTo(q[0], q[1]) : lctx.moveTo(q[0], q[1]))); lctx.closePath(); };
    // the floor: the triangle dΔ, the Newton polygon in it (the hull of the terms present: all of
    // it unless terms are taken out), and the subdivision the roof projects to
    lctx.strokeStyle = MM.color('rule');
    lctx.lineWidth = 1;
    path([[0, 0], [d, 0], [0, d]].map(([i, j]) => P(i, j, VMIN)));
    lctx.stroke();
    path(model.newton.hull.map((k) => at(k, VMIN)));
    lctx.fillStyle = MM.color('sunken');
    lctx.fill();
    lctx.stroke();
    lctx.strokeStyle = MM.color('ink-3');
    lctx.beginPath();
    for (const e of sub.edges) { const a = at(e.a, VMIN), b = at(e.b, VMIN); lctx.moveTo(a[0], a[1]); lctx.lineTo(b[0], b[1]); }
    lctx.stroke();
    // the posts from the floor up to each lifted point
    lctx.save();
    lctx.setLineDash([2, 3]);
    lctx.strokeStyle = MM.rgba('ink-3', 0.7);
    lctx.beginPath();
    pts.forEach((p, k) => { if (off[k]) return; const a = at(k, VMIN), b = at(k); lctx.moveTo(a[0], a[1]); lctx.lineTo(b[0], b[1]); });
    lctx.stroke();
    lctx.restore();
    // the lattice points on the floor: filled where they are vertices of the subdivision;
    // those of the terms taken out small and faint, with nothing above them
    pts.forEach((p, k) => {
      const a = at(k, VMIN), on = sub.isVertex[k];
      if (off[k]) {
        lctx.beginPath();
        lctx.arc(a[0], a[1], 1.8, 0, TAU);
        lctx.fillStyle = MM.rgba('ink-3', 0.5);
        lctx.fill();
        return;
      }
      lctx.beginPath();
      lctx.arc(a[0], a[1], 2.8, 0, TAU);
      lctx.fillStyle = on ? MM.color(k === state.hover ? 'highlight' : k === sel ? 'accent' : 'ink-2') : MM.color('surface');
      lctx.fill();
      if (!on) { lctx.strokeStyle = MM.color(k === state.hover ? 'highlight' : k === sel ? 'accent' : 'ink-2'); lctx.lineWidth = 1.2; lctx.stroke(); }
    });
    // the axes: i along one leg, j along the other, numbered
    // (on a patch of the ground, so that a post behind a label does not cross it)
    const lab = (text, q, size, color) => {
      const w = MM.measureLabel(lctx, text, size);
      lctx.fillStyle = MM.color('surface');
      lctx.fillRect(q[0] - w / 2 - 2, q[1] - 0.6 * size, w + 4, 1.2 * size);
      MM.canvasLabel(lctx, text, q[0], q[1], { size, align: 'center', baseline: 'middle', color });
    };
    const c3 = MM.color('ink-3'), c2 = MM.color('ink-2');
    for (let i = 0; i <= d; i++) lab('$' + i + '$', P(i, -AX.tick, VMIN), 11.5, c3);
    for (let j = 1; j <= d; j++) lab('$' + j + '$', P(-AX.tick, j, VMIN), 11.5, c3);
    lab('$i$', P(d / 2, -AX.name, VMIN), 14, c2);
    lab('$j$', P(-AX.name, d / 2, VMIN), 14, c2);
    // the roof, its faces from the back to the front
    const faces = sub.faces.map((f) => {
      const Q = f.poly.map((k) => at(k));
      return { Q, z: Q.reduce((t, q) => t + q[2], 0) / Q.length };
    }).sort((a, b) => a.z - b.z);
    lctx.lineJoin = 'round';
    for (const f of faces) {
      path(f.Q);
      lctx.fillStyle = MM.rgba('roof', 0.07);
      lctx.fill();
      lctx.strokeStyle = MM.color('trop');
      lctx.lineWidth = 1.3;
      lctx.stroke();
    }
    // the lifted points themselves, under their handles (so that an image without them still has the points)
    pts.forEach((p, k) => {
      if (off[k]) return;
      const a = at(k);
      lctx.beginPath();
      lctx.arc(a[0], a[1], 3.2, 0, TAU);
      lctx.fillStyle = MM.color(k === state.hover ? 'highlight' : k === sel ? 'accent' : 'ink-2');
      lctx.fill();
    });
    // the handles, at the lifted points
    pts.forEach((p, k) => {
      const el = handles[k];
      if (!el) return;
      el.hidden = off[k];
      if (off[k]) return;
      const a = at(k);
      el.style.transform = 'translate(' + a[0].toFixed(1) + 'px,' + a[1].toFixed(1) + 'px)';
      el.classList.toggle('is-sel', k === sel);
      el.classList.toggle('is-hover', k === state.hover);
      el.tabIndex = k === (sel === null ? off.indexOf(false) : sel) ? 0 : -1;
      el.setAttribute('aria-valuemin', String(VMIN));
      el.setAttribute('aria-valuemax', String(VMAX[d]));
      el.setAttribute('aria-valuenow', String(round2(v[k])));
      el.setAttribute('aria-valuetext', fmt(v[k]) + ', so the coefficient of ' + monoPlain(p) + ' is ' + coefPlain(k));
    });
  }

  /* ---------- readouts ---------- */

  // the area of the Newton polygon, a whole number or a half, as TeX
  const areaTex = () => { const a = Math.round(2 * model.newton.area); return a % 2 ? '\\tfrac' + (a < 10 ? a + '2' : '{' + a + '}{2}') : String(a / 2); };

  function legendHTML() {
    const item = (mark, text) => '<span class="legend-item">' + mark + text + '</span>';
    let s = item('<span class="am-mark" style="--c: var(--amoeba)"></span>', 'the amoeba');
    if (state.trop) s += item('<svg class="legend-line trop" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5H21"/></svg>', 'the tropical curve');
    if (state.trop && [...model.trop.edges, ...model.trop.rays].some((e) => e.weight > 1)) s += item('<svg class="am-wt" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8"/><text x="9" y="12.6">2</text></svg>', 'the weight of an edge');
    if (state.real) s += item('<svg class="legend-line real" viewBox="0 0 22 10" aria-hidden="true"><path d="M2 5H21" stroke-dasharray="0.1 3.2"/></svg>', 'its real points');
    return s;
  }
  // the answers beside the picture, each leading to the section that explains it: the number of
  // holes (and how many there could be, when that is more), the area as a part of the largest
  const link = (id, text) => '<a href="#' + id + '">' + text + '</a>';
  function aboutRows() {
    const m = model, g = m.newton.inside.filter(Boolean).length;
    const holes = [...amo.seen.keys()].filter((k) => m.newton.inside[k]).length;
    const cyc = m.cycles === 1 ? '$1$ cycle' : m.cycles ? '$' + m.cycles + '$ cycles' : 'no cycles';
    const a = area.key === areaKey() && area.value !== null
      ? link('sec-area', '$' + Math.min(100, Math.round(area.value * 100)) + '\\%$') + '${}\\cdot' + areaTex() + '\\pi^2$' : '…';
    return [
      ['Holes', link('sec-holes', '$' + holes + '$') + (holes !== g ? ' ($' + g + '$ possible)' : '')],
      ['Tropical curve', (m.smooth ? 'smooth' : 'not smooth') + ', ' + cyc],
      ['Area', a],
    ];
  }
  // under the lifted Newton polygon and its copy of the amoeba
  function liftCaption() {
    return 'The lattice points $(i,j)$ lifted to their heights $v_{ij}$, the roof over them, and on the floor the subdivision it projects to.'
      + (model.sub.isVertex.some((x, k) => !x && !model.off[k]) ? ' Hollow points on the floor are not corners of the roof.' : '');
  }
  // The polynomial, written out term by term (by degree, z before w), to be edited
  // in place. Each term is its sign, which a click changes, and the rest, which a
  // drag to the right raises and to the left lowers (with a mouse or a pen, up and
  // down too; on a touch screen a drag that starts up or down scrolls the page): its
  // power of t is the height of its point; a click on it gives it a slider. The
  // elements stay while the values change, so that a drag keeps hold of what it moves.
  const texNum = (x) => { const r = round2(x); return (r < 0 ? '-' : '') + Math.abs(r); };
  const TERM_PX = 36;  // pixels of drag for a unit of height
  function termOrder() {
    const pts = model.pts;
    return pts.map((_, k) => k).sort((a, b) => pts[a][0] + pts[a][1] - pts[b][0] - pts[b][1] || pts[b][0] - pts[a][0]);
  }
  // t^v and the monomial, as TeX: t^{2}z^{2}w
  function termTex(k) {
    const p = model.pts[k], r = round2(cur().v[k]);
    const coef = r === 0 ? '' : r === 1 ? 't' : 't^{' + texNum(r) + '}';
    const mono = (p[0] ? 'z' + (p[0] > 1 ? '^{' + p[0] + '}' : '') : '') + (p[1] ? 'w' + (p[1] > 1 ? '^{' + p[1] + '}' : '') : '');
    return coef + mono || '1';
  }
  const formulaEl = $('formula');
  let terms = [];  // by lattice point: the term's elements, and what they show
  function buildFormula() {
    formulaEl.textContent = '';
    const lhs = document.createElement('span');
    lhs.className = 'am-lhs';
    MM.setHTML(lhs, '$f={}$');
    formulaEl.appendChild(lhs);
    terms = [];
    termOrder().forEach((k, n) => {
      const name = monoPlain(model.pts[k]);
      const box = document.createElement('span'), sign = document.createElement('button'), body = document.createElement('span');
      box.className = 'am-tm';
      sign.type = 'button';
      sign.className = 'am-sign';
      sign.tabIndex = -1; // from the keyboard, Space on the term changes it
      sign.setAttribute('aria-label', 'Change the sign of the term in ' + name);
      body.className = 'am-body';
      body.setAttribute('role', 'slider');
      body.setAttribute('aria-label', 'The power of t in the term in ' + name);
      body.setAttribute('aria-keyshortcuts', 'Space');
      box.append(sign, body);
      // a line may break before a term, never inside one
      if (n) formulaEl.appendChild(document.createElement('wbr'));
      formulaEl.appendChild(box);
      terms[k] = { box, sign, body, n, name };
      wireTerm(terms[k], k);
    });
  }
  // t from the keyboard, on the chart's handle
  function tKeys(e) {
    const step = { ArrowUp: 0.1, ArrowRight: 0.1, ArrowDown: -0.1, ArrowLeft: -0.1, PageUp: 1, PageDown: -1 }[e.key];
    if (step) setS(Math.round((state.s + step) * 10) / 10);
    else if (e.key === 'Home') setS(S0);
    else return;
    e.preventDefault();
    commit();
  }
  let tHeld = false; // t is being changed by a slider or the chart's handle

  // Under the formula, t on a line of its own, and once a term has been clicked, the height of
  // the chosen term: each its value and a slider.
  const logtEl = $('logt'), heightEl = $('height'), vRow = $('v-row'), fblock = vRow.parentElement;
  logtEl.min = String(SMIN);
  logtEl.max = String(SMAX);
  logtEl.addEventListener('input', () => { tHeld = true; setS(+logtEl.value); });
  logtEl.addEventListener('change', () => { tHeld = false; commit(); });
  heightEl.addEventListener('input', () => { if (cur().sel === null) return; held = { k: cur().sel }; setHeight(cur().sel, +heightEl.value); });
  heightEl.addEventListener('change', () => { held = null; released(); });
  // A term (or its region, or its lattice point) chosen, with the slider of its height; a click
  // on the chosen one lets go of it, as does Escape.
  function chooseTerm(k) { select(k); }
  function toggleTerm(k) { select(cur().sel === k ? null : k); }
  // A click anywhere else lets go of it too: not in the formula and its sliders (where the slider
  // of t must not move up under the pointer as the other one goes), the amoeba and the lifted
  // picture (which choose by clicks of their own), the bar, or a dialog.
  document.addEventListener('click', (e) => {
    if (cur().sel === null || !(e.target instanceof Element)) return;
    if (!e.target.closest('.am-fblock, #canvas, #lift, .control-bar, dialog, .menu')) select(null);
  });
  // the values, the chosen term and the one pointed at, in the elements as they are
  function updateFormula() {
    const c = cur();
    model.pts.forEach((p, k) => {
      const T = terms[k];
      if (!T) return;
      // a term taken out: grey, with the coefficient 0 (and a plus before it), and a click puts it back
      const off = c.off[k], neg = c.sg[k] < 0 && !off, sign = T.n ? (neg ? '${}-{}$' : '${}+{}$') : (neg ? '$-$' : '$+$');
      MM.setHTML(T.sign, sign);
      T.sign.classList.toggle('is-lead', !T.n && !neg);
      T.sign.setAttribute('aria-label', (off ? 'Put back the term in ' : 'Change the sign of the term in ') + T.name);
      const body = '$' + (off ? '0' + monoTex(p).replace(/^1$/, '') : termTex(k)) + '$';
      MM.setHTML(T.body, body);
      if (T.off !== off) { T.off = off; T.box.classList.toggle('is-off', off); T.drag.update(); }
      T.box.classList.toggle('is-sel', k === c.sel);
      T.box.classList.toggle('is-hover', k === state.hover);
      // (a term taken out is a tab stop of its own, at its sign, which puts it back)
      T.sign.tabIndex = off ? 0 : -1;
      T.body.tabIndex = !off && k === (c.sel === null ? termOrder().find((j) => !c.off[j]) : c.sel) ? 0 : -1;
      T.body.setAttribute('aria-valuemin', String(VMIN));
      T.body.setAttribute('aria-valuemax', String(VMAX[state.d]));
      T.body.setAttribute('aria-valuenow', String(round2(c.v[k])));
      T.body.setAttribute('aria-valuetext', off ? 'taken out: Enter puts it back' : fmt(c.v[k]) + ', so the term is ' + coefPlain(k) + ' ' + monoPlain(p));
    });
    const t = '$t=\\mathrm{e}^{' + texNum(state.s) + '}$';
    MM.setHTML($('t-val'), t);
    if (+logtEl.value !== state.s) logtEl.value = String(state.s);
    logtEl.setAttribute('aria-valuetext', 'log t = ' + fmt(state.s));
    // the chosen term's height
    const k = c.sel;
    vRow.hidden = k === null;
    fblock.classList.toggle('is-editing', k !== null);
    if (k === null) return;
    const p = model.pts[k], mono = monoTex(p) === '1' ? '' : '<span class="am-mono">$' + monoTex(p) + '$</span>';
    const v = '<span class="am-chosen"><span class="am-coef">$t^{' + texNum(c.v[k]) + '}$</span>' + mono + '</span>';
    MM.setHTML($('v-val'), v);
    heightEl.min = String(VMIN);
    heightEl.max = String(VMAX[state.d]);
    if (+heightEl.value !== round2(c.v[k])) heightEl.value = String(round2(c.v[k]));
    heightEl.setAttribute('aria-label', 'The power of t in the term in ' + monoPlain(p));
    heightEl.setAttribute('aria-valuetext', fmt(c.v[k]));
    delEl.disabled = !canTakeOut(k);
    delEl.setAttribute('aria-label', 'Take out the term in ' + monoPlain(p));
  }
  function wireTerm(T, k) {
    T.sign.addEventListener('click', () => (isOff(k) ? putBack(k) : flipSign(k)));
    let from = 0, moved = 0;
    const drag = T.drag = MM.turnDrag(T.body, {
      when: () => !isOff(k),
      start: () => { from = cur().v[k]; moved = 0; held = { k }; chooseTerm(k); },
      move: (dx, dy) => { moved += dx - dy; setHeight(k, snap(from + moved / TERM_PX)); },
      end: () => { held = null; released(); },
    });
    T.body.addEventListener('click', () => { if (isOff(k)) putBack(k); else if (!drag.moved) toggleTerm(k); });
    // one tab stop, at the chosen term: left and right move along the formula, up and
    // down change the power of t (Page Up and Page Down by a whole unit), Home puts it
    // back, Space changes the sign, Delete takes the term out (and the focus goes to its
    // sign, which puts it back); on a term taken out, Enter or Space puts it back
    T.body.addEventListener('keydown', (e) => {
      if (isOff(k) && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); putBack(k); return; }
      if (e.key === ' ') { e.preventDefault(); flipSign(k); return; }
      if (e.key === 'Escape') { if (cur().sel !== null) { e.preventDefault(); select(null); } return; }
      if (e.key === 'Enter') { e.preventDefault(); toggleTerm(k); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (!isOff(k) && canTakeOut(k)) { takeOut(k); T.sign.focus(); } return; }
      const move = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (move) {
        e.preventDefault();
        const order = termOrder().filter((j) => j === k || !isOff(j)), j = order[(order.indexOf(k) + move + order.length) % order.length];
        select(j);
        terms[j].body.focus();
        return;
      }
      const step = { ArrowUp: 0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 }[e.key];
      let x;
      if (isOff(k)) return;
      if (step) x = Math.round((cur().v[k] + step) * 4) / 4;
      else if (e.key === 'Home') x = AM.honeycomb(state.d, 1)[k];
      else return;
      e.preventDefault();
      chooseTerm(k);
      setHeight(k, x);
      released();
    });
    T.box.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') setHover(k); });
    T.box.addEventListener('pointerleave', () => { if (state.hover === k) setHover(null); });
  }

  function readouts() {
    if (!amo) return;
    MM.setHTML($('title'), NAMES[model.degree]);
    MM.setHTML($('name'), 'A curve of degree $' + model.degree + '$ in $(\\CC^\\times)^2$, of genus $' + model.newton.inside.filter(Boolean).length + '$.');
    MM.setHTML($('legend'), legendHTML());
    updateFormula();
    MM.kv($('about'), aboutRows());
    MM.setHTML($('lift-cap'), liftCaption());
    MM.setHTML($('chart-cap'), 'The area of the amoeba against $\\log t$, as a percentage of $' + areaTex() + '\\pi^2$. The picture of the amoeba is scaled by $1/\\log t$, so its area looks smaller as $t$ grows.');
  }

  function draw() {
    if (!canvas.clientWidth || !amo) return;
    drawAmoeba();
    copies.forEach(drawCopy);
    drawLift();
    readouts();
    chartLater();
    drawChart();
    zoomEl.value = RMAX / state.frame.R;
    if (example) example.changed();
  }

  /* ---------- the controls ---------- */

  function syncControls() {
    $('degree').value = String(state.d);
    $('trop').pressed = state.trop;
    $('real').pressed = state.real;
    $('spin').pressed = state.spin;
  }

  // the pictures, the formula and the controls for a curve of another degree, or put back by
  // Undo (after rebuild() and the window)
  function afresh() {
    buildHandles();
    buildFormula();
    updateFormula();
    shapeLift();
    layoutLift();
    syncControls();
    invalidate();
  }
  function chooseDegree(d) {
    state.d = d;
    state.hover = null;
    rebuild();
    fit();
    afresh();
    commit();
  }
  function setS(s) {
    s = clamp(round2(s), SMIN, SMAX);
    if (s === state.s) return;
    state.s = s;
    state.frame = clampFrame(state.frame);
    updateFormula();
    invalidate();
  }
  function setHeight(k, x) {
    x = clamp(round2(x), VMIN, VMAX[state.d]);
    if (x === cur().v[k]) return;
    cur().v[k] = x;
    rebuild();
    updateFormula();
    invalidate();
  }
  // a change of the heights has ended: the window and the lifted picture refit if they must
  function released() {
    keepInView();
    layoutLift();
    invalidate();
    commit();
  }
  function select(k) {
    if (cur().sel === k) return;
    cur().sel = k;
    draw();
  }
  // a click on a sign in the formula: the coefficient changes sign
  function flipSign(k) {
    const c = cur();
    c.sg[k] = -c.sg[k];
    draw();
    invalidate();
    commit();
  }
  // the button by the chosen term's slider (or Delete on the term) takes it out; a click on
  // it, grey in the formula, puts it back, chosen
  function takeOut(k) {
    const c = cur();
    c.off[k] = true;
    if (c.sel === k) c.sel = null;
    if (state.hover === k) state.hover = null;
    rebuild();
    keepInView();
    layoutLift();
    draw();
    invalidate();
    commit();
  }
  function putBack(k) {
    const c = cur();
    c.off[k] = false;
    c.sel = k;
    rebuild();
    keepInView();
    layoutLift();
    draw();
    invalidate();
    commit();
  }
  const delEl = $('del');
  delEl.addEventListener('click', () => {
    const k = cur().sel;
    if (k === null || !canTakeOut(k)) return;
    // the focus to the term, now grey, whose sign a click or Enter puts back
    const refocus = document.activeElement === delEl;
    takeOut(k);
    if (refocus) terms[k].sign.focus();
  });
  function setHover(k) {
    if (state.hover === k) return;
    state.hover = k;
    canvas.classList.toggle('is-over', k !== null);
    draw();
  }

  $('degree').addEventListener('change', (e) => chooseDegree(+e.detail.value));
  $('trop').addEventListener('change', (e) => { state.trop = e.detail.pressed; draw(); });
  $('real').addEventListener('change', (e) => { state.real = e.detail.pressed; draw(); });
  $('spin').addEventListener('change', (e) => { state.spin = e.detail.pressed; startLoop(); if (example) example.changed(); });
  // The window zooms by f about the point (x, y) of the picture, which stays where it is:
  // with the slider about the middle, with two fingers about the point between them.
  function zoomAt(f, x, y) {
    const V = view(), f0 = state.frame, px = V.x(x), py = V.y(y);
    const R = clampFrame({ c: f0.c, R: f0.R / f }).R, r = R / f0.R;
    if (r === 1) return;
    state.frame = clampFrame({ c: [px + (f0.c[0] - px) * r, py + (f0.c[1] - py) * r], R });
    state.panned = true;
    zoomEl.value = RMAX / state.frame.R;
    invalidate();
  }
  const middle = () => [canvas.clientWidth / 2, canvas.clientHeight / 2];
  zoomEl.addEventListener('input', () => zoomAt(state.frame.R / (RMAX / zoomEl.value), ...middle()));
  zoomEl.addEventListener('change', () => { if (example) example.changed(); });
  MM.pinchZoom(canvas, { zoom: zoomAt, pan: (dx, dy) => panBy(dx, dy), end: () => { if (example) example.changed(); } });

  /* ---------- the handles: dragging a lifted point up or down ---------- */

  let held = null; // the handle being dragged: its point, where the drag began, its height then
  const snap = (x) => { const h = Math.round(x * 2) / 2; return Math.abs(x - h) < 0.07 ? h : round2(x); };
  function wire(el, k) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      el.setPointerCapture(e.pointerId);
      held = { k, id: e.pointerId, y: e.clientY, v: cur().v[k] };
      e.preventDefault();
      el.focus({ preventScroll: true });
      chooseTerm(k);
    });
    el.addEventListener('pointermove', (e) => {
      if (!held || held.k !== k || e.pointerId !== held.id) return;
      const per = liftView().perHeight;
      if (per > 1) setHeight(k, snap(held.v - (e.clientY - held.y) / per));
    });
    const end = () => { if (held && held.k === k) { held = null; released(); } };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, end));
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') setHover(k); });
    el.addEventListener('pointerleave', () => { if (state.hover === k) setHover(null); });
    // The points are one tab stop, at the chosen one (or the first): left and right move to the
    // previous and next point, up and down change the height (Page Up and Page
    // Down by a whole unit), Home puts it back where the page starts it, Space
    // changes the sign of its coefficient.
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ') { e.preventDefault(); flipSign(k); return; }
      const n = handles.length, move = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (move) {
        e.preventDefault();
        let j = k;
        do j = (j + move + n) % n; while (isOff(j));
        select(j);
        handles[j].focus();
        return;
      }
      const step = { ArrowUp: 0.25, ArrowDown: -0.25, PageUp: 1, PageDown: -1 }[e.key];
      let x;
      if (step) x = Math.round((cur().v[k] + step) * 4) / 4;
      else if (e.key === 'Home') x = AM.honeycomb(state.d, 1)[k];
      else return;
      e.preventDefault();
      setHeight(k, x);
      released();
    });
  }

  /* ---------- pointing at the amoeba; dragging moves it ---------- */

  // the lattice point that is the order of the component of the complement under the pointer
  function hit(e) {
    if (!amo) return null;
    const r = canvas.getBoundingClientRect(), g = amo.g, px = e.clientX - r.left, py = e.clientY - r.top;
    const label = labelBoxes.find((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1);
    if (label) return label.k;
    const c = Math.floor((e.clientX - r.left) / g.sx), q = Math.floor((e.clientY - r.top) / g.sy);
    if (c < 0 || q < 0 || c >= g.nC || q >= g.nR) return null;
    const k = amo.raster[q * g.nC + c];
    return k >= 0 && !isOff(k) ? k : null;
  }
  // with a mouse or a pen (on a touch screen the page scrolls instead), and with the arrow keys
  canvas.classList.add('pannable');
  let panning = null;
  function panBy(dx, dy) {
    const V = view(), f = state.frame;
    state.frame = clampFrame({ c: [f.c[0] - dx / V.k, f.c[1] + dy / V.k], R: f.R });
    state.panned = true;
    invalidate();
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' && !e.button) panning = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (panning && e.pointerId === panning.id && e.buttons) {
      const dx = e.clientX - panning.x, dy = e.clientY - panning.y;
      if (!panning.moved && Math.hypot(dx, dy) < 4) return;
      if (!panning.moved) { panning.moved = true; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-panning'); }
      panning.x = e.clientX;
      panning.y = e.clientY;
      panBy(dx, dy);
      return;
    }
    if (e.pointerType !== 'touch') setHover(hit(e));
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => canvas.addEventListener(t, () => {
    canvas.classList.remove('is-panning');
    setTimeout(() => { panning = null; }, 0);
  }));
  canvas.addEventListener('pointerleave', () => { if (!panning) setHover(null); });
  canvas.addEventListener('click', (e) => {
    if (panning && panning.moved) return;
    const k = hit(e);
    if (k !== null) toggleTerm(k); else select(null);
  });
  canvas.addEventListener('keydown', (e) => {
    // as a drag in the direction of the arrow would
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) { e.preventDefault(); panBy(40 * d[0], 40 * d[1]); }
    else if (e.key === 'Escape' && cur().sel !== null) { e.preventDefault(); select(null); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.4, ...middle()); }
    else if (e.key === '-') { e.preventDefault(); zoomAt(1 / 1.4, ...middle()); }
  });

  /* ---------- the lifted picture turns under a drag, and on its own ---------- */

  let turning = null;
  const turn = MM.turnDrag(liftCv, {
    start: () => { turning = { az: state.az, el: state.el, dx: 0, dy: 0 }; },
    move: (dx, dy) => {
      // the near side follows the pointer
      turning.dx += dx;
      turning.dy += dy;
      state.az = turning.az + turning.dx * 0.008;
      state.el = clamp(turning.el + turning.dy * 0.006, 0.2, 1.3);
      layoutLift();
      drawLift();
    },
    end: () => { if (example) example.changed(); },
    // the arrow keys: as a drag that way would
    keys: {
      turn: (a, b) => {
        state.az += a;
        state.el = clamp(state.el + b, 0.2, 1.3);
        layoutLift();
        drawLift();
        if (example) example.changed();
      },
    },
  });
  // pointing at a lattice point on the floor, or at its lifted point
  liftCv.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || turn.active || !L) return;
    const r = liftCv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, { P } = liftView();
    let best = null, bd = 12;
    model.pts.forEach((p, k) => {
      if (model.off[k]) return;
      for (const h of [VMIN, model.v[k]]) { const a = P(p[0], p[1], h), dd = Math.hypot(a[0] - x, a[1] - y); if (dd < bd) { bd = dd; best = k; } }
    });
    setHover(best);
  });
  liftCv.addEventListener('pointerleave', () => setHover(null));
  liftCv.addEventListener('click', (e) => {
    if (turn.moved) return;
    if (state.hover === null) select(null); else toggleTerm(state.hover);
  });

  // it rests while the pointer is over it, while a point is dragged, and while it cannot be seen
  let raf = 0, last = 0, over = false, seen = () => true;
  function frame(t) {
    raf = 0;
    if (!state.spin || !seen()) { last = 0; return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (!held && !turn.active && !over) state.az = (state.az + dt * TAU / TURN) % TAU;
    drawLift();
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (!raf && state.spin && seen()) raf = requestAnimationFrame(frame); }
  lift.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') over = true; });
  lift.addEventListener('pointerleave', () => { over = false; });

  /* ---------- the area against log t (the figure in "Area") ---------- */

  // The area is worked out in a worker (worker.js) for the curve in view, once it has
  // stayed the same for a moment, at the values of log t that Amoeba.sampler gives: a
  // grid, then more where the area bends (it rises steeply to corners, where the real
  // curve changes); a worker still busy with a curve that has changed since is ended.
  // (Where no worker can be started, the same work is done here, a few milliseconds at
  // a time.) The curve is drawn through the values as they come.
  // (from log t = 0, t = 1, where every coefficient is ±1)
  const SAMPLE = { base: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6], tol: 0.008, min: 0.01, max: 80 };
  const S1 = SAMPLE.base[SAMPLE.base.length - 1]; // = SMAX
  const chartSvg = $('chart');
  // What the chart shows is drawn afresh in `body`; the handle at the formula's t, which a drag
  // moves along the curve, is an element of its own over it, kept while the rest is drawn
  // again, so that a drag keeps hold of it. (Save image leaves it out unless asked.)
  const chartBody = MM.svg('g', {}, chartSvg), guide = MM.svg('path', { class: 'ch-guide' }, chartSvg);
  const knob = MM.svg('g', { class: 'ch-handle draggable', tabindex: '0', role: 'slider', 'aria-label': 'log t', 'aria-valuemin': String(SMIN), 'aria-valuemax': String(SMAX) }, chartSvg);
  MM.svg('circle', { class: 'ch-hit', r: 18 }, knob);
  MM.handle(knob, 5.1);
  let chartX = null; // the chart's map from log t to its x, and back: { X, s }
  const curveKey = () => model.key + '|' + model.sg.join(',');
  // the curve the values are for, the values as [log t, area as a fraction of the largest], in order, and whether they are all in
  let chart = { key: '', points: [], done: false };
  let worker = null, workerBusy = false, chartTimer = 0, chartRun = null, chartShown = '';
  function chartLater() {
    const key = curveKey();
    if (chart.key === key) return;
    chart = { key, points: [], done: false };
    clearTimeout(chartTimer);
    if (chartRun) { chartRun.cancelled = true; chartRun = null; }
    if (worker && workerBusy) { worker.terminate(); worker = null; workerBusy = false; }
    chartTimer = setTimeout(() => chartStart(key), held ? 400 : 150);
  }
  function chartStart(key) {
    if (chart.key !== key || chart.done) return;
    chart.points = [];
    const job = { key, pts: model.pts, v: model.v.slice(), sg: model.sg.slice(), chart: SAMPLE };
    if (!worker) {
      try {
        worker = new Worker('worker.js');
        worker.onmessage = chartAnswer;
        worker.onerror = (e) => { e.preventDefault(); worker.terminate(); worker = null; workerBusy = false; chart.points = []; chartHere(job); };
      } catch (err) { worker = null; }
    }
    if (worker) { workerBusy = true; worker.postMessage(job); } else chartHere(job);
  }
  function chartPut(s, value) {
    const P = chart.points;
    let k = P.length;
    while (k && P[k - 1][0] > s) k--;
    P.splice(k, 0, [s, value]);
    drawChart();
  }
  function chartAnswer(e) {
    const { key, s, value, done } = e.data;
    if (key !== chart.key) return;
    if (done) { workerBusy = false; chart.done = true; drawChart(); } else chartPut(s, value);
  }
  function chartHere(job) {
    if (job.key !== chart.key) return;
    const run = chartRun = { cancelled: false }, at = AM.sampler(SAMPLE.base, SAMPLE.tol, SAMPLE.min, SAMPLE.max);
    let s = null, plan = null, ar = null, ac = null;
    const tick = () => {
      if (run.cancelled || job.key !== chart.key) return;
      const t0 = performance.now();
      while (performance.now() - t0 < 8) {
        if (!plan) {
          s = at.next();
          if (s === null) { chartRun = null; chart.done = true; drawChart(); return; }
          plan = AM.areaPlan(job.pts, job.v, job.sg, s);
          ar = runner(plan.rowTerms, plan.s, plan.ys, plan.N);
          ac = runner(plan.colTerms, plan.s, plan.xs, plan.N);
        }
        const next = !ar.done() ? ar : !ac.done() ? ac : null;
        if (next) next.step(32);
        else { const value = AM.areaFrom(plan, ar.result(), ac.result()); at.put(s, value); plan = null; chartPut(s, value); }
      }
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  }

  // The values, joined by a curve that is monotone between them (Fritsch and Carlson's
  // tangents): [x, y, slope] at each point, in the chart's units.
  function smooth(P) {
    const n = P.length, d = [];
    for (let k = 0; k + 1 < n; k++) d.push((P[k + 1][1] - P[k][1]) / (P[k + 1][0] - P[k][0]));
    const m = P.map((_, k) => (k === 0 ? d[0] : k === n - 1 ? d[n - 2] : d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2));
    for (let k = 0; k + 1 < n; k++) {
      if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; }
      const a = m[k] / d[k], b = m[k + 1] / d[k], h = Math.hypot(a, b);
      if (h > 3) { m[k] = 3 * a / h * d[k]; m[k + 1] = 3 * b / h * d[k]; }
    }
    return P.map((p, k) => [p[0], p[1], m[k]]);
  }
  // the curve's value at x, within the values known
  function valueAt(Q, x) {
    for (let k = 0; k + 1 < Q.length; k++) {
      const [x0, y0, m0] = Q[k], [x1, y1, m1] = Q[k + 1];
      if (x < x0 - 1e-9 || x > x1 + 1e-9) continue;
      const h = x1 - x0, u = (x - x0) / h;
      return (2 * u ** 3 - 3 * u ** 2 + 1) * y0 + (u ** 3 - 2 * u ** 2 + u) * h * m0 + (-2 * u ** 3 + 3 * u ** 2) * y1 + (u ** 3 - u ** 2) * h * m1;
    }
    return Q.length === 1 && Math.abs(x - Q[0][0]) < 1e-9 ? Q[0][1] : null;
  }
  // the width it is drawn at, one unit to a pixel, so that its labels keep the size of the text's
  const chartWidth = () => Math.round(Math.min(480, chartSvg.getBoundingClientRect().width || 320));
  function drawChart() {
    const W = chartWidth(), n = chart.points.length, aKnown = area.key === areaKey() ? area.value : null;
    const key = [W, chart.key, n, chart.done, state.s, state.d, aKnown].join('|');
    if (chartShown === key) return;
    chartShown = key;
    const H = 158, left = 44, right = 12, top = 10, bottom = 40;
    const X = (s) => left + s / S1 * (W - left - right), Y = (p) => top + (1 - p) * (H - top - bottom);
    chartX = { X, s: (x) => (x - left) / (W - left - right) * S1, W };
    const el = (name, attrs) => MM.svg(name, attrs, chartBody);
    const label = (text, x, y, anchor) => MM.svgLabel(el('text', { class: 'ch-num', x, y, 'text-anchor': anchor || 'middle' }), text);
    chartBody.textContent = '';
    chartSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    // the percentages up the side, the largest possible dashed; log t along the bottom
    el('path', { class: 'ch-grid', d: 'M' + left + ' ' + (Y(0.5) + 0.5) + 'H' + (W - right) });
    el('path', { class: 'ch-bound', d: 'M' + left + ' ' + (Y(1) + 0.5) + 'H' + (W - right) });
    el('path', { class: 'ch-axis', d: 'M' + left + ' ' + (Y(0) + 0.5) + 'H' + (W - right) });
    [[0, '$0\\%$'], [0.5, '$50\\%$'], [1, '$100\\%$']].forEach(([p, t]) => label(t, left - 8, Y(p) + 4, 'end'));
    for (let s = 0; s <= S1; s++) {
      el('path', { class: 'ch-axis', d: 'M' + (X(s) + 0.5) + ' ' + Y(0) + 'v4' });
      label('$' + s + '$', X(s), Y(0) + 17);
    }
    label('$\\log t$', (X(0) + X(S1)) / 2, Y(0) + 34);
    // the curve, as far as it is known
    const Q = smooth(chart.points.map(([s, v]) => [s, Math.max(0, Math.min(1, v))]));
    if (n > 1) {
      let d = 'M' + X(Q[0][0]).toFixed(1) + ' ' + Y(Q[0][1]).toFixed(1);
      for (let k = 0; k + 1 < n; k++) {
        const [x0, y0, m0] = Q[k], [x1, y1, m1] = Q[k + 1], h = (x1 - x0) / 3;
        d += 'C' + [X(x0 + h), Y(y0 + m0 * h), X(x1 - h), Y(y1 - m1 * h), X(x1), Y(y1)].map((c) => c.toFixed(1)).join(' ');
      }
      el('path', { class: 'ch-curve', d });
    }
    // the handle on the curve at the formula's t (before the curve is known there, at the
    // area worked out for the amoeba at the top, or on the axis), a line down to the axis
    let at = valueAt(Q, state.s);
    if (at === null) at = aKnown === null ? 0 : aKnown;
    const hx = X(state.s), hy = Y(Math.max(0, Math.min(1, at)));
    knob.setAttribute('transform', 'translate(' + hx.toFixed(1) + ' ' + hy.toFixed(1) + ')');
    guide.setAttribute('d', 'M' + (Math.round(hx) + 0.5) + ' ' + Y(0) + 'V' + (hy + 8).toFixed(1));
    knob.setAttribute('aria-valuenow', String(round2(state.s)));
    knob.setAttribute('aria-valuetext', 'log t = ' + fmt(state.s));
    // (read out at the values of the grid)
    const pc = (v) => Math.round(100 * Math.max(0, Math.min(1, v))) + '%';
    chartSvg.setAttribute('aria-label', chart.done
      ? 'The area of the amoeba against log t: ' + chart.points.filter((p) => SAMPLE.base.includes(p[0])).map((p) => pc(p[1]) + ' at ' + p[0]).join(', ')
      : 'The area of the amoeba against log t, being worked out');
  }
  // drawn afresh when its width changes
  new ResizeObserver(() => { if (chartWidth() !== +(chartSvg.getAttribute('viewBox') || '0 0 0').split(' ')[2]) drawChart(); }).observe(chartSvg.parentNode);

  // log t at a point of the screen, in the chart's units (one to a CSS pixel, but the chart may be scaled)
  function sOnChart(clientX) {
    const r = chartSvg.getBoundingClientRect();
    return chartX.s((clientX - r.left) * chartX.W / (r.width || 1));
  }
  // the handle: a drag moves it along the curve, and t with it
  knob.addEventListener('pointerdown', (e) => {
    if (e.button || !chartX) return;
    e.preventDefault();
    e.stopPropagation();
    knob.setPointerCapture(e.pointerId);
    tHeld = { id: e.pointerId };
    knob.focus({ preventScroll: true });
  });
  knob.addEventListener('pointermove', (e) => { if (tHeld && tHeld.id === e.pointerId) setS(snap(sOnChart(e.clientX))); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => knob.addEventListener(t, (e) => {
    if (!tHeld || tHeld.id !== e.pointerId) return;
    tHeld = false;
    commit();
  }));
  knob.addEventListener('keydown', tKeys);
  // a click on the chart puts t there
  chartSvg.addEventListener('click', (e) => {
    if (!chartX || e.target.closest('.ch-handle')) return;
    const s = sOnChart(e.clientX);
    if (s < -0.25 || s > S1 + 0.25) return;
    setS(snap(s));
    commit();
  });

  /* ---------- size ---------- */

  function resize() {
    const dpr = MM.pixelRatio();
    for (const cv of [canvas, liftCv, ...copies.map((c) => c.cv)]) MM.fitCanvas(cv);
    layoutLift();
    if (!canvas.clientWidth) return;
    const saving = dpr > (window.devicePixelRatio || 1);
    if (!amo || amo.key !== amoKey() || (saving && amo.level !== 'fine')) {
      // a new size: in full at once while Save image draws the figure, otherwise roughly first
      if (saving) computeNow('fine');
      else { computeNow('coarse'); scheduleFine(amo ? undefined : 0); }
    } else paintAmoeba();
    draw();
  }

  /* ---------- Undo and Redo ---------- */

  // The curve after each change, as far back as MM.undoRedo keeps: its degree, log t, and the
  // heights, signs and chosen coefficient for that degree. The window, the views and the
  // toggles are not changes of the curve.
  const back = [], forth = [];
  let now = null;
  const undoButtons = MM.undoRedo({ undo, redo, canUndo: () => back.length > 0, canRedo: () => forth.length > 0 });
  const snapshot = () => ({ d: state.d, s: state.s, v: cur().v.slice(), sg: cur().sg.slice(), off: cur().off.slice(), sel: cur().sel });
  const sameCurve = (a, b) => a.d === b.d && a.s === b.s && same(a.v, b.v) && same(a.sg, b.sg) && same(a.off, b.off);
  // a change has been made (a drag let go, a click, a key): it is kept, unless nothing changed
  function commit() {
    const x = snapshot();
    if (now && !sameCurve(now, x)) {
      undoButtons.keep(back, now);
      forth.length = 0;
    }
    now = x;
    undoButtons.update();
    if (example) example.changed();
  }
  function restore(x) {
    // (the chosen term stays chosen, unless the degree changes back)
    const c = state.cases[x.d], other = x.d !== state.d;
    Object.assign(c, { v: x.v.slice(), sg: x.sg.slice(), off: x.off.slice() });
    if (other) c.sel = x.sel;
    if (c.sel !== null && c.off[c.sel]) c.sel = null;
    Object.assign(state, { d: x.d, s: x.s, hover: null });
    rebuild();
    if (other) fit(); else keepInView();
    afresh();
  }
  const busy = () => held || tHeld;
  function undo() {
    if (!back.length || busy()) return;
    forth.push(now);
    now = back.pop();
    restore(now);
  }
  function redo() {
    if (!forth.length || busy()) return;
    back.push(now);
    now = forth.pop();
    restore(now);
  }

  rebuild();
  fit();
  buildHandles();
  buildFormula();
  shapeLift();
  syncControls();
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  ro.observe(liftCv);
  copies.forEach((c) => ro.observe(c.cv));
  resize();
  MM.onFonts(() => { chartShown = ''; draw(); });
  seen = MM.whenVisible([lift], (on) => { if (on) startLoop(); });
  startLoop();

  /* ---------- links, reset and Save image ---------- */

  const within = (x, lo, hi) => x >= lo - 1e-9 && x <= hi + 1e-9;
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  // The selected coefficient in a link, by its lattice point: k=0.1 is the term in w.
  // The terms taken out, z, by their indices among the lattice points (row by row, from
  // the constant term).
  const point = {
    write: (p) => (p ? p[0] + '.' + p[1] : ''),
    read(s) { if (s === '') return null; const m = /^(\d)\.(\d)$/.exec(s); if (!m) throw new Error('not a lattice point: "' + s + '"'); return [+m[1], +m[2]]; },
  };
  // What a link does not name of the heights, the signs, the selected coefficient and
  // the window is the curve's own, as choosing it gives them. So where they are, get()
  // gives the page's own example's (the cubic's), which a link leaves out (choosing the
  // quartic is ?c=4), and set() takes those as the curve's own, named or not (Save
  // image and Reset name every field).
  const HOME = fresh(3);
  example = MM.example({
    fields: { c: 'int', s: 'number', v: 'numbers', g: 'numbers', z: 'numbers', k: point, x: 'flag', r: 'flag', o: 'flag', w: 'numbers', a: 'numbers' },
    view: ['w', 'a'],
    get: () => {
      const c = cur(), own = fresh(state.d);
      return {
        c: state.d, s: state.s,
        v: same(c.v, own.v) ? HOME.v : c.v.slice(), g: same(c.sg, own.sg) ? HOME.sg : c.sg.slice(),
        z: c.off.flatMap((o, k) => (o ? [k] : [])),
        k: c.sel === null ? null : model.pts[c.sel].slice(),
        x: state.trop, r: state.real, o: state.spin,
        w: state.panned ? [state.frame.c[0], state.frame.c[1], state.frame.R] : [], a: [state.az, state.el],
      };
    },
    set(x, named) {
      const d = x.c;
      if (!DEGREES.includes(d)) return false;
      const pts = AM.triangle(d), n = pts.length, f = fresh(d);
      if (same(x.v, HOME.v)) x.v = f.v;
      if (same(x.g, HOME.sg)) x.g = f.sg;
      if (!named.has('w')) x.w = [];
      if (!named.has('z')) x.z = [];
      const sel = x.k === null ? null : pts.findIndex((p) => same(p, x.k));
      const off = pts.map((_, k) => x.z.includes(k));
      const ok = x.v.length === n && x.v.every((t) => within(t, VMIN, VMAX[d]))
        && x.g.length === n && x.g.every((t) => t === 1 || t === -1)
        && x.z.every((k) => Number.isInteger(k) && k >= 0 && k < n)
        && AM.newton(pts, x.v.map((h, k) => (off[k] ? -Infinity : h))).area > 0
        && sel !== -1 && !(sel !== null && off[sel]) && within(x.s, SMIN, SMAX)
        && (!x.w.length || (x.w.length === 3 && x.w[2] > 0)) && x.a.length === 2;
      if (!ok) return false;
      for (const e of DEGREES) state.cases[e] = e === d ? { v: x.v.map(round2), sg: x.g.slice(), off, sel } : fresh(e);
      Object.assign(state, { d, s: x.s, trop: x.x, real: x.r, spin: x.o && !MM.reduceMotion(), az: x.a[0], el: clamp(x.a[1], 0.2, 1.3), hover: null });
      rebuild();
      if (x.w.length) { state.frame = clampFrame({ c: [x.w[0], x.w[1]], R: x.w[2] }); state.panned = true; } else fit();
      buildHandles();
      buildFormula();
      shapeLift();
      layoutLift();
      syncControls();
      computeNow('coarse');
      scheduleFine();
      draw();
      startLoop();
      // (Reset can be undone)
      commit();
    },
    pictures: () => [
      { label: 'Amoeba', element: plane },
      { label: 'Lifted Newton polygon', element: lift, selected: false },
      { label: 'Area', element: chartSvg, selected: false },
    ],
    // the chart's handle shows in an image only when asked
    redraw: (o) => {
      knob.style.display = guide.style.display = o && o.handles === false ? 'none' : '';
      resize();
    },
    // for Save image: the area against log t as far as it is known, so that the
    // full-width page need not work it out again
    scene: {
      get: () => (chart.key === curveKey() ? { chart: chart.points, done: chart.done } : { chart: [], done: false }),
      set(sc) {
        const ok = (p) => Array.isArray(p) && p.length === 2 && within(p[0], 0, S1) && p[1] >= 0 && p[1] < 2;
        const P = Array.isArray(sc.chart) && sc.chart.length <= SAMPLE.max && sc.chart.every(ok) ? sc.chart.slice().sort((a, b) => a[0] - b[0]) : [];
        if (!P.length || chart.key !== curveKey()) return;
        chart.points = P;
        chart.done = sc.done === true;
        if (chart.done) clearTimeout(chartTimer);
        drawChart();
      },
    },
  });
  // the curve the page starts with, which Undo goes back to
  commit();
})();
