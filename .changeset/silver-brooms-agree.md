---
"@repo/backend": minor
---

Implement validation without validate session for checking auth, resulting improvement on performance, query from 1s down to 200ms. mutation still use validation session tho to make it more secure
