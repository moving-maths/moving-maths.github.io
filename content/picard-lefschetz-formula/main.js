// Picard–Lefschetz formula: the plane of x, shaded by |p(x) − z| (or coloured by the phase of
// p(x) − z), with the roots of
// p(x) = z (where the level set V_z degenerates) and the vanishing cycles along the straight paths
// from z to the critical values; the plane of values, with the critical values, those paths, the
// Stokes rays where the cycles jump, and z; the cycles carried along with z, and the intersection
// form. The mathematics is in lefschetz.js; the figures in the text are in figures.js.
(function () {
  'use strict';
  const PL = window.Lefschetz, TAU = 2 * Math.PI;
  const $ = (id) => document.getElementById(id);
  const el = MM.svg;
  const xcv = $('xcv'), xsvg = $('xsvg'), zcv = $('zcv'), zh = $('zh');

  // The critical points the page opens with, for each μ: found so that the critical values lie on
  // an arc above the start of z, from left to right in the order of the paths from it (the order of
  // a distinguished basis), with the critical points from left to right too; the vanishing cycles
  // then form a chain.
  const DEFAULTS = {
    2: [[-0.378, 0.655], [0.378, -0.655]],
    3: [[-0.918, -0.239], [0.1, -0.241], [0.818, 0.48]],
    4: [[-0.968, 0.263], [-0.444, -0.263], [0.444, -0.263], [0.968, 0.263]],
    5: [[-0.826, 0.596], [-0.709, 0.029], [-0.107, -0.399], [0.628, -0.33], [1.013, 0.103]],
  };
  const state = { n: 3, mu: 3, crit: DEFAULTS[3].map((c) => c.slice()), z: null, z0: null, phase: false, arcs: false };
  let shapeT = 1;   // the cycles drawn as their arcs (0) or as what they are (1), and in between
  let frame = null;   // the windows of the two planes
  let model = null;   // what follows from the critical points and z
  let example = null;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /* ---------- the windows ----------
   * The plane of values round the critical values, z and z0; the plane of x round the roots of
   * p(x) = z for every z in it, and the critical points. They are fitted when the page opens, when
   * μ changes and when a critical point is let go, and stay put meanwhile. */
  function fit() {
    const P = PL.poly(state.crit);
    let Rc = 1e-3;
    P.vals.forEach((v) => { Rc = Math.max(Rc, Math.hypot(v[0], v[1])); });
    let R = 1.6 * Rc;
    [state.z, state.z0].forEach((q) => { if (q) R = Math.max(R, 1.2 * Math.hypot(q[0], q[1] + 0.15 * Rc)); });
    const zv = { cx: 0, cy: -0.15 * Rc, R };
    let Rx = 0, guess = null;
    for (let k = 0; k < 96; k++) {
      const t = k / 96 * TAU, w = [zv.cx + 1.2 * R * Math.cos(t), zv.cy + 1.2 * R * Math.sin(t)];
      guess = PL.roots(P, w[0], w[1], guess);
      guess.forEach((q) => { Rx = Math.max(Rx, Math.hypot(q[0], q[1])); });
    }
    P.crit.forEach((c) => { Rx = Math.max(Rx, 1.15 * Math.hypot(c[0], c[1])); });
    frame = { zv, xv: { cx: 0, cy: 0, R: 1.04 * Rx }, Rc };
  }
  function view(v, cv) {
    const W = cv.clientWidth || 400, H = cv.clientHeight || W, k = Math.min(W, H) / (2 * v.R);
    return { W, H, k, X: (x) => W / 2 + (x - v.cx) * k, Y: (y) => H / 2 - (y - v.cy) * k, x: (px) => v.cx + (px - W / 2) / k, y: (py) => v.cy - (py - H / 2) / k };
  }
  const zUnit = () => 1 / view(frame.zv, zcv).k;   // a CSS pixel of the plane of values
  const SNAP_VAL = 10, SNAP_RAY = 7, SNAP_BASE = 9;   // pixels

  /* ---------- the roots and the basis ---------- */
  // the roots of p(x) = w, followed from old ones: each keeps its identity, at the nearest new root
  function follow(P, w, old) {
    const nw = PL.roots(P, w[0], w[1], old), used = new Set();
    return old.map((q) => {
      let best = -1, d = Infinity;
      nw.forEach((r, k) => { if (!used.has(k)) { const e = dist(r, q); if (e < d) { d = e; best = k; } } });
      used.add(best);
      return nw[best];
    });
  }
  // the arc of the vanishing cycle along the straight path from w to z_j (the lift of the path
  // through c_j), with the root identities at its ends (from rts, the roots of p = w)
  function arcAt(P, w, j, rts, h) {
    const v = P.vals[j];
    const r = Math.sqrt(dist(w, v)), ph = Math.atan2(w[1] - v[1], w[0] - v[0]);
    const A = PL.lift(P, j, [w[0], w[1], v[0], v[1]], [1, 0], [r * Math.cos(ph / 2), r * Math.sin(ph / 2)], h);
    const kp = A.plus.length - 2, km = A.minus.length - 2;
    return { A, p: PL.nearest(rts, A.plus[kp], A.plus[kp + 1]), q: PL.nearest(rts, A.minus[km], A.minus[km + 1]) };
  }
  // The reference basis at w: the cycles along the straight paths, oriented as in the books (keeping
  // the orientations of prev where a cycle has the same ends), and their intersection forms. The
  // basis at z is kept as coefficients B[n] in this one, changed only by jumps.
  function reference(P, w, rts, prev) {
    const h = 2 / view(frame.xv, xcv).k;
    const raw = P.vals.map((_, j) => arcAt(P, w, j, rts, h));
    const seeds = raw.map((c, j) => {
      const o = prev && prev[j];
      if (!o || !((o.p === c.p && o.q === c.q) || (o.p === c.q && o.q === c.p))) return null;
      return { f1: o.p === c.p ? 1 : -1, f2: o.f2 };
    });
    const f = PL.niceSigns(raw.map((c) => ({ p: c.p, q: c.q, e: c.A.e })), rts, seeds);
    const cyc = raw.map((c, j) => ({ p: f.f1[j] > 0 ? c.p : c.q, q: f.f1[j] > 0 ? c.q : c.p, e: [c.A.e[0] * f.f2[j], c.A.e[1] * f.f2[j]], f2: f.f2[j] }));
    return { cyc, S: { 1: PL.gram(1, cyc), 2: PL.gram(2, cyc), 3: PL.gram(3, cyc) }, pos: rts.map((q) => q.slice()) };
  }
  // Everything from the critical points, with the cycles taken afresh at z (z0 = z). keep: the model
  // before the critical points moved, to follow its roots and orientations.
  function build(keep) {
    const P = PL.poly(state.crit);
    // (a z sitting on a critical value moves off it, to where it arrived)
    if (keep && keep.atVal !== null) state.z = keep.zi.slice();
    const wi = state.z;
    const rts = keep ? follow(P, wi, keep.rts) : PL.roots(P, wi[0], wi[1]);
    const ref = reference(P, wi, rts, keep ? keep.ref.cyc : null);
    model = { P, rts, ref, zi: wi.slice(), B: { 1: PL.eye(P.mu), 2: PL.eye(P.mu), 3: PL.eye(P.mu) }, atVal: null, onRay: null, flash: null };
    state.z0 = wi.slice();
  }

  // The cycles taken afresh at z, as they are now (z0 = z): the basis at z becomes the reference.
  function rebase() {
    const mu = model.P.mu, S = {};
    for (const n of [1, 2, 3]) S[n] = PL.matmul(PL.transpose(model.B[n]), PL.matmul(model.ref.S[n], model.B[n]));
    const cyc = model.ref.cyc.map((c, j) => { const e = classEnds(j); return e ? { p: e.plus, q: e.minus } : c; });
    model.ref = { cyc, S, pos: model.rts.map((q) => q.slice()) };
    model.B = { 1: PL.eye(mu), 2: PL.eye(mu), 3: PL.eye(mu) };
    state.z0 = (model.atVal !== null ? model.zi : state.z).slice();
  }
  // Back at z0, each cycle of the basis is one of those taken there, or its negative: the arc is the
  // same, but for odd n going round z_j turns Δ_j's ends round. They are taken with the signs they
  // had at z0, so that what is carried reads in the basis as it was.
  function normalise() {
    if (dist(state.z, state.z0) > 1e-12 * (1 + Math.hypot(state.z0[0], state.z0[1]))) return;
    model.ref.cyc.forEach((c, j) => {
      const e = classEnds(j);
      if (!e) return;
      const at = model.rts[e.plus];
      if (dist(at, model.ref.pos[c.q]) < dist(at, model.ref.pos[c.p])) for (const n of [1, 3]) model.B[n].forEach((r) => { r[j] = -r[j] || 0; });
    });
  }

  /* ---------- moving z ----------
   * z moves in short steps (no z − z_j turning by more than π/6 in one). A step across the Stokes
   * ray of z_k for z_j changes Δ_j by the Picard–Lefschetz operator of z_k (lefschetz.js,
   * crossings, jump), and the roots are followed. z may sit on a Stokes ray, and on a critical value:
   * there the cycles are kept as they were where z arrived (zi), and when z leaves it goes round the
   * critical value from that side to the side it leaves by. */
  function stepZ(b) {
    const a = model.zi, vals = model.P.vals;
    let k = Math.max(1, Math.ceil(dist(a, b) / (16 * zUnit())));
    vals.forEach((v) => { k = Math.max(k, Math.ceil(Math.abs(PL.turn(a[0] - v[0], a[1] - v[1], b[0] - v[0], b[1] - v[1])) / (Math.PI / 6))); });
    for (let q = 1; q <= k; q++) {
      const c = q === k ? b.slice() : [a[0] + (b[0] - a[0]) * q / k, a[1] + (b[1] - a[1]) * q / k];
      for (const x of PL.crossings(vals, model.zi, c)) {
        for (const n of [1, 2, 3]) PL.jump(model.ref.S[n], n, model.B[n], x.j, x.k, x.s);
        model.flash = { j: x.j, k: x.k, s: x.s, at: performance.now() };
      }
      model.zi = c;
      model.rts = follow(model.P, c, model.rts);
    }
  }
  // round the critical value v at radius r from the angle of a to the angle of b, the short way
  function roundTo(v, a, b) {
    const r = dist(a, v), a0 = Math.atan2(a[1] - v[1], a[0] - v[0]), d = PL.turn(a[0] - v[0], a[1] - v[1], b[0] - v[0], b[1] - v[1]);
    const m = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 12)));
    for (let q = 1; q <= m; q++) stepZ([v[0] + r * Math.cos(a0 + d * q / m), v[1] + r * Math.sin(a0 + d * q / m)]);
  }
  // where z would go for the point t: held on a critical value, on a Stokes ray, or on z0
  function snapped(t) {
    const u = zUnit(), vals = model.P.vals;
    for (let k = 0; k < vals.length; k++) if (dist(t, vals[k]) < SNAP_VAL * u) return { val: k, z: vals[k].slice() };
    if (dist(t, state.z0) < SNAP_BASE * u) return { z: state.z0.slice() };
    let best = null;
    vals.forEach((zj, j) => vals.forEach((zk, k) => {
      if (j === k) return;
      const L = dist(zk, zj), ux = (zk[0] - zj[0]) / L, uy = (zk[1] - zj[1]) / L;
      const lam = (t[0] - zk[0]) * ux + (t[1] - zk[1]) * uy, off = Math.abs((t[0] - zk[0]) * uy - (t[1] - zk[1]) * ux);
      if (lam > 1.6 * SNAP_VAL * u && off < SNAP_RAY * u && (!best || off < best.off)) best = { ray: { j, k }, off, z: [zk[0] + lam * ux, zk[1] + lam * uy] };
    }));
    return best ? { ray: best.ray, z: best.z } : { z: t.slice() };
  }
  // z goes to the point t (with the holds above)
  function moveZ(t) {
    const v = frame.zv, m = 6 * zUnit();
    t = [clamp(t[0], v.cx - v.R + m, v.cx + v.R - m), clamp(t[1], v.cy - v.R + m, v.cy + v.R - m)];
    const sn = snapped(t), vals = model.P.vals, r = SNAP_VAL * zUnit();
    if (model.atVal !== null) {
      if (sn.val === model.atVal) return;
      // leaving z_k: round it from where z arrived to the side it leaves by, then on
      const vk = vals[model.atVal], ex = dist(sn.z, vk) > 1e-12 ? sn.z : [vk[0] + 1, vk[1]];
      roundTo(vk, model.zi, [vk[0] + (ex[0] - vk[0]) / dist(ex, vk) * dist(model.zi, vk), vk[1] + (ex[1] - vk[1]) / dist(ex, vk) * dist(model.zi, vk)]);
      model.atVal = null;
    }
    if (sn.val !== undefined) {
      // arriving at z_k: up to a little way from it, from the side z comes from
      const vk = vals[sn.val], d = dist(model.zi, vk);
      const rim = d > 1e-12 ? [vk[0] + (model.zi[0] - vk[0]) / d * r * 0.6, vk[1] + (model.zi[1] - vk[1]) / d * r * 0.6] : [vk[0] + 0.6 * r, vk[1]];
      stepZ(rim);
      model.atVal = sn.val;
      model.onRay = null;
      state.z = sn.z;
      return;
    }
    stepZ(sn.z);
    model.onRay = sn.ray || null;
    state.z = sn.z;
    normalise();
  }

  /* ---------- the plane of x ---------- */
  const cyc = (j, form) => MM.color('cy-' + (j + 1) + (form ? '-' + form : ''));
  const cycVar = (j, form) => 'var(--cy-' + (j + 1) + (form ? '-' + form : '') + ')';
  function drawAxes(ctx, V, names) {
    const X0 = V.X(0), Y0 = V.Y(0), hor = Y0 > 0 && Y0 < V.H, ver = X0 > 0 && X0 < V.W;
    ctx.strokeStyle = MM.rgba('ink', 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (hor) { ctx.moveTo(0, Y0); ctx.lineTo(V.W, Y0); }
    if (ver) { ctx.moveTo(X0, 0); ctx.lineTo(X0, V.H); }
    ctx.stroke();
    const opt = { size: 13, color: MM.color('ink-3') };
    if (hor) MM.canvasLabel(ctx, names[0], V.W - 6, Y0 + (Y0 < V.H - 20 ? 14 : -8), Object.assign({ align: 'right', baseline: 'middle' }, opt));
    if (ver) MM.canvasLabel(ctx, names[1], X0 + 6, 12, Object.assign({ align: 'left', baseline: 'middle' }, opt));
  }

  // The phase of p(x) − z at each pixel (MM.phase.paint): coarse while something is dragged,
  // sharp (up to twice the CSS resolution) once it rests. Kept until z, p or the size changes.
  const phase = { key: '', cv: document.createElement('canvas') };
  let sharpTimer = 0;
  function phaseImage(V, coarse) {
    const s = coarse ? 0.5 : Math.min(2, MM.pixelRatio()), w = Math.max(1, Math.round(V.W * s)), h = Math.max(1, Math.round(V.H * s));
    const z = state.z, key = [w, h, z[0], z[1], state.crit.flat().join(','), frame.xv.R].join('|');
    if (phase.key === key) return phase.cv;
    const P = model.P, m = P.m, cr = P.r, ci = P.i, ph = new Float32Array(w * h), lm = new Float32Array(w * h), kind = new Uint8Array(w * h).fill(1);
    for (let py = 0, q = 0; py < h; py++) {
      const y = V.y((py + 0.5) / s);
      for (let px = 0; px < w; px++, q++) {
        const x = V.x((px + 0.5) / s);
        let ar = cr[m], ai = ci[m];
        for (let k = m - 1; k >= 0; k--) { const t = ar * x - ai * y + cr[k]; ai = ar * y + ai * x + ci[k]; ar = t; }
        ar -= z[0]; ai -= z[1];
        ph[q] = Math.atan2(ai, ar);
        lm[q] = 0.5 * Math.log(ar * ar + ai * ai + 1e-300);
      }
    }
    const img = MM.phase.paint(new ImageData(w, h), { w, h, dpr: s, ph, lm, kind, step: Math.PI / 6, lines: !coarse });
    phase.cv.width = w; phase.cv.height = h;
    phase.cv.getContext('2d').putImageData(img, 0, 0);
    phase.key = key;
    return phase.cv;
  }

  // The plain picture: the landscape of g = asinh(|p(x) − z|/σ), light blue where |p(x) − z| is
  // small (below the levels of the critical points) and white where it is large, with level lines evenly in g and those through the critical
  // points darker, as in the picture of the Stokes phenomenon. The critical points are its saddles,
  // and the arc of each vanishing cycle runs from its saddle down to two roots, across the level
  // lines. Sampled every GRID pixels, and kept with its level lines until z, p or the size changes.
  const GRID = 4, LEVEL = 0.5;
  const land = { key: '', cv: document.createElement('canvas'), small: document.createElement('canvas') };
  const rgbOf = (name) => MM.color(name).match(/[\d.]+/g).slice(0, 3).map(Number);
  function landImage(V) {
    const dpr = Math.min(2, MM.pixelRatio()), z = state.z, P = model.P;
    const key = [V.W, V.H, dpr, z[0], z[1], state.crit.flat().join(','), frame.xv.R].join('|');
    if (land.key === key) return land.cv;
    const sig = 0.4 * frame.Rc, m = P.m, cr = P.r, ci = P.i;
    const g = (x, y) => {
      let ar = cr[m], ai = ci[m];
      for (let k = m - 1; k >= 0; k--) { const t = ar * x - ai * y + cr[k]; ai = ar * y + ai * x + ci[k]; ar = t; }
      return Math.asinh(Math.hypot(ar - z[0], ai - z[1]) / sig);
    };
    const nx = Math.ceil(V.W / GRID) + 1, ny = Math.ceil(V.H / GRID) + 1, G = new Float64Array(nx * ny);
    let top = 0;
    for (let j = 0; j < ny; j++) { const y = V.y(j * GRID); for (let i = 0; i < nx; i++) { const v = g(V.x(i * GRID), y); G[j * nx + i] = v; top = Math.max(top, v); } }
    // the shading, at the corners of the cells, smoothed: from white to light blue across the
    // levels of the critical points (at their median)
    const lv = P.vals.map((v) => Math.asinh(dist(v, z) / sig)).sort((a, b) => a - b), mid = lv[lv.length >> 1];
    const sm = land.small;
    if (sm.width !== nx || sm.height !== ny) { sm.width = nx; sm.height = ny; }
    const sctx = sm.getContext('2d'), img = sctx.createImageData(nx, ny), d = img.data, S = rgbOf('surface'), B = rgbOf('land');
    for (let q = 0; q < nx * ny; q++) {
      const a = 0.12 * (1 - Math.tanh((G[q] - mid) / 0.9)), o = 4 * q;
      d[o] = S[0] + (B[0] - S[0]) * a; d[o + 1] = S[1] + (B[1] - S[1]) * a; d[o + 2] = S[2] + (B[2] - S[2]) * a; d[o + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    const cv = land.cv, w = Math.round(V.W * dpr), h = Math.round(V.H * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // (the samples are at the corners of the cells: half a cell beyond each edge)
    ctx.drawImage(sm, 0, 0, nx, ny, -GRID / 2, -GRID / 2, nx * GRID, ny * GRID);
    // the level lines, by marching squares: each cell adds a piece to the lines of the levels
    // between its corners' values
    const NL = Math.min(60, Math.floor(top / LEVEL)), even = Array.from({ length: NL + 1 }, () => []);
    const crit = P.vals.map((v) => ({ v: Math.asinh(dist(v, z) / sig), segs: [] }));
    const cut = (a, b, c, e, v, x0, y0, out) => {
      const A = a - v, Bv = b - v, C = c - v, D = e - v, pts = [];
      if ((A > 0) !== (Bv > 0)) pts.push(x0 + GRID * A / (A - Bv), y0);
      if ((Bv > 0) !== (C > 0)) pts.push(x0 + GRID, y0 + GRID * Bv / (Bv - C));
      if ((D > 0) !== (C > 0)) pts.push(x0 + GRID * D / (D - C), y0 + GRID);
      if ((A > 0) !== (D > 0)) pts.push(x0, y0 + GRID * A / (A - D));
      for (let q = 0; q + 3 < pts.length; q += 4) out.push(pts[q], pts[q + 1], pts[q + 2], pts[q + 3]);
    };
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = G[j * nx + i], b = G[j * nx + i + 1], c = G[(j + 1) * nx + i + 1], e = G[(j + 1) * nx + i];
      const lo = Math.min(a, b, c, e), hi = Math.max(a, b, c, e), x0 = i * GRID, y0 = j * GRID;
      for (let k = Math.max(1, Math.ceil(lo / LEVEL)); k <= Math.min(NL, Math.floor(hi / LEVEL)); k++) cut(a, b, c, e, k * LEVEL, x0, y0, even[k]);
      for (const L of crit) if (L.v > 1e-9 && L.v >= lo && L.v <= hi) cut(a, b, c, e, L.v, x0, y0, L.segs);
    }
    ctx.lineWidth = 1;
    const stroke = (segs, alpha) => {
      if (!segs.length) return;
      ctx.strokeStyle = MM.rgba('c1-text', alpha);
      ctx.beginPath();
      for (let q = 0; q < segs.length; q += 4) { ctx.moveTo(segs[q], segs[q + 1]); ctx.lineTo(segs[q + 2], segs[q + 3]); }
      ctx.stroke();
    };
    even.forEach((segs) => stroke(segs, 0.11));
    crit.forEach((L) => stroke(L.segs, 0.3));
    land.key = key;
    return cv;
  }

  // The arcs of the cycles, on the screen, from the − end to the + end (null for a cycle that has
  // vanished), with the size of the fibre's sphere, √|z − p(x)|, at each point.
  let arcsKept = { key: '', arcs: null };
  function cycleArcs(V) {
    const key = JSON.stringify([state.z, state.crit, model.atVal, model.onRay, model.B[1], model.rts, V.W, V.H, frame.xv.R]);
    if (arcsKept.key === key) return arcsKept.arcs;
    arcsKept = { key, arcs: arcsNow(V) };
    return arcsKept.arcs;
  }
  function arcsNow(V) {
    const P = model.P, z = state.z, h = 1.5 / V.k, out = [];
    const rts = model.atVal !== null ? follow(P, z, model.rts) : model.rts;
    for (let j = 0; j < P.mu; j++) {
      if (model.atVal === j) { out.push(null); continue; }
      let w = z, cut = null;
      // at z = z_k the arcs that end at c_k end at a double root, which the lift reaches only by
      // ever smaller steps: each path starts a hair's breadth along it (its roots near c_k a fifth
      // of a pixel apart)
      if (model.atVal !== null) {
        const zj = P.vals[j], L = dist(zj, z), d = Math.hypot(P.a[model.atVal][0], P.a[model.atVal][1]) * Math.pow(0.2 / V.k, 2);
        w = [z[0] + (zj[0] - z[0]) / L * d, z[1] + (zj[1] - z[1]) / L * d];
      }
      // on the Stokes ray of z_k for z_j the path runs through z_k: the arc runs into c_k, where it
      // goes on either way round on the two sides of the ray; it is drawn up to c_k
      if (model.onRay && model.onRay.j === j) {
        const zk = P.vals[model.onRay.k], zj = P.vals[j], L = dist(zk, zj), e = 1e-7 * frame.zv.R;
        w = [z[0] - (zk[1] - zj[1]) / L * e, z[1] + (zk[0] - zj[0]) / L * e];
        cut = P.crit[model.onRay.k];
      }
      const a = arcAt(P, w, j, rts, h);
      let pts = PL.arcOf(a.A).pts, minus = a.q, plus = a.p;
      // the orientation the basis has (its class for n = 1 is [+ end] − [− end]), by where its +
      // end is (two roots may meet at c_k)
      const ends = classEnds(j);
      if (ends) {
        const e = rts[ends.plus];
        if (dist(e, [pts[0], pts[1]]) < dist(e, [pts[pts.length - 2], pts[pts.length - 1]])) { pts = reverse(pts); minus = a.p; plus = a.q; }
      }
      if (cut) {
        let best = 0, bd = Infinity;
        for (let k = 0; k < pts.length; k += 2) { const d = Math.hypot(pts[k] - cut[0], pts[k + 1] - cut[1]); if (d < bd) { bd = d; best = k; } }
        // keep the side of c_k that holds c_j
        const cj = P.crit[j];
        let side = 0;
        for (let k = 0; k < pts.length; k += 2) if (Math.hypot(pts[k] - cj[0], pts[k + 1] - cj[1]) < 1e-9 * (1 + frame.xv.R)) { side = k < best ? -1 : 1; break; }
        pts = side < 0 ? pts.slice(0, best + 2) : pts.slice(best);
        if (side < 0) plus = null; else minus = null;
      }
      const scr = [], fib = [], o = [0, 0, 0, 0];
      for (let k = 0; k < pts.length; k += 2) {
        scr.push([V.X(pts[k]), V.Y(pts[k + 1])]);
        PL.evalPD(P, pts[k], pts[k + 1], o);
        fib.push(Math.sqrt(Math.hypot(z[0] - o[0], z[1] - o[1])));
      }
      out.push({ scr, fib, minus, plus, cut: cut ? [V.X(cut[0]), V.Y(cut[1])] : null });
    }
    return out;
  }
  const reverse = (s) => { const o = []; for (let k = s.length - 2; k >= 0; k -= 2) o.push(s[k], s[k + 1]); return o; };
  // the roots at the ends of Δ_j in the basis, from its class for n = 1
  function classEnds(j) {
    const B = model.B[1], cyc0 = model.ref.cyc, v = new Map();
    B.forEach((row, k) => { const c = row[j]; if (!c) return; v.set(cyc0[k].p, (v.get(cyc0[k].p) || 0) + c); v.set(cyc0[k].q, (v.get(cyc0[k].q) || 0) - c); });
    let plus = null, minus = null;
    for (const [r, c] of v) { if (c === 1) plus = r; else if (c === -1) minus = r; else if (c) return null; }
    return plus !== null && minus !== null ? { plus, minus } : null;
  }
  // a polyline through the points, smoothed
  function smooth(ctx, P) {
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let k = 1; k < P.length - 1; k++) ctx.quadraticCurveTo(P[k][0], P[k][1], (P[k][0] + P[k + 1][0]) / 2, (P[k][1] + P[k + 1][1]) / 2);
    if (P.length > 1) ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
  }
  // the points at distance d either side of the arc (its normals), and the point d along from an end
  function offset(scr, wid, sign) {
    return scr.map((p, k) => {
      const a = scr[Math.max(0, k - 1)], b = scr[Math.min(scr.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [p[0] - (b[1] - a[1]) / l * wid[k] * sign, p[1] + (b[0] - a[0]) / l * wid[k] * sign];
    });
  }
  function along(scr, d, fromEnd) {
    const P = fromEnd ? scr.slice().reverse() : scr;
    for (let k = 1; k < P.length; k++) {
      const l = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
      if (d <= l) { const t = d / l; return { x: P[k - 1][0] + t * (P[k][0] - P[k - 1][0]), y: P[k - 1][1] + t * (P[k][1] - P[k - 1][1]), dx: (P[k][0] - P[k - 1][0]) / l * (fromEnd ? -1 : 1), dy: (P[k][1] - P[k - 1][1]) / l * (fromEnd ? -1 : 1) }; }
      d -= l;
    }
    return null;
  }
  const arcLength = (scr) => { let L = 0; for (let k = 1; k < scr.length; k++) L += Math.hypot(scr[k][0] - scr[k - 1][0], scr[k][1] - scr[k - 1][1]); return L; };
  function chevron(ctx, a, size) {
    ctx.beginPath();
    ctx.moveTo(a.x - a.dx * size - a.dy * size * 0.8, a.y - a.dy * size + a.dx * size * 0.8);
    ctx.lineTo(a.x + a.dx * size * 0.6, a.y + a.dy * size * 0.6);
    ctx.lineTo(a.x - a.dx * size + a.dy * size * 0.8, a.y - a.dy * size - a.dx * size * 0.8);
    ctx.stroke();
  }

  // Each cycle as what it is over its arc (t = 1): for n = 1 its two points, with their signs; for
  // n = 2 the circle made of the two points ±y over each point of the arc (y² = z − p(x)), drawn
  // either side of it, one sheet solid and the other dashed; for n = 3 the sphere made of the
  // circles of radius √|z − p(x)| over its points, drawn as its outline with a few of the circles.
  // Or as its arc, with its orientation (t = 0), the sphere shrinking onto it as t goes to 0.
  function drawCycles(ctx, V, arcs, t) {
    let big = 1e-12;
    arcs.forEach((a) => { if (a) a.fib.forEach((f) => { big = Math.max(big, f); }); });
    const kap = 13 / big * t, n = state.n;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    arcs.forEach((a, j) => {
      const P = model.P;
      if (!a) {
        // vanished: the singular point
        const c = P.crit[j], X = V.X(c[0]), Y = V.Y(c[1]);
        ctx.strokeStyle = cyc(j, 'text'); ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(X, Y, 6, 0, TAU); ctx.stroke();
        return;
      }
      const scr = a.scr, wid = a.fib.map((f) => f * kap), line = cyc(j, 'line');
      if (scr.length < 2) return;
      if (n === 1) {
        // the arc: a line, dotted under the two points
        ctx.strokeStyle = line;
        if (t < 1) { ctx.globalAlpha = 1 - t; ctx.lineWidth = 2.2; smooth(ctx, scr); ctx.stroke(); }
        if (t > 0) { ctx.globalAlpha = t; ctx.lineWidth = 1.4; ctx.setLineDash([1.5, 4]); smooth(ctx, scr); ctx.stroke(); ctx.setLineDash([]); }
        ctx.globalAlpha = 1;
      } else {
        // the two sides
        ctx.strokeStyle = line; ctx.lineWidth = 2.2;
        smooth(ctx, offset(scr, wid, 1)); ctx.stroke();
        if (n === 2) ctx.setLineDash([5, 4]);
        smooth(ctx, offset(scr, wid, -1)); ctx.stroke();
        ctx.setLineDash([]);
        if (n === 3) {
          // the axis, faint, and a few of the circles, seen from the side
          ctx.strokeStyle = MM.rgba('cy-' + (j + 1), 0.45); ctx.lineWidth = 1.2;
          smooth(ctx, scr); ctx.stroke();
          const L = arcLength(scr);
          ctx.strokeStyle = line; ctx.lineWidth = 1.1;
          for (const f of [0.2, 0.4, 0.6, 0.8]) {
            const q = along(scr, f * L, false);
            if (!q) continue;
            let best = 0, bd = Infinity;
            scr.forEach((p, k) => { const d = Math.hypot(p[0] - q.x, p[1] - q.y); if (d < bd) { bd = d; best = k; } });
            const r = wid[best];
            if (r < 1.5) continue;
            ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.3 * r, r, Math.atan2(q.dy, q.dx), 0, TAU); ctx.stroke();
          }
        }
      }
      // its orientation: for n = 3 on the sphere, otherwise on the arc
      const mid = along(scr, 0.62 * arcLength(scr), false), ca = n === 3 ? 1 : 1 - t;
      if (mid && ca > 0.01) { ctx.globalAlpha = ca; ctx.strokeStyle = line; ctx.lineWidth = 2; chevron(ctx, mid, 5); ctx.globalAlpha = 1; }
      if (n === 1 && t > 0.01) {
        // the two points: + filled, − hollow, a little way along the arc from the roots
        const L = arcLength(scr), d = Math.min(15, 0.32 * L), u = t;
        ctx.globalAlpha = t;
        [[a.minus, false], [a.plus, true]].forEach(([r, isPlus]) => {
          if (r === null) return;
          const q = along(scr, d, isPlus);
          if (!q) return;
          ctx.fillStyle = isPlus ? cyc(j) : MM.color('surface');
          ctx.strokeStyle = cyc(j, 'text'); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(q.x, q.y, 6.5 * u, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = isPlus ? MM.color('surface') : cyc(j, 'text'); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(q.x - 3.2 * u, q.y); ctx.lineTo(q.x + 3.2 * u, q.y);
          if (isPlus) { ctx.moveTo(q.x, q.y - 3.2 * u); ctx.lineTo(q.x, q.y + 3.2 * u); }
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
      if (a.cut) {
        // the critical point it runs into, on a Stokes ray
        ctx.strokeStyle = MM.color('red'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a.cut[0], a.cut[1], 11, 0, TAU); ctx.stroke();
      }
    });
  }

  function drawX(coarse) {
    const { ctx } = MM.fitCanvas(xcv), V = view(frame.xv, xcv);
    ctx.drawImage(state.phase ? phaseImage(V, coarse) : landImage(V), 0, 0, V.W, V.H);
    drawAxes(ctx, V, ['$\\mathrm{Re}\\,x$', '$\\mathrm{Im}\\,x$']);
    drawCycles(ctx, V, cycleArcs(V), shapeT);
    // the roots of p(x) = z
    const rts = model.atVal !== null ? PL.roots(model.P, state.z[0], state.z[1], model.rts) : model.rts;
    ctx.fillStyle = MM.color('ink');
    rts.forEach((q) => { ctx.beginPath(); ctx.arc(V.X(q[0]), V.Y(q[1]), 3.8, 0, TAU); ctx.fill(); });
    if (state.phase) { const kr = Math.max(17, Math.min(24, V.W / 22)); MM.phase.key(ctx, V.W - kr - 18, V.H - kr - 18, kr); }
    placeCrit(V);
  }

  // the critical points: handle points over the picture, ringed in their cycles' colours
  let ptEls = [];
  function buildCrit() {
    xsvg.textContent = '';
    ptEls = state.crit.map((c, i) => {
      const g = el('g', { class: 'pl-pt draggable', tabindex: 0, role: 'button', 'data-i': i }, xsvg);
      el('circle', { class: 'pl-pad', r: 18 }, g);
      el('circle', { class: 'focus-ring', r: 12.5 }, g);
      el('circle', { class: 'handle-point', r: 8 }, g);
      el('text', { class: 'handle-num', y: 3.9 }, g).textContent = i + 1;
      return g;
    });
  }
  const fmt = (x) => (Math.abs(x) < 5e-3 ? '0' : x.toFixed(2).replace('-', '−'));
  const fmtC = (q) => fmt(q[0]) + (q[1] < 0 ? ' − ' : ' + ') + fmt(Math.abs(q[1])) + 'i';
  function placeCrit(V) {
    if (ptEls.length !== state.crit.length) buildCrit();
    ptEls.forEach((g, i) => {
      const c = state.crit[i];
      g.setAttribute('transform', 'translate(' + V.X(c[0]).toFixed(1) + ',' + V.Y(c[1]).toFixed(1) + ')');
      g.querySelector('.handle-point').style.stroke = cycVar(i, 'text');
      g.setAttribute('aria-label', 'Critical point c' + (i + 1) + ' at ' + fmtC(c) + '. The arrow keys move it.');
    });
  }

  /* ---------- the plane of values ---------- */
  function drawZ() {
    const { ctx } = MM.fitCanvas(zcv), V = view(frame.zv, zcv), vals = model.P.vals, z = state.z, red = MM.color('red');
    drawAxes(ctx, V, ['$\\mathrm{Re}\\,z$', '$\\mathrm{Im}\\,z$']);
    // the Stokes rays: z_k seen from z on the way to z_j
    const far = 4 * frame.zv.R;
    vals.forEach((zj, j) => vals.forEach((zk, k) => {
      if (j === k) return;
      const L = dist(zk, zj), on = model.onRay && model.onRay.j === j && model.onRay.k === k;
      ctx.strokeStyle = on ? red : MM.rgba('red', 0.45);
      ctx.lineWidth = on ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(V.X(zk[0]), V.Y(zk[1]));
      ctx.lineTo(V.X(zk[0] + (zk[0] - zj[0]) / L * far), V.Y(zk[1] + (zk[1] - zj[1]) / L * far));
      ctx.stroke();
    }));
    // the straight paths from z
    ctx.lineCap = 'round';
    vals.forEach((v, j) => {
      ctx.strokeStyle = cyc(j, 'line'); ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(V.X(z[0]), V.Y(z[1])); ctx.lineTo(V.X(v[0]), V.Y(v[1])); ctx.stroke();
    });
    // z0, where the cycles were taken
    if (dist(z, state.z0) > 1e-9) {
      ctx.strokeStyle = MM.color('ink-2'); ctx.fillStyle = MM.color('surface'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(V.X(state.z0[0]), V.Y(state.z0[1]), 4, 0, TAU); ctx.fill(); ctx.stroke();
      MM.canvasLabel(ctx, '$z_0$', V.X(state.z0[0]) - 8, V.Y(state.z0[1]) + 3, { size: 14, align: 'right', baseline: 'top', color: MM.color('ink-2') });
    }
    vals.forEach((v, j) => {
      ctx.fillStyle = cyc(j);
      ctx.beginPath(); ctx.arc(V.X(v[0]), V.Y(v[1]), 5, 0, TAU); ctx.fill();
      MM.canvasLabel(ctx, '$z_{' + (j + 1) + '}$', V.X(v[0]), V.Y(v[1]) - 11, { size: 14, align: 'center', baseline: 'bottom', color: cyc(j, 'text') });
    });
    const zx = V.X(z[0]), zy = V.Y(z[1]);
    zh.style.transform = 'translate(' + zx.toFixed(1) + 'px,' + zy.toFixed(1) + 'px)';
    MM.canvasLabel(ctx, '$z$', zx + 13, zy + 13, { size: 15, align: 'left', baseline: 'top', color: MM.color('ink') });
    zh.setAttribute('aria-valuetext', 'z = ' + fmtC(z) + (model.atVal !== null ? ', at z' + (model.atVal + 1) : ''));
  }

  /* ---------- readouts ---------- */
  const D = (k) => '<span class="pl-d" style="color:' + cycVar(k, 'text') + '">$\\Delta_{' + (k + 1) + '}$</span>';
  function combo(col) {
    let s = '';
    col.forEach((c, k) => {
      if (!c) return;
      const a = Math.abs(c);
      s += s ? (c < 0 ? ' $-$ ' : ' $+$ ') : (c < 0 ? '$-$' : '');
      s += (a !== 1 ? '$' + a + '$' : '') + D(k);
    });
    return s || '$0$';
  }
  const fTex = () => 'f=p(x)' + ['', '+y_2^2', '+y_2^2+y_3^2'][state.n - 1];
  const SUB = [
    'For $n=1$, $V_z$ is the roots of $p(x)=z$, and a vanishing cycle is the difference of two of them.',
    'For $n=2$, $V_z$ is a curve, a double cover of the plane of $x$ branched at the roots of $p(x)=z$, with the two points $\\pm y$, $y^2=z-p(x)$, over each other point; a vanishing cycle is the circle over an arc.',
    'For $n=3$, $V_z$ is a surface fibred over the plane of $x$ by the conics $y_2^2+y_3^2=z-p(x)$, which degenerate at the roots of $p(x)=z$; a vanishing cycle is the sphere made of their circles over an arc.',
  ];
  function drawReadouts() {
    const n = state.n, mu = state.mu, S0 = model.ref.S[n], B = model.B[n];
    MM.setHTML($('title'), '$' + fTex() + '$ <span class="side-kind">near $\\mathrm{A}_{' + mu + '}$</span>');
    MM.setHTML($('sub'), '$p\'(x)=' + (mu + 1) + state.crit.map((_, i) => '(x-c_{' + (i + 1) + '})').join('') + '$. ' + SUB[n - 1]);
    MM.setHTML($('legend'), legendHTML());
    // where z is: on a critical value, on a Stokes ray, or just across one
    let note = '';
    if (model.atVal !== null) note = '$z=z_{' + (model.atVal + 1) + '}$: ' + D(model.atVal) + ' has shrunk to the point $c_{' + (model.atVal + 1) + '}$, where $V_z$ is singular.';
    else if (model.onRay) {
      const { j, k } = model.onRay, S = PL.matmul(PL.transpose(B), PL.matmul(S0, B)), t = S[j][k];
      const e = PL.eps(n), hk = t ? '$' + (e * t > 0 ? '+' : '-') + (Math.abs(t) === 1 ? '' : Math.abs(t)) + '$' + D(k) : '';
      note = 'On a Stokes ray: the path to $z_{' + (j + 1) + '}$ runs through $z_{' + (k + 1) + '}$, and ' + D(j) + ' runs into $c_{' + (k + 1) + '}$. Across the ray, ' + D(j) + ' changes by $h_{' + (k + 1) + '}^{\\pm1}$: by ' + (t ? hk + ' or its negative' : 'nothing, as $\\langle\\Delta_{' + (j + 1) + '},\\Delta_{' + (k + 1) + '}\\rangle=0$') + '.';
    } else if (model.flash && performance.now() - model.flash.at < 2500) {
      const { j, k, s } = model.flash;
      note = 'Across the Stokes ray, ' + D(j) + ' became $h_{' + (k + 1) + '}^{' + (s > 0 ? '-1' : '1') + '}$ of what it was: the path to $z_{' + (j + 1) + '}$ now passes on the other side of $z_{' + (k + 1) + '}$.';
    }
    MM.setHTML($('note'), note);
    $('note-block').hidden = !note;
    // the cycles taken at z0, carried along with z, in the basis at z
    const Hinv = PL.inverse(B), triv = Hinv.every((r, i) => r.every((x, j) => x === +(i === j)));
    const rows = [];
    for (let j = 0; j < mu; j++) rows.push('<p>$h($' + D(j) + '$)=$ ' + combo(Hinv.map((r) => r[j])) + '</p>');
    MM.setHTML($('mono'), triv ? '<p>$h=\\mathrm{id}$</p>' : rows.join(''));
    const e = PL.eps(n);
    MM.setHTML($('rule'), '$h_i(a)=a' + (e < 0 ? '-' : '+') + '\\langle a,\\Delta_i\\rangle\\,\\Delta_i$');
    // the intersection form of the basis at z
    const S = PL.matmul(PL.transpose(B), PL.matmul(S0, B)), box = $('form'), key = n + ':' + JSON.stringify(S);
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      MM.matrix(box, S.map((r) => r.map((x) => (x < 0 ? '-' + -x : String(x)))), 'The intersection numbers of the vanishing cycles');
    }
  }
  function legendHTML() {
    const item = (mark, text) => '<span class="legend-item">' + mark + text + '</span>';
    const three = (body) => '<svg class="pl-key" viewBox="0 0 26 18" aria-hidden="true">' + body + '</svg>';
    const cyclesMark = state.arcs ? three('<path d="M2 9H24" style="stroke:var(--cy-1-line);stroke-width:2.2"/><path d="M11 5L15 9L11 13" style="fill:none;stroke:var(--cy-1-line);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"/>') : [
      three('<line x1="4" y1="9" x2="22" y2="9" style="stroke:var(--cy-1-line);stroke-dasharray:1.5 3;stroke-width:1.4"/><circle cx="5" cy="9" r="4.2" style="fill:var(--surface);stroke:var(--cy-1-text);stroke-width:1.4"/><circle cx="21" cy="9" r="4.2" style="fill:var(--cy-1);stroke:var(--cy-1-text);stroke-width:1.4"/>'),
      three('<path d="M2 9Q13 1 24 9" style="fill:none;stroke:var(--cy-1-line);stroke-width:2"/><path d="M2 9Q13 17 24 9" style="fill:none;stroke:var(--cy-1-line);stroke-width:2;stroke-dasharray:4 3"/>'),
      three('<path d="M2 9Q13 0 24 9Q13 18 2 9Z" style="fill:none;stroke:var(--cy-1-line);stroke-width:2"/><ellipse cx="13" cy="9" rx="2.2" ry="4.5" style="fill:none;stroke:var(--cy-1-line);stroke-width:1.1"/>'),
    ][state.n - 1];
    return item(cyclesMark, state.arcs ? 'the arcs of the vanishing cycles $\\Delta_i$' : 'vanishing cycles $\\Delta_i$')
      + (state.phase ? '' : item('<span class="pl-shade"></span>', 'where $|p(x)-z|$ is small'))
      + item('<svg class="pl-key" viewBox="-11 -9 22 18" aria-hidden="true"><circle r="3.8" style="fill:var(--ink)"/></svg>', state.n === 1 ? 'the points of $V_z$' : 'the roots of $p(x)=z$')
      + item('<svg class="pl-key" viewBox="-11 -10 22 20" aria-hidden="true"><circle class="handle-point" r="8" style="stroke:var(--cy-1-text);stroke-width:2.2"/><text class="handle-num" y="3.9">1</text></svg>', 'critical points $c_i$')
      + item('<svg class="pl-key" viewBox="-11 -9 22 18" aria-hidden="true"><circle r="5" style="fill:var(--cy-1)"/></svg>', 'critical values $z_i=p(c_i)$')
      + item('<svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="--c:var(--cy-1-line);--line-width:2.2"><path d="M1 5H21"/></svg>', 'paths from $z$')
      + item('<svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="--c:var(--red);--line-width:1.4"><path d="M1 5H21"/></svg>', 'Stokes rays');
  }

  let frameReq = 0, coarse = false;
  function draw() {
    frameReq = 0;
    drawX(coarse);
    drawZ();
    drawReadouts();
    if (example) example.changed();
    if (window.PLFigures && window.PLFigures.update) window.PLFigures.update();
    // sharpen once things rest
    clearTimeout(sharpTimer);
    if (coarse) sharpTimer = setTimeout(() => { coarse = false; if (state.phase) drawX(false); }, 180);
  }
  const later = () => { if (!frameReq) frameReq = requestAnimationFrame(draw); };

  /* ---------- dragging ---------- */
  let drag = null;
  const localXY = (e, elm) => { const r = elm.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const capture = (elm, e) => { try { elm.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ } };
  MM.handle(zh);
  function startZ(e, onHandle) {
    stopTravel();
    const V = view(frame.zv, zcv), [px, py] = localXY(e, zcv);
    drag = { kind: 'z', off: onHandle ? [V.x(px) - state.z[0], V.y(py) - state.z[1]] : [0, 0] };
    coarse = true;
    if (!onHandle) dragZ(e);
  }
  function dragZ(e) {
    const V = view(frame.zv, zcv), [px, py] = localXY(e, zcv);
    moveZ([V.x(px) - drag.off[0], V.y(py) - drag.off[1]]);
    coarse = true;
    later();
  }
  function endDrag() {
    if (!drag) return;
    const was = drag;
    drag = null;
    if (was.kind === 'crit') {
      // the windows refitted round the new critical values, if they have left them
      const P = PL.poly(state.crit), v = frame.zv;
      if (P.vals.some((q) => Math.abs(q[0] - v.cx) > 0.92 * v.R || Math.abs(q[1] - v.cy) > 0.92 * v.R)) { fit(); phase.key = ''; }
      build(model);
    }
    keep();
    coarse = false;
    draw();
  }
  zh.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    capture(zh, e);
    zh.focus({ preventScroll: true });
    startZ(e, true);
  });
  // with a mouse or a pen a press anywhere in the plane of values takes z there; a finger scrolls
  // the page unless it starts on the handle
  zcv.addEventListener('pointerdown', (e) => {
    if (e.button || e.pointerType === 'touch') return;
    e.preventDefault();
    capture(zcv, e);
    startZ(e, false);
  });
  [zh, zcv].forEach((elm) => {
    elm.addEventListener('pointermove', (e) => { if (drag && drag.kind === 'z') dragZ(e); });
    elm.addEventListener('pointerup', endDrag);
    elm.addEventListener('pointercancel', endDrag);
  });
  zh.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!k && e.key !== 'Home') return;
    e.preventDefault();
    stopTravel();
    if (k) { const st = (e.shiftKey ? 2 : 8) * zUnit(); moveZ([state.z[0] + k[0] * st, state.z[1] + k[1] * st]); }
    else moveZ(state.z0.slice());
    keep();
    draw();
  });

  // the critical points move freely (only not onto one another); the cycles are taken afresh at z
  function setCrit(i, c) {
    const V = view(frame.xv, xcv), lim = frame.xv.R - 10 / V.k;
    c = [clamp(c[0], -lim, lim), clamp(c[1], -lim, lim)];
    for (let j = 0; j < state.crit.length; j++) {
      if (j === i) continue;
      const d = dist(c, state.crit[j]), m = 4 / V.k;
      if (d < m) { const u = d > 0 ? [(c[0] - state.crit[j][0]) / d, (c[1] - state.crit[j][1]) / d] : [1, 0]; c = [state.crit[j][0] + u[0] * m, state.crit[j][1] + u[1] * m]; }
    }
    state.crit[i] = c;
    build(model);
  }
  xsvg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.pl-pt');
    if (!g || e.button) return;
    e.preventDefault();
    stopTravel();
    capture(g, e);
    g.focus({ preventScroll: true });
    const i = +g.dataset.i, V = view(frame.xv, xcv), [px, py] = localXY(e, xcv);
    drag = { kind: 'crit', i, off: [V.x(px) - state.crit[i][0], V.y(py) - state.crit[i][1]] };
  });
  xsvg.addEventListener('pointermove', (e) => {
    if (!drag || drag.kind !== 'crit') return;
    const V = view(frame.xv, xcv), [px, py] = localXY(e, xcv);
    setCrit(drag.i, [V.x(px) - drag.off[0], V.y(py) - drag.off[1]]);
    coarse = true;
    later();
  });
  xsvg.addEventListener('pointerup', endDrag);
  xsvg.addEventListener('pointercancel', endDrag);
  xsvg.addEventListener('keydown', (e) => {
    const g = e.target.closest('.pl-pt'), k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!g || !k) return;
    e.preventDefault();
    stopTravel();
    const i = +g.dataset.i, st = (e.shiftKey ? 1 : 4) / view(frame.xv, xcv).k;
    setCrit(i, [state.crit[i][0] + k[0] * st, state.crit[i][1] + k[1] * st]);
    keep();
    draw();
  });

  /* ---------- loops from the bar ---------- */
  // z travels without the holds (the critical values aside, which it goes round)
  function rawMove(t) {
    if (model.atVal !== null) { state.z = model.zi.slice(); model.atVal = null; }
    stepZ(t);
    model.onRay = null;
    state.z = t.slice();
    normalise();
  }
  // The loop τ_i from z: straight towards z_i, once round it counterclockwise, and back; or a circle
  // round all the critical values, counterclockwise, through z.
  function loopPath(i) {
    const z = model.atVal !== null ? model.zi : state.z, vals = model.P.vals, pts = [];
    if (i === 'all') {
      let cx = 0, cy = 0;
      vals.forEach((v) => { cx += v[0] / vals.length; cy += v[1] / vals.length; });
      let R = dist(z, [cx, cy]);
      const out = R;
      vals.forEach((v) => { R = Math.max(R, dist(v, [cx, cy]) + 14 * zUnit()); });
      const a0 = Math.atan2(z[1] - cy, z[0] - cx);
      if (R > out) pts.push([cx + R * Math.cos(a0), cy + R * Math.sin(a0)]);
      for (let q = 1; q <= 96; q++) pts.push([cx + R * Math.cos(a0 + TAU * q / 96), cy + R * Math.sin(a0 + TAU * q / 96)]);
      pts.push(z.slice());
      return pts;
    }
    const v = vals[i], d = dist(v, z);
    let r = Math.min(0.5 * d, 40 * zUnit());
    vals.forEach((w, j) => { if (j !== i) r = Math.min(r, 0.45 * dist(w, v)); });
    r = Math.max(r, 4 * zUnit());
    const ux = (z[0] - v[0]) / d, uy = (z[1] - v[1]) / d, a0 = Math.atan2(uy, ux);
    if (d > r) pts.push([v[0] + ux * r, v[1] + uy * r]);
    for (let q = 1; q <= 48; q++) pts.push([v[0] + r * Math.cos(a0 + TAU * q / 48), v[1] + r * Math.sin(a0 + TAU * q / 48)]);
    pts.push(z.slice());
    return pts;
  }
  let anim = null;
  function travel(pts, done) {
    stopTravel();
    if (MM.reduceMotion()) { pts.forEach(rawMove); if (done) done(); draw(); return; }
    const speed = 1.8 * frame.Rc / 1000;
    anim = { pts, i: 0, t: performance.now(), done };
    const tick = (now) => {
      if (!anim) return;
      let budget = speed * Math.min(80, now - anim.t);
      anim.t = now;
      while (budget > 0 && anim.i < anim.pts.length) {
        const p = anim.pts[anim.i], d = dist(p, state.z);
        if (d <= budget) { rawMove(p); budget -= d; anim.i++; }
        else { const f = budget / d; rawMove([state.z[0] + (p[0] - state.z[0]) * f, state.z[1] + (p[1] - state.z[1]) * f]); budget = 0; }
      }
      coarse = true;
      draw();
      if (anim.i >= anim.pts.length) { const fin = anim.done; anim = null; if (fin) fin(); coarse = false; draw(); }
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function stopTravel() { if (anim) { const fin = anim.done; anim = null; if (fin) fin(); } }
  const menu = $('round');
  function setMenu() {
    menu.items = model.P.vals.map((_, i) => ({ value: String(i), label: 'Once round $z_{' + (i + 1) + '}$' })).concat([{ value: 'all', label: 'Once round all of them' }]);
  }
  menu.addEventListener('change', (e) => {
    const i = e.detail.value === 'all' ? 'all' : +e.detail.value;
    stopTravel();
    if (model.atVal !== null) { state.z = model.zi.slice(); model.atVal = null; }
    model.onRay = null;
    rebase();
    travel(loopPath(i), () => { keep(); });
  });

  /* ---------- undo ---------- */
  let back = [], forth = [], now = null;
  const copyB = (B) => ({ 1: B[1].map((r) => r.slice()), 2: B[2].map((r) => r.slice()), 3: B[3].map((r) => r.slice()) });
  const snap = () => ({ crit: state.crit.map((c) => c.slice()), z: state.z.slice(), z0: state.z0.slice(), zi: model.zi.slice(), rts: model.rts.map((q) => q.slice()), ref: model.ref, B: copyB(model.B), atVal: model.atVal, onRay: model.onRay });
  function restore(s) {
    state.crit = s.crit.map((c) => c.slice()); state.z = s.z.slice(); state.z0 = s.z0.slice();
    model = { P: PL.poly(state.crit), rts: s.rts.map((q) => q.slice()), ref: s.ref, zi: s.zi.slice(), B: copyB(s.B), atVal: s.atVal, onRay: s.onRay, flash: null };
    draw();
  }
  function keep() { undoButtons.keep(back, now); now = snap(); forth.length = 0; undoButtons.update(); }
  function forget() { back = []; forth = []; now = snap(); undoButtons.update(); }
  const undoButtons = MM.undoRedo({
    undo() { if (!back.length || drag || anim) return; forth.push(now); now = back.pop(); restore(now); },
    redo() { if (!forth.length || drag || anim) return; back.push(now); now = forth.pop(); restore(now); },
    canUndo: () => back.length > 0,
    canRedo: () => forth.length > 0,
  });

  /* ---------- the bar ---------- */
  const SHAPE = ['Points', 'Circles', 'Spheres'];
  function setN(n) {
    state.n = n;
    $('shape-sphere').textContent = SHAPE[n - 1];
  }
  $('n').addEventListener('change', (e) => { setN(+e.detail.value); draw(); window.dispatchEvent(new CustomEvent('pl:n', { detail: state.n })); });
  // the cycles as their arcs or as what they are: the spheres shrink onto their arcs, or grow
  let shapeReq = 0;
  function setShape(arcs, now) {
    state.arcs = arcs;
    cancelAnimationFrame(shapeReq);
    const goal = arcs ? 0 : 1, from = shapeT, t0 = performance.now(), dur = 500;
    drawReadouts();
    if (now || MM.reduceMotion()) { shapeT = goal; draw(); return; }
    const tick = (tn) => {
      const u = Math.min(1, (tn - t0) / dur), e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);
      shapeT = from + (goal - from) * e;
      drawX(coarse);
      if (u < 1) shapeReq = requestAnimationFrame(tick);
      else if (example) example.changed();
    };
    shapeReq = requestAnimationFrame(tick);
  }
  $('shape').addEventListener('change', (e) => setShape(e.detail.value === 'arc'));
  $('phase').addEventListener('change', (e) => { state.phase = e.detail.pressed; draw(); });
  function chooseMu(mu, crit, z) {
    stopTravel();
    state.mu = mu;
    state.crit = (crit || DEFAULTS[mu]).map((c) => c.slice());
    state.z = null; state.z0 = null;
    fit();
    state.z = z ? z.slice() : [0, -1.25 * frame.Rc];
    fit();
    build();
    buildCrit();
    setMenu();
    phase.key = '';
  }
  $('mu').addEventListener('change', (e) => { chooseMu(+e.detail.value); forget(); draw(); });

  /* ---------- start ---------- */
  chooseMu(state.mu);
  now = snap();
  draw();
  example = MM.example({
    fields: { n: 'int', m: 'int', c: MM.example.numbers(3), z: MM.example.numbers(3), a: 'int', ph: 'int' },
    get: () => ({ n: state.n, m: state.mu, c: state.crit.flat(), z: state.z.slice(), a: state.arcs ? 1 : 0, ph: state.phase ? 1 : 0 }),
    set(x, named) {
      if (![1, 2, 3].includes(x.n) || !DEFAULTS[x.m]) return false;
      let crit = DEFAULTS[x.m];
      if (named.has('c')) {
        if (!Array.isArray(x.c) || x.c.length !== 2 * x.m || x.c.some((v) => !isFinite(v))) return false;
        crit = [];
        for (let k = 0; k < x.m; k++) crit.push([x.c[2 * k], x.c[2 * k + 1]]);
      }
      if (named.has('z') && (!Array.isArray(x.z) || x.z.length !== 2 || x.z.some((v) => !isFinite(v)))) return false;
      setN(x.n);
      $('n').value = String(x.n);
      state.phase = x.ph === 1;
      $('phase').pressed = state.phase;
      $('shape').value = x.a === 1 ? 'arc' : 'sphere';
      setShape(x.a === 1, true);
      $('mu').value = String(x.m);
      chooseMu(x.m, crit, named.has('z') ? x.z : null);
      forget();
      draw();
      window.dispatchEvent(new CustomEvent('pl:n', { detail: state.n }));
    },
    pictures: () => [{ label: 'Plane of x', element: $('xplane') }, { label: 'Plane of values', element: $('zplane'), selected: false }].concat(window.PLFigures ? window.PLFigures.pictures() : []),
    redraw: () => { phase.key = ''; draw(); if (window.PLFigures) window.PLFigures.redraw(); },
    scene: {
      get: () => ({ z0: state.z0, zi: model.zi, rts: model.rts, B: model.B, atVal: model.atVal, onRay: model.onRay }),
      set(s) {
        state.z0 = s.z0.slice(); model.zi = s.zi.slice(); model.rts = s.rts.map((q) => q.slice()); model.B = copyB(s.B);
        model.atVal = s.atVal; model.onRay = s.onRay;
        draw();
      },
    },
  });
  // for the figures in the text
  window.PLMain = { state, get model() { return model; }, toScreen: (q) => { const V = view(frame.zv, zcv), r = zcv.getBoundingClientRect(); return [r.left + V.X(q[0]), r.top + V.Y(q[1])]; } };
  new ResizeObserver(() => { phase.key = ''; draw(); }).observe(xcv);
  new ResizeObserver(() => draw()).observe(zcv);
  MM.onFonts(draw);
})();
