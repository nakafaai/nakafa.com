---
"www": patch
---

Keep surah pages still while the Quran typeface loads. Amiri now follows the
Next.js font guidance: Quran text applies it, so it preloads only on surah
pages, and it displays optionally, so it never swaps in after the text is laid
out. Surah names use the interface font. In long surahs, the outline now
highlights the reading verse past verse 80, where the virtualized verses
begin, and drops the highlight once a verse scrolls away. On the Quran index,
the first row's highlight reaches the top of its card like the last row
reaches the bottom, and the page leaves room below the list.
