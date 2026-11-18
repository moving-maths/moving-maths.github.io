// Independent checks of the mathematics in content/stokes-phenomenon/stokes.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../content/stokes-phenomenon/stokes.js';

const St = globalThis.Stokes;
const TAU = 2 * Math.PI;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const close = (a, b, tol, what) => assert.ok(St.abs(St.sub(a, b)) <= tol * Math.max(1, St.abs(b)), `${what}: ${a} vs ${b}`);

// Ai(z) from its power series, which converges everywhere (for |z| ≤ 2 in a few dozen terms)
function airyAi(z) {
  const c1 = 0.355028053887817239, c2 = 0.258819403792806798;
  let f = [1, 0], g = [z, 0], tf = [1, 0], tg = [z, 0];
  const z3 = z * z * z;
  for (let k = 1; k < 60; k++) {
    tf = St.scl(tf, z3 / ((3 * k - 1) * (3 * k)));
    tg = St.scl(tg, z3 / ((3 * k) * (3 * k + 1)));
    f = St.add(f, tf);
    g = St.add(g, tg);
  }
  return c1 * f[0] - c2 * g[0];
}
// random distinct critical points in the unit square, not too close
function randomCrit(n) {
  for (;;) {
    const c = Array.from({ length: n }, () => [2 * rnd() - 1, 2 * rnd() - 1]);
    let ok = true;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (Math.hypot(c[a][0] - c[b][0], c[a][1] - c[b][1]) < 0.3) ok = false;
    if (ok) return c;
  }
}

test('the action has the given critical points, and S(0) = 0', () => {
  for (let trial = 0; trial < 20; trial++) {
    const crit = randomCrit(2 + (trial % 3)), act = St.action(crit);
    assert.equal(act.m, crit.length + 1);
    close(St.evalS(act, [0, 0]), [0, 0], 1e-14, 'S(0)');
    for (const p of crit) close(St.evalDS(act, p), [0, 0], 1e-12, 'S\'(p)');
    // the leading coefficient 1/m
    close(act.s[act.m], [1 / act.m, 0], 1e-14, 'leading');
  }
});

test('the series of the quartic and of Airy\'s integral agree with their closed forms', () => {
  // ∫ e^{−(x²/2 + x⁴/4)/ħ}: a_k = (−1)^k (4k−1)!! / (4^k k!)
  const q = St.action([[0, 0], [0, 1], [0, -1]]), a = St.series(q, 0, 40);
  let df = 1, fact = 1;
  for (let k = 1; k <= 40; k++) {
    df *= (4 * k - 1) * (4 * k - 3);
    fact *= k;
    const want = ((k % 2 ? -1 : 1) * df) / (4 ** k * fact);
    close(a[k], [want, 0], 1e-12, 'quartic a_' + k);
  }
  // x³/3 − x at x = 1: a_k = u_k (3/2)^k, u_k = Γ(3k + ½) / (54^k k! Γ(k + ½)); at x = −1 with (−1)^k
  const ai = St.action([[-1, 0], [1, 0]]), b = St.series(ai, 1, 30), c = St.series(ai, 0, 30);
  for (let k = 1; k <= 30; k++) {
    const u = Math.exp(St.lgamma(3 * k + 0.5) - k * Math.log(54) - St.lgamma(k + 1) - St.lgamma(k + 0.5)) * 1.5 ** k;
    close(b[k], [u, 0], 1e-10, 'Airy a_' + k);
    close(c[k], [(k % 2 ? -1 : 1) * u, 0], 1e-10, 'Airy at −1, a_' + k);
  }
});

test('the integral over Airy\'s thimble is 2πi ħ^{1/3} Ai(ħ^{−2/3})', () => {
  // S = x³/3 − x: the thimble of −1 runs from the valley at 2π/3 to the one at 4π/3 (ħ > 0),
  // that is Airy's path; downwards it gives −2πi ħ^{1/3} Ai(ħ^{−2/3})
  const ai = St.action([[-1, 0], [1, 0]]);
  for (const h of [1, 0.6, 0.35]) {
    const r = St.integral(ai, 0, [h, 0], [0, -1]);
    const I = St.mul(St.cexp(r.e), r.v);
    close(I, [0, -TAU * Math.cbrt(h) * airyAi(Math.pow(h, -2 / 3))], 1e-11, 'ħ = ' + h);
  }
});

test('the quartic integral over the real line, by quadrature', () => {
  const q = St.action([[0, 0], [0, 1], [0, -1]]);
  for (const h of [0.5, 0.2, 0.08]) {
    // the trapezoid rule on the real line, which converges fast for this integrand
    let s = 0;
    const dx = 0.002;
    for (let x = -12; x <= 12; x += dx) s += Math.exp(-(x * x / 2 + x ** 4 / 4) / h) * dx;
    const r = St.integral(q, 0, [h, 0], [1, 0]);
    close(St.mul(St.cexp(r.e), r.v), [s, 0], 1e-10, 'ħ = ' + h);
  }
});

test('the thimbles make a tree on the valleys, and paths add up', () => {
  for (let trial = 0; trial < 30; trial++) {
    const n = 2 + (trial % 3), act = St.action(randomCrit(n)), phi = TAU * rnd();
    const th = St.thimbles(act, phi, St.directions(act, phi));
    const ends = th.map((t) => [t.from, t.to]);
    // each thimble joins two valleys; the path from a to b, then b to c, is the path from a to c
    for (let a = 0; a < act.m; a++) {
      for (let b = 0; b < act.m; b++) {
        if (a === b) continue;
        const nab = St.decompose(act.m, ends, a, b);
        assert.ok(nab, 'a tree at φ = ' + phi);
        for (let c = 0; c < act.m; c++) {
          if (c === a || c === b) continue;
          const nbc = St.decompose(act.m, ends, b, c), nac = St.decompose(act.m, ends, a, c);
          nac.forEach((x, i) => assert.equal(x, nab[i] + nbc[i]));
        }
      }
    }
  }
});

test('across a Stokes ray the sum of thimbles jumps, and the integral over Γ does not', () => {
  for (let trial = 0; trial < 6; trial++) {
    const n = 2 + (trial % 3), act = St.action(randomCrit(n)), phi0 = 0.37;
    const dirs = St.directions(act, phi0);
    // a ray of J_0, and a path that has J_0 in it on one side
    const rays = St.stokesRays(act, 0, dirs, phi0);
    assert.ok(rays.length > 0, 'J_0 has a Stokes ray');
    const th = St.liftNear(rays[0].theta, phi0), eps = 0.02;
    const at = (phi) => {
      const d = St.turnDirs(dirs, phi0, phi), t = St.thimbles(act, phi, d);
      return { d, ends: t.map((q) => [q.from, q.to]) };
    };
    const A = at(th - eps), B = at(th + eps);
    // the path: the thimble J_0 just before the ray, which jumps across it
    const [a, b] = A.ends[0];
    const nA = St.decompose(act.m, A.ends, a, b), nB = St.decompose(act.m, B.ends, a, b);
    assert.notDeepEqual(nA, nB, 'the coefficients jump');
    // I_Γ on both sides, from the thimbles of each side; |ħ| large enough that nothing is negligible
    const r = 0.6;
    const I = (phi, d, nn) => nn.reduce((s, c, i) => {
      if (!c) return s;
      const q = St.integral(act, i, St.scl(St.cis(phi), r), d[i]);
      return St.add(s, St.scl(St.mul(St.cexp(q.e), q.v), c));
    }, [0, 0]);
    const left = I(th - eps, A.d, nA), right = I(th + eps, B.d, nB);
    // the integral is analytic in ħ: across 2ε it changes by about 2ε·|dI/dφ|, not by a jump
    const mid1 = I(th - 2 * eps, at(th - 2 * eps).d, St.decompose(act.m, at(th - 2 * eps).ends, a, b));
    const slope = St.abs(St.sub(left, mid1)) / eps;
    assert.ok(St.abs(St.sub(right, left)) < 3 * slope * 2 * eps + 1e-9 * St.abs(left), 'continuous across the ray');
  }
});

test('the Stokes rays of Airy\'s and the quartic\'s thimbles', () => {
  const ai = St.action([[-1, 0], [1, 0]]), d = St.directions(ai, 0.5);
  const r0 = St.stokesRays(ai, 0, d, 0.5), r1 = St.stokesRays(ai, 1, d, 0.5);
  assert.equal(r0.length, 1);
  assert.ok(Math.abs(Math.abs(r0[0].theta) - Math.PI) < 1e-12);
  assert.deepEqual(r0[0].js, [1]);
  assert.equal(Math.abs(r0[0].mu[1]), 1);
  assert.equal(r1.length, 1);
  assert.ok(Math.abs(r1[0].theta) < 1e-12);
  // the quartic: J at 0 runs into ±i together, at arg ħ = π
  const q = St.action([[0, 0], [0, 1], [0, -1]]), rq = St.stokesRays(q, 0, St.directions(q, 0.5), 0.5);
  assert.equal(rq.length, 1);
  assert.deepEqual(rq[0].js.slice().sort(), [1, 2]);
});

// critical values well apart: where some lie close together, the series of those points diverge
// fast and the formula needs far higher orders before it settles (it is still right)
function spreadAction(n) {
  for (;;) {
    const act = St.action(randomCrit(n));
    let lo = Infinity, hi = 0;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) { const d = St.abs(St.sub(act.values[a], act.values[b])); lo = Math.min(lo, d); hi = Math.max(hi, d); }
    if (lo > 0.35 * hi) return act;
  }
}

test('the large orders of each series follow from the others (resurgence)', () => {
  for (let trial = 0; trial < 8; trial++) {
    const n = 2 + (trial % 3), act = spreadAction(n), phi = 0.2;
    const dirs = St.directions(act, phi), K = 40;
    const ser = [];
    const sj = (j) => ser[j] || (ser[j] = St.series(act, j, K));
    for (let i = 0; i < n; i++) {
      const rays = St.stokesRays(act, i, dirs, phi), a = sj(i);
      const digits = (L) => { const p = St.predict(rays, K, L, sj); return -Math.log10(St.abs(St.sub(a[K], p[K])) / St.abs(a[K])); };
      // one term gives the growth, four give several digits more
      assert.ok(digits(1) > 1, 'leading order, i = ' + i + ': ' + digits(1));
      assert.ok(digits(4) > digits(1) + 2.5, 'four terms, i = ' + i + ': ' + digits(4));
    }
  }
});

test('the Borel transform along a ray agrees with its series near 0', () => {
  const act = St.action([[0.3, -0.2], [-0.8, 0.4], [0.5, 0.9]]), i = 0;
  const a = St.series(act, i, 40), inv = St.localInverse(act, i, 24);
  let R = Infinity;
  act.values.forEach((v, j) => { if (j !== i) R = Math.min(R, St.abs(St.sub(v, act.values[i]))); });
  for (const alpha of [0.3, 1.9, -2.4]) {
    const nR = 20, rho = 0.4 * R, out = St.borelRay(act, i, alpha, rho, nR, inv);
    const z = St.scl(St.cis(alpha), rho);
    let s = [0, 0], pw = [1, 0], poch = 1;
    for (let k = 0; k <= 40; k++) {
      if (k) { pw = St.mul(pw, z); poch *= k - 0.5; }
      s = St.add(s, St.scl(St.mul(a[k], pw), 1 / poch));
    }
    close([out[2 * nR], out[2 * nR + 1]], s, 1e-8, 'β at α = ' + alpha);
  }
});

test('on the Stokes ray the optimally truncated series leaves half the jump (Berry)', () => {
  const ai = St.action([[-1, 0], [1, 0]]), phi0 = 0.5, dirs0 = St.directions(ai, phi0);
  const i = 1, ray = St.stokesRays(ai, i, dirs0, phi0)[0], j = ray.js[0], A = ray.A[j];
  const F = 10, r = St.abs(A) / F, th = St.liftNear(ray.theta, phi0);
  const hb = St.scl(St.cis(th - 1e-3), r), d = St.turnDirs(dirs0, phi0, th - 1e-3);
  const q = St.integral(ai, i, hb, d[i]);
  const exact = St.div(q.v, St.scl(q.v0, Math.sqrt(Math.PI)));
  const a = St.series(ai, i, F), b = St.series(ai, j, F);
  let FN = [0, 0], P = [0, 0], hk = [1, 0];
  for (let k = 0; k < F; k++) { FN = St.add(FN, St.mul(a[k], hk)); P = St.add(P, St.mul(b[k], hk)); hk = St.mul(hk, hb); }
  const sub = St.mul(St.scl(ray.kappa[j], -1), St.mul(St.cexp(St.scl(St.div(A, hb), -1)), P));
  const m = St.div(St.sub(exact, FN), sub);
  assert.ok(Math.abs(m[0] - 0.5) < 0.02, 'the multiplier on the ray: ' + m);
});

test('the integrals along a ray of ħ agree with the thimble integrals, also beside the Stokes rays', () => {
  for (let trial = 0; trial < 4; trial++) {
    const n = 2 + (trial % 3), act = spreadAction(n), phi0 = 0.3, dirs0 = St.directions(act, phi0);
    const rays = act.crit.map((p, i) => St.stokesRays(act, i, dirs0, phi0).map((r) => r.theta));
    let span = 0;
    for (const a of act.values) for (const b of act.values) span = Math.max(span, St.abs(St.sub(a, b)));
    // the disc of ħ the page draws: |ħ| up to 0.6 of the largest difference of critical values
    const rhos = [0.05, 0.2, 0.4, 0.6].map((f) => f * span), tgs = {};
    const tgFor = (h) => tgs[h] || (tgs[h] = St.rayTargets(rhos, 6.5, h));
    const thetas = [0.37, 1.9, -2.6];
    rays.forEach((list) => list.forEach((t) => thetas.push(t + 0.02, t - 0.03)));
    for (const theta of thetas) {
      const dirs = St.turnDirs(dirs0, phi0, theta);
      for (let i = 0; i < n; i++) {
        const plan = St.rayPlan(theta, rays[i], 0.5), alpha = plan.alpha;
        // (in a sector too narrow for a ray the page integrates over the thimble itself)
        if (!St.rayStep(plan.clear)) continue;
        const ray = St.thimbleRay(act, i, alpha, St.turnDirs(dirs0, phi0, alpha)[i], tgFor(St.rayStep(plan.clear))), T = St.rayCombine(act, i, ray, theta);
        const th = St.thimbles(act, theta, dirs)[i];
        assert.deepEqual(ray.ends, [th.from, th.to], 'the valleys at θ = ' + theta);
        rhos.forEach((rho, r) => {
          const ref = St.integral(act, i, St.scl(St.cis(theta), rho), dirs[i]);
          close(St.scl([T[2 * r], T[2 * r + 1]], Math.sqrt(rho)), ref.v, 1e-4 * St.abs(ref.v) / Math.max(1, St.abs(ref.v)), 'J_' + i + ' at θ = ' + theta.toFixed(3) + ', ρ = ' + rho.toFixed(3));
        });
      }
    }
  }
});
