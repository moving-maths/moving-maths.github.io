/* Moving Maths: a link to the example in view, a way back to the page's own
 * example, and the figure saved as an image. Loaded on every content page
 * after site.js. A page with an example to share calls MM.example() once its
 * figure is drawn (docs/authoring.md, "Links, reset and images"):
 *
 *   const example = MM.example({
 *     fields: { t: 'text', n: 'numbers', v: 'rotation' }, // the link's parameters, and how each is written
 *     view: ['v'],                    // those that only turn, pan or zoom the picture
 *     get() { return { t: …, n: …, v: … }; },  // the example in view, field by field
 *     set(values, named) { … },       // shows an example; false if it cannot (below)
 *     pictures() { return [{ label: 'Roots', element: canvas }]; },  // what Save image offers
 *     redraw(options) { … },          // draws every canvas now, at MM.pixelRatio(); with
 *                                     // options.handles false, without the handles
 *     scene: { get() { … }, set(s) { … } },  // optional: what the pictures show that the
 *                                     // link does not name (below)
 *   });
 *   example.changed();                // after each change (the end of draw() is a good place)
 *
 * set() gets every field: those the link names, and for the rest the page's own
 * example's values. `named` is the set of fields the link names (on Reset, all);
 * a field whose default depends on another (a handle's place depends on the
 * type) should take the page's default for that other one when it is not named,
 * so that a link to /root-systems/?t=b3 shows B₃ as choosing it would.
 *
 * The page's control bar gets a button at its end, with Copy link, Save image
 * and Reset; and beside it, while the page's first picture is out of view, a
 * button that goes back to it. A link names only what differs from the page's own example, so it
 * stays short: /root-systems/?t=b2&n=0.6,0.8. The address bar never changes
 * while the reader explores; a page opened from a link keeps that link until
 * the reader changes the example, or moves the picture away from the view it
 * names (once the drag is let go: MM.moved). The picture turning on its own
 * does not count.
 *
 * Save image draws the pictures in a hidden frame of the same page (see REF below),
 * which is given the example by its fields. Whatever else the pictures show (a picked
 * root, the loops of a group's generators, the trails of moving points, a drawn curve
 * exactly as it is) the page hands over with `scene`: get() returns it as plain data
 * (it goes through JSON), and set(s), called in the frame after set(), shows it and
 * draws. Leave out what is only there while the pointer is (a hover).
 *
 * The codecs (MM.example.codecs) are plain functions with no use of the page,
 * so test/example.test.mjs loads this file in Node.
 */
(function (root) {
  'use strict';
  const MM = root.MM || (root.MM = {});

  /* ---------- how a value is written in a link ---------- */

  const fail = (what, s) => { throw new Error('not ' + what + ': "' + s + '"'); };
  let capturing = false; // while Save image draws the page's pictures its own way
  const round = (x, d) => { const p = 10 ** d, v = Math.round(x * p) / p; return v === 0 ? 0 : v; }; // and never −0
  // A number in a link: to d decimals, unless that loses a fraction with a denominator up
  // to 12, which is written as one (−4/3, so that a special level or weight stays special).
  // (A fraction the decimals write exactly, 0 or 1/2 off by rounding, is written as decimals.)
  function numText(x, d) {
    if (Math.abs(round(x, d) - x) > 1e-12) for (let q = 2; q <= 12; q++) { const p = Math.round(x * q); if (Math.abs(x - p / q) < 1e-9 && round(p / q, d) !== p / q) return p + '/' + q; }
    return String(round(x, d));
  }
  function num(s) {
    const m = /^(-?(?:\d+\.?\d*|\.\d+))(?:\/([1-9]\d*))?$/.exec(s);
    return m ? (m[2] ? +m[1] / +m[2] : +m[1]) : fail('a number', s);
  }
  const number = (d = 4) => ({ write: (x) => numText(x, d), read: num });
  const numbers = (d = 4) => ({ write: (v) => v.map((x) => numText(x, d)).join(','), read: (s) => (s === '' ? [] : s.split(',').map(num)) });

  // A rotation of space as a unit quaternion (w, x, y, z) with w ≥ 0: four numbers
  // instead of nine, and equally precise in every direction.
  function quaternion(R) {
    const t = R[0][0] + R[1][1] + R[2][2];
    let q;
    if (t > 0) { const s = 2 * Math.sqrt(1 + t); q = [s / 4, (R[2][1] - R[1][2]) / s, (R[0][2] - R[2][0]) / s, (R[1][0] - R[0][1]) / s]; }
    else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) { const s = 2 * Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]); q = [(R[2][1] - R[1][2]) / s, s / 4, (R[0][1] + R[1][0]) / s, (R[0][2] + R[2][0]) / s]; }
    else if (R[1][1] > R[2][2]) { const s = 2 * Math.sqrt(1 + R[1][1] - R[0][0] - R[2][2]); q = [(R[0][2] - R[2][0]) / s, (R[0][1] + R[1][0]) / s, s / 4, (R[1][2] + R[2][1]) / s]; }
    else { const s = 2 * Math.sqrt(1 + R[2][2] - R[0][0] - R[1][1]); q = [(R[1][0] - R[0][1]) / s, (R[0][2] + R[2][0]) / s, (R[1][2] + R[2][1]) / s, s / 4]; }
    const n = Math.hypot(...q) * (q[0] < 0 ? -1 : 1);
    return q.map((x) => x / n);
  }
  const rotation = {
    write: (R) => numbers().write(quaternion(R)),
    read(s) {
      const q = numbers().read(s), n = Math.hypot(...q);
      if (q.length !== 4 || !(n > 0.5)) fail('a rotation', s);
      const [a, b, c, d] = q.map((x) => x / n);
      return [
        [1 - 2 * (c * c + d * d), 2 * (b * c - a * d), 2 * (b * d + a * c)],
        [2 * (b * c + a * d), 1 - 2 * (b * b + d * d), 2 * (c * d - a * b)],
        [2 * (b * d - a * c), 2 * (c * d + a * b), 1 - 2 * (b * b + c * c)],
      ];
    },
  };

  // A generalised Cartan matrix: its size, then each bond i–j (i < j, nodes
  // numbered in base 36) with |a_ij| and |a_ji| unless both are 1. A₄ is
  // 4.01.12.23, B₂ is 2.0112, and no nodes at all is 0.
  const cartan = {
    write(A) {
      const out = [A.length];
      A.forEach((row, i) => row.forEach((a, j) => {
        if (j > i && (a || A[j][i])) out.push(i.toString(36) + j.toString(36) + (a === -1 && A[j][i] === -1 ? '' : -a + '' + -A[j][i]));
      }));
      return out.join('.');
    },
    read(s) {
      const [size, ...bonds] = s.split('.'), n = +size;
      if (!/^\d{1,2}$/.test(size) || n > 35) fail('a Cartan matrix', s);
      const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));
      for (const b of bonds) {
        const m = /^([0-9a-z])([0-9a-z])(?:([1-9])([1-9]))?$/.exec(b), i = m && parseInt(m[1], 36), j = m && parseInt(m[2], 36);
        if (!m || i >= j || j >= n || A[i][j]) fail('a Cartan matrix', s);
        A[i][j] = -(m[3] || 1);
        A[j][i] = -(m[4] || 1);
      }
      return A;
    },
  };

  const codecs = {
    text: { write: String, read: (s) => (/^[\w.-]{0,64}$/.test(s) ? s : fail('a name', s)) },
    flag: { write: (v) => (v ? '1' : '0'), read: (s) => (s === '1' ? true : s === '0' ? false : fail('0 or 1', s)) },
    int: { write: (x) => String(Math.round(x)), read: (s) => (/^-?\d{1,9}$/.test(s) ? +s : fail('a whole number', s)) },
    number: number(), numbers: numbers(), rotation, cartan,
  };

  // The query string of a link: the fields that differ from `home`, in the order given.
  // Values are written with letters, digits and . , - / only; a comma and a slash are
  // left as they are.
  function query(strings, home) {
    const parts = [];
    for (const k in strings) if (strings[k] !== home[k]) parts.push(k + '=' + encodeURIComponent(strings[k]).replace(/%2C/gi, ',').replace(/%2F/gi, '/'));
    return parts.length ? '?' + parts.join('&') : '';
  }

  MM.example = function (page) {
    const fields = {};
    for (const k in page.fields) {
      const c = page.fields[k];
      fields[k] = typeof c === 'string' ? codecs[c] : c;
      if (!fields[k]) throw new Error('MM.example: no codec "' + c + '"');
    }
    const view = new Set(page.view || []);
    const write = (values) => { const out = {}; for (const k in fields) out[k] = fields[k].write(values[k]); return out; };
    const read = (strings) => { const out = {}; for (const k in fields) out[k] = fields[k].read(strings[k]); return out; };
    const now = () => write(page.get());
    const example = (strings) => Object.keys(fields).filter((k) => !view.has(k)).map((k) => strings[k]).join('&');
    const show = (strings, named) => page.set(read(strings), named) !== false;
    const all = new Set(Object.keys(fields));
    const forget = () => history.replaceState(history.state, '', location.pathname + location.hash);
    const home = now(); // the page's own example

    // a page opened from a link shows its example, and keeps the link while it does
    let kept = null;
    const params = new URLSearchParams(location.search), given = {};
    for (const k in fields) if (params.has(k)) given[k] = params.get(k);
    if (Object.keys(given).length) {
      let ok = false;
      try { ok = show({ ...home, ...given }, new Set(Object.keys(given))); } catch (err) { console.warn('MM.example: ' + err.message); }
      if (ok) kept = example(now());
      else { console.warn('MM.example: the link names an example this page cannot show'); show(home, all); forget(); }
    }

    function changed() {
      if (kept !== null && !capturing && example(now()) !== kept) { kept = null; forget(); }
    }
    const link = () => location.origin + location.pathname + query(now(), home);
    if (root.name === FRAME && root.frameElement) { serveFrame(page, (strings) => show(strings, all)); return { changed }; }
    // The reader has moved the picture (MM.moved: a drag let go, a zoom): the link goes too
    // once the view is not the one it named. (After the page's own handlers have run.)
    const named = kept === null ? null : query(now(), home);
    document.addEventListener('mm:moved', () => setTimeout(() => {
      if (kept !== null && !capturing && query(now(), home) !== named) { kept = null; forget(); }
    }, 0));
    barTools({
      link,
      atHome: () => query(now(), home) === '',
      reset() { show(home, all); changed(); },
      save: () => saveImage(page, link, now),
      picture() { const p = page.pictures && page.pictures(); return p && p[0] ? p[0].element : null; },
    });
    return { changed };
  };
  MM.example.codecs = codecs;
  MM.example.number = number;   // number(d), numbers(d): with d decimals instead of four
  MM.example.numbers = numbers;
  MM.example.query = query;

  /* ---------- the button at the end of the control bar ---------- */

  const DOTS = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.35" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.35" fill="currentColor" stroke="none"/><circle cx="13" cy="8" r="1.35" fill="currentColor" stroke="none"/></svg>';
  // back to the picture: an arrow up to a line (turned over when the picture is below)
  const GOTO = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h10"/><path d="M8 14V6"/><path d="M4.5 9.5L8 6l3.5 3.5"/></svg>';
  let menus = 0;

  // Copies text: the Clipboard API where the page may use it (https, localhost), else
  // the old way, else a box to copy it from.
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (err) { /* not allowed here */ }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(area);
    area.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch (err) { /* not supported */ }
    area.remove();
    if (!done) window.prompt('Copy this link:', text);
    return done;
  }

  function barTools(actions) {
    const bar = document.querySelector('.control-bar');
    const box = document.createElement('div'), id = 'mm-tools-' + ++menus;
    box.className = 'bar-tools';
    box.innerHTML = '<span class="bar-status" role="status"></span>'
      + '<button type="button" class="btn btn-sm btn-icon bar-goto" aria-label="Go to the picture" title="Go to the picture" hidden>' + GOTO + '</button>'
      + '<button type="button" class="btn btn-sm btn-icon bar-more" aria-haspopup="menu" aria-expanded="false" aria-controls="' + id + '" aria-label="Link, image and reset" title="Link, image and reset">' + DOTS + '</button>'
      + '<div class="menu" id="' + id + '" role="menu" hidden>'
      + '<button type="button" role="menuitem" data-do="link">Copy link</button>'
      + '<button type="button" role="menuitem" data-do="save">Save image…</button>'
      + '<button type="button" role="menuitem" data-do="reset">Reset</button></div>';
    if (bar) { bar.append(box); bar.classList.add('has-tools'); }
    const button = box.querySelector('.bar-more'), menu = box.querySelector('.menu'), status = box.querySelector('.bar-status');
    const items = () => Array.from(menu.querySelectorAll('[role="menuitem"]:not(:disabled)'));
    let timer = 0;
    function say(text) {
      status.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(() => { status.textContent = ''; }, 2400);
    }
    function open() {
      menu.querySelector('[data-do="reset"]').disabled = actions.atHome();
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      items()[0].focus();
    }
    function close(refocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (refocus) button.focus();
    }
    button.addEventListener('click', () => (menu.hidden ? open() : close(true)));
    button.addEventListener('keydown', (e) => { if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && menu.hidden) { e.preventDefault(); open(); } });
    menu.addEventListener('keydown', (e) => {
      const list = items(), i = list.indexOf(document.activeElement);
      const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 }[e.key];
      if (to !== undefined) { e.preventDefault(); list[(to + list.length) % list.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) close(false); });
    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('[data-do]');
      if (!item) return;
      close(true);
      const what = item.dataset.do;
      if (what === 'link') { if (await copy(actions.link())) say('Link copied'); }
      else if (what === 'reset') actions.reset();
      else actions.save();
    });
    // Go to the picture: shown while the page's first picture is wholly out of view (above, under
    // the bar, or below the window); it scrolls the figure that holds it back under the bar, and
    // the keyboard's focus goes with it.
    const goto = box.querySelector('.bar-goto');
    let pending = 0;
    function place() {
      if (pending) { cancelAnimationFrame(pending.raf); clearTimeout(pending.timer); pending = 0; }
      const pic = actions.picture(), top = bar ? bar.getBoundingClientRect().bottom : 0;
      const r = pic ? pic.getBoundingClientRect() : null;
      const below = !!r && r.height > 0 && r.top >= window.innerHeight - 1, away = !!r && r.height > 0 && (below || r.bottom <= top + 1);
      goto.classList.toggle('is-down', below);
      if (goto.hidden === !away) return;
      goto.hidden = !away;
      if (bar) bar.classList.toggle('shows-goto', away);
    }
    // (at most once a frame, or soon where frames are not drawn)
    const later = () => { if (!pending) pending = { raf: requestAnimationFrame(place), timer: setTimeout(place, 120) }; };
    window.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    later();
    goto.addEventListener('click', () => {
      const pic = actions.picture();
      if (!pic) return;
      const fig = pic.closest('.panel, figure') || pic;
      fig.scrollIntoView({ block: 'start', behavior: MM.reduceMotion() ? 'auto' : 'smooth' });
      if (!fig.hasAttribute('tabindex')) fig.setAttribute('tabindex', '-1');
      fig.focus({ preventScroll: true });
    });
  }

  /* ---------- Save image ---------- */

  // the resolution: 1× is 2 pixels in the image for each CSS pixel, as most phones show them
  const RESOLUTIONS = [1, 1.5, 2, 3];
  const ZOOMS = [1, 1.25, 1.5, 2];

  // Zoom does not depend on the window. The image is drawn in a hidden frame the size of
  // a large window (REF), showing the same example: there the page has its widest layout,
  // as on any window at least as large, whatever the window it is opened in. 100% draws
  // the figure at its width there, 200% laid out at half that width. The frame's
  // example.js serves the dialog (serveFrame) and does nothing else. If the frame cannot
  // be used, the image is drawn on the page itself, from the figure's width there.
  const REF = { w: 1280, h: 1000 }, FRAME = 'mm-save-frame';
  // The frame, once its page is ready: { capture(o, picks), sizes(picks), remove() }, or
  // null (and no frame) if it does not come up, or shows other pictures than the page.
  function openFrame(href, strings, scene, labels) {
    return new Promise((resolve) => {
      const f = document.createElement('iframe');
      f.name = FRAME;
      f.tabIndex = -1;
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;left:-' + (REF.w + 100) + 'px;top:0;width:' + REF.w + 'px;height:' + REF.h + 'px;border:0;pointer-events:none';
      f.mmState = strings; // what serveFrame shows: the example as it is on the page,
      f.mmScene = scene;   // and the rest of what the pictures show (JSON, or null)
      const timer = setTimeout(() => done(null), 15000);
      function done(api) {
        clearTimeout(timer);
        if (api && api.labels.join('\n') === labels.join('\n')) resolve({ ...api, remove: () => f.remove() });
        else { if (api) console.warn('Save image: the full-width page shows other pictures'); else console.warn('Save image: the full-width page did not come up'); f.remove(); resolve(null); }
      }
      f.addEventListener('mm-frame', (e) => done(e.detail));
      f.src = href;
      document.body.append(f);
    });
  }
  // in the hidden frame: show the page's example, rest the animations, and draw on request
  function serveFrame(page, show) {
    const el = root.frameElement;
    try {
      show(el.mmState);
      if (el.mmScene && page.scene) page.scene.set(JSON.parse(el.mmScene));
    } catch (err) { console.warn('Save image: ' + err.message); }
    document.documentElement.classList.add('is-dialog-open');
    document.dispatchEvent(new Event('mm:dialog'));
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => {
      const pictures = page.pictures().filter((p) => p.element && shown(p.element));
      const holder = pictures.length ? holderOf(pictures.map((p) => p.element)) : null;
      const full = () => (holder ? holder.getBoundingClientRect().width : 0);
      el.dispatchEvent(new CustomEvent('mm-frame', { detail: {
        labels: pictures.map((p) => p.label),
        // the chosen pictures' sizes in the image, in CSS pixels, nearly (a picture that fills
        // its column narrows with the zoom; one of a fixed size does not, and is larger)
        sizes: (picks, zoom) => picks.map((i) => { const r = pictures[i].element.getBoundingClientRect(); return { w: r.width / zoom, h: r.height / zoom }; }),
        capture: (o, picks) => capture(page, picks.map((i) => pictures[i]), { ...o, width: full() / o.zoom }, holder, true),
      } }));
    }, 100));
  }
  // the next frame (or a moment, where a hidden frame's page is not given frames)
  const frame = () => new Promise((done) => { const t = setTimeout(done, 100); requestAnimationFrame(() => { clearTimeout(t); done(); }); });
  // Whether this browser makes a canvas so large: every one makes 4096 × 4096 (Safari on
  // a phone no more); beyond that, a canvas is tried once, and what it says is kept.
  let okArea = 4096 * 4096, badArea = Infinity;
  function canvasFits(W, H) {
    const a = W * H;
    if (W > 32767 || H > 32767) return false;
    if (a <= okArea) return true;
    if (a >= badArea) return false;
    let ok = false;
    try {
      const c = document.createElement('canvas'), x = (c.width = W, c.height = H, c.getContext('2d'));
      x.fillRect(W - 1, H - 1, 1, 1);
      ok = x.getImageData(W - 1, H - 1, 1, 1).data[3] === 255;
      c.width = c.height = 0;
    } catch (err) { /* too large */ }
    if (ok) okArea = a; else badArea = a;
    return ok;
  }
  const SVG_STYLE = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'visibility', 'display', 'color', 'paint-order',
    'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'baseline-shift'];
  const FONT_FAMILIES = ['MM Math', 'Inter', 'IBM Plex Mono'];

  // The fonts an SVG drawing uses, as @font-face rules with the fonts inline: a
  // drawing becomes an image to be drawn on a canvas, and an image cannot reach
  // the page's fonts. Read from the page's own stylesheets, so the URLs are theirs.
  let fontRules = null;
  function fontsCSS() {
    if (fontRules) return fontRules;
    const wanted = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (err) { continue; }
      for (const r of rules) {
        if (!(r instanceof CSSFontFaceRule)) continue;
        const family = r.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
        const url = /url\(["']?([^"')]+)["']?\)/.exec(r.style.getPropertyValue('src'));
        if (FONT_FAMILIES.includes(family) && url) wanted.push({ family, style: r.style.getPropertyValue('font-style') || 'normal', weight: r.style.getPropertyValue('font-weight') || 'normal', url: new URL(url[1], sheet.href || location.href).href });
      }
    }
    fontRules = Promise.all(wanted.map(async (f) => {
      try {
        const blob = await (await fetch(f.url)).blob();
        const data = await new Promise((done, fail) => { const r = new FileReader(); r.onload = () => done(r.result); r.onerror = fail; r.readAsDataURL(blob); });
        return { family: f.family, css: '@font-face{font-family:"' + f.family + '";font-style:' + f.style + ';font-weight:' + f.weight + ';src:url(' + data + ')}' };
      } catch (err) { return null; } // a label in a fallback font is better than no image
    })).then((list) => list.filter(Boolean));
    return fontRules;
  }

  const shown = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';

  // An SVG drawing as markup that draws the same on its own: each element's
  // computed look written into it, and `scale` times as many pixels.
  function svgMarkup(svg, r, scale) {
    const copyOf = svg.cloneNode(true), from = [svg, ...svg.querySelectorAll('*')], to = [copyOf, ...copyOf.querySelectorAll('*')];
    from.forEach((n, i) => {
      const cs = getComputedStyle(n);
      let style = to[i].getAttribute('style') || '';
      for (const p of SVG_STYLE) { const v = cs.getPropertyValue(p); if (v) style += ';' + p + ':' + v; }
      to[i].setAttribute('style', style);
    });
    copyOf.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!copyOf.getAttribute('viewBox')) copyOf.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
    copyOf.setAttribute('width', Math.max(1, Math.round(r.width * scale)));
    copyOf.setAttribute('height', Math.max(1, Math.round(r.height * scale)));
    return new XMLSerializer().serializeToString(copyOf);
  }
  async function svgImage(markup) {
    const fonts = (await fontsCSS()).filter((f) => markup.includes(f.family)).map((f) => f.css).join('');
    if (fonts) markup = markup.replace(/^(<svg[^>]*>)/, '$1<style>' + fonts.replace(/[<>&]/g, '') + '</style>');
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
    await img.decode();
    return img;
  }

  // The pictures as they are now, each a list of layers (its canvases and SVG drawings,
  // where they lie in it), measured in CSS pixels and drawn at o.res × o.zoom pixels to
  // each. `holder`, the box that holds the pictures (the figure), is laid out o.width
  // wide (its width at full size over the zoom; see REF), as in a window of that size; a
  // picture that fills its column takes that width, and its labels and marks, which keep
  // their size, come out larger beside it at a larger zoom, while a picture of a fixed
  // size (a small Dynkin diagram) keeps its size, and so comes out larger with them. The
  // page draws its canvases afresh, its handles hidden unless o.handles; everything is
  // read at one moment, and the page is put back as it was. Unless `offstage` (in the
  // hidden frame), a still copy hides all this from the reader.
  // one at a time: a capture changes the page and puts it back, so two must not overlap
  let queue = Promise.resolve();
  function capture(...args) {
    const run = queue.then(() => captureNow(...args));
    queue = run.catch(() => {});
    return run;
  }
  async function captureNow(page, pictures, o, holder, offstage) {
    const els = pictures.map((p) => p.element), screen = MM.pixelRatio, ratio = 2 * o.res * o.zoom, html = document.documentElement;
    const zoomed = holder && o.width > 0 && Math.abs(o.width - holder.getBoundingClientRect().width) > 0.25;
    const kept = holder && [holder.style.width, holder.style.maxWidth, holder.style.height, holder.style.overflow, holder.style.clipPath, holder.getAttribute('style')], keptX = html.style.overflowX;
    let shots, still = null;
    capturing = true;
    try {
      if (zoomed) {
        // a still copy of the figure stands in its place, and the figure keeps its height, so
        // that nothing on the page moves while it is laid out at another width behind the
        // copy; it is clipped away, as wider it would reach past the copy, and the page
        // does not scroll sideways meanwhile
        const r = holder.getBoundingClientRect();
        if (!offstage) {
          still = stillCopy(holder);
          holder.style.height = r.height + 'px';
          holder.style.overflow = 'hidden';
          holder.style.clipPath = 'inset(0 100% 100% 0)';
          html.style.overflowX = 'clip';
        }
        holder.style.width = o.width + 'px';
        holder.style.maxWidth = 'none';
        await frame();
        await frame(); // (the pages' ResizeObservers have laid the pictures out)
      }
      MM.pixelRatio = () => ratio;
      page.redraw({ handles: o.handles });
      shots = els.map((element) => {
        const box = element.getBoundingClientRect();
        const parts = element.matches('canvas, svg') ? [element] : Array.from(element.querySelectorAll('canvas, svg')).filter((n) => !n.parentElement.closest('svg'));
        return { w: box.width, h: box.height, layers: parts.filter(shown).filter((n) => o.handles || !n.closest('[role="slider"]')).map((n) => {
          const r = n.getBoundingClientRect(), layer = { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
          if (n.tagName.toLowerCase() === 'canvas') {
            const c = document.createElement('canvas');
            c.width = n.width; c.height = n.height;
            c.getContext('2d').drawImage(n, 0, 0);
            layer.src = c;
          } else layer.markup = svgMarkup(n, r, ratio);
          return layer;
        }) };
      });
    } finally {
      if (holder) {
        [holder.style.width, holder.style.maxWidth, holder.style.height, holder.style.overflow, holder.style.clipPath] = kept;
        if (kept[5] === null && !holder.getAttribute('style')) holder.removeAttribute('style');
      }
      html.style.overflowX = keptX;
      if (!html.getAttribute('style')) html.removeAttribute('style');
      MM.pixelRatio = screen;
      page.redraw();
      capturing = false;
      if (still) {
        // the copy goes once the page has laid the figure out again at its own size
        await frame();
        await frame();
        still.remove();
      }
    }
    for (const sh of shots) for (const l of sh.layers) if (l.markup) { l.src = await svgImage(l.markup); delete l.markup; }
    return shots;
  }
  // A copy of el, as it looks now (canvases copied too), laid exactly over it: what the
  // page shows while el is laid out differently underneath. It goes just after el, ids and
  // all, so that every style of el's applies to it (and getElementById still finds el).
  function stillCopy(el) {
    const copy = el.cloneNode(true), from = [el, ...el.querySelectorAll('canvas')], to = [copy, ...copy.querySelectorAll('canvas')];
    from.forEach((n, i) => { if (i) { to[i].width = n.width; to[i].height = n.height; to[i].getContext('2d').drawImage(n, 0, 0); } });
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    // where el lies, to the fraction of a pixel (offsetLeft and its kin are rounded), from
    // the box an absolutely placed copy is placed in: el's offsetParent if that is placed,
    // else the page
    const r = el.getBoundingClientRect(), op = el.offsetParent, placed = op && getComputedStyle(op).position !== 'static';
    const o = placed ? op.getBoundingClientRect() : { left: -scrollX, top: -scrollY };
    const x = r.left - o.left - (placed ? op.clientLeft - op.scrollLeft : 0), y = r.top - o.top - (placed ? op.clientTop - op.scrollTop : 0);
    Object.assign(copy.style, { position: 'absolute', left: x + 'px', top: y + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', zIndex: '50', pointerEvents: 'none', boxSizing: 'border-box' });
    el.after(copy);
    return copy;
  }

  // the smallest box holding all the pictures (the figure), or none
  function holderOf(els) {
    let h = els[0].parentElement;
    while (h && !els.every((el) => h.contains(el))) h = h.parentElement;
    return h && h !== document.body && h !== document.documentElement ? h : null;
  }

  // Where everything goes: the pictures at o.res × o.zoom pixels to each of their CSS
  // pixels (as laid out for the image, so at their sizes there), side by side or one above
  // another, 16 CSS pixels apart and from the edges.
  function geometry(boxes, o) {
    const r = 2 * o.res * o.zoom, m = Math.round(16 * r), n = boxes.length, stack = o.layout === 'stack';
    const ws = boxes.map((b) => b.w * r), hs = boxes.map((b) => b.h * r), wide = Math.max(...ws), tall = Math.max(...hs);
    const W = Math.round(2 * m + (stack ? wide : ws.reduce((a, b) => a + b, 0) + m * (n - 1)));
    const H = Math.round(2 * m + (stack ? hs.reduce((a, b) => a + b, 0) + m * (n - 1) : tall));
    let x = m, y = m;
    const at = boxes.map((b, i) => {
      const p = stack ? [m + (wide - ws[i]) / 2, y] : [x, m + (tall - hs[i]) / 2];
      x += ws[i] + m;
      y += hs[i] + m;
      return p;
    });
    return { W, H, scale: r, at, fits: canvasFits(W, H) };
  }

  function compose(shots, g) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    canvas.width = g.W;
    canvas.height = g.H;
    ctx.fillStyle = MM.color('paper');
    ctx.fillRect(0, 0, g.W, g.H);
    shots.forEach((sh, i) => {
      for (const l of sh.layers) ctx.drawImage(l.src, g.at[i][0] + l.x * g.scale, g.at[i][1] + l.y * g.scale, l.w * g.scale, l.h * g.scale);
    });
    return canvas;
  }

  // The image shrunk to fit a box w × h (CSS pixels), by halves and then the rest, so
  // that thin lines stay lines: in one step a browser drops most of their pixels.
  function shrink(image, w, h) {
    const dpr = window.devicePixelRatio || 1, k = Math.min(1, w * dpr / image.width, h * dpr / image.height);
    let src = image, sw = image.width, sh = image.height;
    while (sw > 2 * image.width * k + 1) {
      const half = document.createElement('canvas'), x = half.getContext('2d');
      half.width = Math.ceil(sw / 2);
      half.height = Math.ceil(sh / 2);
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, 0, 0, half.width, half.height);
      src = half;
      sw = half.width;
      sh = half.height;
    }
    const out = document.createElement('canvas'), x = out.getContext('2d');
    out.width = Math.max(1, Math.round(image.width * k));
    out.height = Math.max(1, Math.round(image.height * k));
    out.style.width = out.width / dpr + 'px';
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, out.width, out.height);
    return out;
  }

  // a PNG with the link to the example in it (an iTXt chunk, "Description", before IEND)
  async function withLink(blob, text) {
    const bytes = new Uint8Array(await blob.arrayBuffer()), enc = new TextEncoder();
    const data = new Uint8Array([...enc.encode('iTXt'), ...enc.encode('Description'), 0, 0, 0, 0, 0, ...enc.encode(text)]);
    let crc = -1;
    for (const b of data) { crc ^= b; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    const chunk = new Uint8Array(data.length + 8), dv = new DataView(chunk.buffer);
    dv.setUint32(0, data.length - 4);
    chunk.set(data, 4);
    dv.setUint32(data.length + 4, (crc ^ -1) >>> 0);
    return new Blob([bytes.subarray(0, bytes.length - 12), chunk, bytes.subarray(bytes.length - 12)], { type: 'image/png' });
  }

  const CROSS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  function saveImage(page, link, state) {
    if (document.querySelector('.save-dialog')) return;
    const pictures = page.pictures().filter((p) => p.element && shown(p.element));
    if (!pictures.length) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog save-dialog';
    dialog.setAttribute('aria-labelledby', 'save-title');
    const toggles = pictures.map((p, i) => '<mm-toggle data-pick="' + i + '"' + (p.selected === false ? '' : ' pressed') + '>' + MM.esc(p.label) + '</mm-toggle>').join('');
    const seg = (name, label, values, value, text) => '<div class="save-option"' + (name === 'layout' ? ' data-if="several"' : '') + '><span class="label">' + label + '</span>'
      + '<mm-seg data-opt="' + name + '" value="' + value + '" aria-label="' + label + '">' + values.map((v, i) => '<button value="' + v + '">' + text[i] + '</button>').join('') + '</mm-seg></div>';
    dialog.innerHTML = '<form>'
      + '<h2 class="dialog-title" id="save-title">Save image</h2>'
      + '<button type="button" class="btn btn-quiet btn-icon dialog-close" data-cancel aria-label="Close">' + CROSS + '</button>'
      + '<div class="save-body">'
      + '<div class="save-preview"><p class="hint">Drawing the image…</p></div>'
      + '<div class="save-options">'
      + (pictures.length > 1 ? '<div class="save-option"><span class="label">Pictures</span><div class="save-row">' + toggles + '</div></div>' : '')
      + seg('zoom', 'Zoom', ZOOMS, 1.5, ZOOMS.map((z) => z * 100 + '%'))
      + seg('layout', 'Layout', ['row', 'stack'], 'row', ['Side by side', 'Stacked'])
      + '<div class="save-row"><mm-toggle data-opt="handles" data-if="handles">Show handle</mm-toggle></div>'
      + seg('res', 'Resolution', RESOLUTIONS, 2, RESOLUTIONS.map((r) => r + '×'))
      + '<p class="hint save-size" aria-live="polite"></p>'
      + '</div></div>'
      + '<div class="dialog-actions"><button class="btn btn-quiet" type="button" data-cancel>Cancel</button><button class="btn" type="button" data-save disabled>Save</button></div>'
      + '</form>';
    document.body.append(dialog);
    const $ = (sel) => dialog.querySelector(sel), preview = $('.save-preview'), sizeNote = $('.save-size'), save = $('[data-save]');
    const back = document.activeElement, holder = holderOf(pictures.map((p) => p.element));
    let scene = null;
    try { scene = page.scene ? JSON.stringify(page.scene.get()) : null; } catch (err) { console.warn('Save image: ' + err.message); }
    const stage = openFrame(link(), state(), scene, pictures.map((p) => p.label)); // the hidden full-width page
    let shots = null, key = '', image = null, version = 0;
    const options = () => ({
      picks: pictures.map((_, i) => { const t = $('[data-pick="' + i + '"]'); return !t || t.pressed; }),
      res: +$('[data-opt="res"]').value,
      zoom: +$('[data-opt="zoom"]').value,
      layout: $('[data-opt="layout"]').value,
      handles: $('[data-opt="handles"]').pressed,
    });
    function message(text) { image = null; save.disabled = true; preview.innerHTML = '<p class="hint">' + text + '</p>'; }
    async function refresh() {
      const v = ++version, o = options(), chosen = pictures.map((p, i) => i).filter((i) => o.picks[i]);
      const st = await stage;
      if (v !== version) return;
      $('[data-if="several"]').hidden = chosen.length < 2;
      $('[data-if="handles"]').hidden = !chosen.some((i) => pictures[i].element.querySelector('[role="slider"]'));
      if (!chosen.length) { sizeNote.textContent = ''; message('Choose a picture to save.'); return; }
      // a resolution too large for a canvas cannot be chosen (the pictures' sizes in the
      // image, nearly, tell)
      const boxes = st ? st.sizes(chosen, o.zoom) : chosen.map((i) => { const r = pictures[i].element.getBoundingClientRect(); return { w: r.width / o.zoom, h: r.height / o.zoom }; });
      const res = $('[data-opt="res"]');
      for (const b of res.querySelectorAll('button')) b.disabled = !geometry(boxes, { ...o, res: +b.value }).fits;
      if (res.querySelector('button[value="' + o.res + '"]').disabled) {
        const fit = Array.from(res.querySelectorAll('button:not(:disabled)')).pop();
        if (!fit) { sizeNote.textContent = ''; message('These pictures are too large to save together.'); return; }
        res.value = fit.value;
        o.res = +fit.value;
      }
      // drawn afresh when the pictures, the resolution, the zoom or the handles change
      const want = [chosen, o.res, o.zoom, o.handles].join();
      if (want !== key) {
        save.disabled = true;
        let fresh;
        try {
          fresh = st ? await st.capture(o, chosen)
            : await capture(page, chosen.map((i) => pictures[i]), { ...o, width: holder ? holder.getBoundingClientRect().width / o.zoom : 0 }, holder);
        } catch (err) { console.error(err); if (v === version) message('The image could not be drawn.'); return; }
        if (v !== version) return; // (a later change draws its own)
        shots = fresh;
        key = want;
      }
      const g = geometry(shots, o);
      if (!g.fits) { sizeNote.textContent = ''; message('This image is too large for the browser: choose a lower resolution.'); return; }
      image = compose(shots, g);
      const box = preview.getBoundingClientRect(), pad = 28;
      preview.replaceChildren(shrink(image, box.width - pad, box.height - pad));
      sizeNote.textContent = g.W + ' × ' + g.H + ' pixels';
      save.disabled = false;
    }
    dialog.addEventListener('change', refresh);
    save.addEventListener('click', () => {
      if (!image) return;
      const canvas = image;
      save.disabled = true;
      canvas.toBlob(async (blob) => {
        try {
          if (!blob) throw new Error('no image');
          const file = await withLink(blob, document.title.split(' · ')[0] + '\n' + link());
          const a = document.createElement('a'), url = URL.createObjectURL(file);
          a.href = url;
          a.download = (location.pathname.split('/').filter(Boolean).pop() || 'figure') + '.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          finish();
        } catch (err) { console.error(err); message('The image could not be saved.'); }
      }, 'image/png');
    });
    // Closed by its close button, Cancel, Escape or once saved. (Not by waiting for the
    // close event, which some browsers are slow to send.)
    // While it is open, the page's animations rest (MM.whenVisible), so that the picture
    // stays as it was when the dialog opened.
    const over = (on) => { document.documentElement.classList.toggle('is-dialog-open', on); document.dispatchEvent(new Event('mm:dialog')); };
    let closed = false;
    function finish() {
      if (closed) return;
      closed = true;
      version++;
      if (dialog.open) dialog.close();
      dialog.remove();
      stage.then((st) => st && st.remove());
      over(false);
      if (back && back.focus) back.focus();
    }
    dialog.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', finish));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(); });
    dialog.addEventListener('close', finish);
    dialog.addEventListener('submit', (e) => e.preventDefault());
    dialog.showModal();
    over(true);
    refresh();
  }
})(typeof window !== 'undefined' ? window : globalThis);
