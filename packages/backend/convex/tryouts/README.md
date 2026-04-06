# Tryout Runtime

Generic tryout runtime built on top of the shared `exerciseAttempts` engine.
Product-specific rules live in `tryouts/products/`, while the runtime tables,
queries, mutations, IRT publication, and leaderboard flow stay generic.

## Related Docs

- IRT technical basis: `../irt/README.md`
- IRT explainer: `../irt/docs/EXPLAINER.id.md`
- Tryout architecture: `./docs/ARCHITECTURE.id.md`
- Product policy: `./docs/PRODUCT_POLICY.id.md`

## Core Model

- `tryouts` stores detected tryout definitions for one product and locale,
  including the dense `catalogPosition` used by paginated hub browse queries
- `tryoutCatalogMeta` stores exact active package counts per product and locale
- `tryoutPartSets` maps each tryout to its ordered exercise sets
- each mapped part keeps both `partIndex` (internal order) and `partKey`
  (stable public identity for routes)
- `tryoutAttempts` stores per-user simulation lifecycle and final IRT result
- `tryoutPartAttempts` links one runtime part to one shared `exerciseAttempt`
- `tryoutAccessCampaignProducts` stores explicit campaign-to-product scope rows
- `userTryoutEntitlements` stores active event access rows per user and product
  for `competition` and `access-pass`
- `tryoutLeaderboardEntries` stores the current best official result per user
- `userTryoutStats` stores leaderboard aggregates per product namespace

## Current Product Policy

Today only SNBT is configured in `tryouts/products/`.
That policy owns:

- tryout detection from synced `exerciseSets`
- required part membership and order
- attempt expiry window
- per-part simulation timer
- displayed score scaling
- global leaderboard namespace format

## Design Notes

- Shared answer storage, timers, and set completion still use `exerciseAttempts`
- Tryout attempts always use frozen published IRT scales from `irtScaleVersions`
- Product-specific rules stay in policy/config instead of creating new table
  families like `tkaTryouts`, `cpnsTryouts`, etc.
- Hub browse reads paginate directly on `tryouts` using the persisted
  `catalogPosition` order so Convex returns the final display order without
  caller-side `.collect()` or page exhaustion
- Tryout start reads go through exact user-scoped entitlements and one indexed
  `tryoutAttempts` lookup for competition usage instead of projection tables or
  broad scans inside the mutation
- Event access trusts the materialized `userTryoutEntitlements` rows filtered by
  active `endsAt` windows, while Pro access reads the canonical active
  subscription directly from `customers` + `subscriptions`
- Concurrent `startTryout` calls rely on Convex serializable OCC over the real
  business reads: latest indexed `tryoutAttempts` rows and active indexed
  event entitlements plus active subscription source-of-truth rows
- Generic ranking still uses aggregate components for O(log n) rank lookups
- Competition campaign windows are immutable after the first redemption so the
  runtime never needs to repair old attempts after ops edits campaign policy
- Competition result finalization goes straight from `pending` to `finalized`:
  exact end-time scheduling is primary, and the cron sweep is only overdue
  repair
- Auth cleanup deletes user-scoped tryout runtime, access, and leaderboard rows
  together so deleted users do not leave orphaned runtime state behind
- Ops can verify access time-state integrity through bounded maintenance queries
  in dev and prod

## Catalog Read Model

- `tryouts` is the source of truth for tryout hub rows
- each tryout stores the browse fields the hub needs together with
  `catalogPosition`, a dense readable order written by content sync
- content sync sorts detected tryouts with the product policy comparator and then
  persists that final order as `catalogPosition`
- `tryoutCatalogMeta` stores `activeCount` so the hub badge does not need to
  scan or count the full catalog at read time
- content sync is the authoritative writer for both the browse order and the
  exact active-count metadata

## Finalized Attempt Semantics

- Public tryout score is always derived from the attempt's final `theta`
- If a tryout ends before every part was started, unstarted parts still count as
  zero-correct timed sections in the finalized tryout score
- Ended tryout result reads still return those never-started parts so the UI can
  show full-tryout totals and per-part zero-score summaries

## Frontend Contract

Use the generic query/mutation surface in `tryouts/`:

- `queries/tryouts.ts`
- `queries/tryouts.ts#getActiveTryoutCatalogSnapshot`
- `queries/tryouts.ts#getActiveTryoutCatalogPage`
- `queries/me/attempt.ts`
- `queries/me/history.ts`
- `queries/me/part.ts`
- `queries/leaderboard.ts`
- `mutations/attempts.ts`

The hub should not exhaust all active tryout pages on the server.
Use `getActiveTryoutCatalogSnapshot` on the server for the exact count plus the
first page, then hydrate into `getActiveTryoutCatalogPage` with
`usePaginatedQuery` on the client.
Use `getActiveTryoutCatalogPage` with `usePaginatedQuery` on the client and
let the catalog page query attach latest-attempt badges only for the rows in the
current page.

The part runtime route is intentionally different.
It can read runtime state with an authenticated server-side Convex query and then
load question content from the snapshot-resolved `setSlug`, so historical
attempts stay bound to their original part mapping even after content sync
changes.

Frontend routing can stay product-specific, for example:

- `/[locale]/try-out/[product]`
- `/[locale]/try-out/[product]/[slug]`
- `/[locale]/try-out/[product]/[slug]/part/[partKey]`

The backend slug remains the detected runtime slug like `2026-set-1`.
