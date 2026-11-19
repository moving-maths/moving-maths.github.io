// The figures in the text: the level set near a critical point in 3D as z comes to z_i (the
// cycle vanishing), the half-twist of the roots as z goes once round z_i, the Dynkin diagram of the
// basis in the main picture, and the eigenvalues of its classical monodromy. They read the main
// picture's state from window.PLMain.
(function () {
  'use strict';
  const TAU = 2 * Math.PI, PL = window.Lefschetz;
  const $ = (id) => document.getElementById(id);
  const main = () => window.PLMain;
  const nNow = () => (main() ? main().state.n : 3);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const capture = (elm, e) => { try { elm.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } };
  const localXY = (e, elm) => { const r = elm.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const csqrt = (x, y) => PL.csqrt(x, y);

  /* =====================================================================
     The level set near a critical point, in 3D.
     Near c_i, f = z_i + x² + y_2² + ⋯ + y_n² in suitable coordinates, so V_z there is the quadric
     x² + y_2² + ⋯ = ε, ε = z − z_i. With θ = arg √ε and every coordinate turned by e^{−iθ}, its
     real points are the sphere of radius |√ε| (two points, a circle, a sphere), the vanishing cycle.
       n = 1: the two points ±√ε in the plane of x;
       n = 2: the curve x² + y² = ε, drawn over the plane of x with height Re(e^{−iθ} y): a neck whose
              waist is the circle; at ε = 0 it is the two planes y = ±ix, crossing at the node;
       n = 3: the sphere in the real space of (e^{−iθ}x, e^{−iθ}y_2, e^{−iθ}y_3).
     ===================================================================== */
  const v3 = { cv: $('v3-cv'), dial: $('v3-dial'), eps: [0, -0.62], yaw: -0.15, pitch: 0.5, theta: -Math.PI / 4, drag: null, spin: true, last: 0 };
  const R3 = 1;   // the disc |x| ≤ 1 of the plane of x
  function cam(W, H) { return { k: Math.min(W, H) * 0.34, cx: W / 2, cy: H * 0.56 }; }
  function proj(p, c) {
    const cy = Math.cos(v3.yaw), sy = Math.sin(v3.yaw), x1 = p[0] * cy - p[1] * sy, y1 = p[0] * sy + p[1] * cy;
    const cp = Math.cos(v3.pitch), sp = Math.sin(v3.pitch);
    return [c.cx + x1 * c.k, c.cy - (p[2] * cp + y1 * sp) * c.k, y1 * cp - p[2] * sp];
  }
  function shade(rgb, f) { return 'rgb(' + rgb.map((x) => Math.round(clamp(x * f, 0, 255))).join(',') + ')'; }
  // The surface (n = 2, 3) as a grid of points and its faces, each with its colour (for n = 2 the
  // phase of y; light from above, by the slope of the face), kept until n or ε changes: turning
  // the picture only projects the points again.
  let geo = null;
  function geometry(n, s, th) {
    const key = n + ':' + s + ':' + th;
    if (geo && geo.key === key) return geo;
    const ct = Math.cos(th), st = Math.sin(th), pts = [], faces = [];
    const face = (v, rgb) => {
      const [A, B, C, D] = v.map((i) => pts[i]);
      const d1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], d2 = [D[0] - B[0], D[1] - B[1], D[2] - B[2]];
      const nz = d1[0] * d2[1] - d1[1] * d2[0], nl = Math.hypot(d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], nz) || 1;
      faces.push({ v, fill: shade(rgb, 0.78 + 0.22 * Math.abs(nz / nl)) });
    };
    if (n === 2) {
      const height = (x, y) => [x[0], x[1], ct * y[0] + st * y[1]];   // over x, at Re(e^{−iθ} y)
      if (s > 1e-9) {
        // the curve: x = √ε cos w, y = √ε sin w (w = σ + iτ), out to |x| = 1
        const T = Math.acosh(Math.max(1.0001, R3 / s)), NS = 48, NT = 22, se = [s * ct, s * st];
        const at = (sg, ta) => {
          const cw = [Math.cos(sg) * Math.cosh(ta), -Math.sin(sg) * Math.sinh(ta)], sw = [Math.sin(sg) * Math.cosh(ta), Math.cos(sg) * Math.sinh(ta)];
          return [[se[0] * cw[0] - se[1] * cw[1], se[0] * cw[1] + se[1] * cw[0]], [se[0] * sw[0] - se[1] * sw[1], se[0] * sw[1] + se[1] * sw[0]]];
        };
        for (let a = 0; a < NS; a++) for (let b = 0; b <= NT; b++) pts.push(height(...at(a / NS * TAU, -T + 2 * T * b / NT)));
        const id = (a, b) => (a % NS) * (NT + 1) + b;
        for (let a = 0; a < NS; a++) for (let b = 0; b < NT; b++) {
          const y = at((a + 0.5) / NS * TAU, -T + 2 * T * (b + 0.5) / NT)[1];
          face([id(a, b), id(a + 1, b), id(a + 1, b + 1), id(a, b + 1)], MM.phase.color(Math.atan2(y[1], y[0])));
        }
      } else {
        // the node: the two planes y = ±ix
        const NR = 8, NA = 48;
        for (const sg of [1, -1]) {
          const o = pts.length, id = (a, b) => o + (a % NA) * (NR + 1) + b;
          for (let a = 0; a < NA; a++) for (let b = 0; b <= NR; b++) {
            const rr = R3 * b / NR, x = [rr * Math.cos(a / NA * TAU), rr * Math.sin(a / NA * TAU)];
            pts.push(height(x, [-sg * x[1], sg * x[0]]));
          }
          for (let a = 0; a < NA; a++) for (let b = 0; b < NR; b++) {
            const am = (a + 0.5) / NA * TAU;
            face([id(a, b), id(a + 1, b), id(a + 1, b + 1), id(a, b + 1)], MM.phase.color(Math.atan2(sg * Math.cos(am), -sg * Math.sin(am))));
          }
        }
      }
    } else {
      // n = 3: the sphere of radius |√ε|, lit from above (a shade for each band of latitude, so that
      // it is drawn in few pieces)
      const NU = 40, NV = 20, rgb = MM.color('cy-1-soft').match(/[\d.]+/g).slice(0, 3).map(Number), id = (a, b) => (a % NU) * (NV + 1) + b;
      for (let a = 0; a < NU; a++) for (let b = 0; b <= NV; b++) {
        const lo = a / NU * TAU, la = -Math.PI / 2 + b / NV * Math.PI;
        pts.push([s * Math.cos(la) * Math.cos(lo), s * Math.cos(la) * Math.sin(lo), s * Math.sin(la)]);
      }
      for (let a = 0; a < NU; a++) for (let b = 0; b < NV; b++) {
        const la = -Math.PI / 2 + (b + 0.5) / NV * Math.PI;
        faces.push({ v: [id(a, b), id(a + 1, b), id(a + 1, b + 1), id(a, b + 1)], fill: shade(rgb, 0.8 + 0.25 * Math.max(0, Math.sin(la))) });
      }
    }
    geo = { key, pts, faces, T: n === 2 && s > 1e-9 ? Math.acosh(Math.max(1.0001, R3 / s)) : 0, NT: 22 };
    return geo;
  }
  function draw3() {
    if (!v3.cv) return;
    const { ctx, w: W, h: H } = MM.fitCanvas(v3.cv), c = cam(W, H), n = nNow();
    const [er, ei] = v3.eps, r = Math.hypot(er, ei);
    if (r > 1e-9) v3.theta = Math.atan2(ei, er) / 2;
    const th = v3.theta, ct = Math.cos(th), st = Math.sin(th), s = Math.sqrt(r);
    // the disc of the plane of x, and on it the arc between the branch points ±√ε
    const ring = [];
    for (let q = 0; q <= 96; q++) ring.push(proj([R3 * Math.cos(q / 96 * TAU), R3 * Math.sin(q / 96 * TAU), 0], c));
    ctx.fillStyle = MM.rgba('sunken', 0.75);
    ctx.beginPath(); ring.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.fill();
    ctx.strokeStyle = MM.color('rule'); ctx.lineWidth = 1; ctx.stroke();
    // the axes, under the surface; their names, over it (drawn last)
    const names = [];
    const ax = (a, b, name) => {
      const A = proj(a, c), B = proj(b, c);
      ctx.strokeStyle = MM.rgba('ink', 0.3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      names.push(() => MM.canvasLabel(ctx, name, B[0] + (B[0] - A[0]) * 0.06, B[1] + (B[1] - A[1]) * 0.06, { size: 13, align: 'center', baseline: 'middle', color: MM.color('ink-3') }));
    };
    if (n === 3) {
      ax([-1.15, 0, 0], [1.15, 0, 0], '$\\mathrm{Re}\\,x$');
      ax([0, -1.15, 0], [0, 1.15, 0], '$\\mathrm{Re}\\,y_2$');
      ax([0, 0, -0.85], [0, 0, 0.9], '$\\mathrm{Re}\\,y_3$');
    } else {
      ax([-1.15, 0, 0], [1.15, 0, 0], '$\\mathrm{Re}\\,x$');
      ax([0, -1.15, 0], [0, 1.15, 0], '$\\mathrm{Im}\\,x$');
      if (n === 2) ax([0, 0, -0.85], [0, 0, 0.9], '$\\mathrm{Re}(\\mathrm{e}^{-\\mathrm{i}\\theta}y)$');
    }
    const col = MM.color('cy-1-line'), colText = MM.color('cy-1-text');
    const bp = [[s * ct, s * st, 0], [-s * ct, -s * st, 0]];
    if (n === 1) {
      // the two points, + and −, and the segment they move along
      const A = proj(bp[0], c), B = proj(bp[1], c);
      ctx.setLineDash([2, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.setLineDash([]);
      [[A, true], [B, false]].forEach(([p, plus]) => {
        ctx.fillStyle = plus ? MM.color('cy-1') : MM.color('surface'); ctx.strokeStyle = colText; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, TAU); ctx.fill(); ctx.stroke();
      });
      if (r < 1e-9) { const O = proj([0, 0, 0], c); ctx.fillStyle = MM.color('red'); ctx.beginPath(); ctx.arc(O[0], O[1], 5, 0, TAU); ctx.fill(); }
      names.forEach((f) => f());
      return;
    }
    // the surface, projected
    const g = geometry(n, s, th), N = g.pts.length, SX = new Float64Array(N), SY = new Float64Array(N), SD = new Float64Array(N);
    g.pts.forEach((p, i) => { const q = proj(p, c); SX[i] = q[0]; SY[i] = q[1]; SD[i] = q[2]; });
    const depth = (f) => SD[f.v[0]] + SD[f.v[1]] + SD[f.v[2]] + SD[f.v[3]];
    // a face, a little larger than it is (grow, in pixels), so that no seams show between faces
    const face = (f, grow) => {
      const v = f.v, mx = (SX[v[0]] + SX[v[1]] + SX[v[2]] + SX[v[3]]) / 4, my = (SY[v[0]] + SY[v[1]] + SY[v[2]] + SY[v[3]]) / 4;
      for (let k = 0; k < 4; k++) {
        let x = SX[v[k]], y = SY[v[k]];
        if (grow) { const dx = x - mx, dy = y - my, l = Math.hypot(dx, dy) || 1; x += dx / l * grow; y += dy / l * grow; }
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    ctx.lineCap = 'round';
    if (n === 2) {
      // the faces from the back to the front, and the vanishing cycle, the waist (the real circle
      // τ = 0), among them, nearer than the surface it lies on by about the size of the faces next
      // to it (which would otherwise hide it)
      const items = g.faces.map((f) => ({ d: depth(f) / 4, f }));
      if (r > 1e-9) {
        const bias = Math.max(0.06 * Math.max(s, 0.2), 1.2 * s * Math.sinh(2 * g.T / g.NT));
        for (let q = 0; q < 96; q++) {
          const a = q / 96 * TAU, b = (q + 1) / 96 * TAU;
          const PA = proj([s * Math.cos(a) * ct, s * Math.cos(a) * st, s * Math.sin(a)], c), PB = proj([s * Math.cos(b) * ct, s * Math.cos(b) * st, s * Math.sin(b)], c);
          items.push({ d: (PA[2] + PB[2]) / 2 - bias, seg: [PA, PB] });
        }
      }
      items.sort((u, w) => w.d - u.d);
      ctx.strokeStyle = col; ctx.lineWidth = 3.2;
      items.forEach((it) => {
        ctx.beginPath();
        if (it.f) { ctx.fillStyle = it.f.fill; face(it.f, 0.45); ctx.fill(); }
        else { ctx.moveTo(it.seg[0][0], it.seg[0][1]); ctx.lineTo(it.seg[1][0], it.seg[1][1]); ctx.stroke(); }
      });
    } else {
      // n = 3: the near half of the sphere (it is convex: no face hides another), a path for each
      // shade; then the near halves of its equator and a meridian
      const byFill = new Map();
      g.faces.forEach((f) => { if (depth(f) < 0) { if (!byFill.has(f.fill)) byFill.set(f.fill, []); byFill.get(f.fill).push(f); } });
      ctx.lineWidth = 0.7;
      byFill.forEach((list, fill) => { ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.beginPath(); list.forEach((f) => face(f, 0)); ctx.fill(); ctx.stroke(); });
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath();
      for (const kind of [0, 1]) for (let q = 0; q < 72; q++) {
        const at = (t) => (kind ? [s * Math.cos(t), 0, s * Math.sin(t)] : [s * Math.cos(t), s * Math.sin(t), 0]);
        const PA = proj(at(q / 72 * TAU), c), PB = proj(at((q + 1) / 72 * TAU), c);
        if (PA[2] + PB[2] < 0) { ctx.moveTo(PA[0], PA[1]); ctx.lineTo(PB[0], PB[1]); }
      }
      ctx.stroke();
    }
    // the branch points (n = 2), or the singular point
    if (r > 1e-9 && n === 2) bp.forEach((q) => { const P = proj(q, c); ctx.fillStyle = MM.color('ink'); ctx.beginPath(); ctx.arc(P[0], P[1], 3.6, 0, TAU); ctx.fill(); });
    if (r <= 1e-9) { const O = proj([0, 0, 0], c); ctx.fillStyle = MM.color('red'); ctx.beginPath(); ctx.arc(O[0], O[1], 5, 0, TAU); ctx.fill(); }
    names.forEach((f) => f());
  }
  // At most one drawing a frame; while the picture turns by itself, about 30 a second, and none
  // while it is out of view.
  let req3 = 0, want3 = false, seen3 = () => true;
  function redraw3() { want3 = true; if (!req3) req3 = requestAnimationFrame(tick3); }
  function tick3(t) {
    req3 = 0;
    if (!seen3()) { v3.last = 0; return; }
    if (v3.spin) {
      if (!v3.last) v3.last = t;
      else if (t - v3.last >= 30) { v3.yaw += Math.min(100, t - v3.last) * 0.00025; v3.last = t; want3 = true; }
      req3 = requestAnimationFrame(tick3);
    } else v3.last = 0;
    if (want3) { want3 = false; draw3(); }
  }
  // the dial: z near z_i, ε = z − z_i in the unit disc; held at the centre
  function drawDial() {
    const cv = v3.dial;
    if (!cv) return;
    const { ctx, w: W, h: H } = MM.fitCanvas(cv), R = Math.min(W, H) / 2 - 12, cx = W / 2, cy = H / 2;
    ctx.strokeStyle = MM.color('rule'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = MM.rgba('ink', 0.25);
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    const zx = cx + v3.eps[0] * R, zy = cy - v3.eps[1] * R;
    ctx.strokeStyle = MM.color('cy-1-line'); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(zx, zy); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.fillStyle = MM.color('cy-1');
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
    MM.canvasLabel(ctx, '$z_i$', cx + 8, cy - 8, { size: 14, align: 'left', baseline: 'bottom', color: MM.color('cy-1-text') });
    const hEl = $('v3-z');
    if (hEl) hEl.style.transform = 'translate(' + zx.toFixed(1) + 'px,' + zy.toFixed(1) + 'px)';
    MM.canvasLabel(ctx, '$z$', zx + 12, zy + 12, { size: 14, align: 'left', baseline: 'top', color: MM.color('ink') });
    const r = Math.hypot(v3.eps[0], v3.eps[1]);
    MM.setHTML($('v3-val'), r < 1e-9 ? '$z=z_i$' : '$|z-z_i|=' + r.toFixed(2) + '$');
  }
  function epsFromDial(e) {
    const cv = v3.dial, [px, py] = localXY(e, cv), W = cv.clientWidth, H = cv.clientHeight, R = Math.min(W, H) / 2 - 12;
    let x = (px - W / 2) / R, y = -(py - H / 2) / R;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (Math.hypot(x, y) * R < 9) { x = 0; y = 0; }
    v3.eps = [x, y];
    drawDial(); redraw3();
  }
  if (v3.dial) {
    MM.handle($('v3-z'));
    const down = (e) => { if (e.button || (e.pointerType === 'touch' && !$('v3-z').contains(e.target))) return; e.preventDefault(); capture(e.currentTarget, e); v3.drag = true; epsFromDial(e); };
    [v3.dial, $('v3-z')].forEach((elm) => {
      elm.addEventListener('pointerdown', down);
      elm.addEventListener('pointermove', (e) => { if (v3.drag) epsFromDial(e); });
      elm.addEventListener('pointerup', () => { v3.drag = false; });
      elm.addEventListener('pointercancel', () => { v3.drag = false; });
    });
    $('v3-z').addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (!k) return;
      e.preventDefault();
      let x = v3.eps[0] + k[0] * 0.05, y = v3.eps[1] + k[1] * 0.05;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      if (Math.hypot(x, y) < 0.03) { x = 0; y = 0; }
      v3.eps = [x, y]; drawDial(); redraw3();
    });
  }
  // turning: by itself, slowly, and by a drag
  if (v3.cv) {
    MM.turnDrag(v3.cv, {
      start() { v3.spin = false; },
      move(dx, dy) { v3.yaw += dx * 0.01; v3.pitch = clamp(v3.pitch + dy * 0.01, -0.2, 1.45); redraw3(); },
      end() { v3.spin = !MM.reduceMotion(); redraw3(); },
      keys: { turn(a, b) { v3.yaw += a; v3.pitch = clamp(v3.pitch + b, -0.2, 1.45); redraw3(); }, home() { v3.yaw = -0.15; v3.pitch = 0.5; redraw3(); } },
    });
    v3.spin = !MM.reduceMotion();
    seen3 = MM.whenVisible([v3.cv], (on) => { if (on) redraw3(); });
    redraw3();
  }


  /* =====================================================================
     The half-twist. Near c_i the roots of p(x) = z are c_i ± √((z − z_i)/a_i); as z goes round z_i
     by an angle φ they turn by φ/2 round c_i, and the arcs that end at them are dragged along.
     The model: p(x) = x² (c_i = 0, z_i = 0), the roots ±√ε of x² = ε with |ε| fixed, and two roots A
     and B further out that hardly move; the picture of x is carried by the map that turns the disc
     |x| ≤ r1 by φ/2, the ring r1 ≤ |x| ≤ r2 less and less, and leaves the rest, which takes the
     roots where they go. The arc a from A, and the arc b from B, are the images of segments.
     ===================================================================== */
  const tw = { cv: $('tw-cv'), dial: $('tw-dial'), phi: 0, drag: null, last: null };
  const TW = { e0: 0.36, r1: 0.78, r2: 1.65, A: [-1.8, 0.45], B: [1.8, -0.45], R: 2.05 };
  function twist(p, phi) {
    const r = Math.hypot(p[0], p[1]), f = r <= TW.r1 ? 1 : r >= TW.r2 ? 0 : (TW.r2 - r) / (TW.r2 - TW.r1);
    const a = f * phi / 2, c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
  }
  const segment = (a, b, m) => Array.from({ length: m + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m]);
  function drawTwist() {
    if (!tw.cv) return;
    const { ctx, w: W, h: H } = MM.fitCanvas(tw.cv), k = Math.min(W, H) / (2 * TW.R), X = (x) => W / 2 + x * k, Y = (y) => H / 2 - y * k;
    const phi = tw.phi, s = Math.sqrt(TW.e0), rp = [s * Math.cos(phi / 2), s * Math.sin(phi / 2)], rm = [-rp[0], -rp[1]];
    // the phase of x² − ε, with ε = e0 e^{iφ}: its zeros are the two roots
    const sc = 0.5, w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc)), ph = new Float32Array(w * h), lm = new Float32Array(w * h), kind = new Uint8Array(w * h).fill(1);
    const er = TW.e0 * Math.cos(phi), ei = TW.e0 * Math.sin(phi);
    for (let py = 0, q = 0; py < h; py++) for (let px = 0; px < w; px++, q++) {
      const x = (px / sc - W / 2) / k, y = -(py / sc - H / 2) / k;
      // (x − A)(x − B)(x² − ε), so that A and B are roots too
      let ar = x * x - y * y - er, ai = 2 * x * y - ei;
      for (const Q of [TW.A, TW.B]) { const ur = x - Q[0], ui = y - Q[1], t = ar * ur - ai * ui; ai = ar * ui + ai * ur; ar = t; }
      ph[q] = Math.atan2(ai, ar); lm[q] = 0.5 * Math.log(ar * ar + ai * ai + 1e-300);
    }
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    off.getContext('2d').putImageData(MM.phase.paint(new ImageData(w, h), { w, h, dpr: sc, ph, lm, kind, step: Math.PI / 6, lines: false }), 0, 0);
    ctx.globalAlpha = 0.55; ctx.drawImage(off, 0, 0, W, H); ctx.globalAlpha = 1;
    const line = (pts, col, width, dash) => {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); ctx.setLineDash([]);
    };
    // before: the arcs as they were, dashed
    const a0 = segment(TW.A, [-s, 0], 160), b0 = segment(TW.B, [s, 0], 160);
    if (Math.abs(phi) > 1e-3) { line(a0, MM.color('ink-3'), 1.4, [5, 4]); line(b0, MM.color('ink-3'), 1.4, [5, 4]); line([[-s, 0], [s, 0]], MM.color('ink-3'), 1.4, [5, 4]); }
    // now: Δ_i between the two roots, a and b carried along
    line(a0.map((p) => twist(p, phi)), MM.color('cy-2-line'), 2.6);
    line(b0.map((p) => twist(p, phi)), MM.color('cy-3-line'), 2.6);
    line([rm, rp], MM.color('cy-1-line'), 2.6);
    ctx.fillStyle = MM.color('ink');
    [rp, rm, TW.A, TW.B].forEach((p) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 4, 0, TAU); ctx.fill(); });
    const lab = (t, p, col, dx, dy) => MM.canvasLabel(ctx, t, X(p[0]) + dx, Y(p[1]) + dy, { size: 15, align: 'center', baseline: 'middle', color: col });
    lab('$a$', twist(a0[40], phi), MM.color('cy-2-text'), 0, -13);
    lab('$b$', twist(b0[40], phi), MM.color('cy-3-text'), 0, -13);
    lab('$\\Delta_i$', [0, 0], MM.color('cy-1-text'), 0, 16);
    const turns = phi / TAU, n = nNow(), kk = Math.round(turns);
    let txt;
    if (Math.abs(turns - kk) > 0.02) txt = '$\\arg(z-z_i)$ has turned by $' + Math.round(phi * 180 / Math.PI) + '^\\circ$.';
    else if (kk === 0) txt = '$z$ has not gone round $z_i$.';
    else if (n % 2) txt = kk % 2 ? '$a\\mapsto a-\\Delta_i$, $b\\mapsto b+\\Delta_i$, $\\Delta_i\\mapsto-\\Delta_i$: the reflection $h_i$' + (Math.abs(kk) > 1 ? ', ' + Math.abs(kk) + ' times' : '') + '.' : '$a$, $b$ and $\\Delta_i$ are back as they were, as $h_i^2=1$, though the arcs are not.';
    else txt = '$a\\mapsto a' + (kk > 0 ? '-' : '+') + (Math.abs(kk) === 1 ? '' : Math.abs(kk)) + '\\Delta_i$, $b\\mapsto b' + (kk > 0 ? '+' : '-') + (Math.abs(kk) === 1 ? '' : Math.abs(kk)) + '\\Delta_i$, $\\Delta_i\\mapsto\\Delta_i$: $h_i^{' + kk + '}$, a power of a Dehn twist.';
    MM.setHTML($('tw-val'), txt);
  }
  function drawTwDial() {
    const cv = tw.dial;
    if (!cv) return;
    const { ctx, w: W, h: H } = MM.fitCanvas(cv), R = Math.min(W, H) / 2 - 16, cx = W / 2, cy = H / 2;
    ctx.strokeStyle = MM.color('rule'); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    // the angle travelled, as an arc
    ctx.strokeStyle = MM.color('ink-2'); ctx.lineWidth = 2.5;
    if (Math.abs(tw.phi) > 1e-3) {
      ctx.beginPath();
      const turns = Math.min(3, Math.abs(tw.phi) / TAU);
      for (let q = 0; q <= 200; q++) { const t = q / 200 * tw.phi, rr = R - 7 * (Math.abs(t) / TAU) * (turns > 1 ? 1 : 0); const x = cx + rr * Math.cos(t), y = cy - rr * Math.sin(t); if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = MM.color('cy-1');
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
    MM.canvasLabel(ctx, '$z_i$', cx + 8, cy - 8, { size: 14, align: 'left', baseline: 'bottom', color: MM.color('cy-1-text') });
    const zx = cx + R * Math.cos(tw.phi), zy = cy - R * Math.sin(tw.phi);
    const hEl = $('tw-z');
    if (hEl) hEl.style.transform = 'translate(' + zx.toFixed(1) + 'px,' + zy.toFixed(1) + 'px)';
    MM.canvasLabel(ctx, '$z$', zx + 12, zy - 12, { size: 14, align: 'left', baseline: 'bottom', color: MM.color('ink') });
  }
  function twFromDial(e) {
    const cv = tw.dial, [px, py] = localXY(e, cv), a = Math.atan2(-(py - cv.clientHeight / 2), px - cv.clientWidth / 2);
    // unwrapped, so that z can go round more than once; held at whole turns
    let phi = a + TAU * Math.round((tw.phi - a) / TAU);
    phi = clamp(phi, -2 * TAU, 2 * TAU);
    const kk = Math.round(phi / TAU);
    if (Math.abs(phi - kk * TAU) < 0.12) phi = kk * TAU;
    tw.phi = phi;
    drawTwDial(); drawTwist();
  }
  if (tw.dial) {
    MM.handle($('tw-z'));
    const down = (e) => { if (e.button || (e.pointerType === 'touch' && !$('tw-z').contains(e.target))) return; e.preventDefault(); capture(e.currentTarget, e); tw.drag = true; twFromDial(e); };
    [tw.dial, $('tw-z')].forEach((elm) => {
      elm.addEventListener('pointerdown', down);
      elm.addEventListener('pointermove', (e) => { if (tw.drag) twFromDial(e); });
      elm.addEventListener('pointerup', () => { tw.drag = false; });
      elm.addEventListener('pointercancel', () => { tw.drag = false; });
    });
    $('tw-z').addEventListener('keydown', (e) => {
      const d = { ArrowLeft: 1, ArrowUp: 1, ArrowRight: -1, ArrowDown: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      tw.phi = clamp(tw.phi + d * (e.shiftKey ? 1 : 15) * Math.PI / 180, -2 * TAU, 2 * TAU);
      drawTwDial(); drawTwist();
    });
  }

  /* =====================================================================
     The Dynkin diagram of the basis in the main picture: a node for each Δ_i, where its critical
     value is, and an edge for each ⟨Δ_i, Δ_j⟩ ≠ 0: for odd n solid where it is positive and dashed
     where negative (the convention of [AGZV] for n = 3), for n = 2 an arrow from i to j where
     ⟨Δ_i, Δ_j⟩ = 1; numbers above 1 are written by the edge.
     ===================================================================== */
  function currentForm() {
    const m = main().model, n = nNow(), B = m.B[n], S0 = m.ref.S[n];
    return PL.matmul(PL.transpose(B), PL.matmul(S0, B));
  }
  function drawDynkin() {
    const svg = $('dyn');
    if (!svg || !main() || !main().model) return;
    const m = main().model, vals = m.P.vals, S = currentForm(), n = nNow(), W = Math.max(240, Math.round(svg.parentNode.clientWidth || 360)), H = 200;
    // (redrawn only when what it shows has changed)
    const key = JSON.stringify([W, n, S, vals]);
    if (svg.dataset.key === key) return;
    svg.dataset.key = key;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.style.width = W + 'px'; svg.style.height = H + 'px';
    svg.textContent = '';
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    vals.forEach((v) => { x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); });
    const k = Math.min((W - 80) / Math.max(1e-9, x1 - x0), (H - 70) / Math.max(1e-9, y1 - y0), 260);
    const P = vals.map((v) => [W / 2 + (v[0] - (x0 + x1) / 2) * k, H / 2 - (v[1] - (y0 + y1) / 2) * k]);
    const el = MM.svg;
    for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) {
      const t = S[i][j];
      if (!t) continue;
      const g = el('g', {}, svg), [a, b] = t > 0 || n % 2 ? [P[i], P[j]] : [P[j], P[i]];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
      el('line', { x1: a[0] + ux * 13, y1: a[1] + uy * 13, x2: b[0] - ux * 13, y2: b[1] - uy * 13, stroke: 'var(--ink)', 'stroke-width': 1.8, 'stroke-dasharray': n % 2 && t * (n === 1 ? -1 : 1) < 0 ? '5 4' : 'none' }, g);
      if (n % 2 === 0) { const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; el('path', { d: 'M' + (mx - ux * 6 - uy * 5) + ' ' + (my - uy * 6 + ux * 5) + 'L' + (mx + ux * 4) + ' ' + (my + uy * 4) + 'L' + (mx - ux * 6 + uy * 5) + ' ' + (my - uy * 6 - ux * 5), fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.8 }, g); }
      if (Math.abs(t) > 1) { const lbl = el('text', { x: (a[0] + b[0]) / 2 - uy * 12, y: (a[1] + b[1]) / 2 + ux * 12 + 4, 'text-anchor': 'middle', 'font-size': 14 }, g); MM.svgLabel(lbl, '$' + Math.abs(t) + '$'); }
    }
    P.forEach((p, i) => {
      el('circle', { cx: p[0], cy: p[1], r: 11, fill: 'var(--surface)', stroke: 'var(--cy-' + (i + 1) + '-text)', 'stroke-width': 2.4 }, svg);
      const t = el('text', { x: p[0], y: p[1] + 5, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--cy-' + (i + 1) + '-text)' }, svg);
      MM.svgLabel(t, '$' + (i + 1) + '$');
    });
  }

  /* =====================================================================
     The eigenvalues of the classical monodromy: the product of h_1, …, h_μ in the order in which the
     paths leave z counterclockwise (the loop round all the critical values), for the basis in the
     main picture, on the unit circle, with the (μ+1)-th roots of unity marked (for n = 2, their
     negatives).
     ===================================================================== */
  function charPoly(M) {
    // Faddeev–LeVerrier: the coefficients of det(λ − M), highest first
    const m = M.length, c = [1];
    let A = PL.eye(m);
    for (let k = 1; k <= m; k++) {
      const MA = PL.matmul(M, A);
      let tr = 0; for (let i = 0; i < m; i++) tr += MA[i][i];
      const ck = -tr / k; c.push(ck);
      A = MA.map((r, i) => r.map((x, j) => x + (i === j ? ck : 0)));
    }
    return c;
  }
  function polyRoots(c) {
    // Durand–Kerner for the monic polynomial with coefficients c (highest first)
    const m = c.length - 1, z = Array.from({ length: m }, (_, k) => [0.9 * Math.cos(TAU * k / m + 0.3), 0.9 * Math.sin(TAU * k / m + 0.3)]);
    const ev = (x) => { let r = [1, 0]; for (let k = 1; k <= m; k++) r = [r[0] * x[0] - r[1] * x[1] + c[k], r[0] * x[1] + r[1] * x[0]]; return r; };
    for (let it = 0; it < 500; it++) {
      let worst = 0;
      for (let i = 0; i < m; i++) {
        let d = [1, 0];
        for (let j = 0; j < m; j++) if (j !== i) { const u = [z[i][0] - z[j][0], z[i][1] - z[j][1]]; d = [d[0] * u[0] - d[1] * u[1], d[0] * u[1] + d[1] * u[0]]; }
        const f = ev(z[i]), q = PL.cdiv(f[0], f[1], d[0], d[1]);
        z[i] = [z[i][0] - q[0], z[i][1] - q[1]];
        worst = Math.max(worst, Math.hypot(q[0], q[1]));
      }
      if (worst < 1e-13) break;
    }
    return z;
  }
  function classical() {
    const m = main().model, n = nNow(), S = currentForm(), z = main().state.z;
    const order = m.P.vals.map((v, j) => [Math.atan2(v[1] - z[1], v[0] - z[0]), j]).sort((a, b) => a[0] - b[0]).map((x) => [x[1], 1]);
    return PL.monodromy(S, n, order);
  }
  function drawEigen() {
    const svg = $('eig');
    if (!svg || !main() || !main().model) return;
    const n = nNow(), mu = main().state.mu, H = classical(), key = JSON.stringify([n, H]);
    if (svg.dataset.key === key) return;
    svg.dataset.key = key;
    const ev = polyRoots(charPoly(H)), W = 220, R = 80, cx = 110, cy = 110;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + W); svg.style.width = W + 'px'; svg.style.height = W + 'px';
    svg.textContent = '';
    const el = MM.svg;
    el('circle', { cx, cy, r: R, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.5 }, svg);
    el('line', { x1: cx - R - 14, y1: cy, x2: cx + R + 14, y2: cy, stroke: 'var(--ink-3)', 'stroke-width': 1, opacity: 0.5 }, svg);
    el('line', { x1: cx, y1: cy - R - 14, x2: cx, y2: cy + R + 14, stroke: 'var(--ink-3)', 'stroke-width': 1, opacity: 0.5 }, svg);
    const N = mu + 1;
    for (let k = 0; k < N; k++) {
      const a = TAU * k / N + (n % 2 ? 0 : Math.PI);
      el('line', { x1: cx + (R - 7) * Math.cos(a), y1: cy - (R - 7) * Math.sin(a), x2: cx + (R + 7) * Math.cos(a), y2: cy - (R + 7) * Math.sin(a), stroke: 'var(--ink-3)', 'stroke-width': 1.2 }, svg);
    }
    ev.forEach((q) => el('circle', { cx: cx + R * q[0], cy: cy - R * q[1], r: 6, fill: 'var(--cy-1)', stroke: 'var(--cy-1-text)', 'stroke-width': 1.4 }, svg));
    // its order
    let P = PL.eye(mu), ord = 0;
    for (let k = 1; k <= 2 * N; k++) { P = PL.matmul(P, H); if (P.every((r, i) => r.every((x, j) => x === +(i === j)))) { ord = k; break; } }
    MM.setHTML($('eig-val'), ord ? '$h$ has order $' + ord + '$.' : '');
  }

  /* ---------- the whole ---------- */
  function update() {
    ['dyn', 'eig'].forEach((id) => { if ($(id)) delete $(id).dataset.key; });
    draw3(); drawDial(); drawTwist(); drawTwDial(); drawDynkin(); drawEigen();
  }
  window.PLFigures = {
    // (after each drawing of the main picture: the figures that show its basis)
    update() { drawDynkin(); drawEigen(); },
    redraw: update,
    pictures: () => [
      { label: 'Near a critical point', element: $('v3-box'), selected: false },
      { label: 'The half-twist', element: $('tw-box'), selected: false },
      { label: 'Dynkin diagram', element: $('dyn'), selected: false },
      { label: 'Eigenvalues', element: $('eig'), selected: false },
    ].filter((p) => p.element),
  };
  window.addEventListener('pl:n', () => { redraw3(); drawTwist(); drawDynkin(); drawEigen(); });
  const ro = new ResizeObserver(() => update());
  [v3.cv, v3.dial, tw.cv, tw.dial, $('dyn') && $('dyn').parentNode].forEach((e) => { if (e) ro.observe(e); });
  MM.onFonts(update);
})();
