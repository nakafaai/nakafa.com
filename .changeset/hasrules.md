---
"www": patch
"@repo/design-system": patch
---

Stop an inserted element from restyling the whole page. No class styles an element
from a `:has()` or a child position above it any more, and the Tailwind policy
rejects the variants that would, so a lesson's load runs 2 whole-page style passes
where it ran 38.
