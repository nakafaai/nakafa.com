import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
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
import { loadTryoutRuntimeBundle } from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

interface RuntimeRetentionOptions {
  readonly ignoredReleaseId?: string;
}

/** Checks whether one release still selects an immutable try-out pair. */
const releaseRetainsRuntime = Effect.fn(
  "contentRelease.releaseRetainsTryoutRuntime"
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

/** Classifies every attempt and release consumer of one pair. */
export const readTryoutRuntimeRetention = Effect.fn(
  "contentRelease.readTryoutRuntimeRetention"
)(function* (
  ctx: ReadCtx,
  row: Doc<"tryoutRuntimeBundles">,
  options?: RuntimeRetentionOptions
) {
  const [attempt, state] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutBundleId", (query) =>
          query.eq("tryoutBundleId", row._id)
        )
        .first()
    ),
    loadState(ctx),
  ]);
  const releaseIds = state
    ? [state.activeReleaseId, state.candidateReleaseId, state.recoveryReleaseId]
    : [];
  for (const releaseId of releaseIds) {
    if (
      releaseId &&
      releaseId !== options?.ignoredReleaseId &&
      (yield* releaseRetainsRuntime(ctx, releaseId, row))
    ) {
      return {
        retainedByAttempt: attempt !== null,
        retainingReleaseId: releaseId,
      };
    }
  }
  return {
    retainedByAttempt: attempt !== null,
    retainingReleaseId: null,
  };
});

/** Reconciles permanent ownership after its attempt is deleted transactionally. */
export const reconcileTryoutRuntimeAfterAttempt = Effect.fn(
  "contentRelease.reconcileTryoutRuntimeAfterAttempt"
)(function* (ctx: MutationCtx, runtimeId: Id<"tryoutRuntimeBundles">) {
  const row = yield* Effect.promise(() =>
    ctx.db.get("tryoutRuntimeBundles", runtimeId)
  );
  if (!row) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "A deleted try-out attempt referenced a missing permanent runtime."
    );
  }
  const retention = yield* readTryoutRuntimeRetention(ctx, row);
  const cleanupReleaseId = retention.retainingReleaseId;
  if (cleanupReleaseId) {
    if (cleanupReleaseId !== row.cleanupReleaseId) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutRuntimeBundles", row._id, {
          cleanupReleaseId,
        })
      );
    }
    return;
  }
  if (row.cleanupReleaseId === undefined) {
    return;
  }
  if (retention.retainedByAttempt) {
    return;
  }
  yield* Effect.promise(() => ctx.db.delete("tryoutRuntimeBundles", row._id));
});

/** Reads every permanent runtime pair addressed by one signed release. */
export const readReleaseTryoutRuntime = Effect.fn(
  "contentRelease.readReleaseTryoutRuntime"
)(function* (ctx: ReadCtx, release: SignedContentRelease) {
  const transition = release.manifest.snapshots.tryout;
  const rendererManifestHash = release.manifest.rendererManifestHash;
  const result = transition.resultSnapshotId
    ? yield* loadTryoutRuntimeBundle(
        ctx,
        transition.resultSnapshotId,
        rendererManifestHash
      )
    : null;
  const needsRetainedBase =
    release.manifest.origin.kind === "git" &&
    transition.mode === "replace" &&
    transition.baseSnapshotId !== null;
  const retainedBase = needsRetainedBase
    ? yield* loadTryoutRuntimeBundle(
        ctx,
        transition.baseSnapshotId,
        rendererManifestHash
      )
    : null;
  return { result, retainedBase };
});

/** Requires every new or restored runtime pair before activation advances. */
export const loadReleaseTryoutRuntime = Effect.fn(
  "contentRelease.loadReleaseTryoutRuntime"
)(function* (ctx: ReadCtx, release: SignedContentRelease) {
  const runtime = yield* readReleaseTryoutRuntime(ctx, release);
  const transition = release.manifest.snapshots.tryout;
  const requiresResult = transition.resultSnapshotId !== null;
  const requiresBase =
    release.manifest.origin.kind === "git" &&
    transition.mode === "replace" &&
    transition.baseSnapshotId !== null;
  if (
    (requiresResult && runtime.result === null) ||
    (requiresBase && runtime.retainedBase === null)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out runtime pairs required by release ${release.manifest.releaseId} are unavailable.`
    );
  }
  return runtime;
});
