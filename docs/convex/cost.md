# Convex Cost And Scale Evidence

## Status

Architecture verified through 2026-08-04. Billing and log measurements below
retain their exact historical dates. A short log sample is not treated as proof
of a full monthly invoice.

## Billing Snapshot

The Convex usage screen for 2026-06-12 through 2026-07-12 showed:

| Resource | Usage | Included | On demand |
| --- | ---: | ---: | ---: |
| Function calls | 9.8M | 25M | 0 |
| Action compute | 1.1 GB-hours | 250 GB-hours | 0 |
| Database storage | 741.39 MB | 50 GB | 0 |
| Database I/O | 108.03 GB | 50 GB | 58.03 GB |
| File storage | 7.68 MB | 100 GB | 0 |
| Data egress | 90.08 MB | 50 GB | 0 |

Database I/O was the only visible overage. At the observed US Professional rate
of $0.20 per additional GB, 58.03 GB is approximately $11.61. Added to the $25
developer subscription, the pre-tax estimate is $36.61. The invoice remains the
source of truth for tax and regional adjustments.

Convex bills database I/O for document and index data transferred between a
function and the database. Cached query reads do not incur database bandwidth,
while logical backups read documents and consume database bandwidth.

## Baseline Evidence

The original bounded log samples identified large Quran page reads as the
clearest repeatable hot path:

- Development: 965 executions read 19,820,211 bytes. Quran page reads accounted
  for 17,139,989 bytes, or 86.5% of the sample.
- Production: 656 executions read 1,735,605 bytes. Quran pages read 778,838
  bytes, curriculum pages read 494,237 bytes, and one analytics partition read
  364,442 bytes.
- Serializing all 114 Quran page payloads from source produced 19,504,297 bytes.
  Long Indonesian tafsir contributed 9,147,814 bytes, although the web page only
  rendered short tafsir.

Omitting long tafsir only from a response would not save database I/O because
Convex reads the stored document before projecting the response. The hot stored
row had to change.

## Current Architecture

### Signed publication runtime

- Aksara exclusively owns authored content and emits signed publication
  artifacts. Nakafa has no local authored corpus or publication writer.
- `contentState` pins the active signed release. Family read models authenticate
  their release, manifest, projection, artifact, and indexed facts before use.
- Article and material catalogs use equality-prefixed indexes and bounded cursor
  pages. Unified search reads authenticated signed family indexes rather than a
  mutable `contentSearch` copy.
- Quran and try-out structured rows remain immutable signed snapshots. Public
  application reads use only the unversioned current contract.
- Mutable legacy route, search, Quran, curriculum, author, and content-copy
  tables are not part of the current runtime.

### Try-out discovery

- Aksara owns authored try-out content and publishes a signed snapshot.
- Nakafa reads the verified active snapshot directly. It has no authored
  question-bank or try-out catalog tables.
- Retained attempts resolve only by exact attempt ID and may read one private
  immutable history decoder while production still references historical signed
  bytes. Current attempt creation and public catalog reads never use it.
- `tryoutSetProgress` stores one compact latest-state row only after a user has
  attempted a set. It does not create a user-by-catalog cross product.
- Attempt start and finalization update the progress row in the same Convex
  transaction as the attempt lifecycle.
- Normal set pages read compact progress rows instead of large attempt documents
  containing section snapshots.
- User status ordering uses a compound index before cursor pagination.
- Unattempted and attempted streams remain separate standard Convex paginated
  queries, composed reactively by the client. No loaded-page client sort or
  unbounded table collection is used.

### Removed data and work

- Dead projection tables and 1,105 obsolete projection rows per environment were
  removed.
- The obsolete `materialLocales` data path was removed.
- The empty authored `questionChoices`, `questions`, `questionSets`,
  `tryoutCountries`, `tryoutExams`, `tryoutTracks`, `tryoutSets`, and
  `tryoutSections` production tables were removed after signed-runtime
  acceptance and zero-row proof.
- No-change signed release activation performs no redundant mutation batches.
- One-time repair and migration functions were removed after dev and production
  verification.

## Historical Post-change Evidence

The dated samples below describe earlier runtime generations and preserve their
original function names for cost comparison. They are not current interfaces.

### 2026-07-11 runtime sample

A fresh production sample after the content read changes contained 745 completed
executions, about 3.5 MB read, and zero errors:

| Function | Calls | Approximate bytes read |
| --- | ---: | ---: |
| `getCurriculumPage` | 249 | 2.36 MB |
| `getContentRouteArtifactPage` | 14 | 577 KB |
| `getContentRoute` | 457 | 365 KB |
| `getArticlePage` | 7 | 184 KB |

The corresponding development sample was dominated by deliberate reset,
migration, Quran rebuild, and integrity verification work. It must not be used
as a normal-traffic projection.

### 2026-07-11 synchronization and integrity

- Production public-route rebuild: 1,276 routes across 1,236 occupied shards.
- Immediate second public-route sync: 1,276 unchanged routes and zero writes.
- Dev and production Quran verification pass with 114 surahs and 6,236 verses.
- The latest 100 dev and production Convex executions had no non-null errors at
  the final verification point.

### 2026-08-04 signed cutover

- The active production release is `quran-tryout-cutover-20260804-a48d644`.
- Signed article, material, learning-program, Quran, and try-out publication is
  the authored-content source of truth.
- Production retained 8 try-out attempts, 7 progress rows, 20 section attempts,
  650 placements, 11 responses, 7 scores, 28 calibration runs, 4 IRT scale
  versions, and 600 IRT scale items after the authored table removal and final
  schema deployment.
- Content reset preserves signed publication, try-out runtime, access,
  entitlements, scoring, and IRT state. It deletes only rebuildable local
  projections.

### Recovery evidence

Pre-migration logical backups exist for both deployments and were opened as ZIP
archives before schema deployment:

- `dev.zip`
- `prod.zip`

The local backup directory is intentionally not committed because it contains
deployment data.

## Scale Model

Millions of localized content records are partitioned by signed source identity,
locale, content family, and bounded catalog partitions. Hot user state remains
in Convex. Aksara owns static authoring truth and sends signed projections to
Nakafa. Queries use equality-prefixed indexes and cursor pagination; no runtime
query added by this work collects a globally growing table.

Try-out runtime growth is partitioned by signed release identity, locale, set,
and user activity. Progress storage grows with actual participation, not with
every possible user and set pair. Status pagination reads the attempted index
directly; the sparse unattempted stream advances through the signed catalog in
bounded pages.

## Remaining Operations

1. Export the monthly Database I/O breakdown after a full billing cycle on this
   architecture and compare I/O per build and active user with the baseline.
2. Record dev and production logical-backup schedules and reconcile their reads
   with the same invoice period. Do not disable production backups merely to
   reduce cost.
3. Add a durable monthly alert before included database I/O is exhausted, using
   Convex usage attribution fields.
4. Review high-I/O Insights findings by function before considering another
   schema change. Do not add speculative digest tables or caches without a
   measured hot path.

## Guardrails

- Keep mutable attempts, responses, entitlements, and user state in Convex.
- Do not replace indexed reads with unbounded collection or loaded-page client
  sorting.
- Do not claim savings from response projection while the same large stored
  document is still read.
- Do not add compatibility reads for removed data models; migrate, verify, and
  delete the obsolete path.
- Do not disable backups without a documented recovery-point objective and a
  tested restore procedure.

## References

- [Convex pricing](https://www.convex.dev/pricing)
- [Convex limits and database I/O](https://docs.convex.dev/production/state/limits)
- [Convex indexes](https://docs.convex.dev/database/reading-data/indexes/)
- [Convex pagination](https://docs.convex.dev/database/pagination)
- [Convex automatic query caching](https://docs.convex.dev/realtime)
- [Convex backup pricing](https://docs.convex.dev/database/backup-restore)
- [Convex usage attribution](https://docs.convex.dev/platform-apis/track-usage)
- [Next.js `use cache` keys](https://nextjs.org/docs/app/api-reference/directives/use-cache#cache-keys)
