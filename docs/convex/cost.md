# Convex Cost And Scale Evidence

## Status

Measured and implemented through 2026-07-11. This document separates billing
evidence, runtime evidence, shipped architecture, and remaining operational
work. A short log sample is not treated as proof of a full monthly invoice.

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

## Shipped Architecture

### Quran runtime

- `quranVerses` no longer stores unused long tafsir in the hot verse document.
- Metadata generation uses a lightweight surah metadata query instead of
  loading every verse.
- Body rendering still uses the indexed surah page query and preserves the same
  public content contract.

### Public content routes

- Public routes are synchronized through deterministic shards rather than one
  monolithic root document or full-table rewrite.
- A root content hash and shard states make an unchanged sync a no-op.
- Incremental sync skips Convex work when the source projection has not changed.
- Route tracking identity is derived from the source graph contract; runtime
  reads no longer perform a redundant tracking lookup.
- Route-owned cached loaders prevent metadata and page rendering from repeating
  the same build read.
- Static parameter generation is capped at 512 routes per locale and route
  family. The remaining long tail renders on demand under Next.js Cache
  Components rather than forcing every content row into every build.

### Try-out discovery

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
- No-change content synchronization performs no redundant mutation batches.
- One-time repair and migration functions were removed after dev and production
  verification.

## Post-change Evidence

### Runtime sample

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

### Synchronization and integrity

- Production public-route rebuild: 1,276 routes across 1,236 occupied shards.
- Immediate second public-route sync: 1,276 unchanged routes and zero writes.
- Dev and production content verification both pass with 840 questions, 4,200
  choices, 10 sets, 34 sections, and zero orphan choices.
- Dev and production Quran verification pass with 114 surahs and 6,236 verses.
- Dev and production both have 0 try-out attempts and 0 progress rows after
  the canonical reset and rebuild; no browser verification data remains.
- The latest 100 dev and production Convex executions had no non-null errors at
  the final verification point.

### Recovery evidence

Pre-migration logical backups exist for both deployments and were opened as ZIP
archives before schema deployment:

- `dev.zip`
- `prod.zip`

The local backup directory is intentionally not committed because it contains
deployment data.

## Scale Model

Millions of localized content records are partitioned by source identity,
locale, route family, and bounded route shards. Hot user state remains in
Convex, while static authoring truth remains in the repository and is projected
incrementally. Queries use equality-prefixed indexes and cursor pagination; no
runtime query added by this work collects a globally growing table.

Try-out growth is partitioned by country, exam, track, locale, and set. Progress
storage grows with actual user participation, not with every possible user and
set pair. Status pagination reads the attempted index directly; the sparse
unattempted stream advances through the already indexed track catalog in bounded
pages.

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
