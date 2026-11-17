# Documentation

Moving Maths is a static site of interactive pictures of mathematics, built by a small Node generator in `build/` and deployed to GitHub Pages. These guides cover writing pages and working on the site.

| Guide | Read it when you want to… |
|---|---|
| [authoring.md](authoring.md) | write or edit a page: files, front matter, TeX, scripts, thumbnails |
| [design.md](design.md) | style a page: tokens, colours, fonts, the shared components and their tokens, the design lint, figure conventions |
| [porting-an-artifact.md](porting-an-artifact.md) | turn an existing standalone HTML page (such as a Claude artifact) into a page |
| [generator.md](generator.md) | understand or change the build: the build steps, the code layout, adding page types |
| [deploying.md](deploying.md) | publish the site, or set up the GitHub repository and Pages |

## Quick reference

```bash
npm install                 # once
npm run dev                 # build, serve on http://localhost:8080, rebuild and reload on change
                            #   (also serves the component gallery at /components/)
npm run build               # build dist/ (drafts left out)
npm run check               # build, then check every internal link
npm run check -- --drafts   # the same with the drafts built too (dist/ is left alone)
npm test                    # unit tests, plus a full build and link check
npm run test:browser        # every page in a browser (install Playwright's Chromium once);
                            #   MM_DRAFTS=1 npm run test:browser tries the drafts too
npm run new -- my-slug "Title"            # start a new page
npm run import -- page.html my-slug       # start one from an existing HTML page
npm run thumbs -- [slug…]                 # make card/preview images (needs Playwright's Chromium)
```

## Where things are

```
build/            the generator (see generator.md)
scripts/          new, import and thumbs commands
site/
  site.yml        site title, tagline, URL, repository, licence
  tags.yml        the list of topics
  order.yml       the order of topics, and of the pages in each
  macros.tex      TeX macros for every page
  pages/          standalone pages (about)
  assets/         theme.css, site.css, site.js (the browser runtime), example.js (links, reset,
                  Save image), fonts
content/
  <slug>/         one folder per page, published at /<slug>/
tools/fonts/      the FontForge script that builds the figure-label font
test/             node:test tests
browser-tests/    the same, in a browser (npm run test:browser)
docs/             these guides
.github/          the workflow that tests, builds and publishes the site (see deploying.md)
LICENSE           MIT, for the code; LICENSE-content.md says what is under CC BY 4.0
```
