---
"@repo/backend": patch
"@repo/design-system": patch
---

Remove the nanoid and date-fns dependencies where Effect covers them. The electability chart labels months in UTC, so they stay correct for viewers west of UTC.
