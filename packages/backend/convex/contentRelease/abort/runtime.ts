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

const SOURCE_RUNTIME_LIMIT = 2;

type ReadCtx = MutationCtx | QueryCtx;

/** Loads the bounded result and retained-base rows created by one release. */
const loadSourceRuntime = Effect.fn("contentRelease.loadAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_sourceReleaseId", (query) =>
          query.eq("sourceReleaseId", releaseId)
        )
        .take(SOURCE_RUNTIME_LIMIT + 1)
    );
    if (rows.length > SOURCE_RUNTIME_LIMIT) {
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

/** Classifies permanent pair retention outside its source release. */
const loadAbortRuntimeRetention = Effect.fn(
  "contentRelease.loadAbortRuntimeRetention"
)(function* (
  ctx: ReadCtx,
  sourceReleaseId: string,
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
    return { durable, migration: migrationRetains };
  }
  const releaseIds = [
    state.activeReleaseId,
    state.candidateReleaseId,
    state.recoveryReleaseId,
  ];
  for (const releaseId of releaseIds) {
    if (
      releaseId &&
      releaseId !== sourceReleaseId &&
      (yield* releaseRetainsRuntime(ctx, releaseId, row))
    ) {
      durable = true;
      break;
    }
  }
  return { durable, migration: migrationRetains };
});

/** Removes only permanent rows with no attempt or state-owned consumer. */
export const deleteAbortRuntime = Effect.fn(
  "contentRelease.deleteAbortRuntime"
)(function* (ctx: MutationCtx, releaseId: string) {
  const rows = yield* loadSourceRuntime(ctx, releaseId);
  for (const row of rows) {
    const retention = yield* loadAbortRuntimeRetention(ctx, releaseId, row);
    if (retention.durable || retention.migration) {
      continue;
    }
    yield* Effect.promise(() => ctx.db.delete("tryoutRuntimeBundles", row._id));
  }
});

/** Detects source-owned permanent rows with no durable runtime consumer. */
export const hasAbortRuntime = Effect.fn("contentRelease.hasAbortRuntime")(
  function* (ctx: ReadCtx, releaseId: string) {
    const rows = yield* loadSourceRuntime(ctx, releaseId);
    for (const row of rows) {
      const retention = yield* loadAbortRuntimeRetention(ctx, releaseId, row);
      if (!retention.durable) {
        return true;
      }
    }
    return false;
  }
);
