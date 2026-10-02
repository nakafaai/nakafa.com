---
"www": patch
---

Keep one app shell on screen across try-out navigation. The catalog, every set,
and every section share one shell, so moving from the catalog to a set or a
section no longer blanks the page. A page waits for its catalog content instead
of showing an empty frame, a set or section shows its heading while the
learner's attempt loads, and a running attempt locks that same shell, already in
its first paint, instead of mounting a second one.
