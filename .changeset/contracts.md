---
"www": patch
"@repo/backend": patch
"@repo/contents": patch
"@repo/email": patch
"@repo/internationalization": patch
"@repo/seo": patch
---

The packages now read @nakafa/aksara-contracts 0.48.7. Every export of 0.47.0 keeps its type and its encoded bytes; inside, the package is now written with Effect modules, and no data shape is written inline. Since 0.48.5 it has owners for shapes that readers wrote again, and the backend reads the first one: the question count of a section list. 0.48.7 adds the identity of the active catalog as one Schema.
