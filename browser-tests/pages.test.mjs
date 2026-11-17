// The pages in a real browser (Playwright's Chromium: `npx playwright install
// chromium` once), on a fresh build: each loads without an error and asks no other
// server for anything; its link names the example and brings it back; Save image
// saves the picture its dialog shows; at phone width the bar is one row and nothing
// scrolls sideways; and the links between the pages arrive at the same type.
// Run with `npm run test:browser`; `MM_DRAFTS=1 npm run test:browser` tries the drafts too.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { build } from '../build/build.mjs';
import { serveStatic } from '../build/static.mjs';

const DRAFTS = !!process.env.MM_DRAFTS;
let browser, server, origin, out;
before(async () => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-browser-'));
  const res = await build({ outDir: out, drafts: DRAFTS });
  assert.deepEqual(res.errors, []);
  server = http.createServer((req, res2) => serveStatic(req, res2, out));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
  if (out) fs.rmSync(out, { recursive: true, force: true });
});

// a page at a size, with its errors and requests to other servers collected
async function open(url, { phone = false, motion = false, dpr = 1 } = {}) {
  const reducedMotion = motion ? 'no-preference' : 'reduce';
  const context = await browser.newContext(phone
    ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion, deviceScaleFactor: dpr }
    : { viewport: { width: 1280, height: 900 }, reducedMotion, deviceScaleFactor: dpr });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage(), problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) problems.push('request to ' + r.url()); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(r.status() + ' ' + r.url()); });
  await page.goto(origin + url);
  await page.locator('.bar-tools').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { page, problems, close: () => context.close() };
}
async function menu(page, item) {
  await page.getByRole('button', { name: 'Link, image and reset' }).click();
  await page.getByRole('menuitem', { name: item }).click();
}
async function copyLink(page) {
  await menu(page, 'Copy link');
  await page.locator('.bar-status', { hasText: 'Link copied' }).waitFor();
  return page.evaluate(() => navigator.clipboard.readText());
}

// Every published page, and for these a change a reader might make, by the
// page's controls (a page not listed is tried without one)
const PAGES = fs.readdirSync('content').filter((slug) => {
  const file = path.join('content', slug, 'index.html');
  return fs.existsSync(file) && (DRAFTS || !/^draft:\s*true\s*$/m.test(fs.readFileSync(file, 'utf8').split(/^---$/m)[1] || ''));
});
const CHANGES = {
  'root-systems': (page) => page.locator('#strip .strip-item[data-key="b2"]').click(),
  'dynkin-diagrams': async (page) => { await page.locator('#family button[value="hyperbolic"]').click(); await page.locator('#strip .strip-item[data-key="[5,3,3,3]"]').click(); },
  // a number on the Dynkin diagram raised from the keyboard: λ = 3ϖ1 + ϖ2
  'highest-weight-representations': (page) => page.locator('#weights .hw-num').first().press('ArrowUp'),
  'configuration-spaces': async (page) => { await page.locator('#surface .select-trigger').click(); await page.getByRole('option', { name: 'The torus' }).click(); },
  // a quartic, with the sign of a term changed
  amoebas: async (page) => { await page.locator('#degree button[value="4"]').click(); await page.locator('.am-sign').nth(2).click(); },
  knots: (page) => page.locator('#strip .strip-item[data-name="5_2"]').click(),
  // a point dragged onto another, which collide into a double point
  'hilbert-schemes': async (page) => {
    const dots = page.locator('#stage .hs-pt .handle-point');
    const a = await dots.nth(0).boundingBox(), b = await dots.nth(1).boundingBox();
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(ax + 40, ay - 25, { steps: 12 });
    await page.mouse.move(ax + 9, ay - 6, { steps: 6 });
    await page.mouse.up();
    await page.locator('#stage .handle-num').waitFor();
  },
};

for (const slug of PAGES) {
  test(slug + ': links, reset and Save image', async () => {
    const { page, problems, close } = await open('/' + slug + '/');
    try {
      assert.equal(await copyLink(page), origin + '/' + slug + '/', 'the page\'s own example needs no parameters');
      if (CHANGES[slug]) {
        await CHANGES[slug](page);
        const link = await copyLink(page);
        assert.notEqual(link, origin + '/' + slug + '/');
        assert.equal(page.url(), origin + '/' + slug + '/', 'exploring leaves the address alone');
        assert.ok(link.length < 160, link);
        await page.goto(link);
        await page.locator('.bar-tools').waitFor();
        assert.equal(page.url(), link, 'a link stays in the address bar…');
        assert.equal(await copyLink(page), link, '…and names the example it shows');
        await menu(page, 'Reset');
        await page.waitForURL(origin + '/' + slug + '/');
        assert.equal(await copyLink(page), origin + '/' + slug + '/', 'Reset is the page\'s own example');
      }

      await menu(page, 'Save image…');
      const dialog = page.getByRole('dialog', { name: 'Save image' });
      await dialog.locator('.save-preview canvas').waitFor();
      const [, w, h] = (await dialog.locator('.save-size').innerText()).match(/(\d+) × (\d+)/);
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      const png = fs.readFileSync(await (await download).path());
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [+w, +h], 'the image is the size the dialog says');
      assert.ok(png.includes(Buffer.from('iTXt')), 'with the link in it');
      assert.equal(await page.locator('.save-dialog').count(), 0, 'the dialog closes');
      assert.deepEqual(problems, []);
    } finally { await close(); }
  });
}

test('at phone width the bar is one row, and the page does not scroll sideways', async () => {
  for (const slug of PAGES) {
    const { page, problems, close } = await open('/' + slug + '/', { phone: true });
    try {
      assert.ok(await page.locator('.control-bar').evaluate((el) => el.offsetHeight) < 80, slug);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), slug);
      const tools = await page.locator('.bar-tools .bar-more').boundingBox();
      assert.ok(tools && tools.x + tools.width <= 375, slug + ': the tools button is on the screen');
      assert.deepEqual(problems, []);
    } finally { await close(); }
  }
});

test('the links between the pages arrive at the same type', async () => {
  const cases = [
    ['/root-systems/?t=b3', (p) => p.locator('#strip .strip-item[aria-pressed="true"]').getAttribute('data-key'), 'b3'],
    ['/dynkin-diagrams/?t=3.01.02.12', (p) => p.locator('#type').innerText(), /A2\(1\)|affine/],
    ['/highest-weight-representations/?t=a11&k=-4/3', (p) => p.locator('#level input.field').inputValue(), '−4/3'],
    ['/highest-weight-representations/?t=b3', (p) => p.locator('#strip .strip-item[aria-pressed="true"]').getAttribute('data-key'), 'b3'],
  ];
  for (const [url, read, want] of cases) {
    const { page, problems, close } = await open(url);
    try {
      const got = await read(page);
      if (want instanceof RegExp) assert.match(got, want, url); else assert.equal(got, want, url);
      assert.equal(page.url(), origin + url, url + ' is kept');
      // and each link the page offers to the others opens without trouble
      for (const href of await page.locator('#see-also a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
        const there = await open(href);
        try { assert.equal(there.page.url(), origin + href, href + ' is understood'); assert.deepEqual(there.problems, [], href); } finally { await there.close(); }
      }
      assert.deepEqual(problems, []);
    } finally { await close(); }
  }
});

test('Root systems: the disc far out, exactly; its link comes back, and lets go of the address bar once the disc is dragged', async () => {
  const { page, problems, close } = await open('/root-systems/?t=t23i');
  try {
    const canvas = page.locator('#canvas'), box = await canvas.boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const drag = async (dx, dy) => { await page.mouse.move(cx, cy); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(cx + dx * i / 6, cy + dy * i / 6); await page.mouse.up(); };
    for (let k = 0; k < 14; k++) await drag(...[[-200, 40], [-130, -150], [-60, 200]][k % 3]);
    // the handle into the middle of the view, then a step to the right
    const handle = page.locator('#handle').first(), hb = await handle.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(hb.x + hb.width / 2 + (cx + 9 - hb.x - hb.width / 2) * i / 8, hb.y + hb.height / 2 + (cy + 7 - hb.y - hb.height / 2) * i / 8);
    await page.mouse.up();
    await handle.press('ArrowRight');
    const link = await copyLink(page), q = new URL(link).searchParams;
    assert.ok(q.get('w').length > 20 && q.get('h').length > 20, 'far out, in the chamber of a long word: ' + link);
    const readout = await page.locator('#pos').innerText(), at = await handle.evaluate((el) => el.style.transform);
    assert.ok(/\d{5}/.test(readout), 'its simple roots have large coefficients');
    const there = await open(link.slice(origin.length));
    try {
      assert.equal(there.page.url(), link);
      assert.equal(await there.page.locator('#pos').innerText(), readout, 'the link brings back the chamber');
      assert.equal(await there.page.locator('#handle').first().evaluate((el) => el.style.transform), at, 'and the handle where it was');
      // a drag keeps the link while it lasts, and lets it go once let go (away from the handle, in the middle)
      await there.page.mouse.move(cx - 120, cy + 90);
      await there.page.mouse.down();
      for (let i = 1; i <= 6; i++) await there.page.mouse.move(cx - 120 + 12 * i, cy + 90);
      assert.equal(there.page.url(), link, 'during the drag');
      await there.page.mouse.up();
      await there.page.waitForFunction(() => location.search === '');
      assert.deepEqual(there.problems, []);
    } finally { await there.close(); }
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('Root systems: a drag that leaves the disc turns it, and coming back the way it went puts it back', async () => {
  const { page, problems, close } = await open('/root-systems/?t=t344');
  try {
    const box = await page.locator('#canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2, K = Math.min(box.width, box.height) / 2 - 12;
    const out = [];
    for (let i = 0; i <= 10; i++) out.push([-(0.3 + i / 10) * K, 0.2 * i / 10 * K]);
    const a0 = Math.atan2(0.2, -1.3), R = Math.hypot(1.3, 0.2) * K, round = [];
    for (let i = 1; i <= 36; i++) round.push([R * Math.cos(a0 + Math.PI * i / 18), R * Math.sin(a0 + Math.PI * i / 18)]);
    const walk = async (pts) => { for (const [x, y] of pts) await page.mouse.move(cx + x, cy - y); };
    // the link, from the keyboard (the mouse is holding the disc)
    const link = async () => {
      await page.locator('.bar-more').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      return page.evaluate(() => navigator.clipboard.readText());
    };
    const start = await link();
    await page.mouse.move(cx + out[0][0], cy - out[0][1]);
    await page.mouse.down();
    await walk(out.slice(1));
    const outside = await link();
    assert.ok(/b=/.test(outside), 'it moved: ' + outside);
    await walk(round.slice(0, 9));
    assert.notEqual(await link(), outside, 'round the outside, it turns');
    await walk(round.slice(9));
    assert.equal(await link(), outside, 'a whole turn round is no turn');
    await walk(out.slice().reverse());
    await page.mouse.up();
    assert.equal(await link(), start, 'and back the way it went, as it was');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('Save image: a fixed resolution, zoom by a narrower figure, the handle only when asked', async () => {
  const { page, problems, close } = await open('/root-systems/?t=b2');
  try {
    const plane = page.locator('#plane').first(), figure = page.locator('#figure').first(), before = await plane.boundingBox();
    const diagram = await page.locator('#dynkin svg').boundingBox();
    await menu(page, 'Save image…');
    const dialog = page.getByRole('dialog', { name: 'Save image' }), canvas = dialog.locator('.save-preview canvas');
    const size = async () => (await dialog.locator('.save-size').innerText()).match(/(\d+) × (\d+)/).slice(1).map(Number);
    await canvas.waitFor();
    await dialog.locator('[data-opt="zoom"] button[value="1"]').click(); // (it opens at 150%)
    // the diagram alone: a small image, at 4 pixels to each of its own
    await dialog.getByRole('button', { name: 'Roots' }).click();
    await dialog.getByRole('button', { name: 'Dynkin diagram' }).click();
    await page.waitForFunction(() => !document.querySelector('[data-save]').disabled && document.querySelector('.save-size').textContent);
    const [w, h] = await size();
    assert.ok(Math.abs(w - (diagram.width * 4 + 128)) < 3 && Math.abs(h - (diagram.height * 4 + 128)) < 3, w + ' × ' + h);
    // zoomed, the diagram keeps its size on the page, so it is twice as large in the image
    const at100 = await canvas.evaluate((c) => c.toDataURL());
    await dialog.locator('[data-opt="zoom"] button[value="2"]').click();
    await page.waitForFunction((was) => { const c = document.querySelector('.save-preview canvas'); return c && c.toDataURL() !== was; }, at100);
    const [w2] = await size();
    assert.ok(Math.abs(w2 - 2 * w) < 4, w2 + ' is twice ' + w);
    assert.equal(await figure.getAttribute('style'), null, 'the figure is put back as it was');
    assert.deepEqual(await plane.boundingBox(), before);
    await dialog.getByRole('button', { name: 'Roots' }).click();
    await dialog.getByRole('button', { name: 'Dynkin diagram' }).click();
    assert.equal(await page.locator('#handle').first().isVisible(), true, 'and so is its handle'); // (the first: a capture may have its copy over the figure)
    await dialog.getByRole('button', { name: 'Show handle' }).click();
    await page.waitForFunction(() => !document.querySelector('[data-save]').disabled);
    assert.equal(page.url(), origin + '/root-systems/?t=b2', 'drawing for the image is not a change of the example');
    await dialog.getByRole('button', { name: 'Close' }).click();
    assert.equal(await page.locator('.save-dialog').count(), 0);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('Save image draws in a hidden full-width frame: the page behind it does not change', async () => {
  for (const viewport of [{ phone: false }, { phone: false, dpr: 2 }, { phone: true, dpr: 3 }]) {
    const { page, problems, close } = await open('/root-systems/?t=b2', viewport);
    try {
      await page.evaluate(() => scrollTo(0, 300));
      await menu(page, 'Save image…');
      await page.locator('.save-preview canvas').waitFor();
      // each frame while the image is drawn: does the figure lie exactly where it lay,
      // element by element, untouched, and has the page below stayed put?
      const frames = await page.evaluate(async () => {
        const fig = document.getElementById('figure'), below = document.querySelector('.entry-foot');
        const parts = (root) => [root, ...root.querySelectorAll('*')].map((n) => n.getBoundingClientRect());
        const was = parts(fig), b0 = below.getBoundingClientRect().top, out = [];
        document.querySelector('.save-dialog [data-opt="zoom"] button[value="2"]').click();
        for (let k = 0; k < 30; k++) {
          await new Promise((r) => requestAnimationFrame(r));
          const copy = document.querySelector('figure[aria-hidden="true"]'), now = parts(fig);
          const off = Math.max(...now.map((r, i) => Math.max(Math.abs(r.left - was[i].left), Math.abs(r.top - was[i].top), Math.abs(r.width - was[i].width), Math.abs(r.height - was[i].height))));
          out.push({ off: Math.round(off * 1000) / 1000, below: Math.round((below.getBoundingClientRect().top - b0) * 1000) / 1000, styled: fig.hasAttribute('style'), copy: !!copy });
        }
        return out;
      });
      for (const f of frames) assert.ok(f.off <= 0.01 && f.below === 0 && !f.styled && !f.copy, JSON.stringify(f)); // to the hundredth of a pixel
      assert.equal(await page.locator('iframe[name="mm-save-frame"]').count(), 1, 'drawn in the hidden frame');
      await page.locator('.save-dialog [data-cancel]').first().click();
      assert.equal(await page.locator('iframe[name="mm-save-frame"]').count(), 0, 'which goes with the dialog');
      assert.deepEqual(problems, []);
    } finally { await close(); }
  }
});

test('Save image: the same image at each zoom on a phone as on a desktop', async () => {
  const sizes = [];
  for (const viewport of [{ phone: false }, { phone: true, dpr: 3 }]) {
    const { page, problems, close } = await open('/knots/', viewport);
    try {
      await menu(page, 'Save image…');
      const dialog = page.getByRole('dialog', { name: 'Save image' }), out = [];
      for (const z of ['1', '2']) {
        await dialog.locator('[data-opt="zoom"] button[value="' + z + '"]').click();
        await page.waitForFunction((z) => document.querySelector('[data-opt="zoom"]').value === z && !document.querySelector('[data-save]').disabled, z);
        out.push(await dialog.locator('.save-size').innerText());
      }
      sizes.push(out);
      assert.deepEqual(problems, []);
    } finally { await close(); }
  }
  assert.deepEqual(sizes[1], sizes[0]);
});

test('Save image: the hidden frame shows what the link does not name (the loops of the generators)', async () => {
  const { page, problems, close } = await open('/knots/');
  try {
    await page.locator('button.kn-gen').first().click(); // (the readouts may be redrawn meanwhile: click finds it again)
    await page.locator('#stage .kn-loop').first().waitFor();
    const loops = await page.locator('#stage .kn-loop').count();
    assert.ok(loops > 0, 'the loops show on the page');
    await page.evaluate(() => scrollTo(0, 0));
    await menu(page, 'Save image…');
    await page.waitForFunction(() => !document.querySelector('[data-save]').disabled);
    const inFrame = await page.evaluate(() => document.querySelector('iframe[name="mm-save-frame"]').contentDocument.querySelectorAll('#stage .kn-loop').length);
    assert.equal(inFrame, loops, 'and in the frame the image is drawn in');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('while Save image is open, a turning picture stands still', async () => {
  const { page, problems, close } = await open('/configuration-spaces/', { motion: true });
  try {
    const picture = () => page.locator('#space').evaluate((c) => c.toDataURL());
    const wait = (ms) => page.waitForTimeout(ms);
    const a = await picture();
    await wait(400);
    assert.notEqual(await picture(), a, 'it turns on its own');
    await menu(page, 'Save image…');
    await page.locator('.save-preview canvas').waitFor();
    await wait(200);
    const held = await picture();
    await wait(400);
    assert.equal(await picture(), held, 'and stands still while the dialog is open');
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await wait(400);
    assert.notEqual(await picture(), held, 'and turns again once it is closed');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

// Configuration spaces: the points at the top (their labels in order, x₁ first), and how often the
// paths drawn there go round a point (one number for each path)
const csDots = (page) => page.locator('#stage .cs-pt[data-t="-1"] .handle-point');
const csWhere = (page) => csDots(page).evaluateAll((ds) => ds.map((d) => [d.getAttribute('cx'), d.getAttribute('cy')].map((v) => Math.round(v * 100) / 100)));
const csWindings = (page, c) => page.locator('#stage .cs-paths > .cs-trail').evaluateAll((ps, c) => ps.map((p) => {
  const pts = p.getAttribute('d').slice(1).split('L').map((s) => s.trim().split(/\s+/).map(Number));
  let w = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = [pts[i - 1][0] - c[0], pts[i - 1][1] - c[1]], b = [pts[i][0] - c[0], pts[i][1] - c[1]];
    w += Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
  }
  return Math.round(Math.abs(w) / (2 * Math.PI) * 10) / 10;
}), c);
const csMenu = (page, move) => page.locator('#moves [data-move="' + move + '"] .menu-trigger');
const csOpenList = (page) => page.locator('.popup-list:not([hidden])');

test('configuration spaces: a move is one choice from a menu in the bar; Undo and Redo play it back', async () => {
  const { page, problems, close } = await open('/configuration-spaces/');
  try {
    const before = await csWhere(page);
    // in Artin's order, x_j round x_i with i < j; Escape closes the menu, back on its button
    await csMenu(page, 'round').click();
    assert.deepEqual(await csOpenList(page).locator('[role="menuitem"]').evaluateAll((bs) => bs.map((b) => b.value)), ['1,0', '2,0', '2,1']);
    await page.keyboard.press('Escape');
    assert.equal(await csOpenList(page).count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.closest('[data-move]')?.dataset.move), 'round');
    // from the keyboard: the second, x₃ round x₁, once round it and back where it was
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.deepEqual(await csWhere(page), before);
    assert.ok((await csWindings(page, before[0])).includes(1), 'a path once round x₁');
    assert.ok((await csWindings(page, before[1])).every((w) => w === 0), 'and none round x₂');
    // a click: x₂ and x₃ change places
    await csMenu(page, 'swap').click();
    await csOpenList(page).locator('[value="1,2"]').click();
    const after = await csWhere(page);
    assert.deepEqual(after, [before[0], before[2], before[1]]);
    const undo = page.getByRole('button', { name: 'Undo' });
    await undo.click();
    assert.deepEqual(await csWhere(page), before);
    await undo.click();
    assert.equal(await undo.isDisabled(), true, 'the loop was the first change');
    await page.keyboard.press('Control+Shift+Z');
    await page.keyboard.press('Control+Shift+Z');
    assert.deepEqual(await csWhere(page), after);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('configuration spaces: a move of two points that have collided is not offered', async () => {
  const { page, problems, close } = await open('/configuration-spaces/');
  try {
    await page.locator('#strata .st-node[aria-label^="Stratum 12|3:"]').click();
    await csMenu(page, 'swap').click();
    const offered = () => csOpenList(page).locator('[role="menuitem"]').evaluateAll((bs) => bs.map((b) => b.value + (b.disabled ? ' (not offered)' : '')));
    assert.deepEqual(await offered(), ['0,1 (not offered)', '0,2', '1,2']);
    // the list lies under its button, over the page
    const [t, l] = [await csMenu(page, 'swap').boundingBox(), await csOpenList(page).boundingBox()];
    assert.ok(l.y >= t.y + t.height && l.y < t.y + t.height + 12);
    assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y).closest('.popup-list'), [l.x + l.width / 2, l.y + l.height / 2]), true);
    // a click elsewhere closes it
    await page.mouse.click(4, 400);
    assert.equal(await csOpenList(page).count(), 0);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('configuration spaces: the generators of the braid group, each drawn as a braid and, chosen, played from a row', async () => {
  const { page, problems, close } = await open('/configuration-spaces/');
  try {
    const gens = page.locator('#gens button');
    assert.equal(await gens.count(), 3, 'x₂ round x₁, x₃ round x₁, x₃ round x₂');
    await csMenu(page, 'swap').click();
    await csOpenList(page).locator('[value="0,1"]').click();
    const before = await csWhere(page);
    await gens.nth(1).click();
    assert.equal(await gens.nth(1).getAttribute('aria-checked'), 'true');
    // the points jump into a level row, evenly spaced, the paths start afresh, and x₃ goes once round x₁
    const row = await csWhere(page);
    assert.ok(row[0][0] < row[1][0] && row[1][0] < row[2][0]);
    assert.ok(Math.abs(row[0][1] - row[1][1]) < 0.5 && Math.abs(row[1][1] - row[2][1]) < 0.5);
    assert.ok(Math.abs((row[1][0] - row[0][0]) - (row[2][0] - row[1][0])) < 0.5);
    assert.deepEqual(await csWindings(page, row[0]), [0, 0, 1], 'x₃ once round x₁, the others still');
    assert.deepEqual(await csWindings(page, row[1]), [0, 0, 0], 'and not round x₂');
    // Undo takes back the loop, then the jump
    const undo = page.getByRole('button', { name: 'Undo' });
    await undo.click();
    assert.deepEqual(await csWhere(page), row);
    await undo.click();
    assert.deepEqual(await csWhere(page), before);
    // unordered: the swaps of neighbours in the row; on the torus, with the loops of x₁ across the sides and the top
    await page.getByRole('radio', { name: 'Unordered points' }).click();
    await page.locator('#surface .select-trigger').click();
    await page.getByRole('option', { name: 'The torus' }).click();
    assert.equal(await gens.count(), 4);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('configuration spaces: the braid of a loop on a surface is drawn in its box, which stands still but turns under a drag', async () => {
  const { page, problems, close } = await open('/configuration-spaces/?x=torus&k=2', { motion: true });
  try {
    await page.evaluate(() => document.getElementById('sec-braids').scrollIntoView({ block: 'start', behavior: 'instant' }));
    const braid = page.locator('#braid'), picture = () => braid.evaluate((c) => c.toDataURL());
    assert.equal(await braid.evaluate((c) => c.classList.contains('is-3d')), true);
    const b = await picture();
    await page.waitForTimeout(400);
    assert.equal(await picture(), b, 'it does not turn on its own');
    const r = await braid.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + 60, r.y + r.height / 2, { steps: 4 });
    await page.mouse.up();
    assert.notEqual(await picture(), b, 'a drag turns it');
    await braid.focus();
    const c = await picture();
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await picture(), c, 'and so do the arrow keys');
    // on a curve the strands hang under it, flat
    await page.locator('#surface .select-trigger').click();
    await page.getByRole('option', { name: 'The circle' }).click();
    assert.equal(await braid.evaluate((c) => c.classList.contains('is-3d')), false);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('configuration spaces: beside the braid, the points in the row where it starts, wherever they are at the top', async () => {
  const { page, problems, close } = await open('/configuration-spaces/');
  try {
    const shown = page.locator('#braid-copy > svg:not([hidden])');
    assert.equal(await shown.count(), 1);
    assert.equal(await shown.locator('use').count(), 0, 'not the figure at the top');
    const dots = await shown.locator('.cs-pt[data-t="-1"] .handle-point').evaluateAll((ds) => ds.map((d) => [+d.getAttribute('cx'), +d.getAttribute('cy')]));
    assert.equal(dots.length, 3);
    assert.ok(dots.every((d) => Math.abs(d[1] - dots[0][1]) < 0.5), 'a level row');
    const top = await csWhere(page);
    assert.ok(!top.every((p) => Math.abs(p[1] - top[0][1]) < 0.5), 'where the points at the top are not');
    assert.equal(await page.locator('#hint').isVisible(), false, 'and under them no hint');
    // a loop chosen plays at the top, and beside the braid that figure shows while its path lasts
    await page.locator('#gens button').nth(1).click();
    assert.equal(await shown.count(), 1);
    assert.equal(await shown.locator('use').count(), 1);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('configuration spaces: the text about the plane is there only for the plane, and that about surfaces not for a curve', async () => {
  const { page, problems, close } = await open('/configuration-spaces/');
  try {
    const parts = ['plane-text', 'artin-text', 'cohom-plane', 'turns-text', 'gens-text', 'cohom-case'];
    const shown = () => page.evaluate((ids) => ids.filter((id) => !document.getElementById(id).hidden), parts);
    const space = async (name) => { await page.locator('#surface .select-trigger').click(); await page.getByRole('option', { name }).click(); };
    assert.deepEqual(await shown(), ['plane-text', 'artin-text', 'cohom-plane', 'turns-text', 'gens-text'], 'Arnold’s formula said once');
    await page.getByRole('radio', { name: 'Unordered points' }).click();
    assert.deepEqual(await shown(), parts, 'and for unordered points how theirs are computed');
    await space('The torus');
    assert.deepEqual(await shown(), ['turns-text', 'gens-text', 'cohom-case']);
    await space('The circle');
    assert.deepEqual(await shown(), ['cohom-case']);
    assert.match(await page.locator('#braid-cap').innerText(), /^Time goes up/);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('configuration spaces: points collided in the strata and set apart there go back where they were', async () => {
  const { page, problems, close } = await open('/configuration-spaces/');
  try {
    const dots = page.locator('#stage .cs-pt[data-t="-1"] .handle-point'), where = () => dots.evaluateAll((ds) => ds.map((d) => d.getAttribute('cx') + ',' + d.getAttribute('cy')));
    const node = (start) => page.locator('#strata .st-node[aria-label^="Stratum ' + start + ':"]');
    const start = await where();
    await node('12|3').click();
    assert.equal(await dots.count(), 2, 'x₁ = x₂');
    await node('123').click();
    assert.equal(await dots.count(), 1);
    await node('1|2|3').click();
    assert.deepEqual(await where(), start);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('typed values: a fraction typed on the Dynkin diagram where any weight may be chosen, and what is not allowed marked', async () => {
  const { page, problems, close } = await open('/highest-weight-representations/');
  try {
    const nums = page.locator('#weights .hw-num'), box = page.locator('#weights input.field');
    const values = () => nums.evaluateAll((els) => els.map((e) => e.getAttribute('aria-valuetext')));
    // a click between a number's arrows: on an integral λ it steps, and opens no box
    const middle = async (i) => { const b = await nums.nth(i).boundingBox(); await page.mouse.click(b.x + b.width / 2 + 2, b.y + b.height / 2); };
    await middle(0);
    assert.deepEqual(await values(), ['3', '1']);
    assert.equal(await box.count(), 0, 'an integral λ is stepped, not typed');
    await page.locator('#any button').click();
    assert.equal(await page.locator('.control-bar input.field:visible').count(), 0, 'and nothing in the bar edits λ');
    const type = async (i, text) => { await middle(i); assert.equal(await box.inputValue(), await nums.nth(i).getAttribute('aria-valuetext')); await box.fill(text); await box.press('Enter'); };
    await type(0, '1/3');
    await type(1, '-1/2');
    assert.deepEqual(await values(), ['1/3', '−1/2']);
    assert.equal(await box.count(), 0, 'Enter takes the box away');
    assert.match(await copyLink(page), /a=1&l=1\/3,-0\.5/, 'a third as a fraction, a half as a decimal');
    await middle(0);
    await box.fill('20');
    await box.press('Enter');
    assert.equal(await box.getAttribute('aria-invalid'), 'true', 'a coefficient beyond 12 is not taken');
    await box.press('Escape');
    assert.equal(await box.count(), 0);
    assert.deepEqual(await values(), ['1/3', '−1/2'], 'Escape leaves the number as it was');
    // a step keeps the fraction
    await nums.first().press('ArrowUp');
    assert.deepEqual(await values(), ['4/3', '−1/2']);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('amoebas: the readouts lead to the sections that explain them, and the area against log t is worked out', async () => {
  const { page, problems, close } = await open('/amoebas/');
  try {
    // (the area is a link once it is known)
    await page.locator('#about a[href="#sec-area"]').waitFor({ timeout: 20000 });
    const hrefs = await page.locator('#about a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    assert.deepEqual(hrefs, ['#sec-holes', '#sec-area']);
    for (const href of hrefs) assert.equal(await page.locator(href).count(), 1, href);
    // in a worker, value by value, up to log t = 6
    await page.waitForFunction(() => / at 6$/.test(document.getElementById('chart').getAttribute('aria-label') || ''), null, { timeout: 30000 });
    assert.ok(await page.locator('#chart .ch-curve').count() === 1 && await page.locator('#chart .ch-handle').count() === 1, 'the curve, and the handle at the formula’s t');
    // the numbers in the readouts are typeset, and only they lead to the text: the holes (as many
    // as are possible, so no more is said), the area as a percentage of the largest, 9/2 π²
    const tex = (sel) => page.locator(sel).evaluateAll((es) => es.map((e) => e.textContent));
    assert.deepEqual(await tex('#about a[href="#sec-holes"] annotation'), ['1']);
    assert.equal(await page.locator('#about dd').first().innerText().then((t) => /possible/.test(t)), false);
    assert.deepEqual(await tex('#about a[href="#sec-area"] annotation'), ['100\\%']);
    assert.deepEqual(await tex('#about dd:last-of-type > .katex annotation'), ['{}\\cdot\\tfrac92\\pi^2']);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('amoebas: the chart’s handle changes t, the copies beside the figures show the amoeba, and Undo and Redo take it back', async () => {
  const { page, problems, close } = await open('/amoebas/');
  try {
    // (the handle follows t at the next frame)
    const t = async () => { await page.evaluate(() => new Promise((done) => setTimeout(done, 100))); return page.locator('.ch-handle').getAttribute('aria-valuenow'); };
    await page.evaluate(() => document.getElementById('sec-area').scrollIntoView({ block: 'start', behavior: 'instant' }));
    const knob = await page.locator('.ch-handle .handle-dot').boundingBox(), svg = await page.locator('#chart').boundingBox();
    const W = +(await page.locator('#chart').getAttribute('viewBox')).split(' ')[2], x = (s) => svg.x + (44 + s / 6 * (W - 56)) * svg.width / W;
    await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
    await page.mouse.down();
    await page.mouse.move(x(4.5), knob.y + 30, { steps: 8 });
    await page.mouse.up();
    assert.equal(await t(), '4.5');
    assert.match(await page.locator('#t-val').innerText(), /e\s*4\.5/, 'the t under the formula is the handle’s');
    // the copy of the amoeba beside the chart is drawn, at the same t
    await page.waitForFunction(() => {
      const c = document.getElementById('copy-area'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let k = 0; k < d.length; k += 4 * 97) if (d[k] < 200 || d[k + 1] < 200) ink++;
      return ink > 15;
    });
    await page.locator('#undo').click();
    assert.equal(await t(), '2.5');
    await page.keyboard.press('Control+Shift+Z');
    assert.equal(await t(), '4.5');
    // a click on the chart puts t there; the keys move the handle by a tenth (measured again:
    // Playwright scrolls the page to bring the bar's buttons in, sticky as they are)
    const svg2 = await page.locator('#chart').boundingBox();
    await page.mouse.click(x(1) - svg.x + svg2.x, svg2.y + svg2.height / 3);
    assert.equal(await t(), '1');
    await page.locator('.ch-handle').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await t(), '1.1');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('zoom: a slider with a mouse; on a touch screen two fingers zoom the picture, and one scrolls the page', async () => {
  let { page, problems, close } = await open('/amoebas/');
  try {
    const zoom = () => page.evaluate(() => document.getElementById('zoom').value);
    const z0 = await zoom();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    assert.ok(Math.abs(await zoom() / z0 - 1.4) < 1e-6, 'a magnifier zooms by a step');
    assert.deepEqual(problems, []);
  } finally { await close(); }
  ({ page, problems, close } = await open('/amoebas/', { phone: true }));
  try {
    assert.equal(await page.locator('mm-zoom').isVisible(), false, 'no slider on a touch screen');
    const st = () => page.evaluate(() => ({ zoom: document.getElementById('zoom').value, y: scrollY, scale: visualViewport.scale }));
    const cdp = await page.context().newCDPSession(page), b = await page.locator('#canvas').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const before = await st();
    await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[cx - 30 - 5 * k, cy], [cx + 30 + 5 * k, cy]]);
    await touch('touchEnd', []);
    const after = await st();
    assert.ok(Math.abs(after.zoom / before.zoom - 2) < 0.02, 'twice as far apart, twice the size: ' + after.zoom / before.zoom);
    assert.equal(after.y, before.y, 'the page does not scroll');
    assert.equal(after.scale, 1, 'nor zoom');
    await touch('touchStart', [[cx, cy + 100]]);
    for (let k = 1; k <= 8; k++) await touch('touchMove', [[cx, cy + 100 - 20 * k]]);
    await touch('touchEnd', []);
    await page.waitForFunction((y) => scrollY > y + 50, before.y);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('highest weight: the numbers beside the picture in TeX, the table headed in words, and the text for the type in view', async () => {
  const { page, problems, close } = await open('/highest-weight-representations/');
  try {
    const dd = page.locator('#about dd');
    assert.equal(await dd.first().locator('.katex').count(), 1, 'the dimension');
    assert.equal(await dd.nth(1).locator('.katex').count(), 3, 'the weights, the orbits and W');
    assert.deepEqual(await page.locator('#table th').allInnerTexts(), ['Weight', 'Orbit size', 'Multiplicity']);
    assert.equal(await page.locator('#table tfoot').count(), 0, 'no sum under it');
    const shown = (sec) => page.locator('#sec-' + sec).isVisible();
    assert.deepEqual([await shown('shells'), await shown('relief'), await shown('tensor'), await shown('affine')], [true, true, true, false], 'sl3');
    await page.locator('#strip .strip-item[data-key="g2"]').click();
    assert.deepEqual([await shown('shells'), await shown('relief')], [false, true], 'g2: no hexagons, a relief');
    await page.locator('#strip .strip-item[data-key="b3"]').click();
    assert.equal(await shown('relief'), false, 'rank three: no relief');
    await page.locator('#family button[value="affine"]').click();
    await page.locator('#strip .strip-item[data-key="a11"]').click();
    assert.deepEqual([await shown('weights'), await shown('tensor'), await shown('verma'), await shown('affine'), await shown('verma-affine')], [false, false, false, true, true], 'affine sl2: its own sections only');
    assert.equal(await page.locator('.side-head #level').isVisible(), true, 'its level under the title');
    assert.equal(await page.locator('.control-bar #level').count(), 0, 'not in the bar');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('highest weight: an affine algebra has whole levels from 0 and Λ dominant integral, unless Any weight is on', async () => {
  const { page, problems, close } = await open('/highest-weight-representations/?t=a21');
  try {
    const any = page.getByRole('button', { name: 'Any weight' }), range = page.locator('#level input[type="range"]'), box = page.locator('#level input.field');
    const labels = () => page.locator('#weights .hw-num').evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-valuetext')));
    assert.equal(await any.getAttribute('aria-pressed'), 'false', 'off at first');
    assert.deepEqual([await range.getAttribute('min'), await range.getAttribute('step')], ['0', '1']);
    await box.fill('3/2');
    await box.press('Enter');
    assert.equal(await box.inputValue(), '2', 'a level typed goes to the nearest whole one');
    assert.deepEqual(await labels(), ['2', '0', '0']);
    await page.locator('#handle-lam').focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    assert.deepEqual(await labels(), ['0', '2', '0'], 'the handle stops where λ_0 would go below 0');
    await any.click();
    assert.deepEqual([await range.getAttribute('min'), await range.getAttribute('step')], ['-6', 'any']);
    await box.fill('-4/3');
    await box.press('Enter');
    assert.equal(await box.inputValue(), '−4/3');
    await any.click();
    assert.deepEqual(await labels(), ['0', '2', '0'], 'Any weight off: Λ as it was');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('highest weight: the picture zooms by the slider or by pinching, as far out as the slider goes, and a link keeps the zoom', async () => {
  let { page, problems, close } = await open('/highest-weight-representations/');
  try {
    const picture = () => page.locator('#canvas').evaluate((c) => c.toDataURL());
    const zoom = () => page.evaluate(() => +document.getElementById('zoom').value);
    const fitted = await zoom();
    assert.ok(fitted > 1 && fitted < 12, 'the slider shows the scale of the fitted picture: ' + fitted);
    const a = await picture();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const z = await zoom();
    assert.ok(Math.abs(z / fitted - 1.4) < 1e-6, 'a magnifier zooms by a step');
    assert.notEqual(await picture(), a);
    const link = await copyLink(page);
    assert.match(link, /[?&]z=/);
    await close();
    ({ page, problems, close } = await open(new URL(link).pathname + new URL(link).search));
    assert.ok(Math.abs(await zoom() / z - 1) < 0.01, 'the link brings the zoom back (as it writes it): ' + await zoom() + ' for ' + z);
    await close();
    // λ far out: the fitted picture goes no farther out than the slider, and keeps λ in view
    ({ page, problems, close } = await open('/highest-weight-representations/?l=20,20'));
    assert.ok(Math.abs(await zoom() - 1) < 1e-6, 'at the least scale: ' + await zoom());
    const [h, c] = [await page.locator('#handle-lam').boundingBox(), await page.locator('#canvas').boundingBox()];
    assert.ok(h.x > c.x && h.y > c.y && h.x + h.width < c.x + c.width && h.y + h.height < c.y + c.height, 'the handle of λ in the picture');
    assert.deepEqual(problems, []);
  } finally { await close(); }
  ({ page, problems, close } = await open('/highest-weight-representations/', { phone: true }));
  try {
    assert.equal(await page.locator('mm-zoom').isVisible(), false, 'no slider on a touch screen');
    const zoom = () => page.evaluate(() => +document.getElementById('zoom').value);
    const cdp = await page.context().newCDPSession(page), b = await page.locator('#canvas').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const y0 = await page.evaluate(() => scrollY), z0 = await zoom();
    await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[cx - 30 - 5 * k, cy], [cx + 30 + 5 * k, cy]]);
    await touch('touchEnd', []);
    assert.ok(Math.abs(await zoom() / z0 - 2) < 0.02, 'twice as far apart, twice as near: ' + await zoom() / z0);
    assert.equal(await page.evaluate(() => scrollY), y0, 'the page does not scroll');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('a figure in the text that changes the main picture has a copy of it beside it', async () => {
  // configuration spaces: a stratum chosen moves the points at the top; the copy is that picture, live
  let { page, problems, close } = await open('/configuration-spaces/?k=4');
  try {
    const where = () => page.locator('#stage .cs-pt[data-t="-1"] .handle-point').evaluateAll((ds) => ds.map((d) => d.getAttribute('cx') + ',' + d.getAttribute('cy')).join(' '));
    const before = await where();
    await page.evaluate(() => document.getElementById('sec-collisions').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.locator('#strata .st-node').nth(3).click();
    assert.notEqual(await where(), before, 'the points have moved');
    assert.equal(await page.locator('#stage-copy use[href="#stage"]').count(), 1);
    assert.ok(await page.locator('#stage-copy').isVisible());
    const fits = await page.evaluate(() => { const box = document.getElementById('strata').parentNode; return box.scrollWidth <= box.clientWidth; });
    assert.ok(fits, 'the strata of four points fit beside the copy, without scrolling');
    assert.deepEqual(problems, []);
  } finally { await close(); }
  // hilbert schemes: the disc changes the configuration only when it has a triple point, and only then is the copy shown
  ({ page, problems, close } = await open('/hilbert-schemes/'));
  try {
    await page.evaluate(() => document.getElementById('sec-collide').scrollIntoView({ block: 'start', behavior: 'instant' }));
    assert.equal(await page.locator('#plane-copy').isVisible(), false, 'no triple point: no copy');
    await page.locator('#strip button').first().click();
    await page.evaluate(() => document.getElementById('sec-collide').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.locator('#plane-copy').waitFor();
    const formula = () => page.locator('#formula').innerText();
    const f0 = await formula(), d = await page.locator('#disc').boundingBox();
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    await page.mouse.down();
    await page.mouse.move(d.x + d.width * 0.72, d.y + d.height * 0.3, { steps: 6 });
    await page.mouse.up();
    await page.waitForFunction((f0) => document.getElementById('formula').innerText !== f0, f0);
    assert.equal(await page.locator('#plane-copy use[href="#stage"]').count(), 1);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('knots: a name under the skein diagrams leads into that diagram', async () => {
  const { page, problems, close } = await open('/knots/');
  try {
    await page.evaluate(() => document.getElementById('skein').closest('section').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.locator('.kn-into').first().waitFor();
    assert.equal(await page.locator('#skein-path button').count(), 0);
    await page.locator('.kn-into').first().click();
    assert.equal(await page.locator('#skein-path button').count(), 1, 'one step taken');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('knots: a ring drawn round a strand of the figure-eight knot is named as the sum it makes, not 6^2_2', async () => {
  const { page, problems, close } = await open('/knots/');
  try {
    // a point on the strand that runs over the top of the knot, on the screen
    const [x, y] = await page.evaluate(() => {
      const path = Array.from(document.querySelectorAll('#stage path.kn-strand')).reduce((a, b) => (b.getTotalLength() > a.getTotalLength() ? b : a));
      const q = path.getPointAtLength(0.3 * path.getTotalLength()), m = path.getScreenCTM();
      return [q.x * m.a + q.y * m.c + m.e, q.x * m.b + q.y * m.d + m.f];
    });
    await page.locator('#mode button[value="draw"]').click();
    await page.mouse.move(x + 28, y);
    await page.mouse.down();
    for (let i = 1; i <= 48; i++) await page.mouse.move(x + 28 * Math.cos(Math.PI * i / 24), y + 28 * Math.sin(Math.PI * i / 24), { steps: 2 });
    await page.mouse.up();
    await page.locator('#name annotation', { hasText: '\\#' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('#name annotation').textContent(), '4_{1}\\mathbin{\\#}2^{2}_{1}');
    assert.equal(await page.locator('#sub').innerText(), 'A sum of a knot and a link');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('amoebas: t has a slider under the formula, down to log t = 0.05, and a term clicked a slider of its height', async () => {
  const { page, problems, close } = await open('/amoebas/');
  try {
    const tex = (sel) => page.locator(sel + ' annotation').evaluateAll((as) => as.map((a) => a.textContent).join(''));
    assert.equal(await page.locator('#v-row').isVisible(), false, 'no term chosen, so no height slider, when the page opens');
    await page.locator('#logt').focus();
    await page.keyboard.press('Home');
    assert.equal(await tex('#t-val'), 't=\\mathrm{e}^{0.05}');
    await page.locator('.am-tm .am-body').nth(1).click();
    assert.equal(await tex('#v-val'), 't^{2}z');
    await page.locator('#height').focus();
    await page.keyboard.press('End');
    assert.equal(await tex('#v-val'), 't^{6}z');
    assert.equal(await page.locator('.am-tm .am-body').nth(1).locator('annotation').textContent(), 't^{6}z', 'the term follows its slider');
    await page.keyboard.press('Control+Z');
    assert.equal(await tex('#v-val'), 't^{2}z', 'and Undo takes it back');
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('amoebas: a click on a region of the complement, or on its label where the amoeba covers it, chooses its term with its slider', async () => {
  const { page, problems, close } = await open('/amoebas/');
  try {
    const cv = await page.locator('#canvas').boundingBox(), mid = [cv.x + cv.width / 2, cv.y + cv.height / 2];
    const chosen = () => page.locator('#v-val annotation').evaluateAll((as) => as.map((a) => a.textContent).join(''));
    // nothing chosen at first; the hole of the cubic, round the middle of the picture (away from
    // its label), chosen by a click and let go by another
    assert.equal(await page.locator('.am-tm.is-sel').count(), 0);
    await page.mouse.click(mid[0] - 30, mid[1] + 30);
    assert.ok(await page.locator('#v-row').isVisible());
    assert.equal(await chosen(), 't^{3}zw');
    await page.mouse.click(mid[0] - 30, mid[1] + 30);
    assert.equal(await page.locator('#v-row').isVisible(), false, 'let go');
    await page.mouse.click(mid[0] - 30, mid[1] + 30);
    // a term chosen in the formula, then t near 1: the amoeba covers the hole's label, which still chooses it
    await page.locator('.am-tm .am-body').nth(1).click();
    assert.equal(await chosen(), 't^{2}z');
    await page.locator('#logt').focus();
    await page.keyboard.press('Home');
    await page.evaluate(() => new Promise((done) => setTimeout(done, 200)));
    await page.mouse.click(mid[0], mid[1]);
    assert.equal(await chosen(), 't^{3}zw');
    // the slider of t keeps it (and stays where it is); a click anywhere else lets go of it
    const t = await page.locator('#logt').boundingBox();
    await page.mouse.click(t.x + t.width * 0.7, t.y + t.height / 2);
    assert.ok(await page.locator('#v-row').isVisible());
    assert.equal((await page.locator('#logt').boundingBox()).y, t.y);
    await page.locator('.lede').click();
    assert.equal(await page.locator('#v-row').isVisible(), false);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('a strip of pictures is one stop for Tab, with the arrow keys, Home and End along the family shown', async () => {
  const { page, problems, close } = await open('/root-systems/');
  try {
    const strip = page.locator('#strip'), key = () => page.evaluate(() => document.activeElement.dataset.key);
    const shown = () => strip.locator('.strip-item:visible').evaluateAll((bs) => bs.map((b) => b.dataset.key));
    assert.equal(await strip.locator('.strip-item[tabindex="0"]').count(), 1, 'one stop for Tab');
    assert.equal(await strip.locator('.strip-item[tabindex="0"]').getAttribute('aria-pressed'), 'true', 'on the system shown');
    const list = await shown();
    await strip.locator('.strip-item[tabindex="0"]').focus();
    const at = list.indexOf(await key());
    await page.keyboard.press('ArrowRight');
    assert.equal(await key(), list[at + 1]);
    await page.keyboard.press('End');
    assert.equal(await key(), list[list.length - 1]);
    await page.keyboard.press('ArrowRight');
    assert.equal(await key(), list[0], 'round to the start');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Home');
    assert.equal(await key(), list[0]);
    assert.equal(await strip.locator('.strip-item[tabindex="0"]').count(), 1, 'the stop follows the focus');
    // Alt with an arrow is the browser's
    await page.keyboard.press('Alt+ArrowRight');
    assert.equal(await key(), list[0]);
    // another family: its items only, from the keyboard too; Enter chooses
    await page.locator('#family button[value="affine"]').click();
    const affine = await shown();
    assert.ok(affine.length && !affine.includes(list[0]));
    await strip.locator('.strip-item[tabindex="0"]').focus();
    await page.keyboard.press('End');
    assert.equal(await key(), affine[affine.length - 1]);
    await page.keyboard.press('Enter');
    await page.waitForFunction((k) => document.querySelector('#strip .strip-item[aria-pressed="true"]')?.dataset.key === k, affine[affine.length - 1]);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('Undo and Redo: the buttons start disabled; Ctrl+Z, Shift+Ctrl+Z and Ctrl+Y take a change back and make it again, but not in a text field', async () => {
  const { page, problems, close } = await open('/dynkin-diagrams/');
  try {
    const type = () => page.locator('#type').innerText(), off = () => page.evaluate(() => ['undo', 'redo'].map((id) => document.getElementById(id).disabled));
    assert.deepEqual(await off(), [true, true]);
    const a = await type();
    await page.locator('#strip .strip-item[data-key="E7"]').click();
    const b = await type();
    assert.notEqual(a, b);
    assert.deepEqual(await off(), [false, true]);
    const press = async (key, want) => { await page.keyboard.press(key); assert.equal(await type(), want, key); };
    await page.evaluate(() => document.activeElement.blur());
    await press('Control+z', a);
    assert.deepEqual(await off(), [true, false]);
    await press('Control+Shift+z', b);
    await press('Meta+z', a);
    await press('Control+y', b);
    // a text field has an Undo of its own, a slider has not; a key a handler took is left alone
    await page.evaluate(() => { const f = document.createElement('input'); document.body.prepend(f); f.focus(); });
    await press('Control+z', b);
    await page.evaluate(() => { const s = document.createElement('input'); s.type = 'range'; s.id = 'probe-range'; document.body.prepend(s); s.focus(); });
    await press('Control+z', a);
    await page.evaluate(() => document.getElementById('probe-range').addEventListener('keydown', (e) => e.preventDefault()));
    await press('Control+Shift+z', a);
    assert.deepEqual(problems, []);
  } finally { await close(); }
});

test('MM.setHTML leaves the same HTML alone, and writes afresh what something else has changed', async () => {
  const { page, close } = await open('/root-systems/');
  try {
    assert.deepEqual(await page.evaluate(() => {
      const d = document.createElement('div'), out = [];
      document.body.append(d);
      out.push(MM.setHTML(d, 'a $x$'), MM.setHTML(d, 'a $x$'));
      d.textContent = 'b';
      out.push(MM.setHTML(d, 'a $x$'), !!d.querySelector('.katex'));
      out.push(MM.kv(d, [['A', '$1$'], null]), d.querySelectorAll('dt').length, MM.kv(d, [['A', '$1$']]));
      return out;
    }), [true, false, true, true, true, 1, false]);
  } finally { await close(); }
});
