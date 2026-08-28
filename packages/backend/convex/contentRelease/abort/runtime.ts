import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

const CLEANUP_RUNTIME_LIMIT = 2;

type ReadCtx = MutationCtx | QueryCtx;

/** Loads the bounded permanent rows owned by one release cleanup. */
const loadAbortRuntime = Effect.fn("contentRelease.loadAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_cleanupReleaseId", (query) =>
          query.eq("cleanupReleaseId", releaseId)
        )
        .take(CLEANUP_RUNTIME_LIMIT + 1)
    );
    if (rows.length > CLEANUP_RUNTIME_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} exceeded its permanent runtime pair bound.`
      );
    }
    return rows;
  }
);

/** Checks whether one state-owned release still selects the immutable pair. */
const releaseRetainsRuntime = Effect.fn(
  "contentRelease.releaseRetainsAbortRuntime"
)(function* (
  ctx: ReadCtx,
  releaseId: string,
  row: Doc<"tryoutRuntimeBundles">
) {
  const release = yield* loadRelease(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const transition = signed.manifest.snapshots.tryout;
  if (signed.manifest.rendererManifestHash !== row.rendererManifestHash) {
    return false;
  }
  if (transition.resultSnapshotId === row.snapshotId) {
    return true;
  }
  return (
    signed.manifest.origin.kind === "git" &&
    transition.mode === "replace" &&
    transition.baseSnapshotId === row.snapshotId
  );
});

/** Classifies permanent pair retention outside its cleanup owner. */
const loadAbortRuntimeRetention = Effect.fn(
  "contentRelease.loadAbortRuntimeRetention"
)(function* (
  ctx: ReadCtx,
  cleanupReleaseId: string,
  row: Doc<"tryoutRuntimeBundles">
) {
  const attempt = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_tryoutBundleId", (query) =>
        query.eq("tryoutBundleId", row._id)
      )
      .first()
  );
  let durable = attempt !== null;
  const migrations = yield* Effect.promise(() =>
    ctx.db.query("tryoutHistoryMigrations").take(2)
  );
  if (migrations.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "More than one try-out history migration owns runtime retention."
    );
  }
  const migration = migrations[0];
  const migrationRetains =
    migration?.target.kind === "staged" &&
    migration.target.bundleHash === row.bundleHash &&
    migration.target.snapshotId === row.snapshotId;
  const state = yield* loadState(ctx);
  if (!state) {
    return {
      durable,
      migration: migrationRetains,
      retainingReleaseId: null,
    };
  }
  const releaseIds = [
    state.activeReleaseId,
    state.candidateReleaseId,
    state.recoveryReleaseId,
  ];
  for (const releaseId of releaseIds) {
    if (
      releaseId &&
      releaseId !== cleanupReleaseId &&
      (yield* releaseRetainsRuntime(ctx, releaseId, row))
    ) {
      durable = true;
      return {
        durable,
        migration: migrationRetains,
        retainingReleaseId: releaseId,
      };
    }
  }
  return {
    durable,
    migration: migrationRetains,
    retainingReleaseId: null,
  };
});

/** Removes only permanent rows with no attempt or state-owned consumer. */
export const deleteAbortRuntime = Effect.fn(
  "contentRelease.deleteAbortRuntime"
)(function* (ctx: MutationCtx, releaseId: string) {
  const rows = yield* loadAbortRuntime(ctx, releaseId);
  for (const row of rows) {
    const retention = yield* loadAbortRuntimeRetention(ctx, releaseId, row);
    if (retention.retainingReleaseId) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutRuntimeBundles", row._id, {
          cleanupReleaseId: retention.retainingReleaseId,
        })
      );
      continue;
    }
    if (retention.durable || retention.migration) {
      continue;
    }
    yield* Effect.promise(() => ctx.db.delete("tryoutRuntimeBundles", row._id));
  }
});

/** Detects cleanup-owned permanent rows with no durable runtime consumer. */
export const hasAbortRuntime = Effect.fn("contentRelease.hasAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const rows = yield* loadAbortRuntime(ctx, releaseId);
    for (const row of rows) {
      const retention = yield* loadAbortRuntimeRetention(ctx, releaseId, row);
      if (!retention.durable) {
        return true;
      }
    }
    return false;
  }
);
