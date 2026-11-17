// MathML (as KaTeX writes it) to plain Unicode text, and plain-text names for
// formulas. Shared by the build (plain.mjs, tex.mjs) and the browser runtime:
// the build inlines this file into /assets/js/site.js, stripping `export`.
// Keep it free of imports and of Node- or browser-only APIs.

const PLAIN_SUP = {
  0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '−': '⁻', '-': '⁻',
  '=': '⁼', '(': '⁽', ')': '⁾', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ',
  k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ',
  y: 'ʸ', z: 'ᶻ', '∗': '*', '*': '*', '′': '′', '∘': '°',
};
const PLAIN_SUB = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '−': '₋', '-': '₋',
  '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ',
  p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};
// Mathematical alphanumerics: start of A–Z, start of a–z (0: none), holes.
const PLAIN_VARIANTS = {
  'double-struck': [0x1D538, 0x1D552, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }],
  fraktur: [0x1D504, 0x1D51E, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }],
  script: [0x1D49C, 0x1D4B6, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' }],
  bold: [0x1D400, 0x1D41A, {}],
};
const PLAIN_SPACED = '=<>≤≥≠≅≃≈∼≡∈∉⊂⊃⊆⊇→←↦⟶⟼↪↠⇒⇔⇄≔+−×⋅⊕⊗∘∪∩∧∨∖|';

function plainDecode(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos|nbsp);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code <= 0x10FFFF && !(code >= 0xD800 && code <= 0xDFFF) ? String.fromCodePoint(code) : m;
    }
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' }[e];
  });
}

function plainStyled(text, variant) {
  const v = PLAIN_VARIANTS[variant];
  if (!v) return text;
  return Array.from(text).map((ch) => {
    if (v[2][ch]) return v[2][ch];
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(v[0] + c - 65);
    if (c >= 97 && c <= 122 && v[1]) return String.fromCodePoint(v[1] + c - 97);
    if (variant === 'double-struck' && ch === '1') return '𝟙';
    return ch;
  }).join('');
}

function plainScript(text, table, mark) {
  const chars = Array.from(text);
  if (chars.length && chars.every((c) => table[c])) return chars.map((c) => table[c]).join('');
  return mark + (chars.length === 1 ? text : '(' + text + ')');
}

// A tiny MathML parser: just enough for KaTeX's output.
function plainParse(src) {
  const root = { tag: '#root', attrs: '', children: [] };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.children.push({ text: plainDecode(m[5]) }); continue; }
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const node = { tag: m[2], attrs: m[3], children: [] };
    top.children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

function plainAttr(node, name) {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(node.attrs || '');
  return m ? m[1] : null;
}

function plainNode(node, depth) {
  if (node.text !== undefined) return node.text;
  const kids = node.children;
  const all = () => kids.map((k) => plainNode(k, depth)).join('');
  switch (node.tag) {
    case 'annotation': case 'mphantom': return '';
    case 'mspace': return parseFloat(plainAttr(node, 'width') || '0') >= 0.25 ? ' ' : '';
    case 'mi': case 'mn': return plainStyled(all(), plainAttr(node, 'mathvariant'));
    case 'mtext': {
      // KaTeX writes spacing commands (\! \, \quad) as thin and invisible characters
      const t = all().replace(/[    ⁡-⁤​]/g, '');
      return t.trim() === '' ? (t.length ? ' ' : '') : plainStyled(t, plainAttr(node, 'mathvariant'));
    }
    case 'mo': {
      const t = all().replace(/[⁡⁢⁣]/g, '');
      return depth === 0 && t.length === 1 && PLAIN_SPACED.indexOf(t) >= 0 ? ' ' + t + ' ' : t;
    }
    case 'msup': return plainNode(kids[0], depth) + plainScript(plainNode(kids[1], depth + 1).trim(), PLAIN_SUP, '^');
    case 'msub': return plainNode(kids[0], depth) + plainScript(plainNode(kids[1], depth + 1).trim(), PLAIN_SUB, '_');
    case 'msubsup': return plainNode(kids[0], depth) + plainScript(plainNode(kids[1], depth + 1).trim(), PLAIN_SUB, '_') + plainScript(plainNode(kids[2], depth + 1).trim(), PLAIN_SUP, '^');
    case 'mfrac': {
      const wrap = (s) => (/[\s+−-]/.test(s.trim()) ? '(' + s.trim() + ')' : s.trim());
      return wrap(plainNode(kids[0], depth + 1)) + '/' + wrap(plainNode(kids[1], depth + 1));
    }
    case 'msqrt': return '√(' + all().trim() + ')';
    case 'mover': case 'munder': case 'munderover': return plainNode(kids[0], depth);
    default: return all();
  }
}

// KaTeX's MathML for one formula → plain text ("ℝⁿ", "x₁ = x₂", "𝔥//W").
export function mathmlToPlain(mathml) {
  return plainNode(plainParse(mathml), 0).replace(/\s+/g, ' ').trim();
}

// Gives a KaTeX formula a plain-text accessible name: role="math" with an
// aria-label, and its MathML hidden from assistive technology. Used where the
// formula is part of a control's, link's or heading's name, which browsers do
// not compute from MathML.
export function labelKatex(html) {
  const m = /<math[\s\S]*?<\/math>/.exec(html);
  if (!m) return html;
  const name = mathmlToPlain(m[0]).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return html
    .replace('<span class="katex">', '<span class="katex" role="math" aria-label="' + name + '">')
    .replace('<span class="katex-mathml">', '<span class="katex-mathml" aria-hidden="true">');
}
