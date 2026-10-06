---
"@repo/backend": patch
---

Stop changing arrays in place in the backend. Every `push`, `pop`,
`unshift`, `splice`, `sort`, and `reverse` call in the Confect modules and
the repository scripts now builds a new array through Effect's `Array` module
(`Array.append`, `Array.sort`, `Array.sortWith`, `Array.reverse`,
`Array.remove`), tests record calls through `Ref`, and the repository check
rejects the in-place methods there from here on.
