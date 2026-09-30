---
"@repo/contents": patch
"www": patch
---

Render surah verses in document flow so surah pages load without layout shift.
The outline reaches any verse through its fragment link, parsed headings no
longer carry a virtual list index, and Quran routes preload both Amiri subsets
that verses render.
