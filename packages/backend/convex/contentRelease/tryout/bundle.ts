import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { isLegacyTryoutRuntime } from "@nakafa/aksara-contracts/release/current/legacy";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { retainTryoutBundle } from "@repo/backend/convex/tryouts/runtime/bundle";
import { Effect } from "effect";

type ActivatedRelease = Pick<
  Doc<"contentReleases">,
  "releaseId" | "releaseJson" | "rendererJson"
>;

/** Retains only the exact predecessor bytes during permanent runtime expansion. */
export const retainActivatedTryoutBundle = Effect.fn(
  "contentRelease.retainActivatedTryoutBundle"
)(function* (
  ctx: MutationCtx,
  release: ActivatedRelease,
  signed: SignedContentRelease,
  activatedAt: number
) {
  if (!isLegacyTryoutRuntime(signed)) {
    return;
  }
  const snapshotId = signed.manifest.snapshots.tryout.resultSnapshotId;
  if (snapshotId === null) {
    return;
  }

  yield* retainTryoutBundle(
    ctx,
    {
      manifestHash: signed.manifestHash,
      releaseId: release.releaseId,
      releaseJson: release.releaseJson,
      rendererJson: release.rendererJson,
      snapshotId,
    },
    activatedAt
  ).pipe(
    Effect.mapError(
      (error) =>
        new ReleaseError({
          code:
            error.code === "TRYOUT_BUNDLE_CONFLICT"
              ? "CONTENT_RELEASE_CONFLICT"
              : "CONTENT_RELEASE_INTEGRITY",
          message: `Content release ${release.releaseId} could not retain its try-out runtime bundle.`,
        })
    )
  );
});
