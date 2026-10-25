# ADR 0007: Static Public Lessons And Reactive Learner Context

> Superseded in part by [ADR 0037](0037-cloudflare.md): the hosting, delivery, and deployment decisions of this record no longer apply. Its caching design, restated without the earlier framework, is the Caching decision of ADR 0037.

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
production build's prerendered HTML, delayed Convex context, canonical metadata,
hard missing-page status, Markdown, responsive reading, and the repository's full
production acceptance run. Verify the exact head locally, then merge it to
protected `main`, whose push deploys production (ADR 0037).

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
