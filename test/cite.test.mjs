import test from 'node:test';
import assert from 'node:assert/strict';
import { citeRefs } from '../build/cite.mjs';

const refs = [{ key: 'alexander1928' }, { key: 'conway1970' }, { key: 'fox1962' }];
const cite = (src) => citeRefs(src, refs);
const ref = (key, n) => `<a class="cite-ref" href="#ref-${key}">${n}</a>`;

test('a citation becomes a numbered link, after a no-break space', () => {
  const r = cite('the polynomial [@conway1970].');
  assert.equal(r.html, `the polynomial&nbsp;<span class="cite">[${ref('conway1970', 2)}]</span>.`);
  assert.deepEqual([...r.used], ['conway1970']);
  assert.deepEqual(r.problems, []);
});

test('several keys are sorted by number; a locator follows its number', () => {
  assert.equal(cite('[@fox1962; @alexander1928]').html, `<span class="cite">[${ref('alexander1928', 1)}, ${ref('fox1962', 3)}]</span>`);
  assert.equal(cite('[@fox1962, §3]').html, `<span class="cite">[${ref('fox1962', 3)}, §3]</span>`);
  assert.equal(cite('[@fox1962, §3; @conway1970]').html, `<span class="cite">[${ref('conway1970', 2)}; ${ref('fox1962', 3)}, §3]</span>`);
});

test('code, scripts and comments are left alone', () => {
  const src = '<code>[@fox1962]</code><!-- [@fox1962] --><script>x = "[@fox1962]"</script>';
  assert.equal(cite(src).html, src);
  assert.equal(cite(src).used.size, 0);
});

test('unknown keys, bad syntax and unclosed citations are reported', () => {
  assert.match(cite('[@nobody]').problems[0].message, /"nobody", which is not a key/);
  assert.match(cite('[@fox1962 §3]').problems[0].message, /write \[@key\]/);
  assert.match(cite('see [@fox1962\nand').problems[0].message, /not closed/);
  assert.equal(cite('[@nobody]').html, '[@nobody]');
  // offsets point at the citation
  assert.equal(cite('abc [@nobody]').problems[0].offset, 3);
});

test('ordinary brackets and @ signs are untouched', () => {
  const src = 'an interval [0, 1], a mail a@b.c, and [ @ ]';
  assert.equal(cite(src).html, src);
});
