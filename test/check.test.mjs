import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLinks } from '../build/check.mjs';

test('checkLinks reads real start tags only, in every quoting style', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-check-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'a'));
  fs.writeFileSync(path.join(dir, 'a', 'index.html'), '');
  fs.writeFileSync(path.join(dir, 'img.png'), '');
  fs.writeFileSync(path.join(dir, 'index.html'), [
    '<!doctype html>',
    `<a href="/a/">double</a> <a href='/a/'>single</a> <a href=/a/>bare</a> <a href="a/">relative</a>`,
    '<!-- <a href="/gone-comment/">old</a> -->',
    '<script>const s = "<a href=\\"/gone-script/\\">";</script>',
    '<template><img src="/gone-template.png"></template>',
    '<textarea><a href="/gone-textarea/"></textarea>',
    '<p><code>&lt;a href="/gone-code/"&gt;</code></p>',
    '<img srcset="/img.png 1x, /missing-2x.png 2x" src="/img.png" alt="">',
    '<a href="/broken-double/">x</a>',
    `<a href='/broken-single/'>x</a>`,
    '<a href=/broken-bare/>x</a>',
    '<a href="#top">anchor</a> <a href="https://example.com/x">external</a> <a href="mailto:a@b.c">mail</a>',
    '<a href="/a/?q=1&amp;r=2#frag">query</a> <a title="no link">x</a>',
  ].join('\n'));
  assert.deepEqual(checkLinks(dir).map((p) => `${p.line}: ${p.message}`), [
    '8: broken link /missing-2x.png',
    '9: broken link /broken-double/',
    '10: broken link /broken-single/',
    '11: broken link /broken-bare/',
  ]);
});
