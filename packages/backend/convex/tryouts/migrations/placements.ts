import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  identityFailure,
  type TryoutIdentityInput,
} from "@repo/backend/convex/tryouts/migrations/spec";
import {
  exactRows,
  identityReceipt,
  requireSet,
  requireStableAttempt,
  validatePlacementState,
} from "@repo/backend/convex/tryouts/migrations/state";
import { loadStableSet } from "@repo/backend/convex/tryouts/snapshot/catalog";
import { loadStablePlacement } from "@repo/backend/convex/tryouts/snapshot/placement";
import { Effect } from "effect";

/** Migrates one bounded placement page to signed Aksara artifact identities. */
export const migratePlacements = Effect.fn(
  "tryouts.migrations.migratePlacements"
)(function* (ctx: MutationCtx, input: TryoutIdentityInput) {
  const rows = yield* exactRows(
    () => ctx.db.query("tryoutAttemptPlacements").take(input.expectedRows + 1),
    input.expectedRows,
    input.phase
  );
  const page = yield* Effect.promise(() =>
    ctx.db.query("tryoutAttemptPlacements").paginate(input.paginationOpts)
  );
  let candidates = 0;
  let updated = 0;
  for (const placement of page.page) {
    const [attempt, section] = yield* Effect.all([
      Effect.promise(() => ctx.db.get(placement.tryoutAttemptId)),
      Effect.promise(() => ctx.db.get(placement.tryoutSectionId)),
    ]);
    if (!(attempt && section) || section.tryoutSetId !== attempt.tryoutSetId) {
      return yield* identityFailure(
        "TRYOUT_IDENTITY_PLACEMENT_PARENT_INVALID",
        `Placement ${placement._id} has an invalid durable parent.`
      );
    }
    const set = yield* requireSet(ctx, attempt.tryoutSetId);
    const stableSet = yield* loadStableSet(ctx, input.snapshotId, set);
    const attemptError = requireStableAttempt(
      attempt,
      input.snapshotId,
      stableSet
    );
    if (attemptError) {
      return yield* attemptError;
    }
    const frozenSection = attempt.sectionSnapshots.find(
      (candidate) => candidate.tryoutSectionId === placement.tryoutSectionId
    );
    if (
      !frozenSection ||
      frozenSection.sectionKey !== section.sectionKey ||
      frozenSection.sourceRevision !== section.sourceRevision
    ) {
      return yield* identityFailure(
        "TRYOUT_IDENTITY_PLACEMENT_SECTION_INVALID",
        `Placement ${placement._id} does not belong to its attempt snapshot.`
      );
    }
    const stable = yield* loadStablePlacement(
      ctx,
      input.snapshotId,
      stableSet,
      frozenSection.sectionKey,
      {
        answerContentKey: `${placement.sourcePath}/answer`,
        choices: placement.choiceSnapshots,
        locale: stableSet.locale,
        questionContentKey: `${placement.sourcePath}/question`,
        questionOrder: placement.questionOrder,
        sourceRevision: placement.sourceRevision,
        title: placement.title,
      }
    );
    const placementError = validatePlacementState(
      placement,
      frozenSection.sectionKey,
      stable
    );
    if (placementError) {
      return yield* placementError;
    }
    if (placement.placementIdentity !== undefined) {
      continue;
    }
    candidates += 1;
    if (input.apply) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutAttemptPlacements", placement._id, {
          answerArtifactHash: stable.row.answerArtifactHash,
          answerContentKey: stable.row.answerContentKey,
          placementIdentity: stable.identity,
          placementRowHash: stable.rowHash,
          questionArtifactHash: stable.row.questionArtifactHash,
          questionContentKey: stable.row.questionContentKey,
          rendererDomain: stable.row.rendererDomain,
          sectionKey: stable.row.sectionKey,
        })
      );
      updated += 1;
    }
  }
  return identityReceipt(rows.length, page, candidates, updated);
});
