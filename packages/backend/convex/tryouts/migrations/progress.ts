import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  bindLegacySection,
  bindLegacySet,
  requireTryoutSnapshot,
} from "@repo/backend/convex/tryouts/migrations/catalog";
import {
  isSignedProgress,
  isSignedSectionAttempt,
  requireSignedAttempt,
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
import { ensureTryoutProgressWithinReadBudget } from "@repo/backend/convex/tryouts/progress/size";
import { Effect } from "effect";

/** Prepares one bounded page of set progress rows. */
const migrateProgressPage = Effect.fn("tryouts.migrations.migrateProgressPage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSetProgress")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "tryoutSetProgress",
    });
    let changed = 0;
    for (const row of page.page) {
      const patch = yield* prepareProgress(ctx, args.expectedSnapshotId, row);
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

/** Prepares one bounded page of section attempts. */
const migrateSectionPage = Effect.fn("tryouts.migrations.migrateSectionPage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "tryoutSectionAttempts",
    });
    let changed = 0;
    for (const row of page.page) {
      const patch = yield* prepareSection(ctx, args.expectedSnapshotId, row);
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

/** Adds one signed set identity to a legacy progress row. */
const prepareProgress = Effect.fn("tryouts.migrations.prepareProgress")(
  function* (
    ctx: MutationCtx,
    expectedSnapshotId: string,
    progress: Doc<"tryoutSetProgress">
  ) {
    yield* ensureTryoutProgressWithinReadBudget(progress);
    if (progress.setIdentity) {
      const attempt = yield* Effect.promise(() =>
        ctx.db.get(progress.latestAttemptId)
      );
      if (attempt && isSignedProgress(progress, attempt, expectedSnapshotId)) {
        return null;
      }
    }
    if (!progress.tryoutSetId) {
      return yield* migrationFail("A progress row lost its legacy set.");
    }
    const set = yield* bindLegacySet(
      ctx,
      expectedSnapshotId,
      progress.tryoutSetId
    );
    if (hasMigrationConflict(progress.setIdentity, set.identity)) {
      return yield* migrationFail(
        "A progress row conflicts with its signed set identity."
      );
    }
    if (
      progress.countryKey !== set.row.countryKey ||
      progress.examKey !== set.row.examKey ||
      progress.trackKey !== set.row.trackKey ||
      progress.setKey !== set.row.setKey ||
      progress.locale !== set.row.locale
    ) {
      return yield* migrationFail(
        "A progress row differs from its signed set."
      );
    }
    if (progress.setIdentity === set.identity) {
      return null;
    }
    yield* ensureTryoutProgressWithinReadBudget({
      ...progress,
      setIdentity: set.identity,
    });
    return { setIdentity: set.identity };
  }
);

/** Adds one signed section identity to a legacy section attempt. */
const prepareSection = Effect.fn("tryouts.migrations.prepareSection")(
  function* (
    ctx: MutationCtx,
    expectedSnapshotId: string,
    attempt: Doc<"tryoutSectionAttempts">
  ) {
    if (attempt.sectionIdentity && !attempt.tryoutSectionId) {
      const parent = yield* requireSignedAttempt(
        ctx,
        attempt.tryoutAttemptId,
        expectedSnapshotId
      );
      if (isSignedSectionAttempt(attempt, parent)) {
        return null;
      }
      return yield* migrationFail(
        "A section attempt conflicts with its signed parent attempt."
      );
    }
    if (!attempt.tryoutSectionId) {
      return yield* migrationFail("A section attempt lost its legacy section.");
    }
    const section = yield* bindLegacySection(
      ctx,
      expectedSnapshotId,
      attempt.tryoutSectionId
    );
    if (hasMigrationConflict(attempt.sectionIdentity, section.identity)) {
      return yield* migrationFail(
        "A section attempt conflicts with its signed section identity."
      );
    }
    if (
      attempt.sectionKey !== section.row.sectionKey ||
      attempt.sectionOrder !== section.row.order ||
      attempt.totalQuestions !== section.row.questionCount
    ) {
      return yield* migrationFail(
        "A section attempt differs from its signed section."
      );
    }
    if (attempt.sectionIdentity === section.identity) {
      return null;
    }
    return { sectionIdentity: section.identity };
  }
);

/** Migrates one bounded set-progress page. */
export const migrateProgress = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migrateProgressPage(ctx, args)),
});

/** Migrates one bounded section-attempt page. */
export const migrateSections = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migrateSectionPage(ctx, args)),
});
