# SNBT Try-Out System

SNBT try-out backend built on top of the shared `exerciseAttempts` engine.
Each subject uses the normal exercise timer and answer flow, while the SNBT
tables own try-out lifecycle, IRT scoring, and official leaderboard rules.

## Core Rules

- A try-out attempt stays open for at most 24 hours from `startedAt`
- Subject attempts are stored in `exerciseAttempts` with `origin: "snbt"`
- SNBT try-out attempts are simulation-only
- Simulation subjects use a fixed time limit of `90` seconds per question
- Official scoring is currently `2PL-first`: stored item parameters keep
  `guessing`, but operational theta estimation uses `c = 0`
- Only the first completed simulation attempt per user per try-out is official
- Later simulation retries never update the official leaderboard
- Practice is unlocked only after an official simulation completion and uses the
  standalone `exerciseAttempts` flow outside of `snbtTryoutAttempts`

## Data Model

```mermaid
erDiagram
    snbtTryouts ||--o{ snbtTryoutSets : contains
    snbtTryoutSets }o--|| exerciseSets : references
    snbtTryoutAttempts ||--o{ snbtTryoutSubjectAttempts : contains
    snbtTryoutSubjectAttempts }o--|| exerciseAttempts : references
    snbtTryoutAttempts }o--|| users : belongs_to
    snbtLeaderboard }o--|| snbtTryoutAttempts : references
    userSnbtStats }o--|| users : aggregates
```

## Tables

| Table | Purpose |
|-------|---------|
| `exerciseAttempts` | Shared exercise engine. SNBT subjects use `origin: "snbt"`; standalone exercise pages use `origin: "standalone"`. |
| `snbtTryouts` | Auto-detected SNBT try-out definitions keyed by locale/year/slug. |
| `snbtTryoutSets` | Maps a try-out to its seven subject `exerciseSets`. |
| `snbtTryoutAttempts` | Per-user simulation lifecycle, raw totals, and final IRT result. The 24h expiry window is derived from `startedAt`. |
| `snbtTryoutSubjectAttempts` | One subject record per try-out attempt. Points to the shared `exerciseAttempts` row for that subject. |
| `snbtLeaderboard` | Official per-try-out leaderboard entries. One official simulation entry per user per try-out. |
| `userSnbtStats` | Official aggregate stats per user and locale, fed only by official leaderboard insertions. |

## Backend Flow

```mermaid
flowchart TD
    A[startTryout simulation] --> B[create or resume snbtTryoutAttempt]
    B --> C[schedule 24h expiry]
    C --> D[startSubject]
    D --> E[create or reuse exerciseAttempt origin=snbt]
    E --> F[submitAnswer or completeAttempt]
    F --> G[sync parent tryout expiry]
    G --> H[completeSubject]
    H --> I{all subjects completed?}
    I -->|No| D
    I -->|Yes| J[completeTryout]
    J --> K[updateLeaderboard internal mutation]
    K --> L[snbtLeaderboard + userSnbtStats]
    L --> M[unlock standalone practice]
```

## Query Contract

| Query | Purpose |
|-------|---------|
| `getActiveTryouts` | List active try-outs for a locale |
| `getTryoutDetails` | Load one try-out and its ordered subject sets |
| `getUserTryoutAttempt` | Load the latest simulation attempt, subject progress, whether the latest attempt is official, and whether standalone practice is unlocked |
| `getTryoutContextForAttempt` | Resolve SNBT context from a subject `exerciseAttempt` |
| `getTryoutLeaderboard` | Read official per-try-out ranking via aggregate component |
| `getGlobalLeaderboard` | Read official global ranking via aggregate component |

## Mutation Contract

| Mutation | Purpose |
|----------|---------|
| `startTryout` | Create a new simulation attempt or resume the latest in-progress simulation attempt if still within the 24h window |
| `startSubject` | Create the subject `exerciseAttempt` once, or return the existing one for that subject |
| `completeSubject` | Finalize one subject, compute subject theta, and update try-out raw totals |
| `completeTryout` | Finalize the try-out only after all subjects are completed and return whether this result is official or an unofficial retry |
| `expireTryoutAttemptInternal` | Internal scheduled expiry that marks the try-out and any open subject attempts as expired |
| `updateLeaderboard` | Internal official leaderboard/stat update for the first completed simulation attempt only |

## Leaderboard Policy

- The first completed simulation attempt for a user on a try-out is the only official one
- Later simulation retries still get results, but they do not overwrite official leaderboard data
- Standalone practice attempts never create leaderboard entries and never affect `userSnbtStats`

## Convex Design Notes

- Shared timing uses the same durable scheduled-expiry pattern as standalone exercises
- Exercise answer correctness is computed on the server from canonical choice data
- Try-out expiry is handled by an internal scheduled mutation, not `Date.now()` in queries
- Relationship traversals use `convex-helpers` where they fit naturally (`getManyFrom`, `getAll`, `getOneFrom`)
- Official ranking reads use the aggregate component for O(log n) rank lookup
- The backend stores only the state it must query directly; officialness is derived from completion behavior, not a redundant flag
- Practice uses the standalone exercise engine so the SNBT lifecycle stays focused on official simulation state

## IRT Scoring

- Subject and try-out theta use EAP estimation
- Operational SNBT theta estimation uses a 2PL policy over calibrated item parameters
- Display score scale is `200-1000`
- `theta = 0` maps to `600`
- Implementation lives in `packages/backend/convex/irt/`
