// Root systems of rank two and three: the figure and its readouts.
// The mathematics (roots, multiplicities, positive systems) is in roots.js.
//
// Rank two is drawn in the plane, each root at its place. Rank three is drawn
// on the sphere of directions: a root sits where its ray meets the sphere.
// In both, the handle is a linear functional f, drawn through the dot product
// of the picture as a point n with f = n · (−); the roots with f > 0 are the
// positive ones. The mirror of a root α is {f : f(α) = 0}: the positions of
// the handle at which α changes sign.
//
// In rank three an affine or hyperbolic system can also be drawn flat: the
// functionals with f(δ) = 1 form a Euclidean plane, and those inside the light
// cone, up to scale, a hyperbolic plane, drawn as the Poincaré disc. There the
// mirrors are lines, the chambers triangles, and the handle a point. The disc is
// drawn with hyperbolic.js, which keeps it exact however far it is moved: the view
// and the handle are each a point near the standard chamber, and an element of the
// Weyl group, in integers, that takes them where they are.
(function () {
  'use strict';
  const RS = window.RootSystems, HY = window.Hyperbolic;
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d'), handle = $('handle');
  MM.handle(handle);
  const TAU = 2 * Math.PI;

  const M2 = (a, b) => [[2, -a], [-b, 2]];
  const SYSTEMS = {
    a1a1: { A: M2(0, 0), tex: '\\mathrm{A}_1\\times\\mathrm{A}_1', plain: 'A1 × A1' },
    a2: { A: M2(1, 1), tex: '\\mathrm{A}_2', plain: 'A2' },
    b2: { A: M2(1, 2), tex: '\\mathrm{B}_2', plain: 'B2' },
    g2: { A: M2(3, 1), tex: '\\mathrm{G}_2', plain: 'G2' },
    a3: { A: [[2, -1, 0], [-1, 2, -1], [0, -1, 2]], tex: '\\mathrm{A}_3', plain: 'A3' },
    b3: { A: [[2, -1, 0], [-1, 2, -1], [0, -2, 2]], tex: '\\mathrm{B}_3', plain: 'B3' },
    c3: { A: [[2, -1, 0], [-1, 2, -2], [0, -1, 2]], tex: '\\mathrm{C}_3', plain: 'C3', like: 'b3' }, // the same mirrors as B3: shown the same way round
    a11: { A: M2(2, 2), tex: '\\mathrm{A}_1^{(1)}', plain: 'affine A1(1)' },
    a22: { A: M2(4, 1), tex: '\\mathrm{A}_2^{(2)}', plain: 'affine A2(2)' },
    a21: { A: [[2, -1, -1], [-1, 2, -1], [-1, -1, 2]], tex: '\\mathrm{A}_2^{(1)}', plain: 'affine A2(1)' },
    c21: { A: [[2, -1, 0], [-2, 2, -2], [0, -1, 2]], tex: '\\mathrm{C}_2^{(1)}', plain: 'affine C2(1)' },
    g21: { A: [[2, -1, 0], [-1, 2, -1], [0, -3, 2]], tex: '\\mathrm{G}_2^{(1)}', plain: 'affine G2(1)' },
    d43: { A: [[2, -1, 0], [-1, 2, -3], [0, -1, 2]], tex: '\\mathrm{D}_4^{(3)}', plain: 'affine D4(3)', like: 'g21' }, // the same alcoves as G2(1)
    t23i: { A: [[2, -2, 0], [-2, 2, -1], [0, -1, 2]] },
    tiii: { A: [[2, -2, -2], [-2, 2, -2], [-2, -2, 2]] },
    t344: { A: [[2, -1, -2], [-1, 2, -2], [-1, -1, 2]] },
    t246: { A: [[2, -2, 0], [-1, 2, -3], [0, -1, 2]] },
    sl21: { plain: 'sl(2|1)', even: '\\mathfrak{gl}_2', form: '$(\\varepsilon_i,\\varepsilon_j)=\\delta_{ij}$, $(\\delta_1,\\delta_1)=-1$' },
    osp32: { plain: 'osp(3|2)', even: '\\mathfrak{so}_3\\oplus\\mathfrak{sp}_2', form: '$(\\varepsilon_1,\\varepsilon_1)=1$, $(\\delta_1,\\delta_1)=-1$' },
    osp14: { plain: 'osp(1|4)', even: '\\mathfrak{sp}_4', form: '$(\\delta_i,\\delta_j)=-\\delta_{ij}$' },
    sl31: { plain: 'sl(3|1)', even: '\\mathfrak{gl}_3', form: '$(\\varepsilon_i,\\varepsilon_j)=\\delta_{ij}$, $(\\delta_1,\\delta_1)=-1$' },
    osp52: { plain: 'osp(5|2)', even: '\\mathfrak{so}_5\\oplus\\mathfrak{sp}_2', form: '$(\\varepsilon_i,\\varepsilon_j)=\\delta_{ij}$, $(\\delta_1,\\delta_1)=-1$' },
    osp34: { plain: 'osp(3|4)', even: '\\mathfrak{so}_3\\oplus\\mathfrak{sp}_4', form: '$(\\varepsilon_1,\\varepsilon_1)=1$, $(\\delta_i,\\delta_j)=-\\delta_{ij}$' },
    d21: { plain: 'D(2,1;α)', even: '\\mathfrak{sl}_2\\oplus\\mathfrak{sl}_2\\oplus\\mathfrak{sl}_2', form: '$(\\varepsilon_1,\\varepsilon_1)=-(1+\\alpha)$, $(\\varepsilon_2,\\varepsilon_2)=1$, $(\\varepsilon_3,\\varepsilon_3)=\\alpha$' },
    g3: { plain: 'G(3)', even: '\\mathrm{G}_2\\oplus\\mathfrak{sl}_2', form: '$(\\varepsilon_i,\\varepsilon_j)=1-3\\delta_{ij}$ with $\\varepsilon_1+\\varepsilon_2+\\varepsilon_3=0$, and $(\\delta,\\delta)=2$' },
  };
  // The hyperbolic systems of rank 2 are one family: 'h' + a + b for the matrix with |a_12| = a,
  // |a_21| = b, ab > 4, each at most 8 (the sliders under the name give them)
  const HEAVY = 8;
  const rankTwo = (id) => { const m = /^h([1-8])([1-8])$/.exec(id || ''); return m && +m[1] * +m[2] > 4 ? [+m[1], +m[2]] : null; };
  // a system's definition, by its id
  function defOf(id) {
    const ab = rankTwo(id);
    if (ab && !SYSTEMS[id]) SYSTEMS[id] = { A: M2(ab[0], ab[1]) };
    return SYSTEMS[id];
  }
  const FAMILY = { finite: 'finite type', affine: 'affine type', hyperbolic: 'hyperbolic type', super: 'Lie superalgebra' };
  // The systems under the picture, in a list for each type, in a group for each rank
  const LISTS = {
    finite: [['a1a1', 'a2', 'b2', 'g2'], ['a3', 'b3', 'c3']],
    affine: [['a11', 'a22'], ['a21', 'c21', 'g21', 'd43']],
    hyperbolic: [['h', 't23i', 'tiii', 't344', 't246']],
    super: [['sl21', 'osp32', 'osp14'], ['sl31', 'osp52', 'osp34', 'd21', 'g3']],
  };
  // each system's type and rank: 'finite2', …
  const GROUP = {};
  for (const fam of Object.keys(LISTS)) LISTS[fam].forEach((ids, k) => ids.forEach((id) => { GROUP[id] = fam + (k + 2); }));
  GROUP.h = 'hyperbolic2';
  ['t23i', 'tiii', 't344', 't246'].forEach((id) => { GROUP[id] = 'hyperbolic3'; });
  const groupOf = (id) => (rankTwo(id) ? 'hyperbolic2' : GROUP[id]);
  // the entry of the lists a system is under
  const entryOf = (id) => (rankTwo(id) ? 'h' : id);
  // kind of root → [colour token, name]
  const KIND = {
    real: ['root-real', 'real root'], imag: ['root-imag', 'imaginary root'],
    even: ['root-real', 'even root'], iso: ['root-iso', 'odd isotropic root'], odd: ['root-odd', 'odd root, not isotropic'],
  };
  const EXTENT = { min: 5, max: 20, start: 7 };   // rank 2: half-width of the window, for the infinite systems
  const DEPTH = 36;                               // rank 3: real roots and mirrors up to this height, the deeper smaller
  const IM_DEPTH = 12;                            // rank 3: imaginary roots up to this height
  const SPAN = { min: 1.4, max: 4.8, start: 2.1 }; // rank 3, the affine plane: half-width of the window, in diameters of an alcove
  const IM_LOCAL = 8;                    // the disc: imaginary roots up to this height in the coordinates of their chamber
  const RIM = 0.985;                     // the disc: the handle stays inside this radius
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  /* ---------- vectors ---------- */
  const mv = (R, p) => [R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]];
  const tmv = (R, p) => [R[0][0] * p[0] + R[1][0] * p[1] + R[2][0] * p[2], R[0][1] * p[0] + R[1][1] * p[1] + R[2][1] * p[2], R[0][2] * p[0] + R[1][2] * p[1] + R[2][2] * p[2]];
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
  const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // the view of the sphere: the model's z-axis up and tipped towards the reader
  // (more so for the infinite types, whose chambers lie round the pole)
  const viewAt = (tilt) => mm(rotX(tilt), mm([[1, 0, 0], [0, 0, 1], [0, -1, 0]], rotZ(-0.35)));
  const VIEW0 = viewAt(0.95);

  // The Lorentzian plane x² + y² − z²: the disc is moved by maps that preserve it (hyperbolic.js).
  const { flipZ, lift } = HY;

  // The single source of truth; draw() renders everything from it.
  const state = {
    id: 'a2',          // the system shown
    family: 'finite', rank: 2, // its type and rank (GROUP)
    n: [0, 1],         // the handle: a unit vector of the model space
    view: VIEW0,       // rank 3: the rotation from the model to the screen (x right, y up, z towards the reader)
    zoom: EXTENT.start, // rank 2: the half-width of the window
    mirrors: true,
    handle: true,      // the handle is shown (Save image may leave it out); hidden, it keeps its place
    lengths: true,     // rank 3, finite type: the roots at their true lengths, out of the sphere
    flat: true,        // rank 3, affine and hyperbolic type: the plane or the disc instead of the sphere
    pan: [0, 0],       // the plane: the functional in the middle of the window
    span: SPAN.start,  // the plane: the half-width of the window, in diameters of an alcove
    boost: I3,         // the disc: the Lorentz map from the functionals of the frame `at` to the view (kept small)
    at: null,          // the disc: the frame of the view, an element w of the Weyl group (Hyperbolic.group)
    loc: null,         // hyperbolic type: the handle as a functional near the standard chamber in a frame (located())
    alpha: 1,          // the parameter of D(2,1;α)
    sel: null,         // key of the selected root
    hover: null,
  };

  let example = null; // links, reset and Save image (MM.example, at the end)
  const cache = {};
  function currentId() { return state.id; }
  function system(which) {
    const id = which || currentId(), k = id === 'd21' ? id + '@' + state.alpha : id;
    if (!cache[k]) {
      const def = defOf(id);
      const sys = def.A ? RS.kacMoody(def.A, { R: EXTENT.max, H: DEPTH, Him: IM_DEPTH }) : RS.superSystem(id, state.alpha);
      sys.byKey = new Map(sys.roots.map((v) => [RS.key(v.c), v]));
      sys.reach = Math.max(...sys.roots.map((v) => Math.hypot(...v.p)));
      sys.maxNorm = Math.max(...sys.roots.map((v) => Math.abs(v.norm)));
      const nonzero = (x) => Math.abs(x) > 1e-9;
      sys.levels = sys.family === 'super' ? Array.from(new Set(sys.roots.map((v) => Math.round(v.norm * 1e6) / 1e6).filter(nonzero))) : sys.realNorms;
      for (const v of sys.roots) {
        v.u = sys.rank === 3 ? unit(v.p) : null;
        v.primitive = Math.abs(v.c.reduce((g, x) => { let a = Math.abs(g), b = Math.abs(x); while (b) { const t = a % b; a = b; b = t; } return a; }, 0)) === 1;
        v.doubled = sys.byKey.has(RS.key(v.c.map((x) => x / 2)));          // 2β for an odd root β
        v.hasDouble = sys.byKey.has(RS.key(v.c.map((x) => 2 * x)));
      }
      sys.walls.forEach((w, i) => { w.u = sys.rank === 3 ? unit(w.p) : null; w.index = i; });
      // only the newest D(2,1;α) is kept
      if (id === 'd21') Object.keys(cache).forEach((x) => { if (x.startsWith('d21@')) delete cache[x]; });
      cache[k] = sys;
    }
    return cache[k];
  }

  const place = (sys, c) => sys.E[0].map((_, k) => c.reduce((t, x, i) => t + x * sys.E[i][k], 0)); // a lattice vector in the model
  // The flat views reach roots beyond the ones listed with the system; they are kept here.
  const known = new Map();
  const rootOf = (sys, k) => (k && (sys.byKey.get(k) || known.get(k))) || null;
  // (`near`: the same root taken near the standard chamber by the Weyl group, which keeps the
  // form; its length is worked out from that, exactly, when c is far out in the disc)
  function record(sys, c, kind, rep, near) {
    const k = RS.key(c);
    let v = sys.byKey.get(k) || known.get(k);
    if (!v) {
      if (known.size > 40000) { const keep = known.get(state.sel); known.clear(); if (keep) known.set(state.sel, keep); }
      const p = place(sys, c), b = near || c;
      v = { c, p, u: unit(p), norm: RS.quad(sys.gram)(b, b), kind, ht: RS.height(c), mult: kind === 'real' ? 1n : sys.mult(rep), primitive: true };
      known.set(k, v);
    }
    if (rep) v.rep = rep; // an imaginary root: its conjugate in the standard chamber, with the same multiplicities
    return v;
  }
  const isFlat = (sys) => state.flat && sys.rank === 3 && (sys.family === 'affine' || sys.family === 'hyperbolic');
  // true lengths: how far the longest root reaches, in radii of the sphere through the shortest
  const stretch = (sys) => (state.lengths && sys.rank === 3 && sys.family === 'finite' ? Math.sqrt(sys.realNorms[sys.realNorms.length - 1] / sys.realNorms[0]) : 1);
  const sphereK = (sys) => (Math.min(canvas.clientWidth, canvas.clientHeight) / 2 - 24) / stretch(sys);
  // Finite type, rank 3: the orthogonal map from the model to a frame fixed by
  // the directions of the simple roots. Systems with the same mirrors have the
  // same directions in it, whatever the lengths.
  function frame(sys) {
    const rows = [];
    for (const e of sys.E) {
      let v = unit(e);
      for (const u of rows) { const t = v[0] * u[0] + v[1] * u[1] + v[2] * u[2]; v = v.map((x, k) => x - t * u[k]); }
      rows.push(unit(v));
    }
    return rows;
  }
  const transpose = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  // α_1, …, α_n themselves: marked in grey wherever the handle is, so that a
  // name like α_1 + 2α_2 can be followed back to them
  const standard = (sys) => (sys.family === 'super' ? [] : sys.E.map((_, i) => sys.E.map((__, j) => +(i === j))));
  // the roots whose mirrors are picked out: the one pointed at, then the selected one
  function marked(sys) {
    const out = [];
    for (const [k, lw] of [[state.hover !== state.sel && state.hover, 1.5], [state.sel, 2.25]]) {
      const v = rootOf(sys, k);
      if (v && v.kind !== 'imag') out.push([v, lw]);
    }
    return out;
  }

  const fmt = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));
  const colorOf = (kind, alpha) => (alpha === undefined ? MM.color(KIND[kind][0]) : MM.rgba(KIND[kind][0], alpha));
  // how strongly to draw the mirror of a root: the far ones fade
  const wallAlpha = (sys, w) => (sys.family === 'super' || !sys.infinite ? 0.5
    : 0.17 + 0.43 / (1 + (sys.rank === 2 ? w.index / 5 : (w.ht - 1) / 10)));

  let shown = []; // the roots in view, with their pixel positions, for hit-testing

  function dot2(px, py, r, col, filled) {
    ctx.beginPath();
    if (filled) {
      ctx.arc(px, py, r, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
    } else {
      const lw = Math.min(1.6, r * 0.45);
      ctx.arc(px, py, Math.max(0.5, r - lw / 2), 0, TAU);
      ctx.fillStyle = MM.color('surface');
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = col;
      ctx.stroke();
    }
  }

  // A label beside the point (x, y), pushed away from the centre, on a patch of
  // the surface colour so that it reads over lines and other roots.
  function tag(V, text, x, y, gap, color) {
    const size = V.w < 420 ? 12.5 : 13.5, tw = MM.measureLabel(ctx, text, size), th = size * 1.3;
    const d = Math.hypot(x - V.cx, y - V.cy) || 1, ux = (x - V.cx) / d, uy = (y - V.cy) / d;
    const bx = x + ux * (gap + tw / 2 + 3), by = y + uy * (gap + th / 2 + 3);
    plate(V, text, bx, by, color);
  }
  // A label centred at (bx, by), moved if it would sit under the handle.
  function plate(V, text, bx, by, color, anywhere) {
    const size = V.w < 420 ? 12.5 : 13.5, tw = MM.measureLabel(ctx, text, size), th = size * 1.3;
    bx = Math.max(tw / 2 + 5, Math.min(V.w - tw / 2 - 5, bx));
    by = Math.max(th / 2 + 3, Math.min(V.h - th / 2 - 3, by));
    // keep clear of the handle, which sits on top of the canvas
    if (!anywhere && state.handle && Math.abs(bx - V.hx) < tw / 2 + 18 && Math.abs(by - V.hy) < th / 2 + 18) by = V.hy + (V.hy > V.cy ? -1 : 1) * (th / 2 + 22);
    ctx.fillStyle = MM.rgba('surface', 0.86);
    ctx.beginPath();
    ctx.roundRect(bx - tw / 2 - 4, by - th / 2 - 1, tw + 8, th + 2, 4);
    ctx.fill();
    MM.canvasLabel(ctx, text, bx, by, { size, align: 'center', baseline: 'middle', color });
  }

  function rings(picked, simpleKeys, originKeys) {
    const ring = (k, color, lw, grow) => {
      const p = k && shown.find((q) => RS.key(q.v.c) === k);
      if (!p) return null;
      ctx.beginPath();
      ctx.arc(p.px, p.py, p.r + grow, 0, TAU);
      ctx.lineWidth = lw;
      ctx.strokeStyle = color;
      ctx.stroke();
      return p;
    };
    (originKeys || []).forEach((k) => ring(k, MM.color('ink-3'), 1.25, 3.2));
    (simpleKeys || []).forEach((k) => ring(k, MM.color('ink'), 1.5, 3.2));
    if (state.hover !== state.sel) ring(state.hover, MM.color('ink-3'), 1.25, 4.5);
    return ring(state.sel, MM.color('accent'), 2, 4.5);
  }

  /* ---------- rank two: the plane ---------- */

  function viewPlane(sys) {
    const w = canvas.clientWidth, h = canvas.clientHeight, half = Math.min(w, h) / 2;
    const ext = sys.infinite ? state.zoom : 1.5 * sys.reach, rh = half - 20;
    return { w, h, cx: w / 2, cy: h / 2, s: half / ext, ext, rh, hx: w / 2 + rh * state.n[0], hy: h / 2 - rh * state.n[1] };
  }

  function levelSet(sys, V, c) {
    // sign · (x² + sig · y²) = c
    const t = c / sys.sign, { cx, cy, s, ext } = V;
    ctx.beginPath();
    if (sys.sig === 1) {
      if (t <= 0) return;
      ctx.arc(cx, cy, Math.sqrt(t) * s, 0, TAU);
    } else if (sys.sig === 0) {
      if (t <= 0) return;
      for (const sg of [1, -1]) { const x = cx + sg * Math.sqrt(t) * s; ctx.moveTo(x, 0); ctx.lineTo(x, V.h); }
    } else {
      for (const sg of [1, -1]) {
        for (let i = 0; i <= 120; i++) {
          const u = (i / 60 - 1) * ext * 1.05, v = sg * Math.sqrt(Math.abs(t) + u * u);
          const x = t > 0 ? v : u, y = t > 0 ? u : v;
          if (i) ctx.lineTo(cx + x * s, cy - y * s); else ctx.moveTo(cx + x * s, cy - y * s);
        }
      }
    }
    ctx.stroke();
  }

  function arrow(x0, y0, x1, y1, gap) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < gap + 8) return;
    const ux = (x1 - x0) / d, uy = (y1 - y0) / d, tx = x1 - ux * gap, ty = y1 - uy * gap;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(tx - ux * 4, ty - uy * 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - ux * 9 - uy * 4, ty - uy * 9 + ux * 4);
    ctx.lineTo(tx - ux * 9 + uy * 4, ty - uy * 9 - ux * 4);
    ctx.closePath();
    ctx.fill();
  }

  function paintPlane(sys, V, res, f) {
    const { w, h, cx, cy, s } = V, n = state.n, L = w + h;
    const at = (c) => [cx + (c[0] * sys.E[0][0] + c[1] * sys.E[1][0]) * s, cy - (c[0] * sys.E[0][1] + c[1] * sys.E[1][1]) * s];
    ctx.clearRect(0, 0, w + 2, h + 2); // the canvas can be a fraction of a pixel larger than its box
    ctx.setLineDash([]);

    // the negative side of the dividing line, tinted
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-(Math.atan2(n[1], n[0]) - Math.PI / 2));
    ctx.fillStyle = MM.rgba('ink', 0.035);
    ctx.fillRect(-2 * L, 0, 4 * L, 2 * L);
    ctx.restore();

    // the chamber of the handle: the sector between the mirrors of the simple roots
    if (res.ok && state.mirrors) {
      const rays = RS.dualBasis(res.simple.map((c) => place(sys, c))).map(unit);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + L * rays[0][0], cy - L * rays[0][1]);
      ctx.lineTo(cx + L * (rays[0][0] + rays[1][0]), cy - L * (rays[0][1] + rays[1][1]));
      ctx.lineTo(cx + L * rays[1][0], cy - L * rays[1][1]);
      ctx.closePath();
      ctx.fillStyle = MM.rgba('accent', 0.11);
      ctx.fill();
    }

    // level sets of the form through the roots that have a length
    ctx.lineWidth = 1;
    ctx.strokeStyle = MM.color('rule');
    sys.levels.forEach((c) => levelSet(sys, V, c));

    // null directions
    if (sys.sig !== 1) {
      ctx.strokeStyle = MM.color('ink-3');
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (sys.sig === 0) { ctx.moveTo(cx, 0); ctx.lineTo(cx, h); }
      else { ctx.moveTo(cx - L, cy - L); ctx.lineTo(cx + L, cy + L); ctx.moveTo(cx - L, cy + L); ctx.lineTo(cx + L, cy - L); }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // mirrors: for each root, the line of handle positions at which it changes sign
    const mirror = (p) => {
      const l = Math.hypot(p[0], p[1]), ux = -p[1] / l, uy = p[0] / l;
      ctx.beginPath();
      ctx.moveTo(cx - L * ux, cy + L * uy);
      ctx.lineTo(cx + L * ux, cy - L * uy);
      ctx.stroke();
    };
    if (state.mirrors) {
      ctx.lineWidth = 1;
      if (sys.family === 'affine') {
        // The mirrors close in on the mirror of δ. Each side is drawn in order
        // of slope, skipping those less than two pixels from the last one drawn
        // at the edge of the figure, and the fan ends with its limit, the
        // mirror of δ: lines all the way, evenly spaced where they are dense.
        const edge = Math.hypot(w, h) / 2, tilt = (wl) => Math.atan2(Math.abs(wl.p[0]), wl.p[1]);
        sys.fan = sys.fan || [1, -1].map((sg) => sys.walls.filter((wl) => Math.sign(wl.p[0]) === sg).sort((a, b) => tilt(b) - tilt(a)));
        const pen = (gap) => colorOf('real', Math.max(0.3, Math.min(0.5, 0.075 * gap)));
        for (const side of sys.fan) {
          let at = Infinity;
          for (const wl of side) {
            const t = tilt(wl), gap = (at - t) * edge;
            if (gap < 2 || t * edge < 2) continue;
            ctx.strokeStyle = pen(gap);
            mirror(wl.p);
            at = t;
          }
        }
        ctx.strokeStyle = pen(2);
        mirror([0, 1]);
      } else {
        for (const wl of sys.walls) {
          ctx.strokeStyle = colorOf(wl.kind, wallAlpha(sys, wl));
          ctx.setLineDash(wl.kind === 'iso' ? [4, 3] : []);
          mirror(wl.p);
          ctx.setLineDash([]);
        }
      }
    }
    // the mirror of the selected root
    for (const [v, lw] of marked(sys)) {
      ctx.strokeStyle = colorOf(v.kind);
      ctx.lineWidth = lw;
      ctx.setLineDash(v.kind === 'iso' ? [5, 3] : []);
      mirror(v.p);
      ctx.setLineDash([]);
    }

    // the dividing line: the kernel of the handle's functional
    ctx.strokeStyle = MM.color('ink');
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx - L * n[1], cy - L * n[0]);
    ctx.lineTo(cx + L * n[1], cy + L * n[0]);
    ctx.stroke();
    // a stem from the origin to the handle
    if (state.handle) {
      ctx.strokeStyle = MM.rgba('ink', 0.35);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(V.hx, V.hy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // arrows to the simple roots; in grey, to α_1 and α_2 when they are not the simple roots
    const base = sys.infinite ? Math.max(2, Math.min(5.5, 0.15 * s)) : (w < 420 ? 5 : 6);
    const simple = [], origin = standard(sys).filter((c) => !(res.ok && res.simple.some((b) => RS.key(b) === RS.key(c)))).map((c) => ({ c, at: at(c) }));
    ctx.strokeStyle = ctx.fillStyle = MM.color('ink-3');
    ctx.lineWidth = 1.25;
    for (const o of origin) arrow(cx, cy, o.at[0], o.at[1], base + 2.5);
    if (res.ok) {
      ctx.strokeStyle = ctx.fillStyle = MM.color('ink');
      ctx.lineWidth = 1.75;
      for (const b of res.simple) {
        let [px, py] = at(b);
        const d = Math.hypot(px - cx, py - cy), far = 3 * L;
        if (d > far) { px = cx + (px - cx) * far / d; py = cy + (py - cy) * far / d; }
        arrow(cx, cy, px, py, base + 2.5);
        simple.push({ c: b, key: RS.key(b), px, py, inside: px > 4 && px < w - 4 && py > 4 && py < h - 4 });
      }
    }

    // the origin
    ctx.fillStyle = MM.color('ink');
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, TAU);
    ctx.fill();

    // the roots: filled on the positive side, hollow on the negative
    shown = [];
    const lim = V.ext * 1.04;
    for (const v of sys.roots) {
      if (Math.abs(v.p[0]) > lim || Math.abs(v.p[1]) > lim) continue;
      const px = cx + v.p[0] * s, py = cy - v.p[1] * s;
      const r = v.kind === 'imag' && v.mult > 1n ? base * Math.min(2.3, 1 + 0.2 * Math.log2(Number(v.mult))) : base;
      shown.push({ v, px, py, r });
      dot2(px, py, r, colorOf(v.kind), f(v.c) > 1e-9);
    }

    // multiplicities, where there is room for them
    if (sys.family === 'hyperbolic' && s >= 30) {
      for (const p of shown) {
        if (p.v.kind !== 'imag' || p.v.mult <= 1n) continue;
        MM.canvasLabel(ctx, String(p.v.mult), p.px + p.r + 2, p.py - p.r - 1, { size: 11, color: MM.color('ink-2') });
      }
    }

    const picked = rings(null);
    for (const o of origin) tag(V, '$' + RS.rootTex(sys, o.c) + '$', o.at[0], o.at[1], base + 3, MM.color('ink-3'));
    for (const b of simple) if (b.inside) tag(V, '$' + RS.rootTex(sys, b.c) + '$', b.px, b.py, base + 3, MM.color('ink'));
    if (picked && !simple.some((b) => b.key === state.sel)) tag(V, '$' + RS.rootTex(sys, picked.v.c) + '$', picked.px, picked.py, picked.r + 5, MM.color('accent-ink'));
  }

  /* ---------- rank three: the sphere of directions ---------- */

  function viewSphere(sys) {
    const w = canvas.clientWidth, h = canvas.clientHeight, K = sphereK(sys);
    const hv = mv(state.view, state.n), r = Math.hypot(hv[0], hv[1]);
    // a handle on the far side is shown at the rim
    const k = hv[2] >= 0 || r < 1e-9 ? 1 : 1 / r;
    return { w, h, cx: w / 2, cy: h / 2, K, hv, back: hv[2] < 0, hx: w / 2 + K * hv[0] * k, hy: h / 2 - K * hv[1] * k };
  }

  // the near half of the great circle of points orthogonal to a (a unit vector, in view coordinates)
  function nearHalf(a, N) {
    const l = Math.hypot(a[0], a[1]);
    if (l < 1e-9) return null; // the rim itself
    const u = [a[1] / l, -a[0] / l, 0];
    let w = cross(a, u);
    if (w[2] < 0) w = w.map((x) => -x);
    const pts = [];
    for (let i = 0; i <= N; i++) { const t = Math.PI * i / N, c = Math.cos(t), s = Math.sin(t); pts.push([c * u[0] + s * w[0], c * u[1] + s * w[1], s * w[2]]); }
    return pts;
  }

  // Strokes a path through view points, keeping the parts where keep(p) ≥ 0
  // (cut where it changes sign) and, in any case, the near side only.
  function strokePts(V, pts, keep) {
    const g = (p) => Math.min(p[2] + 1e-9, keep ? keep(p) : 1);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], gp = g(p);
      if (i) {
        const q = pts[i - 1], gq = g(q);
        if ((gp >= 0) !== (gq >= 0)) {
          const t = gq / (gq - gp), x = q[0] + t * (p[0] - q[0]), y = q[1] + t * (p[1] - q[1]);
          if (gp >= 0) { ctx.moveTo(V.cx + V.K * x, V.cy - V.K * y); pen = true; } else if (pen) { ctx.lineTo(V.cx + V.K * x, V.cy - V.K * y); pen = false; }
        }
      }
      if (gp >= 0) { if (pen) ctx.lineTo(V.cx + V.K * p[0], V.cy - V.K * p[1]); else { ctx.moveTo(V.cx + V.K * p[0], V.cy - V.K * p[1]); pen = true; } }
    }
    ctx.stroke();
  }

  const slerp = (a, b, N) => { const out = []; for (let i = 0; i <= N; i++) out.push(unit(a.map((x, k) => x * (1 - i / N) + b[k] * (i / N)))); return out; };

  function paintSphere(sys, V, res, f) {
    const { w, h, cx, cy, K } = V, R = state.view;
    const X = (p) => cx + K * p[0], Y = (p) => cy - K * p[1];
    // inside the light cone, in model coordinates (the cone's axis is the model's z-axis)
    const mz = (p) => R[0][2] * p[0] + R[1][2] * p[1] + R[2][2] * p[2];
    const inCone = (p) => { const z = mz(p); return z * z - 0.5; };
    ctx.clearRect(0, 0, w + 2, h + 2); // the canvas can be a fraction of a pixel larger than its box
    ctx.setLineDash([]);

    // the sphere
    ctx.beginPath();
    ctx.arc(cx, cy, K, 0, TAU);
    ctx.fillStyle = MM.color('surface');
    ctx.fill();
    ctx.save();
    ctx.clip();

    // the negative hemisphere, tinted
    const hv = V.hv, hl = Math.hypot(hv[0], hv[1]);
    ctx.fillStyle = MM.rgba('ink', 0.04);
    if (hl < 1e-6) { if (hv[2] < 0) ctx.fillRect(0, 0, w, h); } else {
      // everything beyond the near half of the dividing circle, on the side away from the handle
      const half = nearHalf(hv, 48), dx = -3 * hv[0] / hl, dy = -3 * hv[1] / hl, a = half[half.length - 1], b = half[0];
      ctx.beginPath();
      half.forEach((p, i) => { if (i) ctx.lineTo(X(p), Y(p)); else ctx.moveTo(X(p), Y(p)); });
      ctx.lineTo(X([a[0] + dx]), Y([0, a[1] + dy]));
      ctx.lineTo(X([b[0] + dx]), Y([0, b[1] + dy]));
      ctx.closePath();
      ctx.fill();
    }

    // the chamber of the handle: the triangle cut out by the mirrors of the simple roots
    let corners = null;
    if (res.ok && state.mirrors) {
      corners = RS.dualBasis(res.simple.map((c) => place(sys, c))).map((v) => mv(R, unit(v)));
      const edge = [].concat(slerp(corners[0], corners[1], 16), slerp(corners[1], corners[2], 16), slerp(corners[2], corners[0], 16));
      if (edge.some((p) => p[2] > 0)) {
        ctx.beginPath();
        edge.forEach((p, i) => { const l = p[2] >= 0 ? 1 : 1 / (Math.hypot(p[0], p[1]) || 1); if (i) ctx.lineTo(cx + K * p[0] * l, cy - K * p[1] * l); else ctx.moveTo(cx + K * p[0] * l, cy - K * p[1] * l); });
        ctx.closePath();
        ctx.fillStyle = MM.rgba('accent', 0.13);
        ctx.fill();
      }
    }

    // the null cone: two circles
    if (sys.sig === -1) {
      ctx.strokeStyle = MM.color('ink-3');
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      for (const sg of [1, -1]) {
        const pts = [];
        for (let i = 0; i <= 96; i++) { const t = TAU * i / 96; pts.push(mv(R, [Math.cos(t) * Math.SQRT1_2, Math.sin(t) * Math.SQRT1_2, sg * Math.SQRT1_2])); }
        strokePts(V, pts);
      }
      ctx.setLineDash([]);
    }

    // mirrors: great circles; in hyperbolic type only inside the light cone, where the chambers are
    const depth = DEPTH, clip = sys.family === 'hyperbolic' ? inCone : null;
    if (state.mirrors) {
      ctx.lineWidth = 1;
      for (const wl of sys.walls) {
        if (sys.infinite && wl.ht > depth) continue;
        const pts = nearHalf(mv(R, wl.u), clip ? 72 : 48);
        if (!pts) continue;
        ctx.strokeStyle = colorOf(wl.kind, wallAlpha(sys, wl));
        if (wl.kind === 'iso') ctx.setLineDash([4, 3]);
        strokePts(V, pts, clip);
        ctx.setLineDash([]);
      }
    }
    // the mirror of the selected root
    for (const [v, lw] of marked(sys)) {
      const pts = nearHalf(mv(R, v.u), 72);
      if (!pts) continue;
      ctx.strokeStyle = colorOf(v.kind);
      ctx.lineWidth = lw;
      if (v.kind === 'iso') ctx.setLineDash([5, 3]);
      strokePts(V, pts, clip);
      ctx.setLineDash([]);
    }
    // the walls of the chamber
    if (corners) {
      ctx.strokeStyle = MM.color('accent');
      ctx.lineWidth = 1.75;
      for (let i = 0; i < 3; i++) strokePts(V, slerp(corners[i], corners[(i + 1) % 3], 16));
    }

    // the dividing circle: the kernel of the handle's functional
    const div = nearHalf(hv, 64);
    if (div) { ctx.strokeStyle = MM.color('ink'); ctx.lineWidth = 1.25; strokePts(V, div); }
    ctx.restore();

    // the rim
    ctx.beginPath();
    ctx.arc(cx, cy, K, 0, TAU);
    ctx.strokeStyle = MM.color('rule');
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // the roots, where their rays meet the near side of the sphere
    const r0 = w < 420 ? 4.6 : 5.6, imDepth = IM_DEPTH, dht = sys.delta ? RS.height(sys.delta) : 0;
    const list = [], out = stretch(sys) > 1;
    for (const v of sys.roots) {
      const ht = Math.abs(v.ht);
      let r, a; // (a: paler for the deep imaginary roots of a hyperbolic system)
      if (sys.family === 'super') r = v.kind === 'odd' ? 0.7 : v.doubled ? 1.5 : 1;
      else if (v.kind === 'imag') {
        if (sys.family === 'affine' ? ht !== dht : !v.primitive || ht > imDepth) continue;
        r = sys.family === 'affine' ? 1.1 : Math.max(0.18, 1.1 / Math.pow(ht, 0.75));
        if (sys.family === 'hyperbolic') a = Math.max(0.3, 1 - 0.7 * (ht - 2) / (IM_DEPTH - 2));
      } else {
        if (sys.infinite && ht > depth) continue;
        r = (0.5 + 0.55 * v.norm / sys.maxNorm) * (sys.infinite ? Math.max(0.2, Math.min(1, 1.5 / (1 + ht / 5))) : 1);
      }
      const p = mv(R, v.u);
      // true lengths: a longer root stands out of the sphere, at the end of a stem
      const far = out ? Math.sqrt(v.norm / sys.realNorms[0]) : 1;
      if (far > 1 + 1e-9) {
        // behind the sphere it shows only where it clears the rim
        const from = p[2] >= 0 ? 1 : 1 / (Math.hypot(p[0], p[1]) || 1e-9);
        if (from >= far) continue;
        ctx.strokeStyle = colorOf(v.kind, 0.55);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(cx + K * from * p[0], cy - K * from * p[1]);
        ctx.lineTo(cx + K * far * p[0], cy - K * far * p[1]);
        ctx.stroke();
        list.push({ v, a, z: p[2] * far, px: cx + K * far * p[0], py: cy - K * far * p[1], r: r0 * r * (0.72 + 0.28 * p[2]) });
        continue;
      }
      if (p[2] < 0.02) continue;
      list.push({ v, a, z: p[2], px: X(p), py: Y(p), r: r0 * r * (0.72 + 0.28 * p[2]) });
    }
    // the larger first, so that the smaller stay in reach; standing out of the sphere, the nearer last
    list.sort(out ? (a, b) => a.z - b.z : (a, b) => b.r - a.r);
    shown = list;
    for (const p of list) dot2(p.px, p.py, p.r, colorOf(p.v.kind, p.a), f(p.v.c) > 1e-9);

    const simpleKeys = res.ok ? res.simple.map(RS.key) : [], originKeys = standard(sys).map(RS.key).filter((k) => !simpleKeys.includes(k));
    const picked = rings(null, simpleKeys, originKeys);
    for (const k of originKeys.concat(simpleKeys)) {
      const p = list.find((q) => RS.key(q.v.c) === k);
      if (p) tag(V, '$' + RS.rootTex(sys, p.v.c) + '$', p.px, p.py, p.r + 4, MM.color(simpleKeys.includes(k) ? 'ink' : 'ink-3'));
    }
    if (picked && !simpleKeys.includes(state.sel)) tag(V, '$' + RS.rootTex(sys, picked.v.c) + '$', picked.px, picked.py, picked.r + 5, MM.color('accent-ink'));
  }

  /* ---------- rank three, flat: the plane of an affine system, the disc of a hyperbolic one ---------- */

  // The plane of an affine system in a frame fixed by its standard alcove:
  // the centroid at the origin, the longest side horizontal and of length 1,
  // running from its sharper corner to its blunter one, the third corner
  // above. Systems with similar alcoves, such as G2(1) and D4(3), then have
  // the same picture, and every mirror runs at a multiple of 30° or of 45°.
  function planeFrame(sys) {
    if (sys.plane) return sys.plane;
    const dz = place(sys, sys.delta)[2], q = RS.dualBasis(sys.E).map((r) => [r[0] / (r[2] * dz), r[1] / (r[2] * dz)]);
    const sub = (u, v) => [u[0] - v[0], u[1] - v[1]], len = (u) => Math.hypot(u[0], u[1]);
    const angle = [0, 1, 2].map((i) => { const u = sub(q[(i + 1) % 3], q[i]), v = sub(q[(i + 2) % 3], q[i]); return Math.acos((u[0] * v[0] + u[1] * v[1]) / (len(u) * len(v))); });
    const side = [0, 1, 2].map((i) => len(sub(q[(i + 1) % 3], q[(i + 2) % 3]))); // side i is opposite corner i
    let top = 0;
    for (let i = 1; i < 3; i++) if (side[i] > side[top] + 1e-9) top = i;
    let [a, b] = [0, 1, 2].filter((i) => i !== top);
    if (angle[b] < angle[a] - 1e-9) [a, b] = [b, a];
    const c0 = [(q[0][0] + q[1][0] + q[2][0]) / 3, (q[0][1] + q[1][1] + q[2][1]) / 3];
    const u = sub(q[b], q[a]), e1 = [u[0] / len(u), u[1] / len(u)];
    let e2 = [-e1[1], e1[0]];
    const up = sub(q[top], c0);
    if (up[0] * e2[0] + up[1] * e2[1] < 0) e2 = [-e2[0], -e2[1]];
    sys.plane = { dz, c0, e1, e2, D: side[top] };
    // where the handle starts: inside the alcove, off its centre
    const wt = [0, 0, 0];
    wt[a] = 0.3; wt[b] = 0.38; wt[top] = 0.32;
    const st = [0, 1].map((k) => wt[0] * q[0][k] + wt[1] * q[1][k] + wt[2] * q[2][k]);
    sys.plane.start = unit([dz * st[0], dz * st[1], 1]);
    return sys.plane;
  }
  const toPlane = (F, n) => { const x = n[0] / (n[2] * F.dz) - F.c0[0], y = n[1] / (n[2] * F.dz) - F.c0[1]; return [(F.e1[0] * x + F.e1[1] * y) / F.D, (F.e2[0] * x + F.e2[1] * y) / F.D]; };
  const fromPlane = (F, k) => unit([F.dz * (F.c0[0] + F.D * (k[0] * F.e1[0] + k[1] * F.e2[0])), F.dz * (F.c0[1] + F.D * (k[0] * F.e1[1] + k[1] * F.e2[1])), 1]);

  // The Weyl group of a hyperbolic system of rank 3, acting on the disc (hyperbolic.js).
  const weyl = (sys) => sys.weyl || (sys.weyl = HY.group(sys.cartan, sys.E));
  // A reduced word for w⁻¹, w the element of a frame: the chamber w⁻¹(C) that it takes to the
  // standard one, C. The functional c ↦ ht(w(c)) is positive on that chamber, and exact.
  function frameWord(sys, F) {
    if (!F || F.word) return F ? F.word : [];
    const res = RS.positive(sys, [0, 0, 1], { f: (c) => RS.height(HY.imv(F.M, c)) });
    return (F.word = res.ok ? res.word : []);
  }
  // The handle of a hyperbolic system in the disc, exactly: a functional x in the standard
  // chamber (or on its walls) in a frame F that takes it where the handle is; f(c) its value on
  // a root c of the model, res its chamber. Worked out from state.n when that has changed by
  // other means; the disc places it exactly (placeHandle), and keeps state.n for the rest.
  function located(sys) {
    if (sys.family !== 'hyperbolic' || sys.rank !== 3) return null;
    const n = state.n;
    if (state.loc && state.loc.n === n && state.loc.id === currentId()) return state.loc;
    state.loc = null;
    if (!(n[2] > 0 && Math.hypot(n[0], n[1]) < n[2])) return null; // outside the cone: only on the sphere
    const W = weyl(sys), { x, steps } = W.walk(n);
    let F = W.origin;
    for (const i of steps) F = W.step(F, i);
    return (state.loc = locate(sys, n, F, x));
  }
  function locate(sys, n, F, x) {
    const f = weyl(sys).exact(F, x);
    return { n, id: currentId(), F, x, f, res: RS.positive(sys, x, { f }) };
  }
  // the handle to the point (x, y) of the disc V
  function placeHandle(sys, V, x, y) {
    const W = V.W, { x: xl, steps } = W.walk(V.fromR(x, y));
    let F = V.F;
    for (const i of steps) F = W.step(F, i);
    if (W.size(F) > FAR) return;
    state.n = unit(W.out(F, xl));
    state.loc = locate(sys, state.n, F, xl);
  }
  // the handle's functional and its chamber
  function handleAt(sys) {
    const loc = located(sys);
    return loc ? { f: loc.f, res: loc.res } : { f: RS.functional(sys, state.n), res: RS.positive(sys, state.n) };
  }

  // A functional is a vector n of the model, as on the sphere. Affine type:
  // those with n · δ = 1 form a plane, with the metric dual to the form, and n
  // is drawn at its first two coordinates. Hyperbolic type: those inside the
  // upper light cone form, up to scale, a hyperbolic plane, drawn as the
  // Poincaré disc: the functionals of the frame state.at (an element w of the
  // Weyl group, exactly) through the Lorentz map state.boost, which recentre()
  // keeps small. Roots are taken to the frame first, c ↦ w(c) in integers, so
  // that what is drawn is near the standard chamber, however far it is in the model.
  // V.mirror(c), V.rays(base) take roots of the model; the …R ones roots of the frame.
  function viewFlat(sys) {
    const w = canvas.clientWidth, h = canvas.clientHeight, cx = w / 2, cy = h / 2, disc = sys.family === 'hyperbolic';
    const V = { w, h, cx, cy, disc, flat: true };
    if (disc) {
      const K = V.K = Math.min(w, h) / 2 - 12, L = state.boost, Li = HY.inv(L), W = V.W = weyl(sys), F = V.F = state.at || W.origin;
      const px = (m) => { const q = HY.disc(m); return [cx + K * q[0], cy - K * q[1]]; };
      V.down = (c) => HY.imv(F.M, c);
      V.up = (c) => HY.imv(F.Mi, c);
      // a functional of the frame, and the one under a point of the canvas
      V.toR = (x) => px(mv(L, x));
      V.fromR = (x, y) => {
        let a = (x - cx) / K, b = (cy - y) / K;
        const r = Math.hypot(a, b);
        if (r > RIM) { a *= RIM / r; b *= RIM / r; }
        return unit(mv(Li, lift([a, b])));
      };
      // the same for functionals of the model, as far as floating point takes them
      V.to = (n) => V.toR(W.into(F, n));
      V.from = (x, y) => unit(W.out(F, V.fromR(x, y)));
      // The corners of the chamber with base β_1, β_2, β_3, as rays in the frame
      // of the view: corner k lies on the mirrors of the other two roots.
      V.raysR = (base) => {
        const m = base.map((c) => unit(flipZ(mv(L, flipZ(place(sys, c))))));
        return [0, 1, 2].map((k) => {
          const v = cross(m[(k + 1) % 3], m[(k + 2) % 3]);
          return v[0] * m[k][0] + v[1] * m[k][1] + v[2] * m[k][2] < 0 ? v.map((x) => -x) : v;
        });
      };
      V.rays = (base) => V.raysR(base.map(V.down));
      V.point = px;
      // a line of the hyperbolic plane is straight in the Klein model
      V.edge = (a, b) => {
        const N = 20, pts = [];
        for (let i = 0; i <= N; i++) { const t = i / N; pts.push(px([0, 1, 2].map((k) => (1 - t) * a[k] / a[2] + t * b[k] / b[2]))); }
        return pts;
      };
      // the mirror of a root: a circle orthogonal to the rim, with its centre at the pole of the
      // line, or a line where that circle is within a thousandth of a pixel of one
      V.mirrorR = (c) => {
        const g = HY.geodesic(mv(L, flipZ(place(sys, c))), 1e8 / K);
        return g.r === undefined ? { x: cx + K * g.x, y: cy - K * g.y, ux: g.ux, uy: -g.uy } : { x: cx + K * g.x, y: cy - K * g.y, r: K * g.r };
      };
      V.mirror = (c) => V.mirrorR(V.down(c));
    } else {
      const F = planeFrame(sys), pan = state.pan, s = V.s = Math.min(w, h) / 2 / state.span;
      V.K = Math.min(w, h) / 2;
      V.to = (n) => { const k = toPlane(F, n); return [cx + s * (k[0] - pan[0]), cy - s * (k[1] - pan[1])]; };
      V.from = (x, y) => fromPlane(F, [(Math.max(8, Math.min(w - 8, x)) - cx) / s + pan[0], (cy - Math.max(8, Math.min(h - 8, y))) / s + pan[1]]);
      V.rays = (base) => RS.dualBasis(base.map((c) => place(sys, c)));
      V.point = V.to;
      V.edge = (u, v) => { const a = V.to(u), b = V.to(v); return [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b]; };
      // the mirror of a root, at p = (a, z): the functionals with dz q · a + z = 0, a line in the frame's coordinates
      V.mirror = (c) => {
        const p = place(sys, c), b = [F.e1[0] * p[0] + F.e1[1] * p[1], F.e2[0] * p[0] + F.e2[1] * p[1]], l2 = b[0] * b[0] + b[1] * b[1], l = Math.sqrt(l2);
        const t = -(p[2] + F.dz * (F.c0[0] * p[0] + F.c0[1] * p[1])) / (F.dz * F.D * l2);
        return { x: cx + s * (t * b[0] - pan[0]), y: cy - s * (t * b[1] - pan[1]), ux: -b[1] / l, uy: -b[0] / l };
      };
    }
    // the handle; in the plane it can be out of the window, and is then shown at the edge
    const loc = disc && located(sys), at = loc ? V.toR(V.W.between(loc.F, V.F, loc.x)) : V.to(state.n);
    V.hx = Math.max(10, Math.min(w - 10, at[0]));
    V.hy = Math.max(10, Math.min(h - 10, at[1]));
    V.back = V.hx !== at[0] || V.hy !== at[1];
    return V;
  }

  // hyperbolic type: the imaginary roots of the standard chamber that are drawn in every chamber
  const antidominant = (sys) => sys.anti || (sys.anti = RS.antidominant(sys, IM_LOCAL));
  // How far the middle of the disc is from the cusps: the least value, on the
  // null roots at the ideal corners of its chamber, of the functional in the
  // middle (taken with Lorentz length 1), in the frame of the view. Going down a
  // cusp it falls to 0 like e^(−distance), and the chambers there thin out into
  // slivers that look the same wherever one moves, their mirrors a dense fan, so
  // the view is not let in further than CUSP (for (2,3,∞) it is 0.59 at the start).
  const CUSP = 0.2;
  function cuspRoom(sys, boost) {
    const corners = antidominant(sys).filter((a) => Math.abs(RS.quad(sys.gram)(a, a)) < 1e-9);
    if (!corners.length) return Infinity;
    const n0 = mv(HY.inv(boost), [0, 0, 1]), res = RS.positive(sys, unit(n0));
    if (!res.ok) return Infinity;
    return Math.min(...corners.map((a) => { const p = place(sys, [0, 1, 2].map((k) => a[0] * res.simple[0][k] + a[1] * res.simple[1][k] + a[2] * res.simple[2][k])); return n0[0] * p[0] + n0[1] * p[1] + n0[2] * p[2]; }));
  }

  // The chambers in view, found by crossing walls from the one in the middle,
  // with their mirrors and, in the disc, the imaginary roots: in each chamber
  // w(C) the roots w(α), α in the standard chamber, placed at −(wα, ·).
  let tess = null;
  function tessellation(sys, V) {
    const id = [currentId(), V.w, V.h, V.disc ? state.boost.map((r) => r.join()).join() + ';' + V.F.M.map((r) => r.join()).join() : state.pan.join() + ';' + state.span].join('|');
    if (tess && tess.id === id) return tess;
    // in the disc, the chambers are found in the frame of the view, near the standard one, and
    // their roots taken back to the model (V.up) to be named
    const shapes = new Map(), rays = V.disc ? V.raysR : V.rays, up = V.disc ? V.up : (c) => c;
    const keep = (base) => {
      const pts = rays(base).map(V.point);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      shapes.set(base, { pts, size });
      // the disc: down to a few pixels; the plane: whatever meets the window
      return V.disc ? size >= 5 : Math.max(...xs) > -2 && Math.min(...xs) < V.w + 2 && Math.max(...ys) > -2 && Math.min(...ys) < V.h + 2;
    };
    // from the chamber in the middle of the view or, if the middle is on a mirror, beside it
    let list = null;
    for (let t = 0; t < 6 && !list; t++) list = RS.chambers(sys, (V.disc ? V.fromR : V.from)(V.cx + 0.37 * t, V.cy + 0.21 * t), keep, 6000);
    list = list || [];
    const mirrors = new Map(), dots = [];
    for (const base of list) {
      for (const b of base) {
        const o = up(b), c = o.find((x) => x) > 0 ? o : o.map((x) => -x), k = RS.key(c);
        if (!mirrors.has(k)) mirrors.set(k, { c, b, g: V.disc ? V.mirrorR(b) : V.mirror(c) });
      }
    }
    if (V.disc) {
      sys.anti = antidominant(sys);
      const seen = new Set(), r0 = V.w < 420 ? 4.4 : 5.2;
      for (const base of list) {
        const size = shapes.get(base).size;
        if (size < 16) continue;
        for (const a of sys.anti) {
          const cf = [0, 1, 2].map((k) => a[0] * base[0][k] + a[1] * base[1][k] + a[2] * base[2][k]), c = up(cf), ck = RS.key(c);
          if (seen.has(ck)) continue;
          const p = place(sys, cf), q = V.toR([-p[0], -p[1], p[2]]);
          // as large as its place in the hyperbolic plane allows; a null root, on the rim, by the size of its chamber
          const room = 1 - ((q[0] - V.cx) ** 2 + (q[1] - V.cy) ** 2) / (V.K * V.K);
          const r = r0 * Math.max(0.3, 0.95 / Math.sqrt(RS.height(a))) * (room < 1e-6 ? 1.6 * Math.min(1, size / V.K) : 1.25 * room);
          if (r < 0.75) continue;
          seen.add(ck);
          // paler the higher it is in its chamber, as the deep ones are on the sphere
          const al = Math.max(0.3, 1 - 0.7 * (RS.height(a) - 2) / (IM_LOCAL - 2));
          dots.push({ v: record(sys, c, 'imag', a, cf), px: q[0], py: q[1], r: Math.min(r, r0), a: al });
        }
      }
      dots.sort((a, b) => b.r - a.r);
    }
    tess = { id, mirrors, dots, first: list.length ? shapes.get(list[0]) : null };
    return tess;
  }

  // An arc of the circle g (centre x, y, radius r, in pixels) from angle a through angle d, in the
  // disc: as the canvas draws it for a circle smaller than the disc, else as a polyline within a
  // tenth of a pixel of it (Hyperbolic.arc: canvases draw a large circle pixels off its place).
  function arcTo(V, g, a, d) {
    if (g.r < V.K) { ctx.arc(g.x, g.y, g.r, a, a + d, d < 0); return; }
    for (const q of HY.arc(g, a, d, 0.1)) ctx.lineTo(q[0], q[1]);
  }
  // The outline of a chamber with base β_1, β_2, β_3, given its walls as polylines from corner to
  // corner. In the disc each wall is an arc of the mirror of its root, a circle orthogonal to the
  // rim (or, through the middle, a straight line), and is traced as one, exactly: a polyline leaves
  // it near a cusp, where the corner is on the rim.
  function pathChamber(V, sys, base, walls) {
    walls.forEach((e, i) => {
      const a = e[0], b = e[e.length - 1];
      if (!i) ctx.moveTo(a[0], a[1]);
      if (!V.disc) { e.forEach((q, j) => { if (j) ctx.lineTo(q[0], q[1]); }); return; }
      const g = V.mirror(base[i]);
      if (g.r === undefined) { ctx.lineTo(b[0], b[1]); return; }
      // the arc inside the disc is less than half the circle: the shorter way round
      const a0 = Math.atan2(a[1] - g.y, a[0] - g.x);
      let d = Math.atan2(b[1] - g.y, b[0] - g.x) - a0;
      d -= TAU * Math.round(d / TAU);
      arcTo(V, g, a0, d);
    });
    ctx.closePath();
  }
  function pathMirror(V, g) {
    if (g.r !== undefined && g.r < V.K) { ctx.moveTo(g.x + g.r, g.y); ctx.arc(g.x, g.y, g.r, 0, TAU); return; }
    if (g.r !== undefined) {
      // a large circle: its arc in the disc, and a few pixels more, for the clip to cut
      const { a, d } = HY.within(g, V.cx, V.cy, V.K, 4 / g.r);
      ctx.moveTo(g.x + g.r * Math.cos(a), g.y + g.r * Math.sin(a));
      arcTo(V, g, a, d);
      return;
    }
    const S = 4 * (V.w + V.h);
    ctx.moveTo(g.x - S * g.ux, g.y - S * g.uy);
    ctx.lineTo(g.x + S * g.ux, g.y + S * g.uy);
  }
  // the point of a mirror nearest to (x, y), and its distance
  function nearMirror(g, x, y) {
    if (g.r !== undefined) {
      const d = Math.hypot(x - g.x, y - g.y) || 1;
      return { x: g.x + (x - g.x) * g.r / d, y: g.y + (y - g.y) * g.r / d, d: Math.abs(d - g.r) };
    }
    const t = (x - g.x) * g.ux + (y - g.y) * g.uy, fx = g.x + t * g.ux, fy = g.y + t * g.uy;
    return { x: fx, y: fy, d: Math.hypot(x - fx, y - fy) };
  }

  // The names of three roots, each beside the middle of its wall, outside the
  // chamber, when the chamber is large enough to hold them apart.
  // `taken` lists the boxes of names already there; a name that would cover one is left out.
  function wallNames(sys, V, walls, roots, color, taken) {
    const mids = walls.map((e) => e[e.length >> 1]), mx = (mids[0][0] + mids[1][0] + mids[2][0]) / 3, my = (mids[0][1] + mids[1][1] + mids[2][1]) / 3, boxes = [];
    if (Math.max(...mids.map((q) => Math.hypot(q[0] - mx, q[1] - my))) <= 20) return boxes;
    roots.forEach((c, i) => {
      const q = mids[i], d = Math.hypot(q[0] - mx, q[1] - my) || 1, ux = (q[0] - mx) / d, uy = (q[1] - my) / d;
      if (q[0] < 0 || q[0] > V.w || q[1] < 0 || q[1] > V.h) return;
      const text = '$' + RS.rootTex(sys, c) + '$', sz = V.w < 420 ? 12.5 : 13.5, tw = MM.measureLabel(ctx, text, sz), off = 8 + Math.abs(ux) * tw / 2 + Math.abs(uy) * sz * 0.65;
      const b = { x: q[0] + ux * off, y: q[1] + uy * off, w: tw + 10, h: sz * 1.3 + 6 };
      if ((taken || []).some((t) => Math.abs(t.x - b.x) < (t.w + b.w) / 2 && Math.abs(t.y - b.y) < (t.h + b.h) / 2)) return;
      boxes.push(b);
      plate(V, text, b.x, b.y, color, true); // outside the chamber, so clear of the handle inside it
    });
    return boxes;
  }

  function paintFlat(sys, V, res) {
    const { w, h, cx, cy, K } = V, T = tessellation(sys, V);
    ctx.clearRect(0, 0, w + 2, h + 2); // the canvas can be a fraction of a pixel larger than its box
    ctx.setLineDash([]);
    ctx.save();
    ctx.beginPath();
    if (V.disc) { ctx.arc(cx, cy, K, 0, TAU); ctx.fillStyle = MM.color('surface'); ctx.fill(); } else ctx.rect(0, 0, w, h);
    ctx.clip();

    // the chamber of the handle; wall i, the mirror of the simple root i, joins the two corners on it
    let walls = null;
    if (res.ok) {
      const rays = V.rays(res.simple);
      walls = [0, 1, 2].map((i) => V.edge(rays[(i + 1) % 3], rays[(i + 2) % 3]));
      ctx.beginPath();
      pathChamber(V, sys, res.simple, walls);
      ctx.fillStyle = MM.rgba('accent', 0.14);
      ctx.fill();
    }

    // the mirrors; in the disc the small circles near the rim are drawn fainter
    const groups = [[], [], []];
    T.mirrors.forEach((m) => groups[!V.disc || m.g.r === undefined || m.g.r >= 0.5 * K ? 0 : m.g.r >= 0.1 * K ? 1 : 2].push(m.g));
    ctx.lineWidth = 1;
    [0.5, 0.38, 0.24].forEach((a, i) => {
      if (!groups[i].length) return;
      ctx.strokeStyle = colorOf('real', a);
      ctx.beginPath();
      groups[i].forEach((g) => pathMirror(V, g));
      ctx.stroke();
    });
    // the mirror of the selected root
    const picks = marked(sys).map(([v, lw]) => ({ v, lw, g: V.mirror(v.c) }));
    for (const m of picks) {
      ctx.strokeStyle = colorOf('real');
      ctx.lineWidth = m.lw;
      ctx.beginPath();
      pathMirror(V, m.g);
      ctx.stroke();
    }
    // the standard chamber, in grey, when the handle is in another one
    let home = null;
    if (!res.ok || res.simple.map(RS.key).join('|') !== standard(sys).map(RS.key).join('|')) {
      const rays = V.rays(standard(sys));
      home = [0, 1, 2].map((i) => V.edge(rays[(i + 1) % 3], rays[(i + 2) % 3]));
    }
    ctx.lineJoin = 'round';
    for (const [edges, base, color, lw] of [[home, standard(sys), MM.color('ink-3'), 1.25], [walls, walls && res.simple, MM.color('accent'), 1.75]]) {
      if (!edges) continue;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pathChamber(V, sys, base, edges);
      ctx.stroke();
    }
    ctx.restore();

    // the plane runs on past the window: a frame says so
    if (!V.disc) {
      ctx.beginPath();
      ctx.roundRect(0.5, 0.5, w - 1, h - 1, 6);
      ctx.strokeStyle = MM.color('rule');
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // the rim of the disc: the null cone, at infinity
    if (V.disc) {
      ctx.beginPath();
      ctx.arc(cx, cy, K, 0, TAU);
      ctx.strokeStyle = MM.color('ink-3');
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // the imaginary roots: points of the hyperbolic plane
    shown = T.dots;
    for (const d of shown) dot2(d.px, d.py, d.r, colorOf('imag', d.a), true);
    const picked = rings(null);

    // the simple roots, each beside its wall; in grey, α_1, α_2, α_3 beside the walls of the standard chamber
    const named = walls ? wallNames(sys, V, walls, res.simple, MM.color('ink')) : [];
    if (home) wallNames(sys, V, home, standard(sys), MM.color('ink-3'), named);
    // the name of the selected root: by its dot, or on its mirror where that comes nearest the middle
    const simpleKeys = res.ok ? res.simple.map(RS.key) : [];
    if (picked) tag(V, '$' + RS.rootTex(sys, picked.v.c) + '$', picked.px, picked.py, picked.r + 5, MM.color('accent-ink'));
    for (const m of picks) {
      if (RS.key(m.v.c) !== state.sel || simpleKeys.includes(state.sel)) continue;
      const q = nearMirror(m.g, cx, cy);
      if (V.disc && Math.hypot(q.x - cx, q.y - cy) > K) continue;
      tag(V, '$' + RS.rootTex(sys, m.v.c) + '$', q.x, q.y, 4, MM.color('accent-ink'));
    }
  }

  /* ---------- readouts ---------- */

  const upToSign = (sys, kind) => sys.roots.filter((v) => v.kind === kind && (v.ambient.find((x) => x) > 0))
    .map((v) => '$\\pm(' + RS.rootTex(sys, v.c) + ')$').join(', ').replace(/\\pm\(([^()+-]+)\)/g, '\\pm $1');
  const order = (a) => ['2', '3', '4', '6'][a] || '\\infty';

  function about(sys, id) {
    const rows = [], def = defOf(id), three = sys.rank === 3, flat = isFlat(sys), cite = ' [@kac1990, Proposition 5.10]';
    let title;
    if (sys.family === 'super') {
      title = '$' + sys.name + '$';
      const model = sys.sig > 0 ? ': negative definite, drawn as $-(x^2+y^2)$.'
        : '. On the span of the roots it has signature $' + (sys.sign > 0 ? '(' + (sys.rank - 1) + ',1)' : '(1,' + (sys.rank - 1) + ')') + '$, drawn as $'
          + (sys.sign > 0 ? '' : '-(') + (three ? 'x^2+y^2-z^2' : 'x^2-y^2') + (sys.sign > 0 ? '' : ')') + '$.';
      rows.push(['Form', def.form + model]);
      rows.push(['Even roots', upToSign(sys, 'even') + ', the roots of $' + def.even + '$']);
      const iso = upToSign(sys, 'iso'), odd = upToSign(sys, 'odd');
      rows.push(['Odd roots', [iso && iso + ' (isotropic)', odd && odd + ' (not isotropic)'].filter(Boolean).join('; ')]);
      if (iso) rows.push(['Mirrors', 'Crossing a dashed one, the mirror of an isotropic root, is an <a href="#sec-super">odd reflection</a>: the diagram changes.']);
    } else {
      const A = sys.cartan, norms = '$(\\alpha,\\alpha)=' + sys.realNorms.join(',\\,') + '$';
      const tri = three ? [A[0][1] * A[1][0], A[0][2] * A[2][0], A[1][2] * A[2][1]].map(order).sort().join(',') : '';
      title = def.tex ? '$' + def.tex + '$' : three ? '$(' + tri + ')$' : '$a=' + -A[0][1] + ',\\ b=' + -A[1][0] + '$';
      rows.push(['Cartan matrix', '<span class="rs-cartan"></span>']); // (filled by MM.matrix, below)
      if (sys.family === 'finite') {
        rows.push(['Form', 'Positive definite, drawn as $' + (three ? 'x^2+y^2+z^2' : 'x^2+y^2') + '$.']);
        rows.push(['Roots', '$' + sys.roots.length + '$, all real, ' + (three ? 'with ' : 'on the circle' + (sys.realNorms.length > 1 ? 's ' : ' ')) + norms + '.']);
      } else if (sys.family === 'affine') {
        const delta = '$\\delta=' + RS.linear(sys.delta, sys.names) + '$';
        rows.push(['Form', flat ? 'Positive semidefinite, with radical spanned by ' + delta + '. The plane is the set of functionals $f$ with $f(\\delta)=1$.'
          : three ? 'Positive semidefinite, drawn as $x^2+y^2$. Its radical is spanned by ' + delta + ', the axis of the sphere.'
          : 'Positive semidefinite, drawn as $x^2$. Its radical is spanned by ' + delta + ', drawn vertical.']);
        if (three) rows.push(['Real roots', 'A root of the finite part plus a multiple of $\\delta$, with ' + norms + '. ' + (flat ? 'Each is drawn as its mirror.' : 'Their rays close in on $\\pm\\delta$.')]);
        else {
          const fin = sys.names[1 - sys.affineNode];
          rows.push(['Real roots', (sys.realNorms.length > 1 ? '$\\pm' + fin + '+n\\delta$ and $\\pm2' + fin + '+(2n+1)\\delta$' : '$\\pm' + fin + '+n\\delta$') + ', on the lines ' + norms + '.']);
        }
        const ms = sys.roots.filter((v) => v.kind === 'imag' && v.ht > 0).sort((u, v) => u.ht - v.ht).map((v) => String(v.mult));
        rows.push(['Imaginary roots', '$n\\delta$ for $n\\ne0$, ' + (new Set(ms).size === 1 ? 'each of multiplicity $' + ms[0] + '$.' : 'of multiplicity $' + ms.slice(0, 6).join(',') + ',\\dots$ for $n=1,2,3,\\dots$')]);
      } else {
        rows.push(['Form', flat ? 'Signature $(2,1)$. The disc is the hyperbolic plane of functionals inside the null cone, up to scale.' : three ? 'Signature $(2,1)$, drawn as $x^2+y^2-z^2$.' : 'Signature $(1,1)$, drawn as $x^2-y^2$, with the null lines at $45^\\circ$.']);
        if (three) rows.push(['Weyl group', 'The triangle group $(' + tri + ')$: the mirrors cut ' + (flat ? 'the disc' : 'each cap of the sphere') + ' into triangles with angles $\\pi/m$.']);
        rows.push(['Real roots', flat ? 'Infinitely many, with ' + norms + '. Each is drawn as its mirror.' : three ? 'Infinitely many, with ' + norms + '. Their rays lie between the null circles and close in on them.'
          : 'On the hyperbola' + (sys.realNorms.length > 1 ? 's ' : ' ') + norms + ', infinitely many.']);
        const imag = 'Every lattice point with $(\\alpha,\\alpha)\\le0$ except the origin' + cite + '. ';
        rows.push(['Imaginary roots', imag + (flat ? 'The ray of $\\beta$ is drawn at the functional $-(\\beta,\\cdot\\,)$, a point of the disc, and every triangle carries the same pattern.'
          : three ? 'Their rays are dense in the two caps.' : 'The dots grow with the multiplicity.')]);
      }
    }
    MM.setHTML($('about-h'), title + ' <span class="side-kind">' + FAMILY[sys.family] + '</span>');
    if (MM.kv($('about'), rows) && sys.cartan) {
      const A = sys.cartan;
      MM.matrix($('about').querySelector('.rs-cartan'), A, 'The Cartan matrix, row by row: ' + A.map((r) => r.join(', ').replace(/-/g, '−')).join('; '));
    }
  }
  // what depends on how the system is drawn: the name of the figure, the controls under it, the legend
  function chrome(sys, id) {
    const def = defOf(id), three = sys.rank === 3, flat = isFlat(sys), disc = flat && sys.family === 'hyperbolic';
    const what = def.plain || (three ? 'the hyperbolic system with triangle group (' + tri3(sys) + ')' : 'the hyperbolic system with a = ' + -sys.cartan[0][1] + ', b = ' + -sys.cartan[1][0]);
    canvas.setAttribute('aria-label', disc
      ? 'The mirrors of the real roots of ' + what + ' in the hyperbolic plane, drawn as a disc: they cut it into triangles, and the imaginary roots are points of it. The triangle of the handle is shaded. Drag to move the plane, or use the arrow keys.'
      : flat ? 'The mirrors of the real roots of ' + what + ' in the plane of functionals with value 1 on delta: they cut it into alcoves. The alcove of the handle is shaded. Drag to move the plane, or use the arrow keys.'
        : three ? 'The roots of ' + what + ' on the sphere of directions, with their mirrors, and a great circle that separates the positive roots from the negative ones. Drag to turn the sphere, or use the arrow keys.'
          : 'The roots of ' + what + ', drawn in the plane, with their mirrors and a line through the origin that separates the positive roots from the negative ones.');
    $('mirrors').hidden = flat;
    $('recentre').hidden = !flat;
    $('lengths').hidden = !(three && sys.family === 'finite' && sys.realNorms.length > 1);
    for (const fam of ['affine', 'hyperbolic']) {
      const seg = $('view-' + fam);
      seg.closest('.control').hidden = !(three && sys.family === fam);
      if (seg.value !== (state.flat ? 'flat' : 'sphere')) seg.value = state.flat ? 'flat' : 'sphere';
    }
    about(sys, id);
    legend(sys);
  }
  function tri3(sys) { const A = sys.cartan; return [A[0][1] * A[1][0], A[0][2] * A[2][0], A[1][2] * A[2][1]].map((a) => ['2', '3', '4', '6'][a] || '∞').sort().join(', '); }

  function legend(sys) {
    const three = sys.rank === 3, kinds = Array.from(new Set(sys.roots.map((v) => v.kind)));
    const mark = (cls, c, text) => '<span class="legend-item"><span class="dot' + cls + '" style="--c: var(--' + c + ')"></span>' + text + '</span>';
    const line = (dash, text, cls) => '<span class="legend-item"><svg class="legend-line' + (cls || '') + '" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5H21"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/></svg>' + text + '</span>';
    if (isFlat(sys)) {
      const disc = sys.family === 'hyperbolic';
      MM.setHTML($('legend'), line(false, 'mirror of a real root', ' mirror') + (disc ? mark('', KIND.imag[0], 'imaginary root') + line(true, 'the null cone, at infinity') : '')
        + '<span class="legend-item"><span class="swatch c1"></span>' + (disc ? 'chamber' : 'alcove') + ' of the handle, with the simple roots on its walls</span>'
        + '<span class="legend-item"><span class="swatch"></span>the standard ' + (disc ? 'chamber' : 'alcove') + ', with walls $\\alpha_1,\\alpha_2,\\alpha_3$</span>');
      MM.setHTML($('hint'), 'Drag the yellow handle, or the ' + (disc ? 'disc' : 'plane') + ' itself. Click a mirror for its root.');
      return;
    }
    let html = ['real', 'even', 'imag', 'iso', 'odd'].filter((k) => kinds.includes(k)).map((k) => mark('', KIND[k][0], sys.family === 'finite' ? 'root' : KIND[k][1])).join('');
    html += mark('', 'ink-3', 'positive') + mark(' hollow', 'ink-3', 'negative');
    const arrowMark = (cls) => '<svg class="legend-line' + cls + '" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5H20M15 1.5 20 5 15 8.5"/></svg>';
    html += three ? '<span class="legend-item"><span class="dot ringed"></span>simple root</span>' : '<span class="legend-item">' + arrowMark('') + 'simple root</span>';
    if (sys.family !== 'super') html += three ? '<span class="legend-item"><span class="dot ringed faint"></span>$\\alpha_1,\\alpha_2,\\alpha_3$</span>' : '<span class="legend-item">' + arrowMark(' faint') + '$\\alpha_1,\\alpha_2$</span>';
    if (sys.sig === 0 && !three) html += line(true, 'the null line $\\RR\\delta$');
    if (sys.sig < 0) html += line(true, three ? 'the null cone $(\\alpha,\\alpha)=0$' : 'the null lines $(\\alpha,\\alpha)=0$');
    if (state.mirrors) {
      html += line(false, kinds.includes('iso') ? 'mirror of an even root' : 'mirror of a root', ' mirror');
      if (kinds.includes('iso')) html += line(true, 'mirror of an isotropic root', ' mirror iso');
      html += '<span class="legend-item"><span class="swatch c1"></span>chamber of the handle</span>';
    }
    MM.setHTML($('legend'), html);
    MM.setHTML($('hint'), three ? 'Drag the yellow handle, or the sphere to turn it.' + (stretch(sys) > 1 ? ' The longer roots stand out of the sphere, at their true length.' : '') : 'Drag the yellow handle, or click a root.');
  }

  /* the Dynkin diagram of the simple roots, each node with its root */
  const NODE = { o: 'even', x: 'odd isotropic', b: 'odd, not isotropic' };
  function dynkin(sys, res) {
    const box = $('dynkin'), el = MM.svg;
    if (!res.ok) { if (MM.setHTML(box, '')) box._key = ''; return; }
    const d = RS.diagram(sys, res.simple), names = res.simple.map((c) => '$' + RS.rootTex(sys, c) + '$');
    const k = JSON.stringify([d, names]);
    if (box._key === k) return;
    box._key = k;
    box.textContent = '';
    const n = d.nodes.length, svg = el('svg', { role: 'img' }, box);
    const bondName = (b) => (b.heavy ? 'a bond labelled ' + b.label : ['a single', 'a double', 'a triple', 'a quadruple'][b.lines - 1] + ' bond' + (b.label ? ' labelled ' + b.label : ''))
      + (b.arrow === 3 ? ' with arrows both ways' : b.arrow ? ' with an arrow to node ' + (b.arrow === 1 ? b.i + 1 : b.j + 1) : '');
    svg.setAttribute('aria-label', 'Dynkin diagram with ' + n + ' nodes: ' + d.nodes.map((t, i) => 'node ' + (i + 1) + ' ' + NODE[t]).join(', ')
      + (d.bonds.length ? '; ' + d.bonds.map((b) => 'nodes ' + (b.i + 1) + ' and ' + (b.j + 1) + ' joined by ' + bondName(b)).join(', ') : '; no bonds'));
    // labels first, to measure them
    const texts = names.map((t) => { const e = el('text', { class: 'dk-name' }, svg); MM.svgLabel(e, t); return e; });
    // the box, not the text length: the label spaces its operators with offsets, which the length leaves out
    const widths = texts.map((t) => { try { return t.getBBox().width; } catch (e) { return 60; } });
    const r = 7, triangle = n === 3 && d.bonds.length === 3;
    // a path: put a node joined to both others in the middle
    let seq = d.nodes.map((_, i) => i);
    if (n === 3 && !triangle) {
      const deg = seq.map((i) => d.bonds.filter((b) => b.i === i || b.j === i).length), mid = deg.indexOf(2);
      if (mid >= 0 && mid !== 1) seq = [seq.find((i) => i !== mid), mid, seq.filter((i) => i !== mid)[1]];
    }
    const pos = [];
    let W, Hh;
    if (triangle) {
      const gap = Math.max(84, (widths[seq[0]] + widths[seq[1]]) / 2 + 16), left = Math.max(r + 2, widths[seq[0]] / 2), top = 12;
      pos[seq[0]] = [left, top + 50];
      pos[seq[1]] = [left + gap, top + 50];
      pos[seq[2]] = [left + gap / 2, top];
      texts[seq[0]].setAttribute('x', pos[seq[0]][0]); texts[seq[0]].setAttribute('y', top + 50 + 24);
      texts[seq[1]].setAttribute('x', pos[seq[1]][0]); texts[seq[1]].setAttribute('y', top + 50 + 24);
      texts[seq[2]].setAttribute('x', pos[seq[2]][0] + r + 8); texts[seq[2]].setAttribute('y', top + 4); texts[seq[2]].setAttribute('class', 'dk-name start');
      W = Math.max(left + gap + widths[seq[1]] / 2, pos[seq[2]][0] + r + 8 + widths[seq[2]]) + 2;
      Hh = top + 50 + 32;
    } else {
      // the labels sit under the nodes; when they are long, the middle one drops to a second line
      const stagger = n === 3 && Math.max(...widths) > 62, y = 18;
      const wd = (t) => widths[seq[t]];
      const gaps = stagger ? [0, 0].map(() => Math.max(64, (wd(0) + wd(2)) / 4 + 7)) : seq.slice(1).map((_, t) => Math.max(64, (wd(t) + wd(t + 1)) / 2 + 14));
      let x = Math.max(r + 2, wd(0) / 2, stagger ? wd(1) / 2 - gaps[0] : 0);
      seq.forEach((i, t) => {
        if (t) x += gaps[t - 1];
        pos[i] = [x, y];
        texts[i].setAttribute('x', x);
        texts[i].setAttribute('y', y + 26 + (stagger && t === 1 ? 19 : 0));
      });
      W = Math.max(...seq.map((i) => pos[i][0] + widths[i] / 2)) + 2;
      Hh = y + 32 + (stagger ? 19 : 0);
    }
    for (const b of d.bonds) {
      const [x1, y1] = pos[b.i], [x2, y2] = pos[b.j], len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const g = el('g', { transform: 'translate(' + x1 + ' ' + y1 + ') rotate(' + ang + ')' }, svg);
      for (let i = 0; i < b.lines; i++) el('path', { class: 'dk-line' + (b.heavy ? ' heavy' : ''), d: 'M0 ' + ((i - (b.lines - 1) / 2) * 3.4) + 'H' + len }, g);
      const hh = 3.2 + 1.7 * b.lines, chevron = (x, dir) => el('path', { class: 'dk-line', d: 'M' + (x - dir * 3.5) + ' ' + -hh + 'L' + (x + dir * 3.5) + ' 0L' + (x - dir * 3.5) + ' ' + hh }, g);
      if (b.arrow === 1) chevron(len / 2, -1);
      if (b.arrow === 2) chevron(len / 2, 1);
      if (b.arrow === 3) { chevron(len / 2 - 9, -1); chevron(len / 2 + 9, 1); }
      if (b.label) {
        // beside the middle of the bond, on the outside of a triangle
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, horizontal = Math.abs(y2 - y1) < 1;
        const side = triangle && mx < pos[seq[2]][0] ? -1 : 1;
        el('text', { class: 'dk-bond', x: mx + (horizontal ? 0 : side * 15), y: my + (horizontal ? (triangle ? 15 : -7) : 3) }, svg).textContent = b.label;
      }
    }
    d.nodes.forEach((t, i) => {
      const [x, y] = pos[i];
      el('circle', { class: 'dk-node ' + t, cx: x, cy: y, r }, svg);
      if (t === 'x') { const c = r * Math.SQRT1_2; el('path', { class: 'dk-line', d: 'M' + (x - c) + ' ' + (y - c) + 'L' + (x + c) + ' ' + (y + c) + 'M' + (x - c) + ' ' + (y + c) + 'L' + (x + c) + ' ' + (y - c) }, svg); }
    });
    texts.forEach((t) => svg.appendChild(t)); // names on top
    svg.setAttribute('viewBox', '-2 0 ' + (W + 4) + ' ' + Hh);
    svg.setAttribute('width', W + 4);
    svg.setAttribute('height', Hh);
  }

  function positiveText(sys, res) {
    const name = (c) => '$' + RS.rootTex(sys, c) + '$', three = sys.rank === 3;
    const kernel = three ? 'dividing circle' : 'dividing line';
    if (!res.ok) {
      if (res.why === 'root' && isFlat(sys)) return '<p>The handle is on the mirror of the root ' + name(res.on[0]) + '. Move it off to get a positive system.</p>';
      if (res.why === 'root') return '<p>The ' + kernel + ' passes through the root ' + name(res.on[0]) + ': the handle is on its mirror. Move it off to get a positive system.</p>';
      if (res.why === 'null') return '<p>The ' + kernel + ' contains $\\delta$, so it does not separate $n\\delta$ from $-n\\delta$. As the handle comes to this position it crosses infinitely many mirrors, and the simple roots run off to infinity.</p>';
      if (res.why === 'timelike') return '<p>The ' + kernel + ' passes inside the light cone, so there are imaginary roots of both signs on each side. Since $W$ preserves the positive imaginary roots, this half is not $w(\\Delta_\\pm)$ for any $w\\in W$: the handle is outside the two cones that the chambers fill.</p>';
      return '<p>The handle is very close to ' + (sys.family === 'affine' ? 'the mirror of $\\delta$' : 'the null cone') + ': the simple roots are too far away to compute.</p>';
    }
    const list = res.simple.map(name), spoken = '<p class="sr-only">Simple roots: ' + list.join(', ') + '.</p>';
    if (sys.family === 'super') {
      const node = (t) => '<svg class="dk-key" viewBox="-8 -8 16 16" aria-hidden="true"><circle class="dk-node ' + t + '" r="6.3"/>' + (t === 'x' ? '<path class="dk-line" d="M-4.45-4.45 4.45 4.45M-4.45 4.45 4.45-4.45"/>' : '') + '</svg>';
      return spoken + '<p class="rs-key">Nodes: <span class="rs-kind">' + node('o') + 'even,</span> <span class="rs-kind">' + node('x') + 'odd isotropic,</span> <span class="rs-kind">' + node('b') + 'odd, not isotropic.</span></p>';
    }
    const len = res.word.length, side = res.sign > 0 ? '\\Delta_+' : '\\Delta_-';
    const pos = '<a href="#sec-simple">positive roots</a>';
    if (!len) return spoken + '<p>The ' + pos + ' are ' + (res.sign > 0 ? 'the standard ones, $\\Delta_+$.' : 'the negatives of the standard ones, $\\Delta_-$.') + '</p>';
    return spoken + '<p>The ' + pos + ' are $w(' + side + ')$ with $w=' + RS.wordTex(res.word, sys.rank) + '$, of length $' + len + '$. Node $i$ of the diagram is $' + (res.sign > 0 ? '' : '-') + 'w(\\alpha_i)$.</p>';
  }

  function selectedText(sys, f) {
    const k = state.hover || state.sel, v = rootOf(sys, k), flat = isFlat(sys);
    if (!v) return '<p class="hint">' + (flat ? 'Click a mirror' + (sys.family === 'hyperbolic' ? ', or a point,' : '') + ' to read off its root.' : 'Point at a root, or tap it, to read off its coordinates, its length and its multiplicity.') + '</p>';
    const name = RS.rootTex(sys, v.c), alt = sys.family === 'affine' ? RS.affineTex(sys, v.c) : name;
    const norm = '$(\\alpha,\\alpha)=' + fmt(v.norm) + '$', three = sys.rank === 3;
    let text;
    const kind = (words, sec) => '<a href="#' + sec + '">' + words + '</a>';
    if (v.kind === 'real') text = kind('Real root', 'sec-geom') + ': ' + norm + ', height $' + v.ht + '$, multiplicity $1$.';
    else if (v.kind === 'imag' && three) {
      // the roots on this ray: the multiples of the primitive one
      const ms = [];
      const rep = v.rep || v.c.map(Math.abs);
      for (let j = 1; j <= 6; j++) { const m = sys.mult(rep.map((x) => x * j)); if (m === null) break; ms.push(String(m)); }
      text = kind('Imaginary root', 'sec-geom') + ': ' + norm + ', height $' + v.ht + '$. Its multiples lie on the same ray; $\\alpha' + (ms.length > 1 ? ',2\\alpha' : '') + (ms.length > 2 ? ',\\dots' : '') + '$ have multiplicity $' + ms.join(',') + '$.';
      if (v.rep && RS.key(v.rep) !== RS.key(v.c)) text += ' It is conjugate under $W$ to $' + RS.rootTex(sys, v.rep) + '$.';
    } else if (v.kind === 'imag') text = kind('Imaginary root', 'sec-geom') + ': ' + norm + ', height $' + v.ht + '$, multiplicity $' + v.mult + '$.';
    else if (v.kind === 'even') text = kind('Even root', 'sec-super') + ': ' + norm + '. Its reflection $s_\\alpha$ lies in the Weyl group.' + (v.doubled ? ' It is twice an odd root, drawn inside it.' : '');
    else if (v.kind === 'iso') text = kind('Odd root, isotropic', 'sec-super') + ': ' + norm + '. It has no reflection; when the handle crosses its mirror, the simple roots change by an odd reflection.';
    else text = kind('Odd root, not isotropic', 'sec-super') + ': ' + norm + ', and $2\\alpha$ is an even root.';
    const fv = f(v.c);
    text += Math.abs(fv) < 1e-9 ? (flat ? ' The handle is on its mirror.' : ' On the ' + (three ? 'dividing circle.' : 'dividing line.')) : fv > 0 ? ' Positive for this handle.' : ' Negative for this handle.';
    return '<p class="rs-sel-name">$\\alpha=' + name + (alt !== name ? '=' + alt : '') + '$</p><p>' + text + '</p>';
  }

  /* ---------- draw: everything from the state ---------- */

  function draw() {
    const sys = system(), three = sys.rank === 3, flat = isFlat(sys), V = flat ? viewFlat(sys) : three ? viewSphere(sys) : viewPlane(sys);
    if (!V.w) return;
    const { f, res } = handleAt(sys);
    (flat ? paintFlat : three ? paintSphere : paintPlane)(sys, V, res, f);

    handle.hidden = !state.handle;
    handle.style.transform = 'translate(' + V.hx.toFixed(1) + 'px,' + V.hy.toFixed(1) + 'px)';
    handle.classList.toggle('is-back', !!V.back);
    const deg = (x) => Math.round(x * 180 / Math.PI * 10) / 10;
    const lon = (deg(Math.atan2(state.n[1], state.n[0])) % 360 + 360) % 360;
    handle.setAttribute('aria-valuenow', lon);
    handle.setAttribute('aria-valuetext', three ? 'latitude ' + deg(Math.asin(Math.max(-1, Math.min(1, state.n[2])))) + ' degrees, longitude ' + lon + ' degrees' : lon + ' degrees');

    dynkin(sys, res);
    MM.setHTML($('pos'), positiveText(sys, res));
    MM.setHTML($('sel'), selectedText(sys, f));

    // the planes zoom (the plane of rank two and the affine plane)
    const zoomable = zoomsNow(sys), zoom = $('zoom');
    zoom.hidden = !zoomable;
    if (zoomable) {
      const R = three ? SPAN : EXTENT;
      zoom.setAttribute('max', String(R.max / R.min));
      zoom.value = R.max / (three ? state.span : state.zoom);
    }
    if (example) example.changed();
  }

  // a new system: reset what belongs to the old one
  let lastId = null;
  function setSystem(keepHandle) {
    state.family = groupOf(state.id).slice(0, -1);
    state.rank = +groupOf(state.id).slice(-1);
    const sys = system(), three = sys.rank === 3, id = currentId(), def = defOf(id), from = lastId;
    const like = (x) => (x && defOf(x).like) || x;
    lastId = id;
    const kin = from && from !== id && like(from) === like(id);
    if (keepHandle) { /* the same system with another parameter */ }
    else if (kin && sys.family === 'finite') {
      // the same mirrors with other lengths: keep the picture as it is
      const turn = mm(transpose(frame(system(from))), frame(sys));
      state.view = mm(state.view, turn);
      state.n = unit(tmv(turn, state.n));
    } else if (kin && isFlat(sys) && state.n[2] > 1e-6) {
      // the same alcoves: the plane stays where it is, and the handle keeps its place in it
      state.n = fromPlane(planeFrame(sys), toPlane(planeFrame(system(from)), state.n));
      state.view = viewAt(1.27);
    } else {
      state.n = unit(isFlat(sys) && sys.family === 'affine' ? planeFrame(sys).start : sys.start);
      state.view = sys.infinite ? viewAt(1.27) : VIEW0;
      if (def.like && sys.family === 'finite') {
        // start as the system it resembles starts
        const twin = system(def.like), turn = mm(transpose(frame(twin)), frame(sys));
        state.view = mm(state.view, turn);
        state.n = unit(tmv(turn, twin.start));
      }
      state.zoom = EXTENT.start; state.span = SPAN.start; state.pan = [0, 0]; state.boost = I3; state.at = null;
    }
    state.sel = state.hover = null;
    known.clear();
    light(id);
    $('alpha').hidden = id !== 'd21';
    // the family of rank 2: a and b, each refusing what would make ab ≤ 4 with the other
    const ab = rankTwo(id);
    if (ab) lastPair = id;
    $('hyp').hidden = !ab;
    if (ab) [['hyp-a', 0], ['hyp-b', 1]].forEach(([sid, k]) => {
      const sl = $(sid);
      sl.allow = (x) => x * ab[1 - k] > 4; // (the range stays; a value that would make ab ≤ 4 is refused)
      sl.value = ab[k];
    });
    drag.update();
    if (three) canvas.tabIndex = 0; else canvas.removeAttribute('tabindex');
    chrome(sys, id);
    seeAlso(id);
    draw();
  }
  // the same type in the other pages of it
  const WEIGHTS = ['a2', 'b2', 'g2', 'a3', 'b3', 'c3', 'a11', 'a21', 'c21', 'g21'];
  function seeAlso(id) {
    const def = defOf(id), links = [];
    // (Dynkin diagrams names its classical diagrams; any other goes by its Cartan matrix)
    if (def.A) links.push('<a href="/dynkin-diagrams/?t=' + (['a2', 'b2', 'g2', 'a3', 'b3', 'c3'].includes(id) ? id : MM.example.codecs.cartan.write(def.A)) + '">Dynkin diagrams</a>');
    if (WEIGHTS.includes(id)) links.push('<a href="/highest-weight-representations/?t=' + id + '">Highest weight representations</a>');
    $('see-also').hidden = !links.length;
    $('see-also').innerHTML = links.length ? 'The same type in ' + links.join(' and ') + '.' : '';
  }
  // the flat views show the functionals positive on δ, or inside the upper cone: brings the handle there
  function intoView(sys) {
    if (!isFlat(sys) || (state.loc && state.loc.n === state.n && located(sys))) return;
    const n = state.n, inside = sys.family === 'affine' ? Math.abs(n[2]) > 1e-3 : Math.hypot(n[0], n[1]) < Math.abs(n[2]) * RIM;
    state.n = !inside ? unit(sys.start) : n[2] < 0 ? n.map((x) => -x) : n;
  }
  // sphere ↔ plane or disc
  function setFlat(on) {
    const sys = system();
    state.flat = on;
    state.sel = state.hover = null;
    intoView(sys);
    chrome(sys, currentId());
    draw();
  }

  function resize() {
    MM.fitCanvas(canvas);
    draw();
  }

  /* ---------- controls ---------- */

  /* ---------- the lists of systems, under the picture ---------- */

  // A system's Dynkin diagram, small (MM.dynkinPicture): from its Cartan matrix, or from the
  // distinguished simple roots of a superalgebra; in a row with the node joined to both others
  // in the middle, or as a triangle.
  function miniDiagram(id) {
    const def = defOf(id === 'h' ? 'h33' : id), ones = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => +(i === j)));
    const sys = def.A ? { family: 'kac-moody', cartan: def.A } : RS.superSystem(id, 1), n = def.A ? def.A.length : sys.basis.length;
    const d = RS.diagram(sys, ones(n)), deg = d.nodes.map((_, i) => d.bonds.filter((b) => b.i === i || b.j === i).length);
    let pos = [[0, 0], [1, 0]];
    if (n === 3 && d.bonds.length === 3) pos = [[0, 0], [1, 0], [0.5, -0.87]];
    else if (n === 3) { const mid = deg.indexOf(2), [a, b] = [0, 1, 2].filter((i) => i !== mid); pos = []; pos[a] = [0, 0]; pos[mid] = [1, 0]; pos[b] = [2, 0]; }
    return { pos, nodes: d.nodes, bonds: d.bonds.map((b) => Object.assign({}, b, { label: '' })) };
  }
  // its name under it, and in words
  const ORDER = (a) => ['2', '3', '4', '6'][a] || '\\infty';
  function itemName(id) {
    if (id === 'h') return ['$a,b$', 'Hyperbolic systems of rank 2, with numbers a and b'];
    const def = defOf(id), A = def.A;
    if (def.tex) return ['$' + def.tex + '$', def.plain];
    if (A && A.length === 2) return ['$' + -A[0][1] + ',' + -A[1][0] + '$', 'a = ' + -A[0][1] + ', b = ' + -A[1][0]];
    if (A) return ['$(' + [A[0][1] * A[1][0], A[0][2] * A[2][0], A[1][2] * A[2][1]].map(ORDER).sort().join(',') + ')$', 'triangle group (' + tri3({ cartan: A }) + ')'];
    return ['$' + RS.superSystem(id, 1).name + '$', def.plain];
  }
  const minis = new Map(); // id → its button
  let lastPair = 'h33';    // the family of rank 2: the system its entry brings back
  let strip = null;        // the lists (MM.strip)
  function buildLists() {
    const box = $('strip');
    for (const fam of Object.keys(LISTS)) {
      LISTS[fam].forEach((ids) => {
        const group = document.createElement('div');
        group.className = 'strip-group';
        group.dataset.family = fam;
        box.appendChild(group);
        for (const id of ids) {
          const b = document.createElement('button'), [tex, words] = itemName(id);
          b.type = 'button'; b.className = 'strip-item'; b.dataset.key = id;
          b.setAttribute('aria-label', words);
          b.innerHTML = '<svg aria-hidden="true"></svg><span class="strip-name" aria-hidden="true"></span>';
          MM.dynkinPicture(b.firstChild, miniDiagram(id), { unit: 22 });
          MM.setHTML(b.lastChild, tex);
          group.appendChild(b);
          minis.set(id, b);
        }
      });
    }
    strip = MM.strip(box, {
      control: $('family'),
      pick(b) {
        if (b.dataset.key === entryOf(state.id)) return;
        state.id = b.dataset.key === 'h' ? lastPair : b.dataset.key;
        setSystem();
      },
    });
  }
  // the entry of the system shown, lit, and its list shown
  function light(system) { strip.light(minis.get(entryOf(system))); }
  buildLists();

  $('mirrors').addEventListener('change', (e) => { state.mirrors = e.detail.pressed; chrome(system(), currentId()); draw(); });
  // the plane or the disc back where it started
  $('recentre').addEventListener('click', () => { state.pan = [0, 0]; state.boost = I3; state.at = null; draw(); MM.moved(); });
  $('lengths').addEventListener('change', (e) => { state.lengths = e.detail.pressed; chrome(system(), currentId()); draw(); });
  ['affine', 'hyperbolic'].forEach((fam) => $('view-' + fam).addEventListener('change', (e) => setFlat(e.detail.value === 'flat')));
  $('alpha').addEventListener('input', (e) => { state.alpha = +e.target.value; setSystem(true); });
  // a and b of the family of rank 2: the same handle, another system
  [['hyp-a', 0], ['hyp-b', 1]].forEach(([sid, k]) => $(sid).addEventListener('input', (e) => {
    const ab = rankTwo(state.id);
    if (!ab) return;
    ab[k] = +e.target.value;
    const id = 'h' + ab.join('');
    if (!rankTwo(id) || id === state.id) return;
    state.id = lastPair = id;
    setSystem(true);
  }));

  // The planes zoom, by f about the point (x, y) of the canvas, which stays where it is (the
  // plane of rank two, which stays centred on the origin, about its middle): with the slider
  // (a mouse), about the middle; with two fingers, or a pinch on a trackpad, about the point
  // between them. Two fingers moving together move the affine plane.
  const clampTo = (x, R) => Math.max(R.min, Math.min(R.max, x));
  function zoomsNow(sys) { return sys.infinite && (sys.rank === 2 || (isFlat(sys) && sys.family === 'affine')); }
  function zoomAt(f, x, y) {
    const sys = system();
    if (!zoomsNow(sys)) return;
    if (sys.rank === 2) state.zoom = clampTo(state.zoom / f, EXTENT);
    else {
      const V = viewFlat(sys), span = clampTo(state.span / f, SPAN), r = span / state.span;
      const P = [state.pan[0] + (x - V.cx) / V.s, state.pan[1] + (V.cy - y) / V.s];
      state.pan = [0, 1].map((k) => Math.max(-40, Math.min(40, P[k] + (state.pan[k] - P[k]) * r)));
      state.span = span;
    }
    draw();
  }
  $('zoom').addEventListener('input', () => {
    const sys = system(), R = sys.rank === 3 ? SPAN : EXTENT, now = sys.rank === 3 ? state.span : state.zoom;
    zoomAt(now / (R.max / $('zoom').value), canvas.clientWidth / 2, canvas.clientHeight / 2);
  });
  MM.pinchZoom(canvas, {
    zoom: zoomAt,
    pan: (dx, dy) => { const sys = system(); if (zoomsNow(sys) && sys.rank === 3) { slide(sys, 0, 0, dx, -dy); draw(); } },
  });

  // the handle: drag it, or move it with the arrow keys. A drag keeps how far from the handle's
  // point it was taken (grabOff), so that the handle does not jump to the pointer.
  let dragging = false, grabOff = [0, 0];
  function handleTo(e) {
    const cx = e.clientX - grabOff[0], cy = e.clientY - grabOff[1];
    const r = canvas.getBoundingClientRect(), x = cx - r.left - r.width / 2, y = r.top + r.height / 2 - cy, sys = system();
    if (isFlat(sys)) {
      const V = viewFlat(sys);
      if (V.disc) placeHandle(sys, V, cx - r.left, cy - r.top);
      else state.n = V.from(cx - r.left, cy - r.top);
      return;
    }
    if (state.rank === 2) { if (x || y) state.n = unit([x, y]); return; }
    const K = sphereK(sys), d = Math.hypot(x, y) / K;
    state.n = tmv(state.view, d >= 1 ? [x / K / d, y / K / d, 0] : [x / K, y / K, Math.sqrt(1 - d * d)]);
  }
  handle.addEventListener('pointerdown', (e) => {
    const b = handle.getBoundingClientRect();
    grabOff = [e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)];
    handle.setPointerCapture(e.pointerId);
    dragging = true;
  });
  handle.addEventListener('pointermove', (e) => { if (dragging) { handleTo(e); draw(); } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => handle.addEventListener(t, () => { dragging = false; }));
  const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  handle.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const a = ARROWS[e.key], t = (e.shiftKey ? 0.2 : 2) * Math.PI / 180, sys = system();
    if (e.key === 'Home') state.n = unit(sys.start);
    else if (!a) return;
    else if (isFlat(sys)) {
      // by pixels in the plane; in the disc by less towards the rim, where a pixel is a long way
      const V = viewFlat(sys), px = (e.shiftKey ? 1.5 : 8) * (V.disc ? Math.max(0.05, 1 - ((V.hx - V.cx) ** 2 + (V.hy - V.cy) ** 2) / (V.K * V.K)) : 1);
      if (V.disc) placeHandle(sys, V, V.hx + a[0] * px, V.hy - a[1] * px);
      else state.n = V.from(V.hx + a[0] * px, V.hy - a[1] * px);
    } else if (state.rank === 2) {
      // round the circle, the way the arrow points from where the handle is
      const along = -a[0] * state.n[1] + a[1] * state.n[0];
      const s = (Math.abs(along) > 1e-6 ? Math.sign(along) : a[0] + a[1]) * t, c = Math.cos(s), sn = Math.sin(s);
      state.n = unit([c * state.n[0] - sn * state.n[1], sn * state.n[0] + c * state.n[1]]);
    }
    else state.n = unit(tmv(state.view, mv(mm(rotY(a[0] * t), rotX(-a[1] * t)), mv(state.view, state.n))));
    e.preventDefault();
    draw();
  });

  // roots: point at one, or tap it
  function hit(e, reach) {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = Infinity;
    for (const p of shown) {
      const d = Math.hypot(p.px - x, p.py - y) - p.r;
      if (d < reach && d < bd) { bd = d; best = p; }
    }
    return best && RS.key(best.v.c);
  }
  function hover(k) {
    if (k === state.hover) return;
    state.hover = k;
    canvas.classList.toggle('is-over-root', !!k);
    draw();
  }
  // a mirror of the flat views near the pointer: its root, of the sign that is positive for the handle
  function hitMirror(e) {
    const sys = system(), r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!tess) return null;
    let best = null, bd = 7;
    tess.mirrors.forEach((m) => { const d = nearMirror(m.g, x, y).d; if (d < bd) { bd = d; best = m; } });
    if (!best) return null;
    const c = handleAt(sys).f(best.c) >= 0 ? best.c : best.c.map((t) => -t);
    return RS.key(record(sys, c, 'real', null, best.b).c);
  }
  // moves the flat view by (x0, y0) → (x1, y1), in pixels from the middle of the canvas, y up (keys, a pinch)
  function slide(sys, x0, y0, x1, y1) {
    const V = viewFlat(sys);
    if (!V.disc) { state.pan = [0, 1].map((k) => Math.max(-40, Math.min(40, state.pan[k] - [x1 - x0, y1 - y0][k] / V.s))); return; }
    moveDisc(sys, grip(V, x0, y0), inDisc(V, x1, y1));
  }
  // A point of the canvas in the unit disc, held within HOLD of the rim's radius: a pixel further
  // out is a long way in the hyperbolic plane, and outside the disc there is nothing to hold.
  const HOLD = 0.9;
  const inDisc = (V, x, y) => { const r = Math.hypot(x, y) / V.K, k = r > HOLD ? HOLD / r : 1; return [x / V.K * k, y / V.K * k]; };
  // A hold on the disc: the view when it was taken, the point p of the disc taken hold of, and
  // q, where it has been brought so far.
  const grip = (V, x, y) => { const p = inDisc(V, x, y); return { L: state.boost, F: state.at, p, q: p }; };
  // The view with p brought to q. Not down a cusp, unless it is the way out of one: a drag into one
  // goes as far as it may, and the picture then slips under the pointer. Returns the hold after it.
  function moveDisc(sys, g, q) {
    const by = (t) => HY.fix(mm(HY.translation(g.p, [g.q[0] + t * (q[0] - g.q[0]), g.q[1] + t * (q[1] - g.q[1])]), g.L));
    const now = cuspRoom(sys, state.boost), fine = (L) => L.every((row) => row.every(Number.isFinite)) && (cuspRoom(sys, L) >= CUSP || cuspRoom(sys, L) > now);
    let t = 1;
    if (!fine(by(1))) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (fine(by(m))) lo = m; else hi = m; }
      t = lo;
    }
    const went = t > 0 && recentre(sys, by(t), g.F);
    if (went && t === 1) return { ...g, q };
    // stopped short: hold again, here, what is under the pointer now
    return { L: state.boost, F: state.at, p: q, q };
  }
  // A drag on the disc, the pointer from a to b (in pixels from the middle, y up). Within HOLD of
  // the rim's radius the point it holds follows the pointer (moveDisc); further out, and outside
  // the disc, the pointer turns the disc about its middle by the angle it goes round, like a
  // wheel. Each part starts from the view where the pointer's path crossed into it, and goes with
  // where the pointer is, not with the way it went: a drag that goes out, round the disc a whole
  // turn and back puts the picture back as it was.
  function dragDisc(sys, V, h, a, b) {
    const R = HOLD * V.K, turn = Math.hypot(b[0], b[1]) > R;
    if (h && h.turn !== turn) {
      // where the path crosses the circle of radius R: the part it leaves goes as far as there,
      // and the next starts there
      const d = [b[0] - a[0], b[1] - a[1]], A = d[0] * d[0] + d[1] * d[1], B = a[0] * d[0] + a[1] * d[1], C = a[0] * a[0] + a[1] * a[1] - R * R;
      const root = Math.sqrt(Math.max(0, B * B - A * C)), t = A ? (C < 0 ? (-B + root) / A : (-B - root) / A) : 0;
      const c = [a[0] + t * d[0], a[1] + t * d[1]], ca = Math.atan2(c[1], c[0]);
      if (turn) moveDisc(sys, h, inDisc(V, ...c)); else turnDisc(h, ca);
      h = turn ? { turn, L: state.boost, F: state.at, a: ca } : { ...grip(V, ...c), turn };
    }
    if (!h) h = turn ? { turn, L: state.boost, F: state.at, a: Math.atan2(b[1], b[0]) } : { ...grip(V, ...b), turn };
    if (turn) { turnDisc(h, Math.atan2(b[1], b[0])); return h; }
    return { ...moveDisc(sys, h, inDisc(V, ...b)), turn };
  }
  function turnDisc(h, a) {
    const c = Math.cos(a - h.a), s = Math.sin(a - h.a);
    state.boost = HY.fix(mm([[c, -s, 0], [s, c, 0], [0, 0, 1]], h.L));
    state.at = h.F;
  }
  // The view {L, F} with the middle of the disc brought back near the standard chamber by the
  // Weyl group, so that L stays small; as far out as roots of the model stay exact integers
  // (a frame's entries times those of the roots drawn, up to 10^4, below 2^53): distance 25 or so.
  const FAR = 1e11;
  function recentre(sys, L, F) {
    const W = weyl(sys), v = W.recentre({ L, F: F || W.origin });
    if (W.size(v.F) > FAR || !v.L.every((row) => row.every(Number.isFinite))) return false;
    state.boost = v.L;
    state.at = v.F;
    return true;
  }
  // the sphere: drag to turn it; the plane and the disc: drag to move them (on a touch screen, a
  // drag that starts sideways; one that starts up or down scrolls the page, MM.turnDrag)
  let held = null; // the hold of a drag on the disc (dragDisc)
  const drag = MM.turnDrag(canvas, {
    when: () => state.rank === 3,
    start: () => { held = null; },
    end: () => { held = null; },
    move: (dx, dy, e) => {
      const sys = system(), r = canvas.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2;
      const x = e.clientX - mx, y = my - e.clientY, V = isFlat(sys) && viewFlat(sys);
      if (V && V.disc) { const from = [x - dx, y + dy]; held = dragDisc(sys, V, held || dragDisc(sys, V, null, from, from), from, [x, y]); }
      else if (V) slide(sys, x - dx, y + dy, x, y);
      else { const K = sphereK(sys); state.view = mm(mm(rotY(dx / K), rotX(dy / K)), state.view); }
      state.hover = null;
      draw();
    },
    // the arrow keys: as a drag that way would (the plane and the disc move 36 pixels a press, 6 with Shift)
    keys: {
      turn: (a, b) => {
        const sys = system();
        if (isFlat(sys)) slide(sys, 0, 0, a * KEY_PX, -b * KEY_PX);
        else state.view = mm(mm(rotY(a), rotX(b)), state.view);
        draw();
      },
    },
  });
  const KEY_PX = 6 * 180 / Math.PI; // pixels a key moves the plane or the disc, for each radian a key turns the sphere
  canvas.addEventListener('pointermove', (e) => { if (!drag.active && e.pointerType === 'mouse') hover(hit(e, 9)); });
  canvas.addEventListener('pointerleave', () => hover(null));
  canvas.addEventListener('click', (e) => {
    if (drag.moved) return;
    let k = hit(e, 14);
    if (!k && isFlat(system())) {
      k = hitMirror(e);
      const v = k && rootOf(system(), k);
      if (v && state.sel === RS.key(v.c.map((t) => -t))) k = state.sel; // the same mirror: a second click lets go of it
    }
    state.sel = k === state.sel ? null : k;
    draw();
  });

  new ResizeObserver(resize).observe(canvas);
  setSystem();
  // canvas text uses whatever font is loaded, and the diagram measures its labels: redraw once the fonts are there
  MM.onFonts(() => { $('dynkin')._key = null; draw(); });

  /* ---------- links, reset and Save image ---------- */

  // The view of the disc, a map preserving x² + y² − z²: where it takes the centre (at
  // distance r from it, in direction a) and its turn t there. Three numbers, not nine.
  const lorentz = {
    write: (L) => MM.example.codecs.numbers.write(HY.params(L)),
    read(text) {
      const v = MM.example.codecs.numbers.read(text);
      if (v.length !== 3 || !(v[0] >= 0 && v[0] < 12) || !v.every(Number.isFinite)) throw new Error('not a view of the disc: "' + text + '"');
      return HY.fromParams(v);
    },
  };
  // A chamber of the hyperbolic plane, by a reduced word for the element of the Weyl group
  // that takes the standard chamber to it, s_{i_1} ⋯ s_{i_k} written i_1 … i_k.
  const word = {
    write: (a) => a.join(''),
    read(text) {
      if (!/^[1-9]{0,2000}$/.test(text)) throw new Error('not a word in the reflections: "' + text + '"');
      return text.split('').map(Number);
    },
  };
  // The handle of a hyperbolic system in the disc: the chamber it is in (h) and where it is in
  // it (n, taken there by the Weyl group, with Lorentz length 1); the view: its middle's
  // chamber, near enough (w), and the small map after it (b).
  function fields() {
    const sys = system(), loc = located(sys);
    return {
      t: currentId(), n: loc ? loc.x.map((x) => x / Math.sqrt(-HY.lip(loc.x, loc.x))) : state.n, h: loc ? frameWord(sys, loc.F) : [],
      f: state.flat, m: state.mirrors, l: state.lengths, a: state.alpha,
      v: state.view, z: state.zoom, s: state.span, p: state.pan, b: state.boost, w: frameWord(sys, state.at),
    };
  }
  // A field that does not apply to the picture in view (the turn of the sphere when the disc is
  // shown, say) is given as the page's own, so that a link leaves it out.
  const own = JSON.parse(JSON.stringify(fields()));
  function applies(sys) {
    const three = sys.rank === 3, flat = isFlat(sys), views = three && (sys.family === 'affine' || sys.family === 'hyperbolic');
    return {
      f: views, m: !flat, l: three && sys.family === 'finite' && sys.realNorms.length > 1, a: currentId() === 'd21',
      v: three && !flat, z: sys.rank === 2 && sys.infinite,
      s: flat && sys.family === 'affine', p: flat && sys.family === 'affine', b: flat && sys.family === 'hyperbolic', w: flat && sys.family === 'hyperbolic',
    };
  }
  example = MM.example({
    fields: { t: 'text', n: 'numbers', h: word, f: 'flag', m: 'flag', l: 'flag', a: 'number', v: 'rotation', z: 'number', s: 'number', p: 'numbers', b: lorentz, w: word },
    view: ['v', 'z', 's', 'p', 'b', 'w'],
    get() {
      const x = fields(), on = applies(system());
      for (const k in on) if (!on[k]) x[k] = own[k];
      return x;
    },
    // what a link does not name of the handle and the view is as choosing the system makes it
    set(x, named) {
      const group = groupOf(x.t), rank = group && +group.slice(-1);
      if (!group || !(x.a >= 0.2 && x.a <= 3) || (named.has('n') && (x.n.length !== rank || !(Math.hypot(...x.n) > 1e-6))) || (named.has('p') && x.p.length !== 2)) return false;
      if (x.h.concat(x.w).some((i) => i > rank) || (x.h.length && (group !== 'hyperbolic3' || !(x.n[2] > Math.hypot(x.n[0], x.n[1]))))) return false;
      // the controls as a reader would set them, then the system afresh
      state.id = x.t;
      state.alpha = x.a;
      state.flat = x.f;
      $('alpha').value = x.a;
      ['affine', 'hyperbolic'].forEach((fam) => { $('view-' + fam).value = x.f ? 'flat' : 'sphere'; });
      lastId = null;
      setSystem();
      Object.assign(state, { mirrors: x.m, lengths: x.l });
      if (named.has('n')) state.n = unit(x.n);
      if (x.h.length) {
        // the handle, given in the chamber with the word h
        const sys = system(), W = weyl(sys), { x: xl, steps } = W.walk(unit(x.n));
        let F = W.frame(x.h);
        for (const i of steps) F = W.step(F, i);
        state.n = unit(W.out(F, xl));
        state.loc = locate(sys, state.n, F, xl);
      }
      if (named.has('v')) state.view = x.v;
      if ((named.has('b') || named.has('w')) && group === 'hyperbolic3' && !recentre(system(), x.b, weyl(system()).frame(x.w))) { state.boost = I3; state.at = null; }
      if (named.has('z')) state.zoom = clampTo(x.z, EXTENT);
      if (named.has('s')) state.span = clampTo(x.s, SPAN);
      if (named.has('p')) state.pan = x.p.map((c) => Math.max(-40, Math.min(40, c)));
      $('mirrors').pressed = x.m;
      $('lengths').pressed = x.l;
      intoView(system());
      chrome(system(), currentId());
      draw();
    },
    pictures: () => [{ label: 'Roots', element: $('plane') }, { label: 'Dynkin diagram', element: $('dynkin').querySelector('svg'), selected: false }],
    // for Save image: the root selected
    scene: { get: () => ({ sel: state.sel }), set(s) { state.sel = s.sel; draw(); } },
    // without the handle, its stem goes too
    redraw(o) {
      const shown = state.handle;
      if (o && o.handles === false) state.handle = false;
      resize();
      state.handle = shown;
    },
  });
})();
