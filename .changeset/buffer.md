---
"@repo/backend": patch
---

The AI gateway module now loads the Buffer polyfill itself. The gateway provider encodes file bytes with the global `Buffer`, which the default Convex runtime does not have, so every function that builds the gateway gets it. The HTTP routes no longer load the polyfill, because no route reads the global without a fallback.
