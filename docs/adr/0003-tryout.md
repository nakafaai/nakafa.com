# ADR 0003: Try-Out Country And Exam Architecture

## Status

Accepted. Amended on 2026-07-08 to insert the canonical try-out track layer,
on 2026-07-22 to define freemium attempt access, and on 2026-08-04 to make
Aksara signed publication the only authored try-out source. Amended on
2026-08-10 to define transactional response and scoring integrity. Amended on
2026-08-14 to record the completed physical retirement of superseded storage,
on 2026-09-01 to define the structured response rollout, and on 2026-09-19
to make attempts and scores free with Pro access to worked solutions. Amended on
2026-09-27 to separate exam language from the application locale and retire the
unused access-campaign storage. Amended on 2026-10-02 to give responses one
module outside try-out, with short answers, rubrics, stored outcomes, question
worth, and penalized scoring.

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
- Billing-owned user plans and subscriptions for current Pro solution access.
- `irtCalibration*` and `irtScale*` for scoring calibration and immutable scale versions.

Do not reconstruct authored catalog or question data from Nakafa filesystem
copies. Do not add a second authored table family beside the signed snapshot.

### Language And Identity

The application locale selects navigation and explanations. It does not identify
an attempt or select the language of an exam question. Progress and history use
the learner, country, exam, track, and set, so changing the interface language
keeps the same attempt and result.

Aksara owns each section's real exam language. SNBT and TKA questions follow
their Indonesian exam contract; a section assessing English keeps its English
source. Germany's future exams use their German source regardless of interface
language. Explanations remain localized independently. A retained attempt keeps
the signed questions and scoring specification with which it started.

The current `de` locale denotes German for Germany, as identified by the
application's `DE` country metadata. Future Austrian and Swiss editions need
their own reviewed locale and corpus identities; they must not alias Germany's
content or automatically inherit its exam questions.

### Runtime Integrity

One domain response transaction receives one frozen placement ID and exactly one
learner selection. A selection is empty, one option, an ordered option set, an
ordered category assignment, a typed short answer, or a rubric answer, according
to the placement's frozen `responseSpec`. The server derives elapsed time from the active section timer and
evaluates correctness from that immutable specification. The transaction
validates attempt, section, placement, response kind, and response ownership
before it updates the response and parent activity counters.

The structured-response rollout completed on 2026-09-01 after production data
contained only canonical rows. Placements persist one required `responseSpec`,
learner responses persist one required `selection` and `isComplete` result, and
the public mutation accepts only that stable contract. Single-choice,
multiple-choice, and category responses share this model without rollout
adapters or duplicate runtime projections.

### Response Module And Scoring

`packages/backend/confect/response` owns every response format apart from
try-out: the frozen `ResponseSpec`, the learner-facing `RenderableSpec`, the
canonical `Selection`, and the `Outcome` of an answer. `freeze` captures a signed
response at attempt start, `project` hides answer keys until review, `select`
checks that a selection belongs to its response, and `evaluate` decides its
outcome. They are synchronous and deterministic, so the answer mutation,
optimistic updates, and rendering share them; Effect programs lift their typed
`ResponseRejected` failure, which try-out maps onto its deployed selection error
codes. Try-out keeps attempt and placement integrity in `tryouts/response`.

Choice and category answers are correct or incorrect. A short answer is graded
only through the contract's `matchesAnswerKey` and `readNumberAnswer` in the
question's delivery language, which `freeze` stores in the spec: a comma
decimal in Indonesian and German, a dot in English, and fractions only when the
key accepts them. A numeric key decides the answer. A text answer that matches
no accepted answer stays `pending` until the grader judges text variants. A
rubric earns the upper level of each final-answer criterion whose typed final
answer matches its key; a written response leaves its judged criteria, and so
the answer, `pending`. A selection keeps the learner's raw text beside the exact
number the grader read. A deterministic integrity check defers to the stored
outcome only where its own evaluation is `pending`.

Responses store their outcome beside the legacy `isCorrect` flag, which stays
true only for `correct`; readers map rows written before outcomes through one
read function. A later migration fills every outcome, then the flag and the read
function are removed. Counters count complete answers and correct outcomes, so a
pending answer is answered but never correct.

Every strategy reads a question's worth only through the contract's
`questionPoints`: its authored points or one, and a rubric's derived total.
Placements freeze authored points, and section snapshots freeze the signed
marks of penalized sets. `rawScore` is the percentage of attainable worth
earned, where a correct answer earns its worth and a partial answer its points;
raw sets publish it. Penalized sets publish the sum of each section's marks for
a correct, wrong, or blank answer times the question's worth; an incomplete
answer counts as blank. IRT sets keep the estimate, where only a correct answer
is correct. A pending answer earns nothing yet and keeps the score provisional
instead of counting as zero.

The runtime exposes only exact attempt-ID
state, response, history, and page operations. Public-path compatibility
queries, fallback indexes, and duplicate state shapes are not supported.

Retained attempts read their immutable signed catalog, placement, artifact,
release, renderer, and snapshot bytes through the same canonical contracts as
active content. Historical review preserves the authored content, responses, and scoring data
frozen at attempt start. It authenticates their stored signed identities and
fails closed when those bytes violate the canonical contract. Historical decoders, fallback transformations, and separate recovery
projection contracts are not supported.

Section completion, attempt completion, and expiry load bounded indexed
placement and response graphs. They reject missing, duplicate, or mismatched
snapshot identities before persistence. Terminal IRT scoring loads one
validated placement inventory and score source, then reuses both for section
and attempt results so maximum-size placements are not read twice in one
transaction.

Current attempt pages resolve the latest attempt through the one compact,
indexed progress row, then fail closed unless its duplicated identity, attempt
number, status, status rank, and latest attempt row agree. Historical review
pages continue to render their stored immutable snapshot.
Restart actions and retained-route destinations resolve separately from the
active signed catalog in the same Convex query transaction, so a catalog rename
or entry revision cannot silently change the frozen review or send a new attempt
to an obsolete route.

The web bootstraps that exact attempt page, then subscribes only to
`getSetAttemptState` or `getSectionAttemptState` while the attempt can still
change. Frozen display stays separate from the active signed restart and
navigation destinations. Terminal pages stop their mutable subscriptions.

### Freemium Access

Every authenticated account can start and repeat any try-out without a lifetime
claim or a per-set attempt cap. Every completed attempt retains its score,
including IRT scores on supported sets. The start mutation resumes a live attempt
before starting another and derives the next attempt number from the newest
indexed attempt, without scanning the complete history.

Response capture and IRT scoring do not filter by subscription plan. More free
attempts can therefore contribute response data, but response volume alone does
not calibrate the model. The current scale publisher reuses matching item
parameters or starts a provisional 2PL scale; it does not fit new parameters
automatically from accumulated responses. Scores retain their scale status.

Nakafa Pro grants access to worked solutions and answer keys after an attempt
finishes. The billing-owned `users.plan` is the current entitlement, maintained
transactionally by the subscription trigger. Upgrading opens solutions for
previous attempts too. Downgrading revokes future solution reads while preserving
attempts and scores. An access-source snapshot records the circumstances of a
start for competition eligibility and attribution; it does not grant permanent
access to solutions.

Both the runtime response projection and the signed-body query enforce the same
current-plan check. Free terminal responses omit answer keys and answer selectors.
A direct request for an answer artifact must pass ownership, terminal lifecycle,
and current Pro entitlement checks. The user interface presents the upgrade
option below the free result.

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
  Raw["Raw or penalized score"]

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
access state, entitlements, calibration runs, and IRT scales.
Attempts and scales retain the exact signed snapshot needed for historical
review and scoring.

Removing a retired deployment table requires proof that no active schema or
code reference remains and that the replacement runtime passes acceptance.
Its data must be empty, independently verified in the replacement store, or
explicitly approved for disposal by the operator. Preserve a recoverable export
through cutover acceptance. Use bounded conversion when needed, then remove the
converter, predecessor schemas, and physical tables. Do not retain permanent
cleanup functions for retired table names.

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

On 10 October 2026 the owner approved the disposal of the retired bookmark
data. A production export taken at 10:38 UTC held zero rows in `bookmarks` and
`bookmarkCollections`, and a temporary purge function then deleted zero rows
from each on dev and on production. The two tables, their account deletion
step, and that function left the schema and the code in the same change.

## Consequences

- The public practice/exercise pages are intentionally removed.
- The app has one try-out vocabulary from source to Convex to UI.
- Attempt routes use verified signed catalog indexes instead of route parsing or unbounded scans.
- Exam pages list tracks, and track pages paginate ready sets through indexed Convex read models.
- Old direct exam-to-set URLs are intentionally not supported.
- IRT is a strategy under try-out scoring, not an SNBT-only subsystem.
- Backward compatibility is intentionally not supported for removed practice/exercise URLs.
- Content reset cannot erase durable try-out history or access state.
