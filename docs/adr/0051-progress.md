# ADR 0051: Retire the World Game and Own Gamification in Progress

## Status

Accepted on 26 November 2026. Supersedes ADR 0042, ADR 0047, and ADR 0050.

## Context

The interactive 3D world game (`/{locale}/island`, `/{locale}/island/{username}`) carried a large custom WebGL2 engine, procedural flora/fauna/terrain libraries, chunk and guest-book persistence, and recorded audio assets with high maintenance cost. At the same time, Nakafa's core learning gamification (Stars, unbounded levels, tiered badges/medals, daily streaks, and leaderboards) was coupled to the `island` backend domain, tables, and i18n namespace.

## Decision

1. **Remove the world game in full.** Delete the game routes (`/$locale/island`, `/$locale/island_/$username`), server loaders, components, engine libraries, audio assets, E2E specs, CSS tokens, lint/color-check exceptions, and game-only tables (`islandChunks`, `islandGuests`) and fields (`access`, `blueprints`, `chunks`, `entered`). Answer retired `island` URLs with HTTP `410 Gone` via `GONE_FAMILIES`.
2. **Own gamification in `progress`.** Replace `packages/backend/confect/island`, `islands`, `islandAwards`, and the `Island` dictionary namespace with `packages/backend/confect/progress`, `progress`, `progressAwards`, and `Progress`.
3. **Keep reads bounded and cost-efficient.**
   - `progress` stores one compact row per learner (`userId`, `lifetime`, `tally`, `learned`, `streak`, `timeZone`), indexed by `by_userId` and `by_lifetime`.
   - `progressAwards` stores one idempotent row per earned key (`lesson`, `section`, `set`, extensible via `AwardSource` and `AWARD_RULES`), indexed by `by_userId_and_key` and `by_userId_and_day`.
   - Level, next-level thresholds, and all badge tiers derive purely from `lifetime` and `tally` with zero unbounded ledger scans.
4. **Link leaderboard rows to learner profiles.** `leaderIdentityOf` (shared by global Stars and try-out set leaderboards) resolves a learner's `username` through `profileAccess` (ADR 0009): rows open `/@username` when the viewer may view that profile, and remain non-interactive for school members viewed by others or accounts without a username.
5. **Retire legacy data cleanly.** Per `packages/backend/AGENTS.md`, no compatibility layer, dual read, or migration function ships. Dropped `island*` tables are cleared via the Convex CLI where needed.

## Consequences

- Zero game engine, audio, or world-persistence maintenance surface remains.
- Gamification is isolated in one small, extensible domain (`progress`) ready for new award kinds, achievements, and badges without touching unrelated apps.
- Every leaderboard row across Home and Try-out surfaces consistently links to accessible learner profiles while preserving school privacy.
