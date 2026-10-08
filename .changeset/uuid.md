---
"www": patch
"@repo/backend": patch
"@repo/utilities": patch
---

Generate every random UUID through Effect's `Crypto` service instead of the
global `crypto.randomUUID`, and reject the global call in the typecheck.
