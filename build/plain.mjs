// TeX to plain Unicode text, for places that cannot show KaTeX: <meta> tags,
// link previews, the feed. "$\RR^n$" becomes "ℝⁿ", "$E_n$" becomes "Eₙ",
// "$\mathfrak h/\!/W$" becomes "𝔥//W". Works from KaTeX's MathML, so macros and
// fonts are resolved exactly as on the page. The conversion itself is in
// plain-core.mjs, which the browser runtime shares.
import katex from 'katex';
import { transformMath, rewriteTex } from './tex-scan.mjs';
import { mathmlToPlain } from './plain-core.mjs';

export function mathToPlain(tex, macros = {}) {
  const mathml = katex.renderToString(rewriteTex(tex), { output: 'mathml', throwOnError: false, strict: 'ignore', macros: { ...macros } });
  return mathmlToPlain(mathml);
}

// Text with $…$ maths → plain text.
export function texToPlain(text, macros = {}) {
  return transformMath(String(text), (tex) => mathToPlain(tex, macros), () => {}, { glue: false }).replace(/\s+/g, ' ').trim();
}
