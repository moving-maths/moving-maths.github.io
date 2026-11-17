// Dynkin diagrams: the mathematics, with no drawing.
//
// A diagram is a generalized Cartan matrix A = (a_ij), a_ij = <α_i^∨, α_j>:
// a_ii = 2, a_ij ≤ 0 off the diagonal, and a_ij = 0 exactly when a_ji = 0.
// When α_i and α_j have lengths, a_ij / a_ji = (α_j, α_j) / (α_i, α_i), so in a
// bond the larger of |a_ij|, |a_ji| belongs to the shorter root.
// A bond may also carry a label m, as in a Coxeter diagram, for m = 5 or 7 ≤ m ≤ 12:
// then a_ij = a_ji = −2 cos(π/m), which is not an integer. The reflections still
// generate a Coxeter group, in which s_i s_j has order m.
//
//   describe(A)        the type of each connected component, with its name
//   realRoots(A, H)    the positive real roots up to height H (integer A only)
//   positiveRoots(A)   the positive roots of a diagram of finite type
//   finiteData(A)      roots, exponents, Coxeter number, order of the Weyl group
//   preset(name)       the matrix of a diagram by its name (as describe gives it), and
//                      a layout for it
//
// Names: [letter, n] for a finite type, [letter, n, r] for X_n^(r), ['I', 2, 0, m] for
// I_2(m); past the finite and affine types, ['E', n] for E_n (n ≥ 10), ['T', p, q, r]
// for the other trees with three legs, of p ≤ q ≤ r nodes counting the middle one, and
// ['[', m_1, …, m_k] for a path with a label, in Coxeter's notation [m_1, …, m_k]
// (m_i the order of s_i s_{i+1}).
//
// Also used by test/dynkin-diagrams.test.mjs, so it touches no DOM.
(function (G) {
  'use strict';

  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
  const sub = (A, idx) => idx.map((i) => idx.map((j) => A[i][j]));
  const without = (A, k) => sub(A, range(A.length).filter((i) => i !== k));
  const transpose = (A) => A.map((_, i) => A.map((row) => row[i]));

  // Bonds labelled m: a_ij = a_ji = −2 cos(π/m), for the m that no integer matrix gives.
  const LABELS = [5, 7, 8, 9, 10, 11, 12];
  const labelEntry = (m) => -2 * Math.cos(Math.PI / m);
  // the label of an entry, or 0 for an integer
  const labelOf = (a) => (Number.isInteger(a) ? 0 : LABELS.find((m) => Math.abs(a - labelEntry(m)) < 1e-9) || 0);
  const integral = (A) => A.every((row) => row.every(Number.isInteger));

  function isCartan(A) {
    const n = A.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = A[i][j];
      if ((i === j ? a !== 2 : a > 0) || (a === 0) !== (A[j][i] === 0)) return false;
      if (!Number.isInteger(a) && !(labelOf(a) && labelOf(A[j][i]) === labelOf(a))) return false;
    }
    return true;
  }

  // the connected components of the diagram, as lists of indices
  function components(A) {
    const n = A.length, seen = new Array(n).fill(false), out = [];
    for (let s = 0; s < n; s++) {
      if (seen[s]) continue;
      const part = [], stack = [s];
      seen[s] = true;
      while (stack.length) {
        const i = stack.pop();
        part.push(i);
        for (let j = 0; j < n; j++) if (j !== i && A[i][j] && !seen[j]) { seen[j] = true; stack.push(j); }
      }
      out.push(part.sort((a, b) => a - b));
    }
    return out;
  }

  // The determinant of an integer matrix, exactly (Bareiss, in BigInt).
  function det(M) {
    const n = M.length, a = M.map((row) => row.map(BigInt));
    if (!n) return 1n;
    let sign = 1n, prev = 1n;
    for (let k = 0; k < n - 1; k++) {
      if (a[k][k] === 0n) {
        const r = range(n).find((i) => i > k && a[i][k] !== 0n);
        if (r === undefined) return 0n;
        [a[k], a[r]] = [a[r], a[k]];
        sign = -sign;
      }
      for (let i = k + 1; i < n; i++) for (let j = k + 1; j < n; j++) a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / prev;
      prev = a[k][k];
    }
    return sign * a[n - 1][n - 1];
  }

  // The determinant of a matrix with labels. When every label is 5 its entries are in
  // Z[τ], τ = 2 cos(π/5) = (1 + √5)/2, and so is the determinant: then also
  // `tau`, [a, b] for a + bτ, exactly (Bareiss, in BigInt, dividing in Q(√5)).
  function detLabelled(M) {
    const n = M.length;
    if (M.every((row) => row.every((x) => Number.isInteger(x) || labelOf(x) === 5))) {
      const mul = ([a, b], [c, d]) => [a * c + b * d, a * d + b * c + b * d]; // τ² = τ + 1
      // x / y, when it is in Z[τ]: x ȳ / N(y), with ȳ = (c + d) − dτ and N(y) = c² + cd − d²
      const div = (x, [c, d]) => { const N = c * c + c * d - d * d, [p, q] = mul(x, [c + d, -d]); return [p / N, q / N]; };
      const zero = ([a, b]) => !a && !b;
      const a = M.map((row) => row.map((x) => (Number.isInteger(x) ? [BigInt(x), 0n] : [0n, -1n])));
      let sign = 1n, prev = [1n, 0n], out = [1n, 0n];
      for (let k = 0; k < n - 1; k++) {
        if (zero(a[k][k])) {
          const r = range(n).find((i) => i > k && !zero(a[i][k]));
          if (r === undefined) { out = [0n, 0n]; break; }
          [a[k], a[r]] = [a[r], a[k]];
          sign = -sign;
        }
        for (let i = k + 1; i < n; i++) for (let j = k + 1; j < n; j++) {
          const [p, q] = mul(a[i][j], a[k][k]), [r, t] = mul(a[i][k], a[k][j]);
          a[i][j] = div([p - r, q - t], prev);
        }
        prev = a[k][k];
      }
      if (n && out[0] + out[1] !== 0n) out = [sign * a[n - 1][n - 1][0], sign * a[n - 1][n - 1][1]];
      const tau = out.map(Number);
      return { det: tau[0] + tau[1] * (1 + Math.sqrt(5)) / 2, detTau: tau };
    }
    // otherwise in floating point (Gaussian elimination)
    const a = M.map((row) => row.slice());
    let det = 1;
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
      if (Math.abs(a[p][k]) < 1e-12) return { det: 0, detTau: null };
      if (p !== k) { [a[k], a[p]] = [a[p], a[k]]; det = -det; }
      det *= a[k][k];
      for (let i = k + 1; i < n; i++) { const f = a[i][k] / a[k][k]; for (let j = k; j < n; j++) a[i][j] -= f * a[k][j]; }
    }
    return { det, detTau: null };
  }

  // Positive integers d_i, the smallest on each component, with d_i a_ij = d_j a_ji:
  // then (α_i, α_j) = d_i a_ij is a symmetric form with (α_i, α_i) = 2 d_i. null
  // when there are none: round some cycle the products of the a_ij differ.
  function symmetrize(A) {
    const n = A.length, d = new Array(n).fill(null);
    for (const part of components(A)) {
      // d as fractions num/den, spreading from the first node of the component
      const num = {}, den = {}, stack = [part[0]];
      num[part[0]] = 1; den[part[0]] = 1;
      while (stack.length) {
        const i = stack.pop();
        for (const j of part) {
          if (j === i || !A[i][j]) continue;
          // d_j = d_i a_ij / a_ji (= d_i, across a labelled bond)
          let p = num[i], q = den[i];
          if (Number.isInteger(A[i][j])) {
            p *= A[i][j]; q *= A[j][i];
            const g = gcd(p, q);
            p = Math.abs(p / g); q = Math.abs(q / g);
          }
          if (num[j] === undefined) { num[j] = p; den[j] = q; stack.push(j); } else if (num[j] !== p || den[j] !== q) return null;
        }
      }
      const l = part.reduce((m, i) => m * den[i] / gcd(m, den[i]), 1);
      const ints = part.map((i) => num[i] * l / den[i]), g = ints.reduce(gcd, 0);
      part.forEach((i, k) => { d[i] = ints[k] / g; });
    }
    return d;
  }

  // The eigenvalues of a real symmetric matrix, in increasing order, and an
  // orthonormal basis of eigenvectors in the same order (Jacobi).
  function eigen(S) {
    const n = S.length, a = S.map((row) => row.slice()), V = range(n).map((i) => range(n).map((j) => +(i === j)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
      }
    }
    const order = range(n).sort((i, j) => a[i][i] - a[j][j]);
    return { values: order.map((i) => a[i][i]), vectors: order.map((i) => V.map((row) => row[i])) };
  }
  const eigenvalues = (S) => eigen(S).values;

  // The form in the basis α_i / |α_i| (times 2): the symmetric matrix with 2 on
  // the diagonal and −√(a_ij a_ji) off it. For a symmetrizable A it is conjugate
  // to A, so it has the eigenvalues of A, and its signature is that of the form.
  const normalized = (A) => A.map((row, i) => row.map((x, j) => (i === j ? 2 : -Math.sqrt(x * A[j][i]))));

  const TOL = 1e-7;
  function signature(A) {
    const ev = eigenvalues(normalized(A));
    return { eigenvalues: ev, plus: ev.filter((x) => x > TOL).length, minus: ev.filter((x) => x < -TOL).length, zero: ev.filter((x) => Math.abs(x) <= TOL).length };
  }

  // positive definite: the leading principal minors of the symmetrized matrix are positive
  // (with labels, its eigenvalues, which are those of the form, are)
  function positiveDefinite(A, d) {
    if (!integral(A)) { const s = signature(A); return !s.minus && !s.zero; }
    const Gm = A.map((row, i) => row.map((x) => d[i] * x));
    return range(A.length).every((k) => det(sub(Gm, range(k + 1))) > 0n);
  }

  // For a matrix of corank 1: the primitive integer vector v with M v = 0 and
  // positive entries, read off a row of cofactors.
  function kernel(M) {
    const n = M.length;
    for (let k = 0; k < n; k++) {
      const rows = range(n).filter((i) => i !== k);
      const v = range(n).map((j) => Number((((k + j) % 2) ? -1n : 1n) * det(rows.map((i) => range(n).filter((c) => c !== j).map((c) => M[i][c])))));
      if (v.every((x) => x === 0)) continue;
      const g = v.reduce(gcd, 0), s = v.find((x) => x) > 0 ? 1 : -1;
      return v.map((x) => s * x / g);
    }
    return null;
  }

  /* ---------- names ---------- */

  const bonds = (A) => { const out = []; for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) if (A[i][j]) out.push({ i, j, a: -A[i][j], b: -A[j][i] }); return out; };
  // the lengths of the legs at a node of a tree
  function legs(A, at) {
    const out = [];
    for (let j = 0; j < A.length; j++) {
      if (j === at || !A[at][j]) continue;
      let len = 1, prev = at, cur = j;
      for (;;) {
        const next = range(A.length).filter((k) => k !== cur && k !== prev && A[cur][k]);
        if (next.length !== 1) { if (next.length) return null; break; }
        prev = cur; cur = next[0]; len++;
      }
      out.push(len);
    }
    return out.sort((x, y) => x - y);
  }
  const degree = (A, i) => A[i].filter((x, j) => j !== i && x).length;

  // The name of a connected diagram of finite type: [letter, rank], or ['I', 2, 0, m]
  // for I_2(m). With a label it is H_3, H_4 or I_2(m) (Humphreys, §2.7).
  function finiteName(A) {
    const n = A.length, bs = bonds(A), multiple = bs.filter((b) => b.a * b.b > 1);
    const labelled = bs.find((b) => !Number.isInteger(b.a));
    if (labelled) return n === 2 ? ['I', 2, 0, labelOf(-labelled.a)] : ['H', n];
    if (!multiple.length) {
      const fork = range(n).filter((i) => degree(A, i) === 3);
      if (!fork.length) return ['A', n];
      const l = legs(A, fork[0]);
      if (l[0] === 1 && l[1] === 1) return ['D', n];
      return ['E', n];
    }
    const m = multiple[0];
    if (m.a * m.b === 3) return ['G', 2];
    if (n === 2) return ['B', 2];
    // a double bond: at an end of the path (B or C), or in the middle of F4
    const end = degree(A, m.i) === 1 ? m.i : degree(A, m.j) === 1 ? m.j : -1;
    if (end < 0) return ['F', 4];
    // |a_end,other| = 2: the end root is the short one, as in B_n
    return [(end === m.i ? m.a : m.b) === 2 ? 'B' : 'C', n];
  }

  // The name of a connected diagram of affine type: [letter, index, tier],
  // for X_index^(tier) in Kac's notation. `marks` is δ, `comarks` its dual.
  // A node with both marks 1 can serve as α_0; without it the diagram has the
  // type of the finite one that is left, and δ − α_0 is its highest root (tier
  // 1) or its highest short root (tier 2 or 3). Only A_2l^(2) has no such node.
  function affineName(A, d, marks, comarks) {
    const n = A.length, zero = range(n).find((i) => marks[i] === 1 && comarks[i] === 1);
    if (zero === undefined) return ['A', 2 * (n - 1), 2];
    const rest = range(n).filter((i) => i !== zero), F = sub(A, rest), [letter, l] = finiteName(F);
    const theta = rest.map((i) => marks[i]), dF = rest.map((i) => d[i]);
    let norm = 0;
    for (let i = 0; i < l; i++) for (let j = 0; j < l; j++) norm += theta[i] * theta[j] * dF[i] * F[i][j];
    if (norm === 2 * Math.max(...dF)) return [letter === 'B' && l === 2 ? 'C' : letter, l, 1];
    return { B: ['D', l + 1, 2], C: ['A', 2 * l - 1, 2], F: ['E', 6, 2], G: ['D', 4, 3] }[letter];
  }

  // A path with a label: the orders m of s_i s_{i+1} along it (a label m; 3, 4, 6 or ∞
  // for a bond of 1, 2, 3 or more lines), from the end that gives the larger list; else null.
  function coxeterPath(A) {
    const n = A.length;
    if (n < 2 || bonds(A).length !== n - 1 || range(n).some((i) => degree(A, i) > 2)) return null;
    const order = [range(n).find((i) => degree(A, i) === 1)];
    while (order.length < n) { const i = order[order.length - 1]; order.push(range(n).find((j) => j !== i && !order.includes(j) && A[i][j])); }
    const m = order.slice(1).map((j, k) => { const i = order[k], p = A[i][j] * A[j][i]; return labelOf(A[i][j]) || (p === 1 ? 3 : p === 2 ? 4 : p === 3 ? 6 : Infinity); });
    const r = m.slice().reverse(), k = m.findIndex((x, t) => x !== r[t]);
    return k < 0 || m[k] > r[k] ? m : r;
  }

  const tex = (name) => (name[0] === 'T' ? '\\mathrm{T}_{' + name.slice(1).join(',') + '}'
    : name[0] === '[' ? '[' + name.slice(1).map((m) => (m === Infinity ? '\\infty' : m)).join(',') + ']'
      : '\\mathrm{' + name[0] + '}_{' + name[1] + '}' + (name[3] ? '(' + name[3] + ')' : name[2] ? '^{(' + name[2] + ')}' : ''));
  const plain = (name) => (name[0] === 'T' ? 'T' + name.slice(1).join(',')
    : name[0] === '[' ? '[' + name.slice(1).map((m) => (m === Infinity ? '∞' : m)).join(',') + ']'
      : name[0] + name[1] + (name[3] ? '[' + name[3] + ']' : name[2] ? '(' + name[2] + ')' : ''));

  /* ---------- types ---------- */

  // A connected diagram: { family, symmetrizable, name, … }. family is
  // 'finite', 'affine', 'hyperbolic' or 'indefinite' (Kac, Theorem 4.3 and
  // §5.10): finite when the form is positive definite; affine when it is
  // positive semidefinite of corank 1; hyperbolic when it is neither but every
  // proper connected subdiagram is finite or affine.
  // finite, affine or neither, for a connected diagram with its d
  function kind(A, d) {
    if (!d) return 'other';
    if (positiveDefinite(A, d)) return 'finite';
    // (a diagram with a label is never affine: the affine Coxeter diagrams have the labels 3, 4, 6 and ∞ only)
    if (!integral(A)) return 'other';
    const n = A.length;
    return det(A) === 0n && range(n).every((k) => positiveDefinite(without(A, k), d.filter((_, i) => i !== k))) ? 'affine' : 'other';
  }
  function classify(A) {
    const n = A.length, d = symmetrize(A), whole = integral(A);
    const out = Object.assign({ rank: n, symmetrizable: !!d, d, labelled: !whole, name: null }, whole ? { det: Number(det(A)) } : detLabelled(A));
    if (!d) return Object.assign(out, { family: 'indefinite' });
    Object.assign(out, signature(A));
    const k = kind(A, d);
    if (k === 'finite') {
      out.family = 'finite';
      out.name = finiteName(A);
    } else if (k === 'affine') {
      out.family = 'affine';
      out.marks = kernel(A);
      out.comarks = kernel(transpose(A));
      out.name = affineName(A, d, out.marks, out.comarks);
    } else {
      // which nodes can be removed leaving only finite and affine pieces
      out.bad = range(n).filter((k) => { const B = without(A, k), dB = d.filter((_, i) => i !== k); return !components(B).every((part) => kind(sub(B, part), part.map((i) => dB[i])) !== 'other'); });
      out.family = out.bad.length ? 'indefinite' : 'hyperbolic';
      // the diagrams E_n continue past E_8 and E_8^(1) = E_9, among the trees T_{p,q,r} with three legs
      if (whole && bonds(A).every((b) => b.a * b.b === 1) && bonds(A).length === n - 1) {
        const fork = range(n).filter((i) => degree(A, i) === 3);
        const l = fork.length === 1 && range(n).every((i) => degree(A, i) <= 3) ? legs(A, fork[0]) : null;
        if (l) out.name = l[0] === 1 && l[1] === 2 ? ['E', n] : ['T', l[0] + 1, l[1] + 1, l[2] + 1];
      }
      // a path with a label, in Coxeter's notation
      const m = whole ? null : coxeterPath(A);
      if (m) out.name = ['['].concat(m);
    }
    out.lorentzian = out.minus === 1 && out.zero === 0;
    if (out.name) { out.tex = tex(out.name); out.plain = plain(out.name); }
    return out;
  }

  // Any diagram: its components, each with its nodes and its type.
  function describe(A) {
    if (!isCartan(A)) throw new Error('not a generalized Cartan matrix');
    const parts = components(A).map((nodes) => Object.assign(classify(sub(A, nodes)), { nodes }));
    const order = ['finite', 'affine', 'hyperbolic', 'indefinite'];
    return { parts, family: parts.length ? order[Math.max(...parts.map((p) => order.indexOf(p.family)))] : 'finite' };
  }

  /* ---------- roots ---------- */

  // The positive real roots of height at most H, by height: the orbit of the
  // simple roots under the simple reflections s_i(β) = β − <α_i^∨, β> α_i,
  // climbing. Stops after `cap` roots; `upTo` is the last height that is complete.
  function realRoots(A, H, cap) {
    const n = A.length, key = (c) => c.join(','), seen = new Set(), levels = [[]];
    const add = (c, h) => { const k = key(c); if (seen.has(k)) return; seen.add(k); (levels[h] = levels[h] || []).push(c); };
    range(n).forEach((i) => add(range(n).map((j) => +(i === j)), 1));
    let count = 0, upTo = 0, cut = false;
    for (let h = 1; h < levels.length && h <= H; h++) {
      const level = levels[h] || [];
      count += level.length;
      if (count > (cap || Infinity)) { cut = true; break; }
      upTo = h;
      for (const c of level) {
        for (let i = 0; i < n; i++) {
          let p = 0;
          for (let j = 0; j < n; j++) p += A[i][j] * c[j];
          if (p >= 0) continue;
          if (h - p > H) { cut = true; continue; } // s_i(c) = c − p α_i is higher by −p
          const b = c.slice();
          b[i] -= p;
          add(b, h - p);
        }
      }
    }
    const done = levels.slice(0, upTo + 1);
    // complete: nothing was left out, so these are all the positive real roots
    return { levels: done, heights: Array.from(done, (l) => (l ? l.length : 0)), upTo, complete: !cut };
  }

  // The positive roots of a diagram of finite type, as lists of coefficients (real
  // numbers, with labels): the orbit of the simple roots under the reflections,
  // climbing, in order of the sum of the coefficients.
  const rootKey = (c) => c.map((x) => Math.round(x * 1e6) / 1e6).join(',');
  function positiveRoots(A, cap) {
    if (integral(A)) return realRoots(A, Infinity, cap || 1000).levels.flat();
    const n = A.length, seen = new Map(), list = [];
    const add = (c) => { const k = rootKey(c); if (!seen.has(k)) { seen.set(k, c); list.push(c); } };
    range(n).forEach((i) => add(range(n).map((j) => +(i === j))));
    for (let q = 0; q < list.length && list.length <= (cap || 1000); q++) {
      const c = list[q];
      for (let i = 0; i < n; i++) {
        let p = 0;
        for (let j = 0; j < n; j++) p += A[i][j] * c[j];
        if (p > -1e-9) continue;
        const b = c.slice();
        b[i] -= p;
        add(b);
      }
    }
    const sum = (c) => c.reduce((t, x) => t + x, 0);
    return list.sort((x, y) => sum(x) - sum(y));
  }

  // c = the product of the simple reflections, those of one colour of the tree first
  // (see coxeter below), as a matrix on orthonormal coordinates: the rows of E are the
  // simple roots, with Gram matrix the symmetrized A.
  function coxeterMatrix(A) {
    const n = A.length, d = symmetrize(A), E = cholesky(A.map((row, i) => row.map((x) => d[i] * x)));
    const colour = new Array(n).fill(-1), stack = [0];
    colour[0] = 0;
    while (stack.length) {
      const i = stack.pop();
      for (let j = 0; j < n; j++) if (j !== i && A[i][j] && colour[j] < 0) { colour[j] = 1 - colour[i]; stack.push(j); }
    }
    const dotv = (u, v) => u.reduce((t, x, i) => t + x * v[i], 0);
    const times = (X, Y) => X.map((row) => range(n).map((j) => row.reduce((t, x, k) => t + x * Y[k][j], 0)));
    const matrix = (k) => {
      let M = range(n).map((i) => range(n).map((j) => +(i === j)));
      for (let i = 0; i < n; i++) {
        if (colour[i] !== k) continue;
        const r = E[i], rr = dotv(r, r);
        M = times(M, range(n).map((a) => range(n).map((b) => +(a === b) - 2 * r[a] * r[b] / rr)));
      }
      return M;
    };
    const Ma = matrix(0);
    return { E, colour, Ma, C: times(Ma, matrix(1)) };
  }

  // A connected diagram of finite type: its roots and the numbers read off them.
  // The exponents are the partition dual to the numbers of roots of each height;
  // with labels, where there are no heights, they are read off the eigenvalues
  // exp(2πi m / h) of c, and h = 2N / n for N positive roots.
  function finiteData(A) {
    if (!integral(A)) {
      const n = A.length, pos = positiveRoots(A), h = 2 * pos.length / n, { C } = coxeterMatrix(A);
      // c + c⁻¹ has the eigenvalue 2 cos(2πm/h) twice for each pair m, h − m of exponents, and once for m = h/2
      const ms = eigenvalues(C.map((row, i) => row.map((x, j) => x + C[j][i]))).map((v) => Math.round(h * Math.acos(Math.max(-1, Math.min(1, v / 2))) / (2 * Math.PI)));
      const exponents = [];
      ms.sort((x, y) => x - y);
      for (let k = 0, l = 0; k < ms.length; k = l) {
        while (l < ms.length && ms[l] === ms[k]) l++;
        for (let t = k; t < l; t += 2) { if (2 * ms[k] === h) exponents.push(ms[k], ms[k]); else exponents.push(ms[k], h - ms[k]); }
        if ((l - k) % 2) exponents.pop(); // (an odd count: m = h/2 once)
      }
      exponents.sort((x, y) => x - y);
      return {
        positive: pos.length, roots: 2 * pos.length, heights: null, exponents, coxeter: h,
        order: exponents.reduce((p, m) => p * BigInt(m + 1), 1n), highest: null, highestShort: null, long: pos.length, short: 0,
      };
    }
    const n = A.length, r = realRoots(A, Infinity, 1000), heights = r.heights.slice(1), d = symmetrize(A);
    const exponents = range(n).map((i) => heights.filter((k) => k > i).length).sort((x, y) => x - y);
    const norm = (c) => { let t = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) t += c[i] * c[j] * d[i] * A[i][j]; return t; };
    const all = r.levels.flat(), long = Math.max(...d) * 2, short = all.filter((c) => norm(c) < long);
    return {
      positive: all.length, roots: 2 * all.length, heights, exponents, coxeter: heights.length + 1,
      order: exponents.reduce((p, m) => p * BigInt(m + 1), 1n),
      highest: r.levels[r.levels.length - 1][0],
      highestShort: short.length ? short[short.length - 1] : null,
      long: all.length - short.length, short: short.length,
    };
  }

  /* ---------- the Coxeter element ---------- */

  // G = L Lᵗ for a positive definite G: the rows of L are vectors with Gram matrix G
  function cholesky(Gm) {
    const n = Gm.length, L = range(n).map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let t = Gm[i][j];
      for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(t) : t / L[j][j];
    }
    return L;
  }

  // A connected diagram of finite type: a Coxeter element c and the planes it
  // turns. The diagram is a tree, so its nodes take two colours with no bond
  // inside a colour; the reflections of one colour commute, their product a is
  // an involution, likewise b for the other colour, and c = a b. Then
  // a c a = c⁻¹: a and b generate a dihedral group of order 2h.
  // c has order h and eigenvalues exp(2πi m / h), m the exponents; for each
  // m ≤ h/2 that gives a real plane, `planes` has { m, u, v, w, depth }:
  //   u, v   an orthonormal basis of the plane, on which c is the rotation by
  //          2π m / h, with a(u) = −u and a(v) = v. The planes are the
  //          eigenspaces of c + c⁻¹, and m = 1 gives the Coxeter plane.
  //   w      a third direction, to see the plane in space, chosen so that as
  //          much of the dihedral group as possible keeps the span of u, v, w:
  //          the line on which c = −1 if there is one (then all of it does);
  //          or else, in another of the planes, a line that a fixes or
  //          reverses, taking the plane in which the most powers of c are ±1.
  //          In any case a keeps the span. Among lines that are as good, the
  //          one that keeps the roots furthest apart in the picture.
  //   depth  where w is: 'line', or the exponent of that plane
  //   turns  the powers k (0 < k < h) with c^k(w) = ±w
  // Also:
  //   apply(β)       c(β), in coefficients of the simple roots
  //   flip(β)        a(β)
  //   embed(β)       β in orthonormal coordinates
  //   project(P, β)  the coordinates of the projection of β to the plane P
  function coxeter(A) {
    const n = A.length, { E, colour, Ma, C } = coxeterMatrix(A);
    const dotv = (u, v) => u.reduce((t, x, i) => t + x * v[i], 0);
    const embed = (c) => range(n).map((k) => c.reduce((t, x, i) => t + x * E[i][k], 0));
    // the product of the reflections of one colour, on coefficients
    const half = (k, c) => {
      const b = c.slice();
      for (let i = 0; i < n; i++) if (colour[i] === k) { let p = 0; for (let j = 0; j < n; j++) p += A[i][j] * c[j]; b[i] -= p; }
      return b;
    };
    const apply = (c) => half(0, half(1, c));
    const act = (M, x) => M.map((row) => dotv(row, x));

    const h = finiteData(A).coxeter, e = eigen(C.map((row, i) => row.map((x, j) => x + C[j][i]))), planes = [], lines = [];
    // in the plane spanned by p and q: the unit vectors that a reverses and fixes
    // (when a is ±1 on the plane, as on the plane where c = −1 in D_n with n even, any two)
    const axes = (p, q) => {
      const ap = act(Ma, p), aq = act(Ma, q), off = 2 * dotv(p, aq), diff = dotv(p, ap) - dotv(q, aq);
      const t = 0.5 * Math.atan2(off, diff), co = Math.cos(t), si = Math.sin(t);
      return { u: p.map((x, k) => -si * x + co * q[k]), v: p.map((x, k) => co * x + si * q[k]), free: Math.hypot(off, diff) < 1e-8 };
    };
    for (let k = 0; k < n;) {
      let l = k + 1;
      while (l < n && Math.abs(e.values[l] - e.values[k]) < 1e-8) l++;
      // 2 cos(2π m / h), twice: a plane. Once: the line on which c = −1.
      if (l - k === 2) {
        planes.push(Object.assign({ m: Math.round(h * Math.acos(Math.max(-1, Math.min(1, e.values[k] / 2))) / (2 * Math.PI)) }, axes(e.vectors[k], e.vectors[k + 1])));
      } else lines.push(e.vectors[k]);
      k = l;
    }
    planes.sort((p, q) => p.m - q.m);
    const turns = (m) => range(h).filter((k) => k && ((m * k) % h === 0 || 2 * ((m * k) % h) === h));
    // the direction in the plane Q for which the roots, projected to the plane P and that direction, have the largest least distance
    const apart = (P, Q) => {
      const pos = positiveRoots(A), pts = pos.concat(pos.map((c) => c.map((x) => -x))).map((c) => { const x = embed(c); return [dotv(x, P.u), dotv(x, P.v), dotv(x, Q.u), dotv(x, Q.v)]; });
      // only pairs that are close in the plane can come close in space
      const pairs = [], near = 0.5 * Math.hypot(...E[0]);
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d2 = dx * dx + dy * dy;
        if (d2 < near * near) pairs.push([d2, pts[i][2] - pts[j][2], pts[i][3] - pts[j][3]]);
      }
      // any direction when a is ±1 on Q; otherwise the line a fixes or, if that keeps the roots further apart, the one it reverses
      const N = 360, tries = Q.free ? range(N) : [N / 2, 0];
      let best = tries[0], top = -1;
      for (const t of tries) {
        const co = Math.cos(Math.PI * t / N), si = Math.sin(Math.PI * t / N);
        let least = Infinity;
        for (const [d2, a, b] of pairs) { const z = a * co + b * si, d = d2 + z * z; if (d < least) least = d; }
        if (least > top + 1e-9) { top = least; best = t; }
      }
      const co = Math.cos(Math.PI * best / N), si = Math.sin(Math.PI * best / N);
      return Q.u.map((x, k) => co * x + si * Q.v[k]);
    };
    planes.forEach((P, i) => {
      P.w = null; P.depth = null; P.turns = [];
      if (lines.length) { P.w = lines[0]; P.depth = 'line'; P.turns = range(h).slice(1); return; }
      for (let t = 1; t < planes.length; t++) {
        const Q = planes[(i + t) % planes.length], ks = turns(Q.m);
        if (!P.w || ks.length > P.turns.length) { P.w = Q.v; P.depth = Q.m; P.turns = ks; P.from = Q; }
      }
      // Among the directions of that plane that are as good, the one that keeps the roots furthest apart in the picture.
      if (P.from) P.w = apart(P, P.from);
    });
    return { h, apply, flip: (c) => half(0, c), embed, planes, matrix: C, project: (P, c) => { const x = embed(c); return [dotv(x, P.u), dotv(x, P.v)]; } };
  }

  // The pairs of roots nearest to each other, as pairs of indices into `roots`
  // (lists of coefficients): in a simply laced system, the pairs at 60°.
  function nearest(A, roots) {
    const n = A.length, d = symmetrize(A), Gm = A.map((row, i) => row.map((x) => d[i] * x)), out = [];
    let best = Infinity;
    for (let a = 0; a < roots.length; a++) for (let b = a + 1; b < roots.length; b++) {
      let t = 0;
      for (let i = 0; i < n; i++) { const x = roots[a][i] - roots[b][i]; if (x) for (let j = 0; j < n; j++) t += x * (roots[a][j] - roots[b][j]) * Gm[i][j]; }
      if (t < best - 1e-9) { best = t; out.length = 0; }
      if (Math.abs(t - best) <= 1e-9) out.push([a, b]);
    }
    return out;
  }

  /* ---------- the classical diagrams ---------- */

  // The diagrams the page offers, by name as classify gives it: a finite type
  // [letter, n] in Bourbaki's numbering (also E_n for n > 8), an affine one
  // [letter, n, r] for X_n^(r) with α_0 first (Kac's numbering), H_3 and H_4 with
  // the label between α_1 and α_2, ['I', 2, 0, m], T_{p,q,r} and a path [m_1, …].
  // With places for the nodes on a grid (x to the right, y down), one unit for a
  // bond. preset(type, n) for a finite type also works.
  function preset(type, n, tier, m) {
    const name = Array.isArray(type) ? type : [type, n, tier, m];
    if (name[0] === 'T') return treePreset(name[1], name[2], name[3]);
    if (name[0] === '[') return pathPreset(name.slice(1));
    [type, n, tier, m] = name;
    if (tier) return affinePreset(type, n, tier);
    const A = range(n).map((i) => range(n).map((j) => (i === j ? 2 : 0)));
    if (type === 'H' || type === 'I') {
      for (let i = 0; i + 1 < n; i++) A[i][i + 1] = A[i + 1][i] = -1;
      A[0][1] = A[1][0] = labelEntry(type === 'H' ? 5 : m);
      return { A, pos: range(n).map((i) => [i, 0]) };
    }
    const join = (i, j, a, b) => { A[i][j] = -(a || 1); A[j][i] = -(b || 1); };
    let pos = range(n).map((i) => [i, 0]);
    if (type === 'A' || type === 'B' || type === 'C' || type === 'F' || type === 'G') {
      for (let i = 0; i + 1 < n; i++) join(i, i + 1);
      if (type === 'B') join(n - 2, n - 1, 1, 2);       // α_n short
      if (type === 'C') join(n - 2, n - 1, 2, 1);       // α_n long
      if (type === 'F') join(1, 2, 1, 2);               // α_3, α_4 short
      if (type === 'G') join(0, 1, 3, 1);               // α_1 short
    } else if (type === 'D') {
      for (let i = 0; i + 2 < n; i++) join(i, i + 1);
      join(n - 3, n - 1);
      pos = range(n).map((i) => (i < n - 2 ? [i, 0] : [n - 2.3, i === n - 2 ? -0.75 : 0.75]));
    } else if (type === 'E') {
      // α_1 − α_3 − α_4 − … − α_n, with α_2 on α_4
      join(0, 2); join(1, 3);
      for (let i = 2; i + 1 < n; i++) join(i, i + 1);
      pos = range(n).map((i) => (i === 0 ? [0, 0] : i === 1 ? [2, -1] : [i - 1, 0]));
    } else throw new Error('unknown type ' + type);
    return { A, pos };
  }

  // T_{p,q,r}: legs of p − 1, q − 1 and r − 1 nodes on a middle one, the second to its left,
  // the third to its right and the first above it; numbered along the row, then upwards.
  function treePreset(p, q, r) {
    const n = p + q + r - 2, A = range(n).map((i) => range(n).map((j) => (i === j ? 2 : 0))), pos = [];
    const join = (i, j) => { A[i][j] = A[j][i] = -1; };
    for (let i = 0; i < q + r - 1; i++) { pos.push([i - (q - 1), 0]); if (i) join(i - 1, i); }
    for (let k = 1; k < p; k++) { pos.push([0, -k]); join(k === 1 ? q - 1 : q + r - 3 + k, q + r - 2 + k); }
    return { A, pos };
  }
  // A path in a row, with the orders m of s_i s_{i+1}: a label for m = 5 or 7 ≤ m ≤ 12, else a
  // bond of 1, 2, 3 lines for m = 3, 4, 6 (the arrow to α_i), and a double bond both ways for ∞.
  function pathPreset(ms) {
    const n = ms.length + 1, A = range(n).map((i) => range(n).map((j) => (i === j ? 2 : 0)));
    ms.forEach((m, i) => {
      if (LABELS.includes(m)) { A[i][i + 1] = A[i + 1][i] = labelEntry(m); return; }
      const [a, b] = m === 3 ? [1, 1] : m === 4 ? [2, 1] : m === 6 ? [3, 1] : [2, 2];
      A[i][i + 1] = -a; A[i + 1][i] = -b;
    });
    return { A, pos: range(n).map((i) => [i, 0]) };
  }

  // α_0 added to a finite Cartan matrix F as δ − θ, θ a positive root given by its
  // coefficients: a_0j = −2(θ, α_j)/(θ, θ) and a_j0 = −2(α_j, θ)/(α_j, α_j).
  function extend(F, theta) {
    const n = F.length, d = symmetrize(F), B = (u, v) => { let t = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) t += u[i] * v[j] * d[i] * F[i][j]; return t; };
    const e = (i) => range(n).map((j) => +(i === j)), tt = B(theta, theta);
    const row = range(n).map((j) => -2 * B(theta, e(j)) / tt + 0), col = range(n).map((j) => -2 * B(e(j), theta) / B(e(j), e(j)) + 0);
    return [[2].concat(row)].concat(F.map((r, j) => [col[j]].concat(r)));
  }

  // The affine diagram X_n^(r) (Kac, Tables Aff 1–3): the finite diagram with α_0 = δ − θ,
  // θ its highest root (r = 1) or its highest short root (r = 2, 3), except A_2l^(2).
  function affinePreset(type, n, tier) {
    const row = (k, from) => range(k).map((i) => [i + (from || 0), 0]);
    const fork = (k) => [[0.3, -0.75], [0.3, 0.75]].concat(range(k - 1).map((i) => [i + 1, 0])); // α_0, α_1 both on α_2
    if (type === 'A' && tier === 2 && n % 2 === 0) {
      // A_2l^(2): α_0 ⇐ α_1 − … − α_{l−1} ⇐ α_l, and for l = 1 a quadruple bond
      const l = n / 2, A = range(l + 1).map((i) => range(l + 1).map((j) => (i === j ? 2 : Math.abs(i - j) === 1 ? -1 : 0)));
      if (l === 1) A[0][1] = -4; else { A[0][1] = -2; A[l - 1][l] = -2; }
      return { A, pos: row(l + 1) };
    }
    const base = tier === 1 ? [type, n] : type === 'A' ? ['C', (n + 1) / 2] : type === 'D' ? (tier === 3 ? ['G', 2] : ['B', n - 1]) : ['F', 4];
    const F = preset(base[0], base[1]).A, f = finiteData(F), A = extend(F, tier === 1 ? f.highest : f.highestShort), l = F.length;
    let pos;
    if (tier === 1 && type === 'A') {
      // a polygon, α_0 at the top
      pos = l === 1 ? row(2) : range(l + 1).map((i) => { const t = -Math.PI / 2 - 2 * Math.PI * i / (l + 1), r = 0.5 / Math.sin(Math.PI / (l + 1)); return [r * Math.cos(t), r * Math.sin(t)]; });
    } else if ((tier === 1 && type === 'B') || (tier === 2 && type === 'A')) pos = fork(l);
    else if (tier === 1 && type === 'D') pos = fork(l - 2).concat([[l - 2.3, -0.75], [l - 2.3, 0.75]]);
    else if (tier === 1 && type === 'E') {
      // as E_n in preset, with α_0 at the end of the arm θ is joined to
      const P = preset('E', l).pos;
      pos = [l === 6 ? [2, -2] : l === 7 ? [-1, 0] : [7, 0]].concat(P);
    } else if (tier === 1 && type === 'G') pos = [[0, 0], [2, 0], [1, 0]];
    else if (tier === 2 && type === 'E') pos = [[4, 0]].concat(row(4));
    else pos = row(l + 1); // C_l^(1), F_4^(1), D_{l+1}^(2), D_4^(3)
    return { A, pos };
  }

  G.Dynkin = {
    isCartan, components, det, symmetrize, eigenvalues, normalized, signature, kernel, bonds,
    finiteName, classify, describe, realRoots, positiveRoots, rootKey, finiteData, coxeter, nearest, eigen, preset, extend, tex, plain, sub, without, transpose,
    LABELS, labelEntry, labelOf, integral, detLabelled,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
