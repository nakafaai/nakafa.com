import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  bindLegacySet,
  requireTryoutSnapshot,
} from "@repo/backend/convex/tryouts/migrations/catalog";
import {
  migrationFail,
  migrationPageOptions,
  migrationPageResult,
  type TryoutMigrationArgs,
  tryoutMigrationArgs,
  tryoutMigrationResultValidator,
  validateMigrationPage,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

/** Prepares one bounded page of IRT scale versions. */
const migrateScalePage = Effect.fn("tryouts.migrations.migrateScalePage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("irtScaleVersions")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "irtScaleVersions",
    });
    let changed = 0;
    for (const row of page.page) {
      const patch = yield* prepareScale(ctx, args.expectedSnapshotId, row);
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

/** Adds stable set identity without consuming the rollback-owned scale. */
const prepareScale = Effect.fn("tryouts.migrations.prepareScale")(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  scale: Doc<"irtScaleVersions">
) {
  const set = yield* bindLegacyScale(ctx, expectedSnapshotId, scale);
  const items = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleItems")
      .withIndex("by_scaleVersionId_and_placementIdentity", (index) =>
        index.eq("scaleVersionId", scale._id)
      )
      .take(scale.questionCount + 1)
  );
  if (
    items.length !== scale.questionCount ||
    items.some(
      (item) =>
        item.placementIdentity === undefined ||
        item.placementRowHash === undefined
    )
  ) {
    return yield* migrationFail(
      "An IRT scale cannot bind before every item is prepared."
    );
  }
  if (
    scale.tryoutSnapshotId === undefined &&
    scale.setIdentity === set.identity
  ) {
    return null;
  }
  return {
    setIdentity: set.identity,
    tryoutSnapshotId: undefined,
  };
});

/** Authenticates one legacy scale against its signed set without binding it. */
export const bindLegacyScale = Effect.fn("tryouts.migrations.bindLegacyScale")(
  function* (
    ctx: MutationCtx,
    expectedSnapshotId: string,
    scale: Doc<"irtScaleVersions">
  ) {
    if (!scale.tryoutSetId) {
      return yield* migrationFail("An IRT scale lost its legacy set.");
    }
    const set = yield* bindLegacySet(
      ctx,
      expectedSnapshotId,
      scale.tryoutSetId
    );
    if (scale.questionCount !== set.row.questionCount) {
      return yield* migrationFail(
        "An IRT scale count differs from its signed set."
      );
    }
    if (
      (scale.tryoutSnapshotId !== undefined &&
        scale.tryoutSnapshotId !== expectedSnapshotId) ||
      (scale.setIdentity !== undefined && scale.setIdentity !== set.identity)
    ) {
      return yield* migrationFail(
        "An IRT scale conflicts with its signed snapshot identity."
      );
    }
    return set;
  }
);

/** Migrates one bounded IRT scale-version page. */
export const migrateScales = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migrateScalePage(ctx, args)),
});
