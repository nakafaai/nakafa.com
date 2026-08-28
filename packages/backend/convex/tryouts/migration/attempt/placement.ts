import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { verifyStoredTryoutPlacement } from "@repo/backend/convex/tryouts/history/placement";
import { loadStoredTryoutPlacement } from "@repo/backend/convex/tryouts/history/rows";
import {
  loadMapping,
  loadTargetRow,
} from "@repo/backend/convex/tryouts/migration/attempt/target";
import { Effect } from "effect";

/** Converts every frozen placement in place while preserving document IDs. */
export const migratePlacements = Effect.fn(
  "tryouts.migration.migratePlacements"
)(function* (
  ctx: MutationCtx,
  migrationId: string,
  attempt: Doc<"tryoutAttempts">,
  targetSnapshotId: string
) {
  const placements = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttemptPlacements")
      .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .take(attempt.totalQuestions + 1)
  );
  if (placements.length !== attempt.totalQuestions) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained attempt has incomplete frozen placement coverage."
    );
  }
  for (const placement of placements) {
    const historical = yield* loadStoredTryoutPlacement(
      ctx,
      attempt.tryoutSnapshotId,
      placement.placementRowHash
    ).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Retained attempt placement failed historical authentication.",
          })
      )
    );
    if (!historical) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Retained attempt placement is missing."
      );
    }
    yield* verifyStoredTryoutPlacement(historical, placement).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Retained attempt placement differs from signed history.",
          })
      )
    );
    const mapping = yield* loadMapping(
      ctx,
      migrationId,
      "placement",
      placement.placementRowHash
    );
    const target = yield* loadTargetRow(ctx, targetSnapshotId, mapping);
    if (target.rowKind !== "placement") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Retained placement mapping selected a catalog row."
      );
    }
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutAttemptPlacements", placement._id, {
        answerArtifactHash: target.record.row.answerArtifactHash,
        answerContentKey: target.record.row.answerContentKey,
        choiceSnapshots: [...target.record.row.choices],
        contentHash: target.record.row.contentHash,
        placementIdentity: mapping.identity,
        placementRowHash: target.record.rowHash,
        questionArtifactHash: target.record.row.questionArtifactHash,
        questionContentKey: target.record.row.questionContentKey,
        rendererDomain: target.record.row.rendererDomain,
        sectionKey: target.record.row.sectionKey,
        sourcePath: target.record.row.questionSourcePath,
        sourceRevision: target.record.row.sourceRevision,
      })
    );
  }
});
