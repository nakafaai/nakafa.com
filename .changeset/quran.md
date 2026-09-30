---
"www": patch
---

Render a surah's leading verses in document flow so surah pages load without
layout shift, and keep later verses virtualized below the fold. Declare the
Quran typeface on every page without preloads, so prefetching a Quran route no
longer downloads Amiri on other pages, and show Quran text only once Amiri has
loaded.
