import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { CleanupPage } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { Effect } from "effect";

const PAGE_COUNT = 32;
type CleanupMigration = Extract<
  Doc<"tryoutHistoryMigrations">,
  { readonly phase: "cleaning" | "completed" }
>;

/** Deletes one bounded child page from the next unreferenced source scale. */
export const cleanupScale = Effect.fn("tryouts.migration.cleanupScale")(
  function* (ctx: MutationCtx, migration: CleanupMigration) {
    for (const scaleVersionId of migration.authorization
      .sourceScaleVersionIds) {
      const items = yield* Effect.promise(() =>
        ctx.db
          .query("irtScaleItems")
          .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
            query.eq("scaleVersionId", scaleVersionId)
          )
          .take(PAGE_COUNT)
      );
      if (items.length > 0) {
        yield* Effect.forEach(items, (item) =>
          Effect.promise(() => ctx.db.delete("irtScaleItems", item._id))
        );
        return {
          deleted: items.length,
          kind: "scaleItem",
        } satisfies CleanupPage;
      }
    }
    for (const scaleVersionId of migration.authorization
      .sourceScaleVersionIds) {
      const runs = yield* Effect.promise(() =>
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex(
            "by_scaleVersionId_and_sectionIdentity_and_startedAt",
            (query) => query.eq("scaleVersionId", scaleVersionId)
          )
          .take(PAGE_COUNT)
      );
      if (runs.length > 0) {
        yield* Effect.forEach(runs, (run) =>
          Effect.promise(() => ctx.db.delete("irtCalibrationRuns", run._id))
        );
        return {
          deleted: runs.length,
          kind: "scaleRun",
        } satisfies CleanupPage;
      }
    }
    for (const scaleVersionId of migration.authorization
      .sourceScaleVersionIds) {
      const scale = yield* Effect.promise(() => ctx.db.get(scaleVersionId));
      if (!scale) {
        continue;
      }
      if (scale.tryoutSnapshotId !== migration.sourceSnapshotId) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "A retained IRT scale changed before signed cleanup."
        );
      }
      yield* Effect.promise(() =>
        ctx.db.delete("irtScaleVersions", scaleVersionId)
      );
      return { deleted: 1, kind: "scale" } satisfies CleanupPage;
    }
    return null;
  }
);
