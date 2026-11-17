import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMacros } from '../build/macros.mjs';

test('parses newcommand, arguments and operators', () => {
  const m = parseMacros(String.raw`
% a comment \newcommand{\no}{no}
\newcommand{\RR}{\mathbb{R}}
\newcommand\abs[1]{\left|#1\right|}
\renewcommand{\phi}{\varphi} % trailing comment
\DeclareMathOperator{\Hom}{Hom}
\DeclareMathOperator*{\colim}{colim}
\newcommand{\pct}{50\%}
`);
  assert.deepEqual(m, {
    '\\RR': '\\mathbb{R}',
    '\\abs': '\\left|#1\\right|',
    '\\phi': '\\varphi',
    '\\Hom': '\\operatorname{Hom}',
    '\\colim': '\\operatorname*{colim}',
    '\\pct': '50\\%',
  });
});

test('reports the line of a bad definition', () => {
  assert.throws(() => parseMacros('\n\n\\newcommand{\\x}{unbalanced', 'f.tex'), /f\.tex:3: Unbalanced/);
});

test('the declared argument count must match the body', () => {
  assert.throws(() => parseMacros('\\newcommand{\\f}[2]{#1}', 'm.tex'), /m\.tex:1: \\f declares 2 argument\(s\) but its body uses #1…#1/);
  assert.throws(() => parseMacros('\n\\newcommand{\\g}{x_#1}', 'm.tex'), /m\.tex:2: \\g declares 0 argument\(s\)/);
  assert.deepEqual(parseMacros('\\newcommand{\\h}[2]{#2^{#1}}'), { '\\h': '#2^{#1}' });
});
