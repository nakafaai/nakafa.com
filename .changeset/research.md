---
"@repo/backend": patch
---

Web research calls the search provider's HTTP API through Effect's `HttpClient`
instead of its SDK, from one module that owns the two requests, the parts of
each answer that Nina reads, and the failures. The SDK leaves the backend with
its own dependencies. The answer run's bundle no longer holds the SDK, an HTTP
client library, a schema converter, a second copy of zod, or the Node HTTP
client that the SDK imported on demand, and goes from 8.6 MB to 7.6 MB. A page
whose title or description the provider gives as a list of texts now reads as
its first text, and a request no longer carries the SDK's `origin` field. A bad
gateway is still asked again twice, and a page that the provider keeps
processing is still not waited for.
