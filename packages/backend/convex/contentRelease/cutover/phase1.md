# Strict Phase 1 production runbook

Run this sequence only from the reviewed exact-head Phase 1 commit after its
ready pull request and deployment checks pass. Keep the private production
backup until the final Phase 2 proof is complete.

Every command below targets production. Stop on any count, identity, phase, or
hash difference. Never repair, skip, or reinterpret a failed gate.

## Deploy and quiesce

1. Run the final production dry run and confirm it removes the audio functions
   and tables, adds only the temporary cutover and retained-history schema, and
   preserves every legacy content table.
2. Deploy Phase 1.
3. Invoke the legacy drain once. This first call performs the full read-only
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

## Drain legacy rows

Run the bounded legacy drain until it returns `complete: true`,
`deleted: 12854`, and phase `legacy-drained` across the accumulated
receipts:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/legacy:drainLegacy '{}' --prod
```

## Preserve retained attempt history

Copy the app locale into the additive current field:

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

## Freeze and prove

Authenticate all 1,680 retained artifacts and freeze the old mutable pointer:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/freeze:freeze '{}' --prod
```

Run the bounded current-store drain until the accumulated receipts return
`complete: true`, `deleted: 22954`, and phase `complete`:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/current:drainCurrent '{}' --prod
```

Run the terminal proof:

```sh
pnpm --filter @repo/backend exec convex run contentRelease/cutover/proof:proof '{}' --prod
```

Accept only the exact receipt and durable phase `proved`. Phase 2 must follow
`phase2.md`; no current genesis, strict schema, or temporary-row retirement
may run before this proof succeeds.
