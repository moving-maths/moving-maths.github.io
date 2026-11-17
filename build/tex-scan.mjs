// Finds TeX in an HTML string and replaces it with rendered output.
//
// This file is shared by the build (Node) and the browser runtime: the build
// inlines it into /assets/js/site.js, stripping the `export` keywords. Keep it
// free of imports and of Node- or browser-only APIs.
//
// Delimiters (outside of tags, comments and skipped elements):
//   $…$  \(…\)       inline maths
//   $$…$$  \[…\]     display maths
//   \$               a literal dollar sign
// An inline $ opens only when the next character is not whitespace, and closes
// only when the previous character is not whitespace and the next is not a
// digit. Maths may not run across a blank line.
//
// Skipped (copied verbatim): <script> <style> <textarea> <pre> <code> <svg>
// <math> <template> <noscript> <title>, any element with a `data-notex`
// attribute, and any element whose class list contains `notex` or `katex`
// (so already-rendered maths is never rendered twice).
//
// Maths may not run into a closing tag or a comment: "$x</p><p>y$" is an
// error (an unclosed $), not one formula swallowing the markup.
//
// The renderer is told whether the maths sits inside an element whose
// accessible name comes from its content (a button, link, heading, label, or
// an element with such a role), so it can give the formula a plain-text name.

const TEX_SKIP_TAGS = {
  script: 1, style: 1, textarea: 1, pre: 1, code: 1, svg: 1, math: 1,
  template: 1, noscript: 1, title: 1,
};
const TEX_RAW_TAGS = { script: 1, style: 1, textarea: 1, title: 1 };
const TEX_VOID_TAGS = {
  area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1,
  link: 1, meta: 1, source: 1, track: 1, wbr: 1,
};
// elements whose accessible name is computed from their content
const TEX_NAME_TAGS = {
  a: 1, button: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, summary: 1,
  label: 1, legend: 1, caption: 1, option: 1, th: 1,
};
const TEX_NAME_ROLES = /\srole\s*=\s*["']?(button|link|tab|radio|checkbox|switch|option|menuitem|menuitemradio|menuitemcheckbox|heading|treeitem)\b/i;

function texIsSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

// Index just past the `>` that ends the tag starting at `i`. Quotes delimit
// only attribute values (right after `=`), so alt=it's does not open a quote.
function texTagEnd(src, i) {
  let q = null, afterEq = false;
  for (let j = i + 1; j < src.length; j++) {
    const ch = src[j];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '>') return j + 1;
    if (afterEq && (ch === '"' || ch === "'")) { q = ch; afterEq = false; continue; }
    if (ch === '=') afterEq = true;
    else if (!texIsSpace(ch)) afterEq = false;
  }
  return src.length;
}

// Index just past the close tag matching an open `name` element whose start
// tag ended at `from`. Nested elements of the same name are counted. (Searches
// case-insensitively in place: no lowercased copy, so offsets stay right and
// the cost does not grow with the number of skipped elements.)
function texCloseOf(src, from, name) {
  if (TEX_RAW_TAGS[name]) {
    const closeRe = new RegExp('</' + name + '\\s*>', 'gi');
    closeRe.lastIndex = from;
    const m = closeRe.exec(src);
    return m ? m.index + m[0].length : src.length;
  }
  const re = new RegExp('<(/?)' + name + '(?=[\\s>/])', 'gi');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(src))) {
    const end = texTagEnd(src, m.index);
    if (m[1]) { depth--; if (depth === 0) return end; }
    else if (!/\/\s*>$/.test(src.slice(m.index, end))) depth++;
    re.lastIndex = end;
  }
  return src.length;
}

function texShouldSkip(name, tag) {
  if (TEX_SKIP_TAGS[name]) return true;
  if (/\sdata-notex(?=[\s=>\/])/i.test(tag)) return true;
  const cls = /\sclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  if (cls) {
    const list = (cls[2] || cls[3] || cls[4] || '').split(/\s+/);
    for (const c of list) if (c === 'notex' || c === 'katex' || c === 'katex-display') return true;
  }
  return false;
}

// The site's changes to TeX before KaTeX sees it (as in new-banana): \mathbb{1}
// becomes 𝟙, which the BananaMath font draws (theme.css), and \mathbb of a capital
// Greek letter, which has no double-struck form, becomes bold.
export function rewriteTex(tex) {
  return tex
    .replace(/\\mathbb\s*\{\s*\\(Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)\s*\}/g, '\\mathbf{\\$1}')
    .replace(/\\mathbb\s*(?:\{\s*1\s*\}|1(?![0-9]))/g, '\u{1D7D9}');
}

export function decodeEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos|nbsp);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      // not a character (too large, or a lone surrogate): leave it as written
      if (!(code <= 0x10FFFF) || (code >= 0xD800 && code <= 0xDFFF)) return m;
      return String.fromCodePoint(code);
    }
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }[e];
  });
}

// Find the end of the maths that starts at `start` (just after the opening
// delimiter). Returns the index of the closing delimiter, -1 if there is none
// before a blank line, or -2 if the maths runs into a closing tag or comment.
function texFindClose(src, start, close, inlineDollar) {
  for (let j = start; j < src.length; j++) {
    const ch = src[j];
    if (ch === '<' && (src[j + 1] === '/' && /[a-zA-Z]/.test(src[j + 2] || '') || src.startsWith('<!--', j))) return -2;
    if (ch === '\\') {
      if (close[0] === '\\' && src.startsWith(close, j)) return j;
      j++; // skip the escaped character
      continue;
    }
    if (ch === '\n') {
      // no blank lines inside maths
      let k = j + 1;
      while (k < src.length && (src[k] === ' ' || src[k] === '\t' || src[k] === '\r')) k++;
      if (src[k] === '\n') return -1;
      continue;
    }
    if (close[0] !== '\\' && src.startsWith(close, j)) {
      if (!inlineDollar) return j;
      if (!texIsSpace(src[j - 1]) && !/[0-9]/.test(src[j + 1] || '')) return j;
    }
  }
  return -1;
}

// transformMath(src, render, onError, options) -> string
//   render(tex, display, offset) returns HTML; it may throw.
//   onError(message, offset, tex) is called for unclosed delimiters and for
//   errors thrown by render; the source text is then kept as it was.
//   render(tex, display, offset, { name }) is told whether the maths is inside
//   an element named by its content (see above).
//   options.glue (default true): wrap a short inline formula and the punctuation
//   after it in <span class="tex-nowrap">, so a line cannot break between them.
//   options.name: the whole of `src` is inside such an element (e.g. it will
//   become a button's content).
export function transformMath(src, render, onError, options) {
  const glue = !options || options.glue !== false;
  const baseName = !!(options && options.name);
  let out = '';
  let i = 0;
  let textStart = 0;
  const n = src.length;
  const report = (msg, at, tex) => { if (onError) onError(msg, at, tex); };
  // open elements, for knowing whether we are inside a name-from-content one
  const stack = [];
  let named = 0;

  while (i < n) {
    const ch = src[i];

    if (ch === '<') {
      if (src.startsWith('<!--', i)) {
        const e = src.indexOf('-->', i + 4);
        i = e < 0 ? n : e + 3;
        continue;
      }
      const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(src.slice(i, i + 64));
      if (m) {
        const end = texTagEnd(src, i);
        const name = m[1].toLowerCase();
        const tag = src.slice(i, end);
        const selfClosing = /\/\s*>$/.test(tag) || TEX_VOID_TAGS[name];
        if (!selfClosing && texShouldSkip(name, tag)) { i = texCloseOf(src, end, name); continue; }
        if (!selfClosing) {
          const isName = !!(TEX_NAME_TAGS[name] || TEX_NAME_ROLES.test(tag));
          stack.push({ name, isName });
          if (isName) named++;
        }
        i = end;
        continue;
      }
      if (src[i + 1] === '/') {
        const closing = /^<\/([a-zA-Z][a-zA-Z0-9-]*)/.exec(src.slice(i, i + 64));
        if (closing) {
          const name = closing[1].toLowerCase();
          for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k].name !== name) continue;
            while (stack.length > k) { if (stack.pop().isName) named--; }
            break;
          }
        }
        i = texTagEnd(src, i);
        continue;
      }
      if (src[i + 1] === '!' || src[i + 1] === '?') {
        i = texTagEnd(src, i);
        continue;
      }
      i++;
      continue;
    }

    let open = null, close = null, display = false, inlineDollar = false;
    if (ch === '\\') {
      const d = src[i + 1];
      if (d === '$') {
        out += src.slice(textStart, i) + '$';
        i += 2;
        textStart = i;
        continue;
      }
      if (d === '(') { open = '\\('; close = '\\)'; }
      else if (d === '[') { open = '\\['; close = '\\]'; display = true; }
      else { i += 2; continue; }
    } else if (ch === '$') {
      if (src[i + 1] === '$') { open = '$$'; close = '$$'; display = true; }
      else if (i + 1 < n && !texIsSpace(src[i + 1])) { open = '$'; close = '$'; inlineDollar = true; }
      else { i++; continue; }
    } else {
      i++;
      continue;
    }

    const start = i + open.length;
    const end = texFindClose(src, start, close, inlineDollar);
    if (end < 0) {
      report(end === -2
        ? 'Unclosed ' + open + ': the maths runs into a closing tag (write \\$ for a literal dollar sign)'
        : 'Unclosed ' + open + ' (write \\$ for a literal dollar sign)', i, src.slice(start, start + 40));
      i = start;
      continue;
    }
    const tex = decodeEntities(src.slice(start, end));
    let html;
    try {
      html = render(tex, display, start, { name: baseName || named > 0 });
    } catch (err) {
      report(String(err && err.message || err), start, tex);
      i = end + close.length;
      continue;
    }
    i = end + close.length;
    // Keep punctuation right after a short inline formula on the same line as it
    // ("… and $\Ran$: four spaces", not a colon starting the next line).
    const punct = glue && !display && tex.length <= 40 ? /^[.,;:!?)\]\u2019\u201d]+/.exec(src.slice(i, i + 8)) : null;
    if (punct) {
      out += src.slice(textStart, start - open.length) + '<span class="tex-nowrap">' + html + punct[0] + '</span>';
      i += punct[0].length;
    } else {
      out += src.slice(textStart, start - open.length) + html;
    }
    textStart = i;
  }
  return out + src.slice(textStart);
}
