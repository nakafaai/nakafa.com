---
"www": patch
"@repo/design-system": patch
---

Report indexing script progress through Effect's logger instead of a
hand-written console logger, and give picked files a counter-based id instead
of a random one. The typecheck now rejects the global `console` and
`Math.random`, and the repository check rejects compiler configurations
whose Effect language service rules differ.
