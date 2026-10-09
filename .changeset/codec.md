---
"@repo/utilities": patch
---

Add `@repo/utilities/json`, the one owner of the plain JSON text codec. It exports `JsonTextSchema`, which decodes JSON text into an unknown value, and `encodeJsonText`, which writes any value as JSON text with the same bytes as `JSON.stringify`. The apps and packages that declared their own copy of this codec now import these two values instead. Behavior does not change.
