// Highest weight representations: the figure and its readouts.
// The mathematics (weights, multiplicities, Verma modules, tensor products, affine algebras) is in weights.js.
//
// The weights live in R^r, r the rank, drawn according to the algebra's kind:
//   line       sl2: on a line;
//   plane      rank two: in the plane, the dominant chamber opening upwards;
//   space      rank three: in space, turned with the pointer;
//   aff-line   affine sl2: the finite part across, the depth below Λ downwards;
//   aff-space  affine algebras over rank two: the same in space.
// Three views, as the algebra allows:
//   weights    the weights of the simple module L(λ) (V(λ) when λ is dominant
//              integral) or of the Verma module M(λ), each a dot with its multiplicity;
//   relief     (rank two) the multiplicities of V(λ) as the heights of columns;
//   tensor     the weights of V(ν) placed at λ and folded into the dominant
//              chamber by the dot action (Brauer–Klimyk): the summands of V(λ) ⊗ V(ν).
// The algebras are chosen from the lists of small Dynkin diagrams under the picture.
// Beside it, the algebra's Dynkin diagram carries the highest weight, the numbers on
// its nodes, which are changed there (see "the highest weight, on the Dynkin diagram").
// How the answers are found is the text after the figure, to which the readouts link.
(function () {
  'use strict';
  const HW = window.HighestWeight;
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas'), ctx = canvas.getContext('2d'), plane = $('plane');
  const handles = { lam: $('handle-lam'), nu: $('handle-nu') };
  // (MM.handle); λ's may be a hoop round a weight instead, which shows through it (the tensor product)
  MM.handle(handles.nu);
  MM.handle(handles.lam).insertAdjacentHTML('beforeend', '<circle class="h-hoop-edge" r="13"/><circle class="h-hoop" r="13"/><circle class="focus-ring h-focus-hoop" r="18"/>');
  const TAU = 2 * Math.PI;
  const K = HW.key, add = HW.add, sub = HW.sub, scale = HW.scale, isInt = HW.isInt;
  const SHORT = Math.SQRT2;        // the length of a short root
  const ANYCAP = 12;               // "any weight": the labels of λ stay within ±12
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const zeros = (r) => Array(r).fill(0);
  const basisVec = (r, i) => { const v = zeros(r); v[i] = 1; return v; };

  // The algebras, as the title names them (the lists under the picture name them in
  // index.html). cap: the largest label the handles allow; levels: the range of the
  // level slider.
  const INFO = {
    A1: { fam: 'finite', alg: '\\mathfrak{sl}_2', cartan: '\\mathrm{A}_1', plain: 'sl2', kind: 'line', cap: 16, lam: [3], nu: [2] },
    A2: { fam: 'finite', alg: '\\mathfrak{sl}_3', cartan: '\\mathrm{A}_2', plain: 'sl3', kind: 'plane', cap: 20, lam: [2, 1], nu: [1, 0] },
    B2: { fam: 'finite', alg: '\\mathfrak{so}_5\\cong\\mathfrak{sp}_4', cartan: '\\mathrm{B}_2=\\mathrm{C}_2', plain: 'so5', kind: 'plane', cap: 20, lam: [2, 1], nu: [1, 0] },
    G2: { fam: 'finite', alg: '\\mathfrak{g}_2', cartan: '\\mathrm{G}_2', plain: 'g2', kind: 'plane', cap: 20, lam: [2, 1], nu: [1, 0] },
    A3: { fam: 'finite', alg: '\\mathfrak{sl}_4', cartan: '\\mathrm{A}_3', plain: 'sl4', kind: 'space', cap: 4, lam: [1, 1, 1], nu: [1, 0, 0] },
    B3: { fam: 'finite', alg: '\\mathfrak{so}_7', cartan: '\\mathrm{B}_3', plain: 'so7', kind: 'space', cap: 4, lam: [1, 0, 1], nu: [0, 0, 1] },
    C3: { fam: 'finite', alg: '\\mathfrak{sp}_6', cartan: '\\mathrm{C}_3', plain: 'sp6', kind: 'space', cap: 4, lam: [1, 0, 1], nu: [1, 0, 0] },
    'A1-1': { fam: 'affine', alg: '\\widehat{\\mathfrak{sl}}_2', cartan: '\\mathrm{A}_1^{(1)}', plain: 'affine sl2', kind: 'aff-line', levels: [-6, 6] },
    'A2-1': { fam: 'affine', alg: '\\widehat{\\mathfrak{sl}}_3', cartan: '\\mathrm{A}_2^{(1)}', plain: 'affine sl3', kind: 'aff-space', levels: [-6, 3] },
    'C2-1': { fam: 'affine', alg: '\\widehat{\\mathfrak{so}}_5\\cong\\widehat{\\mathfrak{sp}}_4', cartan: '\\mathrm{C}_2^{(1)}', plain: 'affine so5', kind: 'aff-space', levels: [-6, 3] },
    'G2-1': { fam: 'affine', alg: '\\widehat{\\mathfrak{g}}_2', cartan: '\\mathrm{G}_2^{(1)}', plain: 'affine g2', kind: 'aff-space', levels: [-7, 3] },
  };
  // a type's name in links and in the lists: a2, a11
  const linkId = (t) => t.toLowerCase().replace('-', '');
  const TYPE = {};
  for (const t in INFO) TYPE[linkId(t)] = t;
  const VIEWS = { line: ['weights', 'tensor'], plane: ['weights', 'relief', 'tensor'], space: ['weights', 'tensor'], 'aff-line': ['weights'], 'aff-space': ['weights'] };
  // where the nodes of the Dynkin diagrams go (node 0 is the affine one)
  const LAYOUT = {
    A1: [[0, 0]], A2: [[0, 0], [1, 0]], B2: [[0, 0], [1, 0]], G2: [[0, 0], [1, 0]],
    A3: [[0, 0], [1, 0], [2, 0]], B3: [[0, 0], [1, 0], [2, 0]], C3: [[0, 0], [1, 0], [2, 0]],
    'A1-1': [[0, 0], [1, 0]], 'A2-1': [[0.5, -0.85], [0, 0], [1, 0]], 'C2-1': [[0, 0], [2, 0], [1, 0]], 'G2-1': [[0, 0], [2, 0], [1, 0]],
  };

  let example = null; // links, reset and Save image (MM.example, at the end)

  // The single source of truth; draw() renders everything from it.
  const state = {
    type: 'A2',
    want: 'weights', view: 'weights', // the view the reader chose, and the one shown: the same when this algebra has it
    module: 'simple',                 // the weights view: the simple module L(λ), or the Verma module M(λ)
    any: false,                       // rank one and two: λ anywhere, not only dominant integral
    lams: {}, nus: {},                // the dominant integral λ and ν of each finite type
    anys: {},                         // λ when it may be any weight
    affs: {},                         // each affine algebra: the level k and the finite part of Λ, Λ dominant integral
    affAnys: {},                      // … and when Λ may be any weight (Any weight)
    shell: [4, 2],                    // the λ of sl3 in the figure of hexagons and triangles, in the text
    sel: null,                        // key of the selected point
    hover: null,
    az: -0.42, el: 0.62,              // the relief: the turn about the vertical, and the elevation of the eye
    cam: { az: 0.62, el: 0.36 },      // the pictures in space, likewise
    frame: null,                      // the window: {c, R}, its centre and half-width in the model's units
    zoom: null,                       // the zoom the reader chose (see SMIN), or null: the window fitted to the view
  };
  for (const t in INFO) {
    if (INFO[t].fam === 'finite') { state.lams[t] = INFO[t].lam.slice(); state.nus[t] = INFO[t].nu.slice(); }
    else state.affs[t] = { k: 1, lam: zeros(HW.affine(t).rank) };
  }
  const info = () => INFO[state.type];
  const kind = () => info().kind;
  const isAffine = () => info().fam === 'affine';
  const lam = () => state.lams[state.type];
  const nu = () => state.nus[state.type];
  const aff = () => HW.affine(state.type);
  const alg = () => (isAffine() ? aff().g : HW.algebra(state.type));
  // Λ of the affine algebra in view: with Any weight, any level and any labels; without, a level
  // k = 0, 1, 2, … and Λ dominant integral (its labels λ_0, …, λ_r whole numbers ≥ 0)
  const affSt = () => {
    if (!state.any) return state.affs[state.type];
    if (!state.affAnys[state.type]) { const st = state.affs[state.type]; state.affAnys[state.type] = { k: st.k, lam: st.lam.slice() }; }
    return state.affAnys[state.type];
  };
  const anyMode = () => state.any && !isAffine() && alg().rank <= 2 && state.view === 'weights';
  // λ in the weights view
  function wlam() {
    if (!anyMode()) return lam();
    if (!state.anys[state.type]) state.anys[state.type] = lam().slice();
    return state.anys[state.type];
  }
  const P = (x) => alg().pos(x);
  const norm = (x) => Math.hypot(...P(x));
  // a finite weight in the model: the line is drawn across the middle of the plane
  const M = (x) => { const p = P(x); return p.length === 1 ? [p[0], 0] : p; };
  const turns = () => kind() === 'space' || kind() === 'aff-space' || state.view === 'relief';

  /* ---------- numbers, weights and roots in TeX ---------- */

  // x = p/q for q up to 12, as the site's number boxes and the Dynkin diagram write it (MM.formatNumber), or null
  function fracOf(x) {
    for (let q = 1; q <= 12; q++) { const p = Math.round(x * q); if (Math.abs(x * q - p) < 1e-7) return [p, q]; }
    return null;
  }
  const decimal = (x) => x.toFixed(2).replace(/0$/, '');
  // a number ≥ 0 in TeX
  const numTex = (x) => { const f = fracOf(x); return f ? (f[1] === 1 ? String(f[0]) : '\\tfrac{' + f[0] + '}{' + f[1] + '}') : decimal(x); };
  // any number as text
  function numText(x) {
    const f = fracOf(Math.abs(x)), s = f ? (f[1] === 1 ? String(f[0]) : f[0] + '/' + f[1]) : decimal(Math.abs(x));
    return (x < -1e-9 && s !== '0' ? '−' : '') + s;
  }
  function comb(v, sym, from) {
    const o = from === undefined ? 1 : from;
    let s = '';
    v.forEach((c, i) => {
      if (Math.abs(c) < 1e-9) return;
      const a = Math.abs(c);
      s += (c < 0 ? '-' : s ? '+' : '') + (Math.abs(a - 1) < 1e-9 ? '' : numTex(a)) + sym + '_' + (i + o);
    });
    return s || '0';
  }
  function plainComb(v, sym, from) {
    const o = from === undefined ? 1 : from;
    let s = '';
    v.forEach((c, i) => {
      if (Math.abs(c) < 1e-9) return;
      const t = numText(Math.abs(c));
      s += (c < 0 ? '-' : s ? '+' : '') + (t === '1' ? '' : t) + sym + (i + o);
    });
    return s || '0';
  }
  const wtex = (mu) => comb(mu, '\\varpi');
  const rtex = (c) => comb(c, '\\alpha');
  const wplain = (mu) => plainComb(mu, 'ω');
  const aplain = (labels) => plainComb(labels, 'Λ', 0);
  // an affine weight (μ, n) at level k: its labels on Λ_0, …, Λ_r, then −nδ
  const affLabels = (mu, k) => [k - mu.reduce((s, x, i) => s + aff().comarks[i + 1] * x, 0)].concat(mu);
  function atex(mu, n, k) {
    const s = comb(affLabels(mu, k), '\\Lambda', 0);
    if (Math.abs(n) < 1e-9) return s;
    return (s === '0' ? '' : s) + (n > 0 ? '-' : '+') + (Math.abs(Math.abs(n) - 1) < 1e-9 ? '' : numTex(Math.abs(n))) + '\\delta';
  }

  function repName(type, L) {
    if (L.every((x) => !x)) return 'the trivial representation';
    const [a, b, c] = L;
    if (type === 'A1') {
      if (a === 1) return 'the standard representation $\\CC^2$';
      if (a === 2) return 'the adjoint representation, $\\Sym^2\\CC^2$';
      return '$\\Sym^{' + a + '}\\CC^2$, the binary forms of degree $' + a + '$';
    }
    if (type === 'A2') {
      if (a === 1 && b === 1) return 'the adjoint representation';
      if (a === 1 && !b) return 'the standard representation $\\CC^3$';
      if (!a && b === 1) return '$\\Lambda^2\\CC^3\\cong(\\CC^3)^*$';
      if (!b) return '$\\Sym^{' + a + '}\\CC^3$';
      if (!a) return '$\\Sym^{' + b + '}(\\CC^3)^*$';
    } else if (type === 'B2') {
      if (a === 1 && !b) return 'the vector representation $\\CC^5$ of $\\mathfrak{so}_5$';
      if (!a && b === 1) return 'the spin representation; for $\\mathfrak{sp}_4$, the standard one, $\\CC^4$';
      if (!a && b === 2) return 'the adjoint representation, $\\Sym^2\\CC^4$ for $\\mathfrak{sp}_4$';
      if (!a) return '$\\Sym^{' + b + '}\\CC^4$ for $\\mathfrak{sp}_4$';
      if (!b) return 'the harmonic polynomials of degree $' + a + '$ on $\\CC^5$';
    } else if (type === 'G2') {
      if (a === 1 && !b) return 'the $7$-dimensional representation, on the imaginary octonions';
      if (!a && b === 1) return 'the adjoint representation';
    } else if (type === 'A3') {
      if (a === 1 && !b && !c) return 'the standard representation $\\CC^4$';
      if (!a && !b && c === 1) return '$\\Lambda^3\\CC^4\\cong(\\CC^4)^*$';
      if (!a && b === 1 && !c) return '$\\Lambda^2\\CC^4$; for $\\mathfrak{sl}_4\\cong\\mathfrak{so}_6$, the vector representation $\\CC^6$';
      if (a === 1 && !b && c === 1) return 'the adjoint representation';
      if (!b && !c) return '$\\Sym^{' + a + '}\\CC^4$';
      if (!a && !b) return '$\\Sym^{' + c + '}(\\CC^4)^*$';
    } else if (type === 'B3') {
      if (a === 1 && !b && !c) return 'the vector representation $\\CC^7$';
      if (!a && b === 1 && !c) return 'the adjoint representation, $\\Lambda^2\\CC^7$';
      if (!a && !b && c === 1) return 'the spin representation, $\\CC^8$';
      if (!a && !b && c === 2) return '$\\Lambda^3\\CC^7$';
      if (!b && !c) return 'the harmonic polynomials of degree $' + a + '$ on $\\CC^7$';
    } else if (type === 'C3') {
      if (a === 1 && !b && !c) return 'the standard representation $\\CC^6$';
      if (a === 2 && !b && !c) return 'the adjoint representation, $\\Sym^2\\CC^6$';
      if (!a && b === 1 && !c) return 'the kernel of the contraction $\\Lambda^2\\CC^6\\to\\CC$ with the symplectic form';
      if (!a && !b && c === 1) return 'the kernel of the contraction $\\Lambda^3\\CC^6\\to\\CC^6$';
      if (!b && !c) return '$\\Sym^{' + a + '}\\CC^6$';
    }
    return '';
  }
  function affName(type, L) {
    if (L.every((x) => !x)) return 'the trivial representation';
    const one = (i) => L.every((x, j) => x === (j === i ? 1 : 0));
    if (one(0)) return 'the basic representation';
    if ((type === 'A1-1' && one(1)) || (type === 'A2-1' && (one(1) || one(2))) || (type === 'C2-1' && one(1))) return 'the basic representation, moved by a symmetry of the Dynkin diagram';
    return '';
  }

  /* ---------- what is drawn ---------- */

  // The weights view of a finite type: V(λ) when the module is simple and λ is
  // dominant integral, or else M(λ) or L(λ): in rank one and two, as deep as the
  // window goes (see weightsFrame), and in rank three down to depth 5.
  const sceneCache = new Map();
  function finiteScene() {
    const A = alg(), L = wlam(), fd = state.module === 'simple' && L.every((x) => isInt(x) && x > -1e-9);
    const need = fd ? 0 : A.rank === 3 ? 5 : Math.max(1, Math.ceil(depthToFill(L) - 1e-9));
    const D = Math.min(need, A.rank === 1 ? 120 : 60), ck = [state.type, state.module, D].concat(L).join('|');
    if (sceneCache.has(ck)) return sceneCache.get(ck);
    const lr = add(L, A.rho);
    // the positive roots α with <λ+ρ, α^∨> a positive integer: then M(λ) contains M(s_α·λ)
    const special = [];
    for (const b of A.positive) { const v = A.coroot(lr, b); if (isInt(v) && Math.round(v) > 0) special.push({ b, v: Math.round(v) }); }
    let S;
    if (fd) {
      const Li = L.map(Math.round);
      S = { kind: 'fd', lam: Li, ch: HW.character(A, Li), special };
    } else {
      // capped: the picture stops at depth D before the window does
      const R = state.module === 'verma' ? HW.verma(A, L, D) : HW.simpleQuotient(A, L, D);
      S = { kind: state.module, lam: L.slice(), D, capped: A.rank === 3 || need > D, points: R.points, terms: R.terms, order: R.order, special };
    }
    if (sceneCache.size > 120) sceneCache.clear();
    sceneCache.set(ck, S);
    return S;
  }

  // The affine picture: the weights down to a depth that keeps it readable, and
  // the scale on which depth is drawn: depth n at height −u·n.
  const affCache = new Map();
  function affScene() {
    const t = state.type, A = aff(), st = affSt(), line = kind() === 'aff-line';
    const labels = affLabels(st.lam, st.k), ck = [t, state.module, st.k].concat(st.lam).join('|');
    if (affCache.has(ck)) return affCache.get(ck);
    const integrable = labels.every((x) => isInt(x) && x > -1e-9);
    const S = integrable && state.module === 'simple' ? integrableScene(A, labels.map(Math.round), line) : otherScene(A, st.k, st.lam, line);
    Object.assign(S, { labels, k: st.k, lam: st.lam.slice(), line });
    if (affCache.size > 80) affCache.clear();
    affCache.set(ck, S);
    return S;
  }
  // the height of a step in depth: the same for every Λ of a kind, so that the picture keeps its shape as Λ and the level change
  const DEPTH_STEP = { 'aff-line': 0.62, 'aff-space': 0.85 };
  // L(Λ) for Λ dominant integral: as deep as the multiplicities stay readable
  function integrableScene(A, labels, line) {
    const g = A.g, maxN = line ? 12 : 6, lim = line ? 160 : 110, most = line ? 260 : 520;
    const full = HW.affineCharacter(A, labels, maxN);
    const fits = (N) => { const ws = full.weights.filter((w) => w.n <= N); return ws.length <= most && ws.every((w) => w.mult <= lim); };
    let N = maxN;
    while (N > 3 && !fits(N)) N--;
    const ch = HW.affineCharacter(A, labels, N), k = ch.k;
    // the radius of the paraboloid |μ|² = |λ|² + 2kn at depth n, in the model's units
    const rad = (n) => Math.sqrt(Math.max(0, (g.ip(ch.lam, ch.lam) + 2 * A.Z * k * n) / g.det));
    const wide = Math.max(rad(N), SHORT, ...ch.weights.map((w) => Math.hypot(...g.pos(w.mu))));
    const u = DEPTH_STEP[line ? 'aff-line' : 'aff-space'];
    const model = (mu, n) => { const p = g.pos(mu); return line ? [p[0], -u * n] : [p[0], p[1], -u * n]; };
    return {
      mode: 'int', ch, N, u, model, rad,
      points: ch.weights.map((w) => ({ key: w.key, mu: w.mu, n: w.n, mult: w.mult, dom: K(w.dom.mu) + '|' + w.dom.n })),
      centre: line ? [0, -u * N / 2] : [0, 0, -u * N / 2],
      R: line ? Math.max(wide + 0.7 * SHORT, u * N / 2 + 0.95 * SHORT) : Math.max(wide, u * N / 2) + 0.8 * SHORT,
    };
  }
  // M(Λ), or L(Λ) for Λ not integrable: equal to M(Λ) when that is simple
  // (Kac–Kazhdan); for affine sl2 away from the critical level, by Kazhdan–Lusztig
  // theory; otherwise built from the generators (see build()), to a smaller
  // depth, since that takes longer. The window is the same for all of them:
  // round the weights of M(Λ), which hold those of L(Λ).
  const BY_GENERATORS = { 'A1-1': [6, 4], 'A2-1': [3, 2], 'C2-1': [3, 1], 'G2-1': [2, 1] };
  // these pictures are wedges, wider than deep: a taller step in depth than for the integrable ones
  const WEDGE_STEP = { 'aff-line': 1.1, 'aff-space': 0.85 };
  function otherScene(A, k, lb, line) {
    const g = A.g, critical = Math.abs(k + A.hv) < 1e-7;
    let N = line ? 6 : 3, H = line ? 4 : 2, mode, R = null, job = null;
    if (state.module === 'verma') { mode = 'verma'; R = HW.affineVerma(A, k, lb, N, H); }
    else if (!critical && !HW.affineSpecial(A, k, lb, N).length) { mode = 'generic'; R = HW.affineVerma(A, k, lb, N, H); }
    else if (!critical && A.type === 'A1-1') { mode = 'kl'; R = HW.sl2Affine(k, lb[0], N, H); }
    else {
      [N, H] = BY_GENERATORS[A.type];
      job = HW.affineGeneratorJob(A, k, lb, N, H);
      mode = job ? 'generators' : 'irrational';
    }
    const points = R ? R.points.map((p) => ({ key: p.key, mu: p.mu, n: p.n, nb: p.nb, mult: p.mult })) : [];
    const window = R && mode !== 'kl' ? R : HW.affineVerma(A, k, lb, N, H);
    const u = WEDGE_STEP[line ? 'aff-line' : 'aff-space'];
    const model = (mu, n) => { const p = g.pos(mu); return line ? [p[0], -u * n] : [p[0], p[1], -u * n]; };
    // the window: Λ and the weights below it, down to depth N; in space only those near the column
    // under Λ (the module spreads wide at every depth: fitted whole, the picture is small)
    const near = (mu) => line || Math.hypot(...g.pos(sub(mu, lb))) <= 2 * SHORT;
    const pts = window.points.filter((p) => near(p.mu)).map((p) => model(p.mu, p.n)).concat([model(lb, 0), model(lb, N)]);
    const lo = pts[0].slice(), hi = pts[0].slice();
    for (const p of pts) p.forEach((x, i) => { lo[i] = Math.min(lo[i], x); hi[i] = Math.max(hi[i], x); });
    const centre = lo.map((x, i) => (x + hi[i]) / 2);
    const R0 = line ? Math.max(hi[0] - lo[0], hi[1] - lo[1]) / 2 + 0.95 * SHORT : Math.max(...pts.map((p) => Math.hypot(...p.map((x, i) => x - centre[i])))) + 0.6 * SHORT;
    return { mode, critical, N, H, u, model, points, terms: R ? R.terms : [], job, centre, R: Math.max(R0, 3 * SHORT) };
  }
  // L(Λ) built from the generators: a slice of the work each frame, drawing what is
  // done so far; the work stops when the reader moves on, and goes on if they come back
  let building = null;
  function build(S) {
    if (building === S || !S.job || S.job.done) return;
    building = S;
    const step = () => {
      if (building !== S) return;
      const done = S.job.run(performance.now() + 12);
      S.points = S.job.points();
      draw();
      if (done) { building = null; chrome(); } else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- the window ---------- */

  // The weights view in rank one and two, for any λ, and the same for L(λ) and M(λ),
  // so that switching between them shows where they differ. For λ dominant integral:
  // round the origin, with the polygon of V(λ) whole. Otherwise round the origin, λ
  // and the weights below it, down to where L(λ) parts from M(λ) when it does (the
  // highest weights of the Verma modules in its character) and a little further:
  // centred on the origin unless that makes it a third wider, and never closer in than
  // V(λ) for small λ. The weights of a module that goes on fill it.
  const MIN_WINDOW = 3 * SHORT;
  function weightsFrame(L) {
    const p = M(L), line = kind() === 'line', d = line ? 1 : 2, dn = line ? 0 : 1;   // down: left on the line
    if (L.every((x) => isInt(x) && x > -1e-9)) {
      const r = Math.hypot(p[0], p[1]);
      return { c: [0, 0], R: Math.max(r * (line ? 1.12 : 1.1) + (line ? 1.2 : 1.3) * SHORT, MIN_WINDOW) };
    }
    const pts = [p].concat(cutoffApexes(L).map(M));
    const low = pts.reduce((a, q) => (q[dn] < a[dn] ? q : a));
    const below = low.slice();
    below[dn] -= (pts.length > 1 ? 1.3 : 2) * SHORT;
    pts.push([0, 0], below);
    const m = 1.2 * SHORT, lo = [0, 0], hi = [0, 0];
    for (const q of pts) for (let i = 0; i < d; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); }
    const box = Math.max(MIN_WINDOW, ...lo.slice(0, d).map((x, i) => (hi[i] - x) / 2 + m));
    const round = Math.max(MIN_WINDOW, ...lo.slice(0, d).map((x, i) => Math.max(-x, hi[i]) + m));
    if (round <= 1.3 * box) return { c: [0, 0], R: round };
    return { c: [0, 1].map((i) => (i < d ? (lo[i] + hi[i]) / 2 : 0)), R: box };
  }
  // where L(λ) parts from M(λ): the highest weights, other than λ, of the Verma
  // modules in its character (none when L(λ) = M(λ))
  const apexCache = new Map();
  function cutoffApexes(L) {
    const ck = state.type + '|' + L.join(',');
    if (!apexCache.has(ck)) {
      if (apexCache.size > 200) apexCache.clear();
      apexCache.set(ck, HW.simpleQuotient(alg(), L, 0).terms.map((t) => t.apex).filter((a) => a.some((x, i) => Math.abs(x - L[i]) > 1e-9)));
    }
    return apexCache.get(ck);
  }
  // the height of λ − x, for x a point of the model, as a linear function: its gradient
  const heightCache = {};
  function heightGrad() {
    const A = alg();
    if (!heightCache[A.type]) {
      const ht = (v) => A.toSimple(A.fromPos(v)).reduce((s, x) => s + x, 0);
      heightCache[A.type] = A.rank === 1 ? [ht([1]), 0] : [ht([1, 0]), ht([0, 1])];
    }
    return heightCache[A.type];
  }
  // how deep the weights below λ reach into the window, with a margin: the window in
  // view, and the one it is moving to (they differ while λ is dragged)
  function depthToFill(L) {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 600, g = heightGrad(), p = M(L), m = 0.7 * SHORT;
    const reach = (f) => {
      const ex = kind() === 'line' ? f.R : f.R * w / Math.min(w, h), ey = kind() === 'line' ? 0 : f.R * h / Math.min(w, h);
      return g[0] * (p[0] - f.c[0]) + g[1] * (p[1] - f.c[1]) + (ex + m) * Math.abs(g[0]) + (ey + m) * Math.abs(g[1]);
    };
    const f = state.frame;
    return Math.max(reach(weightsFrame(L)), f && f.c.length === 2 ? reach(f) : 0);
  }

  // the window round a set of points of the model
  function frameOf(pts, k) {
    const d = pts[0].length, lo = pts[0].slice(), hi = pts[0].slice();
    for (const p of pts) for (let i = 0; i < d; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    const c = lo.map((x, i) => (x + hi[i]) / 2);
    if (k === 'line') return { c: [c[0], 0], R: (hi[0] - lo[0]) / 2 + 1.4 * SHORT };
    if (k === 'space') return { c, R: Math.max(...pts.map((p) => Math.hypot(...p.map((x, i) => x - c[i])))) + 0.8 * SHORT };
    return { c, R: Math.max(hi[0] - lo[0], hi[1] - lo[1]) / 2 + 1.2 * SHORT };
  }
  // where the window should be for the current view (the relief has its own)
  function target() {
    const k = kind(), v = state.view;
    if (k === 'aff-line' || k === 'aff-space') { const S = affScene(); return { c: S.centre, R: S.R }; }
    if (v === 'tensor') {
      const c = M(lam()), r = norm(nu());
      if (k === 'space') return { c, R: Math.max(r * 1.12 + 0.8 * SHORT, 1.7 * SHORT) };
      // the weights of V(ν) round λ, and the origin, by which the dot action folds them
      const half = k === 'line' ? Math.max(r * 1.15 + 1.4 * SHORT, 3 * SHORT) : Math.max(r * 1.12 + 1.5 * SHORT, 2.2 * SHORT), m = 1.2 * SHORT;
      const lo = c.map((x) => Math.min(x - half, -m)), hi = c.map((x) => Math.max(x + half, m));
      if (k === 'line') return { c: [(lo[0] + hi[0]) / 2, 0], R: (hi[0] - lo[0]) / 2 };
      return { c: lo.map((x, i) => (x + hi[i]) / 2), R: Math.max(hi[0] - lo[0], hi[1] - lo[1]) / 2 };
    }
    if (v === 'weights' && (k === 'line' || k === 'plane')) return weightsFrame(wlam());
    let L = lam();
    if (v === 'weights') {
      const S = finiteScene();
      // a Verma module in space: its top, two steps down (it goes on below), λ and the origin
      if (S.kind !== 'fd') return frameOf(S.points.filter((p) => p.depth <= 2).map((p) => M(p.mu)).concat([M(S.lam), zeros(3)]), k);
      L = S.lam;
    }
    const r = norm(L);
    if (k === 'space') return { c: [0, 0, 0], R: Math.max(r * 1.06 + 0.9 * SHORT, 2.4 * SHORT) };
    if (k === 'line') return { c: [0, 0], R: Math.max(r * 1.12 + 1.2 * SHORT, 3 * SHORT) };
    return { c: [0, 0], R: Math.max(r * 1.1 + 1.3 * SHORT, 3 * SHORT) };
  }
  let anim = null;
  const sameFrame = (a, b) => a.c.length === b.c.length && a.c.every((x, i) => Math.abs(x - b.c[i]) < 1e-6) && Math.abs(a.R - b.R) < 1e-6;
  // The zoom, as a scale: at least SMIN pixels to a unit of the model, at most MAG times that.
  // The window is fitted to the view but never farther out than SMIN, where it keeps the handles
  // in view; or it is as near as the reader chose, the magnification state.zoom over SMIN. The
  // slider in the bar shows the scale drawn (zoomShown).
  const SMIN = 18, MAG = 12;
  const halfOf = () => (kind() === 'line' ? canvas.clientWidth : Math.min(canvas.clientWidth, canvas.clientHeight)) / 2 || 300;
  // the points the window must not lose, the last first: λ, and λ + ν in the tensor product
  function anchors() {
    if (isAffine()) { const S = affScene(); return [S.model(S.lam, 0)]; }
    if (state.view === 'tensor') return [M(add(lam(), nu())), M(lam())];
    return [M(wlam())];
  }
  function zoomed(t) {
    const half = halfOf(), R = state.zoom ? half / (SMIN * state.zoom) : clamp(t.R, half / (SMIN * MAG), half / SMIN);
    if (R >= t.R - 1e-9) return { c: t.c, R };
    const m = Math.min(1.3 * SHORT, 0.45 * R), c = t.c.slice();
    for (const q of anchors()) for (let i = 0; i < c.length; i++) if (!(kind() === 'line' && i === 1)) c[i] = q[i] + clamp(c[i] - q[i], m - R, R - m);
    return { c, R };
  }
  function retarget(now) {
    const t = target(), f = state.frame, z = zoomed(t);
    // a picture moved by hand stays where it was put while what it is fitted to does not change
    // (when that changes, the window is fitted again, as near as the zoom says)
    if (!now && state.panned && state.goal && sameFrame(state.goal, t)) { draw(); return; }
    state.goal = t;
    state.panned = false;
    if (!f || now || MM.reduceMotion() || state.view === 'relief' || f.c.length !== z.c.length) { state.frame = z; anim = null; draw(); return; }
    if (sameFrame(f, z)) { anim = null; draw(); return; }
    const running = !!anim;
    anim = { from: { c: f.c.slice(), R: f.R }, to: z, t0: performance.now(), dur: 340 };
    if (!running) requestAnimationFrame(tick);
  }
  function tick(ts) {
    if (!anim) return;
    const u = clamp((ts - anim.t0) / anim.dur, 0, 1), e = 1 - Math.pow(1 - u, 3), { from, to } = anim;
    state.frame = { c: from.c.map((x, i) => x + (to.c[i] - x) * e), R: from.R * Math.pow(to.R / from.R, e) };
    draw();
    if (u < 1) requestAnimationFrame(tick); else anim = null;
  }
  // the plane, the line (across the middle) and affine sl2: model → screen
  function view2d() {
    const w = canvas.clientWidth, h = canvas.clientHeight, f = state.frame || zoomed(target());
    const s = kind() === 'line' ? w / 2 / f.R : Math.min(w, h) / 2 / f.R, c = f.c;
    return {
      w, h, s, c, dim: 2,
      at: (p) => [w / 2 + (p[0] - c[0]) * s, h / 2 - (p[1] - c[1]) * s, 0],
      back: (x, y) => [c[0] + (x - w / 2) / s, c[1] - (y - h / 2) / s],
    };
  }
  // space: turned about the vertical (the third axis) by az, and seen from the
  // elevation el; at() also gives how near the point is to the eye
  function view3d() {
    const w = canvas.clientWidth, h = canvas.clientHeight, f = state.frame || zoomed(target());
    const s = Math.min(w, h) / 2 / f.R, c = f.c, cam = state.cam;
    const ca = Math.cos(cam.az), sa = Math.sin(cam.az), ce = Math.cos(cam.el), se = Math.sin(cam.el);
    const model = (q0, q1, z) => [ca * q0 + sa * q1 + c[0], -sa * q0 + ca * q1 + c[1], z + c[2]];
    return {
      w, h, s, c, dim: 3,
      at: (p) => {
        const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2], q0 = ca * x - sa * y, q1 = sa * x + ca * y;
        return [w / 2 + s * q0, h / 2 - s * (q1 * se + z * ce), -q1 * ce + z * se];
      },
      // the point of the model under (x, y) at the given nearness, or on the level z
      back: (x, y, near) => { const q0 = (x - w / 2) / s, Y = (h / 2 - y) / s; return model(q0, se * Y - ce * near, ce * Y + se * near); },
      onLevel: (x, y, z) => { const q0 = (x - w / 2) / s, Y = (h / 2 - y) / s, zr = z - c[2]; return model(q0, (Y - zr * ce) / Math.max(se, 1e-3), zr); },
    };
  }
  const offscreen = (V, x, y, m) => x < -m || y < -m || x > V.w + m || y > V.h + m;

  /* ---------- drawing helpers ---------- */

  function rgbOf(name) { return MM.color(name).match(/[\d.]+/g).map(Number).slice(0, 3); }
  const mix = (a, b, t) => 'rgb(' + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',') + ')';
  function seg(x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function ring(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }

  // every dot the same size: the multiplicity is the number by it
  const dotR = (spacing) => clamp(spacing * 0.12, 2.2, 4);
  function disc(x, y, r, col, hollow, rim) {
    ctx.beginPath();
    if (hollow) {
      const lw = Math.min(1.6, r * 0.45);
      ctx.arc(x, y, Math.max(0.5, r - lw / 2), 0, TAU);
      ctx.fillStyle = MM.color('surface');
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = col;
      ctx.stroke();
      return;
    }
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = col;
    ctx.fill();
    if (rim) { ctx.lineWidth = 0.9; ctx.strokeStyle = MM.rgba('surface', 0.9); ctx.stroke(); } // dots in space overlap
  }

  // What can be pointed at, {key, x, y, r, near, …}; the boxes of the labels
  // drawn so far, so that the next keep off them.
  let shown = [], taken = [];
  const overlaps = (b) => taken.some((t) => Math.abs(t.x - b.x) * 2 < t.w + b.w && Math.abs(t.y - b.y) * 2 < t.h + b.h);
  const onDot = (b, skip) => shown.some((p) => p !== skip && Math.abs(p.x - b.x) < b.w / 2 + p.r && Math.abs(p.y - b.y) < b.h / 2 + p.r);
  // the centre of a box of half-size (ex, ey) whose edge is `gap` from (x, y) in the direction a (y up)
  function beside(x, y, a, gap, ex, ey) {
    const ux = Math.cos(a), uy = -Math.sin(a);
    const t = gap + Math.min(Math.abs(ux) > 1e-6 ? ex / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? ey / Math.abs(uy) : 1e9);
    return [x + ux * t, y + uy * t];
  }
  // a label on a patch of the surface colour, kept inside the canvas
  function plate(V, text, bx, by, color, size, pad) {
    const sz = size || (V.w < 420 ? 12.5 : 13.5), tw = MM.measureLabel(ctx, text, sz), th = sz * 1.3, p = pad === undefined ? 4 : pad;
    bx = clamp(bx, tw / 2 + 5, V.w - tw / 2 - 5);
    by = clamp(by, th / 2 + 3, V.h - th / 2 - 3);
    ctx.fillStyle = MM.rgba('surface', 0.86);
    ctx.beginPath();
    ctx.roundRect(bx - tw / 2 - p, by - th / 2 - 1, tw + 2 * p, th + 2, Math.min(4, p + 1));
    ctx.fill();
    MM.canvasLabel(ctx, text, bx, by, { size: sz, align: 'center', baseline: 'middle', color });
    const box = { x: bx, y: by, w: tw + 2 * p, h: th + 2 };
    taken.push(box);
    return box;
  }
  // the distance from (x, y) to a box
  const boxDist = (b, x, y) => Math.hypot(Math.max(Math.abs(x - b.x) - b.w / 2, 0), Math.max(Math.abs(y - b.y) - b.h / 2, 0));
  // a label beside (x, y), in the direction a (y up) or the nearest one that is free;
  // tight: hard against the point; clear: no nearer to it than that (for a mark round it)
  function label(V, text, x, y, gap, color, a, size, skip, tight, clear) {
    const sz = size || (V.w < 420 ? 12.5 : 13.5), tw = MM.measureLabel(ctx, text, sz), th = sz * (tight ? 1.05 : 1.3), p = tight ? 1.5 : 4;
    let best = null;
    for (const d of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, 2.3, -2.3, Math.PI]) {
      let [bx, by] = beside(x, y, a + d, gap, tw / 2 + p, th / 2);
      if (clear) {
        const ux = Math.cos(a + d), uy = -Math.sin(a + d);
        for (let i = 0; i < 40 && boxDist({ x: bx, y: by, w: tw + 2 * p, h: th }, x, y) < clear; i++) { bx += ux; by += uy; }
      }
      const box = { x: clamp(bx, tw / 2 + 5, V.w - tw / 2 - 5), y: clamp(by, th / 2 + 3, V.h - th / 2 - 3), w: tw + 2 * p, h: th };
      if (!best) best = box;
      if (!overlaps(box) && !onDot(box, skip)) { best = box; break; }
    }
    return plate(V, text, best.x, best.y, color, sz, p);
  }
  function head(tx, ty, ux, uy) {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - ux * 7.5 - uy * 3.4, ty - uy * 7.5 + ux * 3.4);
    ctx.lineTo(tx - ux * 7.5 + uy * 3.4, ty - uy * 7.5 - ux * 3.4);
    ctx.closePath();
    ctx.fill();
  }
  function arrow(x0, y0, x1, y1, gap0, gap1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < gap0 + gap1 + 6) return;
    const ux = (x1 - x0) / d, uy = (y1 - y0) / d, tx = x1 - ux * gap1, ty = y1 - uy * gap1;
    seg(x0 + ux * gap0, y0 + uy * gap0, tx - ux * 4, ty - uy * 4);
    head(tx, ty, ux, uy);
  }
  // an arrow along an arc, bowed by `bow` pixels to the right of its direction
  function curve(x0, y0, x1, y1, bow, gap0, gap1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < gap0 + gap1 + 6) return;
    const cx = (x0 + x1) / 2 - (y1 - y0) / d * bow, cy = (y0 + y1) / 2 + (x1 - x0) / d * bow;
    const t0 = unit([cx - x0, cy - y0]), t1 = unit([x1 - cx, y1 - cy]);
    const tx = x1 - t1[0] * gap1, ty = y1 - t1[1] * gap1;
    ctx.beginPath();
    ctx.moveTo(x0 + t0[0] * gap0, y0 + t0[1] * gap0);
    ctx.quadraticCurveTo(cx, cy, tx - t1[0] * 4, ty - t1[1] * 4);
    ctx.stroke();
    head(tx, ty, t1[0], t1[1]);
  }

  // Numbers by the dots: on the side furthest from the neighbouring weights in
  // the plane; in space, on the first side that is free. Not when the dots are
  // too close together to tell which number is whose.
  const angleCache = {};
  function numberAngle(V) {
    const k = kind();
    if (k === 'line') return Math.PI / 2;
    if (k === 'aff-line') return 0;
    if (angleCache[state.type] !== undefined) return angleCache[state.type];
    const A = alg(), o = V.at(M(zeros(A.rank))), dirs = [];
    for (const r of A.positive) {
      if (r.long) continue;
      const p = V.at(M(r.labels)), a = Math.atan2(o[1] - p[1], p[0] - o[0]);
      dirs.push(a, a + Math.PI);
    }
    let best = 0, bd = -Infinity;
    for (let i = -12; i <= 12; i++) {
      const a = i * Math.PI / 24, d = Math.min(...dirs.map((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))));
      const score = d - 0.01 * Math.abs(a - 0.3);
      if (score > bd) { bd = score; best = a; }
    }
    return (angleCache[state.type] = best);
  }
  function numbers(V, spacing) {
    // in space, not where the dots are close, nor (but for an affine algebra, whose pictures are
    // wide and sparse) where there are very many; a number that has no room by its dot is left out
    const many = V.dim === 3 ? (isAffine() ? spacing < 30 : shown.length > 72 || spacing < 22) : spacing < 23;
    if (many) return;
    const fs = 10.5, ink = MM.color('ink-2'), halo = MM.rgba('surface', 0.92);
    ctx.font = MM.font('sans', fs, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const a0 = V.dim === 3 ? null : numberAngle(V);
    const list = V.dim === 3 ? shown.slice().reverse() : shown; // in space, the nearest first
    for (const p of list) {
      if (p.num === undefined || p.num === null || offscreen(V, p.x, p.y, 0)) continue;
      const txt = String(p.num), tw = ctx.measureText(txt).width, r = p.handle ? Math.max(p.r, 12.5) : p.r;
      let box = null;
      for (const a of a0 === null ? [0.55, 0, 1.2, 2.6, -0.6, 3.14, 1.9, -1.6] : [a0]) {
        const [x, y] = beside(p.x, p.y, a, r + 2, tw / 2 + 1.5, fs / 2);
        const b = { x, y, w: tw + 3, h: fs + 1 };
        if (a0 !== null || (!overlaps(b) && !onDot(b, p))) { box = b; break; }
      }
      if (!box) continue;
      ctx.strokeStyle = halo;
      ctx.lineWidth = 3;
      ctx.strokeText(txt, box.x, box.y + 0.5);
      ctx.fillStyle = ink;
      ctx.fillText(txt, box.x, box.y + 0.5);
      taken.push(box);
    }
  }

  // rings: round the pointed-at point, and the selected one with its orbit (a list of keys)
  function rings(orbitOf) {
    const find = (k) => shown.find((p) => p.key === k);
    const sel = find(state.sel);
    if (sel && orbitOf) {
      ctx.strokeStyle = MM.rgba('accent', 0.55);
      ctx.lineWidth = 1.25;
      for (const k of orbitOf(sel)) {
        const p = find(k);
        if (p && p !== sel) ring(p.x, p.y, p.r + 3.2);
      }
    }
    const hov = state.hover !== state.sel && find(state.hover);
    if (hov) { ctx.strokeStyle = MM.color('ink-3'); ctx.lineWidth = 1.25; ring(hov.x, hov.y, hov.r + 4.5); }
    if (sel) { ctx.strokeStyle = MM.color('accent'); ctx.lineWidth = 2; ring(sel.x, sel.y, sel.r + 4.5); }
    return sel;
  }
  // in space, how much paler a dot is for being far from the eye
  function fader(near) {
    let lo = Infinity, hi = -Infinity;
    for (const z of near) { lo = Math.min(lo, z); hi = Math.max(hi, z); }
    return (z) => (hi - lo < 1e-9 ? 0 : 0.55 * (hi - z) / (hi - lo));
  }
  // the colour of a dot: paler at the back, and at the depth where the picture stops
  function tone(base, white, back, last) { const t = 1 - (1 - back) * (1 - last); return t > 0.004 ? mix(base, white, t) : 'rgb(' + base.join(',') + ')'; }

  /* ---------- backdrops ---------- */

  // The plane: the dominant chamber (tinted), the mirrors through the origin or
  // through −ρ, and the weight lattice, faintly.
  function backdropPlane(V, opts) {
    const A = alg(), { w, h } = V, L = 3 * (w + h);
    ctx.clearRect(0, 0, w + 2, h + 2); // the canvas can be a fraction of a pixel larger than its box
    ctx.setLineDash([]);
    const O = V.at([0, 0]), e = A.e.map(unit);
    if (opts.chamber) {
      ctx.beginPath();
      ctx.moveTo(O[0], O[1]);
      ctx.lineTo(O[0] + L * e[0][0], O[1] - L * e[0][1]);
      ctx.lineTo(O[0] + L * (e[0][0] + e[1][0]), O[1] - L * (e[0][1] + e[1][1]));
      ctx.lineTo(O[0] + L * e[1][0], O[1] - L * e[1][1]);
      ctx.closePath();
      ctx.fillStyle = MM.rgba('accent', 0.06);
      ctx.fill();
    }
    const mirrors = (at, dashed, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.setLineDash(dashed ? [5, 4] : []);
      const o = V.at(at);
      for (const r of A.positive) {
        const d = unit(P(r.labels)), ux = -d[1], uy = d[0];
        seg(o[0] - L * ux, o[1] + L * uy, o[0] + L * ux, o[1] - L * uy);
      }
      ctx.setLineDash([]);
    };
    if (opts.mirrors) mirrors([0, 0], false, MM.color('rule'));
    if (opts.shifted) mirrors(P([-1, -1]), true, MM.rgba('ink', opts.faint ? 0.18 : 0.3));
    // the walls of the dominant chamber, a little stronger
    if (opts.chamber) {
      ctx.strokeStyle = MM.rgba('accent', 0.32);
      for (let i = 0; i < 2; i++) seg(O[0], O[1], O[0] + L * e[i][0], O[1] - L * e[i][1]);
    }
    // the weight lattice
    if (opts.lattice && V.s * SHORT >= 11) {
      const corners = [V.back(0, 0), V.back(w, 0), V.back(0, h), V.back(w, h)].map(A.fromPos);
      const x0 = Math.floor(Math.min(...corners.map((c) => c[0]))), x1 = Math.ceil(Math.max(...corners.map((c) => c[0])));
      const y0 = Math.floor(Math.min(...corners.map((c) => c[1]))), y1 = Math.ceil(Math.max(...corners.map((c) => c[1])));
      ctx.fillStyle = MM.rgba('ink', 0.22);
      for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) {
        const [x, y] = V.at(P([a, b]));
        if (offscreen(V, x, y, 2)) continue;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, TAU);
        ctx.fill();
      }
    }
    origin(V);
  }
  // The line: the axis, the dominant half-line as a pale band, the mirror
  // through 0 or through −ρ, and the weight lattice.
  function backdropLine(V, opts) {
    const { w, h } = V, O = V.at([0, 0]), y0 = O[1];
    ctx.clearRect(0, 0, w + 2, h + 2);
    ctx.setLineDash([]);
    if (opts.chamber) {
      ctx.fillStyle = MM.rgba('accent', 0.07);
      ctx.fillRect(clamp(O[0], 0, w), y0 - 12, w + 2 - clamp(O[0], 0, w), 24);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = MM.color('rule');
    seg(0, y0, w + 2, y0);
    if (opts.mirrors) seg(O[0], y0 - 30, O[0], y0 + 30);
    if (opts.shifted) {
      const m = V.at(M([-1]));
      ctx.strokeStyle = MM.rgba('ink', 0.3);
      ctx.setLineDash([5, 4]);
      seg(m[0], y0 - 30, m[0], y0 + 30);
      ctx.setLineDash([]);
    }
    if (opts.lattice && V.s * SHORT >= 11) {
      const A = alg(), a0 = Math.floor(A.fromPos([V.back(0, 0)[0]])[0]), a1 = Math.ceil(A.fromPos([V.back(w, 0)[0]])[0]);
      ctx.fillStyle = MM.rgba('ink', 0.22);
      for (let a = a0; a <= a1; a++) { const [x] = V.at(M([a])); ctx.beginPath(); ctx.arc(x, y0, 1.2, 0, TAU); ctx.fill(); }
    }
    origin(V);
  }
  // Space: the edges of the dominant chamber, the rays through the ϖ_i (or,
  // dashed, the chamber moved to −ρ), and the edges of a W-polytope.
  function backdropSpace(V, opts) {
    const A = alg(), { w, h } = V, f = state.frame || target();
    ctx.clearRect(0, 0, w + 2, h + 2);
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    const ray = (from, i, col, dash) => {
      const d = unit(P(basisVec(3, i))), a = V.at(from), b = V.at(from.map((x, j) => x + d[j] * f.R * 0.95));
      ctx.strokeStyle = col;
      ctx.setLineDash(dash || []);
      seg(a[0], a[1], b[0], b[1]);
      ctx.setLineDash([]);
    };
    if (opts.chamber) for (let i = 0; i < 3; i++) ray([0, 0, 0], i, MM.rgba('accent', 0.36));
    if (opts.shifted) for (let i = 0; i < 3; i++) ray(P([-1, -1, -1]), i, MM.rgba('ink', 0.3), [5, 4]);
    if (opts.hull) {
      // the polytope's edges, fainter at the back
      const [x, by] = opts.hull, o = by ? P(by) : [0, 0, 0];
      const edges = HW.hullEdges(A, x).map(([p, q]) => [V.at(add(P(p), o)), V.at(add(P(q), o))]);
      const zs = edges.map(([a, b]) => (a[2] + b[2]) / 2), lo = Math.min(...zs), hi = Math.max(...zs);
      edges.forEach(([a, b], i) => {
        const t = hi - lo < 1e-9 ? 1 : (zs[i] - lo) / (hi - lo);
        ctx.strokeStyle = MM.rgba('wt', 0.16 + 0.34 * t);
        ctx.lineWidth = 1.1;
        seg(a[0], a[1], b[0], b[1]);
      });
    }
    origin(V);
  }
  function origin(V) {
    const O = V.at(M(zeros(alg().rank)));
    ctx.fillStyle = MM.color('ink');
    ctx.beginPath();
    ctx.arc(O[0], O[1], 2, 0, TAU);
    ctx.fill();
  }
  // The fundamental weights, in their own colour: a ring at ϖ_i (round the dot
  // there, if there is one) and its name hard against it, away from the chamber.
  function fundamentals(V) {
    const r = alg().rank, O = V.at(M(zeros(r))), col = MM.color('fund'), pts = [];
    for (let i = 0; i < r; i++) pts.push(V.at(M(basisVec(r, i))));
    const cx = pts.reduce((s, p) => s + p[0], 0) / r, cy = pts.reduce((s, p) => s + p[1], 0) / r;
    pts.forEach((p, i) => {
      if (offscreen(V, p[0], p[1], -6)) return;
      const here = shown.find((d) => Math.abs(d.x - p[0]) < 0.5 && Math.abs(d.y - p[1]) < 0.5), rr = (here ? here.r : 0) + 3;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ring(p[0], p[1], rr);
      let a;
      if (r === 1) a = -Math.PI / 2;
      else if (r === 2) {
        // perpendicular to the wall, away from the other fundamental weight
        const q = pts[1 - i], ux = p[0] - O[0], uy = p[1] - O[1], nx = -uy, ny = ux;
        const s = (q[0] - O[0]) * nx + (q[1] - O[1]) * ny > 0 ? -1 : 1;
        a = Math.atan2(-s * ny, s * nx);
      } else a = Math.atan2(cy - p[1], p[0] - cx);
      label(V, '$\\varpi_' + (i + 1) + '$', p[0], p[1], rr + 1.5, col, a, 12.5, here, true);
    });
  }
  // The roots, thin arrows from the origin in their own colour; the simple ones named.
  function rootArrows(V) {
    const A = alg(), O = V.at(M(zeros(A.rank)));
    ctx.strokeStyle = ctx.fillStyle = MM.rgba('root', V.dim === 3 ? 0.55 : 0.7);
    ctx.lineWidth = 1.2;
    for (const a of A.roots) {
      const t = V.at(M(a)), d = Math.hypot(t[0] - O[0], t[1] - O[1]);
      if (d < 10) continue;
      const ux = (t[0] - O[0]) / d, uy = (t[1] - O[1]) / d, hl = Math.min(6, d * 0.3), hw = hl * 0.45;
      seg(O[0], O[1], t[0] - ux * hl * 0.6, t[1] - uy * hl * 0.6);
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      ctx.lineTo(t[0] - ux * hl - uy * hw, t[1] - uy * hl + ux * hw);
      ctx.lineTo(t[0] - ux * hl + uy * hw, t[1] - uy * hl - ux * hw);
      ctx.closePath();
      ctx.fill();
    }
  }
  function rootLabels(V) {
    const A = alg(), O = V.at(M(zeros(A.rank))), col = mix(rgbOf('root'), rgbOf('ink'), 0.35);
    A.simple.forEach((a, i) => {
      const t = V.at(M(a));
      if (offscreen(V, t[0], t[1], -6)) return;
      const here = shown.find((d) => Math.abs(d.x - t[0]) < 0.5 && Math.abs(d.y - t[1]) < 0.5), r = here ? here.r : 2;
      const dir = A.rank === 1 ? -Math.PI / 2 : Math.atan2(O[1] - t[1], t[0] - O[0]);
      label(V, '$\\alpha_' + (i + 1) + '$', t[0], t[1], r + 3, col, dir, 12.5, here, true, r + 2);
    });
  }
  // the point −ρ, through which the dashed mirrors pass, named when it is in view
  function minusRho(V) {
    const r = alg().rank, m = V.at(M(zeros(r).map(() => -1)));
    if (!offscreen(V, m[0], m[1], -10)) label(V, '$-\\rho$', m[0], m[1], 6, MM.color('ink-3'), r === 1 ? -Math.PI / 2 : -2.4, 12.5);
    return m;
  }
  // the convex hull of a W-orbit in the plane, moved by the weight `by`
  function hull2d(V, x, col, by) {
    const o = by ? P(by) : [0, 0];
    const pts = HW.orbit(alg(), x).map(P).sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => { const [sx, sy] = V.at([p[0] + o[0], p[1] + o[1]]); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
    ctx.closePath();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }
  // on the line, the segment from −x to x, moved by `by`
  function hullLine(V, x, by) {
    const o = by ? by[0] : 0, a = V.at(M([o - x[0]])), b = V.at(M([o + x[0]]));
    ctx.strokeStyle = MM.rgba('wt', 0.35);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    seg(a[0], a[1], b[0], b[1]);
    ctx.lineCap = 'butt';
  }
  // the cone λ − Q₊ of a Verma module: rays from λ down the simple roots
  function cone(V, L, D) {
    const A = alg(), a = V.at(M(L));
    ctx.strokeStyle = MM.rgba('wt', 0.4);
    ctx.lineWidth = 1.25;
    for (let i = 0; i < A.rank; i++) { const b = V.at(M(sub(L, scale(D + 3, A.simple[i])))); seg(a[0], a[1], b[0], b[1]); }
  }
  // in the plane, the lines through λ where <λ+ρ, α^∨> is a positive integer; not
  // at an integral weight, where there is one for nearly every root and they clutter
  const specialShown = (S) => kind() === 'plane' && anyMode() && S.special.length > 0 && !S.lam.every((x) => isInt(x));
  function specialLines(V, S) {
    if (!specialShown(S)) return;
    const a = V.at(M(S.lam)), L = 3 * (V.w + V.h);
    ctx.strokeStyle = MM.rgba('ink', 0.5);
    ctx.lineWidth = 1.1;
    ctx.setLineDash([2, 3]);
    for (const { b } of S.special) { const d = unit(P(b.labels)), ux = -d[1], uy = d[0]; seg(a[0] - L * ux, a[1] + L * uy, a[0] + L * ux, a[1] - L * uy); }
    ctx.setLineDash([]);
  }

  /* ---------- hints for the handles ---------- */

  // (for an affine algebra, a coefficient λ_i of Λ held on the Dynkin diagram, i ≥ 1, moves Λ across its row too)
  const held = (which) => dragging === which || handles[which].matches(':focus-visible')
    || (which === 'lam' && isAffine() && !!editShown() && editShown().i > 0);
  // In space, while a handle is held (or has the keyboard's focus): the weights it
  // can step to, λ ± ϖ_i, each joined to it by a dashed line.
  function stepHints(V, which) {
    if (kind() !== 'space' || !held(which)) return;
    const off = which === 'nu' ? P(lam()) : [0, 0, 0], from = V.at(add(P(which === 'nu' ? nu() : lam()), off));
    const fill = MM.color('accent-2-soft'), edge = MM.color('accent-2-strong');
    for (const n of neighbours(which)) {
      const q = V.at(add(P(n.x), off));
      ctx.strokeStyle = MM.rgba('ink', 0.55);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      seg(from[0], from[1], q[0], q[1]);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(q[0], q[1], 6, 0, TAU);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      label(V, '$' + (n.sgn > 0 ? '+' : '-') + '\\varpi_' + (n.i + 1) + '$', q[0], q[1], 10, MM.color('ink-2'), Math.atan2(from[1] - q[1], q[0] - from[0]), 11.5, null, true, 10);
    }
  }
  // While a number on the Dynkin diagram is held, or has the keyboard's focus: the line
  // along which it moves its weight (λ, or λ + ν for ν), with a mark at each step.
  function editLine(V) {
    const on = editShown();
    if (!on || isAffine() || state.view === 'relief') return;
    const r = alg().rank, e = basisVec(r, on.i);
    const base = on.which === 'nu' ? add(lam(), nu()) : state.view === 'weights' ? wlam() : lam();
    const at = (t) => V.at(M(add(base, scale(t, e))));
    const o = at(0), u = at(1), stepPx = Math.hypot(u[0] - o[0], u[1] - o[1]);
    if (stepPx < 1) return;
    const T = Math.ceil(1.5 * Math.hypot(V.w, V.h) / stepPx), a = at(-T), b = at(T);
    ctx.lineCap = 'round';
    ctx.strokeStyle = MM.color('accent-2-soft');
    ctx.lineWidth = 8;
    seg(a[0], a[1], b[0], b[1]);
    ctx.strokeStyle = ctx.fillStyle = MM.color('accent-2-strong');
    ctx.lineWidth = 1.5;
    seg(a[0], a[1], b[0], b[1]);
    ctx.lineCap = 'butt';
    const ux = (u[0] - o[0]) / stepPx, uy = (u[1] - o[1]) / stepPx;
    for (let t = -T; t <= T; t++) {
      const q = at(t);
      if (offscreen(V, q[0], q[1], 4)) continue;
      if (V.dim === 3) { ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, TAU); ctx.fill(); } else seg(q[0] - uy * 4, q[1] + ux * 4, q[0] + uy * 4, q[1] - ux * 4);
    }
  }
  // Affine, in space: the plane Λ moves in, the top layer, with its weight lattice drawn
  // as the grid of its shortest vectors. Very light at all times, over the part between
  // 0 and Λ, so that the alcove and Λ stay in one picture; stronger round Λ while it is held.
  const shortCache = {};
  function shortestVecs(g) {
    if (shortCache[g.type]) return shortCache[g.type];
    let best = Infinity, out = [];
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      if (!a && !b) continue;
      const p = g.pos([a, b]), l = Math.hypot(p[0], p[1]);
      if (l < best - 1e-9) { best = l; out = [p]; } else if (Math.abs(l - best) < 1e-9) out.push(p);
    }
    return (shortCache[g.type] = out.filter((p) => p[1] > 1e-9 || (Math.abs(p[1]) < 1e-9 && p[0] > 0)));
  }
  function planeGrid(V, S) {
    const c = aff().g.pos(S.lam);
    gridLines(V, [0, 0], c, 2.6 * SHORT, 0.13);
    if (held('lam')) gridLines(V, c, c, 3.4 * SHORT, 0.4);
  }
  // the lines of the grid within `rad` of the segment [p, q], fading out towards that distance
  function gridLines(V, p, q, rad, strength) {
    const g = aff().g, e = g.e, covol = Math.abs(e[0][0] * e[1][1] - e[0][1] * e[1][0]), piece = rad / 8;
    const pq = [q[0] - p[0], q[1] - p[1]], len2 = pq[0] * pq[0] + pq[1] * pq[1];
    const dist = (x, y) => {
      const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((x - p[0]) * pq[0] + (y - p[1]) * pq[1]) / len2)) : 0;
      return Math.hypot(x - p[0] - t * pq[0], y - p[1] - t * pq[1]);
    };
    ctx.lineWidth = 1;
    for (const v of shortestVecs(g)) {
      // the lines x·n = j·step, each the points j·step·n + s·d
      const l = Math.hypot(v[0], v[1]), d = [v[0] / l, v[1] / l], n = [-d[1], d[0]], step = covol / l;
      const pn = p[0] * n[0] + p[1] * n[1], qn = q[0] * n[0] + q[1] * n[1], pd = p[0] * d[0] + p[1] * d[1], qd = q[0] * d[0] + q[1] * d[1];
      const s0 = Math.min(pd, qd) - rad, s1 = Math.max(pd, qd) + rad, count = Math.ceil((s1 - s0) / piece);
      for (let j = Math.ceil((Math.min(pn, qn) - rad) / step); j <= Math.floor((Math.max(pn, qn) + rad) / step); j++) {
        const o = j * step;
        for (let t = 0; t < count; t++) {
          const a0 = s0 + (s1 - s0) * t / count, a1 = s0 + (s1 - s0) * (t + 1) / count, am = (a0 + a1) / 2;
          const fade = 1 - dist(o * n[0] + am * d[0], o * n[1] + am * d[1]) / rad;
          if (fade <= 0) continue;
          const A = V.at([o * n[0] + a0 * d[0], o * n[1] + a0 * d[1], 0]), B = V.at([o * n[0] + a1 * d[0], o * n[1] + a1 * d[1], 0]);
          ctx.strokeStyle = MM.rgba('ink', strength * fade);
          seg(A[0], A[1], B[0], B[1]);
        }
      }
    }
  }

  /* ---------- the weights ---------- */

  function paintWeights(V) {
    const A = alg(), k = kind(), S = finiteScene(), L = S.lam, fd = S.kind === 'fd';
    taken = [];
    if (k === 'plane') { backdropPlane(V, { chamber: true, mirrors: true, shifted: !fd, faint: true, lattice: true }); if (fd) hull2d(V, L, MM.rgba('wt', 0.4)); }
    else if (k === 'line') { backdropLine(V, { chamber: true, mirrors: true, shifted: !fd, lattice: true }); if (fd) hullLine(V, L); }
    else backdropSpace(V, { chamber: true, hull: fd ? [L, null] : null });
    if (!fd) { cone(V, L, S.D); specialLines(V, S); }
    editLine(V);
    rootArrows(V);
    const spacing = V.s * SHORT * (V.dim === 3 ? 0.8 : 1), r = dotR(spacing);
    const pts = fd ? S.ch.weights.map((wt) => ({ key: wt.key, mu: wt.mu, mult: wt.mult })) : S.points;
    const items = pts.map((p) => { const q = V.at(M(p.mu)); return { p, x: q[0], y: q[1], near: q[2] }; });
    if (V.dim === 3) items.sort((a, b) => a.near - b.near);
    const back = V.dim === 3 ? fader(items.map((it) => it.near)) : () => 0;
    const base = rgbOf('wt'), white = rgbOf('surface'), lk = fd ? K(L) : 'b' + K(zeros(A.rank));
    shown = [];
    for (const it of items) {
      if (offscreen(V, it.x, it.y, 20)) continue;
      const last = fd || !S.capped ? 0 : it.p.depth === S.D ? 0.5 : it.p.depth === S.D - 1 ? 0.22 : 0;   // the picture stops at depth D
      disc(it.x, it.y, r, tone(base, white, back(it.near), last), false, V.dim === 3);
      shown.push({ key: it.p.key, x: it.x, y: it.y, r, near: it.near, mu: it.p.mu, num: it.p.mult, handle: it.p.key === lk });
    }
    numbers(V, spacing);
    const sel = rings(fd ? (p) => HW.orbit(A, p.mu).map(K) : null);
    fundamentals(V);
    rootLabels(V);
    stepHints(V, 'lam');
    const hx = V.at(M(L)), O = V.at(M(zeros(A.rank)));
    const away = Math.hypot(hx[0] - O[0], hx[1] - O[1]) > 4 ? Math.atan2(O[1] - hx[1], hx[0] - O[0]) : Math.PI / 2;
    label(V, '$\\lambda$', hx[0], hx[1], 15, MM.color('ink'), k === 'line' ? -0.7 : fd ? away : Math.PI / 2, undefined, shown.find((p) => p.key === lk));
    if (sel && sel.key !== lk) label(V, '$' + wtex(sel.mu) + '$', sel.x, sel.y, sel.r + 7, MM.color('accent-ink'), Math.atan2(O[1] - sel.y, sel.x - O[0]) || Math.PI / 2, undefined, sel);
    putHandle(handles.lam, hx);
  }

  /* ---------- the relief ---------- */

  let reliefCache = null;
  // The profile of the relief: for each weight, its distance from the origin
  // (to the far side of its cell) and its height as a fraction of the tallest.
  // The picture is fitted to it, which does not change as it turns.
  const profileCache = new Map();
  function profile(A, ch) {
    const k = A.type + ':' + K(ch.lam);
    if (!profileCache.has(k)) {
      if (profileCache.size > 50) profileCache.clear();
      const cellR = Math.max(...A.cell.map((c) => Math.hypot(c[0], c[1])));
      profileCache.set(k, ch.weights.map((wt) => [Math.hypot(...A.pos(wt.mu)) + cellR, wt.mult / ch.maxMult]));
    }
    return profileCache.get(k);
  }
  function reliefView() {
    const A = alg(), w = canvas.clientWidth, h = canvas.clientHeight, ch = HW.character(A, lam());
    // the tallest column: lower when every multiplicity is small, so a small representation is not a tower
    const R = Math.max(norm(lam()) + 0.95 * SHORT, 2.4 * SHORT), H = R * (0.22 + 0.33 * (1 - 1 / ch.maxMult));
    const ca = Math.cos(state.az), sa = Math.sin(state.az), se = Math.sin(state.el), ce = Math.cos(state.el);
    // up the screen the picture spans from the front edge of the floor to the highest top
    const prof = profile(A, ch), reach = Math.max(...prof.map((p) => p[0]), 2.8 * SHORT);
    const top = Math.max(...prof.map((p) => p[0] * se + p[1] * H * ce)), bottom = -reach * se;
    const fit = Math.min((w - 36) / (2 * reach), (h - 56) / (top - bottom)), s = state.zoom ? SMIN * state.zoom : clamp(fit, SMIN, SMIN * MAG);
    const mid = (top + bottom) / 2 - 4 / s; // a little low: the label of λ sits above the top
    const rot = (p) => [ca * p[0] - sa * p[1], sa * p[0] + ca * p[1]];
    const proj = (p, z) => { const q = rot(p); return [w / 2 + s * q[0], h / 2 - s * (q[1] * se + z * ce - mid)]; };
    // a point of the screen, at height z, back in the plane
    const unproj = (x, y, z) => {
      const qx = (x - w / 2) / s, qy = ((h / 2 - y) / s + mid - z * ce) / se;
      return [ca * qx + sa * qy, -sa * qx + ca * qy];
    };
    return { w, h, s, R: reach, H, ch, rot, proj, unproj, se, ce, zOf: (m) => (m / ch.maxMult) * H };
  }

  function paintRelief() {
    const A = alg(), V = reliefView(), { w, h, ch, proj, rot, R } = V;
    ctx.clearRect(0, 0, w + 2, h + 2);
    ctx.setLineDash([]);
    taken = [];
    // the floor: the mirrors, the walls of the dominant chamber and the hull of Wλ
    ctx.lineWidth = 1;
    ctx.strokeStyle = MM.color('rule');
    for (const r of A.positive) {
      const d = unit(P(r.labels)), u = [-d[1] * R, d[0] * R];
      const a = proj(u, 0), b = proj([-u[0], -u[1]], 0);
      seg(a[0], a[1], b[0], b[1]);
    }
    ctx.strokeStyle = MM.rgba('accent', 0.32);
    for (const e of A.e) {
      const u = unit(e), a = proj([0, 0], 0), b = proj([u[0] * R, u[1] * R], 0);
      seg(a[0], a[1], b[0], b[1]);
    }
    const pts = HW.orbit(A, lam()).map(P).sort((p, q) => Math.atan2(p[1], p[0]) - Math.atan2(q[1], q[0]));
    if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach((p, i) => { const [x, y] = proj(p, 0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
      ctx.strokeStyle = MM.rgba('wt', 0.4);
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }

    // the columns, from the back to the front
    const base = rgbOf('wt'), white = rgbOf('surface'), ink = rgbOf('ink');
    const light = unit([-0.55, -0.62]), lz = 0.62; // from the upper left, towards the eye
    // small cells: no gaps and no outlines, so that the columns read as one surface
    const px = V.s * SHORT, fine = px < 13, gap = fine ? 1 : 0.9, cell = A.cell.map((c) => [c[0] * gap, c[1] * gap]);
    const items = ch.weights.map((wt) => { const p = P(wt.mu); return { wt, p, depth: rot(p)[1] }; }).sort((a, b) => b.depth - a.depth);
    const Mx = ch.maxMult;
    shown = [];
    const faces = []; // for pointing: [key, polygon], in drawing order
    ctx.lineJoin = 'round';
    const edge = mix(base, ink, 0.25);
    for (const it of items) {
      const z = V.zOf(it.wt.mult), foot = cell.map((c) => [it.p[0] + c[0], it.p[1] + c[1]]);
      const lo = foot.map((q) => proj(q, 0)), hi = foot.map((q) => proj(q, z));
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = edge;
      const stroke = () => { if (fine) { ctx.lineWidth = 0.5; ctx.strokeStyle = ctx.fillStyle; } ctx.stroke(); }; // fills the hairline seams between faces
      for (let i = 0; i < foot.length; i++) {
        const j = (i + 1) % foot.length, dx = foot[j][0] - foot[i][0], dy = foot[j][1] - foot[i][1];
        const n = rot(unit([dy, -dx])); // outward normal, turned with the picture
        if (n[1] >= -1e-6 || V.ce < 1e-3) continue; // faces away from the eye
        const lit = Math.max(0, n[0] * light[0] + n[1] * light[1]);
        ctx.fillStyle = mix(base, white, 0.12 + 0.5 * lit);
        const quad = [lo[i], lo[j], hi[j], hi[i]];
        ctx.beginPath();
        quad.forEach((q, kk) => (kk ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.closePath();
        ctx.fill();
        stroke();
        faces.push([it.wt.key, quad]);
      }
      // the top, paler for small multiplicities
      const t = Mx > 1 ? (it.wt.mult - 1) / (Mx - 1) : 1;
      ctx.fillStyle = mix(white, base, (0.16 + 0.5 * t) * (0.8 + 0.2 * lz));
      ctx.beginPath();
      hi.forEach((q, kk) => (kk ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fill();
      stroke();
      faces.push([it.wt.key, hi]);
      const top = proj(it.p, z);
      shown.push({ key: it.wt.key, x: top[0], y: top[1], r: 6, mu: it.wt.mu });
    }
    reliefCache = { faces, V };

    // the selected column and the one pointed at, outlined
    const outline = (key, col, lw) => {
      if (!key) return;
      const wt = ch.byKey.get(key);
      if (!wt) return;
      const p = P(wt.mu), z = V.zOf(wt.mult), foot = cell.map((c) => [p[0] + c[0], p[1] + c[1]]);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      foot.map((q) => proj(q, z)).forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.stroke();
      // and its edges down to the floor
      foot.forEach((q) => { const a = proj(q, z), b = proj(q, 0); seg(a[0], a[1], b[0], b[1]); });
    };
    if (state.hover !== state.sel) outline(state.hover, MM.color('ink-2'), 1.25);
    outline(state.sel, MM.color('accent'), 2);
    ctx.lineJoin = 'miter';

    const top = proj(P(lam()), V.zOf(1));
    label({ w, h }, '$\\lambda$', top[0], top[1], 16, MM.color('ink'), Math.PI / 2);
    const selw = state.sel && ch.byKey.get(state.sel);
    if (selw && selw.key !== K(lam())) {
      const q = proj(P(selw.mu), V.zOf(selw.mult));
      label({ w, h }, '$' + wtex(selw.mu) + '$', q[0], q[1], 10, MM.color('accent-ink'), Math.PI / 2);
    }
    putHandle(handles.lam, top);
  }

  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------- tensor products ---------- */

  const tensorCache = new Map();
  function tensorOf() {
    const k = state.type + K(lam()) + '|' + K(nu());
    if (!tensorCache.has(k)) {
      if (tensorCache.size > 200) tensorCache.clear();
      const T = HW.tensor(alg(), lam(), nu());
      T.byKappa = new Map(T.parts.map((p) => [K(p.kappa), p]));
      tensorCache.set(k, T);
    }
    return tensorCache.get(k);
  }

  function paintTensor(V) {
    const A = alg(), k = kind(), T = tensorOf(), L = lam(), Nu = nu();
    taken = [];
    if (k === 'plane') { backdropPlane(V, { chamber: true, shifted: true, lattice: true }); hull2d(V, Nu, MM.rgba('wt', 0.4), L); }
    else if (k === 'line') { backdropLine(V, { chamber: true, shifted: true, lattice: true }); hullLine(V, Nu, L); }
    else backdropSpace(V, { chamber: true, shifted: true, hull: [Nu, L] });
    editLine(V);
    const spacing = V.s * SHORT * (V.dim === 3 ? 0.8 : 1), r = dotR(spacing);
    const part = rgbOf('wt-part'), neg = rgbOf('wt-neg'), white = rgbOf('surface'), grey = MM.color('ink-3');
    // What is drawn where: a summand V(κ) as a filled dot, with its multiplicity;
    // every other point λ + ν' as a ring: red when an odd w moves it (and it is
    // taken away there), green when an even one does, grey when it lies on a
    // mirror through −ρ or what it adds is cancelled.
    const cloud = new Map(T.moves.map((mv) => [K(mv.at), mv]));
    const hoop = 12.5;
    // the moves, from λ + ν' to w·(λ + ν'): on the line, bowed below it
    ctx.lineWidth = 1.25;
    for (const mv of T.moves) {
      if (!mv.to || !mv.steps.length) continue;
      const a = V.at(M(mv.at)), b = V.at(M(mv.to));
      ctx.strokeStyle = ctx.fillStyle = MM.rgba(mv.sign < 0 ? 'wt-neg' : 'wt-part', 0.8);
      if (k === 'line') curve(a[0], a[1], b[0], b[1], Math.sign(b[0] - a[0]) * Math.min(0.32 * Math.abs(b[0] - a[0]), 0.36 * V.h), r + 2.5, r + 3);
      else arrow(a[0], a[1], b[0], b[1], r + 2.5, r + 3);
    }
    const keys = new Set([...cloud.keys(), ...T.parts.map((p) => K(p.kappa))]);
    const items = [...keys].map((key) => {
      const mv = cloud.get(key), p = T.byKappa.get(key), mu = mv ? mv.at : p.kappa, q = V.at(M(mu));
      return { key, mv, p, mu, x: q[0], y: q[1], near: q[2] };
    });
    if (V.dim === 3) items.sort((a, b) => a.near - b.near);
    const back = V.dim === 3 ? fader(items.map((it) => it.near)) : () => 0;
    const top = K(add(L, Nu));
    shown = [];
    for (const it of items) {
      if (offscreen(V, it.x, it.y, 20)) continue;
      const { mv, p } = it, t = back(it.near);
      let num = null;
      if (p) { disc(it.x, it.y, r, tone(part, white, t, 0), false, V.dim === 3); num = p.n; }
      else if (mv.to && mv.steps.length) { disc(it.x, it.y, r + 0.6, tone(mv.sign < 0 ? neg : part, white, t, 0), true); if (mv.mult > 1) num = mv.mult; }
      else { disc(it.x, it.y, r + 0.6, grey, true); if (mv.mult > 1) num = mv.mult; }
      shown.push({ key: it.key, x: it.x, y: it.y, r, near: it.near, mu: it.mu, num, handle: it.key === K(L) || it.key === top });
    }
    // the weight ν, as an arrow from λ to λ + ν
    const l = V.at(M(L)), tp = V.at(M(add(L, Nu)));
    ctx.strokeStyle = ctx.fillStyle = MM.color('ink');
    ctx.lineWidth = 1.5;
    if (k === 'line') {
      const y = l[1] - 30;
      arrow(l[0], y, tp[0], y, 0, 0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = MM.rgba('ink', 0.35);
      ctx.setLineDash([2, 3]);
      seg(l[0], l[1] - 14, l[0], y + 4);
      seg(tp[0], tp[1] - 14, tp[0], y + 4);
      ctx.setLineDash([]);
      if (Math.abs(tp[0] - l[0]) > 8) label(V, '$\\nu$', (l[0] + tp[0]) / 2, y, 3, MM.color('ink'), Math.PI / 2);
    } else if (Math.hypot(tp[0] - l[0], tp[1] - l[1]) > 20) {
      arrow(l[0], l[1], tp[0], tp[1], hoop + 2, 12);
      const mx = (l[0] + tp[0]) / 2, my = (l[1] + tp[1]) / 2, a = Math.atan2(-(tp[1] - l[1]), tp[0] - l[0]);
      label(V, '$\\nu$', mx, my, 5, MM.color('ink'), a + Math.PI / 2);
    }
    numbers(V, spacing);
    rings(null);
    if (k !== 'space') fundamentals(V);
    stepHints(V, 'lam');
    stepHints(V, 'nu');
    label(V, '$\\lambda$', l[0], l[1], hoop + 3, MM.color('ink'), k === 'line' ? -Math.PI / 2 : Math.atan2(-(l[1] - tp[1]), l[0] - tp[0]));
    minusRho(V);
    putHandle(handles.lam, l);
    putHandle(handles.nu, tp);
  }

  /* ---------- affine algebras ---------- */

  function affineLabel(V, n, y) {
    const t = '$-' + (n === 1 ? '' : n) + '\\delta$', tw = MM.measureLabel(ctx, t, 11.5);
    plate(V, t, 6 + tw / 2, y, MM.color('ink-3'), 11.5);
  }
  function affineMessage(V, S) {
    if (S.mode === 'irrational') plate(V, 'Its labels are not fractions with small denominators: choose Verma for $M(\\Lambda)$', V.w / 2, V.h / 2, MM.color('ink-2'), 13);
  }

  function paintAffLine(V) {
    const S = affScene(), { N, u, k } = S, g = aff().g, m0 = S.lam[0], { w, h } = V, int = S.mode === 'int';
    ctx.clearRect(0, 0, w + 2, h + 2);
    ctx.setLineDash([]);
    taken = [];
    const X = (m) => V.at([g.pos([m])[0], 0])[0], Y = (n) => V.at([0, -u * n])[1], mOf = (x) => g.fromPos([V.back(x, 0)[0]])[0];
    const top = Y(0), dy = Y(1) - Y(0);
    ctx.lineWidth = 1;
    // the dominant weights: those over the alcove 0 ≤ m ≤ k, at every depth; at a
    // negative level, where there are none, the antidominant ones, over k ≤ m ≤ 0
    ctx.fillStyle = MM.rgba('accent', 0.06);
    ctx.fillRect(X(Math.min(0, k)), top, Math.abs(X(k) - X(0)), h - top);
    // a row for each depth
    ctx.strokeStyle = MM.color('rule-2');
    for (let n = 0; n <= N + 2; n++) seg(0, Y(n), w + 2, Y(n));
    if (int && k > 0) {
      // the mirrors m ∈ kℤ, the walls of the alcoves
      ctx.strokeStyle = MM.color('rule');
      for (let j = Math.floor(mOf(0) / k); j <= Math.ceil(mOf(w) / k); j++) seg(X(j * k), top, X(j * k), h + 2);
    }
    // the walls of that alcove
    ctx.strokeStyle = MM.rgba('accent', 0.32);
    seg(X(0), top, X(0), h + 2);
    seg(X(k), top, X(k), h + 2);
    if (int && k > 0) {
      // the paraboloid through WΛ: |μ|² = |λ|² + 2kn, that is n = (m² − a²)/4k
      ctx.beginPath();
      let pen = false;
      for (let x = 0; x <= w; x += 3) {
        const m = mOf(x), n = (m * m - m0 * m0) / (4 * k);
        if (n < 0) { pen = false; continue; }
        if (pen) ctx.lineTo(x, Y(n)); else ctx.moveTo(x, Y(n));
        pen = true;
      }
      ctx.strokeStyle = MM.rgba('wt', 0.45);
      ctx.lineWidth = 1.25;
      ctx.stroke();
    } else if (!int) {
      // the mirrors of the integral Weyl group in the dot action: <x + ρ, (α_1 + jδ)^∨> =
      // (m + 1) + j(k + 2) = 0, for the j where that root is integral for Λ
      const K2 = k + 2;
      if (Math.abs(K2) > 0.05) {
        ctx.strokeStyle = MM.rgba('ink', 0.3);
        ctx.setLineDash([5, 4]);
        const a = mOf(0), b = mOf(w), j0 = Math.ceil(Math.min(-(a + 1) / K2, -(b + 1) / K2)), j1 = Math.floor(Math.max(-(a + 1) / K2, -(b + 1) / K2));
        for (let j = j0; j <= j1 && j - j0 < 200; j++) if (isInt(m0 + 1 + j * K2)) seg(X(-1 - j * K2), top, X(-1 - j * K2), h + 2);
        ctx.setLineDash([]);
      }
      // the cone Λ − Q₊: along the top row, and down −α_0 = −δ + α_1
      ctx.strokeStyle = MM.rgba('wt', 0.4);
      ctx.lineWidth = 1.25;
      seg(X(m0), top, 0, top);
      const e = V.at([g.pos([m0 + 2 * (N + 2)])[0], -u * (N + 2)]);
      seg(X(m0), top, e[0], e[1]);
    }
    // while Λ is held: the row it moves along, with a tick at each integer it snaps to
    if (held('lam')) {
      ctx.fillStyle = MM.color('accent-2-soft');
      ctx.fillRect(0, top - 4, w + 2, 8);
      ctx.strokeStyle = MM.color('accent-2-strong');
      ctx.lineWidth = 1.5;
      seg(0, top, w + 2, top);
      for (let m = Math.ceil(mOf(0)); m <= Math.floor(mOf(w)); m++) seg(X(m), top - 4, X(m), top + 4);
    }
    // the weights, paler at the depth where the picture stops
    const spacing = Math.min(X(2) - X(0), dy), r = dotR(spacing), base = rgbOf('wt'), white = rgbOf('surface');
    shown = [];
    for (const p of S.points) {
      const [x, y] = V.at(S.model(p.mu, p.n));
      if (offscreen(V, x, y, 20)) continue;
      disc(x, y, r, tone(base, white, 0, int ? 0 : p.n === N ? 0.5 : 0));
      shown.push({ key: p.key, x, y, r, mu: p.mu, n: p.n, num: p.mult, dom: p.dom, handle: p.n === 0 && Math.abs(p.mu[0] - m0) < 1e-9 });
    }
    if (int) {
      // below depth N the weights go on: the rows fade out
      const fadeTop = Y(N) + Math.max(10, dy * 0.4), grad = ctx.createLinearGradient(0, fadeTop, 0, Math.min(h, fadeTop + Math.max(24, dy)));
      grad.addColorStop(0, MM.rgba('surface', 0));
      grad.addColorStop(1, MM.rgba('surface', 1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, fadeTop, w + 2, h + 2 - fadeTop);
    }
    numbers(V, spacing);
    rings(int ? (p) => shown.filter((q) => q.dom === p.dom).map((q) => q.key) : null);
    const hx = [X(m0), top];
    label(V, '$\\Lambda$', hx[0], hx[1], 15, MM.color('ink'), Math.PI / 2);
    if (int && k > 0) {
      // the corners of the alcove, kΛ_0 and kΛ_1, unless Λ is there
      const nm = (i) => '$' + (k === 1 ? '' : k) + '\\Lambda_' + i + '$';
      if (Math.abs(m0) > 1e-9) label(V, nm(0), X(0), top, 6, MM.color('ink-3'), Math.PI / 2 + 0.5, 12.5);
      if (Math.abs(m0 - k) > 1e-9) label(V, nm(1), X(k), top, 6, MM.color('ink-3'), Math.PI / 2 - 0.5, 12.5);
    }
    const every = dy < 15 ? 3 : dy < 22 ? 2 : 1;
    for (let n = every; n <= N; n += every) affineLabel(V, n, Y(n));
    affineMessage(V, S);
    putHandle(handles.lam, hx);
  }

  function paintAffSpace(V) {
    const S = affScene(), { N, u, k } = S, A = aff(), g = A.g, { w, h } = V, int = S.mode === 'int';
    ctx.clearRect(0, 0, w + 2, h + 2);
    ctx.setLineDash([]);
    taken = [];
    const at = (p, n) => V.at([p[0], p[1], -u * n]);
    // the axis, through 0
    ctx.lineWidth = 1;
    ctx.strokeStyle = MM.color('rule');
    const a0 = at([0, 0], 0), a1 = at([0, 0], N + 0.6);
    seg(a0[0], a0[1], a1[0], a1[1]);
    // the dominant weights: those over the alcove kA, at every depth (at a negative
    // level, where there are none, kA holds the antidominant ones)
    const corners = [[0, 0]].concat([0, 1].map((i) => g.pos(basisVec(2, i).map((x) => x * k / g.comarks[i]))));
    const tri = corners.map((p) => at(p, 0));
    ctx.beginPath();
    tri.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.fillStyle = MM.rgba('accent', 0.1);
    ctx.fill();
    ctx.strokeStyle = MM.rgba('accent', 0.38);
    ctx.stroke();
    ctx.strokeStyle = MM.rgba('accent', 0.22);
    corners.forEach((p) => { const q0 = at(p, 0), q1 = at(p, N); seg(q0[0], q0[1], q1[0], q1[1]); });
    if (int && k > 0) {
      // the paraboloid: a circle at each depth
      for (let n = 0; n <= N; n++) {
        const rr = S.rad(n);
        if (rr < 1e-6) continue;
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const t = TAU * i / 72, q = at([rr * Math.cos(t), rr * Math.sin(t)], n);
          if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        }
        ctx.strokeStyle = MM.rgba('wt', 0.28);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (!int) {
      // the cone Λ − Q₊: down −α_1 and −α_2 in the top layer, and down −α_0 = −δ + θ
      const top = g.pos(S.lam), o = at(top, 0), far = N + 2;
      ctx.strokeStyle = MM.rgba('wt', 0.4);
      ctx.lineWidth = 1.25;
      for (let i = 0; i < 2; i++) { const e = at(g.pos(sub(S.lam, scale(far, g.simple[i]))), 0); seg(o[0], o[1], e[0], e[1]); }
      const e0 = at(g.pos(add(S.lam, scale(far, g.theta))), far);
      seg(o[0], o[1], e0[0], e0[1]);
    }
    planeGrid(V, S);
    // the weights, from the back
    const items = S.points.map((p) => { const q = V.at(S.model(p.mu, p.n)); return { p, x: q[0], y: q[1], near: q[2] }; }).sort((a, b) => a.near - b.near);
    const back = fader(items.map((it) => it.near)), sp = V.s * Math.min(SHORT, u) * 0.85, r = dotR(sp), base = rgbOf('wt'), white = rgbOf('surface');
    shown = [];
    for (const it of items) {
      disc(it.x, it.y, r, tone(base, white, back(it.near), int ? 0 : it.p.n === N ? 0.5 : 0), false, true);
      shown.push({ key: it.p.key, x: it.x, y: it.y, r, near: it.near, mu: it.p.mu, n: it.p.n, num: it.p.mult, dom: it.p.dom, handle: it.p.n === 0 && K(it.p.mu.map((x) => Math.round(x * 1e6))) === K(S.lam.map((x) => Math.round(x * 1e6))) });
    }
    // the depths, at the left, level with the axis (before the multiplicities, which keep clear of them)
    const every = V.s * u < 16 ? 2 : 1;
    for (let n = every; n <= N; n += every) affineLabel(V, n, at([0, 0], n)[1]);
    numbers(V, sp);
    rings(int ? (p) => shown.filter((q) => q.dom === p.dom).map((q) => q.key) : null);
    const hx = V.at(S.model(S.lam, 0));
    label(V, '$\\Lambda$', hx[0], hx[1], 15, MM.color('ink'), Math.PI / 2);
    affineMessage(V, S);
    putHandle(handles.lam, hx);
  }

  /* ---------- the highest weight, on the Dynkin diagram ---------- */

  // Beside the picture, the algebra's Dynkin diagram carries the highest weight: the
  // number on node i is the coefficient λ_i of ϖ_i in λ (and in ν, for the tensor
  // product), or for an affine algebra the coefficient λ_i of Λ = Σ λ_i Λ_i. It is the only
  // place λ is set in numbers: a drag sideways moves a number a step at a time (with a
  // mouse, up and down too; on a touch screen a drag that starts up or down scrolls the
  // page), a click on either side of it steps it down or up, and so do the arrow keys.
  // Where λ may be any weight (Any weight, an affine algebra), a click between a number's
  // arrows, or Enter, opens a box over it to type it (typeNumber). A step is ±1 exactly,
  // so a fraction keeps its fractional part, and for an affine algebra the other
  // coefficients stay as they are: the level changes with λ_i, by a_i^∨ λ_i. The diagram
  // is an SVG with the numbers in it, for Save image; the places that take the pointer lie
  // under it, one for each number, and stay while the values change, so that a drag keeps
  // hold of what it moves.
  const DK = { unit: 60, typed: 74, r: 5.5, size: 14 };  // px: a bond (longer where numbers may be fractions), a node's radius, the numbers
  const STEP_PX = 22;                         // pixels of drag for a step
  const measure = document.createElement('canvas').getContext('2d');
  const editors = {};    // 'lam', 'nu' → the diagram of that weight, for the algebra shown
  let editing = null;    // { which, i, held } while a number is held, or has the focus
  const whiches = () => (!isAffine() && state.view === 'tensor' ? ['lam', 'nu'] : ['lam']);
  // the number held, or focused from the keyboard: then the picture shows where it moves its weight
  function editShown() {
    if (!editing || !editors[editing.which]) return null;
    return editing.held || editors[editing.which].nums[editing.i].matches(':focus-visible') ? editing : null;
  }

  // the numbers on the diagram of `which`: λ, ν or Λ by their coefficients;
  // 'shell': the λ of sl3 in the figure of hexagons and triangles, in the text
  function numbersOf(which) {
    if (which === 'shell') return state.shell;
    if (isAffine()) return affLabels(affSt().lam, affSt().k);
    return which === 'nu' ? nu() : wlam();
  }
  // whether `which` may have the numbers x: integers within the cap, or where λ may be any
  // weight (typeable) anything within ±ANYCAP, and for an affine algebra a level in the
  // slider's range
  const typeable = (which) => which === 'lam' && ((isAffine() && state.any) || anyMode());
  function allowed(which, x) {
    if (which === 'shell') return x.every((c) => Number.isInteger(c) && c >= 0 && c <= SHELL_CAP);
    if (isAffine()) {
      const c = aff().comarks, k = x.reduce((t, a, j) => t + c[j] * a, 0), [lo, hi] = levels();
      if (!state.any && !x.every((a) => Number.isInteger(a) && a >= 0)) return false;
      return k >= lo - 1e-9 && k <= hi + 1e-9 && x.slice(1).every((a) => Math.abs(a) <= ANYCAP + 1e-9);
    }
    if (typeable(which)) return x.every((c) => Math.abs(c) <= ANYCAP + 1e-9);
    return x.every((c) => Number.isInteger(c) && c >= 0 && c <= info().cap);
  }
  // the numbers with number i moved by n from `from`, or null where that is not allowed
  function stepped(which, i, n, from) {
    const x = from.slice();
    x[i] = Math.round((x[i] + n) * 1e9) / 1e9;
    return allowed(which, x) ? x : null;
  }
  // new numbers for `which`; whether anything changed
  function setNumbers(which, x) {
    if (which === 'shell') {
      if (x.every((c, i) => c === state.shell[i])) return false;
      state.shell = x.slice();
      return true;
    }
    if (!isAffine()) return setWeight(which, x);
    const st = affSt(), c = aff().comarks, k = Math.round(x.reduce((t, a, j) => t + c[j] * a, 0) * 1e9) / 1e9, moved = Math.abs(k - st.k) > 1e-12;
    st.k = k;
    const changed = setAffine(x.slice(1)) || moved;
    if (moved) syncControls(); // (the level slider)
    return changed;
  }
  // number i moved n whole steps from `from`, or as far that way as is allowed
  function stepNumber(which, i, n, from) {
    for (let m = n; m; m -= Math.sign(m)) { const x = stepped(which, i, m, from); if (x) return setNumbers(which, x); }
    return setNumbers(which, from);
  }
  // a step from the arrow keys or a click: as a reader's change, the window refitted
  function nudge(which, i, n) {
    if (!stepNumber(which, i, n, numbersOf(which).slice())) return;
    if (which === 'shell') { drawShells(); return; }
    state.sel = state.hover = null;
    update();
  }

  // The diagram of `which`, for the algebra shown (sl3 for the figure in the text): its nodes
  // in the places of LAYOUT, the numbers above them (below the lower nodes of the triangle
  // of affine sl3), and the nodes' indices under them where the nodes are not in order.
  function buildEditor(which) {
    const type = which === 'shell' ? 'A2' : state.type, affine = INFO[type].fam === 'affine';
    const A = affine ? HW.affine(type).cartan : HW.algebra(type).cartan, n = A.length;
    const layout = LAYOUT[type], below = type === 'A2-1' ? [1, 2] : [], numbered = type === 'C2-1' || type === 'G2-1';
    const u = typeable(which) ? DK.typed : DK.unit, pad = 28, top = 34;
    const xs = layout.map((p) => p[0]), ys = layout.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
    const pts = layout.map(([x, y]) => [pad + (x - x0) * u, top + (y - y0) * u]);
    const W = 2 * pad + (Math.max(...xs) - x0) * u, low = top + (Math.max(...ys) - y0) * u;
    const H = low + (below.length ? 34 : numbered ? 24 : 10);
    const make = MM.svg;
    const el = document.createElement('div'), sym = document.createElement('span'), box = document.createElement('div'), layer = document.createElement('div');
    el.className = 'hw-wt';
    sym.className = 'hw-wt-sym';
    MM.setHTML(sym, affine ? '$\\Lambda$' : which === 'nu' ? '$\\nu$' : '$\\lambda$');
    box.className = 'hw-dk';
    layer.className = 'hw-dknums';
    const svg = make('svg', { class: 'hw-dkpic', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img' }, box);
    box.insertBefore(layer, svg);
    el.append(sym, box);
    const line = (d) => make('path', { class: 'hw-dk-line', d }, svg);
    const f = (x) => x.toFixed(1);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!A[i][j]) continue;
      const a = Math.abs(A[i][j]), b = Math.abs(A[j][i]), m = Math.max(a, b), r = DK.r;
      const [xa, ya] = pts[i], [xb, yb] = pts[j], d = Math.hypot(xb - xa, yb - ya), ux = (xb - xa) / d, uy = (yb - ya) / d, nx = -uy, ny = ux;
      for (let k = 0; k < m; k++) {
        const o = (k - (m - 1) / 2) * 3.4;
        line('M' + f(xa + ux * r + nx * o) + ' ' + f(ya + uy * r + ny * o) + 'L' + f(xb - ux * r + nx * o) + ' ' + f(yb - uy * r + ny * o));
      }
      // an arrow towards the shorter root (both ways for affine sl2): |a_ij| > |a_ji| when α_i is the shorter
      const chevron = (dir) => {
        const mx = (xa + xb) / 2 + dir * ux * (a === b ? 5 : 0), my = (ya + yb) / 2 + dir * uy * (a === b ? 5 : 0), hh = 2.4 + 1.5 * m;
        line('M' + f(mx - dir * ux * 3.6 + nx * hh) + ' ' + f(my - dir * uy * 3.6 + ny * hh) + 'L' + f(mx + dir * ux * 3.6) + ' ' + f(my + dir * uy * 3.6)
          + 'L' + f(mx - dir * ux * 3.6 - nx * hh) + ' ' + f(my - dir * uy * 3.6 - ny * hh));
      };
      if (a > b) chevron(-1); else if (b > a) chevron(1); else if (m === 2) { chevron(1); chevron(-1); }
    }
    const at = [], texts = [], nums = [];
    pts.forEach(([x, y], i) => {
      make('circle', { class: 'hw-dk-node', cx: x, cy: y, r: DK.r }, svg);
      // (21 px from the node: its place, 20 px tall, and the ring of its focus or its typing box clear the node)
      const p = [x, below.includes(i) ? y + 21 : y - 21];
      at.push(p);
      texts.push(make('text', { class: 'hw-dk-num', x, y: p[1] }, svg));
      if (numbered) make('text', { class: 'hw-dk-idx', x, y: y + 19 }, svg).textContent = String(i);
      const s = document.createElement('span');
      s.className = 'hw-num';
      s.tabIndex = 0;
      s.setAttribute('role', 'spinbutton');
      s.setAttribute('aria-label', affine ? 'The coefficient of Lambda ' + i + ' in Lambda' : 'The coefficient of omega ' + (i + 1) + ' in ' + (which === 'nu' ? 'nu' : 'lambda') + (which === 'shell' ? ', for the figure of hexagons and triangles' : ''));
      s.style.top = p[1] + 'px';
      s.innerHTML = '<span class="hw-step" data-d="-1"><svg viewBox="0 0 5 8" aria-hidden="true"><path d="M5 0 0 4 5 8z"/></svg></span><span class="hw-mid"></span>'
        + '<span class="hw-step" data-d="1"><svg viewBox="0 0 5 8" aria-hidden="true"><path d="M0 0 5 4 0 8z"/></svg></span>';
      layer.appendChild(s);
      nums.push(s);
    });
    const ed = { which, el, svg, at, texts, nums, shown: [] };
    nums.forEach((s, i) => wireNumber(ed, i));
    return ed;
  }
  function wireNumber(ed, i) {
    const el = ed.nums[i], which = ed.which, own = which === 'shell'; // (own: the figure in the text, which redraws itself)
    let from = null, moved = 0, last = 0;
    const drag = MM.turnDrag(el, {
      start: () => {
        from = numbersOf(which).slice(); moved = 0; last = 0;
        if (own) { ed.held = i; drawShells(); return; }
        editing = { which, i, held: true };
        chrome();
        draw();
      },
      move: (dx, dy) => {
        moved += dx - dy;
        const n = Math.trunc(moved / STEP_PX);
        if (n === last) return;
        last = n;
        const changed = stepNumber(which, i, n, from);
        if (own) { if (changed) drawShells(); return; }
        if (changed) state.sel = state.hover = null;
        chrome();
        draw();
      },
      // the window, kept still while the number moved, fits the picture again
      end: () => {
        if (own) { ed.held = null; drawShells(); return; }
        editing = el === document.activeElement ? { which, i, held: false } : null;
        chrome();
        retarget();
      },
    });
    // A click steps it down or up, on the side of its middle it falls; where λ may be any
    // weight, a click between its arrows opens a box over it instead, to type it.
    el.addEventListener('click', (e) => {
      if (drag.moved) return;
      const r = el.getBoundingClientRect(), x = e.clientX - r.left;
      if (typeable(which) && x > STEP_ZONE && x < r.width - STEP_ZONE) { typeNumber(ed, i); return; }
      nudge(which, i, x < r.width / 2 ? -1 : 1);
    });
    // up and right raise it, down and left lower it; Page Up and Page Down by five, Home to 0;
    // Enter opens the box where it may be typed
    el.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
      if (d) nudge(which, i, d);
      else if (e.key === 'Enter' && typeable(which)) typeNumber(ed, i);
      else if (e.key === 'Home') {
        const x = stepped(which, i, -numbersOf(which)[i], numbersOf(which));
        if (x && setNumbers(which, x)) { if (own) drawShells(); else { state.sel = state.hover = null; update(); } }
      } else return;
      e.preventDefault();
    });
    if (own) return;
    el.addEventListener('focus', () => { if (!editing || !editing.held) editing = { which, i, held: false }; draw(); });
    el.addEventListener('blur', () => { if (editing && !editing.held) editing = null; draw(); });
  }
  // Where λ may be any weight, a number is typed in a box over it, at its place: the box
  // holds the number as the site's boxes show one, selected; Enter, or leaving the box,
  // takes what was typed (a decimal, or a fraction such as −1/2, read as those boxes read
  // it) if λ may have it, and Enter marks it if not; Escape puts the number back.
  const STEP_ZONE = 15; // px at each end of a number's place, round its arrow: a click there steps
  function typeNumber(ed, i) {
    const which = ed.which, s = ed.nums[i], box = s.parentElement.parentElement;
    if (box.querySelector('.hw-numfield')) return;
    const input = document.createElement('input');
    input.className = 'field hw-numfield';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-label', s.getAttribute('aria-label'));
    input.value = MM.formatNumber(numbersOf(which)[i]);
    input.style.left = ed.at[i][0] + 'px';
    input.style.top = ed.at[i][1] + 'px';
    box.appendChild(input);
    ed.texts[i].classList.add('is-typed');
    input.focus();
    input.select();
    let open = true;
    const close = (back) => {
      if (!open) return;
      open = false;
      input.remove();
      ed.texts[i].classList.remove('is-typed');
      if (back) s.focus();
    };
    const take = () => {
      const v = MM.parseNumbers(input.value), x = numbersOf(which).slice();
      if (!v || v.length !== 1) return false;
      x[i] = Math.round(v[0] * 1e9) / 1e9;
      if (!allowed(which, x)) return false;
      if (setNumbers(which, x)) { state.sel = state.hover = null; update(); }
      return true;
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); if (take()) close(true); else { input.setAttribute('aria-invalid', 'true'); input.select(); } }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    });
    input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
    // (a box taken away with its diagram, for another algebra, takes nothing)
    input.addEventListener('blur', () => { if (open && input.isConnected) take(); close(false); });
  }
  // an editor's numbers as they are, written as the site's number boxes write them (so the
  // level and λ_0 read alike): the text in the drawing, the place that takes the pointer
  // sized to it (wider where a number may be typed, for a click between its arrows), the
  // arrows faded where a step is not allowed; `held`, the number held, and `lit`, the one
  // whose line the picture shows
  function syncNumbers(ed, x, lo, hi, held, lit) {
    measure.font = MM.font('math', DK.size);
    const typed = typeable(ed.which);
    x.forEach((v, i) => {
      const t = MM.formatNumber(v), s = ed.nums[i], wide = Math.max(typed ? 58 : 42, Math.ceil(measure.measureText(t).width) + 34);
      if (ed.shown[i] !== t + '|' + wide) {
        ed.shown[i] = t + '|' + wide;
        ed.texts[i].textContent = t;
        s.style.width = wide + 'px';
        s.style.left = (ed.at[i][0] - wide / 2) + 'px';
        s.setAttribute('aria-valuenow', String(Math.round(v * 1e4) / 1e4));
        s.setAttribute('aria-valuetext', t);
      }
      s.classList.toggle('is-typeable', typed);
      if (typed) s.setAttribute('aria-keyshortcuts', 'Enter'); else s.removeAttribute('aria-keyshortcuts');
      s.setAttribute('aria-valuemin', lo);
      s.setAttribute('aria-valuemax', hi);
      s.firstChild.classList.toggle('is-off', !stepped(ed.which, i, -1, x));
      s.lastChild.classList.toggle('is-off', !stepped(ed.which, i, 1, x));
      s.classList.toggle('is-held', held === i);
      ed.texts[i].classList.toggle('is-on', lit === i);
    });
  }
  // the diagrams of the weights in view, built afresh for another algebra or view, and their numbers
  function syncEditors() {
    const box = $('weights'), list = whiches(), key = state.type + '|' + list.join(',') + (typeable('lam') ? '|typed' : '');
    if (box._key !== key) {
      box._key = key;
      box.textContent = '';
      for (const w of Object.keys(editors)) delete editors[w];
      for (const w of list) { editors[w] = buildEditor(w); box.appendChild(editors[w].el); }
      editing = null;
    }
    const on = editShown();
    for (const w of list) {
      const ed = editors[w], x = numbersOf(w), wide = isAffine() || (w === 'lam' && anyMode());
      ed.svg.setAttribute('aria-label', 'The Dynkin diagram of ' + info().plain + ', with ' + (isAffine() ? 'Lambda' : w === 'nu' ? 'nu' : 'lambda') + ' by its coefficients: ' + x.map((v) => MM.formatNumber(v)).join(', '));
      syncNumbers(ed, x, wide ? -ANYCAP : 0, wide ? ANYCAP : info().cap, editing && editing.held && editing.which === w ? editing.i : null, on && on.which === w ? on.i : null);
    }
  }

  /* ---------- in the text: the hexagons and triangles of sl3 ---------- */

  // The weights of V(aϖ1 + bϖ2) for sl3 on their shells: a dominant μ with λ − μ =
  // c1α1 + c2α2 lies on shell min(c1, c2), the hull of Wλ with each edge moved in that
  // many steps. The shells are min(a, b) hexagons, then triangles (or the point 0), and
  // the weights on each have one multiplicity, written once, at its right. The figure has
  // its own λ, set on its own Dynkin diagram, and is drawn one unit to a pixel, so that
  // its labels keep the size of the text's.
  const SHELL_CAP = 6, SHELL0 = [4, 2]; // the largest coefficient, and the first case (state.shell)
  let shellEd = null;
  function drawShells() {
    const svg = $('shells'), box = svg.parentElement;
    if (!shellEd) { shellEd = buildEditor('shell'); shellEd.held = null; $('shells-lam').appendChild(shellEd.el); }
    syncNumbers(shellEd, state.shell, 0, SHELL_CAP, shellEd.held, shellEd.held);
    shellEd.svg.setAttribute('aria-label', 'The Dynkin diagram of sl3, with lambda by its coefficients: ' + state.shell.join(', '));
    const A = HW.algebra('A2'), [a, b] = state.shell, ch = HW.character(A, [a, b]);
    const W = Math.max(240, Math.min(440, Math.round(box.clientWidth || 440))), H = Math.round(W * 0.82);
    const byDom = new Map(ch.dominant.map((D) => [K(D.mu), D])), shells = new Map();
    for (const wt of ch.weights) {
      const D = byDom.get(K(wt.dom)), j = Math.min(D.c[0], D.c[1]);
      if (!shells.has(j)) shells.set(j, { mult: D.mult, pts: [] });
      shells.get(j).pts.push(A.pos(wt.mu));
    }
    const R = Math.max(SHORT, ...ch.weights.map((wt) => Math.hypot(...A.pos(wt.mu)))), s = Math.min(W, H) / 2 / (R + 0.8 * SHORT);
    const X = (p) => W / 2 + p[0] * s, Y = (p) => H / 2 - p[1] * s, r = clamp(s * SHORT * 0.12, 2, 3.4), f = (x) => x.toFixed(1);
    // the convex hull of a shell's points, on the screen (they all lie on its boundary); rounded
    // first, so that points one above another stay in order
    const hull = (pts) => {
      const q = pts.map((p) => [Math.round(X(p) * 1000) / 1000, Math.round(Y(p) * 1000) / 1000]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
      const cross = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
      const half = (list) => { const out = []; for (const p of list) { while (out.length > 1 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-6) out.pop(); out.push(p); } out.pop(); return out; };
      return half(q).concat(half(q.slice().reverse()));
    };
    let out = '', dots = '', labels = '';
    for (const [, sh] of shells) {
      const poly = sh.pts.length > 2 ? hull(sh.pts) : [];
      if (poly.length > 2) out += '<path class="sh-hull" d="M' + poly.map((p) => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z"/>';
      for (const p of sh.pts) dots += '<circle class="sh-dot" cx="' + f(X(p)) + '" cy="' + f(Y(p)) + '" r="' + r.toFixed(2) + '"/>';
      // its multiplicity, just right of its rightmost point, on the horizontal mirror
      const right = Math.max(...sh.pts.map((p) => X(p))), t = String(sh.mult);
      labels += '<text class="sh-num halo" x="' + f(right + r + 4 + 3.4 * t.length) + '" y="' + f(H / 2) + '">' + t + '</text>';
    }
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const key = W + '|' + a + ',' + b;
    if (svg._key !== key) { svg._key = key; svg.innerHTML = out + dots + labels; }
    const lam = '$V(' + wtex([a, b]) + ')$', m = Math.min(a, b);
    svg.setAttribute('aria-label', 'The weights of V(' + wplain([a, b]) + ') for sl3 on ' + m + (m === 1 ? ' hexagon' : ' hexagons') + ' and then triangles, with multiplicities '
      + [...shells.entries()].sort((u, v) => u[0] - v[0]).map(([, sh]) => sh.mult).join(', ') + ' from the outside in');
    MM.setHTML($('shells-cap'), 'The weights of ' + lam + '. The number by each hexagon or triangle is the multiplicity of the weights on it.');
  }

  /* ---------- readouts ---------- */

  const mark = (cls, c, text) => '<span class="legend-item"><span class="' + cls + '"' + (c ? ' style="--c: var(--' + c + ')"' : '') + '></span>' + text + '</span>';
  const lineMark = (cls, d, dash, text) => '<span class="legend-item"><svg class="legend-line' + cls + '" viewBox="0 0 22 10" aria-hidden="true"><path d="' + d + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>' + text + '</span>';
  const dotMark = (c, text) => '<span class="legend-item"><svg class="hw-dotnum" viewBox="0 0 22 14" aria-hidden="true" style="--c: var(--' + c + ')"><circle cx="4" cy="8" r="3.2"/><text x="10" y="6.5">2</text></svg>' + text + '</span>';
  const ARROW = 'M1 5H18M14 1.8L19.5 5L14 8.2';
  const fundMark = mark('dot hollow', 'fund', 'the fundamental weights $\\varpi_i$');
  const rootMark = lineMark(' root', ARROW, '', 'the roots, $\\alpha_i$ the simple ones');

  // the roots α with <λ+ρ, α^∨> a positive integer
  const specialRoots = (S) => S.special.map((x) => rtex(x.b.c)).join(',\\ ');
  // a readout's value, leading to the section that explains it
  const why = (sec, html) => '<a href="#sec-' + sec + '">' + html + '</a>';
  // a count, in TeX, and what it counts
  const many = (n, one, more) => '$' + n + '$ ' + (n === 1 ? one : more);

  // what depends on the algebra, the view and the weights, but not on the pointer
  function chrome() {
    syncEditors();
    seeAlso();
    // under the figure, what is about some types (or one family) only for them (data-for)
    for (const el of document.querySelectorAll('[data-for]')) { const f = el.dataset.for.split(' '); el.hidden = !f.includes(state.type) && !f.includes(info().fam); }
    if (isAffine()) { chromeAffine(); return; }
    const A = alg(), I = info(), v = state.view, k = kind();
    const fam = ' <span class="side-kind">$' + I.alg + '$, type $' + I.cartan + '$</span>';
    const rows = [];
    let title, name = '', legend = '', hint = '';
    const S = v === 'weights' ? finiteScene() : null;
    const L = S ? S.lam : lam();
    const turn = k === 'space' ? 'Drag the picture to turn it, and ' : 'Drag ';
    if (v === 'tensor') {
      const T = tensorOf(), count = T.parts.reduce((s2, p) => s2 + p.n, 0);
      title = '$V(\\lambda)\\otimes V(\\nu)$';
      rows.push(['Weights', '$\\lambda=' + wtex(L) + '$, $\\nu=' + wtex(nu()) + '$']);
      rows.push(['Dimension', '$' + T.dim + '$']);
      rows.push(['Summands', why('tensor', '$' + T.parts.length + '$') + (count > T.parts.length ? ', or $' + count + '$ counted with multiplicity' : '')]);
      const moved = T.moves.filter((m) => m.to && m.steps.length);
      legend = dotMark('wt-part', 'a summand, with its multiplicity')
        + (moved.some((m) => m.sign < 0) ? mark('dot hollow', 'wt-neg', 'moved by $w\\cdot{}$, $w$ odd: taken away there') : '')
        + (moved.some((m) => m.sign > 0) ? mark('dot hollow', 'wt-part', 'moved by $w\\cdot{}$, $w$ even: added there') : '')
        + mark('dot hollow', 'ink-3', 'on a mirror through $-\\rho$, or cancelled') + lineMark(' nu', ARROW, '', 'the weight $\\nu$')
        + lineMark('', 'M1 5H21', '5 4', k === 'space' ? 'the dominant chamber moved to $-\\rho$' : 'mirrors through $-\\rho$') + (k === 'space' ? '' : fundMark);
      hint = turn + 'the handles at $\\lambda$ and $\\lambda+\\nu$, or the numbers on the Dynkin diagrams, to change $\\lambda$ and $\\nu$.';
    } else if (v === 'relief' || S.kind === 'fd') {
      const ch = HW.character(A, L);
      title = '$V(' + wtex(L) + ')$';
      name = repName(state.type, L);
      rows.push(['Dimension', why('weights', '$' + ch.dim + '$')]);
      rows.push(['Weights', '$' + ch.weights.length + '$, in ' + many(ch.dominant.length, 'orbit', 'orbits') + ' of $W$']);
      // (for sl3, the hexagons and triangles say what they are)
      rows.push(['Multiplicities', (ch.maxMult > 1 ? 'up to ' : 'all ') + why(state.type === 'A2' ? 'shells' : 'weights', '$' + ch.maxMult + '$')]);
      if (v === 'weights') {
        legend = dotMark('wt', 'a weight, with its multiplicity') + lineMark(' hull', 'M1 5H21', '', 'the convex hull of $W\\lambda$') + mark('swatch c1', '', 'the dominant chamber') + fundMark + rootMark;
        hint = anyMode() ? 'The yellow handle snaps to the integral weights, and to the lines and points where $M(\\lambda)$ is not simple.'
          : (k === 'space' ? 'Drag the picture to turn it, and the yellow handle or a number on the Dynkin diagram to change $\\lambda$.' : 'Drag the yellow handle, or a number on the Dynkin diagram, to change $\\lambda$.');
      } else {
        legend = '<span class="legend-item">each weight a column, as tall as its multiplicity</span>' + lineMark(' hull', 'M1 5H21', '', 'the convex hull of $W\\lambda$');
        hint = 'Drag the picture to turn it, and the yellow handle or a number on the Dynkin diagram to change $\\lambda$.';
      }
    } else {
      // M(λ), or L(λ) infinite-dimensional
      const verma = S.kind === 'verma', simpleM = !S.special.length;
      title = '$' + (verma ? 'M' : 'L') + '(' + wtex(L) + ')$';
      name = verma ? 'a Verma module' : simpleM ? 'equal to the Verma module $M(\\lambda)$' : 'the simple quotient of the Verma module $M(\\lambda)$';
      rows.push(['$M(\\lambda)$ simple', simpleM ? why('verma', 'yes') : why('verma', 'no') + ': it contains $M(s_\\alpha\\cdot\\lambda)$ for $\\alpha=' + specialRoots(S) + '$']);
      if (!verma && !simpleM) rows.push(['Character', why('verma', 'an alternating sum') + ' of $' + S.terms.length + '$ characters of Verma modules, in the table']);
      if (S.capped) rows.push(['Shown', 'down to depth $' + S.D + '$']);
      legend = dotMark('wt', 'a weight, with its multiplicity') + lineMark(' hull', 'M1 5H21', '', 'the cone $\\lambda-Q_+$')
        + (k === 'space' ? '' : lineMark('', 'M1 5H21', '5 4', 'mirrors through $-\\rho$'))
        + (specialShown(S) ? lineMark(' special', 'M1 5H21', '2 3', 'where $\\langle\\lambda+\\rho,\\alpha^\\vee\\rangle$ is a positive integer') : '')
        + mark('swatch c1', '', 'the dominant chamber') + fundMark + rootMark;
      hint = (anyMode() ? 'The yellow handle snaps to the integral weights, and to the lines and points where $M(\\lambda)$ is not simple. ' : k === 'space' ? 'Drag the picture to turn it. ' : '')
        + (S.capped ? 'The weights go on below depth $' + S.D + '$.' : 'The weights go on beyond the window' + (pans() && finePointer ? ': drag the picture to see more.' : '.'));
    }
    MM.setHTML($('title'), title + fam);
    MM.setHTML($('name'), name);
    $('name').hidden = !name;
    MM.kv($('about'), rows);
    $('about').parentNode.hidden = !rows.length;
    MM.setHTML($('legend'), legend);
    MM.setHTML($('hint'), hint);
    table();
    canvas.setAttribute('aria-label', describe());
    const hl = handles.lam;
    hl.setAttribute('aria-label', k === 'line' ? 'The highest weight lambda: the arrow keys change it'
      : k === 'space' ? 'The highest weight lambda: the left and right arrow keys change its coefficient of omega 1, down and up that of omega 2, page down and page up that of omega 3'
        : 'The highest weight lambda: the left and right arrow keys change its coefficient of omega 1, down and up its coefficient of omega 2');
    hl.setAttribute('aria-valuemin', anyMode() ? -ANYCAP : 0);
    hl.setAttribute('aria-valuemax', anyMode() ? ANYCAP : I.cap);
    hl.setAttribute('aria-valuenow', Math.round(L[0] * 100) / 100);
    hl.setAttribute('aria-valuetext', 'lambda = ' + wplain(L));
    handles.nu.setAttribute('aria-valuemax', I.cap);
    handles.nu.setAttribute('aria-valuenow', nu()[0]);
    handles.nu.setAttribute('aria-valuetext', 'nu = ' + wplain(nu()));
  }

  function chromeAffine() {
    const I = info(), S = affScene(), A = aff(), labels = S.labels, k = kind(), int = S.mode === 'int', verma = S.mode === 'verma';
    const fam = ' <span class="side-kind">$' + I.alg + '$, type $' + I.cartan + '$</span>';
    MM.setHTML($('title'), '$' + (verma ? 'M' : 'L') + '(' + comb(labels, '\\Lambda', 0) + ')$' + fam);
    const name = int ? affName(state.type, labels.map(Math.round)) : verma ? 'a Verma module' : S.mode === 'generic' ? 'equal to the Verma module $M(\\Lambda)$' : 'the simple quotient of the Verma module $M(\\Lambda)$';
    MM.setHTML($('name'), name);
    $('name').hidden = !name;
    const rows = []; // (the level: its slider, above them)
    let legend = dotMark('wt', 'a weight, with its multiplicity');
    // (no counts of the weights drawn, or of how deep: they say more about the picture than the module)
    if (int) legend += lineMark(' hull', 'M1 5H21', '', 'the paraboloid through $W\\Lambda$');
    else {
      const building = S.mode === 'generators' && !S.job.done;
      rows.push(['Module', {
        verma: why('verma-affine', 'the Verma module') + ' $M(\\Lambda)$',
        generic: why('verma-affine', 'equal to $M(\\Lambda)$') + ' down to this depth',
        kl: why('verma-affine', 'an alternating sum') + ' of $' + S.terms.length + '$ characters of Verma modules, in the table',
        generators: why('verma-affine', building ? 'being built from the generators…' : 'built from the generators'),
        irrational: 'not computed: its labels are not fractions with small denominators',
      }[S.mode]]);
      legend += lineMark(' hull', 'M1 5H21', '', 'the cone $\\Lambda-\\widehat{Q}_+$') + (k === 'aff-line' && Math.abs(S.k + A.hv) > 0.05 ? lineMark('', 'M1 5H21', '5 4', 'mirrors of the integral Weyl group') : '');
    }
    // the alcove: the dominant weights lie over it; at a negative level there are none, and it holds the antidominant ones
    legend += mark('swatch c1', '', S.k < -1e-9 ? 'the antidominant weights: over the alcove' : S.k > 1e-9 ? 'the dominant weights: over the alcove' : 'the dominant weights: over $0$');
    MM.kv($('about'), rows);
    $('about').parentNode.hidden = !rows.length;
    MM.setHTML($('legend'), legend);
    MM.setHTML($('hint'), (k === 'aff-line' ? 'Drag the yellow handle along the top row, or a number on the Dynkin diagram, to change $\\Lambda$.'
      : 'Drag the picture to turn it, and the yellow handle across the top layer or a number on the Dynkin diagram to change $\\Lambda$.'));
    // (not how deep the picture goes, which its depths say: a hint of one length at every level keeps the panel under it still)
    table();
    canvas.setAttribute('aria-label', describe());
    const hl = handles.lam;
    hl.setAttribute('aria-label', k === 'aff-line' ? 'The highest weight Lambda, on the top row: the left and right arrow keys move it' : 'The highest weight Lambda, in the top layer: the arrow keys move it');
    hl.setAttribute('aria-valuemin', -ANYCAP);
    hl.setAttribute('aria-valuemax', ANYCAP);
    hl.setAttribute('aria-valuenow', Math.round(S.lam[0] * 100) / 100);
    hl.setAttribute('aria-valuetext', 'Lambda = ' + aplain(labels));
  }

  function describe() {
    const I = info(), k = kind(), v = state.view;
    if (isAffine()) {
      const S = affScene(), what = (S.mode === 'verma' ? 'M(' : 'L(') + aplain(S.labels) + ')';
      if (!S.points.length) return 'The highest weight ' + aplain(S.labels) + ' of ' + I.plain + (S.mode === 'generators' ? '; its simple module is being built.' : '; its simple module is not drawn.');
      return 'The weights of ' + what + ' for ' + I.plain + ' down to depth ' + S.N + ', the depth drawn downwards, each a dot with its multiplicity by it.' + (k === 'aff-space' ? ' Drag to turn the picture, or use the arrow keys.' : '');
    }
    const where = { line: 'on a line', plane: 'in the plane', space: 'in space' }[k];
    if (v === 'weights') {
      const S = finiteScene(), what = (S.kind === 'fd' ? 'V(' : S.kind === 'verma' ? 'M(' : 'L(') + wplain(S.lam) + ')';
      return 'The weights of ' + what + ' for ' + I.plain + ' ' + where + ', each a dot with its multiplicity by it' + (S.kind === 'fd' ? '; the table lists the dominant ones.' : S.capped ? ', down to depth ' + S.D + '.' : ', as far as the window goes.') + (k === 'space' ? ' Drag to turn the picture, or use the arrow keys.' : '');
    }
    if (v === 'relief') return 'The weights of V(' + wplain(lam()) + ') for ' + I.plain + ' as columns whose heights are the multiplicities. Drag to turn the picture, or use the arrow keys.';
    return 'The weights of V(' + wplain(nu()) + ') placed at lambda = ' + wplain(lam()) + ' and moved into the dominant chamber: the summands of the tensor product, listed in the table.';
  }

  // the Verma modules in an alternating sum, as rows
  function termRows(terms, name) {
    return terms.map((t) => '<tr><td class="num">$' + (t.coef > 0 ? '+' : '-') + (Math.abs(t.coef) > 1 ? Math.abs(t.coef) : '') + '$</td><td>$M(' + name(t) + ')$</td></tr>').join('');
  }

  function table() {
    const el = $('table');
    let head = '', html = '';
    if (isAffine()) {
      const S = affScene();
      if (S.mode === 'int') {
        const ch = S.ch, on = state.sel && ch.byKey.get(state.sel), cap = 8;
        const list = ch.strings.length > cap ? ch.strings.slice(0, cap - 1) : ch.strings;
        head = 'Maximal dominant weights';
        html = '<thead><tr><th>Weight $\\mu$</th><th>Multiplicities of $\\mu,\\mu-\\delta,\\mu-2\\delta,\\dots$</th></tr></thead><tbody>';
        for (const s of list) {
          const key = K(s.mu) + '|' + s.n, isOn = on && K(on.dom.mu) === K(s.mu);
          html += '<tr' + (isOn ? ' class="is-on"' : '') + '><td><button type="button" class="hw-pick" data-key="' + key + '">$' + atex(s.mu, s.n, ch.k) + '$</button></td><td class="hw-string">' + s.mults.join(', ') + ', …</td></tr>';
        }
        if (list.length < ch.strings.length) html += '<tr class="hw-more"><td colspan="2">and ' + (ch.strings.length - list.length) + ' more</td></tr>';
        html += '</tbody>';
      } else if (S.mode === 'kl') {
        head = 'Verma modules in $\\operatorname{ch}L(\\Lambda)$';
        html = '<thead><tr><th class="num">Sign</th><th>Module</th></tr></thead><tbody>' + termRows(S.terms, (t) => atex(t.apex[0], t.apex[1], S.k)) + '</tbody>';
      }
    } else if (state.view === 'tensor') {
      const T = tensorOf();
      head = 'Summands';
      html = '<thead><tr><th>Summand</th><th class="num">Multiplicity</th><th class="num">Dimension</th></tr></thead><tbody>';
      const cap = 12, list = T.parts.length > cap ? T.parts.slice(0, cap - 1) : T.parts;
      for (const p of list) {
        const k = K(p.kappa);
        html += '<tr' + (state.sel === k ? ' class="is-on"' : '') + '><td><button type="button" class="hw-pick" data-key="' + k + '">$V(' + wtex(p.kappa) + ')$</button></td><td class="num">' + p.n + '</td><td class="num">' + p.dim + '</td></tr>';
      }
      if (list.length < T.parts.length) html += '<tr class="hw-more"><td colspan="3">and ' + (T.parts.length - list.length) + ' more</td></tr>';
      html += '</tbody>';
    } else {
      const S = state.view === 'weights' ? finiteScene() : null;
      if (!S || S.kind === 'fd') {
        const A = alg(), ch = HW.character(A, S ? S.lam : lam()), rows = ch.dominant, cap = 10;
        const list = rows.length > cap ? rows.slice(0, cap - 1) : rows, on = state.sel && ch.byKey.get(state.sel);
        head = 'Dominant weights';
        html = '<thead><tr><th>Weight</th><th class="num">Orbit size</th><th class="num">Multiplicity</th></tr></thead><tbody>';
        for (const D of list) {
          const k = K(D.mu);
          html += '<tr' + (on && K(on.dom) === k ? ' class="is-on"' : '') + '><td><button type="button" class="hw-pick" data-key="' + k + '">$' + wtex(D.mu) + '$</button></td><td class="num">' + D.orbit.length + '</td><td class="num">' + D.mult + '</td></tr>';
        }
        if (list.length < rows.length) html += '<tr class="hw-more"><td colspan="3">and ' + (rows.length - list.length) + ' more</td></tr>';
        html += '</tbody>';
      } else if (S.kind === 'simple' && S.terms.length > 1) {
        head = 'Verma modules in $\\operatorname{ch}L(\\lambda)$';
        html = '<thead><tr><th class="num">Sign</th><th>Module</th></tr></thead><tbody>' + termRows(S.terms, (t) => wtex(t.apex)) + '</tbody>';
      }
    }
    const sec = el.closest('.side-block');
    sec.hidden = !html;
    MM.setHTML($('table-h'), head);
    MM.setHTML(el, html);
  }

  function tableauHtml(rows) {
    const len = rows[0].length;
    return '<table class="hw-yt" aria-hidden="true">' + rows.map((r) => '<tr>' + Array.from({ length: len }, (_, i) => (i < r.length ? '<td>' + r[i] + '</td>' : '<td class="empty"></td>')).join('') + '</tr>').join('') + '</table>';
  }

  function selectedText() {
    const v = state.view, key = state.hover || state.sel;
    if (isAffine()) {
      MM.setHTML($('sel-h'), 'Selected weight');
      const S = affScene();
      const p = key && S.points.find((q) => q.key === key);
      if (!p) return '<p class="hint">' + (S.points.length ? 'Point at a weight, or tap it' + (S.mode === 'int' ? ', or pick a maximal dominant weight in the table' : '') + '.' : 'Nothing is drawn for this highest weight.') + '</p>';
      const A = aff(), g = A.g, c = g.toSimple(sub(S.lam, p.mu)), roots = [p.n].concat(c.map((x, i) => p.n * A.marks[i + 1] + x));
      let html = '<p class="hw-sel-name">$\\mu=' + atex(p.mu, p.n, S.k) + '$</p><p>Multiplicity $' + p.mult + '$; $\\Lambda-\\mu=' + comb(roots, '\\alpha', 0) + '$.';
      if (S.mode === 'int') {
        const wt = S.ch.byKey.get(p.key), isDom = K(wt.dom.mu) === K(wt.mu) && wt.dom.n === wt.n;
        html += ' ' + (isDom ? 'Dominant.' : 'In the orbit of the dominant weight $' + atex(wt.dom.mu, wt.dom.n, S.k) + '$.') + '</p>';
        const down = [];
        for (let n = p.n; n <= S.N; n++) { const x = S.ch.byKey.get(K(p.mu) + '|' + n); down.push(x ? x.mult : 0); }
        let up = 0;
        while (S.ch.byKey.has(K(p.mu) + '|' + (p.n - up - 1))) up++;
        html += '<p>' + (up ? 'It is $' + up + '$ step' + (up > 1 ? 's' : '') + ' down its string. ' : 'It is maximal: $\\mu+\\delta$ is not a weight. ') + 'The multiplicities of $\\mu,\\mu-\\delta,\\dots$ shown: $' + down.join(', ') + '$.</p>';
      } else html += '</p>';
      return html;
    }
    const A = alg();
    MM.setHTML($('sel-h'), v === 'tensor' ? 'Selected point' : 'Selected weight');
    if (v === 'weights' || v === 'relief') {
      const S = v === 'weights' ? finiteScene() : null;
      if (S && S.kind !== 'fd') {
        const p = key && S.points.find((q) => q.key === key);
        if (!p) return '<p class="hint">Point at a weight, or tap it.</p>';
        const Pm = HW.partitions(A, S.D)(p.c);
        return '<p class="hw-sel-name">$\\mu=\\lambda' + (p.depth ? '-(' + rtex(p.c) + ')' : '') + '$</p><p>Multiplicity $' + p.mult + '$' + (S.kind === 'verma' ? ': the $' + Pm + '$ way' + (Pm > 1 ? 's' : '') + ' of writing $' + rtex(p.c) + '$ as a sum of positive roots.' : S.terms.length > 1 ? ', where $M(\\lambda)$ has $' + Pm + '$.' : '.') + '</p>';
      }
      const L = S ? S.lam : lam(), ch = HW.character(A, L), wt = key && ch.byKey.get(key);
      if (!wt) return '<p class="hint">Point at a weight, or tap it, or pick a dominant weight in the table.</p>';
      const c = A.toSimple(sub(L, wt.mu)).map(Math.round);
      const D = ch.dominant.find((d) => K(d.mu) === K(wt.dom));
      let html = '<p class="hw-sel-name">$\\mu=' + wtex(wt.mu) + '$</p><p>Multiplicity $' + wt.mult + '$; $\\lambda-\\mu=' + rtex(c) + '$. '
        + (K(wt.dom) === wt.key ? 'Dominant; its orbit has $' + D.orbit.length + '$ weight' + (D.orbit.length > 1 ? 's' : '') + '.' : 'In the orbit of the dominant weight $' + wtex(wt.dom) + '$, of $' + D.orbit.length + '$ weights.') + '</p>';
      if (state.type[0] === 'A') {
        const shape = L.map((_, i) => L.slice(i).reduce((s, x) => s + x, 0)).filter((x) => x), boxes = shape.reduce((s, x) => s + x, 0);
        const T = HW.tableaux(L, wt.mu, 9), sh = '(' + shape.join(',') + ')';
        if (boxes && boxes <= 12 && T.length <= 8) html += '<p>A basis of the weight space is indexed by the semistandard tableaux of shape $' + sh + '$ and weight $\\mu$:</p><div class="hw-tabs">' + T.map(tableauHtml).join('') + '</div>';
        else if (boxes) html += '<p>Its multiplicity is the number of semistandard tableaux of shape $' + sh + '$ and weight $\\mu$.</p>';
      }
      return html;
    }
    // tensor
    if (!key) return '<p class="hint">Point at a point, or tap it, or pick a summand in the table.</p>';
    const T = tensorOf(), x = key.split(',').map(Number), part = T.byKappa.get(key);
    const here = T.moves.filter((m) => K(m.at) === key), into = T.moves.filter((m) => m.to && m.steps.length && K(m.to) === key);
    let html = '<p class="hw-sel-name">$' + wtex(x) + '$</p>';
    for (const m of here) {
      const at = '$\\lambda+' + (m.from.some((c) => c) ? '(' + wtex(m.from) + ')' : '0') + '$';
      if (!m.to) html += '<p>' + at + ', with $m_\\nu=' + m.mult + '$, lies on a mirror through $-\\rho$: it adds nothing.</p>';
      else if (!m.steps.length) html += '<p>' + at + ', with $m_\\nu=' + m.mult + '$, is dominant: $+' + m.mult + '$.</p>';
      else {
        const word = m.steps.slice().reverse().map((i) => 's_' + (i + 1)).join('');
        html += '<p>' + at + ', with $m_\\nu=' + m.mult + '$, is not dominant: $' + word + '\\cdot{}$ takes it to $' + wtex(m.to) + '$, ' + (m.sign < 0 ? 'with sign $-$: $-' : 'with sign $+$: $+') + m.mult + '$ there.</p>';
      }
    }
    for (const m of into) html += '<p>From $\\lambda+(' + wtex(m.from) + ')$: $' + (m.sign < 0 ? '-' : '+') + m.mult + '$.</p>';
    html += part ? '<p>In all, $V(' + wtex(x) + ')$ appears $' + part.n + '$ time' + (part.n > 1 ? 's' : '') + '.</p>' : (here.length || into.length ? '<p>In all, nothing: $V(' + wtex(x) + ')$ is not a summand.</p>' : '');
    return html;
  }

  // the same type in the other pages of it
  function seeAlso() {
    const t = state.type, box = $('see-also');
    const dynkin = isAffine() ? MM.example.codecs.cartan.write(aff().cartan) : linkId(t);
    const html = 'The same type in <a href="/dynkin-diagrams/?t=' + dynkin + '">Dynkin diagrams</a>'
      + (t !== 'A1' ? ' and <a href="/root-systems/?t=' + linkId(t) + '">Root systems</a>' : '') + '.'; // (Root systems starts at rank two)
    box.hidden = false;
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  /* ---------- the lists of algebras, under the picture ---------- */

  // an algebra's Dynkin diagram, small (MM.dynkinPicture): its nodes as LAYOUT places them,
  // its bonds from its Cartan matrix, with an arrow to the shorter root
  function miniDiagram(t) {
    const A = INFO[t].fam === 'affine' ? HW.affine(t).cartan : HW.algebra(t).cartan, bonds = [];
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = -A[i][j], b = -A[j][i];
      if (a) bonds.push({ i, j, lines: Math.max(a, b), arrow: a === b ? (a === 2 ? 3 : 0) : a < b ? 2 : 1 });
    }
    return { pos: LAYOUT[t], bonds, nodes: A.map(() => 'o') };
  }
  const minis = new Map(); // type → its button
  let strip = null;        // the lists (MM.strip)
  // the entries are in the page, each with its name (index.html): their diagrams are drawn here
  function buildLists() {
    const box = $('strip');
    for (const b of box.querySelectorAll('.strip-item')) {
      const t = TYPE[b.dataset.key];
      MM.dynkinPicture(b.querySelector('svg'), miniDiagram(t), { unit: 22 });
      minis.set(t, b);
    }
    strip = MM.strip(box, {
      control: $('family'),
      pick(b) {
        const t = TYPE[b.dataset.key];
        if (t && t !== state.type) { unzoom(); setType(t); }
      },
    });
  }
  // the entry of the algebra shown, lit, and its list shown
  function light(t) { strip.light(minis.get(t)); }

  /* ---------- the controls in the bar ---------- */

  const viewSeg = $('view'), moduleSeg = $('module'), anyToggle = $('any'), levelSlider = $('level');
  function syncControls() {
    const avail = VIEWS[kind()];
    for (const b of viewSeg.querySelectorAll('button')) {
      b.disabled = !avail.includes(b.value);
      if (b.disabled) b.title = b.value === 'relief' ? 'For rank two' : 'For finite types'; else b.removeAttribute('title');
    }
    if (viewSeg.value !== state.view) viewSeg.value = state.view;
    $('module-control').hidden = state.view !== 'weights';
    if (moduleSeg.value !== state.module) moduleSeg.value = state.module;
    anyToggle.hidden = !isAffine() && (alg().rank > 2 || state.view !== 'weights');
    if (anyToggle.pressed !== state.any) anyToggle.pressed = state.any;
    levelSlider.hidden = !isAffine();
    if (isAffine()) {
      const [lo, hi] = levels();
      levelSlider.setAttribute('min', lo);
      levelSlider.setAttribute('max', hi);
      levelSlider.setAttribute('step', state.any ? 'any' : '1');
      // (the slider and node 0 of the Dynkin diagram, λ_0 = k − Σ a_i^∨ λ_i, change together: setNumbers, setLevel)
      if (Math.abs(levelSlider.value - affSt().k) > 1e-9) levelSlider.setAttribute('value', affSt().k);
      showLevel(affSt().k);
    }
  }

  // a new λ or ν, kept within what the algebra allows
  function setWeight(which, x) {
    if (which === 'lam' && anyMode()) {
      const cur = wlam();
      x = x.map((c) => clamp(Math.round(c * 1e9) / 1e9, -ANYCAP, ANYCAP));
      if (x.every((c, i) => Math.abs(c - cur[i]) < 1e-12)) return false;
      state.anys[state.type] = x;
      return true;
    }
    const cur = which === 'lam' ? lam() : nu(), cap = info().cap;
    x = x.map((c) => clamp(Math.round(c), 0, cap));
    if (x.every((c, i) => c === cur[i])) return false;
    (which === 'lam' ? state.lams : state.nus)[state.type] = x;
    return true;
  }
  // the finite part of an affine highest weight
  function setAffine(lb) {
    const st = affSt();
    lb = lb.map((c) => clamp(Math.round(c * 1e9) / 1e9, -ANYCAP, ANYCAP));
    // Λ dominant integral: whole labels, the finite part within the level
    if (!state.any && !(lb.every((c) => Number.isInteger(c) && c >= 0) && lb.reduce((t, c, i) => t + aff().comarks[i + 1] * c, 0) <= st.k + 1e-9)) return false;
    if (lb.every((c, i) => Math.abs(c - st.lam[i]) < 1e-12)) return false;
    st.lam = lb;
    return true;
  }

  function setType(t) {
    state.type = t;
    state.view = VIEWS[INFO[t].kind].includes(state.want) ? state.want : 'weights';
    state.sel = state.hover = null;
    editing = null;
    light(t);
    syncControls();
    update(true);
  }
  viewSeg.addEventListener('change', (e) => {
    state.want = state.view = e.detail.value;
    unzoom();
    state.sel = state.hover = null;
    syncControls();
    update();
  });
  moduleSeg.addEventListener('change', (e) => {
    state.module = e.detail.value;
    state.sel = state.hover = null;
    update();
  });
  anyToggle.addEventListener('change', (e) => {
    state.any = e.detail.pressed;
    // start from the dominant integral λ, or Λ
    if (state.any && isAffine()) { const st = state.affs[state.type]; state.affAnys[state.type] = { k: st.k, lam: st.lam.slice() }; }
    else if (state.any) state.anys[state.type] = lam().slice();
    state.sel = state.hover = null;
    syncControls();
    update();
  });
  // The level snaps to the integers. While the slider is dragged its thumb
  // follows the pointer, the picture follows at most once a frame, and the
  // window stays put; on release the thumb settles on the level shown and the
  // window fits the picture again.
  const snapLevel = (k) => (!state.any ? Math.round(k) : Math.abs(k - Math.round(k)) < 0.12 ? Math.round(k) : Math.round(k * 100) / 100);
  // the levels allowed: from 0 up, whole, unless Λ may be any weight
  const levels = () => (state.any ? info().levels : [0, info().levels[1]]);
  // the finite parts of Λ dominant integral of level k: whole numbers ≥ 0 with Σ a_i^∨ λ_i ≤ k
  function integralParts(k) {
    const c = aff().comarks.slice(1), out = [];
    (function grow(pre, room) {
      if (pre.length === c.length) { out.push(pre); return; }
      for (let a = 0; a * c[pre.length] <= room + 1e-9; a++) grow(pre.concat(a), room - a * c[pre.length]);
    })([], Math.round(k));
    return out;
  }
  // of those, the one nearest the finite weight lb
  function nearestPart(lb, k) {
    const g = aff().g, p = g.pos(lb);
    let best = null, bd = Infinity;
    for (const q of integralParts(k)) { const d = Math.hypot(...g.pos(q).map((x, i) => x - p[i])); if (d < bd - 1e-12) { bd = d; best = q; } }
    return best;
  }
  // the level as its box shows it (a fraction such as −4/3 as such), and as it is read out
  function showLevel(k) { if (levelSlider.show) levelSlider.show(MM.formatNumber(k)); }
  // exact: a level typed in the box, taken as it is
  function setLevel(k, settle, exact) {
    const [lo, hi] = levels(), st = affSt(), kk = clamp(exact && state.any ? k : snapLevel(k), lo, hi);
    if (settle && Math.abs(levelSlider.value - kk) > 1e-9) levelSlider.value = kk;
    showLevel(kk);
    if (Math.abs(st.k - kk) > 1e-12) {
      st.k = kk;
      // Λ dominant integral: at a lower level its finite part may have to come down
      if (!state.any) st.lam = nearestPart(st.lam, kk);
      state.sel = state.hover = null;
    }
    if (settle) update(); else { chrome(); draw(); }
  }
  let levelPending = null, levelFrame = 0;
  levelSlider.addEventListener('input', () => {
    levelPending = +levelSlider.value;
    showLevel(clamp(snapLevel(levelPending), ...levels()));
    if (!levelFrame) levelFrame = requestAnimationFrame(() => { levelFrame = 0; if (levelPending !== null) { const k = levelPending; levelPending = null; setLevel(k, false); } });
  });
  levelSlider.addEventListener('change', (e) => {
    levelPending = null;
    if (e.detail && e.detail.exact) setLevel(e.detail.value, true, true);
    else setLevel(+levelSlider.value, true);
  });
  // the arrow keys step through the integers
  levelSlider.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const k = affSt().k;
    setLevel(isInt(k) ? Math.round(k) + d : d > 0 ? Math.ceil(k) : Math.floor(k), true);
  });
  $('table').addEventListener('click', (e) => {
    const b = e.target.closest('.hw-pick');
    if (!b) return;
    state.sel = state.sel === b.dataset.key ? null : b.dataset.key;
    chrome();
    draw();
  });

  /* ---------- draw: everything from the state ---------- */

  function putHandle(el, p) {
    el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)';
  }

  function draw() {
    const w = canvas.clientWidth;
    if (!w) return;
    zoomShown();
    const k = kind(), v = state.view;
    // only the module in view is built
    const cur = isAffine() ? affScene() : null;
    if (building && building !== cur) building = null;
    if (cur && cur.job && !cur.job.done) build(cur);
    handles.nu.hidden = v !== 'tensor';
    handles.lam.classList.toggle('is-hoop', v === 'tensor');
    if (k === 'aff-line') paintAffLine(view2d());
    else if (k === 'aff-space') paintAffSpace(view3d());
    else if (v === 'relief') paintRelief();
    else {
      const V = k === 'space' ? view3d() : view2d();
      if (v === 'tensor') paintTensor(V); else paintWeights(V);
    }
    MM.setHTML($('sel'), selectedText());
    if (example) example.changed();
  }

  // can the key still be selected?
  function selectable(key) {
    if (isAffine()) return affScene().points.some((p) => p.key === key);
    if (state.view === 'tensor') { const T = tensorOf(); return T.byKappa.has(key) || T.moves.some((m) => K(m.at) === key); }
    if (state.view === 'weights') { const S = finiteScene(); if (S.kind !== 'fd') return S.points.some((p) => p.key === key); }
    return HW.character(alg(), state.view === 'weights' ? finiteScene().lam : lam()).byKey.has(key);
  }

  // a new algebra, view or weight: what the pointer does not change
  function update(now) {
    if (state.sel && !selectable(state.sel)) state.sel = null;
    if (state.hover && !selectable(state.hover)) state.hover = null;
    const k = kind();
    plane.classList.toggle('is-line', k === 'line');
    drag.update();
    canvas.classList.toggle('pannable', pans());
    if (turns() || pans()) canvas.tabIndex = 0; else canvas.removeAttribute('tabindex');
    chrome();
    retarget(now);
  }

  function resize() {
    MM.fitCanvas(canvas);
    draw();
  }

  /* ---------- the handles: λ, and λ + ν in the tensor product ---------- */

  // the dominant integral weight nearest to a point of the model (rank one or two)
  function nearestDominant(p) {
    const A = alg(), f = A.fromPos(p);
    if (A.rank === 1) return [Math.max(0, Math.round(f[0]))];
    let best = null, bd = Infinity;
    for (const a of [Math.floor(f[0]), Math.ceil(f[0])]) for (const b of [Math.floor(f[1]), Math.ceil(f[1])]) {
      const x = [Math.max(0, a), Math.max(0, b)], q = P(x), d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; best = x; }
    }
    return best;
  }
  // Any weight: the point of the model p, snapped to an integral weight or to a
  // point where two of the lines <λ+ρ, α^∨> = n (n a positive integer) meet, if
  // one is within a tenth of a short root (at most 10 pixels), or else onto one of
  // those lines within 0.035 of one (at most 4 pixels, and not when that is under
  // one). The lines are dense, in g2 most of all; at these distances, at any zoom,
  // about half of the plane is still free.
  function snapAny(p, s) {
    const A = alg(), f = A.fromPos(p), rho = A.rho, root = s * SHORT;
    const px = (x) => { const q = P(x); return Math.hypot(q[0] - p[0], (q[1] || 0) - (p[1] || 0)) * s; };
    let best = null, bd = Math.min(10, 0.1 * root);
    const consider = (x) => { const d = px(x); if (d < bd) { bd = d; best = x; } };
    // the integral weights round p
    const fl = f.map(Math.floor);
    for (let m = 0; m < 1 << f.length; m++) consider(fl.map((x, i) => x + ((m >> i) & 1)));
    if (A.rank === 2) {
      const val = (x, b) => A.coroot(add(x, rho), b), cv = (b) => [0, 1].map((i) => A.coroot(basisVec(2, i), b));
      const roots = A.positive;
      for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) {
        const a = roots[i], b = roots[j], ca = cv(a), cb = cv(b), det = ca[0] * cb[1] - ca[1] * cb[0];
        for (const na of [Math.floor(val(f, a)), Math.ceil(val(f, a))]) for (const nb of [Math.floor(val(f, b)), Math.ceil(val(f, b))]) {
          if (na < 1 || nb < 1) continue;
          // <x + ρ, a^∨> = na, <x + ρ, b^∨> = nb
          const y = [(na * cb[1] - nb * ca[1]) / det, (ca[0] * nb - cb[0] * na) / det];
          consider(sub(y, rho));
        }
      }
      if (!best && 0.035 * root >= 1) {
        let ld = Math.min(4, 0.035 * root);
        for (const a of roots) {
          const v = val(f, a), n = Math.round(v);
          if (n < 1) continue;
          const x = add(f, scale((n - v) / 2, a.labels)), d = px(x);
          if (d < ld) { ld = d; best = x; }
        }
      }
    }
    return best ? best.map((x) => Math.round(x * 1e9) / 1e9) : f;
  }
  // rank three: the weights a handle can step to, λ ± ϖ_i (or ν ± ϖ_i), dominant and within the cap
  function neighbours(which) {
    const base = which === 'nu' ? nu() : lam(), cap = info().cap, out = [];
    for (let i = 0; i < base.length; i++) for (const sgn of [1, -1]) {
      const x = base.slice();
      x[i] += sgn;
      if (x[i] >= 0 && x[i] <= cap) out.push({ x, i, sgn });
    }
    return out;
  }
  let dragging = null;
  function dragTo(which, e) {
    const r = canvas.getBoundingClientRect(), x = clamp(e.clientX - r.left, 6, r.width - 6), y = clamp(e.clientY - r.top, 6, r.height - 6);
    const k = kind();
    if (k === 'aff-line' || k === 'aff-space') {
      // the finite part of Λ, anywhere; it snaps to the integral weights (without Any weight, it
      // goes to the nearest of those that make Λ dominant integral of its level)
      const g = aff().g;
      let lb;
      if (!state.any) {
        const V = k === 'aff-line' ? view2d() : view3d(), S = affScene();
        let bd = Infinity;
        for (const q of integralParts(affSt().k)) { const s2 = V.at(S.model(q, 0)), d = Math.hypot(s2[0] - x, s2[1] - y); if (d < bd) { bd = d; lb = q; } }
      } else if (k === 'aff-line') {
        const V = view2d(), m = g.fromPos([V.back(x, y)[0]])[0], mr = Math.round(m);
        lb = [Math.abs(V.at([g.pos([mr])[0], 0])[0] - x) < 10 ? mr : m];
      } else {
        const V = view3d(), p = V.onLevel(x, y, 0), f = g.fromPos([p[0], p[1]]), fr = f.map(Math.round), q = V.at(affScene().model(fr, 0));
        lb = Math.hypot(q[0] - x, q[1] - y) < 12 ? fr : f;
      }
      if (setAffine(lb)) { state.sel = state.hover = null; chrome(); draw(); }
      return;
    }
    let next;
    if (k === 'space') {
      // One step at a time, along the dashed line the pointer follows: the one
      // whose segment it is nearest to, once it is more than halfway along it.
      // (Then it is less than halfway back, so the handle does not step back.)
      const V = view3d(), off = which === 'nu' ? P(lam()) : [0, 0, 0], at = (w) => V.at(add(P(w), off));
      let moved = false;
      for (let steps = 0; steps < 4; steps++) {
        const c0 = at(which === 'nu' ? nu() : lam()), dx = x - c0[0], dy = y - c0[1];
        let best = null, be = Infinity, bt = 0;
        for (const n of neighbours(which)) {
          const q = at(n.x), vx = q[0] - c0[0], vy = q[1] - c0[1], vv = vx * vx + vy * vy;
          if (vv < 36) continue;   // seen end on: there is no line to follow
          const t = (dx * vx + dy * vy) / vv, tc = clamp(t, 0, 1), e = Math.hypot(dx - tc * vx, dy - tc * vy);
          if (e < be) { be = e; best = n; bt = t; }
        }
        if (!best || bt < 0.6 || !setWeight(which, best.x)) break;
        moved = true;
      }
      if (moved) { state.sel = state.hover = null; chrome(); draw(); }
      return;
    } else {
      let p;
      if (state.view === 'relief') { const V = reliefView(); p = V.unproj(x, y, V.zOf(1)); }
      else p = view2d().back(x, y);
      if (k === 'line') p = [p[0]];
      if (which === 'nu') p = sub(p, P(lam()));
      next = which === 'lam' && anyMode() ? snapAny(p, view2d().s) : nearestDominant(p);
    }
    if (setWeight(which, next)) { state.sel = state.hover = null; chrome(); draw(); }
  }
  for (const which of ['lam', 'nu']) {
    const el = handles[which];
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); dragging = which; e.preventDefault(); draw(); });
    el.addEventListener('pointermove', (e) => { if (dragging === which) dragTo(which, e); });
    const end = () => { if (dragging === which) { dragging = null; retarget(); } };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, end));
    // the hints of where it can go show while it has the keyboard's focus, too
    el.addEventListener('focus', () => draw());
    el.addEventListener('blur', () => draw());
    el.addEventListener('keydown', (e) => {
      const k = kind(), d = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowUp: [1, 1], ArrowDown: [1, -1], PageUp: [2, 1], PageDown: [2, -1] }[e.key];
      if (k === 'aff-line' || k === 'aff-space') {
        const lb = affSt().lam.slice();
        if (e.key === 'Home') lb.fill(0);
        else if (d && d[0] < lb.length) lb[d[0]] = Math.round(lb[d[0]]) + d[1];
        else if (!d) return;
        e.preventDefault();
        if (setAffine(lb)) update();
        return;
      }
      let x = (which === 'nu' ? nu() : wlam()).slice();
      if (e.key === 'Home') x = x.map(() => 0);
      else if (d) { const i = x.length === 1 ? 0 : d[0]; if (i >= x.length) return; x[i] += d[1]; }
      else return;
      e.preventDefault();
      if (setWeight(which, x)) update();
    });
  }

  /* ---------- pointing at the canvas; dragging turns a picture in space ---------- */

  function hit(e) {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (state.view === 'relief' && reliefCache && !isAffine()) {
      for (let i = reliefCache.faces.length - 1; i >= 0; i--) if (inPoly(x, y, reliefCache.faces[i][1])) return reliefCache.faces[i][0];
      return null;
    }
    // the nearest dot under the pointer; in space, the one nearest the eye
    let best = null, bd = Infinity, bz = -Infinity;
    for (const p of shown) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > Math.max(p.r + 5, 11)) continue;
      const z = p.near || 0;
      if (z > bz + 1e-9 || (Math.abs(z - bz) < 1e-9 && d < bd)) { bd = d; bz = z; best = p.key; }
    }
    return best;
  }
  function hover(k) {
    if (k === state.hover) return;
    state.hover = k;
    canvas.classList.toggle('is-over', !!k);
    draw();
  }
  // the turn and tilt of the picture being turned
  // The pictures in the plane and on the line move under a drag with a mouse or pen
  // (on a touch screen the page scrolls instead), and under the arrow keys.
  const pans = () => !turns() && (kind() === 'line' || kind() === 'plane');
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  let panning = null;
  function panBy(dx, dy) {
    const f = state.frame;
    if (!f) return;
    const s = view2d().s;
    anim = null;
    state.frame = { c: [f.c[0] - dx / s, kind() === 'line' ? f.c[1] : f.c[1] + dy / s], R: f.R };
    state.panned = true;
    draw();
  }
  // (two fingers move any picture but the relief: one in space across the screen)
  function panAny(dx, dy) {
    const f = state.frame;
    if (!f || (state.view === 'relief' && !isAffine())) return;
    if (f.c.length === 2) { panBy(dx, dy); return; }
    const V = view3d();
    anim = null;
    state.frame = { c: V.back(V.w / 2 - dx, V.h / 2 - dy, 0), R: f.R };
    state.panned = true;
    draw();
  }
  // The zoom (<mm-zoom> in the bar, a pinch, + and −): about the point (x, y) of the canvas,
  // which stays where it is; the relief about its middle.
  const zoomEl = $('zoom');
  // the magnification drawn: the scale over SMIN
  const reliefShown = () => state.view === 'relief' && !isAffine();
  const zoomNow = () => (reliefShown() ? reliefView().s : halfOf() / (state.frame || zoomed(target())).R) / SMIN;
  function zoomAt(f, x, y) {
    const now = zoomNow(), z = clamp(now * f, 1, MAG), r = now / z, fr = state.frame;
    if (Math.abs(r - 1) < 1e-9) return;
    state.zoom = z;
    if (fr && !reliefShown()) {
      const p = fr.c.length === 3 ? view3d().back(x, y, 0) : view2d().back(x, y);
      if (kind() === 'line') p[1] = fr.c[1];
      anim = null;
      state.frame = { c: fr.c.map((v, i) => p[i] + (v - p[i]) * r), R: fr.R * r };
      state.panned = true;
    }
    draw();
  }
  function zoomShown() { const z = zoomNow(); if (Math.abs(zoomEl.value - z) > 1e-6) zoomEl.value = z; }
  const middle = () => [canvas.clientWidth / 2, canvas.clientHeight / 2];
  zoomEl.addEventListener('input', () => zoomAt(zoomEl.value / zoomNow(), ...middle()));
  zoomEl.addEventListener('change', () => { if (example) example.changed(); });
  MM.pinchZoom(canvas, { zoom: zoomAt, pan: panAny, end: () => { if (example) example.changed(); } });
  function unzoom() { state.zoom = null; }
  canvas.addEventListener('pointerdown', (e) => {
    if (pans() && e.pointerType !== 'touch') panning = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!panning || e.pointerId !== panning.id || !e.buttons) return;
    const dx = e.clientX - panning.x, dy = e.clientY - panning.y;
    if (!panning.moved && Math.hypot(dx, dy) < 4) return;
    if (!panning.moved) { panning.moved = true; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-panning'); }
    panning.x = e.clientX;
    panning.y = e.clientY;
    panBy(dx, dy);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => canvas.addEventListener(t, () => {
    canvas.classList.remove('is-panning');
    setTimeout(() => { panning = null; }, 0);
  }));
  const camera = () => (state.view === 'relief' && !isAffine() ? state : state.cam);
  const tilt = (el) => (kind() === 'space' ? clamp(el, -Math.PI / 2, Math.PI / 2) : clamp(el, 0.18, Math.PI / 2));
  // a picture in space turns under a drag (on a touch screen, one that starts sideways; one that
  // starts up or down scrolls the page, MM.turnDrag); turning: the camera's angles when it began,
  // and how far it has gone
  let turning = null;
  const drag = MM.turnDrag(canvas, {
    when: () => turns(),
    start: () => { const c = camera(); turning = { az: c.az, el: c.el, dx: 0, dy: 0 }; },
    move: (dx, dy) => {
      // the near side of the picture follows the pointer
      const c = camera();
      turning.dx += dx;
      turning.dy += dy;
      c.az = turning.az + turning.dx * 0.008;
      c.el = tilt(turning.el + turning.dy * 0.006);
      draw();
    },
    // the arrow keys: as a drag that way would
    keys: { turn: (a, b) => { const c = camera(); c.az += a; c.el = tilt(c.el + b); draw(); } },
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' && !drag.active && !(panning && panning.moved)) hover(hit(e));
  });
  canvas.addEventListener('pointerleave', () => hover(null));
  canvas.addEventListener('click', (e) => {
    if (drag.moved || (panning && panning.moved)) return;
    const k = hit(e);
    state.sel = k && k !== state.sel ? k : null;
    state.hover = null;
    chrome();
    draw();
  });
  canvas.addEventListener('keydown', (e) => {
    if ((e.key === '+' || e.key === '=' || e.key === '-') && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      zoomAt(e.key === '-' ? 1 / 1.25 : 1.25, ...middle());
      if (example) example.changed();
      return;
    }
    if (pans()) {
      // as a drag in the direction of the arrow would (in space, MM.turnDrag turns it)
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || (kind() === 'line' && d[1])) return;
      e.preventDefault();
      panBy(40 * d[0], 40 * d[1]);
    }
  });

  new ResizeObserver(resize).observe(canvas);
  new ResizeObserver(() => drawShells()).observe($('shells-fig'));
  // canvas text uses whatever font is loaded, and the numbers on the Dynkin diagrams are measured: again once the fonts are there
  MM.onFonts(() => { for (const w in editors) editors[w].shown = []; if (shellEd) shellEd.shown = []; chrome(); draw(); drawShells(); });
  buildLists();
  light(state.type);
  syncControls();
  update(true);

  /* ---------- links, reset and Save image ---------- */

  const within = (v, lo, hi) => v.every((x) => x >= lo - 1e-9 && x <= hi + 1e-9);
  example = MM.example({
    fields: { t: 'text', s: 'text', m: 'text', a: 'flag', l: 'numbers', n: 'numbers', k: 'number', c: 'numbers', r: 'numbers', w: 'numbers', z: 'number' },
    view: ['c', 'r', 'w', 'z'],
    get: () => ({
      t: linkId(state.type), s: state.view, m: state.module, a: state.any,
      l: isAffine() ? affSt().lam : wlam(), n: state.view === 'tensor' ? nu() : [], k: isAffine() ? affSt().k : 1,
      c: [state.cam.az, state.cam.el], r: [state.az, state.el], w: state.panned && state.frame ? state.frame.c.concat([state.frame.R]) : [], z: state.zoom || 0,
    }),
    // what a link does not name of the weights, the level and the window is the algebra's own
    set(x, named) {
      const type = TYPE[x.t], I = type && INFO[type];
      if (!I || !VIEWS[I.kind].includes(x.s) || (x.m !== 'simple' && x.m !== 'verma')) return false;
      const affine = I.fam === 'affine', rank = (affine ? HW.affine(type).g : HW.algebra(type)).rank, dim = I.kind === 'space' || I.kind === 'aff-space' ? 3 : 2;
      if (!named.has('l')) x.l = affine ? zeros(rank) : I.lam.slice();
      if (!named.has('n')) x.n = [];
      if (!named.has('k')) x.k = 1;
      if (!named.has('w')) x.w = [];
      if (!named.has('z')) x.z = 0;
      // an affine Λ dominant integral: a level 0, 1, 2, … and whole labels ≥ 0 (λ_0 too)
      const intAff = affine && Number.isInteger(x.k) && x.k >= 0 && x.k <= I.levels[1] && x.l.every((c) => Number.isInteger(c) && c >= 0)
        && x.l.reduce((t, c, i) => t + HW.affine(type).comarks[i + 1] * c, 0) <= x.k;
      // any weight where the link says so; for an affine algebra also where it names a Λ that is
      // not dominant integral without saying (as links did before there was the choice)
      const any = affine ? x.a || (!named.has('a') && !intAff) : x.a && rank <= 2 && x.s === 'weights';
      const ok = x.l.length === rank && (affine ? (any ? within(x.l, -ANYCAP, ANYCAP) && within([x.k], ...I.levels) : intAff) : any ? within(x.l, -ANYCAP, ANYCAP) : within(x.l, 0, I.cap) && x.l.every(Number.isInteger))
        && (!x.n.length || (x.n.length === rank && within(x.n, 0, I.cap) && x.n.every(Number.isInteger)))
        && x.c.length === 2 && x.r.length === 2 && (!x.w.length || (x.w.length === dim + 1 && x.w[dim] > 0)) && (x.z === 0 || (x.z >= 1 && x.z <= MAG));
      if (!ok) return false;
      anim = null;
      building = null;
      state.want = x.s;
      state.module = x.m;
      state.any = affine ? any : x.a;
      anyToggle.pressed = state.any;
      if (affine) state[any ? 'affAnys' : 'affs'][type] = { k: x.k, lam: x.l.slice() };
      else {
        if (any) state.anys[type] = x.l.slice(); else state.lams[type] = x.l.slice();
        state.nus[type] = x.n.length ? x.n.slice() : I.nu.slice();
      }
      state.cam = { az: x.c[0], el: x.c[1] };
      [state.az, state.el] = x.r;
      state.shell = SHELL0.slice(); // (the figure in the text: its own case, back to its first)
      drawShells();
      state.zoom = x.z || null;
      setType(type);
      if (x.w.length) { state.frame = { c: x.w.slice(0, dim), R: x.w[dim] }; state.panned = true; draw(); }
    },
    // the picture, the Dynkin diagrams with the highest weights on them, and the figure in the text
    pictures: () => [{ label: 'Weights', element: plane }].concat(whiches().filter((w) => editors[w]).map((w) => ({
      label: whiches().length > 1 ? 'Dynkin diagram, ' + (w === 'nu' ? 'ν' : 'λ') : 'Dynkin diagram', element: editors[w].svg, selected: false,
    }))).concat(state.type === 'A2' ? [{ label: 'Hexagons and triangles', element: $('shells'), selected: false }] : []),
    // for Save image: the weight selected, and the case of the figure in the text
    scene: {
      get: () => ({ sel: state.sel, shell: state.shell }),
      set(s) {
        state.sel = s.sel;
        if (Array.isArray(s.shell) && s.shell.length === 2 && s.shell.every((x) => Number.isInteger(x) && x >= 0 && x <= SHELL_CAP)) state.shell = s.shell.slice();
        drawShells();
        draw();
      },
    },
    redraw: resize,
  });
})();
