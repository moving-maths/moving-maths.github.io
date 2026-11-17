import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolvePath } from '../build/static.mjs';

test('resolvePath keeps every request inside the root', () => {
  const root = path.resolve('/srv/site');
  for (const p of ['/', '/a/b.html', '/../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/a/../../b', '/..%2f..%2fb', '//etc/passwd', '/%5c..%5cb']) {
    const r = resolvePath(root, p);
    assert.ok(r.file, p);
    assert.ok(r.file === root || r.file.startsWith(root + path.sep), `${p} → ${r.file}`);
  }
  assert.equal(resolvePath(root, '/a/b.html').file, path.join(root, 'a', 'b.html'));
});

test('resolvePath rejects malformed paths', () => {
  assert.equal(resolvePath('/srv', '/%E0%A4%A').status, 400); // a broken escape
  assert.equal(resolvePath('/srv', '/a%00b').status, 400);    // NUL
});
