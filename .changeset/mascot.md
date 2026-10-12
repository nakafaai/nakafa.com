---
"@repo/mascot": minor
"@repo/design-system": minor
"www": patch
---

Draw every profile animal in code. The new package `@repo/mascot` holds 65 flat
animals, each with its own palettes, six poses, and four kinds of eyes, as typed
pictures made of one small vocabulary of shapes. A mascot is stored as one short
text, such as `cat.0.243e66.right.open`, and a text that names no mascot fails
to decode. A seed always gives the same animal, a cast never shows an animal
twice, and every ground stands out from the body by a contrast of 2.4 or more.
`Drawing` in the design system is the one place where a picture becomes SVG.

The contributor gallery now shows these animals, and `react-nice-avatar` is
gone, together with `chroma-js`, which only it used.
