/* The main picture in 3D (loaded after lefschetz.js, before main.js): the level set V_z for n = 2,
   the curve y² = z − p(x), as a double cover of the plane of x branched at the roots of p(x) = z,
   drawn as in the books: two sheets, one over the other, which pass through each other along cuts,
   a ray from each root outwards. The heights are not to scale. Off the cuts, the branch y_ref of
   √(z − p(x)) = i ∏ √(x − r_k), each factor cut along its root's ray, picks the upper sheet: the
   point y over x is at the height H g(x) if y = y_ref(x) and −H g(x) if y = −y_ref(x), with g
   rising from 0 on the cuts (and at the roots) to 1 away from them. The upper sheet is white and the
   lower light blue. The surface is a polar grid of faces over the disc |x| ≤ R; a face round a root
   is a fan from it whose rim goes twice round, as the two sheets join there; faces are cut where the
   height changes sign, so that no two cross, and drawn from the back to the front.
   window.PLSurface = { field, mesh, camera, draw }. */
(function (root) {
  'use strict';
  const PL = root.Lefschetz, TAU = 2 * Math.PI;

  // The heights over the plane, for the polynomial P, the value z and the roots rts of p(x) = z:
  // the cuts, a ray from each root away from the others; H, the height of the sheets; L, the
  // distance from the cuts over which they rise to it. at(x, y): the point's y (either root),
  // y_ref, and g; lift(q, w): the point of the sheet over q with y = w, [x, y, h, ±1].
  function field(P, z, rts, H, L) {
    const out = [0, 0, 0, 0];
    const rays = rts.map((r, k) => {
      let dx = 0, dy = 0;
      rts.forEach((q, l) => { if (l === k) return; const ex = r[0] - q[0], ey = r[1] - q[1], d2 = ex * ex + ey * ey || 1e-300; dx += ex / d2; dy += ey / d2; });
      const l = Math.hypot(dx, dy) || 1;
      return { r, ux: dx / l, uy: dy / l, a: Math.atan2(dy, dx) };
    });
    const at = (x, y) => {
      PL.evalPD(P, x, y, out);
      const w = PL.csqrt(z[0] - out[0], z[1] - out[1]);
      // y_ref = i ∏ |x − r_k|^½ e^{i(a_k + φ_k)/2}, φ_k ∈ [0, 2π) the angle from the ray
      let mod = 1, ang = Math.PI / 2, g = Infinity;
      for (const c of rays) {
        const dx = x - c.r[0], dy = y - c.r[1], d = Math.hypot(dx, dy);
        let f = Math.atan2(dy, dx) - c.a;
        f = ((f % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        mod *= Math.sqrt(d); ang += (c.a + f) / 2;
        const t = dx * c.ux + dy * c.uy;
        g = Math.min(g, t > 0 ? Math.abs(dx * c.uy - dy * c.ux) : d);
      }
      return { x, y, w, yref: [mod * Math.cos(ang), mod * Math.sin(ang)], g: Math.tanh(g / L) };
    };
    const lift = (q, w) => {
      const s = w[0] * q.yref[0] + w[1] * q.yref[1] >= 0 ? 1 : -1;
      return [q.x, q.y, s * H * q.g, s];
    };
    // the height of the upper sheet over (x, y)
    const top = (x, y) => {
      let g = Infinity;
      for (const c of rays) {
        const dx = x - c.r[0], dy = y - c.r[1], t = dx * c.ux + dy * c.uy;
        g = Math.min(g, t > 0 ? Math.abs(dx * c.uy - dy * c.ux) : Math.hypot(dx, dy));
      }
      return H * Math.tanh(g / L);
    };
    return { at, lift, rays, top };
  }

  // The surface over the disc |x − (cx, cy)| ≤ R, for the polynomial P and the value z.
  //   F  the field; NR, NA  rings and spokes of the grid; RG, AG  every RG-th ring and AG-th spoke
  //   a grid line; rts  the roots of p(x) = z
  // Returns { faces: [{ p: [x, y, h, …], c (1 on the upper sheet, −1 on the lower), nz (the slope),
  // lines: [[[x, y, h], …], …] }] }. The grid lines follow the surface between the faces' corners,
  // so that they are smooth, and the same whatever the number of faces.
  function mesh(P, z, o) {
    const { cx, cy, R, NR, NA, RG, AG, F } = o;
    const at = (rho, phi) => F.at(cx + rho * Math.cos(phi), cy + rho * Math.sin(phi));
    const lift = (q, w, s) => F.lift(q, s > 0 ? w : [-w[0], -w[1]]);
    const align = (w, ref) => (w[0] * ref[0] + w[1] * ref[1] < 0 ? [-w[0], -w[1]] : w);
    // the grid's points
    const G = [];
    for (let b = 0; b <= NR; b++) { const row = []; for (let a = 0; a < NA; a++) row.push(at(R * b / NR, TAU * a / NA)); G.push(row); }
    // the roots, in polar coordinates
    const rp = o.rts.map((r) => ({ r, rho: Math.hypot(r[0] - cx, r[1] - cy), phi: ((Math.atan2(r[1] - cy, r[0] - cx) % TAU) + TAU) % TAU }));
    const faces = [];
    // a polygon of lifted points [x, y, h, ±1], with its grid lines (polylines of [x, y, h]), cut
    // where h changes sign
    function addFace(pts, lines) {
      let pos = false, neg = false;
      const tiny = 1e-12 * R;
      pts.forEach((q) => { if (q[2] > tiny) pos = true; else if (q[2] < -tiny) neg = true; });
      if (!(pos && neg)) { push(pts, lines); return; }
      for (const sg of [1, -1]) {
        const poly = [], segs = [];
        for (let i = 0; i < pts.length; i++) {
          const P0 = pts[i], P1 = pts[(i + 1) % pts.length], h0 = sg * P0[2], h1 = sg * P1[2];
          if (h0 >= 0) poly.push(P0);
          if ((h0 > 0 && h1 < 0) || (h0 < 0 && h1 > 0)) { const t = h0 / (h0 - h1); poly.push(P0.map((v, k) => v + (P1[k] - v) * t)); }
        }
        // the parts of the grid lines on this side
        lines.forEach((L) => {
          let cur = null;
          for (let i = 0; i < L.length; i++) {
            const h = sg * L[i][2];
            if (h >= 0) { if (!cur) { cur = []; if (i) { const h0 = sg * L[i - 1][2], t = h0 / (h0 - h); cur.push(L[i - 1].map((v, k) => v + (L[i][k] - v) * t)); } } cur.push(L[i]); }
            else if (cur) { const h0 = sg * L[i - 1][2], t = h0 / (h0 - h); cur.push(L[i - 1].map((v, k) => v + (L[i][k] - v) * t)); segs.push(cur); cur = null; }
          }
          if (cur && cur.length > 1) segs.push(cur);
        });
        if (poly.length >= 3) push(poly, segs);
      }
    }
    // a grid line along a side of a cell, from (f0, r0) to (f1, r1) in polar coordinates, on the sheet
    // through the point q0 with y = w0 (the side's first point): K points, y followed along it
    const K = 4;
    function gridLine(f0, r0, f1, r1, w0, s) {
      const out = [];
      let w = w0;
      for (let k = 0; k <= K; k++) {
        const q = at(r0 + (r1 - r0) * k / K, f0 + (f1 - f0) * k / K);
        w = align(q.w, w);
        out.push(lift(q, w, s).slice(0, 3));
      }
      return out;
    }
    function push(pts, segs) {
      const p = [];
      let c = 0;
      pts.forEach((q) => { p.push(q[0], q[1], q[2]); c += q[2]; });
      // the slope, from the diagonals (or two edges)
      const n = pts.length, A0 = pts[0], B0 = pts[Math.min(1, n - 1)], C0 = pts[Math.min(2, n - 1)], D0 = pts[n - 1];
      const d1 = n >= 4 ? [C0[0] - A0[0], C0[1] - A0[1], C0[2] - A0[2]] : [B0[0] - A0[0], B0[1] - A0[1], B0[2] - A0[2]];
      const d2 = n >= 4 ? [D0[0] - B0[0], D0[1] - B0[1], D0[2] - B0[2]] : [C0[0] - A0[0], C0[1] - A0[1], C0[2] - A0[2]];
      const nx = d1[1] * d2[2] - d1[2] * d2[1], ny = d1[2] * d2[0] - d1[0] * d2[2], nz = d1[0] * d2[1] - d1[1] * d2[0];
      faces.push({ p, c: c >= 0 ? 1 : -1, nz: Math.abs(nz) / (Math.hypot(nx, ny, nz) || 1), lines: segs });
    }
    // a cell of the grid, angles f0 to f1 and radii r0 to r1, with its corners (points of `at`) and
    // which of its sides are grid lines: [inner, outer, f0, f1]
    function cell(f0, f1, r0, r1, Q, grid, depth) {
      const inside = rp.filter((q) => q.rho >= r0 && q.rho < r1 && angleIn(q.phi, f0, f1));
      if (inside.length >= 2 && depth < 5) {
        const fm = (f0 + f1) / 2, rm = (r0 + r1) / 2, M = {};
        const pt = (f, r) => { const k = f + ':' + r; return M[k] || (M[k] = at(r, f)); };
        const q00 = Q[0], q10 = Q[1], q11 = Q[2], q01 = Q[3], qm0 = pt(fm, r0), qm1 = pt(fm, r1), q0m = pt(f0, rm), q1m = pt(f1, rm), qmm = pt(fm, rm);
        cell(f0, fm, r0, rm, [q00, qm0, qmm, q0m], [grid[0], false, grid[2], false], depth + 1);
        cell(fm, f1, r0, rm, [qm0, q10, q1m, qmm], [grid[0], false, false, grid[3]], depth + 1);
        cell(fm, f1, rm, r1, [qmm, q1m, q11, qm1], [false, grid[1], false, grid[3]], depth + 1);
        cell(f0, fm, rm, r1, [q0m, qmm, qm1, q01], [false, grid[1], grid[2], false], depth + 1);
        return;
      }
      if (!inside.length) {
        // two faces, the lifts of the cell to the two sheets
        const w0 = Q[0].w, ws = Q.map((q) => align(q.w, w0));
        for (const s of [1, -1]) {
          const lines = [];
          if (grid[0]) lines.push(gridLine(f0, r0, f1, r0, ws[0], s));
          if (grid[1]) lines.push(gridLine(f0, r1, f1, r1, ws[3], s));
          if (grid[2]) lines.push(gridLine(f0, r0, f0, r1, ws[0], s));
          if (grid[3]) lines.push(gridLine(f1, r0, f1, r1, ws[1], s));
          addFace(Q.map((q, k) => lift(q, ws[k], s)), lines);
        }
        return;
      }
      // a fan from the root (or from the middle of two that are too close, as at a node), its rim
      // the cell's sides cut into pieces, followed twice round (once if the fan has two roots)
      const M = 4, rim = [], onGrid = [];
      const side = (fa, ra, fb, rb, g) => { for (let k = 0; k < M; k++) { rim.push(k ? at(ra + (rb - ra) * k / M, fa + (fb - fa) * k / M) : null); onGrid.push(g); } };
      side(f0, r0, f1, r0, grid[0]); side(f1, r0, f1, r1, grid[3]); side(f1, r1, f0, r1, grid[1]); side(f0, r1, f0, r0, grid[2]);
      // (the corners: the points given)
      rim[0] = Q[0]; rim[M] = Q[1]; rim[2 * M] = Q[2]; rim[3 * M] = Q[3];
      let cxr = 0, cyr = 0;
      inside.forEach((q) => { cxr += q.r[0] / inside.length; cyr += q.r[1] / inside.length; });
      const ctr = [cxr, cyr, 0, 0], N = rim.length, laps = inside.length % 2 ? 2 : 1;
      for (let s of laps === 2 ? [1] : [1, -1]) {
        let w = rim[0].w;
        const ys = [w];
        for (let k = 1; k < laps * N; k++) { w = align(rim[k % N].w, w); ys.push(w); }
        for (let k = 0; k < laps * N; k++) {
          const a = lift(rim[k % N], ys[k], s), b = lift(rim[(k + 1) % N], k + 1 < laps * N ? ys[k + 1] : align(rim[0].w, ys[k]), s);
          addFace([ctr, a, b], onGrid[k % N] ? [[a.slice(0, 3), b.slice(0, 3)]] : []);
        }
      }
    }
    for (let b = 0; b < NR; b++) for (let a = 0; a < NA; a++) {
      const f0 = TAU * a / NA, f1 = TAU * (a + 1) / NA;
      cell(f0, f1, R * b / NR, R * (b + 1) / NR, [G[b][a], G[b][(a + 1) % NA], G[b + 1][(a + 1) % NA], G[b + 1][a]],
        [b > 0 && b % RG === 0, b + 1 === NR || (b + 1) % RG === 0, a % AG === 0, (a + 1) % AG === 0], 0);
    }
    return { faces };
  }
  function angleIn(phi, f0, f1) { return phi >= f0 && phi < f1; }

  // An orthographic camera: turned by yaw about the upright axis through (cx, cy), tipped by pitch
  // (π/2 looks straight down), and fitted to W × H with the disc of radius R and heights up to hmax.
  function camera(W, H, o) {
    const { cx, cy, R, yaw, pitch, hmax } = o, cw = Math.cos(yaw), sw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // (room for the axes' names, just beyond the disc)
    const k = Math.min(0.94 * W / (2.3 * R), 0.94 * H / (2.3 * R * sp + 2 * hmax * cp)), X0 = W / 2, Y0 = H / 2;
    return {
      k,
      proj(x, y, h) {
        const u = x - cx, v = y - cy, x1 = u * cw - v * sw, y1 = u * sw + v * cw;
        return [X0 + x1 * k, Y0 - (h * cp + y1 * sp) * k, y1 * cp - h * sp];
      },
      // the point of the plane at the height h (0 if not given) under the screen point (X, Y)
      unproj(X, Y, h) {
        const x1 = (X - X0) / k, y1 = (-(Y - Y0) / k - (h || 0) * cp) / sp;
        return [cx + x1 * cw + y1 * sw, cy - x1 * sw + y1 * cw];
      },
    };
  }

  // Draws the faces of the surface M from the back to the front, each with its grid lines, and
  // among them the segments segs ({ a, b: [x, y, h], color, width, bias }: lines such as the
  // seams and the axes, short, a little nearer by bias, so that the faces in front hide them);
  // colours: { white, blue: [r, g, b], grid }.
  function draw(ctx, cam, M, col, segs) {
    const items = M.faces.map((f) => {
      const p = f.p, n = p.length / 3, scr = new Float64Array(2 * n);
      let d = 0;
      for (let i = 0; i < n; i++) { const q = cam.proj(p[3 * i], p[3 * i + 1], p[3 * i + 2]); scr[2 * i] = q[0]; scr[2 * i + 1] = q[1]; d += q[2]; }
      return { d: d / n, f, scr };
    });
    (segs || []).forEach((sg) => { const a = cam.proj(...sg.a), b = cam.proj(...sg.b); items.push({ d: (a[2] + b[2]) / 2 - (sg.bias || 0), seg: [a, b], sg }); });
    items.sort((u, w) => w.d - u.d);
    const fill = (f) => {
      const t = (1 - f.c) / 2, sh = 0.9 + 0.1 * f.nz, W = col.white, B = col.blue;
      return 'rgb(' + [0, 1, 2].map((k) => Math.round((W[k] + (B[k] - W[k]) * t) * sh)).join(',') + ')';
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    items.forEach((it) => {
      if (it.seg) {
        ctx.strokeStyle = it.sg.color; ctx.lineWidth = it.sg.width; ctx.beginPath();
        ctx.moveTo(it.seg[0][0], it.seg[0][1]); ctx.lineTo(it.seg[1][0], it.seg[1][1]); ctx.stroke();
        return;
      }
      const s = it.scr, n = s.length / 2;
      let mx = 0, my = 0;
      for (let i = 0; i < n; i++) { mx += s[2 * i] / n; my += s[2 * i + 1] / n; }
      ctx.fillStyle = it.f.fill || (it.f.fill = fill(it.f));
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        // (a little larger than it is, so that no seams show between faces)
        const dx = s[2 * i] - mx, dy = s[2 * i + 1] - my, l = Math.hypot(dx, dy) || 1, x = s[2 * i] + dx / l * 0.45, y = s[2 * i + 1] + dy / l * 0.45;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.fill();
      if (it.f.lines.length) {
        ctx.strokeStyle = col.grid; ctx.lineWidth = 0.8; ctx.beginPath();
        it.f.lines.forEach((L) => L.forEach((q, i) => { const a = cam.proj(q[0], q[1], q[2]); if (i) ctx.lineTo(a[0], a[1]); else ctx.moveTo(a[0], a[1]); }));
        ctx.stroke();
      }

    });
  }

  root.PLSurface = { field, mesh, camera, draw };
})(typeof globalThis !== 'undefined' ? globalThis : this);
