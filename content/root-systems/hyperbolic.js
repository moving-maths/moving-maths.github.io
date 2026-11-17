/* The hyperbolic plane, drawn as the Poincaré disc, and moved over by a reflection group.
   No DOM: Root systems draws with it (main.js), and test/root-systems.test.mjs checks it.

   A point of the plane is a vector v of R³ with ⟨v, v⟩ < 0 and v_z > 0, up to a positive
   factor, where ⟨u, v⟩ = u_x v_x + u_y v_y − u_z v_z (`lip`); the unit disc shows it at
   disc(v), and the null vectors, ⟨v, v⟩ = 0, on the rim. A line of the plane is the set
   ⟨v, m⟩ = 0 of a vector m with ⟨m, m⟩ > 0, drawn as an arc of a circle orthogonal to the
   rim (geodesic(m)). The plane is moved by the linear maps that keep ⟨,⟩ and the sign of
   v_z, Lorentz maps, kept as 3×3 matrices.

   Numbers. A Lorentz map that takes the middle a distance r away has entries of size e^r,
   and rounding leaves it short of keeping the form by about 1e-16·e^(2r); a cusp drawn
   through it leaves the rim, by pixels at r = 8. So a picture that may go anywhere keeps the
   map it draws through small, and brings the far part of the plane near by a symmetry it
   knows exactly: group(A, E), the reflection group of a Cartan matrix A, whose elements are
   integer matrices on root coordinates. A frame { M, Mi } is such an element w, with
   M: c ↦ w(c) on root coordinates and Mi its inverse; a functional x "in the frame" is the
   functional n of the model with n(c) = x(M c). A view is a frame and a small Lorentz map L:
   the functional x of the frame is drawn at disc(L x), and recentre() moves the frame after
   L so that the middle of the view stays in the standard chamber (or one beside it). */
(function (root) {
  'use strict';
  const mv = (R, p) => [R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]];
  const tmv = (R, p) => [R[0][0] * p[0] + R[1][0] * p[1] + R[2][0] * p[2], R[0][1] * p[0] + R[1][1] * p[1] + R[2][1] * p[2], R[0][2] * p[0] + R[1][2] * p[1] + R[2][2] * p[2]];
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  /* ---------- the form, and the maps that keep it ---------- */
  const lip = (u, v) => u[0] * v[0] + u[1] * v[1] - u[2] * v[2];
  const flipZ = (v) => [v[0], v[1], -v[2]];
  const inv = (L) => [[L[0][0], L[1][0], -L[2][0]], [L[0][1], L[1][1], -L[2][1]], [-L[0][2], -L[1][2], L[2][2]]];
  // the point p of the unit disc, on the sheet ⟨x, x⟩ = −1
  const lift = (p) => { const q = p[0] * p[0] + p[1] * p[1]; return [2 * p[0] / (1 - q), 2 * p[1] / (1 - q), (1 + q) / (1 - q)]; };
  // the half-turn about a point X of the sheet: x ↦ −x − 2 ⟨x, X⟩ X
  const halfTurn = (X) => { const Y = flipZ(X); return X.map((x, i) => Y.map((y, j) => (i === j ? -1 : 0) - 2 * x * y)); };
  // the translation that takes the point p of the disc to q: two half-turns
  function translation(p, q) {
    const a = lift(p), b = lift(q), m = a.map((x, i) => x + b[i]), l = Math.sqrt(-lip(m, m));
    return mm(halfTurn(m.map((x) => x / l)), halfTurn(a));
  }
  // a matrix that keeps the form all but exactly, made to keep it: its columns orthonormal again
  function fix(L) {
    const col = (j) => [L[0][j], L[1][j], L[2][j]], scale = (v, l) => v.map((x) => x / l);
    let t = col(2), a = col(0), b = col(1);
    t = scale(t, Math.sqrt(-lip(t, t)));
    const at = lip(a, t);
    a = a.map((x, i) => x + at * t[i]);
    a = scale(a, Math.sqrt(lip(a, a)));
    const bt = lip(b, t), ba = lip(b, a);
    b = b.map((x, i) => x + bt * t[i] - ba * a[i]);
    b = scale(b, Math.sqrt(lip(b, b)));
    return [0, 1, 2].map((i) => [a[i], b[i], t[i]]);
  }
  // A map that keeps orientation, as three numbers: how far it takes the middle (r), in which
  // direction (a), and its turn t there; and back.
  function params(L) {
    const x = L[0][2], y = L[1][2], d = L[2][2] + 1, r = Math.hypot(x, y);
    const r00 = (1 + x * x / d) * L[0][0] + x * y / d * L[1][0] - x * L[2][0], r10 = x * y / d * L[0][0] + (1 + y * y / d) * L[1][0] - y * L[2][0];
    // (no direction when the middle stays put, but for rounding)
    return [Math.asinh(r), r < 1e-9 ? 0 : Math.atan2(y, x), Math.atan2(r10, r00)];
  }
  function fromParams(v) {
    const x = Math.sinh(v[0]) * Math.cos(v[1]), y = Math.sinh(v[0]) * Math.sin(v[1]), z = Math.cosh(v[0]), d = z + 1, c = Math.cos(v[2]), s = Math.sin(v[2]);
    const T = [[1 + x * x / d, x * y / d, x], [x * y / d, 1 + y * y / d, y], [x, y, z]];
    return T.map((row) => [row[0] * c + row[1] * s, -row[0] * s + row[1] * c, row[2]]);
  }

  /* ---------- the disc ---------- */
  // the point of the unit disc of a vector inside or on the light cone, with v_z > 0
  function disc(v) {
    const d = v[2] + Math.sqrt(Math.max(0, v[2] * v[2] - v[0] * v[0] - v[1] * v[1]));
    return [v[0] / d, v[1] / d];
  }
  // The line ⟨v, m⟩ = 0 in the unit disc (y up): the circle {x, y, r} orthogonal to the rim with
  // its centre at the pole of the line or, when that is further out than `far` radii, the line
  // {x, y, ux, uy} through the circle's point nearest the middle, along it; which is off the
  // circle by 1/(2·far) at the rim.
  function geodesic(m, far) {
    const l = Math.hypot(m[0], m[1]), e = [m[0] / l, m[1] / l];
    const c = Math.abs(m[2]) < 1e-15 * l ? Infinity : l / Math.abs(m[2]); // the centre's distance from the middle
    if (c > (far || 1e8)) {
      const t = Number.isFinite(c) ? Math.sign(m[2]) / (c + Math.sqrt(c * c - 1)) : 0;
      return { x: t * e[0], y: t * e[1], ux: -e[1], uy: e[0] };
    }
    return { x: m[0] / m[2], y: m[1] / m[2], r: Math.sqrt(Math.max(0, c * c - 1)) };
  }
  // the angles about its centre of the arc of a circle g of geodesic() inside a disc of radius R
  // about (cx, cy): from a through d, towards the middle; `more` widens it at both ends
  function within(g, cx, cy, R, more) {
    const c = Math.atan2(cy - g.y, cx - g.x), h = Math.atan(R / g.r) + (more || 0);
    return { a: c - h, d: 2 * h };
  }
  // Points along the arc of the circle g from angle a through d, with chords within tol of the
  // arc. (Canvases draw an arc as cubic curves, which leave a circle by about 3e-4 of its radius:
  // pixels, for a line of the disc that is nearly straight. A polyline worked out here does not.)
  function arc(g, a, d, tol) {
    const n = Math.max(2, Math.ceil(Math.abs(d) * Math.sqrt(g.r / (8 * tol)))), out = [];
    for (let i = 0; i <= n; i++) { const t = a + d * i / n; out.push([g.x + g.r * Math.cos(t), g.y + g.r * Math.sin(t)]); }
    return out;
  }

  /* ---------- integers ---------- */
  // M c and A B for integer matrices and vectors, exactly: in BigInt where a product could pass
  // 2^53, given back as numbers (exact while the result stays below 2^53). Far out, a frame's
  // entries pass 10^8, and a root of the model taken to a frame is a large integer times another
  // that comes to a small one.
  const SAFE = 2 ** 53;
  const most = (v) => Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
  function imv(M, c) {
    if (3 * Math.max(most(M[0]), most(M[1]), most(M[2])) * most(c) < SAFE) return mv(M, c);
    const C = c.map(BigInt);
    return M.map((r) => Number(BigInt(r[0]) * C[0] + BigInt(r[1]) * C[1] + BigInt(r[2]) * C[2]));
  }
  function imm(A, B) {
    const cols = [0, 1, 2].map((j) => imv(A, [B[0][j], B[1][j], B[2][j]]));
    return [0, 1, 2].map((i) => cols.map((c) => c[i]));
  }

  /* ---------- a reflection group, exactly ---------- */
  // A: the Cartan matrix of a hyperbolic reflection group of rank 3; E: the simple roots in the
  // model, its rows, with the form ⟨,⟩ (up to sign) on roots. Functionals are vectors n of the
  // model, n(c) = n · E^T c.
  function group(A, E) {
    // s_i on root coordinates: c − ⟨c, α_i^∨⟩ α_i, ⟨c, α_i^∨⟩ = Σ_j A_ij c_j
    const reflect = (i, c) => { const t = A[i][0] * c[0] + A[i][1] * c[1] + A[i][2] * c[2]; return c.map((x, k) => (k === i ? x - t : x)); };
    // the matrix of s_{w_1} ⋯ s_{w_k} (a word of 1-based indices, as RootSystems.positive gives)
    function matrix(word) {
      const cols = I3.map((e) => { let c = e.slice(); for (let k = word.length - 1; k >= 0; k--) c = reflect(word[k] - 1, c); return c; });
      return [0, 1, 2].map((i) => cols.map((c) => c[i]));
    }
    const R = [0, 1, 2].map((i) => matrix([i + 1]));
    const det = dot(E[0], cross(E[1], E[2]));
    const Ei = [0, 1, 2].map((i) => [cross(E[1], E[2])[i] / det, cross(E[2], E[0])[i] / det, cross(E[0], E[1])[i] / det]);
    // s_i on functionals: (G_i n)(c) = n(s_i c)
    const G = R.map((Ri) => mm(Ei, mm(Ri.map((_, i) => Ri.map((r) => r[i])), E)));
    const g = {
      A, E, Ei, R, G, matrix,
      origin: { M: I3, Mi: I3 },
      // the frame of w, from a word for w⁻¹ (so that the chamber w⁻¹(C) has that word)
      frame: (word) => ({ M: matrix(word.slice().reverse()), Mi: matrix(word) }),
      // the frame F followed by s_i
      step: (F, i) => ({ M: mm(R[i], F.M), Mi: mm(F.Mi, R[i]) }),
      // the functional of the model of a functional x in the frame F, and back
      out: (F, x) => mv(Ei, tmv(F.M, mv(E, x))),
      into: (F, n) => mv(Ei, tmv(F.Mi, mv(E, n))),
      // a functional x of the frame F in the frame H
      between: (F, H, x) => mv(Ei, tmv(imm(F.M, H.Mi), mv(E, x))),
      // the exact functional c ↦ n(c) of x in the frame F: M c in integers, then the sum
      exact(F, x) { const ex = mv(E, x); return (c) => dot(ex, imv(F.M, c)); },
      // the reflections that take x into the standard chamber, x(α_i) ≥ 0 (in order), and where x goes
      walk(x) {
        const steps = [];
        for (let k = 0; k < 500; k++) {
          const v = mv(E, x), l = Math.hypot(x[0], x[1], x[2]);
          let i = 0;
          for (let j = 1; j < 3; j++) if (v[j] < v[i]) i = j;
          if (!(v[i] < -1e-13 * l)) break;
          x = mv(G[i], x);
          steps.push(i);
        }
        return { x, steps };
      },
      // the largest entry of a frame (a picture lets it grow as far as its roots in the model,
      // the frame's entries times those of roots of the frame, stay below 2^53)
      size: (F) => Math.max(...F.M.map((r) => Math.max(...r.map(Math.abs))), ...F.Mi.map((r) => Math.max(...r.map(Math.abs)))),
      // A view {L, F} again, with the middle of the disc, the functional L⁻¹(0, 0, 1) of F,
      // taken into the standard chamber C by the group, or into s_k(C) after an odd number of
      // reflections, so that L keeps its orientation. The picture does not change.
      recentre(view, k) {
        const { steps } = g.walk(mv(inv(view.L), [0, 0, 1]));
        if (steps.length % 2) steps.push(k || 0);
        let L = view.L, F = view.F;
        for (const i of steps) { L = mm(L, G[i]); F = g.step(F, i); }
        return { L: fix(L), F };
      },
    };
    return g;
  }

  root.Hyperbolic = { lip, flipZ, inv, lift, translation, fix, params, fromParams, disc, geodesic, within, arc, imv, imm, group, I3 };
})(globalThis);
