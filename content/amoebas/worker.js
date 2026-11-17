// Amoebas: the area of the amoeba against log t (the figure in "Area"), worked out
// away from the page so that it never holds it up (main.js starts this worker). The
// page sends { key, pts, v, sg, chart }: the curve, by its lattice points, heights
// and signs, and how to sample log t (the arguments of Amoeba.sampler). It gets back
// { key, s, value } for each log t sampled, the area as a fraction of the largest
// possible, then { key, done: true }; it ends the worker and starts another when the
// curve changes before then.
importScripts('amoeba.js');

self.onmessage = (e) => {
  const { key, pts, v, sg, chart } = e.data, A = self.Amoeba;
  const at = A.sampler(chart.base, chart.tol, chart.min, chart.max);
  for (let s = at.next(); s !== null; s = at.next()) {
    const value = A.areaRatio(pts, v, sg, s);
    at.put(s, value);
    self.postMessage({ key, s, value });
  }
  self.postMessage({ key, done: true });
};
