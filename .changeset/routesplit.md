---
"www": patch
---

Give each route's loader a chunk of its own, so the first bundle no longer carries
every route's loader and what it imports.
