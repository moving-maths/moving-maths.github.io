The fonts are served with the site, so a page makes no request to another server.

Inter: variable, weights 100–900, optical sizes 14–32, upright and italic; the Latin
subset, from Google Fonts (Inter v20, 13 November 2026).
https://github.com/google/fonts/tree/main/ofl/inter
Licence: Inter-OFL.txt

IBM Plex Mono: regular and medium; the Latin subset, from Google Fonts (v23).
https://github.com/google/fonts/tree/main/ofl/ibmplexmono
Licence: IBMPlexMono-OFL.txt

Noto Sans Math: regular, the whole font (v19). The browser fetches it only for a
character that the fonts before it lack.
https://github.com/google/fonts/tree/main/ofl/notosansmath
Licence: NotoSansMath-OFL.txt

MM Math (the figure-label font, built by tools/fonts/mm-math.py from KaTeX's fonts)
and Banana Math: OFL.txt.

A character outside the Latin subset (Greek in running text, say) falls back to
MM Math, which has KaTeX's glyphs. The build adds a hash of each font to its URL
in the CSS, so a changed font is fetched afresh.
