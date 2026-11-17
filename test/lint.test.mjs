import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintCss, lintJs } from '../build/lint.mjs';

const msgs = (css) => lintCss(css, 'x.css').map((w) => `${w.line}: ${w.message.split(';')[0]}`);

test('restyling a component is flagged; setting its tokens is not', () => {
  assert.deepEqual(msgs('.seg > button { color: var(--ink); }'), ['1: restyles .seg (color) in `.seg button`']);
  assert.deepEqual(msgs('.btn.big { background: var(--c1); }'), ['1: restyles .btn (background) in `.btn.big`']);
  assert.deepEqual(msgs('.dense .seg { --seg-height: 24px; margin-top: 4px; }'), []);
  assert.deepEqual(msgs('.readout .kind { color: var(--ink-3); }'), []); // the page's own content
  assert.deepEqual(msgs('.data-table th .katex { font-size: 1em; }'), []);
  assert.deepEqual(msgs('.data-table thead th { background: var(--sunken); }'), ['1: restyles .data-table (background) in `.data-table thead th`']);
  assert.deepEqual(msgs('.dot.big { background: var(--c1); }'), ['1: restyles .dot (background) in `.dot.big`']);
  assert.deepEqual(msgs('.fig-overlay.top { font-size: 14px; }'), ['1: restyles .fig-overlay (font-size) in `.fig-overlay.top`']);
  assert.deepEqual(msgs('.dot.faint { --dot-ring: var(--ink-3); } .legend-line.mine { --c: var(--c3); }'), []);
});

test('colours and fonts must come from tokens', () => {
  assert.deepEqual(msgs('.fig {\n  fill: #ff0000;\n  font-family: Georgia;\n}'), ['2: hard-coded colour (fill: #ff0000)', '3: font named in font-family']);
  assert.deepEqual(msgs('.fig { stroke: rgba(0, 0, 0, .5); font: 500 13px var(--sans); }'), ['1: hard-coded colour (stroke: rgba(0, 0, 0, .5))']);
  assert.deepEqual(msgs('.fig { --mine: #123456; }'), ['1: hard-coded colour in --mine']);
});

test('design-ok opts a rule out', () => {
  assert.deepEqual(msgs('.btn.big { /* design-ok: a one-off */ background: var(--c1); }'), []);
  assert.deepEqual(msgs('/* design-ok: legend swatches */\n.chip.x { border-color: var(--c2); }'), []);
});

test('scripts: hard-coded hex colours', () => {
  const w = lintJs("ctx.fillStyle = '#ff8800';\nconst ok = MM.color('c1');", 'x.js');
  assert.equal(w.length, 1);
  assert.equal(w[0].line, 1);
});
