# Tryout Runtime

Generic tryout runtime built on top of the shared `exerciseAttempts` engine.
Product-specific rules live in `tryouts/products/`, while the runtime tables,
queries, mutations, IRT publication, and leaderboard flow stay generic.

## Related Docs

- IRT technical basis: `../irt/README.md`
- IRT explainer: `../irt/docs/EXPLAINER.id.md`
- Product policy: `./docs/PRODUCT_POLICY.id.md`

## Core Model

- `tryouts` stores detected tryout definitions for one product and locale
- `tryoutPartSets` maps each tryout to its ordered exercise sets
- each mapped part keeps both `partIndex` (internal order) and `partKey`
  (stable public identity for routes)
- `tryoutAttempts` stores per-user simulation lifecycle and final IRT result
- `tryoutPartAttempts` links one runtime part to one shared `exerciseAttempt`
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
- Generic ranking still uses aggregate components for O(log n) rank lookups

## Finalized Attempt Semantics

- Public tryout score is always derived from the attempt's final `theta`
- If a tryout ends before every part was started, unstarted parts still count as
  zero-correct timed sections in the finalized tryout score
- Ended tryout result reads still return those never-started parts so the UI can
  show full-tryout totals and per-part zero-score summaries

## Frontend Contract

Use the generic query/mutation surface in `tryouts/`:

- `queries/tryouts.ts`
- `queries/me/attempt.ts`
- `queries/me/packages.ts`
- `queries/me/part.ts`
- `queries/leaderboard.ts`
- `mutations/attempts.ts`

Frontend routing can stay product-specific, for example:

- `/[locale]/snbt/try-out`
- `/[locale]/snbt/try-out/[slug]`

The backend slug remains the detected runtime slug like `2026-set-1`.
