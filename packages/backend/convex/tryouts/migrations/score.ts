import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  bindLegacySet,
  requireTryoutSnapshot,
} from "@repo/backend/convex/tryouts/migrations/catalog";
import {
  hasLegacySectionSource,
  isSignedScore,
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

/** Prepares one bounded page of finalized scores. */
const migrateScorePage = Effect.fn("tryouts.migrations.migrateScorePage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutScores")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "tryoutScores",
    });
    let changed = 0;
    for (const row of page.page) {
      const patch = yield* prepareScore(ctx, args.expectedSnapshotId, row);
      if (!patch) {
        continue;
      }
      changed += 1;
      if (args.apply) {
        yield* Effect.promise(() => ctx.db.patch(row._id, patch));
      }
    }
    return migrationPageResult(page, changed, processed);
  }
);

/** Adds the signed snapshot and set identity to one legacy score. */
const prepareScore = Effect.fn("tryouts.migrations.prepareScore")(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  score: Doc<"tryoutScores">
) {
  const attempt = yield* Effect.promise(() =>
    ctx.db.get(score.tryoutAttemptId)
  );
  if (!attempt) {
    return yield* migrationFail("A score lost its owning attempt.");
  }
  if (isSignedScore(score, attempt, expectedSnapshotId)) {
    return null;
  }
  if (
    score.tryoutSnapshotId === expectedSnapshotId &&
    score.setIdentity !== undefined &&
    !hasLegacySectionSource(attempt)
  ) {
    return yield* migrationFail(
      "A signed score conflicts with its owning attempt."
    );
  }
  if (!score.tryoutSetId) {
    return yield* migrationFail("A score lost its legacy set reference.");
  }
  const set = yield* bindLegacySet(ctx, expectedSnapshotId, score.tryoutSetId);
  if (
    attempt.userId !== score.userId ||
    attempt.scoringStrategy !== score.scoringStrategy ||
    attempt.totalCorrect !== score.totalCorrect ||
    attempt.totalQuestions !== score.totalQuestions
  ) {
    return yield* migrationFail("A score differs from its owning attempt.");
  }
  if (
    attempt.tryoutSnapshotId !== expectedSnapshotId ||
    attempt.setIdentity !== set.identity
  ) {
    return yield* migrationFail("A score's owning attempt is not prepared.");
  }
  if (
    hasMigrationConflict(score.tryoutSnapshotId, expectedSnapshotId) ||
    hasMigrationConflict(score.setIdentity, set.identity)
  ) {
    return yield* migrationFail(
      "A score conflicts with its signed snapshot identity."
    );
  }
  if (
    score.tryoutSnapshotId === expectedSnapshotId &&
    score.setIdentity === set.identity
  ) {
    return null;
  }
  return {
    setIdentity: set.identity,
    tryoutSnapshotId: expectedSnapshotId,
  };
});

/** Migrates one bounded score page. */
export const migrateScores = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migrateScorePage(ctx, args)),
});
