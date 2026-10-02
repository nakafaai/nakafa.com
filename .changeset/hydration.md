---
"@repo/design-system": patch
"www": patch
---

Keep the lesson the server streamed when it is opened for the first time. A
lesson rendered on demand arrives after the page starts up, and when the
sign-in session, the Convex sign-in, the usage data choice, or the phone
layout resolved before it, React threw the streamed lesson away and drew it
again in the browser. That happened on most first visits to a lesson, which
then showed its heading late and gave search engines a page without it. These
states now reach the components that read them without changing the shared
providers, so the lesson streams in once and stays.

The sidebar keeps its open state and the phone layout in a store, so opening,
closing, or resizing it no longer redraws streamed content either.

A press that lands while a lesson's charts and visuals are still loading now
works: the lesson no longer waits for their code before it responds, so its
outline, links, and other controls answer the first tap instead of losing it.
Only a visual whose own code is still loading waits for it.

Signed-out visitors keep their guest sidebar and sign-in prompts when they
return to the tab. The sign-in session is checked again on every return, and
during that check the page briefly treated the visitor as still loading, so
those parts disappeared and came back. The page now keeps the settled session
until the check answers. The try-out review's Ask Nina buttons also keep the
review the server streamed when the sign-in resolves, and the Convex sign-in
answers every token request that waits on a failed one instead of leaving one
of them broken.
