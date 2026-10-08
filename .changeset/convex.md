---
"@repo/backend": patch
"www": patch
---

Send every Nina model call through the Convex AI gateway with no Vercel gateway key, routing, or spend tags, and record the cost each call reports. The documents of one message may now total at most 10 MiB, and the composer refuses a larger message before anything uploads.
