import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isSnapshotReferenced } from "@repo/backend/convex/contentRelease/snapshot/retention";
import type { CleanupPage } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { Effect } from "effect";

const PAGE_COUNT = 32;
type CleanupMigration = Extract<
  Doc<"tryoutHistoryMigrations">,
  { readonly phase: "cleaning" | "completed" }
>;

/** Deletes one bounded source-owned row page after reference proof. */
export const cleanupSource = Effect.fn("tryouts.migration.cleanupSource")(
  function* (ctx: MutationCtx, migration: CleanupMigration) {
    const snapshotId = migration.sourceSnapshotId;
    if (
      yield* isSnapshotReferenced(ctx, "tryout", snapshotId, {
        ignoredMigrationId: migration.migrationId,
      })
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "The retained try-out snapshot is still protected from cleanup."
      );
    }
    const history = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .take(PAGE_COUNT)
    );
    if (history.length > 0) {
      yield* Effect.forEach(history, (row) =>
        Effect.promise(() => ctx.db.delete("tryoutHistoryRows", row._id))
      );
      return {
        deleted: history.length,
        kind: "history",
      } satisfies CleanupPage;
    }
    const catalog = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .take(PAGE_COUNT)
    );
    if (catalog.length > 0) {
      yield* Effect.forEach(catalog, (row) =>
        Effect.promise(() => ctx.db.delete("tryoutCatalog", row._id))
      );
      return {
        deleted: catalog.length,
        kind: "catalog",
      } satisfies CleanupPage;
    }
    const placements = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .take(PAGE_COUNT)
    );
    if (placements.length > 0) {
      yield* Effect.forEach(placements, (row) =>
        Effect.promise(() => ctx.db.delete("tryoutPlacements", row._id))
      );
      return {
        deleted: placements.length,
        kind: "placement",
      } satisfies CleanupPage;
    }
    const legacy = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutBundles")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .take(PAGE_COUNT)
    );
    if (legacy.length > 0) {
      yield* Effect.forEach(legacy, (bundle) =>
        Effect.promise(() => ctx.db.delete("tryoutBundles", bundle._id))
      );
      return {
        deleted: legacy.length,
        kind: "legacy",
      } satisfies CleanupPage;
    }
    const runtimes = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_snapshotId_and_rendererManifestHash", (query) =>
          query.eq("snapshotId", snapshotId)
        )
        .take(PAGE_COUNT)
    );
    if (runtimes.length > 0) {
      for (const runtime of runtimes) {
        const attempt = yield* Effect.promise(() =>
          ctx.db
            .query("tryoutAttempts")
            .withIndex("by_tryoutBundleId", (query) =>
              query.eq("tryoutBundleId", runtime._id)
            )
            .first()
        );
        if (attempt) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "A retained permanent runtime is still referenced after migration."
          );
        }
        yield* Effect.promise(() =>
          ctx.db.delete("tryoutRuntimeBundles", runtime._id)
        );
      }
      return {
        deleted: runtimes.length,
        kind: "runtime",
      } satisfies CleanupPage;
    }
    const snapshot = yield* Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_family_and_snapshotId", (query) =>
          query.eq("family", "tryout").eq("snapshotId", snapshotId)
        )
        .unique()
    );
    if (snapshot) {
      yield* Effect.promise(() =>
        ctx.db.delete("contentSnapshots", snapshot._id)
      );
      return { deleted: 1, kind: "snapshot" } satisfies CleanupPage;
    }
    return null;
  }
);
