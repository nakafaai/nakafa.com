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
the global `fetch`. The language switch and the copy button load their request
code when a visitor uses them, so no page ships the HTTP client in its first
JavaScript.
