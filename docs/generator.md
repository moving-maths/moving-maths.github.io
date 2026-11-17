# The generator

The site is built by about 2000 lines of plain Node (ES modules, Node 20 or later). There is no framework and no template engine. It depends only on `katex` and `yaml`, plus `playwright` for thumbnails. The aim is that anyone can read the whole build in an afternoon and change it without fighting a tool.

## The build, step by step

`npm run build` runs `build/cli.mjs build`, which calls `build()` in `build/build.mjs`:

1. **Load site data** (`config.mjs`): `site/site.yml`, `site/tags.yml` (tag slugs checked), and `site/macros.tex` (parsed by `macros.mjs` into a KaTeX macro map). Then `site/order.yml` (`order.mjs`), the order of topics and of the pages in each; its problems are errors with their lines.
2. **Load pages** (`content.mjs`): every folder in `content/` (folders starting with `_` or `.` are skipped). Front matter is split off and parsed as YAML; TeX inside double quotes is rejected, since YAML would read `\alpha` as an escape. In a production build, drafts (`draft: true`) are dropped first. The rest are validated (`validatePage`): required keys, known tags, the type of every value (real dates, booleans, lists of existing files, the shape of references, macros and `thumb`), no unknown keys. A folder name must be a slug and must not be one the site uses (`RESERVED_SLUGS` in `config.mjs`, plus the standalone pages). Problems are collected as `{file, line, message}` rather than thrown, so one run reports all of them, and a page with errors does not stop the others. Each page's last-updated day is the day (UTC) of the last git commit that touched its folder, unless its front matter sets `updated`, which always wins; with neither, `date`; the list is sorted by it, most recent first (the order of the feed). CI checks out the whole history (`fetch-depth: 0`) for this.
3. **Prepare the output folder and copy assets.** Before deleting anything, `prepareOutDir` refuses a folder that contains the project or lies inside one of its source folders, and a non-empty folder that is not an earlier build output: each build writes a `.mm-build` marker, and only a folder with one (or `dist/` and `.dev-dist*`) is emptied. Then it copies `site/assets/**`, KaTeX's CSS, JS and woff2 fonts, and a favicon generated from the logo (`logo.mjs`), in the `--accent` and `--accent-2` it reads from `theme.css`. Each asset URL gets `?v=<content hash>`, so browsers fetch a new copy only when it changes; so do the `url()`s inside the CSS. Two sources writing the same output path is an error. `site.js` is assembled here from four pieces, inlined where their placeholders are (with `export` removed): `build/tex-scan.mjs`, so the browser and the build share one TeX scanner; `build/plain-core.mjs`, the MathML-to-text conversion that gives formulas in buttons, links and headings their plain-text names; `build/cite.mjs`, so that citations in text that scripts write are numbered as the build numbers them; and `site/assets/js/components.js`, the shared controls. The runtime must parse in every browser from 2023 on (no regex lookbehind, which older Safari rejects); a test checks the built file.
4. **Render and check each page**:
   - Citations in the body (`[@key]`) are first turned into numbered links to the reference list by `citeRefs` (`cite.mjs`); an unknown key is an error, and a reference cited neither in the body nor in the page's scripts is a warning.
   - The body, the `heading`, the `description` and each reference are passed through `renderTex` (`tex.mjs`); the description also gets a plain-text version (`plain.mjs`) for meta tags and the feed. Before KaTeX sees a formula, `rewriteTex` (in `tex-scan.mjs`, so the browser does the same) turns `\mathbb{1}` into 𝟙. That calls `transformMath` (`tex-scan.mjs`), a small hand-written scanner. It walks the HTML, skips tags, comments and elements that must not be touched, finds the maths delimiters, and calls KaTeX for each piece with the site and page macros. TeX errors carry file and line; KaTeX "strict" warnings become build warnings. The scanner also tracks whether a formula sits inside an element whose accessible name comes from its content (a link, button, heading, label, or an element with a role such as `tab`); there the formula gets `role="math"` and an `aria-label` with its plain-text form, because browsers otherwise name such an element from the visible KaTeX, which is hidden from them. The heading and description are rendered as such names too, since they end up inside card links.
   - The design lint (`lint.mjs`) checks the page's CSS and scripts and adds warnings: components restyled instead of tokened, hard-coded colours, named fonts (see [design.md](design.md#guard-rails)).
   - The folder's other files are copied to `dist/<slug>/`, except `thumb.html`, the designed card image, which is never published.
5. **Arrange the topics** (`arrange` in `order.mjs`): the used topics in the order of `site/order.yml`, then the rest in the order of `tags.yml`, each with its pages listed first or most recently updated first (see [authoring.md](authoring.md#where-it-is-listed)). `orderWarnings` adds a warning for a listed name that is not a page or lacks the topic, and for a page left out of its topic's list.
6. **Write pages** with the templates in `layouts.mjs`: each page (with up to three related pages, ranked by shared tags, and `example.js` before its own scripts), the home page (a row of cards per topic, `.shelf`), `/tags/` and one page per used topic, in that order, the standalone pages in `site/pages/` (those with `dev_only: true`, such as the component gallery, only in dev builds; `wide: true` drops the text measure), `404.html`, `feed.xml` (Atom), `sitemap.xml`, `robots.txt` and `.nojekyll`. With `thumbs` (in dev builds, and for `npm run thumbs`), also each page's `thumb.html`, through `thumbPage`: its body, TeX rendered, in a page of exactly 1200×630 with the theme, the runtime, the page's styles and macros, and `MMThumb.canvas()`.
7. **Report**: the CLI prints warnings and errors and exits non-zero if there are errors. `npm run check` also runs `check.mjs`, which reads every built HTML file and checks that each internal `href`/`src` points to a file that exists. With `--drafts` it builds the drafts as well, into a temporary folder, so that a page can be checked before it is published and `dist/` never holds a draft.

## Files

| File | Role |
|---|---|
| `build/cli.mjs` | command line: `build [--dev] [--json] [--out DIR]`, `dev [--port N] [--host H]`, `check` |
| `build/config.mjs` | paths (`projectPaths(root)`, so tests can build a fixture project), reserved slugs, the slug pattern, `lineIndex`, loading `site/` data |
| `build/content.mjs` | front matter parsing and validation; loading content pages and standalone pages |
| `build/order.mjs` | `site/order.yml`: reading and checking it, putting topics and pages in order |
| `build/tex-scan.mjs` | the TeX scanner, shared with the browser; no imports allowed |
| `build/cite.mjs` | citations: `[@key]` → numbered links to the reference list; shared with the browser (`MM.setHTML`); no imports allowed |
| `build/tex.mjs` | KaTeX rendering with error locations |
| `build/macros.mjs` | `\newcommand` / `\DeclareMathOperator` parser |
| `build/layouts.mjs` | every page template, as functions returning strings |
| `build/html.mjs` | `esc`, the `html` tagged template, date formatting |
| `build/logo.mjs` | the trefoil mark, computed from the knot's parametrisation: the whole curve, a band along the upper strand at each crossing that masks what passes beneath, the upper strands drawn again on top, the control point and its ring (a gap cut into the strands); the inline logo (with the geometry `site.js` animates the point with) and the favicon |
| `build/plain.mjs` | TeX → plain Unicode (via KaTeX's MathML), for `<meta>` descriptions and the feed |
| `build/plain-core.mjs` | the MathML → text conversion and `labelKatex`, shared with the browser; no imports allowed |
| `build/static.mjs` | the static file handler of the dev server and the thumbnail script: safe path decoding, kept inside the root |
| `scripts/thumbs.mjs` | `npm run thumbs`: builds with `thumbs: true` and photographs each page's `thumb.html` in Chromium (or, without one, captures elements of its page and composes them, side by side and trimmed) |
| `tools/fonts/mm-math.py` | builds the figure-label font from KaTeX's fonts (run with FontForge; output committed in `site/assets/fonts/`) |
| `build/build.mjs` | the steps above |
| `build/check.mjs` | internal link checker |
| `build/lint.mjs` | the design lint (warnings) |
| `site/assets/js/components.js` | the shared controls: sliding indicators, slider fill, `<mm-seg>`, `<mm-tabs>`, `<mm-slider>`, `<mm-toggle>`, `<mm-numbers>` (inlined into `site.js`) |
| `site/assets/js/example.js` | links, reset and Save image (`MM.example`), loaded on content pages before their own scripts; its link codecs also run in Node, for `test/example.test.mjs` |
| `site/pages/components.html` | the component gallery, `/components/` in dev builds |
| `build/serve.mjs` | dev server |
| `site/assets/js/site.js` | the browser runtime `window.MM`: TeX, the figure-label typesetter, theme colours and fonts, the sticky header, the logo animation, the scroll buttons of the home page's rows |

## The dev server

`npm run dev` serves the site on `localhost:8080` (`--port`, or `PORT`). It listens only on this machine, since dev builds include drafts; `npm run dev -- --host 0.0.0.0` opens it to the local network, to try a page on a phone. It claims the port before building, so a second copy stops at once. It watches `site/`, `content/` and `build/`, and rebuilds 120ms after the last change. Each rebuild runs `cli.mjs build --dev --json` in a child process, so changes to the generator itself apply without a restart. The build goes into `.dev-dist-next/`, which is then swapped in for `.dev-dist/` (never shared with `npm run build`), so a request never sees a half-written site. Pages load `/__dev/reload.js`, which listens on a server-sent-events stream and reloads the page once the last change is built. If the build failed, it shows the errors in a box at the bottom of the page.

## Templates

Templates are functions in `layouts.mjs` that take `ctx` (`{site, tags, assets, dev, macros}`) and return HTML strings built with the `html` tagged template, which drops `null`/`false` and joins arrays. Escape all text with `esc()`. Values that are already HTML (`headingHtml`, `bodyHtml`) are inserted as they are.

## Changing things

- **A new page type**: write a template in `layouts.mjs`, and call it from `build()` with `writeFile(path.join(outDir, …, 'index.html'), …)`. Add its URL to `urls` for the sitemap.
- **A new front matter key**: add it to `KNOWN_KEYS` and `validatePage` in `content.mjs`, give it a default in `loadContent`, use it in `layouts.mjs`, and document it in `authoring.md`.
- **New delimiters or skip rules**: edit `tex-scan.mjs` and add cases to `test/tex-scan.test.mjs`. Remember that it also runs in browsers, so use only plain JavaScript.
- **A build-time transform of the body** (for example, syntax highlighting or figure numbering): add a function after `renderTex` in step 4. Keep it a function from string to string, so it can be tested alone.
- **A new global asset**: put it under `site/assets/` and refer to it through `ctx.assets['path/in/assets']`, which carries the cache-busting hash.

## Tests

`npm test` runs `node --test test/`:

- units: the TeX scanner, the macro parser, front matter parsing and validation, the order of topics and pages, the link checker, the static handler's path containment, plain-text conversion and the design lint;
- fixture builds (`test/fixture.test.mjs`): this repository's `site/` with pages written by the test, built with `build({ root, outDir })`, for drafts, broken pages, reserved names and the output-folder guard;
- a full build of the real site into a temporary folder, followed by the link check and checks on the assembled `site.js`;
- the link codecs of `example.js` (`test/example.test.mjs`).

`npm run test:browser` runs `browser-tests/` in Playwright's Chromium (`npx playwright install chromium` once), on a fresh build: every published page loads without an error and fetches nothing from another server, a copied link brings its example back, Reset returns to the page's own example, Save image saves a PNG of the size its dialog says, the control bar is one row at phone width with nothing scrolling sideways, and the links between pages arrive at the same type.

Run both before pushing; CI runs them too, then builds the site.
