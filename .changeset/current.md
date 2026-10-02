---
"www": patch
"@repo/design-system": patch
---

Mark only the page the reader is on as current in the sidebar.
`NavigationLink` guessed the current page from one route segment, which
inside the app shell fell back to the home path and marked the home link as
the current page on every app page. It now renders the link, and the sidebar
sets `aria-current="page"` only on the link whose path matches the page
exactly, while a section stays highlighted on its nested pages.
