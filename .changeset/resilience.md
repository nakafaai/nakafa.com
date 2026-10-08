---
"www": patch
"@repo/backend": patch
---

Production builds now print a heartbeat every 15 seconds and stop after five
minutes without output. Content reads and Convex queries retry an attempt that
misses its ten second deadline, including queries from pages rendered on
request, and a failed static page render is tried once more.
