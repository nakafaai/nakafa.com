# Strict Phase 2 deletion ledger

Phase 2 may start only after `contentRelease/cutover/proof:proof` returns its
exact receipt and `contentCutoverState.phase` is `proved`. The retained-history
tables remain until their independent zero-reference gate is satisfied.

## Coordinated transition

1. Keep the private production backup until every Phase 2 proof is complete.
2. Deploy the current signed application and the Phase 2 backend that contains
   no legacy content writer, reader, route, sync, repair, local-content audio
   path, or fallback. Remove the publication guards from the sole current
   signed Aksara ingress in this deployment because no legacy publication
   writer remains, while retaining the independent try-out and application
   maintenance guards backed by the `proved` checkpoint.
3. Keep `contentCutoverState` in `proved` while verifying that the deployed app
   no longer calls any legacy function.
4. Publish the clean six-scope current genesis through the protected Aksara
   release workflow and prove the exact active pointer and signed catalogs.
5. Run application, retained-history, and signed-publication acceptance while
   the `proved` checkpoint still blocks try-out and application writes.
6. Deploy the strict current schema while preserving the maintenance guard.
7. Delete the single `contentCutoverState` and `contentCutoverActivity`
   documents through the Phase 2 bounded retire mutation only after genesis
   and application acceptance succeed.
8. Verify both temporary tables are empty, then deploy the guard retirement
   and remove every temporary seam below as one coordinated boundary.
9. Physically delete every empty undeclared legacy and cutover table from the
   production deployment, then prove that no table or scheduled function
   remains.

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
- Delete `contentCutoverActivity` and `contentCutoverState` after their rows are
  zero and their schema declarations are gone.
- Remove `ELEVENLABS_API_KEY` and `ENABLE_AUDIO_GENERATION` from every Convex
  and Vercel environment after the deployed source and scheduler proof have no
  consumer.
- Preserve current analytics and application-state tables that have live
  consumers.
