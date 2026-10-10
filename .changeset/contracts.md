---
"www": patch
"@repo/backend": patch
"@repo/contents": patch
"@repo/email": patch
"@repo/internationalization": patch
"@repo/seo": patch
---

The packages now read @nakafa/aksara-contracts 0.48.9. Every export that these packages read keeps its type, its encoded bytes, and its key order; inside, the package is written with Effect modules, and no data shape is written inline. Since 0.48.5 it has owners for shapes that readers wrote again, and the backend reads the first one: the question count of a section list. 0.48.7 adds the identity of the active catalog as one Schema. 0.48.9 takes the identity fields of the release verification evidence and the publication receipt from that Schema, at their stored positions. 0.48.8 moved those keys and was never read here: the backend compares a stored receipt as JSON text, so the key order is part of the stored format.
