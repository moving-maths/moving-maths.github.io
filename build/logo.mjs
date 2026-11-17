// The site's mark: a trefoil knot, computed from its parametrisation
//   p(t) = (sin t + 2 sin 2t,  cos t − 2 cos 2t),  height z(t) = −sin 3t.
// The curve is drawn whole. At each crossing a band along the upper strand,
// the stroke plus a margin each side wide, masks out whatever passes beneath
// it, and the upper strand is drawn again on top through its own band. A
// control point rests on the left crossing. While the pointer is on the logo
// (site.js) the point travels round the knot under the same bands, so it
// disappears exactly where its strand does. The point's white ring is a gap cut
// into the strands around it (a mask too), so the mark works on any background.

const TAU = 2 * Math.PI;
const P = (t) => [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t)];
const dP = (t) => [Math.cos(t) + 4 * Math.cos(2 * t), -Math.sin(t) + 4 * Math.sin(2 * t)];
const Z = (t) => -Math.sin(3 * t);
const fmt = (v) => (Math.round(v * 100) / 100).toString();

// Each band runs this far either side of its crossing, as a parameter range
// along the upper strand: far enough to cover the point as it passes under
// (with its ring, about 6 box units). The redrawn upper strand runs a little
// further, so that it overlaps the band's ends without a seam, and stops well
// short of the next crossing along that strand (about 9 units away).
const BAND_SPAN = 0.3;
const OVER_SPAN = 0.36;

// The 3 crossings, as { under, over } parameters: the strand at `under` passes
// beneath the strand at `over`, at the same point of the plane.
function crossings() {
  const N = 1800, pts = [];
  for (let i = 0; i <= N; i++) pts.push(P((i / N) * TAU));
  const found = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 2; j < N; j++) {
      if (i === 0 && j === N - 1) continue;
      const [a, b, c, d] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (Math.abs(den) < 1e-12) continue;
      const s = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (s < 0 || s > 1 || u < 0 || u > 1) continue;
      const t1 = ((i + s) / N) * TAU, t2 = ((j + u) / N) * TAU;
      found.push(Z(t1) < Z(t2) ? { under: t1, over: t2 } : { under: t2, over: t1 });
    }
  }
  return found.sort((a, b) => a.under - b.under);
}
let crossingCache = null;

// The knot in a size×size box: the scale k (box units per curve unit), the
// crossings (unders[i] passes beneath overs[i]), the stroke, the band width
// `hide` (stroke plus margin each side), the radii of the point and of its
// ring, and where the point rests (the left crossing, on its upper strand).
const geometryCache = new Map();
export function knotGeometry({ size = 32, pad = 2.4, stroke = 2.5, margin = 0.55, point = 2.65, ring = 1.5 } = {}) {
  const key = [size, pad, stroke, margin, point, ring].join('/');
  if (!geometryCache.has(key)) {
    crossingCache = crossingCache || crossings();
    const cross = crossingCache;
    const left = cross.reduce((a, b) => (P(b.over)[0] < P(a.over)[0] ? b : a));
    geometryCache.set(key, {
      size, k: (size / 2 - pad) / 3, stroke, hide: stroke + 2 * margin, point, halo: point + ring,
      unders: cross.map((c) => c.under), overs: cross.map((c) => c.over), span: BAND_SPAN, rest: left.over,
    });
  }
  return geometryCache.get(key);
}

const toBox = (g, [x, y]) => [g.size / 2 + g.k * x, g.size / 2 + g.k * y];

// SVG path data for the curve from t0 to t1, as n cubic Béziers fitted to the
// curve's derivative.
function curve(g, t0, t1, n) {
  const h = (t1 - t0) / n;
  const p0 = toBox(g, P(t0));
  let d = `M${fmt(p0[0])} ${fmt(p0[1])}`;
  for (let i = 0; i < n; i++) {
    const ta = t0 + i * h, tb = ta + h;
    const pa = toBox(g, P(ta)), pb = toBox(g, P(tb));
    const va = dP(ta), vb = dP(tb);
    const c = (h * g.k) / 3;
    d += `C${fmt(pa[0] + va[0] * c)} ${fmt(pa[1] + va[1] * c)} ${fmt(pb[0] - vb[0] * c)} ${fmt(pb[1] - vb[1] * c)} ${fmt(pb[0])} ${fmt(pb[1])}`;
  }
  return d;
}

// The three drawings: the whole curve; the bands, one subpath per crossing in
// the order of `unders`; and the upper strands through the crossings.
const pathCache = new Map();
export function knotPaths(opts = {}) {
  const g = knotGeometry(opts);
  if (!pathCache.has(g)) {
    pathCache.set(g, {
      curve: curve(g, 0, TAU, 48) + 'Z',
      bands: g.overs.map((t) => curve(g, t - BAND_SPAN, t + BAND_SPAN, 4)).join(''),
      overs: g.overs.map((t) => curve(g, t - OVER_SPAN, t + OVER_SPAN, 5)).join(''),
    });
  }
  return pathCache.get(g);
}

// The SVG's content. Masks (white shows, black hides):
//   k  the curve: hidden in the bands and in the point's ring
//   o  the upper strands: hidden in the point's ring
//   p  the point: hidden in the band of the crossing it is passing under
// The ring is a group (h) that both k and o use: the halo circle, then, with
// `live`, three shapes that site.js fills in while the point passes under a
// band, so that the ring is exactly the outline of the part of the point that
// can be seen: the ring beyond the hidden part of its rim is given back
// (unring, white), the rounded ends where the visible rim meets the band are
// cut again (corners, black), and the band itself is given back (unband,
// white), so the ring never cuts the strand above the point.
let uid = 0;
function knotMarkup({ geometry, point, live, ink = 'currentColor', dot = null }) {
  const g = knotGeometry(geometry);
  const paths = knotPaths(geometry);
  const id = `mmk${++uid}`;
  const box = `x="-8" y="-8" width="${g.size + 16}" height="${g.size + 16}"`;
  const mask = (name, inner) => `<mask id="${id}${name}" maskUnits="userSpaceOnUse" ${box}><rect ${box} fill="white"/>${inner}</mask>`;
  const bands = `<path class="logo-bands" d="${paths.bands}" fill="none" stroke="black" stroke-width="${fmt(g.hide)}"/>`;
  const stroke = `fill="none" stroke="${ink}" stroke-width="${g.stroke}"`;
  if (!point) {
    return `<defs>${mask('k', bands)}</defs>`
      + `<path class="logo-knot" d="${paths.curve}" ${stroke} stroke-linejoin="round" mask="url(#${id}k)"/>`
      + `<path class="logo-over" d="${paths.overs}" ${stroke}/>`;
  }
  const [cx, cy] = toBox(g, P(g.rest)).map(fmt);
  const halo = `<circle class="logo-halo" cx="${cx}" cy="${cy}" r="${fmt(g.halo)}" fill="black"/>`;
  let defs;
  if (live) {
    const ring = `<g id="${id}h">${halo}`
      + `<path class="logo-unring" d="" fill="white"/>`
      + `<path class="logo-corners" d="" fill="black"/>`
      + `<path class="logo-unband" d="" fill="none" stroke="white" stroke-width="${fmt(g.hide)}"/></g>`;
    defs = ring + mask('k', `<use href="#${id}h"/>${bands}`) + mask('o', `<use href="#${id}h"/>`)
      + mask('p', `<path class="logo-band-on" d="" fill="none" stroke="black" stroke-width="${fmt(g.hide)}"/>`);
  } else {
    defs = mask('k', halo + bands) + mask('o', halo);
  }
  return `<defs>${defs}</defs>`
    + `<path class="logo-knot" d="${paths.curve}" ${stroke} stroke-linejoin="round" mask="url(#${id}k)"/>`
    + `<path class="logo-over" d="${paths.overs}" ${stroke} mask="url(#${id}o)"/>`
    + `<circle class="logo-point" cx="${cx}" cy="${cy}" r="${fmt(g.point)}"${dot ? ` fill="${dot}"` : ''}${live ? ` mask="url(#${id}p)"` : ''}/>`;
}

// Inline SVG for the page; colours come from CSS (`color` on .logo, fill on
// .logo-point). data-knot carries the geometry for the animation in site.js.
export function logoSvg({ className = 'logo', point = true } = {}) {
  const g = knotGeometry();
  const r5 = (t) => +t.toFixed(5);
  const data = JSON.stringify({ k: g.k, size: g.size, rest: r5(g.rest), unders: g.unders.map(r5), overs: g.overs.map(r5), span: g.span, hide: g.hide });
  return `<svg class="${className}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"${point ? ` data-knot='${data}'` : ''}>`
    + knotMarkup({ point, live: point })
    + `</svg>`;
}

// The favicon: the same mark with the point at rest, drawn a little heavier
// (and with wider margins at the crossings) to read at 16 pixels. The build
// passes the theme's --accent and --accent-2; the defaults are the same values.
export function faviconSvg({ ink = '#197eb8', dot = '#f2b51e' } = {}) {
  const geometry = { pad: 2, stroke: 3, margin: 1, point: 3.2, ring: 1.6 };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${knotMarkup({ geometry, point: true, live: false, ink, dot })}</svg>\n`;
}
