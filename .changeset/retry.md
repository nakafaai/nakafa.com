---
"www": patch
"@repo/backend": patch
---

The session token, language switch, reviewed content source, and Convex query reads share one network attempt helper for their deadline and retries, with the same limits and error types as before. The language switch's transport failure now carries a fixed message instead of the raw request error text.
