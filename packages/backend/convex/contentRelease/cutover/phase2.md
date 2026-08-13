# Strict Phase 2 deletion ledger

Phase 2 reader cutover may start only after the Phase 1 runbook has created all
21 authenticated history markers while `contentCutoverState.phase` remains
`quiescent`. Destructive draining may start only after the deployed reader
cutover writes the otherwise unreachable `readerCutoverAcceptedAt` checkpoint.
The retained-history tables remain until their independent zero-reference gate
is satisfied.

## Coordinated transition

1. Keep the private production backup until every Phase 2 proof is complete.
2. Deploy the additive reader cutover before deleting any source row. Retained
   set pages, section pages, and protected artifact reads must select the
   attempt-owned history marker first and read only authenticated history rows.
   Remove every legacy application and agent-doc reader in the same deployment.
3. Run current publication, retained in-progress attempt, completed-attempt
   review, protected artifact, agent-doc, and browser acceptance against that
   deployment. No fallback or current-history union is accepted.
4. Only the reader-cutover deployment may expose
   `contentRelease/cutover/readers:accept`. It must re-prove all 21 markers,
   require the exact Phase 1 article, material lesson, material topic, Quran,
   and try-out proof receipts, and verify the audited publication identity is
   unchanged before it persists `readerCutoverAcceptedAt` on the existing
   quiescent checkpoint. Phase 1 has no writer for this field, so an earlier
   drain is impossible.
5. Invoke `contentRelease/cutover/legacy:drainLegacy` until it reaches phase
   `legacy-drained`. Sum `deleted` across every bounded action receipt and
   accept only exactly 12,854 total deletions. The terminal proof independently
   requires the same durable cumulative count.
6. Authenticate all 1,680 retained artifacts and freeze the old mutable pointer:

   ```sh
   pnpm --filter @repo/backend exec convex run contentRelease/cutover/freeze:freeze '{}' --prod
   ```

7. Run `contentRelease/cutover/current:drainCurrent` until its accumulated
   receipts return exactly 22,954 deletions and phase `complete`, then run:

   ```sh
   pnpm --filter @repo/backend exec convex run contentRelease/cutover/proof:proof '{}' --prod
   ```

   Accept only the exact receipt and durable phase `proved`.
8. Deploy the strict current application and backend with no legacy content
   writer, reader, route, sync, repair, local-content audio path, or fallback.
   Remove publication guards from the sole current Aksara ingress while keeping
   the separate try-out and application maintenance guard backed by `proved`.
9. Publish the clean six-scope current genesis through the protected Aksara
   release workflow and prove the exact active pointer and signed catalogs.
10. Run application, retained-history, and signed-publication acceptance while
   the `proved` checkpoint still blocks try-out and application writes.
11. Deploy the strict current schema while preserving the maintenance guard.
12. Physically delete every empty undeclared legacy table and all six retired
   learning-program tables only after the strict schema is deployed. Prove that
   no removed table or scheduled function remains.
13. Delete the single `contentCutoverState` and `contentCutoverActivity`
   documents through the Phase 2 bounded retire mutation only after genesis,
   application acceptance, and physical legacy-table deletion succeed.
14. Verify both temporary tables are empty, then deploy the guard retirement
   and remove every temporary seam below as one coordinated boundary. Finally,
   physically delete both empty cutover tables.

## Code deletion

- Delete `contentRelease/cutover/**`, including its schema spread from
  `contentRelease/schema.ts` and this ledger.
- Delete the audio-journal audit, cleanup, scheduler scan, exact inventory
  constants, tests, and checkpoint fields after the Phase 1 proof confirms the
  shared Workflow component contains no matching workflow or linked step.
- Delete the publication guards from `contentRelease/ingress/dispatch.ts`,
  `contentRelease/model.ts`, `contentRelease/models.ts`, and
  `contentRelease/cleanup.ts` in the Phase 2 deployment that also deletes every
  legacy publication writer. The remaining try-out and application guards keep
  the maintenance window closed while the signed genesis is published.
- Delete the legacy and try-out cutover trigger registrations from
  `convex/functions.ts` and the legacy route trigger composition from
  `triggers/contents/routes.ts`.
- Delete the explicit cutover guards from try-out attempt, response, section,
  expiry, progress, and account-cleanup mutations.
- Delete the temporary runtime-cache exclusions for
  `contentCutoverActivity` and `contentCutoverState`.
- Delete the reader-acceptance mutation and `readerCutoverAcceptedAt` field
  after the terminal proof and current-genesis acceptance are complete.
- Delete the retired learning-program zero receipt and its six-table inventory
  only after the terminal proof and physical table deletion are complete.
- Delete migration-only `tryouts/history/copy.ts`, `locale.ts`, and
  `finalize.ts`, plus the write-only history-row operation after their exact
  production functions are no longer referenced.
- Keep only the read-only retained-attempt history decoder, marker, row,
  selector, and protected-runtime seams while retained attempt references are
  nonzero.
- Make current try-out `appLocale` fields required, delete legacy `locale`
  fields and indexes, and remove every optional migration shape.
- Delete the history decoder, tables, and remaining read paths only after
  attempts, markers, referenced old bundles, the old snapshot, history rows,
  and retained artifact references all prove zero.

## Physical table deletion

- Delete all 16 empty legacy tables listed by `LEGACY_INVENTORY`.
- Delete the six empty retired tables listed by `RETIRED_PROGRAM_TABLES`:
  `learningProgramCoverage`, `learningProgramSources`, `learningPrograms`,
  `learningPlanItems`, `learningPlans`, and `learningProfiles`.
- Delete `contentCutoverActivity` and `contentCutoverState` after their rows are
  zero and their schema declarations are gone.
- Remove `ELEVENLABS_API_KEY` and `ENABLE_AUDIO_GENERATION` from every Convex
  and Vercel environment after the deployed source and scheduler proof have no
  consumer.
- Preserve every other current analytics and application-state table that has
  live consumers.
