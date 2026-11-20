/* Penrose tilings, by deflation of half-tiles. No DOM: main.js draws with it, and
   test/regular-polytopes.test.mjs checks it.

   Every tile is cut along its axis of symmetry into two half-tiles, golden triangles
   (Robinson's triangles): a half-tile is [kind, apex, b, c], kind 0 or 1, with the apex where
   its two equal sides meet.
   - Rhombs (P3): kind 0 is half a thin rhomb, angles 36° at the apex and 72° at b and c; kind 1
     half a thick rhomb, 108° at the apex and 36° at b and c. The two halves of a rhomb meet
     along bc, its short or long diagonal; the tile's edges are apex–b and apex–c, of length 1.
   - Kites and darts (P2): kind 0 is half a kite, its head at the apex (36° there), a wing at b
     and its tail at c; kind 1 half a dart, its notch at the apex (108°), a wing at b and its tip
     at c. The two halves meet along apex–c; the edges are apex–b and b–c. A kite's long edges
     are φ = (1 + √5)/2 times its short ones; a dart's are the same two lengths.
   Deflation cuts each half-tile into smaller half-tiles, φ times smaller, as Penrose's
   substitution does with the tiles; done again and again from a sun it gives a Penrose tiling
   of any size, and only the half-tiles that meet the window need be cut (Penrose 1974;
   Grünbaum and Shephard, Tilings and patterns, ch. 10). */
(function (root) {
  'use strict';
  const phi = (1 + Math.sqrt(5)) / 2, g1 = 1 / phi, g2 = 1 / (phi * phi);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  // one half-tile cut into the half-tiles of the next level
  function cut(kind, t, out) {
    const [k, A, B, C] = t;
    if (kind === 'p3') {
      if (k === 0) { const P = lerp(A, B, g1); out.push([0, C, P, B], [1, P, C, A]); }
      else { const Q = lerp(B, A, g1), R = lerp(B, C, g1); out.push([1, R, C, A], [1, Q, R, B], [0, R, Q, A]); }
    } else if (k === 0) {
      const Q = lerp(A, B, g2), R = lerp(A, C, g1);
      out.push([1, Q, R, A], [0, B, C, R], [0, B, Q, R]);
    } else {
      const P = lerp(B, C, g2);
      out.push([1, P, A, B], [0, C, P, A]);
    }
    return out;
  }
  // the sun: five kites with their heads at the origin, or ten halves of thin rhombs round it,
  // edges `r` long (a kite's long edges)
  function sun(kind, r) {
    const out = [], at = (a) => [r * Math.cos(a), r * Math.sin(a)];
    for (let i = 0; i < 10; i++) {
      if (kind === 'p3') {
        let b = at((2 * i - 1) * Math.PI / 10), c = at((2 * i + 1) * Math.PI / 10);
        if (i % 2 === 0) [b, c] = [c, b];
        out.push([0, [0, 0], b, c]);
      } else {
        const th = Math.floor(i / 2) * 2 * Math.PI / 5;
        out.push([0, [0, 0], at(th + (i % 2 ? -1 : 1) * Math.PI / 5), at(th)]);
      }
    }
    return out;
  }
  // the box of a half-tile meets [x0, x1] × [y0, y1]
  function meets(t, b) {
    const xs = [t[1][0], t[2][0], t[3][0]], ys = [t[1][1], t[2][1], t[3][1]];
    return Math.max(...xs) >= b[0] && Math.min(...xs) <= b[1] && Math.max(...ys) >= b[2] && Math.min(...ys) <= b[3];
  }
  // The half-tiles of each level from `start` down `levels` deflations that meet the box: a list
  // per level, the last the finest.
  function cover(kind, start, box, levels) {
    const out = [start.filter((t) => meets(t, box))];
    for (let l = 0; l < levels; l++) {
      const next = [];
      for (const t of out[l]) { const kids = cut(kind, t, []); for (const s of kids) if (meets(s, box)) next.push(s); }
      out.push(next);
    }
    return out;
  }
  // The arcs that mark the matching rules, two to a half-tile (the first colour, then the
  // second), each centred at a vertex (0 apex, 1 b, 2 c) with a radius in units of the tile's
  // short edge, as Penrose's tiles are usually drawn: Conway's for kites and darts (the kite's
  // first-colour arc round its tail, 1/φ, the second round its head, 1; the dart's round its
  // notch, 1/φ², and its tip, 1/φ); for rhombs, small arcs round the thin rhomb's obtuse
  // corners, and round one acute corner of the thick rhomb with a large arc round the other
  // (radii 1/φ³ and 1 − 1/φ³). Arcs of one colour run on across every edge into the next tile.
  const g3 = g1 * g2;
  const ARCS = {
    p2: [[[2, g1], [0, 1]], [[0, g2], [2, g1]]],          // kite: tail, head; dart: notch, tip
    p3: [[[1, g3], [2, g3]], [[1, 1 - g3], [2, g3]]],     // thin, thick: at b, at c
  };
  // the length of the short edge of a half-tile (P2: a kite's short edge, a dart's leg; P3: the side)
  function unit(kind, t) {
    const l = Math.hypot(t[2][0] - t[1][0], t[2][1] - t[1][1]);
    return kind === 'p2' && t[0] === 0 ? l / phi : l;
  }

  root.Penrose = { phi, cut, sun, cover, meets, ARCS, unit };
})(globalThis);
