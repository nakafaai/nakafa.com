---
"@repo/design-system": patch
"www": patch
---

Send lessons with a lighter page payload. Each formula now travels in the page's
RSC payload as packed KaTeX markup, a small fraction of its former size, and the
formula's client leaf restores the exact markup, so every formula draws the
same. Line-equation cards send their authored points as flat coordinates at the
32-bit precision WebGL draws them with, instead of one object per point.
