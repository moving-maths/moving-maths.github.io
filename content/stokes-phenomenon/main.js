// Stokes phenomenon and resurgence: the figure and its readouts.
// The mathematics (thimbles, their jumps, the series, the integrals) is in stokes.js.
//
// The main picture is the plane of x for an action S with S' = Π (x − p_i): the landscape of
// the integrand |e^{−S/ħ}| (blue where it is large), the real and imaginary axes, the critical
// points p_i (handles), the thimbles J_i through them and the ascending paths K_i, and the path
// Γ itself, from one end (a handle in a valley at the rim) to the other, pushed some way along
// the upward flow of Re(S/ħ) by Flow; the points where it crossed the K_i are ringed. Beside it,
// the integral I(ħ) itself on a disc of the plane of ħ, coloured by its phase and darker near its
// zeros, with the handle of ħ; and the plane of values of S: the critical values S(p_i) and the
// rays S(p_i) + ħ·[0, ∞) that the thimbles map onto. A thimble jumps when its ray runs into
// another critical value; the handle holds at those Stokes rays, where the thimble runs into the
// other critical point. Under the pictures, Γ as a sum of thimbles, a term that has just entered
// it lit for a moment.
//
// Each degree keeps its own critical points, path, |ħ| and orientations; arg ħ is shared, and
// kept as a real number (the valleys turn with it, so after a whole turn Γ has moved on a valley).
(function () {
  'use strict';
  const St = window.Stokes;
  const $ = (id) => document.getElementById(id);
  const TAU = 2 * Math.PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const el = MM.svg;
  const xcv = $('xcv'), xctx = xcv.getContext('2d'), xsvg = $('xsvg'), plane = $('plane');
  const zcv = $('zcv'), zctx = zcv.getContext('2d'), hbarEl = $('hbar');
  const hcv = $('hcv'), hctx = hcv.getContext('2d'), hplane = $('hplane');

  /* ---------- the cases ---------- */

  // Each degree starts from a symmetric action: Airy's x³/3 − x, the quartic x²/2 + x⁴/4 of
  // φ⁴ theory in no dimensions, x⁵/5 − x. The path: for the cubic, Airy's (the thimble of −1
  // when ħ > 0); for the quartic the real line; for the quintic from the upper left to the right,
  // through p₃ = −1 and p₁ = 1. |ħ| about a tenth of the nearest difference of critical values.
  const PRESETS = {
    3: { crit: [[-1, 0], [1, 0]], gamma: [1, 2], r: 0.13 },
    4: { crit: [[0, 0], [0, 1], [0, -1]], gamma: [2, 0], r: 0.025 },
    5: { crit: [[1, 0], [0, 1], [-1, 0], [0, -1]], gamma: [2, 0], r: 0.11 },
  };
  const DEGREES = [3, 4, 5];
  const NAMES = { 3: 'Airy integral', 4: 'Pearcey integral', 5: 'Swallowtail integral' };
  const PHI0 = 0.6;                 // arg ħ as the page opens
  const RH_FIT = 0.6;               // the disc of ħ: |ħ| up to this times the largest difference of critical values
  const R_SPAN = 200;               // and down to that over this
  const FLOW0 = 0;                  // how far Γ has flowed as the page opens (a fraction of the slider)
  const TURN = 48;                  // seconds for a whole turn of ħ, with Turn on
  const HOLD = 0.9;                 // seconds Turn rests on a Stokes ray
  const FIT = 1.9;                  // the plane's half-width, in units of the spread of the critical points
  const MINSEP = 0.08;              // how close two critical points may come (× the spread)
  const NEW_FOR = 1600;             // milliseconds a term that has entered the sum is lit

  // the single source of truth; draw() renders everything from it
  const state = {
    deg: 3,
    phi: PHI0,                      // arg ħ, a real number
    cases: {},                      // each degree: { crit, gamma: [from, to], dirs, phiAt, r }
    zoom: 1,                        // the plane's magnification over its fit
    frame: null,                    // the plane's window: { c, R } (R before zoom)
    turn: false,                    // ħ turns on its own
    snap: null,                     // arg ħ rests on a Stokes ray: { i, theta } (the lifted angle)
    lit: -1,                        // the thimble pointed at in the sum
    flow: FLOW0,                    // how far Γ has flowed, 0 … 1
    focus: 0,                       // the critical point the figures in the text are about
  };
  const cur = () => state.cases[state.deg];
  function freshCase(d) {
    const p = PRESETS[d];
    return { crit: p.crit.map((q) => q.slice()), gamma: p.gamma.slice(), dirs: null, phiAt: state.phi, r: p.r };
  }
  for (const d of DEGREES) state.cases[d] = freshCase(d);
  const copyCase = (c) => ({ crit: c.crit.map((q) => q.slice()), gamma: c.gamma.slice(), dirs: c.dirs && c.dirs.map((q) => q.slice()), phiAt: c.phiAt, r: c.r });

  let example = null;                // links, reset and Save image (MM.example, at the end)

  /* ---------- the model: the thimbles and the sum, from the state ---------- */

  let model = null, raysCache = { key: '', rays: null };
  const critKey = (c) => c.crit.map((q) => q[0].toFixed(6) + ',' + q[1].toFixed(6)).join(';');
  // the orientations, carried to the current φ: from where they were kept, along the lift
  function dirsNow(c, act) {
    if (!c.dirs) return null;
    return St.directions(act, state.phi, St.turnDirs(c.dirs, c.phiAt, state.phi));
  }
  // the thimbles at φ, with the thimble that the snap says runs into a point followed into it
  function traceAt(act, phi, dirs, snapI) {
    const R = 30 * act.scale;
    return act.crit.map((p, i) => {
      const o = { R, hit: i === snapI ? 0.02 : 1e-7 };
      const plus = St.branch(act, i, phi, dirs[i], o), minus = St.branch(act, i, phi, St.scl(dirs[i], -1), o);
      return { i, d: dirs[i], plus, minus, from: minus.valley, to: plus.valley, hit: plus.hit >= 0 ? plus.hit : minus.hit };
    });
  }
  // the sum as it was, to light a term that enters it (not after a change of case, an undo, a link)
  let lastN = null, quiet = true, entered = { at: 0, terms: new Set() };
  function rebuild() {
    const c = cur(), act = St.action(c.crit);
    let dirs = dirsNow(c, act);
    let orient = false;
    if (!dirs) { dirs = St.directions(act, state.phi); orient = true; }
    let th = traceAt(act, state.phi, dirs, state.snap ? state.snap.i : -1);
    let n = St.decompose(act.m, th.map((t) => [t.from, t.to]), c.gamma[0], c.gamma[1]);
    // a case met for the first time: each thimble of Γ runs the way Γ does
    if (orient && n) {
      dirs = dirs.map((d, i) => (n[i] < 0 ? St.scl(d, -1) : d));
      th = traceAt(act, state.phi, dirs, -1);
      n = St.decompose(act.m, th.map((t) => [t.from, t.to]), c.gamma[0], c.gamma[1]);
    }
    c.dirs = dirs;
    c.phiAt = state.phi;
    // on a Stokes ray: the sums just before and just after it
    let before = null, after = null;
    if (state.snap) {
      const dm = St.turnDirs(dirs, state.phi, state.phi - 1e-6), dp = St.turnDirs(dirs, state.phi, state.phi + 1e-6);
      const tm = traceAt(act, state.phi - 1e-6, dm, -1), tp = traceAt(act, state.phi + 1e-6, dp, -1);
      before = St.decompose(act.m, tm.map((t) => [t.from, t.to]), c.gamma[0], c.gamma[1]);
      after = St.decompose(act.m, tp.map((t) => [t.from, t.to]), c.gamma[0], c.gamma[1]);
    }
    // where the thimbles jump: depends only on the critical points
    const key = critKey(c);
    if (raysCache.key !== key) raysCache = { key, rays: act.crit.map((p, i) => St.stokesRays(act, i, dirs, state.phi)) };
    // the landscape's scale: the spread of the critical values about their mean
    const Sbar = St.scl(act.values.reduce(St.add, St.C(0)), 1 / act.n);
    let sigma = 0;
    for (const v of act.values) sigma = Math.max(sigma, St.abs(St.sub(v, Sbar)));
    const nn = n || before;
    if (nn && lastN && !quiet && nn.length === lastN.length) {
      const terms = new Set();
      nn.forEach((x, i) => { if (x && x !== lastN[i]) terms.add(i); });
      if (terms.size) entered = { at: performance.now(), terms };
    }
    if (nn) lastN = nn.slice();
    quiet = false;
    // the disc of ħ, and |ħ| within it
    let span = 0;
    for (const a of act.values) for (const b of act.values) span = Math.max(span, St.abs(St.sub(a, b)));
    const RH = RH_FIT * Math.max(span, 1e-3);
    c.r = clamp(c.r, RH / R_SPAN, RH);
    model = { act, dirs, th, n: nn, before, after, rays: raysCache.rays, Sbar, sigma: Math.max(sigma, 0.02 * Math.pow(act.scale, act.m)), RH };
  }
  // the Stokes rays of the thimbles, by lifted angle near φ: [{ theta, i, js, mu }]
  function stokesNear(phi) {
    const out = [];
    model.rays.forEach((list, i) => list.forEach((r) => out.push({ i, theta: St.liftNear(r.theta, phi), js: r.js, mu: r.mu })));
    return out;
  }

  /* ---------- the plane of x: its window ---------- */

  function fitFrame() {
    const act = St.action(cur().crit);
    state.frame = { c: act.centre.slice(), R: FIT * act.scale };
  }
  function view(w, h) {
    const W = w || xcv.clientWidth, H = h || xcv.clientHeight, f = state.frame, R = f.R / state.zoom, k = Math.min(W, H) / (2 * R);
    return {
      W, H, k, R,
      X: (x) => W / 2 + (x - f.c[0]) * k, Y: (y) => H / 2 - (y - f.c[1]) * k,
      x: (px) => f.c[0] + (px - W / 2) / k, y: (py) => f.c[1] - (py - H / 2) / k,
    };
  }
  // where the ends of Γ are drawn: on a circle near the rim, in the valleys' directions
  const RIM = 0.44;
  const rimRadius = (V) => RIM * Math.min(V.W, V.H);
  function rimPoint(V, a) { const r = rimRadius(V); return [V.W / 2 + r * Math.cos(a), V.H / 2 - r * Math.sin(a)]; }

  /* ---------- colours, numbers ---------- */

  const rgbOf = (name) => { const m = MM.color(name).match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; };
  const thColor = (i) => MM.color('th-' + (i + 1));
  const thText = (i) => 'var(--th-' + (i + 1) + '-text)';
  const fmtN = (x) => { const r = Math.round(x * 100) / 100; return (r < 0 ? '−' : '') + Math.abs(r); };
  const fmtC = (p) => fmtN(p[0]) + (p[1] < 0 ? ' − ' : ' + ') + fmtN(Math.abs(p[1])) + 'i';
  const texNum = (x, d) => x.toFixed(d).replace(/\.?0+$/, '');
  const rTex = (r) => texNum(r, r < 0.01 ? 4 : r < 0.1 ? 3 : 2);
  const degOf = (phi) => { const d = Math.round(((phi * 180 / Math.PI) % 360 + 540) % 360 - 180); return d === -180 ? 180 : d; };

  /* ---------- drawing the plane of x ---------- */

  const land = document.createElement('canvas'), lctx = land.getContext('2d');
  const LAND_STEP = 3;               // CSS pixels per sample of the landscape
  const CONTOUR_STEP = 4;            // and of the grid its level lines are found on
  // g(x) = asinh(Re((S(x) − S̄) e^{−iφ}) / σ): the landscape, in a scale that grows slowly
  function landFn() {
    const s = model.act.s, rc = Math.cos(state.phi), rs = Math.sin(state.phi), sb = model.Sbar, sig = model.sigma;
    return (x, y) => {
      let re = 0, im = 0;
      for (let k = s.length - 1; k >= 0; k--) { const t = re * x - im * y + s[k][0]; im = re * y + im * x + s[k][1]; re = t; }
      return Math.asinh(((re - sb[0]) * rc + (im - sb[1]) * rs) / sig);
    };
  }
  // light blue where the integrand is large (g < 0), white where it dies
  function paintLand(ctx, V, g) {
    const w = Math.ceil(V.W / LAND_STEP), h = Math.ceil(V.H / LAND_STEP);
    if (land.width !== w || land.height !== h) { land.width = w; land.height = h; }
    const img = lctx.createImageData(w, h), d = img.data;
    const P = rgbOf('surface'), B = rgbOf('land');
    for (let j = 0; j < h; j++) {
      const y = V.y((j + 0.5) * LAND_STEP);
      for (let i = 0; i < w; i++) {
        const v = g(V.x((i + 0.5) * LAND_STEP), y);
        const a = 0.24 * (1 - Math.tanh(v / 1.1)) / 2;
        const o = 4 * (j * w + i);
        d[o] = P[0] + (B[0] - P[0]) * a; d[o + 1] = P[1] + (B[1] - P[1]) * a; d[o + 2] = P[2] + (B[2] - P[2]) * a; d[o + 3] = 255;
      }
    }
    lctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(land, 0, 0, w, h, 0, 0, w * LAND_STEP, h * LAND_STEP);
  }
  // level lines of g by marching squares: evenly in g (so ever further apart in Re(S/ħ)), and
  // the lines through the critical points a little darker
  function drawContours(ctx, V, g, fade) {
    const nx = Math.ceil(V.W / CONTOUR_STEP) + 1, ny = Math.ceil(V.H / CONTOUR_STEP) + 1;
    const G = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) G[j * nx + i] = g(V.x(i * CONTOUR_STEP), V.y(j * CONTOUR_STEP));
    const levels = [];
    for (let k = -14; k <= 14; k++) levels.push({ v: k * 0.55, a: 0.11 * fade });
    for (const p of model.act.crit) levels.push({ v: g(p[0], p[1]), a: 0.3 * fade });
    ctx.lineWidth = 1;
    for (const L of levels) {
      ctx.strokeStyle = MM.rgba('c1-text', L.a);
      ctx.beginPath();
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const a = G[j * nx + i] - L.v, b = G[j * nx + i + 1] - L.v, c = G[(j + 1) * nx + i + 1] - L.v, d = G[(j + 1) * nx + i] - L.v;
          const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
          if (code === 0 || code === 15) continue;
          const x0 = i * CONTOUR_STEP, y0 = j * CONTOUR_STEP, s = CONTOUR_STEP;
          const e = [];
          if ((a > 0) !== (b > 0)) e.push([x0 + s * a / (a - b), y0]);
          if ((b > 0) !== (c > 0)) e.push([x0 + s, y0 + s * b / (b - c)]);
          if ((d > 0) !== (c > 0)) e.push([x0 + s * d / (d - c), y0 + s]);
          if ((a > 0) !== (d > 0)) e.push([x0, y0 + s * a / (a - d)]);
          for (let q = 0; q + 1 < e.length; q += 2) { ctx.moveTo(e[q][0], e[q][1]); ctx.lineTo(e[q + 1][0], e[q + 1][1]); }
        }
      }
      ctx.stroke();
    }
  }
  // the real and imaginary axes through 0, named at their ends
  function drawAxes(ctx, V, names, small) {
    const X0 = V.X(0), Y0 = V.Y(0);
    ctx.strokeStyle = MM.rgba('ink', 0.32);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const hor = Y0 > 0 && Y0 < V.H, ver = X0 > 0 && X0 < V.W;
    if (hor) { ctx.moveTo(0, Y0); ctx.lineTo(V.W, Y0); }
    if (ver) { ctx.moveTo(X0, 0); ctx.lineTo(X0, V.H); }
    ctx.stroke();
    if (small) return;
    const opt = { size: 13, color: MM.color('ink-3') };
    if (hor) MM.canvasLabel(ctx, names[0], V.W - 6, Y0 + (Y0 < V.H - 20 ? 14 : -7), Object.assign({ align: 'right', baseline: 'middle' }, opt));
    if (ver) MM.canvasLabel(ctx, names[1], X0 + 6, 12, Object.assign({ align: 'left', baseline: 'middle' }, opt));
  }
  // a path of world points on the screen, cut a little outside it
  function screenPath(V, pts) {
    const out = [], m = 40;
    for (let k = 0; k < pts.length; k += 2) {
      const X = V.X(pts[k]), Y = V.Y(pts[k + 1]);
      out.push([X, Y]);
      if (X < -m || X > V.W + m || Y < -m || Y > V.H + m) break;
    }
    return out;
  }
  function strokePath(ctx, P) {
    if (P.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let k = 1; k < P.length; k++) ctx.lineTo(P[k][0], P[k][1]);
    ctx.stroke();
  }
  // the point at a fraction of a path's length, and the direction there
  function along(P, f) {
    let L = 0;
    for (let k = 1; k < P.length; k++) L += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
    let goal = f * L;
    for (let k = 1; k < P.length; k++) {
      const s = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
      if (goal <= s && s > 0) {
        const t = goal / s;
        return { x: P[k - 1][0] + t * (P[k][0] - P[k - 1][0]), y: P[k - 1][1] + t * (P[k][1] - P[k - 1][1]), dx: (P[k][0] - P[k - 1][0]) / s, dy: (P[k][1] - P[k - 1][1]) / s };
      }
      goal -= s;
    }
    return null;
  }
  function chevron(ctx, a, size) {
    const ux = a.dx, uy = a.dy, px = -uy, py = ux;
    ctx.beginPath();
    ctx.moveTo(a.x - ux * size + px * size * 0.8, a.y - uy * size + py * size * 0.8);
    ctx.lineTo(a.x + ux * size * 0.6, a.y + uy * size * 0.6);
    ctx.lineTo(a.x - ux * size - px * size * 0.8, a.y - uy * size - py * size * 0.8);
    ctx.stroke();
  }

  /* ---------- Γ and its flow ---------- */

  // Γ before the flow: in from far out along the direction of its first valley, through the
  // handle of that end, round near the middle of the window, out through the handle of the other
  // end and far out along its valley. Flow pushes every point of it up the landscape for a time
  // that grows as the square of the slider (the flow is slowed where S' is large, so that nothing
  // reaches infinity: the same paths, at other speeds), with points put in wherever neighbours
  // draw apart on the screen. The points where Γ crossed the ascending paths K_i are carried too.
  let gam = { key: '' };
  // the direction of an end of Γ: its valley's, or where a drag holds it, or on the way back
  function endAngle(e) {
    if (drag && drag.kind === 'end' && drag.e === e && drag.a !== undefined) return drag.a;
    if (glide && glide.e === e) return glide.a;
    return St.valleyAngle(model.act.m, state.phi, cur().gamma[e]);
  }
  function gammaKey(V) { return [critKey(cur()), state.phi.toFixed(7), endAngle(0).toFixed(6), endAngle(1).toFixed(6), state.flow.toFixed(4), state.frame.c.join(','), V.R.toFixed(6), V.W].join('|'); }
  function computeGamma(V) {
    const act = model.act, f = state.frame.c;
    const ta = endAngle(0), tb = endAngle(1);
    const ua = [Math.cos(ta), Math.sin(ta)], ub = [Math.cos(tb), Math.sin(tb)];
    const rr = rimRadius(V) / V.k, far = 3.2 * rr;
    const Ha = [f[0] + rr * ua[0], f[1] + rr * ua[1]], Hb = [f[0] + rr * ub[0], f[1] + rr * ub[1]];
    const Fa = [f[0] + far * ua[0], f[1] + far * ua[1]], Fb = [f[0] + far * ub[0], f[1] + far * ub[1]];
    // the bend: about the middle of the window, a little to one side, clear of a critical point there
    const d = [Hb[0] - Ha[0], Hb[1] - Ha[1]], dl = Math.hypot(d[0], d[1]) || 1;
    const C = [f[0] - 0.14 * act.scale * d[1] / dl, f[1] + 0.14 * act.scale * d[0] / dl];
    const bez = (t) => [(1 - t) * (1 - t) * Ha[0] + 2 * t * (1 - t) * C[0] + t * t * Hb[0], (1 - t) * (1 - t) * Ha[1] + 2 * t * (1 - t) * C[1] + t * t * Hb[1]];
    const at = (s) => {
      if (s < 0.12) { const t = s / 0.12; return [Fa[0] + (Ha[0] - Fa[0]) * t, Fa[1] + (Ha[1] - Fa[1]) * t]; }
      if (s > 0.88) { const t = (s - 0.88) / 0.12; return [Hb[0] + (Fb[0] - Hb[0]) * t, Hb[1] + (Fb[1] - Hb[1]) * t]; }
      return bez((s - 0.12) / 0.76);
    };
    let lmin = Infinity, lmax = 0;
    for (const s2 of act.second) { const l = St.abs(s2); lmin = Math.min(lmin, l); lmax = Math.max(lmax, l); }
    const T = 7 / lmin, tt = T * state.flow * state.flow;
    const cap = 3 * Math.pow(act.scale, act.n), dt = Math.min(0.06 / lmax, 0.02 * rr / cap);
    const go = (x0) => (tt > 0 ? St.flowPoint(act, state.phi, x0, tt, cap, dt) : x0);
    const pts = [];
    const N0 = 120;
    for (let q = 0; q <= N0; q++) { const s = q / N0; pts.push({ s, x: go(at(s)) }); }
    const scr = (x) => [V.X(x[0]), V.Y(x[1])];
    const shown = (p) => p[0] > -V.W * 0.4 && p[0] < V.W * 1.4 && p[1] > -V.H * 0.4 && p[1] < V.H * 1.4;
    for (let pass = 0; pass < 14 && pts.length < 1800; pass++) {
      let added = 0;
      for (let q = pts.length - 2; q >= 0; q--) {
        const a = pts[q], b = pts[q + 1], P = scr(a.x), Q = scr(b.x);
        if ((shown(P) || shown(Q)) && Math.hypot(P[0] - Q[0], P[1] - Q[1]) > 4.5 && b.s - a.s > 1e-9) {
          const s = (a.s + b.s) / 2;
          pts.splice(q + 1, 0, { s, x: go(at(s)) });
          added++;
        }
      }
      if (!added) break;
    }
    // the ascending paths, and where Γ before the flow crosses them
    const asc = act.crit.map((p, i) => {
      const dd = St.mul(model.dirs[i], [0, 1]), o = { R: 30 * act.scale };
      return [St.branch(act, i, state.phi + Math.PI, dd, o), St.branch(act, i, state.phi + Math.PI, St.scl(dd, -1), o)];
    });
    const path0 = [];
    for (let q = 0; q <= 240; q++) path0.push(at(q / 240));
    const cross = [];
    const seg = (p, q, r, t) => {
      const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [t[0] - r[0], t[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) < 1e-300) return null;
      const u = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den, v = ((r[0] - p[0]) * d1[1] - (r[1] - p[1]) * d1[0]) / den;
      return u >= 0 && u < 1 && v >= 0 && v < 1 ? u : null;
    };
    asc.forEach((halves) => halves.forEach((h) => {
      for (let k = 0; k + 3 < h.pts.length; k += 2) {
        const r = [h.pts[k], h.pts[k + 1]], t = [h.pts[k + 2], h.pts[k + 3]];
        for (let e = 0; e + 1 < path0.length; e++) {
          const u = seg(path0[e], path0[e + 1], r, t);
          if (u !== null) cross.push(go([path0[e][0] + u * (path0[e + 1][0] - path0[e][0]), path0[e][1] + u * (path0[e + 1][1] - path0[e][1])]));
        }
      }
    }));
    gam = { key: gammaKey(V), pts: pts.map((p) => p.x), orig: path0, asc, cross };
  }
  function drawGamma(ctx, V, k) {
    // where Γ was before the flow, grey and dashed
    if (state.flow > 0) {
      ctx.strokeStyle = MM.color('ink-3');
      ctx.lineWidth = k < 1 ? 1 : 1.6;
      ctx.setLineDash(k < 1 ? [3, 3] : [5, 4]);
      strokePath(ctx, gam.orig.map((x) => [V.X(x[0]), V.Y(x[1])]));
      ctx.setLineDash([]);
    }
    const P = gam.pts.map((x) => [V.X(x[0]), V.Y(x[1])]);
    ctx.strokeStyle = MM.color('gamma');
    ctx.lineWidth = k < 1 ? 1.5 : 2.3;
    // (a jump between neighbours far apart is where Γ went off to infinity: not drawn)
    ctx.beginPath();
    const pieces = [];
    let piece = [];
    for (let q = 0; q < P.length; q++) {
      if (q && Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]) > 0.5 * V.W) { pieces.push(piece); piece = []; }
      piece.push(P[q]);
    }
    pieces.push(piece);
    for (const pc of pieces) strokePath(ctx, pc);
    if (k < 1) return;
    // which way Γ runs: chevrons along what is in view
    const inView = pieces.map((pc) => pc.filter((p) => p[0] > 4 && p[0] < V.W - 4 && p[1] > 4 && p[1] < V.H - 4)).filter((pc) => pc.length > 4);
    ctx.lineWidth = 2.2;
    for (const pc of inView) for (const f of [0.3, 0.7]) { const a = along(pc, f); if (a) chevron(ctx, a, 6); }
  }
  // the plane into a canvas: at full size (k = 1), or small, as a copy beside a figure in the text
  function renderPlane(ctx, V, k) {
    MM.clearCanvas(ctx, MM.color('surface'));
    const g = landFn();
    paintLand(ctx, V, g);
    drawContours(ctx, V, g, k < 1 ? 0.7 : 1);
    drawAxes(ctx, V, ['$\\mathrm{Re}\\,x$', '$\\mathrm{Im}\\,x$'], k < 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const n = model.n || [];
    if (gam.key !== gammaKey(view())) computeGamma(view());
    // the ascending paths, dashed
    if (k === 1) {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      gam.asc.forEach((halves, i) => { ctx.strokeStyle = thColor(i); ctx.globalAlpha = 0.75; halves.forEach((b) => strokePath(ctx, screenPath(V, b.pts))); });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // the thimbles: those Γ is the sum of thick, the others thin; the one pointed at on a red halo
    const order = model.th.map((t, i) => i).sort((a, b) => Math.abs(n[a] || 0) - Math.abs(n[b] || 0));
    for (const i of order) {
      const t = model.th[i], inG = !!n[i];
      const paths = [screenPath(V, t.plus.pts), screenPath(V, t.minus.pts)];
      if (state.lit === i) {
        ctx.strokeStyle = MM.rgba('highlight', 0.35);
        ctx.lineWidth = inG ? 10 : 7;
        paths.forEach((P) => strokePath(ctx, P));
      }
      // the half that runs into another critical point, on a Stokes ray: red under it
      if (t.hit >= 0) {
        ctx.strokeStyle = MM.rgba('highlight', 0.32);
        ctx.lineWidth = 8;
        [t.plus, t.minus].forEach((b, q) => { if (b.hit >= 0) strokePath(ctx, paths[q]); });
      }
      ctx.strokeStyle = thColor(i);
      ctx.lineWidth = (inG ? 4 : 1.7) * (k < 1 ? 0.6 : 1);
      paths.forEach((P) => strokePath(ctx, P));
    }
    drawGamma(ctx, V, k);
    // where Γ crossed the ascending paths, carried along by the flow
    if (k === 1) {
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = MM.color('highlight');
      for (const x of gam.cross) { ctx.beginPath(); ctx.arc(V.X(x[0]), V.Y(x[1]), 5, 0, TAU); ctx.stroke(); }
    }
  }
  // the valleys: a faint tick on the rim at each, where an end of Γ may be put
  function drawValleys(ctx, V) {
    const m = model.act.m, r = rimRadius(V);
    ctx.strokeStyle = MM.color('ink-3');
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < m; k++) {
      const a = St.valleyAngle(m, state.phi, k), u = [Math.cos(a), -Math.sin(a)];
      ctx.beginPath();
      ctx.moveTo(V.W / 2 + u[0] * (r - 6), V.H / 2 + u[1] * (r - 6));
      ctx.lineTo(V.W / 2 + u[0] * (r + 6), V.H / 2 + u[1] * (r + 6));
      ctx.stroke();
    }
  }
  function drawPlane() {
    const V = view();
    renderPlane(xctx, V, 1);
    drawValleys(xctx, V);
    // Γ named by its first end
    const a = rimPoint(V, endAngle(0)), u = [a[0] - V.W / 2, a[1] - V.H / 2], ul = Math.hypot(u[0], u[1]) || 1;
    const lp = [a[0] - u[0] / ul * 26 + u[1] / ul * 16, a[1] - u[1] / ul * 26 - u[0] / ul * 16];
    xctx.fillStyle = MM.rgba('surface', 0.8);
    xctx.beginPath(); xctx.arc(lp[0], lp[1], 10, 0, TAU); xctx.fill();
    MM.canvasLabel(xctx, '$\\Gamma$', lp[0], lp[1], { size: 16, align: 'center', baseline: 'middle', color: MM.color('ink') });
    placeOverlay(V);
  }

  /* ---------- the overlay: critical points and the ends of Γ ---------- */

  let ptEls = [], endEls = [];
  function buildOverlay() {
    xsvg.textContent = '';
    ptEls = cur().crit.map((p, i) => {
      const g = el('g', { class: 'sp-pt draggable', tabindex: 0, role: 'button', 'data-i': i }, xsvg);
      el('circle', { class: 'sp-pad', r: 18 }, g);
      el('circle', { class: 'focus-ring', r: 12.5 }, g);
      el('circle', { class: 'handle-point', r: 8 }, g);
      el('text', { class: 'handle-num', y: 3.9 }, g).textContent = i + 1;
      return g;
    });
    endEls = [0, 1].map((e) => {
      const g = el('g', { class: 'sp-end draggable', tabindex: 0, role: 'slider', 'data-e': e }, xsvg);
      el('circle', { class: 'sp-pad', r: 20 }, g);
      MM.handle(el('g', {}, g), 6.5);
      return g;
    });
  }
  function placeOverlay(V) {
    const c = cur(), m = model.act.m;
    ptEls.forEach((g, i) => {
      const p = c.crit[i], X = V.X(p[0]), Y = V.Y(p[1]);
      g.setAttribute('transform', 'translate(' + X.toFixed(1) + ',' + Y.toFixed(1) + ')');
      // (a point moved out of the window by a zoom or a pan is not drawn over the page)
      g.style.display = X < -2 || X > V.W + 2 || Y < -2 || Y > V.H + 2 ? 'none' : '';
      g.querySelector('.handle-point').style.stroke = thColor(i);
      g.classList.toggle('is-lit', state.lit === i);
      g.setAttribute('aria-label', 'Critical point p' + (i + 1) + ' at ' + fmtC(p) + '. Arrow keys move it.');
    });
    endEls.forEach((g, e) => {
      const k = c.gamma[e], P = rimPoint(V, endAngle(e));
      g.setAttribute('transform', 'translate(' + P[0].toFixed(1) + ',' + P[1].toFixed(1) + ')');
      g.setAttribute('aria-label', (e ? 'Where the path Gamma goes out' : 'Where the path Gamma comes in') + ': valley ' + (St.mod(k, m) + 1) + ' of ' + m + '. Arrow keys move it to the next valley.');
      g.setAttribute('aria-valuetext', 'valley ' + (St.mod(k, m) + 1));
    });
  }

  /* ---------- the plane of values of S ---------- */

  function zview(w, h) {
    const W = w || zcv.clientWidth, H = h || zcv.clientHeight, act = model.act;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const v of act.values) { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
    const c = [(x0 + x1) / 2, (y0 + y1) / 2];
    const k = Math.min(0.36 * W / Math.max((x1 - x0) / 2, 1e-9), 0.3 * H / Math.max((y1 - y0) / 2, 1e-9), 0.36 * Math.min(W, H) / Math.max(1e-9, Math.hypot(x1 - x0, y1 - y0) / 2));
    return { W, H, k, c, X: (x) => W / 2 + (x - c[0]) * k, Y: (y) => H / 2 - (y - c[1]) * k };
  }
  // the critical values drawn where they are, those that coincide side by side across the rays
  function zDots(Z) {
    const act = model.act, u = [-Math.sin(state.phi), -Math.cos(state.phi)];
    const pos = act.values.map((v) => [Z.X(v[0]), Z.Y(v[1])]);
    const groups = [];
    pos.forEach((p, i) => { const g = groups.find((q) => Math.hypot(pos[q[0]][0] - p[0], pos[q[0]][1] - p[1]) < 1); if (g) g.push(i); else groups.push([i]); });
    for (const g of groups) {
      if (g.length < 2) continue;
      g.forEach((i, q) => { const o = (q - (g.length - 1) / 2) * 15; pos[i] = [pos[i][0] + u[0] * o, pos[i][1] + u[1] * o]; });
    }
    return pos;
  }
  function drawZeta() {
    const Z = zview(), ctx = zctx;
    MM.clearCanvas(ctx, MM.color('surface'));
    const e = [Math.cos(state.phi), -Math.sin(state.phi)];
    drawAxes(ctx, { W: Z.W, H: Z.H, X: Z.X, Y: Z.Y }, ['$\\mathrm{Re}\\,S$', '$\\mathrm{Im}\\,S$'], false);
    const pos = zDots(Z), n = model.n || [], far = Math.hypot(Z.W, Z.H);
    ctx.lineCap = 'round';
    if (state.snap) {
      const t = model.th[state.snap.i];
      if (t.hit >= 0) {
        ctx.strokeStyle = MM.rgba('highlight', 0.32);
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(pos[t.i][0], pos[t.i][1]); ctx.lineTo(pos[t.hit][0], pos[t.hit][1]); ctx.stroke();
      }
    }
    const order = pos.map((p, i) => i).sort((a, b) => Math.abs(n[a] || 0) - Math.abs(n[b] || 0));
    for (const i of order) {
      const p = pos[i], inG = !!n[i];
      if (state.lit === i) {
        ctx.strokeStyle = MM.rgba('highlight', 0.35);
        ctx.lineWidth = inG ? 9 : 7;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + e[0] * far, p[1] + e[1] * far); ctx.stroke();
      }
      ctx.strokeStyle = thColor(i);
      ctx.lineWidth = inG ? 3.2 : 1.6;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + e[0] * far, p[1] + e[1] * far); ctx.stroke();
    }
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i];
      ctx.fillStyle = thColor(i);
      ctx.strokeStyle = MM.color('surface');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = MM.color('surface');
      ctx.font = MM.font('sans', 10.5, 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p[0], p[1] + 0.5);
    }
  }

  /* ---------- the integral as a function of ħ ---------- */

  // I(ħ) on the disc |ħ| ≤ R of the plane of ħ, in ordinary coordinates. It is computed row by row,
  // a row for each of H_NA directions: the thimbles there and their integrals for H_NR moduli at
  // once (stokes.js, rayIntegrals), a few rows a frame. A pixel takes the branch of I continued
  // from ħ the short way round, so the picture has a cut on the ray opposite ħ; its colour is the
  // phase of I (the key), darkened where the terms Σ n_i ∫_{J_i} cancel, near the zeros of I. Since
  // a row's colours depend on ħ only through the branch it takes, only the rows the cut passes are
  // painted again as ħ turns.
  const H_NA = 360, H_NR = 32, H_MARGIN = 0.5, H_U = 6.5;
  let hData = { key: '' }, hReq = 0;
  function hview(w, h) {
    const W = w || hcv.clientWidth, H = h || hcv.clientHeight, D = 0.45 * Math.min(W, H), R = model.RH;
    return { W, H, D, R, k: D / R, cx: W / 2, cy: H / 2, X: (x) => W / 2 + x * D / R, Y: (y) => H / 2 - y * D / R };
  }
  const hKey = () => critKey(cur()) + '|' + model.RH.toPrecision(9);
  function hStart() {
    const key = hKey();
    if (hData.key !== key) {
      const R = model.RH, rhos = Array.from({ length: H_NR }, (_, r) => R * (r + 1) / H_NR);
      hData = {
        key, R, rhos, tgs: {}, rows: new Array(H_NA), next: 0,
        phi0: state.phi, dirs0: model.dirs.map((d) => d.slice()), sing: model.rays.map((l) => l.map((r) => r.theta)),
        cache: new Map(), ncache: new Map(), gkey: '', img: null,
      };
    }
    if (hData.next < H_NA && !hReq) hReq = soon(hStep);
  }
  function hStep() {
    hReq = 0;
    if (hData.key !== hKey()) { hStart(); return; }
    const t0 = performance.now();
    while (hData.next < H_NA && performance.now() - t0 < 10) hRow(hData.next++);
    drawH();
    if (hData.next < H_NA) hReq = soon(hStep);
  }
  function hRow(a) {
    const act = model.act, base = -Math.PI + TAU * (a + 0.5) / H_NA, th = St.liftNear(base, hData.phi0);
    const row = { th, T: [], ends: [] };
    for (let i = 0; i < act.n; i++) {
      const plan = St.rayPlan(th, hData.sing[i], H_MARGIN), alpha = plan.alpha, step = St.rayStep(plan.clear);
      // in a sector too narrow for any ray to keep clear of the singularities: the integral over the
      // thimble itself, for each modulus (a row or two of the picture at most)
      if (!step) {
        const d = St.turnDirs(hData.dirs0, hData.phi0, th)[i], T = new Float64Array(2 * H_NR);
        hData.rhos.forEach((rho, r) => { const v = St.integral(act, i, St.scl(St.cis(th), rho), d).v; T[2 * r] = v[0] / Math.sqrt(rho); T[2 * r + 1] = v[1] / Math.sqrt(rho); });
        const o = { R: 30 * act.scale };
        row.T.push(T);
        row.ends.push([St.branch(act, i, th, St.scl(d, -1), o).valley, St.branch(act, i, th, d, o).valley]);
        continue;
      }
      const tg = hData.tgs[step] || (hData.tgs[step] = St.rayTargets(hData.rhos, H_U, step));
      // (the ray is the row's own unless it is moved away from a singular direction; those are shared)
      const ck = i + ':' + alpha.toFixed(9), shared = Math.abs(alpha - th) > 1e-12;
      let ray = shared ? hData.cache.get(ck) : null;
      if (!ray) {
        ray = St.thimbleRay(act, i, alpha, St.turnDirs(hData.dirs0, hData.phi0, alpha)[i], tg);
        if (shared) hData.cache.set(ck, ray);
      }
      row.T.push(St.rayCombine(act, i, ray, th));
      row.ends.push(ray.ends);
    }
    hData.rows[a] = row;
  }
  // the coefficients of Γ for a row taken at its lift + 2πk (the valleys named one on for each turn)
  function hCoef(a, k) {
    const key = a + ':' + k;
    if (hData.ncache.has(key)) return hData.ncache.get(key);
    const m = model.act.m, c = cur();
    const n = St.decompose(m, hData.rows[a].ends.map(([f, t]) => [St.mod(f - k, m), St.mod(t - k, m)]), c.gamma[0], c.gamma[1]);
    hData.ncache.set(key, n);
    return n;
  }
  const hOff = document.createElement('canvas'), hoctx = hOff.getContext('2d');
  // the colours: every pixel of the rows whose branch (or whose data) is new
  function paintH(V) {
    if (!wheel) makeWheel();
    const w = Math.round(V.W), h = Math.round(V.H), gk = cur().gamma.join(',');
    let img = hData.img;
    const fresh = !img || img.w !== w || img.h !== h || hData.gkey !== gk;
    if (hData.gkey !== gk) { hData.ncache = new Map(); hData.gkey = gk; }
    if (fresh) {
      img = hData.img = { w, h, data: new ImageData(w, h), ks: new Array(H_NA).fill(null), row: new Int16Array(w * h), rho: new Float32Array(w * h), th: new Float32Array(w * h) };
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const q = py * w + px, x = (px + 0.5 - V.cx) / V.k, y = -(py + 0.5 - V.cy) / V.k, r = Math.hypot(x, y), t = Math.atan2(y, x);
        img.rho[q] = r; img.th[q] = t;
        // (outside the disc, and ħ = 0 itself, where I has its essential singularity, are left white)
        img.row[q] = r > V.R || r < 1e-9 * V.R ? -1 : Math.min(H_NA - 1, Math.floor((t + Math.PI) / TAU * H_NA));
      }
    }
    // the rows to paint: the branch each takes now
    const todo = new Uint8Array(H_NA);
    let any = false;
    for (let a = 0; a < H_NA; a++) {
      const row = hData.rows[a];
      const k = row ? Math.round((St.liftNear(row.th, state.phi) - row.th) / TAU) : null;
      if (k !== img.ks[a] || fresh) { todo[a] = 1; img.ks[a] = k; any = true; }
    }
    if (!any) return img;
    const d = img.data.data, S = rgbOf('surface'), G = rgbOf('sunken'), vals = model.act.values, nT = model.act.n;
    const re = new Float64Array(nT), im = new Float64Array(nT);
    for (let q = 0; q < w * h; q++) {
      const a = img.row[q], o = 4 * q;
      if (a < 0) { if (fresh) { d[o] = S[0]; d[o + 1] = S[1]; d[o + 2] = S[2]; d[o + 3] = 255; } continue; }
      if (!todo[a]) continue;
      const row = hData.rows[a];
      const n = row ? hCoef(a, img.ks[a]) : null;
      if (!n) { d[o] = G[0]; d[o + 1] = G[1]; d[o + 2] = G[2]; d[o + 3] = 255; continue; }
      const rho = img.rho[q], t = img.th[q], ct = Math.cos(t), st = Math.sin(t);
      const fr = rho / hData.R * H_NR - 1, r0 = Math.max(0, Math.min(H_NR - 2, Math.floor(fr))), u = Math.max(0, Math.min(1, fr - r0));
      // the exponents −S(p_i)/ħ, and the largest real part among the terms of Γ
      let emax = -Infinity;
      for (let i = 0; i < nT; i++) {
        re[i] = -(vals[i][0] * ct + vals[i][1] * st) / rho;
        im[i] = -(vals[i][1] * ct - vals[i][0] * st) / rho;
        if (n[i] && re[i] > emax) emax = re[i];
      }
      let sr = 0, si = 0, mag = 0;
      for (let i = 0; i < nT; i++) {
        if (!n[i]) continue;
        const T = row.T[i], tr = T[2 * r0] + u * (T[2 * r0 + 2] - T[2 * r0]), ti = T[2 * r0 + 1] + u * (T[2 * r0 + 3] - T[2 * r0 + 1]);
        const f = n[i] * Math.exp(re[i] - emax), c = Math.cos(im[i]), s2 = Math.sin(im[i]);
        const ar = f * (tr * c - ti * s2), ai = f * (tr * s2 + ti * c);
        sr += ar; si += ai; mag += Math.hypot(ar, ai);
      }
      if (!(Number.isFinite(sr) && Number.isFinite(si))) { d[o] = G[0]; d[o + 1] = G[1]; d[o + 2] = G[2]; d[o + 3] = 255; continue; }
      const col = wheelAt(Math.atan2(si, sr)), qz = mag > 0 ? Math.hypot(sr, si) / mag : 1, sh = 0.4 + 0.6 * Math.pow(qz, 0.45);
      d[o] = col[0] * sh; d[o + 1] = col[1] * sh; d[o + 2] = col[2] * sh; d[o + 3] = 255;
    }
    if (hOff.width !== w || hOff.height !== h) { hOff.width = w; hOff.height = h; }
    hoctx.putImageData(img.data, 0, 0);
    return img;
  }
  function drawH() {
    if (!model || !hcv.clientWidth) return;
    // (while a critical point is dragged the colours of the case before stay, faded; they are
    // worked out afresh once it is let go)
    const stale = hData.key !== hKey() && drag && drag.kind === 'pt';
    if (hData.key !== hKey() && !stale) hStart();
    const V = hview();
    MM.clearCanvas(hctx, MM.color('surface'));
    if (!stale) paintH(V);
    hctx.imageSmoothingEnabled = true;
    hctx.globalAlpha = stale ? 0.35 : 1;
    if (hOff.width) hctx.drawImage(hOff, 0, 0, V.W, V.H);
    hctx.globalAlpha = 1;
    drawAxes(hctx, { W: V.W, H: V.H, X: V.X, Y: V.Y }, ['$\\mathrm{Re}\\,\\hbar$', '$\\mathrm{Im}\\,\\hbar$'], false);
    // the rim, named by its |ħ|
    hctx.strokeStyle = MM.color('rule');
    hctx.lineWidth = 1;
    hctx.beginPath(); hctx.arc(V.cx, V.cy, V.D, 0, TAU); hctx.stroke();
    const la = -Math.PI / 4;
    MM.canvasLabel(hctx, '$|\\hbar|=' + rTex(V.R) + '$', V.cx - V.D * Math.cos(la) - 6, V.cy - V.D * Math.sin(la) + 14, { size: 12, align: 'right', baseline: 'middle', color: MM.color('ink-3') });
    // the Stokes rays where the coefficients of Γ jump, and the ray opposite ħ where the picture is cut
    if (stokesData.key !== stokesKey()) computeStokes();
    const runs = stokesData.runs;
    hctx.lineWidth = 1.2;
    hctx.strokeStyle = MM.rgba('ink', 0.6);
    hctx.setLineDash([5, 4]);
    for (let q = 1; q < runs.length; q++) {
      const a = runs[q - 1].n, b = runs[q].n;
      if (!a || !b || a.every((x, i) => x === b[i])) continue;
      const t = runs[q].a;
      hctx.beginPath(); hctx.moveTo(V.cx, V.cy); hctx.lineTo(V.cx + V.D * Math.cos(t), V.cy - V.D * Math.sin(t)); hctx.stroke();
    }
    hctx.setLineDash([1.5, 3.5]);
    hctx.strokeStyle = MM.color('ink');
    const tc = state.phi + Math.PI;
    hctx.beginPath(); hctx.moveTo(V.cx, V.cy); hctx.lineTo(V.cx + V.D * Math.cos(tc), V.cy - V.D * Math.sin(tc)); hctx.stroke();
    hctx.setLineDash([]);
    // 0, where I has its essential singularity: the colours turn ever faster there
    hctx.fillStyle = MM.color('surface');
    hctx.beginPath(); hctx.arc(V.cx, V.cy, 5, 0, TAU); hctx.fill();
    hctx.fillStyle = MM.color('ink-2');
    hctx.beginPath(); hctx.arc(V.cx, V.cy, 2, 0, TAU); hctx.fill();
    const kr = Math.max(13, Math.min(18, 0.045 * Math.min(V.W, V.H)));
    drawPhaseKey(hctx, V.W - kr - 16, V.H - kr - 16, kr);
    // ħ: the handle (an element over the canvas, which centres itself on the point)
    const r = cur().r, hp = [V.cx + Math.cos(state.phi) * r * V.k, V.cy - Math.sin(state.phi) * r * V.k];
    hbarEl.style.transform = 'translate(' + hp[0].toFixed(1) + 'px,' + hp[1].toFixed(1) + 'px)';
    const dg = degOf(state.phi);
    hbarEl.setAttribute('aria-valuetext', 'arg ħ = ' + dg + '°, |ħ| = ' + rTex(r) + (state.snap ? ', on a Stokes ray' : ''));
    MM.setHTML($('hval'), '$|\\hbar|=' + rTex(r) + ',\\quad\\arg\\hbar=' + dg + '^\\circ$');
  }

  /* ---------- readouts ---------- */

  const term = (c, i, first) => {
    const s = first ? (c < 0 ? '-' : '') : c < 0 ? '{}-{}' : '{}+{}';
    const k = Math.abs(c) === 1 ? '' : String(Math.abs(c));
    const isNew = entered.terms.has(i) && performance.now() - entered.at < NEW_FOR;
    return (s ? '$' + s + '$' : '') + '<span class="sp-term' + (state.lit === i ? ' is-lit' : '') + (isNew ? ' is-new' : '') + '" data-i="' + i + '" tabindex="0" style="color:' + thText(i) + '">$' + k + 'J_{' + (i + 1) + '}$</span>';
  };
  function sumHTML(n) {
    let s = '', first = true;
    n.forEach((c, i) => { if (c) { s += term(c, i, first); first = false; } });
    return s || '$0$';
  }
  function legendHTML() {
    const item = (mark, text) => '<span class="legend-item">' + mark + text + '</span>';
    const two = (w, dash) => '<svg class="legend-line th" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5H11" style="stroke:var(--th-1);stroke-width:' + w + (dash ? ';stroke-dasharray:3 3' : '') + '"/><path d="M12 5H21" style="stroke:var(--th-2);stroke-width:' + w + (dash ? ';stroke-dasharray:3 3' : '') + '"/></svg>';
    return item('<svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="--line-width:2.3"><path d="M1 5H21"/></svg>', 'the path $\\Gamma$')
      + (state.flow > 0 ? item('<svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="--c:var(--ink-3)"><path d="M1 5H21" stroke-dasharray="5 4"/></svg>', '$\\Gamma$ before the flow') : '')
      + item('<svg class="sp-key" viewBox="-11 -9 22 18" aria-hidden="true"><circle r="7.5" class="handle-ring"/><circle r="6.2" class="handle-gap"/><circle r="4.9" class="handle-dot"/></svg>', 'its ends, in two valleys')
      + item('<svg class="sp-key" viewBox="-11 -9 22 18" aria-hidden="true"><circle class="handle-point" r="6.5" style="stroke:var(--th-1);stroke-width:1.8"/></svg>', 'critical points $p_i$')
      + item(two(1.7), 'thimbles $J_i$')
      + item(two(4), 'those in $\\Gamma$')
      + item(two(1.2, true), 'ascending paths $K_i$')
      + item('<svg class="sp-key" viewBox="-11 -9 22 18" aria-hidden="true"><circle r="5" style="fill:none;stroke:var(--highlight);stroke-width:1.8"/></svg>', 'where $\\Gamma$ crossed them')
      + item('<span class="sp-shade"></span>', 'where $|\\mathrm{e}^{-S/\\hbar}|$ is large');
  }
  // S written out: its coefficients rounded, those that round to 0 left out, i upright
  function actionTex() {
    const s = model.act.s, m = model.act.m;
    const r2 = (x) => Math.round(x * 100) / 100;
    const coef = (c) => {
      let re = r2(c[0]), im = r2(c[1]);
      const neg = re < 0 || (re === 0 && im < 0);
      if (neg) { re = -re; im = -im; }
      re = Math.abs(re) === 0 ? 0 : re;
      if (!im) return { v: re, tex: String(re), neg, one: re === 1, real: true };
      if (!re) return { v: im, tex: (Math.abs(im) === 1 ? '' : String(Math.abs(im))) + '\\mathrm{i}', neg, one: false, real: true, imag: true };
      return { tex: '(' + re + (im < 0 ? '-' : '+') + Math.abs(im) + '\\mathrm{i})', neg, one: false, real: false };
    };
    let out = '\\tfrac1{' + m + '}x^{' + m + '}';
    for (let k = m - 1; k >= 1; k--) {
      const c = coef(s[k]);
      if (c.real && c.v === 0) continue;
      const exact = { 0.5: '\\tfrac12', 0.33: '\\tfrac13', 0.25: '\\tfrac14' }[c.v];
      const body = exact && c.real && !c.imag ? exact : c.one ? '' : c.tex;
      out += (c.neg ? '-' : '+') + body + (k > 1 ? 'x^{' + k + '}' : 'x');
    }
    return 'S(x)=' + out;
  }
  function drawReadouts() {
    MM.setHTML($('title'), NAMES[state.deg]);
    MM.setHTML($('sub'), '$\\displaystyle\\int_\\Gamma\\mathrm{e}^{-S(x)/\\hbar}\\,dx$, &ensp;$' + actionTex() + '$');
    MM.setHTML($('legend'), legendHTML());
    MM.setHTML($('dec'), '$\\Gamma={}$' + (model.n ? sumHTML(model.n) : '…'));
    let jump = '';
    if (state.snap && model.before && model.after) {
      const t = model.th[state.snap.i], r = model.rays[state.snap.i].find((q) => Math.abs(St.liftNear(q.theta, state.phi) - state.snap.theta) < 1e-9);
      if (r) {
        let j = '$J_{' + (t.i + 1) + '}\\mapsto J_{' + (t.i + 1) + '}';
        r.js.forEach((q) => { j += (r.mu[q] < 0 ? '-' : '+') + (Math.abs(r.mu[q]) === 1 ? '' : Math.abs(r.mu[q])) + 'J_{' + (q + 1) + '}'; });
        j += '$';
        const changes = model.before.some((c, k) => c !== model.after[k]);
        jump = 'A <a href="#sec-stokes">Stokes ray</a>: $J_{' + (t.i + 1) + '}$ runs into $p_{' + r.js.map((q) => q + 1).join('},p_{') + '}$, and as $\\arg\\hbar$ grows, ' + j
          + (changes ? ', so that $\\Gamma={}$' + sumHTML(model.after) + '.' : '.');
      }
    }
    MM.setHTML($('jump'), jump);
  }

  /* ---------- drawing everything ---------- */

  // the next frame, or soon if frames do not come (a hidden page, the frame of Save image)
  function soon(fn) {
    let done = false;
    const run = () => { if (!done) { done = true; fn(); } };
    requestAnimationFrame(run);
    setTimeout(run, 150);
    return 1;
  }
  let frameReq = 0, newTimer = 0;
  function draw() {
    frameReq = 0;
    if (!model) return;
    drawPlane();
    drawH();
    drawZeta();
    drawReadouts();
    drawCopies();
    textDirty();
    // a lit term is let go once its moment is over
    clearTimeout(newTimer);
    if (entered.terms.size && performance.now() - entered.at < NEW_FOR) newTimer = setTimeout(() => drawReadouts(), NEW_FOR + 20);
    if (example) example.changed();
  }
  function later() { if (!frameReq) frameReq = soon(draw); }
  function resize() {
    MM.fitCanvas(xcv);
    MM.fitCanvas(zcv);
    MM.fitCanvas(hcv);
    draw();
  }

  /* ---------- ħ ---------- */

  // φ set by a drag or the keys: held on a Stokes ray within tol of it
  function setPhi(phi, tol) {
    const c = cur(), act = St.action(c.crit);
    let snap = null;
    if (tol > 0) {
      let best = tol;
      for (const r of stokesNear(phi)) { const d = Math.abs(r.theta - phi); if (d < best) { best = d; snap = { i: r.i, theta: r.theta }; } }
    }
    const to = snap ? snap.theta : phi;
    // the orientations follow ħ round
    c.dirs = St.directions(act, to, St.turnDirs(c.dirs, c.phiAt, to));
    c.phiAt = to;
    state.phi = to;
    state.snap = snap;
    rebuild();
  }
  const setR = (r) => { cur().r = clamp(r, model.RH / R_SPAN, model.RH); };
  // a step of arg ħ from the keys, which stops on a Stokes ray it would pass
  function stepPhi(k, fine) {
    const step = (fine ? 0.5 : 3) * Math.PI / 180;
    let stop = null;
    for (const r of stokesNear(state.phi)) {
      const d = (r.theta - state.phi) * k;
      if (d > 1e-9 && d <= step + 1e-12 && (!stop || d < (stop.theta - state.phi) * k)) stop = r;
    }
    if (stop) setPhi(stop.theta, 1e-9); else setPhi(state.phi + k * step, 0);
  }

  /* ---------- dragging ---------- */

  let drag = null;                  // what is being dragged: a point, an end of Γ, ħ
  function localXY(e, elm) { const r = elm.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  xsvg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.sp-pt, .sp-end');
    if (!g || e.button) return;
    e.preventDefault();
    stopTurn();
    g.setPointerCapture(e.pointerId);
    g.focus({ preventScroll: true });
    if (g.classList.contains('sp-pt')) drag = { kind: 'pt', i: +g.dataset.i };
    else { glide = null; drag = { kind: 'end', e: +g.dataset.e }; }
    onDrag(e);
  });
  xsvg.addEventListener('pointermove', (e) => { if (drag && (drag.kind === 'pt' || drag.kind === 'end')) onDrag(e); });
  function onDrag(e) {
    const V = view(), [px, py] = localXY(e, xcv);
    if (drag.kind === 'pt') {
      const c = cur(), act = St.action(c.crit);
      let p = [V.x(clamp(px, 4, V.W - 4)), V.y(clamp(py, 4, V.H - 4))];
      // keep away from the other critical points (a double point has no thimbles of its own)
      const minD = MINSEP * act.scale;
      c.crit.forEach((q, j) => {
        if (j === drag.i) return;
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < minD) { const s = minD / Math.max(d, 1e-9); p = [q[0] + (p[0] - q[0]) * s, q[1] + (p[1] - q[1]) * s]; }
      });
      c.crit[drag.i] = p;
      c.dirs = St.directions(St.action(c.crit), state.phi, c.dirs);
      state.snap = null;
      rebuild();
      later();
    } else {
      // an end of Γ: it follows the pointer round the rim, Γ with it, and Γ is the sum for the
      // nearest valley (not the other end's)
      const m = model.act.m, a0 = Math.atan2(V.H / 2 - py, px - V.W / 2);
      const prev = drag.a !== undefined ? drag.a : endAngle(drag.e), a = a0 + TAU * Math.round((prev - a0) / TAU);
      drag.a = a;
      const k = St.mod(Math.round((m * a - state.phi) / TAU), m);
      const c = cur(), other = St.mod(c.gamma[1 - drag.e], m);
      if (k !== other && St.mod(c.gamma[drag.e], m) !== k) { c.gamma[drag.e] = k; rebuild(); }
      later();
    }
  }
  function endDrag() {
    if (!drag || (drag.kind !== 'pt' && drag.kind !== 'end')) return;
    const was = drag;
    drag = null;
    if (was.kind === 'pt') {
      // refit when a point has left the middle of the window
      const V = view(), out = cur().crit.some((p) => Math.abs(p[0] - state.frame.c[0]) > 0.85 * V.R || Math.abs(p[1] - state.frame.c[1]) > 0.85 * V.R);
      if (out) fitFrame();
      raysCache.key = '';
      rebuild();
    } else if (was.a !== undefined) glideEnd(was.e, was.a);
    commit();
    draw();
  }
  // an end of Γ let go between valleys glides into its own (at once under reduced motion)
  let glide = null;
  function glideEnd(e, from) {
    const va = St.valleyAngle(model.act.m, state.phi, cur().gamma[e]), to = va + TAU * Math.round((from - va) / TAU);
    if (MM.reduceMotion() || Math.abs(to - from) < 1e-3) { glide = null; return; }
    const t0 = performance.now(), me = glide = { e, a: from };
    const step = () => {
      if (glide !== me) return;
      const f = Math.min(1, (performance.now() - t0) / 240), q = f * f * (3 - 2 * f);
      me.a = from + (to - from) * q;
      if (f >= 1) glide = null;
      draw();
      if (f < 1) soon(step);
    };
    soon(step);
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => xsvg.addEventListener(t, endDrag));

  // the keys: a point moves by a step of the picture, an end of Γ to the next valley
  xsvg.addEventListener('keydown', (e) => {
    const g = e.target.closest('.sp-pt, .sp-end');
    if (!g || e.altKey || e.ctrlKey || e.metaKey) return;
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!dirs) return;
    e.preventDefault();
    stopTurn();
    const c = cur();
    if (g.classList.contains('sp-pt')) {
      const i = +g.dataset.i, V = view(), s = (e.shiftKey ? 2 : 8) / V.k;
      const p = [c.crit[i][0] + dirs[0] * s, c.crit[i][1] + dirs[1] * s];
      if (c.crit.some((q, j) => j !== i && Math.hypot(p[0] - q[0], p[1] - q[1]) < MINSEP * model.act.scale)) return;
      c.crit[i] = p;
      c.dirs = St.directions(St.action(c.crit), state.phi, c.dirs);
      state.snap = null;
      raysCache.key = '';
    } else {
      const ei = +g.dataset.e, m = model.act.m, step = dirs[0] + dirs[1] > 0 ? 1 : -1;
      let k = St.mod(c.gamma[ei] + step, m);
      if (k === St.mod(c.gamma[1 - ei], m)) k = St.mod(k + step, m);
      c.gamma[ei] = k;
    }
    rebuild();
    commit();
    draw();
  });

  // ħ: a press on the picture of I(ħ) puts it there, a drag moves it (held on the Stokes rays)
  hplane.classList.add('draggable');
  hplane.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    e.preventDefault();
    stopTurn();
    drag = { kind: 'hbar' };
    hplane.setPointerCapture(e.pointerId);
    hbarEl.focus({ preventScroll: true });
    moveHbar(e);
  });
  function moveHbar(e) {
    if (!drag || drag.kind !== 'hbar') return;
    const [px, py] = localXY(e, hcv), V = hview(), x = (px - V.cx) / V.k, y = (V.cy - py) / V.k, r = Math.hypot(x, y);
    setR(r);
    setPhi(St.liftNear(Math.atan2(y, x), state.phi), Math.min(0.15, 6 / Math.max(cur().r * V.k, 1)));
    later();
  }
  hplane.addEventListener('pointermove', moveHbar);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => hplane.addEventListener(t, () => {
    if (drag && drag.kind === 'hbar') { drag = null; commit(); draw(); }
  }));
  hbarEl.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const turn = { ArrowLeft: 1, ArrowRight: -1 }[e.key], grow = { ArrowUp: 1, ArrowDown: -1 }[e.key];
    if (!turn && !grow) return;
    e.preventDefault();
    stopTurn();
    if (turn) stepPhi(turn, e.shiftKey);
    else { setR(cur().r * Math.pow(10, grow * (e.shiftKey ? 0.01 : 0.05))); }
    commit();
    draw();
  });

  // a mouse drag on the empty plane moves it; two fingers zoom it; the arrow keys move it
  let pan = null;
  xcv.classList.add('pannable');
  xcv.addEventListener('pointerdown', (e) => {
    if (e.button || e.pointerType === 'touch') return;
    pan = { x: e.clientX, y: e.clientY, c: state.frame.c.slice(), moved: false };
    xcv.setPointerCapture(e.pointerId);
    xcv.classList.add('is-panning');
  });
  xcv.addEventListener('pointermove', (e) => {
    if (!pan) return;
    const V = view();
    state.frame.c = [pan.c[0] - (e.clientX - pan.x) / V.k, pan.c[1] + (e.clientY - pan.y) / V.k];
    pan.moved = true;
    later();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => xcv.addEventListener(t, () => {
    if (!pan) return;
    const moved = pan.moved;
    pan = null;
    xcv.classList.remove('is-panning');
    if (moved) MM.moved();
  }));
  const zoomEl = $('zoom');
  function zoomAbout(f, px, py) {
    const V = view(), x = V.x(px), y = V.y(py);
    state.zoom = clamp(state.zoom * f, 0.5, 6);
    const V2 = view();
    state.frame.c = [state.frame.c[0] + x - V2.x(px), state.frame.c[1] + y - V2.y(py)];
    zoomEl.value = state.zoom;
    later();
  }
  xcv.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    const V = view();
    if (d) { e.preventDefault(); const s = (e.shiftKey ? 8 : 32) / V.k; state.frame.c = [state.frame.c[0] + d[0] * s, state.frame.c[1] + d[1] * s]; later(); MM.moved(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAbout(1.25, V.W / 2, V.H / 2); MM.moved(); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAbout(0.8, V.W / 2, V.H / 2); MM.moved(); }
  });
  MM.pinchZoom(plane, { zoom: zoomAbout, pan: (dx, dy) => { const V = view(); state.frame.c = [state.frame.c[0] - dx / V.k, state.frame.c[1] + dy / V.k]; later(); } });
  // (the magnification is the element's value; the event comes from the range inside it)
  zoomEl.addEventListener('input', () => { const V = view(); zoomAbout(zoomEl.value / state.zoom, V.W / 2, V.H / 2); });

  // Flow
  $('flow').addEventListener('input', (e) => { state.flow = +e.target.value / 1000; later(); });

  // the sum: a thimble pointed at, or focused, shows in both pictures
  $('dec').addEventListener('pointerover', (e) => { const t = e.target.closest('.sp-term'); setLit(t ? +t.dataset.i : -1); });
  $('dec').addEventListener('pointerleave', () => setLit(-1));
  $('dec').addEventListener('focusin', (e) => { const t = e.target.closest('.sp-term'); if (t) setLit(+t.dataset.i); });
  $('dec').addEventListener('focusout', () => setLit(-1));
  function setLit(i) { if (state.lit !== i) { state.lit = i; later(); } }

  /* ---------- Turn ---------- */

  let last = 0, holdUntil = 0, seen = null, loopReq = 0;
  function stopTurn() {
    if (!state.turn) return;
    state.turn = false;
    $('turn').pressed = false;
  }
  function loop(t) {
    loopReq = 0;
    if (!state.turn) return;
    if (seen && !seen()) { last = 0; return; }
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    if (t < holdUntil) { loopReq = requestAnimationFrame(loop); return; }
    const to = state.phi + TAU * dt / TURN;
    // rest a moment on each Stokes ray passed
    let hit = null;
    for (const r of stokesNear(state.phi)) if (r.theta > state.phi + 1e-9 && r.theta <= to) if (!hit || r.theta < hit.theta) hit = r;
    if (hit) { setPhi(hit.theta, 1e-9); holdUntil = t + HOLD * 1000; } else setPhi(to, 0);
    draw();
    loopReq = requestAnimationFrame(loop);
  }
  function startTurn() { if (state.turn && !loopReq) { last = 0; loopReq = requestAnimationFrame(loop); } }
  $('turn').addEventListener('change', (e) => { state.turn = e.detail.pressed; startTurn(); });

  /* ---------- the degree ---------- */

  $('degree').addEventListener('change', (e) => {
    stopTurn();
    state.deg = +e.detail.value;
    state.snap = null;
    raysCache.key = '';
    quiet = true;
    fitFrame();
    buildOverlay();
    rebuild();
    buildPickers();
    commit();
    draw();
  });

  /* ---------- undo and redo ---------- */

  const snapshot = () => ({ deg: state.deg, phi: state.phi, snap: state.snap && { ...state.snap }, cases: Object.fromEntries(DEGREES.map((d) => [d, copyCase(state.cases[d])])) });
  const sameSnap = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const back = [], forth = [];
  let now = null;
  function commit() {
    const s = snapshot();
    if (now && sameSnap(now, s)) return;
    if (now) undoButtons.keep(back, now);
    forth.length = 0;
    now = s;
    undoButtons.update();
  }
  function restore(s) {
    const degChanged = s.deg !== state.deg;
    state.deg = s.deg;
    state.phi = s.phi;
    state.snap = s.snap && { ...s.snap };
    for (const d of DEGREES) state.cases[d] = copyCase(s.cases[d]);
    $('degree').value = String(state.deg);
    raysCache.key = '';
    quiet = true;
    if (degChanged) { fitFrame(); buildOverlay(); }
    rebuild();
    if (degChanged) buildPickers();
    draw();
    undoButtons.update();
  }
  const undoButtons = MM.undoRedo({
    undo() { if (!back.length || drag) return; forth.push(now); now = back.pop(); restore(now); },
    redo() { if (!forth.length || drag) return; back.push(now); now = forth.pop(); restore(now); },
    canUndo: () => back.length > 0,
    canRedo: () => forth.length > 0,
  });

  /* =====================================================================
     The figures in the text. They show the case at the top, at its ħ; those that change ħ
     have a copy of the plane of x or of the plane of values beside them. The critical point
     they are about is their own, shared between them.
     ===================================================================== */

  const W0 = (svg) => Math.max(240, Math.round(svg.clientWidth || svg.parentNode.clientWidth || 480));

  // the critical points' series (kept until the case changes)
  let textCache = { key: '', ser: [] };
  function seriesOf(j, K) {
    const key = critKey(cur());
    if (textCache.key !== key) textCache = { key, ser: [] };
    const have = textCache.ser[j];
    if (!have || have.length < K + 1) textCache.ser[j] = St.series(model.act, j, Math.max(K, 60));
    return textCache.ser[j];
  }
  const focusI = () => Math.min(state.focus, model.act.n - 1);
  // the nearest singularity of J_i's Borel transform: |A|, its ray and its critical point
  function nearest(i) {
    let best = null;
    for (const r of model.rays[i] || []) for (const j of r.js) { const a = St.abs(r.A[j]); if (!best || a < best.a - 1e-12) best = { a, ray: r, j }; }
    return best;
  }

  /* ---------- the pickers of the critical point, and the sliders of |ħ| ---------- */

  const pickers = Array.from(document.querySelectorAll('.sp-pick'));
  function buildPickers() {
    const n = model.act.n;
    pickers.forEach((box) => {
      // (the theme puts the sliding indicator in the group too: only the buttons are ours)
      if (box.querySelectorAll('button').length === n) return;
      box.querySelectorAll('button').forEach((q) => q.remove());
      for (let i = 0; i < n; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.dataset.i = i;
        MM.setHTML(b, '$J_{' + (i + 1) + '}$');
        box.appendChild(b);
      }
    });
    syncPickers();
  }
  function syncPickers() {
    const f = focusI();
    pickers.forEach((box) => Array.from(box.querySelectorAll('button')).forEach((b) => {
      const on = +b.dataset.i === f;
      if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }));
  }
  pickers.forEach((box) => box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    state.focus = +b.dataset.i;
    syncPickers();
    textDirty();
    if (example) example.changed();
  }));
  const rSliders = Array.from(document.querySelectorAll('.sp-r'));
  const rToV = (r) => Math.round(1000 * Math.log(r * R_SPAN / model.RH) / Math.log(R_SPAN));
  const vToR = (v) => model.RH / R_SPAN * Math.pow(R_SPAN, v / 1000);
  function syncSliders() {
    const v = rToV(cur().r);
    rSliders.forEach((s) => { if (+s.value !== v) s.value = v; });
    const tex = '$|\\hbar|=' + rTex(cur().r) + '$';
    MM.setHTML($('trunc-val'), tex);
    MM.setHTML($('smooth-val'), tex);
  }
  rSliders.forEach((s) => {
    s.addEventListener('input', () => { setR(vToR(+s.value)); later(); });
    s.addEventListener('change', () => commit());
  });

  /* ---------- small SVG charts, one unit to a pixel ---------- */

  function chartBox(svg, H, pad) {
    const W = W0(svg);
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    return { W, H, x0: pad[3], x1: W - pad[1], y0: pad[0], y1: H - pad[2] };
  }
  function label(svg, str, x, y, cls, anchor) {
    const t = el('text', { x, y, class: cls || 'sp-num', 'text-anchor': anchor || 'middle' }, svg);
    MM.svgLabel(t, str);
    return t;
  }
  function poly(svg, pts, cls, extra) {
    if (pts.length < 2) return null;
    return el('path', Object.assign({ d: 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'), class: cls }, extra || {}), svg);
  }

  /* ---------- copies of the pictures at the top ---------- */

  const planeCopies = [$('copy-stokes'), $('copy-borel')], hCopies = [$('copy-trunc'), $('copy-smooth')];
  function drawCopies() {
    for (const cv of planeCopies) {
      if (!cv.clientWidth) continue;
      const { w, h, ctx } = MM.fitCanvas(cv);
      const V = view(w, h);
      renderPlane(ctx, V, 0.5);
      cur().crit.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(V.X(p[0]), V.Y(p[1]), 3.6, 0, TAU);
        ctx.fillStyle = MM.color('handle');
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = thColor(i);
        ctx.stroke();
      });
    }
    for (const cv of hCopies) {
      if (!cv.clientWidth || !hcv.width) continue;
      const { w, h, ctx } = MM.fitCanvas(cv);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hcv, 0, 0, w, h);
      const V = hview(w, h), r = cur().r;
      ctx.beginPath(); ctx.arc(V.cx + Math.cos(state.phi) * r * V.k, V.cy - Math.sin(state.phi) * r * V.k, 4.5, 0, TAU);
      ctx.fillStyle = MM.color('handle'); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = MM.color('accent'); ctx.stroke();
    }
  }

  /* ---------- The Stokes phenomenon: the exponents and the coefficients as arg ħ turns ---------- */

  // A whole turn of arg ħ centred on φ, which stays in the middle: a drag moves the chart under
  // it, a click brings the angle clicked to the middle. The angles are named mod 2π.
  const stokesSvg = $('stokes-chart');
  let stokesData = { key: '' }, stokesBox = null;
  const dirsSig = () => model.dirs.map((d) => d.map((v) => v.toFixed(4)).join(',')).join(';');
  function stokesKey() { return [critKey(cur()), cur().gamma.join(','), state.phi.toFixed(6), dirsSig()].join('|'); }
  function computeStokes() {
    const act = model.act, lo = state.phi - Math.PI, hi = state.phi + Math.PI, c = cur();
    const br = [];
    model.rays.forEach((list) => list.forEach((r) => { for (let t = St.liftNear(r.theta, lo) - TAU; t <= hi + TAU; t += TAU) if (t > lo && t < hi) br.push(t); }));
    br.sort((a, b) => a - b);
    const cuts = [lo].concat(br.filter((t, k) => !k || t - br[k - 1] > 1e-9)).concat([hi]);
    const runs = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const a = cuts[k], b = cuts[k + 1], mid = (a + b) / 2;
      const dirs = St.turnDirs(model.dirs, state.phi, mid);
      const th = traceAt(act, mid, dirs, -1);
      const nn = St.decompose(act.m, th.map((t) => [t.from, t.to]), c.gamma[0], c.gamma[1]);
      // (a Stokes ray of a thimble that is not in Γ changes nothing: one run across it)
      const prev = runs[runs.length - 1];
      if (prev && prev.n && nn && prev.n.every((x, i) => x === nn[i])) prev.b = b; else runs.push({ a, b, n: nn });
    }
    stokesData = { key: stokesKey(), lo, hi, runs };
  }
  // a multiple of π/2, named as an angle in (−π, π]
  const piTex = (q) => ['0', '\\pi/2', '\\pi', '-\\pi/2'][((q % 4) + 4) % 4];
  function drawStokes() {
    if (!stokesSvg.clientWidth && !stokesSvg.parentNode.clientWidth) return;
    if (stokesData.key !== stokesKey()) computeStokes();
    const act = model.act, n = act.n, B = chartBox(stokesSvg, 300, [12, 44, 30, 40]);
    stokesBox = B;
    const { lo, hi, runs } = stokesData;
    const rowH = 19, rowsTop = B.y1 - n * rowH, yc = rowsTop - 14;
    const rel = act.values.map((v) => St.sub(v, model.Sbar));
    let amp = 1e-12;
    for (const v of rel) amp = Math.max(amp, St.abs(v));
    const X = (t) => B.x0 + (t - lo) / (hi - lo) * (B.x1 - B.x0), Y = (e) => (B.y0 + yc) / 2 - e / (1.15 * amp) * (yc - B.y0) / 2;
    const E = (i, t) => -(rel[i][0] * Math.cos(t) + rel[i][1] * Math.sin(t));
    // the angles: a line at each multiple of π/2, named under the rows
    for (let q = Math.ceil(lo / (Math.PI / 2)); q * Math.PI / 2 <= hi + 1e-9; q++) {
      const x = X(q * Math.PI / 2);
      el('line', { x1: x, x2: x, y1: B.y0, y2: B.y1, class: 'sp-grid' }, stokesSvg);
      label(stokesSvg, '$' + piTex(q) + '$', x, B.y1 + 17);
    }
    label(stokesSvg, '$\\arg\\hbar$', B.x1 + 6, B.y1 + 17, 'sp-num', 'start');
    el('line', { x1: B.x0, x2: B.x1, y1: yc, y2: yc, class: 'sp-axis' }, stokesSvg);
    // the rows of the coefficients n_i
    for (let i = 0; i < n; i++) {
      const y = rowsTop + i * rowH;
      el('line', { x1: B.x0, x2: B.x1, y1: y + rowH, y2: y + rowH, class: 'sp-row' }, stokesSvg);
      const nm = label(stokesSvg, '$n_{' + (i + 1) + '}$', B.x0 - 8, y + rowH / 2 + 5, 'sp-rowname', 'end');
      nm.style.fill = thColor(i);
      for (const r of runs) {
        if (!r.n) continue;
        const xa = X(r.a), xb = X(r.b);
        if (xb - xa < 16) continue;
        const v = r.n[i], t = label(stokesSvg, '$' + (v < 0 ? '-' : '') + Math.abs(v) + '$', (xa + xb) / 2, y + rowH / 2 + 5, 'sp-coef' + (v ? '' : ' zero'));
        if (v) t.style.fill = thText(i);
      }
    }
    // the jumps of the coefficients: a line through the chart at each, a dot where a curve changes
    for (let k = 1; k < runs.length; k++) {
      const a = runs[k - 1].n, b = runs[k].n;
      if (!a || !b || a.every((x, i) => x === b[i])) continue;
      const t = runs[k].a, x = X(t);
      el('line', { x1: x, x2: x, y1: B.y0, y2: B.y1, class: 'sp-jumpline' }, stokesSvg);
      a.forEach((x0, i) => { if (x0 !== b[i]) el('circle', { cx: x, cy: Y(E(i, t)), r: 3.6, class: 'sp-jumpdot', style: 'fill:' + thColor(i) }, stokesSvg); });
    }
    // the curves, solid where the thimble is in Γ; a curve that coincides with one before it (equal
    // critical values) in dashes between that one's, so that both colours show
    const twin = rel.map((v, i) => rel.findIndex((w, j) => j < i && St.abs(St.sub(v, w)) < 1e-9 * amp) >= 0);
    for (let i = 0; i < n; i++) {
      for (const r of runs) {
        const pts = [];
        const m = Math.max(2, Math.ceil((X(r.b) - X(r.a)) / 2));
        for (let q = 0; q <= m; q++) { const t = r.a + (r.b - r.a) * q / m; pts.push([X(t), Y(E(i, t))]); }
        const inG = r.n && r.n[i];
        const extra = { style: 'stroke:' + thColor(i) };
        if (twin[i]) Object.assign(extra, inG ? { 'stroke-dasharray': '7 7', 'stroke-dashoffset': '7' } : { 'stroke-dashoffset': '2.25' });
        poly(stokesSvg, pts, inG ? 'sp-curve' + (twin[i] ? ' twin' : '') : 'sp-curve faint', extra);
      }
    }
    // the names at the right, apart
    const ends = rel.map((v, i) => ({ i, y: Y(E(i, hi)) })).sort((a, b) => a.y - b.y);
    for (let q = 1; q < ends.length; q++) if (ends[q].y - ends[q - 1].y < 17) ends[q].y = ends[q - 1].y + 17;
    for (const e of ends) { const t = label(stokesSvg, '$J_{' + (e.i + 1) + '}$', B.x1 + 6, e.y + 5, 'sp-name', 'start'); t.style.fill = thColor(e.i); }
    // φ, in the middle
    const x = X(state.phi);
    el('line', { x1: x, x2: x, y1: B.y0, y2: B.y1, class: 'sp-now' }, stokesSvg);
    const h = el('g', { class: 'sp-knob', transform: 'translate(' + x.toFixed(1) + ',' + yc + ')', tabindex: 0, role: 'slider', 'aria-label': 'arg hbar: the arrow keys turn it', 'aria-valuetext': degOf(state.phi) + '°' }, stokesSvg);
    MM.handle(el('g', {}, h), 6.5);
  }
  // a drag moves the chart under the middle; a click (no drag) brings the angle clicked there
  let sdrag = null, tween = 0;
  stokesSvg.addEventListener('pointerdown', (e) => {
    if (e.button || !stokesBox) return;
    stopTurn();
    sdrag = { x0: e.clientX, phi0: state.phi, moved: false };
    stokesSvg.setPointerCapture(e.pointerId);
    stokesSvg.classList.add('is-panning');
  });
  stokesSvg.addEventListener('pointermove', (e) => {
    if (!sdrag) return;
    const dx = e.clientX - sdrag.x0, w = stokesBox.x1 - stokesBox.x0;
    if (Math.abs(dx) > 3) sdrag.moved = true;
    if (!sdrag.moved) return;
    setPhi(sdrag.phi0 - dx / w * TAU, 6 / w * TAU);
    draw();
  });
  function endStokes(e) {
    if (!sdrag) return;
    const was = sdrag;
    sdrag = null;
    stokesSvg.classList.remove('is-panning');
    if (!was.moved && e.type === 'pointerup') {
      const r = stokesSvg.getBoundingClientRect(), w = stokesBox.x1 - stokesBox.x0, mid = (stokesBox.x0 + stokesBox.x1) / 2;
      glidePhi(state.phi + (e.clientX - r.left - mid) / w * TAU, 6 / w * TAU);
    } else commit();
  }
  ['pointerup', 'pointercancel'].forEach((t) => stokesSvg.addEventListener(t, endStokes));
  // arg ħ glides to an angle (at once under reduced motion), and holds on a Stokes ray there
  function glidePhi(to, tol) {
    const from = state.phi, t0 = performance.now(), dur = MM.reduceMotion() ? 0 : 380, id = ++tween;
    const step = () => {
      if (id !== tween) return;
      const f = dur ? Math.min(1, (performance.now() - t0) / dur) : 1, s = f * f * (3 - 2 * f);
      setPhi(from + (to - from) * s, f === 1 ? tol : 0);
      draw();
      if (f < 1) soon(step); else commit();
    };
    step();
  }
  stokesSvg.addEventListener('keydown', (e) => {
    if (!e.target.closest('.sp-knob')) return;
    const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!k) return;
    e.preventDefault();
    stopTurn();
    stepPhi(k, e.shiftKey);
    commit();
    draw();
    const kn = stokesSvg.querySelector('.sp-knob');
    if (kn) kn.focus({ preventScroll: true });
  });

  /* ---------- The Borel plane ---------- */

  const borelCv = $('borel-cv'), borelBox = $('borel-box'), borelH = $('borel-h');
  let borelData = { key: '' };
  const NA = 540, NR = 150;
  function borelKey() { return critKey(cur()) + '|' + focusI(); }
  function computeBorel() {
    const act = model.act, i = focusI();
    let R = 0;
    act.values.forEach((v, j) => { if (j !== i) R = Math.max(R, St.abs(St.sub(v, act.values[i]))); });
    R = Math.max(R, 1e-6) * 1.3;
    const inv = St.localInverse(act, i, 24);
    const grid = new Float64Array(NA * 2 * (NR + 1)), buf = new Float64Array(2 * (NR + 1));
    for (let a = 0; a < NA; a++) {
      St.borelRay(act, i, -Math.PI + TAU * (a + 0.5) / NA, R, NR, inv, buf);
      grid.set(buf, a * 2 * (NR + 1));
    }
    borelData = { key: borelKey(), R, grid, i, img: null };
  }
  // the colour of a phase: round the data colours, lightened
  let wheel = null;
  function makeWheel() {
    const names = ['c1', 'c6', 'c3', 'c7', 'c2', 'c5', 'c4'];
    const cols = names.map(rgbOf), W = rgbOf('surface');
    wheel = [];
    for (let q = 0; q < 360; q++) {
      const t = q / 360 * cols.length, k = Math.floor(t), f = t - k, a = cols[k % cols.length], b = cols[(k + 1) % cols.length];
      wheel.push([0, 1, 2].map((c) => a[c] + (b[c] - a[c]) * f).map((v, c) => v + (W[c] - v) * 0.62));
    }
  }
  const wheelAt = (ph) => wheel[Math.floor(((ph / TAU + 1) % 1) * 360) % 360];
  function paintBorel(V) {
    if (!wheel) makeWheel();
    const dpr = MM.pixelRatio(), w = Math.round(V.W * dpr), h = Math.round(V.H * dpr);
    const img = new ImageData(w, h), d = img.data, G = borelData.grid, R = borelData.R, W = rgbOf('surface');
    const stride = 2 * (NR + 1);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const zx = (px / dpr - V.cx) / V.k, zy = -(py / dpr - V.cy) / V.k;
        const rho = Math.hypot(zx, zy), o = 4 * (py * w + px);
        if (rho >= R) { d[o] = W[0]; d[o + 1] = W[1]; d[o + 2] = W[2]; d[o + 3] = 255; continue; }
        const fa = (Math.atan2(zy, zx) + Math.PI) / TAU * NA - 0.5, fr = rho / R * NR;
        let a0 = Math.floor(fa);
        const ta = fa - a0, r0 = Math.min(NR - 1, Math.floor(fr)), tr = fr - r0;
        const a1 = (a0 + 1 + NA) % NA;
        a0 = (a0 + NA) % NA;
        const q = (a, r) => a * stride + 2 * r;
        let re = 0, im = 0;
        const wts = [[q(a0, r0), (1 - ta) * (1 - tr)], [q(a1, r0), ta * (1 - tr)], [q(a0, r0 + 1), (1 - ta) * tr], [q(a1, r0 + 1), ta * tr]];
        for (const [k, wgt] of wts) { re += wgt * G[k]; im += wgt * G[k + 1]; }
        const mag = Math.log2(Math.hypot(re, im) + 1e-300);
        // darker where |β| is large, with a level line at each power of √2
        const x = 2 * mag, dl = Math.abs(x - Math.round(x));
        const shade = (1 - 0.62 * Math.tanh(Math.max(0, mag) / 2.2)) * (1 - 0.16 * Math.exp(-(dl * dl) / 0.0015));
        const c = wheelAt(Math.atan2(im, re));
        d[o] = c[0] * shade; d[o + 1] = c[1] * shade; d[o + 2] = c[2] * shade; d[o + 3] = 255;
      }
    }
    return img;
  }
  function borelView() {
    const W = borelCv.clientWidth || 400, H = borelCv.clientHeight || 400, R = borelData.R || 1;
    const k = Math.min(W, H) / (2 * R * 1.12);
    return { W, H, k, cx: W / 2, cy: H / 2, X: (x) => W / 2 + x * k, Y: (y) => H / 2 - y * k };
  }
  // the key of the colours: a ring of phases, named at 1, i, −1, −i
  function drawPhaseKey(ctx, cx, cy, r) {
    if (!wheel) makeWheel();
    for (let q = 0; q < 72; q++) {
      const a0 = q / 72 * TAU, a1 = (q + 1.2) / 72 * TAU, c = wheelAt(a0);
      ctx.beginPath();
      ctx.arc(cx, cy, r, -a0, -a1, true);
      ctx.arc(cx, cy, r * 0.55, -a1, -a0, false);
      ctx.closePath();
      ctx.fillStyle = 'rgb(' + c.map(Math.round).join(',') + ')';
      ctx.fill();
    }
    const o = { size: 11.5, align: 'center', baseline: 'middle', color: MM.color('ink-2') }, d = r + 9;
    MM.canvasLabel(ctx, '$1$', cx + d, cy, o);
    MM.canvasLabel(ctx, '$\\mathrm{i}$', cx, cy - d, o);
    MM.canvasLabel(ctx, '$-1$', cx - d - 3, cy, o);
    MM.canvasLabel(ctx, '$-\\mathrm{i}$', cx, cy + d, o);
  }
  function drawBorel() {
    if (!borelCv.clientWidth || !model) return;
    if (borelData.key !== borelKey()) computeBorel();
    const fit = MM.fitCanvas(borelCv), ctx = fit.ctx, V = borelView(), i = borelData.i, act = model.act;
    const sizeKey = fit.w + 'x' + fit.h + '@' + MM.pixelRatio();
    if (!borelData.img || borelData.imgKey !== sizeKey) { borelData.img = paintBorel(V); borelData.imgKey = sizeKey; }
    ctx.putImageData(borelData.img, 0, 0);
    drawAxes(ctx, { W: V.W, H: V.H, X: V.X, Y: V.Y }, ['$\\mathrm{Re}\\,\\zeta$', '$\\mathrm{Im}\\,\\zeta$'], false);
    // the singularities on this sheet: the critical values J_i runs into
    const sing = new Set();
    for (const r of model.rays[i] || []) for (const j of r.js) sing.add(j);
    // the cuts: from each singularity straight out
    ctx.strokeStyle = MM.rgba('ink', 0.45);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const j of sing) {
      const A = St.sub(act.values[j], act.values[i]), u = St.scl(A, 1 / St.abs(A));
      ctx.beginPath(); ctx.moveTo(V.X(A[0]), V.Y(A[1])); ctx.lineTo(V.X(A[0] + u[0] * 3 * borelData.R), V.Y(A[1] + u[1] * 3 * borelData.R)); ctx.stroke();
    }
    ctx.setLineDash([]);
    // the ray of ħ, and the point ħ on it where it lies within the picture
    const e = [Math.cos(state.phi), Math.sin(state.phi)], len = 0.92 * Math.min(V.W, V.H) / 2;
    ctx.strokeStyle = MM.color('ink');
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(V.cx, V.cy); ctx.lineTo(V.cx + e[0] * len, V.cy - e[1] * len); ctx.stroke();
    if (state.snap && state.snap.i === i) {
      const t = model.th[i];
      if (t.hit >= 0) {
        const A = St.sub(act.values[t.hit], act.values[i]);
        ctx.strokeStyle = MM.rgba('highlight', 0.5);
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(V.cx, V.cy); ctx.lineTo(V.X(A[0]), V.Y(A[1])); ctx.stroke();
      }
    }
    const rk = Math.min(cur().r * V.k, len), hp = [V.cx + e[0] * rk, V.cy - e[1] * rk];
    ctx.fillStyle = MM.rgba('surface', 0.85);
    const lp = [hp[0] - e[1] * 22, hp[1] - e[0] * 22];
    ctx.beginPath(); ctx.arc(lp[0], lp[1], 9, 0, TAU); ctx.fill();
    MM.canvasLabel(ctx, '$\\hbar$', lp[0], lp[1], { size: 15, align: 'center', baseline: 'middle', color: MM.color('ink') });
    // the points: 0 for S(p_i), and the other critical values less S(p_i); those that coincide side
    // by side; a singularity ringed, a point that is no singularity on this sheet a ring of its colour
    const pts = act.values.map((v, j) => { const A = St.sub(v, act.values[i]); return { j, x: V.X(A[0]), y: V.Y(A[1]) }; });
    const groups = [];
    pts.forEach((p) => { const g = groups.find((q) => Math.hypot(q[0].x - p.x, q[0].y - p.y) < 12); if (g) g.push(p); else groups.push([p]); });
    for (const g of groups) if (g.length > 1) g.sort((a, b) => (a.j === i ? -1 : b.j === i ? 1 : a.j - b.j)).forEach((p, q) => { p.x += (q - (g.length - 1) / 2) * 17; });
    for (const p of pts) {
      const j = p.j, own = j === i, s = sing.has(j);
      if (s) { ctx.beginPath(); ctx.arc(p.x, p.y, 10.5, 0, TAU); ctx.lineWidth = 1.6; ctx.strokeStyle = MM.color('ink'); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, TAU);
      if (own || s) {
        ctx.fillStyle = thColor(j); ctx.fill();
        ctx.lineWidth = 1.8; ctx.strokeStyle = MM.color('surface'); ctx.stroke();
      } else {
        ctx.fillStyle = MM.color('surface'); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = thColor(j); ctx.stroke();
      }
      ctx.fillStyle = own || s ? MM.color('surface') : MM.color('th-' + (j + 1) + '-text');
      ctx.font = MM.font('sans', 9.5, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(j + 1), p.x, p.y + 0.5);
    }
    const kr = Math.max(14, Math.min(20, 0.045 * Math.min(V.W, V.H)));
    drawPhaseKey(ctx, V.W - kr - 16, V.H - kr - 16, kr);
    borelH.style.transform = 'translate(' + hp[0].toFixed(1) + 'px,' + hp[1].toFixed(1) + 'px)';
    borelH.setAttribute('aria-valuetext', 'arg ħ = ' + degOf(state.phi) + '°, |ħ| = ' + rTex(cur().r));
    const names = [...sing].sort((a, b) => a - b).map((j) => '$A_{' + (i + 1) + (j + 1) + '}$');
    MM.setHTML($('borel-cap'), 'The Borel transform $\\beta_{' + (i + 1) + '}$, coloured by its phase as in the key and darker where it is large, with the ray of $\\hbar$ and the point $\\hbar$ on it. Its singularities, ' + names.join(' and ') + ', are ringed; the dashed lines are its cuts.');
  }
  // ħ is a point of the Borel plane (both measure differences of values of S): a press puts it
  // there, a drag moves it, held on the directions of the singularities
  let borelDrag = false;
  function borelPhi(e) {
    const rc = borelCv.getBoundingClientRect(), V = borelView();
    const x = (e.clientX - rc.left - V.cx) / V.k, y = (V.cy - (e.clientY - rc.top)) / V.k;
    setR(Math.hypot(x, y));
    const i = focusI(), px = Math.max(cur().r * V.k, 1);
    let to = St.liftNear(Math.atan2(y, x), state.phi), snapTo = null, best = Math.min(0.15, 6 / px);
    for (const rr of model.rays[i] || []) { const t = St.liftNear(rr.theta, to); if (Math.abs(t - to) < best) { best = Math.abs(t - to); snapTo = t; } }
    if (snapTo !== null) setPhi(snapTo, 1e-9); else setPhi(to, 0);
    draw();
  }
  borelBox.classList.add('draggable');
  borelBox.addEventListener('pointerdown', (e) => { if (e.button) return; e.preventDefault(); stopTurn(); borelDrag = true; borelBox.setPointerCapture(e.pointerId); borelH.focus({ preventScroll: true }); borelPhi(e); });
  borelBox.addEventListener('pointermove', (e) => { if (borelDrag) borelPhi(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => borelBox.addEventListener(t, () => { if (borelDrag) { borelDrag = false; commit(); } }));
  borelH.addEventListener('keydown', (e) => {
    const turn = { ArrowLeft: 1, ArrowRight: -1 }[e.key], grow = { ArrowUp: 1, ArrowDown: -1 }[e.key];
    if ((!turn && !grow) || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    stopTurn();
    if (turn) stepPhi(turn, e.shiftKey); else setR(cur().r * Math.pow(10, grow * (e.shiftKey ? 0.01 : 0.05)));
    commit();
    draw();
  });

  /* ---------- Resurgence: the terms, the errors and the large-order prediction ---------- */

  const truncSvg = $('trunc-chart');
  const PRED_L = 3;                  // the coefficients of each neighbour's series in the prediction
  function drawTrunc() {
    if (!model || (!truncSvg.clientWidth && !truncSvg.parentNode.clientWidth)) return;
    const i = focusI(), best = nearest(i), act = model.act;
    syncSliders();
    const B = chartBox(truncSvg, 250, [14, 16, 34, 46]);
    if (!best) return;
    const r = cur().r, F = best.a / r, K = Math.min(60, Math.max(16, Math.round(2.2 * F) + 6));
    const a = seriesOf(i, K);
    // ħ in its direction now (just off a Stokes ray of J_i, where the thimble is not defined)
    let phi = state.phi;
    if (state.snap && state.snap.i === i) phi += 1e-4;
    const hb = St.scl(St.cis(phi), r);
    const I = St.integral(act, i, hb, St.turnDirs(model.dirs, state.phi, phi)[i]);
    const exact = St.div(I.v, St.scl(I.v0, Math.sqrt(Math.PI)));
    const rays = model.rays[i] || [], pred = St.predict(rays, K, PRED_L, (j) => seriesOf(j, K));
    const terms = [], errs = [], preds = [];
    let sum = St.C(0), hk = St.C(1);
    for (let k = 0; k <= K; k++) {
      const t = St.mul(a[k], hk);
      terms.push(St.abs(t));
      preds.push(St.abs(pred[k]) * Math.pow(r, k));
      sum = St.add(sum, t);
      errs.push(St.abs(St.sub(exact, sum)) / St.abs(exact));
      hk = St.mul(hk, hb);
    }
    // the logarithmic scale: from the precision of doubles to the largest term
    const lg = (v) => Math.log10(Math.max(v, 1e-17));
    let top = 1;
    for (const t of terms) top = Math.max(top, lg(t));
    top = Math.min(4 * Math.ceil(top / 4), 8);
    const bot = -16;
    const X = (k) => B.x0 + 8 + k / K * (B.x1 - B.x0 - 8), Y = (v) => B.y0 + (top - Math.max(bot, Math.min(top, lg(v)))) / (top - bot) * (B.y1 - B.y0);
    el('line', { x1: B.x0, x2: B.x1, y1: B.y1, y2: B.y1, class: 'sp-axis' }, truncSvg);
    for (let d = top; d >= bot; d -= 4) {
      const y = B.y0 + (top - d) / (top - bot) * (B.y1 - B.y0);
      el('line', { x1: B.x0, x2: B.x1, y1: y, y2: y, class: 'sp-grid' }, truncSvg);
      label(truncSvg, d === 0 ? '$1$' : '$10^{' + d + '}$', B.x0 - 6, y + 4, 'sp-num', 'end');
    }
    const stepK = K > 40 ? 10 : 5;
    for (let k = 0; k <= K; k += stepK) label(truncSvg, '$' + k + '$', X(k), B.y1 + 17);
    label(truncSvg, '$k$', B.x1, B.y1 + 30, 'sp-num', 'end');
    // the band below which doubles cannot tell
    el('rect', { x: B.x0, y: Y(1e-15), width: B.x1 - B.x0, height: Math.max(0, B.y1 - Y(1e-15)), class: 'sp-floor' }, truncSvg);
    // the prediction from the neighbours, in the colour of the one (or ink, for several)
    const js = [];
    rays.forEach((q) => q.js.forEach((j) => { if (!js.includes(j)) js.push(j); }));
    // the errors, and their least
    let kmin = 0;
    errs.forEach((e, k) => { if (e < errs[kmin]) kmin = k; });
    poly(truncSvg, errs.map((e, k) => [X(k + 1), Y(e)]).filter((p, k) => k + 1 <= K), 'sp-errline');
    errs.forEach((e, k) => { if (k + 1 <= K) el('circle', { cx: X(k + 1), cy: Y(e), r: 3, class: 'sp-err' }, truncSvg); });
    terms.forEach((t, k) => el('circle', { cx: X(k), cy: Y(t), r: 3.2, class: 'sp-term-dot', style: 'fill:' + thColor(i) }, truncSvg));
    poly(truncSvg, preds.map((p, k) => [X(k), Y(p)]).slice(1), 'sp-pred', { style: 'stroke:' + (js.length === 1 ? thColor(js[0]) : MM.color('ink-2')) });
    el('circle', { cx: X(kmin + 1), cy: Y(errs[kmin]), r: 7, class: 'sp-mark' }, truncSvg);
    label(truncSvg, '$N=' + (kmin + 1) + '$', X(kmin + 1), Y(errs[kmin]) - 12);
    MM.setHTML($('trunc-cap'), 'The terms $|a_k\\hbar^k|$ of the series of $J_{' + (i + 1) + '}$ (dots), the error of the sum of the terms before $a_k\\hbar^k$ relative to the integral over $J_{' + (i + 1) + '}$ (rings), and the terms predicted from the series of ' + js.map((j) => '$p_{' + (j + 1) + '}$').join(' and ') + ' (line), for $|A/\\hbar|=' + texNum(F, 1) + '$.');
  }

  /* ---------- Smoothing the jump ---------- */

  const smoothSvg = $('smooth-chart');
  const SM_T = 3.2, SM_N = 33, SM_RANGE = 60 * Math.PI / 180;   // samples in units of the width; the chart's half-range
  const F_LO = 2, F_HI = 22;         // |A/ħ| where optimal truncation means something, and doubles resolve the rest
  let smooth = { key: '', pts: [], next: 0 }, smoothReq = 0;
  function smoothKey() { return [critKey(cur()), focusI(), cur().r.toFixed(6), dirsSig()].join('|'); }
  // the multiplier at θ + t·w, from the integral over the thimble just before the ray
  function smoothSample(t) {
    const act = model.act, i = focusI(), best = nearest(i), ray = best.ray, th = St.liftNear(ray.theta, state.phi);
    const A = ray.A[best.j], r = cur().r, F = St.abs(A) / r, w = Math.sqrt(2 * r / St.abs(A));
    const ph = th + t * w, hb = St.scl(St.cis(ph), r), dirs = St.turnDirs(model.dirs, state.phi, ph);
    const Ii = St.integral(act, i, hb, dirs[i]);
    let v = Ii.v;
    if (ph > th) for (const j of ray.js) {
      const Ij = St.integral(act, j, hb, dirs[j]);
      v = St.sub(v, St.scl(St.mul(St.cexp(St.sub(Ij.e, Ii.e)), Ij.v), ray.mu[j]));
    }
    const exact = St.div(v, St.scl(Ii.v0, Math.sqrt(Math.PI)));
    const N = Math.round(F), a = seriesOf(i, N + 2);
    let FN = St.C(0), hk = St.C(1);
    for (let k = 0; k < N; k++) { FN = St.add(FN, St.mul(a[k], hk)); hk = St.mul(hk, hb); }
    let sub = St.C(0);
    for (const j of ray.js) {
      const aj = seriesOf(j, N + 2);
      let Pj = St.C(0), hj = St.C(1);
      for (let k = 0; k < N; k++) { Pj = St.add(Pj, St.mul(aj[k], hj)); hj = St.mul(hj, hb); }
      sub = St.add(sub, St.mul(St.scl(ray.kappa[j], -1), St.mul(St.cexp(St.scl(St.div(ray.A[j], hb), -1)), Pj)));
    }
    return { t, x: t * w, m: St.div(St.sub(exact, FN), sub) };
  }
  function smoothValid() { const b = nearest(focusI()); if (!b) return false; const F = b.a / cur().r; return F >= F_LO && F <= F_HI; }
  function smoothStart() {
    if (!model || !nearest(focusI())) return;
    const key = smoothKey();
    if (smooth.key !== key) smooth = { key, pts: [], next: 0 };
    drawSmooth();
    if (smoothValid() && smooth.next < SM_N && !smoothReq) smoothReq = soon(smoothStep);
  }
  function smoothStep() {
    smoothReq = 0;
    if (smooth.key !== smoothKey()) { smoothStart(); return; }
    const t0 = performance.now();
    while (smooth.next < SM_N && performance.now() - t0 < 12) {
      // samples evenly in t, clear of the ray itself
      let t = -SM_T + 2 * SM_T * smooth.next / (SM_N - 1);
      if (Math.abs(t) < 0.004) t = 0.004;
      smooth.pts.push(smoothSample(t));
      smooth.next++;
    }
    drawSmooth();
    if (smooth.next < SM_N) smoothReq = soon(smoothStep);
  }
  function drawSmooth() {
    if (!model || (!smoothSvg.clientWidth && !smoothSvg.parentNode.clientWidth)) return;
    syncSliders();
    const i = focusI(), best = nearest(i), B = chartBox(smoothSvg, 230, [14, 16, 34, 40]);
    if (!best) return;
    const A = best.ray.A[best.j], r = cur().r, F = best.a / r, ok = smoothValid();
    const X = (x) => (B.x0 + B.x1) / 2 + x / SM_RANGE * (B.x1 - B.x0) / 2, Y = (m) => B.y1 - (m + 0.15) / 1.3 * (B.y1 - B.y0);
    el('line', { x1: B.x0, x2: B.x1, y1: B.y1, y2: B.y1, class: 'sp-axis' }, smoothSvg);
    for (const m of [0, 0.5, 1]) {
      el('line', { x1: B.x0, x2: B.x1, y1: Y(m), y2: Y(m), class: 'sp-grid' }, smoothSvg);
      label(smoothSvg, '$' + (m === 0.5 ? '\\tfrac12' : m) + '$', B.x0 - 6, Y(m) + 4, 'sp-num', 'end');
    }
    for (const dgr of [-60, -30, 0, 30, 60]) label(smoothSvg, '$' + (dgr < 0 ? '-' : '') + Math.abs(dgr) + '^\\circ$', X(dgr * Math.PI / 180), B.y1 + 17);
    label(smoothSvg, '$\\arg\\hbar-\\arg A$', B.x1, B.y1 + 30, 'sp-num', 'end');
    // the thimble's jump, and Berry's error function
    poly(smoothSvg, [[B.x0, Y(0)], [X(0), Y(0)], [X(0), Y(1)], [B.x1, Y(1)]], 'sp-step');
    const curve = [];
    for (let q = 0; q <= 200; q++) {
      const x = -SM_RANGE + 2 * SM_RANGE * q / 200;
      const Ah = St.div(A, St.scl(St.cis(St.arg(A) + x), r)), sigma = -Ah[1] / Math.sqrt(2 * Math.max(Ah[0], 1e-12));
      curve.push([X(x), Y(0.5 * (1 + St.erf(sigma)))]);
    }
    poly(smoothSvg, curve, 'sp-berry');
    if (ok) for (const p of smooth.pts) {
      if (Math.abs(p.x) > SM_RANGE || !Number.isFinite(p.m[0])) continue;
      el('circle', { cx: X(p.x), cy: Y(Math.max(-0.15, Math.min(1.15, p.m[0]))), r: 3.3, class: 'sp-term-dot', style: 'fill:' + thColor(i) }, smoothSvg);
    }
    const j = best.j, ij = (i + 1) + '' + (j + 1);
    const why = ok ? '' : F < F_LO
      ? ' Here $|A_{' + ij + '}/\\hbar|=' + texNum(F, 1) + '$: the smallest term is among the first, and the remainder is not small, so there are no dots.'
      : ' Here $|A_{' + ij + '}/\\hbar|=' + texNum(F, 1) + '$: the remainder, about $\\mathrm{e}^{-' + Math.round(F) + '}$ of the integral, is below what double precision resolves, so there are no dots.';
    MM.setHTML($('smooth-cap'), 'What is left when the series of $J_{' + (i + 1) + '}$ is summed to its smallest term, as a multiple of the jumping term $\\kappa_{' + ij + '}\\,\\mathrm{e}^{-A_{' + ij + '}/\\hbar}\\sum_l a^{(' + (j + 1) + ')}_l\\hbar^l$, across the Stokes ray of $J_{' + (i + 1) + '}$ (dots, the real part); the error function (curve) and the jump of the thimble (dashed).' + why);
  }

  /* ---------- when the figures in the text are drawn ---------- */

  // each is drawn while it is in view (or Save image is open), after the picture at the top
  const textFigs = [
    { el: $('stokes-fig'), draw: drawStokes },
    { el: $('borel-fig'), draw: drawBorel },
    { el: $('trunc-fig'), draw: drawTrunc },
    { el: $('smooth-fig'), draw: () => smoothStart() },
  ];
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const f = textFigs.find((q) => q.el === en.target);
      if (en.isIntersecting) { visible.add(f); f.dirty = true; } else visible.delete(f);
    }
    textLater();
  }, { rootMargin: '200px 0px' });
  textFigs.forEach((f) => io.observe(f.el));
  const sized = new ResizeObserver((entries) => {
    for (const en of entries) { const f = textFigs.find((q) => q.el.contains(en.target)); if (f) f.dirty = true; }
    drawCopies();
    textLater();
  });
  [stokesSvg, borelCv, truncSvg, smoothSvg, ...planeCopies, ...hCopies].forEach((x) => sized.observe(x));
  let textReq = 0;
  function textDirty() { textFigs.forEach((f) => { f.dirty = true; }); textLater(); }
  function textLater() { if (!textReq) textReq = soon(drawText); }
  function drawText() {
    textReq = 0;
    if (!model) return;
    syncPickers();
    syncSliders();
    const all = document.documentElement.classList.contains('is-dialog-open');
    for (const f of textFigs) if (f.dirty && (all || visible.has(f))) { f.dirty = false; f.draw(); }
  }
  document.addEventListener('mm:dialog', () => textDirty());

  /* ---------- start ---------- */

  MM.handle(hbarEl);
  MM.handle(borelH);
  zoomEl.value = state.zoom;
  fitFrame();
  buildOverlay();
  rebuild();
  const ro = new ResizeObserver(() => resize());
  ro.observe(xcv);
  ro.observe(zcv);
  ro.observe(hcv);
  // the figures in the text follow the width of the text
  new ResizeObserver(() => textDirty()).observe(document.querySelector('.prose'));
  resize();
  MM.onFonts(draw);
  seen = MM.whenVisible([plane, hplane], (on) => { if (on) startTurn(); });
  buildPickers();
  syncSliders();

  /* ---------- links, reset and Save image ---------- */

  const flat = (crit) => crit.flatMap((q) => [Math.round(q[0] * 1e4) / 1e4, Math.round(q[1] * 1e4) / 1e4]);
  const sameArr = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  const HOME = { p: flat(PRESETS[3].crit), g: PRESETS[3].gamma.slice(), r: PRESETS[3].r };
  example = MM.example({
    // the case (d, p, g), ħ (h its argument, r its modulus), Turn (t), the zoom (z), Flow (w),
    // and the critical point the figures in the text are about (f)
    fields: { d: 'int', p: 'numbers', g: 'numbers', h: 'number', r: 'number', t: 'flag', z: 'number', w: 'number', f: 'int' },
    view: ['z'],
    get: () => {
      const c = cur(), pre = PRESETS[state.deg], p = flat(c.crit), m = state.deg;
      const g = [St.mod(c.gamma[0], m), St.mod(c.gamma[1], m)], r = Math.round(c.r * 1e4) / 1e4;
      return {
        d: state.deg,
        p: sameArr(p, flat(pre.crit)) ? HOME.p : p,
        g: sameArr(g, pre.gamma) ? HOME.g : g,
        h: Math.round(state.phi * 1e4) / 1e4,
        r: Math.abs(r - pre.r) < 1e-9 ? HOME.r : r,
        t: state.turn, z: Math.round(state.zoom * 1e3) / 1e3, w: Math.round(state.flow * 1e3) / 1e3, f: focusI(),
      };
    },
    set(x, named) {
      const d = x.d;
      if (!DEGREES.includes(d)) return false;
      const pre = PRESETS[d];
      const p = !named.has('p') || sameArr(x.p, HOME.p) ? flat(pre.crit) : x.p;
      const g = !named.has('g') || sameArr(x.g, HOME.g) ? pre.gamma.slice() : x.g;
      const r = !named.has('r') || Math.abs(x.r - HOME.r) < 1e-9 ? pre.r : x.r;
      if (p.length !== 2 * (d - 1) || !p.every(Number.isFinite) || p.some((v) => Math.abs(v) > 50)) return false;
      if (g.length !== 2 || !g.every((k) => Number.isInteger(k) && k >= 0 && k < d) || g[0] === g[1]) return false;
      if (!Number.isFinite(x.h) || Math.abs(x.h) > 1000 || !(x.z >= 0.5 && x.z <= 6) || !(r > 0 && r < 100)) return false;
      if (!(Number.isInteger(x.f) && x.f >= 0 && x.f < d - 1) || !(x.w >= 0 && x.w <= 1)) return false;
      const crit = [];
      for (let k = 0; k < p.length; k += 2) crit.push([p[k], p[k + 1]]);
      // distinct critical points
      for (let a = 0; a < crit.length; a++) for (let b = a + 1; b < crit.length; b++) if (Math.hypot(crit[a][0] - crit[b][0], crit[a][1] - crit[b][1]) < 1e-6) return false;
      stopTurn();
      state.deg = d;
      state.phi = x.h;
      state.snap = null;
      for (const e of DEGREES) state.cases[e] = freshCase(e);
      Object.assign(state.cases[d], { crit, gamma: g, dirs: null, phiAt: x.h, r });
      Object.assign(state, { zoom: x.z, focus: x.f, flow: x.w });
      $('degree').value = String(d);
      zoomEl.value = state.zoom;
      $('flow').value = Math.round(state.flow * 1000);
      raysCache.key = '';
      quiet = true;
      fitFrame();
      buildOverlay();
      rebuild();
      buildPickers();
      // held on a Stokes ray if the link sits on one
      setPhi(state.phi, 1e-7);
      draw();
      if (x.t && !MM.reduceMotion()) { state.turn = true; $('turn').pressed = true; startTurn(); }
      commit();
    },
    pictures: () => [
      { label: 'Plane of x', element: plane },
      { label: 'I(ħ)', element: hplane },
      { label: 'Values of S', element: zcv },
      { label: 'The exponentials', element: stokesSvg, selected: false },
      { label: 'Borel plane', element: borelBox, selected: false },
      { label: 'Resurgence', element: truncSvg, selected: false },
      { label: 'Smoothing', element: smoothSvg, selected: false },
    ],
    redraw: () => { resize(); textDirty(); },
    // what the link does not name: where the plane has been moved to, and which way each
    // thimble runs (it follows ħ round, so after a turn it may differ from a fresh start)
    scene: {
      get: () => ({ c: state.frame.c.slice(), R: state.frame.R, dirs: cur().dirs.map((q) => q.slice()), at: cur().phiAt }),
      set(sc) {
        const okPt = (q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite);
        if (okPt(sc.c) && sc.R > 0) state.frame = { c: sc.c.slice(), R: sc.R };
        if (Array.isArray(sc.dirs) && sc.dirs.length === cur().crit.length && sc.dirs.every(okPt) && Number.isFinite(sc.at)) {
          cur().dirs = sc.dirs.map((q) => q.slice());
          cur().phiAt = sc.at;
          raysCache.key = '';
          quiet = true;
          rebuild();
        }
        draw();
      },
    },
  });
  commit();
})();
