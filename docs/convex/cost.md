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

### 2026-09-12 to 2026-10-12 usage by function group

Read from the Convex Usage page on 2026-10-11 (team Nakafa, Professional plan, all
projects). Only Database I/O was over what the plan includes.

| Resource | Usage | Included | On demand |
| --- | ---: | ---: | ---: |
| Function calls | 2.2M | 25M | 0 |
| Action compute | 10 GB-hours | 250 GB-hours | 0 |
| Database storage | 8.52 GB | 50 GB | 0 |
| Database I/O | 92.9 GB (reads 86.78 GB, writes 6.11 GB) | 50 GB | 42.9 GB |
| Data egress | 2.31 GB | 50 GB | 0 |

Database I/O by the group of functions that caused it:

| Group | GB | What it is |
| --- | ---: | --- |
| Content release pipeline | 36.9 (production 26.95, dev 9.95) | Publishing from Aksara: staging, proof, compaction, heads, rollback preparation |
| Runtime reads | about 34 | Serving `www`, `api` and `mcp`: lesson, navigation, sitemap, ownership, catalog |
| Exports and one-off queries | 13.8 | `snapshot_export` 8.92 (dev 0.96), queries run from the dashboard, the CLI or a connector 3.02, the dashboard itself 0.87 |
| Popularity pipeline | 3.27 | Eight windows in two scopes, of which the homepage read one |

Quiet days used 1.0 to 2.6 GB. The days above that were content releases and
exports: about 9.5 GB on 13 September, 10.5 GB on 24 September, 9.3 GB on
27 September.

Four runtime functions ran 200,000 to 250,000 times each in the period
(`article.categories`, `page.catalog`, `material.sitemapPage`,
`ownership.resolve`), which is one call for nearly every document request,
crawlers included, on a site with few learners.

What changed because of these numbers, each in its own section or pull request:
the reads nobody needed (below, #991), content read once per release through a
store that a deploy does not empty (#992), content releases that publish to
production only (Aksara #452), and no production export or one-off production
query as a working rule. The measured effect belongs in this note after a full
billing period on the new code.

The hosting usage for the cycle that began on 2026-09-30 showed $11.59 of the
$20.00 credit used after 12 days, with ISR writes at $4.43 (1.11M units). The
move to Cloudflare is recorded in ADR 0037.

### 2026-10-11 reads nobody needed

The 2026-09-12 to 2026-10-12 usage showed 92.9 GB of Database I/O. Five backend
reads were examined. Four had no reader or no reason and changed. The fifth,
the featured try-out question, reads what its completeness proof needs and stays
as it was. Each row is one call measured with Convex test metrics, which count
documents and bytes the way the backend does; production row sizes and counts
were not measured, so these are ratios to carry into the next invoice, not
invoice figures. The last column names the committed test that pins the
documents read after the change.

| Read | Fixture | Before | After | Pinned by |
| --- | --- | ---: | ---: | --- |
| Staging four projections | four staged items | 16 documents, 21,347 bytes | 12 documents, 17,739 bytes | `projection.test.ts`: 12 |
| Saved curriculum program (`getCurrent`) | six programs | 16 documents, 17,371 bytes | 5 documents, 5,988 bytes | `program.test.ts`: 5 |
| Featured try-out question | real SNBT set 1: seven sections, twenty landing questions | 34 documents, 60,975 bytes | unchanged | `featured.test.ts`: 34 |
| Idle compaction tick | 40 retained releases | 40 documents, 185,588 bytes | 2 documents, 4,655 bytes | `compact.test.ts`: 2 |
| One more view of a known lesson | ten lessons, five days of signals | 101 documents, 115,371 bytes, 27 writes | 17 documents, 18,169 bytes, 6 writes | `apply.test.ts`: 16 on one lesson |
| Daily popularity expiry | the same ten lessons | 14 pages, 112 documents, 76,104 bytes | 1 page, 12 documents, 8,820 bytes | `refresh.test.ts`: 15 on one lesson |
| Weekly popularity repair | the same ten lessons | 14 pages, 714 documents, 621,839 bytes | 1 page, 62 documents, 52,020 bytes | `refresh.test.ts`: 21 on one lesson |

The three popularity rows were measured once, before and after the change, on a
fixture of ten lessons with five days of signals, four of them also viewed
through a curriculum placement. That fixture is not committed, so the tests pin
the same operations on one lesson instead.

One featured question call is large because it proves the landing section
complete before it returns one question: the state, release and snapshot rows
(3), the country, exam, track and set rows (4), the seven section rows of the
set (7), and all twenty placements of the landing section (20), each carrying
its whole response. A read of the one placement took 15 documents and 20,268
bytes, and also stopped noticing a missing sibling placement or a broken order,
so it was reverted. Any saving belongs to the caller, which can ask once per
content release instead of once per request.

The popularity pipeline cost 3.27 GB in that invoice, of which the view drain
was 1.66 GB, the daily expiry 1.04 GB and the weekly repair 0.57 GB. Each is
multiplied by the bytes read after the change over the bytes read before it in
the ten-lesson rows (18,169 over 115,371, 8,820 over 76,104 and 52,020 over
621,839), which gives about 0.26 GB, 0.12 GB and 0.05 GB. That leaves about
0.43 GB, so roughly 2.8 GB a month fewer. The estimate assumes the invoice
splits the way the fixture does. The counters and maintenance rows of the older
windows and scope are retired: the prune found none left on dev and production
on 12 October 2026, and the code that retired them is deleted. Retiring them
cost about 11.6 KB per counter once (a page of ten counters read 95 documents
and 116,105 bytes in a throwaway fixture).

Compaction no longer writes `contentState`, the row every content query reads,
so a compaction page stops making Convex run those queries again. That saving
is in function executions, not in Database I/O.

One step remains: the older scope and `applied` windows of daily signals are
cleared in the change that narrows them (ADR 0008). The retirement of the
older popularity rows and the ignored `windowKey` argument are deleted. The
carry of the compaction fields out of `contentState` ended on 12 October 2026:
dev and production each held the `contentCompaction` row and no `contentState`
row held a compaction field, so the carry, its tests and the six fields were
deleted.

### 2026-10-12 the section index

Knowledge search (ADR 0023) keeps one row for each section of a lesson, an
article, and a Quran passage, and builds the index again for each content
release. Each row below is one build or one search measured with Convex test
metrics on the nine documents and 27 sections of `test/knowledge.ts`, which count
documents and bytes the way the backend does. The last column names the committed
test that pins the documents. The bytes come from the same runs and are not
pinned, because they move with the text of the fixture.

| Operation | Documents read | Documents written | Bytes read | Bytes written | Pinned by |
| --- | ---: | ---: | ---: | ---: | --- |
| First build of the release | 71 | 37 | 74,188 | 204,422 | `build.test.ts`: 71 and 37 |
| Build of the same release again | 63 | 0 | 60,891 | 0 | `build.test.ts`: 63 and 0 |
| Build of a new release that changed nothing | 64 | 1 | 61,027 | 136 | `build.test.ts`: 64 and 1 |
| New release, one section of one lesson edited | 77 | 3 | 130,953 | 7,934 | `build.test.ts`: 77 and 3 |
| New release, a section inserted in a lesson | 80 | 7 | 153,443 | 37,817 | `build.test.ts`: 80 and 7 |
| Gate of a search (`state.ready`) | 2 | 0 | 912 | 0 | `state.test.ts`: 2 |
| `hits.resolve` with one hit | 6 | 0 | 16,787 | 0 | `hits.test.ts`: 6 |
| Each more section of the same document | 1 | 0 | | | `hits.test.ts`: 1 |
| Each more document among the hits | 6 | 0 | | | `hits.test.ts`: 6 |

**What a build writes.** The first build writes 27 sections, 9 records of the
version each document was made from, and the record that the build finished. A
build that changes nothing writes nothing, and a new release that changes nothing
writes only that last record, because a row does not say which release made it.
A new release that edits one section embeds one text and writes that section (the
vector is 6,914 bytes of its row), the record of its document, and the record of
the build. A section inserted in a lesson embeds one text too. Every row of a
lesson says how many sections its document has, so all 5 rows are written again,
but the sections that stood a place further keep the vector of the stored row
with their text: they are not embedded again. An unchanged section costs no
embedding call and no write when the number of sections of its document is the
same.

**What the first build costs at the scale of the corpus (computed, not
measured).** The Aksara corpus at `9821d3f38b` was counted once with the real
splitter, in a script that is not committed: 1,170 lessons and articles with
9,567 sections (19 at the most in a document) and 12.9 MB of text, and, from the
verse counts of the Quran, 114 surahs with 1,085 chunks, 3,255 passages in three
languages (48 at the most in a surah and a language). That is 12,822 rows and
1,512 documents. The unit costs of the table and one measured surah of 50 chunks
(54 documents read by the step, 1 by each of its three stores) give for the first
build:

- Documents read: 5,070 for the lessons (4 for each lesson and 2 for each of the
  195 pages), 1,512 for the stores (the state, once for each), 1,541 for the
  Quran (4 for each surah and 1 for each chunk), about 2,700 for the clean up (2
  for each lesson, 1 for each Quran document, and the state), and 1 for the
  record: about 10,800 in all, and up to about 13,100 if every lesson has two
  versions, whose head is read twice.
- Documents written: 14,335, which are 12,822 sections, 1,512 records, and the
  record of the build.
- Embedding calls: 356, which are 231 for the lessons in 195 steps and 125 for the
  Quran in 114 steps, for 12,822 texts. A step embeds the sections of its own
  documents in batches of 64. `quran.test.ts` pins the calls of one surah.
- Bytes written: the vectors are 88.7 MB (12,822 times 6,914), the text of the
  lessons is 12.9 MB, the text of the Quran is estimated at 12 MB from the size of
  its sources, and the other fields of a row are about 0.7 KB each, 9 MB, so about
  120 MB.
- Bytes read: the sources of the lessons are about 11.4 MB of MDX, read once.
  The search rows, which carry each lesson's whole plain text, the heads, the
  routes, and the chunks of the Quran were not measured at this scale.

A build of the same release again, or of a new release that changed nothing,
reads 4 documents for each lesson and 2 for each page too, but no artifact body
and no chunk of the Quran, and writes nothing but the record of the build. The
unit costs give 8,100 documents read, and up to about 10,400 if every lesson has
two versions: the lessons (5,070), the records of the 342 Quran documents and the
owner of the Quran (about 350), the clean up (about 2,700), and the record (2).

A design that stored the release on every row would have rewritten every section
for every release: about 120 MB written and 360 MB read for 12,822 rows, from
reading that code (the row read three times and written once), not measured.
That is why a row does not say which release made it.

**What a search costs.** A search asks `state.ready` first, 2 documents, and only
when the index may answer does it embed the question and run the vector search.
Then `hits.resolve` reads, for one question: one row for each section that the
vector search and the word search return (at most 32 and 32, and a row both found
is read once), the same place in the learner's language for each of the best 24
sections that the words found in another language (1 document each), and the
reference of the document of each of those 24 sections (5 documents for each
distinct document, once however many of its sections rank). One hit costs 6 documents, a
second section of the same document 1 more, and a section of another document 6
more; all three are pinned in `hits.test.ts`. A search that ranks many documents
reads far more than the one hit of the table: by the constants, up to 2 + 32 + 32
+ 24 + 5 times 24, which is 210 documents for one question, and Nina may put up
to four questions to the index in one search, so up to 840 (computed from
`CANDIDATES_PER_LEG`, `SEARCH_VERIFY_SLACK`, `SECTION_CANDIDATES`, and
`NAKAFA_AGENT_MAX_QUERIES`, not measured). A row is read whole with its vector:
7.7 KB in the fixture, and up to about 31 KB for a Quran passage, so one question
may read 0.5 MB to 2 MB of rows. A search over all kinds of content also runs the
word search for try-outs once, which is not counted here. While the index may not
answer, a search costs the 2 documents of the gate and no embedding call.

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
- Do not add compatibility reads for removed data models. Clear the obsolete rows
  with the Convex CLI, or remove them with their table in the same change, and
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
