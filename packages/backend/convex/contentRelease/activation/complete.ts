import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadState } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { completedReceipt } from "@repo/backend/convex/contentRelease/receipt";
import { findReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/binding";
import { Effect } from "effect";

/** Returns terminal evidence for one idempotently repeated activation. */
export const completedActivation = Effect.fn(
  "contentRelease.completedActivation"
)(function* (
  ctx: MutationCtx,
  releaseId: string,
  release: Doc<"contentReleases">
) {
  const state = yield* loadState(ctx);
  if (
    state?.activeReleaseId !== releaseId ||
    state.activeSequence !== release.sequence ||
    state.articleReleaseId !== releaseId ||
    state.articleSequence !== release.sequence ||
    state.materialReleaseId !== releaseId ||
    state.materialSequence !== release.sequence ||
    state.searchReleaseId !== releaseId ||
    state.searchSequence !== release.sequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Completed release ${releaseId} is not the complete active model sequence.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (
    state.activeManifestHash !== signed.manifestHash ||
    state.articleManifestHash !== signed.manifestHash ||
    state.materialManifestHash !== signed.manifestHash ||
    state.searchManifestHash !== signed.manifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Completed release ${releaseId} lost its active model manifest.`
    );
  }
  yield* findReleaseTryoutRuntime(ctx, signed, release.tryoutRuntimeBundleHash);
  return yield* completedReceipt(release, signed);
});
