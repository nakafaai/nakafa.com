# ADR 0007: Static Public Lessons And Reactive Learner Context

## Decision

Public lesson content, metadata, structured data, canonical links, and Markdown
remain server-rendered from Aksara's signed publication. Optional curriculum
return context uses the existing public Convex query from small client controls.
The material page never reads request `searchParams` on the server.

The breadcrumb, outline heading, and pagination share Convex's native query
subscription deduplication. A canonical visit without `ctx` uses `"skip"` and
does not query curriculum context. Repeated or malformed hints are ignored.
The same projection decoder validates context identity in browser navigation,
server-side locale resolution, and chat context. It does not fetch data.

The static shell contains the real lesson, heading, outline, and canonical
pagination. Context changes link destinations without replacing those visible
labels. The breadcrumb's Home link stays outside Suspense in the initial HTML;
only its optional context segment waits inside the fixed-height reading header.
View recording waits for context resolution so one
contextual visit cannot first record a canonical view and then a placement view.

## Framework Boundaries

- Public publication readers use Next.js `use cache` and React `cache` where
  metadata and body need the same verified result in one render.
- Content-addressed rendered artifacts use native `cacheLife("max")` and their
  artifact tags. Mutable publication selectors retain scope invalidation and
  the existing bounded freshness profile.
- RSS caches the completed XML. Its update timestamp comes from authored
  publication dates, so another request does not manufacture changed output.
- Flight requests bypass the Proxy's duplicate publication ownership reads.
  HTML requests retain the early check because streamed `notFound()` can return
  HTTP 200 after a response has started. Markdown negotiation remains explicit.
- The `www` function region is `iad1`, beside the production Convex deployment.
  CDN delivery remains global. The project default region must match the checked
  configuration so the durable ISR cache is created in the intended region.

Confect's HTTP client reads signed public content at the server boundary.
Confect React queries own reactive learner state. Stable reading surfaces remain
visible while optional learner controls subscribe; there is no vanilla Convex
preload adapter. Public SEO content stays server-rendered.

## Convex Clock

Confect's registered function runtime owns the deterministic Effect clock and
tracing behavior in queries and mutations. Application handlers consume its
services directly and do not install a second runtime or clock adapter. Read
time only when domain behavior requires it, since a query's time dependency
affects caching. Node actions use Confect's Node action boundary.

The landing question reader passes its selected signed section to the existing
section reader. It does not reload publication ownership or look up the same
section again. Signed set inventory and placement verification remain intact.

## Verification And Operations

Validate signed content in the isolated local acceptance runtime. Check the
production build's prerender manifest and rendered HTML, delayed Convex context,
canonical metadata, hard missing-page status, Markdown, responsive reading, and
the repository's full production acceptance workflow. Use exact-head CI and a
protected merge before the Git integration creates production. Do not create a
Vercel Preview deployment.

Billing comparisons require the same period and project. ISR reads and writes
are 8 KB units, not request counts or a cache hit ratio. PostHog visitors are not
all HTTP requests. Separate function invocations, middleware, durable cache
traffic, crawler requests, and build usage before assigning a cause.

Vercel spend management applies after included credits and can pause all team
projects. Checks occur periodically, so it is not an instantaneous hard cap.
Do not increase a budget or resume a paused site as an incidental deployment
step without reconciling the operator's current spending constraint.

## References

- [Confect React clients](https://confect.dev/v10/clients/react)
- [Confect determinism](https://confect.dev/v10/server/database/determinism)
- [Convex query clock guidance](https://docs.convex.dev/understanding/best-practices#dont-use-datenow-in-queries)
- [Next.js search parameters and static rendering](https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering)
- [Next.js cache lifetimes](https://nextjs.org/docs/app/api-reference/functions/cacheLife)
- [Next.js not-found status codes](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
- [Vercel ISR units, unchanged output, and regions](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing)
- [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region)
- [Vercel spend management](https://vercel.com/docs/spend-management)
