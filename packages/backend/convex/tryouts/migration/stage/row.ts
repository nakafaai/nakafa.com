import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { MAX_TRYOUT_HISTORY_MIGRATION_ROWS } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import {
  stageTryoutCatalog,
  stageTryoutPlacement,
} from "@repo/backend/convex/contentRelease/snapshot/tryout";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { stageMapEntry } from "@repo/backend/convex/tryouts/migration/stage/map";
import {
  type MapInput,
  mapInputValidator,
  simpleStageReceiptValidator,
} from "@repo/backend/convex/tryouts/migration/stage/schema";
import { loadStagingMigration } from "@repo/backend/convex/tryouts/migration/stage/state";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Stores current catalog or placement rows and their source mappings. */
export const stageRowsProgram = Effect.fn("tryouts.migration.stageRows")(
  function* (
    ctx: MutationCtx,
    migrationId: string,
    targetSnapshotId: string,
    entries: readonly MapInput[]
  ) {
    if (
      entries.length === 0 ||
      entries.length > MAX_TRYOUT_HISTORY_MIGRATION_ROWS
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history row staging exceeded its bounded batch contract."
      );
    }
    const now = yield* Clock.currentTimeMillis;
    const migration = yield* loadStagingMigration(ctx, migrationId);
    if (
      migration.target.kind !== "staged" ||
      migration.target.snapshotId !== targetSnapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history rows do not belong to the staged target snapshot."
      );
    }
    const rowKind = entries[0]?.kind;
    if (
      (rowKind !== "catalog" && rowKind !== "placement") ||
      entries.some(({ kind }) => kind !== rowKind)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history row batch mixes mapping kinds."
      );
    }
    let created = 0;
    for (const entry of entries) {
      if (entry.rowJson === undefined) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history row staging received no target row."
        );
      }
      const row: ContentSnapshotRow = yield* decodeSnapshotRowJson(
        entry.rowJson
      );
      if (
        row.family !== "tryout" ||
        row.rowKind !== entry.kind ||
        row.record.rowHash !== entry.newHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history row mapping changed its target identity."
        );
      }
      const source = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_snapshotId_and_rowKind_and_rowHash", (query) =>
            query
              .eq("snapshotId", migration.sourceSnapshotId)
              .eq("rowKind", rowKind)
              .eq("rowHash", entry.oldHash)
          )
          .unique()
      );
      if (!source || source.index !== entry.index) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history mapping does not identify its retained source row."
        );
      }
      const reused =
        row.rowKind === "catalog"
          ? yield* stageTryoutCatalog(
              ctx,
              targetSnapshotId,
              entry.index,
              row,
              entry.rowJson
            )
          : yield* stageTryoutPlacement(
              ctx,
              targetSnapshotId,
              entry.index,
              row,
              entry.rowJson
            );
      if (!(yield* stageMapEntry(ctx, migrationId, entry, !reused))) {
        created += 1;
      }
    }
    if (created > 0) {
      const counts =
        rowKind === "catalog"
          ? { catalogMapCount: migration.catalogMapCount + created }
          : { placementMapCount: migration.placementMapCount + created };
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutHistoryMigrations", migration._id, {
          ...counts,
          updatedAt: now,
        })
      );
    }
    return { created, unchanged: entries.length - created };
  }
);

export const stageRows = internalMutation({
  args: {
    entries: v.array(mapInputValidator),
    migrationId: v.string(),
    targetSnapshotId: v.string(),
  },
  returns: simpleStageReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageRowsProgram(
        ctx,
        args.migrationId,
        args.targetSnapshotId,
        args.entries
      )
    ),
});
