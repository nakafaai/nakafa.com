# ADR 0038: Static-First Public Content

## Status

Accepted on 25 October 2026. Phase A is implemented on `nabil/static`. Phase B
(the `/api` relay, the School host shell, and the app shells) and Phase C (shards
and the stable loader) are next, and each merges only after its gate in Gates
passes.

Supersedes the request-time content path of ADR 0037. Its Markdown twin and CDN statements are corrected under Corrections.

## Context

Measured on origin/main 2359c75ad0. The research was pinned at 1d8184be9a; #1207 changed the Bun toolchain and the deploy.yml node version only.

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

D2. Signed-in and School surfaces render only in the browser. School hosts (*.nakafa.com) get an assets-only single-page-application shell. Its school gate and refusal run in the browser against Convex. Signed-in apex screens are client routes of a static shell that owns their route prefixes. No server function runs for them.

D3. One small dynamic Worker, with its own bundle and no TanStack or SSR code, serves nakafa.com/api/*. It answers the Better Auth relay, weather from request.cf coordinates, the pricing currency from CF-IPCountry, and the Aksara renderer manifest. Its target is under 10 ms CPU per request, measured in Workers Logs. The Convex token is fetched per document load and held in memory only.

D4. A page with an Aksara source has a static .md twin beside its HTML. The HTML head links it with a rel alternate of type text/markdown, and llms.txt lists it. Accept negotiation and its Worker are removed, so a request that asks for Markdown receives HTML.

D5. Social images are one per collection or family, not one per page.

D6. Content pages navigate by document load and are prefetched on intent with Speculation Rules. The rules are one JSON file served through the Speculation-Rules response header, not an inline script, so the Content-Security-Policy keeps its current form. No client loader calls a server function for public content.

D7. Static pages set no cookies and no per-request headers. Security headers and the CSP come from _headers. The root path picks a locale with Single Redirect rules on the Accept-Language header (id, then de, otherwise en), declared in apps/www/deploy.

D8. A build reads the active release once in bulk, renders every public URL, writes the .md twins, the feeds and the OG images, and fails when a page fails or when the emitted files differ from the expected URL set. An Aksara activation starts deploy.yml with a workflow dispatch for stage prod and ref main, in place of the cache POST. In the same change the replaced request-time paths are deleted: the content store, Accept negotiation, request-time content readers, server functions with no caller, the nine-page prerender list, and Set-Cookie on content.

D9. Workers Free only. No backward compatibility, no legacy path and no temporary function. Effect v4 and Confect v10 as AGENTS.md states. 100% per-file coverage. Browser suites run on a production build.

## Phase A as implemented

- **Page list.** `apps/www/src/lib/static/pages.ts` selects the public paths of the
  active release from the sitemap readers: every sitemap URL except the search
  screen and the try-out sets and sections, plus the articles index and the try-out
  hub of each locale. `scripts/static/run.mjs pages` writes the list before the
  client build, and `vite.config.ts` gives it to TanStack's prerender with
  `autoStaticPathsDiscovery` and `crawlLinks` off and a fixed concurrency.
- **Strict verifier.** The build fails unless the emitted `index.html` files are
  exactly the listed pages, no page carries a server failure marker, and no page
  renders the standalone not-found page.
- **Markdown twins.** `scripts/static/build.ts` writes `<path>.md` for every
  prerendered page whose Markdown source exists, links the twin from the page head
  with `rel="alternate" type="text/markdown"`, and lists the twins in `llms.txt`.
  Accept negotiation is deleted, so a request that asks for Markdown receives HTML.
  The `llms.mdx` route stays, because it answers the section indexes that no twin
  covers.
- **Social images.** One image per locale for the home page, the articles section
  and the curricula section, which have published copy in every locale. `getOgUrl`
  points every page of those sections at the section image, and every other page
  at the home image. The per-page images and the per-page alias are deleted.
- **Navigation.** A link to a prerendered route template loads as a document, so
  no client loader or server function reads the public content on the way.
  `public/speculation-rules.json` names the content families to prerender on
  intent. Its `Speculation-Rules` header and `application/speculationrules+json`
  content type are set in `_headers`, so the Content-Security-Policy keeps its form.
- **Cheap not-found.** A request whose first segment is neither a locale nor a
  Worker route answers the static `404.html` from assets before any redirect or
  render. Assets answer 404 with `notFoundHandling: "404-page"`.
- **Release dispatch.** After the commit of a production release that changes
  content, Aksara starts `deploy.yml` on `nakafaai/nakafa.com` with a workflow
  dispatch (`inputs.stage` `prod`, `ref` `main`). It authenticates with a GitHub App
  token that its release steps create, and that token carries only actions write
  on that repository. A target with `AKSARA_CACHE_SURFACE=none` starts nothing. The
  cache POST and its receipt are deleted. The Nakafa deploy workflow has no
  repository dispatch trigger.

Not in Phase A: the `/api` relay and the School shell (Phase B), shards and the
stable loader (Phase C), and per-request cookies for the pricing currency, which
a static page cannot set (see Consequences).

## Alternatives rejected

- Edge cache of Worker renders. Workers Caching has no API to pre-populate the cache, collapses concurrent misses per data center, bills hits, and bypasses responses that set cookies. Every miss still runs the Worker under the 10 ms budget.
- R2 as the content tier. A public bucket needs no Worker, but storage above 10 GB is metered and route precedence against the apex is untested. R2 stays an archive only if a spike finds a cap.
- TanStack prerender as the only renderer. A failed page does not fail the build, and a shard cannot reuse prior output. The Node renderer reads the release once and awaits every page. Spike S2 compares both on 100 pages, and TanStack prerender with filter remains the fallback if S2 finds the Node output differs.
- Workers Paid now. The $5 monthly minimum buys nothing under the measured limits. Paid is the first step only after a measured limit binds.
- Per-page OG images. They double the file count and add about 114.5 KB per page (research measurement).
- A Speculation Rules inline script. It needs an inline-speculation-rules source or a hash in the CSP, which the current policy does not grant. The header form needs no CSP change.

## Consequences

Positive: public pages cost zero Worker requests and zero Convex reads per view. Cost stays flat as traffic grows. Navigation between content pages is a document load that the browser can prerender.

Negative: the pricing currency of a static page is the default currency until the Phase B relay answers the visitor's country. A content release reaches the public site only after the static deploy finishes, which takes minutes. Accept negotiation for Markdown is removed. Per-article social images are removed. Signed-in pages render no HTML for crawlers, so public profile and shared chat pages need a per-page decision. The pricing currency costs one call per new browser when its cookie is absent. Every code release rebuilds every page until a stable loader exists (spike S6, required before 20,000 URLs).

## Gates

S1: route precedence, 404 behavior and zero Worker invocations on a scratch zone that is not nakafa.com. S2: Node render cost and HTML parity against the current Worker on 100 URLs. S3: relay CPU under 10 ms at p99. S5: the Single Redirect field for Accept-Language and its Free quota. S7: upload and deploy time for an 18,000-file shard. S8: the shell build. S9: bulk read cost against the Convex plan and the spending limit. S6: a stable loader prototype before 20,000 URLs.

## Corrections to earlier documents

- ADR 0037 (lines 26-28) says Markdown twins are built into static assets. The build wrote no Markdown. This ADR creates them.
- ADR 0037 (lines 20-22) says static requests never invoke a Worker. That holds only without run_worker_first.
- AGENTS.md names packages/site/crawlers.ts and apps/www/src/lib/content/published/tree.ts. Neither exists. The crawler registry is apps/www/src/lib/seo/crawlers.ts.
- AGENTS.md documents pnpm commands. origin/main runs on Bun (root package.json workspaces and catalog).
- apps/www/src/lib/content/delivery.ts promises a CDN-kept hour for HTML. Cloudflare does not cache HTML by default, and the repository has no Cache Rule.
