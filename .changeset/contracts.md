---
"www": patch
"@repo/backend": patch
"@repo/contents": patch
"@repo/email": patch
"@repo/internationalization": patch
"@repo/seo": patch
---

The packages now read @nakafa/aksara-contracts 0.48.8. Every export that these packages read keeps its type; inside, the package is written with Effect modules, and no data shape is written inline. Since 0.48.5 it has owners for shapes that readers wrote again, and the backend reads the first one: the question count of a section list. 0.48.7 adds the identity of the active catalog as one Schema. 0.48.8 builds the release verification evidence and the publication receipt from that identity, so their six identity keys come first in the encoded object; both are decoded through their Schema here, and nothing hashes them.
