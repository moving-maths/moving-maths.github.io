// Knots: the slow invariants, worked out away from the page so that they never hold
// it up (main.js starts this worker): the numbers of homomorphisms of the group onto
// S₃, S₄ and S₅, and the hyperbolic volume (KnotVolume.search, run to its end). The
// page sends { id, D, onto, volume }, D a diagram with no crossing to undo, and gets
// back { id, task, value } for each task asked; it ends the worker and starts another
// when the diagram changes before the answers come.
importScripts('knots.js', 'volume.js');

self.onmessage = (e) => {
  const { id, D, onto, volume } = e.data;
  if (onto) self.postMessage({ id, task: 'onto', value: [3, 4, 5].map((n) => (D.n <= 20 ? self.Knots.onto(D, n, 60000) : null)) });
  if (volume) {
    const run = self.KnotVolume.search(D);
    let r;
    do r = run.step(); while (r === undefined);
    self.postMessage({ id, task: 'volume', value: r });
  }
};
