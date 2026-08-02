import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireTryoutSnapshot } from "@repo/backend/convex/tryouts/migrations/catalog";
import { bindLegacyIrtItem } from "@repo/backend/convex/tryouts/migrations/question";
import { bindLegacyScale } from "@repo/backend/convex/tryouts/migrations/scale";
import {
  isSignedScale,
  isSignedScaleItem,
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

/** Prepares one bounded page of IRT scale items. */
const migrateItemPage = Effect.fn("tryouts.migrations.migrateItemPage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("irtScaleItems")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "irtScaleItems",
    });
    let changed = 0;
    for (const row of page.page) {
      const patch = yield* prepareItem(ctx, args.expectedSnapshotId, row);
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

/** Adds one immutable signed placement identity to a legacy IRT item. */
const prepareItem = Effect.fn("tryouts.migrations.prepareItem")(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  item: Doc<"irtScaleItems">
) {
  const scale = yield* Effect.promise(() => ctx.db.get(item.scaleVersionId));
  if (!scale) {
    return yield* migrationFail("An IRT item lost its scale version.");
  }
  if (isSignedScale(scale, expectedSnapshotId)) {
    if (isSignedScaleItem(item)) {
      return null;
    }
    return yield* migrationFail(
      "A signed IRT item lost its placement identity."
    );
  }
  yield* bindLegacyScale(ctx, expectedSnapshotId, scale);
  const placement = yield* bindLegacyIrtItem(ctx, expectedSnapshotId, item);
  if (
    hasMigrationConflict(item.placementIdentity, placement.identity) ||
    hasMigrationConflict(item.placementRowHash, placement.rowHash)
  ) {
    return yield* migrationFail(
      "An IRT item conflicts with its signed placement identity."
    );
  }
  if (
    item.placementIdentity === placement.identity &&
    item.placementRowHash === placement.rowHash
  ) {
    return null;
  }
  return {
    placementIdentity: placement.identity,
    placementRowHash: placement.rowHash,
  };
});

/** Migrates one bounded IRT scale-item page. */
export const migrateItems = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migrateItemPage(ctx, args)),
});
