import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  bindLegacySection,
  requireTryoutSnapshot,
} from "@repo/backend/convex/tryouts/migrations/catalog";
import { bindLegacyScale } from "@repo/backend/convex/tryouts/migrations/scale";
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

/** Prepares one bounded page of IRT calibration runs. */
const migrateRunPage = Effect.fn("tryouts.migrations.migrateRunPage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("irtCalibrationRuns")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "irtCalibrationRuns",
    });
    let changed = 0;
    for (const row of page.page) {
      const patch = yield* prepareRun(ctx, args.expectedSnapshotId, row);
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

/** Adds signed section and scale ownership to one legacy calibration run. */
const prepareRun = Effect.fn("tryouts.migrations.prepareRun")(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  run: Doc<"irtCalibrationRuns">
) {
  if (!run.tryoutSectionId) {
    return yield* migrationFail("An IRT run lost its legacy section.");
  }
  const section = yield* bindLegacySection(
    ctx,
    expectedSnapshotId,
    run.tryoutSectionId
  );
  const items = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleItems")
      .withIndex("by_calibrationRunId", (index) =>
        index.eq("calibrationRunId", run._id)
      )
      .take(run.questionCount + 1)
  );
  if (items.length !== run.questionCount) {
    return yield* migrationFail(
      "An IRT run does not own its expected scale items."
    );
  }
  const scaleVersionId = items[0]?.scaleVersionId;
  if (
    !scaleVersionId ||
    items.some((item) => item.scaleVersionId !== scaleVersionId)
  ) {
    return yield* migrationFail("An IRT run spans multiple scale versions.");
  }
  const scale = yield* Effect.promise(() => ctx.db.get(scaleVersionId));
  if (!scale) {
    return yield* migrationFail("An IRT run lost its scale version.");
  }
  yield* bindLegacyScale(ctx, expectedSnapshotId, scale);
  if (
    hasMigrationConflict(run.scaleVersionId, scaleVersionId) ||
    hasMigrationConflict(run.sectionIdentity, section.identity)
  ) {
    return yield* migrationFail(
      "An IRT run conflicts with its signed section or scale identity."
    );
  }
  if (
    run.scaleVersionId === scaleVersionId &&
    run.sectionIdentity === section.identity
  ) {
    return null;
  }
  return { scaleVersionId, sectionIdentity: section.identity };
});

/** Migrates one bounded IRT calibration-run page. */
export const migrateRuns = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migrateRunPage(ctx, args)),
});
