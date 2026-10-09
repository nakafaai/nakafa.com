---
"www": patch
"@repo/analytics": patch
"@repo/backend": patch
"@repo/next-config": patch
"@repo/utilities": patch
---

Read environment values through one Effect Schema seam and remove the `@t3-oss/env-nextjs` adapter. A missing or invalid required value still fails with a message that names the variable, and an empty value stays a set value as before.
