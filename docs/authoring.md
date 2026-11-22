# Writing a page

A page is a folder `content/<slug>/`, published at `/<slug>/`. The slug is lowercase words joined by hyphens and should not change once published, since it is the page's URL.

```
content/root-systems/
  index.html    front matter, then the page's HTML
  style.css     styles for this page only (optional)
  main.js       the page's script (optional; any number of scripts)
  data.json     anything else the scripts fetch; every file is copied as-is
  thumb.html    the card image, drawn for card size (not published)
  thumb.png     the card and link-preview image, 1200×630 (npm run thumbs)
```

Start one with `npm run new -- <slug> "Title"`, or from an existing page with `npm run import` (see [porting-an-artifact.md](porting-an-artifact.md)). Then run `npm run dev` and open `http://localhost:8080/<slug>/`. The page rebuilds and reloads on every save. Build errors appear in the terminal and in a red box at the bottom of the page.

## Front matter

`index.html` starts with a YAML block between `---` lines:

```yaml
---
title: Configuration spaces of Rⁿ
heading: Configuration spaces of $\RR^n$
description: 'Drag $k$ points in $\RR^n$ and watch where the configuration lands in $\Conf_k$, $\Sym^k$ and $\Ran$.'
tags: [topology]
date: 2026-11-09
updated: 2026-12-01
katex_runtime: true
macros:
  \Conf: \operatorname{Conf}
styles: [style.css]
scripts: [main.js]
thumb:
  selector: "#shapecard"
  wait: 800
references:
  - key: lurie2017
    authors: J. Lurie
    title: Higher Algebra
    url: https://www.math.ias.edu/~lurie/papers/HA.pdf
    note: §5.5, factorization homology
---
```

| Key | Required | Meaning |
|---|---|---|
| `title` | yes | Plain text (Unicode is fine, no TeX or HTML). Used in the browser tab, link previews, the feed. |
| `heading` | no | The `<h1>` on the page and the title on cards. HTML and TeX allowed. Defaults to `title`. |
| `description` | yes | One or two sentences; TeX (`$…$`) is fine, HTML is not. Cards show it typeset; link previews, search results and the feed get a plain-text version (`$\RR^n$` becomes ℝⁿ). Put TeX in single quotes: inside double quotes YAML reads `\alpha` as an escape sequence, so the build rejects TeX there. |
| `tags` | yes | One or more tag slugs from `site/tags.yml`. Add a new tag there first (slug and `name`). |
| `date` | yes | Publication date, `YYYY-MM-DD`, used in the feed. |
| `updated` | no | Rarely needed: the page footer shows "Updated" with the day of the last commit that touched the page's folder (UTC), and the feed and topics sorted by update use it (see [Where it is listed](#where-it-is-listed)). Setting it overrides the commit date, whether earlier or later (for example, to leave the date alone after a small fix). |
| `draft` | no | `true` (a boolean: not `yes` or `"true"`) keeps the page out of `npm run build` (and so out of the deployed site); `npm run dev` still shows it, its card marked “Draft”. A draft is not validated in production builds, nor by `npm run check` and `npm run test:browser`: check one with `npm run check -- --drafts` and `MM_DRAFTS=1 npm run test:browser`. |
| `katex_runtime` | no | `true` loads KaTeX in the browser so scripts can typeset with `MM.tex` and friends. Not needed for TeX written in the HTML. |
| `macros` | no | TeX macros for this page only, added to `site/macros.tex`. Quote values in single quotes when they start with a special YAML character. A macro's `[n]` must match the highest `#n` its body uses. |
| `styles` | no | CSS files in the folder, linked in `<head>` in this order. |
| `scripts` | no | JS files in the folder, loaded at the end of `<body>` in this order. A `.mjs` file loads as a module. Full URLs are allowed but avoid them. |
| `image` | no | The card image file in the folder. Default `thumb.png`. |
| `thumb` | no | How `npm run thumbs` takes the image: `wait`, and, for a page without a `thumb.html`, `selector`, `click`, `trim` and `style` (see [Thumbnails](#thumbnails)). |
| `references` | no | List of `{key, title, authors?, url?, note?}`, in the order of the authors' surnames (the first author's, then the next; one author's works by year); `title` and `note` may contain TeX. Shown under the page, numbered in this order; the text cites each by its `key` (see [Citations](#citations)). |

Unknown keys and values of the wrong type (a date that does not exist, `draft: yes`, a reference without a title) are errors, so typos are caught. One page's errors do not stop the others from building.

## The page body

Everything after the front matter is placed inside `<main>`, after a header the layout draws (the topic chips and the `<h1>`, a link to the page itself without a link's parameters, to copy). Do not write your own `<h1>`, `<html>`, `<head>` or `<body>`, and do not link fonts or KaTeX: the layout does that.

The body runs edge to edge, so wrap content in `<div class="wrap">` (the site's column, 1200px wide with side gutters). A `.control-bar` can stay outside `.wrap`, so that its background spans the width. A typical outline:

```html
<div class="wrap">
  <p class="lede">What the reader will see and do, in one paragraph.</p>
</div>
<div class="control-bar"><div class="wrap">…controls…</div></div>
<div class="wrap section">
  <figure class="panel" id="figure">…</figure>
</div>
<div class="wrap section">
<div class="prose">
<section aria-labelledby="sec-what">
  <h2 class="section-title" id="sec-what">What is going on</h2>
  <p>…</p>
  <figure>
    <div class="fig-bar">…the figure's own controls…</div>
    <svg id="chart" role="img"></svg>
    <figcaption class="caption" id="chart-cap"></figcaption>
  </figure>
</section>
<section aria-labelledby="sec-more">…</section>
</div>
</div>
```

The theme spaces this out: the figure's section sits close under the control bar (a `.section` right after the bar), the sections of text are 40px apart, a figure among them has room above and below and its caption centred under it, and a `.fig-bar` centres the figure's own controls on it (above it, or under it with a little room). Give each section's heading an `id` (`sec-…`, which the readouts can link to) and the section `aria-labelledby` it. See [design.md](design.md) for the components.

In the text, a term is set in bold (`<strong>`) where it is defined, its words only, not its symbol (`the <strong>braid group</strong> $B_n$`), once on the page and never in the lede; and the name of one of the page's controls, where the text refers to it, is in italics, exactly as its label reads (`shown by <em>Colouring</em>`).

A figure with readouts beside it uses `.split`: one column on a phone, and from 900px the picture on the left and the readouts on the right. While longer readouts scroll, the picture stays in view under the control bar:

```html
<figure class="panel split my" id="figure">
  <div class="split-main my-main">
    <canvas class="split-fit" id="canvas" role="img" aria-label="…"></canvas>
    <p class="hint" id="hint">…</p>
  </div>
  <div class="split-side">
    <section class="side-block side-head" aria-labelledby="title">
      <h2 class="side-title" id="title">…the name… <span class="side-kind">…its kind…</span></h2>
      <p class="side-sub" id="sub">…a line about it…</p>
      <div class="legend" id="legend"></div>
    </section>
    <section class="side-block" aria-label="About it"><dl class="kv" id="about"></dl></section>
    <section class="side-block" aria-labelledby="sel-h">…more readouts…</section>
  </div>
</figure>
```

The readouts are blocks (`.side-block`) with a hairline between them. The first, `.side-head`, names what the picture shows: its title, a few grey words after it, a line under it, a slider or two for a number in the name (`<mm-slider plain>`, `.slider-pair`), and the legend. On a wide screen it has no rule above it, and nor has a block marked `.side-more`, which reads as the rest of the head (the description of the object, say). On a phone the readouts follow the picture, each block with its rule. To bring a block up under the picture there, make the columns one list in the page's CSS, below the theme's breakpoint, and order the blocks:

```css
@media (max-width: 899.98px) {
  .my > .split-main, .my > .split-side { display: contents; }
  .my .side-head { order: 1; }
  .my .side-block:not(.side-head) { order: 2; }
}
```

A second picture in the readouts that goes with the main one (a plane of values beside a plane of x) comes right under it on a phone, without a rule, before the head, so that both show in one screen while a handle is dragged; the main picture's legend stays under it, and the second picture may be a little smaller there for the two to fit: Stokes phenomenon, Configuration spaces, Picard–Lefschetz formula. Don't fold the head away instead: the legend is needed to read the picture.

Set the proportion of the columns on the page's class (`.my { --split-main: 1.25fr; }`, the readouts' column being `1fr`). `.split-fit` goes on the picture, or on the box that holds it and the handles placed over it: on a short window it narrows the picture so that the whole column shows under the control bar. Tell it the picture's shape with `--fit-ratio` (width over height, `1` by default) and the height of what follows it in the column with `--split-below` (64px by default). A picture column taller than the window anyway (two pictures, say) scrolls with the page.

When another page shows the same object (the same type of root system, say), a line under the panel leads there, to that object: `<p class="see-also" id="see-also" hidden></p>`, filled by the script, for example with `The same type in <a href="/dynkin-diagrams/?t=b2">Dynkin diagrams</a>.` The link uses the other page's own link parameters (see [Links, reset and images](#links-reset-and-images)); keep the line hidden when there is nowhere to go.

## Citations

The text cites a reference by its `key`, in square brackets, and the build numbers it by the reference's place in the list:

```html
<p>… gives the Jones polynomial [@jones1985].</p>          <!-- [9] -->
<p>… by the skein relation [@freyd1985; @przytycki1987].</p>  <!-- [7, 17] -->
<p>… Freudenthal's formula [@humphreys1972, §22.3].</p>     <!-- [3, §22.3] -->
```

- Several keys, separated by `;`, come out in order of number. A locator after a comma (`§22.3`, `Theorem 1.1`, `Ch. 7–8`) may contain TeX.
- Each number links to its entry in the list. Pointing at it, or focusing it, shows the reference in a small card; on a phone a tap shows the card, which links to the list. The space before the bracket becomes a no-break space.
- A key that is not in `references` is an error, and a reference that the text never cites is a warning: the list keeps only works the text cites.
- Text that a script writes may cite too: `MM.setHTML` numbers `[@key]` in the same way (see [From scripts](#from-scripts)). The build looks for `[@key]` in the page's scripts when it checks that every reference is cited.
- If a name matters to the sentence, write it: "as Conway showed [@conway1970]". Otherwise the number is enough.

## Controls

Use the shared components (see [design.md](design.md#components)) rather than building your own buttons, pickers or sliders: then they look and behave like every other page, and a restyle of the theme reaches them. In a new page, prefer the custom elements:

```html
<div class="control-bar"><div class="wrap">
  <div class="control"><span class="label">$n$</span>
    <mm-seg id="n" value="2" aria-label="dimension n">
      <button value="1">1</button><button value="2">2</button><button value="3">3</button>
    </mm-seg>
  </div>
  <mm-toggle id="arrows" pressed>Show the arrows</mm-toggle>
</div></div>
<mm-slider id="angle" min="0" max="360" step="1" value="0" unit="°">Rotate by $g$</mm-slider>
```

```js
document.getElementById('n').addEventListener('change', (e) => { state.n = +e.detail.value; draw(); });
document.getElementById('arrows').addEventListener('change', (e) => { state.arrows = e.detail.pressed; draw(); });
document.getElementById('angle').addEventListener('input', (e) => { state.angle = +e.target.value; draw(); });
```

`change` from `<mm-seg>` and `<mm-toggle>` bubbles, like an input's. `<mm-tabs>` sends a `change` that does not bubble, but its panels hold other controls whose events pass through it, so check the target:

```js
tabs.addEventListener('change', (e) => { if (e.target === tabs) show(e.detail.value); });
```

An `aria-label` or `aria-labelledby` on a custom element moves to the control inside it; give one when the visible text does not say what the control is.

Where a segmented control would have so many choices that the bar gets too long on a phone (Configuration spaces' nine spaces $X$), use `<mm-select>` instead: the same children and the same `change`, shown as a button with the choice that opens the list of them.

Where one kind of action has several targets (Configuration spaces' moves: which two points to swap, which point goes round which), use `<mm-menu>`: a button with the action's icon that opens the list of its targets, so that each action is a single choice, not a button and then a click on the picture. The page sets the list from its script, `el.items = [{ value, label, disabled }]` (labels may contain TeX), and keeps it current; choosing a target sends `change` with its value.

A value that a reader may want to give exactly, beyond what dragging reaches (a fractional weight, a level of $-4/3$), can also be typed, in the bar:

```html
<mm-numbers id="lam" value="2,1" min="0" max="20" integer aria-label="The highest weight lambda, by its coefficients">$\lambda$</mm-numbers>
<mm-slider id="level" exact min="-6" max="6" step="any" value="1">Level $k$</mm-slider>
```

`<mm-numbers>` is a few numbers in a box, typed as `2, 1` or `(1/3, −1/2)`. Once Enter or leaving the box gives valid ones it sends `change` with `e.detail.value`, an array; what breaks its `count`, `min`, `max` or `integer` is marked, not taken, and Escape goes back. Set `el.value` (an array) when the value changes otherwise, by dragging: the box follows unless the reader is typing in it. The page may refuse a value for a reason of its own with `e.preventDefault()` in its `change` listener. `exact` on a `<mm-slider>` (with `step="any"`) makes its value a box of the same kind; a typed value comes as a `change` with `e.detail = { value, exact: true }`, to be taken as it is rather than snapped. Both show fractions with a denominator up to 12 as fractions. A slider shows its value with the decimals of its step (two for `step="any"`), and its value keeps one width, enough for the longest value its range allows, so the track does not grow or shrink under the pointer; a page need not size it.

Markup with the theme's classes (`.seg` with `aria-checked` buttons, `.tabs`, `input[type=range]`) works too, and gets the sliding indicators and slider fill automatically; your script then handles clicks and sets the `aria-*` attributes itself. A group with `role="radiogroup"` or `role="tablist"` also gets the keyboard: it becomes a single tab stop, and the arrow keys, Home and End move to the next item and click it, so your click handler is all it needs. If your script handles one of those keys itself, it calls `preventDefault()` and the shared handling leaves that key alone. The build warns if your CSS restyles a component; set its tokens instead.

## Mathematics

### In the HTML

Write TeX directly in the page. The build renders it with KaTeX, so the published page contains finished HTML and needs no JavaScript for it.

| You write | You get |
|---|---|
| `$x^2$` or `\(x^2\)` | inline maths |
| `$$\sum_i a_i$$` or `\[\sum_i a_i\]` | display maths |
| `\$` | a literal dollar sign |

Rules:

- An inline `$` opens only if the next character is not a space, and closes only if the previous character is not a space and the next is not a digit. A dollar that is not maths should be written `\$`; an unmatched `$` is a build error, so a stray one is caught.
- Maths cannot run across a blank line.
- `<` inside maths is fine as is: `$a<b$`. `&lt;` also works.
- Punctuation straight after a short inline formula (`$\Ran$:`, `$x$.`) is kept on the same line as it; the formula itself may still break where KaTeX allows (after a relation or an operator).
- TeX is not rendered inside `<script>`, `<style>`, `<pre>`, `<code>`, `<textarea>`, `<svg>`, `<math>`, `<template>`, `<noscript>`, inside attributes, in HTML comments, or inside any element with a `data-notex` attribute or a `notex` class. Use those to show TeX source or dollar-heavy text.
- A TeX error stops the build with its file and line. KaTeX warnings (for example, Unicode letters in maths mode) are printed but do not stop it.
- A display that the text refers back to gets a number, `\tag{2}` at its end, and is cited as (2), so that a reader who starts in the middle can find what a formula is about. Number only displays that are referred to, in order down the page.
- `\mathbb{1}` gives 𝟙, and `\mathbb` of a capital Greek letter (which has no double-struck form) is set bold, as in new-banana. These rewrites also apply in the browser.

### Macros

`site/macros.tex` defines macros for every page (`\RR`, `\ZZ`, `\CC`, `\Hom`, `\Spec`, `\Sym`, `\colim`, `\abs`, …). It accepts `\newcommand`, `\renewcommand` and `\DeclareMathOperator(*)`. Add a macro there if more than one page will use it. Otherwise put it under `macros:` in the page's front matter.

### From scripts

Text that a script builds at runtime (captions, readouts, labels that change) cannot be rendered by the build. Set `katex_runtime: true` and use the runtime in `site.js`. It uses the same macros and the same delimiter rules as the build:

```js
MM.setHTML(el, `The stratum $\\Delta_{${i}${j}}$ has codimension $${n}$.`);  // most common
el.innerHTML = MM.rich(htmlWithDollars);   // the same thing, as a string
el.innerHTML = MM.tex('\\Conf_k(\\RR^n)'); // one expression, no delimiters
MM.tex('\\int_0^1', true);                 // display style
MM.renderMath(el);                          // render TeX already in el's text
```

In JavaScript strings every backslash is doubled (`'\\RR'`), or use `String.raw`: ``String.raw`$\RR^n$` ``. Recent results are cached (the last thousand formulas), so calling these on every frame is cheap.

- A matrix in a readout: `MM.matrix(box, rows, label)` puts its entries (TeX) in a grid between KaTeX's tall parentheses, as tall as the grid at any size (KaTeX's own `pmatrix` uses a fixed glyph for two rows, which looks out of place beside larger ones). It returns the grid; each cell is a `.mx-e` with `data-i` and `data-j`, and the class `is-lit` lights it (Dynkin diagrams lights the selected node's row and column).
- A small Dynkin diagram, as the lists of diagrams under a picture show them: `MM.dynkinPicture(svg, { pos, bonds, nodes })` draws it into an `<svg>` in `currentColor`, from the nodes' places on a grid and the bonds' lines, arrows and labels (see `site.js`; Dynkin diagrams and Root systems use it).
- Inside a button, tab, link, heading or label, `MM.setHTML` also gives each formula a plain-text name for screen readers (`$\RR^n$` is read as ℝⁿ). KaTeX hides its visible output from them, and some browsers then read nothing. So use `MM.setHTML` there, not `innerHTML = MM.tex(…)`. `MM.rich(html, { name: true })` does the same for a string.
- `MM.setHTML` and `MM.rich` also number citations, `[@key]`, as the build does ([Citations](#citations)).
- `MM.setHTML` leaves an element alone when it is given the HTML it last wrote there (and the element still holds it), and returns whether it wrote. So a readout may be set on every frame: it costs nothing, and a live region speaks only when its text changes.
- The rows of a `<dl class="kv">` readout: `MM.kv(dl, [[term, html], …])`, by `MM.setHTML` (a falsy row is left out).
- `MM.renderMath(el)` changes only the text that contains TeX, so the controls, listeners and state inside `el` survive. A formula must lie within one run of text, not across tags.
- KaTeX's output does not take `text-decoration`: to underline clickable maths (a dotted line under a formula that does something when clicked), give the element a `border-bottom` instead.
- A subscript of more than one character needs braces: the knot 9₂₅ is `9_{25}` in TeX, while `9_25` gives 9 with 2 below, then 5.

### In figures

KaTeX cannot draw into SVG `<text>` or onto a canvas, so figure labels have their own typesetter, which uses KaTeX's glyphs (the "MM Math" label font) and TeX's maths-mode rules. A label is words with `$…$` maths:

```js
MM.canvasLabel(ctx, 'nearest pair: $x_1, x_2$', x, y, { size: 12, align: 'center', baseline: 'middle', color: MM.color('ink-2') });
MM.svgLabel(textEl, '$S_{\\mathrm{reg}}$');          // fills an SVG <text> with tspans
const w = MM.measureLabel(ctx, label, 12);           // width in px, e.g. for a background box
MM.onFonts(draw);                                    // canvases: redraw once the fonts have loaded
```

The maths is a one-line subset of TeX:

- `_` and `^` (with `{…}`; a subscript and a superscript on one letter sit side by side), `\mathrm`, `\mathit`, `\operatorname`, `\text`, `\mathfrak`, `\mathbb`, `\mathcal`, `\mathbf`;
- `\frac{a}{b}` (set as a/b), `\sqrt` (√x), accents (`\bar`, `\hat`, `\tilde`, `\vec`, `\dot`, …) and primes (`f'`);
- Greek letters, common symbols (`\to`, `\in`, `\cong`, `\oplus`, `\colon`, …), spacing (`\,`, `\quad`), and the site's and the page's macros (`\RR`, `\Hom`, `\abs`);
- operator names (`\det`, `\sin`, `\lim`, …), set upright. For any other, write `\operatorname{tr}`; a command labels do not know is set the same way, with a warning in the console. `\left`, `\right` and `\big` are ignored.

Unicode works as well. Malformed TeX in a label (`$x^$`) does not throw: the label is drawn as plain text and the console says why. Screen readers read a label's text as drawn. A plain SVG `<text>` with Unicode (`ℝⁿ`, `Σ₃`, `𝔩`) is already in the label font; add `font-style: italic` for variables. For a long formula in a figure, an HTML element placed over the figure and filled with `MM.setHTML` is still an option.

### Complex functions

A complex function is drawn as the site draws them all (Stokes phenomenon: the integral as a function of $\hbar$, Airy's function in the plane of $z$): by its phase, a colour from a wheel of the theme's colours, with thin lines of constant phase and of constant modulus, a grid of small squares since $\log f$ is holomorphic, faded out where its lines would crowd and broken where the function jumps. The page works out the phase and the log of the modulus at each pixel of an `ImageData` the size of the canvas's backing store, and `MM.phase.paint` colours it:

```js
const { ctx, w: W, h: H, dpr } = MM.fitCanvas(canvas), w = Math.round(W * dpr), h = Math.round(H * dpr);
const ph = new Float32Array(w * h), lm = new Float32Array(w * h), kind = new Uint8Array(w * h);
for (let q = 0; q < w * h; q++) {
  const z = /* the point of pixel q */;
  if (/* outside the region */) continue;               // kind 0: painted o.none
  ph[q] = /* arg f(z) */; lm[q] = /* log |f(z)| */; kind[q] = 1;   // 2: the same, pale
}
const img = MM.phase.paint(new ImageData(w, h), { w, h, dpr, ph, lm, kind, step: Math.PI / 12, none: null });
// put img on an offscreen canvas of w × h and drawImage it at W × H
```

- `shade` (a `Float32Array`, 1 for none) darkens pixels, for example near the zeros of a sum whose terms cancel there. Shade by something that does not jump where the function does not: a measure of cancellation among terms that jump makes a seam the function does not have.
- `step` is the spacing of the lines in both phase and log modulus (π/12; π/6 where the phase turns fast across the picture). `pale` (0.4) is how far a `kind` 2 pixel goes to the ground: a term of an expansion shown where it is not part of it.
- `pixels` (an array of pixel indices), or `only(q)`, limits the pixels painted, to paint again only what changed (the integral as a function of ħ keeps a list of the pixels of each of its rows, and paints again the rows the cut has passed as ħ turns).
- A picture that takes long to compute is painted coarse first and sharpened: at most at twice the CSS resolution (a phone's 3× costs more than twice as much and shows little more), at the CSS resolution while a zoom or a drag that changes the whole picture lasts, and worked out coarse to fine (every 8th row first, each row not yet worked out painted from the nearest that is), as the integral as a function of ħ is.
- `MM.phase.color(ph)` is the colour of one phase (`[r, g, b]`), for a picture shaded in its own way (the Borel plane), and `MM.phase.key(ctx, x, y, r)` draws the key, a ring of the colours with $1$, $\mathrm i$, $-1$, $-\mathrm i$, in a corner of every such picture.

Over a disc, a multivalued function is drawn continued the short way round from a direction (a parameter's handle, or a knob of the angle): `const fade = MM.phase.cut(ctx, cx, cy, angle, width)` for the ray opposite it, where the two ways round meet and do not agree. `fade.veil(r)` whitens the disc towards it (a white fade, not a line: it is no jump of the function; `fade.veil(r, r0)` only the ring from `r0`), `fade.faded(draw, r0, r1)` draws `draw(ctx)` faded out with it between radii `r0` and `r1` (the arcs round the rim), and `fade.seen(t)` is how much shows at angle `t`. They use a mask drawn once for each size and turned to the cut, not a conic gradient, which Firefox on Android draws in broken pieces: keep `createConicGradient` out of the pages. `MM.phase.mark(ctx, cx, cy, r, angle, alpha)` is a red mark on the rim (a Stokes ray), and `MM.phase.knob(ctx, cx, cy, r0, r1, angle)` the knob of an angle at radius `r1`, with a thin line in from it to `r0`; the page drags it (a press outside the disc) and turns it with the arrow keys. Angles are counterclockwise, with $y$ up. The gallery at `/components/` shows both.

## Scripts

- Scripts load at the end of `<body>`, after `site.js`, so the DOM and `window.MM` are ready. Wrap a classic script in an IIFE, or use a `.mjs` module.
- Read colours from the theme with `MM.color('c1')`, `MM.rgba('ink', .3)` and `MM.font('serif', 14, 600)`. Never hard-code hex values or font names (see [design.md](design.md)). A misspelt name gives a warning in the console. Colours are cached: a page that changes a colour token on `body` or `:root` calls `MM.color.clear()` afterwards, and one that sets tokens on its own element passes that element, as in `MM.color('pt-1', fig)`.
- On a touch screen a finger moves a picture's value only from a handle, and elsewhere scrolls the page (see design.md, *Touch*). In practice:
  - give `.draggable` (`touch-action: none`) to the handles, never to the whole picture: a picture that is `.draggable` all over cannot be scrolled past on a phone;
  - a handle that a canvas draws (a knob, a point) gets a transparent box over it that takes the finger: a `<div class="handle draggable" aria-hidden="true">` in the picture's positioned box, moved onto the handle by the script whenever it is drawn (Stokes phenomenon, `touchBox`);
  - the picture's `pointerdown` returns for `e.pointerType === 'touch'` unless the press is on a handle; test with `handleEl.contains(e.target)`, since `MM.handle` draws its dot inside the element;
  - keep the offset between the press and the handle's point, and take it off every move, so that the value does not jump to the finger;
  - zoom with `MM.pinchZoom`, which leaves one finger to the page;
  - try it on a phone, or in Playwright with `hasTouch` and CDP `Input.dispatchTouchEvent`: a tap and a swipe on the picture must leave its value alone and the swipe must scroll the page (`scrollY`), and a drag from each handle must move it.
- An element that is dragged (a canvas, an SVG) needs `touch-action: none`, so that a swipe on it moves the point instead of scrolling the page. Give it the class `draggable` (which also shows the grab cursor), or set it in your CSS. Set it only on what is dragged, so the page still scrolls everywhere else. A shape inside an SVG (a node, a strand, a handle) must have the class: browsers ignore `touch-action` on such shapes, and a picture drawn afresh during a drag removes the shape touched, so site.js stops the page scrolling from a touch that starts on a `.draggable` element itself.
- A 3D picture that turns under a drag uses `MM.turnDrag(el, { when, start, move, end, keys })` (see `site/assets/js/site.js`): on a touch screen a drag that starts sideways turns the picture to its end, and one that starts up or down scrolls the page. While it turns (`when()`, asked once the page's script has run), the element has the class `.turnable`, which gives it `touch-action: pan-y` and the grab cursor; a picture that turns only sometimes (in space, not in the plane) calls `drag.update()` after a change that changes `when()`'s answer. Its `moved` tells a click from the end of a drag. `keys: { turn(a, b), home() }` turns it from the keyboard as a drag would: the arrow keys by 6° (1° with Shift), `a` for Left and Right and `b` for Up and Down, in radians, Down positive as a drag down; Home calls `home()`, if given. It serves as well for a small element dragged sideways, such as a term of a formula that a drag changes (Amoebas): a mouse is held from the press, so a quick drag off the element still reaches it.
- A flat picture that a mouse drag of the page's own moves (a finger scrolls the page instead) has the class `.pannable`, and `.is-panning` while it moves: the grab cursor, grabbing.
- The handle of a picture is `MM.handle(el)`: into a `<div class="handle draggable" role="slider" tabindex="0">` over the picture, placed by your script with a transform, it draws a yellow dot, ringed, and the ring of its keyboard focus; `MM.handle(g, r)` draws the same into an SVG group, the dot of radius `r`. Points of the figure that are themselves handles (the points of a configuration) are `<circle class="handle-point">`, with their number in a `<text class="handle-num">`. In an SVG, a shape the keyboard focuses draws its focus as a `.focus-ring` (a circle or a rounded rect round it, in the focusable group).
- A strip of small pictures to choose from under the picture is a `.strip-block`: a `.strip-head` with its label and a segmented control of the families, then a `<div class="strip" role="toolbar">` of `.strip-group` groups (each with a `data-family`, if there are families), of `<button class="strip-item">` items, an `<svg>` and a `.strip-name` each. `const strip = MM.strip(el, { control, pick(item) })` makes it one stop for Tab with the arrow keys, Home and End along it, shows the family chosen in `control`, and calls `pick` on a click; `strip.light(item)` marks the item shown pressed, shows its family and brings it into view.
- A picture that zooms does it with `<mm-zoom>` in the control bar (a slider for a mouse, hidden on a touch screen) and `MM.pinchZoom(el, { zoom(f, x, y), pan(dx, dy), end })` on the picture (two fingers, or a pinch on a trackpad), both into one function of the page that zooms by `f` about the point `(x, y)` (CSS pixels from the element's corner), keeping that point where it is. `el.value` of the slider is a magnification between its `min` and `max`: map it to the page's own measure of the window (Amoebas: the magnification m, from 1 to 28, is the half-width 14/m; Root systems sets `max` for the plane in view), set it whenever the window changes otherwise, and zoom about the middle on its `input`. It gives the element the class `.zoomable`, with `touch-action: pan-y` (one finger still scrolls the page). Keys + and − on a focused picture may zoom too.
- A figure in the text must not change the main picture unseen. Where dragging or clicking it changes what the main picture shows (a height, a parameter, the configuration), it is the first child of a `.fig-pair`, and the second is a `<div class="fig-copy" aria-label="…">`: `const copy = MM.copyPicture(box, [canvas, svg])` keeps in it a small copy of the main picture's layers, one over another as on the page (an SVG, which needs an id, is copied live by `<use>`; call `copy()` after drawing a canvas). A page may draw the copy itself instead, leaving out what is too small to read at that size (Amoebas). Show it only while the figure does change the main picture (Hilbert schemes: while there is a triple point for the disc to change).
- Size canvases with `MM.fitCanvas(canvas)` (see the template from `npm run new`): it makes the backing store the size of the CSS box at `MM.pixelRatio()`, not `devicePixelRatio`, empties it and sets the context to draw in CSS pixels, and returns `{ w, h, dpr, ctx }`; `MM.fitCanvas(canvas, w, h)` sizes it to `w × h` CSS pixels instead. Redraw on resize with a `ResizeObserver`. Save image raises `MM.pixelRatio()` for a moment to draw the figure at the size of the image. `MM.clearCanvas(ctx, color)` clears every pixel of a canvas (the backing store may reach a fraction of a CSS pixel beyond the drawing), and fills it with `color` if given.
- Elements of an SVG drawn from a script: `MM.svg(tag, attrs, parent)` makes one with those attributes, appended to `parent` if given (a page may keep a short name for it, `const el = MM.svg`).
- Respect `prefers-reduced-motion`: start auto-rotation and other animations paused when it is set. `MM.reduceMotion()` says whether it is, as it is now.
- Undo and Redo: the page keeps its own history, and `const undoButtons = MM.undoRedo({ undo, redo, canUndo, canRedo })` wires the buttons `#undo` and `#redo` (in the bar, `disabled` in the HTML) and the keys Ctrl+Z (⌘Z on a Mac), Shift+Ctrl+Z (⇧⌘Z) and Ctrl+Y, everywhere but in a text field (a slider is not one) and not for a key a handler before has taken (`preventDefault()`). Call `undoButtons.update()` after every change, to enable the buttons as `canUndo()` and `canRedo()` say, and keep a change with `undoButtons.keep(list, entry)`, which forgets the oldest beyond 200.
- An animation that runs on its own (a picture turning, paths fading) rests while it cannot be seen: `const seen = MM.whenVisible([el1, el2], (on) => { … })` calls back when the last of the elements leaves the view (or the tab is hidden, or a dialog such as Save image is open over the page) and when one comes back, and `seen()` says which; the frame loop asks `seen()` before asking for the next frame. Time that ages things (a path fading, a move playing) should stop with it: Configuration spaces keeps a clock of its own that stands still while the figure rests.
- Large computed data belongs in its own file (`data.json` fetched with `fetch('data.json')`, or `data.js` that sets a global), not in `index.html`. Prefer committing the script that generates it next to it, for example `generate.py`. Every file in the folder is published, so keep private files elsewhere.
- Work that can take more than a frame or two (a search, a count that grows quickly with the input) goes to a Web Worker, so that drags and turning pictures never stall: a file in the folder, left out of `scripts`, started with `new Worker('worker.js')`, which loads the page's own mathematics with `importScripts('knots.js')` (a module that sets a global on `globalThis` works there unchanged). End a worker that is still busy when its answer is no longer wanted, and start another. Knots works out hyperbolic volumes this way (`content/knots/worker.js`).

## Links, reset and images

Every page has a button at the end of its control bar, a menu with **Copy link**, **Save image** and **Reset**, and beside it, while the first of the page's `pictures()` is out of view, a button that goes back to it (**Go to the picture**). The page tells `MM.example` (in `site/assets/js/example.js`, loaded on every content page) what its example is, once its figure is drawn:

```js
let example = null;
// … at the end of draw(): if (example) example.changed();
example = MM.example({
  fields: { t: 'text', n: 'numbers', v: 'rotation', z: 'int' },
  view: ['v', 'z'],
  get: () => ({ t: state.type, n: state.handle, v: state.turn, z: state.zoom }),
  set(x, named) {
    if (!TYPES[x.t] || (named.has('n') && x.n.length !== TYPES[x.t].rank)) return false;
    chooseType(x.t);                  // as the controls would, which resets the rest
    if (named.has('n')) state.handle = x.n;
    state.turn = x.v;
    state.zoom = x.z;
    draw();
  },
  pictures: () => [{ label: 'Roots', element: $('plane') }, { label: 'Dynkin diagram', element: $('dynkin'), selected: false }],
  redraw: resize,
  scene: { get: () => ({ sel: state.sel }), set(s) { state.sel = s.sel; draw(); } },
});
```

- **`fields`**: the link's parameters, one or two lowercase letters each, and how each value is written. The codecs are `text` (a name: letters, digits, `-` and `.`), `flag` (`0` or `1`), `int`, `number` and `numbers` (four decimals, or a fraction such as `-4/3` where decimals would not be exact; `MM.example.numbers(3)` for three decimals), `rotation` (a rotation of space, as the four numbers of a unit quaternion) and `cartan` (a generalised Cartan matrix: its size, then its bonds, `4.01.12.23`). A codec of the page's own is an object `{ write(value) → text, read(text) → value }`, whose `read` throws on text it cannot read.
- **`get()`** returns the example in view, field by field. A link names only the fields that differ from the page's own example (as `get()` gave it when the page opened), so the page's own example has the plain address and others stay short: `/root-systems/?t=b2&n=0.1736,0.9848`. A field that does not apply to the example in view returns the page's own value for it, and is left out.
- **`set(values, named)`** shows an example, as a reader choosing it with the controls would get it: every field is given, those the link names and, for the rest, the page's own example's values. `named` is the set of fields the link names (all of them for Reset). A field whose default depends on another (where a type's handle starts) takes that default when it is not named, so that `/root-systems/?t=b3` shows B₃ as choosing it from the bar would. Check what the link says and return `false` if it cannot be shown: the page then shows its own example and drops the parameters.
- **`view`**: the fields that only turn, pan or zoom the picture.
- **`pictures()`**: what Save image offers, `{ label, element, selected }`: a canvas, an SVG, or a box holding canvases and SVGs (handles over a canvas, say); `selected: false` for a picture offered but not chosen at first. Offer every figure on the page, those in the text after the panel too (the main picture first, chosen; the rest not). Only canvases and SVGs come out in the image, so text that belongs to a figure is drawn in its SVG (`MM.svgLabel`), and HTML in the box (a name, a button's icon) is left out of it or hidden while the dialog is open (`html.is-dialog-open`). A figure drawn only while it is in view is drawn when the dialog opens (it announces `mm:dialog`) and on every draw while it is open, since the hidden frame scrolls to none of them. Handles (inside `[role="slider"]`) are left out of the image unless the reader asks for them with Show handle; a mark that is part of the picture, such as a weight on a dial, is not a slider, so that it is always drawn.
- **`redraw(options)`** draws every canvas afresh at once, at `MM.pixelRatio()`: usually the page's resize function. With `options.handles === false` it leaves out what belongs to the handles on the canvas too (Root systems' stem from the origin to its handle).
- **`scene`** (optional), `{ get(), set(s) }`: what the pictures show that the link does not name, for Save image, which draws in a hidden copy of the page given the example by its fields (below). `get()` returns it as plain data (it goes through JSON); `set(s)` is called in the copy after `set()`, and shows it and draws. Hand over what stays on the picture until the reader changes it: a selected root, the loops of a group's generators (Knots), the trails of moving points, with times as ages since the copy's clock is not the page's (Configuration spaces), a drawn curve exactly where the link rounds it. Leave out what is there only while the pointer is (a hover).
- Call **`example.changed()`** after every change of the example; the end of `draw()` is the place.

The address bar never changes while the reader explores. A page opened from a link keeps the link in the address bar, so that reloading keeps the example, until the reader changes the example, or moves the picture away from the view the link names: a change of the `view` fields counts once the reader has let go of the drag, pinch or zoom that made it (`MM.moved()`, which `MM.turnDrag` (its drags and its `keys`), `MM.pinchZoom` and `<mm-zoom>` call themselves; a page calls it after its own view controls, keys and buttons). The picture turning on its own does not count. Reset goes back to the page's own example, wherever the page was opened.

Save image draws the chosen pictures on a white ground, side by side or one above another, at their sizes in the page's widest layout (see Zoom) and at a fixed **resolution**: 1×, 1.5×, 2× or 3×, where 1× is 2 pixels in the image for each CSS pixel (as most phones show them), so a small diagram makes a small image and a large figure a large one; resolutions the browser cannot draw are not offered. A preview shows the image itself. **Zoom** (100% to 200%, 150% at first) does not depend on the reader's window. Save image draws the pictures in a hidden frame the size of a large window (1280 × 1000), showing the same example, so the page has its widest layout there whatever the window, a phone's included. 100% draws the figure at its width there, and 200% narrows the box that holds the pictures (the figure) to half that width, waits two frames for the page to lay them out, and draws them. The frame's `example.js` sets the example as it is on the page (from the link's fields, then the page's `scene`), rests the animations, and does nothing else; the page itself is not touched, and the frame goes when the dialog closes. If the frame does not come up, or shows other pictures than the page, the image is drawn on the page instead, from the figure's width there, behind a still copy of the figure. A picture that fills its column narrows with it, while its labels, dots and lines keep their size, so they come out larger beside it; a picture of a fixed size, such as a small Dynkin diagram, keeps its size, and so comes out larger with them. For that, a picture takes its layout from its box, as a canvas sized in a `ResizeObserver` does. While the dialog is open the page's animations rest (`MM.whenVisible` reports the pictures unseen), so that the image is the picture as it was when the dialog opened. The saved PNG carries the page's title and the link to the example in its metadata, and nothing on the picture.

## Thumbnails

The card image, `thumb.png` (1200×630), is shown on the home page about 365 pixels wide, and on a phone about 300: a third or a quarter of its size. A line 2 pixels wide there is half a pixel, and a 13-pixel label is 4. So a picture of the page's figure, shrunk, comes out grey and unreadable. Draw the card image for that size instead, as `thumb.html` in the page's folder, and `npm run thumbs -- <slug>` photographs it. Run it after any change to the picture, and commit the PNG. The first run needs a browser download: `npx playwright install chromium`.

### Designing it

Think of a video thumbnail: one picture that can be read at a glance at a quarter of its size, and that shows what the reader will find.

- **Only what the page draws.** The figure as the page draws it, with its own elements, colours and conventions (filled and hollow dots, the yellow handle, its colour names from its `style.css`), on `--paper`. Leave out what would be too small to read, such as most names; add nothing the page does not have: no colour codes of your own, no titles, no decoration, no frame (the card draws one).
- **One subject, large.** One figure filling most of the height, or two side by side of about the same size, as in Dynkin diagrams; not a panel with its controls.
- **A simple case.** The page's first view, or a simpler case of it: a dozen points read at card size where a hundred turn into texture.
- **Marks a little heavier than the page's.** In the 1200×630 image, main lines 3–5 pixels and faint ones 2–3, dots of radius 11–13, a handle of radius about 22, labels of 34–44 pixels, and only a few of them ($\alpha_1$, $\lambda$). Heavier than that and the picture shouts.
- **Room at the edges.** Keep the subject about 40 pixels in from the edges: the card's corners are rounded and its picture zooms a little on hover.

### Writing thumb.html

`thumb.html` is the body of a page exactly 1200×630 CSS pixels, with the theme, the runtime (`MM.color`, `MM.canvasLabel`, `MM.onFonts`, …), the page's stylesheets and its macros, so its colour names and labels work as on the page. It is never published. Load the page's own mathematics with a relative `<script src>`, so that the picture is computed, not copied, and draw on a canvas from `MMThumb.canvas()`, which fills the image at the device's pixel ratio and returns its context in CSS pixels (`MMThumb.W` by `MMThumb.H`):

```html
<script src="roots.js"></script>
<script>
(function () {
  const cx = MMThumb.canvas();
  function draw() {
    cx.clearRect(0, 0, MMThumb.W, MMThumb.H);
    cx.fillStyle = MM.color('root-real');
    // …
    MM.canvasLabel(cx, '$\\alpha_1$', 700, 300, { size: 54, color: MM.color('ink') });
  }
  MM.onFonts(draw);
})();
</script>
```

While you work on it, `npm run dev` serves it at `http://localhost:8080/<slug>/thumb.html`, reloading on every save. `npm run thumbs` photographs it at twice the size and halves it, after `thumb.wait` milliseconds (default 300); a script error stops it, and the old image is kept. Each page's `thumb.html` is an example.

### Without thumb.html

A page without `thumb.html` (a draft, say) gets a picture of its page instead: `npm run thumbs` opens the page at 1280×900, captures an element, and centres it on the page background. The `thumb` keys say how:

| Key | Meaning |
|---|---|
| `selector` | The element to capture; default the first `figure`, `canvas` or `svg`. A list of selectors captures each and sets them side by side, in order and at the scale they have on the page. |
| `click` | Selectors to click first, in order: a preset, a tab, a control. |
| `wait` | Milliseconds to wait after load and the clicks, before the capture; default 600 (300 for `thumb.html`). |
| `trim` | `true` crops each capture to what is drawn in it: the margin that has the colour of its top-left corner is left out. |
| `style` | CSS added to the page before the capture, for the picture only: for example, to hide a frame that `trim` would otherwise keep. |

## Where it is listed

The home page has a row of cards for each topic, and a card appears in the row of each of its topics; the topic pages (`/tags/<slug>/`) list the same cards in the same order. `site/order.yml` sets the order of the topics, and of the pages in each:

```yaml
sort: listed            # or updated
topics:
  algebraic-geometry: [amoebas, hilbert-schemes]
  representation-theory: [root-systems, dynkin-diagrams, highest-weight-representations]
  number-theory: { pages: [primes], sort: updated }
```

- Topics come in the order of `topics`; a topic left out comes after them, in the order of `site/tags.yml`.
- `sort: listed` (the default) shows a topic's pages in the order listed under it, and any it does not list after them, most recently updated first. `sort: updated` shows them most recently updated first. Set `sort` at the top for every topic, or beside a topic's `pages` for that topic alone.
- When you add a page to a topic that lists its pages, add it to the list too; the build warns about one left out, and about a listed name that is not a page or not in that topic.

## Checklist before publishing

- [ ] `title`, `description`, `tags`, `date`, `references` filled in, every reference cited as `[@key]`; `draft` removed
- [ ] `npm run check` passes with no warnings for this page (`npm run check -- --drafts` while it is a draft)
- [ ] Works at phone width (375px) and on touch: no sideways scrolling, controls reachable, the page scrolls except on what is dragged
- [ ] Works from the keyboard: every control reachable with Tab, groups with the arrow keys, and every control named (a button that shows only maths still has a name)
- [ ] `MM.example` set up: Copy link brings the example back, and Save image offers the page's pictures and draws them as the page shows them (anything the link does not name goes in `scene`); `npm run test:browser` passes (it tries every page, and with `MM_DRAFTS=1` the drafts; add a change of yours to `CHANGES` in `browser-tests/pages.test.mjs` to try its links)
- [ ] No hard-coded colours or fonts; nothing animates under reduced motion
- [ ] a `thumb.html` drawn for card size, and `thumb.png` up to date
- [ ] placed in its topics' lists in `site/order.yml`
