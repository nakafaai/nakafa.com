# Strict Phase 2 deletion ledger

Phase 2 reader cutover may start only after the Phase 1 runbook has created all
21 authenticated history markers while `contentCutoverState.phase` remains
`quiescent`. Destructive draining may start only after the deployed reader
cutover writes the otherwise unreachable `readerCutoverReceipt` checkpoint.
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
   `contentRelease/cutover/readers:accept`. It must prove the exact 21 attempts
   and 21 markers, the 15 and 6 release split, locale completion, snapshot
   identity, and 1,720 declared questions,
   require the exact Phase 1 article, material lesson, material topic, Quran,
   and try-out proof receipts, and verify the audited publication identity is
   unchanged before it persists one structured `readerCutoverReceipt` on the
   existing quiescent checkpoint. The cold path is limited to four queries,
   44 documents, 512 KiB read, one patch, and zero schedules. An exact retry
   reads only the existing receipt. Phase 1 has no writer for this field, so an
   earlier drain is impossible.
5. Invoke `contentRelease/cutover/legacy:drainLegacy` until it reaches phase
   `legacy-drained`. Sum `deleted` across every bounded action receipt and
   accept only exactly 12,854 total deletions. The terminal proof independently
   requires the same durable cumulative count.
6. Run the full terminal history proof and freeze the old mutable pointer. The
   proof must authenticate both retained bundle and renderer bindings, the
   retained snapshot bytes and aggregate digests, all 54 catalog rows, all 840
   placement rows, all 1,680 retained artifacts, all 1,720 frozen attempt
   placements, all 10 progress rows, and all 21 attempts and markers:

   ```sh
   pnpm --filter @repo/backend exec convex run contentRelease/cutover/freeze:freeze '{}' --prod
   ```

7. Run `contentRelease/cutover/current:drainCurrent` until its accumulated
   receipts return exactly 22,954 deletions and phase `complete`, then run:

   ```sh
   pnpm --filter @repo/backend exec convex run contentRelease/cutover/proof:proof '{}' --prod
   ```

   The post-drain proof must repeat that same full terminal authentication.
   Accept only its observed exact receipt and durable phase `proved`.
8. Deploy the transitional current application and backend with no legacy content
   writer, reader, route, sync, repair, local-content audio path, or fallback.
   Remove publication guards from the sole current Aksara ingress while keeping
   the separate try-out and application maintenance guard backed by `proved`.
9. Publish the clean six-scope current genesis through the protected Aksara
   release workflow and prove the exact active pointer and signed catalogs.
10. Run application, retained-history, and signed-publication acceptance while
   the `proved` checkpoint still blocks try-out and application writes.
11. Retire all 31 legacy locale fields and 1,720 frozen placement titles while
   the transitional schema still declares them. Accept only 21 attempts, 10
   progress rows, 1,720 placements, 31 locale removals, and 1,720 title
   removals. Repeat once and require zero removals on retry:

   ```sh
   pnpm --filter @repo/backend exec convex run contentRelease/cutover/locale:retire '{}' --prod
   ```

12. Immediately deploy the strict try-out schema. Delete the field-retirement
   mutation in that deployment, make `appLocale` required, remove the legacy
   `locale` fields and index, and remove the frozen placement `title` field.
   Preserve the proved checkpoint and all maintenance guards.
13. Physically delete every empty undeclared legacy table and all six retired
   learning-program tables only after the strict schema is deployed. Use the
   Convex Dashboard's table-scoped **Delete table** operation because the
   installed CLI has no table-scoped deletion command. Immediately before each
   deletion, prove the table is still undeclared and empty. Record the table,
   production deployment, operator, timestamp, and zero-count evidence. Prove
   every removed table remains absent after the final deletion.
14. Set the exact accepted genesis identity from the signed publication receipt,
   then delete the single `contentCutoverState` and `contentCutoverActivity`
   documents through the bounded retire mutation:

   ```sh
   export NAKAFA_GENESIS_RELEASE_ID='<accepted-release-id>'
   export NAKAFA_GENESIS_MANIFEST_HASH='<accepted-manifest-hash>'
   NAKAFA_CHECKPOINT_ARGS="$(jq -cn --arg activeReleaseId "$NAKAFA_GENESIS_RELEASE_ID" --arg activeManifestHash "$NAKAFA_GENESIS_MANIFEST_HASH" '{activeReleaseId:$activeReleaseId,activeManifestHash:$activeManifestHash}')"
   pnpm --filter @repo/backend exec convex run contentRelease/cutover/checkpoint:retire "$NAKAFA_CHECKPOINT_ARGS" --prod
   unset NAKAFA_CHECKPOINT_ARGS NAKAFA_GENESIS_MANIFEST_HASH NAKAFA_GENESIS_RELEASE_ID
   ```

   Accept only one checkpoint deletion, one activity deletion, 21 attempts,
   1,720 placements, and 10 progress rows. Repeat once and require zero row
   deletions with the same accepted genesis identity.
15. Verify both temporary tables are empty, then deploy the guard retirement
   and remove every temporary seam below as one coordinated boundary. Finally,
   restore the current content-compaction and try-out-expiry crons, physically
   delete both empty cutover tables, and repeat application acceptance.

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
- Delete the reader-acceptance mutation and `readerCutoverReceipt` field
  after the terminal proof and current-genesis acceptance are complete.
- Delete the retired learning-program zero receipt and its six-table inventory
  only after the terminal proof and physical table deletion are complete.
- This Phase 2 tree deletes migration-only `tryouts/history/copy.ts`,
  `locale.ts`, and `finalize.ts`, their pre-drain audit operations, and the
  write-only history-row operation after exact production completion.
- Keep only the read-only retained-attempt history decoder, marker, row,
  selector, and protected-runtime seams while retained attempt references are
  nonzero.
- Make current try-out `appLocale` fields required, delete legacy `locale`
  fields and indexes, and remove every optional migration shape.
- Delete the history decoder, tables, and remaining read paths only after
  attempts, markers, referenced old bundles, the old snapshot, history rows,
  and retained artifact references all prove zero.

## Physical table deletion

- Delete these 16 empty legacy tables: `articleReferences`, `contentAuthors`,
  `articleContents`, `authors`, `curriculumLessons`, `curriculumTopics`,
  `quranVerses`, `quranSurahs`, `contentRoutes`, `contentRoutePages`,
  `contentRouteCounts`, `publicRouteSitemapCounts`,
  `publicRouteSitemapPages`, `publicRoutes`, `publicRouteSyncState`, and
  `contentSearch`.
- Delete these six empty retired tables: `learningProgramCoverage`,
  `learningProgramSources`, `learningPrograms`,
  `learningPlanItems`, `learningPlans`, and `learningProfiles`.
- Delete `contentCutoverActivity` and `contentCutoverState` after their rows are
  zero and their schema declarations are gone.
- Remove `ELEVENLABS_API_KEY` and `ENABLE_AUDIO_GENERATION` from every Convex
  and Vercel environment after the deployed source and scheduler proof have no
  consumer.
- Preserve every other current analytics and application-state table that has
  live consumers.
