import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Finds every permanent runtime pair explicitly bound to one release. */
export const findReleaseTryoutRuntime = Effect.fn(
  "contentRelease.findReleaseTryoutRuntime"
)(function* (
  ctx: ReadCtx,
  release: SignedContentRelease,
  expectedBundleHash?: string
) {
  const transition = release.manifest.snapshots.tryout;
  const runtime = yield* readReleaseTryoutRuntime(ctx, release);
  const hasBoundResult =
    expectedBundleHash === undefined
      ? transition.resultSnapshotId === null && runtime.result === null
      : runtime.result?.bundle.bundleHash === expectedBundleHash;
  const hasRetainedBase =
    !(
      release.manifest.origin.kind === "git" &&
      transition.mode === "replace" &&
      transition.baseSnapshotId !== null
    ) || runtime.retainedBase !== null;
  if (!(hasBoundResult && hasRetainedBase)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${release.manifest.releaseId} lost its exact permanent try-out runtime binding.`
    );
  }
  return runtime;
});
