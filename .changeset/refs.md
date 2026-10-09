---
"www": patch
"@repo/backend": patch
"@repo/email": patch
---

The web app imports Convex function references per domain, so a page no longer ships the whole backend contract. Backend codegen writes one refs module per domain, and five contracts moved from spec modules to contract modules. First JavaScript on the homepage is about 2 percent smaller.
