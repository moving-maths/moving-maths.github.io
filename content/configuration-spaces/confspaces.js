// Configuration spaces of the line, the circle and surfaces: the mathematics, without the DOM.
// main.js draws; test/configuration-spaces.test.mjs checks it.
//
// For a surface, rational Betti numbers come from two Chevalley–Eilenberg complexes, built out
// of the compactly supported cohomology of the surface Σ with constant
// coefficients and with coefficients in its orientation sheaf w:
//
//   unordered (Knudsen, Thm 1.1):  ⊕_k H_*(UConf_k Σ; Q) ≅ H^Lie(H_c^{-*}(Σ; L(Q^w[1]))),
//     where L(Q^w[1]) is the free Lie algebra on one generator x of degree 1,
//     twisted by w: it is spanned by x and [x, x], the latter untwisted;
//   ordered (Petersen, §1.17):  H_*(Conf_k Σ; Q) is the part of the same with
//     k generators x_1, …, x_k that is linear in each x_i: the twisted Lie
//     algebra ⊕_B H_c^{-*}(Σ; w^{⊗|B|}) ⊗ Lie(B) over the blocks B ⊂ {1, …, k},
//     with the bracket that merges two blocks by the cup product.
//
// A class of cohomological degree i becomes homological degree −i; a Lie word
// in r letters, each of degree 1, has degree r. The test checks both complexes
// against an independent computation, from a simplicial model of the
// compactified product and its collisions, and Poincaré duality.
(function (root) {
  'use strict';

  /* ---------- the spaces: two curves and the surfaces ---------- */

  // The line and the circle (dim 1) are the interval [0, 1], open at both ends or with its
  // ends glued (x as for a surface; every point has y = ½). Their configuration spaces are
  // described directly (see ONE below), so they need no classes.
  // The sphere and the projective plane (ball) are the unit sphere in R³, the projective
  // plane's opposite points being the same point: a point of it is kept as either of its two
  // unit vectors, a line through 0.
  // Each other surface (dim 2) is the unit square [0, 1]² with edges glued:
  //   x: the left and right edges, 'straight' (0, y) ~ (1, y), 'flip' (0, y) ~ (1, 1 − y), or null (open)
  //   y: the bottom and top edges, 'straight' (x, 0) ~ (x, 1), 'flip' (x, 0) ~ (1 − x, 1), or null (open)
  // classes: a basis of H_c^*(Σ; Q) ⊕ H_c^*(Σ; Q^w), as [name, degree, twist]: twist 0 is
  //   constant coefficients, twist 1 the orientation sheaf; on an orientable surface
  //   the two are the same and every class has twist 0.
  // unit: the class 1 of a closed surface; products: the other nonzero cup
  //   products, [i, j, k, c] for e_i ∪ e_j = c e_k.
  // symbol: whether tex is the standard name of the space, to name it by in the controls (the
  //   Möbius band and the Klein bottle have none, so M and K are only for formulas).
  const SURFACES = {
    line: { name: 'line', symbol: true, tex: '\\RR', dim: 1, chi: 1, orientable: true, x: null, y: null, pi1: '1' },
    circle: { name: 'circle', symbol: true, tex: 'S^1', dim: 1, chi: 0, orientable: true, x: 'straight', y: null, pi1: '\\ZZ' },
    plane: {
      name: 'plane', symbol: true, tex: '\\RR^2', chi: 1, orientable: true, x: null, y: null, pi1: '1',
      classes: [['u', 2, 0]], products: [],
    },
    sphere: {
      name: 'sphere', symbol: true, tex: 'S^2', chi: 2, orientable: true, ball: true, x: null, y: null, pi1: '1',
      classes: [['1', 0, 0], ['\\omega', 2, 0]], unit: 0, products: [],
    },
    projective: {
      name: 'projective plane', symbol: true, tex: '\\RR P^2', chi: 1, orientable: false, ball: true, antipodal: true, x: null, y: null, pi1: '\\ZZ/2',
      classes: [['1', 0, 0], ['\\nu', 2, 1]], unit: 0, products: [],
    },
    cylinder: {
      name: 'cylinder', symbol: true, tex: 'S^1\\times\\RR', chi: 0, orientable: true, x: 'straight', y: null, pi1: '\\ZZ',
      classes: [['a', 1, 0], ['u', 2, 0]], products: [],
    },
    torus: {
      name: 'torus', symbol: true, tex: 'T^2', chi: 0, orientable: true, x: 'straight', y: 'straight', pi1: '\\ZZ^2',
      classes: [['1', 0, 0], ['\\alpha', 1, 0], ['\\beta', 1, 0], ['\\omega', 2, 0]], unit: 0,
      products: [[1, 2, 3, 1], [2, 1, 3, -1]],
    },
    mobius: {
      name: 'Möbius band', tex: 'M', chi: 0, orientable: false, x: 'flip', y: null, pi1: '\\ZZ',
      classes: [['b', 1, 1], ['\\nu', 2, 1]], products: [],
    },
    klein: {
      // H^1(K; Q) ⊗ H^1(K; Q^w) → H^2(K; Q^w) is Poincaré duality, so a ∪ b ≠ 0
      name: 'Klein bottle', tex: 'K', chi: 0, orientable: false, x: 'straight', y: 'flip', pi1: '\\ZZ\\rtimes\\ZZ',
      classes: [['1', 0, 0], ['a', 1, 0], ['b', 1, 1], ['\\nu', 2, 1]], unit: 0,
      products: [[1, 2, 3, 1], [2, 1, 3, -1]],
    },
  };
  // Conf_k(Σ) is aspherical unless Σ is S² or RP² (Fadell–Neuwirth)
  const NOT_ASPHERICAL = new Set(['projective', 'sphere']);

  const surface = (id) => {
    const s = SURFACES[id];
    if (!s) throw new Error('unknown surface ' + id);
    if (!s.mult) {
      s.mult = s.classes.map((_, i) => s.classes.map((__, j) => {
        if (s.unit === i) return [[j, 1]];
        if (s.unit === j) return [[i, 1]];
        return s.products.filter((p) => p[0] === i && p[1] === j).map((p) => [p[2], p[3]]);
      }));
    }
    return s;
  };
  const deg = (s, c) => s.classes[c][1];
  // the classes a block of r points carries: w^{⊗r} is w for r odd, constant for r even
  const classesFor = (s, r) => s.classes.map((_, c) => c).filter((c) => s.orientable || s.classes[c][2] === r % 2);

  /* ---------- linear algebra over a large prime ---------- */

  const PRIME = 67108859; // the largest prime below 2^26: a product of two residues is exact in a double
  const mod = (a) => { const r = a % PRIME; return r < 0 ? r + PRIME : r; };
  function inverse(a) {
    let r0 = PRIME, r1 = mod(a), s0 = 0, s1 = 1;
    while (r1) {
      const q = Math.floor(r0 / r1);
      [r0, r1] = [r1, r0 - q * r1];
      [s0, s1] = [s1, s0 - q * s1];
    }
    return mod(s0);
  }
  // the rank of a list of sparse vectors, each a Map from index to integer
  function rank(vectors) {
    const pivots = new Map();
    let r = 0;
    for (const v0 of vectors) {
      const v = new Map();
      for (const [i, x] of v0) { const y = mod(x); if (y) v.set(i, y); }
      while (v.size) {
        let lead = -1;
        for (const i of v.keys()) if (i > lead) lead = i;
        const p = pivots.get(lead);
        if (!p) {
          const f = inverse(v.get(lead));
          for (const [i, x] of v) v.set(i, (x * f) % PRIME);
          pivots.set(lead, v);
          r++;
          break;
        }
        const f = v.get(lead);
        for (const [i, x] of p) {
          const y = mod((v.get(i) || 0) - (f * x) % PRIME);
          if (y) v.set(i, y); else v.delete(i);
        }
      }
    }
    return r;
  }
  const add = (map, key, x) => { const y = (map.get(key) || 0) + x; if (y) map.set(key, y); else map.delete(key); };
  const push = (map, key, x) => { if (!map.has(key)) map.set(key, []); map.get(key).push(x); };
  const trim = (b) => { const c = b.slice(); while (c.length > 1 && !c[c.length - 1]) c.pop(); return c; };

  // Betti numbers of a chain complex: basis maps each degree to its basis keys,
  // d(key) is the boundary as a Map from keys one degree lower to coefficients.
  function homology(basis, d) {
    const index = new Map();
    for (const keys of basis.values()) keys.forEach((key, i) => index.set(key, i));
    const rk = new Map();
    for (const [n, keys] of basis) {
      rk.set(n, rank(keys.map((key) => {
        const v = new Map();
        for (const [k2, x] of d(key)) v.set(index.get(k2), x);
        return v;
      })));
    }
    const top = Math.max(0, ...basis.keys()), b = [];
    for (let n = 0; n <= top; n++) b.push((basis.get(n) || []).length - (rk.get(n) || 0) - (rk.get(n + 1) || 0));
    return trim(b);
  }

  // the Koszul sign of moving the factors at positions i < j of a monomial to
  // its front: m[i] passes the factors before it, then m[j] those before it but m[i]
  function frontSign(m, i, j, sd) {
    let e = 0, before = 0;
    for (let l = 0; l < j; l++) {
      if (l === i) e += sd(m[i]) * before;
      else before += sd(m[l]);
    }
    e += sd(m[j]) * before;
    return e % 2 ? -1 : 1;
  }

  /* ---------- unordered configurations: Knudsen's complex ---------- */

  function unorderedComplex(s, k) {
    // g: weight 1, the classes times x (degree 1 − i); weight 2, the classes times [x, x] (degree 2 − i).
    // Generators of the symmetric algebra are their suspensions, one degree up.
    const gens = [];
    classesFor(s, 1).forEach((c) => gens.push({ w: 1, c, g: 1 - deg(s, c), s: 2 - deg(s, c) }));
    classesFor(s, 2).forEach((c) => gens.push({ w: 2, c, g: 2 - deg(s, c), s: 3 - deg(s, c) }));
    const square = new Map();
    gens.forEach((x, i) => { if (x.w === 2) square.set(x.c, i); });
    const sd = (i) => gens[i].s;
    const basis = new Map();
    (function rec(i, left, mono) {
      if (!left) { push(basis, mono.reduce((t, j) => t + sd(j), 0), mono.join(',')); return; }
      if (i === gens.length) return;
      for (let r = 0; r * gens[i].w <= left && (r < 2 || !(sd(i) % 2)); r++) rec(i + 1, left - r * gens[i].w, mono.concat(new Array(r).fill(i)));
    })(0, k, []);
    // sort a list of generators, with the Koszul sign; null if an odd one repeats
    function normal(a) {
      a = a.slice();
      let sign = 1;
      for (let i = 1; i < a.length; i++) {
        for (let j = i; j > 0 && a[j - 1] > a[j]; j--) {
          if (sd(a[j - 1]) % 2 && sd(a[j]) % 2) sign = -sign;
          [a[j - 1], a[j]] = [a[j], a[j - 1]];
        }
      }
      for (let i = 1; i < a.length; i++) if (a[i] === a[i - 1] && sd(a[i]) % 2) return null;
      return [a, sign];
    }
    function d(key) {
      const m = key ? key.split(',').map(Number) : [], out = new Map();
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          const a = gens[m[i]], b = gens[m[j]];
          if (a.w !== 1 || b.w !== 1) continue;
          // d(sa·sb) = (−1)^{|a|} s[a, b], and [αx, βx] = (−1)^{deg β} (α ∪ β)[x, x]
          const sign = frontSign(m, i, j, sd) * (a.g % 2 ? -1 : 1) * (deg(s, b.c) % 2 ? -1 : 1);
          const rest = m.filter((_, l) => l !== i && l !== j);
          for (const [c, x] of s.mult[a.c][b.c]) {
            const nm = normal([square.get(c)].concat(rest));
            if (nm) add(out, nm[0].join(','), sign * x * nm[1]);
          }
        }
      }
      return out;
    }
    return { basis, d };
  }

  /* ---------- ordered configurations: the multilinear complex ---------- */

  const bits = (B) => { const out = []; for (let i = 0; B >> i; i++) if ((B >> i) & 1) out.push(i); return out; };
  const highest = (B) => 31 - Math.clz32(B);
  const lowest = (B) => 31 - Math.clz32(B & -B);
  function permutations(a) {
    if (a.length <= 1) return [a.slice()];
    const out = [];
    a.forEach((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => out.push([x].concat(p))));
    return out;
  }
  const letter = (i) => String.fromCharCode(48 + i);
  const unletter = (ch) => ch.charCodeAt(0) - 48;

  function orderedComplex(s, k) {
    // A generator of g: a block B of letters, a class c it may carry, and a basis
    // word of Lie(B): the right-normed bracket [x_{w_0}, [x_{w_1}, …, [x_{w_{r−2}}, x_max]…]]
    // with max = the largest letter of B, given by the list w of the others.
    const gens = [], ids = new Map();
    function gen(B, c, w) {
      const key = B + '|' + c + '|' + w.join(',');
      let id = ids.get(key);
      if (id === undefined) {
        const r = bits(B).length;
        id = gens.length;
        ids.set(key, id);
        gens.push({ B, c, w, r, min: lowest(B), g: r - deg(s, c), s: r - deg(s, c) + 1 });
      }
      return id;
    }
    const sd = (id) => gens[id].s;

    // Lie words in odd letters inside the tensor algebra: [P, Q] = PQ − (−1)^{|P||Q|} QP
    const expansions = new Map();
    function expand(B, w) {
      const key = B + '|' + w.join(',');
      let E = expansions.get(key);
      if (!E) {
        E = new Map([[letter(highest(B)), 1]]);
        for (let i = w.length - 1; i >= 0; i--) {
          const a = letter(w[i]), len = w.length - i, F = new Map();
          for (const [mono, x] of E) { add(F, a + mono, x); add(F, mono + a, len % 2 ? x : -x); }
          E = F;
        }
        expansions.set(key, E);
      }
      return E;
    }
    // A Lie element in the letters of B, written in the basis: the word with
    // prefix w has the same coefficient as the monomial w·max, since no other
    // basis word has a monomial ending in max.
    function extract(B, E) {
      const top = letter(highest(B)), out = [];
      for (const [mono, x] of E) if (x && mono[mono.length - 1] === top) out.push([Array.from(mono.slice(0, -1), unletter), x]);
      return out;
    }

    // [(c, B, w), (c', B', w')] = (−1)^{|B| deg c'} (c ∪ c') ⊗ [w, w']
    const brackets = new Map();
    function bracket(g1, g2) {
      const key = g1 + ',' + g2;
      let out = brackets.get(key);
      if (!out) {
        out = [];
        const a = gens[g1], b = gens[g2], prods = s.mult[a.c][b.c];
        if (prods.length) {
          const P = expand(a.B, a.w), Q = expand(b.B, b.w), PQ = new Map();
          const qp = (a.r * b.r) % 2 ? 1 : -1;
          for (const [u, x] of P) for (const [v, y] of Q) { add(PQ, u + v, x * y); add(PQ, v + u, qp * x * y); }
          const B = a.B | b.B, sign = (a.r * deg(s, b.c)) % 2 ? -1 : 1;
          for (const [w, y] of extract(B, PQ)) for (const [c, x] of prods) out.push([gen(B, c, w), sign * x * y]);
        }
        brackets.set(key, out);
      }
      return out;
    }

    // the basis: a set partition of the letters, and for each block a class and a word;
    // the factors in the order of their least letters
    const basis = new Map();
    const choices = new Map();
    function choicesFor(B) {
      let out = choices.get(B);
      if (!out) {
        const others = bits(B).filter((i) => i !== highest(B));
        out = [];
        for (const c of classesFor(s, others.length + 1)) for (const w of permutations(others)) out.push(gen(B, c, w));
        choices.set(B, out);
      }
      return out;
    }
    (function rec(i, blocks) {
      if (i === k) {
        const lists = blocks.map((bl) => choicesFor(bl.reduce((B, j) => B | (1 << j), 0)));
        (function pick(t, mono, n) {
          if (t === lists.length) { push(basis, n, mono.join(',')); return; }
          for (const id of lists[t]) pick(t + 1, mono.concat(id), n + sd(id));
        })(0, [], 0);
        return;
      }
      for (const bl of blocks) { bl.push(i); rec(i + 1, blocks); bl.pop(); }
      blocks.push([i]);
      rec(i + 1, blocks);
      blocks.pop();
    })(0, []);

    // insert a generator among others ordered by least letter, with the Koszul sign
    function insert(rest, h) {
      let pos = 0, passed = 0;
      while (pos < rest.length && gens[rest[pos]].min < gens[h].min) passed += sd(rest[pos++]);
      return [rest.slice(0, pos).concat([h], rest.slice(pos)), (sd(h) * passed) % 2 ? -1 : 1];
    }
    const boundaries = new Map();
    function d(key) {
      let out = boundaries.get(key);
      if (out) return out;
      out = new Map();
      const m = key.split(',').map(Number);
      for (let i = 0; i < m.length; i++) {
        for (let j = i + 1; j < m.length; j++) {
          const br = bracket(m[i], m[j]);
          if (!br.length) continue;
          const sign = frontSign(m, i, j, sd) * (gens[m[i]].g % 2 ? -1 : 1);
          const rest = m.filter((_, l) => l !== i && l !== j);
          for (const [h, x] of br) {
            const [nm, e] = insert(rest, h);
            add(out, nm.join(','), sign * e * x);
          }
        }
      }
      boundaries.set(key, out);
      return out;
    }

    // the permutation tau (letter i ↦ tau[i]) on generators and on monomials
    const acted = new Map();
    function act(tau, id) {
      const key = tau.join(',') + '|' + id;
      let out = acted.get(key);
      if (!out) {
        const g = gens[id], B = bits(g.B).reduce((t, i) => t | (1 << tau[i]), 0), E = new Map();
        for (const [mono, x] of expand(g.B, g.w)) E.set(Array.from(mono, (ch) => letter(tau[unletter(ch)])).join(''), x);
        out = extract(B, E).map(([w, x]) => [gen(B, g.c, w), x]);
        acted.set(key, out);
      }
      return out;
    }
    function actOn(tau, key) {
      let terms = [[[], 1]];
      for (const id of key.split(',').map(Number)) {
        const next = [];
        for (const [list, x] of terms) for (const [h, y] of act(tau, id)) next.push([list.concat(h), x * y]);
        terms = next;
      }
      const out = new Map();
      for (const [list, x] of terms) {
        const a = list.slice();
        let sign = 1;
        for (let i = 1; i < a.length; i++) {
          for (let j = i; j > 0 && gens[a[j - 1]].min > gens[a[j]].min; j--) {
            if (sd(a[j - 1]) % 2 && sd(a[j]) % 2) sign = -sign;
            [a[j - 1], a[j]] = [a[j], a[j - 1]];
          }
        }
        add(out, a.join(','), sign * x);
      }
      return out;
    }
    // Betti numbers of the part invariant under a group of permutations of the letters
    function invariantBetti(group) {
      const sums = new Map(); // degree → orbit sums
      for (const [n, keys] of basis) {
        sums.set(n, keys.map((key) => {
          const v = new Map();
          for (const tau of group) for (const [k2, x] of actOn(tau, key)) add(v, k2, x);
          return v;
        }));
      }
      const index = new Map();
      for (const keys of basis.values()) keys.forEach((key, i) => index.set(key, i));
      const dim = new Map(), rk = new Map();
      for (const [n, vs] of sums) {
        dim.set(n, rank(vs.map((v) => { const u = new Map(); for (const [k2, x] of v) u.set(index.get(k2), x); return u; })));
        rk.set(n, rank(vs.map((v) => {
          const u = new Map();
          for (const [k2, x] of v) for (const [k3, y] of d(k2)) add(u, index.get(k3), x * y);
          return u;
        })));
      }
      const top = Math.max(0, ...basis.keys()), b = [];
      for (let n = 0; n <= top; n++) b.push((dim.get(n) || 0) - (rk.get(n) || 0) - (rk.get(n + 1) || 0));
      return trim(b);
    }
    return { basis, d, gens, bracket, actOn, invariantBetti, betti: () => homology(basis, d) };
  }

  /* ---------- the results, cached ---------- */

  const cache = new Map();
  const cached = (key, f) => { if (!cache.has(key)) cache.set(key, f()); return cache.get(key); };
  const dimOf = (id) => SURFACES[id].dim || 2;
  // b_0, b_1, … of the unordered configuration space UConf_k(Σ)
  const bettiUnordered = (id, k) => cached('u' + id + k, () => (!k ? [1] : dimOf(id) === 1 ? ONE.betti(id, k, [[...Array(k).keys()]])
    : homology(...Object.values(unorderedComplex(surface(id), k)))));
  // … of the ordered configuration space Conf_k(Σ)
  const bettiOrdered = (id, k) => cached('o' + id + k, () => (!k ? [1] : dimOf(id) === 1 ? ONE.betti(id, k, [...Array(k).keys()].map((i) => [i]))
    : orderedComplex(surface(id), k).betti()));
  // … of Conf_l(Σ)/G for G the permutations that keep each of the given groups of letters
  function groupOf(l, groups) {
    const where = new Array(l);
    groups.forEach((g, i) => g.forEach((x) => { where[x] = i; }));
    return permutations([...Array(l).keys()]).filter((p) => p.every((x, i) => where[x] === where[i]));
  }
  const bettiQuotient = (id, l, groups) => cached('q' + id + l + JSON.stringify(groups), () => {
    if (dimOf(id) === 1) return ONE.betti(id, l, groups);
    if (groups.every((g) => g.length === 1)) return bettiOrdered(id, l);
    if (groups.length === 1) return bettiUnordered(id, l);
    return orderedComplex(surface(id), l).invariantBetti(groupOf(l, groups));
  });

  /* ---------- the line and the circle ---------- */

  // On the line a point cannot pass another, so the order of the points is kept: Conf_k(R) is
  // k! open simplices, one for each order, and UConf_k(R) one. On the circle the cyclic order is
  // kept: turning x₁ to 0, Conf_k(S¹) ≅ S¹ × Conf_{k−1}(R), (k − 1)! copies of S¹ times an open
  // simplex, one for each cyclic order. A group G of relabellings permutes these pieces, and a
  // piece of the quotient is a piece divided by the finite group that keeps it, acting freely; it
  // keeps the rational homology of the piece (on the circle G does not turn the S¹ round, since
  // relabelling commutes with turning all the points). So b₀ is the number of orbits of G on
  // the orders (or the cyclic orders), and on the circle b₁ is the same.
  const ONE = {
    // the orders of 0, …, l − 1 (on the circle, those starting with 0: the cyclic orders)
    orders: (id, l) => (SURFACES[id].x ? permutations([...Array(l).keys()].slice(1)).map((p) => [0].concat(p)) : permutations([...Array(l).keys()])),
    // an order relabelled by g, in its normal form (on the circle, turned to start with 0)
    act(id, g, order) {
      const o = order.map((x) => g[x]);
      if (!SURFACES[id].x) return o.join(',');
      const z = o.indexOf(0);
      return o.slice(z).concat(o.slice(0, z)).join(',');
    },
    betti(id, l, groups) {
      const G = groupOf(l, groups), seen = new Set();
      let orbits = 0;
      for (const o of ONE.orders(id, l)) {
        const key = o.join(',');
        if (seen.has(key)) continue;
        orbits++;
        for (const g of G) seen.add(ONE.act(id, g, o));
      }
      return SURFACES[id].x ? [orbits, orbits] : [orbits];
    },
  };

  /* ---------- collision strata ---------- */

  // the set partitions of {0, …, k−1}, each a list of blocks ordered by least element
  function setPartitions(k) {
    const out = [];
    (function rec(i, blocks) {
      if (i === k) { out.push(blocks.map((b) => b.slice())); return; }
      for (const b of blocks) { b.push(i); rec(i + 1, blocks); b.pop(); }
      blocks.push([i]);
      rec(i + 1, blocks);
      blocks.pop();
    })(0, []);
    return out;
  }
  // the partitions of k, parts in decreasing order
  function intPartitions(k, most = k) {
    if (!k) return [[]];
    const out = [];
    for (let p = Math.min(k, most); p >= 1; p--) intPartitions(k - p, p).forEach((q) => out.push([p].concat(q)));
    return out;
  }
  const typeOf = (blocks) => blocks.map((b) => b.length).sort((a, b) => b - a);
  const partKey = (blocks) => blocks.map((b) => b.join('.')).join('|');
  // the groups of points that have parts of the same size, for a partition λ: the
  // stratum of Sym^k Σ of type λ is Conf_ℓ(Σ)/Π Σ_{m_i}, the points of one size unlabelled
  function groupsOf(lambda) {
    const groups = [];
    lambda.forEach((p, i) => { if (i && lambda[i - 1] === p) groups[groups.length - 1].push(i); else groups.push([i]); });
    return groups;
  }
  // The strata of Σ^k (ordered: set partitions) or of Sym^k Σ (unordered:
  // partitions of k), with the covering relations: a stratum lies in the
  // closure of another when it is got by merging two blocks.
  function strata(k, ordered) {
    const nodes = ordered
      ? setPartitions(k).map((blocks) => ({ key: partKey(blocks), blocks, parts: blocks.length }))
      : intPartitions(k).map((lambda) => ({ key: lambda.join(','), lambda, parts: lambda.length }));
    const at = new Map(nodes.map((n, i) => [n.key, i])), edges = [];
    nodes.forEach((n, i) => {
      const seen = new Set();
      for (let a = 0; a < n.parts; a++) {
        for (let b = a + 1; b < n.parts; b++) {
          let key;
          if (ordered) {
            const merged = n.blocks.filter((_, t) => t !== a && t !== b).concat([n.blocks[a].concat(n.blocks[b]).sort((x, y) => x - y)]);
            key = partKey(merged.sort((x, y) => x[0] - y[0]));
          } else {
            key = n.lambda.filter((_, t) => t !== a && t !== b).concat(n.lambda[a] + n.lambda[b]).sort((x, y) => y - x).join(',');
          }
          if (!seen.has(key)) { seen.add(key); edges.push([i, at.get(key)]); }
        }
      }
    });
    return { nodes, edges };
  }

  /* ---------- Euler characteristics ---------- */

  const falling = (x, k) => { let p = 1; for (let i = 0; i < k; i++) p *= x - i; return p + 0; }; // + 0: no −0
  const factorial = (k) => falling(k, k);
  // χ(Conf_k M) = χ(M)·χ(M minus a point)·…, by the fibrations forgetting the last point. Taking a
  // point out of a surface lowers χ by 1, out of a curve raises it by 1 (it cuts it, χ(S⁰) = 2).
  const chiConf = (id, k) => (dimOf(id) === 1 ? (-1) ** k * falling(-SURFACES[id].chi, k) + 0 : falling(SURFACES[id].chi, k));
  const chiOrdered = (id, k) => chiConf(id, k);
  const chiUnordered = (id, k) => chiConf(id, k) / factorial(k);
  // χ of a stratum of type λ: χ(Conf_ℓ M) / Π m_i!
  const chiStratum = (id, lambda) => groupsOf(lambda).reduce((t, g) => t / factorial(g.length), chiConf(id, lambda.length));
  const chiFromBetti = (b) => b.reduce((t, x, i) => t + (i % 2 ? -x : x), 0);

  /* ---------- the models: gluing, wrapping, distance, the way from one point to another ---------- */

  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit3 = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return n < 1e-12 ? null : [a[0] / n, a[1] / n, a[2] / n]; };

  // The maps that take the square to the squares beside it, each with its
  // place (dx, dy): where the gluings commute (torus, Klein bottle) also the
  // corners. The sphere models have none.
  const sides = new Map();
  function neighbours(id) {
    let out = sides.get(id);
    if (!out) {
      const s = SURFACES[id];
      const X = s.x === 'straight' ? (p, e) => [p[0] + e, p[1]] : s.x === 'flip' ? (p, e) => [p[0] + e, 1 - p[1]] : null;
      const Y = s.y === 'straight' ? (p, e) => [p[0], p[1] + e] : s.y === 'flip' ? (p, e) => [1 - p[0], p[1] + e] : null;
      out = [];
      if (X) for (const e of [1, -1]) out.push({ dx: e, dy: 0, f: (p) => X(p, e), flip: s.x === 'flip' });
      if (Y) for (const e of [1, -1]) out.push({ dx: 0, dy: e, f: (p) => Y(p, e), flip: s.y === 'flip' });
      if (X && Y && !(s.x === 'flip' && s.y === 'flip')) {
        for (const ex of [1, -1]) for (const ey of [1, -1]) out.push({ dx: ex, dy: ey, f: (p) => X(Y(p, ey), ex), flip: s.x === 'flip' || s.y === 'flip' });
      }
      sides.set(id, out);
    }
    return out;
  }
  // the point of the surface that p stands for: in the square model p may be anywhere in the plane,
  // and in an open direction it is kept within [lo, 1 − lo]; in the sphere model p is any nonzero vector
  function wrap(id, p, lo = 0) {
    const s = SURFACES[id];
    if (s.ball) return unit3(p) || [0, 0, 1];
    let [x, y] = p;
    for (let round = 0; round < 6; round++) {
      if (s.x && (x >= 1 || x < 0)) { const e = Math.floor(x); x -= e; if (s.x === 'flip' && e % 2) y = 1 - y; continue; }
      if (s.y && (y >= 1 || y < 0)) { const e = Math.floor(y); y -= e; if (s.y === 'flip' && e % 2) x = 1 - x; continue; }
      break;
    }
    if (!s.x) x = Math.min(1 - lo, Math.max(lo, x));
    if (!s.y) y = Math.min(1 - lo, Math.max(lo, y));
    if (s.dim === 1) y = 0.5;
    return [x, y];
  }
  // of q and its copies (across the edges of the square, or the opposite unit vector on the
  // projective plane), the one nearest p: q in coordinates round p
  function near(id, p, q) {
    const s = SURFACES[id];
    if (s.ball) return s.antipodal && dot3(p, q) < 0 ? [-q[0], -q[1], -q[2]] : q;
    let best = q, bd = Math.hypot(p[0] - q[0], p[1] - q[1]);
    for (const n of neighbours(id)) {
      const r = n.f(q), d = Math.hypot(p[0] - r[0], p[1] - r[1]);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  // the distance on the surface between nearby points (in the square model, through one gluing at
  // most: enough to see whether two points touch); on the sphere models, the angle between them
  function dist(id, p, q) {
    const r = near(id, p, q);
    if (SURFACES[id].ball) return 2 * Math.asin(Math.min(1, Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2]) / 2));
    return Math.hypot(p[0] - r[0], p[1] - r[1]);
  }
  // the way along a great circle from the unit vector p to q, a fraction t of it
  function slerp(p, q, t) {
    const c = Math.max(-1, Math.min(1, dot3(p, q))), th = Math.acos(c);
    if (th < 1e-6) return unit3(p.map((x, i) => x + t * (q[i] - x))) || p.slice();
    let u;
    if (th > Math.PI - 1e-6) { // opposite: by any great circle
      u = unit3(cross3(p, Math.abs(p[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
      return p.map((x, i) => Math.cos(Math.PI * t) * x + Math.sin(Math.PI * t) * u[i]);
    }
    const s = Math.sin(th), a = Math.sin((1 - t) * th) / s, b = Math.sin(t * th) / s;
    return p.map((x, i) => a * x + b * q[i]);
  }
  // The point a fraction t of the way from p to q, going the shortest way: between two recorded
  // configurations each point is taken to have moved so.
  function toward(id, p, q, t) {
    const r = near(id, p, q);
    if (SURFACES[id].ball) return slerp(p, r, t);
    return wrap(id, [p[0] + t * (r[0] - p[0]), p[1] + t * (r[1] - p[1])]);
  }

  /* ---------- pictures of the spaces themselves ---------- */

  // complex numbers as [re, im]
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cscale = (a, t) => [a[0] * t, a[1] * t];
  const cabs2 = (a) => a[0] * a[0] + a[1] * a[1];
  const OMEGA = [-0.5, Math.sqrt(3) / 2], OMEGA2 = [-0.5, -Math.sqrt(3) / 2]; // ω = e^{2πi/3}, ω² = ω̄

  // Three points of the plane up to translation and scale: centred, they lie in
  // the plane Σ v_i = 0 of C³, which the discrete Fourier transform
  //   p = (v₁ + ω̄v₂ + ω̄²v₃)/√3,   q = (v₁ + ωv₂ + ω²v₃)/√3
  // identifies isometrically with C²; scaled, on its unit sphere S³. The equilateral
  // triangles are the circles q = 0 and p = 0; a collision v_i = v_j is a complex
  // line through 0, so a great circle: a fibre of the Hopf map S³ → CP¹ that
  // forgets the rotation of the triangle. Null if the three points coincide.
  function onSphere(pts) {
    const c = cscale(cadd(cadd(pts[0], pts[1]), pts[2]), 1 / 3), v = pts.map((x) => csub(x, c));
    const p = cscale(cadd(cadd(v[0], cmul(OMEGA2, v[1])), cmul(OMEGA, v[2])), 1 / Math.sqrt(3));
    const q = cscale(cadd(cadd(v[0], cmul(OMEGA, v[1])), cmul(OMEGA2, v[2])), 1 / Math.sqrt(3));
    const n = Math.sqrt(cabs2(p) + cabs2(q));
    return n < 1e-12 ? null : [cscale(p, 1 / n), cscale(q, 1 / n)];
  }
  // Unordered: the monic cubic z³ + az + b with roots the centred points, a = e₂,
  // b = −e₃. In A = −a/3, B = b/2 a double root s and a simple one −2s give
  // (A, B) = (s², s³): the discriminant, 4a³ + 27b² = 0, is A³ = B². Scaling the
  // points by t takes (A, B) to (t²A, t³B), which meets S³ once: the discriminant
  // meets it in the (2, 3) torus knot, the trefoil.
  function onSphereUnordered(pts) {
    const c = cscale(cadd(cadd(pts[0], pts[1]), pts[2]), 1 / 3), v = pts.map((x) => csub(x, c));
    const e2 = cadd(cadd(cmul(v[0], v[1]), cmul(v[0], v[2])), cmul(v[1], v[2])), e3 = cmul(cmul(v[0], v[1]), v[2]);
    const A = cscale(e2, -1 / 3), B = cscale(e3, -1 / 2), a2 = cabs2(A), b2 = cabs2(B);
    if (a2 + b2 < 1e-24) return null;
    const f = (t) => t ** 4 * a2 + t ** 6 * b2;
    let lo = 0, hi = 1;
    while (f(hi) < 1) hi *= 2;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) < 1) lo = m; else hi = m; }
    return [cscale(A, lo * lo), cscale(B, lo ** 3)];
  }
  // Stereographic projections to R³, from the clockwise equilateral triangle with
  // x₁ on the right of the centre ((p, q) = (0, 1), and (A, B) = (0, −1)): the
  // equilateral triangles of that orientation become the vertical axis, and the
  // picture turns round it. Both keep the orientation of S³ (that of C² ⊃ B⁴).
  const project = ([p, q]) => { const d = 1 - q[0]; return [p[0] / d, p[1] / d, -q[1] / d]; };
  const projectUnordered = ([A, B]) => { const d = 1 + B[0]; return [A[0] / d, A[1] / d, B[1] / d]; };
  // the configuration as a point of R³ (null if all three coincide)
  function point3(pts, ordered) {
    const s = ordered ? onSphere(pts) : onSphereUnordered(pts);
    return s && (ordered ? project(s) : projectUnordered(s));
  }
  // The collisions, as closed curves in R³, each oriented by turning the
  // configuration counterclockwise: for the ordered points the circles x_i = x_j,
  // for the unordered the trefoil (made of the same configurations).
  const curves = new Map();
  function collisionCurves(ordered, n = 360) {
    const key = ordered + ',' + n;
    if (!curves.has(key)) {
      const pairs = ordered ? [[0, 1], [0, 2], [1, 2]] : [[0, 1]], out = [];
      for (const [i, j] of pairs) {
        const pts = [];
        for (let s = 0; s < n; s++) {
          const e = [Math.cos(2 * Math.PI * s / n), Math.sin(2 * Math.PI * s / n)];
          pts.push(point3([0, 1, 2].map((m) => (m === i || m === j ? e : cscale(e, -2))), ordered));
        }
        out.push({ pair: [i, j], pts });
      }
      curves.set(key, out);
    }
    return curves.get(key);
  }
  // Two points on a surface that is a group in the square model (the plane, the
  // cylinder S¹ × (0, 1), the torus R²/Z²): up to translation, their relative
  // position x₂ − x₁, in the surface minus 0 (the collision).
  const GROUPS = new Set(['plane', 'cylinder', 'torus']);
  function relative(id, a, b) {
    const s = SURFACES[id];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    if (s.x === 'straight') dx -= Math.round(dx);
    if (s.y === 'straight') dy -= Math.round(dy);
    return [dx, dy];
  }
  // Two points on the open Möbius band M = R × (0, 1)/((x, y) ~ (x + 1, 1 − y)).
  // Sliding along the band, (x, y) ↦ (x + t, y), moves M by isometries; sliding by 1
  // is the reflection ρ(x, y) = (x, 1 − y). Slide the pair until x₁ is at x = ½, then
  // push the column round x₁ up or down until x₁ is at the centre (a homeomorphism of
  // M that is the identity near the glued edge). What is left is s, where x₁ was along
  // the band, and q, where x₂ went. This is a bundle, with fibre an interval (the
  // height of x₁), from Conf₂(M) onto the mapping torus of ρ on M minus its centre: a
  // homotopy equivalence onto a 3-manifold. In it the collisions are the line
  // q = (½, ½), and s = 1 is glued to s = 0 by q ↦ ρ(q). Returned as [q_x, q_y, s].
  const bump = (x) => Math.max(0, 1 - Math.abs(x - 0.5) / 0.45);
  function mobiusPair(a, b) {
    const q = wrap('mobius', [b[0] + 0.5 - a[0], b[1]]);
    const m = a[1] + (0.5 - a[1]) * bump(q[0]); // where the push takes x₁'s height, in q's column
    const y = q[1] < a[1] ? q[1] * m / a[1] : m + (q[1] - a[1]) * (1 - m) / (1 - a[1]);
    return [q[0], y, a[0]];
  }
  /* ---------- the line and the circle: the space itself, or nearly ---------- */

  // k points of the line (0, 1), as (x₁, …, x_k), lie in the open cube (0, 1)^k off the planes
  // x_i = x_j; k points of the circle, in the torus [0, 1)^k. Two points: a square, three: a cube,
  // drawn as they are. Four points of the circle, turned until x₁ is at 0, lie in the open cube of
  // (x₂ − x₁, x₃ − x₁, x₄ − x₁) mod 1, whose faces are where another point meets x₁: only the
  // circle of turnings is left out. Four points of the line, centred and scaled, lie on a sphere.
  const frac = (x) => x - Math.floor(x);
  function cubePoint(id, pts) {
    const x = pts.map((p) => p[0]);
    if (x.length === 4) return [1, 2, 3].map((i) => frac(x[i] - x[0]));
    return SURFACES[id].x ? x.map(frac) : x;
  }
  // the collisions that are diagonal planes of the cube, as [i, j, a, b]: points i and j (from 0)
  // meet where coordinates a and b agree
  const cubePlanes = (k) => (k === 4 ? [[1, 2, 0, 1], [1, 3, 0, 2], [2, 3, 1, 2]] : [[0, 1, 0, 1], [0, 2, 0, 2], [1, 2, 1, 2]]);
  // Centred, four points lie in the hyperplane Σ x_i = 0 of R⁴, which the orthonormal basis
  // (1, 1, −1, −1)/2, (1, −1, 1, −1)/2, (1, −1, −1, 1)/2 identifies with R³; scaled, on its unit
  // sphere. The collision x_i = x_j is the great circle orthogonal to the image of e_i − e_j, and
  // the six circles cut the sphere into 24 triangles, one for each order of the points.
  const U4 = [[1, 1, -1, -1], [1, -1, 1, -1], [1, -1, -1, 1]].map((u) => u.map((x) => x / 2));
  function spherePoint(pts) {
    const x = pts.map((p) => p[0]), m = x.reduce((t, v) => t + v, 0) / 4;
    const v = U4.map((u) => u.reduce((t, a, i) => t + a * (x[i] - m), 0)), n = Math.hypot(...v);
    return n < 1e-12 ? null : v.map((a) => a / n);
  }
  // the great circle where x_i = x_j, as n points
  function sphereCircle(i, j, n = 240) {
    const d = U4.map((u) => u[i] - u[j]), dl = Math.hypot(...d), z = d.map((x) => x / dl);
    const t = Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], tz = t[0] * z[0] + t[1] * z[1] + t[2] * z[2];
    const a0 = t.map((x, c) => x - tz * z[c]), al = Math.hypot(...a0), a = a0.map((x) => x / al);
    const b = [z[1] * a[2] - z[2] * a[1], z[2] * a[0] - z[0] * a[2], z[0] * a[1] - z[1] * a[0]];
    return Array.from({ length: n }, (_, s) => { const th = 2 * Math.PI * s / n; return [0, 1, 2].map((c) => Math.cos(th) * a[c] + Math.sin(th) * b[c]); });
  }

  /* ---------- frames, and S³ divided by a binary dihedral group: prisms ---------- */

  // the unit quaternion [w, x, y, z] of the rotation whose matrix has these columns, up to sign
  function quatOf([c0, c1, c2]) {
    const m00 = c0[0], m10 = c0[1], m20 = c0[2], m01 = c1[0], m11 = c1[1], m21 = c1[2], m02 = c2[0], m12 = c2[1], m22 = c2[2];
    const t = m00 + m11 + m22;
    let q, s;
    if (t > 0) { s = 2 * Math.sqrt(1 + t); q = [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s]; }
    else if (m00 > m11 && m00 > m22) { s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s]; }
    else if (m11 > m22) { s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s]; }
    else { s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4]; }
    const n = Math.hypot(q[0], q[1], q[2], q[3]);
    return q.map((x) => x / n);
  }
  const qmul = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
  // The binary dihedral group Dic_4n = ⟨e^{kπ/n}, i⟩ ⊂ S³, of order 4n: the preimage of the
  // dihedral group of rotations made of the turns by 2π/n about the z axis and the half turns
  // about the x axis. For n = 2 the quaternion group Q₈ = {±1, ±i, ±j, ±k}.
  const DIC = new Map();
  function dicyclic(n) {
    if (!DIC.has(n)) {
      const out = [];
      for (let m = 0; m < 2 * n; m++) { const a = m * Math.PI / n; out.push([Math.cos(a), 0, 0, Math.sin(a)], [0, Math.cos(a), Math.sin(a), 0]); }
      DIC.set(n, out);
    }
    return DIC.get(n);
  }
  const Q8 = dicyclic(2);
  // S³/Dic_4n: of an orbit qDic_4n, the point nearest 1 has the largest real part w. These points
  // (the Dirichlet domain) make a spherical prism, which central projection, (x, y, z)/w, makes
  // straight: |z| ≤ tan(π/2n), from e^{±kπ/n}, and |x cos θ + y sin θ| ≤ 1 from the e^{kθ}i, a
  // regular 2n-gon of inradius 1. For n = 2 it is the cube [−1, 1]³. Each face is glued to the
  // opposite one by the q ↦ qg that ties its points with their images, a turn about its normal.
  const central = (q) => [q[1] / q[0], q[2] / q[0], q[3] / q[0]];
  function toPrism(q, n) {
    let best = null;
    for (const g of dicyclic(n)) { const r = qmul(q, g); if (!best || r[0] > best[0]) best = r; }
    return central(best);
  }
  // The prism: its height h (|z| ≤ h), the radius r of its corners, and its 6n edges, each with
  // the number of its class (the face maps glue the edges in classes) and its direction, 1 or −1,
  // relative to the others of its class, for drawing arrows.
  const PRISMS = new Map();
  function prism(n) {
    if (PRISMS.has(n)) return PRISMS.get(n);
    const h = Math.tan(Math.PI / (2 * n)), r = 1 / Math.cos(Math.PI / (2 * n)), G = dicyclic(n);
    const corner = (m, z) => { const a = (m + 0.5) * Math.PI / n; return [r * Math.cos(a), r * Math.sin(a), z]; };
    const edges = [];
    for (let m = 0; m < 2 * n; m++) edges.push({ from: corner(m, -h), to: corner(m, h) }, { from: corner(m, h), to: corner(m + 1, h) }, { from: corner(m, -h), to: corner(m + 1, -h) });
    // the faces, as planes u · p = 1, each with its map
    const faces = [[0, 0, 1 / h], [0, 0, -1 / h]];
    for (let m = 0; m < 2 * n; m++) faces.push([Math.cos(m * Math.PI / n), Math.sin(m * Math.PI / n), 0]);
    const maps = faces.map((u) => {
      const q = [1].concat(u.map((x) => x / dot3(u, u))), g = G.find((x) => x[0] < 1 - 1e-9 && Math.abs(qmul(q, x)[0] - 1) < 1e-9);
      return (p) => central(qmul([1, p[0], p[1], p[2]], g));
    });
    const lerp3 = (a, b, t) => a.map((x, i) => x + t * (b[i] - x)), minus = (a, b) => a.map((x, i) => x - b[i]);
    const find = (p) => edges.findIndex((e) => {
      const d = minus(e.to, e.from), t = dot3(minus(p, e.from), d) / dot3(d, d);
      return t > -1e-6 && t < 1 + 1e-6 && Math.hypot(...minus(lerp3(e.from, e.to, t), p)) < 1e-6;
    });
    // union–find, with each edge's direction relative to its parent
    const parent = edges.map((_, i) => i), sign = edges.map(() => 1);
    const root = (i) => { let sg = 1; while (parent[i] !== i) { sg *= sign[i]; i = parent[i]; } return [i, sg]; };
    edges.forEach((e, i) => {
      faces.forEach((u, f) => {
        if (Math.abs(dot3(u, e.from) - 1) > 1e-9 || Math.abs(dot3(u, e.to) - 1) > 1e-9) return;
        const p0 = maps[f](lerp3(e.from, e.to, 0.25)), p1 = maps[f](lerp3(e.from, e.to, 0.75)), j = find(p0);
        if (j < 0) throw new Error('a face map takes an edge of the prism off its edges');
        const dir = Math.sign(dot3(minus(p1, p0), minus(edges[j].to, edges[j].from)));
        const [ri, si] = root(i), [rj, sj] = root(j);
        if (ri !== rj) { parent[rj] = ri; sign[rj] = si * dir * sj; }
        else if (si * dir !== sj) throw new Error('the prism edges are glued inconsistently');
      });
    });
    const roots = [];
    const out = {
      n, h, r, faces,
      edges: edges.map((e, i) => {
        const [rt, sg] = root(i);
        if (!roots.includes(rt)) roots.push(rt);
        return { from: e.from, to: e.to, n: roots.indexOf(rt) + 1, dir: sg };
      }),
    };
    PRISMS.set(n, out);
    return out;
  }

  /* ---------- two points on the projective plane ---------- */

  // Two distinct lines through 0, as unit vectors a and b: turn them apart in their plane, each by
  // the same angle, until they are orthogonal (a deformation retraction of Conf₂(RP²), the same for
  // either order). With the line orthogonal to both they make a frame u, v, u × v of R³, up to the
  // signs of u and v: changing those multiplies the rotation with these columns on the right by a
  // half turn about a coordinate axis, so the pairs of lines are SO(3)/(Z/2)² = S³/Q₈, the cube
  // (n = 2). Swapping the lines multiplies it by the half turn about (1, 1, 0), which exchanges u
  // and v: with the others it makes the dihedral group of order 8, whose preimage in S³ is Q₁₆, so
  // the unordered pairs are S³/Q₁₆, the octagonal prism (n = 4). Null if the lines are the same.
  function frameOf(a, b) {
    const c = dot3(a, b) < 0 ? b.map((x) => -x) : b;
    const m = unit3(a.map((x, i) => x + c[i])), d = unit3(a.map((x, i) => x - c[i]));
    if (!m || !d) return null;
    const u = m.map((x, i) => (x + d[i]) / Math.SQRT2), v = m.map((x, i) => (x - d[i]) / Math.SQRT2);
    return [u, v, cross3(u, v)];
  }
  // two points of RP² as a point of the cube (ordered) or of the octagonal prism (unordered); null if they collide
  function projectivePair(a, b, unordered) {
    const F = frameOf(a, b);
    return F && toPrism(quatOf(F), unordered ? 4 : 2);
  }

  /* ---------- two or three points on the sphere ---------- */

  // Two points: pushing x₂ away from x₁ until it is opposite leaves x₁, so Conf₂(S²) ≃ S². So does
  // the direction of the chord from x₂ to x₁, which is drawn: it is x₁ itself on the opposite pairs.
  // A swap takes it to the opposite direction, so unordered, the line of the chord: UConf₂(S²) ≃ RP²,
  // drawn as a disc, as the ball of rotations is: a line in the direction of its horizontal part, as
  // far out as its angle from the vertical is of a right angle. The horizontal lines make the rim,
  // whose opposite points are glued. Null if the points collide.
  const chordOf = (a, b) => unit3(a.map((x, i) => x - b[i]));
  function chordDisc(a, b) {
    const d = chordOf(a, b);
    if (!d) return null;
    const s = d[2] < 0 ? -1 : 1, l = Math.hypot(d[0], d[1]);
    if (l < 1e-12) return [0, 0];
    const t = Math.acos(Math.min(1, s * d[2])) / (Math.PI / 2);
    return [s * t * d[0] / l, s * t * d[1] / l];
  }
  // Three distinct points make a frame: e₃ the normal of their plane (oriented by their order), e₁
  // the direction round the circle through them where x₁ would be were they equally spaced (the
  // mean of the directions of x₁, of x₂ turned back by a third of a turn, and of x₃ by two thirds;
  // never zero, as the points go round in their order), e₂ = e₃ × e₁. Relabelling the points turns
  // the frame on the right by a symmetry of the equilateral triangle: a cyclic relabelling by a
  // third of a turn about e₃, a transposition by a half turn about e₁. On the equilateral triangles
  // on great circles, to which Conf₃(S²) ≅ PSL₂(C) retracts, keeping the rotations, it is the
  // rotation that takes the one with x₁ = (1, 0, 0) on the equator there; so it is a homotopy
  // equivalence onto SO(3), and unordered onto SO(3)/D₃ = S³/Dic₁₂, the hexagonal prism (n = 3).
  function frame3(x) {
    const n = unit3(cross3(x[1].map((v, i) => v - x[0][i]), x[2].map((v, i) => v - x[0][i])));
    const e = n && unit3(x[0].map((v, i) => v - dot3(x[0], n) * n[i]));
    if (!e) return null;
    const f = cross3(n, e);
    let cx = 0, cy = 0;
    x.forEach((p, i) => { const a = Math.atan2(dot3(p, f), dot3(p, e)) - 2 * Math.PI * i / 3; cx += Math.cos(a); cy += Math.sin(a); });
    const al = Math.atan2(cy, cx), e1 = e.map((v, i) => Math.cos(al) * v + Math.sin(al) * f[i]);
    return [e1, cross3(n, e1), n];
  }
  // A rotation, as a point of the unit ball: along its axis, as far out as its angle is of a half
  // turn (opposite points of the boundary, the half turns, are the same rotation).
  function ballOf(q) {
    const s = q[0] < 0 ? -1 : 1, v = [s * q[1], s * q[2], s * q[3]], l = Math.hypot(v[0], v[1], v[2]);
    if (l < 1e-12) return [0, 0, 0];
    const t = 2 * Math.acos(Math.min(1, s * q[0])) / Math.PI;
    return v.map((x) => t * x / l);
  }
  // three points of S² as a point of the ball (ordered) or of the hexagonal prism (unordered); null if two collide
  function rotationPoint(pts, unordered) {
    const F = frame3(pts);
    return F && (unordered ? toPrism(quatOf(F), 3) : ballOf(quatOf(F)));
  }
  // In the ball of rotations, and in the disc of lines (chordDisc), a place x near the boundary is
  // as near the opposite point: across the boundary, at −(2 − |x|) x/|x|, the same rotation or line
  // with its angle taken the other way round (2π − θ about the opposite axis; π − φ from the
  // vertical, leaning the opposite way). Null at the centre, which is far from the boundary.
  function across(x) {
    const r = Math.hypot(...x);
    return r < 1e-12 ? null : x.map((v) => -(2 - r) * v / r);
  }

  // which picture there is of the space: for a curve 'square', 'cube' or 'sphere'; for a surface
  // '3d', '2d', 'mobius', 'quaternion', 'direction', 'rotation'; or null
  const picture = (id, k) => (dimOf(id) === 1 ? (k === 2 ? 'square' : k === 3 || (k === 4 && SURFACES[id].x) ? 'cube' : k === 4 ? 'sphere' : null)
    : id === 'plane' && k === 3 ? '3d' : k === 2 && GROUPS.has(id) ? '2d'
      : id === 'mobius' && k === 2 ? 'mobius' : id === 'projective' && k === 2 ? 'quaternion'
        : id === 'sphere' && k === 2 ? 'direction' : id === 'sphere' && k === 3 ? 'rotation' : null);

  /* ---------- where there is no picture ---------- */

  // A picture of the space of k points is a manifold of dimension at most three with its
  // homotopy type, once the translations of the cylinder or torus are set aside (those of
  // the plane, and its scalings, are contractible). Moving x₁ to 0, Conf_k Σ = Σ × Conf_{k−1}(Σ∖0),
  // so the Betti numbers of the second factor are those of Conf_k Σ divided by those of Σ.
  const TRANSLATE = new Set(['cylinder', 'torus']);
  function bettiReduced(id, k) {
    const p = bettiOrdered(id, k).slice(), q = TRANSLATE.has(id) ? bettiOrdered(id, 1) : [1], out = [];
    while (p.length >= q.length) {
      const c = p[0] / q[0];
      out.push(c);
      q.forEach((x, i) => { p[i] -= c * x; });
      p.shift();
    }
    if (p.some((x) => x)) throw new Error(id + ': Conf_' + k + ' is not the surface times the rest');
    return out;
  }
  // Why k ≥ 2 points have no picture, or null where they have one. A connected manifold of
  // dimension at most three has no rational homology above degree 3, and b₃ ≤ 1; if it is
  // aspherical with infinite π₁, χ ≤ 0 (a graph, a surface, or in dimension three a compact
  // core, with χ = χ(∂)/2 and no spheres in its boundary). A finite cover of such a manifold is
  // another, and in a finite cover the Betti numbers can only grow (by the transfer) and χ is
  // multiplied by the degree; so the unordered space, which shares a finite cover with the
  // ordered one, has no picture when the ordered one has none.
  //   { betti: [i, b_i] }  for Conf_k Σ, translations set aside: b_i ≠ 0 with i ≥ 4, or b₃ ≥ 2
  //   { chi, chiUnordered } three points on the torus or cylinder, translations set aside: aspherical
  //       with χ = (−1)(−2) = 2; for unordered points fix the sum of the points instead (the quotient
  //       by translations is an orbifold): that space is covered by the ordered one with the sum fixed,
  //       itself a cover of Conf₂(Σ∖0) of degree |Σ[3]| (9, or 3), so χ = |Σ[3]| · 2 / 3!
  //   { klein: true }  two points on the Klein bottle: b = 1, 2, 2, 1 is that of a closed 3-manifold,
  //       but the pairs (a, b) in T² × T² over distinct points of K, a cover of degree 4, have b₃ = 2.
  //       With σ(x, y) = (x + ½, −y) the deck map and d = b − a, the cover is S¹ × W, W the 3-torus
  //       (y, d) minus the circles d = 0 and d = (½, −2y); by Lefschetz duality, or the Wang sequence
  //       of W as the mapping torus of pushing a puncture twice round T² minus two points, W has
  //       Betti numbers 1, 3, 2, so the cover has 1, 4, 5, 2.
  //   { universal: true }  three points on RP²: forgetting a point is a fibration over
  //       Conf₂(RP²) ≃ S³/Q₈ with aspherical fibre, so the universal cover is ≃ S³ while π₁ is
  //       infinite; a manifold of dimension at most three whose universal cover has H₃ ≠ 0 is closed,
  //       with finite π₁.
  // (Two points on RP² have a picture: Conf₂(RP²) ≃ S³/Q₈, see projectivePair; two or three on S²
  // too, see chordOf and frame3. From four on, S² has b₄ ≠ 0.)
  function noPicture(id, k) {
    if (k < 2 || picture(id, k) || dimOf(id) === 1) return null;
    const b = bettiReduced(id, k);
    for (let i = 4; i < b.length; i++) if (b[i]) return { betti: [i, b[i]] };
    if (b[3] >= 2) return { betti: [3, b[3]] };
    if (k === 3 && TRANSLATE.has(id)) {
      const torsion = id === 'torus' ? 9 : 3;
      const chi = falling(SURFACES[id].chi - 1, 2);
      return { chi, chiUnordered: torsion * chi / 6 };
    }
    if (id === 'klein' && k === 2) return { klein: true };
    if (id === 'projective' && k === 3) return { universal: true };
    throw new Error('no reason known for ' + id + ', ' + k + ' points');
  }

  root.ConfSpaces = {
    SURFACES, NOT_ASPHERICAL, surface, classesFor, dimOf, ONE,
    cubePoint, cubePlanes, spherePoint, sphereCircle,
    bettiUnordered, bettiOrdered, bettiQuotient, groupOf, groupsOf,
    setPartitions, intPartitions, typeOf, partKey, strata,
    chiOrdered, chiUnordered, chiStratum, chiFromBetti, falling,
    neighbours, wrap, dist, near, toward,
    onSphere, onSphereUnordered, point3, collisionCurves, relative, mobiusPair, picture,
    TRANSLATE, bettiReduced, noPicture, frameOf, quatOf, qmul, Q8, dicyclic, toPrism, prism, projectivePair,
    chordOf, chordDisc, frame3, ballOf, rotationPoint, across,
    // for the tests
    unorderedComplex: (id, k) => unorderedComplex(surface(id), k),
    orderedComplex: (id, k) => orderedComplex(surface(id), k),
    homology, rank, PRIME,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
