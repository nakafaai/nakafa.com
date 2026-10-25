---
"www": patch
"@repo/analytics": patch
"@repo/backend": patch
"@repo/design-system": patch
"@repo/internationalization": patch
"@repo/site": patch
"@repo/seo": patch
---

Every dependency moves to its current release, including the AI SDK 7.0.128
cohort, Motion 14, KaTeX 0.19, the Convex Agent component 0.7.4, and the MCP
SDK 2.3.1. The dependency audit now runs OSV Scanner 2.6.0 and no longer
ignores the http-cache-semantics advisory, which a patched release closed.
