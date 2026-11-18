/* Moving Maths runtime, loaded on every page before the page's own scripts.
 * Exposes window.MM:
 *
 *   MM.tex(src, display)    TeX → KaTeX HTML string (cached)
 *   MM.rich(html)           renders every $…$, \(…\), $$…$$, \[…\] in an HTML string,
 *                           and numbers citations [@key] as the build does (build/cite.mjs)
 *   MM.setHTML(el, html)    el.innerHTML = MM.rich(html); a formula that becomes part
 *                           of a button's, link's or tab's name gets a plain-text name.
 *                           The same HTML again is skipped (returns whether it wrote)
 *   MM.kv(dl, rows)         the rows of a <dl class="kv">, [term, html] each, by MM.setHTML
 *   MM.renderMath(el)       renders TeX left in el's text, touching only the text
 *                           nodes that contain it (rendered maths is skipped)
 *   MM.color(name[, el])    a colour as "rgb(…)", e.g. MM.color('c3'), MM.color('pt-1');
 *                           sees variables on :root and body, or on el if given.
 *                           MM.color.clear() forgets cached values (after a remap)
 *   MM.rgba(name, a[, el])  the same colour with alpha, for canvas fills
 *   MM.cssVar(name)         the raw value of --name on :root
 *   MM.font(kind, px[, weight[, italic]])
 *                           a canvas font string; kind is 'math' (the label font,
 *                           KaTeX's glyphs; 'serif' is the same), 'sans' or 'mono'
 *   MM.onFonts(fn)          calls fn once the fonts are loaded (canvases: redraw)
 *   MM.canvasLabel(ctx, label, x, y, opts)   draws a figure label (see below)
 *   MM.measureLabel(ctx, label, px[, weight]) its width
 *   MM.svgLabel(textEl, label)               the same, into an SVG <text>
 *                           A label is words with $…$ maths, e.g. "pair $x_1, x_2$"
 *   MM.esc(s)               escapes &, <, >, " for use in HTML
 *   MM.svg(tag, attrs[, parent])  an SVG element with these attributes, appended to parent
 *   MM.turnDrag(el, {when, start, move, end, keys})
 *                           a drag on el turns a 3D picture: move(dx, dy, e) gets
 *                           each movement in pixels; when(e) says whether a press
 *                           may start one, start() and end(e) bracket it. On a touch
 *                           screen the first movement decides: sideways turns for the
 *                           whole drag, up or down scrolls the page. While it turns,
 *                           el has the class .turnable (touch-action: pan-y, the grab
 *                           cursor). keys: { turn(a, b), home() }: the arrow keys turn
 *                           it by 6° (1° with Shift), Home puts it back. Returns
 *                           { active, moved, update }: whether a drag is turning now,
 *                           whether the last one did (until the next press), to tell
 *                           a click from a drag, and update(), to call when when()
 *                           may have changed its answer
 *   MM.pinchZoom(el, {zoom, pan, end})
 *                           two fingers on el (or a pinch on a trackpad) zoom it,
 *                           zoom(f, x, y), and move it, pan(dx, dy); el gets the class
 *                           .zoomable (touch-action: pan-y)
 *   MM.handle(el[, r])      draws the handle of a picture (a yellow dot, ringed) into
 *                           a .handle box over the picture, or into an SVG group
 *   MM.strip(el, {pick, control})
 *                           a .strip of .strip-item pictures to choose from: one stop
 *                           for Tab, the arrow keys along it, its families shown one at
 *                           a time; returns { light(item), show(family), family() }
 *   MM.moved()              the reader has moved a picture: a drag let go, a pinch or a
 *                           zoom done. MM.turnDrag, MM.pinchZoom and <mm-zoom> say so
 *                           themselves; a page says so after its own view controls (keys,
 *                           buttons). A page opened from a link then lets the link go from
 *                           the address bar, if the view is no longer the one it named
 *                           (example.js); turning on its own does not count
 *   MM.pixelRatio()         device pixels per CSS pixel for a canvas's backing store:
 *                           the screen's, or more while Save image draws the figure
 *   MM.fitCanvas(canvas[, w, h])
 *                           sizes a canvas's backing store to its CSS box (or w × h) at
 *                           MM.pixelRatio(), empties it and sets its context to draw in CSS
 *                           pixels; returns { w, h, dpr, ctx }
 *   MM.clearCanvas(ctx[, color])  clears every pixel of the canvas, fills it with color
 *   MM.reduceMotion()       whether the reader asks for less motion (prefers-reduced-motion)
 *   MM.matrix(box, rows[, label])
 *                           puts a matrix into box: its entries (TeX) in a grid between
 *                           KaTeX's tall parentheses, as tall as it at any size; returns
 *                           the grid, whose cells (.mx-e, data-i, data-j) may be lit
 *   MM.dynkinPicture(svg, {pos, bonds, nodes}, opts)
 *                           draws a small Dynkin diagram into an <svg>, as a list of
 *                           diagrams under a picture shows them (see below)
 *   MM.whenVisible(els, fn) fn(false) when none of the elements is in view (or the tab
 *                           is hidden, or a dialog is open over the page: html has
 *                           .is-dialog-open, announced with the event mm:dialog),
 *                           fn(true) when one is again; returns a function that says
 *                           which. For animations that should rest while unseen
 *   MM.undoRedo({undo, redo, canUndo, canRedo})
 *                           Undo and Redo: the buttons #undo and #redo and the keys
 *                           Ctrl/⌘+Z, Shift+Ctrl/⌘+Z and Ctrl+Y (not in a text field); returns
 *                           { update(), keep(list, entry) } (see below)
 *   MM.enhance(root)        enhances controls a script added (normally automatic)
 *   <mm-seg>, <mm-tabs>, <mm-slider>, <mm-toggle>, <mm-numbers>   see components.js
 *   MM.example(…)           links, reset and Save image, in example.js (content pages)
 *
 * TeX rendering needs `katex_runtime: true` in the page's front matter; it
 * uses the same macros as the build (site/macros.tex plus the page's own).
 * build/tex-scan.mjs (the TeX scanner), build/plain-core.mjs (plain-text names),
 * build/cite.mjs (citations) and components.js are inlined at build time where
 * their placeholders are.
 *
 * Runs in browsers from 2023 on; keep to syntax they all parse (no regex
 * lookbehind, for example: Safari before 16.4 rejects the whole file).
 */
(function () {
  'use strict';

  /* @tex-scan */

  /* @plain-core */

  /* @cite */

  // A Map that forgets its oldest entry beyond `max` (a Map keeps insertion order).
  function remember(map, key, value, max) {
    if (map.size >= max) map.delete(map.keys().next().value);
    map.set(key, value);
    return value;
  }

  var macros = null;
  function getMacros() {
    if (!macros) {
      var el = document.getElementById('mm-macros');
      try { macros = el ? JSON.parse(el.textContent) : {}; } catch (e) { macros = {}; }
    }
    return macros;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var texCache = new Map();
  var warned = false;
  function tex(src, display) {
    var key = (display ? 'D' : 'I') + src;
    var hit = texCache.get(key);
    if (hit !== undefined) return hit;
    var out;
    if (window.katex) {
      out = window.katex.renderToString(rewriteTex(src), {
        displayMode: !!display,
        throwOnError: false,
        strict: 'ignore',
        macros: Object.assign({}, getMacros()),
      });
    } else {
      if (!warned) { warned = true; console.warn('MM.tex: KaTeX is not loaded; set `katex_runtime: true` in front matter.'); }
      out = '<span class="tex-src">' + esc(src) + '</span>';
    }
    return remember(texCache, key, out, 1000);
  }

  // elements whose accessible name comes from their content
  var NAME_CONTEXT = 'a, button, h1, h2, h3, h4, h5, h6, summary, label, legend, caption, option, th, '
    + '[role="button"], [role="link"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], '
    + '[role="option"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="heading"], [role="treeitem"]';
  var SKIP_TEXT = 'script, style, textarea, pre, code, svg, math, template, noscript, .katex, .katex-display, .notex, [data-notex]';

  // The page's reference list, in order, as [{ key }] (from the ids the build
  // gives its entries), for citations ([@key]) in text that scripts write.
  var refList = null;
  function pageRefs() {
    if (!refList || !refList.length) {
      refList = Array.prototype.map.call(document.querySelectorAll('.refs li[id^="ref-"]'), function (li) {
        return { key: li.id.slice(4) };
      });
    }
    return refList;
  }
  function cite(html) {
    if (html.indexOf('[@') < 0) return html;
    var r = citeRefs(html, pageRefs());
    r.problems.forEach(function (p) { console.warn('MM.rich: ' + p.message); });
    return r.html;
  }

  // options.name: the HTML will be (part of) a link's, heading's or control's content
  function rich(html, options) {
    return transformMath(cite(String(html)), function (t, d, offset, context) {
      var out = tex(t, d);
      return context && context.name ? labelKatex(out) : out;
    }, function (msg, at, t) {
      console.warn('MM.rich: ' + msg + (t ? ' in "' + t + '"' : ''));
    }, { name: !!(options && options.name) });
  }

  function inNameContext(el) { return !!(el && el.closest && el.closest(NAME_CONTEXT)); }

  // The same HTML written again is left as it is, so that a readout redrawn on every
  // frame costs nothing and its live region speaks only when the text changes. el keeps
  // a note of what was written and of the nodes it made: content that something else has
  // put there since (innerHTML, textContent) is written afresh. Whether it wrote.
  function setHTML(el, html) {
    html = String(html);
    var name = inNameContext(el), last = el._mmHTML;
    if (last && last.html === html && last.name === name && last.n === el.childNodes.length
      && last.first === el.firstChild && last.last === el.lastChild) return false;
    el.innerHTML = rich(html, { name: name });
    el._mmHTML = { html: html, name: name, n: el.childNodes.length, first: el.firstChild, last: el.lastChild };
    return true;
  }

  // the rows of a <dl class="kv">, [term, html] each (a falsy row is left out)
  function kv(dl, rows) {
    return setHTML(dl, rows.filter(Boolean).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join(''));
  }

  // Renders TeX in el's text nodes, leaving elements (and their listeners,
  // state and focus) alone. A formula must sit within one text node.
  function renderMath(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || p.closest(SKIP_TEXT)) return NodeFilter.FILTER_REJECT;
        return /\$|\\\(|\\\[/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var source = esc(n.nodeValue);
      var html = rich(source, { name: inNameContext(n.parentElement) });
      if (html === source) return;
      var t = document.createElement('template');
      t.innerHTML = html;
      n.parentNode.replaceChild(t.content, n);
    });
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
  }

  // Resolves var(--name), including color-mix() values, to [r, g, b, a] by
  // painting one pixel: computed styles may report color(srgb …), which canvas
  // code cannot take apart. The probe sits inside `scope` (default: <body>), so
  // it sees custom properties a page defines on body or on the scope element.
  var probe = null, pixel = null;
  var colorCache = new Map();
  var colorChecked = {};
  function rgbOf(name, scope) {
    var host = scope || document.body || document.documentElement;
    var key = scope ? null : name; // only the default scope is cached
    var hit = key && colorCache.get(key);
    if (hit) return hit;
    if (!probe) {
      probe = document.createElement('span');
      probe.style.display = 'none';
      var cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      pixel = cv.getContext('2d', { willReadFrequently: true });
    }
    if (!colorChecked[name]) { // once per name: a misspelt colour would otherwise be black
      colorChecked[name] = true;
      if (!host.isConnected || !getComputedStyle(host).getPropertyValue('--' + name).trim()) {
        console.warn('MM.color: --' + name + (host.isConnected ? ' is not defined here' : ': the element is not in the document'));
      }
    }
    host.appendChild(probe);
    probe.style.color = 'var(--' + name + ')';
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = '#000';
    pixel.fillStyle = getComputedStyle(probe).color;
    pixel.fillRect(0, 0, 1, 1);
    probe.remove();
    var d = pixel.getImageData(0, 0, 1, 1).data;
    var v = [d[0], d[1], d[2], d[3] / 255];
    if (key) colorCache.set(key, v);
    return v;
  }

  function color(name, scope) {
    var v = rgbOf(name, scope);
    return v[3] === 1 ? 'rgb(' + v[0] + ',' + v[1] + ',' + v[2] + ')' : 'rgba(' + v.join(',') + ')';
  }
  color.clear = function () { colorCache.clear(); };

  function rgba(name, alpha, scope) {
    var v = rgbOf(name, scope);
    return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + alpha * v[3] + ')';
  }

  function font(kind, px, weight, italic) {
    var family = cssVar(kind === 'serif' ? 'math' : (kind || 'sans'));
    return (italic ? 'italic ' : '') + (weight || 400) + ' ' + px + 'px ' + family;
  }

  // Canvas text is drawn with whatever font is loaded at that moment, so figures
  // should redraw once the fonts arrive: MM.onFonts(draw).
  var fontsPromise = null;
  function onFonts(fn) {
    if (!fontsPromise) {
      var f = document.fonts;
      fontsPromise = f ? Promise.all([
        f.load('16px "MM Math"'), f.load('italic 16px "MM Math"'),
        f.load('400 16px Inter'), f.load('600 16px Inter'), f.load('16px "IBM Plex Mono"'),
      ]).then(function () { return f.ready; }).catch(function () {}) : Promise.resolve();
    }
    fontsPromise.then(function () { fn(); });
  }

  /* ---------- figure labels ----------
   * Text on a canvas or in SVG cannot be typeset by KaTeX. A label is text with
   * optional $…$ maths, e.g. "nearest pair: $x_1, x_2$". Words are set in Inter;
   * maths in the label font (KaTeX's own glyphs) in TeX's maths mode: italic
   * letters, upright digits and symbols, space around relations and operators.
   * The maths is a TeX subset: _ and ^ (with {…} groups; a sub- and a
   * superscript on one base are set side by side), \mathrm, \mathit,
   * \operatorname, \text, \mathfrak, \mathbb, \mathcal, \mathbf, \frac and
   * \sqrt (written on one line, as a/b and √x), accents (\bar, \hat, …), Greek
   * letters, common symbols, spacing commands and the page's macros; \left,
   * \right and \big are ignored. Operator names (\det, \sin, …) are upright;
   * other unknown commands are set the same way, with a warning. Unicode (ℂ,
   * x₁, α) works as well. Malformed input falls back to plain text, with a
   * warning.
   */
  var LBL_SYM = {
    to: '→', rightarrow: '→', leftarrow: '←', mapsto: '↦', hookrightarrow: '↪', twoheadrightarrow: '↠',
    Rightarrow: '⇒', Leftrightarrow: '⇔', iff: '⟺', longrightarrow: '⟶', longmapsto: '⟼',
    in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', subsetneq: '⊊',
    cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅', cong: '≅', simeq: '≃', sim: '∼',
    approx: '≈', equiv: '≡', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', oplus: '⊕',
    otimes: '⊗', times: '×', cdot: '⋅', circ: '∘', ast: '∗', star: '⋆', pm: '±', mp: '∓', wedge: '∧',
    vee: '∨', perp: '⊥', mid: '∣', parallel: '∥', infty: '∞', partial: '∂', nabla: '∇', ell: 'ℓ',
    hbar: 'ℏ', ldots: '…', cdots: '⋯', dots: '…', langle: '⟨', rangle: '⟩', lvert: '|', rvert: '|',
    vert: '|', prime: '′', forall: '∀', exists: '∃', neg: '¬', bullet: '∙', dagger: '†',
    rtimes: '⋊', ltimes: '⋉', triangleleft: '◁', '{': '{', '}': '}', '|': '‖', '_': '_', '#': '#',
    '%': '%', '&': '&', '$': '$', backslash: '\\',
  };
  var LBL_GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
    theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
    varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ',
    varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
    Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  };
  var LBL_ACCENT = { bar: '̄', overline: '̄', hat: '̂', widehat: '̂', tilde: '̃', widetilde: '̃', vec: '⃗', dot: '̇', ddot: '̈', check: '̌' };
  var LBL_SPACE = { ',': 0.167, ':': 0.222, '>': 0.222, ';': 0.278, ' ': 0.25, quad: 1, qquad: 2, '!': -0.167 };
  // [A–Z start, a–z start, holes]
  var LBL_ALPHA = {
    mathbb: [0x1D538, 0x1D552, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ', 1: '𝟙' }],
    mathfrak: [0x1D504, 0x1D51E, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }],
    mathcal: [0x1D49C, 0, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' }],
    mathbf: [0x1D400, 0x1D41A, {}],
  };
  var LBL_REL = '=<>≤≥≠≅≃∼≈≡∈∉∋⊂⊆⊃⊇⊊→←↦↪↠⇒⇔⟺⟶⟼∣∥:';
  var LBL_BIN = '+−×⋅∘∗⋆±∓∪∩∖⊕⊗∧∨⋊⋉';
  var LBL_OPEN = '([{⟨';
  var LBL_CLOSE = ')]}⟩';
  var LBL_PRIMES = { '\\prime': 1, '′': 1, "'": 1 };
  var LBL_OPS = ' arccos arcsin arctan arg cos cosh cot coth csc deg det dim exp gcd hom inf injlim ker lg lim liminf limsup ln log max min Pr projlim sec sin sinh sup tan tanh ';
  // sizes and styles that a one-line label ignores
  var LBL_IGNORE = /^(left|right|middle|[bB]igg?[lrm]?|displaystyle|textstyle|scriptstyle|limits|nolimits)$/;
  var lblUnknown = {};

  function lblAlpha(text, table) {
    return Array.from(text).map(function (ch) {
      if (table[2][ch]) return table[2][ch];
      var c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(table[0] + c - 65);
      if (c >= 97 && c <= 122 && table[1]) return String.fromCodePoint(table[1] + c - 97);
      if (table === LBL_ALPHA.mathbf && c >= 0x391 && c <= 0x3A9) return String.fromCodePoint(0x1D6A8 + c - 0x391); // bold capital Greek
      if (table === LBL_ALPHA.mathbf && c >= 0x3B1 && c <= 0x3C9) return String.fromCodePoint(0x1D6C2 + c - 0x3B1); // bold small Greek
      return ch;
    }).join('');
  }

  // Maths → runs {t: text, f: 'm' (maths italic) | 'r' (maths upright) | 's' (Inter),
  // s: scale, y: baseline shift in em (down is +), g: space before in em, k: class}.
  function lblMath(src, mode, scale, dy, depth, out, nest) {
    var i = 0, n = src.length;
    if ((nest || 0) > 20) throw new Error('macros nest too deeply');
    function group() { // after "{": up to the matching "}" (or the end, if there is none)
      var level = 1, start = i;
      while (i < n && level) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '{') level++;
        else if (src[i] === '}') level--;
        i++;
      }
      return level ? src.slice(start) : src.slice(start, i - 1);
    }
    function arg() {
      while (i < n && src[i] === ' ') i++;
      if (i >= n) return '';
      if (src[i] === '{') { i++; return group(); }
      if (src[i] === '\\') { var m = /^\\([a-zA-Z]+|[^a-zA-Z]?)/.exec(src.slice(i)); i += m[0].length; return m[0]; }
      var ch = String.fromCodePoint(src.codePointAt(i)); i += ch.length; return ch;
    }
    function put(t, f, k) { out.push({ t: t, f: f, s: scale, y: dy, g: 0, k: depth ? null : k }); }
    function sub(text, m) { return lblMath(text, m || mode, scale, dy, depth, [], nest); }
    function atoms(runs) { return runs.filter(function (r) { return r.t && r.s === scale; }).length; } // scripts aside
    function bracket(runs) { // (…) around a multi-atom part of a \frac or \sqrt
      if (atoms(runs) <= 1) { Array.prototype.push.apply(out, runs); return; }
      put('(', 'r', 'ord'); Array.prototype.push.apply(out, runs); put(')', 'r', 'ord');
    }
    while (i < n) {
      var c = src[i];
      if (c === ' ' || c === '\n' || c === '\t') { i++; continue; }
      if (c === '{') { i++; lblMath(group(), mode, scale, dy, depth, out, nest); }
      else if (c === '}') { i++; continue; }
      else if (c === '_' || c === '^') { /* a script with no base: set on its own, below */ }
      else if (c === '\\') {
        var m = /^\\([a-zA-Z]+|[^a-zA-Z]?)/.exec(src.slice(i)); i += m[0].length;
        var name = m[1], macro = getMacros()['\\' + name];
        if (!name) put('\\', 'r', 'ord'); // a lone trailing backslash
        else if (macro !== undefined && typeof macro === 'string') {
          var count = 0;
          macro.replace(/#(\d)/g, function (x, d) { count = Math.max(count, +d); return x; });
          var args = [];
          for (var a = 0; a < count; a++) args.push(arg());
          lblMath(macro.replace(/#(\d)/g, function (x, d) { return args[d - 1] || ''; }), mode, scale, dy, depth, out, (nest || 0) + 1);
        }
        else if (LBL_IGNORE.test(name)) { if (src[i] === '.') i++; } // \left. is no delimiter at all
        else if (name === 'mathrm' || name === 'mathup' || name === 'mathsf' || name === 'mathtt') lblMath(arg(), 'r', scale, dy, depth, out, nest);
        else if (name === 'mathit') lblMath(arg(), 'm', scale, dy, depth, out, nest);
        else if (name === 'operatorname') {
          if (src[i] === '*') i++;
          var op = arg();
          if (/^[A-Za-z]+$/.test(op)) put(op, 'r', 'op'); else lblMath(op, 'r', scale, dy, depth, out, nest);
        }
        else if (name === 'text' || name === 'textrm' || name === 'mbox') put(arg(), 's', 'ord');
        else if (LBL_ALPHA[name] || name === 'boldsymbol' || name === 'bm') {
          if (!LBL_ALPHA[name]) name = 'mathbf';
          var body = arg();
          var g = /^\\([A-Za-z]+)$/.exec(body);
          put(lblAlpha(g && LBL_GREEK[g[1]] ? LBL_GREEK[g[1]] : body.replace(/\\[A-Za-z]+/g, ''), LBL_ALPHA[name]), 'r', 'ord');
        }
        else if (LBL_GREEK[name]) put(LBL_GREEK[name], /^[A-Z]/.test(name) ? 'r' : mode, 'ord');
        else if (LBL_SPACE[name] !== undefined) out.push({ t: '', f: 'r', s: scale, y: dy, g: LBL_SPACE[name] * scale, k: 'space' });
        else if (name === 'colon') put(':', 'r', 'punct');
        else if (name === 'frac' || name === 'tfrac' || name === 'dfrac') { var num = sub(arg()), den = sub(arg()); bracket(num); put('/', 'r', 'ord'); bracket(den); }
        else if (name === 'sqrt') {
          var close = src[i] === '[' ? src.indexOf(']', i) : -1; // \sqrt[3]{x}: a small 3 before the √
          if (close > 0) { lblMath(src.slice(i + 1, close), 'r', scale * 0.7, dy - 0.38 * scale, depth + 1, out, nest); i = close + 1; }
          put('√', 'r', 'ord'); bracket(sub(arg()));
        }
        else if (LBL_ACCENT[name]) {
          var accented = sub(arg());
          for (var k = accented.length - 1; k >= 0; k--) if (accented[k].t) { accented[k].t += LBL_ACCENT[name]; break; }
          Array.prototype.push.apply(out, accented);
        }
        else if (LBL_SYM[name]) { var sy = LBL_SYM[name]; put(sy, 'r', LBL_REL.indexOf(sy) >= 0 ? 'rel' : LBL_BIN.indexOf(sy) >= 0 ? 'bin' : 'ord'); }
        else { // \det, …: an upright operator name; a name the label does not know is set the same way
          if (/^[a-zA-Z]+$/.test(name) && LBL_OPS.indexOf(' ' + name + ' ') < 0 && !lblUnknown[name]) {
            lblUnknown[name] = true;
            console.warn('MM label: \\' + name + ' is not a command labels know; it is set as an operator name');
          }
          put(name, 'r', /^[a-zA-Z]+$/.test(name) ? 'op' : 'ord');
        }
      } else {
        var ch = String.fromCodePoint(src.codePointAt(i)); i += ch.length;
        if (ch === '-') ch = '−';
        if (ch === "'") ch = '′';
        var letter = /[A-Za-z]/.test(ch);
        put(ch, letter ? mode : 'r', LBL_REL.indexOf(ch) >= 0 ? 'rel' : LBL_BIN.indexOf(ch) >= 0 ? 'bin' : ch === ',' || ch === ';' ? 'punct' : 'ord');
      }
      // scripts after the atom
      while (i < n && (src[i] === '_' || src[i] === '^')) {
        var isSub = src[i] === '_'; i++;
        var s = arg();
        // the label font draws ′ as a superscript already: do not shrink it again
        if (!isSub && LBL_PRIMES[s]) { out.push({ t: '′', f: 'r', s: scale, y: dy, g: 0, k: null }); continue; }
        lblMath(s, mode, scale * 0.7, dy + (isSub ? 0.18 : -0.38) * scale, depth + 1, out, nest);
      }
    }
    return out;
  }

  // TeX's spacing between atoms: around relations and binary operators, after
  // punctuation, around operator names. A binary operator at the start, after
  // another operator, a relation, punctuation or an opening bracket, or before
  // a relation, punctuation, a closing bracket or the end, is unary (no space).
  function lblSpace(runs) {
    var atomsOnly = runs.filter(function (r) { return r.k && r.k !== 'space'; });
    atomsOnly.forEach(function (r, i) {
      if (r.k !== 'bin') return;
      var before = atomsOnly[i - 1], after = atomsOnly[i + 1];
      if (!before || before.k === 'rel' || before.k === 'bin' || before.k === 'punct' || before.k === 'op' || LBL_OPEN.indexOf(before.t) >= 0
        || !after || after.k === 'rel' || after.k === 'punct' || LBL_CLOSE.indexOf(after.t) >= 0) r.k = 'ord';
    });
    var prev = null;
    atomsOnly.forEach(function (r) {
      if (r.k === 'rel' && prev) { r.g += 0.278; r.after = 0.278; }
      if (r.k === 'bin') { r.g += 0.222; r.after = 0.222; }
      if (r.k === 'op') { if (prev && prev.k !== 'rel' && prev.k !== 'bin' && LBL_OPEN.indexOf(prev.t) < 0) r.g += 0.167; r.after = 0.167; }
      if (prev && prev.k === 'op' && (r.k !== 'ord' || LBL_OPEN.indexOf(r.t) >= 0 || /^[²³¹⁰-₟′″]/.test(r.t))) prev.after = 0;
      if (prev && prev.after) r.g += prev.after;
      if (r.k === 'punct') r.after = 0.167;
      prev = r;
    });
    return runs;
  }

  // Splits at unescaped $ (no regex lookbehind: see the note at the top).
  function lblParts(s) {
    var parts = [], buf = '';
    for (var k = 0; k < s.length; k++) {
      if (s[k] === '\\' && s[k + 1] === '$') { buf += '\\$'; k++; continue; }
      if (s[k] === '$') { parts.push(buf); buf = ''; continue; }
      buf += s[k];
    }
    parts.push(buf);
    return parts;
  }

  var lblCache = new Map();
  var lblWarned = {};
  function labelRuns(str) {
    str = String(str);
    var hit = lblCache.get(str);
    if (hit) return hit;
    var runs = [];
    try {
      lblParts(str).forEach(function (part, n) {
        if (!part) return;
        if (n % 2) runs = runs.concat(lblSpace(lblMath(rewriteTex(part), 'm', 1, 0, 0, [], 0)));
        else runs.push({ t: part.replace(/\\\$/g, '$'), f: 's', s: 1, y: 0, g: 0 });
      });
    } catch (err) {
      if (!lblWarned[str]) { lblWarned[str] = true; console.warn('MM label: could not typeset "' + str + '": ' + err.message); }
      runs = [{ t: str.replace(/\\\$/g, '\u0000').replace(/\$/g, '').replace(/\u0000/g, '$'), f: 's', s: 1, y: 0, g: 0 }];
    }
    return remember(lblCache, str, runs, 2000);
  }

  // Maths is set 10% larger than the words around it, as KaTeX is in text
  // (theme.css: .katex { font-size: 1.1em }), so the two look the same size.
  var LBL_MATH_SCALE = 1.1;
  function runFont(r, px, weight) {
    if (r.f === 's') return (weight || 400) + ' ' + (px * r.s).toFixed(2) + 'px ' + cssVar('sans');
    return (r.f === 'm' ? 'italic ' : '') + '400 ' + (px * r.s * LBL_MATH_SCALE).toFixed(2) + 'px ' + cssVar('math');
  }

  // Width of a label in px, with the canvas's current state.
  function measureLabel(ctx, str, px, weight) {
    var w = 0;
    ctx.save();
    labelRuns(str).forEach(function (r) { ctx.font = runFont(r, px, weight); w += r.g * px + (r.t ? ctx.measureText(r.t).width : 0); });
    ctx.restore();
    return w;
  }

  // Draws a label. opts: size (px, default 14), align ('left' | 'center' |
  // 'right'), baseline ('alphabetic' | 'middle'), weight (for words), color.
  // Returns the width.
  function canvasLabel(ctx, str, x, y, opts) {
    opts = opts || {};
    var px = opts.size || 14, w = measureLabel(ctx, str, px, opts.weight);
    var cx = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
    var by = opts.baseline === 'middle' ? y + 0.34 * px : y;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (opts.color) ctx.fillStyle = opts.color;
    labelRuns(str).forEach(function (r) {
      cx += r.g * px;
      if (!r.t) return;
      ctx.font = runFont(r, px, opts.weight);
      ctx.fillText(r.t, cx, by + r.y * px);
      cx += ctx.measureText(r.t).width;
    });
    ctx.restore();
    return w;
  }

  // Fills an SVG <text> with a label, as tspans; position and anchor stay the
  // text element's own. Shifts are in em, so the element need not be in the
  // document yet. Assistive technology reads the tspans' text.
  function svgLabel(el, str) {
    var y = 0;
    while (el.firstChild) el.removeChild(el.firstChild);
    labelRuns(str).forEach(function (r) {
      var ts = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      var scale = r.f === 's' ? r.s : r.s * LBL_MATH_SCALE; // font size relative to the <text>
      ts.textContent = r.t || '​';
      ts.style.fontFamily = r.f === 's' ? 'var(--sans)' : 'var(--math)';
      ts.style.fontStyle = r.f === 'm' ? 'italic' : 'normal';
      if (scale !== 1) ts.style.fontSize = (scale * 100).toFixed(1) + '%';
      // dx and dy in the tspan's own em, i.e. the <text>'s size times scale
      if (r.g) ts.setAttribute('dx', (r.g / scale).toFixed(3) + 'em');
      if (r.y !== y) { ts.setAttribute('dy', ((r.y - y) / scale).toFixed(3) + 'em'); y = r.y; }
      el.appendChild(ts);
    });
    if (y) { // back to the baseline, for anything appended later
      var end = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      end.textContent = '​';
      end.setAttribute('dy', (-y).toFixed(3) + 'em');
      el.appendChild(end);
    }
  }

  /* ---------- turning a picture by dragging ----------
   * A drag on a 3D picture turns it. With a mouse or a pen it turns from the
   * first movement. On a touch screen the first movement decides the whole drag:
   * mostly sideways, the drag turns the picture to its end, up and down included,
   * and the page does not scroll; mostly up or down, the page scrolls and the
   * picture stays still. While the picture turns (when() says so, or always if
   * there is no when), the element has the class .turnable: theme.css gives it
   * `touch-action: pan-y`, so that the browser may scroll the page from it, and
   * the grab cursor. when() is asked once the page's script has run; a page
   * whose when() changes its answer later (a picture that turns only in space)
   * calls drag.update() after the change.
   * With keys: { turn(a, b), home() }, the arrow keys on the focused element
   * turn it as a drag that way would: turn(a, b) by the angles a (Left and
   * Right, Right positive) and b (Up and Down, Down positive), in radians,
   * TURN_STEP a press, TURN_FINE with Shift; Home calls home() (the view it
   * started with), if given. Alt, Ctrl and Meta combinations are left to the
   * browser, and so is a key a handler before has taken (preventDefault). */
  // the reader has moved a picture (MM.moved, above)
  function moved() { document.dispatchEvent(new CustomEvent('mm:moved')); }
  var TURN_SLOP = 5; // pixels a press moves before it is a drag, and its direction is read
  var TURN_STEP = Math.PI / 30, TURN_FINE = Math.PI / 180; // a key turns by 6°, with Shift 1°
  var TURN_KEYS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
  function turnDrag(el, opts) {
    var drag = { active: false, moved: false, update: update }, g = null; // g: the press being followed
    function update() { el.classList.toggle('turnable', !opts.when || !!opts.when()); }
    // (first once the page's script has run, so that when() may read what it sets up later)
    if (opts.when) Promise.resolve().then(update); else update();
    if (opts.keys) {
      el.addEventListener('keydown', function (e) {
        var a = TURN_KEYS[e.key], k = opts.keys;
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (!a && !(e.key === 'Home' && k.home))) return;
        if (opts.when && !opts.when(e)) return;
        e.preventDefault();
        if (a) { var t = e.shiftKey ? TURN_FINE : TURN_STEP; k.turn(a[0] * t, a[1] * t, e); } else k.home(e);
        moved();
      });
    }
    function decide(x, y) {
      var dx = x - g.x0, dy = y - g.y0;
      if (Math.hypot(dx, dy) < TURN_SLOP) return false;
      // touch, mostly up or down: the page scrolls, and the drag is not the picture's
      if (g.touch && Math.abs(dy) >= Math.abs(dx)) { g = null; return false; }
      drag.active = drag.moved = true;
      try { el.setPointerCapture(g.id); } catch (err) { /* the pointer is already gone */ }
      if (opts.start) opts.start();
      return true;
    }
    el.addEventListener('pointerdown', function (e) {
      if (g || e.button) return;
      drag.moved = false;
      if (opts.when && !opts.when(e)) return;
      g = { id: e.pointerId, touch: e.pointerType !== 'mouse', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      // A mouse is held from the press, so that a quick drag off a small element
      // (a term of a formula) still reaches it, and so does its release. (A touch
      // is held once its first movement has decided, above.)
      if (!g.touch) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ } }
    });
    // a press let go, or taken over by the browser, wherever that happens: so that
    // a press whose release never came to el does not hold it up
    function forget(e) { if (g && e.pointerId === g.id && !drag.active) g = null; }
    window.addEventListener('pointerup', forget);
    window.addEventListener('pointercancel', forget);
    el.addEventListener('pointermove', function (e) {
      if (!g || e.pointerId !== g.id) return;
      if (!drag.active) {
        if (!g.touch && !e.buttons) { g = null; return; } // let go outside before it moved
        if (!decide(e.clientX, e.clientY)) return;
      }
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      g.x = e.clientX;
      g.y = e.clientY;
      if (dx || dy) opts.move(dx, dy, e);
    });
    // A second finger: the drag gives way, to a pinch (MM.pinchZoom) or to the page.
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length < 2 || !g || !g.touch) return;
      g = null;
      if (drag.active) { drag.active = false; if (opts.end) opts.end(e); moved(); }
    }, { passive: true });
    // While a touch drag turns the picture, the page must not scroll, whichever way
    // the finger goes. (A browser may send this before the pointer event: then it decides.)
    el.addEventListener('touchmove', function (e) {
      if (!g || !g.touch || e.touches.length !== 1) return;
      if (!drag.active && !decide(e.touches[0].clientX, e.touches[0].clientY)) return;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    function finish(e) {
      if (!g || e.pointerId !== g.id) return;
      g = null;
      if (drag.active) { drag.active = false; if (opts.end) opts.end(e); moved(); }
    }
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { el.addEventListener(t, finish); });
    return drag;
  }

  /* ---------- zooming a picture by pinching ----------
   * MM.pinchZoom(el, { zoom, pan, end }): on a touch screen two fingers on el zoom
   * the picture as they spread or close, zoom(f, x, y) by the factor f about the
   * point (x, y) between them (CSS pixels from el's top left corner), and move it
   * as they move together, pan(dx, dy) (if given); meanwhile the page neither
   * scrolls nor zooms. One finger is left alone: it scrolls the page, or drags what
   * the page lets it (a finger on a .draggable element is not part of a pinch, and
   * a drag of MM.turnDrag gives way to a second finger). A pinch on a trackpad
   * zooms about the pointer: browsers report it as a wheel turned with Ctrl, Safari
   * as gesture events. end() when a pinch is over. The element gets the class
   * .zoomable: theme.css gives it `touch-action: pan-y`, so that the browser
   * leaves the pinch to the page; with a mouse the page shows <mm-zoom> instead. */
  function pinchZoom(el, opts) {
    var p = null, wheelEnd = 0, gs = null; // the pinch: its fingers' last distance and midpoint; Safari's gesture: its last scale
    el.classList.add('zoomable');
    function fingers(e) {
      var list = [];
      for (var i = 0; i < e.touches.length; i++) {
        var t = e.touches[i], n = t.target;
        if (n && n.nodeType === 1 && el.contains(n) && !n.closest('.draggable')) list.push(t);
      }
      return list.length === 2 ? list : null;
    }
    function at(f) {
      var r = el.getBoundingClientRect();
      return {
        d: Math.hypot(f[0].clientX - f[1].clientX, f[0].clientY - f[1].clientY),
        x: (f[0].clientX + f[1].clientX) / 2 - r.left, y: (f[0].clientY + f[1].clientY) / 2 - r.top,
      };
    }
    function stop() { if (p) { p = null; if (opts.end) opts.end(); moved(); } }
    el.addEventListener('touchstart', function (e) { var f = fingers(e); if (f) p = at(f); }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      var f = fingers(e);
      // not two fingers, or the browser has the touches already (the page scrolls)
      if (!f || !e.cancelable) { stop(); return; }
      e.preventDefault();
      var q = at(f);
      if (p) {
        if (opts.pan && (q.x !== p.x || q.y !== p.y)) opts.pan(q.x - p.x, q.y - p.y);
        if (p.d > 0 && q.d > 0 && q.d !== p.d) opts.zoom(q.d / p.d, q.x, q.y);
      }
      p = q;
    }, { passive: false });
    ['touchend', 'touchcancel'].forEach(function (t) { el.addEventListener(t, function (e) { if (!fingers(e)) stop(); }); });
    el.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      var r = el.getBoundingClientRect(), dy = e.deltaMode === 1 ? 16 * e.deltaY : e.deltaY;
      opts.zoom(Math.exp(-Math.max(-50, Math.min(50, dy)) / 100), e.clientX - r.left, e.clientY - r.top);
      clearTimeout(wheelEnd);
      wheelEnd = setTimeout(function () { if (opts.end) opts.end(); moved(); }, 250);
    }, { passive: false });
    // Safari's own pinch events: from a trackpad they zoom; on a touch screen the touches above do
    el.addEventListener('gesturestart', function (e) { e.preventDefault(); gs = navigator.maxTouchPoints ? null : 1; });
    el.addEventListener('gesturechange', function (e) {
      e.preventDefault();
      if (gs === null || !(e.scale > 0)) return;
      var r = el.getBoundingClientRect();
      opts.zoom(e.scale / gs, e.clientX - r.left, e.clientY - r.top);
      gs = e.scale;
    });
    el.addEventListener('gestureend', function (e) { e.preventDefault(); if (gs !== null) { gs = null; if (opts.end) opts.end(); moved(); } });
  }

  // an SVG element with these attributes, appended to parent if given (MM.svg)
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- a handle ----------
   * MM.handle(el[, r]) draws the handle of a picture (theme.css: .handle): a yellow dot,
   * a gap of the ground, a ring, and the ring of the keyboard focus outside them. Into an
   * SVG element (a group, placed by the page) it draws them about the origin, the dot of
   * radius r (7 by default) and the rest in proportion, and gives el the class .handle-art;
   * into any other element (a .handle, a box over a picture) it puts an <svg> that fills
   * it, whose size the box sets (--handle-size). Returns what it drew into. */
  var HANDLE = [['focus-ring', 14.5], ['handle-ring', 10.75], ['handle-gap', 9], ['handle-dot', 7]];
  function handle(el, r) {
    var host = el, k = (r || 7) / 7;
    if (!(el instanceof SVGElement)) {
      el.textContent = '';
      host = svgEl('svg', { viewBox: '-22 -22 44 44', 'aria-hidden': 'true' }, el);
      k = 1;
    }
    host.classList.add('handle-art');
    HANDLE.forEach(function (c) { svgEl('circle', { class: c[0], r: String(Math.round(c[1] * k * 100) / 100) }, host); });
    return host;
  }

  /* ---------- a strip of pictures to choose from ----------
   * MM.strip(el, { pick, control }): el is a .strip (role="toolbar") of .strip-item buttons,
   * in .strip-group groups; where the groups have a data-family, one family is shown at a
   * time. The strip is one stop for Tab, on the item pressed (or the first shown); the
   * arrow keys, Home and End move along the items shown (Alt, Ctrl and Meta combinations
   * are left to the browser). A click on an item calls pick(item, e). control, a segmented
   * control of the families (<mm-seg>, values as the groups' data-family), chooses the
   * family shown, and follows it. Returns
   *   light(item)  the item pressed (null: none): its family shown, the item brought into
   *                view within the strip (smoothly, unless motion is reduced)
   *   show(family) the groups of that family shown, from the start (or the item pressed)
   *   family()     the family shown
   * Items may be added or replaced later (light() takes them in). */
  function strip(el, opts) {
    opts = opts || {};
    var control = opts.control || null, lit = el.querySelector('.strip-item[aria-pressed="true"]'), fam = null;
    function all() { return Array.prototype.slice.call(el.querySelectorAll('.strip-item')); }
    function shown() { return all().filter(function (b) { var g = b.closest('.strip-group'); return !b.hidden && !(g && g.hidden); }); }
    // the one tab stop: `to`, or the item pressed if it is shown, or the first shown
    function stop(to) {
      if (el.contains(document.activeElement)) return;
      var list = shown();
      to = to || (lit && list.indexOf(lit) >= 0 ? lit : list[0]);
      all().forEach(function (b) { var t = b === to ? 0 : -1; if (b.getAttribute('tabindex') !== String(t)) b.tabIndex = t; });
    }
    // an item brought into view within the strip (the page itself does not scroll)
    function bringIn(b) {
      var left = b.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft, room = el.clientWidth;
      if (left < el.scrollLeft + 8 || left + b.offsetWidth > el.scrollLeft + room - 8) {
        el.scrollTo({ left: Math.max(0, left - room / 2 + b.offsetWidth / 2), behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    }
    function show(f) {
      fam = String(f);
      if (control && String(control.value) !== fam) control.value = fam;
      Array.prototype.forEach.call(el.querySelectorAll('.strip-group[data-family]'), function (g) { g.hidden = g.dataset.family !== fam; });
      stop();
      el.scrollLeft = 0;
      if (lit && shown().indexOf(lit) >= 0) bringIn(lit);
    }
    function light(b) {
      var was = lit;
      lit = b || null;
      all().forEach(function (o) { var on = String(o === lit); if (o.getAttribute('aria-pressed') !== on) o.setAttribute('aria-pressed', on); });
      var g = lit && lit.closest('.strip-group[data-family]');
      if (g && g.dataset.family !== fam) { show(g.dataset.family); return; }
      stop(lit && shown().indexOf(lit) >= 0 ? lit : null);
      if (lit && lit !== was) bringIn(lit);
    }
    el.addEventListener('keydown', function (e) {
      var b = e.target.closest && e.target.closest('.strip-item'), step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!b || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (!step && e.key !== 'Home' && e.key !== 'End')) return;
      var list = shown(), i = list.indexOf(b), to = list[e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + step + list.length) % list.length];
      if (!to) return;
      all().forEach(function (o) { o.tabIndex = o === to ? 0 : -1; });
      to.focus();
      e.preventDefault();
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.strip-item');
      if (b && el.contains(b) && opts.pick) opts.pick(b, e);
    });
    if (control) control.addEventListener('change', function (e) { show(e.detail && e.detail.value !== undefined ? e.detail.value : control.value); });
    if (!el.getAttribute('role')) el.setAttribute('role', 'toolbar');
    all().forEach(function (b) { if (!b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false'); });
    var first = el.querySelector('.strip-group[data-family]');
    if (control || first) show(control ? control.value : first.dataset.family); else stop();
    return { light: light, show: show, family: function () { return fam; } };
  }

  /* ---------- a copy of the main picture ----------
   * A figure in the text that changes the main picture, out of view by then, has a small
   * copy of it beside it (theme.css: .fig-pair, .fig-copy). MM.copyPicture(box, layers)
   * fills the .fig-copy box with a copy of `layers`, the main picture's canvases and SVGs,
   * one over another as on the page (each SVG with an id). An SVG is copied live, by <use>;
   * a canvas is copied when the returned function is called, which the page does after it
   * draws. The copy takes the shape of the first layer. */
  function copyPicture(box, layers) {
    var parts = layers.map(function (src) {
      if (src.tagName.toLowerCase() === 'canvas') {
        var c = document.createElement('canvas');
        box.appendChild(c);
        return { src: src, el: c };
      }
      var svg = svgEl('svg', null, box), use = svgEl('use', { href: '#' + src.id }, svg);
      // (its size follows the original's)
      new MutationObserver(function () { update(); }).observe(src, { attributes: true, attributeFilter: ['viewBox'] });
      return { src: src, el: svg, use: use };
    });
    box.setAttribute('role', box.getAttribute('role') || 'img');
    function update() {
      var first = layers[0], w = first.clientWidth, h = first.clientHeight;
      if (w && h) box.style.setProperty('--fig-copy-ratio', String(w / h));
      var dpr = pixelRatio(), W = Math.max(1, Math.round(box.clientWidth * dpr)), H = Math.max(1, Math.round(box.clientHeight * dpr));
      parts.forEach(function (p) {
        if (p.use) {
          var vb = p.src.getAttribute('viewBox'), v = vb && vb.split(/[\s,]+/);
          if (!v || v.length !== 4) return;
          if (p.el.getAttribute('viewBox') !== vb) p.el.setAttribute('viewBox', vb);
          ['x', 'y', 'width', 'height'].forEach(function (a, k) { if (p.use.getAttribute(a) !== v[k]) p.use.setAttribute(a, v[k]); });
          return;
        }
        if (p.el.width !== W) p.el.width = W;
        if (p.el.height !== H) p.el.height = H;
        var c2 = p.el.getContext('2d');
        c2.clearRect(0, 0, W, H);
        if (p.src.width && p.src.height) c2.drawImage(p.src, 0, 0, W, H);
      });
    }
    new ResizeObserver(function () { update(); }).observe(box);
    update();
    return update;
  }

  /* ---------- touch on draggable shapes in an SVG ----------
   * `.draggable` sets `touch-action: none`, so that a swipe on what is dragged does
   * not scroll the page. Browsers honour that on boxes (a canvas, an <svg>, a div)
   * but not on the shapes inside an SVG; and a page that draws its picture afresh
   * as a shape is dragged removes the shape touched, while the touch's events stay
   * with it, out of reach of listeners on the picture. So a touch that starts on a
   * draggable element stops the page scrolling from the element touched itself. */
  function setupDraggables() {
    document.addEventListener('touchstart', function (e) {
      var t = e.target;
      if (!t || !t.closest || !t.closest('.draggable')) return;
      function stop(ev) { if (ev.cancelable) ev.preventDefault(); }
      function done() {
        t.removeEventListener('touchmove', stop);
        t.removeEventListener('touchend', done);
        t.removeEventListener('touchcancel', done);
      }
      t.addEventListener('touchmove', stop, { passive: false });
      t.addEventListener('touchend', done);
      t.addEventListener('touchcancel', done);
    }, { passive: true });
  }

  /* ---------- matrices ----------
   * MM.matrix(box, rows, label) replaces box's content with the matrix whose rows are
   * lists of entries (TeX): a grid, each cell a .mx-e with data-i and data-j for its row
   * and column (class is-lit lights one), between parentheses. These are KaTeX's tall
   * parentheses, of the weight of its other delimiters at the size of the entries, made
   * as tall as the grid; for fewer rows than their hooks need, the hooks are shortened
   * (KaTeX's own pmatrix uses a fixed glyph for two rows, which looks out of place beside
   * the others). label says the matrix in words. box must be on the page, to measure;
   * the parentheses are drawn again once the fonts are loaded. */
  // KaTeX's tall left parenthesis (the path of its "lparen"), in thousandths of an em: 875
  // wide, two hooks 1800 high and a straight middle `mid` high between them
  function lparen(mid) {
    return 'M863,9c0,-2,-2,-5,-6,-9c0,0,-17,0,-17,0c-12.7,0,-19.3,0.3,-20,1c-5.3,5.3,-10.3,11,-15,17c-242.7,294.7,-395.3,682,-458,1162c-21.3,163.3,-33.3,349,-36,557l0,' + (mid + 84)
      + 'c0.2,6,0,26,0,60c2,159.3,10,310.7,24,454c53.3,528,210,949.7,470,1265c4.7,6,9.7,11.7,15,17c0.7,0.7,7,1,19,1c0,0,18,0,18,0c4,-4,6,-7,6,-9c0,-2.7,-3.3,-8.7,-10,-18c-135.3,-192.7,-235.5,-414.3,-300.5,-665c-65,-250.7,-102.5,-544.7,-112.5,-882c-2,-104,-3,-167,-3,-189l0,-' + (mid + 92)
      + 'c0,-162.7,5.7,-314,17,-454c20.7,-272,63.7,-513,129,-723c65.3,-210,155.3,-396.3,270,-559c6.7,-9.3,10,-15.3,10,-18z';
  }
  function fitMatrix(wrap) {
    var grid = wrap.children[1], k = grid.querySelector('.katex'), em = k ? parseFloat(getComputedStyle(k).fontSize) : 18, h = grid.offsetHeight;
    if (!h) return;
    var mid = Math.max(0, Math.round(h / em * 1000) - 3600);
    [wrap.children[0], wrap.children[2]].forEach(function (s) {
      s.innerHTML = '<svg viewBox="0 0 875 ' + (mid + 3600) + '" preserveAspectRatio="none" width="' + (0.875 * em).toFixed(2) + '" height="' + h + '"><path d="' + lparen(mid) + '"/></svg>';
    });
  }
  function matrix(box, rows, label) {
    var wrap = document.createElement('span'), grid = document.createElement('span');
    function paren() { var s = document.createElement('span'); s.className = 'mx-paren'; s.setAttribute('aria-hidden', 'true'); return s; }
    wrap.className = 'mx-wrap';
    wrap.setAttribute('role', 'img');
    if (label) wrap.setAttribute('aria-label', label);
    grid.className = 'mx';
    grid.style.setProperty('--mx-n', rows.length ? rows[0].length : 1);
    grid.innerHTML = rows.map(function (row, i) {
      return row.map(function (t, j) { return '<span class="mx-e" data-i="' + i + '" data-j="' + j + '">' + tex(String(t)) + '</span>'; }).join('');
    }).join('');
    wrap.appendChild(paren());
    wrap.appendChild(grid);
    wrap.appendChild(paren());
    box.textContent = '';
    box.appendChild(wrap);
    fitMatrix(wrap);
    return grid;
  }
  onFonts(function () { Array.prototype.forEach.call(document.querySelectorAll('.mx-wrap'), fitMatrix); });

  /* ---------- small Dynkin diagrams ----------
   * MM.dynkinPicture(svg, d, opts) draws the diagram d into an <svg>, small, as the
   * lists of diagrams under a picture show them (Dynkin diagrams, Root systems):
   *   d.pos    the nodes' places on a grid, [x, y] (x to the right, y down), one unit
   *            for a bond
   *   d.bonds  [{ i, j, lines, arrow, label, heavy }]: 1 to 4 lines; arrow 0 for none,
   *            1 pointing to node i, 2 to node j (the shorter root), 3 both ways; a
   *            label (words with $…$ maths) above the middle; heavy, one thick line
   *   d.nodes  'o' (white, the default), 'x' (crossed: odd isotropic) or 'b' (black)
   * opts: unit (13 px a bond), r (2.7, the nodes' radius), height (44), base (30, the
   * height of the row y = 0, so that rows of pictures line up). Everything is drawn in
   * currentColor; the <svg> gets the width the diagram needs. */
  function dynkinPicture(svg, d, opts) {
    var o = { unit: 13, r: 2.7, height: 44, base: 30 };
    Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
    var xs = d.pos.map(function (q) { return q[0]; }), make = svgEl;
    var x0 = Math.min.apply(null, xs), W = (Math.max.apply(null, xs) - x0) * o.unit + 10;
    function at(i) { return [5 + (d.pos[i][0] - x0) * o.unit, o.base + d.pos[i][1] * o.unit]; }
    svg.textContent = '';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + o.height);
    svg.style.width = W + 'px';
    var ink = { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    function line(attrs, parent) { Object.keys(ink).forEach(function (k) { if (!(k in attrs)) attrs[k] = ink[k]; }); return make('path', attrs, parent); }
    (d.bonds || []).forEach(function (b) {
      var p = at(b.i), q = at(b.j), len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len, r = o.r;
      var lines = b.heavy ? 1 : Math.max(1, Math.min(4, b.lines || 1)), g = make('g', {}, svg);
      for (var k = 0; k < lines; k++) {
        var off = (k - (lines - 1) / 2) * 1.7;
        line({ d: 'M' + (p[0] + ux * r - uy * off) + ' ' + (p[1] + uy * r + ux * off) + 'L' + (q[0] - ux * r - uy * off) + ' ' + (q[1] - uy * r + ux * off), 'stroke-width': b.heavy ? 2.4 : 1.1 }, g);
      }
      var cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2, hh = 1.6 + 0.9 * lines;
      // a chevron at the middle (moved along the bond by `shift`), its tip that way (dir ±1 along it)
      function chevron(dir, shift) {
        var px = cx + ux * shift, py = cy + uy * shift;
        line({ d: 'M' + (px - dir * 2 * ux - uy * hh) + ' ' + (py - dir * 2 * uy + ux * hh) + 'L' + (px + dir * 2 * ux) + ' ' + (py + dir * 2 * uy) + 'L' + (px - dir * 2 * ux + uy * hh) + ' ' + (py - dir * 2 * uy - ux * hh) }, g);
      }
      if (b.arrow === 1) chevron(-1, 0);
      else if (b.arrow === 2) chevron(1, 0);
      else if (b.arrow === 3) { chevron(-1, -3); chevron(1, 3); }
      if (b.label) {
        // above the middle, or to the left of a bond that runs up and down
        var nx = uy, ny = -ux;
        if (ny > 0 || (Math.abs(ny) < 1e-9 && nx > 0)) { nx = -nx; ny = -ny; }
        svgLabel(make('text', { x: cx + nx * 4.5, y: cy + ny * 4.5 + (ny < -0.5 ? 0 : 3), 'font-size': 9, 'text-anchor': Math.abs(ny) < 0.5 ? 'end' : 'middle', fill: 'currentColor' }, svg), b.label);
      }
    });
    d.pos.forEach(function (_, i) {
      var p = at(i), kind = (d.nodes && d.nodes[i]) || 'o';
      make('circle', { cx: p[0], cy: p[1], r: o.r, fill: kind === 'b' ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': 1.1 }, svg);
      if (kind === 'x') { var c = o.r * Math.SQRT1_2; line({ d: 'M' + (p[0] - c) + ' ' + (p[1] - c) + 'L' + (p[0] + c) + ' ' + (p[1] + c) + 'M' + (p[0] - c) + ' ' + (p[1] + c) + 'L' + (p[0] + c) + ' ' + (p[1] - c), 'stroke-width': 0.9 }, svg); }
    });
    return svg;
  }

  /* ---------- canvases: their pixels, and pausing what cannot be seen ---------- */
  // A canvas's backing store has this many pixels per CSS pixel. Save image
  // (example.js) replaces it for a moment, to draw the figure at its own size.
  function pixelRatio() { return window.devicePixelRatio || 1; }

  // Every pixel of a canvas's backing store cleared (it may reach a fraction of a CSS
  // pixel beyond the drawing's width), and filled with color if given.
  function clearCanvas(ctx, color) {
    var cv = ctx.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.restore();
  }

  // A canvas made ready to draw on: its backing store the size of its CSS box (or of
  // w × h CSS pixels, if given) at MM.pixelRatio() (read from MM, which Save image
  // replaces), empty, and its context drawing in CSS pixels. The store is made anew
  // only when its size changes. Returns { w, h, dpr, ctx }.
  function fitCanvas(cv, w, h) {
    if (w === undefined) { var r = cv.getBoundingClientRect(); w = r.width; h = r.height; }
    var dpr = window.MM.pixelRatio(), W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr)), ctx = cv.getContext('2d');
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } else clearCanvas(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h, dpr: dpr, ctx: ctx };
  }

  // whether the reader has asked for less motion, as it is now
  var calmQuery = null;
  function reduceMotion() {
    if (!calmQuery && window.matchMedia) calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return !!(calmQuery && calmQuery.matches);
  }

  function whenVisible(els, fn) {
    var list = Array.isArray(els) ? els : [els], seen = new Map(), on = true;
    function check() {
      var now = !document.hidden && !document.documentElement.classList.contains('is-dialog-open')
        && list.some(function (el) { return seen.get(el) !== false; });
      if (now !== on) { on = now; fn(on); }
    }
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { seen.set(e.target, e.isIntersecting); });
        check();
      });
      list.forEach(function (el) { io.observe(el); });
    }
    document.addEventListener('visibilitychange', check);
    document.addEventListener('mm:dialog', check);
    return function () { return on; };
  }

  /* ---------- Undo and Redo ----------
   * MM.undoRedo({ undo, redo, canUndo, canRedo, buttons }) wires a page's Undo and Redo, whose
   * history the page keeps: the buttons (#undo and #redo, or buttons: [undo, redo]) call undo()
   * and redo(), and so do Ctrl+Z (⌘Z on a Mac) and Shift+Ctrl+Z (⇧⌘Z) or Ctrl+Y, wherever the
   * focus is but in a text field, which has an Undo of its own (a slider is not one), when
   * canUndo() or canRedo() says there is a change to take back or make again. Alt combinations,
   * and a key a handler before has taken (preventDefault), are left alone. Returns
   *   update()          the buttons enabled or not as canUndo() and canRedo() say (call it
   *                     after every change; it is called after each undo and redo)
   *   keep(list, entry) list.push(entry), forgetting the oldest beyond UNDO_LIMIT entries */
  var UNDO_LIMIT = 200;
  var NOT_TEXT = { range: 1, checkbox: 1, radio: 1, button: 1, submit: 1, reset: 1, color: 1, file: 1, image: 1, hidden: 1 };
  function inTextField(t) {
    if (!t || t.nodeType !== 1) return false;
    return t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !NOT_TEXT[String(t.type).toLowerCase()]);
  }
  function undoRedo(opts) {
    var b = opts.buttons || [document.getElementById('undo'), document.getElementById('redo')];
    function update() {
      [opts.canUndo(), opts.canRedo()].forEach(function (can, i) { if (b[i] && b[i].disabled === !!can) b[i].disabled = !can; });
    }
    function act(back, e) {
      if (back) opts.undo(e); else opts.redo(e);
      update();
    }
    if (b[0]) b[0].addEventListener('click', function (e) { act(true, e); });
    if (b[1]) b[1].addEventListener('click', function (e) { act(false, e); });
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || inTextField(e.target)) return;
      var key = String(e.key).toLowerCase(), back = key === 'z' && !e.shiftKey;
      if (!back && !(key === 'z' && e.shiftKey) && !(key === 'y' && e.ctrlKey)) return;
      if (!(back ? opts.canUndo() : opts.canRedo())) return;
      e.preventDefault();
      act(back, e);
    });
    update();
    return {
      update: update,
      keep: function (list, entry) { list.push(entry); if (list.length > UNDO_LIMIT) list.shift(); },
    };
  }

  window.MM = {
    tex: tex, rich: rich, setHTML: setHTML, renderMath: renderMath,
    color: color, rgba: rgba, cssVar: cssVar, font: font, onFonts: onFonts, esc: esc,
    canvasLabel: canvasLabel, measureLabel: measureLabel, svgLabel: svgLabel,
    turnDrag: turnDrag, pinchZoom: pinchZoom, handle: handle, strip: strip, moved: moved, copyPicture: copyPicture, pixelRatio: pixelRatio, whenVisible: whenVisible, matrix: matrix, dynkinPicture: dynkinPicture,
    kv: kv, svg: svgEl, fitCanvas: fitCanvas, clearCanvas: clearCanvas, reduceMotion: reduceMotion, undoRedo: undoRedo,
  };

  /* Components (segmented controls, tabs, sliders, toggles), inlined at build
     time from components.js; adds MM.enhance. */
  /* @components */

  // Sticky header. Marks <html> as .is-scrolled once the page has moved (the
  // navigation then shows a soft fade instead of a rule), publishes the
  // height of the page's .control-bar as --bar-h (for other sticky
  // elements and anchor offsets), and marks the bar .is-stuck while it sits
  // under the navigation. On a phone the bar is one row that scrolls
  // sideways, and fades at an edge with more beyond it, as an overflowing
  // segmented control does, with an arrow there that scrolls it on. A .split
  // figure's picture column stays in view under them while its readouts
  // scroll; one too tall to show whole there is marked .is-tall and scrolls
  // with the page instead.
  function setupSticky() {
    var root = document.documentElement;
    var bar = document.querySelector('.control-bar');
    var row = bar && bar.querySelector(':scope > .wrap');
    var mains = Array.prototype.slice.call(document.querySelectorAll('.split-main'));
    var navH = 0;
    // an arrow at each end of the row, shown while the row is cut off there, that scrolls it on
    var more = row ? ['start', 'end'].map(function (side) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bar-scroll bar-scroll-' + side;
      b.hidden = true;
      b.tabIndex = -1; // (the keys go along the controls themselves, and scroll them into view)
      b.setAttribute('aria-hidden', 'true');
      b.innerHTML = '<svg viewBox="0 0 16 16"><path d="' + (side === 'start' ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5') + '"/></svg>';
      b.addEventListener('click', function () {
        row.scrollBy({ left: (side === 'start' ? -1 : 1) * Math.max(60, row.clientWidth * 0.7), behavior: reduceMotion() ? 'auto' : 'smooth' });
      });
      bar.appendChild(b);
      return b;
    }) : [];
    function edges() {
      var max = row.scrollWidth - row.clientWidth;
      var start = max > 1 && row.scrollLeft > 1, end = max > 1 && row.scrollLeft < max - 1;
      row.classList.toggle('is-clipped-start', start);
      row.classList.toggle('is-clipped-end', end);
      more[0].hidden = !start;
      more[1].hidden = !end;
      // the end arrow goes right up to the page's tools, if there are any, over the gap
      // before them, so that the row is hidden under as little of it as can be
      // (the first of them shown: the menu, or the button back to the picture before it)
      var b = bar.getBoundingClientRect(), r = row.getBoundingClientRect(), first = Infinity, stop = r.right;
      Array.prototype.forEach.call(bar.querySelectorAll('.bar-tools > .btn:not([hidden])'), function (t) {
        first = Math.min(first, t.getBoundingClientRect().left);
      });
      if (first < Infinity) stop = Math.min(b.right, Math.max(r.right, first - 2));
      bar.style.setProperty('--row-start', (r.left - b.left) + 'px');
      bar.style.setProperty('--row-end', (b.right - stop) + 'px');
      row.style.setProperty('--end-arrow', Math.max(0, r.right - stop + 22) + 'px'); // (22px: the arrow's width)
    }
    function update() {
      root.classList.toggle('is-scrolled', window.scrollY > 1);
      if (bar) bar.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= navH + 0.5);
    }
    function fit() {
      mains.forEach(function (m) {
        var top = parseFloat(getComputedStyle(m).top);
        m.classList.toggle('is-tall', isFinite(top) && m.offsetHeight > window.innerHeight - top - 12);
      });
    }
    function measure() {
      navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 0;
      if (bar) root.style.setProperty('--bar-h', bar.offsetHeight + 'px');
      if (row) edges();
      fit();
      update();
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', measure);
    if (row) row.addEventListener('scroll', edges, { passive: true });
    if (window.ResizeObserver) {
      if (bar) new ResizeObserver(measure).observe(bar);
      // the row, and each control in it: one that is hidden, shown or changes its width
      // (a page hides those that do not apply) cuts the row off, or no longer, without the
      // row itself changing size or scrolling
      if (row) {
        var watch = new ResizeObserver(edges), each = function () { Array.prototype.forEach.call(row.children, function (c) { watch.observe(c); }); };
        watch.observe(row);
        each();
        new MutationObserver(each).observe(row, { childList: true });
      }
      mains.forEach(function (m) { new ResizeObserver(fit).observe(m); });
    }
    measure();
  }

  /* The logo's control point moves round the knot while the pointer is over the
   * logo: it eases in, runs at an even pace along the curve, passes under the
   * upper strand at each crossing (hidden exactly where its own strand is; the
   * geometry comes from build/logo.mjs), and eases to a stop when the pointer
   * leaves, always where it can be seen whole. Where it stops is kept for the
   * visit (sessionStorage), so the point stays put from page to page; a new
   * visit starts it on the left crossing. */
  var TAU = 2 * Math.PI;
  var LOGO_KEY = 'mm-logo-point';
  var LOGO_TURN = 3000;        // ms for one turn at full speed
  var LOGO_EASE_IN = 160;      // ms, time constant of speeding up
  var LOGO_EASE_OUT = 240;     // ms, of slowing down

  // The knot of a logo <svg>: p(t) = (sin t + 2 sin 2t, cos t − 2 cos 2t), scaled.
  //
  // build/logo.mjs draws the whole curve and hides what passes under each
  // crossing with a band along the upper strand (masks; see the comment on
  // knotMarkup there). Under a crossing the point is hidden by the same band,
  // so it disappears exactly where its strand does. Its white ring is a gap
  // cut into the strands (the halo circle). While the point is under a band,
  // the ring is made the outline of what can be seen of the point: everything
  // within the ring's width of the visible part, outside the band. So the ring
  // never touches the strand above, and never shows without the point.
  var knotIds = 0;
  function knotOf(svg) {
    if (svg._mmKnot) return svg._mmKnot;
    // unique ids, also in a copy (cloneNode) of a logo
    var suffix = '-' + (++knotIds), renamed = {};
    Array.prototype.forEach.call(svg.querySelectorAll('[id]'), function (el) { renamed[el.id] = el.id + suffix; el.id += suffix; });
    Array.prototype.forEach.call(svg.querySelectorAll('[mask], use'), function (el) {
      var m = /^url\(#(.+)\)$/.exec(el.getAttribute('mask') || '');
      if (m && renamed[m[1]]) el.setAttribute('mask', 'url(#' + renamed[m[1]] + ')');
      var href = el.getAttribute('href');
      if (href && renamed[href.slice(1)]) el.setAttribute('href', '#' + renamed[href.slice(1)]);
    });

    var g = JSON.parse(svg.getAttribute('data-knot'));
    var dot = svg.querySelector('.logo-point'), halo = svg.querySelector('.logo-halo');
    var unband = svg.querySelector('.logo-unband'), unring = svg.querySelector('.logo-unring');
    var corners = svg.querySelector('.logo-corners');
    var bandOn = svg.querySelector('.logo-band-on');
    var bandPaths = svg.querySelector('.logo-bands').getAttribute('d').match(/M[^M]*/g) || [];
    var rDot = parseFloat(dot.getAttribute('r')), rHalo = parseFloat(halo.getAttribute('r')), h = g.hide / 2;
    function at(t) {
      return [g.size / 2 + g.k * (Math.sin(t) + 2 * Math.sin(2 * t)), g.size / 2 + g.k * (Math.cos(t) - 2 * Math.cos(2 * t))];
    }
    function wrap(t) { return ((t % TAU) + TAU) % TAU; }
    function segDist(p, a, b) {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var s = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dy);
    }

    // per crossing: the band's centre line (the upper strand), and the stretches
    // of t around the under-pass in which the ring, or the point itself, meets it
    var bands = g.unders.map(function (under, i) {
      var pts = [];
      for (var j = 0; j <= 32; j++) pts.push(at(g.overs[i] + (j / 16 - 1) * g.span));
      function dist(p) {
        var d = Infinity;
        for (var k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(p, pts[k], pts[k + 1]));
        return d;
      }
      function stretch(r) {
        var lo = under, hi = under;
        while (dist(at(lo - 0.002)) < h + r && under - lo < 1) lo -= 0.002;
        while (dist(at(hi + 0.002)) < h + r && hi - under < 1) hi += 0.002;
        return { from: wrap(lo - 0.002), span: hi - lo + 0.004 };
      }
      return { d: bandPaths[i] || '', dist: dist, ring: stretch(rHalo), point: stretch(rDot) };
    });
    function inside(s, t) { return wrap(t - s.from) < s.span; }

    // The ring as the outline of the visible part of the point, for the mask:
    // { unring: wedges from the centre over the hidden stretches of rim (the
    // ring there is given back), corners: discs of the ring's width where the
    // visible rim meets the band (cut again: the outline's rounded ends) }.
    // The rim is sampled every 2°, and each meeting point found by bisection.
    function ringShape(c, band) {
      var N = 180, step = TAU / N, hidden = [], any = false, all = true;
      function rim(a) { return [c[0] + rDot * Math.cos(a), c[1] + rDot * Math.sin(a)]; }
      function isHidden(a) { return band.dist(rim(a)) < h; }
      for (var k = 0; k < N; k++) {
        hidden[k] = isHidden(k * step);
        any = any || hidden[k];
        all = all && hidden[k];
      }
      if (!any) return { unring: '', corners: '' };
      var R = rHalo + 1, w = rHalo - rDot;
      function pt(a, r) { return (c[0] + r * Math.cos(a)).toFixed(3) + ' ' + (c[1] + r * Math.sin(a)).toFixed(3); }
      if (all) return { unring: 'M' + pt(0, R) + 'A' + R + ' ' + R + ' 0 1 1 ' + pt(Math.PI, R) + 'A' + R + ' ' + R + ' 0 1 1 ' + pt(0, R) + 'Z', corners: '' };
      // the angle between samples k and k+1 where the rim leaves or enters the band
      function edge(k) {
        var lo = k * step, hi = lo + step, from = hidden[k];
        for (var i = 0; i < 12; i++) { var mid = (lo + hi) / 2; if (isHidden(mid) === from) lo = mid; else hi = mid; }
        return (lo + hi) / 2;
      }
      var unringD = '', cornersD = '';
      for (var k0 = 0; k0 < N; k0++) {
        var prev = (k0 + N - 1) % N;
        if (hidden[prev] === hidden[k0]) continue;
        var a = edge(prev), p = rim(a);
        cornersD += 'M' + (p[0] - w).toFixed(3) + ' ' + p[1].toFixed(3) + 'a' + w + ' ' + w + ' 0 1 0 ' + 2 * w + ' 0a' + w + ' ' + w + ' 0 1 0 ' + -2 * w + ' 0Z';
        if (!hidden[k0]) continue;
        // a run of hidden samples starts here: a wedge from this edge to the next
        var len = 0;
        while (hidden[(k0 + len) % N]) len++;
        var b = edge((k0 + len - 1) % N);
        if (b < a) b += TAU;
        unringD += 'M' + c[0].toFixed(3) + ' ' + c[1].toFixed(3) + 'L' + pt(a, R);
        for (var s = Math.ceil(a / step) * step; s < b; s += step) unringD += 'L' + pt(s, R);
        unringD += 'L' + pt(b, R) + 'Z';
      }
      return { unring: unringD, corners: cornersD };
    }

    // the whole point can be seen
    function visible(t) {
      for (var i = 0; i < bands.length; i++) if (inside(bands[i].point, t)) return false;
      return true;
    }
    var active = -1;
    function place(t) {
      var q = at(t), x = q[0].toFixed(2), y = q[1].toFixed(2);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      halo.setAttribute('cx', x); halo.setAttribute('cy', y);
      var now = -1;
      for (var i = 0; i < bands.length; i++) if (inside(bands[i].ring, t)) now = i;
      if (now !== active) {
        active = now;
        var d = now < 0 ? '' : bands[now].d;
        unband.setAttribute('d', d);
        bandOn.setAttribute('d', d);
        if (now < 0) { unring.setAttribute('d', ''); corners.setAttribute('d', ''); }
      }
      if (now >= 0) {
        var shape = ringShape(q, bands[now]);
        unring.setAttribute('d', shape.unring);
        corners.setAttribute('d', shape.corners);
      }
    }
    // the first t from here on where the point can be seen whole
    function open(t) {
      for (var i = 0; i < 2000 && !visible(t); i++) t += 0.002;
      return wrap(t);
    }
    return (svg._mmKnot = { g: g, dot: dot, place: place, visible: visible, open: open });
  }

  function savedLogoT() {
    try { var v = parseFloat(sessionStorage.getItem(LOGO_KEY)); return isFinite(v) ? v : null; } catch (e) { return null; }
  }
  function saveLogoT(t) {
    logoT = t;
    try { sessionStorage.setItem(LOGO_KEY, t.toFixed(4)); } catch (e) { /* storage blocked: each page starts at rest */ }
  }

  // Put the point where it last stopped as soon as the logo is parsed, before
  // it is first painted (the page's own scripts may hold DOMContentLoaded back).
  var logoT = savedLogoT();
  if (logoT !== null) {
    var logoWatch = new MutationObserver(function () {
      var dot = document.querySelector('svg[data-knot] .logo-point');
      if (!dot) return;
      knotOf(dot.ownerSVGElement).place(logoT);
      logoWatch.disconnect();
    });
    logoWatch.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { logoWatch.disconnect(); });
  }

  function setupLogos() {
    Array.prototype.forEach.call(document.querySelectorAll('svg[data-knot]'), function (svg) {
      if (svg.querySelector('.logo-point')) setupLogo(svg.closest('.brand') || svg, svg);
    });
  }
  function setupLogo(brand, svg) {
    if (svg._mmLogo) return;
    svg._mmLogo = true;
    var knot = knotOf(svg);
    var t = logoT !== null ? logoT : knot.g.rest;
    knot.place(t);
    // speed in curve units per ms: a turn is the length of the curve, ∫|p'(t)| dt,
    // and |p'(t)|² = 17 + 8 cos 3t
    var length = 0;
    for (var i = 0; i < 360; i++) length += Math.sqrt(17 + 8 * Math.cos(3 * (i + 0.5) * TAU / 360)) * TAU / 360;
    var full = length / LOGO_TURN;
    var v = 0, hovered = false, running = false, last = 0;
    function frame(now) {
      var dt = Math.min(50, now - last);
      last = now;
      // once the pointer has left, keep going while any of the point is hidden
      var target = hovered ? full : knot.visible(t) ? 0 : 0.4 * full;
      v += (target - v) * (1 - Math.exp(-dt / (target > v ? LOGO_EASE_IN : LOGO_EASE_OUT)));
      t = (t + v * dt / Math.sqrt(17 + 8 * Math.cos(3 * t))) % TAU;
      knot.place(t);
      if (!hovered && v < 0.03 * full && knot.visible(t)) {
        running = false;
        v = 0;
        saveLogoT(t);
        return;
      }
      requestAnimationFrame(frame);
    }
    function start(e) {
      if (e.pointerType === 'touch') return; // a tap is a click on the link
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      hovered = true;
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    }
    brand.addEventListener('pointerenter', start);
    brand.addEventListener('pointermove', function (e) { if (!hovered) start(e); });
    brand.addEventListener('pointerleave', function () { hovered = false; });
    // leaving the page mid-move (a click on the logo): the next page starts
    // from here, moved on out of any gap
    window.addEventListener('pagehide', function () { if (running) saveLogoT(knot.open(t)); });
  }

  // Rows of cards (.shelf, on the home page). While a row holds more than
  // fits it is marked .is-scrollable, and:
  // - round arrows either side of the bar under it scroll it by as many whole
  //   cards as are in view; each shows only while there is more that way
  //   (.has-prev, .has-next);
  // - a mouse can drag it, and on release it settles on a card (further on
  //   when flung); a drag is not a click on the card it started on;
  // - a card cut off by an edge (.is-partial) is a button that scrolls the
  //   row that way, not a link;
  // - under it, a dot for each card and a pill over those in view; a click on
  //   a dot brings its card in, a drag along them scrubs the row.
  function setupShelves() {
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(document.querySelectorAll('.shelf'), function (shelf) {
      var track = shelf.querySelector('.shelf-track');
      var prev = shelf.querySelector('.shelf-prev'), next = shelf.querySelector('.shelf-next');
      var pos = shelf.querySelector('.shelf-pos'), bar = shelf.querySelector('.shelf-bar'), thumb = shelf.querySelector('.shelf-thumb');
      if (!track || !prev || !next) return;
      function max() { return track.scrollWidth - track.clientWidth; }
      // the scroll positions at which a card starts the row
      function stops() {
        var cards = track.children, first = cards[0], m = max(), out = [];
        for (var i = 0; i < cards.length; i++) out.push(Math.min(m, cards[i].offsetLeft - first.offsetLeft));
        return out;
      }
      // the distinct places the row can rest, and between a scroll position and
      // the bar's position in segments (0 at the first place, 1 at the next, …)
      function places() {
        return stops().filter(function (p, i, a) { return i === 0 || p > a[i - 1] + 1; });
      }
      function segAt(x) {
        var s = places();
        for (var i = 1; i < s.length; i++) if (x <= s[i]) return i - 1 + (x - s[i - 1]) / (s[i] - s[i - 1]);
        return s.length - 1;
      }
      function xAt(seg) {
        var s = places(), i = Math.max(0, Math.min(s.length - 2, Math.floor(seg)));
        return s.length < 2 ? 0 : s[i] + (seg - i) * (s[i + 1] - s[i]);
      }
      function update() {
        var m = max(), x = track.scrollLeft, on = m >= 2;
        var cs = getComputedStyle(track), pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
        shelf.classList.toggle('is-scrollable', on);
        shelf.classList.toggle('has-prev', on && x > 2);
        shelf.classList.toggle('has-next', on && x < m - 2);
        prev.disabled = !(on && x > 2);
        next.disabled = !(on && x < m - 2);
        // a card cut off by either edge of the column scrolls the row instead
        var r = track.getBoundingClientRect(), lo = r.left + pl - 2, hi = r.right - pr + 2;
        Array.prototype.forEach.call(track.children, function (c) {
          var b = c.getBoundingClientRect();
          c.classList.toggle('is-partial', on && (b.left < lo || b.right > hi));
        });
        if (pos) {
          pos.hidden = !on;
          if (on) {
            // a dot for each card; at rest the pill covers the dots of the
            // cards in view (one for each place the row can rest, less the
            // last), and it moves in step between them
            var n = track.children.length, k = places().length - 1;
            bar.style.setProperty('--span', n - k);
            bar.style.setProperty('--at', segAt(x).toFixed(4));
          }
        }
      }
      function go(x) { track.scrollTo({ left: x, behavior: still ? 'auto' : 'smooth' }); }
      function step(dir) {
        var s = stops(), x = track.scrollLeft, card = track.firstElementChild;
        var cs = getComputedStyle(track), gap = parseFloat(cs.columnGap) || 0;
        var pitch = card.getBoundingClientRect().width + gap;
        var view = track.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var n = Math.max(1, Math.floor((view + gap) / pitch + 0.01));
        var i = 0;
        while (i < s.length - 1 && s[i] < x - 2) i++;      // the first card in view
        if (dir < 0 && Math.abs(s[i] - x) > 2) i++;       // part-way: count from the next one back
        go(s[Math.max(0, Math.min(s.length - 1, i + dir * n))]);
      }
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });
      // a click on a card cut off by an edge brings it in: the whole card is
      // the target, its link and topics being inert while it is cut off. Not
      // from the keyboard (a click with no detail), nor a click that opens the
      // link elsewhere (with a modifier key): those follow the link.
      track.addEventListener('click', function (e) {
        var c = e.target.closest && e.target.closest('.card.is-partial');
        if (!c || dragged || e.detail === 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        var r = track.getBoundingClientRect(), b = c.getBoundingClientRect();
        step(b.left + b.width / 2 < r.left + r.width / 2 ? -1 : 1);
      });
      // a card reached with the Tab key comes into view whole
      track.addEventListener('focusin', function (e) {
        var c = e.target.closest && e.target.closest('.card');
        if (!c || !c.classList.contains('is-partial')) return;
        track.scrollTo({ left: stops()[Array.prototype.indexOf.call(track.children, c)], behavior: 'instant' });
        update();
      });

      // dragging with a mouse
      var drag = null, dragged = false;
      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button || max() < 2) return;
        drag = { x0: e.clientX, s0: track.scrollLeft, id: e.pointerId, on: false, v: 0, t: e.timeStamp, x: e.clientX };
        dragged = false;
      });
      track.addEventListener('pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (!e.buttons) { drag = null; return; }
        var dx = e.clientX - drag.x0;
        if (!drag.on) {
          if (Math.abs(dx) < 5) return;
          drag.on = dragged = true;
          track.classList.add('is-dragging');
          try { track.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
        }
        var dt = e.timeStamp - drag.t;
        if (dt > 0) drag.v = 0.7 * drag.v + 0.3 * (e.clientX - drag.x) / dt;
        drag.t = e.timeStamp; drag.x = e.clientX;
        track.scrollLeft = drag.s0 - dx;
      });
      function release(e) {
        if (!drag || e.pointerId !== drag.id) return;
        var was = drag.on, v = drag.v;
        drag = null;
        if (!was) return;
        track.classList.remove('is-dragging');
        // settle on the card nearest to where a fling would carry the row
        var aim = track.scrollLeft - v * 220, s = stops(), best = s[0];
        s.forEach(function (p) { if (Math.abs(p - aim) < Math.abs(best - aim)) best = p; });
        go(best);
      }
      track.addEventListener('pointerup', release);
      track.addEventListener('pointercancel', release);
      track.addEventListener('lostpointercapture', release);
      track.addEventListener('click', function (e) {
        if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; }
      }, true);
      track.addEventListener('dragstart', function (e) { e.preventDefault(); });

      // the dots: a click on one brings its card in (no further than
      // needed); a drag along them scrubs the row, the pill following the
      // pointer from where it was taken, and settles on a card when let go
      if (bar) {
        var dots = bar.querySelectorAll('.shelf-dot'), press = null;
        var pitch = function () { return dots.length > 1 ? dots[1].getBoundingClientRect().left - dots[0].getBoundingClientRect().left : 1; };
        var segOf = function (e) {
          var k = places().length - 1;
          return Math.max(0, Math.min(k, (e.clientX - press.grab - dots[0].getBoundingClientRect().left) / pitch()));
        };
        bar.addEventListener('pointerdown', function (e) {
          if (e.button) return;
          var t = thumb.getBoundingClientRect(), on = e.clientX >= t.left - 3 && e.clientX <= t.right + 3;
          press = { x0: e.clientX, id: e.pointerId, scrub: false, grab: on ? e.clientX - t.left : t.width / 2 };
          try { bar.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
          e.preventDefault();
        });
        bar.addEventListener('pointermove', function (e) {
          if (!press || e.pointerId !== press.id) return;
          if (!press.scrub) {
            if (Math.abs(e.clientX - press.x0) < 4) return;
            press.scrub = true;
            bar.classList.add('is-dragging');
            track.classList.add('is-dragging');
          }
          track.scrollLeft = xAt(segOf(e));
        });
        var letGo = function (e) {
          if (!press || e.pointerId !== press.id) return;
          var p = press;
          press = null;
          bar.classList.remove('is-dragging');
          track.classList.remove('is-dragging');
          var s = places();
          if (p.scrub) {
            var x = track.scrollLeft, best = s[0];
            s.forEach(function (q) { if (Math.abs(q - x) < Math.abs(best - x)) best = q; });
            go(best);
            return;
          }
          if (e.type !== 'pointerup') return;
          // which dot: the nearest to the press
          var i = 0, d = Infinity;
          Array.prototype.forEach.call(dots, function (dot, j) {
            var r = dot.getBoundingClientRect(), dd = Math.abs(r.left + r.width / 2 - p.x0);
            if (dd < d) { d = dd; i = j; }
          });
          var at = Math.round(segAt(track.scrollLeft)), span = dots.length - (s.length - 1);
          if (i < at) go(s[i]);
          else if (i > at + span - 1) go(s[Math.min(s.length - 1, i - span + 1)]);
        };
        bar.addEventListener('pointerup', letGo);
        bar.addEventListener('pointercancel', letGo);
        bar.addEventListener('lostpointercapture', letGo);
      }

      track.addEventListener('scroll', update, { passive: true });
      if (window.ResizeObserver) new ResizeObserver(update).observe(track);
      else window.addEventListener('resize', update);
      update();
    });
  }

  // Citations (a.cite-ref, from [@key] by build/cite.mjs, or by MM.setHTML in
  // text that scripts write; hence the listeners on the document). Pointing at
  // or focusing a number shows its reference in a card under it (over it when
  // there is no room below); the pointer may move into the card, whose links
  // work. A tap opens the card instead of jumping to the list, and a tap
  // elsewhere or Esc closes it; the card links to the entry in the list.
  function setupCites() {
    if (!document.querySelector('.refs li[id^="ref-"]')) return;
    var card = document.createElement('div');
    card.className = 'cite-card';
    card.id = 'cite-card';
    card.hidden = true;
    document.body.appendChild(card);
    var current = null, openT = 0, closeT = 0, touch = false, quiet = false;
    function refOf(t) { return t && t.closest ? t.closest('a.cite-ref') : null; }

    function place(a) {
      var r = a.getBoundingClientRect(), cr = card.getBoundingClientRect();
      var root = getComputedStyle(document.documentElement);
      var head = (parseFloat(root.getPropertyValue('--nav-h')) || 0) + (parseFloat(root.getPropertyValue('--bar-h')) || 0);
      var gap = 6, w = document.documentElement.clientWidth;
      var below = r.bottom + gap + cr.height <= window.innerHeight - 8 || r.top - gap - cr.height < head + 8;
      var top = below ? r.bottom + gap : r.top - gap - cr.height;
      var left = Math.max(12, Math.min(r.left + r.width / 2 - cr.width / 2, w - 12 - cr.width));
      card.style.top = (top + window.scrollY) + 'px';
      card.style.left = (left + window.scrollX) + 'px';
    }
    function open(a) {
      clearTimeout(openT); clearTimeout(closeT);
      if (current === a) return;
      var li = document.getElementById(a.getAttribute('href').slice(1));
      if (!li) return;
      if (current) current.setAttribute('aria-expanded', 'false');
      current = a;
      card.innerHTML = '<span class="cite-card-n">[' + esc(a.textContent) + ']</span>' + li.innerHTML +
        '<a class="cite-card-go" href="#' + esc(li.id) + '">Go to reference</a>';
      card.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
      card.hidden = false;
      card.style.top = '0px'; card.style.left = '0px';
      place(a);
      a.setAttribute('aria-controls', 'cite-card');
      a.setAttribute('aria-expanded', 'true');
    }
    function close() {
      clearTimeout(openT); clearTimeout(closeT);
      if (!current) return;
      current.setAttribute('aria-expanded', 'false');
      current = null;
      card.hidden = true;
    }
    function later(fn, ms) { clearTimeout(openT); clearTimeout(closeT); return setTimeout(fn, ms); }

    document.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var a = refOf(e.target);
      if (a) { if (current) open(a); else openT = later(function () { open(a); }, 150); }
      else if (current && card.contains(e.target)) clearTimeout(closeT);
    });
    document.addEventListener('pointerout', function (e) {
      if (e.pointerType !== 'mouse') return;
      var from = refOf(e.target) || (card.contains(e.target) ? card : null);
      if (!from || from.contains(e.relatedTarget)) return;
      if (refOf(e.relatedTarget) === current || card.contains(e.relatedTarget)) return;
      if (current) closeT = later(close, 250); else clearTimeout(openT);
    });
    document.addEventListener('focusin', function (e) {
      var a = refOf(e.target);
      if (a && !quiet && a.matches(':focus-visible')) open(a);
      else if (current && card.contains(e.target)) clearTimeout(closeT);
    });
    document.addEventListener('focusout', function (e) {
      if (!current || (e.target !== current && !card.contains(e.target))) return;
      if (e.relatedTarget === current || card.contains(e.relatedTarget)) return;
      closeT = later(close, 100);
    });
    document.addEventListener('pointerdown', function (e) {
      var a = refOf(e.target);
      touch = !!a && e.pointerType !== 'mouse';
      if (current && !a && !card.contains(e.target)) close();
    });
    // choosing the entry already in the address flashes it again
    function reflash(link) {
      var li = document.getElementById(link.getAttribute('href').slice(1));
      if (!li || location.hash !== '#' + li.id) return;
      li.style.animation = 'none';
      void li.offsetWidth;
      li.style.animation = '';
    }
    document.addEventListener('click', function (e) {
      var a = refOf(e.target);
      var go = !a && e.target.closest ? e.target.closest('.cite-card-go') : null;
      if (go) { reflash(go); close(); return; }
      if (!a) return;
      var tap = touch;
      touch = false;
      if (!tap) { reflash(a); return; } // a mouse click or Enter goes to the list
      e.preventDefault();
      if (current === a) close(); else open(a);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !current) return;
      var a = current, inCard = card.contains(document.activeElement);
      close();
      if (inCard) { quiet = true; a.focus(); quiet = false; }
    });
    window.addEventListener('resize', function () { if (current) place(current); });
  }

  function setup() { setupSticky(); setupLogos(); setupShelves(); setupCites(); setupDraggables(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
