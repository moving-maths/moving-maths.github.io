// Dynkin diagrams: the editor and its readouts.
// The mathematics (types, names, roots) is in dynkin.js.
(function () {
  'use strict';
  const D = window.Dynkin, $ = (id) => document.getElementById(id);
  const stage = $('stage'), menu = $('menu');
  const MAX = 12;       // nodes
  const R = 9;          // radius of a node
  const HEIGHT = 30;    // real roots are counted up to this height
  const FAMILY = { finite: 'finite type', affine: 'affine type', hyperbolic: 'hyperbolic type', indefinite: 'indefinite type' };
  const GOLDEN = (1 + Math.sqrt(5)) / 2;              // τ = 2 cos(π/5), the entry of a bond labelled 5
  // The series with a diagram for every n, which the slider under the name runs through:
  // the name of the diagram for each n, from `least` on
  const SERIES = {
    A: { least: 1, name: (n) => ['A', n] }, B: { least: 2, name: (n) => ['B', n] }, C: { least: 3, name: (n) => ['C', n] }, D: { least: 4, name: (n) => ['D', n] },
    A1: { least: 1, name: (n) => ['A', n, 1] }, B1: { least: 3, name: (n) => ['B', n, 1] }, C1: { least: 2, name: (n) => ['C', n, 1] }, D1: { least: 4, name: (n) => ['D', n, 1] },
    A2: { least: 1, name: (n) => ['A', 2 * n, 2] }, A2o: { least: 3, name: (n) => ['A', 2 * n - 1, 2] }, D2: { least: 2, name: (n) => ['D', n + 1, 2] },
  };
  // the series of a diagram, by its name, and its n
  function seriesOf(name) {
    if (!name || name[3] || !'ABCD'.includes(name[0])) return null;
    const [x, k, r] = name;
    if (!r) return k >= SERIES[x].least ? [x, k] : null;
    if (r === 1) return [x + '1', k];
    if (r === 2 && x === 'A') return k % 2 ? (k >= 5 ? ['A2o', (k + 1) / 2] : null) : ['A2', k / 2];
    if (r === 2 && x === 'D') return ['D2', k - 1];
    return null;
  }
  // Hyperbolic diagrams of rank 2 and 3 with no name, as in Root systems: by their matrices, with
  // a layout, a name for under their picture and one in words. Those of rank 2, with a = |a_12|,
  // b = |a_21| and ab > 4, are one family, whose a and b the sliders under the name give; those of
  // rank 3 go by the triangle group of the Weyl group.
  const TRIANGLE = [[0, 0], [1, 0], [0.5, -0.87]], ROW3 = [[0, 0], [1, 0], [2, 0]];
  const HEAVY = 8; // the largest a or b the sliders give
  const UNNAMED = [
    { key: 'hab', A: [[2, -3], [-3, 2]], tex: 'a,b', words: 'Hyperbolic diagrams of rank 2, with numbers a and b' },
    { key: 't23i', A: [[2, -2, 0], [-2, 2, -1], [0, -1, 2]], pos: ROW3, tex: '(2,3,\\infty)', words: 'triangle group (2, 3, ∞)' },
    { key: 'tiii', A: [[2, -2, -2], [-2, 2, -2], [-2, -2, 2]], pos: TRIANGLE, tex: '(\\infty,\\infty,\\infty)', words: 'triangle group (∞, ∞, ∞)' },
    { key: 't344', A: [[2, -1, -2], [-1, 2, -2], [-1, -1, 2]], pos: TRIANGLE, tex: '(3,4,4)', words: 'triangle group (3, 4, 4)' },
    { key: 't246', A: [[2, -2, 0], [-1, 2, -3], [0, -1, 2]], pos: ROW3, tex: '(2,4,6)', words: 'triangle group (2, 4, 6)' },
  ];
  UNNAMED.forEach((u) => { u.pos = u.pos || [[0, 0], [1, 0]]; });
  const PERMS = { 2: [[0, 1], [1, 0]], 3: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] };
  // whether A is of the family of rank 2: a thick bond, ab > 4
  const rankTwoHyperbolic = (A) => A.length === 2 && D.integral(A) && A[0][1] * A[1][0] > 4;
  // the entry of one of them that A is, in any numbering of the nodes
  const unnamedKey = (A) => (rankTwoHyperbolic(A) ? 'hab' : (UNNAMED.find((u) => u.A.length === A.length && A.length === 3 && PERMS[3].some((p) => p.every((pi, i) => p.every((pj, j) => u.A[pi][pj] === A[i][j])))) || {}).key || null);
  // The diagrams under the picture, in a list for each type, each in groups; a series is shown by one of its diagrams
  const LISTS = {
    finite: [[['A', 4], ['B', 4], ['C', 4], ['D', 5]], [['E', 6], ['E', 7], ['E', 8], ['F', 4], ['G', 2]], [['H', 3], ['H', 4], ['I', 2, 0, 5]]],
    affine: [[['A', 3, 1], ['B', 4, 1], ['C', 3, 1], ['D', 5, 1]], [['E', 6, 1], ['E', 7, 1], ['E', 8, 1], ['F', 4, 1], ['G', 2, 1]],
      [['A', 4, 2], ['A', 5, 2], ['D', 4, 2], ['E', 6, 2], ['D', 4, 3]]],
    hyperbolic: [UNNAMED, [['T', 3, 3, 4], ['T', 2, 4, 5], ['E', 10]], [['[', 7, 3], ['[', 5, 3, 3, 3]]],
  };
  // what an entry of the lists stands for: its series, or the diagram itself; the same for the diagram drawn
  const keyOf = (name) => (!Array.isArray(name) ? name.key : name[0] === 'I' ? 'I' : (seriesOf(name) || [])[0] || D.plain(name));
  const SERIES_TEX = {
    A: 'A}_n', B: 'B}_n', C: 'C}_n', D: 'D}_n', A1: 'A}_n^{(1)}', B1: 'B}_n^{(1)}', C1: 'C}_n^{(1)}', D1: 'D}_n^{(1)}',
    A2: 'A}_{2n}^{(2)}', A2o: 'A}_{2n-1}^{(2)}', D2: 'D}_{n+1}^{(2)}', I: 'I}_2(m)',
  };
  const itemTeX = (name) => (!Array.isArray(name) ? name.tex : SERIES_TEX[keyOf(name)] ? '\\mathrm{' + SERIES_TEX[keyOf(name)] : D.tex(name));
  // an entry's matrix and layout
  const presetFor = (item) => (Array.isArray(item) ? D.preset(item) : { A: item.A.map((r) => r.slice()), pos: item.pos });

  // The single source of truth; draw() renders everything from it.
  const state = {
    nodes: [],      // [{ x, y }], in pixels of the stage
    A: [],          // the Cartan matrix
    mode: 'draw',   // what a drag on the diagram does: 'draw' a bond, or 'move' nodes
    sel: null,      // the selection, with its menu beside it: { nodes: [i, …] } or { bond: [i, j] }
    joining: false, // the next node chosen is joined to the node selected (Join, in its menu)
    box: null,      // the box being drawn to select nodes, [x0, y0, x1, y1] in pixels
    plane: 1,       // finite type: the exponent of the plane the roots are projected to
    root: null,     // the root picked there, as its coefficients joined by commas
    turn: null,     // rank 3 and more: the rotation of the picture of the roots
    series: null,   // the series of the diagram drawn, for the slider (SERIES)
    w: 0, h: 0,     // the size of the stage
  };
  let example = null;  // links, reset and Save image (MM.example, at the end)
  const history = [], future = []; // snapshots of nodes and A, for Undo and Redo
  let press = null;    // the pointer, while it is down
  let lastInfo = null; // the types of the diagram as last drawn (a drag changes only the picture)

  const el = MM.svg;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const at = (i) => [state.nodes[i].x, state.nodes[i].y];
  const clamp = (p) => ({ x: Math.max(18, Math.min(state.w - 18, p[0])), y: Math.max(26, Math.min(state.h - 30, p[1])) });

  // the nodes selected; whether the bond between i and j is selected, alone or with its two nodes
  const selNodes = () => (state.sel && state.sel.nodes) || [];
  const isBond = (i, j) => {
    const s = state.sel;
    if (!s) return false;
    return s.bond ? (s.bond[0] === i && s.bond[1] === j) || (s.bond[0] === j && s.bond[1] === i) : s.nodes.length > 1 && s.nodes.includes(i) && s.nodes.includes(j);
  };
  // a note under the picture for a few seconds (why something was not done)
  let note = '', noteTimer = 0;
  function say(text) {
    note = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note = ''; hint(); }, 4000);
  }
  // whether k more nodes would be too many (and then say so)
  const full = (k) => { if (state.nodes.length + k <= MAX) return false; say('Twelve nodes at most.'); return true; };

  /* ---------- editing ---------- */

  const snapshot = () => JSON.stringify({ nodes: state.nodes, A: state.A });
  function remember() {
    undoButtons.keep(history, snapshot());
    future.length = 0;
  }
  function restore(s) {
    const o = JSON.parse(s);
    state.nodes = o.nodes;
    state.A = o.A;
    state.sel = null;
    state.joining = false;
  }
  function undo() { const s = history.pop(); if (!s) return; future.push(snapshot()); restore(s); }
  function redo() { const s = future.pop(); if (!s) return; history.push(snapshot()); restore(s); }
  // a new node at p, joined to nothing (the caller records the step for Undo); its index
  function pushNode(p) {
    const n = state.nodes.length;
    state.nodes.push(clamp(p));
    state.A.forEach((row) => row.push(0));
    state.A.push(range(n + 1).map((i) => (i === n ? 2 : 0)));
    return n;
  }
  const join = (i, j) => { state.A[i][j] = state.A[j][i] = -1; };
  function removeNodes(list) {
    remember();
    list.slice().sort((a, b) => b - a).forEach((i) => {
      state.nodes.splice(i, 1);
      state.A.splice(i, 1);
      state.A.forEach((row) => row.splice(i, 1));
    });
    state.sel = null;
  }
  // |a_ij| = a and |a_ji| = b; both 0 removes the bond
  function setBond(i, j, a, b) {
    remember();
    state.A[i][j] = a ? -a : 0;
    state.A[j][i] = b ? -b : 0;
  }
  // a bond labelled m: a_ij = a_ji = −2 cos(π/m)
  function setLabel(i, j, m) {
    remember();
    state.A[i][j] = state.A[j][i] = D.labelEntry(m);
  }
  // A bond drawn from node i to node j: a single bond if there is none, else one more line
  // (four go back to one) with the arrow pointing to j, or the next label if it has one.
  function addLine(i, j) {
    remember();
    const a = state.A[i][j], m = D.labelOf(a);
    if (m) { state.A[i][j] = state.A[j][i] = D.labelEntry(D.LABELS[(D.LABELS.indexOf(m) + 1) % D.LABELS.length]); return; }
    const lines = a ? Math.max(-a, -state.A[j][i]) : 0, next = lines >= 4 ? 1 : lines + 1;
    state.A[i][j] = -1;
    state.A[j][i] = -next;
  }
  // The ends of a bond as they lie on the screen: the left one first.
  function ends(i, j) {
    const p = state.nodes[i], q = state.nodes[j];
    return p.x < q.x || (p.x === q.x && p.y <= q.y) ? [i, j] : [j, i];
  }
  // the kind of a bond: |a_ij|-|a_ji| for its ends i, j as they lie on the screen, or m and its label
  const bondValue = (i, j) => { const [lo, hi] = ends(i, j), m = D.labelOf(state.A[lo][hi]); return m ? 'm' + m : -state.A[lo][hi] + '-' + -state.A[hi][lo]; };

  // places on a grid (x to the right, y down), in the middle of the stage
  function place(pos) {
    if (!pos.length) return [];
    const xs = pos.map((q) => q[0]), ys = pos.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const step = Math.min(78, (state.w - 80) / Math.max(1, x1 - x0));
    return pos.map((q) => ({ x: state.w / 2 + (q[0] - (x0 + x1) / 2) * step, y: state.h / 2 - 8 + (q[1] - (y0 + y1) / 2) * step }));
  }
  // a diagram of the lists, by its name (or its entry), laid out in the middle of the stage
  function load(name) {
    const p = presetFor(name);
    state.nodes = place(p.pos);
    state.A = p.A;
    state.sel = null;
    state.joining = false;
  }
  // The name of the diagram, if A is its matrix numbered as the lists number it (Bourbaki's,
  // with α_0 first for an affine one), or null.
  function presetOf(A) {
    const info = D.describe(A), part = info.parts.length === 1 && info.parts[0];
    if (!part || !part.name) return null;
    let P;
    try { P = D.preset(part.name); } catch (err) { return null; }
    return P.A.length === A.length && P.A.every((row, i) => row.every((a, j) => a === A[i][j])) ? part.name : null;
  }
  // and that name in a link: e6, e8.1, a5.2, e10, t334, h3, i7 (a path with a label has none)
  const presetName = (A) => {
    const nm = presetOf(A);
    if (!nm || nm[0] === '[') return null;
    return nm[0] === 'T' ? 't' + nm.slice(1).join('') : nm[0].toLowerCase() + (nm[3] || nm[1]) + (nm[2] ? '.' + nm[2] : '');
  };
  // Where a diagram's nodes go when it is not drawn by hand: one of the lists' as they
  // lay it out, a path in a row, any other round a circle.
  function standardNodes(A) {
    const name = presetOf(A), n = A.length, same = UNNAMED.find((u) => JSON.stringify(u.A) === JSON.stringify(A));
    if (name) return place(D.preset(name).pos);
    if (same) return place(same.pos);
    const nb = A.map((row, i) => row.map((a, j) => j).filter((j) => j !== i && A[i][j]));
    const end = nb.findIndex((l) => l.length === 1), order = end < 0 ? [] : [end];
    for (let next = nb[end] && nb[end][0]; next !== undefined && nb[next].length <= 2; next = nb[next].find((j) => !order.includes(j))) order.push(next);
    if (n > 1 && order.length === n) {
      const pos = [];
      order.forEach((i, k) => { pos[i] = [k, 0]; });
      return place(pos);
    }
    return place(A.map((_, i) => [Math.cos(Math.PI + 2 * Math.PI * i / n), Math.sin(Math.PI + 2 * Math.PI * i / n)].map((c) => (n === 1 ? 0 : c * Math.max(1, n / 4)))));
  }
  // a place for a new node beside node `near`, clear of the others
  function freeSpot(near) {
    const from = near === undefined || near === null ? { x: state.w / 2, y: state.h / 2 - 8 } : state.nodes[near], step = 64;
    for (const r of [1, 2, 3]) {
      for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const p = [from.x + dx * step * r, from.y + dy * step * r], c = clamp(p);
        if (c.x !== p[0] || c.y !== p[1]) continue;
        if (state.nodes.every((q) => dist(p, [q.x, q.y]) > 36)) return p;
      }
    }
    return [from.x, from.y];
  }

  /* ---------- the diagram ---------- */

  // A bond is drawn straight unless another node lies in its way; then it bows
  // out to one side. Returns how far the middle of the curve is pulled, across
  // the bond: the curve is (len · t, 2 · bow · t(1 − t)) in the frame of the bond.
  function bow(i, j) {
    const u = state.nodes[i], v = state.nodes[j], len = Math.hypot(v.x - u.x, v.y - u.y) || 1;
    const blocked = state.nodes.some((q, k) => {
      if (k === i || k === j) return false;
      const t = ((q.x - u.x) * (v.x - u.x) + (q.y - u.y) * (v.y - u.y)) / (len * len);
      return t > 0 && t < 1 && Math.hypot(q.x - (u.x + t * (v.x - u.x)), q.y - (u.y + t * (v.y - u.y))) < 20;
    });
    // upwards on the screen: across the bond, the frame's y-axis points down when the bond runs to the right
    return blocked ? (v.x > u.x || (v.x === u.x && v.y > u.y) ? -1 : 1) * Math.max(80, 0.5 * len) : 0;
  }
  // a point of the bond from node i to node j, t from 0 to 1
  function along(i, j, t, bend) {
    const u = state.nodes[i], v = state.nodes[j], len = Math.hypot(v.x - u.x, v.y - u.y) || 1, cx = (v.x - u.x) / len, sx = (v.y - u.y) / len;
    const x = len * t, y = 2 * bend * t * (1 - t);
    return [u.x + cx * x - sx * y, u.y + sx * x + cx * y];
  }

  // the node at p (within reach of a finger on a touch screen, or of a bond let go on it), or −1
  function nodeAt(p, skip, reach) {
    let best = -1, bd = reach || 17;
    state.nodes.forEach((q, i) => { const d = dist(p, [q.x, q.y]); if (i !== skip && d < bd) { bd = d; best = i; } });
    return best;
  }
  function bondAt(p) {
    let best = null, bd = 9;
    for (const b of D.bonds(state.A)) {
      const bend = bow(b.i, b.j);
      for (let k = 0; k <= 24; k++) {
        const d = dist(p, along(b.i, b.j, k / 24, bend)) - (bend ? 0 : 0.01); // a straight bond wins a tie
        if (d < bd) { bd = d; best = [b.i, b.j]; }
      }
    }
    return best;
  }

  const STAGE_LABEL = stage.getAttribute('aria-label');
  function drawStage(info) {
    const active = document.activeElement, focus = active && stage.contains(active) ? active.dataset.key : null;
    stage.textContent = '';
    stage.setAttribute('viewBox', '0 0 ' + state.w + ' ' + state.h);
    stage.classList.toggle('is-drawing', state.mode === 'draw');
    stage.classList.toggle('is-moving', state.mode === 'move');
    const n = state.nodes.length, pr = press && press.moved ? press : null;
    // (with no nodes, the frame itself takes the focus: Enter places a node)
    if (n) { stage.removeAttribute('tabindex'); stage.setAttribute('aria-label', STAGE_LABEL); } else { stage.setAttribute('tabindex', '0'); stage.setAttribute('aria-label', STAGE_LABEL + ' It is empty: Enter places a node.'); }
    if (!n && !pr) el('text', { class: 'dk-empty', x: state.w / 2, y: state.h / 2 }, stage).textContent = state.mode === 'draw' ? 'Click here to place a node' : 'Choose Draw to place nodes';

    // the numbers on the nodes: the highest root in finite type, δ in affine type
    const marks = new Array(n).fill(null);
    for (const part of info ? info.parts : []) {
      const m = part.family === 'finite' ? D.finiteData(D.sub(state.A, part.nodes)).highest : part.family === 'affine' ? part.marks : null;
      if (m) part.nodes.forEach((i, k) => { marks[i] = m[k]; });
    }

    const labels = []; // the labels of bonds (m, or |a_ij|, |a_ji| on a thick one), drawn over the bonds
    for (const b of D.bonds(state.A)) {
      const u = state.nodes[b.i], v = state.nodes[b.j], len = Math.hypot(v.x - u.x, v.y - u.y), ang = Math.atan2(v.y - u.y, v.x - u.x) * 180 / Math.PI;
      const m = D.labelOf(-b.a), heavy = !m && b.a * b.b > 4, lines = m || heavy ? 1 : Math.min(4, Math.max(b.a, b.b)), on = isBond(b.i, b.j);
      // (a thick bond's numbers in the order its ends lie on the screen, the left one first)
      const pair = heavy ? (ends(b.i, b.j)[0] === b.i ? [b.a, b.b] : [b.b, b.a]) : null;
      const name = m ? 'bond labelled ' + m : heavy ? 'thick bond labelled ' + pair.join(', ') : ['single', 'double', 'triple', 'quadruple'][lines - 1] + ' bond';
      const g = el('g', {
        class: 'dk-bond' + (on ? ' is-on' : ''), transform: 'translate(' + u.x + ' ' + u.y + ') rotate(' + ang + ')', 'data-key': 'b' + b.i + '-' + b.j,
        tabindex: 0, role: 'button', 'aria-haspopup': 'menu', 'aria-pressed': String(on),
      }, stage);
      g.setAttribute('aria-label', 'A ' + name + ' between nodes ' + (b.i + 1) + ' and ' + (b.j + 1) + (b.a === b.b || heavy ? '' : ', node ' + (b.a > b.b ? b.i + 1 : b.j + 1) + ' the shorter root') + '. Enter opens its kinds.');
      const bend = bow(b.i, b.j), curve = (o) => (bend ? 'M0 ' + o + 'Q' + len / 2 + ' ' + (bend + o) + ' ' + len + ' ' + o : 'M0 ' + o + 'H' + len);
      el('path', { class: 'dk-halo', d: curve(0) }, g);
      for (let k = 0; k < lines; k++) el('path', { class: 'dk-line' + (heavy ? ' heavy' : ''), d: curve((k - (lines - 1) / 2) * 3.6) }, g);
      el('path', { class: 'dk-hit', d: curve(0) }, g);
      if (m || heavy) {
        // the label beside the middle of the bond, above it (or to its left)
        const [x, y] = along(b.i, b.j, 0.5, bend);
        let nx = (v.y - u.y) / (len || 1), ny = -(v.x - u.x) / (len || 1);
        if (ny > 0 || (Math.abs(ny) < 1e-9 && nx > 0)) { nx = -nx; ny = -ny; }
        labels.push([x + nx * 12, y + ny * 12, '$' + (m || pair.join(',')) + '$']);
        continue;
      }
      // the arrow points to the shorter root, the one with the larger entry in its row
      const hh = 3.4 + 1.8 * lines, mid = bend / 2; // the middle of the curve
      const chevron = (x, dir) => el('path', { class: 'dk-line', d: 'M' + (x - dir * 3.8) + ' ' + (mid - hh) + 'L' + (x + dir * 3.8) + ' ' + mid + 'L' + (x - dir * 3.8) + ' ' + (mid + hh) }, g);
      if (b.a > b.b) chevron(len / 2, -1);
      if (b.b > b.a) chevron(len / 2, 1);
      if (b.a === b.b && b.a > 1) { chevron(len / 2 - 9, -1); chevron(len / 2 + 9, 1); }
    }
    for (const [x, y, text] of labels) MM.svgLabel(el('text', { class: 'dk-blabel', x, y: y + 4.5 }, stage), text);

    // a bond being drawn: from its node, or from where the drag began, to the node under the
    // pointer, or to a new node there
    if (pr && pr.kind === 'draw' && !pr.bond) {
      const a = pr.node >= 0 ? at(pr.node) : pr.p, b = pr.over >= 0 ? at(pr.over) : pr.at;
      el('path', { class: 'dk-line is-new', d: 'M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1] }, stage);
      if (pr.node < 0) el('circle', { class: 'dk-ghost', cx: a[0], cy: a[1], r: R }, stage);
      if (pr.over < 0) el('circle', { class: 'dk-ghost', cx: b[0], cy: b[1], r: R }, stage);
    }

    const sel = selNodes();
    state.nodes.forEach((p, i) => {
      const on = sel.includes(i), joined = range(n).filter((j) => j !== i && state.A[i][j]).map((j) => j + 1);
      const g = el('g', {
        class: 'dk-node draggable' + (on ? ' is-on' : '') + (pr && (pr.kind === 'draw' || pr.kind === 'node') && pr.over === i ? ' is-target' : ''), 'data-key': 'n' + i, tabindex: 0, role: 'button', 'aria-pressed': String(on),
        'aria-label': 'Node ' + (i + 1) + (joined.length ? ', joined to ' + joined.join(', ') : ', joined to nothing') + (marks[i] ? ', with number ' + marks[i] : '') + '. Enter selects it, Space selects it with others, the arrow keys move it, and + adds a node joined to it.',
      }, stage);
      el('circle', { class: 'dk-pad', cx: p.x, cy: p.y, r: 17 }, g);
      el('circle', { class: 'focus-ring', cx: p.x, cy: p.y, r: R + 4.5 }, g);
      el('circle', { class: 'dk-dot', cx: p.x, cy: p.y, r: R }, g);
      // the name and the number go where no bond leaves the node: below and above if they can
      const out = range(n).filter((j) => j !== i && state.A[i][j]).map((j) => { const q = along(i, j, 0.12, bow(i, j)); return Math.atan2(q[1] - p.y, q[0] - p.x); });
      const free = (a) => out.every((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) > 0.7);
      const SIDES = [90, -90, -45, -135, 45, 135, 0, 180].map((d) => d * Math.PI / 180); // screen angles: 90° is down
      const put = (a, cls, text) => {
        const d = R + (Math.abs(Math.sin(a)) > 0.9 ? 12 : 14);
        MM.svgLabel(el('text', { class: cls, x: p.x + d * Math.cos(a), y: p.y + d * Math.sin(a) + 4.5 }, g), text);
      };
      const below = SIDES.find(free), above = [SIDES[1], SIDES[0]].concat(SIDES.slice(2)).find((a) => a !== below && free(a));
      put(below === undefined ? SIDES[0] : below, 'dk-name', '$\\alpha_{' + (i + 1) + '}$');
      if (marks[i]) put(above === undefined ? SIDES[1] : above, 'dk-mark', '$' + marks[i] + '$');
    });
    // the box that selects nodes
    if (state.box) {
      const [x0, y0, x1, y1] = state.box;
      el('rect', { class: 'dk-box', x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }, stage);
    }
    if (focus) { const again = stage.querySelector('[data-key="' + focus + '"]'); if (again) again.focus({ preventScroll: true }); }
  }

  /* ---------- readouts ---------- */

  const tex = (c) => '$' + D.tex(c) + '$';
  const group = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');
  // a coefficient: an integer, a + bτ with a bond labelled 5, or else three decimals
  function coefTeX(x) {
    if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
    for (let b = 1; b <= 12; b++) {
      const a = x - b * GOLDEN;
      if (Math.abs(a - Math.round(a)) < 1e-6) return (Math.round(a) ? Math.round(a) + '+' : '') + (b > 1 ? b : '') + '\\tau';
    }
    return x.toFixed(3);
  }
  // Σ c_i α_i, with real coefficients
  const linear = (coef) => coef.map((c, i) => {
    if (Math.abs(c) < 1e-9) return '';
    const t = coefTeX(Math.abs(c));
    return (c < 0 ? '-' : '') + (t === '1' ? '' : t.includes('+') ? '(' + t + ')' : t) + '\\alpha_{' + (i + 1) + '}';
  }).filter(Boolean).join('+').replace(/\+-/g, '-');
  // a number written exactly where it can be: an integer, or a + bτ
  const exact = (part) => {
    if (!part.labelled) return String(part.det);
    if (!part.detTau) return '\\approx' + part.det.toFixed(3);
    const [a, b] = part.detTau;
    return b ? (a ? a : '') + (b < 0 ? '-' : a ? '+' : '') + (Math.abs(b) === 1 ? '' : Math.abs(b)) + '\\tau' : String(a);
  };

  function typeText(info) {
    const parts = info.parts;
    if (!parts.length) return ['No nodes', '<p>Click in the frame to place a node.</p>'];
    if (parts.length > 1) {
      const names = parts.map((p) => (p.name ? D.tex(p.name) : '\\text{' + p.family + '}')).join('\\times ');
      const same = parts.every((p) => p.family === parts[0].family);
      return ['$' + names + '$' + (same ? ' <span class="side-kind">' + FAMILY[parts[0].family] + '</span>' : ''), '<p>Each connected piece has its own type.</p>'];
    }
    const p = parts[0], n = p.rank, name = p.name ? tex(p.name) + ' <span class="side-kind">' + FAMILY[p.family] + '</span>' : FAMILY[p.family][0].toUpperCase() + FAMILY[p.family].slice(1);
    const node = (i) => '\\alpha_{' + (p.nodes[i] + 1) + '}';
    if (!p.symmetrizable) return [name, '<p>There is no symmetric form: round some cycle, the products of the $a_{ij}$ in the two directions differ. Every finite and affine diagram has a symmetric form, so the type is indefinite.</p>'];
    if (p.family === 'finite' && p.labelled) {
      const what = p.name[0] === 'I' ? 'a regular $' + p.name[3] + '$-gon' : p.rank === 3 ? 'the icosahedron' : 'the 600-cell';
      return [name, '<p>The form is positive definite. The reflections generate the group of symmetries of ' + what + '.</p>'];
    }
    if (p.family === 'finite') return [name, '<p>The form is positive definite. The numbers on the nodes are the coefficients of the highest root.</p>'];
    if (p.family === 'affine') {
      const coef = new Array(state.nodes.length).fill(0);
      p.nodes.forEach((i, k) => { coef[i] = p.marks[k]; });
      return [name, '<p>The form is positive semidefinite. Its radical is spanned by $\\delta=' + linear(coef) + '$, whose coefficients are the numbers on the nodes.</p>'];
    }
    const sig = p.lorentzian ? ', of signature $(' + (n - 1) + ',1)$' : '';
    if (p.family === 'hyperbolic') return [name, '<p>The form is indefinite' + sig + ', and every proper connected subdiagram is of finite or affine type [@kac1990, Ch. 5].</p>'];
    const more = p.bad.length > 1 ? ' (or any of ' + (p.bad.length - 1) + ' other' + (p.bad.length > 2 ? 's' : '') + ')' : '';
    return [name, '<p>The form is indefinite' + sig + '. The diagram is not hyperbolic: without $' + node(p.bad[0]) + '$' + more + ', what is left is still neither finite nor affine.</p>'];
  }

  // The eigenvalues of the form on a number line, with 0 marked (the figure in "Finite, affine and
  // indefinite"); returns what the readouts beside the diagram say of them, or null.
  // the width a chart in the text is drawn at, one unit to a pixel, so that its labels keep their size
  const chartWidth = (svg) => Math.round(Math.min(480, svg.getBoundingClientRect().width || 320));
  function spectrum(info) {
    const svg = $('spectrum'), ok = info.parts.length && info.parts.every((p) => p.symmetrizable), W = chartWidth(svg);
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' 56');
    if (!ok) { svg.setAttribute('height', 0); svg.removeAttribute('aria-label'); MM.setHTML($('form-cap'), info.parts.length ? 'There is no symmetric form.' : 'No nodes.'); return null; }
    svg.removeAttribute('height');
    const s = D.signature(state.A), ev = s.eigenvalues;
    const lo = Math.min(-1, Math.floor(ev[0] - 0.2)), hi = Math.max(4, Math.ceil(ev[ev.length - 1] + 0.2)), X = (v) => 14 + (v - lo) / (hi - lo) * (W - 28);
    el('path', { class: 'sp-axis', d: 'M8 28H' + (W - 8) }, svg);
    for (let t = lo; t <= hi; t++) {
      el('path', { class: t ? 'sp-tick' : 'sp-zero', d: 'M' + X(t) + ' ' + (t ? 25 : 14) + 'V' + (t ? 31 : 34) }, svg);
      if ((hi - lo) * 24 <= W || t % 2 === 0) MM.svgLabel(el('text', { class: 'sp-num', x: X(t), y: 50 }, svg), '$' + t + '$');
    }
    // equal eigenvalues are stacked
    const seen = [];
    for (const v of ev) {
      const k = seen.filter((u) => Math.abs(u - v) < 0.03 * (hi - lo) / 5).length;
      seen.push(v);
      el('circle', { class: 'sp-dot' + (v < -1e-7 ? ' neg' : Math.abs(v) <= 1e-7 ? ' nul' : ''), cx: X(v), cy: 28 - 8 * k, r: 4 }, svg);
    }
    const count = [[s.plus, 'positive'], [s.zero, 'zero'], [s.minus, 'negative']].filter((c) => c[0]).map((c) => c[0] + ' ' + c[1]).join(', ');
    svg.setAttribute('aria-label', 'The eigenvalues of the Cartan matrix on a number line: ' + ev.map((v) => v.toFixed(2)).join(', '));
    MM.setHTML($('form-cap'), 'The eigenvalues of the Cartan matrix $A$.');
    const whole = D.integral(state.A) ? { labelled: false, det: Number(D.det(state.A)) } : Object.assign({ labelled: true }, D.detLabelled(state.A));
    return { count, det: exact(whole) };
  }

  // The number of positive real roots of each height (the figure in "Heights and exponents");
  // returns what the readouts beside the diagram say of the roots, or null.
  function heights(info) {
    // with a label, the coefficients of the roots are not all integers: no heights
    const svg = $('heights'), fig = svg.closest('figure'), labelled = !D.integral(state.A);
    fig.hidden = labelled;
    $('heights-absent').hidden = !labelled;
    if (labelled) {
      if (info.family !== 'finite') return { total: null };
      const data = info.parts.map((p) => D.finiteData(D.sub(state.A, p.nodes)));
      return { total: data.reduce((t, f) => t + f.roots, 0), finite: info.parts.length === 1 ? data[0] : null };
    }
    const W = chartWidth(svg);
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' 112');
    if (!info.parts.length) { svg.setAttribute('height', 0); MM.setHTML($('roots-cap'), 'No nodes.'); return null; }
    svg.removeAttribute('height');
    const r = D.realRoots(state.A, HEIGHT, 6000), hs = r.heights.slice(1), top = Math.max(...hs, 1), n = hs.length;
    const slot = Math.min(22, (W - 24) / (n + (r.complete ? 0 : 1))), bw = Math.max(2, slot - 2), Y = (c) => 88 - 70 * c / top;
    el('path', { class: 'sp-axis', d: 'M8 88.5H' + (W - 8) }, svg);
    hs.forEach((c, k) => {
      if (c) el('rect', { class: 'ht-bar', x: 12 + k * slot, y: Y(c), width: bw, height: 88 - Y(c), rx: Math.min(1.5, bw / 2) }, svg);
      if (k === 0 || (k + 1) % 5 === 0) MM.svgLabel(el('text', { class: 'sp-num', x: 12 + k * slot + bw / 2, y: 106 }, svg), '$' + (k + 1) + '$');
      // the counts themselves, where they fit
      if (top < 10 && slot >= 12 && c) MM.svgLabel(el('text', { class: 'sp-num', x: 12 + k * slot + bw / 2, y: Y(c) - 4 }, svg), '$' + c + '$');
    });
    if (top >= 10 || slot < 12) MM.svgLabel(el('text', { class: 'sp-num', x: 12 + hs.indexOf(top) * slot + bw / 2, y: Y(top) - 4 }, svg), '$' + top + '$');
    if (!r.complete) el('text', { class: 'ht-more', x: 14 + n * slot, y: 86 }, svg).textContent = '…';
    svg.setAttribute('aria-label', 'Positive real roots by height: ' + hs.map((c, k) => c + ' of height ' + (k + 1)).join(', ') + (r.complete ? '' : ', and so on'));

    MM.setHTML($('roots-cap'), r.complete ? 'The number of positive roots of each height.' : 'The number of positive real roots of each height, up to $' + r.upTo + '$.');
    if (!r.complete) return { total: null };
    return { total: 2 * hs.reduce((a, b) => a + b, 0), finite: info.parts.length === 1 ? D.finiteData(state.A) : null };
  }
  // the answers beside the diagram: of its form, and of its roots
  function aboutRows(info, form, roots) {
    if (!info.parts.length) return [];
    const rows = form ? [['Eigenvalues', '<a href="#sec-type">' + form.count + '</a>'], ['Determinant', '$' + form.det + '$']] : [];
    if (roots && roots.total !== null) {
      rows.push(['Roots', '$' + roots.total + '$']);
      if (roots.finite) rows.push(['Exponents', '$' + roots.finite.exponents.join(',\\,') + '$'], ['Coxeter number', '$' + roots.finite.coxeter + '$'], [info.parts[0].labelled ? 'Coxeter group' : 'Weyl group', 'of order $' + group(roots.finite.order) + '$']);
    } else rows.push(['Real roots', 'infinitely many']);
    return rows;
  }

  /* ---------- the roots, about a Coxeter plane ---------- */

  // For a connected diagram of finite type and rank at least 2. The Coxeter
  // element c turns a plane by 2πm/h for each exponent m up to h/2; with m = 1
  // it is the Coxeter plane, on which the roots project to n circles of h. In
  // rank 2 that plane is the picture. From rank 3 on the roots are projected to
  // three dimensions, the plane and one more direction, and the picture turns.
  const cv = $('coxeter'), cc = cv.getContext('2d'), TAU = 2 * Math.PI;
  const mv = (R, p) => [0, 1, 2].map((i) => R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2]);
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const FACE = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // the plane face on: how the picture starts
  let cox = null;   // the roots and the Coxeter element of the diagram last drawn
  let coxTurn = null; // its drag (MM.turnDrag), set up below
  let dots = [];    // the roots as drawn, for picking

  function coxeterPlane(info) {
    const part = info.parts.length === 1 && info.parts[0].family === 'finite' ? info.parts[0] : null, key = JSON.stringify(state.A);
    if (!cox || cox.key !== key) {
      cox = { key, cx: null };
      if (part && part.rank > 1) {
        const pos = D.positiveRoots(state.A), d = part.d, long = Math.max(...d);
        const norm = (c) => { let t = 0; for (let i = 0; i < c.length; i++) for (let j = 0; j < c.length; j++) t += c[i] * c[j] * d[i] * state.A[i][j]; return t; };
        cox.cx = D.coxeter(state.A);
        cox.roots = pos.map((c) => ({ c, positive: true })).concat(pos.map((c) => ({ c: c.map((x) => -x), positive: false })));
        cox.roots.forEach((r, i) => {
          r.i = i; r.key = D.rootKey(r.c); r.long = Math.abs(norm(r.c) - 2 * long) < 1e-6;
          r.simple = r.positive && r.c.filter((x) => Math.abs(x) > 1e-9).length === 1 && r.c.some((x) => Math.abs(x - 1) < 1e-9);
        });
        cox.index = new Map(cox.roots.map((r) => [r.key, r.i]));
        cox.two = cox.roots.some((r) => !r.long);
        cox.edges = D.nearest(state.A, cox.roots.map((r) => r.c));
        cox.space = part.rank > 2;
      }
      state.root = null;
      state.turn = FACE; // the plane face on
    }
    const cx = cox.cx, section = $('cox');
    section.hidden = !cx || !cx.planes.length;
    $('cox-absent').hidden = !section.hidden;
    $('plane-control').hidden = section.hidden || cx.planes.length < 2;
    $('face').hidden = section.hidden || !cox.space;
    if (section.hidden) { dots = []; return; }
    if (!cx.planes.some((P) => P.m === state.plane)) state.plane = cx.planes[0].m;
    // the choice of plane: one button for each exponent up to h/2
    const seg = $('plane'), ms = cx.planes.map((P) => P.m).join(',');
    if (seg.dataset.ms !== ms) {
      seg.dataset.ms = ms;
      seg.textContent = '';
      cx.planes.forEach((P) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.m = P.m; b.textContent = P.m; seg.appendChild(b); });
    }
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.m === state.plane)));

    // the roots in the coordinates of the plane and its third direction
    const P = cx.planes.find((Q) => Q.m === state.plane), n = cox.roots.length;
    if (cox.m !== P.m) {
      cox.m = P.m;
      const dotv = (u, v) => u.reduce((t, x, i) => t + x * v[i], 0);
      cox.at = cox.roots.map((r) => { const x = cx.embed(r.c); return [dotv(x, P.u), dotv(x, P.v), cox.space ? dotv(x, P.w) : 0]; });
      cox.reach = Math.max(...cox.at.map((q) => Math.hypot(q[0], q[1], q[2])));
    }
    if (coxTurn) coxTurn.update();
    paintCoxeter();

    const pick = state.root && cox.roots[cox.index.get(state.root)], rank = state.A.length;
    const mark = (cls, color, text) => '<span class="legend-item"><span class="dot' + cls + '" style="--c: var(--' + color + ')"></span>' + text + '</span>';
    MM.setHTML($('cox-legend'), (cox.two ? mark('', 'root-long', 'long root') + mark('', 'root-short', 'short root') + mark('', 'ink-3', 'positive') + mark(' hollow', 'ink-3', 'negative')
      : mark('', 'root-long', 'positive root') + mark(' hollow', 'root-long', 'negative root'))
      // (the simple roots blue, as the roots are, when they all have one length)
      + '<span class="legend-item"><span class="dot ringed" style="--c: var(--' + (cox.two ? 'ink-3' : 'root-long') + ')"></span>simple root</span>'
      + '<span class="legend-item"><svg class="legend-line" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5H21"/></svg>nearest roots</span>'
      + (pick ? '<span class="legend-item"><svg class="legend-line orbit" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5H21"/></svg>$\\beta,c\\beta,c^2\\beta,\\dots$</span>' : ''));
    // which space the picture is: the plane that c turns and, from rank 3, one more direction
    const angle = (m) => '$2\\pi' + (m > 1 ? '\\cdot' + m : '') + '/' + cx.h + '$';
    let where = 'The $' + n + '$ roots, ';
    if (!cox.space) where += 'in the plane, which $c$ turns by ' + angle(1) + '.';
    else {
      where += 'projected to the plane which $c$ turns by ' + angle(P.m) + ', seen face on at first, and for depth to '
        + (P.depth === 'line' ? 'the line that $c$ reverses.' : 'a direction in the plane for $m=' + P.depth + '$, chosen to keep a mirror' + (fold(P) > 1 ? ' and a ' + fold(P) + '-fold axis' : '') + '.') + ' Drag to turn it.';
    }
    const whole = D.integral(state.A), rough = pick && coefsRough(pick.c); // (with a label there are no heights)
    MM.setHTML($('cox-note'), where + ' ' + (pick ? '$\\beta' + (rough ? '\\approx' : '=') + linear(pick.c) + '$' + (whole ? ', of height $' + pick.c.reduce((t, x) => t + x, 0) + '$.' : '.') : 'Click a root for its orbit under $c$.'));
    cv.setAttribute('aria-label', 'The ' + n + ' roots' + (cox.space ? ', projected to three dimensions: a plane that the Coxeter element turns by ' + P.m + ' over ' + cx.h + ' of a full turn, and one more direction. Drag to turn the picture, or use the arrow keys.'
      : ' in the plane, which the Coxeter element turns by ' + P.m + ' over ' + cx.h + ' of a full turn.'));
  }

  // how many powers of c turn the picture about its axis without changing the depth
  const fold = (P) => 1 + P.turns.filter((k) => (P.depth * k) % cox.cx.h === 0).length;
  // the coefficients of a root that coefTeX writes in decimals
  const coefsRough = (c) => c.some((x) => /\./.test(coefTeX(Math.abs(x))));
  // the picture of the roots as it starts, the plane face on
  const faceOn = () => !state.turn || state.turn.every((row, i) => row.every((x, j) => Math.abs(x - (i === j ? 1 : 0)) < 1e-9));

  function paintCoxeter() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !cox || !cox.cx || !cox.at) return;
    const cx0 = w / 2, cy0 = h / 2, k = (Math.min(w, h) / 2 - 16) / cox.reach, n = cox.roots.length, R = cox.space ? state.turn : FACE;
    $('face').disabled = faceOn();
    const size = (n <= 60 ? 4.6 : n <= 130 ? 3.7 : 3) * (w < 400 ? 0.82 : 1);
    cc.clearRect(0, 0, w + 2, h + 2);
    dots = cox.roots.map((r, i) => { const p = mv(R, cox.at[i]); return { r, x: cx0 + k * p[0], y: cy0 - k * p[1], z: p[2] / cox.reach, s: size * (cox.two && !r.long ? 0.82 : 1) * (cox.space ? 1 + 0.22 * p[2] / cox.reach : 1) }; });

    // the nearest roots, joined: faint, the fainter the more there are
    const E = cox.edges.length;
    cc.strokeStyle = MM.rgba('c1', Math.max(0.12, Math.min(0.45, 0.45 * Math.sqrt(60 / E))));
    cc.lineWidth = E > 2000 ? 0.5 : 1;
    cc.beginPath();
    for (const [a, b] of cox.edges) { cc.moveTo(dots[a].x, dots[a].y); cc.lineTo(dots[b].x, dots[b].y); }
    cc.stroke();
    // the orbit of the picked root: β, cβ, c²β, … joined in order
    const pick = state.root ? dots[cox.index.get(state.root)] : null;
    if (pick) {
      cc.strokeStyle = MM.color('accent');
      cc.lineWidth = 1.5;
      cc.lineJoin = 'round';
      cc.beginPath();
      let c = pick.r.c, first = true;
      for (let t = 0; t < 400; t++) {
        const q = dots[cox.index.get(D.rootKey(c))];
        if (!q) break;
        if (first) cc.moveTo(q.x, q.y); else cc.lineTo(q.x, q.y);
        first = false;
        c = cox.cx.apply(c);
        if (D.rootKey(c) === pick.r.key) break;
      }
      cc.closePath();
      cc.stroke();
    }
    // the roots, the far ones first: filled for positive, hollow for negative
    // coloured by length where there are two
    const long = MM.color('root-long'), short = MM.color('root-short'), paper = MM.color('surface');
    for (const q of dots.slice().sort((a, b) => a.z - b.z || a.r.positive - b.r.positive)) {
      const col = q.r.long ? long : short;
      cc.beginPath();
      cc.arc(q.x, q.y, q.r.positive ? q.s : q.s - 0.6, 0, TAU);
      cc.fillStyle = q.r.positive ? col : paper;
      cc.fill();
      if (!q.r.positive) { cc.lineWidth = 1.2; cc.strokeStyle = col; cc.stroke(); }
    }
    // the simple roots are ringed, and named while there are few enough to keep the names apart
    const name = (q, text, color) => {
      // outside the dot, away from the middle, by half the size of the label in that direction
      const d = Math.hypot(q.x - cx0, q.y - cy0) || 1, ux = (q.x - cx0) / d, uy = (q.y - cy0) / d;
      const off = q.s + 7 + Math.abs(ux) * MM.measureLabel(cc, text, 13) / 2 + Math.abs(uy) * 8;
      MM.canvasLabel(cc, text, q.x + ux * off, q.y + uy * off, { size: 13, align: 'center', baseline: 'middle', color });
    };
    cc.lineWidth = 1.4;
    cc.strokeStyle = MM.color('ink');
    for (const q of dots) {
      if (!q.r.simple) continue;
      cc.beginPath();
      cc.arc(q.x, q.y, q.s + 3, 0, TAU);
      cc.stroke();
    }
    // roots that fall on one place, as the three outer ones of D4 do face on, share a name
    if (state.A.length <= 4) {
      const groups = [];
      for (const q of dots) {
        if (!q.r.simple) continue;
        const g = groups.find((o) => Math.hypot(o.q.x - q.x, o.q.y - q.y) < 9), id = q.r.c.findIndex((x) => Math.abs(x - 1) < 1e-9) + 1;
        if (g) g.ids.push(id); else groups.push({ q, ids: [id] });
      }
      for (const g of groups) name(g.q, '$' + g.ids.sort((x, y) => x - y).map((i) => '\\alpha_{' + i + '}').join(',') + '$', MM.color('ink'));
    }
    if (pick) {
      cc.lineWidth = 2;
      cc.strokeStyle = MM.color('accent');
      cc.beginPath();
      cc.arc(pick.x, pick.y, pick.s + 4.5, 0, TAU);
      cc.stroke();
      if (!pick.r.simple || state.A.length > 4) name(pick, '$\\beta$', MM.color('accent-ink'));
    }
  }

  /* ---------- draw: everything from the state ---------- */

  function draw() {
    if (!state.w) return;
    const info = D.describe(state.A);
    lastInfo = info;
    if ($('mode').value !== state.mode) $('mode').value = state.mode;
    drawStage(info);
    const [title, text] = typeText(info);
    MM.setHTML($('type'), title);
    MM.setHTML($('note'), text);
    const form = spectrum(info), roots = heights(info);
    MM.kv($('about'), aboutRows(info, form, roots));
    coxeterPlane(info);
    drawMatrix();
    drawMenu();
    hint();
    // a diagram of a series can be made longer or shorter: the slider gives its n; and I_2(m) its m
    const one = info.parts.length === 1 ? info.parts[0].name : null, ser = seriesOf(one), slider = $('rank'), dih = $('dihedral');
    state.series = ser ? ser[0] : null;
    slider.hidden = !ser;
    if (ser) {
      const least = SERIES[ser[0]].least, most = least + MAX - D.preset(SERIES[ser[0]].name(least)).A.length;
      if (+slider.getAttribute('min') !== least) slider.setAttribute('min', least);
      if (+slider.getAttribute('max') !== most) slider.setAttribute('max', most);
      if (slider.value !== ser[1]) slider.value = ser[1];
    }
    dih.hidden = !(one && one[0] === 'I');
    if (!dih.hidden) {
      const k = D.LABELS.indexOf(one[3]) + 1;
      if (dih.value !== k) dih.value = k;
      dih.style.setProperty('--slider-value-chars', '2');
      dih.show(String(one[3]));
    }
    // the family of rank 2: its a and b, each refusing what would make ab ≤ 4 with the other
    const two = rankTwoHyperbolic(state.A);
    $('hyp').hidden = !two;
    if (two) [['hyp-a', 0, 1], ['hyp-b', 1, 0]].forEach(([id, i, j]) => {
      const sl = $(id), v = -state.A[i][j], other = -state.A[j][i], hi = Math.max(HEAVY, v);
      if (+sl.getAttribute('max') !== hi) sl.setAttribute('max', hi);
      sl.allow = (x) => x * other > 4; // (the range stays; a value that would leave the family is refused)
      if (sl.value !== v) sl.value = v;
    });
    light(one ? keyOf(one) : info.parts.length === 1 ? unnamedKey(state.A) : null);
    undoButtons.update();
    $('clear').disabled = !state.nodes.length;
    seeAlso(info);
    if (example) example.changed();
  }
  // While a drag goes on only the picture changes, with the matrix's lit entries and the menu.
  function drawDrag() {
    drawStage(lastInfo);
    drawMatrix();
    drawMenu();
    hint();
  }

  // the line under the picture (what a drag does needs no words)
  function hint() {
    const text = note || (state.joining ? 'Choose the node to join it to.' : D.bonds(state.A).length ? 'Click a bond to change its type.' : '');
    const box = $('hint');
    if (box.textContent !== text) box.textContent = text;
  }

  /* ---------- the Cartan matrix ---------- */

  // A grid of the entries between parentheses (MM.matrix), made afresh when the matrix changes;
  // one node selected lights its row and column, several the matrix of the part they make,
  // a bond its two entries.
  let gridKey = null;
  const entryTeX = (a) => { const m = D.labelOf(a); return !m ? String(a) : m === 5 ? '-\\tau' : '-2\\cos(\\pi/' + m + ')'; };
  function drawMatrix() {
    const box = $('matrix'), A = state.A, n = A.length, key = JSON.stringify(A);
    if (key !== gridKey) {
      gridKey = key;
      box.textContent = '';
      if (n) MM.matrix(box, A.map((row) => row.map(entryTeX)), 'The Cartan matrix, row by row: ' + A.map((row) => row.map((a) => entryTeX(a).replace(/\\tau/, 'tau').replace(/\\cos\(\\pi\/(\d+)\)/, ' cos(pi/$1)').replace(/-/g, '−')).join(', ')).join('; '));
      $('matrix-tau').hidden = !A.some((row) => row.some((a) => D.labelOf(a) === 5));
    }
    const sel = state.sel, ns = selNodes();
    box.querySelectorAll('.mx-e').forEach((e) => {
      const i = +e.dataset.i, j = +e.dataset.j;
      e.classList.toggle('is-lit', !!sel && (sel.bond ? (i === sel.bond[0] && j === sel.bond[1]) || (i === sel.bond[1] && j === sel.bond[0])
        : ns.length === 1 ? i === ns[0] || j === ns[0] : ns.includes(i) && ns.includes(j)));
    });
  }
  // the same type in the other pages of it
  const ROOTS = ['a2', 'b2', 'g2', 'a3', 'b3', 'c3', 'a1a1', 'a11', 'a22', 'a21', 'c21', 'g21', 'd43', 't23i', 'tiii', 't344', 't246'];
  const WEIGHTS = ['a1', 'a2', 'b2', 'g2', 'a3', 'b3', 'c3', 'a11', 'a21', 'c21', 'g21'];
  function seeAlso(info) {
    let id = null;
    const parts = info.parts, links = [];
    if (parts.length === 1 && parts[0].name) id = parts[0].name.join('').toLowerCase().replace(/^c2$/, 'b2');
    else if (parts.length === 2 && parts.every((q) => q.name && q.name.join('') === 'A1')) id = 'a1a1';
    if (rankTwoHyperbolic(state.A)) id = 'h' + -state.A[0][1] + -state.A[1][0];
    if (parts.length === 1 && state.A.length === 3 && !parts[0].name) id = unnamedKey(state.A) || id;
    if (id && (ROOTS.includes(id) || /^h[1-8][1-8]$/.test(id))) links.push('<a href="/root-systems/?t=' + id + '">Root systems</a>');
    if (id && WEIGHTS.includes(id)) links.push('<a href="/highest-weight-representations/?t=' + id + '">Highest weight representations</a>');
    const box = $('see-also'), html = links.length ? 'The same type in ' + links.join(' and ') + '.' : '';
    box.hidden = !links.length;
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  /* ---------- the menu beside the selection ---------- */

  // For a bond, its kinds, as pictures of it as it lies: |a_ij|-|a_ji| for its ends i, j in the
  // order they lie on the screen (the left one first); a thick bond (a_ij a_ji > 4) and a bond
  // labelled m, each with sliders for its numbers under the kinds; and Remove. For nodes, Join (one
  // node) and Remove.
  const KINDS = ['1-1', '1-2', '2-1', '2-2', '1-3', '3-1', '1-4', '4-1', 'thick', 'm'];
  const COLUMNS = 8;
  // the kind chosen in the menu, which stays while it is open: a thick bond whose numbers the
  // sliders take as low as 1 (drawn then as the usual lines and arrows) is still a thick bond there
  let menuKind = null;
  // the kind of the bond between lo and hi, as KINDS has it
  const kindOf = (lo, hi) => { const v = bondValue(lo, hi); if (v[0] === 'm') return 'm'; const [a, b] = v.split('-').map(Number); return a * b > 4 ? 'thick' : v; };
  const LINES = ['', 'Single', 'Double', 'Triple', 'Quadruple'];
  function kindName(kind, lo, hi) {
    if (kind === 'm') return 'Bond labelled m';
    if (kind === 'thick') return 'Thick bond, labelled with its two numbers';
    const [a, b] = kind.split('-').map(Number), lines = LINES[Math.max(a, b)];
    return a === b ? lines + ' bond' + (a > 1 ? ' with arrows both ways' : '') : lines + ' bond, the arrow pointing to node ' + ((b > a ? hi : lo) + 1);
  }
  // a bond of this kind, as the diagram draws it, at the angle `ang` at which the bond lies
  function glyph(svg, kind, ang) {
    svg.setAttribute('viewBox', '-15 -15 30 30');
    const g = el('g', { transform: 'rotate(' + ang * 180 / Math.PI + ')' }, svg), m = kind === 'm', heavy = kind === 'thick';
    const [a, b] = m || heavy ? [1, 1] : kind.split('-').map(Number), lines = Math.max(a, b);
    for (let k = 0; k < lines; k++) { const o = (k - (lines - 1) / 2) * 2.9; el('path', { d: 'M-12 ' + o + 'H12', class: heavy ? 'heavy' : '' }, g); }
    if (m || heavy) {
      // the label upright, beside the middle, above the line (or to its left)
      const text = m ? 'm' : 'a,b';
      let nx = Math.sin(ang), ny = -Math.cos(ang);
      if (ny > 0 || (Math.abs(ny) < 1e-9 && nx > 0)) { nx = -nx; ny = -ny; }
      const d = 3.5 + 3.6 * text.length * Math.abs(nx) + (heavy ? 5 : 4) * Math.abs(ny); // (clear of the line, however wide the label)
      MM.svgLabel(el('text', { x: nx * d, y: ny * d + 4.2 }, svg), '$' + text + '$');
      return;
    }
    const hh = 2.4 + 1.5 * lines, chevron = (x, dir) => el('path', { d: 'M' + (x - dir * 3) + ' ' + -hh + 'L' + (x + dir * 3) + ' 0L' + (x - dir * 3) + ' ' + hh }, g);
    if (b > a) chevron(0, 1);
    if (a > b) chevron(0, -1);
    if (a === b && a > 1) { chevron(-5, -1); chevron(5, 1); }
  }
  const TOOLS = {
    join: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="12.5" r="2"/><circle cx="12.5" cy="3.5" r="2"/><path d="M5 11l6-6" stroke-dasharray="1.6 1.9"/></svg>',
    removeNode: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" stroke-dasharray="2.2 1.8"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"/></svg>',
  };
  let menuKey = null;
  function buildMenu(s, ang) {
    menu.textContent = '';
    menuKind = null;
    menu.classList.toggle('is-bond', !!s.bond);
    const add = (kind, name, radio) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = radio ? 'btn' : 'btn btn-sm btn-icon';
      b.dataset.kind = kind;
      b.setAttribute('role', radio ? 'menuitemradio' : 'menuitem');
      b.setAttribute('aria-label', name);
      b.title = name;
      b.tabIndex = -1;
      menu.appendChild(b);
      return b;
    };
    if (s.bond) {
      const [lo, hi] = ends(s.bond[0], s.bond[1]);
      menu.setAttribute('aria-label', 'The bond between nodes ' + (lo + 1) + ' and ' + (hi + 1));
      for (const kind of KINDS) glyph(el('svg', { 'aria-hidden': 'true' }, add(kind, kindName(kind, lo, hi), true)), kind, ang);
      // Remove: the bond as it lies, dashed, and crossed out
      const rm = add('remove', 'Remove the bond'), svg = el('svg', { 'aria-hidden': 'true', viewBox: '-15 -15 30 30' }, rm);
      rm.className = 'btn';
      el('path', { d: 'M-12 0H12', 'stroke-dasharray': '2.6 2.4', transform: 'rotate(' + ang * 180 / Math.PI + ')' }, svg);
      el('path', { d: 'M-3.6 -3.6L3.6 3.6M3.6 -3.6L-3.6 3.6', class: 'cross' }, svg);
      // the numbers of a thick or labelled bond, on sliders
      const panel = document.createElement('div');
      panel.className = 'dk-menu-sliders';
      menu.appendChild(panel);
    } else {
      const k = s.nodes.length, one = 'node ' + (s.nodes[0] + 1);
      menu.setAttribute('aria-label', k > 1 ? 'The ' + k + ' nodes selected' : 'Node ' + (s.nodes[0] + 1));
      if (k === 1 && state.nodes.length > 1) add('join', 'Join ' + one + ' to another node').innerHTML = TOOLS.join;
      add('remove', k > 1 ? 'Remove the ' + k + ' nodes' : 'Remove ' + one).innerHTML = TOOLS.removeNode;
    }
  }
  // the menu shows beside the selection, except during a drag
  function drawMenu() {
    const s = state.sel;
    if (!s || state.joining || (press && press.moved)) { menu.hidden = true; menuKey = null; return; }
    const had = menu.contains(document.activeElement);
    let ang = 0, now = null;
    if (s.bond) { const [lo, hi] = ends(s.bond[0], s.bond[1]), u = state.nodes[lo], v = state.nodes[hi]; ang = Math.atan2(v.y - u.y, v.x - u.x); now = menuKind || kindOf(lo, hi); }
    const key = JSON.stringify(s) + ':' + ang.toFixed(2) + ':' + state.nodes.length;
    const opened = key !== menuKey && !menuKey;
    if (key !== menuKey) { menuKey = key; buildMenu(s, ang); }
    const items = Array.from(menu.querySelectorAll('button'));
    if (now) items.forEach((b) => { if (b.getAttribute('role') === 'menuitemradio') b.setAttribute('aria-checked', String(b.dataset.kind === now)); });
    if (s.bond) sliders(...ends(s.bond[0], s.bond[1]));
    if (!items.some((b) => b.tabIndex === 0)) (items.find((b) => b.getAttribute('aria-checked') === 'true') || items[0]).tabIndex = 0;
    menu.hidden = false;
    placeMenu(s);
    if (opened) reveal();
    if (had && !menu.contains(document.activeElement)) focusMenu();
  }
  // a menu that opens partly out of sight (under the bar, or below the window) is brought into it
  function reveal() {
    const r = menu.getBoundingClientRect(), bar = document.querySelector('.control-bar'), top = bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
    if (r.top < top + 6) window.scrollBy(0, r.top - top - 6);
    else if (r.bottom > window.innerHeight - 6) window.scrollBy(0, Math.min(r.bottom - window.innerHeight + 6, r.top - top - 6));
  }
  // The sliders of the bond's numbers: |a_ij| and |a_ji| of a thick bond, from 1; m of a labelled
  // one. Made when the kind changes, and otherwise only set to the matrix (so that one being
  // dragged stays as it is).
  function sliders(lo, hi) {
    const panel = menu.querySelector('.dk-menu-sliders'), kind = menuKind || kindOf(lo, hi), key = kind === 'thick' || kind === 'm' ? kind + lo + '-' + hi : '';
    if (!panel) return;
    if (panel.dataset.key !== key) {
      panel.dataset.key = key;
      panel.textContent = '';
      const make = (role, label, min, max) => {
        const sl = document.createElement('mm-slider');
        sl.dataset.role = role;
        sl.setAttribute('plain', '');
        sl.setAttribute('min', min); sl.setAttribute('max', max); sl.setAttribute('step', 1);
        MM.setHTML(sl, label);
        panel.appendChild(sl);
      };
      const sub = (i, j) => (i > 9 || j > 9 ? i + ',' + j : '' + i + j);
      if (kind === 'thick') { make('a', '$\\lvert a_{' + sub(lo + 1, hi + 1) + '}\\rvert$', 1, HEAVY); make('b', '$\\lvert a_{' + sub(hi + 1, lo + 1) + '}\\rvert$', 1, HEAVY); }
      if (kind === 'm') make('m', '$m$', 1, D.LABELS.length);
    }
    panel.querySelectorAll('mm-slider').forEach((sl) => {
      if (sl.dataset.role === 'm') {
        const m = D.labelOf(state.A[lo][hi]), k = D.LABELS.indexOf(m) + 1;
        if (sl.value !== k) sl.value = k;
        sl.style.setProperty('--slider-value-chars', '2');
        sl.show(String(m));
        return;
      }
      const [i, j] = sl.dataset.role === 'a' ? [lo, hi] : [hi, lo], v = -state.A[i][j], max = Math.max(HEAVY, v);
      if (+sl.getAttribute('max') !== max) sl.setAttribute('max', max);
      if (sl.value !== v) sl.value = v;
    });
  }
  menu.addEventListener('input', (e) => {
    const sl = e.target.closest('mm-slider'), s = state.sel;
    if (!sl || !s || !s.bond) return;
    const [lo, hi] = ends(s.bond[0], s.bond[1]), v = +sl.value;
    if (sl.dataset.role === 'm') {
      const m = D.LABELS[v - 1];
      if (m && D.labelOf(state.A[lo][hi]) !== m) setLabel(lo, hi, m);
    } else {
      const [i, j] = sl.dataset.role === 'a' ? [lo, hi] : [hi, lo];
      if (v === -state.A[i][j]) return;
      remember();
      state.A[i][j] = -v;
      menuKind = 'thick';
    }
    draw();
  });
  const focusMenu = () => { const b = menu.querySelector('[tabindex="0"]') || menu.querySelector('button'); if (b) b.focus({ preventScroll: true }); };
  // Beside the selection: below it, above it or to a side, whichever covers least of the
  // other nodes (with their names under them and numbers over them), never the selection
  // itself; inside the frame, or reaching down over the line under it.
  const BELOW = 56; // px under the frame that a menu may cover
  function placeMenu(s) {
    const list = s.bond || s.nodes;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const take = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    list.forEach((i) => take(state.nodes[i].x, state.nodes[i].y));
    if (s.bond) { const bend = bow(s.bond[0], s.bond[1]); if (bend) take(...along(s.bond[0], s.bond[1], 0.5, bend)); }
    x0 -= R + 6; x1 += R + 6; y0 -= R + 18; y1 += R + 22;
    const mw = menu.offsetWidth, mh = menu.offsetHeight, W = state.w, H = state.h, gap = 4;
    let best = null, least = Infinity;
    [[(x0 + x1 - mw) / 2, y1 + gap], [(x0 + x1 - mw) / 2, y0 - gap - mh], [x1 + gap, (y0 + y1 - mh) / 2], [x0 - gap - mw, (y0 + y1 - mh) / 2]].forEach(([l, t], k) => {
      l = Math.max(4, Math.min(W - mw - 4, l));
      t = Math.max(4, Math.min(H + BELOW - mh, t));
      const cover = (a, b, c, d) => Math.max(0, Math.min(l + mw, c) - Math.max(l, a)) * Math.max(0, Math.min(t + mh, d) - Math.max(t, b));
      let score = 8 * cover(x0, y0, x1, y1) + 0.05 * Math.max(0, t + mh - H) * mw + k;
      state.nodes.forEach((q, i) => { if (!list.includes(i)) score += cover(q.x - R - 6, q.y - R - 18, q.x + R + 6, q.y + R + 22); });
      if (score < least) { least = score; best = [l, t]; }
    });
    menu.style.left = best[0] + 'px';
    menu.style.top = best[1] + 'px';
  }
  // what the selection is in the picture, to give it the focus back
  const selKey = (s) => (!s ? null : s.bond ? 'b' + Math.min(...s.bond) + '-' + Math.max(...s.bond) : 'n' + s.nodes[0]);
  function choose(kind) {
    const s = state.sel;
    if (!s) return;
    if (kind === 'remove') removeSelected();
    else if (kind === 'join') state.joining = true;
    else if (s.bond) {
      const [lo, hi] = ends(s.bond[0], s.bond[1]);
      if (kind !== (menuKind || kindOf(lo, hi))) {
        if (kind === 'm') setLabel(lo, hi, 5);
        else if (kind === 'thick') setBond(lo, hi, 3, 3);
        else { const [a, b] = kind.split('-').map(Number); setBond(lo, hi, a, b); }
      }
      menuKind = kind === 'thick' ? 'thick' : null;
    }
    const back = kind === 'join' || kind === 'remove' ? selKey(s) : null, inMenu = menu.contains(document.activeElement);
    draw();
    // (from the keyboard, the focus goes back to the picture when the menu goes)
    if (back && inMenu) { const t = stage.querySelector('[data-key="' + back + '"]'); if (t) t.focus({ preventScroll: true }); else stage.focus(); }
  }
  function removeSelected() {
    const s = state.sel;
    if (!s) return;
    if (s.bond) { setBond(s.bond[0], s.bond[1], 0, 0); state.sel = null; } else removeNodes(s.nodes);
  }
  menu.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) choose(b.dataset.kind); });
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('button')), i = items.indexOf(document.activeElement);
    const close = () => {
      const back = selKey(state.sel);
      state.sel = null;
      state.joining = false;
      draw();
      const t = back && stage.querySelector('[data-key="' + back + '"]');
      if (t) t.focus({ preventScroll: true });
    };
    if (e.key === 'Escape') { close(); e.preventDefault(); return; }
    if (e.key === 'Tab') {
      // the kinds (one stop), then the sliders; past either end the menu closes
      const stops = [items.find((b) => b.tabIndex === 0)].concat(Array.from(menu.querySelectorAll('mm-slider input[type="range"]'))).filter(Boolean);
      const k = stops.indexOf(document.activeElement), next = k + (e.shiftKey ? -1 : 1);
      if (k >= 0 && next >= 0 && next < stops.length) { stops[next].focus(); e.preventDefault(); } else close();
      return;
    }
    if (e.target.closest('mm-slider')) return; // (its arrow keys move it)
    // the arrow keys go through the grid of kinds: up and down to the nearest in the other row
    const col = (b) => (b.dataset.kind === 'remove' && menu.classList.contains('is-bond') ? COLUMNS - 1 : items.indexOf(b) % COLUMNS), row = (b) => Math.floor(items.indexOf(b) / COLUMNS);
    let to = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') to = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && menu.classList.contains('is-bond')) {
      const r = row(items[i]) + (e.key === 'ArrowDown' ? 1 : -1), others = items.filter((b) => row(b) === r);
      to = others.length ? others.reduce((x, y) => (Math.abs(col(y) - col(items[i])) < Math.abs(col(x) - col(items[i])) ? y : x)) : null;
    } else if (e.key === 'Home' || e.key === 'End') to = items[e.key === 'Home' ? 0 : items.length - 1];
    if (!to) return;
    items.forEach((b) => { b.tabIndex = b === to ? 0 : -1; });
    to.focus();
    e.preventDefault();
  });
  // a press anywhere but the picture, its menu and the bar puts the selection down
  document.addEventListener('pointerdown', (e) => {
    if ((!state.sel && !state.joining) || e.target.closest('#stage, #menu, .control-bar')) return;
    state.sel = null;
    state.joining = false;
    draw();
  });

  /* ---------- the pointer on the diagram ---------- */

  // Draw: a drag from a node draws a bond, to a new node where it is let go, or to the node
  // it is let go on (one more line if they are joined); from the empty frame it makes a node
  // there first. A click on the frame places a node.
  // Move: a drag moves a node, or all the nodes selected; on the empty frame (on a touch
  // screen, after a press held still) it draws a box that selects the nodes in it, with the
  // bonds between them; with Shift it adds to them, as a click with Shift does.
  // In both, a click on a node or a bond selects it, and its menu opens beside it.
  const pointOf = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const HOLD = 450; // ms
  const REACH = 26; // px: a bond let go this near a node is joined to it
  stage.addEventListener('pointerdown', (e) => {
    if (e.button || press) return;
    const p = pointOf(e), touch = e.pointerType === 'touch', i = nodeAt(p, -1, touch ? 24 : 17), bond = i < 0 ? bondAt(p) : null, shift = e.shiftKey && !touch;
    const pr = press = { id: e.pointerId, p, at: p, node: i, bond, over: -1, moved: false, touch, shift };
    if (state.joining) pr.kind = 'pick';
    else if (state.mode === 'draw') pr.kind = 'draw';
    else if (i >= 0 && !shift) pr.kind = selNodes().includes(i) && selNodes().length > 1 ? 'group' : 'node';
    else pr.kind = touch ? 'wait' : 'box';
    // (a touch on the empty frame, in Move, may still scroll the page: it is not held until it is held still)
    if (pr.kind === 'wait') {
      pr.timer = setTimeout(() => {
        if (press !== pr || pr.moved) return;
        pr.kind = 'box';
        pr.held = true;
        pr.keep = selNodes().slice();
        try { stage.setPointerCapture(pr.id); } catch (err) { /* the pointer is already gone */ }
        state.box = [p[0], p[1], p[0], p[1]];
        drawDrag();
      }, HOLD);
      return;
    }
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
  });
  // the nodes in `from` (index → place) moved by (dx, dy), as far as the frame lets all of them go
  function moveGroup(from, dx, dy) {
    let lx = -Infinity, hx = Infinity, ly = -Infinity, hy = Infinity;
    for (const q of from.values()) { lx = Math.max(lx, 18 - q.x); hx = Math.min(hx, state.w - 18 - q.x); ly = Math.max(ly, 26 - q.y); hy = Math.min(hy, state.h - 30 - q.y); }
    dx = Math.max(lx, Math.min(hx, dx));
    dy = Math.max(ly, Math.min(hy, dy));
    for (const [i, q] of from) state.nodes[i] = { x: q.x + dx, y: q.y + dy };
  }
  // the nodes in the box, with those kept from before
  function boxPick(keep) {
    const [a, b, c, d] = state.box, x0 = Math.min(a, c), x1 = Math.max(a, c), y0 = Math.min(b, d), y1 = Math.max(b, d);
    const inside = range(state.nodes.length).filter((i) => { const q = state.nodes[i]; return q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1; });
    const list = Array.from(new Set(keep.concat(inside))).sort((x, y) => x - y);
    state.sel = list.length ? { nodes: list } : null;
  }
  stage.addEventListener('pointermove', (e) => {
    const pr = press;
    if (!pr || e.pointerId !== pr.id) return;
    const p = pointOf(e);
    if (!pr.moved) {
      if (dist(p, pr.p) < (pr.touch && !pr.held ? 8 : 4)) return;
      pr.moved = true;
      clearTimeout(pr.timer);
      if (pr.kind === 'wait') { press = null; return; } // a touch that moves at once scrolls the page
      if (pr.kind === 'node') { remember(); state.sel = null; pr.off = [pr.p[0] - state.nodes[pr.node].x, pr.p[1] - state.nodes[pr.node].y]; }
      if (pr.kind === 'group') { remember(); pr.from = new Map(selNodes().map((i) => [i, Object.assign({}, state.nodes[i])])); }
      if (pr.kind === 'box' && !pr.held) pr.keep = pr.shift ? selNodes().slice() : [];
      if (pr.kind === 'draw' && pr.node < 0 && !pr.bond) state.sel = null;
    }
    pr.at = p;
    if (pr.kind === 'draw') pr.over = nodeAt(p, pr.node, REACH);
    else if (pr.kind === 'node') { state.nodes[pr.node] = clamp([p[0] - pr.off[0], p[1] - pr.off[1]]); pr.over = nodeAt(at(pr.node), pr.node, REACH); }
    else if (pr.kind === 'group') moveGroup(pr.from, p[0] - pr.p[0], p[1] - pr.p[1]);
    else if (pr.kind === 'box') { state.box = [pr.p[0], pr.p[1], p[0], p[1]]; boxPick(pr.keep); }
    else return;
    drawDrag();
  });
  // While a press on the picture is being followed, a touch does not scroll the page. (The picture
  // is drawn afresh as it changes, the element touched with it, and a touch's events stay with
  // that element: so the listener goes on it.)
  stage.addEventListener('touchstart', (e) => {
    const t = e.target, stop = (ev) => { if (press && press.kind !== 'wait' && ev.cancelable) ev.preventDefault(); };
    const done = () => { t.removeEventListener('touchmove', stop); t.removeEventListener('touchend', done); t.removeEventListener('touchcancel', done); };
    t.addEventListener('touchmove', stop, { passive: false });
    t.addEventListener('touchend', done);
    t.addEventListener('touchcancel', done);
  }, { passive: true });

  // a click: on a node, it alone selected (or put down); on a bond, the same; else nothing selected
  function clickNode(i) { const ns = selNodes(); state.sel = ns.length === 1 && ns[0] === i ? null : { nodes: [i] }; }
  function clickBond(b) { const s = state.sel; state.sel = s && s.bond && s.bond[0] === b[0] && s.bond[1] === b[1] ? null : { bond: b }; }
  function toggleNode(i) {
    const ns = selNodes(), list = ns.includes(i) ? ns.filter((j) => j !== i) : ns.concat([i]).sort((x, y) => x - y);
    state.sel = list.length ? { nodes: list } : null;
  }
  // Join (from a node's menu): the node chosen next is joined to it
  function pick(j) {
    const from = selNodes()[0];
    state.joining = false;
    if (from === undefined || j < 0 || j === from) return;
    addLine(from, j);
    state.sel = { bond: [Math.min(from, j), Math.max(from, j)] };
  }
  // a bond drawn and let go at p
  function drop(pr, p) {
    if (pr.bond) return; // (a drag from a bond draws nothing)
    const from = pr.node, to = nodeAt(p, from, REACH);
    if (from >= 0) {
      if (to >= 0) { addLine(from, to); return; }
      if (dist(p, at(from)) < REACH || full(1)) return;
      remember();
      join(from, pushNode(p));
    } else if (to >= 0) {
      if (full(1)) return;
      remember();
      join(pushNode(pr.p), to);
    } else if (dist(p, pr.p) >= REACH) {
      if (full(2)) return;
      remember();
      join(pushNode(pr.p), pushNode(p));
    }
  }
  // Node i let go on node j, in Move: one node, where j is, with the bonds of both (where both
  // are joined to a node, j's bond stays; a bond between them goes).
  function merge(i, j) {
    state.A.forEach((_, k) => {
      if (k === i || k === j || !state.A[i][k] || state.A[j][k]) return;
      state.A[j][k] = state.A[i][k];
      state.A[k][j] = state.A[k][i];
    });
    state.nodes.splice(i, 1);
    state.A.splice(i, 1);
    state.A.forEach((row) => row.splice(i, 1));
  }
  function endPress(e, cancelled) {
    const pr = press;
    if (!pr || e.pointerId !== pr.id) return;
    press = null;
    menuKind = null; // (what the menu was showing, as chosen there, ends with a press on the picture)
    clearTimeout(pr.timer);
    state.box = null;
    if (cancelled) {
      if (pr.moved && (pr.kind === 'node' || pr.kind === 'group')) { const s = history.pop(); if (s) { const o = JSON.parse(s); state.nodes = o.nodes; } }
      draw();
      return;
    }
    const p = pointOf(e);
    if (pr.kind === 'pick') pick(pr.node);
    else if (pr.kind === 'draw') {
      if (pr.moved) drop(pr, p);
      else if (pr.node >= 0) clickNode(pr.node);
      else if (pr.bond) clickBond(pr.bond);
      else if (state.sel) state.sel = null;
      else if (!full(1)) { remember(); pushNode(p); }
    } else if (pr.kind === 'node' || pr.kind === 'group') {
      if (!pr.moved) clickNode(pr.node);
      else if (pr.kind === 'node' && pr.over >= 0) merge(pr.node, pr.over);
    } else if (!pr.moved) {
      // a click (or a tap) in Move off the nodes, or with Shift
      if (pr.shift && pr.node >= 0) toggleNode(pr.node);
      else if (pr.bond) clickBond(pr.bond);
      else if (!pr.shift) state.sel = null;
    }
    draw();
  }
  stage.addEventListener('pointerup', (e) => endPress(e, false));
  stage.addEventListener('pointercancel', (e) => endPress(e, true));

  const ARROWS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  stage.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    // the empty frame: Enter places a node
    if (e.target === stage && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      remember();
      pushNode([state.w / 2, state.h / 2 - 8]);
      draw();
      stage.querySelector('[data-key="n0"]').focus();
      return;
    }
    const t = e.target.closest('.dk-node, .dk-bond');
    if (!t) return;
    const key = t.dataset.key, node = key[0] === 'n' ? +key.slice(1) : -1, bond = node < 0 ? key.slice(1).split('-').map(Number) : null;
    let open = false;
    if (state.joining && node >= 0 && (e.key === 'Enter' || e.key === ' ')) pick(node);
    else if (e.key === 'Enter' || (e.key === ' ' && bond)) {
      if (bond) clickBond(bond); else clickNode(node);
      open = !!state.sel && !!bond;
    } else if (e.key === ' ') toggleNode(node);
    else if ((e.key === '+' || e.key === '=') && node >= 0) {
      // a node joined to this one, beside it, which then has the focus
      e.preventDefault();
      if (full(1)) { hint(); return; }
      remember();
      const k = pushNode(freeSpot(node));
      join(k, node);
      draw();
      stage.querySelector('[data-key="n' + k + '"]').focus();
      return;
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (bond) { setBond(bond[0], bond[1], 0, 0); state.sel = null; } else removeNodes(selNodes().includes(node) ? selNodes() : [node]);
    } else if (e.key === 'Escape') { state.sel = null; state.joining = false; }
    else if (ARROWS[e.key] && node >= 0) {
      // the node, or all those selected with it, a step that way
      remember();
      const s = e.shiftKey ? 2 : 12, list = selNodes().includes(node) ? selNodes() : [node];
      moveGroup(new Map(list.map((i) => [i, Object.assign({}, state.nodes[i])])), ARROWS[e.key][0] * s, ARROWS[e.key][1] * s);
    } else return;
    e.preventDefault();
    draw();
    // a bond's menu, opened from the keyboard, takes the focus
    if (open) focusMenu();
  });

  $('mode').addEventListener('change', (e) => { state.mode = e.detail.value; state.joining = false; draw(); });
  $('rank').addEventListener('input', (e) => {
    const S = SERIES[state.series], name = S && S.name(+e.target.value);
    if (!S || JSON.stringify(D.preset(name).A) === JSON.stringify(state.A) || D.preset(name).A.length > MAX) return;
    remember();
    load(name);
    draw();
  });
  // a and b of the family of rank 2
  [['hyp-a', 0, 1], ['hyp-b', 1, 0]].forEach(([id, i, j]) => $(id).addEventListener('input', (e) => {
    const v = +e.target.value;
    if (!rankTwoHyperbolic(state.A) || v === -state.A[i][j] || v * -state.A[j][i] <= 4) return;
    remember();
    state.A[i][j] = -v;
    draw();
  }));
  $('dihedral').addEventListener('input', (e) => {
    const m = D.LABELS[+e.target.value - 1];
    if (!m || (state.A.length === 2 && D.labelOf(state.A[0][1]) === m)) { draw(); return; }
    remember();
    load(['I', 2, 0, m]);
    draw();
  });
  const undoButtons = MM.undoRedo({
    undo() { undo(); draw(); },
    redo() { redo(); draw(); },
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,
  });
  // Clear: nothing left, and ready to draw
  $('clear').addEventListener('click', () => {
    if (!state.nodes.length) return;
    remember();
    Object.assign(state, { nodes: [], A: [], sel: null, joining: false, mode: 'draw' });
    draw();
  });
  // the selection put down, or removed, wherever the focus is
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === 'Escape' && (state.sel || state.joining)) { state.sel = null; state.joining = false; draw(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel) { e.preventDefault(); removeSelected(); draw(); }
  });

  /* ---------- the lists of diagrams, under the picture ---------- */

  const minis = new Map(); // key → button
  let strip = null;        // the lists (MM.strip)
  // a small picture of a diagram (MM.dynkinPicture): its nodes, bonds, arrows and labels
  function miniPicture(svg, name) {
    const P = presetFor(name);
    // (the hyperbolic diagrams of rank 2 and 3 drawn larger, as in Root systems: they are small, and their bonds are many)
    MM.dynkinPicture(svg, {
      pos: P.pos,
      bonds: D.bonds(P.A).map((b) => {
        const m = D.labelOf(-b.a);
        if (m) return { i: b.i, j: b.j, lines: 1, label: name[0] === 'I' ? '$m$' : '$' + m + '$' };
        // (a thick bond: its numbers are in the name under the picture)
        if (b.a * b.b > 4) return { i: b.i, j: b.j, heavy: true };
        return { i: b.i, j: b.j, lines: Math.max(b.a, b.b), arrow: b.a > b.b ? 1 : b.b > b.a ? 2 : b.a > 1 ? 3 : 0 };
      }),
    }, { unit: Array.isArray(name) ? 13 : 22 });
  }
  function buildLists() {
    const box = $('strip');
    for (const fam of Object.keys(LISTS)) {
      LISTS[fam].forEach((items) => {
        const group = document.createElement('div');
        group.className = 'strip-group';
        group.dataset.family = fam;
        box.appendChild(group);
        for (const name of items) {
          const b = document.createElement('button'), key = keyOf(name);
          b.type = 'button'; b.className = 'strip-item'; b.dataset.key = key; b._name = name;
          if (!Array.isArray(name)) b.setAttribute('aria-label', name.words);
          b.innerHTML = '<svg aria-hidden="true"></svg><span class="strip-name"' + (Array.isArray(name) ? '' : ' aria-hidden="true"') + '></span>';
          miniPicture(b.firstChild, name);
          MM.setHTML(b.lastChild, '$' + itemTeX(name) + '$');
          group.appendChild(b);
          minis.set(key, b);
        }
      });
    }
    strip = MM.strip(box, {
      control: $('family'),
      pick(b) {
        remember();
        load(b._name);
        state.joining = false;
        draw();
      },
    });
  }
  // the entry for the diagram drawn (by its key), lit; its list shown if another one is
  function light(key) { strip.light((key && minis.get(key)) || null); }
  buildLists();

  $('plane').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.plane = +b.dataset.m;
    draw();
  });
  $('face').addEventListener('click', () => { state.turn = FACE; draw(); });
  // the picture of the roots: drag to turn it (from rank 3; on a touch screen, a drag that starts
  // sideways, MM.turnDrag), click to pick the root nearest the pointer
  const drag = coxTurn = MM.turnDrag(cv, {
    when: () => !!(cox && cox.space),
    move: (dx, dy) => {
      const R = Math.min(cv.clientWidth, cv.clientHeight) / 2;
      state.turn = mm(mm(rotY(dx / R), rotX(dy / R)), state.turn);
      paintCoxeter();
    },
    keys: {
      turn: (a, b) => { state.turn = mm(mm(rotY(a), rotX(b)), state.turn); paintCoxeter(); },
      home: () => { state.turn = FACE; paintCoxeter(); },
    },
  });
  cv.addEventListener('click', (e) => {
    if (drag.moved) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 11;
    for (const q of dots) { const d = Math.hypot(q.x - x, q.y - y) - 0.5 * q.z; if (d < bd) { bd = d; best = q; } } // of two at one place, the nearer
    state.root = best && best.r.key !== state.root ? best.r.key : null;
    draw();
  });
  // the picture of the roots, sized to its box (and drawn afresh by Save image, at its scale)
  function resizeCoxeter() {
    MM.fitCanvas(cv);
    paintCoxeter();
  }
  new ResizeObserver(resizeCoxeter).observe(cv);
  // the charts in the text, drawn afresh when their width changes, one unit to a pixel
  const charts = new ResizeObserver(() => {
    if (['spectrum', 'heights'].some((id) => { const svg = $(id), vb = svg.getAttribute('viewBox'); return vb && !svg.closest('[hidden]') && +vb.split(' ')[2] !== chartWidth(svg); })) draw();
  });
  ['spectrum', 'heights'].forEach((id) => charts.observe($(id).parentNode));

  // the stage in pixels; when it changes size the nodes keep their places in proportion
  new ResizeObserver(() => {
    const r = stage.getBoundingClientRect();
    if (!r.width || (r.width === state.w && r.height === state.h)) return;
    if (state.w) state.nodes = state.nodes.map((p) => ({ x: p.x * r.width / state.w, y: p.y * r.height / state.h }));
    const first = !state.w;
    state.w = r.width;
    state.h = r.height;
    if (first) load(['E', 6]);
    draw();
    if (first) start();
  }).observe(stage);
  MM.onFonts(draw);

  /* ---------- links, reset and Save image ---------- */

  // A diagram in a link: one of the lists' by its name (e8, e8.1, a5.2, e10, t334, h3, i7), any
  // other by its matrix, with its labelled bonds after the others (2.01m5: I_2(5)).
  const diagram = {
    write(A) {
      const id = presetName(A);
      if (id) return id;
      const more = [];
      A.forEach((row, i) => row.forEach((a, j) => { if (j > i && D.labelOf(a)) more.push(i.toString(36) + j.toString(36) + 'm' + D.labelOf(a)); }));
      return [MM.example.codecs.cartan.write(A.map((row) => row.map((a) => (D.labelOf(a) ? 0 : a))))].concat(more).join('.');
    },
    read(text) {
      const fail = () => { throw new Error('no such diagram: ' + text); };
      const m = /^([a-gi])(\d{1,2})(?:\.([123]))?$/.exec(text) || /^(h)([34])()$/.exec(text), t = /^t([2-9])([2-9])([2-9])$/.exec(text);
      if (m || t) {
        const x = t ? 'T' : m[1].toUpperCase(), n = t ? 0 : +m[2], r = m && m[3] ? +m[3] : 0, name = t ? ['T', +t[1], +t[2], +t[3]] : x === 'I' ? ['I', 2, 0, n] : r ? [x, n, r] : [x, n];
        if (x === 'I' && (r || !D.LABELS.includes(n))) fail();
        // only what the lists give: a name that the matrix it stands for has
        let A = null, parts = null;
        try { A = D.preset(name).A; parts = D.describe(A).parts; } catch (err) { fail(); }
        if (A.length > MAX || parts.length !== 1 || JSON.stringify(parts[0].name) !== JSON.stringify(name)) fail();
        return A;
      }
      const parts = text.split('.'), labels = parts.filter((t) => /^[0-9a-z]{2}m\d{1,2}$/.test(t));
      const A = MM.example.codecs.cartan.read(parts.filter((t) => !labels.includes(t)).join('.'));
      for (const t of labels) {
        const i = parseInt(t[0], 36), j = parseInt(t[1], 36), k = +t.slice(3);
        if (i >= j || j >= A.length || A[i][j] || !D.LABELS.includes(k)) fail();
        A[i][j] = A[j][i] = D.labelEntry(k);
      }
      return A;
    },
  };
  // The nodes as fractions of the stage, or none while they lie as standardNodes puts
  // them: compared within their bounding boxes, since a change of the stage's size
  // stretches the diagram in proportion and not as standardNodes would lay it out.
  function inBox(nodes, axis) {
    const v = nodes.map((p) => p[axis]), lo = Math.min(...v), span = Math.max(...v) - lo;
    return v.map((x) => (span < 1 ? 0.5 : (x - lo) / span));
  }
  function drawnNodes() {
    const std = standardNodes(state.A), same = ['x', 'y'].every((k) => { const a = inBox(state.nodes, k), b = inBox(std, k); return a.every((x, i) => Math.abs(x - b[i]) < 0.01); });
    return same ? [] : state.nodes.flatMap((p) => [p.x / state.w, p.y / state.h]);
  }
  function start() {
    example = MM.example({
      fields: { t: diagram, p: MM.example.numbers(3), m: 'int', v: 'rotation' },
      view: ['v'],
      get: () => ({ t: state.A, p: drawnNodes(), m: state.plane, v: state.turn || FACE }),
      set(x) {
        const n = x.t.length; // (nodes a link does not name lie as standardNodes puts them)
        if (n > MAX || (x.p.length && x.p.length !== 2 * n) || x.m < 1) return false;
        if (JSON.stringify(x.t) !== JSON.stringify(state.A) || x.p.length) remember();
        state.A = x.t;
        state.nodes = x.p.length ? state.A.map((_, i) => clamp([x.p[2 * i] * state.w, x.p[2 * i + 1] * state.h])) : standardNodes(state.A);
        state.sel = null;
        state.joining = false;
        draw(); // a new diagram turns its roots face on
        state.plane = x.m;
        state.turn = x.v;
        draw();
      },
      pictures: () => [
        { label: 'Diagram', element: stage }, { label: 'Roots', element: cv },
        { label: 'Form', element: $('spectrum'), selected: false }, { label: 'Real roots by height', element: $('heights'), selected: false },
      ],
      // for Save image: the node or bond selected, and the root picked
      scene: { get: () => ({ sel: state.sel, root: state.root }), set(s) { Object.assign(state, s); draw(); } },
      redraw: resizeCoxeter,
    });
    history.length = 0; // (a link's diagram is where Undo starts)
    draw();
  }
})();
