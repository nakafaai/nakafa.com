---
"@repo/design-system": patch
"www": patch
---

Preload only the fonts each page renders. The unused Geist Pixel faces leave
the font set and theme, Amiri moves to the Quran routes that render it at its
regular weight, and the sidebar logo no longer preloads on every app page.
