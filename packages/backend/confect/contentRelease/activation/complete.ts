import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadState } from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { completedReceipt } from "@repo/backend/confect/contentRelease/receipt";
import { findReleaseTryoutRuntime } from "@repo/backend/confect/contentRelease/tryout/binding";
import { Effect } from "effect";

/** Returns terminal evidence for one idempotently repeated activation. */
export const completedActivation = Effect.fn(
  "contentRelease.completedActivation"
)(function* (releaseId: string, release: Docs["contentReleases"]) {
  const state = yield* loadState();
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
  yield* findReleaseTryoutRuntime(signed, release.tryoutRuntimeBundleHash);
  return yield* completedReceipt(release, signed);
});
