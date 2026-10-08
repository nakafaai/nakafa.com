---
"@repo/backend": patch
---

Transform arrays in the backend through Effect's `Array` module. Every
`map`, `filter`, `flatMap`, `some`, `every`, `forEach`, `reduce`, `flat`,
`toReversed`, and `join` call in the Confect modules and the repository
scripts now goes through `Array.map` and its siblings, with chains written
as `pipe`, and the repository check rejects the native methods there from
here on.
