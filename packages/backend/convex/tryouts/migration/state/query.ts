import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  cleanupReceiptValidator,
  mapEntryValidator,
  targetRowValidator,
  targetRuntimeValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  loadMigrationReceipt,
  loadTryoutHistoryMigration,
} from "@repo/backend/convex/tryouts/migration/state/store";
import { v } from "convex/values";
import { Effect } from "effect";

/** Reads the bounded migration identity ledger in canonical index order. */
const loadMapEntries = Effect.fn("tryouts.migration.loadMapEntries")(function* (
  ctx: QueryCtx,
  migrationId: string
) {
  const entries = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryMigrationMaps")
      .withIndex("by_migrationId_and_kind_and_index", (query) =>
        query.eq("migrationId", migrationId)
      )
      .take(
        retainedTryoutHistoryPlan.artifactCount +
          retainedTryoutHistoryPlan.catalogRowCount +
          retainedTryoutHistoryPlan.placementRowCount +
          1
      )
  );
  return entries.map(({ identity, index, kind, newHash, oldHash }) => ({
    identity,
    index,
    kind,
    newHash,
    oldHash,
  }));
});

/** Reads the immutable runtime selected by a staged migration root. */
const loadTargetRuntime = Effect.fn("tryouts.migration.loadTargetRuntime")(
  function* (ctx: QueryCtx, migrationId: string) {
    const migration = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrations")
        .withIndex("by_migrationId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .unique()
    );
    if (migration?.target.kind !== "staged") {
      return null;
    }
    const bundleHash = migration.target.bundleHash;
    const bundle = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_bundleHash", (query) =>
          query.eq("bundleHash", bundleHash)
        )
        .unique()
    );
    return bundle
      ? { bundleJson: bundle.bundleJson, rendererJson: bundle.rendererJson }
      : null;
  }
);

/** Reads durable proof and deletion progress without exposing them publicly. */
export const receipt = internalQuery({
  args: { migrationId: v.string() },
  returns: cleanupReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      loadMigrationReceipt(ctx, args.migrationId).pipe(
        Effect.map((stored) =>
          stored
            ? {
                deletedRows: stored.deletedRows,
                phase: stored.phase,
                proof: stored.proof ?? null,
                repair: stored.repair ?? null,
              }
            : null
        )
      )
    ),
});

/** Reads the complete bounded source-to-target identity ledger. */
export const mapEntries = internalQuery({
  args: { migrationId: v.string() },
  returns: v.array(mapEntryValidator),
  handler: (ctx, args) =>
    runConvexProgram(loadMapEntries(ctx, args.migrationId)),
});

/** Returns the staged immutable bundle bytes selected by one migration root. */
export const targetRuntime = internalQuery({
  args: { migrationId: v.string() },
  returns: targetRuntimeValidator,
  handler: (ctx, args) =>
    runConvexProgram(loadTargetRuntime(ctx, args.migrationId)),
});

/** Reads one complete bounded staged target row kind in canonical order. */
export const targetRows = internalQuery({
  args: {
    migrationId: v.string(),
    rowKind: v.union(v.literal("catalog"), v.literal("placement")),
  },
  returns: v.array(targetRowValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const migration = yield* loadTryoutHistoryMigration(
          ctx,
          args.migrationId
        );
        if (migration.target.kind !== "staged") {
          return yield* releaseFail(
            "CONTENT_RELEASE_STATE",
            "Try-out history target snapshot is not staged."
          );
        }
        const expected =
          args.rowKind === "catalog"
            ? retainedTryoutHistoryPlan.catalogRowCount
            : retainedTryoutHistoryPlan.placementRowCount;
        const targetSnapshotId = migration.target.snapshotId;
        if (args.rowKind === "catalog") {
          const rows = yield* Effect.promise(() =>
            ctx.db
              .query("tryoutCatalog")
              .withIndex("by_snapshotId_and_index", (query) =>
                query.eq("snapshotId", targetSnapshotId)
              )
              .take(expected + 1)
          );
          return rows.map(({ index, rowHash, rowJson }) => ({
            index,
            rowHash,
            rowJson,
          }));
        }
        const rows = yield* Effect.promise(() =>
          ctx.db
            .query("tryoutPlacements")
            .withIndex("by_snapshotId_and_index", (query) =>
              query.eq("snapshotId", targetSnapshotId)
            )
            .take(expected + 1)
        );
        return rows.map(({ index, rowHash, rowJson }) => ({
          index,
          rowHash,
          rowJson,
        }));
      })
    ),
});
