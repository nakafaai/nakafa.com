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
- A read that depends only on the active release goes through the content
  store (`apps/www/lib/content/store`), which keeps its answer in the Vercel
  Runtime Cache. That cache is shared by every instance and survives a deploy,
  while `use cache` keys include the build, so a deploy and every new instance
  used to read Convex again. A store key holds a version constant, the release
  id, the read and its arguments, so a new release has new keys and an entry is
  never stale; entries live 30 days under the tag of their release. The store
  holds only what Convex answered. What code derives from an answer, such as
  URLs, Markdown and sitemap descriptors, is derived after the read inside the
  `use cache` boundary, so a deploy that changes a derivation takes effect with
  that deploy and needs no version bump. The `use cache` boundaries stay above
  the store because prerendering and the scope tags that expire ISR pages need
  them. Misses of one key that overlap in an instance share one load.
- The active release pointer is the one read that is not release-keyed: each
  region keeps it for a minute. The activation route expires it and reads it
  back, because the Runtime Cache client resolves an expiry that failed, and it
  answers 503 before it revalidates anything while the pointer still names the
  previous release, so the publisher repeats the call. It expires the pointer
  once more after the sitemap purge, for a read that began before the
  activation and wrote the previous release after the first expiry. A pointer
  that is wrong anyway is dropped by the first read that proves it: a store miss
  that finds Convex naming another release, whether its load succeeded or
  failed, or a pinned read that names another release than its pin. That check
  is one pointer read per miss and none per hit; it is kept for every read
  because only some answers name their own release.
- The sitemap index and pages end in a long lifetime, a day at the CDN, so they
  never trust the stored pointer alone. Both are derived on every fill from the
  stored answers of Convex, each fill ends with a check of the release against
  Convex, and a fill that finds another release fails and drops the pointer
  instead of keeping a previous release or a page cached as missing. The page
  route checks the id against the index of the release before it reads
  anything, and a try-out page below the count of its release is the only one
  that is read, so a request can never create a stored or cached entry for an
  id that the release does not list.
- Social images carry the CDN lifetime of the sitemap, a day and a stale day,
  and a CDN tag. An image changes only when its route changes, and a route
  changes only with a release, so the activation of a release purges the tag
  once, as it purges the sitemap. A purge that fails is logged and never fails
  the activation, because a stale image is cosmetic and its lifetime bounds it.
  The image for a route the release does not know is kept for five minutes
  only, because the next release may add the route.
- The image optimizer keeps an optimized copy for a week
  (`images.minimumCacheTTL` in `@repo/next-config`), not the four hours it
  defaults to. A static import already stays for a year, but a file in
  `public/` and a remote image sent short lifetimes and were optimized again
  every four hours for the same bytes.
- The trending list on the home page counts the last seven days and drops its
  oldest day once a night, so its snapshot uses the `hours` profile. The
  `minutes` profile refreshed it every minute and regenerated the page that
  shows it each time.
- A merge to main creates a new deployment of every project, and every
  deployment starts with empty caches, so a project skips the build of a commit
  that nothing it is built from changed. Each `vercel.ts` names
  `scripts/vercel/ignore.mjs` as its Ignored Build Step, and
  `scripts/check/deploy.ts` keeps the four files equal. A project is built from
  its own workspace, every workspace it depends on, the lockfile and the root
  configuration, so `www`, whose build deploys the Convex functions, builds
  whenever `packages/backend` changes. Documentation and tests build nothing. A
  missing earlier commit, a missing earlier deployment, an empty change and any
  failure build. Vercel runs the step before it installs a dependency, so the
  script is plain JavaScript with Node.js built-ins only.
- RSS caches the completed XML. Its update timestamp comes from authored
  publication dates, so another request does not manufacture changed output.
- Flight requests bypass the Proxy's duplicate publication ownership reads.
  HTML requests retain the early check because streamed `notFound()` can return
  HTTP 200 after a response has started. Markdown negotiation remains explicit.
- The Proxy runs before the CDN cache as a Node.js function, so every request
  its matcher lets in costs one run, a cached page included. The matcher keeps
  out only what the Proxy passes on unchanged: the analytics path, which
  `next.config.ts` rewrites to PostHog, and the icon and the manifest that every
  page links. Documents, Flight navigations and prefetches stay in because they
  can redirect, rewrite or reject a locale, and an unknown root file stays in
  because the Proxy answers it with a plain 404.
- The browser reads its Better Auth session on every page load and every return
  to the tab, signed in or not. A read that carries no session cookie and no
  bearer token is answered by the route itself with the `null` that Better Auth
  would give, and never reaches Convex. The browser cannot skip the request,
  because the session cookie is HttpOnly and no script sees that it is missing.
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
- [Vercel Runtime Cache](https://vercel.com/docs/caching/runtime-cache)
- [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region)
- [Vercel spend management](https://vercel.com/docs/spend-management)
