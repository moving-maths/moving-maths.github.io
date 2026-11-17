// Citations: turns `[@key]` in a page's body into numbered links to
// its reference list (numbered in list order, which is by author surname).
//
//   [@jones1985]                  → [12]
//   [@lickorish1987, §2]          → [8, §2]
//   [@freyd1985; @przytycki1987]  → [7, 19]   (sorted by number)
//   [@conway1970; @fox1962, §3]   → [4; 9, §3]
//
// Each number is its own link (a.cite-ref, href="#ref-<key>"); site.js shows
// the reference in a small card when it is pointed at or tapped. The space
// before a citation becomes a no-break space, so the number never starts a
// line. A locator may contain TeX (rendered afterwards with the rest).
//
// Skipped (copied verbatim): comments and <script> <style> <textarea> <pre>
// <code> <svg> <template> elements.
//
// Shared by the build (Node) and the browser runtime, which inlines it into
// /assets/js/site.js (without `export`) so that MM.setHTML numbers citations
// in text that scripts write. Keep it free of imports, and keep its names
// prefixed (cite…, CITE_…): they share site.js's scope.

const CITE_SKIP = /<!--[\s\S]*?-->|<(script|style|textarea|pre|code|svg|template)\b[\s\S]*?<\/\1\s*>/iy;
const CITE_RE = /( ?)\[(@[^\]\n]*)\]/y;
const CITE_PART = /^@([A-Za-z0-9][\w-]*)\s*(?:,\s*(\S[\s\S]*?))?\s*$/;

// citeRefs(src, refs) -> { html, problems: [{ offset, message }], used: Set<key> }
//   refs: the reference list, in order, as [{ key }]
export function citeRefs(src, refs) {
  const number = new Map(refs.map((r, i) => [r.key, i + 1]));
  const problems = [];
  const used = new Set();
  let out = '';
  let i = 0;
  while (i < src.length) {
    const j = citeNext(src, i);
    if (j < 0) { out += src.slice(i); break; }
    out += src.slice(i, j);
    CITE_SKIP.lastIndex = j;
    const skip = CITE_SKIP.exec(src);
    if (skip) { out += skip[0]; i = CITE_SKIP.lastIndex; continue; }
    CITE_RE.lastIndex = j;
    const m = src[j] === '<' ? null : CITE_RE.exec(src);
    if (!m) {
      if (src.startsWith('[@', j)) problems.push({ offset: j, message: 'citation "[@" is not closed by "]" on the same line' });
      out += src[j]; i = j + 1; continue;
    }
    const items = [];
    let bad = false;
    for (const part of m[2].split(';')) {
      const p = CITE_PART.exec(part.trim());
      if (!p) { problems.push({ offset: j, message: `citation "${m[0].trim()}": write [@key], [@key, locator] or [@a; @b]` }); bad = true; break; }
      if (!number.has(p[1])) { problems.push({ offset: j, message: `citation of "${p[1]}", which is not a key in \`references\`` }); bad = true; continue; }
      used.add(p[1]);
      items.push({ key: p[1], n: number.get(p[1]), loc: p[2] });
    }
    if (bad) { out += m[0]; i = CITE_RE.lastIndex; continue; }
    items.sort((a, b) => a.n - b.n);
    const sep = items.some((it) => it.loc) ? '; ' : ', ';
    const inner = items.map((it) => `<a class="cite-ref" href="#ref-${it.key}">${it.n}</a>${it.loc ? `, ${it.loc}` : ''}`).join(sep);
    out += `${m[1] ? '&nbsp;' : ''}<span class="cite">[${inner}]</span>`;
    i = CITE_RE.lastIndex;
  }
  return { html: out, problems, used };
}

// next place where a skipped element or a citation may start
function citeNext(src, from) {
  for (let k = from; k < src.length; k++) {
    const ch = src[k];
    if (ch === '<') return k;
    if (ch === '[' && src[k + 1] === '@') return k > from && src[k - 1] === ' ' ? k - 1 : k;
  }
  return -1;
}
