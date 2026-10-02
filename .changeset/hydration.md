---
"www": patch
"@repo/design-system": patch
---

Keep the server-rendered body of lessons through hydration. The session
settles while a page may still be hydrating, and its update re-rendered the
providers above the lesson, so React discarded the lesson's server HTML and
rendered it again on the client. The session is now read deferred, so React
applies it in a transition and finishes hydrating the page first.
`NavigationLink` no longer guesses the current page from one route segment,
which marked the home link as the current page across the app; the sidebar
marks its active links instead.
