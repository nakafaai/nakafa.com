import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { readReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/runtime";
import { Effect } from "effect";

/** Finds every permanent runtime pair explicitly bound to one release. */
export const findReleaseTryoutRuntime = Effect.fn(
  "contentRelease.findReleaseTryoutRuntime"
)(function* (release: SignedContentRelease, expectedBundleHash?: string) {
  const transition = release.manifest.snapshots.tryout;
  const runtime = yield* readReleaseTryoutRuntime(release);
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
