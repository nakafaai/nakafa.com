# SNBT Try-Out System

SNBT try-out with IRT scoring. Users complete 7 subjects, system calculates θ (theta) for ranking.

## Data Model

```mermaid
erDiagram
    snbtTryouts ||--o{ snbtTryoutSets : contains
    snbtTryoutSets }o--|| exerciseSets : references
    snbtTryoutAttempts ||--o{ snbtTryoutSubjectAttempts : contains
    snbtTryoutSubjectAttempts }o--|| exerciseAttempts : references
    snbtTryoutAttempts }o--|| users : "belongs to"
    snbtLeaderboard }o--|| snbtTryoutAttempts : references
    userSnbtStats }o--|| users : aggregates
```

## Tables

| Table | Fields |
|-------|--------|
| `snbtTryouts` | `year`, `slug` (`{year}-{setName}`), `setName`, `locale`, `subjectCount`, `isActive` |
| `snbtTryoutSets` | `tryoutId`, `setId`, `subjectIndex` |
| `snbtTryoutAttempts` | `userId`, `tryoutId`, `mode`, `status`, `completedSubjectIndices`, `theta`, `irtScore` |
| `snbtTryoutSubjectAttempts` | `tryoutAttemptId`, `subjectIndex`, `setAttemptId`, `theta` |
| `userSnbtStats` | `userId`, `locale`, `averageTheta`, `totalTryoutsCompleted` |
| `snbtLeaderboard` | `tryoutId`, `userId`, `theta`, `irtScore`, `rawScore` (Aggregate handles ranking) |

## User Flow

```mermaid
flowchart TD
    A[Browse Try-outs] --> B[Select Year/Set]
    B --> C[startTryout]
    C --> D[Select Subject]
    D --> E[startSubject]
    E --> F[Complete Exercises]
    F --> G[completeSubject]
    G --> H{All subjects done?}
    H -->|No| D
    H -->|Yes| I[completeTryout]
    I --> J[Update Leaderboard]
```

## Queries

| Query | Purpose |
|-------|---------|
| `getActiveTryouts` | List active try-outs (grouped by year in UI) |
| `getTryoutDetails` | Get try-out + subjects by slug |
| `getUserTryoutAttempt` | Current user progress |
| `getTryoutContextForAttempt` | Detect try-out context from exercise |
| `getTryoutLeaderboard` | Per-tryout rankings (O(log n) via Aggregate) |
| `getGlobalLeaderboard` | Overall rankings (O(log n) via Aggregate) |

## Mutations

| Mutation | Purpose |
|----------|---------|
| `startTryout` | Create try-out attempt |
| `startSubject` | Create subject attempt |
| `completeSubject` | Calculate subject θ, mark complete |
| `completeTryout` | Final θ, update stats/leaderboard |

## IRT Scoring

- EAP (Expected A Posteriori) estimation
- Scale: 200-1000 (θ=0 → 600)
- See `convex/irt/` forimplementation