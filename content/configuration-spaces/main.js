// Configuration spaces of the line, the circle and surfaces: the figures and their readouts.
// The mathematics (Betti numbers, strata, the models of the surfaces, the pictures of the
// spaces) is in confspaces.js.
//
// The stage draws the surface as its model. The plane, the cylinder, the Möbius band, the torus
// and the Klein bottle are the unit square with edges glued, drawn with the squares beside it,
// faded, across each glued edge: a point near such an edge shows again on the far side. The
// sphere and the projective plane are a sphere that turns under a drag, seen through, its far
// half paler; on the projective plane opposite points are the same point, so each point shows
// twice. The line and the circle are the unit interval, open or with its ends glued, and their
// paths run down the stage as time goes on: worldlines. A point can be dragged by any of its
// copies; where it leaves the square, the gluing brings it back. Points dropped on one another
// collide and stay together, the configuration then lying in a stratum of Σ^k (or of Sym^k Σ);
// dragging a collision pulls out the point that joined it last.
//
// Beside it, a picture of the configuration space itself where there is one: for two, three or
// four points on the line or the circle, the square, the cube or the sphere they make (one chamber
// of it for unordered points); for three points in the plane, centred and scaled, the 3-sphere,
// drawn in R³ by stereographic projection, with the collisions in it (three circles, or for
// unordered points a trefoil); for two points on the plane, cylinder or torus, their relative
// position; for two on the Möbius band, the projective plane or the sphere, and three on the
// sphere, a space it is homotopy equivalent to. The configurations the points pass through are
// kept for a few seconds, and every figure draws their path, fading with age.
//
// The moves are in the bar: a menu for each kind of move that names its points (a swap, one point
// once round another, a point across glued edges), and a button for one that moves all the
// points. Undo and Redo play a motion back, backwards or forwards. Under the figure the text
// explains the readouts, with two figures: the generators of the braid group, each drawn as a
// braid and played in the figure at the top on request (a copy of which is beside it), and the
// collision strata, which move the points together and apart.
(function () {
  'use strict';
  const CS = window.ConfSpaces;
  const $ = (id) => document.getElementById(id);
  let stage = $('stage'); // (for a moment another picture, as the copy beside the braids is drawn)
  const stagebox = $('stagebox'), strataSvg = $('strata'), spaceCv = $('space'), sctx = spaceCv.getContext('2d');
  const braidCv = $('braid'), bctx = braidCv.getContext('2d');
  let spaceTurn = null, braidTurn = null; // their drags (MM.turnDrag), set up below
  const measure = document.createElement('canvas').getContext('2d'); // for the widths of labels
  const el = MM.svg;

  // where new points go (y up); the second and fourth near edges, so that they show again across them
  const HOME = [[0.3, 0.36], [0.92, 0.25], [0.57, 0.7], [0.1, 0.88]];
  // on a sphere, where they go as seen from in front (x right, y up): at 110°, 330°, 220° and 20° round
  // its centre, so that on the projective plane their opposite copies (at 290°, 150°, 40° and 200°,
  // seen through) fall between them, and the first two well apart in height
  const BALL_HOME = [[-0.205, 0.564], [0.433, -0.25], [-0.46, -0.386], [0.583, 0.212]];
  const LO = 0.04;          // in an open direction, the points stay this far inside the square
  const R = 8.5;            // the radius of a point, px
  const SNAP = 15;          // a point dropped this close to another (px) collides with it
  const SEP = 32;           // how far apart points are put when they are separated (px)
  const KMAX = 5;           // the Betti numbers are listed for up to this many points
  const TAU = 2 * Math.PI;
  const FADE = 8000;        // ms: a path fades out over this long
  const SPIN = TAU / 30000; // the 3D pictures, turning on their own: once round in 30 s
  const COUNT = ['', 'one', 'two', 'three', 'four'];
  const MULT = ['', 'simple', 'double', 'triple', 'quadruple'];

  // vectors of R³, and rotations of the 3D pictures: x right, y up, z towards the reader
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit3 = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return n < 1e-9 ? null : [a[0] / n, a[1] / n, a[2] / n]; };
  const mv = (M, v) => [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
  const mtv = (M, v) => [0, 1, 2].map((i) => M[0][i] * v[0] + M[1][i] * v[1] + M[2][i] * v[2]); // by the transpose: the inverse
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
  // S³ seen nearly along the axis of the picture (the clockwise equilateral triangles),
  // where its three-fold symmetry shows; a little off it, for depth
  const VIEW3D = mm(rotX(1.36), mm([[1, 0, 0], [0, 0, 1], [0, -1, 0]], rotZ(Math.PI / 2)));
  // the Möbius band's box: upright, seen from a little above and to the side
  const VIEWBOX = mm(rotX(0.42), rotY(-0.5));
  // the quaternion cube, the prisms and the ball of rotations: the axis of the prisms upright, seen from a little above and to the side
  const VIEWCUBE = mm(rotX(-Math.PI / 2 + 0.42), rotZ(-0.62));
  // the cube of three points on a curve (or four on the circle), and the sphere of four on the line
  const VIEWCURVE = mm(rotX(0.42), rotY(-0.7));
  const VIEWSPHERE = mm(rotX(0.55), rotY(0.4));
  // the stage's sphere: its north pole up, tipped a little towards the reader
  const VIEWBALL = rotX(-Math.PI / 2 + 0.4);
  // the sphere of directions: as the stage's, turned a little
  const VIEWDIR = mm(VIEWBALL, rotZ(-0.5));
  // the box (or cylinder) of a braid, time upright: seen from the square's bottom edge, a little
  // above it and to the side
  const VIEWBRAID = mm(rotX(0.3), rotY(-0.4));
  const VIEWS = { '3d': VIEW3D, mobius: VIEWBOX, quaternion: VIEWCUBE, cube: VIEWCURVE, sphere: VIEWSPHERE, direction: VIEWDIR, rotation: VIEWCUBE, braid: VIEWBRAID };
  // The pictures with an upright axis, which turn about it like a turntable (so that the equators
  // and the prisms' ends stay level), and tip only towards the reader or away: its index, 1 for y
  // (the boxes), 2 for z.
  const UPRIGHT = { mobius: 1, quaternion: 2, rotation: 2, direction: 2, braid: 1 };

  let example = null; // links, reset and Save image (MM.example, at the end)

  // The single source of truth; draw() renders everything from it.
  const state = {
    surface: 'plane', k: 3, ordered: true, paths: true, spin: !MM.reduceMotion(),
    pts: HOME.slice(0, 3).map((p) => p.slice()),
    order: [0, 1, 2],     // the points from the bottom of a pile to its top: a dragged point goes on top
    history: [],          // the configurations passed through lately: { pts, jump, t }
    lastMove: 0,          // when the configuration last changed
    drag: null,          // while a point is dragged: { idx, off, moved, start, id }, on a sphere also sign and side
    target: null,         // the points a dragged one would collide with if dropped now
    gen: null,            // the generator of the braid group chosen in the text (its key), or null: the first
    views: { ...VIEWS }, // the rotations of the 3D pictures
    ball: VIEWBALL,       // the rotation of the stage's sphere
    turning: null,        // while a 3D picture is turned by a drag
    rolling: null,        // while the stage's sphere is turned by a drag
    anim: null,           // a move under way, or one played back: { path, t0, T, then }
  };

  /* ---------- the configurations passed through ---------- */

  // The figure's own time: performance.now(), stopped while the figure rests (see seen()).
  let restAt = 0, rested = 0;
  const clock = () => (restAt || performance.now()) - rested;

  // A jump (a collision made or undone, a stratum chosen) is not drawn as a path.
  function record(jump) {
    const now = clock(), pts = state.pts.map((p) => p.slice()), h = state.history;
    h.push({ pts, jump: !!jump, t: now });
    state.lastMove = now;
    // forget what has faded, but keep the last configuration from before, where the paths begin
    let cut = 0;
    while (cut + 1 < h.length && h[cut + 1].t < now - FADE) cut++;
    if (cut) h.splice(0, cut);
    wake();
  }
  let clearedAt = -Infinity; // when the paths were last cleared
  function clearPaths() {
    state.history = [{ pts: state.pts.map((p) => p.slice()), jump: false, t: clock() }];
    // on a curve the paths of points at rest still grow down the stage, until they reach its foot
    const one = CS.dimOf(state.surface) === 1;
    state.lastMove = one ? clock() : -Infinity;
    clearedAt = clock();
    wake();
  }
  // 1 for now, falling to 0 for what happened FADE ago
  const fresh = (t, now) => 1 - (now - t) / FADE;

  /* ---------- paths: the configurations passed through, as a figure shows them ---------- */

  // Between two recorded configurations each point is taken to move the shortest way
  // (CS.toward). A figure shows a configuration at at(pts), a list of numbers, or nowhere (null).
  // Where it bends the path, folds it (at the wall of a chamber, where the points are put in
  // order) or takes it across a glued edge or face, the step is cut finer, so that the path turns
  // exactly at the wall and runs right up to the edge. far(p, q) says whether two places lie
  // either side of a glued edge; a chord stands for the path where it strays from it by at most tol.
  const FINE = 16; // a step is cut into at most 2^16 pieces
  const gap = (p, q) => { let t = 0; for (let i = 0; i < p.length; i++) t += (p[i] - q[i]) ** 2; return Math.sqrt(t); };
  function cutStep(a, b, at, far, tol, qa, qb) {
    const id = state.surface, out = [];
    let piece = null;
    const emit = (q0, t0, q1, t1) => {
      if (!piece || piece[piece.length - 1][0] !== q0) out.push(piece = [[q0, t0]]);
      piece.push([q1, t1]);
    };
    const go = (t0, t1, q0, q1, depth) => {
      if (!q0 && !q1) return;
      const whole = q0 && q1 && !far(q0, q1);
      if (depth >= FINE) { if (whole) emit(q0, t0, q1, t1); return; }
      const tm = (t0 + t1) / 2, qm = at(a.map((p, i) => CS.toward(id, p, b[i], tm)));
      if (whole && qm) {
        const d = gap(q0, q1), d0 = gap(q0, qm), d1 = gap(qm, q1);
        if (d0 + d1 - d <= tol && Math.abs(d0 - d1) <= tol) { emit(q0, t0, q1, t1); return; }
      }
      go(t0, tm, q0, qm, depth + 1);
      go(tm, t1, qm, q1, depth + 1);
    };
    go(0, 1, qa, qb, 0);
    return out;
  }
  // The path in a figure, as runs of [place, time]. Each configuration keeps its place, and the
  // cut step that led to it, under the figure's key: a step is cut only once.
  function pathRuns(key, at, far, tol) {
    const runs = [];
    let run = null, prev = null, before = null;
    for (const e of state.history) {
      const seen = e.seen || (e.seen = new Map());
      let mine = seen.get(key);
      if (!mine) seen.set(key, mine = { q: at(e.pts), from: null, steps: null });
      if (prev && !e.jump) {
        if (mine.from !== prev) { mine.steps = cutStep(prev.pts, e.pts, at, far, tol, before.q, mine.q); mine.from = prev; }
        const t0 = prev.t, dt = e.t - prev.t;
        for (const piece of mine.steps) {
          if (!run || run[run.length - 1][0] !== piece[0][0]) runs.push(run = [[piece[0][0], t0 + piece[0][1] * dt]]);
          for (let m = 1; m < piece.length; m++) run.push([piece[m][0], t0 + piece[m][1] * dt]);
        }
      } else run = null;
      prev = e;
      before = mine;
    }
    return runs;
  }
  // The runs cut where they pass from one step of age to the next (AGES steps), as parts
  // { pts, b }: b the step, pts the places mapped by project. Drawn each with one opacity, a part
  // has no overlapping joins.
  const AGES = 6;
  function byAge(runs, now, project) {
    const out = [];
    for (const run of runs) {
      let part = null;
      for (const [q, t] of run) {
        if (now - t >= FADE) { part = null; continue; }
        const b = Math.min(AGES - 1, Math.floor((now - t) / FADE * AGES)), p = project(q);
        if (part && part.b === b) part.pts.push(p);
        else { const last = part && part.pts[part.pts.length - 1]; out.push(part = { pts: last ? [last, p] : [p], b }); }
      }
    }
    return out.filter((part) => part.pts.length > 1);
  }
  const ageAlpha = (b) => 1 - (b + 0.5) / AGES;
  // the runs as segments [from, to, opacity], for the figures that sort what they draw by depth
  function segments(runs, now) {
    const out = [];
    for (const run of runs) for (let i = 1; i < run.length; i++) { const alpha = 0.8 * fresh(run[i][1], now); if (alpha > 0) out.push([run[i - 1][0], run[i][0], alpha]); }
    return out;
  }

  // Everything moving is drawn in the frame: a change asks for one (redraw), and while a move
  // plays, paths fade (or on a curve grow down the stage) or a picture turns, every frame draws.
  // Nothing is drawn while neither the stage nor the picture can be seen, or while a dialog
  // is open over the page (seen() comes from MM.whenVisible, at the end); then the figure's
  // clock stops too, so that paths do not fade and a move waits.
  let raf = 0, lastFrame = 0, lastFade = 0, seen = () => true;
  const dirty = { stage: false, space: false };
  function redraw() { dirty.stage = dirty.space = true; wake(); }
  function wake() { if (!raf && seen()) { lastFrame = 0; raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
    if (!seen()) return;
    const dt = lastFrame ? Math.min(64, now - lastFrame) : 16, kind = kindNow(), time = clock();
    lastFrame = now;
    let ended = false;
    if (state.anim) {
      const a = state.anim, t = Math.min(1, (time - a.t0) / a.T);
      a.t = t;
      state.pts = a.path(t);
      record(false);
      if (example) example.changed();
      dirty.stage = dirty.space = true;
      if (t >= 1) { state.anim = null; ended = true; if (a.then) a.then(); }
    }
    const spin = state.spin && !!turnable(), spinning = spin && !state.turning;
    const fading = state.paths && !MM.reduceMotion() && time - state.lastMove < FADE + 300;
    if (spinning) {
      // those with an upright axis turn about it; the others about the vertical of the screen
      const up = UPRIGHT[kind], a = SPIN * dt;
      state.views[kind] = up === undefined ? mm(rotY(a), state.views[kind]) : mm(state.views[kind], up === 1 ? rotY(a) : rotZ(a));
    }
    if (braidPlay && braidLive() !== copyLive) drawBraidCopy(chosenGen(generators()));
    if (ended) draw(); // the readouts too: the move may have changed the stratum
    else {
      // a curve's worldlines move down the stage all the time; other paths fade in steps
      if (dirty.stage) { lastFade = now; dirty.stage = false; drawStage(); }
      else if (fading && (G.one || now - lastFade > 90)) { lastFade = now; drawPaths(); }
      if (dirty.space || spinning || fading) { dirty.space = false; drawSpace(); }
    }
    // (a step of a move, recorded above, may have asked for the next frame already)
    if ((spin || fading || state.anim) && !raf) raf = requestAnimationFrame(tick);
  }

  /* ---------- the stage ---------- */

  // A curve: the interval across the stage near its top (y0), and below it the paths, older lower
  // (time going up). A square surface: the square, with margins m for the squares beside it. A sphere: centre
  // (cx, cy), radius R. unit: a length of the model, in px.
  let G = { W: 400, H: 400, m: 52, S: 296, y0: 0, one: false, ball: false, R: 160, cx: 200, cy: 200, unit: 296 };
  const modelOf = (id) => (CS.dimOf(id) === 1 ? 'curve' : CS.SURFACES[id].ball ? 'ball' : 'square');
  function layout() {
    const W = Math.max(220, Math.round(stage.getBoundingClientRect().width) || 400), model = modelOf(state.surface), one = model === 'curve', ball = model === 'ball';
    // a curve without its paths needs only a strip
    const m = Math.round(Math.min(84, Math.max(38, W * 0.13))), H = one ? Math.round(W * (state.paths ? 14 : 5) / 25) : W;
    const R2 = Math.round(W / 2 - Math.max(30, W * 0.08));
    G = { W, H, m, S: W - 2 * m, y0: state.paths ? Math.round(Math.min(58, H * 0.24)) : Math.round(H * 0.6), one, ball, R: R2, cx: W / 2, cy: W / 2 };
    G.unit = ball ? G.R : G.S;
    stagebox.classList.toggle('is-1d', one);
    stagebox.classList.toggle('is-strip', one && !state.paths);
    const s = CS.SURFACES[state.surface];
    stage.setAttribute('aria-label', one
      ? 'The ' + s.name + ' as an interval' + (s.x ? ' with its ends glued' : ', open at both ends') + ', and the points on it' + (state.paths ? ', with their paths below it as time goes on' : '') + '. Drag a point, or move it with the left and right arrow keys.'
      : ball ? (s.antipodal ? 'The projective plane as a sphere whose opposite points are the same point, so that each point shows twice, and the points on it.' : 'The sphere, and the points on it; its far side shows through, fainter.') + ' Drag a point, or move it with the arrow keys; drag the sphere to turn it.'
        : 'The ' + s.name + ' as a square with its edges glued as the arrows say, and the points on it. Drag a point, or move it with the arrow keys.');
    stage.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  const sx = (x) => G.m + x * G.S, sy = (y) => (G.one ? G.y0 : G.m + (1 - y) * G.S);
  // the pointer, in the stage's own units
  function stageXY(e) {
    const r = stage.getBoundingClientRect(), f = G.W / (r.width || G.W);
    return [(e.clientX - r.left) * f, (e.clientY - r.top) * f];
  }
  function toModel(e) { const [x, y] = stageXY(e); return [(x - G.m) / G.S, 1 - (y - G.m) / G.S]; }
  // a point of the sphere on the stage: [x, y, depth], depth from −1 (far) to 1 (near)
  const onBall = (p) => { const v = mv(state.ball, p); return [G.cx + G.R * v[0], G.cy - G.R * v[1], v[2]]; };
  // the place on the sphere under the stage point (x, y), on its near side (side 1) or its far
  // side (−1); off the sphere, on its rim
  function ballAt(x, y, side) {
    let u = (x - G.cx) / G.R, v = (G.cy - y) / G.R;
    const n = Math.hypot(u, v);
    if (n > 1) { u /= n; v /= n; }
    return mtv(state.ball, [u, v, side * Math.sqrt(Math.max(0, 1 - u * u - v * v))]);
  }
  // a frame of the plane touching the sphere at c: e₁ towards p, or with no p across the screen; e₂ = c × e₁
  function tangent(c, p) {
    const off = (v) => unit3(v.map((x, i) => x - dot3(c, v) * c[i]));
    const e = (p && off(p)) || off(state.ball[0]) || off(state.ball[1]);
    return [e, cross3(c, e)];
  }
  // on a sphere, the point at angle rho from c, in the direction th from e₁ towards e₂
  const around = (c, e1, e2, rho, th) => c.map((x, i) => Math.cos(rho) * x + Math.sin(rho) * (Math.cos(th) * e1[i] + Math.sin(th) * e2[i]));

  const same = (p, q) => CS.dist(state.surface, p, q) < 1e-9;
  // the points grouped by place: each group a collision, or a single point
  function clusters() {
    const out = [];
    state.pts.forEach((p, i) => {
      const c = out.find((x) => same(x.p, p));
      if (c) c.idx.push(i); else out.push({ p, idx: [i] });
    });
    return out;
  }
  // the stratum: the set partition of the labels by place, blocks by least label
  const partition = () => clusters().map((c) => c.idx.slice().sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
  // of the points of a collision, the one on top of the pile: the last dragged, which a drag pulls out
  const topOf = (idx) => idx.reduce((a, b) => (state.order.indexOf(b) > state.order.indexOf(a) ? b : a));
  const raise = (i) => { state.order = state.order.filter((j) => j !== i).concat([i]); };

  const pointName = (idx) => idx.map((i) => 'x_{' + (i + 1) + '}').join('=');
  const plainName = (idx) => idx.map((i) => 'x' + (i + 1)).join(' = ');

  // the arrows on a glued edge from a to b (screen points), pointing along it, n of them
  function arrowPath(a, b, dir, n) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / len * dir, dy = (b[1] - a[1]) / len * dir;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let d = '';
    for (let j = 0; j < n; j++) {
      const o = (j - (n - 1) / 2) * 7, cx = mx + dx * o, cy = my + dy * o;
      d += 'M' + (cx - dx * 4 - dy * 5) + ' ' + (cy - dy * 4 + dx * 5) + 'L' + (cx + dx * 4) + ' ' + (cy + dy * 4) + 'L' + (cx - dx * 4 + dy * 5) + ' ' + (cy - dy * 4 - dx * 5);
    }
    return d;
  }
  // the four edges of a square, glued as the surface says: [a, b, glued, direction, number of arrows], in model coordinates
  function edgesOf(s, x0, y0, x1, y1) {
    return [
      [[x0, y0], [x0, y1], s.x, 1, 1], [[x1, y0], [x1, y1], s.x, s.x === 'flip' ? -1 : 1, 1],
      [[x0, y0], [x1, y0], s.y, 1, 2], [[x0, y1], [x1, y1], s.y, s.y === 'flip' ? -1 : 1, 2],
    ];
  }

  // The line or the circle: the interval with its ends open or glued (the circle carried on, faded,
  // past each end), and under it each point's path, older lower and paler (time going up).
  function drawCurve() {
    const s = CS.SURFACES[state.surface], nb = CS.neighbours(state.surface), y = G.y0;
    for (const n of nb) el('line', { class: 'cs-copy', x1: sx(n.dx), y1: y, x2: sx(n.dx + 1), y2: y }, stage);
    const grad = el('linearGradient', { id: 'cs-fade', gradientUnits: 'userSpaceOnUse', x1: 0, y1: y, x2: 0, y2: G.H - 8 }, el('defs', {}, stage));
    el('stop', { class: 'cs-fade-stop', offset: 0, 'stop-opacity': 0.85 }, grad);
    el('stop', { class: 'cs-fade-stop', offset: 1, 'stop-opacity': 0 }, grad);
    el('g', { class: 'cs-paths' }, stage);
    el('line', { class: 'cs-curve', x1: sx(0), y1: y, x2: sx(1), y2: y }, stage);
    // the ends: glued, the same point (solid), or open (dashed)
    for (const x of [0, 1]) el('line', { class: 'cs-edge' + (s.x ? '' : ' open'), x1: sx(x), y1: y - 9, x2: sx(x), y2: y + 9 }, stage);
  }
  function curvePaths(group) {
    const nb = CS.neighbours(state.surface), y = G.y0, bottom = G.H - 8;
    const now = clock(), T = (t) => y + (now - t) / FADE * (bottom - y), last = state.history[state.history.length - 1];
    const ghosts = el('g', { class: 'cs-ghost' }, group);
    for (let i = 0; i < state.k; i++) {
      const key = 'st' + i, runs = pathRuns(key, (pts) => [pts[i][0]], (p, q) => Math.abs(p[0] - q[0]) > 0.3, 1e-3);
      // a point at rest goes straight down: its path runs on to now
      const end = last.seen.get(key).q, r = runs[runs.length - 1];
      if (r && r[r.length - 1][0] === end) r.push([end, now]); else runs.push([[end, last.t], [end, now]]);
      for (const run of runs) {
        // only what is still on the stage
        let from = 0;
        while (from < run.length - 1 && now - run[from + 1][1] > FADE) from++;
        if (run.length - from < 2) continue;
        const path = (dx) => { let d = ''; for (let j = from; j < run.length; j++) d += (j > from ? 'L' : 'M') + sx(run[j][0][0] + dx).toFixed(1) + ' ' + T(run[j][1]).toFixed(1); return d; };
        for (const n of nb) el('path', { class: 'cs-trail is-time', d: path(n.dx) }, ghosts);
        el('path', { class: 'cs-trail is-time', d: path(0) }, group);
      }
    }
  }
  // The paths on the stage are in groups of their own, so that while they fade (or on a curve grow
  // down the stage) they are redrawn alone, and the points, and the focus, stay as they are.
  function drawPaths() {
    const groups = stage.querySelectorAll('.cs-paths');
    for (const g of groups) g.textContent = '';
    if (!state.paths || !groups.length) return;
    if (G.one) curvePaths(groups[0]);
    else if (G.ball) ballPaths(groups[0], groups[1]);
    else squarePaths(groups[0]);
  }

  function drawStage() {
    const active = document.activeElement, focus = active && stage.contains(active) ? +active.dataset.key : null;
    stage.textContent = '';
    const cl = clusters();
    if (G.ball) drawBall(cl);
    else {
      const nb = CS.neighbours(state.surface);
      if (G.one) drawCurve(); else drawSquare();
      drawPaths();
      // the points: their copies across the edges first, faded, then the points themselves
      cl.forEach((c, ci) => nb.forEach((n, t) => {
        const q = n.f(c.p), X = sx(q[0]), Y = sy(q[1]);
        if (X > -R && X < G.W + R && Y > -R && Y < G.H + R) drawPoint(c, ci, t, X, Y);
      }));
      if (state.drag && state.target) {
        const p = state.pts[state.target[0]];
        el('circle', { class: 'snap-ring', cx: sx(p[0]), cy: sy(p[1]), r: R + 8 }, stage);
      }
      cl.forEach((c, ci) => drawPoint(c, ci, -1, sx(c.p[0]), sy(c.p[1])));
    }
    if (focus !== null) {
      const ci = cl.findIndex((c) => c.idx.includes(focus)), again = stage.querySelector('[data-c="' + ci + '"][data-t="-1"]');
      if (again) again.focus({ preventScroll: true });
    }
  }

  // A surface: the square, the squares beside it faded, the paths, and the edges.
  function drawSquare() {
    const s = CS.SURFACES[state.surface], nb = CS.neighbours(state.surface);
    for (const n of nb) el('rect', { class: 'cs-tile', x: sx(n.dx), y: sy(n.dy + 1), width: G.S, height: G.S }, stage);
    for (const n of nb) el('rect', { class: 'cs-tile-edge', x: sx(n.dx), y: sy(n.dy + 1), width: G.S, height: G.S }, stage);
    el('rect', { class: 'cs-square', x: sx(0), y: sy(1), width: G.S, height: G.S }, stage);

    // the paths (squarePaths)
    el('g', { class: 'cs-paths' }, stage);

    // the edges: glued ones with their arrows (one pair single, the other double), open ones dashed
    for (const [a, b, glue, dir, n] of edgesOf(s, 0, 0, 1, 1)) {
      const A = [sx(a[0]), sy(a[1])], B = [sx(b[0]), sy(b[1])];
      el('line', { class: 'cs-edge' + (glue ? '' : ' open'), x1: A[0], y1: A[1], x2: B[0], y2: B[1] }, stage);
      if (glue) el('path', { class: 'cs-arrow', d: arrowPath(A, B, dir, n) }, stage);
    }
  }

  // the paths, fading with age, and their copies across the glued edges
  function squarePaths(group) {
    const now = clock(), nb = CS.neighbours(state.surface), ghosts = el('g', { class: 'cs-ghost' }, group);
    for (let i = 0; i < state.k; i++) {
      const runs = pathRuns('st' + i, (pts) => pts[i], (p, q) => Math.abs(p[0] - q[0]) > 0.3 || Math.abs(p[1] - q[1]) > 0.3, 1e-3);
      for (const { pts, b } of byAge(runs, now, (q) => q)) {
        const op = ageAlpha(b).toFixed(2);
        const path = (f) => pts.map((p, j) => { const q = f ? f(p) : p; return (j ? 'L' : 'M') + sx(q[0]).toFixed(1) + ' ' + sy(q[1]).toFixed(1); }).join('');
        for (const n of nb) el('path', { class: 'cs-trail', d: path(n.f), 'stroke-opacity': op }, ghosts);
        el('path', { class: 'cs-trail', d: path(), 'stroke-opacity': op }, group);
      }
    }
  }

  // The sphere, or the projective plane as a sphere whose opposite points are the same point. It
  // is seen through: its far half first, under a pale disc, then its near half. A graticule (the
  // equator, two parallels and eight meridians) shows how it is turned. On the projective plane
  // each point and each path shows twice, opposite: the nearer copy is the point itself.
  const GRID = (() => {
    const out = [], n = 96, d = Math.PI / 180;
    for (const lat of [-40, 0, 40]) out.push(Array.from({ length: n + 1 }, (_, m) => [Math.cos(lat * d) * Math.cos(TAU * m / n), Math.cos(lat * d) * Math.sin(TAU * m / n), Math.sin(lat * d)]));
    for (const lon of [0, 45, 90, 135]) out.push(Array.from({ length: n + 1 }, (_, m) => [Math.cos(TAU * m / n) * Math.cos(lon * d), Math.cos(TAU * m / n) * Math.sin(lon * d), Math.sin(TAU * m / n)]));
    return out;
  })();
  // a curve on the sphere (places in the model) on the stage, cut where it passes between the near and the far side
  function ballRuns(pts) {
    const out = [];
    let run = null;
    for (const p of pts) {
      const q = onBall(p), near = q[2] >= 0;
      if (run && run.near === near) run.pts.push(q);
      else { const from = run && run.pts[run.pts.length - 1]; out.push(run = { near, pts: from ? [from, q] : [q] }); }
    }
    return out;
  }
  const dOf = (pts) => pts.map((q, j) => (j ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
  function drawBall(cl) {
    const s = CS.SURFACES[state.surface], signs = s.antipodal ? [1, -1] : [1];
    // the handle for turning the sphere, under everything; then the far half, the disc, the near half
    el('circle', { class: 'cs-turn draggable', cx: G.cx, cy: G.cy, r: G.R + 6 }, stage);
    const farG = el('g', {}, stage);
    el('circle', { class: 'cs-ball', cx: G.cx, cy: G.cy, r: G.R }, stage);
    const nearG = el('g', {}, stage);
    el('circle', { class: 'cs-rim', cx: G.cx, cy: G.cy, r: G.R }, stage);
    for (const c of GRID) for (const r of ballRuns(c)) el('path', { class: 'cs-grid', d: dOf(r.pts) }, r.near ? nearG : farG);
    // the paths (ballPaths), on each side
    el('g', { class: 'cs-paths' }, farG);
    el('g', { class: 'cs-paths' }, nearG);
    drawPaths();
    if (state.drag && state.target) {
      const p = state.pts[state.target[0]];
      for (const sg of signs) { const q = onBall(p.map((x) => sg * x)); el('circle', { class: 'snap-ring', cx: q[0], cy: q[1], r: R + 8 }, q[2] < 0 ? farG : stage); }
    }
    // the points: the far ones under the disc (they can still be dragged), the near ones on top
    cl.forEach((c, ci) => {
      const copies = signs.map((sg) => ({ sg, q: onBall(c.p.map((x) => sg * x)) })).sort((u, v) => v.q[2] - u.q[2]);
      copies.forEach((cp, t) => drawPoint(c, ci, t ? 0 : -1, cp.q[0], cp.q[1], { far: cp.q[2] < 0, sign: cp.sg, parent: cp.q[2] < 0 ? farG : stage }));
    });
  }

  function ballPaths(farG, nearG) {
    const now = clock(), signs = CS.SURFACES[state.surface].antipodal ? [1, -1] : [1];
    for (let i = 0; i < state.k; i++) {
      const runs = pathRuns('st' + i, (pts) => pts[i], (p, q) => gap(p, q) > 1, 2e-3);
      for (const sg of signs) {
        for (const { pts, b } of byAge(runs, now, (q) => (sg > 0 ? q : q.map((x) => -x)))) {
          for (const r of ballRuns(pts)) el('path', { class: 'cs-trail', d: dOf(r.pts), 'stroke-opacity': ageAlpha(b).toFixed(2) }, r.near ? nearG : farG);
        }
      }
    }
  }

  function drawPoint(c, ci, tile, X, Y, opt = {}) {
    const ghost = tile >= 0, m = c.idx.length, r = m > 1 ? R + 2.5 : R;
    const g = el('g', { class: 'cs-pt draggable' + (ghost && !G.ball ? ' cs-ghost' : '') + (opt.far ? ' is-far' : ''), 'data-c': ci, 'data-t': tile, 'data-s': opt.sign || 1 }, opt.parent || stage);
    if (!ghost) {
      g.setAttribute('tabindex', 0);
      g.setAttribute('role', 'button');
      // the point a drag or the arrow keys would move: of a collision, the one on top
      g.dataset.key = topOf(c.idx);
      const who = state.ordered ? (m > 1 ? 'Collision of ' + plainName(c.idx) : 'Point ' + plainName(c.idx)) : (m > 1 ? 'A ' + MULT[m] + ' point, ' + plainName(c.idx) : 'A point, ' + plainName(c.idx));
      // on a sphere, where the copy drawn is: on the projective plane the nearer of the two
      const deg = (x) => Math.round(x * 180 / Math.PI) + '°', q = c.p.map((x) => (opt.sign || 1) * x);
      const where = G.ball ? 'latitude ' + deg(Math.asin(Math.max(-1, Math.min(1, q[2])))) + ', longitude ' + deg(Math.atan2(q[1], q[0]))
        : c.p[0].toFixed(2) + (G.one ? '' : ', ' + c.p[1].toFixed(2));
      g.setAttribute('aria-label', who + ', at ' + where + '. ' + (G.one ? 'The left and right arrow keys move it' : 'Arrow keys move it') + (m > 1 ? ', ' + plainName([topOf(c.idx)]) + ' out of the collision' : '') + '.');
    }
    el('circle', { class: 'cs-pad', cx: X, cy: Y, r: r + 8 }, g);
    if (!ghost) el('circle', { class: 'focus-ring', cx: X, cy: Y, r: r + 4 }, g);
    el('circle', { class: 'handle-point', cx: X, cy: Y, r }, g);
    if (m > 1) el('text', { class: 'handle-num', x: X, y: Y + 3.8 }, g).textContent = m;
    // the name, above and to the right if there is room; a copy cut by the frame has none.
    // Unordered points are named too, more faintly, so that one can follow them and the moves.
    if (!ghost || (X > R && X < G.W - R && Y > R && Y < G.H - R)) {
      const right = X < G.W - 64, up = Y > 30;
      const t = el('text', { class: 'cs-name halo' + (state.ordered ? '' : ' faint'), x: X + (right ? 1 : -1) * (r + 3), y: Y + (up ? -r + 1 : r + 12), 'text-anchor': right ? 'start' : 'end' }, g);
      MM.svgLabel(t, '$' + pointName(c.idx) + '$');
    }
  }

  /* ---------- the picture of the space ---------- */

  // '3d': S³ for three points in the plane; '2d': the relative position of two points on the
  // plane, cylinder or torus; 'mobius': two points on the Möbius band; 'quaternion': two on the
  // projective plane; 'direction' and 'rotation': two and three on the sphere; for the curves
  // 'square', 'cube' and 'sphere'; null where there is none
  const kindNow = () => CS.picture(state.surface, state.k);
  // the pictures that turn
  const turnable = () => {
    const k = kindNow();
    return k === '3d' || k === 'mobius' || k === 'quaternion' || k === 'cube' || k === 'rotation' || ((k === 'sphere' || k === 'direction') && state.ordered) ? k : null;
  };
  // the pictures drawn in a square canvas, also on a phone
  const boxed = (k) => k === 'mobius' || k === 'quaternion' || k === 'square' || k === 'cube' || k === 'sphere' || k === 'direction' || k === 'rotation';
  // the configuration in the picture: a point of R³, or of the plane of relative positions
  function spacePoint(pts, kind) {
    if (kind === '3d') return CS.point3(pts, state.ordered);
    const d = CS.relative(state.surface, pts[0], pts[1]);
    if (state.surface !== 'plane' || state.ordered) return d;
    // unordered, on the plane: (x₂ − x₁)², drawn with the radius |x₂ − x₁| and the angle doubled
    const r = Math.hypot(d[0], d[1]), a = 2 * Math.atan2(d[1], d[0]);
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  function sizeSpace() {
    const r = spaceCv.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    MM.fitCanvas(spaceCv, w, h);
    return [w, h];
  }
  function line(a, b, cx = sctx) { cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); }
  // (on the braid canvas, in a strand's colour)
  function dot(p, r, hollow, cx = sctx, col = MM.color('cs-config')) {
    cx.beginPath();
    cx.arc(p[0], p[1], r + 2, 0, TAU);
    cx.fillStyle = MM.color('surface');
    cx.fill();
    cx.beginPath();
    cx.arc(p[0], p[1], r, 0, TAU);
    if (hollow) { cx.lineWidth = 2; cx.strokeStyle = col; cx.stroke(); } else { cx.fillStyle = col; cx.fill(); }
  }
  // a label with a pale box behind it, kept inside the canvas
  function boxLabel(text, x, y, w, h, align, size = 13) {
    const lw = MM.measureLabel(sctx, text, size);
    let left = align === 'right' ? x - lw : align === 'center' ? x - lw / 2 : x;
    left = Math.max(4, Math.min(w - lw - 4, left));
    y = Math.max(10, Math.min(h - 10, y));
    sctx.fillStyle = MM.rgba('surface', 0.85);
    sctx.fillRect(left - 3, y - size * 0.7, lw + 6, size * 1.4);
    MM.canvasLabel(sctx, text, left, y, { size, baseline: 'middle', color: MM.color('ink-2') });
  }
  // A perspective view of R³ fitted to the canvas: a point → [x, y, depth], depth −1 (far) to 1 (near).
  function camera(view, rad, w, h, fill, D = 14) { // (D: the eye, this many times rad away; a little perspective)
    const scale = fill * Math.min(w, h) / rad, cx = w / 2, cy = h / 2;
    return (p) => { const v = mv(view, p), f = D / (D - v[2] / rad); return [cx + scale * f * v[0], cy - scale * f * v[1], v[2] / rad]; };
  }
  // Depth-sorted segments, each with a halo of the page colour, so that whatever is in
  // front hides what passes behind it; and dots.
  // Further away, or older, is paler: the colour mixed with the page's, rather than drawn
  // transparent, so that where the round ends of two segments overlap they do not show darker.
  function paint(items, cx = sctx) {
    items.sort((a, b) => a.z - b.z);
    const paper = MM.color('surface'), white = rgbOf('surface'), rgbs = new Map();
    for (const it of items) {
      if (it.dot) { dot(it.dot, it.r || 5.5, it.far, cx, it.col); continue; }
      cx.setLineDash(it.dash || []);
      if (it.halo) {
        cx.lineCap = 'butt';
        cx.strokeStyle = paper;
        cx.lineWidth = it.w + it.halo;
        line(it.a, it.b, cx);
      }
      if (!rgbs.has(it.col)) rgbs.set(it.col, it.col.match(/[\d.]+/g).map(Number).slice(0, 3));
      const a = it.alpha === undefined ? Math.max(0.45, Math.min(1, 0.7 + 0.3 * it.z)) : it.alpha;
      cx.lineCap = 'round';
      cx.strokeStyle = a >= 1 ? it.col : mix(rgbs.get(it.col), white, 1 - a);
      cx.lineWidth = it.w;
      line(it.a, it.b, cx);
    }
    cx.setLineDash([]);
  }
  // the path, fading, as polylines on the canvas: P maps a place to the canvas
  function strokeAged(runs, now, P, scale = 1) {
    for (const { pts, b } of byAge(runs, now, P)) {
      sctx.globalAlpha = 0.8 * scale * ageAlpha(b);
      trace(pts);
      sctx.stroke();
    }
    sctx.globalAlpha = 1;
  }
  const oKey = () => (state.ordered ? 'o' : 'u');
  const radius = new Map(); // the size of the curves, to fit them to the canvas
  function draw3d(w, h, onPair) {
    const curves = CS.collisionCurves(state.ordered, 240), key = String(state.ordered), now = clock();
    if (!radius.has(key)) radius.set(key, Math.max(...curves.flatMap((c) => c.pts.map((p) => Math.hypot(p[0], p[1], p[2])))));
    const rad = radius.get(key), proj = camera(state.views['3d'], rad, w, h, 0.44), cx = w / 2, cy = h / 2;
    const items = [], projected = [];
    curves.forEach((c) => {
      const col = MM.color(state.ordered ? 'cs-c' + (c.pair[0] + 1) + (c.pair[1] + 1) : 'cs-knot');
      const on = onPair && (!state.ordered || (onPair[0] === c.pair[0] && onPair[1] === c.pair[1]));
      const P = c.pts.map(proj);
      projected.push(P);
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; items.push({ z: (a[2] + b[2]) / 2, a, b, col, w: on ? 4.6 : 3, halo: 4.5 }); }
    });
    if (state.paths) {
      // far out the path leaves the picture: no line through infinity
      const col = MM.color('cs-config'), at = (pts) => { const p = CS.point3(pts, state.ordered); return p && Math.hypot(p[0], p[1], p[2]) < 10 * rad ? p : null; };
      for (const [p, q, alpha] of segments(pathRuns('3d' + oKey(), at, (u, v) => gap(u, v) > 0.8 * rad, 2e-3 * rad), now)) {
        const a = proj(p), b = proj(q);
        items.push({ z: (a[2] + b[2]) / 2, a, b, col, w: 1.8, halo: 3, alpha });
      }
    }
    const cur = CS.point3(state.pts, state.ordered);
    if (cur) {
      let q = proj(cur), far = false;
      const dx = q[0] - cx, dy = q[1] - cy, lim = 0.47 * Math.min(w, h), d = Math.hypot(dx, dy);
      if (Math.hypot(cur[0], cur[1], cur[2]) > 4 * rad || d > lim) { far = true; q = [cx + dx / d * lim, cy + dy / d * lim, q[2]]; }
      items.push({ z: q[2] + 1e-6, dot: q, far });
    }
    paint(items);
    // each circle named where it is furthest out (the trefoil is named in the legend)
    if (state.ordered) {
      curves.forEach((c, ci) => {
        let best = null, bd = -1;
        for (const q of projected[ci]) { const d = Math.hypot(q[0] - cx, q[1] - cy); if (d > bd) { bd = d; best = q; } }
        const ux = (best[0] - cx) / bd, uy = (best[1] - cy) / bd;
        boxLabel('$' + pointName(c.pair) + '$', best[0] + ux * 18, best[1] + uy * 18, w, h, ux > 0.35 ? 'left' : ux < -0.35 ? 'right' : 'center');
      });
    }
    return cur;
  }
  function draw2d(w, h) {
    const id = state.surface, s = CS.SURFACES[id], plane = id === 'plane', now = clock();
    // relative positions: on the plane within a disc of radius √2 (the window's differences, angles
    // doubled or not), on the cylinder [−½, ½] × [−1, 1], on the torus [−½, ½]²
    const X1 = plane ? 1.45 : 0.5, Y1 = plane ? 1.45 : s.y ? 0.5 : 1, pad = 24;
    const sc = Math.min((w - 2 * pad) / (2 * X1), (h - 2 * pad) / (2 * Y1)), cx = w / 2, cy = h / 2;
    const P = (d) => [cx + sc * d[0], cy - sc * d[1]];
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    if (plane) {
      sctx.setLineDash([5, 5]);
      sctx.strokeStyle = MM.color('cs-open');
      sctx.lineWidth = 1.2;
      sctx.beginPath();
      sctx.arc(cx, cy, sc * X1, 0, TAU);
      sctx.stroke();
      sctx.setLineDash([]);
    } else {
      for (const [a, b, glue, dir, n] of edgesOf(s, -X1, -Y1, X1, Y1)) {
        const A = P(a), B = P(b);
        sctx.setLineDash(glue ? [] : [5, 5]);
        sctx.strokeStyle = MM.color(glue ? 'cs-edge' : 'cs-open');
        sctx.lineWidth = glue ? 1.6 : 1.2;
        line(A, B);
        sctx.setLineDash([]);
        if (glue) sctx.stroke(new Path2D(arrowPath(A, B, dir, n)));
      }
    }
    // the collision: the puncture at 0
    const O = P([0, 0]);
    sctx.beginPath();
    sctx.arc(O[0], O[1], 6.5, 0, TAU);
    sctx.fillStyle = MM.color('surface');
    sctx.fill();
    sctx.lineWidth = 2.4;
    sctx.strokeStyle = MM.color('cs-c12-line');
    sctx.stroke();
    // the path, fading, and for unordered points on the cylinder or torus also its image under d ↦ −d
    const signs = !state.ordered && !plane ? [1, -1] : [1];
    if (state.paths) {
      sctx.strokeStyle = MM.color('cs-config');
      sctx.lineWidth = 1.8;
      for (const sg of signs) {
        const at = (pts) => { const d = spacePoint(pts, '2d'); return [sg * d[0], sg * d[1]]; };
        strokeAged(pathRuns('2d' + oKey() + sg, at, (p, q) => Math.abs(p[0] - q[0]) >= X1 || Math.abs(p[1] - q[1]) >= Y1, 1e-3), now, P);
      }
    }
    const d = spacePoint(state.pts, '2d');
    for (const sg of signs) dot(P([sg * d[0], sg * d[1]]), 5.5);
  }
  // Two points on the Möbius band, up to homotopy (CS.mobiusPair): a box whose square is
  // where x₂ is as seen from x₁, kept at its centre, and whose height is where x₁ is along
  // the band. Its sides are glued as the band's, front and back are the band's open ends,
  // and the top is glued to the bottom turned front to back (once round the band turns it
  // over). The collisions are the vertical line through the middle.
  const BOXH = 1.3; // the height of the box, in sides of the square
  function drawMobius(w, h, together) {
    const now = clock(), o = state.ordered;
    const at3 = (q) => [q[0] - 0.5, (q[2] - 0.5) * BOXH, 0.5 - q[1]];
    const rad = Math.hypot(0.5, BOXH / 2, 0.5), proj = camera(state.views.mobius, rad, w, h, 0.47);
    const items = [], ink = MM.color('cs-edge'), faint = MM.color('cs-open');
    const seg = (p, q, col, wd, extra) => { const a = proj(at3(p)), b = proj(at3(q)); items.push(Object.assign({ z: (a[2] + b[2]) / 2, a, b, col, w: wd, halo: 0, alpha: 1 }, extra)); };
    // the box: the band's glued sides solid, its open ends dashed
    for (const x of [0, 1]) for (const y of [0, 1]) seg([x, y, 0], [x, y, 1], faint, 1, { dash: [4, 4] });
    for (const s of [0, 1]) {
      for (const x of [0, 1]) seg([x, 0, s], [x, 1, s], ink, 1.4);
      for (const y of [0, 1]) seg([0, y, s], [1, y, s], faint, 1, { dash: [4, 4] });
    }
    // the collisions, x₁ = x₂: the vertical line through the middle
    const line3 = MM.color('cs-c12');
    for (let i = 0; i < 48; i++) seg([0.5, 0.5, i / 48], [0.5, 0.5, (i + 1) / 48], line3, together ? 4.6 : 3, { halo: 4.5, alpha: undefined });
    // the path, fading, and for unordered points also that of the pair in the other order
    const orders = o ? [[0, 1]] : [[0, 1], [1, 0]];
    if (state.paths) {
      const red = MM.color('cs-config');
      for (const [i, j] of orders) {
        const at = (pts) => CS.mobiusPair(pts[i], pts[j]);
        for (const [p, q, alpha] of segments(pathRuns('mob' + i + j, at, (u, v) => u.some((x, c) => Math.abs(x - v[c]) >= 0.5), 1e-3), now)) {
          const a = proj(at3(p)), b = proj(at3(q));
          items.push({ z: (a[2] + b[2]) / 2, a, b, col: red, w: 1.8, halo: 3, alpha });
        }
      }
    }
    for (const [i, j] of orders) { const q = proj(at3(CS.mobiusPair(state.pts[i], state.pts[j]))); items.push({ z: q[2] + 1e-6, dot: q }); }
    paint(items);
    // the arrows of the band's gluing, on the top and bottom faces: the left side to the back, the right to the front
    sctx.strokeStyle = ink;
    sctx.lineWidth = 1.4;
    sctx.lineJoin = 'round';
    for (const s of [0, 1]) for (const x of [0, 1]) sctx.stroke(new Path2D(arrowPath(proj(at3([x, 0, s])), proj(at3([x, 1, s])), x ? -1 : 1, 1)));
  }

  // A quotient S³/Dic_4n as its prism (CS.prism): the cube for two points on the projective plane
  // (S³/Q₈, n = 2), the octagonal prism for two unordered ones (S³/Q₁₆, n = 4), the hexagonal prism
  // for three unordered points on the sphere (S³/Dic₁₂, n = 3). Each face is glued to the opposite
  // one after a turn: on the cube the edges are glued in threes, and the arrows say how (the number
  // of arrows is the class); the prisms have too many classes for arrows, and their legend says it
  // in words. The collisions are not in it. at(pts) is the configuration's place, or null while
  // two points collide; returns whether there is one.
  function drawPrism(w, h, n, at, key) {
    const now = clock(), P = CS.prism(n), proj = camera(state.views[kindNow()], Math.hypot(P.r, P.h), w, h, 0.42);
    const items = [], ink = MM.color('cs-edge');
    for (const e of P.edges) { const a = proj(e.from), b = proj(e.to); items.push({ z: (a[2] + b[2]) / 2, a, b, col: ink, w: 1.4, halo: 0 }); }
    if (state.paths) {
      const red = MM.color('cs-config');
      for (const [p, q, alpha] of segments(pathRuns(key, at, (u, v) => gap(u, v) > P.h, 2e-3), now)) {
        const a = proj(p), b = proj(q);
        items.push({ z: (a[2] + b[2]) / 2, a, b, col: red, w: 1.8, halo: 3, alpha });
      }
    }
    const c = at(state.pts);
    if (c) { const q = proj(c); items.push({ z: q[2] + 1e-6, dot: q }); }
    paint(items);
    if (n === 2) {
      sctx.strokeStyle = ink;
      sctx.lineWidth = 1.4;
      sctx.lineJoin = 'round';
      for (const e of P.edges) sctx.stroke(new Path2D(arrowPath(proj(e.from), proj(e.to), e.dir, e.n)));
    }
    return !!c;
  }

  // A sphere seen through, as on the stage: a graticule, its far half (back) paler, under the
  // outline, which comes with the near half.
  function sphereGrid(proj, c0, rad, back) {
    const paper = rgbOf('surface'), rule = rgbOf('rule');
    if (!back) { sctx.strokeStyle = MM.color('rule'); sctx.lineWidth = 1; sctx.beginPath(); sctx.arc(c0[0], c0[1], rad, 0, TAU); sctx.stroke(); }
    sctx.strokeStyle = mix(rule, paper, back ? 0.55 : 0);
    sctx.lineWidth = 1;
    for (const g of GRID) for (const r of sides(g.map(proj))) if (r.back === back) { trace(r.pts); sctx.stroke(); }
  }
  // Where opposite points of the boundary are glued (the disc of lines, the ball of rotations), a
  // place x near it lies just as near the opposite point, across the boundary (CS.across): on the
  // line from x through the centre, as far beyond the boundary as x is inside it. Within PAST of the
  // boundary the configuration shows there too, paler the further out, and on the boundary both
  // images alike; a dashed line through the centre, which is marked, joins the two. The path shows
  // there within TRAIL, enough for both sides of a crossing. The disc and the ball are ROOM of the
  // canvas across, so that what shows beyond them fits.
  const PAST = 0.5, TRAIL = 0.25, ROOM = 0.3;
  const across = (x) => (Math.hypot(...x) > 1 - PAST ? CS.across(x) : null);
  // 1 on the boundary, 0 at `past` inside
  const nearness = (x, past = PAST) => Math.max(0, Math.min(1, (Math.hypot(...x) - 1 + past) / past));
  // the path across the boundary: segment by segment, each a solid colour mixed with the page's
  // (its opacity changes along it), so drawn under the path itself
  function strokeAcross(runs, now, P) {
    const red = rgbOf('cs-config'), paper = rgbOf('surface');
    sctx.lineWidth = 1.8;
    for (const run of runs) for (let i = 1; i < run.length; i++) {
      const [p] = run[i - 1], [q, t] = run[i], near = Math.min(nearness(p, TRAIL), nearness(q, TRAIL));
      if (!near || now - t >= FADE) continue;
      const alpha = 0.8 * ageAlpha(Math.min(AGES - 1, Math.floor((now - t) / FADE * AGES))) * near;
      const a = CS.across(p), b = CS.across(q);
      sctx.strokeStyle = mix(red, paper, 1 - alpha);
      line(P(a), P(b));
    }
  }
  // the configuration across the boundary, under the dot itself
  function dotAcross(c, P) {
    const g = c && across(c);
    if (!g) return;
    const q = P(g);
    sctx.globalAlpha = nearness(c);
    dot(q, 5.5);
    sctx.globalAlpha = 1;
  }
  // the dashed line from the configuration through the centre to its image across the boundary
  function joinAcross(c, P) {
    const g = c && across(c);
    if (!g) return;
    sctx.save();
    sctx.setLineDash([4, 4]);
    sctx.lineCap = 'butt';
    sctx.lineWidth = 1.2;
    sctx.strokeStyle = mix(rgbOf('cs-config'), rgbOf('surface'), 1 - 0.75 * nearness(c));
    line(P(c), P(g));
    sctx.restore();
  }
  // the centre: no rotation, or the vertical line
  function markCentre(q) {
    sctx.beginPath();
    sctx.arc(q[0], q[1], 3, 0, TAU);
    sctx.fillStyle = MM.color('cs-edge');
    sctx.fill();
  }

  // Two points on the sphere: the direction of the chord from x₂ to x₁ (CS.chordOf), a point of the
  // sphere; unordered, its line, a point of RP², drawn as a disc whose rim has its opposite points
  // glued (CS.chordDisc). Returns whether there is one (not while the points collide).
  function drawDirection(w, h) {
    const now = clock(), red = MM.color('cs-config');
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    if (!state.ordered) {
      // (smaller than the sphere, to leave room across the rim)
      const L = ROOM * Math.min(w, h), cx = w / 2, cy = h / 2, P = (d) => [cx + L * d[0], cy - L * d[1]];
      const at = (pts) => CS.chordDisc(pts[0], pts[1]), d = at(state.pts);
      // the rim, its two halves glued by the antipodal map: arrows the same way round
      sctx.strokeStyle = MM.color('cs-edge');
      sctx.lineWidth = 1.6;
      sctx.beginPath();
      sctx.arc(cx, cy, L, 0, TAU);
      sctx.stroke();
      for (const a of [Math.PI / 2, -Math.PI / 2]) {
        const A = P([Math.cos(a - 0.05), Math.sin(a - 0.05)]), B = P([Math.cos(a + 0.05), Math.sin(a + 0.05)]);
        sctx.stroke(new Path2D(arrowPath(A, B, 1, 1)));
      }
      joinAcross(d, P);
      if (state.paths) {
        const runs = pathRuns('dir' + oKey(), at, (p, q) => gap(p, q) > 1, 1e-3);
        strokeAcross(runs, now, P);
        sctx.strokeStyle = red;
        sctx.lineWidth = 1.8;
        strokeAged(runs, now, P);
      }
      markCentre([cx, cy]);
      dotAcross(d, P);
      if (d) dot(P(d), 5.5);
      return !!d;
    }
    const proj = camera(state.views.direction, 1, w, h, 0.42), c0 = proj([0, 0, 0]), rad = 0.42 * Math.min(w, h);
    const at = (pts) => CS.chordOf(pts[0], pts[1]);
    const aged = state.paths ? byAge(pathRuns('dir' + oKey(), at, () => false, 2e-3), now, proj) : [];
    const strokePath = (back) => {
      sctx.strokeStyle = red;
      sctx.lineWidth = back ? 1.2 : 1.8;
      for (const { pts, b } of aged) for (const r of sides(pts)) {
        if (r.back !== back) continue;
        sctx.globalAlpha = 0.8 * ageAlpha(b) * (back ? 0.5 : 1);
        trace(r.pts);
        sctx.stroke();
      }
      sctx.globalAlpha = 1;
    };
    // the far half, then the near half over it: the dot with its half
    const d = at(state.pts), q = d && proj(d);
    sphereGrid(proj, c0, rad, true);
    strokePath(true);
    if (q && q[2] < 0) dot(q, 5.5, true);
    sphereGrid(proj, c0, rad, false);
    strokePath(false);
    if (q && q[2] >= 0) dot(q, 5.5);
    return !!d;
  }
  // Three points on the sphere: their frame (CS.frame3) as a rotation, a point of the ball whose
  // opposite boundary points are glued (the half turns), near which it shows across the boundary
  // too; unordered, the hexagonal prism.
  // The ball turns about its upright axis (UPRIGHT), so that its equator stays level, and is seen
  // from above it or below. What is drawn is sorted by depth, the nearer covering the farther (each
  // line on a halo of the page's colour), and the further away the paler, and in a stronger
  // perspective than the other pictures' the smaller. The equator's disc is a pale plate: what lies
  // on the far side of it shows through it, paler still. The configuration has a stem down (or up)
  // to its shadow on the plate, which shows how high it is and where.
  const BALLD = 7; // the eye, this many radii from the ball's centre
  function drawRotation(w, h) {
    if (!state.ordered) return drawPrism(w, h, 3, (pts) => CS.rotationPoint(pts, true), 'rot' + oKey());
    // (smaller than the other pictures, to leave room across the boundary)
    const now = clock(), view = state.views.rotation, proj = camera(view, 1, w, h, ROOM, BALLD);
    const at = (pts) => CS.rotationPoint(pts, false), c = at(state.pts);
    const paper = rgbOf('surface'), edge = rgbOf('cs-edge'), red = rgbOf('cs-config');
    // above the equator's plane or below it: the plate hides the other side
    const above = Math.atan2(view[2][2], view[1][2]) >= 0, beyond = (p) => (above ? p[2] < 0 : p[2] > 0);
    const fade = (z) => Math.max(0.3, Math.min(1, 0.65 + 0.35 * z));
    const groups = [[], []]; // beyond the plate, and on the reader's side of it
    // a segment, cut where it passes through the plate; dashed ones keep their dashes in step
    const seg = (p, q, style, off = 0) => {
      if (p[2] * q[2] < 0) {
        const t = p[2] / (p[2] - q[2]), m = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), 0];
        seg(p, m, style, off);
        seg(m, q, style, off + Math.hypot(...[0, 1].map((i) => proj(m)[i] - proj(p)[i])));
        return;
      }
      const a = proj(p), b = proj(q);
      groups[beyond([0, 1, 2].map((i) => (p[i] + q[i]) / 2)) ? 0 : 1].push({ z: (a[2] + b[2]) / 2, a, b, off, ...style });
    };
    // (a dot is sorted a little nearer than it is, so that the end of its own path, its stem and
    // the line through the centre run under it rather than across it)
    const disc = (p, style) => { const q = proj(p); groups[beyond(p) ? 0 : 1].push({ z: q[2] + 0.08, disc: q, r: 5.5 * BALLD / (BALLD - q[2]), ...style }); };
    // the outline: the sphere's rim as seen from the eye
    const lift = 1 / BALLD, ring = Math.sqrt(1 - lift * lift);
    const outline = Array.from({ length: 97 }, (_, m) => mtv(view, [ring * Math.cos(TAU * m / 96), ring * Math.sin(TAU * m / 96), lift]));
    for (let m = 0; m < 96; m++) seg(outline[m], outline[m + 1], { col: edge, w: 1.6, halo: 2, flat: true });
    if (state.paths) {
      for (const run of pathRuns('rot' + oKey(), at, (p, q) => gap(p, q) > 1, 2e-3)) {
        for (let i = 1; i < run.length; i++) {
          const [p] = run[i - 1], [q, t] = run[i], age = 0.8 * fresh(t, now);
          if (age <= 0) continue;
          seg(p, q, { col: red, w: 1.8, halo: 3, alpha: age });
          // and across the boundary, near it
          const near = Math.min(nearness(p, TRAIL), nearness(q, TRAIL));
          if (near > 0) seg(CS.across(p), CS.across(q), { col: red, w: 1.8, halo: 3, alpha: age * near });
        }
      }
    }
    const g = c && across(c);
    if (c) {
      // (the configuration itself at full strength, whatever its depth: covered, not faded)
      disc(c, { col: red, flat: true });
      // the stem, down or up to the plate (sorted just under the dot: it never crosses it)
      seg(c, [c[0], c[1], 0], { col: edge, w: 1, alpha: 0.75, z: proj(c)[2] + 0.079 });
    }
    if (g) {
      // the image across the boundary, joined to the configuration through the centre
      const n = nearness(c);
      disc(g, { col: red, alpha: n, flat: true });
      const pieces = 12;
      let off = 0;
      for (let m = 0; m < pieces; m++) {
        const p = [0, 1, 2].map((i) => c[i] + (g[i] - c[i]) * m / pieces), q = [0, 1, 2].map((i) => c[i] + (g[i] - c[i]) * (m + 1) / pieces);
        seg(p, q, { col: red, w: 1.2, alpha: 0.75 * n, dash: [4, 4] }, off);
        off += Math.hypot(...[0, 1].map((i) => proj(q)[i] - proj(p)[i]));
      }
    }
    const paperStr = MM.color('surface');
    const paintGroup = (items) => {
      items.sort((x, y) => x.z - y.z);
      for (const it of items) {
        const a = (it.alpha === undefined ? 1 : it.alpha) * (it.flat ? 1 : fade(it.z));
        if (a < 0.01) continue;
        if (it.disc) {
          sctx.globalAlpha = a;
          sctx.beginPath();
          sctx.arc(it.disc[0], it.disc[1], it.r + 2, 0, TAU);
          sctx.fillStyle = paperStr;
          sctx.fill();
          sctx.beginPath();
          sctx.arc(it.disc[0], it.disc[1], it.r, 0, TAU);
          sctx.fillStyle = mix(it.col, paper, 0);
          sctx.fill();
          sctx.globalAlpha = 1;
          continue;
        }
        if (it.halo) {
          sctx.globalAlpha = Math.min(1, 1.5 * a);
          sctx.lineCap = 'butt';
          sctx.strokeStyle = paperStr;
          sctx.lineWidth = it.w + it.halo;
          line(it.a, it.b);
          sctx.globalAlpha = 1;
        }
        sctx.setLineDash(it.dash || []);
        sctx.lineDashOffset = -it.off;
        sctx.lineCap = it.dash ? 'butt' : 'round';
        sctx.strokeStyle = mix(it.col, paper, 1 - a);
        sctx.lineWidth = it.w;
        line(it.a, it.b);
      }
      sctx.setLineDash([]);
      sctx.lineDashOffset = 0;
    };
    paintGroup(groups[0]);
    // the plate, its rim (the far half paler), the centre and the configuration's shadow
    const rim = Array.from({ length: 97 }, (_, m) => proj([Math.cos(TAU * m / 96), Math.sin(TAU * m / 96), 0]));
    trace(rim, true);
    sctx.fillStyle = MM.rgba('sunken', 0.8);
    sctx.fill();
    sctx.lineWidth = 1;
    sctx.lineCap = 'round';
    for (const r of sides(rim)) { sctx.strokeStyle = mix(edge, paper, r.back ? 0.65 : 0.25); trace(r.pts); sctx.stroke(); }
    if (c) {
      trace(Array.from({ length: 24 }, (_, m) => proj([c[0] + 0.05 * Math.cos(TAU * m / 24), c[1] + 0.05 * Math.sin(TAU * m / 24), 0])), true);
      sctx.fillStyle = mix(edge, paper, 0.55);
      sctx.fill();
    }
    markCentre(proj([0, 0, 0]));
    paintGroup(groups[1]);
    return !!c;
  }

  /* ---------- pictures of the line and the circle (CS.cubePoint, CS.spherePoint) ---------- */

  const frac = (x) => x - Math.floor(x);
  // Unordered points on a curve are drawn in one chamber: taken in order along the line, or round
  // the circle from its glued ends (four points, up to turning, from x₁).
  function sorted(pts) {
    const s = CS.SURFACES[state.surface];
    if (s.x && pts.length === 4) {
      const b = pts[0][0];
      return [pts[0]].concat(pts.slice(1).sort((p, q) => frac(p[0] - b) - frac(q[0] - b)));
    }
    const at = (p) => (s.x ? frac(p[0]) : p[0]);
    return pts.slice().sort((p, q) => at(p) - at(q));
  }
  const asDrawn = (pts) => (state.ordered ? pts : sorted(pts));
  const pairColour = (i, j) => MM.color('cs-c' + (i + 1) + (j + 1));
  const rgbOf = (name) => MM.color(name).match(/[\d.]+/g).map(Number).slice(0, 3);
  const mix = (a, b, t) => 'rgb(' + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',') + ')';
  const trace = (pts, close) => { sctx.beginPath(); pts.forEach((q, n) => (n ? sctx.lineTo(q[0], q[1]) : sctx.moveTo(q[0], q[1]))); if (close) sctx.closePath(); };
  // the configuration's path, fading, as runs in a picture of a curve's configurations: at(pts) is
  // its place there (null for none), and a step longer than `jump` in a coordinate crosses a glued
  // edge or face
  const curveRuns = (key, at, jump) => pathRuns(key + oKey(), at, (p, q) => p.some((x, c) => Math.abs(x - q[c]) >= jump), 1.5e-3);
  // Two points: (x₁, x₂) in the square, open (the line) or with opposite sides glued (the circle,
  // whose square is a torus); the diagonal is the collision. Unordered, one chamber: the pairs
  // a < b, above the diagonal, whose other two sides are open (the line) or glued to each other,
  // (0, t) to (t, 1) (the circle: an open Möbius band).
  function drawSquare1d(w, h, together) {
    const id = state.surface, glued = !!CS.SURFACES[id].x, o = state.ordered;
    const pad = 36, L = Math.min(w, h) - 2 * pad, x0 = (w - L) / 2, y0 = (h + L) / 2;
    const P = (q) => [x0 + L * q[0], y0 - L * q[1]];
    const side = (a, b, n) => {
      const A = P(a), B = P(b);
      sctx.setLineDash(glued ? [] : [5, 5]);
      sctx.strokeStyle = MM.color(glued ? 'cs-edge' : 'cs-open');
      sctx.lineWidth = glued ? 1.6 : 1.2;
      line(A, B);
      sctx.setLineDash([]);
      if (glued) { sctx.lineJoin = 'round'; sctx.stroke(new Path2D(arrowPath(A, B, 1, n))); }
    };
    sctx.lineCap = 'round';
    if (o) { side([0, 0], [0, 1], 1); side([1, 0], [1, 1], 1); side([0, 0], [1, 0], 2); side([0, 1], [1, 1], 2); }
    else { side([0, 0], [0, 1], 1); side([0, 1], [1, 1], 1); }
    sctx.strokeStyle = MM.color(o ? 'cs-c12-line' : 'cs-knot');
    sctx.lineWidth = together ? 4.6 : 3;
    line(P([0, 0]), P([1, 1]));
    if (o) {
      // the axes, named near their far ends (the arrows of the gluing are in the middle)
      MM.canvasLabel(sctx, '$x_1$', x0 + 0.85 * L, y0 + 18, { size: 13, align: 'center', baseline: 'middle', color: MM.color('ink-2') });
      MM.canvasLabel(sctx, '$x_2$', x0 - 17, y0 - 0.85 * L, { size: 13, align: 'center', baseline: 'middle', color: MM.color('ink-2') });
    }
    const at = (pts) => CS.cubePoint(id, asDrawn(pts));
    if (state.paths) {
      sctx.strokeStyle = MM.color('cs-config');
      sctx.lineWidth = 1.8;
      sctx.lineJoin = 'round';
      strokeAged(curveRuns('sq', at, 0.5), clock(), P);
    }
    dot(P(at(state.pts)), 5.5);
  }

  // Three points as (x₁, x₂, x₃) in the cube, open (the line) or with opposite faces glued (the
  // circle: the 3-torus); four on the circle as (x₂ − x₁, x₃ − x₁, x₄ − x₁) in the open cube. The
  // collisions are the three diagonal planes, which meet on the diagonal. Unordered, one chamber:
  // the points in order, a < b < c, an open tetrahedron with corners A = (0, 0, 0), B = (0, 0, 1),
  // C = (0, 1, 1), D = (1, 1, 1). Its faces a = b and b = c are collisions; a = 0 and c = 1 are
  // the line's open ends, or for three points on the circle glued, (0, b, c) to (b, c, 1), which
  // takes A, B, C to B, C, D; for four, collisions with x₁.
  const TET = [[0, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 1]];
  function drawCube(w, h, together) {
    const id = state.surface, k = state.k, o = state.ordered, circle = !!CS.SURFACES[id].x;
    const torus = circle && k === 3;
    const proj = camera(state.views.cube, Math.sqrt(3) / 2, w, h, 0.4), P = (q) => proj([q[0] - 0.5, q[1] - 0.5, q[2] - 0.5]);
    const items = [], ink = MM.color('cs-edge'), faint = MM.color('cs-open');
    const seg = (A, B, extra) => items.push(Object.assign({ z: (A[2] + B[2]) / 2, a: A, b: B, halo: 0, alpha: 1 }, extra));
    const arrows = [];
    sctx.lineJoin = 'round';
    if (o) {
      // the planes, the far ones first, faintly filled and outlined in their colours
      const planes = CS.cubePlanes(k).map(([i, j, a, b]) => {
        const c = 3 - a - b, v = (u, z) => { const q = [0, 0, 0]; q[a] = u; q[b] = u; q[c] = z; return P(q); };
        const quad = [v(0, 0), v(1, 0), v(1, 1), v(0, 1)];
        return { quad, z: quad.reduce((t, q) => t + q[2], 0) / 4, i, j, on: together && together[0] === i && together[1] === j };
      }).sort((p, q) => p.z - q.z);
      for (const pl of planes) {
        trace(pl.quad, true);
        sctx.fillStyle = MM.rgba('cs-c' + (pl.i + 1) + (pl.j + 1), 0.13);
        sctx.fill();
        sctx.strokeStyle = pairColour(pl.i, pl.j);
        sctx.lineWidth = pl.on ? 3.4 : 1.8;
        sctx.stroke();
      }
      // where all three meet: the diagonal
      seg(P([0, 0, 0]), P([1, 1, 1]), { col: MM.color('ink-2'), w: 2 });
      // the edges: of the 3-torus glued in fours, as the arrows say; otherwise open
      for (let a = 0; a < 3; a++) for (const u of [0, 1]) for (const v of [0, 1]) {
        const p = [0, 0, 0], q = [0, 0, 0], [b, c] = [0, 1, 2].filter((x) => x !== a);
        p[b] = q[b] = u; p[c] = q[c] = v; q[a] = 1;
        const A = P(p), B = P(q);
        if (torus) { seg(A, B, { col: ink, w: 1.4 }); arrows.push([A, B, a + 1]); } else seg(A, B, { col: faint, w: 1, dash: [4, 4] });
      }
      // the axes, named at the far end of the edges from the corner 0
      const names = k === 4 ? ['x_2-x_1', 'x_3-x_1', 'x_4-x_1'] : ['x_1', 'x_2', 'x_3'];
      for (let a = 0; a < 3; a++) {
        const q = [0, 0, 0];
        q[a] = 1.16;
        const t = P(q);
        MM.canvasLabel(sctx, '$' + names[a] + '$', t[0], t[1], { size: 12.5, align: 'center', baseline: 'middle', color: MM.color('ink-2') });
      }
    } else {
      // one chamber: its collision faces faintly filled, the far ones first
      const V = TET.map(P), side = circle && k === 4 ? 'meet' : torus ? 'glued' : 'open';
      const faces = [[0, 1, 3, 'meet'], [0, 2, 3, 'meet'], [0, 1, 2, side], [1, 2, 3, side]];
      for (const f of faces.filter((f) => f[3] === 'meet').sort((f, g) => f.slice(0, 3).reduce((t, i) => t + V[i][2], 0) - g.slice(0, 3).reduce((t, i) => t + V[i][2], 0))) {
        trace(f.slice(0, 3).map((i) => V[i]), true);
        sctx.fillStyle = MM.rgba('cs-knot', 0.1);
        sctx.fill();
      }
      // its edges: on a collision face in the collision colour, otherwise open or glued
      for (const [i, j] of [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]) {
        const on = faces.filter((f) => f.includes(i) && f.includes(j)).map((f) => f[3]);
        if (on.includes('meet')) seg(V[i], V[j], { col: MM.color('cs-knot'), w: together ? 3.4 : 2.2 });
        else if (on.includes('glued')) seg(V[i], V[j], { col: ink, w: 1.4 });
        else seg(V[i], V[j], { col: faint, w: 1.2, dash: [4, 4] });
      }
      if (torus) for (const [i, j, n] of [[0, 1, 1], [1, 2, 1], [2, 3, 1], [0, 2, 2], [1, 3, 2]]) arrows.push([V[i], V[j], n]);
    }
    // the path, fading, and the configuration
    const at = (pts) => CS.cubePoint(id, asDrawn(pts));
    if (state.paths) for (const [p, q, alpha] of segments(curveRuns('cube', at, 0.5), clock())) { const a = P(p), b = P(q); items.push({ z: (a[2] + b[2]) / 2, a, b, col: MM.color('cs-config'), w: 1.8, halo: 3, alpha }); }
    const c = P(at(state.pts));
    items.push({ z: c[2] + 1e-6, dot: c });
    paint(items);
    sctx.strokeStyle = ink;
    sctx.lineWidth = 1.4;
    for (const [A, B, n] of arrows) sctx.stroke(new Path2D(arrowPath(A, B, 1, n)));
  }

  // Four points of the line, centred and scaled: the sphere, with the six great circles x_i = x_j.
  // They meet, rather than pass over one another, so they are drawn without halos: the far side
  // paler, then the sphere's outline, then the near side. Where three meet, three points do
  // (8 such places); where two meet, two pairs (6). Unordered, one chamber: the triangle of the
  // points in order, with corners where x₁ = x₂ = x₃, x₁ = x₂ and x₃ = x₄, and x₂ = x₃ = x₄.
  const CIRCLES = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) CIRCLES.push({ i, j, pts: CS.sphereCircle(i, j, 240) });
  const line4 = (...x) => CS.spherePoint(x.map((v) => [v, 0.5]));
  const MEETS = [];
  for (let l = 0; l < 4; l++) { const x = [0, 0, 0, 0]; x[l] = 1; const v = line4(...x); MEETS.push(v, v.map((c) => -c)); }
  for (const pairing of [[0, 1], [0, 2], [0, 3]]) { const x = [0, 0, 0, 0]; pairing.forEach((i) => { x[i] = 1; }); const v = line4(...x); MEETS.push(v, v.map((c) => -c)); }
  const slerp = (a, b, n) => {
    const th = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), s = Math.sin(th);
    return Array.from({ length: n + 1 }, (_, m) => { const t = m / n, p = Math.sin((1 - t) * th) / s, q = Math.sin(t * th) / s; return [0, 1, 2].map((c) => p * a[c] + q * b[c]); });
  };
  const CHAMBER = (() => {
    const a = line4(0, 0, 0, 1), b = line4(0, 0, 1, 1), c = line4(0, 1, 1, 1);
    // seen face on, still: its centre towards the reader, the corner where x₁ = x₂ = x₃ at the bottom left
    const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const z = unit([0, 1, 2].map((i) => a[i] + b[i] + c[i])), d = [0, 1, 2].map((i) => c[i] - a[i]);
    const x = unit(d.map((v, i) => v - (d[0] * z[0] + d[1] * z[1] + d[2] * z[2]) * z[i]));
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    return { corners: [a, b, c], sides: [slerp(a, b, 40), slerp(b, c, 40), slerp(c, a, 40)], view: [x, y, z] };
  })();
  // a curve on the sphere, in screen coordinates, cut into runs on the near and the far side
  function sides(P) {
    const runs = [];
    let run = null;
    P.forEach((q) => {
      const back = q[2] < 0;
      if (run && run.back === back) run.pts.push(q);
      else { const from = run ? run.pts[run.pts.length - 1] : null; runs.push(run = { back, pts: from ? [from, q] : [q] }); }
    });
    return runs;
  }
  function drawSphere(w, h, together) {
    const o = state.ordered, proj = camera(o ? state.views.sphere : CHAMBER.view, 1, w, h, 0.42), paper = rgbOf('surface'), c0 = proj([0, 0, 0]);
    const curves = o
      ? CIRCLES.map((c) => ({ runs: sides(c.pts.concat([c.pts[0]]).map(proj)), rgb: rgbOf('cs-c' + (c.i + 1) + (c.j + 1)), on: together && together[0] === c.i && together[1] === c.j }))
      : CHAMBER.sides.map((s) => ({ runs: sides(s.map(proj)), rgb: rgbOf('cs-knot'), on: !!together }));
    const meets = (o ? MEETS : CHAMBER.corners).map(proj);
    const aged = state.paths ? byAge(curveRuns('sph', (pts) => CS.spherePoint(asDrawn(pts)), 3), clock(), proj) : [];
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    const layer = (back) => {
      if (!o) {
        // the chamber, faintly filled, on the side it is on
        const tri = CHAMBER.sides.flat().map(proj);
        if ((tri.reduce((t, q) => t + q[2], 0) < 0) === back) { trace(tri, true); sctx.fillStyle = MM.rgba('cs-knot', back ? 0.05 : 0.1); sctx.fill(); }
      }
      for (const c of curves) for (const r of c.runs) {
        if (r.back !== back) continue;
        trace(r.pts);
        sctx.strokeStyle = mix(c.rgb, paper, back ? 0.62 : 0);
        sctx.lineWidth = back ? 1.4 : c.on ? 4.4 : 2.6;
        sctx.stroke();
      }
      for (const m of meets) {
        if ((m[2] < 0) !== back) continue;
        sctx.beginPath();
        sctx.arc(m[0], m[1], back ? 2.2 : 3.4, 0, TAU);
        sctx.fillStyle = back ? mix(rgbOf('ink'), paper, 0.65) : MM.color('ink');
        sctx.fill();
      }
      sctx.strokeStyle = MM.color('cs-config');
      sctx.lineWidth = back ? 1.2 : 1.8;
      for (const { pts, b } of aged) for (const r of sides(pts)) {
        if (r.back !== back) continue;
        sctx.globalAlpha = 0.8 * ageAlpha(b) * (back ? 0.5 : 1);
        trace(r.pts);
        sctx.stroke();
      }
      sctx.globalAlpha = 1;
    };
    layer(true);
    sctx.strokeStyle = MM.color('rule');
    sctx.lineWidth = 1;
    sctx.beginPath();
    sctx.arc(c0[0], c0[1], 0.42 * Math.min(w, h), 0, TAU);
    sctx.stroke();
    layer(false);
    const p = CS.spherePoint(asDrawn(state.pts));
    if (!p) return false;
    const q = proj(p);
    dot(q, 5.5, q[2] < 0);
    return true;
  }

  // the picture and its legend
  function drawSpace() {
    const kind = kindNow(), block = spaceCv.parentNode, o = state.ordered;
    // where there is no picture, the side panel has no block for it (why not is said under the figure)
    block.hidden = !kind;
    spaceCv.classList.toggle('is-3d', !!turnable());
    if (spaceTurn) spaceTurn.update();
    spaceCv.classList.toggle('is-box', boxed(kind));
    if (!kind) { MM.setHTML($('space-legend'), ''); return; }
    const [w, h] = sizeSpace();
    const blocks = partition(), together = blocks.find((b) => b.length === 2);
    let cur = null;
    if (kind === '3d') cur = draw3d(w, h, together);
    else if (kind === 'square') drawSquare1d(w, h, together);
    else if (kind === 'cube') drawCube(w, h, together);
    else if (kind === 'sphere') cur = drawSphere(w, h, together);
    else if (kind === '2d') draw2d(w, h);
    else if (kind === 'quaternion') cur = drawPrism(w, h, o ? 2 : 4, (pts) => CS.projectivePair(pts[0], pts[1], !o), 'q' + oKey());
    else if (kind === 'direction') cur = drawDirection(w, h);
    else if (kind === 'rotation') cur = drawRotation(w, h);
    else drawMobius(w, h, together);
    const key = (inner) => '<svg class="cs-key" viewBox="0 0 22 16" aria-hidden="true">' + inner + '</svg>';
    const collide = 'where the two points collide';
    const items = [];
    let acrossItem = null; // the configuration across a glued boundary, after the configuration
    const pairKey = (i, j) => key('<path class="sp-line sp-c' + (i + 1) + (j + 1) + '" d="M1 8H21"/>') + 'where $' + pointName([i, j]) + '$';
    if (kind === 'square' || kind === 'cube' || kind === 'sphere') {
      const circle = !!CS.SURFACES[state.surface].x, glued = key('<path class="cs-edge" d="M1 8H21"/><path class="cs-arrow" d="M8.5 3.5 13 8 8.5 12.5"/>') + 'glued, as the arrows say';
      const open = key('<path class="cs-edge open" d="M1 8H21"/>') + 'an open end';
      if (o) {
        const pairs = kind === 'square' ? [[0, 1]] : kind === 'sphere' ? CIRCLES.map((c) => [c.i, c.j]) : CS.cubePlanes(state.k).map(([i, j]) => [i, j]);
        for (const [i, j] of pairs) items.push(pairKey(i, j));
        if (kind === 'cube') {
          items.push(key('<path class="sp-line sp-all" d="M1 8H21"/>') + 'where ' + (state.k === 4 ? '$x_2,x_3,x_4$ meet' : 'all three meet'));
          if (state.k === 4) items.push(key('<path class="cs-edge open" d="M1 8H21"/>') + 'the faces: where a point meets $x_1$');
          else if (circle) items.push(glued);
        }
      } else {
        items.push(key('<path class="sp-line sp-knot" d="M1 8H21"/>') + 'where two points meet');
        if (kind !== 'sphere' && !(kind === 'cube' && state.k === 4)) items.push(circle ? glued : open);
      }
      if (kind === 'sphere') items.push(key('<circle class="sp-meet" cx="11" cy="8" r="3"/>') + 'where three points meet, or two pairs');
      items.push(key('<circle class="sp-dot" cx="11" cy="8" r="4.5"/>') + (o ? 'the configuration' : state.k === 4 && circle ? 'the others, in order round from $x_1$' : 'the points, in order' + (circle ? ' from $0$' : ''))
        + (kind === 'sphere' && !cur ? ' (not on the sphere while all four meet)' : ''));
      MM.setHTML($('space-legend'), items.map((t) => '<span class="legend-item">' + t + '</span>').join(''));
      return;
    }
    if (kind === '3d' && o) {
      for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) items.push(key('<path class="sp-line sp-c' + (i + 1) + (j + 1) + '" d="M1 8H21"/>') + 'where $' + pointName([i, j]) + '$');
    } else if (kind === '3d') {
      items.push(key('<path class="sp-line sp-knot" d="M1 8H21"/>') + 'where two points collide');
    } else if (kind === '2d') {
      items.push(key('<circle class="sp-hole" cx="11" cy="8" r="5"/>') + (o ? 'where $x_1=x_2$' : collide));
    } else if (kind === 'quaternion' || kind === 'rotation' || kind === 'direction') {
      // no collisions in these: they were pushed away
      const glued = key('<path class="cs-edge" d="M1 8H21"/><path class="cs-arrow" d="M8.5 3.5 13 8 8.5 12.5"/>');
      if (kind === 'quaternion' && o) items.push(glued + 'glued edges, as the arrows say');
      else if (kind !== 'direction') items.push(key('<path class="cs-edge" d="M1 8H21"/>') + (kind === 'rotation' && o ? 'the half turns: opposite points are glued' : 'each face glued to the opposite one, after a turn'));
      else if (!o) items.push(glued + 'the rim: opposite points are glued');
      if ((kind === 'rotation' && o) || (kind === 'direction' && !o)) {
        items.push(key('<circle class="sp-centre" cx="11" cy="8" r="3"/>') + (kind === 'rotation' ? 'the centre: no rotation' : 'the centre: the vertical line'));
        acrossItem = key('<g class="cs-ghost"><circle class="sp-dot" cx="11" cy="8" r="4.5"/></g>') + (kind === 'rotation' ? 'the same, across the boundary' : 'the same, across the rim');
      }
    } else {
      items.push(key('<path class="sp-line sp-c12" d="M1 8H21"/>') + (o ? 'where $x_1=x_2$' : collide));
    }
    const what = kind === '3d' || kind === 'quaternion' || kind === 'rotation' ? 'the configuration' : kind === 'mobius' ? (o ? 'the configuration' : 'the pair, in both orders')
      : kind === 'direction' ? (o ? 'the direction from $x_2$ to $x_1$' : 'the line of the chord, $\\pm(x_1-x_2)$')
        : o ? '$x_2-x_1$' : state.surface === 'plane' ? '$(x_2-x_1)^2$' : '$\\pm(x_2-x_1)$';
    items.push(key('<circle class="sp-dot" cx="11" cy="8" r="4.5"/>') + what
      + (kind === '3d' && !cur ? ' (not on the sphere)' : (kind === 'quaternion' || kind === 'rotation' || kind === 'direction') && !cur ? ' (none while points collide)' : ''));
    if (acrossItem) items.push(acrossItem);
    MM.setHTML($('space-legend'), items.map((t) => '<span class="legend-item">' + t + '</span>').join(''));
  }
  // the label and the description of the picture: they change with the case, not with the points
  function drawSpaceText() {
    const kind = kindNow(), s = CS.SURFACES[state.surface], o = state.ordered, sp = space(state.k, o);
    let label;
    const onLine = state.surface === 'line';
    if (kind === 'square' && o) {
      label = 'The space itself: $(x_1,x_2)$ in the ' + (onLine ? 'square' : 'torus') + ', off the diagonal';
    } else if (kind === 'square') {
      label = 'The space itself: the points in order, $a<b$' + (onLine ? '' : ' from $0$');
    } else if (kind === 'cube' && state.k === 3 && o) {
      label = 'The space itself: $(x_1,x_2,x_3)$ in the ' + (onLine ? 'cube' : '3-torus') + ', off the planes $x_i=x_j$';
    } else if (kind === 'cube' && state.k === 3) {
      label = 'The space itself: the points in order, $a<b<c$' + (onLine ? '' : ' from $0$');
    } else if (kind === 'cube' && o) {
      label = 'Turned until $x_1$ is at $0$: $(x_2-x_1,\\,x_3-x_1,\\,x_4-x_1)$';
    } else if (kind === 'cube') {
      label = 'Turned until $x_1$ is at $0$: the others in order round from it';
    } else if (kind === 'sphere' && o) {
      label = 'Centred and scaled: $S^2$ minus six great circles';
    } else if (kind === 'sphere') {
      label = 'Centred and scaled: the points in order';
    } else if (kind === '3d') {
      label = 'Centred and scaled: $S^3$ minus ' + (o ? 'three circles' : 'a trefoil');
    } else if (kind === 'mobius') {
      label = 'Up to homotopy: up, where $x_1$ is along the band; across, $x_2$ as seen from $x_1$';
    } else if (kind === 'quaternion') {
      label = o ? 'Up to homotopy: the quaternion space $S^3/Q_8$' : 'Up to homotopy: $S^3/Q_{16}$, an octagonal prism';
    } else if (kind === 'direction') {
      label = o ? 'Up to homotopy: the direction from $x_2$ to $x_1$, in $S^2$' : 'Up to homotopy: the line of the chord, in $\\RR P^2$';
    } else if (kind === 'rotation') {
      label = o ? 'Up to homotopy: the rotations $SO(3)$, a ball' : 'Up to homotopy: $SO(3)/D_3$, a hexagonal prism';
    } else if (kind === '2d') {
      label = 'Up to translation: ' + (o ? '$x_2-x_1$' : state.surface === 'plane' ? '$(x_2-x_1)^2$' : '$\\pm(x_2-x_1)$') + ' in $' + s.tex + '\\setminus 0$';
    } else {
      label = '';
    }
    MM.setHTML($('space-h'), label);
    const turn = ' Drag sideways or use the arrow keys to turn it.';
    const curveLabel = !o ? (kind === 'square' ? 'Two unordered points on the ' + s.name + ', in order: a triangle' + (onLine ? '' : ' with two sides glued, a Möbius band')
      : kind === 'cube' && state.k === 3 ? 'Three unordered points on the ' + s.name + ', in order: a tetrahedron' + (onLine ? '' : ' with two faces glued')
        : kind === 'cube' ? 'Four unordered points on the circle, turned until the first is at 0, the others in order: a tetrahedron'
          : 'Four unordered points on the line, centred and scaled, in order: a triangle of the sphere')
      : kind === 'square' ? 'Two points on the ' + s.name + ' as a point of the ' + (onLine ? 'square' : 'torus') + ', off the diagonal where they collide'
        : kind === 'cube' && state.k === 3 ? 'Three points on the ' + s.name + ' as a point of the ' + (onLine ? 'cube' : '3-torus, a cube with opposite faces glued') + ', off the three planes where two of them collide'
          : kind === 'cube' ? 'Four points on the circle, turned until the first is at 0, as a point of the open cube of the other three, off the three planes where two of them collide'
            : 'Four points on the line, centred and scaled, as a point of the sphere, off the six great circles where two of them collide';
    spaceCv.setAttribute('aria-label', kind === 'square' || kind === 'cube' || kind === 'sphere'
      ? curveLabel + '; a dot shows the configuration, and a line its path.' + (turnable() ? ' Drag sideways or use the arrow keys to turn it.' : '')
      : kind === '3d'
      ? (o ? 'The ordered configurations of three points in the plane, centred and scaled, as the 3-sphere projected to space: the collisions form three circles, each pair linked once; a dot shows the configuration, and a line its path.'
        : 'The unordered configurations of three points in the plane, centred and scaled, as the 3-sphere projected to space: the configurations where two points collide form a trefoil knot; a dot shows the configuration, and a line its path.') + turn
      : kind === 'quaternion' ? (o ? 'Two points on the projective plane, up to homotopy: the quaternion space, a cube whose opposite faces are glued after a quarter turn'
        : 'Two unordered points on the projective plane, up to homotopy: an octagonal prism whose opposite faces are glued after a turn') + '; a dot shows the configuration, and a line its path.' + turn
      : kind === 'direction' ? (o ? 'Two points on the sphere, up to homotopy: the direction from the second to the first, a point of a sphere; a dot shows it, and a line its path.' + turn
        : 'Two unordered points on the sphere, up to homotopy: the line of the chord between them, a point of the projective plane, drawn as a disc whose rim has its opposite points glued; a dot shows it, and a line its path.')
      : kind === 'rotation' ? (o ? 'Three points on the sphere, up to homotopy: the rotation group, a ball whose opposite boundary points are glued'
        : 'Three unordered points on the sphere, up to homotopy: a hexagonal prism whose opposite faces are glued after a turn') + '; a dot shows the configuration, and a line its path.' + turn
      : kind === 'mobius' ? 'Two points on the Möbius band, up to homotopy: a box whose height is where the first point is along the band and whose square is where the second is as seen from the first; the collisions are the vertical line through the middle. A dot shows the configuration, and a line its path.' + turn
        : 'The relative position of the two points, in the ' + s.name + ' with the collision removed: a dot shows it, and a line its path.');
    $('spin').hidden = !turnable();
  }

  /* ---------- moving the points ---------- */

  function move(idx, p) { for (const i of idx) state.pts[i] = p.slice(); }
  // the points that a cluster would collide with if dropped where it is
  function snapTarget(idx) {
    const p = state.pts[idx[0]];
    let best = null, bd = SNAP / G.unit;
    for (const c of clusters()) {
      if (c.idx.includes(idx[0])) continue;
      const d = CS.dist(state.surface, p, c.p);
      if (d < bd) { bd = d; best = c.idx; }
    }
    return best;
  }
  const merge = (idx, target) => move(idx, state.pts[target[0]]);
  // a place near p, about SEP away, clear of the given points
  function freeSpot(p, avoid, turn) {
    const id = state.surface, r = SEP / G.unit;
    const spot = (a) => {
      if (!G.ball) return CS.wrap(id, [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)], LO);
      const [e1, e2] = tangent(p, null);
      return CS.wrap(id, around(p, e1, e2, r, a));
    };
    for (let t = 0; t < 24; t++) {
      const q = spot((turn || 0) + Math.PI / 4 + t * Math.PI / 6 * (t % 2 ? -1 : 1));
      if (avoid.every((o) => CS.dist(id, o, q) > 0.7 * r)) return q;
    }
    return spot(0);
  }
  function separate(idx) {
    if (idx.length < 2) return;
    const p = state.pts[idx[0]];
    idx.slice(1).forEach((i, j) => move([i], freeSpot(p, state.pts.filter((_, l) => l !== i), j * 2.1)));
  }
  // Where the points go for the stratum of a set partition: each block that gathers points from
  // several places at the place of its biggest group of points already together, those points
  // remembering where they were; of a collision that comes apart, the block with most of its points
  // stays, and the others go back to where they were before a stratum gathered them, if that is
  // free (else near it). The places are only for the strata: any other change of the points forgets
  // them (remember, undo, redo).
  const strataHome = new Map();
  function stratumPlaces(blocks) {
    const id = state.surface, old = clusters(), to = state.pts.map((p) => p.slice()), placed = [], near = 0.5 * SEP / G.unit;
    const count = (idx, b) => idx.filter((i) => b.includes(i)).length;
    const stays = new Map();
    for (const c of old) {
      const parts = blocks.filter((b) => count(c.idx, b));
      if (parts.length > 1) stays.set(c, parts.reduce((x, y) => (count(c.idx, y) > count(c.idx, x) ? y : x)));
    }
    for (const b of blocks) {
      const parts = old.filter((c) => count(c.idx, b));
      let p;
      if (parts.length > 1) {
        const anchor = parts.reduce((x, y) => (count(y.idx, b) > count(x.idx, b) ? y : x));
        p = anchor.p;
        for (const c of parts) if (c !== anchor) for (const i of c.idx) if (b.includes(i) && !strataHome.has(i)) strataHome.set(i, state.pts[i].slice());
      } else if (!stays.has(parts[0]) || stays.get(parts[0]) === b) p = parts[0].p;
      else {
        const home = b.map((i) => strataHome.get(i)).find(Boolean);
        const free = (q) => placed.every((r) => CS.dist(id, q, r) > near) && state.pts.every((r, m) => b.includes(m) || CS.dist(id, q, r) > near);
        p = home && free(home) ? home : freeSpot(parts[0].p, placed.concat(state.pts));
        for (const i of b) strataHome.delete(i);
      }
      if (placed.some((q) => CS.dist(id, p, q) < near)) p = freeSpot(p, placed.concat(state.pts));
      placed.push(p);
      for (const i of b) to[i] = p.slice();
    }
    return to;
  }
  // unordered: of the set partitions of type λ, the one nearest the configuration
  function nearest(lambda) {
    const want = lambda.join(','), old = clusters();
    let best = null, cost = Infinity;
    for (const blocks of CS.setPartitions(state.k)) {
      if (CS.typeOf(blocks).join(',') !== want) continue;
      let c = 0;
      for (const b of blocks) for (const i of b) c += CS.dist(state.surface, state.pts[i], state.pts[b[0]]);
      for (const o of old) c += 0.02 * (new Set(o.idx.map((i) => blocks.findIndex((b) => b.includes(i)))).size - 1);
      if (c < cost) { cost = c; best = blocks; }
    }
    return best;
  }

  /* ---------- moves: loops and paths the points can be sent along ---------- */

  // A move acts on the points chosen for it (each with the others of its collision, if it is one).
  // how far a loop round p can reach: within the window in an open direction, and
  // where an edge is glued within a disc that the gluing does not fold over (0.3 of the square)
  function room(p) {
    const s = CS.SURFACES[state.surface];
    let r = s.x || s.y ? 0.3 : Infinity;
    if (!s.x) r = Math.min(r, p[0] - LO, 1 - LO - p[0]);
    if (!s.y) r = Math.min(r, p[1] - LO, 1 - LO - p[1]);
    return Math.max(0, r);
  }
  // the distance from p to the nearest point other than those given
  const clearance = (p, skip) => Math.min(Infinity, ...state.pts.filter((_, m) => !skip.includes(m)).map((q) => CS.dist(state.surface, p, q)));
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  // the radius and angle at time t of a loop that turns by `angle`; where a turn at
  // radius r would meet another point or the edge of the window, it first draws in
  // to r2, turns there, and goes back out (a homotopic loop)
  function loopAt(t, r, r2, th0, angle) {
    if (r2 >= 0.97 * r) return [r, th0 + angle * ease(t)];
    if (t < 0.2) return [r + (r2 - r) * ease(t / 0.2), th0];
    if (t > 0.8) return [r2 + (r - r2) * ease((t - 0.8) / 0.2), th0 + angle];
    return [r2, th0 + angle * ease((t - 0.2) / 0.6)];
  }
  // The move as a function from time in [0, 1] to configurations, or null if there is none. a: the
  // labels of the point (a collision: all of them) chosen first; b: those of the other point of a
  // swap or a turn round it, or null.
  //   swap: a and b exchanged by half a turn, counterclockwise, about their midpoint
  //   round: a once round b, counterclockwise
  //   across: a once round the surface, through its glued edges (or on the projective plane to its
  //     opposite point, which is the same point)
  //   turn: all the points once round their centre (the plane), or once round the circle
  //   next: on the circle, each point to the place of the next
  function movePath(name, a, b) {
    const id = state.surface, s = CS.SURFACES[id], P = state.pts.map((p) => p.slice()), k = state.k;
    const at = (changes) => {
      const out = P.map((p) => p.slice());
      for (const [idx, p] of changes) { const q = CS.wrap(id, p, LO); for (const i of idx) out[i] = q.slice(); }
      return out;
    };
    const both = b ? a.concat(b) : a;
    if ((name === 'round' || name === 'swap') && (!b || s.dim === 1)) return null;
    if (s.ball) return ballMove(name, P, at, a, b, both);
    if (name === 'round') {
      const Q = P[b[0]], A = CS.near(id, Q, P[a[0]]), u = [A[0] - Q[0], A[1] - Q[1]], r = Math.hypot(u[0], u[1]), th0 = Math.atan2(u[1], u[0]);
      const r2 = Math.min(r, 0.5 * clearance(Q, both), 0.98 * room(Q));
      return (t) => { const [rho, th] = loopAt(t, r, r2, th0, TAU); return at([[a, [Q[0] + rho * Math.cos(th), Q[1] + rho * Math.sin(th)]]]); };
    }
    if (name === 'swap') {
      const A = P[a[0]], Bn = CS.near(id, A, P[b[0]]), u = [Bn[0] - A[0], Bn[1] - A[1]], r = Math.hypot(u[0], u[1]), th0 = Math.atan2(u[1], u[0]);
      const m = [A[0] + u[0] / 2, A[1] + u[1] / 2], h2 = Math.min(r / 2, 0.5 * clearance(m, both), 0.98 * room(m));
      return (t) => {
        const [rho, th] = loopAt(t, r / 2, h2, th0, Math.PI), e = [rho * Math.cos(th), rho * Math.sin(th)];
        return at([[b, [m[0] + e[0], m[1] + e[1]]], [a, [m[0] - e[0], m[1] - e[1]]]]);
      };
    }
    if (name === 'turn' && s.dim === 1) {
      if (!s.x) return null;
      return (t) => { const e = ease(t); return at(P.map((p, i) => [[i], [p[0] + e, 0.5]])); };
    }
    if (name === 'next') {
      // a loop of unordered points, k of which make turning all the points once round
      // (counterclockwise is to the right)
      if (s.dim !== 1 || !s.x || k < 2 || clusters().length < k) return null;
      const order = P.map((_, i) => i).sort((i, j) => P[i][0] - P[j][0]), gap = new Array(k);
      order.forEach((i, r) => { const j = order[(r + 1) % k]; gap[i] = ((P[j][0] - P[i][0]) % 1 + 1) % 1; });
      return (t) => { const e = ease(t); return at(P.map((p, i) => [[i], [p[0] + e * gap[i], 0.5]])); };
    }
    if (name === 'turn') {
      // drawn in first if it would leave the window
      if (id !== 'plane') return null;
      const c = [0, 1].map((d) => P.reduce((t, p) => t + p[d], 0) / k), o = P.map((p) => [p[0] - c[0], p[1] - c[1]]);
      const far = Math.max(...o.map((v) => Math.hypot(v[0], v[1])));
      if (k < 2 || far < 1e-9) return null;
      const lam = Math.min(1, 0.98 * room(c) / far);
      return (t) => {
        const [f, th] = loopAt(t, 1, lam, 0, TAU), C = Math.cos(th), S = Math.sin(th);
        return at(o.map((v, i) => [[i], [c[0] + f * (C * v[0] - S * v[1]), c[1] + f * (S * v[0] + C * v[1])]]));
      };
    }
    if (name === 'across' && s.x && s.dim !== 1) {
      // to the copy of the point across the right edge
      const p = P[a[0]], q = [p[0] + 1, s.x === 'flip' ? 1 - p[1] : p[1]];
      return (t) => { const e = ease(t); return at([[a, [p[0] + e, p[1] + e * (q[1] - p[1])]]]); };
    }
    if (name === 'acrossY' && s.y && s.dim !== 1) {
      // to the copy of the point across the top edge
      const p = P[a[0]], q = [s.y === 'flip' ? 1 - p[0] : p[0], p[1] + 1];
      return (t) => { const e = ease(t); return at([[a, [p[0] + e * (q[0] - p[0]), p[1] + e]]]); };
    }
    return null;
  }
  // The moves on a sphere: on the sphere and the projective plane a point goes round another,
  // two are swapped, and on the projective plane a point goes once round it, to its opposite
  // point (which is the same point) along half a great circle.
  function ballMove(name, P, at, a, b, both) {
    const id = state.surface, s = CS.SURFACES[id];
    if (name === 'round') {
      // counterclockwise as seen from outside
      const Q = P[b[0]], A = CS.near(id, Q, P[a[0]]), r = CS.dist(id, Q, A);
      const r2 = Math.min(r, 0.5 * clearance(Q, both)), [e1, e2] = tangent(Q, A);
      return (t) => { const [rho, th] = loopAt(t, r, r2, 0, TAU); return at([[a, around(Q, e1, e2, rho, th)]]); };
    }
    if (name === 'swap') {
      const A = P[a[0]], Bn = CS.near(id, A, P[b[0]]), r = CS.dist(id, A, Bn);
      const m = unit3(A.map((x, i) => x + Bn[i])) || tangent(A, null)[0], h2 = Math.min(r / 2, 0.5 * clearance(m, both)), [e1, e2] = tangent(m, A);
      return (t) => { const [rho, th] = loopAt(t, r / 2, h2, 0, Math.PI); return at([[a, around(m, e1, e2, rho, th)], [b, around(m, e1, e2, rho, th + Math.PI)]]); };
    }
    if (name === 'across' && s.antipodal) {
      const p = P[a[0]], [e1] = tangent(p, null);
      return (t) => { const r = Math.PI * ease(t); return at([[a, p.map((x, i) => Math.cos(r) * x + Math.sin(r) * e1[i])]]); };
    }
    return null;
  }
  // a move of the points a (with b, the labels of the other point of a swap or a turn round it),
  // played and kept for Undo; none while another plays. Whether it was.
  function play(name, a, b) {
    if (!a || state.anim) return false;
    const path = movePath(name, a, b || null);
    if (!path) return false;
    const T = name === 'turn' || name === 'next' ? 2600 : 1900;
    const entry = { from: snap(), to: { pts: path(1), order: state.order.slice() }, path, T };
    remember(entry);
    run(path, T, null, (t) => {
      // cut short: the part of it that was played
      if (undoStack[undoStack.length - 1] !== entry) return;
      if (t < 0.02) { undoStack.pop(); return; }
      Object.assign(entry, { path: (u) => path(u * t), to: snap(), T: T * t });
    });
    draw();
    return true;
  }
  // A motion played: path(t) for t from 0 to 1 over T ms, then `then` (or at once under reduced
  // motion, its path drawn); `stopped(t)` if it is cut short at t.
  function run(path, T, then, stopped) {
    if (MM.reduceMotion()) {
      for (let i = 1; i <= 120; i++) { state.pts = path(i / 120); record(false); }
      if (then) then();
      draw();
      return;
    }
    state.anim = { path, t0: clock(), T, t: 0, then, stopped };
    wake();
  }
  // a motion under way ends at once, where it was going
  function finish() {
    const a = state.anim;
    if (!a) return;
    state.anim = null;
    state.pts = a.path(1);
    record(true);
    if (a.then) a.then();
  }
  // … or stops where it is (a drag, the keys or another change take over)
  function stop() {
    const a = state.anim;
    if (!a) return;
    state.anim = null;
    if (a.stopped) a.stopped(a.t);
  }

  /* ---------- Undo and Redo ---------- */

  // Each change of the points is kept as { from, to, path, T }: the configurations before and
  // after it (the points and their order in a pile), and for a motion (a drag, the arrow keys, a
  // move) the way it went, path(t) for t from 0 to 1, which Undo plays backwards and Redo
  // forwards over T ms, so that a path that went round comes back round; a jump (the points put in
  // a row to play a braid) has none, and Undo and Redo jump too.
  // Changing the space or the number of points starts afresh.
  const undoStack = [], redoStack = [];
  const snap = () => ({ pts: state.pts.map((p) => p.slice()), order: state.order.slice() });
  function remember(entry) {
    if (!entry.strata) strataHome.clear();
    undoButtons.keep(undoStack, entry);
    redoStack.length = 0;
    keyEntry = null;
  }
  function forget() { undoStack.length = 0; redoStack.length = 0; keyEntry = null; strataHome.clear(); }
  function apply(sn) { state.pts = sn.pts.map((p) => p.slice()); state.order = sn.order.slice(); }
  // A path through the configurations ps, each point going the shortest way from one to the next,
  // at an even pace; and how long to play it.
  function through(ps) {
    const id = state.surface, len = [0];
    for (let m = 1; m < ps.length; m++) len.push(len[m - 1] + ps[m].reduce((t, p, i) => t + CS.dist(id, ps[m - 1][i], p), 0));
    const L = len[len.length - 1];
    const path = (t) => {
      if (!(L > 0)) return ps[ps.length - 1].map((p) => p.slice());
      const want = Math.max(0, Math.min(1, t)) * L;
      let lo = 0, hi = len.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (len[mid] <= want) lo = mid; else hi = mid; }
      const f = len[hi] > len[lo] ? (want - len[lo]) / (len[hi] - len[lo]) : 1;
      return ps[lo].map((p, i) => CS.toward(id, p, ps[hi][i], f));
    };
    return { path, T: Math.max(300, Math.min(1200, 700 * L)) };
  }
  const BACK = 1300; // ms: a move is played back at most this slowly
  function undo() {
    strataHome.clear();
    finish();
    const e = undoStack.pop();
    keyEntry = null;
    if (!e) return;
    redoStack.push(e);
    if (!e.path) { apply(e.from); record(true); draw(); return; }
    run((t) => e.path(1 - t), Math.min(e.T, BACK), () => apply(e.from), (t) => {
      // cut short: what is left of it to undo, as it now is
      redoStack.pop();
      if (t < 0.98) undoStack.push({ from: e.from, to: snap(), path: (v) => e.path(v * (1 - t)), T: e.T * (1 - t) });
    });
    draw();
  }
  function redo() {
    strataHome.clear();
    finish();
    const e = redoStack.pop();
    keyEntry = null;
    if (!e) return;
    undoStack.push(e);
    if (!e.path) { apply(e.to); record(true); draw(); return; }
    run(e.path, Math.min(e.T, BACK), () => apply(e.to), (t) => {
      undoStack.pop();
      if (t > 0.02) undoStack.push({ from: e.from, to: snap(), path: (v) => e.path(v * t), T: e.T * t });
    });
    draw();
  }
  // The arrow keys move a point a step at a time: the steps of one point in a row make one change.
  let keyEntry = null;
  function keyStep(i, before) {
    const now = performance.now(), e = keyEntry;
    if (e && e.i === i && now - e.at < 1500 && undoStack[undoStack.length - 1] === e) {
      e.steps.push(state.pts.map((p) => p.slice()));
      Object.assign(e, through(e.steps), { to: snap(), at: now });
      return;
    }
    const steps = [before.pts, state.pts.map((p) => p.slice())];
    const entry = Object.assign({ from: before, to: snap(), steps, i, at: now }, through(steps));
    remember(entry);
    keyEntry = entry;
  }

  /* ---------- the moves, in the bar ---------- */

  // The moves are in the bar, each kind a menu of its moves, the points named: swap two points;
  // take one point once round another (every pair, either way round); take a point across glued
  // edges (or on the projective plane to its opposite point). Turning all the points, or moving
  // each to the next, is a button. A collision moves as one point; a move of two points of one
  // collision is not offered.

  // An arc of the circle round (cx, cy) of radius r, from angle a0 to a1 (degrees, counterclockwise
  // on the screen when a1 > a0), with an arrowhead at its end: paths for an icon.
  function arcArrow(cx, cy, r, a0, a1, head = 2.3) {
    const P = (a) => [cx + r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)];
    const [x0, y0] = P(a0), [x1, y1] = P(a1), big = Math.abs(a1 - a0) > 180 ? 1 : 0, f = (v) => v.toFixed(2);
    // backwards along the arc at its end, and the two sides of the arrowhead
    const t = a1 * Math.PI / 180, dir = Math.sign(a1 - a0), back = [dir * Math.sin(t), dir * Math.cos(t)];
    const wing = (w) => [x1 + head * (back[0] * Math.cos(w) - back[1] * Math.sin(w)), y1 + head * (back[0] * Math.sin(w) + back[1] * Math.cos(w))];
    const l = wing(0.7), m = wing(-0.7);
    return '<path d="M' + f(x0) + ' ' + f(y0) + 'A' + r + ' ' + r + ' 0 ' + big + ' ' + (dir > 0 ? 0 : 1) + ' ' + f(x1) + ' ' + f(y1) + '"/>'
      + '<path d="M' + f(l[0]) + ' ' + f(l[1]) + 'L' + f(x1) + ' ' + f(y1) + 'L' + f(m[0]) + ' ' + f(m[1]) + '"/>';
  }
  const dotAt = (x, y, r = 1.6, cls = 'dot') => '<circle class="' + cls + '" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
  // a short straight arrow out from (cx, cy) at angle a (degrees, counterclockwise from the right),
  // from distance r0 to r1
  function rayArrow(cx, cy, a, r0, r1, head = 1.7) {
    const c = Math.cos(a * Math.PI / 180), s = -Math.sin(a * Math.PI / 180), f = (v) => v.toFixed(2);
    const x1 = cx + r1 * c, y1 = cy + r1 * s, w = (t) => [x1 - head * (c * Math.cos(t) - s * Math.sin(t)), y1 - head * (s * Math.cos(t) + c * Math.sin(t))];
    const l = w(0.75), m = w(-0.75);
    return '<path d="M' + f(cx + r0 * c) + ' ' + f(cy + r0 * s) + 'L' + f(x1) + ' ' + f(y1) + '"/><path d="M' + f(l[0]) + ' ' + f(l[1]) + 'L' + f(x1) + ' ' + f(y1) + 'L' + f(m[0]) + ' ' + f(m[1]) + '"/>';
  }
  const icon = (inner) => '<svg viewBox="0 0 16 16" aria-hidden="true">' + inner + '</svg>';
  const ICONS = {
    // the two exchanged, counterclockwise
    swap: icon(dotAt(3, 8) + dotAt(13, 8) + '<path d="M11.6 5.6Q8 1.8 4.4 5.6"/><path d="M4.5 3.2 4.4 5.6l2.4-.2"/><path d="M4.4 10.4Q8 14.2 11.6 10.4"/><path d="M11.5 12.8l.1-2.4-2.4.2"/>'),
    // the point once round another, counterclockwise
    round: icon(dotAt(8, 8) + dotAt(13.2, 8) + arcArrow(8, 8, 5.2, 28, 330)),
    // all the points once round
    turn: icon(dotAt(8, 5.9, 1.25) + dotAt(5.9, 9.6, 1.25) + dotAt(10.1, 9.6, 1.25) + arcArrow(8, 8, 6.2, 110, 410)),
    // the one point once round the circle
    turnOne: icon(dotAt(13.2, 8) + arcArrow(8, 8, 5.2, 28, 330)),
    // on the circle, each point to the next
    next: icon(dotAt(8, 2.6) + dotAt(3.32, 10.7) + dotAt(12.68, 10.7) + arcArrow(8, 8, 5.4, 112, 188, 2) + arcArrow(8, 8, 5.4, 232, 308, 2) + arcArrow(8, 8, 5.4, 352, 428, 2)),
    // out through the right edge of the square, and in again through the left
    across: icon('<path class="faint" d="M3 3.5v9M13 3.5v9"/>' + dotAt(6.2, 8) + '<path d="M7.8 8H15"/><path d="M13.2 6.2 15 8l-1.8 1.8"/><path class="faint" d="M1 8h2"/>'),
    // out through the top edge of the square, and in again through the bottom
    acrossY: icon('<path class="faint" d="M3.5 3h9M3.5 13h9"/>' + dotAt(8, 9.8) + '<path d="M8 8.2V1"/><path d="M6.2 2.8 8 1l1.8 1.8"/><path class="faint" d="M8 15v-2"/>'),
    // on the projective plane: out through the rim, and in again at the opposite point
    acrossBall: icon('<circle class="faint" cx="8" cy="8" r="6"/>' + dotAt(5.4, 8) + '<path d="M7 8H15"/><path d="M13.2 6.2 15 8l-1.8 1.8"/><path class="faint" d="M.6 8h1.8"/>'),
    // the points of a collision coming apart: three of them leaving, along short arrows, the spot
    // where they met (a faint dot)
    split: icon(dotAt(8, 9.3, 1.2, 'dot faint') + [90, 210, 330].map((a) => rayArrow(8, 9.3, a, 2.4, 6.6, 1.8)).join('')),
  };
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const uniName = (idx) => idx.map((i) => 'x' + SUB[i + 1]).join(' = ');
  const pointTex = (i) => '$x_{' + (i + 1) + '}$';
  // the moves for the case in view: { kind, name, icon, items } (items: none for a button)
  function moves() {
    const s = CS.SURFACES[state.surface], k = state.k, cl = clusters(), out = [];
    const apart = (i, j) => !cl.some((c) => c.idx.includes(i) && c.idx.includes(j));
    const each = (label) => Array.from({ length: k }, (_, i) => ({ value: String(i), label: label(i) }));
    if (s.dim !== 1 && k > 1) {
      const swaps = [], rounds = [];
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) swaps.push({ value: i + ',' + j, label: 'swap ' + pointTex(i) + ', ' + pointTex(j), disabled: !apart(i, j) });
      // in Artin's order, as the generators below: x_j round x_i with i < j
      for (let j = 1; j < k; j++) for (let i = 0; i < j; i++) rounds.push({ value: j + ',' + i, label: pointTex(j) + ' round ' + pointTex(i), disabled: !apart(i, j) });
      out.push({ kind: 'swap', name: 'Swap two points', icon: 'swap', items: swaps }, { kind: 'round', name: 'Take a point once round another', icon: 'round', items: rounds });
    }
    if (s.antipodal) out.push({ kind: 'across', name: 'Take a point to its opposite point', icon: 'acrossBall', items: each((i) => pointTex(i) + ' to its opposite') });
    else if (s.x && s.dim !== 1) out.push({ kind: 'across', name: 'Take a point across the side edges', icon: 'across', items: each((i) => pointTex(i) + ' across the sides') });
    if (s.y && s.dim !== 1) out.push({ kind: 'acrossY', name: 'Take a point across the top and bottom edges', icon: 'acrossY', items: each((i) => pointTex(i) + ' across the top') });
    if (state.surface === 'plane' && k > 1) out.push({ kind: 'turn', name: 'Turn all the points once round their centre', icon: 'turn' });
    if (s.dim === 1 && s.x) out.push({ kind: 'turn', name: k > 1 ? 'Turn all the points once round the circle' : 'Take the point once round the circle', icon: k > 1 ? 'turn' : 'turnOne' });
    if (s.dim === 1 && s.x && k > 1) out.push({ kind: 'next', name: 'Move each point to the next', icon: 'next' });
    return out;
  }
  // The bar's moves for the case in view: made afresh for another space or number of points, and
  // otherwise only their menus brought up to date (which moves a collision rules out).
  const movesBar = $('moves');
  let movesKey = '';
  function syncMoves() {
    const list = moves(), key = state.surface + ':' + state.k + ':' + list.map((m) => m.kind + m.name).join('|');
    if (key !== movesKey) {
      movesKey = key;
      movesBar.textContent = '';
      for (const m of list) {
        const el = document.createElement(m.items ? 'mm-menu' : 'button');
        el.dataset.move = m.kind;
        el.setAttribute('aria-label', m.name);
        if (m.items) el.innerHTML = ICONS[m.icon];
        else { el.type = 'button'; el.className = 'btn btn-sm btn-icon'; el.title = m.name; el.innerHTML = ICONS[m.icon]; }
        movesBar.appendChild(el);
      }
    }
    for (const m of list) {
      const el = movesBar.querySelector('[data-move="' + m.kind + '"]');
      if (m.items && el && JSON.stringify(el.items) !== JSON.stringify(m.items)) el.items = m.items;
    }
  }
  // a move chosen from a menu (its points, as labels) or a button (all the points)
  movesBar.addEventListener('change', (e) => {
    const el = e.target.closest('mm-menu');
    if (!el) return;
    const [a, b] = String(e.detail.value).split(',').map(Number), cl = clusters();
    const A = cl.find((c) => c.idx.includes(a)), B = b === undefined ? null : cl.find((c) => c.idx.includes(b));
    finish();
    if (A) play(el.dataset.move, A.idx, B ? B.idx : null);
  });
  movesBar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-move]');
    if (!b) return;
    finish();
    play(b.dataset.move, clusters()[0].idx, null);
  });

  /* ---------- the stage: dragging and the keyboard ---------- */

  // A point is dragged by itself or any of its copies. From a collision, the point on top of the
  // pile (the last dragged) comes out; dropped on another point, it collides with it. Elsewhere
  // on a sphere, a drag turns the sphere.
  stage.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    const g = e.target.closest('.cs-pt');
    if (!g) {
      if (G.ball && e.target.closest('.cs-turn')) {
        e.preventDefault();
        state.rolling = { x: e.clientX, y: e.clientY, id: e.pointerId };
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
      }
      return;
    }
    e.preventDefault();
    stop();
    const c = clusters()[+g.dataset.c], t = +g.dataset.t, i = topOf(c.idx), m = stageXY(e), before = snap();
    raise(i);
    const drag = { idx: [i], moved: false, start: [e.clientX, e.clientY], id: e.pointerId, before, steps: null };
    if (G.ball) {
      // the copy grabbed (p or its opposite), and the side of the sphere it was on
      const sign = +g.dataset.s, q = onBall(c.p.map((x) => sign * x));
      Object.assign(drag, { sign, side: q[2] < 0 ? -1 : 1, off: [m[0] - q[0], m[1] - q[1]] });
    } else {
      const at = t >= 0 ? CS.neighbours(state.surface)[t].f(c.p) : c.p, p = toModel(e);
      drag.off = [p[0] - at[0], p[1] - at[1]];
    }
    state.drag = drag;
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
  });
  stage.addEventListener('pointermove', (e) => {
    const r = state.rolling;
    if (r && e.pointerId === r.id) {
      // the near side of the sphere follows the pointer
      const f = G.W / (stage.getBoundingClientRect().width || G.W);
      state.ball = mm(mm(rotY((e.clientX - r.x) * f / G.R), rotX((e.clientY - r.y) * f / G.R)), state.ball);
      r.x = e.clientX;
      r.y = e.clientY;
      dirty.stage = true;
      wake();
      return;
    }
    const d = state.drag;
    if (!d || e.pointerId !== d.id || d.pick) return;
    if (!d.moved && Math.hypot(e.clientX - d.start[0], e.clientY - d.start[1]) < 3) return;
    if (!d.moved) { d.moved = true; d.steps = [d.before.pts]; }
    if (G.ball) {
      const m = stageXY(e);
      move(d.idx, ballAt(m[0] - d.off[0], m[1] - d.off[1], d.side).map((x) => d.sign * x));
    } else {
      const m = toModel(e);
      move(d.idx, CS.wrap(state.surface, [m[0] - d.off[0], m[1] - d.off[1]], LO));
    }
    d.steps.push(state.pts.map((p) => p.slice()));
    record(false);
    state.target = snapTarget(d.idx);
    redraw();
  });
  function endDrag(e, cancelled) {
    if (state.rolling && e.pointerId === state.rolling.id) { state.rolling = null; return; }
    const d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    state.drag = null;
    if (d.moved) {
      if (!cancelled && state.target) { merge(d.idx, state.target); record(true); }
      d.steps.push(state.pts.map((p) => p.slice()));
      remember(Object.assign({ from: d.before, to: snap() }, through(d.steps)));
    }
    state.target = null;
    draw();
  }
  stage.addEventListener('pointerup', (e) => endDrag(e, false));
  stage.addEventListener('pointercancel', (e) => endDrag(e, true));

  // The arrow keys move a point, or the top one of a collision, out of it; on a sphere along the
  // screen's directions. Moving towards another point, it collides with it once close.
  const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  stage.addEventListener('keydown', (e) => {
    const g = e.target.closest('.cs-pt');
    if (!g || e.altKey || e.ctrlKey || e.metaKey) return;
    const c = clusters()[+g.dataset.c], a = ARROWS[e.key];
    if (a) {
      stop();
      const id = state.surface, i = topOf(c.idx), p = state.pts[i], step = (e.shiftKey ? 2 : 9) / G.unit, before = snap();
      raise(i);
      move([i], G.ball ? mtv(state.ball, mv(a[0] ? rotY(a[0] * step) : rotX(-a[1] * step), mv(state.ball, p)))
        : CS.wrap(id, [p[0] + a[0] * step, p[1] + a[1] * step], LO));
      record(false);
      const t = snapTarget([i]);
      if (t && CS.dist(id, state.pts[i], state.pts[t[0]]) < CS.dist(id, p, state.pts[t[0]])) { merge([i], t); record(true); }
      keyStep(i, before);
    } else return;
    e.preventDefault();
    draw();
  });

  // the 3D pictures turn under a drag (on a touch screen, one that starts sideways), or the arrow
  // keys. Those with an upright axis turn like a turntable: sideways about that axis, and up or
  // down they tip towards the reader or away, no further than looking straight down or up.
  function turnBy(dx, dy, k = turnable()) {
    const up = UPRIGHT[k], v = state.views[k];
    if (up === undefined) { state.views[k] = mm(mm(rotY(dx), rotX(dy)), v); return; }
    const el = Math.atan2(v[2][up], v[1][up]), tip = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, el + dy)) - el;
    state.views[k] = mm(rotX(tip), mm(v, up === 1 ? rotY(dx) : rotZ(dx)));
  }
  spaceTurn = MM.turnDrag(spaceCv, {
    when: () => !!turnable(),
    start: () => { state.turning = true; },
    move: (dx, dy) => { turnBy(dx / 150, dy / 150); dirty.space = true; wake(); },
    // let go: if it was turning on its own, it carries on
    end: () => { state.turning = false; wake(); },
    keys: {
      turn: (a, b) => { turnBy(a, b); drawSpace(); },
      home: () => { state.views[turnable()] = VIEWS[turnable()]; drawSpace(); },
    },
  });
  // … and the braid's box
  braidTurn = MM.turnDrag(braidCv, {
    when: () => braid3d,
    move: (dx, dy) => { turnBy(dx / 150, dy / 150, 'braid'); drawBraid(); },
    keys: {
      turn: (a, b) => { turnBy(a, b, 'braid'); drawBraid(); },
      home: () => { state.views.braid = VIEWS.braid; drawBraid(); },
    },
  });

  /* ---------- the braid group: its generators, as braids ---------- */

  // The braid group of the case in view is generated, from the points in a row, by the loops
  // listed (the text says why): for P_k(X), each x_j once round each x_i with i < j, and each point
  // once across each pair of glued edges (on the projective plane, to its opposite point), the
  // others held; for B_k(X), the swaps of neighbours in the row and the loops of x_1. On the circle
  // it is all the points once round (ordered), or each to the next (unordered); on the line there
  // are none. The braid figure shows the strands of the chosen loop (drawBraid), and choosing one
  // plays it: the points jump into the row, the paths are cleared, and the loop plays in the
  // figure at the top, which the copy beside the braid shows meanwhile (otherwise the row).
  const rowAt = (i, k) => (i + 1) / (k + 1);   // the row: across the middle of the square, x_1 at the left
  const DISC = 1.3;                             // on a sphere, the row's square drawn this large in the near disc
  function generators() {
    const s = CS.SURFACES[state.surface], k = state.k, o = state.ordered, out = [];
    const x = (i) => '$x_{' + (i + 1) + '}$';
    if (s.dim === 1) {
      if (s.x) out.push(o || k === 1 ? { key: 'turn', label: k > 1 ? 'all once round' : x(0) + ' once round', kind: 'turn' } : { key: 'next', label: 'each to the next', kind: 'next' });
      return out;
    }
    if (o) for (let j = 1; j < k; j++) for (let i = 0; i < j; i++) out.push({ key: 'r' + i + j, label: x(j) + ' round ' + x(i), kind: 'round', a: j, b: i });
    else for (let i = 0; i + 1 < k; i++) out.push({ key: 's' + i, label: 'swap ' + x(i) + ', ' + x(i + 1), kind: 'swap', a: i, b: i + 1 });
    for (const j of o ? [...Array(k).keys()] : [0]) {
      if (s.antipodal) out.push({ key: 'p' + j, label: x(j) + ' to its opposite', kind: 'across', a: j });
      if (s.x) out.push({ key: 'x' + j, label: x(j) + ' across the sides', kind: 'across', a: j });
      if (s.y) out.push({ key: 'y' + j, label: x(j) + ' across the top', kind: 'acrossY', a: j });
    }
    return out;
  }

  const STEP = 0.005;
  const arcPts = (c, r, a0, a1) => {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / STEP));
    return Array.from({ length: n + 1 }, (_, q) => { const a = a0 + (a1 - a0) * q / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
  };
  // a cubic Bézier from p0 to p3, as points about STEP apart
  function bezier(p0, p1, p2, p3) {
    const len = [[p0, p1], [p1, p2], [p2, p3]].reduce((t, [a, b]) => t + Math.hypot(b[0] - a[0], b[1] - a[1]), 0), n = Math.max(8, Math.ceil(len / STEP));
    return Array.from({ length: n + 1 }, (_, q) => { const t = q / n, u = 1 - t; return [0, 1].map((d) => u * u * u * p0[d] + 3 * u * u * t * p1[d] + 3 * u * t * t * p2[d] + t * t * t * p3[d]); });
  }
  // The ways of a generator's moving points from the row, in the plane of the row (on a sphere,
  // the near disc): { i: [pieces] }, a piece a list of points; the second piece of a loop to the
  // opposite point is that point's opposite. A swap: the two points turn half-way about their
  // midpoint. x_j round x_i: a loop round x_i alone, counterclockwise: over the top to the far side
  // of x_i, then back underneath it, and from there, if there are points between them, up and
  // back over them (behind them, seen from the bottom edge), nearer them than on the way out;
  // smooth, so that its strand never stops or turns a corner. Across the sides:
  // along, rising a little, out at the right edge and in at the left (on the Möbius band below the
  // row); across the top: up, out at the top edge and in at the bottom (on the Klein bottle at the
  // mirror place, the same point); to the opposite point: straight to the top of the disc, so over
  // the rim of the sphere square to it (seen from below, no corner where the point gives way to its
  // opposite), and up again from its bottom.
  function genWays(g) {
    const s = CS.SURFACES[state.surface], k = state.k, c = (i) => rowAt(i, k), gp = 1 / (k + 1), y0 = 0.5, ways = {};
    const plane = (pts) => (s.ball ? pts.map(([x, y]) => [DISC * (x - 0.5), DISC * (y - 0.5)]) : pts);
    const line = (f) => { const n = Math.ceil(1 / STEP); return Array.from({ length: n + 1 }, (_, q) => f(q / n)); };
    if (g.kind === 'swap') {
      const m = [(c(g.a) + c(g.b)) / 2, y0], r = Math.abs(c(g.b) - c(g.a)) / 2;
      ways[g.a] = [plane(arcPts(m, r, Math.PI, 2 * Math.PI))];
      ways[g.b] = [plane(arcPts(m, r, 0, Math.PI))];
    } else if (g.kind === 'round') {
      // drawn with x_j to the right of x_i, and turned half-way round about x_i if it is to the left;
      // m: how many places apart they are. Back from underneath x_i, the way leaves the circle
      // round it rising, at 45°, so that it never runs straight up (in the braid, a halt).
      const j = g.a, i = g.b, d = Math.sign(c(j) - c(i)), m = Math.abs(j - i), D = m * gp, rho = 0.42 * gp, H = 0.55 * gp * (m + 1);
      const out = bezier([D, 0], [D, H], [-rho, H], [-rho, 0]);
      let back;
      if (m === 1) back = bezier([-rho, 0], [-rho, -H], [D, -H], [D, 0]);
      else {
        const b = Math.PI / 4, E = [rho * Math.cos(b), -rho * Math.sin(b)], L = 0.9 * gp;
        back = arcPts([0, 0], rho, Math.PI, 2 * Math.PI - b).concat(bezier(E, [E[0] + L * Math.sin(b), E[1] + L * Math.cos(b)], [D, 0.55 * gp * m], [D, 0]).slice(1));
      }
      ways[j] = [plane(out.concat(back.slice(1)).map(([x, y]) => [c(i) + d * x, y0 + d * y]))];
    } else if (g.kind === 'across' && s.antipodal) {
      const u = DISC * (c(g.a) - 0.5), up = line((t) => { const y = Math.sin(t * Math.PI / 2); return [u * (1 - y), y]; });
      ways[g.a] = [up, up.map(([x, y]) => [x, -y]).reverse()];
    } else if (g.kind === 'across') {
      const j = g.a, h = Math.min(0.6 * gp, 0.25);
      ways[j] = [line((t) => [c(j) + t, y0 + h * Math.sin(Math.PI * t)])];
    } else if (g.kind === 'acrossY') {
      const j = g.a, x1 = s.y === 'flip' ? 1 - c(j) : c(j);
      ways[j] = [line((t) => [c(j) + t * (x1 - c(j)), y0 + t])];
    }
    return ways;
  }
  // The motion of a generator from the row: the row (as points of the model), the configuration
  // at time t, each moving point along its way at a pace that starts and ends at rest, and for the
  // braid figure where each point is at time t: on a curve its place along it (seen(t)); on a
  // surface its place in the plane of the row, or on a sphere in the near disc, with whether it is
  // the opposite point that is there (at(t)). On the circle the points are spread evenly, and turn
  // together.
  function genMotion(g) {
    const id = state.surface, s = CS.SURFACES[id], k = state.k, B0 = state.ball.map((r) => r.slice());
    if (s.dim === 1) {
      const row = Array.from({ length: k }, (_, i) => [(i + 0.5) / k, 0.5]), shift = g.kind === 'next' ? 1 / k : 1;
      const x = (p, t) => ((p[0] + ease(t) * shift) % 1 + 1) % 1;
      return { base: row, config: (t) => row.map((p) => CS.wrap(id, [x(p, t), 0.5], LO)), seen: (t) => row.map((p) => [x(p, t), 0]) };
    }
    const ways = genWays(g);
    const lift = (u, w) => mtv(B0, [u, w, Math.sqrt(Math.max(0, 1 - u * u - w * w))]);
    const model = (q, anti) => (s.ball ? (anti ? lift(q[0], q[1]).map((v) => -v) : lift(q[0], q[1])) : CS.wrap(id, q, LO));
    const rowPt = (i) => (s.ball ? [DISC * (rowAt(i, k) - 0.5), 0] : [rowAt(i, k), 0.5]);
    // each way by its length (on a sphere, measured on the sphere), the pieces end to end
    const z = (p) => (s.ball ? Math.sqrt(Math.max(0, 1 - p[0] * p[0] - p[1] * p[1])) : 0);
    const along = {};
    for (const i in ways) {
      const pieces = ways[i], L = [];
      let tot = 0;
      pieces.forEach((pc) => { const l = [0]; for (let m = 1; m < pc.length; m++) l.push(l[m - 1] + Math.hypot(pc[m][0] - pc[m - 1][0], pc[m][1] - pc[m - 1][1], z(pc[m]) - z(pc[m - 1]))); L.push(l); tot += l[l.length - 1]; });
      along[i] = { pieces, L, tot };
    }
    // the point of way i at fraction f of its length, and whether it is on the opposite side
    function on(i, f) {
      const w = along[i];
      let want = Math.max(0, Math.min(1, f)) * w.tot;
      for (let pi = 0; pi < w.pieces.length; pi++) {
        const pc = w.pieces[pi], l = w.L[pi], len = l[l.length - 1];
        if (want <= len || pi === w.pieces.length - 1) {
          let lo = 0, hi = l.length - 1;
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (l[mid] <= want) lo = mid; else hi = mid; }
          const t = l[hi] > l[lo] ? Math.min(1, (want - l[lo]) / (l[hi] - l[lo])) : 0;
          return { q: [pc[lo][0] + t * (pc[hi][0] - pc[lo][0]), pc[lo][1] + t * (pc[hi][1] - pc[lo][1])], anti: pi > 0 };
        }
        want -= len;
      }
      return null;
    }
    const where = (i, t) => (along[i] ? on(i, ease(t)) : { q: rowPt(i), anti: false });
    return {
      base: Array.from({ length: k }, (_, i) => model(rowPt(i), false)),
      config: (t) => Array.from({ length: k }, (_, i) => { const p = where(i, t); return model(p.q, p.anti); }),
      at: (t) => Array.from({ length: k }, (_, i) => where(i, t)),
    };
  }
  // the generator chosen (by key), or the first
  function chosenGen(list) { return list.find((x) => x.key === state.gen) || list[0] || null; }
  // A generator chosen plays: the points jump into the row, the paths are cleared, and the loop
  // plays from there (the jump and the loop each a change that Undo takes back)
  function playGen() {
    const list = generators(), g = chosenGen(list);
    if (!g) return;
    finish();
    const M = genMotion(g), id = state.surface;
    if (!M.base.every((p, i) => CS.dist(id, p, state.pts[i]) < 1e-9)) {
      const before = snap();
      apply({ pts: M.base, order: state.order.slice() });
      remember({ from: before, to: snap(), path: null });
    }
    clearPaths();
    const path = M.config, T = g.kind === 'swap' ? 1900 : 2600;
    const entry = { from: snap(), to: { pts: path(1), order: state.order.slice() }, path, T };
    remember(entry);
    braidPlay = { entry, path, end: null };
    run(path, T, () => { apply(entry.to); braidPlay.end = clock(); }, (t) => {
      if (undoStack[undoStack.length - 1] !== entry) return;
      if (t < 0.02) { undoStack.pop(); return; }
      Object.assign(entry, { path: (u) => path(u * t), to: snap(), T: T * t });
    });
    draw();
  }

  // the generators as buttons, the one chosen pressed; one tab stop, the arrow keys go through them
  const gensBox = $('gens');
  let gensKey = '';
  function syncGens(list, g) {
    const key = list.map((x) => x.key + x.label).join('|');
    if (key !== gensKey) {
      gensKey = key;
      gensBox.textContent = '';
      for (const x of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm';
        b.dataset.key = x.key;
        b.setAttribute('role', 'radio');
        MM.setHTML(b, x.label);
        gensBox.appendChild(b);
      }
    }
    for (const b of gensBox.children) {
      const on = b.dataset.key === g.key;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }
  // a generator chosen is drawn and played (chosen again, played again)
  gensBox.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.gen = b.dataset.key;
    drawBraid();
    playGen();
  });
  gensBox.addEventListener('keydown', (e) => {
    const items = Array.from(gensBox.children), i = items.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (to === undefined || i < 0) return;
    e.preventDefault();
    const b = items[(to + items.length) % items.length];
    b.click();
    b.focus();
  });

  // where a curve is: on the line, no braids; with one point and no loops of X, none either
  function braidAbsent() {
    const s = CS.SURFACES[state.surface];
    if (s.dim === 1) return '';
    return 'With one point the braid group is $\\pi_1(' + s.tex + ')$, which is trivial.';
  }
  // The braid figure. On a curve: the curve along the top, the strands under it, time going up as
  // on the stage, each cut where it goes out at one end and comes back at the other (the strands of
  // a curve never cross). On a surface: the strands in X × [0, 1], time going up, in the box over
  // the square (or the cylinder over the near disc of a sphere), which turns like the other 3D
  // pictures: its sides glued as the square's edges are (solid, with the square's arrows on its top
  // and bottom faces), its open sides dashed; on the projective plane opposite points of the side
  // are the same point. A strand that goes out through a glued side comes back through the other,
  // both places marked with a ring (on the projective plane joined by a dashed line through the
  // axis, as opposite points are in the other pictures). The points end on the top, with names.
  let braidShown = '', braidGeo = null, braid3d = false;
  // whether the braids are drawn in a box (on a surface with loops to draw)
  function braidBoxed() { return CS.SURFACES[state.surface].dim !== 1 && generators().length > 0; }
  const BRAIDH = 1.2; // the height of the box, in sides of the square
  function drawBraid() {
    const list = generators(), s = CS.SURFACES[state.surface], one = s.dim === 1, g = chosenGen(list);
    $('braid-fig').hidden = !g;
    const absent = !g && !one ? braidAbsent() : '';
    $('braid-absent').hidden = !absent;
    MM.setHTML($('braid-absent'), absent);
    braid3d = braidBoxed();
    braidCv.classList.toggle('is-3d', braid3d);
    if (braidTurn) braidTurn.update();
    braidCv.tabIndex = braid3d ? 0 : -1;
    if (!g) return;
    syncGens(list, g);
    drawBraidCopy(g);
    const r = braidCv.getBoundingClientRect(), dpr = MM.pixelRatio(), w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    const key = [state.surface, state.k, state.ordered, g.key, w, h, dpr, braid3d ? state.views.braid.flat().join(',') : ''].join('|');
    if (key === braidShown) return;
    braidShown = key;
    MM.fitCanvas(braidCv, w, h);
    if (braid3d) drawBraidBox(g, w, h); else drawBraidCurve(g, w, h);
    braidCv.setAttribute('aria-label', 'The braid of ' + g.label.replace(/\$x_\{(\d)\}\$/g, 'x$1') + ', time going up.' + (braid3d ? ' Drag sideways or use the arrow keys to turn it.' : ''));
    MM.setHTML($('braid-cap'), one || (!s.ball && !s.x && !s.y) ? 'Time goes up.'
      : s.antipodal ? 'Time goes up; the disc is the near half of the sphere, and opposite points of its rim are the same point.'
        : s.ball ? 'Time goes up; the disc is the near half of the sphere.'
          : 'Time goes up; the sides of the box are glued as the edges of the square are.');
  }
  // Beside the braid, the points in the row where it starts, as the figure at the top draws them
  // (drawn there for a moment and moved here), wherever the points there are; but while a loop
  // chosen here plays at the top, and its path fades, a copy of that figure, which shows it.
  const braidCopy = $('braid-copy'), rowCopy = el('svg');
  MM.copyPicture(braidCopy, [stage]);
  const liveCopy = braidCopy.lastElementChild;
  rowCopy.setAttribute('aria-hidden', 'true');
  braidCopy.appendChild(rowCopy);
  let rowShown = '', copyLive = false, braidPlay = null; // the loop last played from the braids: { entry (for Undo), path, end (its time) }
  function braidLive() {
    const b = braidPlay;
    if (!b || undoStack[undoStack.length - 1] !== b.entry || state.drag) return false;
    if (state.anim) return state.anim.path === b.path;
    return b.end !== null && state.paths && clock() - b.end < FADE;
  }
  function drawBraidCopy(g) {
    const live = copyLive = braidLive();
    // (SVG elements have no hidden property, only the attribute)
    liveCopy.toggleAttribute('hidden', !live);
    rowCopy.toggleAttribute('hidden', live);
    if (live || !g) return;
    const key = [state.surface, state.k, state.ordered, g.key, stage.getAttribute('viewBox'), state.ball.flat().join(',')].join('|');
    if (key === rowShown) return;
    rowShown = key;
    const base = genMotion(g).base, main = stage, keep = { pts: state.pts, order: state.order, history: state.history, lastMove: state.lastMove, drag: state.drag, target: state.target };
    stage = el('svg');
    Object.assign(state, { pts: base, order: base.map((p, i) => i), history: [{ pts: base, jump: false, t: clock() }], lastMove: -Infinity, drag: null, target: null });
    let drawn;
    try { drawStage(); } finally { drawn = stage; stage = main; Object.assign(state, keep); }
    // a picture to look at only
    for (const e of drawn.querySelectorAll('[id], [tabindex], [role], [aria-label]')) ['id', 'tabindex', 'role', 'aria-label'].forEach((a) => e.removeAttribute(a));
    rowCopy.setAttribute('viewBox', main.getAttribute('viewBox'));
    rowCopy.replaceChildren(...drawn.childNodes);
  }
  // the names of the points where they end, at q (on the canvas), above them and apart
  function braidNames(ends, w) {
    let right = -Infinity;
    for (const i of ends.map((q, m) => m).sort((a, b) => ends[a][0] - ends[b][0])) {
      const label = '$x_{' + (i + 1) + '}$', lw = MM.measureLabel(bctx, label, 13);
      const x = Math.min(Math.max(ends[i][0] - lw / 2, right + 4), w - lw - 2);
      right = x + lw;
      bctx.fillStyle = MM.rgba('surface', 0.85);
      bctx.fillRect(x - 2, ends[i][1] - 25, lw + 4, 18);
      MM.canvasLabel(bctx, label, x, ends[i][1] - 16, { size: 13, baseline: 'middle', color: MM.color(state.ordered ? 'ink' : 'ink-3') });
    }
  }
  // the strands' colours: as flat lines (the braid in the plane), or as they are (the tubes in a box)
  const strandColours = (flat) => state.pts.map((p, i) => MM.color('cs-strand-' + (i + 1) + (flat ? '-line' : '')));
  function drawBraidCurve(g, w, h) {
    const s = CS.SURFACES[state.surface], k = state.k, cx = bctx;
    const pad = 22, y0 = 34, y1 = h - 10, X = (x) => pad + x * (w - 2 * pad), N = 120, dy = (y1 - y0) / N;
    const seen = genMotion(g).seen, at = Array.from({ length: N + 1 }, (_, n) => seen(n / N)), cols = strandColours(true);
    // the curve, its ends glued (solid) or open (dashed)
    cx.lineCap = 'round';
    cx.strokeStyle = MM.color('cs-edge');
    cx.lineWidth = 1.6;
    cx.beginPath(); cx.moveTo(X(0), y0); cx.lineTo(X(1), y0); cx.stroke();
    cx.strokeStyle = MM.color(s.x ? 'cs-edge' : 'cs-open');
    cx.lineWidth = s.x ? 1.6 : 1.2;
    cx.setLineDash(s.x ? [] : [3, 3]);
    for (const x of [0, 1]) { cx.beginPath(); cx.moveTo(X(x), y0 - 7); cx.lineTo(X(x), y0 + 7); cx.stroke(); }
    cx.setLineDash([]);
    // the strands, from the foot (the start) up; where one goes out at an end it comes back at the other
    cx.lineJoin = 'round';
    cx.lineWidth = 3.2;
    for (let i = 0; i < k; i++) {
      cx.strokeStyle = cols[i];
      cx.beginPath();
      for (let n = 0; n <= N; n++) {
        const x = at[n][i][0], y = y1 - dy * n;
        if (n && Math.abs(x - at[n - 1][i][0]) > 0.5) {
          const edge = at[n - 1][i][0] > 0.5 ? 1 : 0;
          cx.lineTo(X(edge), y + dy / 2);
          cx.moveTo(X(1 - edge), y + dy / 2);
        }
        if (n) cx.lineTo(X(x), y); else cx.moveTo(X(x), y);
      }
      cx.stroke();
    }
    const ends = at[N].map((p) => [X(p[0]), y0]);
    ends.forEach((q, i) => { cx.beginPath(); cx.arc(q[0], q[1], 5, 0, TAU); cx.fillStyle = cols[i]; cx.fill(); });
    braidNames(ends, w);
  }
  // The strands of a generator on a surface, as runs of [x, y, t] (x, y in the square, or u, w in
  // the near disc of a sphere), cut where a strand goes out through a glued side of the square
  // (or the projective plane's rim) and comes back through the other: a run ends on the side and
  // the next begins on the other, both places marked; and where the points end.
  function braidRuns(g) {
    const id = state.surface, s = CS.SURFACES[id], k = state.k, M = genMotion(g), N = 200;
    const at = Array.from({ length: N + 1 }, (_, n) => M.at(n / N)), place = (q) => (s.ball ? q : CS.wrap(id, q, LO));
    const snap = (v) => (Math.abs(v) < 1e-6 ? 0 : Math.abs(v - 1) < 1e-6 ? 1 : v);
    const strands = [], marks = [];
    for (let i = 0; i < k; i++) {
      const runs = [];
      let run = [];
      const cut = (out, into, t) => { run.push(out.concat(t)); runs.push(run); run = [into.concat(t)]; marks.push({ i, out: out.concat(t), into: into.concat(t) }); };
      for (let n = 0; n <= N; n++) {
        const p = at[n][i], o = n ? at[n - 1][i] : null;
        if (o && s.ball && o.anti !== p.anti) {
          // over the rim, to the opposite point
          const r = Math.hypot(o.q[0], o.q[1]), e = [o.q[0] / r, o.q[1] / r];
          cut(e, [-e[0], -e[1]], (n - 0.5) / N);
        } else if (o && !s.ball) {
          // the way, unwrapped, crosses a side where x or y passes an integer
          for (const d of [0, 1]) {
            const a = Math.floor(o.q[d]), b = Math.floor(p.q[d]);
            if (a === b) continue;
            const f = (Math.max(a, b) - o.q[d]) / (p.q[d] - o.q[d]), dir = [p.q[0] - o.q[0], p.q[1] - o.q[1]];
            const c = [o.q[0] + f * dir[0], o.q[1] + f * dir[1]], side = (e) => CS.wrap(id, [c[0] + e * dir[0], c[1] + e * dir[1]], LO).map(snap);
            cut(side(-1e-9), side(1e-9), (n - 1 + f) / N);
          }
        }
        run.push(place(p.q).concat(n / N));
      }
      runs.push(run);
      strands.push(runs.filter((rn) => rn.length > 1));
    }
    return { strands, marks, ends: at[N].map((p) => place(p.q)) };
  }
  // The braid's pieces, farthest first: each strand as a tube, as the knots are drawn (a piece at a
  // time: a rim of the page's colour, the tube in the strand's colour, paler the farther it is, and
  // a paler line towards the light, each run on a little past the piece's ends so that no seam
  // shows); the box's edges as lines; the points as dots, and the marks as rings.
  const TUBE = 5, RIM = 2, LIGHT = [-0.55, -0.83];
  function paintBraid(items) {
    const cx = bctx, paper = rgbOf('surface'), white = [255, 255, 255], css = (a) => 'rgb(' + a.map(Math.round).join(',') + ')';
    const shade = new Map(), tone = (col, z) => {
      const step = Math.round(Math.max(0, Math.min(1, (z + 1) / 2)) * 15), key = col + step;
      if (!shade.has(key)) {
        const ink = col.match(/[\d.]+/g).map(Number).slice(0, 3), f = 0.5 + 0.5 * step / 15, over = (a) => paper.map((v, j) => v + f * (a[j] - v));
        shade.set(key, [css(over(ink)), css(over(ink.map((v, j) => (v + white[j]) / 2)))]);
      }
      return shade.get(key);
    };
    const run = (a, b, o, r) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
      cx.beginPath(); cx.moveTo(a[0] + o[0] - r * ux, a[1] + o[1] - r * uy); cx.lineTo(b[0] + o[0] + r * ux, b[1] + o[1] + r * uy); cx.stroke();
    };
    const lit = [0.2 * TUBE * LIGHT[0], 0.2 * TUBE * LIGHT[1]], none = [0, 0];
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.dot) { dot(it.dot, it.r, it.ring, cx, it.col); continue; }
      cx.setLineDash(it.dash || []);
      if (!it.tube) { cx.lineCap = 'round'; cx.strokeStyle = it.col; cx.lineWidth = it.w; line(it.a, it.b, cx); continue; }
      const [body, light] = tone(it.col, it.z);
      cx.lineCap = 'butt';
      cx.strokeStyle = MM.color('surface'); cx.lineWidth = TUBE + 2 * RIM; run(it.a, it.b, none, 0.4);
      cx.strokeStyle = body; cx.lineWidth = TUBE; run(it.a, it.b, none, 1.5);
      cx.strokeStyle = light; cx.lineWidth = 0.32 * TUBE; run(it.a, it.b, lit, 2.5);
    }
    cx.setLineDash([]);
  }
  function drawBraidBox(g, w, h) {
    const s = CS.SURFACES[state.surface], ball = !!s.ball, key = [state.surface, state.k, state.ordered, g.key].join('|');
    if (!braidGeo || braidGeo.key !== key) braidGeo = Object.assign(braidRuns(g), { key });
    const { strands, marks, ends } = braidGeo, cols = strandColours();
    // in the box: x right, time up, the square's bottom edge (or the disc's) towards the reader;
    // the picture a little low in the canvas, for the names over the top
    const at3 = ball ? (p) => [p[0] / 2, (p[2] - 0.5) * BRAIDH, -p[1] / 2] : (p) => [p[0] - 0.5, (p[2] - 0.5) * BRAIDH, 0.5 - p[1]];
    const top = 18, cam = camera(state.views.braid, Math.hypot(0.5, ball ? 0 : 0.5, BRAIDH / 2), w, h - top, 0.5, 8);
    const proj = (p) => { const q = cam(at3(p)); q[1] += top; return q; };
    const items = [], ink = MM.color('cs-edge'), faint = MM.color('cs-open');
    const seg = (p, q, col, wd, extra) => { const a = proj(p), b = proj(q); items.push(Object.assign({ z: (a[2] + b[2]) / 2, a, b, col, w: wd, halo: 0, alpha: 1 }, extra)); };
    const edge = (glued) => (glued ? [ink, 1.4, {}] : [faint, 1, { dash: [4, 4] }]);
    if (ball) {
      // the rims, glued (solid) on the projective plane, where the sphere goes on (dashed) on the
      // sphere, in short pieces so that each lies at its own depth; and the outline of the side
      const n = 64, rim = (a, t) => [Math.cos(a), Math.sin(a), t];
      for (const t of [0, 1]) for (let m = 0; m < n; m++) seg(rim(TAU * m / n, t), rim(TAU * (m + 1) / n, t), ...edge(s.antipodal));
      let lo = null, hi = null;
      for (let m = 0; m < 360; m++) { const a = TAU * m / 360, x = proj(rim(a, 0.5))[0]; if (!lo || x < lo[0]) lo = [x, a]; if (!hi || x > hi[0]) hi = [x, a]; }
      for (const [, a] of [lo, hi]) seg(rim(a, 0), rim(a, 1), faint, 1, { dash: [4, 4] });
    } else {
      for (const x of [0, 1]) for (const y of [0, 1]) seg([x, y, 0], [x, y, 1], faint, 1, { dash: [4, 4] });
      for (const t of [0, 1]) {
        for (const x of [0, 1]) seg([x, 0, t], [x, 1, t], ...edge(s.x));
        for (const y of [0, 1]) seg([0, y, t], [1, y, t], ...edge(s.y));
      }
    }
    strands.forEach((runs, i) => {
      for (const rn of runs) {
        const P = rn.map(proj);
        for (let n = 1; n < P.length; n++) items.push({ z: (P[n - 1][2] + P[n][2]) / 2, a: P[n - 1], b: P[n], col: cols[i], tube: true });
      }
    });
    // where a strand crosses a glued side: the level at that moment, faint, with the two places on its rim
    for (const m of marks) {
      const t = m.out[2], level = ball ? Array.from({ length: 49 }, (_, n) => [Math.cos(TAU * n / 48), Math.sin(TAU * n / 48), t]) : [[0, 0, t], [1, 0, t], [1, 1, t], [0, 1, t], [0, 0, t]];
      for (let n = 1; n < level.length; n++) seg(level[n - 1], level[n], faint, 1, { dash: [2, 3] });
      for (const p of [m.out, m.into]) { const q = proj(p); items.push({ z: q[2] + 0.02, dot: q, r: 4, ring: true, col: cols[m.i] }); }
      if (ball) seg(m.out, m.into, cols[m.i], 1, { dash: [3, 4] });
    }
    const tops = ends.map((p, i) => { const q = proj(p.concat(1)); items.push({ z: q[2] + 0.02, dot: q, r: 5, col: cols[i] }); return q; });
    paintBraid(items);
    // the square's arrows on the glued sides of the top and bottom faces
    bctx.strokeStyle = ink;
    bctx.lineWidth = 1.4;
    bctx.lineJoin = 'round';
    if (!ball) for (const t of [0, 1]) for (const [a, b, glued, dir, n] of edgesOf(s, 0, 0, 1, 1)) if (glued) bctx.stroke(new Path2D(arrowPath(proj(a.concat(t)), proj(b.concat(t)), dir, n)));
    braidNames(tops, w);
  }

  /* ---------- readouts ---------- */

  const space = (k, ordered) => (ordered ? '\\Conf' : '\\UConf') + '_{' + k + '}(' + CS.SURFACES[state.surface].tex + ')';
  // the space as the base of a power: in brackets if it has an exponent or a product of its own
  const base = (tex) => (/[\^_]|\\times/.test(tex) ? '(' + tex + ')' : tex);
  const list = (b) => b.join(',\\,');

  function drawTitle() {
    const s = CS.SURFACES[state.surface], k = state.k;
    const kind = (k === 1 ? 'one point' : COUNT[k] + (state.ordered ? ' ordered' : ' unordered') + ' points') + ' on the ' + s.name;
    MM.setHTML($('title'), '$' + space(k, state.ordered) + '$ <span class="side-kind">' + kind + '</span>');
    const key = (inner) => '<svg class="cs-key" viewBox="0 0 22 16" aria-hidden="true">' + inner + '</svg>';
    const items = [
      [key('<circle class="handle-point" cx="11" cy="8" r="5.5"/>'), state.ordered || k === 1 ? 'a point $x_i$' : 'a point, named only to follow it'],
      [key('<circle class="handle-point" cx="11" cy="8" r="7.5"/><text class="handle-num" x="11" y="11.6">2</text>'), 'a collision'],
    ];
    if (s.dim === 1) {
      items.push(s.x ? [key('<path class="cs-edge" d="M11 1V15"/>'), 'the ends, glued: one point'] : [key('<path class="cs-edge open" d="M11 1V15"/>'), 'an open end']);
      if (s.x) items.push([key('<g class="cs-ghost"><circle class="handle-point" cx="11" cy="8" r="5.5"/></g>'), 'the same point, across the ends']);
      if (state.paths) items.push([key('<path class="cs-trail" d="M11 1V15"/>'), 'its path, older lower down']);
    } else if (s.ball) {
      items.push([key('<g class="cs-ghost"><circle class="handle-point" cx="11" cy="8" r="5.5"/></g>'), s.antipodal ? 'the same point, opposite' : 'a point on the far side']);
    } else {
      if (s.x || s.y) items.push([key('<path class="cs-edge" d="M1 8H21"/><path class="cs-arrow" d="M8.5 3.5 13 8 8.5 12.5"/>'), 'glued edges, as the arrows say']);
      if (!s.x || !s.y) items.push([key('<path class="cs-edge open" d="M1 8H21"/>'), 'an open end']);
      if (s.x || s.y) items.push([key('<g class="cs-ghost"><circle class="handle-point" cx="11" cy="8" r="5.5"/></g>'), 'the same point, across an edge']);
    }
    MM.setHTML($('legend'), items.map(([k2, t]) => '<span class="legend-item">' + k2 + t + '</span>').join(''));
  }

  // the answers about the space, each linked to the section of the text that explains it
  const link = (sec, html) => '<a href="#' + sec + '">' + html + '</a>';
  function drawAbout() {
    const id = state.surface, s = CS.SURFACES[id], k = state.k, o = state.ordered;
    const chi = o ? CS.chiOrdered(id, k) : CS.chiUnordered(id, k);
    if (s.dim === 1) {
      // the pieces: one for each order (the line) or cyclic order (the circle) of ordered points
      const pieces = (o ? CS.bettiOrdered(id, k) : CS.bettiUnordered(id, k))[0];
      const rows = [
        ['Dimension', '$' + k + '$'],
        ['Components', link('sec-collisions', '$' + pieces + '$')],
        ['Euler characteristic', link('sec-cohomology', '$' + chi + '$')],
        ['Fundamental group', link('sec-braids', s.x ? '$\\ZZ$' : 'trivial') + (pieces > 1 ? ', of each' : '')],
        ['Aspherical', link('sec-braids', 'yes')],
        ['Orientable', link('sec-collisions', !s.x || o || k % 2 ? 'yes' : 'no')],
      ];
      MM.kv($('about'), rows);
      return;
    }
    let pi1;
    if (k === 1) pi1 = '$\\pi_1(' + s.tex + ')' + (s.pi1 === '1' ? '=1' : '\\cong ' + s.pi1) + '$';
    else pi1 = o ? '$P_{' + k + '}(' + s.tex + ')$, ' + link('sec-braids', 'the pure braid group') : '$B_{' + k + '}(' + s.tex + ')$, ' + link('sec-braids', 'the braid group');
    const rows = [
      ['Dimension', '$' + 2 * k + '$'],
      ['Euler characteristic', link('sec-cohomology', '$' + chi + '$')],
      ['Fundamental group', pi1],
      ['Aspherical', link('sec-braids', CS.NOT_ASPHERICAL.has(id) ? 'no' : 'yes')],
      ['Orientable', link('sec-collisions', s.orientable ? 'yes' : 'no')],
    ];
    MM.kv($('about'), rows);
  }

  function drawBetti() {
    const id = state.surface, rows = [];
    for (let j = 1; j <= KMAX; j++) rows.push(state.ordered ? CS.bettiOrdered(id, j) : CS.bettiUnordered(id, j));
    const width = Math.max(...rows.map((b) => b.length)), cols = [...Array(width).keys()];
    MM.setHTML($('betti'), '<caption class="sr-only">Rational Betti numbers of the ' + (state.ordered ? 'ordered' : 'unordered') + ' configuration spaces of 1 to ' + KMAX + ' points</caption>'
      + '<thead><tr><th scope="col">$k$</th>' + cols.map((i) => '<th scope="col" class="num">$b_{' + i + '}$</th>').join('') + '</tr></thead><tbody>'
      + rows.map((b, j) => '<tr' + (j + 1 === state.k ? ' class="is-on"' : '') + '><th scope="row">' + (j + 1) + '</th>'
        + cols.map((i) => (i < b.length ? '<td class="num' + (b[i] ? '' : ' zero') + '">' + b[i] + '</td>' : '<td></td>')).join('') + '</tr>').join('')
      + '</tbody>');
    MM.setHTML($('betti-note'), 'Rational coefficients. ' + link('sec-cohomology', 'How they’re computed'));
  }

  // Why two or more points have no picture: CS.noPicture says which reason applies, and why it holds.
  function whyNoPicture() {
    const id = state.surface, k = state.k, o = state.ordered, S = CS.SURFACES[id].tex, sp = '$' + space(k, o) + '$';
    const why = CS.noPicture(id, k), moved = CS.TRANSLATE.has(id), M = 'a manifold of dimension at most three';
    const conf = '$\\Conf_{' + k + '}(' + S + ')$', rest = '$\\Conf_{' + (k - 1) + '}(' + (S.includes('\\times') ? '(' + S + ')' : S) + '\\setminus 0)$';
    const sheets = Array.from({ length: k }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
    const t = 'A picture would need ' + sp + ' to have' + (moved ? ', up to translation,' : '') + ' the homotopy type of ' + M + '. ';
    if (why.betti) {
      const [i, n] = why.betti, has = '$b_' + i + '=' + n + '$', bound = i > 3 ? 'no homology above degree $3$' : '$b_3\\le 1$';
      if (o) return t + 'It does not: ' + (moved ? 'setting translations aside leaves ' + rest + ', which has ' : 'it has ') + has + ', while ' + M + ' has ' + bound + '.';
      return t + 'It does not: ' + (moved ? 'with translations set aside, it shares a finite cover with ' + rest + ', which has ' + has + ', so that cover has $b_' + i + '\\ge ' + n + '$; '
        : conf + ', which covers it $' + sheets + '$ times, has ' + has + '; ') + 'but a finite cover of ' + M + ' is another, with ' + bound + '.';
    }
    const aspherical = ', while an aspherical manifold of dimension at most three with infinite $\\pi_1$ has $\\chi\\le 0$.';
    if (why.chi) {
      return t + 'It does not: ' + (o ? 'setting translations aside leaves ' + rest + ', which is aspherical with $\\chi=' + why.chi + '$'
        : 'with the sum of the points fixed it is aspherical with $\\chi=' + why.chiUnordered + '$') + aspherical;
    }
    if (why.klein) {
      return t + 'Its Betti numbers would allow one, but $T^2$ covers $K$ twice, and the pairs of points of $T^2$ over distinct points of $K$ form a cover of ' + sp + ' of degree $' + (o ? 4 : 8)
        + '$ with $b_3=2$; a finite cover of ' + M + ' is another, with $b_3\\le 1$.';
    }
    // why.universal: three points on the projective plane
    return t + 'Its Betti numbers would allow one, but its universal cover' + (o ? '' : ', that of $\\Conf_3(\\RR P^2)$,') + ' is homotopy equivalent to $S^3$ while $\\pi_1$ is infinite'
      + ' (forgetting the third point is a fibration over $\\Conf_2(\\RR P^2)\\simeq S^3/Q_8$ with aspherical fibre), and a manifold of dimension at most three whose universal cover has $H_3\\ne 0$ is closed, with finite $\\pi_1$.';
  }
  // Under the figure, where two or more points have no picture: why not.
  function drawWhy() {
    const none = state.k > 1 && !kindNow();
    $('why').hidden = !none;
    if (none) MM.setHTML($('why-text'), '<p>' + whyNoPicture() + '</p>');
  }
  // Under the figure, the parts of the text that depend on the case in view: what is about the
  // plane (data-only="plane": its three points, Artin's braid groups and generators, Arnold's Betti
  // numbers) only for the plane, and what is about surfaces (data-only="surface": points turning
  // about each other, the generators) not on a curve; on a curve, its braids; the open stratum,
  // connected and orientable or not; how the Betti numbers are computed; and the Euler
  // characteristic, worked out.
  function drawText() {
    const id = state.surface, s = CS.SURFACES[id], k = state.k, o = state.ordered, S = s.tex, one = s.dim === 1;
    const paren = base(S), fact = (n) => CS.falling(n, n);
    for (const el of document.querySelectorAll('[data-only]')) el.hidden = el.dataset.only === 'plane' ? id !== 'plane' : one;
    // braids on a curve
    const braids = !one ? '' : s.x
      ? 'On the circle the points keep their cyclic order, so the strands can only turn round together: each component of $\\Conf_k(S^1)$ has fundamental group $\\ZZ$, generated by all the points going once round, and $\\pi_1\\UConf_k(S^1)\\cong\\ZZ$ is generated by moving each point to the next.'
      : 'On the line no point can pass another without a collision, so the strands never cross: every braid of the line is trivial.';
    $('braids-case').hidden = !braids;
    MM.setHTML($('braids-case'), braids);
    // the open stratum
    let open;
    if (k === 1) open = 'With one point there are no collisions, and the space is $' + S + '$ itself.';
    else if (!one) {
      open = 'On a surface the collisions have codimension $2$. So $\\Conf_{' + k + '}(' + S + ')$, the rest of $' + paren + '^{' + k + '}$, is connected, and it is '
        + (s.orientable ? 'orientable, as $' + S + '$ is. A swap of two points exchanges two pairs of coordinates, which keeps the orientation of $' + paren + '^{' + k + '}$, so $\\UConf_{' + k + '}(' + S + ')$ is orientable too.'
          : 'not orientable, as $' + S + '$ is not; nor is $\\UConf_{' + k + '}(' + S + ')$, which it covers.');
    } else if (!s.x) {
      open = 'On a curve the collisions have codimension $1$, and they cut $\\RR^{' + k + '}$ apart: $\\Conf_{' + k + '}(\\RR)$ has a component for each order of the points, $' + k + '!=' + fact(k) + '$ of them, each an open simplex such as $x_1<' + (k > 2 ? '\\dots<' : '') + 'x_' + k + '$. $\\UConf_{' + k + '}(\\RR)$ is one of them.';
    } else {
      open = 'On a curve the collisions have codimension $1$, and a point cannot pass another without one: $\\Conf_{' + k + '}(S^1)$ has a component for each cyclic order of the points, '
        + (k === 2 ? 'and two points have only one, so it is connected, an annulus' : '$(' + k + '-1)!=' + fact(k - 1) + '$ of them, each a circle times an open simplex')
        + '. $\\UConf_{' + k + '}(S^1)$ is connected. Moving each point to the next permutes the $' + k + '$ gaps between them cyclically, which keeps the orientation exactly when their number is odd, so it is '
        + (k % 2 ? 'orientable' : 'not orientable' + (k === 2 ? ': an open Möbius band' : '')) + '.';
    }
    MM.setHTML($('collide-case'), '<p>' + open + '</p>');
    // where the Betti numbers come from
    let how;
    if (one) {
      how = 'On a curve the Betti numbers follow from the components: $b_0$ counts them' + (s.x ? ', and $b_1=b_0$, as each is a circle times an open simplex' : '') + '. A stratum $\\Conf_\\ell(' + S + ')/G$ has a component for each orbit of $G$ on the '
        + (s.x ? 'cyclic ' : '') + 'orders.';
    } else if (id === 'plane' && o) {
      how = ''; // Arnold's formula, above
    } else {
      how = 'The Betti numbers of $' + (o ? '\\Conf' : '\\UConf') + '_k(' + S + ')$ are computed from ' + (o ? 'Petersen’s complex [@petersen2020, §1.17]' : 'Knudsen’s complex [@knudsen2017, Theorem 1.1]')
        + ', built from the compactly supported cohomology of $' + S + '$.';
      // a stratum Conf_ℓ(Σ)/G with G neither trivial nor all of Σ_ℓ (from four unordered points on)
      if (!o && CS.strata(k, false).nodes.some((n) => { const g = CS.groupsOf(n.lambda); return g.length > 1 && g.some((x) => x.length > 1); })) {
        how += ' Those of a stratum $\\Conf_\\ell(' + S + ')/G$ come from the part of Petersen’s complex that $G$ fixes [@petersen2020, §1.17].';
      }
    }
    $('cohom-case').hidden = !how;
    MM.setHTML($('cohom-case'), how);
    // the Euler characteristic
    const chi = s.chi, sign = one ? '+' : '-', factors = Array.from({ length: k }, (_, i) => { const v = one ? chi + i : chi - i; return v < 0 ? '(' + v + ')' : String(v); });
    const general = '\\chi\\bigl(\\Conf_k(X)\\bigr)=\\chi(X)\\,\\bigl(\\chi(X)' + sign + '1\\bigr)\\cdots\\bigl(\\chi(X)' + sign + 'k' + (one ? '-' : '+') + '1\\bigr)';
    let chiText = '<p>The Euler characteristic is $\\chi=\\sum_i(-1)^ib_i$. It multiplies along fibrations, and taking a point out of a ' + (one ? 'curve cuts it, which raises' : 'surface lowers') + ' $\\chi$ by $1$, so</p>'
      + '$$' + general + '.$$'
      + '<p>For $\\Conf_{' + k + '}(' + S + ')$ this is $' + factors.join('\\cdot') + '=' + CS.chiOrdered(id, k) + '$'
      + (o ? '.' : ', and $\\UConf_{' + k + '}(' + S + ')$, which it covers $' + k + '!$ times, has $\\chi=' + CS.chiOrdered(id, k) + '/' + fact(k) + '=' + CS.chiUnordered(id, k) + '$.') + '</p>';
    if (k === 1) chiText = '<p>The Euler characteristic is $\\chi=\\sum_i(-1)^ib_i$; for $' + S + '$ it is $' + chi + '$.</p>';
    MM.setHTML($('chi-text'), chiText);
  }

  // the strata: rows by the number of distinct points, k at the top
  function drawStrata(blocks) {
    const { nodes, edges } = CS.strata(state.k, state.ordered);
    const nowKey = state.ordered ? CS.partKey(blocks) : CS.typeOf(blocks).join(',');
    const active = document.activeElement, focus = active && strataSvg.contains(active) ? active.dataset.key : null;
    const label = (n) => (state.ordered ? n.blocks.map((b) => b.map((i) => i + 1).join('')).join('|') : '(' + n.lambda.join(',') + ')');
    // smaller in a narrow column (a phone's, or beside the copy of the points), so that the widest
    // row (seven strata for four points) fits it, and in a wide one no wider than it needs
    // (floored: a column a fraction of a pixel narrower than the diagram would scroll)
    const column = Math.floor(strataSvg.parentNode.getBoundingClientRect().width) || 300, room = Math.min(column, 480);
    const rows = [];
    for (let r = state.k; r >= 1; r--) rows.push(nodes.map((n, i) => i).filter((i) => nodes[i].parts === r));
    const needAt = (sz, pd) => Math.max(...rows.map((row) => row.reduce((t, i) => t + Math.max(30, MM.measureLabel(measure, '$' + label(nodes[i]) + '$', sz) + pd) + 4, 0)));
    const narrow = column < 380 || needAt(12.5, 12) > column;
    const size = narrow ? 11 : 12.5, pad = narrow ? 9 : 12, H = narrow ? 24 : 26, gap = 46, top = 4;
    const widthOf = (n) => Math.max(30, MM.measureLabel(measure, '$' + label(n) + '$', size) + pad);
    // order each row by where its neighbours are, to keep the lines from crossing
    const x = new Map();
    const place = (row) => row.forEach((i, j) => x.set(i, (j + 0.5) / row.length));
    rows.forEach(place);
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 1; r < rows.length; r++) {
        const up = (i) => { const ns = edges.filter((e) => e[1] === i).map((e) => x.get(e[0])); return ns.reduce((t, v) => t + v, 0) / ns.length; };
        rows[r].sort((a, b) => up(a) - up(b) || a - b);
        place(rows[r]);
      }
    }
    const need = Math.max(...rows.map((row) => row.reduce((t, i) => t + widthOf(nodes[i]) + 4, 0)));
    const W = Math.max(need, room);
    strataSvg.setAttribute('width', W);
    strataSvg.setAttribute('height', top * 2 + (rows.length - 1) * gap + H);
    strataSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + (top * 2 + (rows.length - 1) * gap + H));
    strataSvg.setAttribute('aria-label', 'The collision strata of ' + (state.ordered ? 'the product' : 'the symmetric product') + ', by the number of distinct points; each lies in the closure of those joined to it above. Choose one to move the points into it.');
    strataSvg.textContent = '';
    const pos = new Map();
    rows.forEach((row, r) => row.forEach((i) => pos.set(i, [x.get(i) * W, top + r * gap])));
    const now = nodes.findIndex((n) => n.key === nowKey);
    for (const [a, b] of edges) {
      const [xa, ya] = pos.get(a), [xb, yb] = pos.get(b);
      el('line', { class: 'st-edge' + (a === now || b === now ? ' is-on' : ''), x1: xa, y1: ya + H, x2: xb, y2: yb }, strataSvg);
    }
    nodes.forEach((n, i) => {
      const [cx, y] = pos.get(i), w = widthOf(n);
      const g = el('g', { class: 'st-node' + (i === now ? ' is-on' : ''), tabindex: 0, role: 'button', 'data-i': i, 'data-key': n.key, 'aria-pressed': String(i === now) }, strataSvg);
      g.setAttribute('aria-label', 'Stratum ' + label(n) + ': ' + stratumWords(state.ordered ? n.blocks : null, state.ordered ? null : n.lambda, true));
      el('rect', { class: 'focus-ring', x: cx - w / 2 - 3, y: y - 3, width: w + 6, height: H + 6, rx: 8 }, g);
      el('rect', { class: 'st-box', x: cx - w / 2, y, width: w, height: H, rx: 6 }, g);
      const t = el('text', { class: 'st-name', x: cx, y: y + H / 2 + size * 0.36 }, g);
      t.style.fontSize = size + 'px';
      MM.svgLabel(t, '$' + label(n) + '$');
    });
    if (focus) { const again = strataSvg.querySelector('[data-key="' + focus + '"]'); if (again) again.focus({ preventScroll: true }); }
  }

  // what a stratum is, in words: who is together (ordered) or the multiplicities (unordered)
  function stratumWords(blocks, lambda, plain) {
    if (blocks) {
      const big = blocks.filter((b) => b.length > 1);
      if (!big.length) return state.k === 1 ? 'one point' : 'no collision';
      const eq = big.map((b) => (plain ? plainName(b) : '$' + pointName(b) + '$')).join(' and ');
      return eq + (blocks.length > big.length ? (blocks.length - big.length === 1 && state.k > 2 ? ', the other point apart' : ', the others apart') : '');
    }
    const counts = new Map();
    lambda.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
    const parts = [...counts].map(([p, n]) => (n === 1 ? 'a ' : COUNT[n] + ' ') + MULT[p] + ' point' + (n === 1 ? '' : 's'));
    return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0];
  }

  function drawStratum(blocks) {
    const id = state.surface, s = CS.SURFACES[id], k = state.k, n = blocks.length, codim = CS.dimOf(id) * (k - n);
    const whole = state.ordered ? base(s.tex) + '^{' + k + '}' : '\\Sym^{' + k + '}(' + s.tex + ')';
    let what, betti;
    if (state.ordered) {
      what = n === 1 ? s.tex : '\\Conf_{' + n + '}(' + s.tex + ')';
      betti = CS.bettiOrdered(id, n);
    } else {
      const lambda = CS.typeOf(blocks), groups = CS.groupsOf(lambda);
      if (n === 1) what = s.tex;
      else if (groups.length === 1) what = '\\UConf_{' + n + '}(' + s.tex + ')';
      else if (groups.every((g) => g.length === 1)) what = '\\Conf_{' + n + '}(' + s.tex + ')';
      else what = '\\Conf_{' + n + '}(' + s.tex + ')/' + groups.filter((g) => g.length > 1).map((g) => '\\Sigma_{' + g.length + '}').join('\\times');
      betti = CS.bettiQuotient(id, n, groups);
    }
    const head = state.ordered ? stratumWords(blocks, null) : '$\\lambda=(' + list(CS.typeOf(blocks)) + ')$: ' + stratumWords(null, CS.typeOf(blocks));
    let body;
    if (n === k) body = k === 1 ? 'The whole ' + (s.dim === 1 ? s.name : 'surface') + '.' : 'The open stratum: $' + space(k, state.ordered) + '$ itself, dense in $' + whole + '$.';
    else body = 'A copy of $' + what + '$, of codimension $' + codim + '$ in $' + whole + '$' + (n === 1 ? ': the small diagonal.' : '.');
    MM.setHTML($('stratum'), '<p>' + head.charAt(0).toUpperCase() + head.slice(1) + '.</p><p>' + body + ' Betti numbers $' + list(betti) + '$.</p>');
  }

  function draw() {
    const s = CS.SURFACES[state.surface];
    dirty.stage = dirty.space = false;
    drawStage();
    // the hint: only what cannot be guessed
    const hint = s.ball ? 'Drag the sphere to turn it.' : '';
    $('hint').hidden = !hint;
    MM.setHTML($('hint'), hint);
    drawTitle();
    drawSpaceText();
    drawSpace();
    drawAbout();
    drawBetti();
    drawWhy();
    drawText();
    const blocks = partition();
    drawStrata(blocks);
    drawStratum(blocks);
    drawBraid();
    syncMoves();
    undoButtons.update();
    if (example) example.changed();
  }

  /* ---------- controls ---------- */

  // where new point i goes: on a sphere, where it would be seen from in front now
  function home(i) {
    if (modelOf(state.surface) !== 'ball') return CS.wrap(state.surface, HOME[i], LO);
    const [x, y] = BALL_HOME[i];
    return mtv(state.ball, [x, y, Math.sqrt(1 - x * x - y * y)]);
  }
  function setCount(k) {
    while (state.pts.length > k) state.pts.pop();
    while (state.pts.length < k) {
      const p = home(state.pts.length);
      state.pts.push(state.pts.some((q) => CS.dist(state.surface, q, p) < SEP / G.unit) ? freeSpot(p, state.pts) : p);
    }
    state.k = k;
    state.order = state.order.filter((i) => i < k);
    for (let i = 0; i < k; i++) if (!state.order.includes(i)) state.order.push(i);
    clearPaths();
  }
  // (another space or number of points starts Undo afresh, and puts the point chosen down)
  $('surface').addEventListener('change', (e) => {
    stop();
    forget();
    const was = modelOf(state.surface);
    state.surface = e.detail.value;
    layout();
    // a curve, a square and a sphere are models of different shapes: going from one to another, the points start again
    if (modelOf(state.surface) !== was) state.pts = state.pts.map((_, i) => home(i));
    // a point near an open end is brought inside; points that meet there collide
    state.pts = state.pts.map((p) => CS.wrap(state.surface, p, LO));
    clearPaths();
    draw();
  });
  $('count').addEventListener('change', (e) => { stop(); forget(); setCount(+e.detail.value); draw(); });
  // the same motion, seen as ordered or as unordered points: the paths are kept
  $('mode').addEventListener('change', (e) => { state.ordered = e.detail.value === 'ordered'; draw(); wake(); });
  $('trails').addEventListener('change', (e) => { state.paths = e.detail.pressed; layout(); draw(); });
  $('spin').addEventListener('change', (e) => { state.spin = e.detail.pressed; wake(); });
  // Undo and Redo, from the buttons and the keyboard, but not while a point is dragged
  const undoButtons = MM.undoRedo({
    undo() { if (!state.drag) undo(); },
    redo() { if (!state.drag) redo(); },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  });
  // a stratum chosen: the points move into it, together or apart, and stop exactly there
  strataSvg.addEventListener('click', (e) => {
    const g = e.target.closest('.st-node');
    if (!g) return;
    finish();
    const before = snap(), n = CS.strata(state.k, state.ordered).nodes[+g.dataset.i];
    const to = stratumPlaces(state.ordered ? n.blocks : nearest(n.lambda));
    if (to.every((p, i) => CS.dist(state.surface, p, before.pts[i]) < 1e-12)) return;
    const way = through([before.pts, to]), path = (t) => way.path(ease(t));
    const entry = { from: before, to: { pts: to, order: before.order.slice() }, path, T: Math.max(500, way.T), strata: true };
    remember(entry);
    run(path, entry.T, () => apply(entry.to), (t) => {
      if (undoStack[undoStack.length - 1] !== entry) return;
      if (t < 0.02) { undoStack.pop(); return; }
      Object.assign(entry, { path: (u) => path(u * t), to: snap(), T: entry.T * t });
    });
    draw();
  });
  strataSvg.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.st-node')) { e.preventDefault(); e.target.closest('.st-node').dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });

  new ResizeObserver(() => { layout(); drawStage(); }).observe(stage);
  new ResizeObserver(() => drawSpace()).observe(spaceCv.parentNode);
  new ResizeObserver(() => drawStrata(partition())).observe(strataSvg.parentNode);
  // A stratum chosen moves the points in the figure at the top, by then out of view: beside the
  // strata, a copy of it (live, as it is an SVG).
  MM.copyPicture($('stage-copy'), [stage]);
  new ResizeObserver(() => drawBraid()).observe(braidCv);
  // turning on its own from the start, unless motion is to be reduced
  $('spin').pressed = state.spin;
  layout();
  clearPaths();
  draw();
  wake();
  MM.onFonts(() => { braidShown = rowShown = ''; draw(); });
  // (the copies of the points beside the braids and the strata show the motions played from there)
  seen = MM.whenVisible([stage, spaceCv, braidCv, $('braid-copy'), $('stage-copy')], (on) => {
    if (!on) { restAt = performance.now(); cancelAnimationFrame(raf); raf = 0; return; }
    rested += performance.now() - restAt; // the figure carries on where it was
    restAt = 0;
    wake();
  });
  // the braid figure, drawn as it comes into view
  MM.whenVisible([braidCv], (on) => { if (on) drawBraid(); });

  /* ---------- links, reset and Save image ---------- */

  example = MM.example({
    fields: { x: 'text', k: 'int', o: 'flag', p: 'numbers', r: 'numbers', t: 'flag', s: 'flag', v: 'rotation', b: 'rotation' },
    view: ['s', 'v', 'b'],
    // (no points while they are where new points go, no order while it is 0, 1, …)
    get: () => ({
      x: state.surface, k: state.k, o: state.ordered, t: state.paths, s: state.spin,
      p: state.pts.every((q, i) => CS.dist(state.surface, q, home(i)) < 1e-6) ? [] : state.pts.flat(),
      r: state.order.every((v, i) => v === i) ? [] : state.order,
      v: state.views[kindNow()] || VIEWS['3d'], b: state.ball,
    }),
    // points a link does not name start where new points go; a picture's view, as it starts
    set(x, named) {
      const dim = Object.hasOwn(CS.SURFACES, x.x) && (modelOf(x.x) === 'ball' ? 3 : 2), k = x.k;
      if (!dim || !(k >= 1 && k <= 4)) return false;
      const pts = named.has('p') && x.p.length, order = named.has('r') && x.r.length;
      if (pts && x.p.length !== dim * k) return false;
      if (order && (x.r.length !== k || new Set(x.r).size !== k || !x.r.every((i) => Number.isInteger(i) && i >= 0 && i < k))) return false;
      stop();
      forget();
      Object.assign(state, { surface: x.x, k, ordered: x.o, paths: x.t, spin: x.s && !MM.reduceMotion(), ball: x.b, views: { ...VIEWS }, drag: null, target: null, turning: null, rolling: null });
      state.order = order ? x.r.slice() : Array.from({ length: k }, (_, i) => i);
      state.pts = Array.from({ length: k }, (_, i) => (pts ? CS.wrap(x.x, x.p.slice(dim * i, dim * i + dim), LO) : home(i)));
      if (VIEWS[kindNow()] && named.has('v')) state.views[kindNow()] = x.v;
      $('surface').value = x.x;
      $('count').value = String(k);
      $('mode').value = x.o ? 'ordered' : 'unordered';
      $('trails').pressed = x.t;
      $('spin').pressed = state.spin;
      layout();
      clearPaths();
      draw();
      wake();
    },
    pictures: () => [{ label: 'Points', element: stage }, { label: 'Configuration space', element: spaceCv }]
      .concat(generators().length ? [{ label: 'Braid', element: braidCv, selected: false }] : [], [{ label: 'Collision strata', element: strataSvg, selected: false }]),
    // for Save image: the points exactly, and the paths, each step by its age (the frame's
    // clock is not the page's)
    scene: {
      get() {
        const now = clock();
        return {
          pts: state.pts, order: state.order, views: state.views, ball: state.ball,
          history: state.history.map((e) => ({ pts: e.pts, jump: e.jump, age: now - e.t })),
          lastAge: isFinite(state.lastMove) ? now - state.lastMove : null,
        };
      },
      set(s) {
        const now = clock();
        Object.assign(state, { pts: s.pts, order: s.order, views: s.views, ball: s.ball });
        state.history = s.history.map((e) => ({ pts: e.pts, jump: e.jump, t: now - e.age }));
        state.lastMove = s.lastAge === null ? -Infinity : now - s.lastAge;
        draw();
      },
    },
    redraw: () => { drawSpace(); braidShown = ''; drawBraid(); },
  });
})();
