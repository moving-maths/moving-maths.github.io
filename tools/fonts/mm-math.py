"""Build the figure-label font, Moving Maths Math, from KaTeX's fonts.

Labels inside SVG figures and on canvases cannot be typeset by KaTeX, so they are
written in Unicode (x₁, 𝔭_α, ℂ, Σ₃). This font gives those characters the glyphs KaTeX
itself uses, so labels match the formulas around them:

- ASCII, upright Greek capitals, operators, relations and arrows: KaTeX_Main (and
  KaTeX_AMS for symbols Main lacks).
- Lowercase Greek, and the mathematical italic letters U+1D434…: KaTeX_Math (italic),
  as in TeX's maths mode.
- Bold U+1D400…, fraktur U+1D504… (and ℭℌℑℜℨ), script U+1D49C… (and ℬℰℱℋℐℒℳℛ, drawn
  with KaTeX_Caligraphic, i.e. \\mathcal): KaTeX_Main-Bold, KaTeX_Fraktur,
  KaTeX_Caligraphic.
- Double-struck U+1D538… (and ℂℍℕℙℚℝℤ) and 𝟙: BananaMath, the dsfont letters the site's
  KaTeX uses for \\mathbb (site/assets/fonts/BananaMath-Regular.woff2).
- Superscripts and subscripts U+2070…209C: KaTeX's digits, signs and italic letters,
  scaled by 0.7 and raised or lowered as TeX does; primes ′ ″ likewise, as in $x'$.
- Combining accents U+0300…030C: KaTeX's accents (\\bar, \\hat, …) as zero-width marks
  over the letter before, so "z̄" reads like $\\bar z$.

The italic face is TeX's maths mode: the same, except that the Latin letters are
KaTeX_Math's italic ones (digits and capital Greek stay upright). So a label set in
italic, such as "x₁ = x₂", reads like $x_1 = x_2$.

KaTeX's fonts are under the SIL Open Font License 1.1 with Reserved Font Names KaTeX_*,
so this modified version has its own name and keeps the licence (OFL.txt next to it).

Needs FontForge (with its Python module):
    fontforge -lang=py -script tools/fonts/mm-math.py
writes site/assets/fonts/MMMath-Regular.woff2 and MMMath-Italic.woff2.
"""
import os
import fontforge
import psMat

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KATEX = os.path.join(ROOT, 'node_modules', 'katex', 'dist', 'fonts')
OUT = os.path.join(ROOT, 'site', 'assets', 'fonts')


def load(name):
    path = name if os.path.isabs(name) else os.path.join(KATEX, name)
    f = fontforge.open(path)
    f.encoding = 'UnicodeFull'
    return f


MAIN = 'KaTeX_Main-Regular.ttf'
SRC = {
    'bold': load('KaTeX_Main-Bold.ttf'),
    'math': load('KaTeX_Math-Italic.ttf'),
    'frak': load('KaTeX_Fraktur-Regular.ttf'),
    'cal': load('KaTeX_Caligraphic-Regular.ttf'),
    'ams': load('KaTeX_AMS-Regular.ttf'),
    'bb': load(os.path.join(OUT, 'BananaMath-Regular.woff2')),
}
UPPER = [chr(c) for c in range(ord('A'), ord('Z') + 1)]
LOWER = [chr(c) for c in range(ord('a'), ord('z') + 1)]


def has(font, cp):
    try:
        return font[cp].isWorthOutputting()
    except (TypeError, KeyError, ValueError):
        return False


def put(dst, dst_cp, src, src_cp, scale=None, shift=0):
    """Copy src's glyph for src_cp into dst at dst_cp, optionally scaled and shifted."""
    if not has(src, src_cp):
        return False
    src.selection.none()
    src.selection.select(('unicode',), src_cp)
    src.copy()
    dst.createChar(dst_cp)
    dst.selection.none()
    dst.selection.select(('unicode',), dst_cp)
    dst.paste()
    g = dst[dst_cp]
    if scale:
        width = g.width
        g.transform(psMat.compose(psMat.scale(scale), psMat.translate(20, shift)))
        g.width = int(round(width * scale + 40))
    return True


def mark(dst, dst_cp, src, src_cp, centre):
    """Copy src's glyph for src_cp into dst at dst_cp as a combining mark: no width,
    its ink centred at x = centre (renderers without mark positioning draw it there,
    i.e. over the letter before)."""
    if not put(dst, dst_cp, src, src_cp):
        print('warning: no glyph for U+%04X' % src_cp)
        return False
    g = dst[dst_cp]
    x0, _, x1, _ = g.boundingBox()
    g.transform(psMat.translate(centre - (x0 + x1) / 2, 0))
    g.width = 0
    g.glyphclass = 'mark'
    return True


# Combining accents (for labels: $\bar z$ is set as z + U+0304) from KaTeX's spacing
# accents, the glyphs KaTeX itself draws for \grave … \check.
ACCENTS = {0x300: 0x2CB, 0x301: 0x2CA, 0x302: 0x2C6, 0x303: 0x2DC, 0x304: 0x2C9, 0x306: 0x2D8,
           0x307: 0x2D9, 0x308: 0xA8, 0x30A: 0x2DA, 0x30C: 0x2C7}


def alphabet(dst, start, letters, src, holes=None):
    """Map letters to the consecutive code points from start, with holes moved."""
    holes = holes or {}
    for i, ch in enumerate(letters):
        cp = holes.get(ch, start + i)
        put(dst, cp, src, ord(ch))


SUPERSCRIPTS = {'0': 0x2070, '1': 0xB9, '2': 0xB2, '3': 0xB3, '4': 0x2074, '5': 0x2075, '6': 0x2076,
                '7': 0x2077, '8': 0x2078, '9': 0x2079, '+': 0x207A, '−': 0x207B, '=': 0x207C,
                '(': 0x207D, ')': 0x207E}
SUPER_LETTERS = {'n': 0x207F, 'i': 0x2071}
SUBSCRIPTS = {'0': 0x2080, '1': 0x2081, '2': 0x2082, '3': 0x2083, '4': 0x2084, '5': 0x2085, '6': 0x2086,
              '7': 0x2087, '8': 0x2088, '9': 0x2089, '+': 0x208A, '−': 0x208B, '=': 0x208C,
              '(': 0x208D, ')': 0x208E}
SUB_LETTERS = {'a': 0x2090, 'e': 0x2091, 'o': 0x2092, 'x': 0x2093, 'h': 0x2095, 'k': 0x2096, 'l': 0x2097,
               'm': 0x2098, 'n': 0x2099, 'p': 0x209A, 's': 0x209B, 't': 0x209C}
GREEK_LOWER = list(range(0x3B1, 0x3CA)) + [0x3D1, 0x3D5, 0x3D6, 0x3F1, 0x3F5]


def build(italic):
    f = load(MAIN)
    main = load(MAIN)
    f.mergeFonts(os.path.join(KATEX, 'KaTeX_AMS-Regular.ttf'))  # adds only what Main lacks
    math, bold, frak, cal, bb = SRC['math'], SRC['bold'], SRC['frak'], SRC['cal'], SRC['bb']

    if italic:
        for ch in UPPER + LOWER:
            put(f, ord(ch), math, ord(ch))
        for cp in (0x131, 0x237):  # dotless i, j
            put(f, cp, math, cp)
    for cp in GREEK_LOWER:
        put(f, cp, math, cp)

    # Mathematical alphanumerics
    alphabet(f, 0x1D400, UPPER, bold)
    alphabet(f, 0x1D41A, LOWER, bold)
    for i in range(10):
        put(f, 0x1D7CE + i, bold, ord('0') + i)
    alphabet(f, 0x1D434, UPPER, math)
    alphabet(f, 0x1D44E, LOWER, math, {'h': 0x210E})
    for i, cp in enumerate(range(0x391, 0x3AA)):  # italic capital Greek, where KaTeX has it
        put(f, 0x1D6E2 + i, math, cp)
    for i, cp in enumerate(range(0x3B1, 0x3CA)):
        put(f, 0x1D6FC + i, math, cp)
    alphabet(f, 0x1D49C, UPPER, cal, {'B': 0x212C, 'E': 0x2130, 'F': 0x2131, 'H': 0x210B, 'I': 0x2110,
                                     'L': 0x2112, 'M': 0x2133, 'R': 0x211B})
    alphabet(f, 0x1D504, UPPER, frak, {'C': 0x212D, 'H': 0x210C, 'I': 0x2111, 'R': 0x211C, 'Z': 0x2128})
    alphabet(f, 0x1D51E, LOWER, frak)
    alphabet(f, 0x1D538, UPPER, bb, {'C': 0x2102, 'H': 0x210D, 'N': 0x2115, 'P': 0x2119, 'Q': 0x211A,
                                    'R': 0x211D, 'Z': 0x2124})
    put(f, 0x1D55C, bb, ord('k'))
    put(f, 0x1D7D9, bb, 0x1D7D9)

    # Superscripts and subscripts, from upright digits and signs and italic letters
    for ch, cp in SUPERSCRIPTS.items():
        put(f, cp, main, ord(ch), 0.7, 360)
    for ch, cp in SUPER_LETTERS.items():
        put(f, cp, math, ord(ch), 0.7, 360)
    for ch, cp in SUBSCRIPTS.items():
        put(f, cp, main, ord(ch), 0.7, -160)
    for ch, cp in SUB_LETTERS.items():
        put(f, cp, math, ord(ch), 0.7, -160)

    # Primes: KaTeX's prime is drawn to be shrunk into a superscript, as TeX sets x';
    # here it is shrunk and raised already, so "x′" in a label reads like $x'$.
    put(f, 0x2032, main, 0x2032, 0.7, 330)
    prime = f[0x2032]
    f.createChar(0x2033)
    double = f[0x2033]
    double.clear()
    double.addReference(prime.glyphname)
    double.addReference(prime.glyphname, psMat.translate(prime.width - 70, 0))
    double.width = 2 * prime.width - 70

    # Accents sit over a letter about half an em wide; an italic letter leans right,
    # so its accent moves right too. These replace AMS's wide hat and tilde.
    for cp, src_cp in ACCENTS.items():
        mark(f, cp, main, src_cp, -215 if italic else -250)

    style = 'Italic' if italic else 'Regular'
    f.familyname = 'Moving Maths Math'
    f.fontname = 'MovingMathsMath-' + style
    f.fullname = 'Moving Maths Math ' + style
    f.weight = 'Regular'
    f.italicangle = -14.04 if italic else 0
    f.copyright = ('Copyright (c) 2009-2010 Design Science, Inc.; Copyright (c) 2014-2018 Khan Academy; '
                   'BananaMath glyphs from new-banana (dsfont, Olaf Kummer); '
                   'modified for Moving Maths. SIL Open Font License 1.1.')
    f.sfnt_names = tuple(n for n in f.sfnt_names if n[1] not in ('UniqueID', 'Trademark'))
    f.appendSFNTName('English (US)', 'License', 'This Font Software is licensed under the SIL Open Font '
                     'License, Version 1.1. It is a Modified Version of the KaTeX fonts and uses none of '
                     'their Reserved Font Names.')
    f.appendSFNTName('English (US)', 'License URL', 'https://openfontlicense.org')
    f.appendSFNTName('English (US)', 'SubFamily', style)
    out = os.path.join(OUT, 'MMMath-%s.woff2' % style)
    f.generate(out)
    print('wrote', os.path.relpath(out, ROOT), len(list(f.glyphs())), 'glyphs')


build(False)
build(True)
