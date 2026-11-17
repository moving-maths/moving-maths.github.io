// Design checks for pages. They keep pages on the shared components
// and tokens, so that a change in theme.css reaches every page. Each problem is
// a build warning (not an error):
//
//   1. A page's CSS restyles a theme component (paint properties such as
//      colour, background, border, shadow or font on .btn, .seg, .tab, …).
//      Set the component's tokens instead (--btn-*, --seg-*, …; theme.css).
//   2. A hard-coded colour in CSS (#hex, rgb(), hsl()) or in a script ('#hex').
//      Use a token: var(--c3) in CSS, MM.color('c3') in scripts.
//   3. A font named in CSS. Use var(--sans), var(--math) or var(--mono).
//
// A CSS rule that has a good reason opts out with a comment in it (or just
// before it) containing "design-ok", e.g. /* design-ok: the label takes its
// side's colour */.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, lineIndex, isUrl } from './config.mjs';

const COMPONENT = /(^|[^\w-])(\.(btn|seg|tab|tabs|toggle|readout|chip|note|panel|badge|dot|swatch|legend|legend-line|kv|data-table|control-bar|topics|slider|label|eyebrow|hint|caption|lede|menu|fig-menu|fig-overlay|side-title|side-kind|side-sub|handle|strip|strip-block|strip-head|strip-group|strip-item|strip-name)(?![\w-])|input\[type=["']?range|::-(webkit|moz)-(slider|range))/;

// What a selector styles: its last compound. It restyles a component when that
// compound is a component (.btn, .seg.wide, input[type=range]) or a bare
// element whose nearest classed ancestor is one (.seg > button, .data-table th).
// Content of the page's own inside a component (.readout .kind) is not.
function restyledComponent(selector) {
  const compounds = selector.replace(/\([^)]*\)|\[[^\]]*\]/g, (m) => m.replace(/[\s>+~]/g, '_')).split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  const original = selector.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
  const subject = original[original.length - 1] || '';
  if (COMPONENT.test(subject)) return subject;
  if (/[.#]/.test(compounds[compounds.length - 1] || '.')) return null; // the page's own class
  for (let i = compounds.length - 2; i >= 0; i--) {
    if (/[.#]/.test(compounds[i])) return COMPONENT.test(original[i] || '') ? original.slice(i).join(' ') : null;
  }
  return null;
}
const PAINT = /^(background(-color|-image)?|color|border(-[a-z-]+)?|box-shadow|outline(-[a-z]+)?|font(-[a-z]+)?|letter-spacing|text-transform|text-decoration(-[a-z]+)?)$/;
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(\s*\d/;


export function lintCss(src, file) {
  const out = [];
  let lineOf = null; // built on the first warning
  const lineAt = (s, i) => (lineOf || (lineOf = lineIndex(s)))(i);
  // blank out comments (keeping offsets), remembering where "design-ok" ones are
  const okAt = [];
  const css = src.replace(/\/\*[\s\S]*?\*\//g, (m, i) => {
    if (/design-ok/.test(m)) okAt.push(i);
    return m.replace(/[^\n]/g, ' ');
  });
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const selector = m[1].trim();
    if (!selector || selector.startsWith('@')) continue;
    const start = m.index, end = m.index + m[0].length;
    // an opt-out comment inside the rule, or within the 200 characters before it
    if (okAt.some((i) => i >= start - 200 && i < end && !/[{}]/.test(css.slice(i, start)))) continue;
    const bodyStart = m.index + m[1].length + 1;
    const component = selector.split(',').map((s) => s.trim()).map(restyledComponent).find(Boolean);
    let offset = 0;
    for (const decl of m[2].split(';')) {
      const at = bodyStart + offset;
      offset += decl.length + 1;
      const c = decl.indexOf(':');
      if (c < 0) continue;
      const prop = decl.slice(0, c).trim().toLowerCase();
      const value = decl.slice(c + 1).trim();
      if (!prop || prop.startsWith('--')) {
        if (prop.startsWith('--') && COLOUR.test(value)) out.push({ file, line: lineAt(src, at + decl.search(/\S/)), message: `hard-coded colour in ${prop}; use a token (var(--…))` });
        continue;
      }
      const line = () => lineAt(src, at + decl.search(/\S/));
      if (component && PAINT.test(prop)) {
        const name = (/\.([a-z-]+)/.exec(component.match(COMPONENT)[0]) || [, 'slider'])[1];
        out.push({ file, line: line(), message: `restyles .${name} (${prop}) in \`${component}\`; set its tokens (--${name.replace(/s$/, '')}-…) instead, or mark the rule /* design-ok: why */` });
      }
      if (COLOUR.test(value)) out.push({ file, line: line(), message: `hard-coded colour (${prop}: ${value.slice(0, 40)}); use a token (var(--…))` });
      if ((prop === 'font-family' && !/^(var\(|inherit$)/.test(value)) || (prop === 'font' && !/var\(|inherit/.test(value))) {
        out.push({ file, line: line(), message: `font named in ${prop}; use var(--sans), var(--math) or var(--mono)` });
      }
    }
  }
  return out;
}

export function lintJs(src, file) {
  const out = [];
  const re = /(['"`])#[0-9a-fA-F]{3,8}\1/g;
  let m, lineOf = null;
  while ((m = re.exec(src))) {
    out.push({ file, line: (lineOf || (lineOf = lineIndex(src)))(m.index), message: `hard-coded colour ${m[0]}; use MM.color('…') with a theme token` });
  }
  return out;
}

// All design warnings for one page (its own CSS and scripts).
export function lintPage(item, root = ROOT) {
  const out = [];
  for (const [list, lint] of [[item.data.styles, lintCss], [item.data.scripts, lintJs]]) {
    for (const f of list) {
      if (isUrl(f)) continue;
      const p = path.join(item.dir, f);
      if (fs.existsSync(p)) out.push(...lint(fs.readFileSync(p, 'utf8'), path.relative(root, p)));
    }
  }
  return out;
}
