// Parses a small subset of LaTeX macro definitions into a KaTeX macro map.
//
//   \newcommand{\RR}{\mathbb{R}}
//   \newcommand\abs[1]{\left|#1\right|}
//   \renewcommand{\phi}{\varphi}
//   \DeclareMathOperator{\Hom}{Hom}
//   \DeclareMathOperator*{\colim}{colim}
//
// `%` starts a comment. KaTeX infers the number of arguments from the
// highest #n in the body, so a declared [n] must match the arguments the body
// uses: \newcommand{\ignore}[1]{} would otherwise read no argument at all.

function stripComments(src) {
  return src.split('\n').map((line) => {
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '\\') { i++; continue; }
      if (line[i] === '%') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

function skipSpace(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

// Reads `{…}` (balanced) or a single control sequence at i.
function readArg(s, i) {
  i = skipSpace(s, i);
  if (s[i] === '{') {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '\\') { j++; continue; }
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { depth--; if (depth === 0) return { value: s.slice(i + 1, j), end: j + 1 }; }
    }
    throw new Error('Unbalanced braces');
  }
  const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
  if (m) return { value: m[0], end: i + m[0].length };
  throw new Error('Expected an argument');
}

export function parseMacros(src, fileName = 'macros') {
  const s = stripComments(src);
  const macros = {};
  const re = /\\(newcommand|renewcommand|providecommand|DeclareMathOperator)(\*?)/g;
  let m;
  while ((m = re.exec(s))) {
    const lineOf = () => s.slice(0, m.index).split('\n').length;
    try {
      let { value: name, end } = readArg(s, re.lastIndex);
      name = name.trim();
      if (!/^\\[a-zA-Z]+$/.test(name)) throw new Error(`Bad macro name ${name}`);
      let i = skipSpace(s, end);
      let declared = 0;
      if (m[1] !== 'DeclareMathOperator' && s[i] === '[') {
        const close = s.indexOf(']', i);
        if (!/^\d$/.test(s.slice(i + 1, close).trim())) throw new Error('Bad argument count');
        declared = +s.slice(i + 1, close).trim();
        i = close + 1;
        if (s[skipSpace(s, i)] === '[') throw new Error('Optional arguments are not supported');
      }
      const body = readArg(s, i);
      if (m[1] !== 'DeclareMathOperator') {
        const used = Math.max(0, ...Array.from(body.value.matchAll(/#(\d)/g), (a) => +a[1]));
        if (used !== declared) {
          throw new Error(`${name} declares ${declared} argument(s) but its body uses ${used ? `#1…#${used}` : 'none'}; KaTeX counts the arguments a body uses, so make them agree`);
        }
      }
      macros[name] = m[1] === 'DeclareMathOperator'
        ? `\\operatorname${m[2]}{${body.value}}`
        : body.value;
      re.lastIndex = body.end;
    } catch (err) {
      throw new Error(`${fileName}:${lineOf()}: ${err.message}`);
    }
  }
  return macros;
}
