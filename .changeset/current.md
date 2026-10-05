---
"www": patch
"@repo/design-system": patch
---

Mark only the page the reader is on as current. `NavigationLink` guessed the
current page from one route segment, which inside the app shell fell back to
the home path and marked the home link as the current page on every app page.
It now compares its path with the page's path exactly, so the sidebar, header,
and footer mark the link to the page on screen, and a section link stays
unmarked on the section's nested pages.
