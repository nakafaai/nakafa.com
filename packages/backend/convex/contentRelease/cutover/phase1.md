# Strict Phase 1 production runbook

Run this sequence only from the reviewed exact-head Phase 1 commit after its
ready pull request and deployment checks pass. Keep the private production
backup until the final Phase 2 proof is complete.

Every command below targets production. Stop on any count, identity, phase, or
hash difference. Never repair, skip, or reinterpret a failed gate.

## Deploy and quiesce

1. While the old audio schema and cleanup path are still deployed, prove the
   three audio tables and global file storage are empty:

   ```sh
   pnpm --filter @repo/backend exec convex data audioContentSources --prod --limit 1
   pnpm --filter @repo/backend exec convex data contentAudios --prod --limit 1
   pnpm --filter @repo/backend exec convex data audioGenerationQueue --prod --limit 1
   pnpm --filter @repo/backend exec convex data _storage --prod --limit 1
   ```

   Accept only `There are no documents in this table.` for all four reads. This
   is a hard precondition because Phase 1 removes the old audio row and storage
   cleanup path. The private pre-cutover backup must preserve the same empty
   inventories.
2. Run the final production dry run and confirm it removes the audio functions
   and tables, adds only the temporary cutover and retained-history schema, and
   preserves every legacy content table.
3. Deploy Phase 1.
4. Invoke the legacy drain once. This first call performs the full read-only
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
The reader deployment re-authenticates these identities before accepting its
cutover checkpoint.

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
`phase2.md`.
