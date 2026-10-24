---
"www": patch
"@repo/analytics": patch
"@repo/backend": patch
"@repo/site": patch
"@repo/utilities": patch
---

Read environment values through one Effect Schema seam and remove the third-party environment adapter. A missing or invalid value fails with one message that names every such variable, and an empty value stays a set value as before.
