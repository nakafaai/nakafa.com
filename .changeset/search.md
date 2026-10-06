---
"@repo/backend": patch
---

Search arrays in the backend through Effect's `Array` module. Every `find`,
`findIndex`, `findLast`, and `findLastIndex` call in the Confect modules and
the repository scripts now goes through `Array.findFirst`, `Array.findLast`,
and their index forms, which return an `Option`, and the repository check
rejects the native methods there from here on.
