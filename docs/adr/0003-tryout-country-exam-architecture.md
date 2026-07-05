# ADR 0003: Try-Out Country And Exam Architecture

## Status

Accepted.

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
/[locale]/try-out/[country]/[exam]/[set]/[section]
```

Use stable exam-family keys without yearly suffixes. For example, use `snbt` and `tka`, not `snbt-2026` or `tka-2026`.

Move authored try-out source to country and exam folders:

```text
packages/contents/tryout/[country]/[exam]
packages/contents/question-bank/tryout/[country]/[exam]
```

Use these Convex table families:

- `questionSets`, `questions`, `questionChoices` for immutable source-backed question bank rows.
- `tryoutCountries`, `tryoutExams`, `tryoutSets`, `tryoutSections` for public catalog routes.
- `tryoutAttempts`, `tryoutSectionAttempts`, `tryoutAttemptPlacements`, `tryoutResponses`, `tryoutScores` for realtime runtime state.
- `tryoutAccessCampaigns`, `tryoutAccessTargets`, `tryoutAccessLinks`, `tryoutAccessGrants`, `tryoutEntitlements` for premium access.
- `irtCalibration*` and `irtScale*` for scoring calibration and immutable scale versions.

Delete public standalone practice/exercise routes and tool surfaces. Do not keep aliases, compatibility readers, or old product/package/part vocabulary in touched code.

## Flow

```mermaid
flowchart TD
  Source["Source files"]
  Bank["Question bank rows"]
  Catalog["Try-out catalog rows"]
  Route["Country exam set section routes"]
  Attempt["Realtime attempt state"]
  Score["Scoring strategy"]
  IRT["IRT scale version"]
  Raw["Raw or weighted score"]

  Source --> Bank
  Source --> Catalog
  Catalog --> Route
  Route --> Attempt
  Attempt --> Score
  Score --> IRT
  Score --> Raw
```

## Convex Reset Rule

Convex schemas validate only tables listed in the schema. Removing a table from the code schema does not delete old deployed tables automatically. Legacy deployed tables such as `exerciseAnswers`, `exerciseAttempts`, `exerciseChoices`, `exerciseItemParameters`, `exerciseQuestions`, `exerciseSets`, old `parts`, and old event try-out tables must be deleted only after backup.

Backup commands:

```sh
CI=true pnpm --dir packages/backend exec convex export --include-file-storage --path /tmp/nakafa-convex-dev-before-tryout-reset.zip
CI=true pnpm --dir packages/backend exec convex export --prod --include-file-storage --path /tmp/nakafa-convex-prod-before-tryout-reset.zip
```

After the PR code is deployed and the new sync has populated the new tables, delete legacy deployment tables from the Convex dashboard data page. Do not add permanent cleanup functions for old table names.

## Consequences

- The public practice/exercise pages are intentionally removed.
- The app has one try-out vocabulary from source to Convex to UI.
- Attempt routes can scale by indexed catalog and attempt tables instead of route parsing or unbounded scans.
- IRT is a strategy under try-out scoring, not an SNBT-only subsystem.
- Backward compatibility is intentionally not supported for removed practice/exercise URLs.
