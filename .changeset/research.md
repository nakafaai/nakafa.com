---
"@repo/backend": patch
---

Web research calls the search provider's HTTP API through Effect's `HttpClient`
instead of its SDK, from one module that owns the two requests, the parts of
each answer that Nina reads, and the failures. The SDK leaves the backend with
its own dependencies. The answer run's bundle no longer holds the SDK, an HTTP
client library, a schema converter, a second copy of zod, or the Node HTTP
client that the SDK imported on demand, and goes from 8,641 KiB to 7,552 KiB.
A page whose title or description the provider gives as a list of texts now
reads as its first text, and a request no longer carries the SDK's `origin`
field. A bad gateway is still asked again twice, a request that nothing answers
is still cut five seconds after the provider's own limit, and a page that the
provider keeps processing is still not waited for. A page read that has less
than the provider's minimum of one second is no longer sent.
