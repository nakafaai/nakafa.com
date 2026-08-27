import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isSnapshotReferenced } from "@repo/backend/convex/contentRelease/snapshot/retention";
import type { AbortingMigration } from "@repo/backend/convex/tryouts/migration/abort/state";
import { Effect } from "effect";

/** Detects another durable or in-progress owner of the target snapshot. */
export const hasAbortSnapshotReference = Effect.fn(
  "tryouts.migration.hasAbortSnapshotReference"
)(function* (ctx: MutationCtx, migration: AbortingMigration) {
  if (migration.target.kind !== "staged") {
    return false;
  }
  const target = migration.target;
  const [referenced, batch] = yield* Effect.all([
    isSnapshotReferenced(ctx, "tryout", target.snapshotId, {
      ignoredMigrationId: migration.migrationId,
    }),
    Effect.promise(() =>
      ctx.db
        .query("snapshotBatches")
        .withIndex("by_snapshotId_and_family_and_batchIndex", (query) =>
          query.eq("snapshotId", target.snapshotId).eq("family", "tryout")
        )
        .first()
    ),
  ]);
  return referenced || batch !== null;
});

/** Proves whether another consumer retains one staged runtime bundle. */
const hasRuntimeReference = Effect.fn(
  "tryouts.migration.hasAbortRuntimeReference"
)(function* (
  ctx: MutationCtx,
  runtime: Doc<"tryoutRuntimeBundles">,
  snapshotReferenced: boolean
) {
  if (snapshotReferenced) {
    return true;
  }
  const [attempt, release] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutBundleId", (query) =>
          query.eq("tryoutBundleId", runtime._id)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (query) =>
          query.eq("releaseId", runtime.sourceReleaseId)
        )
        .unique()
    ),
  ]);
  return (
    attempt !== null || release?.tryoutRuntimeBundleHash === runtime.bundleHash
  );
});

/** Removes the owned runtime and manifest after every mapping is gone. */
export const deleteAbortTarget = Effect.fn(
  "tryouts.migration.deleteAbortTarget"
)(function* (ctx: MutationCtx, migration: AbortingMigration) {
  if (migration.target.kind === "pending") {
    return 0;
  }
  const target = migration.target;
  const snapshotReferenced = yield* hasAbortSnapshotReference(ctx, migration);
  const runtime = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutRuntimeBundles")
      .withIndex("by_bundleHash", (query) =>
        query.eq("bundleHash", target.bundleHash)
      )
      .unique()
  );
  if (!runtime || runtime.snapshotId !== target.snapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history abort found an incoherent target runtime bundle."
    );
  }
  let deleted = 0;
  if (
    target.bundleCreated &&
    !(yield* hasRuntimeReference(ctx, runtime, snapshotReferenced))
  ) {
    yield* Effect.promise(() =>
      ctx.db.delete("tryoutRuntimeBundles", runtime._id)
    );
    deleted += 1;
  }
  const snapshot = yield* Effect.promise(() =>
    ctx.db
      .query("contentSnapshots")
      .withIndex("by_family_and_snapshotId", (query) =>
        query.eq("family", "tryout").eq("snapshotId", target.snapshotId)
      )
      .unique()
  );
  if (target.snapshotCreated && !snapshot) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history abort found a missing target snapshot."
    );
  }
  if (target.snapshotCreated && !snapshotReferenced && snapshot) {
    yield* Effect.promise(() =>
      ctx.db.delete("contentSnapshots", snapshot._id)
    );
    deleted += 1;
  }
  return deleted;
});
