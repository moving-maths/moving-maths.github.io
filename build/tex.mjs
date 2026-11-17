// Build-time TeX rendering: wraps the shared scanner with KaTeX and turns
// offsets into file:line locations.
import katex from 'katex';
import { transformMath, rewriteTex } from './tex-scan.mjs';
import { labelKatex } from './plain-core.mjs';
import { lineIndex } from './config.mjs';

// renderTex(src, { macros, file, line, errors, warnings, name }) -> html
//   line: the file line on which `src` starts (for messages)
//   errors / warnings: arrays that messages are pushed to
//   name: `src` will be (part of) a link's, heading's or control's content
// A formula inside a button, link, heading or the like is given a plain-text
// accessible name (labelKatex), since browsers do not name controls from MathML.
export function renderTex(src, { macros, file, line = 1, errors, warnings, name = false }) {
  let lineOf = null; // built on first use: most texts have no problems to report
  const at = (offset) => line + (lineOf || (lineOf = lineIndex(src)))(offset) - 1;
  return transformMath(
    src,
    (tex, display, offset, context) => {
      const html = katex.renderToString(rewriteTex(tex), {
        displayMode: display,
        macros: { ...macros }, // KaTeX may add to the map; keep pages isolated
        throwOnError: true,
        strict: (code, msg) => {
          // 𝟙 (from \mathbb{1}) is drawn by the site's own font; KaTeX does not know it.
          if (/\u{1D7D9}|55349/u.test(msg) && /\u{1D7D9}/u.test(rewriteTex(tex))) return 'ignore';
          warnings?.push({ file, line: at(offset), message: `KaTeX: ${msg} in "${tex}"` });
          return 'ignore';
        },
        output: 'htmlAndMathml',
      });
      return context && context.name ? labelKatex(html) : html;
    },
    (message, offset, tex) => {
      errors?.push({ file, line: at(offset), message: `${message.replace(/^KaTeX parse error: /, 'TeX: ')}${tex ? ` in "${tex.slice(0, 60)}"` : ''}` });
    },
    { name },
  );
}
