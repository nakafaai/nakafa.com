import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type CleanupMigration = Extract<
  Doc<"tryoutHistoryMigrations">,
  { readonly phase: "cleaning" | "completed" }
>;

/** Proves every source and temporary row is gone before terminal transition. */
export const requireCleanupEmpty = Effect.fn(
  "tryouts.migration.requireCleanupEmpty"
)(function* (ctx: MutationCtx, migration: CleanupMigration) {
  const snapshotId = migration.sourceSnapshotId;
  const migrationId = migration.migrationId;
  const rows = yield* Effect.all([
    Effect.promise(() => ctx.db.query("tryoutAttemptHistory").first()),
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutSnapshotId", (query) =>
          query.eq("tryoutSnapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutBundles")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_snapshotId_and_rendererManifestHash", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_family_and_snapshotId", (query) =>
          query.eq("family", "tryout").eq("snapshotId", snapshotId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryAttemptMigrationAudits")
        .withIndex("by_migrationId_and_tryoutAttemptId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationMaps")
        .withIndex("by_migrationId_and_kind_and_index", (query) =>
          query.eq("migrationId", migrationId)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryScaleMigrations")
        .withIndex("by_migrationId_and_oldScaleVersionId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .first()
    ),
  ]);
  const scales = yield* Effect.forEach(
    migration.authorization.sourceScaleVersionIds,
    (scaleVersionId) =>
      Effect.all([
        Effect.promise(() => ctx.db.get(scaleVersionId)),
        Effect.promise(() =>
          ctx.db
            .query("irtScaleItems")
            .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
              query.eq("scaleVersionId", scaleVersionId)
            )
            .first()
        ),
        Effect.promise(() =>
          ctx.db
            .query("irtCalibrationRuns")
            .withIndex(
              "by_scaleVersionId_and_sectionIdentity_and_startedAt",
              (query) => query.eq("scaleVersionId", scaleVersionId)
            )
            .first()
        ),
      ])
  );
  if (
    rows.some((row) => row !== null) ||
    scales.some((graph) => graph.some((row) => row !== null))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup retained source or temporary rows."
    );
  }
});
