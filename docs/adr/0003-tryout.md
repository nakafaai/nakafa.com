# ADR 0003: Try-Out Country And Exam Architecture

## Status

Accepted. Amended on 2026-07-08 to insert the canonical try-out track layer,
on 2026-07-22 to define freemium attempt access, and on 2026-08-04 to make
Aksara signed publication the only authored try-out source. Amended on
2026-08-10 to define transactional response and scoring integrity. Amended on
2026-08-14 to record the completed physical retirement of superseded storage,
and on 2026-09-01 to define the structured response rollout.

## Context

Nakafa try-out used to share public practice and exercise vocabulary with content routes. That made SNBT-specific data, product keys, runtime slug parsing, and part/package wording leak across the app, AI, Convex, and sync code.

The product direction is country-first try-out discovery:

- Indonesia contains exams such as SNBT and TKA.
- Germany can later contain exams such as Abitur and Studienkolleg.
- The same runtime must support IRT and non-IRT scoring strategies.
- Convex remains the realtime app-data source for attempts, responses, scores, access, and live read models.

## Decision

Use one try-out route grammar:

```text
/[locale]/try-out/[country]/[exam]/[track]/[set]/[section]
```

Use stable exam-family keys without yearly suffixes. For example, use `snbt` and `tka`, not `snbt-2026` or `tka-2026`. Model year, subject, or future exam-offer groupings as try-out tracks between exam and set.

Keep authored try-out source only in Aksara country and exam folders:

```text
aksara/packages/corpus/tryout/[country]/[exam]
aksara/packages/corpus/question-bank/tryout/[country]/[exam]
```

Aksara canonicalizes catalog rows, placements, protected question and answer
artifacts, renderer metadata, and release metadata into one signed publication.
Nakafa verifies the signature, canonical hashes, complete snapshot digests, and
release transition before any publication write.

Use these Convex table families:

- `contentReleases`, `contentSnapshots`, `tryoutCatalog`, and
  `tryoutPlacements` for verified signed publication state.
- `tryoutAttempts`, `tryoutSectionAttempts`, `tryoutAttemptPlacements`, `tryoutResponses`, `tryoutScores` for realtime runtime state.
- `tryoutAccessCampaigns`, `tryoutAccessTargets`, `tryoutAccessLinks`, `tryoutAccessGrants`, `tryoutEntitlements` for premium access.
- `tryoutFreeAttemptClaims` for the one lifetime free attempt claimed by each account.
- `irtCalibration*` and `irtScale*` for scoring calibration and immutable scale versions.

Do not reconstruct authored catalog or question data from Nakafa filesystem
copies. Do not add a second authored table family beside the signed snapshot.

### Runtime Integrity

One domain response transaction receives one frozen placement ID and exactly one
learner selection. A selection is empty, one option, an ordered option set, or an
ordered category assignment, according to the placement's frozen
`responseSpec`. The server derives elapsed time from the active section timer and
evaluates correctness from that immutable specification. The transaction
validates attempt, section, placement, response kind, and response ownership
before it updates the response and parent activity counters.

The structured-response change follows expand, switch, observe, then contract.
Canonical writers persist `selection` and `responseSpec` for single-choice,
multiple-choice, and category responses. During the bounded observation period,
the public mutation may still accept the predecessor `selectedOptionId`, and the
runtime may still project `choices` and `selectedOptionId` for already deployed
clients. These fields are temporary rollout contracts, not permanent response
models. Remove their validators, readers, projections, schema fields, tests, and
migration operation after production logs show zero predecessor writers for the
full client window, all stored rows are canonical, and no live attempt can still
depend on the predecessor shape. The maximum attempt lifetime is 72 hours.

Outside that temporary rollout seam, the runtime exposes only exact attempt-ID
state, response, history, and page operations. Public-path compatibility
queries, fallback indexes, and duplicate state shapes are not supported.

Retained attempts read their immutable signed catalog, placement, artifact,
release, renderer, and snapshot bytes through one private history decoder. That
decoder is not a writer, route, fallback, or public compatibility contract. It
must be deleted when production proves zero retained attempts reference its
historical snapshot and release identities.

Section completion, attempt completion, and expiry load bounded indexed
placement and response graphs. They reject missing, duplicate, or mismatched
snapshot identities before persistence. Terminal IRT scoring loads one
validated placement inventory and score source, then reuses both for section
and attempt results so maximum-size placements are not read twice in one
transaction.

Current attempt pages resolve the latest attempt through the one compact,
indexed progress row, then fail closed unless its duplicated identity, attempt
number, status, status rank, and latest attempt row agree. Historical review
pages continue to render the exact signed snapshot frozen at attempt start.
Restart actions and retained-route destinations resolve separately from the
active signed catalog in the same Convex query transaction, so a catalog rename
or entry revision cannot silently change the frozen review or send a new attempt
to an obsolete route.

The web bootstraps that exact attempt page, then subscribes only to
`getSetAttemptState` or `getSectionAttemptState` while the attempt can still
change. Frozen display stays separate from the active signed restart and
navigation destinations. Terminal pages stop their mutable subscriptions.

### Freemium Access

Every account can start one complete try-out for free. The claim is global to the
account, not one claim per exam, track, or set. Starting through a live
subscription, competition grant, or access pass does not consume it.

The start mutation is authoritative. It resumes a live attempt before checking
new access, then resolves premium access before the free claim. A successful free
start inserts the claim and attempt in the same transaction, so a failed start
consumes nothing and concurrent starts cannot create two free attempts. The
catalog access query is advisory UI state only; a structured
`TRYOUT_ACCESS_REQUIRED` mutation failure opens the upgrade dialog instead of a
generic retry error.

The free claim is durable account state. Content and try-out reset commands must
preserve it, while deleted-user cleanup removes it with the local user row.
Attempts record the access source used at creation for support, analytics, and
future policy changes.

Delete public standalone practice/exercise routes and tool surfaces. Do not keep aliases, compatibility readers, or old product/package/part vocabulary in touched code.

## Flow

```mermaid
flowchart TD
  Source["Aksara corpus"]
  Release["Signed release"]
  Verify["Nakafa verification"]
  Catalog["Signed catalog and placements"]
  Route["Country exam track set section routes"]
  Attempt["Frozen attempt snapshot"]
  Score["Scoring strategy"]
  IRT["IRT scale version"]
  Raw["Raw or weighted score"]

  Source --> Release
  Release --> Verify
  Verify --> Catalog
  Catalog --> Route
  Route --> Attempt
  Attempt --> Score
  Score --> IRT
  Score --> Raw
```

## Convex Reset Rule

Content reset may delete only rebuildable Nakafa read models. It preserves
signed snapshot state, attempts, progress, placements, responses, scores,
access state, entitlements, free claims, calibration runs, and IRT scales.
Attempts and scales retain the exact signed snapshot needed for historical
review and scoring.

Removing a retired deployment table requires three separate proofs: its row
count is zero, no schema or code reference remains, and the replacement runtime
passes acceptance. Drain rows through one temporary bounded internal operation,
prove every retired table empty, then remove both the operation and schemas in
the final deployment. Do not retain permanent cleanup functions for retired
table names.

### Completed Physical Retirement

On production deployment `dapper-antelope-269`, an authenticated Convex
Dashboard operator deleted the following 27 superseded physical tables between
`2026-08-14T16:00:03.363Z` and `2026-08-14T16:05:00.981Z`:

- Legacy content: `articleReferences`, `contentAuthors`, `articleContents`,
  `authors`, `curriculumLessons`, `curriculumTopics`, `quranVerses`,
  `quranSurahs`, `contentRoutes`, `contentRoutePages`, `contentRouteCounts`,
  `publicRouteSitemapCounts`, `publicRouteSitemapPages`, `publicRoutes`,
  `publicRouteSyncState`, and `contentSearch`.
- Retired learning plans: `learningProgramCoverage`,
  `learningProgramSources`, `learningPrograms`, `learningPlanItems`,
  `learningPlans`, and `learningProfiles`.
- Retired audio generation: `audioContentSources`, `contentAudios`, and
  `audioGenerationQueue`.
- Retired signed ownership: `contentOwners` and `materialOwners`.

Immediately before each deletion, the table was independently reproved
undeclared and empty, and its Dashboard page also reported it empty. After the
final deletion, the production table inventory reported `remaining=0` for all
27 names. Public WWW, API, and MCP acceptance remained HTTP 200, and the latest
1,000 Convex events contained zero failures or errors. This section records
historical completion evidence only; it is not a reusable migration inventory
or runtime compatibility contract.

## Consequences

- The public practice/exercise pages are intentionally removed.
- The app has one try-out vocabulary from source to Convex to UI.
- Attempt routes use verified signed catalog indexes instead of route parsing or unbounded scans.
- Exam pages list tracks, and track pages paginate ready sets through indexed Convex read models.
- Old direct exam-to-set URLs are intentionally not supported.
- IRT is a strategy under try-out scoring, not an SNBT-only subsystem.
- Backward compatibility is intentionally not supported for removed practice/exercise URLs.
- Content reset cannot erase durable try-out history or access state.
