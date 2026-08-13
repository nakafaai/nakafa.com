# Strict Phase 1 production runbook

Run this sequence only from the reviewed exact-head Phase 1 commit after its
ready pull request and deployment checks pass. Keep the private production
backup until the final Phase 2 proof is complete.

Every command below targets production. Stop on any count, identity, phase, or
hash difference. Never repair, skip, or reinterpret a failed gate.

## Deploy and quiesce

1. Resolve the exact provenance of the currently deployed production functions
   and schema before comparing them with this branch. Stop if the live function
   set cannot be tied to an audited deployment. Production may already omit the
   legacy audio functions and declarations, but that absence is never evidence
   that the remaining Phase 1 changes were deployed.
2. Prove the three audio tables, all six retired synthetic learning-program
   tables, and global file storage are empty, including undeclared physical
   tables that remain visible through the data CLI:

   ```sh
   pnpm --filter @repo/backend exec convex data audioContentSources --prod --limit 1
   pnpm --filter @repo/backend exec convex data contentAudios --prod --limit 1
   pnpm --filter @repo/backend exec convex data audioGenerationQueue --prod --limit 1
   pnpm --filter @repo/backend exec convex data learningProgramCoverage --prod --limit 1
   pnpm --filter @repo/backend exec convex data learningProgramSources --prod --limit 1
   pnpm --filter @repo/backend exec convex data learningPrograms --prod --limit 1
   pnpm --filter @repo/backend exec convex data learningPlanItems --prod --limit 1
   pnpm --filter @repo/backend exec convex data learningPlans --prod --limit 1
   pnpm --filter @repo/backend exec convex data learningProfiles --prod --limit 1
   pnpm --filter @repo/backend exec convex data _storage --prod --limit 1
   ```

   Accept only `There are no documents in this table.` for all ten reads. This
   is a hard precondition because Phase 1 removes the old audio row and storage
   cleanup path, while Phase 2 removes the synthetic learning-plan schema and
   account-cleanup path. The private pre-cutover backup must preserve the same
   empty inventories. The quiescence initialization transaction repeats all
   six program-table zero reads, persists their versioned zero receipt, and
   closes the writer guard before any destructive drain begins.
3. Run the final production dry run. Confirm the target function set contains
   no legacy audio function and the target schema declares no legacy audio
   table. If production already omits them, the dry run must leave them absent
   rather than report a removal. Confirm it adds only the reviewed temporary
   cutover and retained-history schema plus the 18 additive reference indexes,
   and preserves every legacy content table.
4. Deploy Phase 1.
5. Invoke the legacy drain once. This first call performs the full read-only
   audit, initializes the durable writer guard, returns phase `quiescent`, and
   deletes no legacy row.

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/legacy:drainLegacy '{}' --prod
```

## Remove the legacy audio journal

Audit the exact terminal Workflow component inventory:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/audio:audit '{}' --prod
```

Accept only 63 workflows, 37 successful, 26 failed, and 315 linked steps. The
audit also scans every scheduler page and rejects any pending or in-progress
audio function.

Run cleanup repeatedly until it returns `complete: true` with zero remaining
workflows and steps:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/audio:cleanup '{}' --prod
```

Confirm the exact frozen audit and both durable timestamps:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/audio:checkpoint '{}' --prod
```

The shared Workflow component remains because other product domains use it.

## Stage signed article identities

Backfill the exact 14 active article asset IDs from their authenticated signed
projections:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/articleAssets:stage '{}' --prod
```

Accept only `complete: true`, `total: 14`, and a combined `updated` plus
`unchanged` count of 14. Repeating the command must return 14 unchanged rows.

## Stage and prove signed material references

Backfill the storage-derived topic asset on all 766 authenticated material
lessons, then prove every lesson and topic index in durable pages. Invoke the
checkpoint until it returns `complete: true`:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/materialAssets:checkpoint '{}' --prod
```

Each transaction processes at most three material rows. The staging phase may
read at most four 16 KiB rows, and the proof phase may read at most 18 16 KiB
rows across its page and exact index checks, for a 294,912-byte ceiling. Accept
only monotonically increasing staging and proof counts, a terminal `checked:
766`, exactly 72 localized topic identities, and both count-766 lesson and
count-72 topic proof receipts. Repeating the terminal command must return
`complete: true` with zero processed or staged rows.

## Stage signed snapshot reference identities

Backfill and prove the exact 228 Quran asset IDs and public paths from their
authenticated signed search rows. Invoke the bounded checkpoint repeatedly
until it returns `complete: true`:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/quranAssets:checkpoint '{}' --prod
```

Each Quran transaction processes at most three rows and durably advances its
signed snapshot cursor. Accept only monotonically increasing `checked` counts,
`processed` between 0 and 3, and a terminal `checked: 228`. Repeating the
terminal command must return `complete: true`, `checked: 228`, and zero
processed or staged rows.

Then backfill the exact 108 try-out asset IDs from their authenticated signed
catalog rows:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/tryoutAssets:stage '{}' --prod
```

Accept only `complete: true`, `total: 108`, and an `updated` plus `unchanged`
sum of 108. Repeating the command must report all 108 rows unchanged.

## Prove all reference indexes in isolated transactions

Authenticate each remaining family and store its typed proof receipt
separately. The material and Quran checkpoints above already store their
isolated receipts, so this step never combines those inventories in one Convex
transaction:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/articleAssets:prove '{}' --prod
pnpm --filter @repo/backend exec convex run contentRelease/cutover/tryoutAssets:prove '{}' --prod
```

Accept only article and try-out receipts with counts 14 and 108. Together with
the completed material lesson count-766, material topic count-72, and Quran
count-228 receipts, the checkpoint must hold exactly five reference receipts
across four families. Every proof authenticates its complete active inventory,
rejects duplicate signed asset or route identities, and proves every permanent
reference index resolves the exact source row. The quiescent publication guard
remains active for the lifetime of these receipts.

## Preserve retained attempt history

While the checkpoint remains `quiescent`, copy the app locale into the
additive current field:

```sh
pnpm --filter @repo/backend exec convex run tryouts/history/locale:migrate '{"target":"attempt"}' --prod
pnpm --filter @repo/backend exec convex run tryouts/history/locale:migrate '{"target":"progress"}' --prod
```

Accept exactly 21 attempts and 10 progress rows. Then copy immutable catalog
rows in pages, starting at `afterIndex: -1`, and reuse each returned
`nextIndex` until `done: true`:

```sh
pnpm --filter @repo/backend exec convex run tryouts/history/copy:copy '{"afterIndex":-1,"rowKind":"catalog"}' --prod
```

Copy placement rows the same way, starting at `afterIndex: 53`:

```sh
pnpm --filter @repo/backend exec convex run tryouts/history/copy:copy '{"afterIndex":53,"rowKind":"placement"}' --prod
```

Finalize only after the copy receipts total exactly 54 catalog rows and 840
placement rows:

```sh
pnpm --filter @repo/backend exec convex run tryouts/history/finalize:finalize '{}' --prod
```

Accept only 21 markers, 21 attempts, 10 progress rows, 1,720 frozen
placements, the exact retained snapshot ID, and the exact 15 and 6 release
split.

## Stop at the reader boundary

Do not invoke the legacy drain again, freeze the publication pointer, or drain
any current signed table in this deployment. The Phase 1 schema contains an
optional `readerCutoverAcceptedAt` checkpoint, but this source deliberately
contains no operation that can write it. Every destructive page and the final
proof reject the missing checkpoint.

The next deployment must first route retained set pages, retained section
pages, and protected artifact reads through the authenticated history tables.
It must also remove every legacy application and agent-doc reader. Only that
deployment may expose the bounded reader-acceptance mutation described in
`phase2.md`. That mutation validates all five durable reference receipts across
four families and the unchanged audited publication identity without reopening
the large source inventories in one transaction.
