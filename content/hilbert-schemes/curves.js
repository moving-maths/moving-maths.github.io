// The real zero sets of polynomials in x and y, drawn into an RGBA pixel buffer as
// bands of even width with soft edges. With no DOM; used by main.js and thumb.html.
//
// A pixel is in the band of f when its distance to the curve f = 0, estimated as
// |f| / |∇f|, is within half the width. The estimate needs no sign change, so a
// doubled line, f = g², is drawn too, and twice as wide (|g²|/|∇g²| = |g|/(2|∇g|)):
// a line of multiplicity k comes out k times as wide, as it should. Only the cells
// of a coarse grid that the curve may cross are worked out pixel by pixel.
(function (root) {
  'use strict';

  const CELL = 8; // device pixels: the coarse grid

  // f as a polynomial in x for each row: coefficients of f and of ∂f/∂y, by power of x
  function compile(terms) {
    let da = 0, db = 0;
    for (const t of terms) { if (t.a > da) da = t.a; if (t.b > db) db = t.b; }
    return { terms, da, db };
  }
  function rowPoly(P, y, f, fy) {
    f.fill(0, 0, P.da + 1);
    fy.fill(0, 0, P.da + 1);
    for (const t of P.terms) {
      const yb = t.b ? Math.pow(y, t.b) : 1;
      f[t.a] += t.c * yb;
      if (t.b) fy[t.a] += t.c * t.b * Math.pow(y, t.b - 1);
    }
  }
  // the value of f, ∂f/∂x and ∂f/∂y at x, from the row's coefficients
  function at(P, f, fy, x, out) {
    let v = 0, dx = 0, vy = 0;
    for (let i = P.da; i >= 0; i--) {
      dx = dx * x + v;
      v = v * x + f[i];
      vy = vy * x + fy[i];
    }
    out[0] = v; out[1] = dx; out[2] = vy;
  }

  // polys: [{ terms: [{a, b, c}], rgb: [r, g, b], alpha, width }] (width in device pixels),
  // drawn in order, the later over the earlier.
  // view: { W, H } the buffer's size, and the plane: x = x0 + (i + 0.5)/k, y = y0 − (j + 0.5)/k.
  function draw(polys, view, buf) {
    const { W, H, x0, y0, k } = view;
    const nx = Math.ceil(W / CELL), ny = Math.ceil(H / CELL);
    const f = new Float64Array(16), fy = new Float64Array(16), v = new Float64Array(3);
    const gv = new Float64Array((nx + 1) * (ny + 1)), gd = new Float64Array((nx + 1) * (ny + 1));
    for (const poly of polys) {
      if (!poly.terms.length) continue;
      const P = compile(poly.terms), half = poly.width / 2, alpha = poly.alpha === undefined ? 1 : poly.alpha;
      const [cr, cg, cb] = poly.rgb;
      // a pixel within the band lies in a cell whose nearest corner is within CELL·√2/2 of it
      const reach = CELL + half + 2;
      // the coarse grid: f and its distance estimate at the corners of the cells
      for (let gj = 0; gj <= ny; gj++) {
        const y = y0 - (gj * CELL) / k;
        rowPoly(P, y, f, fy);
        for (let gi = 0; gi <= nx; gi++) {
          at(P, f, fy, x0 + (gi * CELL) / k, v);
          const g = Math.sqrt(v[1] * v[1] + v[2] * v[2]), q = gj * (nx + 1) + gi;
          gv[q] = v[0];
          gd[q] = g > 0 ? (Math.abs(v[0]) / g) * k : Infinity;
        }
      }
      // the cells the band may cross: a change of sign at the corners, or a corner close to the curve
      const hot = new Uint8Array(nx * ny);
      let any = false;
      for (let gj = 0; gj < ny; gj++) for (let gi = 0; gi < nx; gi++) {
        const a = gj * (nx + 1) + gi, b = a + 1, c = a + nx + 1, d = c + 1;
        const s = Math.sign(gv[a]) + Math.sign(gv[b]) + Math.sign(gv[c]) + Math.sign(gv[d]);
        if (Math.abs(s) < 4 || Math.min(gd[a], gd[b], gd[c], gd[d]) < reach) { hot[gj * nx + gi] = 1; any = true; }
      }
      if (!any) continue;
      const near = hot;
      // pixel by pixel in those cells
      for (let gj = 0; gj < ny; gj++) {
        let rowAny = false;
        for (let gi = 0; gi < nx; gi++) if (near[gj * nx + gi]) { rowAny = true; break; }
        if (!rowAny) continue;
        const j0 = gj * CELL, j1 = Math.min(H, j0 + CELL);
        for (let j = j0; j < j1; j++) {
          const y = y0 - (j + 0.5) / k;
          rowPoly(P, y, f, fy);
          for (let gi = 0; gi < nx; gi++) {
            if (!near[gj * nx + gi]) continue;
            const i0 = gi * CELL, i1 = Math.min(W, i0 + CELL);
            for (let i = i0; i < i1; i++) {
              at(P, f, fy, x0 + (i + 0.5) / k, v);
              const g = Math.sqrt(v[1] * v[1] + v[2] * v[2]);
              const dist = g > 0 ? (Math.abs(v[0]) / g) * k : (v[0] === 0 ? 0 : Infinity);
              let cov = half + 0.5 - dist;
              if (cov <= 0) continue;
              if (cov > 1) cov = 1;
              const a = cov * alpha, p = (j * W + i) * 4, da = buf[p + 3] / 255;
              const oa = a + da * (1 - a);
              if (oa <= 0) continue;
              buf[p] = (cr * a + buf[p] * da * (1 - a)) / oa;
              buf[p + 1] = (cg * a + buf[p + 1] * da * (1 - a)) / oa;
              buf[p + 2] = (cb * a + buf[p + 2] * da * (1 - a)) / oa;
              buf[p + 3] = oa * 255;
            }
          }
        }
      }
    }
  }

  root.Curves = { draw };
})(globalThis);
