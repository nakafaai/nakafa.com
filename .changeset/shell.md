---
"@repo/backend": patch
"@repo/design-system": patch
"@repo/internationalization": patch
"www": patch
---

Keep one app shell on screen across try-out navigation. The catalog, every set,
and every section share one shell, so moving between them no longer blanks the
page. Country, exam, and track pages are prerendered whole. A set or section
paints its heading, its section list or facts, and its durations from the
catalog while the learner's attempt loads, and only the action and the score
wait for it. A running attempt takes the whole screen in that same shell,
already in its first paint, and locking or unlocking it never moves the page.
A track row whose attempt is running opens that attempt directly, a section of
a running attempt links back to that attempt's set, and a public set or section
link to a running attempt shows it in place instead of redirecting through an
empty page. A locked sidebar keeps its open state for when the lock ends, and
local acceptance can sign in synthetic learners for browser tests.
