import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  bindLegacySet,
  requireTryoutSnapshot,
} from "@repo/backend/convex/tryouts/migrations/catalog";
import { isSignedAttempt } from "@repo/backend/convex/tryouts/migrations/signed";
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
    if (!attemptIsPrepared(attempt, set)) {
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

    const scaleVersionId = yield* resolveScale(
      ctx,
      expectedSnapshotId,
      attempt,
      set.identity
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

/** Verifies the route and every frozen section before root activation. */
function attemptIsPrepared(
  attempt: Doc<"tryoutAttempts">,
  set: Effect.Effect.Success<ReturnType<typeof bindLegacySet>>
) {
  return (
    attempt.setIdentity === set.identity &&
    attempt.countryKey === set.row.countryKey &&
    attempt.examKey === set.row.examKey &&
    attempt.trackKey === set.row.trackKey &&
    attempt.setKey === set.row.setKey &&
    attempt.locale === set.row.locale &&
    attempt.setPublicPath === set.row.publicPath &&
    attempt.snapshotReleaseId !== undefined &&
    attempt.sectionSnapshots.every(
      (section) =>
        section.sectionIdentity !== undefined &&
        section.sectionRowHash !== undefined
    )
  );
}

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

/** Resolves the exact signed scale frozen into an activated IRT attempt. */
const resolveScale = Effect.fn("tryouts.migrations.resolveAttemptScale")(
  function* (
    ctx: MutationCtx,
    expectedSnapshotId: string,
    attempt: Doc<"tryoutAttempts">,
    setIdentity: string
  ) {
    if (attempt.scoringStrategy !== "irt") {
      return null;
    }
    const scale = yield* loadScale(ctx, attempt, setIdentity);
    if (
      !scale ||
      (scale.tryoutSnapshotId !== undefined &&
        scale.tryoutSnapshotId !== expectedSnapshotId) ||
      scale.setIdentity !== setIdentity ||
      scale.tryoutSetId !== attempt.tryoutSetId ||
      scale.questionCount !== attempt.totalQuestions
    ) {
      return yield* migrationFail(
        "An IRT attempt cannot activate before its scale is prepared."
      );
    }
    return scale._id;
  }
);

/** Loads an already-frozen scale or the latest prepared migration scale. */
function loadScale(
  ctx: MutationCtx,
  attempt: Doc<"tryoutAttempts">,
  setIdentity: string
) {
  const scaleVersionId = attempt.scaleVersionId;
  if (scaleVersionId) {
    return Effect.promise(() => ctx.db.get(scaleVersionId));
  }
  return findLatestScale(ctx, setIdentity);
}

/** Finds the latest prepared scale for one signed set snapshot. */
function findLatestScale(ctx: MutationCtx, setIdentity: string) {
  return Effect.promise(() =>
    ctx.db
      .query("irtScaleVersions")
      .withIndex("by_setIdentity_and_publishedAt", (query) =>
        query.eq("setIdentity", setIdentity)
      )
      .order("desc")
      .first()
  );
}

/** Activates one bounded attempt page after all child migrations finish. */
export const activateAttempts = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(activateAttemptPage(ctx, args)),
});
