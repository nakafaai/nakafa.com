---
"www": patch
"@repo/backend": patch
"@repo/math": patch
"@repo/utilities": patch
---

Send every request through Effect's `HttpClient` instead of the global
`fetch`: the language switch, the copy button, the indexing scripts, the local
preview reader and its event stream, the content runtime transport, Nina's
math and markdown tools, and the acceptance and customer scripts. One shared
client, `FetchClient`, keeps Effect's trace headers off the wire, the preview
event stream is sanitized as an Effect `Stream`, and the typecheck now rejects
the global `fetch`.
