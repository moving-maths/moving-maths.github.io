// Page templates. Each returns a complete HTML document as a string.
// `ctx` carries { site, tags, assets, dev, macros } (see build.mjs).
import { esc, html, formatDate } from './html.mjs';
import { logoSvg } from './logo.mjs';

// Fonts: Inter (variable, with optical sizes) for all text, IBM Plex Mono for changing
// numbers and code, Noto Sans Math as a last resort for rare symbols, KaTeX's fonts for
// formulas and the "MM Math" label font for figures. All are served with the site and
// declared in theme.css.

const LOGO = logoSvg();

function abs(ctx, url) {
  return ctx.site.url.replace(/\/$/, '') + url;
}

function head(ctx, { title, description, url, image, type = 'website', styles = [], katexRuntime = false, macros = null }) {
  const { site, assets } = ctx;
  const fullTitle = title ? `${title} · ${site.title}` : `${site.title}: ${site.tagline.replace(/\.$/, "")}`;
  const img = image ? abs(ctx, image) : null;
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.tagline)}">
<link rel="canonical" href="${esc(abs(ctx, url))}">
<link rel="icon" href="${assets['img/favicon.svg']}" type="image/svg+xml">
<link rel="alternate" type="application/atom+xml" title="${esc(site.title)}" href="/feed.xml">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title || site.title)}">
<meta property="og:description" content="${esc(description || site.tagline)}">
<meta property="og:type" content="${type}">
<meta property="og:url" content="${esc(abs(ctx, url))}">
${img ? html`<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="stylesheet" href="${assets['katex/katex.min.css']}">
<link rel="stylesheet" href="${assets['css/theme.css']}">
<link rel="stylesheet" href="${assets['css/site.css']}">
${styles.map((s) => `<link rel="stylesheet" href="${esc(s)}">\n`)}${macros ? `<script type="application/json" id="mm-macros">${JSON.stringify(macros).replace(/</g, '\\u003c')}</script>\n` : ''}${katexRuntime ? `<script src="${assets['katex/katex.min.js']}"></script>\n` : ''}<script src="${assets['js/site.js']}"></script>
${ctx.dev ? '<script src="/__dev/reload.js"></script>' : ''}
</head>`;
}

function nav(ctx, current) {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return html`<header class="site-nav">
  <div class="wrap site-nav-inner">
    <a class="brand" href="/"${current === 'home' ? ' aria-current="page"' : ''}>${LOGO}<span>${esc(ctx.site.title)}</span></a>
    <nav aria-label="Site">
      ${link('/about/', 'About', 'about')}
    </nav>
  </div>
</header>`;
}

// `meta`: an extra line above the licence (a page's date and error link).
function siteFooter(ctx, meta = '') {
  const { site } = ctx;
  const l = site.licence;
  return html`<footer class="site-foot">
  <div class="wrap">
${meta ? `    <p class="foot-meta">${meta}</p>\n` : ''}    <p>Text and figures <a href="${esc(l.content_url)}">${esc(l.content)}</a>, code <a href="${esc(l.code_url)}">${esc(l.code)}</a> · <a href="${esc(site.repo)}">GitHub</a></p>
  </div>
</footer>`;
}

function page(ctx, headOpts, current, bodyClass, main, footMeta = '') {
  return html`${head(ctx, headOpts)}
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to content</a>
${nav(ctx, current)}
<main id="main">
${main}
</main>
${siteFooter(ctx, footMeta)}
</body>
</html>
`;
}

// Topic names as plain links, separated by thin spacing (see .topics in site.css).
export function topicLinks(ctx, slugs) {
  return slugs.map((s) => `<a href="/tags/${s}/">${esc(ctx.tags[s].name)}</a>`).join('');
}

// level: the title's heading level, one below the heading the cards sit under
// (h2 on a topic page, h3 in a row of the home page and under "More in …").
// `within`: the topic the card is listed under, left out of its topic capsules.
export function card(ctx, item, level = 2, within = null) {
  const topics = item.data.tags.filter((t) => t !== within);
  const img = item.imageUrl
    ? `<img src="${esc(item.imageUrl)}" alt="" width="1200" height="630" loading="lazy" decoding="async">`
    : `<span class="card-ph" aria-hidden="true">${logoSvg({ point: false })}</span>`;
  // A draft (only in a dev build: production builds leave drafts out) is
  // marked on its picture. The title is drawn twice: the second copy, in the
  // accent colour and underlined, is wiped across the first on hover
  // (site.css, .card-title).
  const draft = item.data.draft === true ? '<span class="card-draft">Draft</span>' : '';
  return html`<article class="card${item.data.draft === true ? ' is-draft' : ''}">
  <a class="card-link" href="${item.url}">
    <span class="card-img">${img}${draft}</span>
    <h${level} class="card-title"><span class="ct">${item.headingHtml}</span><span class="ct ct-hover" aria-hidden="true"><span class="ct-line">${item.headingHtml}</span></span></h${level}>
    <p class="card-desc">${item.descriptionHtml}</p>
  </a>
  ${topics.length ? `<p class="card-topics topics">${topicLinks(ctx, topics)}</p>` : ''}
</article>`;
}

function cardGrid(ctx, items, level = 2, within = null) {
  return `<div class="card-grid">\n${items.map((it) => card(ctx, it, level, within)).join('\n')}\n</div>`;
}

const count = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`;
const chevron = (d) => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${d}"/></svg>`;

// A topic's row of cards on the home page. The row scrolls sideways; while it
// holds more than fits, site.js shows a dot for each card under it, a pill
// over those in view, with arrows either side that scroll it by the cards in view, and lets a
// mouse drag it. Its heading leads to the topic's page.
function shelf(ctx, { slug, items }) {
  const name = esc(ctx.tags[slug].name);
  return html`<section class="shelf" id="${slug}" aria-labelledby="${slug}-h">
  <div class="wrap shelf-head">
    <h2 id="${slug}-h"><a href="/tags/${slug}/">${name}</a></h2>
    <span class="shelf-count">${count(items.length)}</span>
  </div>
  <div class="shelf-body">
    <div class="shelf-track" id="${slug}-cards">
${items.map((it) => card(ctx, it, 3, slug)).join('\n')}
    </div>
    <div class="wrap shelf-pos" hidden>
      <button type="button" class="shelf-arrow shelf-prev" aria-controls="${slug}-cards" aria-label="Previous in ${name}">${chevron('M10 3.5 5.5 8l4.5 4.5')}</button>
      <span class="shelf-bar" aria-hidden="true">${items.map(() => '<span class="shelf-dot"></span>').join('')}<span class="shelf-thumb"></span></span>
      <button type="button" class="shelf-arrow shelf-next" aria-controls="${slug}-cards" aria-label="Next in ${name}">${chevron('M6 3.5 10.5 8 6 12.5')}</button>
    </div>
  </div>
</section>`;
}

function reference(r) {
  const title = r.url ? `<a href="${esc(r.url)}">${r.titleHtml}</a>` : r.titleHtml;
  return html`<li id="ref-${esc(r.key)}">${r.authors ? `${esc(r.authors)}, ` : ''}<cite>${title}</cite>${r.note ? `. ${r.noteHtml}` : ''}</li>`;
}

export function contentPage(ctx, item, related) {
  const d = item.data;
  // A new issue titled "[slug] ", for the reporter to finish; the body is left blank.
  const issue = `${ctx.site.repo}/issues/new?title=${encodeURIComponent(`[${item.slug}] `)}`;
  const footMeta = `Updated ${formatDate(item.updated)} · <a href="${esc(issue)}">Report an error</a>`;
  const headOpts = {
    title: d.title, description: item.descriptionText, url: item.url, type: 'article',
    image: item.imageUrl, styles: item.styleUrls,
    // the macros go on every content page: figure labels expand them too
    katexRuntime: !!d.katex_runtime, macros: item.macros,
  };
  // example.js (links, reset, Save image) first, for the page's scripts to call
  const scripts = [{ src: ctx.assets['js/example.js'] }, ...item.scriptUrls].filter((s) => s.src)
    .map((s) => `<script${s.module ? ' type="module"' : ''} src="${esc(s.src)}"></script>`).join('\n');
  const main = html`<article class="entry">
<header class="entry-head wrap">
  <p class="entry-topics topics">${topicLinks(ctx, d.tags)}</p>
  <h1><a href="${esc(item.url)}" aria-current="page">${item.headingHtml}</a></h1>
</header>
<div class="entry-body">
${item.bodyHtml}
</div>
${d.references.length ? html`<footer class="entry-foot wrap">
  <section class="refs">
    <h2>References</h2>
    <ol>${d.references.map(reference)}</ol>
  </section>
</footer>` : ''}
</article>
${related.length ? html`<section class="related wrap" aria-labelledby="related-h">
  <h2 id="related-h">More in ${related.map((r) => r.via).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).map((s) => esc(ctx.tags[s].name)).join(' and ')}</h2>
  ${cardGrid(ctx, related.map((r) => r.item), 3)}
</section>` : ''}
${scripts}`;
  return page(ctx, headOpts, null, 'page-content', main, footMeta);
}

// topics: [{ slug, items }] in order (build/order.mjs). The capsules under the
// title jump to the rows.
export function homePage(ctx, topics) {
  const main = html`<section class="hero wrap">
  <h1>${esc(ctx.site.tagline)}</h1>
  <nav class="hero-topics topics" aria-label="Topics">${topics.map((t) => `<a href="#${t.slug}">${esc(ctx.tags[t.slug].name)}</a>`).join('')}</nav>
</section>
${topics.map((t) => shelf(ctx, t))}`;
  return page(ctx, { url: '/' }, 'home', 'page-home', main);
}

export function tagsIndexPage(ctx, topics) {
  const main = html`<section class="wrap page-head">
  <h1>Topics</h1>
</section>
<section class="wrap">
  <ul class="topic-list">
  ${topics.map(({ slug, items }) => html`<li><a href="/tags/${slug}/"><span class="topic-name">${esc(ctx.tags[slug].name)}</span><span class="topic-count">${count(items.length)}</span></a></li>`)}
  </ul>
</section>`;
  return page(ctx, { title: 'Topics', description: `Topics on ${ctx.site.title}.`, url: '/tags/' }, 'tags', 'page-tags', main);
}

export function tagPage(ctx, { slug, items }) {
  const t = ctx.tags[slug];
  const main = html`<section class="wrap page-head">
  <p class="eyebrow"><a href="/tags/">Topics</a></p>
  <h1>${esc(t.name)}</h1>
</section>
<section class="wrap">
${cardGrid(ctx, items, 2, slug)}
</section>`;
  return page(ctx, { title: t.name, description: `${t.name} on ${ctx.site.title}.`, url: `/tags/${slug}/` }, 'tags', 'page-tag', main);
}

// A standalone page from site/pages/. Front matter: title, description, and
// optionally `wide: true` (full column instead of a text measure) and
// `dev_only: true` (built only by npm run dev, e.g. the component gallery).
// The text measure sits at the left of the page column, under the logo.
export function simplePage(ctx, p) {
  const main = html`<article class="wrap page-head">
<div${p.data.wide ? '' : ' class="prose"'}>
  <h1>${p.headingHtml}</h1>
${p.bodyHtml}
</div>
</article>`;
  return page(ctx, { title: p.data.title, description: p.data.description, url: p.url }, p.name, `page-${p.name}`, main);
}

// A page's card image, drawn by its thumb.html (see authoring.md):
// a page of exactly 1200×630 CSS pixels with the theme, the runtime, the
// page's own styles and macros, and MMThumb.canvas() for a canvas that fills it.
export function thumbPage(ctx, item, bodyHtml) {
  const { assets } = ctx;
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>${esc(item.data.title)}: card image</title>
<link rel="stylesheet" href="${assets['katex/katex.min.css']}">
<link rel="stylesheet" href="${assets['css/theme.css']}">
${item.styleUrls.map((s) => `<link rel="stylesheet" href="${esc(s)}">\n`)}<style>
html, body { margin: 0; }
body.mm-thumb { position: relative; width: 1200px; height: 630px; overflow: hidden; background: var(--paper); }
/* in a window wider than the image (npm run dev), the image framed on grey */
@media (min-width: 1240px) { html { background: var(--sunken); } body.mm-thumb { margin: 20px auto; box-shadow: 0 0 0 1px var(--rule); } }
</style>
<script type="application/json" id="mm-macros">${JSON.stringify(item.macros).replace(/</g, '\\u003c')}</script>
${item.data.katex_runtime ? `<script src="${assets['katex/katex.min.js']}"></script>\n` : ''}<script src="${assets['js/site.js']}"></script>
<script>
// MMThumb.canvas(): a canvas filling the image, at the device's pixel ratio;
// returns its context, in CSS pixels (1200 by 630).
window.MMThumb = { W: 1200, H: 630, canvas: function () {
  var c = document.createElement('canvas'), r = window.devicePixelRatio || 1;
  c.width = 1200 * r; c.height = 630 * r;
  c.style.cssText = 'position:absolute;left:0;top:0;width:1200px;height:630px';
  document.body.appendChild(c);
  var cx = c.getContext('2d');
  cx.scale(r, r);
  return cx;
} };
</script>
${ctx.dev ? '<script src="/__dev/reload.js"></script>' : ''}
</head>
<body class="mm-thumb">
${bodyHtml}
</body>
</html>
`;
}

export function notFoundPage(ctx) {
  const main = html`<section class="wrap prose page-head">
  <h1>Page not found</h1>
  <p class="lede">There is nothing at this address. It may have moved.</p>
  <p><a href="/">See all pages</a> or <a href="/tags/">browse by topic</a>.</p>
</section>`;
  return page(ctx, { title: 'Page not found', url: '/404.html' }, null, 'page-404', main);
}

export function feed(ctx, items) {
  const { site } = ctx;
  const updated = items.reduce((m, it) => {
    const d = it.updated;
    return d > m ? d : m;
  }, '1970-01-01');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(site.title)}</title>
  <subtitle>${esc(site.tagline)}</subtitle>
  <link href="${esc(abs(ctx, '/feed.xml'))}" rel="self"/>
  <link href="${esc(abs(ctx, '/'))}"/>
  <id>${esc(abs(ctx, '/'))}</id>
  <updated>${updated}T00:00:00Z</updated>
${items.map((it) => `  <entry>
    <title>${esc(it.data.title)}</title>
    <link href="${esc(abs(ctx, it.url))}"/>
    <id>${esc(abs(ctx, it.url))}</id>
    <published>${it.data.date}T00:00:00Z</published>
    <updated>${it.updated}T00:00:00Z</updated>
    <author><name>${esc(site.licence.holder)}</name></author>
    <summary>${esc(it.descriptionText)}</summary>
${it.data.tags.map((t) => `    <category term="${t}" label="${esc(ctx.tags[t].name)}"/>`).join('\n')}
  </entry>`).join('\n')}
</feed>
`;
}

export function sitemap(ctx, urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(abs(ctx, u.url))}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}
