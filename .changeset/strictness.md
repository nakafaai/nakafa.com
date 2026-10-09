---
"www": patch
"@repo/design-system": patch
"@repo/typescript-config": patch
---

The typecheck now rejects 94 patterns of the Effect language service instead
of 24. Every rule that reports nothing on the current code is an error, so new
code cannot bring one back. Four arrow functions that only returned a value
lost their block. Every root `.mts` file (the Vitest configurations and one
content script) is now inside its workspace's typecheck.
