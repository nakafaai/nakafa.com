import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { retainTryoutBundle } from "@repo/backend/convex/tryouts/runtime/bundle";
import { Effect } from "effect";

type ActivatedRelease = Pick<
  Doc<"contentReleases">,
  "releaseId" | "releaseJson" | "rendererJson"
>;

/** Retains the exact active release bytes needed by protected try-out bodies. */
export const retainActivatedTryoutBundle = Effect.fn(
  "contentRelease.retainActivatedTryoutBundle"
)(function* (
  ctx: MutationCtx,
  release: ActivatedRelease,
  signed: SignedContentRelease,
  activatedAt: number
) {
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
