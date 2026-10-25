# ADR 0007: Static Public Lessons And Reactive Learner Context

> Superseded in part by [ADR 0037](0037-cloudflare.md): the Vercel hosting, delivery, and deployment decisions of this record no longer apply.

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
- A `use cache` entry may go without that profile only when nothing it returns
  can change while its key stays the same. The default handler keeps its
  entries, and its record of revalidated tags, in the memory of one process,
  and Vercel keeps `use cache` in memory unless it is `use cache: remote`. The
  activation route revalidates a tag in one instance, so in every other
  instance the profile's hour is what carries a release. Reading through the
  content store does not change that, because the store answers only when it is
  asked. Entry by entry:
  - The profile, an hour: the publication, catalog, navigation and route
    readers of articles, material, programs, pages, the Quran and try-out, the
    RSS feed and the llms.txt section indexes.
  - `max`, with the release in the key: the reciprocal article category routes,
    the category page and the llms.txt documents.
  - `max`, because the key holds what the output is built from: the rendered
    bodies, by content hash, the try-out batches, by immutable selector, the SEO
    metadata, by its context and locale with translations that change only with
    a deploy, and the logo of a social image.
  - `max`, purged by a release only: the sitemap index and pages. They fit no
    other kind. The purge expires them in the instance that ran the activation
    and clears the CDN, and another instance keeps its copy until it ends.

  The profile also keeps the `Cache-Control` of each page within the AFDocs
  check, which reads that header from a local production server: Next.js writes
  it from the lowest lifetime among the entries that the page used, and the
  page navigation, which the app layout reads for every page, is the entry that
  stays at an hour. A longer lifetime on every entry, with the header held at an
  hour by `headers()` in `next.config.ts`, would stop the hourly regeneration
  of each page; it needs a release in every entry's key first, and a check on
  Vercel that the header changes nothing at the CDN.
- A read that depends only on the active release goes through the content
  store (`apps/www/src/lib/content/store`), which keeps its answer in the Vercel
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
- Social images carry a CDN lifetime of an hour and a stale day, and no CDN tag.
  An image changes only when its route changes, and a route changes only with a
  release, so the hour bounds how long a stale image can last. The hour is the
  lifetime of the content entries an image is rendered from: an instance may
  hold the previous release in its memory for up to that hour, and a longer CDN
  lifetime would keep that render long after its source was fresh again.
  The brand image that answers a route inside a content namespace (articles,
  material, the Quran or try-out) that the release does not list is kept for
  five minutes only, because the next release may add the route. A page outside
  those namespaces has no signed owner and shows the generic copy of the site,
  so its image keeps the full lifetime.
- The image optimizer keeps the default of `images.minimumCacheTTL`. Vercel
  keys an optimized local image by the hash of its content and keeps it for up
  to 31 days across deploys, so only a remote image, such as an avatar or a
  favicon, depends on the value, and a longer one would show a changed remote
  image late.
- The trending list on the home page counts the last seven days and drops its
  oldest day once a night, so its snapshot uses the `hours` profile. The
  `minutes` profile refreshed it every minute and regenerated the page that
  shows it each time.
- No project has an Ignored Build Step. A merge to main creates a new deployment
  of every project, and every deployment starts with empty caches, so skipping
  the build of a commit that changes nothing a project is built from was
  measured on 12 October 2026: replayed over the 347 commits on main since
  12 September, the rule would have skipped 30 builds of `www`, because its
  build deploys the Convex functions and so builds whenever `packages/backend`
  changes. That saving does not pay for a second decision on the deploy path.
  Vercel documents `npx turbo-ignore` for this, and that is the tool to use if
  the share of skippable commits grows.
- RSS caches the completed XML. Its update timestamp comes from authored
  publication dates, so another request does not manufacture changed output.
- Flight requests bypass the Proxy's duplicate publication ownership reads.
  HTML requests retain the early check because streamed `notFound()` can return
  HTTP 200 after a response has started. Markdown negotiation remains explicit.
- The Proxy runs before the CDN cache as a Node.js function, so every request
  its matcher lets in costs one run, a cached page included. The matcher keeps
  out only what the Proxy passes on unchanged: the analytics path, which
  `next.config.ts` rewrites to PostHog, and every path in `LOCALE_BYPASS_PATHS`
  (the icon, the manifest, `llms.txt`, `robots.txt`, `rss.xml`, the sitemaps,
  `skill.md`, the IndexNow key and the agent skill files). The Proxy test reads
  that list to keep the matcher equal to it. Documents, Flight navigations and
  prefetches stay in because they can redirect, rewrite or reject a locale, an
  unknown root file stays in because the Proxy answers it with a plain 404, and
  the localized image aliases stay in because the Proxy rejects a locale that
  the site does not serve. A social image therefore costs one Proxy run on every
  request, cached or not; the CDN saves its render.
- The browser reads its Better Auth session on every page load and every return
  to the tab, signed in or not. A read that carries no session cookie and no
  bearer token is answered by the route itself with the `null` that Better Auth
  would give, and never reaches Convex, where it would be one HTTP action: a
  function call with its action compute, and no table read. The browser cannot
  skip the request, because the session cookie is HttpOnly and no script sees
  that it is missing.
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
the repository's full production acceptance run. Verify the exact head locally,
then merge it to protected `main` before the Git integration creates production.
Do not create a Vercel Preview deployment.

Billing comparisons require the same period and project. ISR reads and writes
are 8 KB units, not request counts or a cache hit ratio. PostHog visitors are not
all HTTP requests. Separate function invocations, middleware, durable cache
traffic, crawler requests, and build usage before assigning a cause.

Vercel spend management applies after included credits and can pause all team
projects. Checks occur periodically, so it is not an instantaneous hard cap.
Do not increase a budget or resume a paused site as an incidental deployment
step without reconciling the operator's current spending constraint.

## Amendment: Local Verification Replaces CI, 17 October 2026

GitHub Actions CI is deleted: `.github/workflows/ci.yml`, the `pnpm ci:gate` and
`pnpm ci:production-acceptance` scripts that it ran, and their tests. Waiting for
CI was the bottleneck of every pull request, so CI is removed for good. The
release workflow `cli-publish.yml` is delivery, not CI, and stays.

Each pull request is verified locally on its exact head instead: every browser
suite on a local production build, the unit suites at 100% per-file coverage,
the typechecks, `bun run check:tests`, Ultracite, and React Doctor. A pull request
merges by squash once that verification passes, as `AGENTS.md` describes.

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
