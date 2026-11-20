// The figures in the text: the level set near a critical point in 3D as z comes to z_i (the
// cycle vanishing), the Dynkin diagram of the basis in the main picture, and the eigenvalues of its classical monodromy. They read the main
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
       n = 2: the curve x² + y² = ε, drawn over the plane of x with height Re(e^{−iθ} y) (flattened):
              a double cover of the disc, two sheets joined along the waist, which is the circle;
              at ε = 0 it is the two planes y = ±ix, crossing at the node;
       n = 3: the sphere in the real space of (e^{−iθ}x, e^{−iθ}y_2, e^{−iθ}y_3).
     ===================================================================== */
  const v3 = { cv: $('v3-cv'), dial: $('v3-dial'), eps: [0, -0.62], yaw: -0.15, pitch: 0.72, theta: -Math.PI / 4, drag: null, spin: true, last: 0 };
  const R3 = 1;   // the disc |x| ≤ 1 of the plane of x
  function cam(W, H) { return { k: Math.min(W, H) * 0.34, cx: W / 2, cy: H * 0.56 }; }
  function proj(p, c) {
    const cy = Math.cos(v3.yaw), sy = Math.sin(v3.yaw), x1 = p[0] * cy - p[1] * sy, y1 = p[0] * sy + p[1] * cy;
    const cp = Math.cos(v3.pitch), sp = Math.sin(v3.pitch);
    return [c.cx + x1 * c.k, c.cy - (p[2] * cp + y1 * sp) * c.k, y1 * cp - p[2] * sp];
  }
  function shade(rgb, f) { return 'rgb(' + rgb.map((x) => Math.round(clamp(x * f, 0, 255))).join(',') + ')'; }
  const rgbOf = (name) => MM.color(name).match(/[\d.]+/g).slice(0, 3).map(Number);
  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  // For n = 2 the heights are flattened, so that the curve lies over the disc as a double cover:
  // two sheets, one white and one light blue, joined along the waist.
  const FLAT = 0.22;
  // The curve (n = 2) as a grid of points and its faces, each with its sheet's colour, lit from
  // above by the slope of the face, and the grid lines along its edges (lines of constant σ and
  // τ: confocal hyperbolas and ellipses over the disc); kept until ε changes, so that turning the
  // picture only projects the points again.
  let geo = null;
  function geometry(s, th) {
    const key = s + ':' + th;
    if (geo && geo.key === key) return geo;
    const ct = Math.cos(th), st = Math.sin(th), pts = [], faces = [];
    const sheets = [rgbOf('surface'), mix(rgbOf('surface'), rgbOf('cy-1'), 0.16)];
    const height = (x, y) => [x[0], x[1], FLAT * (ct * y[0] + st * y[1])];   // over x, at Re(e^{−iθ} y)
    const face = (v, sheet, lines) => {
      const [A, B, C, D] = v.map((i) => pts[i]);
      const d1 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]], d2 = [D[0] - B[0], D[1] - B[1], D[2] - B[2]];
      const nz = d1[0] * d2[1] - d1[1] * d2[0], nl = Math.hypot(d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], nz) || 1;
      faces.push({ v, fill: shade(sheets[sheet], 0.9 + 0.1 * Math.abs(nz / nl)), lines });
    };
    if (s > 1e-9) {
      // x = √ε cos w, y = √ε sin w (w = σ + iτ), out to |x| = 1; τ > 0 and τ < 0 are the two
      // sheets, and τ = 0 is the waist; they cross where σ = 0 or π (lines of the grid, so that no
      // face crosses another)
      const T = Math.acosh(Math.max(1.0001, R3 / s)), NS = 36, NT = 20, se = [s * ct, s * st];
      const at = (sg, ta) => {
        const cw = [Math.cos(sg) * Math.cosh(ta), -Math.sin(sg) * Math.sinh(ta)], sw = [Math.sin(sg) * Math.cosh(ta), Math.cos(sg) * Math.sinh(ta)];
        return [[se[0] * cw[0] - se[1] * cw[1], se[0] * cw[1] + se[1] * cw[0]], [se[0] * sw[0] - se[1] * sw[1], se[0] * sw[1] + se[1] * sw[0]]];
      };
      for (let a = 0; a < NS; a++) for (let b = 0; b <= NT; b++) pts.push(height(...at(a / NS * TAU, -T + 2 * T * b / NT)));
      const id = (a, b) => (a % NS) * (NT + 1) + b, onS = (a) => a % 3 === 0, onT = (b) => b % 5 === 0 && b !== NT / 2;
      for (let a = 0; a < NS; a++) for (let b = 0; b < NT; b++) {
        // the edges on grid lines: [from, to] as corners 0–3 of the face
        const lines = [];
        if (onT(b)) lines.push([0, 1]);
        if (onT(b + 1)) lines.push([3, 2]);
        if (onS(a)) lines.push([0, 3]);
        if (onS(a + 1)) lines.push([1, 2]);
        face([id(a, b), id(a + 1, b), id(a + 1, b + 1), id(a, b + 1)], b < NT / 2 ? 1 : 0, lines);
      }
    } else {
      // the node: the two planes y = ±ix, the sheets of τ → ±∞, which cross along the line of
      // e^{iθ} (a line of the grid, so that no face crosses another)
      const NR = 6, NA = 36;
      for (const sg of [1, -1]) {
        const o = pts.length, id = (a, b) => o + (a % NA) * (NR + 1) + b;
        for (let a = 0; a < NA; a++) for (let b = 0; b <= NR; b++) {
          const rr = R3 * b / NR, x = [rr * Math.cos(th + a / NA * TAU), rr * Math.sin(th + a / NA * TAU)];
          pts.push(height(x, [-sg * x[1], sg * x[0]]));
        }
        for (let a = 0; a < NA; a++) for (let b = 0; b < NR; b++) {
          const lines = [];
          if (b % 2 === 1) lines.push([0, 1]);
          if ((b + 1) % 2 === 1 || b + 1 === NR) lines.push([3, 2]);
          if (a % 3 === 0) lines.push([0, 3]);
          if ((a + 1) % 3 === 0) lines.push([1, 2]);
          face([id(a, b), id(a + 1, b), id(a + 1, b + 1), id(a, b + 1)], sg > 0 ? 0 : 1, lines);
        }
      }
    }
    geo = { key, pts, faces, T: s > 1e-9 ? Math.acosh(Math.max(1.0001, R3 / s)) : 0, NT: 20 };
    return geo;
  }
  function draw3() {
    if (!v3.cv) return;
    const { ctx, w: W, h: H } = MM.fitCanvas(v3.cv), c = cam(W, H), n = nNow();
    const [er, ei] = v3.eps, r = Math.hypot(er, ei);
    if (r > 1e-9) v3.theta = Math.atan2(ei, er) / 2;
    const th = v3.theta, ct = Math.cos(th), st = Math.sin(th), s = Math.sqrt(r);
    // the disc of the plane of x
    const ring = [];
    for (let q = 0; q <= 96; q++) ring.push(proj([R3 * Math.cos(q / 96 * TAU), R3 * Math.sin(q / 96 * TAU), 0], c));
    ctx.fillStyle = MM.rgba('sunken', 0.75);
    ctx.beginPath(); ring.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.fill();
    ctx.strokeStyle = MM.color('rule'); ctx.lineWidth = 1; ctx.stroke();
    // the axes, under the surface; their names, over it (drawn last)
    const names = [];
    const ax = (a, b, name, side) => {
      const A = proj(a, c), B = proj(b, c);
      ctx.strokeStyle = MM.rgba('ink', 0.3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      // (side: the name beside the end, to its right, rather than beyond it)
      names.push(() => MM.canvasLabel(ctx, name, side ? B[0] + 6 : B[0] + (B[0] - A[0]) * 0.06, side ? B[1] : B[1] + (B[1] - A[1]) * 0.06, { size: 13, align: side ? 'left' : 'center', baseline: 'middle', color: MM.color('ink-3') }));
    };
    if (n === 3) {
      ax([-1.15, 0, 0], [1.15, 0, 0], '$\\mathrm{Re}\\,x$');
      ax([0, -1.05, 0], [0, 1.05, 0], '$\\mathrm{Re}\\,y_2$', true);
      ax([0, 0, -1.05], [0, 0, 1.25], '$\\mathrm{Re}\\,y_3$');
    } else {
      ax([-1.15, 0, 0], [1.15, 0, 0], '$\\mathrm{Re}\\,x$');
      ax([0, -1.15, 0], [0, 1.15, 0], '$\\mathrm{Im}\\,x$');
      if (n === 2) ax([0, 0, -0.45], [0, 0, 0.5], '$\\mathrm{Re}(\\mathrm{e}^{-\\mathrm{i}\\theta}y)$', true);
    }
    const col = MM.color('cy-1-line'), colText = MM.color('cy-1-text');
    const bp = [[s * ct, s * st, 0], [-s * ct, -s * st, 0]];
    const singular = () => { const O = proj([0, 0, 0], c); ctx.fillStyle = MM.color('red'); ctx.beginPath(); ctx.arc(O[0], O[1], 5, 0, TAU); ctx.fill(); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (n === 1) {
      // the two points, + and −, and the segment they move along
      const A = proj(bp[0], c), B = proj(bp[1], c);
      ctx.setLineDash([2, 4]); ctx.strokeStyle = col; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.setLineDash([]);
      [[A, true], [B, false]].forEach(([p, plus]) => {
        ctx.fillStyle = plus ? MM.color('cy-1') : MM.color('surface'); ctx.strokeStyle = colText; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, TAU); ctx.fill(); ctx.stroke();
      });
      if (r < 1e-9) singular();
    } else if (n === 3) {
      // the sphere of radius |√ε|: its disc on the screen, then the near halves of its circles of
      // latitude and longitude (the far halves are hidden), and its outline
      const O = proj([0, 0, 0], c), R = s * c.k;
      if (r > 1e-9) {
        ctx.fillStyle = MM.rgba('cy-1-soft', 0.55);
        ctx.beginPath(); ctx.arc(O[0], O[1], R, 0, TAU); ctx.fill();
        const circle = (f, wid) => {
          ctx.lineWidth = wid; ctx.beginPath();
          for (let q = 0; q < 72; q++) {
            const PA = proj(f(q / 72 * TAU), c), PB = proj(f((q + 1) / 72 * TAU), c);
            if (PA[2] + PB[2] < 0) { ctx.moveTo(PA[0], PA[1]); ctx.lineTo(PB[0], PB[1]); }
          }
          ctx.stroke();
        };
        ctx.strokeStyle = col;
        for (const la of [-60, -30, 0, 30, 60]) { const L = la * Math.PI / 180, cl = Math.cos(L), sl = Math.sin(L); circle((t) => [s * cl * Math.cos(t), s * cl * Math.sin(t), s * sl], la ? 1 : 1.6); }
        for (let m = 0; m < 6; m++) { const lo = m * Math.PI / 6, cl = Math.cos(lo), sl = Math.sin(lo); circle((t) => [s * Math.cos(t) * cl, s * Math.cos(t) * sl, s * Math.sin(t)], 1); }
        ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(O[0], O[1], R, 0, TAU); ctx.stroke();
      } else singular();
    } else {
      // n = 2: the faces from the back to the front, each with its grid lines, and the vanishing
      // cycle, the waist, among them, nearer than the surface it lies on by about the size of the
      // faces next to it (which would otherwise hide it)
      const g = geometry(s, th), N = g.pts.length, SX = new Float64Array(N), SY = new Float64Array(N), SD = new Float64Array(N);
      g.pts.forEach((p, i) => { const q = proj(p, c); SX[i] = q[0]; SY[i] = q[1]; SD[i] = q[2]; });
      const items = g.faces.map((f) => ({ d: (SD[f.v[0]] + SD[f.v[1]] + SD[f.v[2]] + SD[f.v[3]]) / 4, f }));
      if (r > 1e-9) {
        const bias = Math.max(0.06 * Math.max(s, 0.2), 1.2 * s * Math.sinh(2 * g.T / g.NT));
        for (let q = 0; q < 96; q++) {
          const a = q / 96 * TAU, b = (q + 1) / 96 * TAU;
          const PA = proj([s * Math.cos(a) * ct, s * Math.cos(a) * st, FLAT * s * Math.sin(a)], c), PB = proj([s * Math.cos(b) * ct, s * Math.cos(b) * st, FLAT * s * Math.sin(b)], c);
          items.push({ d: (PA[2] + PB[2]) / 2 - bias, seg: [PA, PB] });
        }
      }
      items.sort((u, w) => w.d - u.d);
      const grid = MM.rgba('ink', 0.32);
      items.forEach((it) => {
        if (it.f) {
          // a face, a little larger than it is, so that no seams show between faces
          const v = it.f.v, mx = (SX[v[0]] + SX[v[1]] + SX[v[2]] + SX[v[3]]) / 4, my = (SY[v[0]] + SY[v[1]] + SY[v[2]] + SY[v[3]]) / 4;
          ctx.fillStyle = it.f.fill; ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            const dx = SX[v[k]] - mx, dy = SY[v[k]] - my, l = Math.hypot(dx, dy) || 1, x = SX[v[k]] + dx / l * 0.45, y = SY[v[k]] + dy / l * 0.45;
            if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.fill();
          if (it.f.lines.length) {
            ctx.strokeStyle = grid; ctx.lineWidth = 0.9; ctx.beginPath();
            it.f.lines.forEach(([i, j]) => { ctx.moveTo(SX[v[i]], SY[v[i]]); ctx.lineTo(SX[v[j]], SY[v[j]]); });
            ctx.stroke();
          }
        } else {
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
          ctx.moveTo(it.seg[0][0], it.seg[0][1]); ctx.lineTo(it.seg[1][0], it.seg[1][1]); ctx.stroke();
        }
      });
      // the vanishing circle again, thin and dashed, so that its hidden half shows (where it is seen,
      // the solid line is under it)
      if (r > 1e-9) {
        ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3.5]); ctx.beginPath();
        for (let q = 0; q <= 96; q++) {
          const a = q / 96 * TAU, P = proj([s * Math.cos(a) * ct, s * Math.cos(a) * st, FLAT * s * Math.sin(a)], c);
          if (q) ctx.lineTo(P[0], P[1]); else ctx.moveTo(P[0], P[1]);
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      // the branch points, or the singular point
      if (r > 1e-9) bp.forEach((q) => { const P = proj(q, c); ctx.fillStyle = MM.color('ink'); ctx.beginPath(); ctx.arc(P[0], P[1], 3.6, 0, TAU); ctx.fill(); });
      else singular();
    }
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
      keys: { turn(a, b) { v3.yaw += a; v3.pitch = clamp(v3.pitch + b, -0.2, 1.45); redraw3(); }, home() { v3.yaw = -0.15; v3.pitch = 0.72; redraw3(); } },
    });
    v3.spin = !MM.reduceMotion();
    seen3 = MM.whenVisible([v3.cv], (on) => { if (on) redraw3(); });
    redraw3();
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
    draw3(); drawDial(); drawDynkin(); drawEigen();
  }
  window.PLFigures = {
    // (after each drawing of the main picture: the figures that show its basis)
    update() { drawDynkin(); drawEigen(); },
    redraw: update,
    pictures: () => [
      { label: 'Near a critical point', element: $('v3-box'), selected: false },
      { label: 'Dynkin diagram', element: $('dyn'), selected: false },
      { label: 'Eigenvalues', element: $('eig'), selected: false },
    ].filter((p) => p.element),
  };
  window.addEventListener('pl:n', () => { redraw3(); drawDynkin(); drawEigen(); });
  const ro = new ResizeObserver(() => update());
  [v3.cv, v3.dial, $('dyn') && $('dyn').parentNode].forEach((e) => { if (e) ro.observe(e); });
  MM.onFonts(update);
})();
