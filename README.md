# Moving Maths

Interactive pictures of mathematics, published at <https://moving-maths.github.io>.

Each page is a folder of HTML, CSS and JavaScript under `content/`. Mathematics is written in TeX and typeset with KaTeX at build time. A small Node generator in `build/` adds the shared theme, navigation, topic pages, feed and sitemap, and GitHub Actions deploys the result to GitHub Pages.

It needs Node 22 or later.

```bash
npm install
npm run dev      # http://localhost:8080, rebuilds and reloads on change
npm test
npm run test:browser   # every page in Chromium (once: npx playwright install chromium)
```

To add a page, run `npm run new -- my-slug "Title"`, or `npm run import -- page.html my-slug` to start from an existing page. The guides are in [docs/](docs/README.md); [docs/deploying.md](docs/deploying.md) says how the site is published.

## Licence

Text and figures are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); code is under the [MIT licence](LICENSE). See [LICENSE-content.md](LICENSE-content.md) for which is which, and for the fonts.
