import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  bindLegacySet,
  requireTryoutSnapshot,
} from "@repo/backend/convex/tryouts/migrations/catalog";
import { resolvePreparedScale } from "@repo/backend/convex/tryouts/migrations/scale";
import {
  isPreparedAttempt,
  isPreparedScore,
  isSignedAttempt,
} from "@repo/backend/convex/tryouts/migrations/signed";
import {
  hasMigrationConflict,
  migrationFail,
  migrationPageOptions,
  migrationPageResult,
  type TryoutMigrationArgs,
  tryoutMigrationArgs,
  tryoutMigrationResultValidator,
  validateMigrationPage,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

/** Activates one bounded page after every attempt dependency is prepared. */
const activateAttemptPage = Effect.fn("tryouts.migrations.activateAttemptPage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "tryoutAttempts",
    });
    let changed = 0;
    for (const attempt of page.page) {
      const patch = yield* prepareActivation(
        ctx,
        args.expectedSnapshotId,
        attempt
      );
      if (!patch) {
        continue;
      }
      changed += 1;
      if (args.apply) {
        yield* Effect.promise(() => ctx.db.patch(attempt._id, patch));
      }
    }
    return migrationPageResult(page, changed, processed);
  }
);

/** Builds the root cutover only after placements and scoring are signed. */
const prepareActivation = Effect.fn("tryouts.migrations.prepareActivation")(
  function* (
    ctx: MutationCtx,
    expectedSnapshotId: string,
    attempt: Doc<"tryoutAttempts">
  ) {
    if (isSignedAttempt(attempt, expectedSnapshotId)) {
      return null;
    }
    const set = yield* bindLegacySet(
      ctx,
      expectedSnapshotId,
      attempt.tryoutSetId
    );
    if (
      hasMigrationConflict(attempt.tryoutSnapshotId, expectedSnapshotId) ||
      hasMigrationConflict(attempt.setIdentity, set.identity)
    ) {
      return yield* migrationFail(
        "An attempt conflicts with its signed snapshot identity."
      );
    }
    if (!isPreparedAttempt(attempt, set)) {
      return yield* migrationFail(
        "An attempt cannot activate before its route and sections are prepared."
      );
    }

    const placements = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.totalQuestions + 1)
    );
    if (
      placements.length !== attempt.totalQuestions ||
      placements.some((placement) => !placementIsPrepared(attempt, placement))
    ) {
      return yield* migrationFail(
        "An attempt cannot activate before every placement is prepared."
      );
    }

    const scaleVersionId = yield* resolvePreparedScale(
      ctx,
      expectedSnapshotId,
      attempt,
      set.identity
    );
    yield* requirePreparedScore(
      ctx,
      expectedSnapshotId,
      attempt,
      scaleVersionId
    );
    const currentScaleVersionId = attempt.scaleVersionId ?? null;
    if (
      attempt.tryoutSnapshotId === expectedSnapshotId &&
      currentScaleVersionId === scaleVersionId
    ) {
      return null;
    }
    return {
      ...(scaleVersionId ? { scaleVersionId } : {}),
      tryoutSnapshotId: expectedSnapshotId,
    };
  }
);

/** Verifies one placement belongs to a prepared frozen section. */
function placementIsPrepared(
  attempt: Doc<"tryoutAttempts">,
  placement: Doc<"tryoutAttemptPlacements">
) {
  const section = attempt.sectionSnapshots.find(
    (candidate) => candidate.sectionKey === placement.sectionKey
  );
  return Boolean(
    placement.answerArtifactHash &&
      placement.answerContentKey &&
      placement.placementIdentity &&
      placement.placementRowHash &&
      placement.questionArtifactHash &&
      placement.questionContentKey &&
      placement.rendererDomain &&
      placement.sectionIdentity &&
      section?.sectionIdentity === placement.sectionIdentity
  );
}

/** Requires terminal scoring to be signed before root activation. */
const requirePreparedScore = Effect.fn(
  "tryouts.migrations.requirePreparedScore"
)(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  attempt: Doc<"tryoutAttempts">,
  scaleVersionId: Doc<"tryoutScores">["scaleVersionId"] | null
) {
  const score = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutScores")
      .withIndex("by_tryoutAttemptId", (query) =>
        query.eq("tryoutAttemptId", attempt._id)
      )
      .unique()
  );
  if (attempt.status === "in-progress") {
    if (score) {
      return yield* migrationFail(
        "An active attempt cannot activate with a finalized score."
      );
    }
    return;
  }
  if (
    !(
      score &&
      isPreparedScore(
        score,
        attempt,
        expectedSnapshotId,
        scaleVersionId ?? null
      )
    )
  ) {
    return yield* migrationFail(
      "A terminal attempt cannot activate before its score is prepared."
    );
  }
});

/** Activates one bounded attempt page after all child migrations finish. */
export const activateAttempts = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(activateAttemptPage(ctx, args)),
});
