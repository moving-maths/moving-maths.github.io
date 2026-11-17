#!/usr/bin/env node
// Usage:
//   node build/cli.mjs build [--dev] [--json] [--out DIR]   build the site
//   node build/cli.mjs dev [--port N] [--host H]            serve with live reload
//   node build/cli.mjs check [--drafts]                     build, then check links
// --drafts builds the drafts too, as a production build would if they were not
// drafts, into a folder of its own that is removed afterwards (so that dist/ never
// holds a draft): for checking a page before it is published.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, formatMessages } from './build.mjs';
import { checkLinks } from './check.mjs';
import { serve } from './serve.mjs';

const [cmd = 'build', ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(name);
const opt = (name, dflt) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : dflt; };

if (cmd === 'dev') {
  serve({ port: Number(opt('--port', process.env.PORT || 8080)), host: opt('--host', '127.0.0.1') });
} else if (cmd === 'build' || cmd === 'check') {
  const scratch = flag('--drafts') && !opt('--out') ? fs.mkdtempSync(path.join(os.tmpdir(), 'mm-drafts-')) : null;
  const outDir = opt('--out') ? path.resolve(opt('--out')) : scratch || undefined;
  const t0 = Date.now();
  let res;
  try {
    res = await build({ outDir, dev: flag('--dev'), drafts: flag('--dev') || flag('--drafts') });
    if (cmd === 'check') res.errors.push(...checkLinks(res.outDir));
  } catch (err) {
    // a problem that stops the whole build (site.yml, the output folder, …)
    res = { errors: [{ file: 'build', line: 0, message: err.message }], warnings: [], count: 0, outDir: outDir || 'dist' };
  }
  if (flag('--json')) {
    process.stdout.write(JSON.stringify({ errors: res.errors, warnings: res.warnings }));
  } else {
    if (res.warnings.length) console.warn(formatMessages(res.warnings, 'warning'));
    if (res.errors.length) console.error(formatMessages(res.errors, 'error'));
    console.log(`${res.errors.length ? 'Failed' : 'Built'}: ${res.count} page(s) in ${Date.now() - t0} ms, ${res.errors.length} error(s), ${res.warnings.length} warning(s) → ${scratch ? 'a temporary folder (drafts included)' : path.relative(process.cwd(), res.outDir) || '.'}`);
  }
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
  process.exitCode = res.errors.length ? 1 : 0;
} else {
  console.error(`Unknown command "${cmd}". Use build, dev or check.`);
  process.exitCode = 2;
}
