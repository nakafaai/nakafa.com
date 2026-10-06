---
"www": patch
"@repo/analytics": patch
"@repo/backend": patch
"@repo/design-system": patch
"@repo/internationalization": patch
"@repo/next-config": patch
"@repo/seo": patch
---

Run on Next.js 16.3.8, a security release that fixes request forgery in image
optimization and cache leaks across `use cache` fills and root params. Every
other dependency moves to its current release, including the AI SDK 7.0.128
cohort, Motion 14, KaTeX 0.19, the Convex Agent component 0.7.4, and the MCP
SDK 2.3.1. The dependency audit now runs OSV Scanner 2.6.0 and no longer
ignores the http-cache-semantics advisory, which a patched release closed.
