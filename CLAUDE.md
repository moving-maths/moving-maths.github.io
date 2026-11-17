# Moving Maths

Static site of interactive maths pictures; custom Node generator, deployed to GitHub Pages. Read `docs/README.md` first; it points to the other guides.

- Pages live in `content/<slug>/` (front matter + HTML in `index.html`, plus `style.css`, `main.js`, data). Follow `docs/authoring.md` and `docs/design.md`; for an existing standalone page, follow `docs/porting-an-artifact.md` (`npm run import`).
- Maths is TeX (`$…$`, `$$…$$`), rendered at build time; scripts use `MM.tex` / `MM.setHTML` with `katex_runtime: true`. Shared macros go in `site/macros.tex`. Descriptions may contain TeX.
- Figure labels (SVG, canvas) go through `MM.svgLabel` / `MM.canvasLabel` (words + `$…$` maths, KaTeX's glyphs via the "MM Math" font); canvases call `MM.onFonts(draw)`.
- Never hard-code colours or font names: use the tokens in `site/assets/css/theme.css` (`--ink`, `--c1`…`--c8`, `--serif`…) and `MM.color()` / `MM.font()` in scripts. Light theme only. Reuse theme components (`.panel`, `.seg`, `.btn`, `.readout`, …) rather than restyling.
- Design is deliberately restrained (see the principles in `docs/design.md`): sentence case, no letter-spaced capitals, no tinted callouts or coloured left borders, blue for the selected state, yellow for handles, few boxes.
- Controls come from the shared components (`<mm-seg>`, `<mm-tabs>`, `<mm-slider>`, `<mm-toggle>`, or the theme classes); restyle a family through its tokens in `theme.css`, never per page. Keep the build free of design-lint warnings, and check visual changes in the dev-only gallery at `/components/`.
- Generator code is in `build/` (see `docs/generator.md`); `build/tex-scan.mjs` also runs in the browser, so it must stay import-free.
- Check work with `npm test` and `npm run check`; view it with `npm run dev` at phone and desktop widths.
- When a change affects authoring or the generator, update the matching guide in `docs/`.
