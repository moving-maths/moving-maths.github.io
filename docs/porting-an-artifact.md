# Porting an existing page

Use this to bring in a standalone HTML page, such as a Claude artifact: one file with its own `<style>`, `<script>` and perhaps rendered KaTeX. Expect to rework it substantially. The aim is a page that looks and behaves like the rest of the site, not a pixel copy of the original.

## 1. Import

Save the page's HTML (for a Claude artifact, its published HTML) and run:

```bash
npm run import -- path/to/page.html my-slug
```

This creates `content/my-slug/` as a draft. It:

- removes the document shell (`<html>`, `<head>`, `<body>`), the `<title>`, font and KaTeX `<link>`s and `<script src>`s, and any inlined copy of KaTeX's stylesheet and fonts;
- turns rendered KaTeX back into TeX, using the source KaTeX keeps in each `<annotation encoding="application/x-tex">`: `<span class="katex-display">` becomes `$$…$$` and `<span class="katex">` becomes `$…$`;
- moves `<style>` blocks to `style.css`, large `window.X = {…}` data scripts to `data.js`, and the other inline scripts to `main.js` (or to `main.mjs` when they are `type="module"`, so they still load as a module); scripts that are not JavaScript, such as `type="application/json"` data, stay where they are;
- writes front matter with the title, `draft: true` and TODOs, and prints a list of what is left.

## 2. Finish by hand

Work through the list with `npm run dev` open on the page. In rough order:

1. **Front matter.** Write `description`, choose `tags` (add any new tag to `site/tags.yml`), set `date`. Move the page's `<h1>` into `title` (plain) and `heading` (with TeX), and delete the `<h1>` and any eyebrow or byline above it. Move bibliography links into `references`.
2. **Mathematics.** Look for maths that was not rendered KaTeX: Unicode imitations (`𝔥//W`, `H<sub>𝔩</sub>`, `<i>x</i>`) in the HTML, and strings the scripts render. Rewrite them as TeX. Replace any `katex.render…` call and the page's own `tex()` helper with `MM.tex`, `MM.rich` or `MM.setHTML`, and move the page's macro table into `site/macros.tex` (if general) or `macros:` (if not). Delete the page's own fallbacks for missing KaTeX. If a script builds HTML with `$…$` and renders it in place, use `MM.setHTML(el, html)`. Check that no literal `$` in prose has become an accidental math span (write `\$`).
3. **Styles.** Delete the page's `:root` tokens, dark-mode blocks (`prefers-color-scheme`, `data-theme`), base element styles (`body`, `h1`, `a`, `*`, `button` resets) and font imports. Map every colour to a theme token (see [design.md](design.md)), naming data colours by meaning (`--pt-1: var(--c2)`). Replace the page's own buttons, segmented controls, tabs, cards, readouts, legends and tables with the theme's components, and delete their CSS. Rename the page's container classes to `.wrap`, `.panel`, `.section` and so on. What remains in `style.css` should be layout and figure styles specific to this page.
4. **Figure labels.** Labels drawn in SVG or on a canvas should use the label typesetter (`MM.svgLabel`, `MM.canvasLabel`; see [authoring.md](authoring.md#in-figures)), so they match KaTeX. If the page has its own helper for labels, make it call these; mark maths with `$…$` and leave words as words.
5. **Scripts.** Read colours with `MM.color` and `MM.rgba` instead of hex values or reading the page's old variables, and fonts with `MM.font`. Remove anything that toggled a theme. Check that nothing assumes the page starts at the top of the document (the site navigation now sits above it) and that sticky elements use `.control-bar`.
6. **Data.** If `data.js` is large, consider making it `data.json` (fetched) or committing the script that produced it. Strip data that the new page no longer needs, such as pre-rendered HTML that can now be TeX.
7. **Check.** Work through the checklist at the end of [authoring.md](authoring.md), run `npm run thumbs -- my-slug`, and remove `draft: true`.

## Things that commonly go wrong

- **Pre-rendered maths in data.** Artifacts sometimes ship KaTeX output inside JSON. The importer only converts HTML, so search data files for `class="katex` (or `class=\"katex` in JSON) and convert those strings to TeX by the same annotation trick.
- **Dollar signs in scripts.** Template literals such as `` `$${n}$` `` are fine, but a `$` meant as text must be written `\\$` in a JS string before it goes through `MM.rich`.
- **Colours read from old variables.** Scripts often read `getComputedStyle(...).getPropertyValue('--s2')`. Point those at the new names or use `MM.color`.
- **Full-height layouts.** Pages that assumed they owned the viewport (`100vh`, `position: fixed`) need to allow for the navigation bar.
