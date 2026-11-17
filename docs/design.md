# Design

All pages share one look: a white page, Inter for all text, KaTeX's Computer Modern for all mathematics (formulas and figure labels alike), two accents (blue for "selected", yellow for "a handle you can move"), a red for marks, and one sequence of data colours, which begins with the blue. `site/assets/css/theme.css` defines the tokens and components below and is loaded on every page. A page's own `style.css` should contain only layout and figure styling specific to that page, written with these tokens.

`npm run dev` also serves a gallery of every token and component at <http://localhost:8080/components/> (`site/pages/components.html`, built only in development). Check a restyle there.

**Never hard-code a colour or a font name**, in CSS or in JavaScript. If the theme lacks something you need, add a token or component to `theme.css` rather than working around it, so the next page can use it too.

## Principles

The site should look edited, not generated. Most of that comes from restraint:

- **Fewer boxes.** Use whitespace and a hairline (`--rule-2`) to separate things before reaching for a bordered panel. Do not nest panels. A panel is for a figure with its own controls, not for every paragraph.
- **Sentence case everywhere.** No letter-spaced capitals for labels, column heads, tab names or diagram headings. A small label is 13px Inter, weight 500, in `--ink-3`.
- **Colour means something.** Text and chrome are ink on white; the accent marks links, focus and the selected state; data colours belong to the mathematics in the figures. Avoid tinted callout boxes and coloured left borders. A `.note` is a light grey block.
- **One way to show "selected".** Buttons and cards that are on use the blue accent (`--accent-ink` text, `--accent` border, `--accent-soft` ground); tabs slide a blue underline over their grey rule. A segmented control is the quiet exception: a white indicator, with a soft shadow, slides to the chosen segment on its grey track. Avoid black filled pills.
- **Yellow means "you can move this".** Slider thumbs, the logo's control point and, in figures, draggable handles (`--handle`). Never use it for text.
- **Quiet controls.** Controls should recede until used: light tracks, hairline buttons, short transitions (about 150ms). They answer the pointer quietly too: a grey wash under a segment, a grey underline under a tab, a pale teal halo round a toggle's box or a slider's thumb.
- **Type does the hierarchy.** Size and weight, not colour or ornament, should tell headings from text. Keep to the scale below.
- **No decoration for its own sake**: no gradients, glows, emoji, icons in front of headings, or check marks used as bullet points.

## Tokens

### Surfaces and ink

| Token | Use |
|---|---|
| `--paper` | page background (white) |
| `--surface` | panels, figures, controls (white) |
| `--sunken` | segmented-control tracks, readouts, notes, hover backgrounds |
| `--ink` | body text, strong strokes |
| `--ink-2` | secondary text |
| `--ink-3` | captions, labels, axes, faint strokes (4.5:1 on `--sunken`, so small text in it stays readable) |
| `--rule` | borders and dividers |
| `--rule-2` | faint dividers, grid lines, section separators |
| `--accent`, `--accent-soft` | primary accent, a blue of hue 202 (`#197eb8`): the selected state, focus rings, slider fills, the logo |
| `--accent-ink` | the same blue, dark enough for text (`#126291`, 6.6:1 on white): links, selected text |
| `--accent-2`, `--accent-2-strong`, `--accent-2-soft` | secondary accent, yellow (`#f2b51e`): handles you can move (slider thumbs, the logo's control point), the text selection; `-strong` for its outline |
| `--handle` | the colour of a draggable point in a figure (yellow), for pages that want one |

### Data colours

Eight categorical colours, `--c1` … `--c8`, in the order a figure takes them: a figure that needs n colours uses `--c1` … `--cn`. The first is the blue accent (`--c1` is `var(--accent)`). Neither yellow (the handle, `--accent-2`) nor red (the mark, `--red`) is among them, so a figure's data never looks like a handle or a mark.

| | | | |
|---|---|---|---|
| `--c1` blue `#197eb8` | `--c2` orange `#d7822c` | `--c3` green `#4f9e57` | `--c4` purple `#956bcc` |
| `--c5` magenta `#d369ac` | `--c6` teal `#4fa3a0` | `--c7` olive `#a49b3d` | `--c8` brown `#a07054` |

Each comes in four forms:

| | |
|---|---|
| `--cN` | the colour: fills, dots, regions, single lines of 2px or more |
| `--cN-soft` | pale, for grounds and fills under a line (`.swatch`) |
| `--cN-line` | the colour with 10% white: flat thick lines in several colours at once that a reader must tell apart, such as a link's strands (Knots), the curves of an ideal's generators (Hilbert schemes) or the strands of a braid in the plane (Configuration spaces). A 3D picture that pales its lines with depth (a tube, a curve in space) starts from `--cN` itself |
| `--cN-text` | a shade darker (OKLCH lightness 0.04 less, the saturation kept), for text and thin lines in the colour (a formula in the colour of its curve, a dashed outline): 3.3:1 to 5.3:1 on white, for formulas and labels of 15px or more |

- Use them in order unless the meaning suggests otherwise, and keep the same meaning for the same colour throughout a page and, for the same object, across pages (the components of a link, the generators of an ideal and the strands of a braid all go blue, orange, green, …).
- The colours themselves are light (orange 3:1 on white): write text in `--cN-text`, which keeps their saturation (darkening by mixing in ink turns them grey). `.dot` and `.swatch` draw a slightly darker rim, so a light one still shows on white.
- When a page needs more than eight colours, use a neutral (`--ink-2`) for the least important class rather than yellow or red.
- In a figure where blue already means "selected", start the data colours at `--c3` (then `--c2`, `--c4`, …).
- Give each colour a meaningful name in your page's CSS, on `body` (the page's stylesheet only loads on that page), so the code reads well and remapping is one line. Scripts then read the same names with `MM.color('pt-1')`; there is no need to repeat the mapping in JavaScript:
  ```css
  body { --pt-1: var(--c2); --pt-2: var(--c1); --stratum-double: var(--c4); }
  ```
  (`MM.color(name, el)` also reads names defined on any other element `el`.)
- `--highlight` (= `--red`, with `--red-soft` for a ground) marks the thing that is hovered, picked or being explained. `--good` (green) and `--bad` (red) mark right and wrong.
- Do not rely on colour alone: pair it with a label, a shape or a dash pattern where a reader must tell items apart.
- The utility classes `.c1` … `.c8` set `--c` and `--c-soft` on an element, for the components that use them (`.dot`, `.swatch`, `.badge`, `.note`).

### Type

| Token | Font | Use |
|---|---|---|
| `--sans` | Inter (variable, with optical sizes) | all text: headings, body, captions, interface, cards |
| `--math` | "MM Math", the label font: KaTeX's own glyphs (see below) | mathematics outside KaTeX: labels in SVG figures and on canvases |
| `--serif` | the same as `--math` | an older name for it; use `--math` in new code |
| `--mono` | IBM Plex Mono | numbers that change (coordinates, counts), code |

All the fonts are served with the site (`site/assets/fonts/`, with their licences): a page asks no other server for anything. Inter is its Latin subset; a character outside it (Greek in running text) falls back to the label font, which has KaTeX's glyphs.

Formulas are KaTeX at 1.1em of the surrounding Inter, with fraction rules and radicals thickened a little to match Inter's strokes (as in new-banana). `\mathbb` uses the double-stroke Computer Modern of the dsfont package, and `\mathbb{1}` gives 𝟙, both from the BananaMath font. A formula in a link is underlined with it: KaTeX's boxes are inline blocks, which a link's underline does not reach, so `theme.css` passes the link's own text decoration down to them (a link shown without an underline, in the header or on a card, leaves its formulas without one too).

Scale (px): page title 30–42 (Inter 560, tight tracking); section heading 21–24 (Inter 600); panel heading 16 (Inter 600); body 16; lede 18 (`--ink-2`); caption 14.5; controls 13.5 (Inter 500); labels and hints 13 (`--ink-3`).

Body text is justified and hyphenated: the paragraphs in `.prose` (a page's sections of text, the standalone pages) and the lede. Captions (centred under their figures), the readouts beside a figure, labels and lists keep their own alignment.

### Figure labels

Labels drawn in SVG or on a canvas use the label font, "MM Math", built by `tools/fonts/mm-math.py` from KaTeX's fonts, so they look exactly like the formulas in the text. It maps Unicode maths (x₁, 𝔭, ℂ, 𝒱, Σ₃, α, ′) to KaTeX's glyphs. Its italic face is TeX's maths mode: italic letters, upright digits and symbols.

- For any label that mixes words and maths, or needs real sub- and superscripts, use the label typesetter in `site.js`: `MM.canvasLabel(ctx, 'nearest pair: $x_1, x_2$', x, y, {size, align, baseline, color})` or `MM.svgLabel(textEl, '$S_{\mathrm{reg}}$')`. Words go in Inter, `$…$` in maths mode with TeX's spacing. The maths is a small TeX subset (scripts, the font commands, `\frac` as a/b, `\sqrt`, accents, Greek, common symbols, spacing and the site's macros; see [authoring.md](authoring.md#in-figures)); Unicode works inside it too. Accents are the font's combining marks, so `\bar z` and `z̄` are the same label.
- A plain SVG `<text>` is set in the label font by default; give it `font-style: italic` if it is a variable, and `font-family: var(--sans)` if it is words.
- Canvas text uses whichever font is loaded when it is drawn: call `MM.onFonts(draw)` once, so the figure redraws when the fonts arrive.

### Shape and space

`--radius` (10px) for panels, readouts and notes; `--radius-sm` (7px) for buttons; `--shadow` only for things that float. `--page-max` (1200px) and `--gutter` (24px, 16px on phones) set the column. Space between blocks: 12, 16, 24, 40px; between sections 40px (`.section`).

### Sticky header

The site navigation is sticky (`--nav-h` tall). A page's `.control-bar` sticks directly under it, and both show a soft fade below them instead of a rule once content scrolls underneath. `site.js` publishes the bar's height as `--bar-h`, so a page can stick something else below both:

```css
#figure { position: sticky; top: calc(var(--nav-h) + var(--bar-h) + 16px); }
```

Use at most one `.control-bar` per page. On a phone (up to 700px wide) or in a short window (up to 500px high) it is one row that scrolls sideways, fading at an edge with more beyond it, so that it takes one row's height and every control stays one swipe away. A quiet arrow at a cut-off edge (`.bar-scroll`, made by `site.js`; the row fades in just after it) shows that there is more that way, and a tap on it scrolls the row on.

On a content page the bar ends in the page's tools (`.bar-tools`): a quiet button, `⋯`, whose menu has Copy link, Save image and Reset ([authoring.md](authoring.md#links-reset-and-images)). It stays at the top right of the column while the controls before it wrap, or scroll on a phone, and "Link copied" shows beside it for a moment. While the page's first picture is wholly out of view (the reader is in the text below it), a second quiet button shows before it, an arrow up to a line (turned over when the picture is below the window): Go to the picture, which scrolls the figure back under the bar.

## Components

Every interactive control has one implementation, in `site/assets/js/components.js` (inlined into `site.js`), and one look, in `theme.css`. A page uses them in one of two ways:

1. **Markup with the theme's classes**, as below. It is enhanced automatically, including markup a script adds later: segmented controls and tabs get an indicator that slides to the chosen item whenever the page sets the `aria-checked` / `aria-pressed` / `aria-selected` attribute, and sliders get their blue fill, which follows the value however a script sets it. The page handles clicks itself.
2. **Custom elements**, which write that markup and emit `change` events. Prefer them in new pages:

```html
<mm-seg value="2" aria-label="dimension">           <!-- change: e.detail.value; el.value -->
  <button value="1">1</button><button value="2">2</button><button value="3">3</button>
</mm-seg>
<mm-seg block value="sym">…</mm-seg>                 <!-- full width -->

<mm-tabs value="a2" aria-label="Examples" hash>     <!-- change: e.detail.value (the tab's id) -->
  <mm-tab id="a2"><span slot="label">Type $A_2$</span> …panel… </mm-tab>
  <mm-tab id="b2"><span slot="label">Type $B_2$</span> … </mm-tab>
</mm-tabs>

<mm-slider min="0" max="360" step="1" value="0" unit="°">Rotate by $g$</mm-slider>   <!-- input / change; el.value -->

<mm-toggle pressed>Show the arrows</mm-toggle>      <!-- change: e.detail.pressed; el.pressed -->

<mm-zoom min="1" max="8" aria-label="Zoom the plane"></mm-zoom>   <!-- input / change; el.value, a magnification -->

<mm-select value="plane" aria-label="The space X">  <!-- change: e.detail.value; el.value -->
  <button value="line">$\RR$</button><button value="plane">$\RR^2$</button> …
</mm-select>

<mm-menu aria-label="Swap two points">…an icon…</mm-menu>   <!-- el.items = [{ value, label, disabled }]; change: e.detail.value -->

<mm-numbers value="2,1" min="0" max="20" integer aria-label="The highest weight">$\lambda$</mm-numbers>
                                                    <!-- typed numbers; change: e.detail.value, an array -->
<mm-slider exact min="-6" max="6" step="any" value="1">Level $k$</mm-slider>   <!-- its value can be typed -->
```

Give a custom element its children in the HTML (or before inserting it from a script). Each is set up as soon as the browser has read it, before the page's scripts run; until then the theme shows only the first `<mm-tab>`. TeX in labels is rendered by the build, like any other text. After inserting controls from a script, enhancement is automatic; `MM.enhance(el)` forces it.

Behaviour shared by both kinds:

- **Keyboard.** A segmented control or tab list with `role="radiogroup"` or `role="tablist"` (the custom elements always have one) is a single tab stop, on the chosen item. The arrow keys, Home and End move through it and choose as they go, by clicking the item, so the page's click handler does the work. Alt, Ctrl and Meta combinations are left to the browser, and so is any key the page's own handler has already taken (`preventDefault()`). A group of independent toggles (`aria-pressed`, no role) keeps one tab stop per button.
- **Overflow.** A segmented control or tab list that is wider than its box scrolls sideways without a scrollbar. An edge with more beyond it fades out (`--edge-fade`), and the chosen item is scrolled into view when it changes.
- **Width.** A `.control` never grows wider than its row, and segments keep their natural width: a segmented control too wide for a phone scrolls sideways inside its track, fading at the edge that has more.
- **Focus.** The focus ring of a tab or segment sits just inside it, since its track scrolls and would clip a ring outside; the slider's thumb gets a solid blue ring.
- **Forced colours** (Windows high contrast): the system repaints the page in a few colours of its own and drops shadows. `theme.css` redraws the chosen segment, the selected tab's underline, a pressed button, a checked toggle, the slider, the pressed item of a strip, the handles and the focus rings in system colours (`Highlight`, `CanvasText`) there, so no state is lost. A new component needs the same care; check it in the gallery with Chromium's forced-colours emulation.

| Class / element | What it is |
|---|---|
| `.wrap`, `.wrap-narrow` | the page column (1200px / 760px) with gutters |
| `.section` | vertical spacing between blocks |
| `.grid-2`, `.grid-3` | one column on phones, two or three from 900px |
| `.split`, `.split-main`, `.split-side`, `.split-fit` | a picture beside its readouts, the picture held in view while they scroll (see [authoring.md](authoring.md#the-page-body)) |
| `.side-block` (+ `.side-head`, `.side-more`) | a block of readouts in `.split-side`, a hairline above it; the head, first, names the object, and on a wide screen has no rule above it, nor has a `.side-more`, which reads as the rest of the head |
| `.side-title`, `.side-kind`, `.side-sub` | in the head: the name of the object (20px), a few grey words after it (its kind or family), a line under it; a slider or two and the legend follow, 12px down |
| `.lede`, `.caption`, `figcaption`, `.label`, `.eyebrow`, `.hint` | text roles |
| `.section-title` | an `h2` heading a section of the page |
| `.prose` > `section`, `figure`, `figcaption` | the sections of text after the panel, 40px apart; a figure among them, with room above and below, its caption centred under it |
| `.fig-bar` | a row of a text figure's own controls, centred on it: above the picture, or under it with 8px between |
| `.panel` (+ `.panel-raised`), `.panel-head`, `.panel-title`, `.panel-sub` | a hairline-bordered area for a figure and its controls |
| `.control-bar` | the page's sticky bar of controls; put a `.wrap` inside |
| `.controls`, `.control` | a row of labelled controls |
| `.btn` (+ `.btn-sm`, `.btn-quiet`, `.btn-icon`), `.btn-row` | buttons; `aria-pressed`, `aria-checked` or `aria-selected` `="true"` shows them on. `.btn-icon` is square and shows only an `<svg>` icon, stroked in the text colour; give it an `aria-label` |
| `.seg` (+ `.seg-block`), `<mm-seg>` | segmented control with a sliding indicator |
| `.tabs` > `.tab`, `<mm-tabs>` | underlined tabs with a sliding underline |
| `.toggle`, `<mm-toggle>` | an on/off button with a check box, `aria-pressed` |
| `<mm-slider plain>`, `.slider-pair` | a slider that shows its value as plain text, without the chip's ground (a number in a name, under it); two sliders side by side |
| `input[type=range]`, `<mm-slider>` | slider: blue fill, yellow thumb ringed in blue; `<mm-slider>` adds its label and value, and `el.allow = (v) => …` keeps it off the values a page refuses (the track keeps its range; those values are drawn dotted on it, and the thumb stops before them) |
| `<mm-select>` | one of many choices in little room (where a segmented control would make the bar too long on a phone): a button showing the choice and a chevron, which opens the list under it, the choice marked blue |
| `<mm-menu>` | one kind of action with several targets, in little room: a button with the action's icon and a chevron, which opens the list of targets under it, so that one click on a target does it. The page sets the list (`el.items`); a target that does not apply now is disabled, not left out |
| `<mm-zoom>` | how far a picture is zoomed in: a slider between a magnifier with − and one with +, on a logarithmic track (each step multiplies the magnification by the same factor). Not shown on a touch screen without a mouse, where two fingers zoom the picture instead (`MM.pinchZoom`, under Interaction). The only way to offer zoom: no − and + buttons of a page's own |
| `.readout` (+ `.readout-title`) | a grey block of text that updates as the reader interacts; give it `aria-live="polite"` |
| `.chip`, `.chip-mono` | a short value on a grey ground |
| `.badge`, `.dot`, `.swatch` | colour markers; colour them with `.c1`… or `style="--c: var(--c3)"`. A badge darkens its colour, so that its white text reads on it. `.red` colours them in the mark's red |
| `.legend` > `.legend-item` | a key for a figure |
| `.dot.hollow`, `.dot.ringed` | in a legend, a point as the figure draws it: open, or with a ring round it (in ink, or `--dot-ring`) |
| `.legend-line` | in a legend, a line as the figure draws it: `<svg class="legend-line" viewBox="0 0 22 10">` with a path, in `--c` (ink) and `--line-width` (1.6), a dash as its `stroke-dasharray` |
| `.topics` > `a` | topic capsules (the site uses these for tags) |
| `.note` | an aside in a light grey block; `.c1`…`.c8` tint it very slightly |
| `.kv` | a `dl` of term/definition pairs; stacks on phones |
| `.data-table` (+ `.num`) | a table; wrap wide tables in `.scroll-x` |
| `.data-table-sm`, `tr.is-on` | a compact table, for a narrow column, its first column flush with the text; the row selected, blue as every selection |
| `.sr-only` | text for screen readers only |
| `.draggable` | an element dragged with pointer events: a swipe on it does not scroll the page (on a shape inside an SVG too, by site.js); the grab cursor, grabbing while held (a page's own cursor, `ns-resize` say, wins) |
| `.turnable`, `.pannable`, `.zoomable` | a picture that turns under a drag, `MM.turnDrag` giving it the class while it turns: a swipe up or down still scrolls the page (`touch-action: pan-y`), the grab cursor; one that a mouse drag of the page's own moves (`.is-panning` while it does): the grab cursor; one that zooms by pinching, `MM.pinchZoom` giving it the class: `touch-action: pan-y` |
| `.handle`, `MM.handle(el)` | the handle of a picture: a yellow dot in a gap of the ground, ringed (`--handle-ring`), with a soft shadow; a box over the picture, with `.draggable`, placed by the page (`--handle-size`), that grows a little while held, or a group in an SVG (`MM.handle(g, r)`). Its focus is a ring round it |
| `.handle-point` (+ `.handle-num`, `.snap-ring`) | a point of the figure that is itself a handle (the points of a configuration: on the figure's lines, many, with a number in them): a yellow dot with a darker rim and no ring; its number; a dashed red ring where a dragged one would land |
| `.focus-ring` | in an SVG, the keyboard focus of the group it is in: a shape the page draws round the thing (a circle, a rounded rect), in the accent, 2px, shown only while the group has the focus (the group then draws no outline) |
| `.strip-block` > `.strip-head`, `.strip` > `.strip-group` > `.strip-item`, `MM.strip` | a strip of small pictures to choose from under a picture (diagrams, systems, knots), each a `.strip-item` button with an `<svg>` (in `currentColor`) over its `.strip-name`, in groups with a hairline between them (by family, by size), the one shown pressed in blue; its head is the label and a segmented control of the families. It scrolls sideways; `MM.strip` makes it one stop for Tab, with the arrow keys along it |
| `.fig-pair`, `.fig-copy` | a figure in the text that changes the main picture, which is out of view by then, and beside it (under it on a phone) a small copy of that picture in a hairline frame, so that the change shows. `MM.copyPicture` fills the copy, or the page draws its own (Amoebas: the amoeba without its labels) |
| `.field`, `<mm-numbers>`, `<mm-slider exact>` | a box for numbers typed exactly, in the mono face: hairline border, blue while it has focus, red (`--bad`) round what it cannot take. `<mm-numbers>` is a label and one; an exact slider shows its value in one |
| `.see-also` | a line under a figure that leads to the same object in other pages |
| `.menu` | a few actions in a floating box under the button that opens it (`role="menu"`, items `role="menuitem"`); the page's tools use it |
| `.fig-menu` | a menu over a picture, beside the thing it acts on, placed by the page's script: the `.menu`'s box, holding buttons (pictures of the choices, or `.btn-icon` tools) |
| `.fig-overlay` | a hint over a picture (in a box with `position: relative`), grey on a veil of the ground, centred near its top (a page may move it), letting the pointer through |
| `.halo` | an SVG label on a halo of the ground, where it crosses lines: on a `<text>`, or on a group or an `<svg>` for all the text in it |
| `.dialog` (+ `.dialog-title`, `.dialog-close`, `.dialog-actions`) | a `<dialog>` opened with `showModal()`: a white box with a hairline and a soft shadow over a faint veil, its title as a panel heading, a close button (a quiet `.btn-icon` with an ×) in its corner, its buttons at the bottom right; Save image is one |

### Component tokens

Each component reads its look from its own tokens, declared together in `theme.css` ("component tokens"). To restyle a whole family, change its tokens there (or its one rule): every page follows. A page may set tokens on its own elements, for a local variant, but never restyle a component's parts.

```css
.dense .seg { --seg-height: 24px; --seg-font-size: 12.5px; }   /* fine: a local variant */
.dense .seg > button { height: 24px; color: var(--ink); }      /* not fine: the build warns */
```

| Component | Tokens |
|---|---|
| text roles | `--text-body`, `--text-lede`, `--text-caption`, `--text-control`, `--text-label`, `--label-color` |
| button | `--btn-height`, `--btn-radius`, `--btn-font-size`, `--btn-bg`, `--btn-border`, `--btn-text`, `--btn-hover-bg`, `--btn-hover-border`, `--btn-on-bg`, `--btn-on-border`, `--btn-on-text` |
| segmented control | `--seg-height`, `--seg-font-size`, `--seg-radius`, `--seg-item-radius`, `--seg-track`, `--seg-text`, `--seg-on-text`, `--seg-indicator`, `--seg-indicator-shadow`, `--seg-hover`, `--seg-speed` |
| tabs | `--tab-font-size`, `--tab-text`, `--tab-on-text`, `--tab-indicator`, `--tab-hover-indicator`, `--tab-indicator-height`, `--tab-speed` |
| overflowing segmented controls and tabs | `--edge-fade` |
| toggle | `--toggle-box`, `--toggle-on` |
| slider | `--slider-height`, `--slider-track`, `--slider-fill`, `--slider-thumb-size`, `--slider-thumb`, `--slider-thumb-ring`, `--slider-thumb-halo`, `--slider-focus-ring`, `--slider-value-width` (the least width of an `<mm-slider>`'s value. The component makes the value as wide as the longest one the slider's range and step allow, a fraction too for an exact slider, and keeps that width, so the track never changes length while the value changes; set the token only to make it wider still) |
| zoom | `--zoom-width` (the slider of an `<mm-zoom>`, between its magnifiers) |
| copy of the main picture | `--fig-copy-size` (the width of a `.fig-copy`) |
| handle | `--handle-size`, `--handle-ring` (grey on a page where blue is the selection, which then rings the selected one), `--handle-rim`, `--handle-shadow` |
| strip | `--strip-picture-height`, `--strip-hover`, `--strip-on-bg`, `--strip-on-text` |
| readout, chip, note | `--readout-bg`, `--chip-bg`, `--note-bg` |
| topic capsules | `--topic-bg`, `--topic-text`, `--topic-on-bg`, `--topic-on-text` |
| panel | `--panel-bg`, `--panel-border`, `--panel-radius` |
| table | `--table-head-bg` |
| text box (`.field`) | `--field-height`, `--field-font-size`, `--field-bg`, `--field-border`, `--field-hover-border`, `--field-focus-border`, `--field-invalid` |
| menu, dialog | `--menu-bg`, `--menu-border`, `--dialog-bg` |

### Guard rails

The build checks each page's CSS and scripts (`build/lint.mjs`) and prints a warning, with file and line, for:

- a rule that restyles a theme component: colour, background, border, shadow, outline or font on `.btn`, `.seg` and its buttons, `.tab`, `.toggle`, `.readout`, `.chip`, `.note`, `.panel`, `.label`, `.data-table` cells, sliders and so on. Set the component's tokens instead. Styling the page's own content inside a component (`.readout .kind`) is fine;
- a hard-coded colour (`#hex`, `rgb()`, `hsl()`) in CSS, or a `'#hex'` string in a script: use a token, or `MM.color()`;
- a font named in CSS: use `var(--sans)`, `var(--math)` or `var(--mono)`.

When a rule has a good reason to break one of these, put a comment containing `design-ok` and the reason in the rule (or just before it). Keep the build free of warnings: then a change in `theme.css` is guaranteed to reach every page.

## Figures

- **Phones first.** Every figure must work at 375px wide, by touch. Use one column below about 900px and keep controls large enough to tap (at least 30px tall; on a touch screen the theme makes segmented controls, small buttons and text boxes 32px, with no change to a figure's size). The page must never scroll sideways; wrap wide tables and diagrams in `.scroll-x`.
- **Size from CSS.** Give a canvas or SVG a width of 100% and an `aspect-ratio`, and size a canvas's backing store from its box with `MM.fitCanvas` (at `MM.pixelRatio()`).
- **Strokes and labels.** Axes and grid lines `--rule`/`--ink-3`, 1px; the objects of interest in data colours, 2 to 2.5px; the highlighted object thicker in `--highlight`. Labels as described under [Figure labels](#figure-labels), in sentence case; give them a halo of the ground (`.halo`) where they cross lines. Labels keep the size of the text around them: draw a small SVG chart one unit to a pixel (its `viewBox` as wide as it is shown, drawn again when that width changes) rather than letting a fixed `viewBox` scale it, and its labels, up.
- **Interaction.** Use pointer events, so mouse, pen and touch share one code path, and set `touch-action: none` (the class `.draggable`) only on the element that is dragged: the theme sets it on nothing, so a swipe anywhere else scrolls the page. Show what can be dragged: a grab cursor (`.draggable` has it), a visible handle (`.handle`, `.handle-point`). A 3D picture that turns under a drag is the exception that still scrolls: turn it with `MM.turnDrag`, which gives it `.turnable` (`touch-action: pan-y`, the grab cursor) while it turns, so that on a touch screen the first movement decides the whole drag (sideways turns the picture, up and down included; up or down scrolls the page). Its `keys` option turns it from the keyboard, alike on every page: the arrow keys by 6°, by 1° with Shift, Home back to its first view where the page has one. A picture that zooms has `<mm-zoom>` in the control bar for a mouse, and zooms by pinching on a touch screen: `MM.pinchZoom(el, { zoom(f, x, y), pan(dx, dy) })` zooms it about the point between two fingers, moves it as they move together, and keeps the page from scrolling or zooming meanwhile (a pinch on a trackpad works too). It gives the element `.zoomable` (`touch-action: pan-y`), so that the browser leaves the pinch to the page while one finger still scrolls; a drag of `MM.turnDrag` gives way to a second finger. Give every control a keyboard path and a visible focus ring (the theme provides it; in an SVG, a `.focus-ring`).
- **Motion.** Animation should explain something. Start auto-rotation paused when `MM.reduceMotion()` (`prefers-reduced-motion`), and give it a pause button. A link within the page (a readout that leads to the section explaining it, a citation) scrolls there smoothly: `theme.css` sets `scroll-behavior: smooth` on `html` (off under reduced motion), so a script that scrolls the page to keep a picture still must pass `behavior: 'instant'`.
- **Text alternatives.** Give each canvas or SVG an `aria-label` or `<title>`, and keep the readout text in step with the figure so screen-reader users get the same information.

## The site's own pieces

- **Mark.** The logo is a trefoil knot in the accent (`--accent`, which is also `--c1`), computed in `build/logo.mjs` from its parametrisation, with a control point in the second accent (`--accent-2`) resting on the left crossing. On the page both colours come from the tokens; the favicon is given the same two values, read from `theme.css` by the build. The curve is drawn whole; at each crossing a band along the upper strand (the stroke plus a thin margin each side) masks out whatever passes beneath, and the upper strand is drawn again on top. The point's white ring is a gap cut into the strands, not white paint, so the mark works on any background; the favicon is generated from the same code, with the point at rest. While the pointer is over the logo, the point moves round the knot at an even pace (a turn in about three seconds), easing in. Where its strand passes under, the same band hides it, so it disappears exactly where its strand does and the figure stays a correct knot diagram throughout; meanwhile its ring is the outline of just the part that can be seen, so it never shows on its own. When the pointer leaves, the point glides to a stop, and only where it can be seen whole (`setupLogo` in `site.js`; the pace and easing are constants there). Where it stops is kept for the visit (`sessionStorage`) and applied as soon as the logo is parsed, so the point stays put from page to page, even across a click on the logo; a new visit starts it on the left crossing. It does not move on touch screens or under reduced motion.
- **Topics** are capsules (`.topics`): Inter 12.5px on `--topic-bg`, turning blue on hover.
- **A page's title** links to the page itself, its plain address without an example's parameters: the title's colour, the accent under the pointer, as the home page's topic headings.
- **Cards** (home and topic pages) are all Inter, with TeX allowed in the title and description: the thumbnail in a hairline frame, the title, the description and the topic capsules, leaving out the topic the card is listed under. On hover the thumbnail zooms slightly inside its frame and an accent copy of the title, underlined, is wiped across it from the left, so the colour and the underline draw in together.
- **The home page** has a row of cards per topic (`.shelf`), under a heading that leads to the topic's page, with the number of pages beside it; the capsules under the page title jump to the rows. A row scrolls sideways, snapping to its cards (on a touch screen a swipe, however fast, moves it one card, and quick swipes in a row move it on further), and runs to the edges of the window, padded so that its cards line up with the page column: three to the column from 900px, two and a bit on tablets, one and a bit on phones, so that the next card shows at the edge. While a row holds more than fits, a sliver of the next card shows beyond the page column, fading out quickly. A card cut off by either edge is not a link but a button that scrolls the row that way, with no hover effect. Under the row, apart from the cards, a dot for each card, with a dark pill over those in view that slides as the row scrolls; a click on a dot brings its card in, and a drag along the dots scrubs the row. Arrows either side of them scroll by the cards in view, faint at an end (not on touch screens, where a swipe does it). A mouse can drag the row, which settles on a card when let go (a drag never opens a card). In a dev build a draft's card carries a small “Draft” label on its picture; drafts are not in the deployed site.
- **Thumbnails** are drawn for the card, not shrunk from the page: each page's `thumb.html` draws one simple case of its figure as the page draws it, large, with marks a little heavier than the page's and only a few labels, and nothing the page does not have; `npm run thumbs` photographs it (see [authoring.md](authoring.md#thumbnails)). Like a video thumbnail, it must read at a glance at a quarter of its size.
