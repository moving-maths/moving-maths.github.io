#!/usr/bin/env node
// npm run thumbs -- [slug…]
// Builds the site (drafts included) into a temporary folder, opens each
// page in headless Chromium and writes its card image (thumb.png,
// 1200×630) into the page's folder. With no slugs, does them all.
//
// A page with a thumb.html (a picture designed for the card, see
// docs/authoring.md) has that page photographed, after `thumb.wait`
// milliseconds (default 300). Otherwise front matter `thumb:` controls a
// capture of the page itself:
//   selector  element to capture (default: the first figure, canvas or svg), or
//             a list of them, set side by side in that order at the scale they
//             have on the page
//   click     list of selectors to click first, in order
//   wait      milliseconds to wait after load (default 600)
//   trim      true: crop each capture to what is drawn in it, leaving out the
//             margin that has the colour of its top-left corner
//   style     CSS added to the page before the capture, e.g. to hide a frame
// Needs Chromium for Playwright: npx playwright install chromium
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { build, THUMB_PAGE } from '../build/build.mjs';
import { loadSiteData } from '../build/config.mjs';
import { loadContent } from '../build/content.mjs';
import { serveStatic } from '../build/static.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed: run npm install');
  process.exit(1);
}

const W = 1200, H = 630;
const SCALE = 2;  // device pixels per CSS pixel of the captures
const GAP = 48;   // CSS pixels between elements set side by side

// Runs in the card page: lays the captures out in a row, each cropped to its
// drawing if `trim`, the whole row scaled down (never up) to fit the card.
async function compose({ shots, trim, gap, maxW, maxH }) {
  const imgs = await Promise.all(shots.map((src) => new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('could not read a capture'));
    img.src = src;
  })));
  // the box of the pixels that differ from the top-left one, with a margin
  const drawn = (img) => {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const px = cx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) + Math.abs(px[i + 2] - px[2]) + Math.abs(px[i + 3] - px[3]) > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return { x: 0, y: 0, w, h };
    const m = 12;
    x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
    x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };
  const boxes = imgs.map((img) => (trim ? drawn(img) : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }));
  const rowW = boxes.reduce((s, b) => s + b.w, 0) + gap * (boxes.length - 1);
  const rowH = Math.max(...boxes.map((b) => b.h));
  const k = Math.min(1, maxW / rowW, maxH / rowH);
  const row = document.getElementById('row');
  row.style.gap = `${gap * k}px`;
  imgs.forEach((img, i) => {
    const b = boxes[i];
    const cell = document.createElement('div');
    cell.style.cssText = `position:relative;overflow:hidden;flex:none;width:${b.w * k}px;height:${b.h * k}px`;
    img.style.cssText = `position:absolute;max-width:none;left:${-b.x * k}px;top:${-b.y * k}px;width:${img.naturalWidth * k}px;height:${img.naturalHeight * k}px`;
    cell.append(img);
    row.append(cell);
  });
}
const { tags } = loadSiteData();
const { items } = loadContent({ tags, includeDrafts: true });
const wanted = process.argv.slice(2);
const unknown = wanted.filter((s) => !items.some((it) => it.slug === s));
for (const s of unknown) console.error(`${s}: no such page (or its front matter has errors)`);
const targets = wanted.length ? items.filter((it) => wanted.includes(it.slug)) : items;

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-thumbs-'));
let server = null, browser = null, failed = unknown.length;
try {
  const res = await build({ outDir, drafts: true, thumbs: true });
  // errors in other pages do not stop these thumbnails
  const mine = res.errors.filter((e) => !/^content\//.test(e.file) || targets.some((it) => e.file.startsWith(`content/${it.slug}/`)));
  for (const e of res.errors) console.error(`${mine.includes(e) ? 'error' : 'note: error elsewhere'} ${e.file}:${e.line}: ${e.message}`);
  if (mine.length) throw new Error('fix the build errors above first');

  server = http.createServer((req, res2) => serveStatic(req, res2, outDir));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch();
  for (const it of targets) {
    const opts = it.data.thumb || {};
    const designed = fs.existsSync(path.join(it.dir, THUMB_PAGE));
    const page = await browser.newPage({ viewport: designed ? { width: W, height: H } : { width: 1280, height: 900 }, deviceScaleFactor: SCALE, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      if (designed) {
        // the page is the image: photographed at twice the size, then halved
        await page.goto(`${base}${it.url}${THUMB_PAGE}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(opts.wait ?? 300);
        // a script error leaves the image unfinished: keep the old one
        if (errors.length) throw new Error(`${THUMB_PAGE}: ${errors.join('; ')}`);
        const shot = (await page.screenshot()).toString('base64');
        const card = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
        await card.setContent(`<body style="margin:0"><img src="data:image/png;base64,${shot}" style="display:block;width:${W}px;height:${H}px"></body>`);
        await card.waitForLoadState('load');
        await card.screenshot({ path: path.join(it.dir, it.data.image) });
        await card.close();
        console.log(`${it.slug}: wrote ${it.data.image} from ${THUMB_PAGE}`);
        continue;
      }
      await page.goto(`${base}${it.url}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      if (opts.style) await page.addStyleTag({ content: opts.style });
      for (const sel of [].concat(opts.click || [])) await page.click(sel);
      await page.waitForTimeout(opts.wait ?? 600);
      const shots = [];
      for (const sel of [].concat(opts.selector || '.entry-body figure, .entry-body canvas, .entry-body svg')) {
        const el = page.locator(sel).first();
        await el.scrollIntoViewIfNeeded();
        shots.push(`data:image/png;base64,${(await el.screenshot()).toString('base64')}`);
      }
      const paper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
      const card = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await card.setContent(`<body style="margin:0;width:${W}px;height:${H}px;display:grid;place-items:center;background:${paper}"><div id="row" style="display:flex;align-items:center"></div></body>`);
      await card.evaluate(compose, { shots, trim: !!opts.trim, gap: GAP * SCALE, maxW: W - 56, maxH: H - 44 });
      await card.waitForLoadState('load');
      await card.screenshot({ path: path.join(it.dir, it.data.image) });
      await card.close();
      console.log(`${it.slug}: wrote ${it.data.image}${errors.length ? ` (page errors: ${errors.join('; ')})` : ''}`);
    } catch (err) {
      failed++;
      console.error(`${it.slug}: ${err.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }
} catch (err) {
  failed++;
  console.error(err.message);
} finally {
  if (browser) await browser.close();
  if (server) server.close();
  fs.rmSync(outDir, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
