---
"www": patch
"@repo/design-system": patch
---

Open the next lesson or surah at once instead of on an empty page. The
Previous and Next links below a lesson or surah now load the neighbouring page
as they come into view, so a press shows it without waiting for the server, on
phones too. Article cards and links inside a lesson's text load their page when
the reader hovers, focuses, or touches them. A first visit no longer undoes
this: the privacy link in the usage-data prompt, like the policy links in the
site footer, no longer prefetches, because a prefetched policy page made the
app read every lesson address as a policy page, so the next lesson never loaded
ahead and opening it showed the marketing layout first. Previous and Next are
now announced as links rather than buttons, and a missing neighbour is no longer
an empty link that the keyboard could reach.
