---
"www": patch
"@repo/design-system": patch
---

Mark only the page the reader is on as current in the sidebar.
`NavigationLink` guessed the current page from one route segment, which
inside the app shell fell back to the home path and marked the home link as
the current page on every app page. It now renders the link, and the sidebar
marks its active links with `aria-current` from the active state it already
computes.
