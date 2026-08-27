import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadTryoutRuntimeBundle } from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

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
