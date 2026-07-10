# Convex Cost Baseline

## Status

Measured on 2026-07-10. This document records evidence and an optimization
order. It does not authorize a schema, query, CI, backup, or deployment change.

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

Database I/O is the only visible overage. At the current US Professional rate
of $0.20 per additional GB, 58.03 GB is approximately $11.61. Added to the
$25 developer subscription, the pre-tax estimate is $36.61. The invoice remains
the source of truth because tax and regional multipliers are not represented in
this estimate.

Convex defines database I/O as document and index data transferred between a
function and the database. Cached query reads do not incur database bandwidth.
Backups do read every document and are billed for that database bandwidth.

## Execution Samples

Bounded `convex logs --history 1000 --success --jsonl` samples were aggregated
from `usageStats.databaseIoReadBytes`. The commands only read deployment logs.

### Development

Window: 2026-07-10 10:57:12 UTC through 11:35:19 UTC.

- 965 completed executions read 19,820,211 bytes across 6,139 documents.
- `getQuranSurahPage` accounted for 17,139,989 bytes across 277 calls and
  5,453 documents. Of those calls, 186 were cache hits.
- `getCurriculumPage` accounted for 1,758,320 bytes across 526 calls. Of those
  calls, 315 were cache hits.
- Quran page reads represented 86.5% of sampled development database I/O.

### Production

Window: 2026-07-10 10:50:54 UTC through 11:35:36 UTC.

- 656 completed executions read 1,735,605 bytes across 763 documents.
- `getQuranSurahPage` read 778,838 bytes across 9 calls. Six were cache hits.
- `getCurriculumPage` read 494,237 bytes across 254 calls. 201 were cache hits.
- One analytics partition read 364,442 bytes and wrote 79,050 bytes.
- `getContentRoute` read 79,462 bytes across 163 calls. 33 were cache hits.

This sample does not explain an entire monthly invoice. It does show that normal
production traffic in the sampled window was small relative to development
Quran page generation.

## Source Payload Estimate

The current Quran source contains 114 surahs and 6,236 verse rows. Serializing
the current page-query shape from source produces these directional estimates:

- All 114 page payloads: 19,504,297 bytes (18.60 MiB).
- The long Indonesian tafsir strings alone: 9,147,814 bytes.
- Page payloads without long tafsir: 10,245,750 bytes (9.77 MiB).
- Estimated payload reduction: 47.47%.
- Largest page, surah 2: 1,343,103 bytes; 679,179 bytes without long tafsir.

These are JSON payload estimates, not invoice bytes. Convex bills the stored
document and index bytes read by a function. Omitting `tafsir.id.long` only from
the returned object would therefore not remove its database I/O; the stored hot
row must change. The current web Quran page uses only `tafsir.id.short`.

## Current Architecture

- `getQuranSurahPage` reads every verse document for a surah. Each verse row
  stores both short and long tafsir.
- Route metadata and the rendered Quran shell independently call the full Quran
  page query.
- Both reads use the `contentRuntime` Next.js cache profile: five-minute stale,
  one-day revalidation, and seven-day expiry.
- Next.js includes the build ID in every `use cache` key. A new build therefore
  invalidates the previous build's entries.
- `.github/workflows/agent-docs.yml` runs the root production build on every pull
  request synchronization and points content reads at the production Convex
  deployment.
- Convex query caching limits repeated identical reads while source data remains
  unchanged, but a cold page or invalidated query still reads the stored rows.

## Causal Assessment

Confidence is high that Quran cold reads are an expensive hot path: they dominate
the development sample, and nearly half of their source payload is long tafsir
that the page does not use.

Confidence is medium that repeated static builds are the main monthly trigger.
The code and Next.js cache-key rules support that mechanism, but the monthly
Database I/O breakdown is still required to attribute every billed byte.

Confidence is unknown for backup contribution. Convex confirms that logical
backups consume database bandwidth, but the active dev and production backup
schedules were not available in the collected evidence.

## Optimization Order

No step should ship before its measurement gate passes.

1. Export the Database I/O dashboard breakdown and record the dev and production
   backup schedules. Reconcile both with the invoice period.
2. Stop avoidable repeated production-data builds. Ensure one validation build
   per commit SHA and determine whether pull-request agent docs can consume one
   existing build artifact or a non-production content snapshot.
3. Add a lightweight Quran metadata query so metadata generation never loads all
   verses. Keep the full page query for the body.
4. Remove long tafsir from the hot `quranVerses` document. If the product needs it,
   move it to a separately keyed table and read it only on demand; otherwise do
   not sync it into Convex.
5. Re-evaluate logical backup frequency against the product recovery-point
   objective. Do not disable production backups merely to reduce cost.
6. Add durable usage attribution from Convex log-stream fields such as
   `database_io_read_bytes` and `database_io_write_bytes`, with a monthly alert
   before included I/O is exhausted.

After each step, compare seven-day database I/O per build and per active user.
Keep a change only when measured I/O falls without correctness, freshness,
recovery, or realtime regressions.

## Guardrails

- Do not move mutable attempt, response, entitlement, or user state out of
  Convex to solve a static-content read problem.
- Do not replace indexed reads with unbounded collection or client filtering.
- Do not add a response-only projection and claim database savings while the
  same large document is still read.
- Do not disable backups without a documented recovery-point objective and a
  tested restore path.
- Do not add another cache layer before measuring Convex cache hits and build
  invalidation; stale duplicated caches increase operational risk.

## References

- [Convex pricing](https://www.convex.dev/pricing)
- [Convex limits and database I/O definition](https://docs.convex.dev/production/state/limits)
- [Convex automatic query caching](https://docs.convex.dev/realtime)
- [Convex backup pricing](https://docs.convex.dev/database/backup-restore)
- [Convex usage attribution fields](https://docs.convex.dev/platform-apis/track-usage)
- [Next.js `use cache` keys](https://nextjs.org/docs/app/api-reference/directives/use-cache#cache-keys)
