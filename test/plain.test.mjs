import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texToPlain } from '../build/plain.mjs';
import { rewriteTex } from '../build/tex-scan.mjs';

const macros = { '\\RR': '\\mathbb{R}', '\\CC': '\\mathbb{C}', '\\GL': '\\operatorname{GL}' };

test('TeX in descriptions becomes Unicode for meta tags', () => {
  const cases = [
    ['Drag points in $\\RR^n$.', 'Drag points in ℝⁿ.'],
    ['An $E_n$-algebra', 'An Eₙ-algebra'],
    ['strata of $\\mathfrak{h}/\\!/W$', 'strata of 𝔥//W'],
    ['$\\GL_2(\\CC)$ and $x_1 = x_2$', 'GL₂(ℂ) and x₁ = x₂'],
    ['$\\frac{a+b}{2}$, $\\mathcal{V}^{hG}$', '(a+b)/2, 𝒱^(hG)'],
    ['$\\mathbb{1}_A$ costs \\$5', '𝟙_A costs $5'],
  ];
  for (const [src, want] of cases) assert.equal(texToPlain(src, macros), want);
});

test('rewriteTex: \\mathbb{1} and blackboard capital Greek', () => {
  assert.equal(rewriteTex('\\mathbb{1} + \\mathbb 1_A + \\mathbb{10}'), '𝟙 + 𝟙_A + \\mathbb{10}');
  assert.equal(rewriteTex('\\mathbb{\\Gamma}'), '\\mathbf{\\Gamma}');
  assert.equal(rewriteTex('\\mathbb{R}'), '\\mathbb{R}');
});
