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
  const RH_FIT = 2;                 // the disc of ħ: |ħ| up to this times the largest difference of critical values
                                    // (on its Stokes rays J_i jumps by about e^{−|A|/|ħ|} of itself, ⅗ or more at the rim)
  const R_SPAN = 600;               // and down to that over this
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
    hv: 0,                          // the integral the picture of ħ shows: 0 over Γ, i over J_i
    hz: 1,                          // the picture of ħ's magnification: |ħ| up to RH / hz
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
  // a list in words: "a", "a and b", "a, b and c"
  const listTex = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
  const rTex = (r) => texNum(r, r < 0.01 ? 4 : r < 0.1 ? 3 : 2);
  const degOf = (phi) => { const d = Math.round(((phi * 180 / Math.PI) % 360 + 540) % 360 - 180); return d === -180 ? 180 : d; };

  /* ---------- drawing the plane of x ---------- */

  const land = document.createElement('canvas'), lctx = land.getContext('2d');
  const GRID = 4;                    // CSS pixels per sample of the landscape and of its level lines
  // g(x) = asinh(Re((S(x) − S̄) e^{−iφ}) / σ): the landscape, in a scale that grows slowly
  function landFn() {
    const s = model.act.s, rc = Math.cos(state.phi), rs = Math.sin(state.phi), sb = model.Sbar, sig = model.sigma;
    return (x, y) => {
      let re = 0, im = 0;
      for (let k = s.length - 1; k >= 0; k--) { const t = re * x - im * y + s[k][0]; im = re * y + im * x + s[k][1]; re = t; }
      return Math.asinh(((re - sb[0]) * rc + (im - sb[1]) * rs) / sig);
    };
  }
  // g at the corners of a grid of GRID-pixel cells over the picture, shared by the shading and the
  // level lines
  function landGrid(V, g) {
    const nx = Math.ceil(V.W / GRID) + 1, ny = Math.ceil(V.H / GRID) + 1, G = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) { const y = V.y(j * GRID); for (let i = 0; i < nx; i++) G[j * nx + i] = g(V.x(i * GRID), y); }
    return { nx, ny, G };
  }
  // light blue where the integrand is large (g < 0), white where it dies (the grid, smoothed)
  function paintLand(ctx, V, grid) {
    const { nx, ny, G } = grid;
    if (land.width !== nx || land.height !== ny) { land.width = nx; land.height = ny; }
    const img = lctx.createImageData(nx, ny), d = img.data;
    const P = rgbOf('surface'), B = rgbOf('land');
    for (let q = 0; q < nx * ny; q++) {
      const a = 0.24 * (1 - Math.tanh(G[q] / 1.1)) / 2, o = 4 * q;
      d[o] = P[0] + (B[0] - P[0]) * a; d[o + 1] = P[1] + (B[1] - P[1]) * a; d[o + 2] = P[2] + (B[2] - P[2]) * a; d[o + 3] = 255;
    }
    lctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    // (the samples are at the cells' corners: half a sample beyond each edge)
    ctx.drawImage(land, 0, 0, nx, ny, -GRID / 2, -GRID / 2, nx * GRID, ny * GRID);
  }
  // level lines of g by marching squares: evenly in g (so ever further apart in Re(S/ħ)), and
  // the lines through the critical points a little darker. Each cell adds a piece to the lines of
  // the levels between its corners' values, so that the grid is gone through once.
  const LEVEL = 0.55, NLEV = 14;
  function drawContours(ctx, V, grid, g, fade) {
    const { nx, ny, G } = grid;
    const even = Array.from({ length: 2 * NLEV + 1 }, () => []);
    const crit = model.act.crit.map((p) => ({ v: g(p[0], p[1]), segs: [] }));
    const cut = (a, b, c, d, v, x0, y0, out) => {
      const A = a - v, B = b - v, Cc = c - v, D = d - v, s = GRID, e = [];
      if ((A > 0) !== (B > 0)) e.push(x0 + s * A / (A - B), y0);
      if ((B > 0) !== (Cc > 0)) e.push(x0 + s, y0 + s * B / (B - Cc));
      if ((D > 0) !== (Cc > 0)) e.push(x0 + s * D / (D - Cc), y0 + s);
      if ((A > 0) !== (D > 0)) e.push(x0, y0 + s * A / (A - D));
      for (let q = 0; q + 3 < e.length; q += 4) out.push(e[q], e[q + 1], e[q + 2], e[q + 3]);
    };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = G[j * nx + i], b = G[j * nx + i + 1], c = G[(j + 1) * nx + i + 1], d = G[(j + 1) * nx + i];
        const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d), x0 = i * GRID, y0 = j * GRID;
        for (let k = Math.max(-NLEV, Math.ceil(lo / LEVEL)); k <= Math.min(NLEV, Math.floor(hi / LEVEL)); k++) cut(a, b, c, d, k * LEVEL, x0, y0, even[k + NLEV]);
        for (const L of crit) if (L.v >= lo && L.v <= hi) cut(a, b, c, d, L.v, x0, y0, L.segs);
      }
    }
    ctx.lineWidth = 1;
    const stroke = (segs, alpha) => {
      if (!segs.length) return;
      ctx.strokeStyle = MM.rgba('c1-text', alpha);
      ctx.beginPath();
      for (let q = 0; q < segs.length; q += 4) { ctx.moveTo(segs[q], segs[q + 1]); ctx.lineTo(segs[q + 2], segs[q + 3]); }
      ctx.stroke();
    };
    for (const segs of even) stroke(segs, 0.11 * fade);
    for (const L of crit) stroke(L.segs, 0.3 * fade);
  }
  // the landscape, its level lines and the axes of the picture at the top, kept while they stay the
  // same (they depend on the critical points, arg ħ, the window and the size: not on Γ, |ħ| or Flow)
  const base = document.createElement('canvas'), bctx = base.getContext('2d');
  let baseKey = '';
  function drawBase(ctx, V, k) {
    const dpr = MM.pixelRatio(), key = [critKey(cur()), state.phi.toFixed(9), state.frame.c.join(','), V.R, V.W, V.H, dpr, k].join('|');
    if (k === 1 && key === baseKey) { ctx.drawImage(base, 0, 0, V.W, V.H); return; }
    const into = k === 1 ? bctx : ctx;
    if (k === 1) {
      const w = Math.round(V.W * dpr), h = Math.round(V.H * dpr);
      if (base.width !== w || base.height !== h) { base.width = w; base.height = h; }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    MM.clearCanvas(into, MM.color('surface'));
    const g = landFn(), grid = landGrid(V, g);
    paintLand(into, V, grid);
    drawContours(into, V, grid, g, k < 1 ? 0.7 : 1);
    drawAxes(into, V, ['$\\mathrm{Re}\\,x$', '$\\mathrm{Im}\\,x$'], k < 1);
    if (k === 1) { baseKey = key; ctx.drawImage(base, 0, 0, V.W, V.H); }
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
  // end and far out along its valley, without corners (the flow would sharpen a corner into a
  // kink). Flow pushes every point of it up the landscape for a time that grows as the square of
  // the slider (the flow is slowed where S' is large, so that nothing reaches infinity: the same
  // paths, at other speeds), with points put in wherever neighbours draw apart on the screen. The
  // points where Γ crosses the ascending paths K_i are carried too; they run into the critical
  // points, and the arrows that show which way Γ runs follow them.
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
    // the bend: a cubic that leaves each handle along its end's direction, bulging a little to one
    // side about the middle of the window, clear of a critical point there
    const d = [Hb[0] - Ha[0], Hb[1] - Ha[1]], dl = Math.hypot(d[0], d[1]) || 1, side = [-0.1 * act.scale * d[1] / dl, 0.1 * act.scale * d[0] / dl];
    const P1 = [Ha[0] - 0.7 * rr * ua[0], Ha[1] - 0.7 * rr * ua[1]], P2 = [Hb[0] - 0.7 * rr * ub[0], Hb[1] - 0.7 * rr * ub[1]];
    const bez = (t) => {
      const u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t, bump = 16 * t * t * u * u;
      return [0, 1].map((c) => b0 * Ha[c] + b1 * P1[c] + b2 * P2[c] + b3 * Hb[c] + bump * side[c]);
    };
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
    // where Γ crosses the ascending paths: found on the polylines, then made exact (on K_i,
    // (S − S(p_i))/ħ is real), so that the flow carries them into the critical points
    // (they do not depend on Flow: kept while only Flow changes)
    const N1 = 240, path0 = [], ck = [critKey(cur()), state.phi.toFixed(7), ta.toFixed(6), tb.toFixed(6), f.join(','), rr, dirsSig()].join('|');
    for (let q = 0; q <= N1; q++) path0.push(at(q / N1));
    if (gam.ck === ck) { finishGamma(V, at, go, path0, gam.asc, gam.crossS, ck); return; }
    const asc = act.crit.map((p, i) => {
      const dd = St.mul(model.dirs[i], [0, 1]), o = { R: 30 * act.scale };
      return [St.branch(act, i, state.phi + Math.PI, dd, o), St.branch(act, i, state.phi + Math.PI, St.scl(dd, -1), o)];
    });
    const seg = (p, q, r, t) => {
      const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [t[0] - r[0], t[1] - r[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) < 1e-300) return null;
      const u = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den, v = ((r[0] - p[0]) * d1[1] - (r[1] - p[1]) * d1[0]) / den;
      return u >= 0 && u < 1 && v >= 0 && v < 1 ? u : null;
    };
    const rot = St.cis(-state.phi), crossS = [];
    asc.forEach((halves, i) => halves.forEach((hh) => {
      const F = (s) => St.mul(St.sub(St.evalS(act, at(s)), act.values[i]), rot)[1];
      for (let k = 0; k + 3 < hh.pts.length; k += 2) {
        const r = [hh.pts[k], hh.pts[k + 1]], t = [hh.pts[k + 2], hh.pts[k + 3]];
        for (let e = 0; e + 1 < path0.length; e++) {
          const u = seg(path0[e], path0[e + 1], r, t);
          if (u === null) continue;
          let lo = e / N1, hi = (e + 1) / N1, flo = F(lo), sc = (e + u) / N1;
          if (flo * F(hi) < 0) {
            for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2, fm = F(mid); if (fm * flo <= 0) hi = mid; else { lo = mid; flo = fm; } }
            sc = (lo + hi) / 2;
          }
          crossS.push(sc);
        }
      }
    }));
    finishGamma(V, at, go, path0, asc, crossS, ck);
  }
  // Γ after the flow: its points, refined where neighbours draw apart on the screen, and the
  // crossings carried along
  function finishGamma(V, at, go, path0, asc, crossS, ck) {
    const pts = [];
    const N0 = 120;
    for (let q = 0; q <= N0; q++) { const s = q / N0; pts.push({ s, x: go(at(s)) }); }
    for (const sc of crossS) pts.push({ s: sc, x: go(at(sc)), mark: true });
    pts.sort((p, q) => p.s - q.s);
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
    const marks = [];
    pts.forEach((p, q) => { if (p.mark) marks.push(q); });
    gam = { key: gammaKey(V), ck, crossS, pts: pts.map((p) => p.x), orig: path0, asc, marks, cross: marks.map((q) => pts[q].x) };
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
    // which way Γ runs: an arrow a little after each point where it crosses an ascending path,
    // carried with those points, so that it moves smoothly with the flow and the handles (with
    // the flow it runs along the thimble that point is on); with none in view, one in the middle
    // of the longest part of Γ in view
    ctx.lineWidth = 2.2;
    const inside = (p) => p[0] > 4 && p[0] < V.W - 4 && p[1] > 4 && p[1] < V.H - 4, far = 0.5 * V.W;
    let drawn = 0;
    for (const q0 of gam.marks) {
      if (!inside(P[q0])) continue;
      let left = 30, a = null;
      for (let q = q0 + 1; q < P.length; q++) {
        const dx = P[q][0] - P[q - 1][0], dy = P[q][1] - P[q - 1][1], l = Math.hypot(dx, dy);
        if (l > far || !inside(P[q])) break;
        if (l >= left && l > 0) { const t = left / l; a = { x: P[q - 1][0] + t * dx, y: P[q - 1][1] + t * dy, dx: dx / l, dy: dy / l }; break; }
        left -= l;
      }
      if (a) { chevron(ctx, a, 6); drawn++; }
    }
    if (drawn) return;
    let best = null, bestL = 60;
    for (const pc of pieces) {
      let run = [];
      const done = () => {
        let L = 0;
        for (let q = 1; q < run.length; q++) L += Math.hypot(run[q][0] - run[q - 1][0], run[q][1] - run[q - 1][1]);
        if (L > bestL) { bestL = L; best = run; }
        run = [];
      };
      for (const p of pc) { if (inside(p)) run.push(p); else done(); }
      done();
    }
    const a = best && along(best, 0.5);
    if (a) chevron(ctx, a, 6);
  }
  // the plane into a canvas: at full size (k = 1), or small, as a copy beside a figure in the text
  function renderPlane(ctx, V, k) {
    MM.clearCanvas(ctx, MM.color('surface'));
    drawBase(ctx, V, k);
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
    // their names: S(p_i) by each value, away from its ray, and S(J_i) beside the ray; each where it
    // covers no ray, dot or other name, or not at all
    const boxes = [], w0 = 46, h0 = 18, nx = [-e[1], e[0]];
    const clear = (w0 / 2) * Math.abs(nx[0]) + (h0 / 2) * Math.abs(nx[1]) + 3;
    const offRays = (x, y) => pos.every((q) => {
      const dx = x - q[0], dy = y - q[1], along = dx * e[0] + dy * e[1];
      return along < -clear || Math.abs(dx * nx[0] + dy * nx[1]) > clear;
    });
    const put = (tex, x, y, color) => {
      const b = [x - w0 / 2, y - h0 / 2, x + w0 / 2, y + h0 / 2];
      if (b[0] < 2 || b[2] > Z.W - 2 || b[1] < 2 || b[3] > Z.H - 2) return false;
      if (boxes.some((q) => b[0] < q[2] && q[0] < b[2] && b[1] < q[3] && q[1] < b[3])) return false;
      if (pos.some((q) => Math.max(b[0] - q[0], q[0] - b[2], b[1] - q[1], q[1] - b[3]) < 9)) return false;
      if (!offRays(x, y)) return false;
      boxes.push(b);
      // (on a pale ground, where it crosses an axis)
      ctx.fillStyle = MM.rgba('surface', 0.85);
      ctx.beginPath(); ctx.roundRect(x - w0 / 2 + 3, y - h0 / 2 + 1, w0 - 6, h0 - 2, 4); ctx.fill();
      MM.canvasLabel(ctx, tex, x, y, { size: 13, align: 'center', baseline: 'middle', color });
      return true;
    };
    pos.forEach((p, i) => {
      // beside the dot, on the side away from its ray first: left or right of it, then below or above
      const tex = '$S(p_{' + (i + 1) + '})$', col = MM.color('th-' + (i + 1) + '-text'), sx = e[0] >= 0 ? -1 : 1, sy = e[1] >= 0 ? -1 : 1;
      for (const [dx, dy] of [[sx * 32, 0], [0, sy * 19], [-sx * 32, 0], [0, -sy * 19], [sx * 30, sy * 15]]) if (put(tex, p[0] + dx, p[1] + dy, col)) break;
    });
    pos.forEach((p, i) => {
      // some way back from where the ray leaves the picture, on either side of it
      let t = far;
      if (e[0] > 1e-9) t = Math.min(t, (Z.W - p[0]) / e[0]); else if (e[0] < -1e-9) t = Math.min(t, -p[0] / e[0]);
      if (e[1] > 1e-9) t = Math.min(t, (Z.H - p[1]) / e[1]); else if (e[1] < -1e-9) t = Math.min(t, -p[1] / e[1]);
      const tex = '$S(J_{' + (i + 1) + '})$', col = MM.color('th-' + (i + 1) + '-text');
      for (const d of [t - 40, t - 90, 0.5 * t]) for (const sg of [1, -1]) {
        if (d < 30) continue;
        // (beside its own ray: clear of it by just over the margin)
        const x = p[0] + e[0] * d + nx[0] * sg * (clear + 1), y = p[1] + e[1] * d + nx[1] * sg * (clear + 1);
        if (put(tex, x, y, col)) return;
      }
    });
  }

  /* ---------- the integral as a function of ħ ---------- */

  // I(ħ) on the disc |ħ| ≤ R of the plane of ħ, in ordinary coordinates. It is computed row by row,
  // a row for each of H_NA directions: the thimbles there and their integrals for H_NR moduli at
  // once (stokes.js, rayIntegrals), a few rows a frame. A pixel takes the branch of I continued
  // from ħ the short way round, so the picture has a cut on the ray opposite ħ (hidden by a fade);
  // its colour is the phase of I (the key), with lines of constant phase and modulus, darkened where
  // the terms Σ n_i ∫_{J_i} cancel, near the zeros of I. Since a row's colours depend on ħ only
  // through the branch it takes, only the rows the cut passes are painted again as ħ turns.
  // The moduli are spaced evenly in log |ħ|, from far inside the disc at its largest zoom (HZ_MAX)
  // out to the rim at none, so that the picture zooms without computing again.
  const H_NA = 360, H_NR = 48, H_MARGIN = 0.5, H_U = 6.5, HZ_MAX = 16;
  // The rows are worked out coarse to fine: every 8th, then those half way between, and so on; a
  // row not yet worked out is painted from the nearest that is, so that the disc fills at once
  // and sharpens (H_ORDER). The picture is painted at most at twice the CSS resolution.
  const H_ORDER = [];
  for (const [step, off] of [[8, 0], [8, 4], [4, 2], [2, 1]]) for (let a = off; a < H_NA; a += step) H_ORDER.push(a);
  // While it zooms, and for a moment after its view changes, it is painted at the CSS resolution
  // (hQuick), and sharpened once that is over.
  const fullRes = () => { const pr = MM.pixelRatio(); return pr === (window.devicePixelRatio || 1) ? Math.min(pr, 2) : pr; };
  let hFast = false, hFastT = 0;
  const hRes = () => (hFast ? Math.min(1, fullRes()) : fullRes());
  function hQuick(ms) {
    hFast = true;
    clearTimeout(hFastT);
    hFastT = setTimeout(() => { hFast = false; drawH(); drawHCopies(); }, ms);
  }
  let hData = { key: '' }, hReq = 0;
  // the disc, with room around it for an arc for each thimble (sp apart, the first gap out), and
  // above that for the name of the axis
  function hview(w, h) {
    const W = w || hcv.clientWidth, H = h || hcv.clientHeight, M = Math.min(W, H), R = model.RH / state.hz;
    const gap = 0.016 * M, sp = 0.018 * M, D = 0.5 * M - gap - sp * model.act.n - 0.065 * M;
    return { W, H, D, R, k: D / R, gap, sp, cx: W / 2, cy: H / 2, X: (x) => W / 2 + x * D / R, Y: (y) => H / 2 - y * D / R };
  }
  const hvNow = () => Math.min(state.hv, model.act.n);
  const hKey = () => critKey(cur()) + '|' + model.RH.toPrecision(9);
  function hStart() {
    const key = hKey();
    if (hData.key !== key) {
      const R = model.RH, lr0 = Math.log(R / (40 * HZ_MAX)), lq = (Math.log(R) - lr0) / (H_NR - 1);
      const rhos = Array.from({ length: H_NR }, (_, r) => Math.exp(lr0 + lq * r));
      hData = {
        key, R, rhos, lr0, lq, tgs: {}, rows: new Array(H_NA), next: 0,
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
    // (a longer step while the disc is still coarse, so that it fills sooner)
    const budget = hData.next < H_NA / 8 ? 40 : 16;
    while (hData.next < H_NA && performance.now() - t0 < budget) hRow(H_ORDER[hData.next++]);
    drawH();
    drawHCopies();
    // (busy while the rows are worked out; data-rows says how many are)
    hcv.setAttribute('aria-busy', String(hData.next < H_NA));
    hcv.dataset.rows = hData.next;
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
    const dpr = hRes(), w = Math.round(V.W * dpr), h = Math.round(V.H * dpr), gk = cur().gamma.join(','), hv = hvNow();
    let img = hData.img;
    // (the lines of constant phase and modulus once every row is worked out: before, borrowed rows
    // break them)
    const lines = hData.next >= H_NA;
    const fresh = !img || img.w !== w || img.h !== h || hData.gkey !== gk || img.hv !== hv || img.R !== V.R || img.lines !== lines;
    if (hData.gkey !== gk) { hData.ncache = new Map(); hData.gkey = gk; }
    if (fresh) {
      img = hData.img = { w, h, hv, lines, R: V.R, data: new ImageData(w, h), ks: new Array(H_NA).fill(null), use: new Int16Array(H_NA).fill(-2), pix: null, row: new Int16Array(w * h), rho: new Float32Array(w * h), th: new Float32Array(w * h), side: new Float32Array(w * h), ph: new Float32Array(w * h), lm: new Float32Array(w * h), sh: new Float32Array(w * h), kind: new Uint8Array(w * h) };
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const q = py * w + px, x = ((px + 0.5) / dpr - V.cx) / V.k, y = -((py + 0.5) / dpr - V.cy) / V.k, r = Math.hypot(x, y), t = Math.atan2(y, x);
        img.rho[q] = r; img.th[q] = t;
        // (outside the disc, and ħ = 0 itself, where I has its essential singularity, are left white)
        const fa = (t + Math.PI) / TAU * H_NA, a = Math.min(H_NA - 1, Math.floor(fa));
        img.row[q] = r > V.R || r < 1e-9 * V.R ? -1 : a;
        // where the pixel lies between its row's direction and the next row's (signed, < ½)
        img.side[q] = fa - a - 0.5;
      }
      // the pixels of each row, and the ground outside the disc
      const count = new Int32Array(H_NA), S = rgbOf('surface'), d0 = img.data.data;
      for (let q = 0; q < w * h; q++) {
        const a = img.row[q];
        if (a >= 0) { count[a]++; continue; }
        const o = 4 * q; d0[o] = S[0]; d0[o + 1] = S[1]; d0[o + 2] = S[2]; d0[o + 3] = 255;
      }
      img.pix = Array.from({ length: H_NA }, (_, a) => new Int32Array(count[a]));
      count.fill(0);
      for (let q = 0; q < w * h; q++) { const a = img.row[q]; if (a >= 0) img.pix[a][count[a]++] = q; }
    }
    // the rows to paint: the branch each takes now (and their neighbours, which they are blended with)
    // (a row not yet worked out uses the nearest that is, `use`; one whose branch or whose row in
    // use has changed is painted again)
    const changed = new Uint8Array(H_NA), todo = new Uint8Array(H_NA), kOld = img.ks.slice();
    for (let a = 0; a < H_NA; a++) {
      const row = hData.rows[a];
      img.ks[a] = row ? Math.round((St.liftNear(row.th, state.phi) - row.th) / TAU) : null;
    }
    const near = new Int16Array(H_NA).fill(-1), dist = new Int16Array(H_NA).fill(H_NA);
    for (let pass = 0; pass < 2; pass++) for (let q = 0; q < 2 * H_NA; q++) {
      const a = pass ? (2 * H_NA - 1 - q) % H_NA : q % H_NA, prev = pass ? (a + 1) % H_NA : (a + H_NA - 1) % H_NA;
      if (hData.rows[a]) { near[a] = a; dist[a] = 0; } else if (near[prev] >= 0 && dist[prev] + 1 < dist[a]) { near[a] = near[prev]; dist[a] = dist[prev] + 1; }
    }
    let any = false;
    for (let a = 0; a < H_NA; a++) {
      const u = near[a];
      if (fresh || u !== img.use[a] || (u >= 0 && img.ks[u] !== kOld[u])) { changed[a] = 1; any = true; }
      img.use[a] = u;
    }
    if (!any) return img;
    for (let a = 0; a < H_NA; a++) todo[a] = changed[a] | changed[(a + 1) % H_NA] | changed[(a + H_NA - 1) % H_NA];
    // the row next to a towards the pixel, when it continues a's branch
    const lifted = (a) => hData.rows[a].th + TAU * img.ks[a];
    const nextRow = (a, sd) => {
      const b = (a + (sd < 0 ? H_NA - 1 : 1)) % H_NA;
      return hData.rows[a] && hData.rows[b] && Math.abs(Math.abs(lifted(b) - lifted(a)) - TAU / H_NA) < 1e-6 ? b : -1;
    };
    const vals = model.act.values, nT = model.act.n;
    const re = new Float64Array(nT), im = new Float64Array(nT), Tr = new Float64Array(nT), Ti = new Float64Array(nT), Ur = new Float64Array(nT), Ui = new Float64Array(nT);
    // the size of each term to leading order, |e^{-S(p_i)/ħ}| √(2π|ħ|/|S''(p_i)|), without the exponential
    const lead = model.act.second.map((s2) => Math.sqrt(TAU / St.abs(s2)));
    // first the values: for each pixel the phase ph and the log of the modulus L of the integral, how
    // dark it is (near the zeros of I, where the terms cancel), and whether it is pale (kind 2: J_i
    // where J_i is not in Γ); kind 0 has no value
    const PH = img.ph, LM = img.lm, SH = img.sh, KIND = img.kind;
    let total = 0;
    for (let a = 0; a < H_NA; a++) if (todo[a]) total += img.pix[a].length;
    const list = new Int32Array(total);
    let fill = 0;
    for (let a0 = 0; a0 < H_NA; a0++) if (todo[a0]) for (const q of img.pix[a0]) {
      list[fill++] = q;
      KIND[q] = 0;
      const a = img.use[a0];
      if (a < 0) continue;
      const row = hData.rows[a], n = hCoef(a, img.ks[a]);
      if (!n) continue;
      const rho = img.rho[q], t = img.th[q], ct = Math.cos(t), st = Math.sin(t);
      // (between moduli in log |ħ|; inside the first, the integrals over √|ħ| hardly change)
      const fr = (Math.log(rho) - hData.lr0) / hData.lq, r0 = Math.max(0, Math.min(H_NR - 2, Math.floor(fr))), u = Math.max(0, Math.min(1, fr - r0));
      // the thimble integrals, from the row's moduli on either side, and from the next row's (U)
      // (blended only in a row of its own, not one borrowed while the disc is coarse)
      const sd = img.side[q], b0 = a === a0 ? nextRow(a, sd) : -1, nb = b0 < 0 ? null : hCoef(b0, img.ks[b0]), b = nb ? b0 : -1;
      const wb = b < 0 ? 0 : Math.abs(sd), wa = 1 - wb;
      for (let i = 0; i < nT; i++) {
        re[i] = -(vals[i][0] * ct + vals[i][1] * st) / rho;
        im[i] = -(vals[i][1] * ct - vals[i][0] * st) / rho;
        const T = row.T[i];
        Tr[i] = T[2 * r0] + u * (T[2 * r0 + 2] - T[2 * r0]); Ti[i] = T[2 * r0 + 1] + u * (T[2 * r0 + 3] - T[2 * r0 + 1]);
        if (wb) {
          const U = hData.rows[b].T[i];
          Ur[i] = U[2 * r0] + u * (U[2 * r0 + 2] - U[2 * r0]); Ui[i] = U[2 * r0 + 1] + u * (U[2 * r0 + 3] - U[2 * r0 + 1]);
        }
      }
      // (the rows hold the integrals over √|ħ|)
      let ph, L, sh = 1;
      if (hv) {
        // the integral over J_i, oriented as the page orients it: carried round from ħ the short way,
        // its direction at p_i turns by half the angle, so a row taken k turns on changes sign
        const i = hv - 1, tr = wa * Tr[i] + wb * Ur[i], ti = wa * Ti[i] + wb * Ui[i];
        ph = Math.atan2(ti, tr) + im[i] + (img.ks[a] & 1 ? Math.PI : 0);
        L = Math.log(Math.hypot(tr, ti)) + re[i] + 0.5 * Math.log(rho);
      } else {
        // I, from each row with its own coefficients, the two blended (across a Stokes ray the
        // coefficients and the thimble integrals jump, I does not), scaled by the largest term
        let emax = -Infinity;
        for (let i = 0; i < nT; i++) if ((n[i] || (wb && nb[i])) && re[i] > emax) emax = re[i];
        let sr = 0, si = 0, big = 0;
        for (let i = 0; i < nT; i++) {
          const ka = wa * n[i], kb = wb ? wb * nb[i] : 0;
          if (!ka && !kb) continue;
          const f = Math.exp(re[i] - emax), c = Math.cos(im[i]), s2 = Math.sin(im[i]);
          const xr = ka * Tr[i] + kb * Ur[i], xi = ka * Ti[i] + kb * Ui[i];
          sr += f * (xr * c - xi * s2); si += f * (xr * s2 + xi * c);
          // darker near the zeros of I: |I| against the largest of its terms to leading order, which
          // does not jump (on a Stokes ray only a smaller term enters or leaves)
          big = Math.max(big, Math.max(Math.abs(n[i]), wb ? Math.abs(nb[i]) : 0) * f * lead[i]);
        }
        ph = Math.atan2(si, sr);
        L = Math.log(Math.hypot(sr, si)) + emax + 0.5 * Math.log(rho);
        sh = 0.4 + 0.6 * Math.pow(big > 0 ? Math.min(1, Math.hypot(sr, si) / (0.8 * big)) : 1, 0.5);
      }
      if (!Number.isFinite(ph)) continue;
      PH[q] = ph; LM[q] = L; SH[q] = sh; KIND[q] = hv && !n[hv - 1] ? 2 : 1;
    }
    // then the colours (MM.phase.paint), with thin lines of constant phase and of constant modulus,
    // which break across a jump; pale where J_i is not in Γ
    MM.phase.paint(img.data, { w, h, dpr, ph: PH, lm: LM, kind: KIND, shade: SH, lines, pixels: list });
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
    // opposite ħ the picture fades to white: the continuations round either side meet there and
    // do not agree, which is no jump of I but the end of the branch drawn
    const fade = MM.phase.cut(hctx, V.cx, V.cy, state.phi + Math.PI, Math.PI / 4), seen = fade.seen;
    fade.veil(V.D + 1);
    drawAxes(hctx, { W: V.W, H: V.H, X: V.X, Y: V.Y }, ['$\\mathrm{Re}\\,\\hbar$', '$\\mathrm{Im}\\,\\hbar$'], false);
    // the rim
    hctx.strokeStyle = MM.color('rule');
    hctx.lineWidth = 1;
    hctx.beginPath(); hctx.arc(V.cx, V.cy, V.D, 0, TAU); hctx.stroke();
    if (stokesData.key !== stokesKey()) computeStokes();
    const runs = stokesData.runs, hv = hvNow();
    // a ray from r0 to r1
    const ray = (t, dash, color, r0, r1, w) => {
      const c = Math.cos(t), sn = Math.sin(t);
      const line = () => { hctx.beginPath(); hctx.moveTo(V.cx + r0 * c, V.cy - r0 * sn); hctx.lineTo(V.cx + r1 * c, V.cy - r1 * sn); hctx.stroke(); };
      hctx.setLineDash(dash);
      hctx.strokeStyle = color;
      hctx.lineWidth = w;
      line();
      hctx.setLineDash([]);
    };
    // red, over J_i: the Stokes rays of J_i, where it jumps (faded with the picture, opposite ħ);
    // red, as the thimbles that run into a point are in the plane of x, so that they read over the
    // axes and apart from the lines of the grid. I itself does not jump: none
    const stokesRay = (t) => { const a = seen(t); if (a > 0.02) ray(t, [], MM.rgba('highlight', 0.9 * a), 0, V.D, 1.4); };
    if (hv) for (const rr of model.rays[hv - 1] || []) stokesRay(St.liftNear(rr.theta, state.phi));
    // on the rim, over Γ, a red mark on each Stokes ray (of any thimble), pointing in (over J_i its
    // own Stokes rays are drawn across the disc)
    const marks = [];
    if (!hv) for (const list of model.rays) for (const rr of list) {
      const t = St.liftNear(rr.theta, state.phi);
      if (!marks.some((u) => Math.abs(Math.sin((u - t) / 2)) < 1e-6)) marks.push(t);
    }
    for (const t of marks) { const a = seen(t); if (a >= 0.02) MM.phase.mark(hctx, V.cx, V.cy, V.D, t, a); }
    // around the rim, an arc for each thimble where it is in Γ: they begin and end on the Stokes rays
    hctx.lineCap = 'butt';
    hctx.lineWidth = 0.62 * V.sp;
    fade.faded((c) => {
      c.lineCap = 'butt';
      c.lineWidth = 0.62 * V.sp;
      for (let i = 0; i < model.act.n; i++) {
        const rr = V.D + V.gap + V.sp * (i + 0.5), k = !hv || hv === i + 1 ? 1 : 0.3;
        c.strokeStyle = MM.rgba('th-' + (i + 1), k);
        for (const run of runs) {
          if (!run.n || !run.n[i]) continue;
          c.beginPath(); c.arc(V.cx, V.cy, rr, -run.b, -run.a); c.stroke();
        }
      }
    }, V.D + 1, V.D + V.gap + V.sp * model.act.n + 2);
    // arg ħ, out from the handle across the arcs, to read off which thimbles are in Γ there (the
    // handle stays on the rim when |ħ| is beyond the disc drawn)
    const rOut = V.D + V.gap + V.sp * model.act.n, ct = Math.cos(state.phi), st = Math.sin(state.phi), rk = Math.min(cur().r, V.R) * V.k;
    // ending in a knob that turns ħ round and keeps |ħ| (a press anywhere outside the disc does,
    // with a mouse), and the box over it for a finger
    MM.phase.knob(hctx, V.cx, V.cy, rk + 9, rOut + 8, state.phi);
    placeBox(hknob, V.cx + (rOut + 8) * ct, V.cy - (rOut + 8) * st);
    // 0, where I has its essential singularity: the colours turn ever faster there
    hctx.fillStyle = MM.color('surface');
    hctx.beginPath(); hctx.arc(V.cx, V.cy, 5, 0, TAU); hctx.fill();
    hctx.fillStyle = MM.color('ink-2');
    hctx.beginPath(); hctx.arc(V.cx, V.cy, 2, 0, TAU); hctx.fill();
    const kr = Math.max(13, Math.min(18, 0.045 * Math.min(V.W, V.H)));
    MM.phase.key(hctx, V.W - kr - 16, V.H - kr - 16, kr);
    // ħ: the handle (an element over the canvas, which centres itself on the point), named beside it
    const r = cur().r, hp = [V.cx + ct * rk, V.cy - st * rk], lp = [hp[0] + 19 * st, hp[1] + 19 * ct];
    hctx.fillStyle = MM.rgba('surface', 0.8);
    hctx.beginPath(); hctx.arc(lp[0], lp[1], 9, 0, TAU); hctx.fill();
    MM.canvasLabel(hctx, '$\\hbar$', lp[0], lp[1], { size: 16, align: 'center', baseline: 'middle', color: MM.color('ink') });
    hbarEl.style.transform = 'translate(' + hp[0].toFixed(1) + 'px,' + hp[1].toFixed(1) + 'px)';
    // (arg ħ as it is, not mod 360°: after a whole turn I(ħ) is on another branch)
    const dg = Math.round(state.phi * 180 / Math.PI);
    hbarEl.setAttribute('aria-valuetext', 'arg ħ = ' + dg + '°, |ħ| = ' + rTex(r) + (state.snap ? ', on a Stokes ray' : ''));
    MM.setHTML($('hval'), '$|\\hbar|=' + rTex(r) + ',\\quad\\arg\\hbar=' + dg + '^\\circ$');
    syncHpick();
    const capKey = hv + '|' + model.act.n;
    if (hcap.dataset.k !== capKey) {
      hcap.dataset.k = capKey;
      if (!hv) hcap.innerHTML = HCAP0;
      else MM.setHTML(hcap, '$\\int_{J_{' + hv + '}}\\mathrm{e}^{-S/\\hbar}\\,dx$ coloured by its phase, with lines of constant phase and modulus. It jumps across the Stokes rays of $J_{' + hv + '}$ (red), more visibly when zoomed out, and is pale where $J_{' + hv + '}$ is not in $\\Gamma$, off its arc.');
    }
  }
  // the menu of the integral the picture shows: over Γ, or over one thimble
  const hpick = $('hpick'), hcap = $('hcap'), HCAP0 = hcap.innerHTML;
  hcap.dataset.k = '0|2';
  function syncHpick() {
    const n = model.act.n, on = hvNow();
    if (hpick.querySelectorAll('button').length !== n + 1) {
      hpick.querySelectorAll('button').forEach((q) => q.remove());
      for (let v = 0; v <= n; v++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.dataset.v = v;
        MM.setHTML(b, v ? '$J_{' + v + '}$' : '$\\Gamma$');
        hpick.appendChild(b);
      }
    }
    hpick.querySelectorAll('button').forEach((b) => {
      const v = String(+b.dataset.v === on);
      if (b.getAttribute('aria-checked') !== v) b.setAttribute('aria-checked', v);
    });
  }
  hpick.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    state.hv = +b.dataset.v;
    hQuick(60);
    drawH();
    drawHCopies();
    if (example) example.changed();
  });

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
      + item('<svg class="sp-key" viewBox="-11 -10 22 20" aria-hidden="true"><circle class="handle-point" r="8" style="stroke:var(--th-1);stroke-width:2.2"/><text class="handle-num" y="3.9">1</text></svg>', 'critical points ' + (model.act.n > 2 ? '$p_1,\\dots,p_{' + model.act.n + '}$' : '$p_1,p_2$'))
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
    // (the figures in the text and their copies of the pictures, while they are in view)
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

  // A box over a handle that a canvas draws (a knob), which on a touch screen takes the finger from
  // the page (.draggable): elsewhere on the picture a finger scrolls the page. Hidden until placed.
  function touchBox(parent) {
    const b = document.createElement('div');
    b.className = 'handle draggable sp-touchbox';
    b.setAttribute('aria-hidden', 'true');
    b.hidden = true;
    parent.appendChild(b);
    return b;
  }
  // how far from the point ħ (as the picture of I(ħ), or a copy of it, draws it) a press is
  function grabOffset(e, cv) {
    const [px, py] = localXY(e, cv), V = hview(cv.clientWidth, cv.clientHeight), r = Math.min(cur().r, V.R) * V.k;
    return [px - (V.cx + Math.cos(state.phi) * r), py - (V.cy - Math.sin(state.phi) * r)];
  }
  function placeBox(b, x, y) {
    b.hidden = false;
    b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }

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
  // On a touch screen a finger moves ħ only from its handle or from the knob of arg ħ (a box over
  // it, touchBox); elsewhere it scrolls the page, and two fingers zoom (MM.pinchZoom, which takes
  // a pinch on a trackpad too). A mouse or a pen moves ħ from anywhere on the picture. The zoom by
  // its menu and the keys + and − zoom too; it zooms about 0, its middle.
  const hzoomEl = $('hzoom'), hknob = touchBox(hplane);
  let hzReq = 0;
  function zoomH(f) {
    const z = clamp(state.hz * f, 1, HZ_MAX);
    if (Math.abs(z - state.hz) < 1e-9) return;
    state.hz = z;
    hzoomEl.value = z;
    hQuick(220);
    if (!hzReq) hzReq = soon(() => { hzReq = 0; drawH(); drawHCopies(); if (example) example.changed(); });
  }
  hzoomEl.addEventListener('input', () => zoomH(hzoomEl.value / state.hz));
  MM.pinchZoom(hplane, { zoom: (f) => zoomH(f) });
  hplane.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    const onHbar = hbarEl.contains(e.target), fromHandle = onHbar || e.target === hknob;
    if (e.pointerType === 'touch' && !fromHandle) return;
    e.preventDefault();
    stopTurn();
    drag = { kind: 'hbar', r0: cur().r, phi0: state.phi, arg: e.target === hknob || (!onHbar && onRing(e)), off: onHbar ? grabOffset(e, hcv) : null };
    hplane.setPointerCapture(e.pointerId);
    hbarEl.focus({ preventScroll: true });
    moveHbar(e);
  });
  // outside the disc, round the arcs and the knob of arg ħ: there a drag turns ħ only (with a hand
  // over the knob)
  function onRing(e) {
    const [px, py] = localXY(e, hcv), V = hview();
    return Math.hypot(px - V.cx, py - V.cy) > V.D + 3;
  }
  function onKnob(e) {
    const [px, py] = localXY(e, hcv), V = hview(), kn = V.D + V.gap + V.sp * model.act.n + 8;
    return Math.hypot(px - V.cx - kn * Math.cos(state.phi), py - V.cy + kn * Math.sin(state.phi)) < 11;
  }
  hplane.addEventListener('pointermove', (e) => { if (!drag && e.pointerType !== 'touch') hplane.classList.toggle('on-knob', onKnob(e)); });
  hplane.addEventListener('pointerleave', () => hplane.classList.remove('on-knob'));
  function moveHbar(e) {
    if (!drag || drag.kind !== 'hbar') return;
    // (on the picture, or on one of its copies beside the figures in the text)
    // (less how far from ħ its handle was taken, so that ħ does not jump to the finger)
    const cv = drag.cv || hcv, [qx, qy] = localXY(e, cv), px = qx - (drag.off ? drag.off[0] : 0), py = qy - (drag.off ? drag.off[1] : 0);
    const V = hview(cv.clientWidth, cv.clientHeight), x = (px - V.cx) / V.k, y = (V.cy - py) / V.k, r = Math.hypot(x, y);
    // (on the ring round the disc only the angle; held on a Stokes ray within a few pixels)
    if (!drag.arg) setR(r);
    setPhi(St.liftNear(Math.atan2(y, x), state.phi), Math.min(0.15, 6 / Math.max((drag.arg ? r : cur().r) * V.k, 1)));
    later();
  }
  hplane.addEventListener('pointermove', moveHbar);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => hplane.addEventListener(t, () => {
    if (drag && drag.kind === 'hbar') { drag = null; commit(); draw(); }
  }));
  hbarEl.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') { e.preventDefault(); zoomH(e.key === '+' || e.key === '=' ? 1.25 : 0.8); MM.moved(); return; }
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
  $('jump').addEventListener('pointerover', (e) => { const t = e.target.closest('.sp-term'); setLit(t ? +t.dataset.i : -1); });
  $('jump').addEventListener('pointerleave', () => setLit(-1));
  $('jump').addEventListener('focusin', (e) => { const t = e.target.closest('.sp-term'); if (t) setLit(+t.dataset.i); });
  $('jump').addEventListener('focusout', () => setLit(-1));
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
  // the copies are drawn only while their figure is in view (or Save image is open); one that
  // comes into view is drawn then, with its figure (drawText)
  const copyShown = (cv) => !!cv.clientWidth && (document.documentElement.classList.contains('is-dialog-open') || [...visible].some((f) => f.el.contains(cv)));
  function drawCopies() {
    for (const cv of planeCopies) {
      if (!copyShown(cv)) continue;
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
    drawHCopies();
  }
  // the copies take a drag as the picture does: inside the disc ħ, outside it only arg ħ; on a touch
  // screen only from the point ħ or the knob (boxes over them), elsewhere the finger scrolls
  const copyBoxes = new Map();
  hCopies.forEach((cv) => {
    const box = cv.parentNode, dot = touchBox(box), knob = touchBox(box);
    copyBoxes.set(cv, { dot, knob });
    box.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      const fromHandle = e.target === dot || e.target === knob;
      if (e.pointerType === 'touch' && !fromHandle) return;
      e.preventDefault();
      stopTurn();
      const [px, py] = localXY(e, cv), V = hview(cv.clientWidth, cv.clientHeight);
      drag = { kind: 'hbar', cv, r0: cur().r, phi0: state.phi, arg: e.target === knob || (e.target !== dot && Math.hypot(px - V.cx, py - V.cy) > V.D + 3), off: e.target === dot ? grabOffset(e, cv) : null };
      box.setPointerCapture(e.pointerId);
      moveHbar(e);
    });
    box.addEventListener('pointermove', moveHbar);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => box.addEventListener(t, () => {
      if (drag && drag.kind === 'hbar' && drag.cv === cv) { drag = null; commit(); draw(); }
    }));
  });
  function drawHCopies() {
    for (const cv of hCopies) {
      if (!copyShown(cv) || !hcv.width) continue;
      const { w, h, ctx } = MM.fitCanvas(cv);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hcv, 0, 0, w, h);
      const V = hview(w, h), r = Math.min(cur().r, V.R), b = copyBoxes.get(cv), kn = V.D + V.gap + V.sp * model.act.n + 8;
      placeBox(b.dot, V.cx + Math.cos(state.phi) * r * V.k, V.cy - Math.sin(state.phi) * r * V.k);
      placeBox(b.knob, V.cx + Math.cos(state.phi) * kn, V.cy - Math.sin(state.phi) * kn);
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
  const NA = 540, NR = 240;
  function borelKey() { return critKey(cur()) + '|' + focusI(); }
  function computeBorel() {
    const act = model.act, i = focusI();
    let R = 0;
    act.values.forEach((v, j) => { if (j !== i) R = Math.max(R, St.abs(St.sub(v, act.values[i]))); });
    // (out to twice the farthest, so that the cuts are seen running out from the singularities)
    R = Math.max(R, 1e-6) * 2.2;
    const inv = St.localInverse(act, i, 24);
    const grid = new Float64Array(NA * 2 * (NR + 1)), buf = new Float64Array(2 * (NR + 1));
    for (let a = 0; a < NA; a++) {
      St.borelRay(act, i, -Math.PI + TAU * (a + 0.5) / NA, R, NR, inv, buf);
      grid.set(buf, a * 2 * (NR + 1));
    }
    borelData = { key: borelKey(), R, grid, i, img: null };
  }
  // the colour of a phase: round the data colours, lightened
  function paintBorel(V) {
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
        const c = MM.phase.color(Math.atan2(im, re));
        d[o] = c[0] * shade; d[o + 1] = c[1] * shade; d[o + 2] = c[2] * shade; d[o + 3] = 255;
      }
    }
    return img;
  }
  // the area two discs of radii a and b, d apart, have in common
  function lens(d, a, b) {
    if (d >= a + b) return 0;
    if (d <= Math.abs(a - b)) return Math.PI * Math.min(a, b) ** 2;
    const x = (d * d + a * a - b * b) / (2 * d), y = d - x;
    return a * a * Math.acos(x / a) - x * Math.sqrt(a * a - x * x) + b * b * Math.acos(y / b) - y * Math.sqrt(b * b - y * y);
  }
  function borelView() {
    const W = borelCv.clientWidth || 400, H = borelCv.clientHeight || 400, R = borelData.R || 1;
    // (room round the disc for the knob of arg ħ)
    const k = Math.min(W, H) / (2 * R * 1.2);
    return { W, H, k, cx: W / 2, cy: H / 2, X: (x) => W / 2 + x * k, Y: (y) => H / 2 - y * k };
  }
  // the key of the colours: a ring of phases, named at 1, i, −1, −i

  function drawBorel() {
    if (!borelCv.clientWidth || !model) return;
    if (borelData.key !== borelKey()) computeBorel();
    const fit = MM.fitCanvas(borelCv), ctx = fit.ctx, V = borelView(), i = borelData.i, act = model.act;
    const sizeKey = fit.w + 'x' + fit.h + '@' + MM.pixelRatio();
    if (!borelData.img || borelData.imgKey !== sizeKey) { borelData.img = paintBorel(V); borelData.imgKey = sizeKey; }
    ctx.putImageData(borelData.img, 0, 0);
    drawAxes(ctx, { W: V.W, H: V.H, X: V.X, Y: V.Y }, ['$\\mathrm{Re}\\,\\zeta$', '$\\mathrm{Im}\\,\\zeta$'], false);
    // its rim, as the other discs have, over the edge of the pixels
    ctx.strokeStyle = MM.color('rule'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(V.cx, V.cy, borelData.R * V.k, 0, TAU); ctx.stroke();
    // the singularities on this sheet: the critical values J_i runs into
    const sing = new Set();
    for (const r of model.rays[i] || []) for (const j of r.js) sing.add(j);
    // the cuts: from each singularity straight out, red as the Stokes rays in the picture of I(ħ)
    // (the Laplace integral jumps where the ray of ħ crosses one)
    ctx.strokeStyle = MM.rgba('highlight', 0.9);
    ctx.lineWidth = 1.4;
    for (const j of sing) {
      const A = St.sub(act.values[j], act.values[i]), u = St.scl(A, 1 / St.abs(A));
      // (out to the rim of the disc drawn, |ζ| = R)
      if (St.abs(A) >= borelData.R) continue;
      ctx.beginPath(); ctx.moveTo(V.X(A[0]), V.Y(A[1])); ctx.lineTo(V.X(u[0] * borelData.R), V.Y(u[1] * borelData.R)); ctx.stroke();
    }
    // the ray of ħ to the rim, the point ħ on it (on the rim when |ħ| is beyond), and beyond the
    // rim a knob that turns ħ and keeps |ħ|, as in the picture of I(ħ)
    const e = [Math.cos(state.phi), Math.sin(state.phi)], len = borelData.R * V.k, kn = len + 12;
    ctx.strokeStyle = MM.color('ink');
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(V.cx, V.cy); ctx.lineTo(V.cx + e[0] * len, V.cy - e[1] * len); ctx.stroke();
    MM.phase.knob(ctx, V.cx, V.cy, len, kn, state.phi);
    placeBox(bknob, V.cx + e[0] * kn, V.cy - e[1] * kn);
    if (state.snap && state.snap.i === i) {
      const t = model.th[i];
      if (t.hit >= 0) {
        const A = St.sub(act.values[t.hit], act.values[i]);
        ctx.strokeStyle = MM.rgba('highlight', 0.5);
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(V.cx, V.cy); ctx.lineTo(V.X(A[0]), V.Y(A[1])); ctx.stroke();
      }
    }
    const rk = Math.min(cur().r, borelData.R) * V.k, hp = [V.cx + e[0] * rk, V.cy - e[1] * rk];
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
      // a point more than half under the handle of ħ (its ring, 8.3 px): its number just beside
      // the handle, on the side the point is (or away from the name ħ)
      const d = Math.hypot(p.x - hp[0], p.y - hp[1]), RH = 8.3, rp = 7;
      if (lens(d, RH, rp) > 0.5 * Math.PI * rp * rp) {
        const u = d > 0.5 ? [(p.x - hp[0]) / d, (p.y - hp[1]) / d] : [e[1], e[0]];
        const q = [hp[0] + u[0] * (RH + 9), hp[1] + u[1] * (RH + 9)];
        ctx.fillStyle = MM.rgba('surface', 0.85);
        ctx.beginPath(); ctx.arc(q[0], q[1], 8, 0, TAU); ctx.fill();
        ctx.fillStyle = MM.color('th-' + (j + 1) + '-text');
        ctx.font = MM.font('sans', 12, 700);
        ctx.fillText(String(j + 1), q[0], q[1] + 0.5);
      }
    }
    const kr = Math.max(14, Math.min(20, 0.045 * Math.min(V.W, V.H)));
    MM.phase.key(ctx, V.W - kr - 16, V.H - kr - 16, kr);
    borelH.style.transform = 'translate(' + hp[0].toFixed(1) + 'px,' + hp[1].toFixed(1) + 'px)';
    borelH.setAttribute('aria-valuetext', 'arg ħ = ' + degOf(state.phi) + '°, |ħ| = ' + rTex(cur().r));
    const names = [...sing].sort((a, b) => a - b).map((j) => '$A_{' + (i + 1) + (j + 1) + '}$');
    MM.setHTML($('borel-cap'), 'The Borel transform $\\beta_{' + (i + 1) + '}$ of the series of $J_{' + (i + 1) + '}$, as in <a href="#eq-3">$(3)$</a>, coloured by its phase as in the key and darker where it is large. In <a href="#eq-4">$(4)$</a> it is integrated along the black ray, the ray of $\\hbar$. Its singularities, ' + listTex(names) + ', are marked; the red lines are its cuts.');
  }
  // ħ is a point of the Borel plane (both measure differences of values of S): a press puts it
  // there, a drag moves it, held on the directions of the singularities
  let borelDrag = false;
  // outside the disc only the angle (the knob); inside, the point ħ
  const borelAt = (e) => { const rc = borelCv.getBoundingClientRect(), V = borelView(); return { V, x: (e.clientX - rc.left - V.cx) / V.k, y: (V.cy - (e.clientY - rc.top)) / V.k }; };
  function borelPhi(e) {
    // (less how far from ħ its handle was taken)
    const at = borelAt(e), V = at.V, x = at.x - (borelDrag.off ? borelDrag.off[0] : 0), y = at.y - (borelDrag.off ? borelDrag.off[1] : 0);
    if (!borelDrag.arg) setR(Math.hypot(x, y));
    const i = focusI(), px = Math.max((borelDrag.arg ? Math.hypot(x, y) : cur().r) * V.k, 1);
    let to = St.liftNear(Math.atan2(y, x), state.phi), snapTo = null, best = Math.min(0.15, 6 / px);
    for (const rr of model.rays[i] || []) { const t = St.liftNear(rr.theta, to); if (Math.abs(t - to) < best) { best = Math.abs(t - to); snapTo = t; } }
    if (snapTo !== null) setPhi(snapTo, 1e-9); else setPhi(to, 0);
    draw();
  }
  // (on a touch screen only from the handle of ħ or the knob, elsewhere the finger scrolls)
  const bknob = touchBox(borelBox);
  borelBox.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    const onH = borelH.contains(e.target), fromHandle = onH || e.target === bknob;
    if (e.pointerType === 'touch' && !fromHandle) return;
    e.preventDefault();
    stopTurn();
    const { V, x, y } = borelAt(e), rk = Math.min(cur().r, borelData.R);
    borelDrag = { arg: e.target === bknob || (!onH && Math.hypot(x, y) > borelData.R * 1.02), off: onH ? [x - Math.cos(state.phi) * rk, y - Math.sin(state.phi) * rk] : null };
    borelBox.setPointerCapture(e.pointerId);
    borelH.focus({ preventScroll: true });
    borelPhi(e);
  });
  borelBox.addEventListener('pointermove', (e) => {
    if (borelDrag) { borelPhi(e); return; }
    if (e.pointerType === 'touch') return;
    // a hand over the knob
    const { V, x, y } = borelAt(e), kn = borelData.R + 12 / V.k;
    borelBox.classList.toggle('on-knob', Math.hypot(x - kn * Math.cos(state.phi), y - kn * Math.sin(state.phi)) * V.k < 11);
  });
  borelBox.addEventListener('pointerleave', () => borelBox.classList.remove('on-knob'));
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
    // as far as about twice the least error, so that the error is seen to turn and grow (at most
    // 150 terms, and not past a coefficient too large for a double)
    const r = cur().r, F = best.a / r;
    let K = Math.min(150, Math.max(16, Math.round(2.2 * F) + 6));
    const a = seriesOf(i, K);
    for (let k = 1; k <= K; k++) if (!(Number.isFinite(a[k][0]) && Number.isFinite(a[k][1]))) { K = k - 1; break; }
    // ħ in its direction now (just off a Stokes ray of J_i, where the thimble is not defined)
    let phi = state.phi;
    if (state.snap && state.snap.i === i) phi += 1e-4;
    const hb = St.scl(St.cis(phi), r);
    const I = St.integral(act, i, hb, St.turnDirs(model.dirs, state.phi, phi)[i]);
    const exact = St.div(I.v, St.scl(I.v0, Math.sqrt(Math.PI))), ex = St.abs(exact);
    // the error of the sum of the first k terms, relative to the integral: computed directly where
    // doubles resolve it well, and below that from the series of the points J_i runs into
    // (stokes.js, remainders; the two agree to a fraction of a percent where both are known)
    const rays = model.rays[i] || [], rem = St.remainders(rays, hb, K, PRED_L, (j) => seriesOf(j, K));
    const errs = [NaN];
    let sum = St.C(0), hk = St.C(1), big = 1;
    const direct = [NaN];
    for (let k = 1; k <= K; k++) {
      sum = St.add(sum, St.mul(a[k - 1], hk));
      hk = St.mul(hk, hb);
      big = Math.max(big, St.abs(sum) / ex);
      direct.push(St.abs(St.sub(exact, sum)) / ex);
    }
    const prec = 1e-15 * big;
    for (let k = 1; k <= K; k++) errs.push(direct[k] > 1e3 * prec ? direct[k] : St.abs(rem[k]) / ex);
    let hi = -Infinity, lo = Infinity;
    for (let k = 1; k <= K; k++) if (errs[k] > 0 && Number.isFinite(errs[k])) { hi = Math.max(hi, Math.log10(errs[k])); lo = Math.min(lo, Math.log10(errs[k])); }
    hi = Math.min(Math.max(hi, -1), 2);
    lo = Math.max(Math.min(lo, hi - 4), hi - 160);
    const span = hi - lo, step = span <= 26 ? 4 : span <= 52 ? 8 : span <= 104 ? 16 : 32;
    const top = step * Math.ceil(hi / step), bot = step * Math.floor(lo / step);
    const X = (k) => B.x0 + 8 + k / K * (B.x1 - B.x0 - 8);
    const Y = (v) => B.y0 + (top - Math.log10(v)) / (top - bot) * (B.y1 - B.y0);
    const shown = (v) => v > 0 && Math.log10(v) >= bot - 1e-9 && Math.log10(v) <= top + 1e-9;
    // a line through the points that are shown, broken where one is not
    const runs = (pts, cls, extra) => {
      let run = [];
      for (const q of pts.concat([null])) {
        if (q) { run.push(q); continue; }
        poly(truncSvg, run, cls, extra);
        run = [];
      }
    };
    el('line', { x1: B.x0, x2: B.x1, y1: B.y1, y2: B.y1, class: 'sp-axis' }, truncSvg);
    for (let d = top; d >= bot; d -= step) {
      const y = B.y0 + (top - d) / (top - bot) * (B.y1 - B.y0);
      el('line', { x1: B.x0, x2: B.x1, y1: y, y2: y, class: 'sp-grid' }, truncSvg);
      label(truncSvg, d === 0 ? '$1$' : '$10^{' + d + '}$', B.x0 - 6, y + 4, 'sp-num', 'end');
    }
    const stepK = K > 100 ? 25 : K > 40 ? 10 : 5;
    for (let k = 0; k <= K; k += stepK) label(truncSvg, '$' + k + '$', X(k), B.y1 + 17);
    label(truncSvg, '$k$', B.x1, B.y1 + 30, 'sp-num', 'end');
    // the error as a curve from k = 1, with a dot at each k when there are few
    runs(errs.map((v, k) => (k >= 1 && shown(v) ? [X(k), Y(v)] : null)), 'sp-curve', { style: 'stroke-width:2;stroke:' + thColor(i) });
    if (K <= 30) errs.forEach((v, k) => { if (k >= 1 && shown(v)) el('circle', { cx: X(k), cy: Y(v), r: 3.2, class: 'sp-term-dot', style: 'fill:' + thColor(i) }, truncSvg); });
    // N, the number of terms where the error is least (the optimal cutoff)
    let N = 1;
    for (let k = 1; k <= K; k++) if (errs[k] < errs[N]) N = k;
    if (N < K && shown(errs[N])) {
      el('circle', { cx: X(N), cy: Y(errs[N]), r: 7, class: 'sp-mark' }, truncSvg);
      label(truncSvg, '$N=' + N + '$', X(N), Y(errs[N]) - 12, 'sp-num halo');
    }
    const ij = (i + 1) + '' + (best.j + 1);
    MM.setHTML($('trunc-cap'), 'The error of the series of $J_{' + (i + 1) + '}$ summed to $k$ terms, relative to the integral over $J_{' + (i + 1) + '}$; $N$ marks where it is least. Here $|A_{' + ij + '}/\\hbar|=' + texNum(F, 1) + '$' + (N >= K ? ', and the least error comes after $k=' + K + '$.' : '.'));
    MM.setHTML($('trunc-series'), seriesTex(i, a));
  }
  // a number to three significant digits, in TeX
  function sig(x) {
    if (!x) return '0';
    const e = Math.floor(Math.log10(Math.abs(x)) + 1e-12);
    if (e >= -3 && e <= 3) return String(Number(x.toPrecision(3)));
    return String(Number((x / Math.pow(10, e)).toPrecision(3))) + '\\cdot10^{' + e + '}';
  }
  // a coefficient as a term of a sum: its sign, then its body (bracketed when complex)
  function coefTex(c) {
    const m = St.abs(c), re = Math.abs(c[0]) < 1e-9 * m ? 0 : c[0], im = Math.abs(c[1]) < 1e-9 * m ? 0 : c[1];
    if (!im) return { neg: re < 0, body: sig(Math.abs(re)) };
    if (!re) return { neg: im < 0, body: sig(Math.abs(im)) + '\\,\\mathrm{i}' };
    return { neg: false, body: '(' + sig(re) + (im < 0 ? '-' : '+') + sig(Math.abs(im)) + '\\,\\mathrm{i})' };
  }
  // the series of J_i written out, with its first coefficients: on one line, and on two with
  // fewer coefficients for a narrow screen
  function seriesTex(i, a) {
    const n = i + 1, terms = (K) => {
      let s = '1';
      for (let k = 1; k <= K; k++) {
        const c = coefTex(a[k]);
        s += (c.neg ? '-' : '+') + c.body + '\\,\\hbar' + (k > 1 ? '^{' + k + '}' : '');
      }
      return '\\bigl(' + s + '+\\cdots\\bigr)';
    };
    const lhs = '\\int_{J_{' + n + '}}\\mathrm{e}^{-S/\\hbar}\\,dx', pre = '\\mathrm{e}^{-S(p_{' + n + '})/\\hbar}\\sqrt{\\frac{2\\pi\\hbar}{S\'\'(p_{' + n + '})}}';
    return '<div class="sp-wide">$$' + lhs + '\\;\\sim\\;' + pre + '\\,' + terms(3) + '$$</div>'
      + '<div class="sp-narrow">$$\\begin{aligned}&' + lhs + '\\;\\sim\\;' + pre + '\\\\&\\qquad\\times' + terms(2) + '\\end{aligned}$$</div>';
  }


  /* ---------- Smoothing the jump ---------- */

  const smoothSvg = $('smooth-chart');
  const SM_N = 240, SM_RANGE = 60 * Math.PI / 180;   // samples, and the chart's half-range
  const F_LO = 2.5;                  // |A/ħ| from which optimal truncation means something
  let smooth = { key: '', pts: [] };
  function smoothKey() { return [critKey(cur()), focusI(), cur().r.toFixed(6), dirsSig()].join('|'); }
  function smoothValid() { const b = nearest(focusI()); if (!b) return false; return b.a / cur().r >= F_LO; }
  // The coefficient of the jumping term in the remainder of the series of J_i, truncated after
  // N ≈ |A/ħ| terms, across its nearest Stokes ray: from the series of the points it runs into
  // (stokes.js, remainders, with β_j itself on the cut: exact but for the quadrature), which gives
  // the remainder of the thimble at ħ, with the jump added past the ray, for the path J_i was
  // before it. The jumping term is κ e^{−A/ħ} times the integral over J_j over its own factor:
  // the series of J_j summed as far, plus its remainder, from the same.
  function computeSmooth() {
    const key = smoothKey();
    if (smooth.key === key) return;
    smooth = { key, pts: [] };
    if (!smoothValid()) return;
    const act = model.act, best = nearest(focusI()), ray = best.ray, r = cur().r, N = Math.max(1, Math.round(best.a / r));
    const ser = (j) => seriesOf(j, Math.min(N, 100) + 2), nP = Math.min(N, 100), cache = new Map();
    smooth.N = N;
    for (let q = 0; q < SM_N; q++) {
      const x = -SM_RANGE + 2 * SM_RANGE * (q + 0.5) / SM_N, hb = St.scl(St.cis(ray.theta + x), r);
      const R = St.remainders([ray], hb, N, PRED_L, ser, N, act, cache)[N];
      let jt = St.C(0);
      for (const j of ray.js) {
        const aj = ser(j);
        let P = St.C(0), hk = St.C(1);
        for (let k = 0; k < nP && Number.isFinite(aj[k][0]); k++) { P = St.add(P, St.mul(aj[k], hk)); hk = St.mul(hk, hb); }
        const Rj = (model.rays[j] || []).length ? St.remainders(model.rays[j], hb, nP, PRED_L, ser, nP, act, cache)[nP] : St.C(0);
        jt = St.add(jt, St.mul(ray.kappa[j], St.mul(St.cexp(St.scl(St.div(ray.A[j], hb), -1)), St.add(P, Rj))));
      }
      // (past the ray, as remainders decides it: arg(A/ħ) < 0)
      const m = St.sub(C0, St.div(R, jt)), past = St.arg(St.div(ray.A[best.j], hb)) < 0;
      smooth.pts.push({ x, m: past ? St.add(m, St.C(1)) : m });
    }
  }
  const C0 = [0, 0];
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
    const j = best.j, ij = (i + 1) + '' + (j + 1);
    label(smoothSvg, '$\\arg\\hbar-\\arg A_{' + ij + '}$', B.x1, B.y1 + 30, 'sp-num', 'end');
    // the thimbles: the term jumps in at once (dotted); the coefficient in the remainder of the
    // series (coloured, the real part), and over it Berry's error function (dashed), as thick
    const erfAt = (x) => { const Ah = St.div(A, St.scl(St.cis(St.arg(A) + x), r)); return 0.5 * (1 + St.erf(-Ah[1] / Math.sqrt(2 * Math.max(Ah[0], 1e-12)))); };
    poly(smoothSvg, [[B.x0, Y(0)], [X(0), Y(0)], [X(0), Y(1)], [B.x1, Y(1)]], 'sp-step');
    computeSmooth();
    const pts = smooth.pts.filter((p) => Number.isFinite(p.m[0]));
    if (pts.length > 1) poly(smoothSvg, pts.map((p) => [X(p.x), Y(Math.max(-0.15, Math.min(1.15, p.m[0])))]), 'sp-erf', { style: 'stroke:' + thColor(i) });
    const curve = [];
    for (let q = 0; q <= 240; q++) { const x = -SM_RANGE + 2 * SM_RANGE * q / 240; curve.push([X(x), Y(erfAt(x))]); }
    poly(smoothSvg, curve, 'sp-erf sp-dash');
    // the number of terms the series is truncated after, in the corner
    if (ok) label(smoothSvg, '$N=' + smooth.N + '$', B.x0 + 10, B.y0 + 10, 'sp-num sp-nlab', 'start');
    const line = (style) => '<svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="' + style + '"><path d="M1 5H21"/></svg>';
    MM.setHTML($('smooth-legend'), (ok ? '<span class="legend-item">' + line('--c:' + thColor(i) + ';--line-width:2') + 'in the remainder $R_N$</span>' : '')
      + '<span class="legend-item">' + line('--line-width:2;stroke-dasharray:6 5') + 'error function</span>'
      + '<span class="legend-item"><svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="--c:var(--ink-2);--line-width:1.6"><path d="M2 5H21" style="stroke-dasharray:0.1 4;stroke-linecap:round"/></svg>in the expansion by thimbles</span>');
    const why = ok ? '' : ' Here $|A_{' + ij + '}/\\hbar|=' + texNum(F, 1) + '$: the smallest term is among the first, and the remainder is not small, so the series is not shown.';
    MM.setHTML($('smooth-cap'), 'The coefficient of the jumping term of <a href="#eq-5">$(5)$</a> as $\\arg\\hbar$ crosses the Stokes ray of $J_{' + (i + 1) + '}$ into $p_{' + (j + 1) + '}$: it jumps from $0$ to $1$ in the expansion by thimbles, and rises smoothly in the remainder $R_N$ of the series of $J_{' + (i + 1) + '}$ (its real part), close to the error function of <a href="#eq-7">$(7)$</a>.' + why);
  }

  /* ---------- when the figures in the text are drawn ---------- */

  /* ---------- Differential equations: Airy's function on the real line ---------- */

  // Ai from its power series, which converges everywhere (to about 10⁻⁷ for z ≥ −10, where
  // its terms reach 10⁹); and the leading terms of its expansion: w₁ for z > 0, w₁ ± i w₂ for z < 0
  const airySvg = $('airy-chart');
  function airyAi(z) {
    const c1 = 0.355028053887817239, c2 = 0.258819403792806798, z3 = z * z * z;
    let f = 1, g = z, tf = 1, tg = z;
    for (let k = 1; k < 120; k++) {
      tf *= z3 / ((3 * k - 1) * (3 * k)); tg *= z3 / ((3 * k) * (3 * k + 1));
      f += tf; g += tg;
      if (Math.abs(tf) + Math.abs(tg) < 1e-18 * (Math.abs(f) + Math.abs(g))) break;
    }
    return c1 * f - c2 * g;
  }
  function airyLead(z) {
    const x = Math.abs(z), xi = (2 / 3) * Math.pow(x, 1.5), q = Math.sqrt(Math.PI) * Math.pow(x, 0.25);
    return z > 0 ? Math.exp(-xi) / (2 * q) : Math.sin(xi + Math.PI / 4) / q;
  }
  function drawAiry() {
    if (!airySvg.clientWidth && !airySvg.parentNode.clientWidth) return;
    const B = chartBox(airySvg, 230, [14, 16, 34, 40]);
    const zl = -10, zr = 4, yl = -0.5, yh = 0.6;
    const X = (z) => B.x0 + (z - zl) / (zr - zl) * (B.x1 - B.x0), Y = (v) => B.y1 - (v - yl) / (yh - yl) * (B.y1 - B.y0);
    for (const v of [-0.4, 0, 0.4]) {
      el('line', { x1: B.x0, x2: B.x1, y1: Y(v), y2: Y(v), class: v ? 'sp-grid' : 'sp-axis' }, airySvg);
      label(airySvg, '$' + (v < 0 ? '-' : '') + Math.abs(v) + '$', B.x0 - 6, Y(v) + 4, 'sp-num', 'end');
    }
    el('line', { x1: X(0), x2: X(0), y1: B.y0, y2: B.y1, class: 'sp-grid' }, airySvg);
    for (let z = zl; z <= zr; z += 2) label(airySvg, '$' + (z < 0 ? '-' : '') + Math.abs(z) + '$', X(z), B.y1 + 17);
    label(airySvg, '$z$', B.x1, B.y1 + 30, 'sp-num', 'end');
    // Ai, and over it the leading terms (dashed), where they lie in the chart
    const ai = [];
    for (let q = 0; q <= 700; q++) { const z = zl + (zr - zl) * q / 700; ai.push([X(z), Y(airyAi(z))]); }
    poly(airySvg, ai, 'sp-erf', { style: 'stroke:' + MM.color('c1') });
    // (out to the edge of the chart near 0, with points dense there: they grow like |z|^{−1/4})
    for (const [a, b] of [[zl, -1e-4], [1e-4, zr]]) {
      let run = [], prev = null;
      for (let q = 0; q <= 1400; q++) {
        const f = q / 1400, z = a + (b - a) * (a < 0 ? 1 - (1 - f) * (1 - f) : f * f), v = airyLead(z), inside = v <= yh && v >= yl;
        // where the curve crosses the edge, a point on it
        if (prev && inside !== prev.inside) {
          const e = v > yh || prev.v > yh ? yh : yl, u = (e - prev.v) / (v - prev.v);
          run.push([X(prev.z + u * (z - prev.z)), Y(e)]);
          if (!inside) { if (run.length > 1) poly(airySvg, run, 'sp-erf sp-dash'); run = []; }
        }
        if (inside) run.push([X(z), Y(v)]);
        prev = { z, v, inside };
      }
      if (run.length > 1) poly(airySvg, run, 'sp-erf sp-dash');
    }
    const line = (style) => '<svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true" style="' + style + '"><path d="M1 5H21"/></svg>';
    MM.setHTML($('airy-legend'), '<span class="legend-item">' + line('--c:var(--c1);--line-width:2') + '$\\mathrm{Ai}(z)$</span>'
      + '<span class="legend-item">' + line('--line-width:2;stroke-dasharray:6 5') + 'leading terms of its expansion</span>');
  }

  /* ---------- The Airy equation: Ai, w₁ and w₂ in the plane of z ---------- */

  // As the picture of I(ħ) shows Γ = n₁J₁ + n₂J₂, this shows Ai ∼ c₁w₁ + c₂w₂ as z → ∞: Ai itself
  // (from its power series, good to 10⁻⁹ for |z| ≤ 5), or the leading term of w₁ or of w₂, coloured
  // by phase with lines of constant phase and modulus as there, arcs where each term is in the
  // expansion, and the Stokes rays. The w's are continued the short way round from a knob at
  // arg z = θ₀ (a real number), fading out opposite it, as I is from ħ; over Ai, which is entire,
  // only the arcs and the marks, which depend on the branches, follow the knob.
  const zpCv = $('zplane-cv'), zpick = $('zpick'), zpCap = $('zplane-cap'), ZCAP0 = zpCap.innerHTML, ZR = 5, ZS = 2 * Math.PI / 3;
  const zpOff = document.createElement('canvas'), zpoctx = zpOff.getContext('2d'), L2P = Math.log(2 * Math.sqrt(Math.PI));
  let zpView = 0, zpTheta = 0, zpDrag = false, zpFast = false, zpSharp = false;
  const zpCache = new Map();          // by resolution: { key (the size), vals, imgs }
  function zpLayout(w, h) {
    const W = w || zpCv.clientWidth, H = h || zpCv.clientHeight, M = Math.min(W, H);
    const gap = 0.016 * M, sp = 0.018 * M, D = 0.5 * M - gap - sp * 2 - 0.065 * M;
    return { W, H, D, gap, sp, k: D / ZR, cx: W / 2, cy: H / 2, rOut: D + gap + sp * 2, X: (x) => W / 2 + x * D / ZR, Y: (y) => H / 2 - y * D / ZR };
  }
  // the coefficients (c₁, c₂) at arg z = φ (lifted): (1, 0) for |φ| < 2π/3 and (1, i) for
  // 2π/3 < φ < 4π/3, and since w₁(ze^{2πi}) = −i w₂(z), w₂(ze^{2πi}) = −i w₁(z) and Ai is single
  // valued, c(φ + 2π) = i (c₂, c₁)(φ)
  function zpCoef(phi) {
    const m = Math.floor((phi + ZS) / TAU), psi = phi - TAU * m;
    let c = psi < ZS ? [[1, 0], [0, 0]] : [[1, 0], [0, 1]];
    const times = (u, v) => [u[0] * v[0] - u[1] * v[1], u[0] * v[1] + u[1] * v[0]];
    for (let q = 0; q < Math.abs(m); q++) c = m > 0 ? [times([0, 1], c[1]), times([0, 1], c[0])] : [times([0, -1], c[1]), times([0, -1], c[0])];
    return c;
  }
  const zpNonzero = (u) => Math.abs(u[0]) + Math.abs(u[1]) > 1e-9;
  // the values at each pixel that do not depend on the branch: the angle, the logs of r and r^{3/2},
  // and Ai (zpAi, the first time its view is painted at this size)
  function zpValues(V, w, h, dpr) {
    const n = w * h, out = { w, h, ai: false, in: new Uint8Array(n), x: new Float32Array(n), y: new Float32Array(n), th: new Float32Array(n), r: new Float32Array(n), lr: new Float32Array(n), r15: new Float32Array(n), aph: new Float32Array(n), alm: new Float32Array(n), wph: new Float32Array(n), wlm: new Float32Array(n) };
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const q = py * w + px, x = ((px + 0.5) / dpr - V.cx) / V.k, y = -((py + 0.5) / dpr - V.cy) / V.k, r = Math.hypot(x, y);
      if (r > ZR || r < 1e-9) continue;
      out.in[q] = 1;
      out.th[q] = Math.atan2(y, x); out.r[q] = r; out.lr[q] = Math.log(r); out.r15[q] = Math.pow(r, 1.5);
      out.x[q] = x; out.y[q] = y;
    }
    return out;
  }
  function zpAi(out) {
    if (out.ai) return;
    out.ai = true;
    const c1 = 0.355028053887817239, c2 = 0.258819403792806798;
    for (let q = 0; q < out.w * out.h; q++) {
      if (!out.in[q]) continue;
      const x = out.x[q], y = out.y[q];
      // Ai: Σ z^{3k}/… in two series
      const zr2 = x * x - y * y, zi2 = 2 * x * y, z3r = zr2 * x - zi2 * y, z3i = zr2 * y + zi2 * x;
      let fr = 1, fi = 0, gr = x, gi = y, tfr = 1, tfi = 0, tgr = x, tgi = y;
      for (let kk = 1; kk < 90; kk++) {
        const a = 1 / ((3 * kk - 1) * (3 * kk)), b = 1 / ((3 * kk) * (3 * kk + 1));
        let t = (tfr * z3r - tfi * z3i) * a; tfi = (tfr * z3i + tfi * z3r) * a; tfr = t;
        t = (tgr * z3r - tgi * z3i) * b; tgi = (tgr * z3i + tgi * z3r) * b; tgr = t;
        fr += tfr; fi += tfi; gr += tgr; gi += tgi;
        if (kk > 4 && Math.abs(tfr) + Math.abs(tfi) + Math.abs(tgr) + Math.abs(tgi) < 1e-17 * (Math.abs(fr) + Math.abs(fi) + Math.abs(gr) + Math.abs(gi))) break;
      }
      const ar = c1 * fr - c2 * gr, ai = c1 * fi - c2 * gi;
      out.aph[q] = Math.atan2(ai, ar); out.alm[q] = Math.log(Math.hypot(ar, ai));
    }
    return out;
  }
  // log w₁, log w₂ = ∓ξ − ¼ log z − log 2√π, ξ = ⅔ z^{3/2}, at r, arg z = φ
  const zpW = (i, D, q, phi) => {
    const m = (2 / 3) * D.r15[q], xr = m * Math.cos(1.5 * phi), xi = m * Math.sin(1.5 * phi), sg = i === 1 ? -1 : 1;
    return [sg * xi - phi / 4, sg * xr - D.lr[q] / 4 - L2P];
  };
  // the colours of one view, with the lines of constant phase and modulus as in the picture of I(ħ)
  function zpPaint(D, view, dpr) {
    const { w, h } = D, n = w * h, kind = new Uint8Array(n);
    if (!view) zpAi(D);
    let PH = D.aph, LM = D.alm, shade = null;
    if (view) {
      // the branch continued from θ₀ the short way round, pale where w_i is not in the expansion
      PH = D.wph; LM = D.wlm;
      for (let q = 0; q < n; q++) {
        if (!D.in[q]) continue;
        const phi = D.th[q] + TAU * Math.round((zpTheta - D.th[q]) / TAU), v = zpW(view, D, q, phi);
        PH[q] = v[0]; LM[q] = v[1];
        kind[q] = zpNonzero(zpCoef(phi)[view - 1]) ? 1 : 2;
      }
    } else {
      // darker near the zeros of Ai: |Ai| against the larger term of its expansion (which does not
      // jump), away from 0, where the terms are no guide
      shade = new Float32Array(n);
      for (let q = 0; q < n; q++) {
        if (!D.in[q]) continue;
        kind[q] = 1;
        const th = D.th[q], big = Math.abs(th) > ZS ? Math.max(zpW(1, D, q, th)[1], zpW(2, D, q, th)[1]) : zpW(1, D, q, th)[1];
        const t = Math.max(0, Math.min(1, (D.r[q] - 0.8) / 0.8));
        shade[q] = 1 - t * (0.6 - 0.6 * Math.pow(Math.min(1, Math.exp(LM[q] - big) / 0.8), 0.5));
      }
    }
    // (lines every 30°: the phase turns faster here than in the picture of I(ħ))
    return MM.phase.paint(new ImageData(w, h), { w, h, dpr, ph: PH, lm: LM, kind, shade, step: Math.PI / 6, none: rgbOf('surface') });
  }
  function drawZPlane() {
    if (!zpCv.clientWidth) return;
    const { ctx } = MM.fitCanvas(zpCv), V = zpLayout();
    // at most twice the CSS resolution, and the CSS resolution while the knob is dragged over w₁ or
    // w₂; a picture not yet painted sharp is shown coarse first, and sharpened at the next frame
    const ik = zpView ? zpView + ':' + zpTheta.toFixed(5) : '0';
    const cacheAt = (dpr) => {
      const w = Math.round(V.W * dpr), h = Math.round(V.H * dpr), key = w + 'x' + h;
      let c = zpCache.get(dpr);
      if (!c || c.key !== key) { c = { key, w, h, vals: zpValues(V, w, h, dpr), imgs: {} }; zpCache.set(dpr, c); }
      return c;
    };
    let dpr = zpFast ? Math.min(1, fullRes()) : fullRes(), c = cacheAt(dpr);
    if (!c.imgs[ik] && dpr > 1 && !zpSharp) {
      dpr = 1; c = cacheAt(1);
      zpSharp = true;
      soon(() => { zpSharp = false; drawZPlane(); });
    }
    if (!c.imgs[ik]) { if (zpView) for (const k2 of Object.keys(c.imgs)) if (k2 !== '0') delete c.imgs[k2]; c.imgs[ik] = zpPaint(c.vals, zpView, dpr); }
    if (zpOff.width !== c.w || zpOff.height !== c.h) { zpOff.width = c.w; zpOff.height = c.h; }
    zpoctx.putImageData(c.imgs[ik], 0, 0);
    MM.clearCanvas(ctx, MM.color('surface'));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(zpOff, 0, 0, V.W, V.H);
    // towards the ray opposite the knob, where the two ways round meet, the arcs fade out, and over
    // w₁ or w₂ the picture too (Ai, which is entire, does not)
    const th0 = zpTheta, fade = MM.phase.cut(ctx, V.cx, V.cy, th0 + Math.PI, Math.PI / 6), seen = fade.seen;
    if (zpView) fade.veil(V.D + 1);
    drawAxes(ctx, { W: V.W, H: V.H, X: V.X, Y: V.Y }, ['$\\mathrm{Re}\\,z$', '$\\mathrm{Im}\\,z$'], false);
    ctx.strokeStyle = MM.color('rule'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(V.cx, V.cy, V.D, 0, TAU); ctx.stroke();
    // the Stokes rays (arg z = 2πk/3) in the turn shown where a coefficient changes: red marks on the
    // rim over Ai, red rays over w_i where its own coefficient changes
    const bounds = [th0 - Math.PI];
    for (let k = Math.ceil((th0 - Math.PI) / (TAU / 3)); k * TAU / 3 < th0 + Math.PI; k++) if (k * TAU / 3 > th0 - Math.PI) bounds.push(k * TAU / 3);
    bounds.push(th0 + Math.PI);
    const same = (u, v) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]) < 1e-9;
    // (over Ai a coefficient jumps across arg z = ±2π/3 on every sheet and nowhere else, so its marks
    // stay there, unfaded, as the knob turns)
    if (!zpView) for (const t of [ZS, -ZS]) MM.phase.mark(ctx, V.cx, V.cy, V.D, t);
    else for (let q = 1; q + 1 < bounds.length; q++) {
      const t = bounds[q], a = seen(t);
      if (same(zpCoef(t - 1e-6)[zpView - 1], zpCoef(t + 1e-6)[zpView - 1]) || a < 0.02) continue;
      ctx.strokeStyle = MM.rgba('highlight', 0.9 * a); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(V.cx, V.cy); ctx.lineTo(V.cx + V.D * Math.cos(t), V.cy - V.D * Math.sin(t)); ctx.stroke();
    }
    // the arcs: where each term is in the expansion, between the Stokes rays
    fade.faded((c) => {
      c.lineCap = 'butt';
      c.lineWidth = 0.62 * V.sp;
      for (let i = 0; i < 2; i++) {
        c.strokeStyle = MM.rgba('th-' + (i + 1), !zpView || zpView === i + 1 ? 1 : 0.3);
        for (let q = 0; q + 1 < bounds.length; q++) {
          const a = bounds[q], b = bounds[q + 1];
          if (!zpNonzero(zpCoef((a + b) / 2)[i])) continue;
          c.beginPath(); c.arc(V.cx, V.cy, V.D + V.gap + V.sp * (i + 0.5), -b, -a); c.stroke();
        }
      }
    }, V.D + 1, V.rOut + 2);
    // the knob of arg z the branches are continued from, out across the arcs, and the box over it
    MM.phase.knob(ctx, V.cx, V.cy, V.D, V.rOut + 8, zpTheta);
    zknob.style.transform = 'translate(' + (V.cx + (V.rOut + 8) * Math.cos(zpTheta)).toFixed(1) + 'px,' + (V.cy - (V.rOut + 8) * Math.sin(zpTheta)).toFixed(1) + 'px)';
    zknob.setAttribute('aria-valuetext', 'arg z = ' + Math.round(zpTheta * 180 / Math.PI) + '°');
    const kr = Math.max(13, Math.min(18, 0.045 * Math.min(V.W, V.H)));
    MM.phase.key(ctx, V.W - kr - 16, V.H - kr - 16, kr);
    zpick.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.v === zpView)));
    zpCv.setAttribute('aria-label', (zpView
      ? 'The leading term of w' + zpView + ' in a disc of the plane of z, coloured by its phase'
      : 'Airy’s function in a disc of the plane of z, coloured by its phase, with the Stokes rays, and arcs showing which of w1 and w2 are in its expansion') + ', continued from arg z = ' + Math.round(zpTheta * 180 / Math.PI) + '°');
    if (zpCap.dataset.v !== String(zpView)) {
      zpCap.dataset.v = String(zpView);
      if (!zpView) zpCap.innerHTML = ZCAP0;
      else MM.setHTML(zpCap, 'The leading term of $w_' + zpView + '(z)$, coloured by its phase, with lines of constant phase and modulus, continued the short way round from the knob of $\\arg z$; opposite the knob the picture fades out.');
    }
  }
  zpCap.dataset.v = '0';
  zpick.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; zpView = +b.dataset.v; drawZPlane(); });
  // the knob: a drag outside the disc turns it, and so does one that starts on the knob itself (a
  // box over it, which on a touch screen takes the finger from the page), as do the arrow keys on
  // the knob; the picture is painted coarse while a drag over w₁ or w₂ lasts
  const zknob = $('zknob');
  const zpAt = (e) => { const r = zpCv.getBoundingClientRect(), V = zpLayout(); return { V, x: e.clientX - r.left - V.cx, y: V.cy - (e.clientY - r.top) }; };
  function zpStart(e, el) {
    const { x, y } = zpAt(e);
    e.preventDefault();
    zpDrag = true;
    zpFast = zpView > 0;
    el.setPointerCapture(e.pointerId);
    zknob.focus({ preventScroll: true });
    zpTheta = St.liftNear(Math.atan2(y, x), zpTheta);
    drawZPlane();
  }
  function zpMove(e) {
    if (!zpDrag) return false;
    const { x, y } = zpAt(e);
    zpTheta = St.liftNear(Math.atan2(y, x), zpTheta);
    drawZPlane();
    return true;
  }
  function zpEnd() {
    if (!zpDrag) return;
    zpDrag = false;
    if (zpFast) { zpFast = false; drawZPlane(); }
  }
  zpCv.addEventListener('pointerdown', (e) => {
    if (e.button || e.pointerType === 'touch') return;
    const { V, x, y } = zpAt(e);
    if (Math.hypot(x, y) < V.D + 3) return;
    zpStart(e, zpCv);
  });
  zknob.addEventListener('pointerdown', (e) => { if (!e.button) zpStart(e, zknob); });
  zknob.addEventListener('pointermove', zpMove);
  zpCv.addEventListener('pointermove', (e) => {
    if (zpMove(e) || e.pointerType === 'touch') return;
    // (over the ring round the disc, outside the knob's box, a hand too)
    const { V, x, y } = zpAt(e);
    zpCv.classList.toggle('on-knob', Math.hypot(x, y) > V.D + 3);
  });
  for (const el of [zpCv, zknob]) ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, zpEnd));
  zpCv.addEventListener('pointerleave', () => zpCv.classList.remove('on-knob'));
  zknob.addEventListener('keydown', (e) => {
    const turn = { ArrowLeft: 1, ArrowUp: 1, ArrowRight: -1, ArrowDown: -1 }[e.key];
    if (!turn || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    zpTheta += turn * (e.shiftKey ? 1 : 5) * Math.PI / 180;
    drawZPlane();
  });

  // each is drawn while it is in view (or Save image is open), after the picture at the top
  const textFigs = [
    { el: $('stokes-fig'), draw: drawStokes },
    { el: $('zplane-fig'), draw: drawZPlane },
    { el: $('airy-fig'), draw: drawAiry },
    { el: $('borel-fig'), draw: drawBorel },
    { el: $('trunc-fig'), draw: drawTrunc },
    { el: $('smooth-fig'), draw: () => drawSmooth() },
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
  [stokesSvg, borelCv, truncSvg, smoothSvg, zpCv, airySvg, ...planeCopies, ...hCopies].forEach((x) => sized.observe(x));
  let textReq = 0;
  function textDirty() { textFigs.forEach((f) => { f.dirty = true; }); textLater(); }
  function textLater() { if (!textReq) textReq = soon(drawText); }
  function drawText() {
    textReq = 0;
    if (!model) return;
    syncPickers();
    syncSliders();
    const all = document.documentElement.classList.contains('is-dialog-open');
    let copies = false;
    for (const f of textFigs) if (f.dirty && (all || visible.has(f))) { f.dirty = false; f.draw(); copies = true; }
    if (copies) drawCopies();
  }
  document.addEventListener('mm:dialog', () => textDirty());

  /* ---------- start ---------- */

  MM.handle(hbarEl);
  MM.handle(borelH);
  zoomEl.value = state.zoom;
  hzoomEl.value = state.hz;
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
    // the critical point the figures in the text are about (f), and the integral the picture of ħ
    // shows (v: 0 over Γ, i over J_i) and its zoom (y)
    fields: { d: 'int', p: 'numbers', g: 'numbers', h: 'number', r: 'number', t: 'flag', z: 'number', w: 'number', f: 'int', v: 'int', y: 'number' },
    view: ['z', 'v', 'y'],
    get: () => {
      const c = cur(), pre = PRESETS[state.deg], p = flat(c.crit), m = state.deg;
      const g = [St.mod(c.gamma[0], m), St.mod(c.gamma[1], m)], r = Math.round(c.r * 1e4) / 1e4;
      return {
        d: state.deg,
        p: sameArr(p, flat(pre.crit)) ? HOME.p : p,
        g: sameArr(g, pre.gamma) ? HOME.g : g,
        h: Math.round(state.phi * 1e4) / 1e4,
        r: Math.abs(r - pre.r) < 1e-9 ? HOME.r : r,
        t: state.turn, z: Math.round(state.zoom * 1e3) / 1e3, w: Math.round(state.flow * 1e3) / 1e3, f: focusI(), v: hvNow(), y: Math.round(state.hz * 1e3) / 1e3,
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
      if (!(Number.isInteger(x.f) && x.f >= 0 && x.f < d - 1) || !(x.w >= 0 && x.w <= 1) || !(Number.isInteger(x.v) && x.v >= 0 && x.v < d) || !(x.y >= 1 && x.y <= HZ_MAX)) return false;
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
      Object.assign(state, { zoom: x.z, focus: x.f, flow: x.w, hv: x.v, hz: x.y });
      $('degree').value = String(d);
      zoomEl.value = state.zoom;
      hzoomEl.value = state.hz;
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
      { label: 'Plane of z', element: zpCv, selected: false },
      { label: 'Airy’s function', element: airySvg, selected: false },
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
