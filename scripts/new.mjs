#!/usr/bin/env node
// npm run new -- <slug> ["Title"]
// Creates content/<slug>/ with index.html, style.css and main.js.
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR, RESERVED_SLUGS, SLUG_RE } from '../build/config.mjs';

const [slug, title = 'Untitled'] = process.argv.slice(2);
if (!slug || !SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
  console.error('Usage: npm run new -- <slug> ["Title"]   (slug: lowercase words joined by hyphens)');
  process.exit(2);
}
const dir = path.join(CONTENT_DIR, slug);
if (fs.existsSync(dir)) {
  console.error(`content/${slug} already exists`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);

fs.writeFileSync(path.join(dir, 'index.html'), `---
title: ${JSON.stringify(title)}
# heading: optional; HTML and TeX allowed, in single quotes, e.g. 'Configuration spaces of $\\RR^n$'
description: 'TODO: one or two sentences for cards and link previews; TeX such as $\\pi_1(S^1)$ is fine.'
tags: [TODO]
date: ${today}
draft: true
katex_runtime: true
styles: [style.css]
scripts: [main.js]
thumb:
  selector: "#figure"
references: []
---
<div class="wrap">
  <p class="lede">One paragraph saying what the reader will see and do. TeX works inline, $\\pi_1(S^1)\\cong\\ZZ$, and in display:
  $$\\chi(M) = \\sum_i (-1)^i \\dim H_i(M;\\QQ).$$</p>
</div>

<div class="control-bar">
  <div class="wrap">
    <div class="control"><span class="label">Mode</span>
      <mm-seg id="mode" value="a" aria-label="Mode">
        <button value="a">A</button><button value="b">B</button>
      </mm-seg>
    </div>
  </div>
</div>

<div class="wrap section">
  <figure class="panel" id="figure">
    <div class="panel-head"><h2>The picture</h2><span class="panel-sub">drag the point</span></div>
    <canvas id="canvas" aria-label="TODO: describe the figure"></canvas>
    <figcaption id="caption"></figcaption>
  </figure>
</div>
`);

fs.writeFileSync(path.join(dir, 'style.css'), `/* Styles for this page only. Use the theme's tokens and components
   (docs/design.md) and keep selectors specific to this page. */
#canvas { aspect-ratio: 16 / 10; touch-action: none; } /* dragged: a swipe on it must not scroll */
`);

fs.writeFileSync(path.join(dir, 'main.js'), `// ${title}
(function () {
  'use strict';
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const state = { mode: 'a', p: [0.5, 0.5] };
  let example = null; // links, reset and Save image (at the end)

  function resize() {
    // its CSS box at MM.pixelRatio(): the screen's, or more while Save image draws the figure
    MM.fitCanvas(canvas);
    draw();
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const [x, y] = [state.p[0] * w, state.p[1] * h];
    ctx.fillStyle = MM.color(state.mode === 'a' ? 'c1' : 'c2');
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, 2 * Math.PI);
    ctx.fill();
    // figure labels: words with $…$ maths, set like KaTeX (see docs/authoring.md)
    MM.canvasLabel(ctx, 'the point $p_0$', x + 14, y, { size: 13, baseline: 'middle', color: MM.color('ink-2') });
    MM.setHTML(document.getElementById('caption'), \`The point is at $(\${state.p[0].toFixed(2)}, \${state.p[1].toFixed(2)})$.\`);
    if (example) example.changed();
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const r = canvas.getBoundingClientRect();
      state.p = [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
      draw();
    };
    move(e);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', () => canvas.removeEventListener('pointermove', move), { once: true });
  });

  // shared components (docs/design.md#components) emit change events
  document.getElementById('mode').addEventListener('change', (e) => {
    state.mode = e.detail.value;
    draw();
  });

  new ResizeObserver(resize).observe(canvas);
  MM.onFonts(draw); // canvas text uses whatever font is loaded: redraw once they are

  // Copy link, Save image and Reset, in a menu at the end of the bar (docs/authoring.md,
  // "Links, reset and images"): what a link says, and how the page shows what it says
  example = MM.example({
    fields: { m: 'text', p: 'numbers' },
    get: () => ({ m: state.mode, p: state.p }),
    set(x) {
      if ((x.m !== 'a' && x.m !== 'b') || x.p.length !== 2) return false;
      state.mode = x.m;
      state.p = x.p;
      document.getElementById('mode').value = x.m;
      draw();
    },
    pictures: () => [{ label: 'The picture', element: canvas }],
    redraw: resize,
  });
})();
`);

console.log(`Created content/${slug}/. Run npm run dev and open http://localhost:8080/${slug}/`);
