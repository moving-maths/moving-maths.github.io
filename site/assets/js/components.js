/* Moving Maths components: one implementation of each interactive control. The
 * build inlines this file into site.js, so every page has it. Their look comes
 * from the component tokens in theme.css. Two ways in:
 *
 * 1. Markup with the theme's classes, as pages already write it:
 *      .seg > button[aria-checked | aria-pressed | aria-selected]
 *      .tabs > .tab[aria-selected]
 *      input[type=range]
 *    These are enhanced automatically, including when a script adds them later:
 *    - segmented controls and tabs get an indicator that slides to the chosen
 *      item whenever the page changes the aria attribute, and fade at an edge
 *      where they overflow;
 *    - a group with role="radiogroup" or role="tablist" becomes one tab stop,
 *      and the arrow keys, Home and End move through it, activating each item
 *      by clicking it (so the page's click handler does the work; a page that
 *      handles a key itself calls preventDefault and this leaves it alone);
 *    - sliders get their fill, kept in step however the value changes.
 *
 * 2. Custom elements, which write that markup and emit `change` events. Give
 *    them their children in the HTML, or before inserting them from a script.
 *      <mm-seg value="2" aria-label="dimension">
 *        <button value="1">1</button><button value="2">2</button>
 *      </mm-seg>
 *          change → detail.value; el.value reads and sets the choice
 *      <mm-tabs value="a" aria-label="Examples" hash>
 *        <mm-tab id="a"><span slot="label">First</span> …panel… </mm-tab>
 *        <mm-tab id="b"><span slot="label">Second</span> … </mm-tab>
 *      </mm-tabs>
 *          change → detail.value (the tab's id); `hash` keeps it in the URL.
 *          This change does not bubble; controls inside the panels send their
 *          own, which do, so a listener on <mm-tabs> checks e.target.
 *      <mm-slider min="0" max="360" step="1" value="0" unit="°">Rotate by $g$</mm-slider>
 *          the native input and change events; el.value. With `exact` (and
 *          step="any") its value can be typed, fractions too: Enter or leaving
 *          the box sends change with detail { value, exact: true }.
 *          el.allow = (v) => … keeps it off the values for which it is false,
 *          drawn dotted on its track (set it again when they change)
 *      <mm-toggle pressed>Show the arrows</mm-toggle>
 *          change → detail.pressed; el.pressed
 *      <mm-select value="b" aria-label="…">
 *        <button value="a">…</button><button value="b">…</button>
 *      </mm-select>
 *          one of many choices in little room: a button that shows the choice
 *          and opens the list of them under it (arrow keys, Home, End, Enter,
 *          Escape). change → detail.value; el.value reads and sets it
 *      <mm-menu aria-label="Swap two points">…an icon…</mm-menu>
 *          a few actions in little room: a button that opens them under it;
 *          el.items = [{ value, label, disabled }]; change → detail.value
 *      <mm-zoom min="1" max="8" value="2"></mm-zoom>
 *          how far a picture is zoomed in: a slider over magnifications from
 *          min to max, on a logarithmic track, between a magnifier with − and
 *          one with +, which zoom out and in by a step. input while it moves,
 *          change when it is let go (a magnifier sends both), and MM.moved()
 *          after change; el.value reads
 *          and sets the magnification (setting sends nothing). Not shown on a
 *          touch screen without a mouse, where the picture zooms by pinching
 *          (MM.pinchZoom, site.js)
 *      <mm-numbers value="2,1" min="0" max="20" integer aria-label="…">$\lambda$</mm-numbers>
 *          a few numbers typed in a box ("2, 1", "1/3, −1/2"); change →
 *          detail.value, an array, once Enter or leaving the box gives valid
 *          ones (preventDefault() refuses them); el.value reads and sets it.
 *          count (default: as many as the value has), min, max and integer
 *          say what is valid
 *    aria-label and aria-labelledby on the element move to the control inside.
 */
var ON = '[aria-checked="true"],[aria-pressed="true"],[aria-selected="true"]';
var uid = 0;

function whenReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

// Moves attributes from a custom element to the control it wraps.
function forward(from, to, names) {
  names.forEach(function (a) {
    if (from.hasAttribute(a)) { to.setAttribute(a, from.getAttribute(a)); from.removeAttribute(a); }
  });
}

/* ---------- groups: sliding indicator, keyboard, overflow ---------- */
function usable(b) { return !b.disabled && !b.hidden; }
function isComposite(el) { var r = el.getAttribute('role'); return r === 'radiogroup' || r === 'tablist'; }

// Arrow keys, Home and End in a radio group or tab list. One listener on the
// document, so it runs after the page's own (on the items or the group), and
// sees whether they handled the key.
function keyNav(e, items) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return; // Alt+← is the browser's Back
  var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step && e.key !== 'Home' && e.key !== 'End') return;
  var list = items().filter(usable);
  var i = list.indexOf(document.activeElement);
  if (i < 0) return;
  var j = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + step + list.length) % list.length;
  e.preventDefault();
  if (j === i) return;
  list[j].focus();
  list[j].click();
}

function attachIndicator(container, kind) {
  if (container._mmIndicator) { container._mmIndicator(); return; }
  // a copy of a set-up control (cloneNode) brings its indicator along
  var ind = container.querySelector(':scope > .' + kind + '-indicator') || document.createElement('span');
  ind.className = kind + '-indicator';
  ind.setAttribute('aria-hidden', 'true');
  var last = null;
  function items() {
    return Array.prototype.filter.call(container.children, function (el) {
      return kind === 'seg' ? el.tagName === 'BUTTON' : (el.classList.contains('tab') || el.getAttribute('role') === 'tab');
    });
  }
  // one tab stop: the chosen item, or else the first that can take focus
  function rove(list, chosen) {
    if (!isComposite(container)) return;
    var stop = chosen && usable(chosen) ? chosen : list.filter(usable)[0];
    list.forEach(function (b) { var t = b === stop ? 0 : -1; if (b.tabIndex !== t) b.tabIndex = t; });
  }
  // fades at an edge that has more to scroll to
  function edges() {
    var max = container.scrollWidth - container.clientWidth;
    container.classList.toggle('is-clipped-start', max > 1 && container.scrollLeft > 1);
    container.classList.toggle('is-clipped-end', max > 1 && container.scrollLeft < max - 1);
  }
  // scrolls an overflowing group (not the page) to show the chosen item
  function reveal(b, animate) {
    var w = container.clientWidth;
    if (container.scrollWidth <= w + 1) return;
    var pad = 28, left = b.offsetLeft, right = left + b.offsetWidth, view = container.scrollLeft;
    var to = left - pad < view ? left - pad : right + pad > view + w ? right + pad - w : null;
    if (to !== null) container.scrollTo({ left: Math.max(0, to), behavior: animate && !reduceMotion() ? 'smooth' : 'auto' });
  }
  function update() {
    if (ind.parentNode !== container) container.insertBefore(ind, container.firstChild);
    var list = items();
    var on = list.filter(function (b) { return b.matches(ON) && !b.hidden; });
    rove(list, on[0]);
    edges();
    if (on.length !== 1) {             // none, or several (a multi-select group): no indicator
      container.classList.remove('has-indicator');
      ind.classList.remove('is-placed', 'is-moving');
      last = null;
      return;
    }
    var b = on[0];
    if (!b.offsetWidth) return;        // not laid out (hidden); the ResizeObserver calls again
    ind.classList.toggle('is-moving', !reduceMotion() && ind.classList.contains('is-placed') && last !== null && last !== b);
    ind.style.width = b.offsetWidth + 'px';
    if (kind === 'seg') {
      ind.style.height = b.offsetHeight + 'px';
      ind.style.transform = 'translate(' + b.offsetLeft + 'px,' + b.offsetTop + 'px)';
    } else {
      ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    }
    ind.classList.add('is-placed');
    container.classList.add('has-indicator');
    if (last !== b) reveal(b, last !== null);
    last = b;
  }
  container._mmIndicator = update;
  new MutationObserver(update).observe(container, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['aria-checked', 'aria-pressed', 'aria-selected', 'hidden', 'disabled'],
  });
  if (window.ResizeObserver) new ResizeObserver(update).observe(container);
  container.addEventListener('scroll', edges, { passive: true });
  container._mmItems = items;
  onFonts(update);
  update();
}

/* ---------- sliders ---------- */
// Setting the value from a script fires no event, so each way of changing it
// (value, valueAsNumber, stepUp/Down, the attributes, form reset) updates --fill.
var valueProp = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
var numberProp = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'valueAsNumber');
function syncRange(input) {
  var min = input.min === '' ? 0 : +input.min, max = input.max === '' ? 100 : +input.max;
  var v = +valueProp.get.call(input);
  input.style.setProperty('--fill', (max > min ? ((v - min) / (max - min)) * 100 : 0).toFixed(2) + '%');
}
function enhanceRange(input) {
  if (input._mmRange) return;
  input._mmRange = true;
  [['value', valueProp], ['valueAsNumber', numberProp]].forEach(function (p) {
    Object.defineProperty(input, p[0], {
      configurable: true,
      get: function () { return p[1].get.call(this); },
      set: function (v) { p[1].set.call(this, v); syncRange(this); },
    });
  });
  ['stepUp', 'stepDown'].forEach(function (m) {
    var native = HTMLInputElement.prototype[m];
    input[m] = function () { native.apply(this, arguments); syncRange(this); };
  });
  input.addEventListener('input', function () { syncRange(input); });
  new MutationObserver(function () { syncRange(input); }).observe(input, { attributes: true, attributeFilter: ['min', 'max', 'step', 'value'] });
  syncRange(input);
}
document.addEventListener('keydown', function (e) {
  var group = e.target.parentElement;
  if (group && group._mmItems && isComposite(group)) keyNav(e, group._mmItems);
});

// a form's reset event comes before the reset itself
document.addEventListener('reset', function (e) {
  var form = e.target;
  setTimeout(function () {
    Array.prototype.forEach.call(form.elements || [], function (el) { if (el.type === 'range') syncRange(el); });
  });
}, true);

/* ---------- enhancing markup, as the page is parsed and as scripts add it ---------- */
var CONTROLS = '.seg, .tabs, input[type="range"]';
function enhance(root) {
  var scope = root || document;
  var list = Array.prototype.slice.call(scope.querySelectorAll(CONTROLS));
  if (scope !== document && scope.matches && scope.matches(CONTROLS)) list.unshift(scope);
  list.forEach(function (el) {
    if (el.matches('.seg')) attachIndicator(el, 'seg');
    else if (el.matches('.tabs')) attachIndicator(el, 'tabs');
    else enhanceRange(el);
  });
}

// Custom elements created by the parser are connected before their children
// are parsed; each is set up once the parser has moved past it, which is
// before the page's own scripts run.
var pending = [];
function parsed(el) {
  if (document.readyState !== 'loading') return true;
  for (var n = el; n && n !== document.documentElement; n = n.parentNode) if (n.nextSibling) return true;
  return false;
}
function setupWhenParsed(el, fn) {
  if (el.firstChild || parsed(el)) fn();
  else pending.push([el, fn]);
}
function flushPending() {
  pending = pending.filter(function (p) {
    if (!p[0].isConnected) return false;
    if (!parsed(p[0])) return true;
    try { p[1](); } catch (err) { console.error(err); }
    return false;
  });
}

var enhanceQueued = false;
new MutationObserver(function (records) {
  if (pending.length) flushPending();
  if (enhanceQueued) return;
  for (var i = 0; i < records.length; i++) {
    var added = records[i].addedNodes;
    for (var j = 0; j < added.length; j++) {
      var n = added[j];
      if (n.nodeType !== 1 || n.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      if (n.matches(CONTROLS) || n.querySelector(CONTROLS)) {
        enhanceQueued = true;
        requestAnimationFrame(function () { enhanceQueued = false; enhance(document); });
        return;
      }
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

/* ---------- custom elements ---------- */
function emit(el, detail, bubbles) {
  el.dispatchEvent(new CustomEvent('change', { bubbles: bubbles !== false, detail: detail }));
}

class MMSeg extends HTMLElement {
  static get observedAttributes() { return ['value']; }
  connectedCallback() { var self = this; setupWhenParsed(this, function () { self._setup(); }); }
  attributeChangedCallback() { if (this._ready) this._sync(); }
  get value() { return this.getAttribute('value'); }
  set value(v) { this.setAttribute('value', String(v)); }
  _buttons() { return Array.prototype.filter.call(this.children, function (c) { return c.tagName === 'BUTTON'; }); }
  _valueOf(b) { return b.hasAttribute('value') ? b.getAttribute('value') : b.textContent.trim(); }
  _setup() {
    if (this._ready) return;
    this._ready = true;
    var self = this;
    this.classList.add('seg');
    if (this.hasAttribute('block')) this.classList.add('seg-block');
    this.setAttribute('role', 'radiogroup');
    this.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.parentNode === self && !b.disabled) self._choose(b);
    });
    new MutationObserver(function () { self._sync(); }).observe(this, { childList: true });
    this._sync();
    attachIndicator(this, 'seg'); // also the keyboard and the single tab stop
  }
  _sync() {
    var v = this.getAttribute('value'), self = this;
    this._buttons().forEach(function (b) {
      var on = self._valueOf(b) === v;
      if (b.type !== 'button') b.type = 'button';
      if (b.getAttribute('role') !== 'radio') b.setAttribute('role', 'radio');
      if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', String(on));
    });
  }
  _choose(b) {
    var v = this._valueOf(b);
    if (v === this.value) return;
    this.value = v;
    emit(this, { value: v });
  }
}

class MMTabs extends HTMLElement {
  static get observedAttributes() { return ['value']; }
  connectedCallback() {
    var self = this;
    if (!this._onHash) this._onHash = function () { self._fromHash(); };
    window.addEventListener('hashchange', this._onHash);
    setupWhenParsed(this, function () { self._setup(); });
  }
  disconnectedCallback() { window.removeEventListener('hashchange', this._onHash); }
  attributeChangedCallback() { if (this._list) this._sync(); }
  // before setup, a tab named in the URL already counts, for scripts that read it early
  get value() { return (!this._list && this._hashId()) || this.getAttribute('value'); }
  set value(v) { this.setAttribute('value', String(v)); }
  _panels() { return Array.prototype.filter.call(this.children, function (c) { return c.tagName === 'MM-TAB'; }); }
  _hashId() {
    if (!this.hasAttribute('hash')) return null;
    var h;
    try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { return null; }
    return h && this._panels().some(function (p) { return p.id === h; }) ? h : null;
  }
  _fromHash() {
    var h = this._list && this._hashId();
    if (h && h !== this.getAttribute('value')) { this.setAttribute('value', h); emit(this, { value: h }, false); }
  }
  _setup() {
    if (this._list) return;
    var self = this;
    // a copy of set-up tabs (cloneNode) brings its tab list along
    var list = this.querySelector(':scope > .tabs[role="tablist"]'), made = {};
    if (list) {
      Array.prototype.forEach.call(list.querySelectorAll('[role="tab"]'), function (b) { made[b.getAttribute('aria-controls')] = b; });
    } else {
      list = document.createElement('div');
      list.className = 'tabs';
      list.setAttribute('role', 'tablist');
      this.insertBefore(list, this.firstChild);
    }
    forward(this, list, ['aria-label', 'aria-labelledby']);
    this._panels().forEach(function (p) {
      if (!p.id) p.id = 'mm-tab-' + (++uid);
      var b = made[p.id];
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'tab';
        b.id = p.id + '-tab';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-controls', p.id);
        var label = p.querySelector(':scope > [slot="label"]');
        if (label) { while (label.firstChild) b.appendChild(label.firstChild); label.remove(); }
        else b.textContent = p.getAttribute('label') || p.id;
        list.appendChild(b);
      }
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', b.id);
      p._mmTab = b;
      b.addEventListener('click', function () { self._choose(p.id); });
    });
    this._list = list;
    var ids = this._panels().map(function (p) { return p.id; });
    var h = this._hashId();
    if (h) this.setAttribute('value', h);
    if (ids.indexOf(this.getAttribute('value')) < 0) this.setAttribute('value', ids[0] || '');
    this._sync();
    attachIndicator(list, 'tabs'); // also the keyboard and the single tab stop
  }
  _sync() {
    var v = this.getAttribute('value');
    this._panels().forEach(function (p) {
      var on = p.id === v;
      p.hidden = !on;
      if (p._mmTab) p._mmTab.setAttribute('aria-selected', String(on));
    });
  }
  _choose(id) {
    if (id === this.getAttribute('value')) return;
    this.setAttribute('value', id);
    if (this.hasAttribute('hash')) history.replaceState(history.state, '', '#' + id);
    emit(this, { value: id }, false);
  }
}
class MMTab extends HTMLElement {}

/* ---------- typed numbers ---------- */
// A number as a box shows it: a fraction with a small denominator as such
// (1/3, −5/2), anything else with at most four decimals; minus as a minus sign.
// x as a fraction with a denominator up to 12 where it is one, else with at
// most `digits` decimals (4 if not given)
function formatNumber(x, digits) {
  var sign = x < 0 ? '\u2212' : '', a = Math.abs(x), k = Math.pow(10, digits === undefined ? 4 : digits);
  for (var q = 1; q <= 12; q++) {
    var p = Math.round(a * q);
    if (Math.abs(a - p / q) < 1e-9) return p === 0 ? '0' : sign + p + (q > 1 ? '/' + q : '');
  }
  var r = Math.round(a * k) / k;
  return r === 0 ? '0' : sign + String(r);
}
// "2, 1", "(1/3, -1/2)", "−0.25": the numbers, or null if any is not one
function parseNumbers(text) {
  var t = text.replace(/[\u2212\u2013]/g, '-').replace(/[()\[\]]/g, '').replace(/\s*\/\s*/g, '/').trim();
  if (!t) return null;
  var out = [];
  var parts = t.split(/\s*[,;]\s*|\s+/);
  for (var i = 0; i < parts.length; i++) {
    var m = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:\/(\d+(?:\.\d*)?|\.\d+))?$/.exec(parts[i]);
    if (!m) return null;
    var v = +m[2] / (m[3] === undefined ? 1 : +m[3]);
    if (!isFinite(v)) return null;
    out.push(m[1] === '-' ? -v : v);
  }
  return out;
}
// A text box that commits what was typed on Enter or when it is left, goes back
// to the value on Escape, and marks what it cannot use (commit(text) returns
// false for that). show() puts the value in the box, unless the reader is typing.
function typedField(input, commit, show) {
  function fit() { input.size = Math.max(3, input.value.length + 1); }
  function back() { input.removeAttribute('data-edited'); input.removeAttribute('aria-invalid'); show(); fit(); }
  function done() {
    if (!input.hasAttribute('data-edited')) return true;
    if (commit(input.value) === false) { input.setAttribute('aria-invalid', 'true'); return false; }
    back();
    return true;
  }
  input.addEventListener('input', function (e) { e.stopPropagation(); input.setAttribute('data-edited', ''); input.removeAttribute('aria-invalid'); fit(); });
  // the box's own change is not the control's: it sends its own, with the value
  input.addEventListener('change', function (e) { e.stopPropagation(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (done()) input.select(); }
    else if (e.key === 'Escape' && input.hasAttribute('data-edited')) { e.preventDefault(); e.stopPropagation(); back(); }
  });
  input.addEventListener('blur', function () { if (!done()) back(); });
  return fit;
}
function showIn(input, text, fit) {
  if (document.activeElement === input && input.hasAttribute('data-edited')) return;
  input.value = text;
  fit();
}

class MMSlider extends HTMLElement {
  static get observedAttributes() { return ['value', 'min', 'max', 'step', 'unit']; }
  connectedCallback() { var self = this; setupWhenParsed(this, function () { self._setup(); }); }
  attributeChangedCallback(name, old, v) {
    if (!this._input) return;
    if (name === 'value') this._input.value = v;
    else if (name !== 'unit') { if (v === null) this._input.removeAttribute(name); else this._input.setAttribute(name, v); }
    if (name !== 'value') { this._width(); this._blocked(); } else this._last = +this._input.value;
    syncRange(this._input);
    this._show();
  }
  get value() { return this._input ? +this._input.value : +this.getAttribute('value'); }
  set value(v) { if (this._input) { this._input.value = v; this._last = +this._input.value; this._show(); } else this.setAttribute('value', v); }
  // allow(v): whether the slider may take the value v. Moved onto one it may not, it holds at
  // the last it may on the way there, as at the end of its track; the values it may not take
  // are drawn dotted on the track. Set it again when they change.
  get allow() { return this._allow || null; }
  set allow(fn) { this._allow = fn; this._blocked(); }
  _blocked() {
    var input = this._input, ok = this._allow;
    if (!input) return;
    var min = input.min === '' ? 0 : +input.min, max = input.max === '' ? 100 : +input.max, step = +input.step || 1, layers = [], start = null;
    var pct = function (x) { return (x - min) / (max - min) * 100; };
    // each run of values it may not take, from half a step before it to half a step after, as
    // dots over the ground (a layer must be placed by where its left edge goes: p% puts the
    // p% point of the layer at the p% point of the track)
    function run(a, b) {
      var w = pct(b) - pct(a), at = w >= 99.99 ? 0 : pct(a) / (100 - w) * 100, box = at.toFixed(2) + '% 0 / ' + w.toFixed(2) + '% 100% no-repeat';
      layers.push('repeating-linear-gradient(to right, var(--slider-track) 0 2px, transparent 2px 4px) ' + box, 'linear-gradient(var(--surface), var(--surface)) ' + box);
    }
    if (ok && max > min) {
      for (var k = 0, v = min; v <= max + 1e-9; k++, v = min + k * step) {
        var bad = !ok(+v.toFixed(10));
        if (bad && start === null) start = v;
        if (!bad && start !== null) { run(Math.max(min, start - step / 2), Math.min(max, v - step / 2)); start = null; }
      }
      if (start !== null) run(Math.max(min, start - step / 2), max);
    }
    if (layers.length) input.style.setProperty('--slider-blocked', layers.join(', ')); else input.style.removeProperty('--slider-blocked');
  }
  _setup() {
    if (this._input) return;
    var self = this, id = 'mm-slider-' + (++uid);
    this.classList.add('slider');
    // a copy of a set-up slider (cloneNode) brings its parts along
    var input = this.querySelector(':scope > input[type="range"]');
    var label = this.querySelector(':scope > label');
    var out = this.querySelector(':scope > output');
    if (!input) {
      label = document.createElement('label');
      label.className = 'label';
      while (this.firstChild) label.appendChild(this.firstChild);
      if (label.textContent.trim()) this.appendChild(label); else label = null;
      input = document.createElement('input');
      input.type = 'range';
      ['min', 'max', 'step', 'value', 'name'].forEach(function (a) { if (self.hasAttribute(a)) input.setAttribute(a, self.getAttribute(a)); });
      this.appendChild(input);
    }
    if (this.hasAttribute('exact')) {
      // the value is a box to type in
      if (!out || out.tagName !== 'INPUT') {
        if (out) out.remove();
        out = document.createElement('input');
        out.className = 'field slider-value';
        out.setAttribute('inputmode', 'decimal');
        out.setAttribute('autocomplete', 'off');
        out.setAttribute('spellcheck', 'false');
        this.appendChild(out);
      }
      out.setAttribute('aria-label', 'Exact value');
      this._fit = typedField(out, function (text) {
        var v = parseNumbers(text), lo = +input.min, hi = +input.max;
        if (!v || v.length !== 1 || v[0] < lo || v[0] > hi) return false;
        valueProp.set.call(input, v[0]);
        syncRange(input);
        self._show();
        self.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value: v[0], exact: true } }));
      }, function () { self._show(); });
    } else if (!out) {
      out = document.createElement('output');
      out.className = 'chip chip-mono';
      this.appendChild(out);
    }
    input.id = id;
    if (label) label.htmlFor = id;
    if (out.tagName === 'OUTPUT') {
      out.htmlFor = id;
      out.setAttribute('aria-hidden', 'true'); // the slider announces its value itself
    }
    forward(this, input, ['aria-label', 'aria-labelledby', 'aria-describedby']);
    this._input = input;
    this._out = out;
    // (first of its listeners: a value it may not take goes no further, see allow)
    this._last = +input.value;
    input.addEventListener('input', function (e) {
      var ok = self._allow, v = +valueProp.get.call(input), last = self._last, step = +input.step || 1, w = v;
      if (ok && !ok(v)) {
        for (var k = 0; k < 10000 && w !== last && !ok(w); k++) w = +(w + (v > last ? -step : step)).toFixed(10);
        valueProp.set.call(input, w);
        if (w === last) { e.stopImmediatePropagation(); return; } // nothing changed
      }
      self._last = w;
    });
    enhanceRange(input);
    input.addEventListener('input', function () { self._show(); });
    this._width();
    this._show();
  }
  // what the value box shows; show(text) puts something else there until the value changes
  show(text) {
    if (this._out.tagName === 'INPUT') showIn(this._out, text, this._fit);
    else this._out.textContent = text;
    this._input.setAttribute('aria-valuetext', text);
  }
  // the decimals the value is shown with: as many as the step has, two for step="any"
  _digits() {
    var step = this.getAttribute('step') || '1';
    return step === 'any' ? 2 : (step.split('.')[1] || '').length;
  }
  _show() {
    var v = +this._input.value, d = this._digits();
    var text = this.hasAttribute('exact') ? formatNumber(v, d) : (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (!this.hasAttribute('exact') && this.getAttribute('step') === 'any') text = String(+text);
    this.show(text.replace(/^-/, '−') + (this.getAttribute('unit') || ''));
  }
  // The value box keeps one width, enough for the longest value the range and
  // the step allow (a fraction too, for an exact slider), so that the track never
  // changes length under the pointer. In characters of the mono face, for the
  // CSS, which takes at least --slider-value-width.
  _width() {
    var lo = +this.getAttribute('min') || 0, hi = this.hasAttribute('max') ? +this.getAttribute('max') : 100, d = this._digits();
    var len = function (x) { return (x < 0 ? 1 : 0) + String(Math.floor(Math.abs(x))).length + (d ? d + 1 : 0); };
    var n = Math.max(len(lo), len(hi));
    if (this.hasAttribute('exact')) n = Math.max(n, (lo < 0 ? 1 : 0) + String(Math.ceil(Math.max(Math.abs(lo), Math.abs(hi)) * 12)).length + 3);
    this.style.setProperty('--slider-value-chars', String(n + (this.getAttribute('unit') || '').length));
  }
}

class MMNumbers extends HTMLElement {
  static get observedAttributes() { return ['value']; }
  connectedCallback() { var self = this; setupWhenParsed(this, function () { self._setup(); }); }
  attributeChangedCallback() { if (this._input) this._sync(); }
  get value() { return (parseNumbers(this.getAttribute('value') || '') || []); }
  set value(v) { this.setAttribute('value', Array.isArray(v) ? v.join(',') : String(v)); }
  // what the box accepts, in words, for its title
  _rule() {
    var n = this.getAttribute('count'), lo = this.getAttribute('min'), hi = this.getAttribute('max');
    return (n ? n + ' ' : '') + (this.hasAttribute('integer') ? 'whole numbers' : 'numbers or fractions')
      + (lo !== null && hi !== null ? ' from ' + formatNumber(+lo) + ' to ' + formatNumber(+hi) : '') + ', separated by commas';
  }
  _setup() {
    if (this._input) return;
    var self = this, id = 'mm-numbers-' + (++uid);
    this.classList.add('numbers');
    var input = this.querySelector(':scope > input.field');
    if (!input) {
      var label = document.createElement('label');
      label.className = 'label';
      while (this.firstChild) label.appendChild(this.firstChild);
      if (label.textContent.trim()) { label.htmlFor = id; this.appendChild(label); }
      input = document.createElement('input');
      input.className = 'field';
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');
      this.appendChild(input);
    }
    input.id = id;
    forward(this, input, ['aria-label', 'aria-labelledby', 'aria-describedby']);
    this._input = input;
    // the page may refuse a value that breaks a rule of its own: preventDefault() on the change
    this._fit = typedField(input, function (text) {
      var v = parseNumbers(text), old = self.getAttribute('value') || '';
      if (!v || !self._valid(v)) return false;
      if (v.length === self.value.length && v.every(function (x, i) { return Math.abs(x - self.value[i]) < 1e-12; })) return;
      self.value = v;
      if (!self.dispatchEvent(new CustomEvent('change', { bubbles: true, cancelable: true, detail: { value: v } }))) {
        self.setAttribute('value', old);
        return false;
      }
    }, function () { self._sync(); });
    this._sync();
  }
  _valid(v) {
    var n = this.getAttribute('count'), lo = this.getAttribute('min'), hi = this.getAttribute('max'), whole = this.hasAttribute('integer');
    if (v.length !== (n ? +n : this.value.length)) return false;
    return v.every(function (x) { return (lo === null || x >= +lo - 1e-12) && (hi === null || x <= +hi + 1e-12) && (!whole || Math.abs(x - Math.round(x)) < 1e-12); });
  }
  _sync() {
    this._input.title = this._rule();
    showIn(this._input, this.value.map(formatNumber).join(', '), this._fit);
  }
}

class MMToggle extends HTMLElement {
  static get observedAttributes() { return ['pressed']; }
  connectedCallback() { var self = this; setupWhenParsed(this, function () { self._setup(); }); }
  attributeChangedCallback() { if (this._button) this._button.setAttribute('aria-pressed', String(this.pressed)); }
  get pressed() { return this.hasAttribute('pressed'); }
  set pressed(v) { this.toggleAttribute('pressed', !!v); }
  _setup() {
    if (this._button) return;
    var self = this;
    var b = this.querySelector(':scope > button.toggle'); // a copy of a set-up toggle (cloneNode)
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'toggle';
      while (this.firstChild) b.appendChild(this.firstChild);
      this.appendChild(b);
    }
    b.setAttribute('aria-pressed', String(this.pressed));
    forward(this, b, ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-controls']);
    b.addEventListener('click', function () {
      self.pressed = !self.pressed;
      emit(self, { pressed: self.pressed });
    });
    this._button = b;
  }
}

// A zoom: the magnification m from min to max is the slider's position (m / min)
// to the power 1 / log(max / min), in ZOOM_STEPS steps, so that each step
// multiplies it by the same factor; a magnifier multiplies it by ZOOM_FACTOR.
var ZOOM_STEPS = 100, ZOOM_FACTOR = 1.4;
var ZOOM_ICONS = {
  out: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.75" cy="6.75" r="4.75"/><path d="M10.2 10.2L14 14"/><path d="M4.6 6.75h4.3"/></svg>',
  in: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.75" cy="6.75" r="4.75"/><path d="M10.2 10.2L14 14"/><path d="M4.6 6.75h4.3M6.75 4.6v4.3"/></svg>',
};
class MMZoom extends HTMLElement {
  static get observedAttributes() { return ['value', 'min', 'max']; }
  connectedCallback() { var self = this; setupWhenParsed(this, function () { self._setup(); }); }
  attributeChangedCallback(name, old, v) { if (this._input) this._put(name === 'value' ? +v : this._m); }
  _range() {
    var lo = +this.getAttribute('min') || 1, hi = +this.getAttribute('max') || 8;
    return [lo, Math.max(hi, lo * 1.0001)];
  }
  get value() { return this._input ? this._m : +this.getAttribute('value') || this._range()[0]; }
  set value(m) { if (this._input) this._put(+m); else this.setAttribute('value', m); }
  // m, within the range, on the slider and the magnifiers
  _put(m) {
    var r = this._range(), lo = r[0], hi = r[1];
    m = Math.max(lo, Math.min(hi, isFinite(m) && m > 0 ? m : lo));
    this._m = m;
    this._input.value = String(Math.round(Math.log(m / lo) / Math.log(hi / lo) * ZOOM_STEPS * 100) / 100);
    this._out.disabled = m <= lo * 1.0001;
    this._in.disabled = m >= hi / 1.0001;
  }
  _setup() {
    if (this._input) return;
    var self = this;
    this.textContent = '';
    function magnifier(way) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-quiet btn-sm btn-icon';
      b.tabIndex = -1; // (the slider is the tab stop)
      b.setAttribute('aria-label', way === 'in' ? 'Zoom in' : 'Zoom out');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = ZOOM_ICONS[way];
      b.addEventListener('click', function () {
        self._put(self._m * (way === 'in' ? ZOOM_FACTOR : 1 / ZOOM_FACTOR));
        self.dispatchEvent(new Event('input', { bubbles: true }));
        self.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.MM && MM.moved) MM.moved();
      });
      return b;
    }
    var input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(ZOOM_STEPS);
    input.step = 'any';
    input.setAttribute('aria-label', 'Zoom');
    forward(this, input, ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-controls']);
    this._out = magnifier('out');
    this._in = magnifier('in');
    this.append(this._out, input, this._in);
    this._input = input;
    enhanceRange(input);
    // the slider's own input and change pass on, with the magnification it is at
    input.addEventListener('input', function () {
      var r = self._range();
      self._m = r[0] * Math.pow(r[1] / r[0], +input.value / ZOOM_STEPS);
      self._out.disabled = +input.value <= 0;
      self._in.disabled = +input.value >= ZOOM_STEPS;
    });
    input.addEventListener('change', function () { if (window.MM && MM.moved) MM.moved(); });
    // with step="any" the arrow keys would take a hundredth of the track: a step, as a magnifier
    input.addEventListener('keydown', function (e) {
      var k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (!k || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      (k > 0 ? self._in : self._out).click();
    });
    this._put(+this.getAttribute('value') || this._range()[0]);
  }
}

/* ---------- lists that open from a button: <mm-select>, <mm-menu> ---------- */

// A list that opens from a button. While open it is at the end of the page, fixed under the
// button (over it, with no room below) and above the bar of controls, at least as wide as the
// button and no wider than its items, so that no box that clips or fades what it holds (a phone's
// bar, which scrolls sideways) cuts it off; it follows the button when the page scrolls, and
// closes once the button is out of sight, on a press elsewhere, Escape (the focus back on the
// button) or Tab. The arrow keys, Home and End go through its items; Enter, Space or a click
// chooses one: choose(item).
var CHEVRON = '<svg class="select-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6.5 8 10l3.5-3.5"/></svg>';
function popupList(trigger, list, choose) {
  list.hidden = true;
  list.classList.add('menu', 'popup-list');
  trigger.setAttribute('aria-expanded', 'false');
  function items() { return Array.prototype.filter.call(list.children, function (b) { return b.tagName === 'BUTTON' && !b.disabled; }); }
  function place() {
    var r = trigger.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || !r.width) { close(false); return; }
    list.style.minWidth = Math.round(r.width) + 'px';
    var h = list.offsetHeight, w = list.offsetWidth, below = window.innerHeight - r.bottom - 8;
    list.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    list.style.top = (h <= below || r.top < h + 8 ? r.bottom + 4 : r.top - 4 - h) + 'px';
  }
  // while it is open: a press elsewhere closes it; a scroll (not its own) or a new size of the window moves it with the button
  function onPress(e) { if (!list.contains(e.target) && !trigger.contains(e.target)) close(false); }
  function onScroll(e) { if (!(e.target instanceof Node && list.contains(e.target))) place(); }
  // (put on the page when first opened: one added while the page is read would be taken for
  // the parser having moved on, and controls after it set up before their children are read)
  function open() {
    if (!list.isConnected) document.body.appendChild(list);
    list.hidden = false;
    place();
    if (list.hidden) return;
    document.addEventListener('pointerdown', onPress, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    trigger.setAttribute('aria-expanded', 'true');
    var on = list.querySelector('[aria-selected="true"]:not(:disabled)') || items()[0];
    if (on) on.focus({ preventScroll: true });
  }
  function close(focusBack) {
    if (list.hidden) return;
    list.hidden = true;
    document.removeEventListener('pointerdown', onPress, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', place);
    trigger.setAttribute('aria-expanded', 'false');
    if (focusBack) trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener('click', function () { if (list.hidden) open(); else close(true); });
  trigger.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b && !b.disabled) { close(true); choose(b); }
  });
  list.addEventListener('keydown', function (e) {
    var all = items(), i = all.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (e.key === 'Tab') { close(false); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) { close(true); choose(all[i]); } return; }
    var to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
    if (to === undefined || !all.length) return;
    e.preventDefault();
    all[Math.max(0, Math.min(all.length - 1, to))].focus();
  });
  return { open: open, close: close };
}

// one of many choices in little room: the button shows the choice
class MMSelect extends HTMLElement {
  static get observedAttributes() { return ['value']; }
  connectedCallback() { var self = this; setupWhenParsed(this, function () { self._setup(); }); }
  disconnectedCallback() { if (this._popup) this._popup.close(false); if (this._list) this._list.remove(); }
  attributeChangedCallback() { if (this._list) this._sync(); }
  get value() { return this.getAttribute('value'); }
  set value(v) { this.setAttribute('value', String(v)); }
  _options() { return Array.prototype.slice.call(this._list.children); }
  _valueOf(b) { return b.hasAttribute('value') ? b.getAttribute('value') : b.textContent.trim(); }
  _setup() {
    if (this._list) return;
    var self = this, id = 'mm-select-' + (++uid);
    var options = Array.prototype.filter.call(this.children, function (c) { return c.tagName === 'BUTTON'; });
    var trigger = document.createElement('button'), list = document.createElement('div');
    trigger.type = 'button';
    trigger.className = 'btn btn-sm select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', id);
    list.id = id;
    list.setAttribute('role', 'listbox');
    this._label = this.getAttribute('aria-label') || '';
    this.removeAttribute('aria-label');
    if (this._label) list.setAttribute('aria-label', this._label);
    options.forEach(function (b) { b.type = 'button'; b.setAttribute('role', 'option'); b.tabIndex = -1; list.appendChild(b); });
    this.appendChild(trigger);
    this._trigger = trigger;
    this._list = list;
    this._popup = popupList(trigger, list, function (b) { self._choose(b); });
    this._sync();
  }
  // the choice on the button, and marked in the list
  _sync() {
    var v = this.getAttribute('value'), self = this, on = null;
    this._options().forEach(function (b) {
      var is = self._valueOf(b) === v;
      b.setAttribute('aria-selected', String(is));
      if (is) on = b;
    });
    if (!on) return;
    this._trigger.innerHTML = on.innerHTML + CHEVRON;
    var name = on.getAttribute('aria-label') || on.textContent.trim();
    this._trigger.setAttribute('aria-label', (this._label ? this._label + ': ' : '') + name);
  }
  _choose(b) {
    var v = this._valueOf(b);
    if (v === this.getAttribute('value')) return;
    this.setAttribute('value', v);
    emit(this, { value: v });
  }
}

// a few actions in little room: the button (its content: the element's, an icon) opens them;
// el.items = [{ value, label (TeX allowed), disabled }]; one chosen sends change with its value
class MMMenu extends HTMLElement {
  connectedCallback() { var self = this; setupWhenParsed(this, function () { self._setup(); }); }
  disconnectedCallback() { if (this._popup) this._popup.close(false); if (this._list) this._list.remove(); }
  _setup() {
    if (this._list) return;
    var self = this, id = 'mm-menu-' + (++uid), trigger = document.createElement('button'), list = document.createElement('div');
    var label = this.getAttribute('aria-label') || '';
    this.removeAttribute('aria-label');
    trigger.type = 'button';
    trigger.className = 'btn btn-sm menu-trigger';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', id);
    list.id = id;
    trigger.setAttribute('aria-label', label);
    trigger.title = label;
    while (this.firstChild) trigger.appendChild(this.firstChild);
    trigger.insertAdjacentHTML('beforeend', CHEVRON);
    list.setAttribute('role', 'menu');
    list.setAttribute('aria-label', label);
    this.appendChild(trigger);
    this._list = list;
    this._popup = popupList(trigger, list, function (b) { emit(self, { value: b.value }); });
    if (this._items) this.items = this._items;
  }
  get items() { return this._items || []; }
  set items(list) {
    this._items = list;
    if (!this._list) return;
    var box = this._list;
    box.textContent = '';
    list.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = -1;
      b.value = it.value;
      b.disabled = !!it.disabled;
      if (window.MM && MM.setHTML) MM.setHTML(b, it.label); else b.textContent = it.label;
      box.appendChild(b);
    });
  }
}

if (window.customElements && !customElements.get('mm-seg')) {
  customElements.define('mm-seg', MMSeg);
  customElements.define('mm-tabs', MMTabs);
  customElements.define('mm-tab', MMTab);
  customElements.define('mm-slider', MMSlider);
  customElements.define('mm-toggle', MMToggle);
  customElements.define('mm-numbers', MMNumbers);
  customElements.define('mm-zoom', MMZoom);
  customElements.define('mm-select', MMSelect);
  customElements.define('mm-menu', MMMenu);
}
MM.enhance = enhance;
MM.formatNumber = formatNumber;
MM.parseNumbers = parseNumbers;
whenReady(function () { flushPending(); enhance(document); });
