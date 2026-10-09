---
"@nakafa/cli": patch
---

Requests to the Nakafa API now end after 10 seconds. A request that misses the deadline reports a network error.
