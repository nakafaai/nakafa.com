# ADR 0038: Static-First Public Content

## Status

Accepted on 25 October 2026. Phase A is implemented on `nabil/static`, and it is
not ready to merge while the blockers under "Not in Phase A" stay open: the
School and www hosts, the trailing-slash status, and the root locale rule are zone
rules that no probe can run. Phase B (the `/api` relay, the School host shell, and
the app shells) and Phase C (shards and the stable loader) are next, and each merges
only after its gate in Gates passes.

Supersedes the request-time content path of ADR 0037. Its Markdown twin and CDN statements are corrected under Corrections.

## Context

Measured on origin/main 2359c75ad0, before origin/main e4776b377e. The research was pinned at 1d8184be9a; #1207 changed the Bun toolchain and the deploy.yml node version only.

- Nine pages are prerendered (apps/www/vite.config.ts:25-33). Every article, lesson, Quran, curriculum, try-out, legal and School page is a Worker render.
- Article pages read Convex on every request (apps/www/src/lib/content/article/publication.ts:82-100). Lessons read an in-isolate store capped at 16 MiB (apps/www/src/lib/content/store/memory.ts:10).
- The sitemap lists 1,920 URLs. The client build holds 3,519 files (256.6 MiB), and 1,923 OG PNGs make up 220.2 MB of it.
- Home HTML is 555,731 bytes. A lesson measured 293,240 bytes in one run and 791 KB in another. Re-measure before relying on either.
- A content render costs 23.3 ms of CPU in Node (research measurement). The 698 ms per lesson figure is an orchestrator number that was not reproduced.
- Workers Free: 100,000 Worker requests per day (Error 1027 beyond), 10 ms CPU per request (Error 1102 on sustained overrun), 20,000 static files per version, 25 MiB per file, 100 Workers and 1,000 routes per zone, 100 _headers rules of at most 2,000 characters per line, 2,000 static plus 100 dynamic _redirects.
- Cloudflare documents that requests to static assets are free and unlimited, that storing assets has no charge, that Workers Caching bills static requests when enabled, that the CDN does not cache HTML by default, and that _headers and _redirects do not apply to Worker responses.
- Alchemy 2.0.0-beta.84 caps one Worker at 20,000 assets (node_modules/.pnpm/@alchemy.run+cloudflare@2.0.0-beta.84_*/node_modules/@alchemy.run/cloudflare/src/Workers/Assets.ts:17-18) and takes one assets directory per Worker.
- TanStack prerender rethrows a failed page inside a queued task whose promise nobody awaits (start-plugin-core prerender.ts:136 and 228-240, queue.ts:68-77). A failed page therefore does not fail the build by itself.

## Decision

D1. Public pages are prerendered HTML in assets-only Workers. A Node renderer runs once per release against one bulk read of the active release, and writes every public URL. Each shard holds at most 18,000 files, and today one shard holds every public page. An unmatched path answers the static 404 page (not_found_handling 404-page), never a render.

D2. Signed-in and School surfaces render only in the browser. School hosts (*.nakafa.com) get a static single-page-application shell. Its school gate and refusal run in the browser against Convex. Signed-in apex screens are client routes of a static shell that owns their route prefixes. No server function runs for them. (Amended 26 Oct 2026 for School, see "Phase B for School as implemented": the web Worker answers the shell from its own assets instead of a second, assets-only Worker.)

D3. One small dynamic Worker, with its own bundle and no TanStack or SSR code, serves nakafa.com/api/*. It answers the Better Auth relay, weather from request.cf coordinates, the pricing currency from CF-IPCountry, and the Aksara renderer manifest. Its target is under 10 ms CPU per request, measured in Workers Logs. The Convex token is fetched per document load and held in memory only.

D4. A page with an Aksara source has a static .md twin beside its HTML. The HTML head links it with a rel alternate of type text/markdown, and llms.txt lists it. Accept negotiation and its Worker are removed, so a request that asks for Markdown receives HTML.

D5. Social images are one per collection or family, not one per page.

D6. Content pages navigate in the browser, with no document load and no Worker request. While the build prerenders a page, the Worker records every server function call that the page's loaders make, and the build writes the answer of each call, byte for byte, as a static file. In the browser a loader reads that file and hands it to the function's own decoder through Start's per-call `fetch` option, so a navigation between prerendered pages costs one static asset read, made on intent before the press. A call that the build did not prerender, such as a later page of a list, asks the Worker. A read that depends on the reader instead of the page, such as a lesson's curriculum placement under a `?ctx=` hint, goes from the browser to Convex and never through the Worker. (Amended 25 Oct 2026: the document loads and Speculation Rules of Phase A made every press reload the page in every browser, and Safari and Firefox do not prerender. Amended 30 Oct 2026: the placement's server function cost 100 to 353 ms of CPU on a fresh isolate against the 10 ms of Workers Free, because its handler loaded Effect, Schema and the contentRelease refs.)

D7. Static pages set no cookies and no per-request headers. Security headers and the CSP come from _headers. The root path picks a locale with Single Redirect rules on the Accept-Language header (id, then de, otherwise en), declared in apps/www/deploy. Phase A does not declare them (see Not in Phase A).

D8. A build reads the active release once in bulk, renders every public URL, writes the .md twins, the feeds and the OG images, and fails when a page fails or when the emitted files differ from the expected URL set. An Aksara activation starts deploy.yml with a workflow dispatch for stage prod and ref main, in place of the cache POST. The stack binds the active release id to the web Worker as `NAKAFA_CONTENT_RELEASE` (`apps/www/deploy/release.ts`), because Alchemy rebuilds a Vite Worker only when its files or its bindings change: without that binding, the dispatch after release legal-xendit-20261026 (26 Oct 2026, run 40418168284) planned no change on an unchanged commit and the site kept the previous release's pages. In the same change the replaced request-time paths are deleted: Accept negotiation, the nine-page prerender list, the per-page social images and their alias, and Set-Cookie on static pages. The content store, the request-time content readers and the server functions with callers stay for the learner routes that the Worker still renders (search, try-out tracks, sets and sections, and signed-in screens). Phase C deletes them, once Phase B moves those routes to the browser.

D9. Workers Free only. No backward compatibility, no legacy path and no temporary function. Effect v4 and Confect v10 as AGENTS.md states. 100% per-file coverage. Browser suites run on a production build.

## Phase A as implemented

- **Page list.** `apps/www/src/lib/static/pages.ts` selects the public paths of the
  active release from the sitemap readers: every sitemap URL except the search
  screen and the try-out tracks, sets and sections (which Phase B for try-out adds),
  plus the articles index and the try-out hub of each locale. The sitemap files drop the same paths
  (`apps/www/src/lib/sitemap/files.ts`), so every sitemap URL is a static page.
  `scripts/static/run.mjs pages` writes the list before the client build, and
  `vite.config.ts` gives it to TanStack's prerender with `autoStaticPathsDiscovery`
  and `crawlLinks` off and a fixed concurrency.
- **Strict verifier.** The build fails unless the emitted `index.html` files are
  exactly the listed pages, no page carries a server failure marker, and no page
  renders the standalone not-found page.
- **Markdown twins.** `scripts/static/build.ts` writes `<path>.md` for every
  prerendered page whose Markdown source exists, links the twin from the page head
  with `rel="alternate" type="text/markdown"`, and lists the twins in `llms.txt`.
  It is the only writer of that link: the route head carries no Markdown alternate,
  and the alternate `types` option of the SEO head is deleted. Accept negotiation is
  deleted, so a request that asks for Markdown receives HTML. The `llms.mdx` route
  stays, because it answers the section indexes that no twin covers.
- **Social images.** One image per locale for the home page, the articles section
  and the curricula section. The curricula image carries the `LearningPrograms`
  index copy of its locale. `getOgUrl` points every page of those sections at the
  section image, and every other page at the home image. The per-page images and
  the per-page alias are deleted.
- **Navigation (D6 as amended).** A prerendered page's loaders call their server
  functions through `readStaticData` (`apps/www/src/lib/static/data.ts`). While the
  build prerenders a page, it sends `x-nakafa-prerender`, and the Worker records
  each call (`record.server.ts`) and closes the page with a comment that lists the
  calls. After the prerender, `writeStaticAnswers` (`apps/www/prerender.config.ts`)
  removes the comment, requests each call once from a preview server of the same
  build as the browser would, and writes its answer to `/_data/<key>.bin`: the
  content type on the first line, then the body. The key is the SHA-256 digest of
  the function's address and its input. In the browser the loader reads that file
  (`answer.ts`), and a missing file asks the Worker. Static assets revalidate by
  ETag, so an answer never outlives the release whose chunks it names. The
  Speculation Rules file and its headers are deleted.
- **Cheap not-found.** The Worker reads a path after the router's input rewrite,
  so a School host's page is its School tree path. The address decisions run
  first: the www host, the slash and spelling redirects, the School gates, the
  removed, migrated and moved addresses. A bare page address, whose first segment
  is neither a locale, nor shaped like one, nor a Worker route, and whose last
  segment names no file, then moves to the negotiated locale with a 307, English
  when the visitor names no served language, as the locale middleware before the move did.
  Every other path that no Worker route renders answers the static `404.html` from
  assets before the router runs (`apps/www/src/lib/routing/rendered.ts`). The
  templates are the generated route tree minus the prerendered ones, so an unknown
  address and a prerendered page without its asset cost no render. Assets answer 404
  with `notFoundHandling: "404-page"`.
- **Release dispatch.** After the commit of a production release that changes
  content, Aksara starts `deploy.yml` on `nakafaai/nakafa.com` with a workflow
  dispatch (`inputs.stage` `prod`, `ref` `main`). It authenticates with a GitHub App
  token that its release steps create, and that token carries only actions write
  on that repository. A target whose `NAKAFA_DEPLOY_SURFACE` is `none` (development)
  starts nothing. The cache POST and its receipt are deleted. The Nakafa deploy
  workflow has no repository dispatch trigger.

## Phase B for try-out, slice 1, as implemented

- **Visitor pages.** The page list and the sitemap now include every try-out track, set and section
  (`apps/www/src/lib/static/pages.ts`, `apps/www/src/lib/sitemap/files.ts`), and their loaders read
  the build's visitor answer (`readStaticData`) unless the signed-in hint is set or the address binds
  an attempt.
- **Written beside their address.** The build writes those pages under `/_tryout`
  (`staticPagePath` in `apps/www/src/lib/routing/prerendered.ts`, each page's `prerender.outputPath`),
  so their own addresses have no asset and reach the Worker, as before. Their Markdown twins and social
  images stay at their own paths and are answered by the assets alone.
- **Learner pages on the Worker.** A page request that sends a session cookie or binds an attempt
  renders on the Worker as before (`isLearnerPage` in `apps/www/src/lib/routing/learner.server.ts`),
  so the learner's attempt, the shell lock, the score card and the player's view are in the first
  HTML. A visitor's request takes the page under `/_tryout` (`readVisitorAsset`), after the redirect
  and School decisions and before any content read. A page the release does not hold goes on through
  the Worker's decisions, which answer the static not-found page without a render.
- **Not `runWorkerFirst`.** A list of paths in `assets.runWorkerFirst` makes Cloudflare answer every
  path the list does not name from the assets alone, so the API, server functions, search, chat and
  School hosts would answer the assets' 404 page (#1337, reverted by #1413). School host paths cannot
  be listed, so the pages move out of the way instead.
- **No swap after hydration.** The assets match a path without its query, so a static page at its
  own address would give a learner's hard load, `?attemptId` included, the visitor's HTML. Their own
  page would replace it after hydration: the shell lock moving the header, the player replacing the
  set page, the score card replacing the facts card, and Start turning into Continue.
- **Cost.** A visitor's view is the same Worker request as before, now one asset read instead of a
  render, which cost 40 to 333 ms of CPU for a missing set. A learner's view costs what it did. Slice
  2 moves the attempt into the browser, after which the pages return to their own paths and
  `isLearnerPage` is deleted.

## Phase B for School as implemented

- **Browser only.** The `/school` route is client-only (`ssr: false`), so the server renders the root
  document alone. Its root reads the locale (the language cookie, then the browser's languages), the
  school's messages from the locale's dictionary chunk, and the instant in the browser
  (`src/lib/tenant/root.ts`). The layout's gate reads the session's Convex token from the token route
  of the school's own host and makes the same `readSchoolFrame` decision as before
  (`readBrowserSchoolFrame`). A visitor's legal links come from the static answer of the shell
  navigation that every locale's pages already write. Every page reads its rows live, so a click reads
  nothing before it commits. Every School server function, its handler and its tests are
  deleted, and so are the school language save (the browser writes its cookie) and the `httpOnly` flag
  of the saved player view, which the browser now reads.
- **Static shell.** The build prerenders the root document once as `/_school.html` (Start's `spa`
  option, masked at `/`, which redirects to a locale). The Worker answers every page of a school host
  with that asset after the refusal check, with status 404 for a refused school and 200 otherwise
  (`src/lib/routing/school/shell.server.ts`), so a school page costs no render. `/api/*`, `/_serverFn/*`
  and every asset keep their answers on the same host.
- **One Worker, not two.** A second, assets-only School Worker would need its own asset set built in
  the same deploy. Alchemy 2.0.0-beta.84 reads a Worker's asset folder when it plans an update, before
  the Web build writes it, and resolves a binding to the web Worker by its stable name, so nothing
  orders the second Worker after the build. Moving `*.nakafa.com/*` between Workers in one deploy also
  hits Alchemy's refusal to take a route that another Worker holds. The web Worker already binds the
  release's assets and answers `/api` and server functions on every host, so it serves the shell.

Not in Phase A: the `/api` relay and the School shell (Phase B), shards and the
stable loader (Phase C), and per-request cookies for the pricing currency, which
a static page cannot set (see Consequences). Each item below is open, and none is
verified on the probe, which has no School or www host and no zone rule:

- **Zone rules (D7).** The Single Redirect rules for the root locale on
  Accept-Language, for the www host (307 to the apex), and for a 308 on a trailing
  slash are not declared. The platform answers `drop-trailing-slash` with 307, and
  the base answered 308. The root answers from the Worker (3 invocations, 6 to 7 ms
  each on the probe). Gate S1 and S5 run on a scratch zone before any of them ships.
- **School and www hosts.** `*.nakafa.com/*` routes to the web Worker, and its
  static assets answer every host. A refused or unknown School host, and www, serve
  the public pages, and School hosts lose the `noindex` of the tenant gate, until
  Phase B's shell and the zone rule land. The base answered 404, 307 and noindex.
- **Trailing-slash status** (above) and every bare page address, the bare profile
  (`/@name`) included, answer the Worker's 307, which Phase A keeps.
- **Root loader.** `apps/www/src/routes/__root.tsx` still runs `readPreviewRefreshFn`
  for every Worker render (critic item 10).
- **404 page.** `apps/www/public/404.html` is a bespoke English page with no stylesheet.
  It is not built from the app's not-found page yet.
- **Pricing checks.** The euro and Rupiah currency browser checks left the suite:
  a static page cannot answer the visitor's country. Phase B restores them with the relay.

## Alternatives rejected

- Edge cache of Worker renders. Workers Caching has no API to pre-populate the cache, collapses concurrent misses per data center, bills hits, and bypasses responses that set cookies. Every miss still runs the Worker under the 10 ms budget.
- R2 as the content tier. A public bucket needs no Worker, but storage above 10 GB is metered and route precedence against the apex is untested. R2 stays an archive only if a spike finds a cap.
- TanStack prerender as the only renderer. A failed page does not fail the build, and a shard cannot reuse prior output. The Node renderer reads the release once and awaits every page. Spike S2 compares both on 100 pages, and TanStack prerender with filter remains the fallback if S2 finds the Node output differs.
- Workers Paid now. The $5 monthly minimum buys nothing under the measured limits. Paid is the first step only after a measured limit binds.
- Per-page OG images. They double the file count and add about 114.5 KB per page (research measurement).
- TanStack's static server functions (`@tanstack/start-static-server-functions`). The package is experimental, stores a JSON result only, so a Server Component body cannot pass through it, and has no fallback when a file is missing.
- Document loads with Speculation Rules, as Phase A shipped. Every press reloaded the page, Safari and Firefox do not prerender, and the owner measured slow page changes on staging (25 Oct 2026).
- A Speculation Rules inline script. It needs an inline-speculation-rules source or a hash in the CSP, which the current policy does not grant. The header form needs no CSP change.

## Consequences

Positive: public pages cost zero Worker requests and zero Convex reads per view. Cost stays flat as traffic grows. Navigation between content pages is a document load that the browser can prerender.

Negative: the pricing currency of a static page is the default currency until the Phase B relay answers the visitor's country. A content release reaches the public site only after the static deploy finishes, which takes minutes. Accept negotiation for Markdown is removed. Per-article social images are removed. Signed-in pages render no HTML for crawlers, so public profile and shared chat pages need a per-page decision. The pricing currency costs one call per new browser when its cookie is absent. Every code release rebuilds every page until a stable loader exists (spike S6, required before 20,000 URLs).

## Gates

S1: route precedence, 404 behavior and zero Worker invocations for content URLs on a scratch zone that is not nakafa.com, and on the probe: zero Worker invocations for content URLs and a scanner CPU p90 under 10 ms (`ops/cpuroutes.mjs`). The Worker answers a scanner's locale path with the static page, so a scanner costs no render. S2: Node render cost and HTML parity against the current Worker on 100 URLs. S3: relay CPU under 10 ms at p99. S5: the Single Redirect field for Accept-Language and its Free quota. S7: upload and deploy time for an 18,000-file shard. S8: the shell build. S9: bulk read cost against the Convex plan and the spending limit. S6: a stable loader prototype before 20,000 URLs.

## Corrections to earlier documents

- ADR 0037 (lines 26-28) says Markdown twins are built into static assets. The build wrote no Markdown. This ADR creates them.
- ADR 0037 (lines 20-22) says static requests never invoke a Worker. That holds only without run_worker_first.
- AGENTS.md named packages/site/crawlers.ts, which does not exist. The crawler registry is apps/www/src/lib/seo/crawlers.ts, and AGENTS.md now names it.
- AGENTS.md documents pnpm commands. origin/main runs on Bun (root package.json workspaces and catalog).
- apps/www/src/lib/content/delivery.ts promises a CDN-kept hour for HTML. Cloudflare does not cache HTML by default, and the repository has no Cache Rule.
