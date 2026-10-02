---
"@repo/backend": patch
---

Keep content releases reaching production. A release first reads the
published content heads page by page, and a full page of 500 heads with
public routes needed about one second of query time, Convex's limit, so
production timed out and answered 500. A head page now resolves at most 128
keys and the publisher follows its cursor through the shorter pages.
