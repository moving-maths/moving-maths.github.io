import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformMath, decodeEntities } from '../build/tex-scan.mjs';

// Renders maths as [I:tex] / [D:tex] so the output is easy to read.
const run = (src) => {
  const errors = [];
  const out = transformMath(src, (t, d) => `[${d ? 'D' : 'I'}:${t}]`, (msg, at) => errors.push({ msg, at }));
  return { out, errors };
};

test('inline and display delimiters', () => {
  assert.equal(run('a $x$ b \\(y\\) c').out, 'a [I:x] b [I:y] c');
  assert.equal(run('$$x$$ and \\[y\\]').out, '[D:x] and [D:y]');
});

test('escaped and stray dollars', () => {
  assert.equal(run('costs \\$5').out, 'costs $5');
  assert.equal(run('a $ b').out, 'a $ b'); // $ followed by a space does not open
  assert.equal(run('$x $ y$').out, '[I:x $ y]'); // closing $ may not follow a space
  assert.equal(run('$a$5 $b$').out, '[I:a$5 $b]'); // closing $ may not precede a digit
});

test('maths may contain < and entities', () => {
  assert.equal(run('$a<b$').out, '[I:a<b]');
  assert.equal(run('$a&lt;b &amp; c$').out, '[I:a<b & c]');
});

test('skips tags, attributes, comments and skipped elements', () => {
  assert.equal(run('<a title="$x$">$y$</a>').out, '<a title="$x$">[I:y]</a>');
  assert.equal(run('<!-- $x$ -->$y$').out, '<!-- $x$ -->[I:y]');
  for (const t of ['script', 'style', 'pre', 'code', 'textarea', 'svg']) {
    assert.equal(run(`<${t}>$x$</${t}>$y$`).out, `<${t}>$x$</${t}>[I:y]`, t);
  }
  assert.equal(run('<div data-notex>$x$ <div>$z$</div></div>$y$').out, '<div data-notex>$x$ <div>$z$</div></div>[I:y]');
  assert.equal(run('<span class="a notex">$x$</span>$y$').out, '<span class="a notex">$x$</span>[I:y]');
  assert.equal(run('<span class="katex"><span>$x$</span></span>$y$').out, '<span class="katex"><span>$x$</span></span>[I:y]');
  assert.equal(run('<script>if (a < b) "</div>$x$"</script>$y$').out, '<script>if (a < b) "</div>$x$"</script>[I:y]');
  assert.equal(run('<img alt="x"><br>$y$').out, '<img alt="x"><br>[I:y]');
});

test('reports unclosed maths and does not cross blank lines', () => {
  const r = run('a $x\n\ny$ b');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].msg, /Unclosed \$/);
  assert.equal(r.errors[0].at, 2);
  assert.equal(run('\\(x').errors.length, 1);
});

test('render errors are reported and the source kept', () => {
  const errors = [];
  const out = transformMath('a $bad$ b', () => { throw new Error('boom'); }, (m) => errors.push(m));
  assert.equal(out, 'a $bad$ b');
  assert.deepEqual(errors, ['boom']);
});

test('decodeEntities', () => {
  assert.equal(decodeEntities('&lt;&gt;&amp;&quot;&#39;&#x3b1;&#945;'), '<>&"\'αα');
});

test('punctuation after a short inline formula stays with it', () => {
  assert.equal(run('in $x$: yes, $y$.').out, 'in <span class="tex-nowrap">[I:x]:</span> yes, <span class="tex-nowrap">[I:y].</span>');
  assert.equal(run('$$x$$.').out, '[D:x].');
});

test('tag names in any case, and nested skipped elements', () => {
  assert.equal(run('<SCRIPT>$x$</SCRIPT>$y$').out, '<SCRIPT>$x$</SCRIPT>[I:y]');
  assert.equal(run('<Pre>$x$</pRE>$y$').out, '<Pre>$x$</pRE>[I:y]');
  assert.equal(run('<svg><g><svg>$x$</svg>$z$</g></svg>$y$').out, '<svg><g><svg>$x$</svg>$z$</g></svg>[I:y]');
  assert.equal(run('<pre><code>$x$</code>$z$</pre>$y$').out, '<pre><code>$x$</code>$z$</pre>[I:y]');
});

test('any text before a skipped element: offsets do not shift', () => {
  // "İ" lowercases to two characters, which once moved every later offset
  assert.equal(run('İ<script>$x$</script>$y$').out, 'İ<script>$x$</script>[I:y]');
  assert.equal(run('ẞ 𝔸 <code>$x$</code> $y$').out, 'ẞ 𝔸 <code>$x$</code> [I:y]');
});

test('maths that runs into a closing tag is reported and kept as text', () => {
  const r = run('<p>Costs $5</p><p>and $y$</p>');
  assert.match(r.errors[0].msg, /runs into a closing tag/);
  assert.equal(r.out, '<p>Costs $5</p><p>and [I:y]</p>');
});

test('render is told whether the maths is part of an element name', () => {
  const seen = [];
  const render = (t, d, o, c) => { seen.push(`${t}:${c.name}`); return t; };
  transformMath('<button>$a$</button><p>$b$</p><div role="tab">$c$</div><h2>x <em>$d$</em></h2><A HREF="#">$e$</A>$f$<label>$g$</label>', render);
  assert.deepEqual(seen, ['a:true', 'b:false', 'c:true', 'd:true', 'e:true', 'f:false', 'g:true']);
  seen.length = 0;
  transformMath('<span>$h$</span>', render, null, { name: true });
  assert.deepEqual(seen, ['h:true']);
});

test('character references outside Unicode are kept as written', () => {
  assert.equal(decodeEntities('&#X3B1;&#x110000;&#xD800;&#55296;&nbsp;'), 'α&#x110000;&#xD800;&#55296;\u00a0');
});
