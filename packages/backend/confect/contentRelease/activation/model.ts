import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadModelBuild,
  loadModelBuildRelease,
} from "@repo/backend/confect/contentRelease/models/build";
import { Effect } from "effect";

/** Requires the fully verified inactive buffers for one exact release. */
export const requireReadyModelBuild = Effect.fn(
  "contentRelease.requireReadyModelBuild"
)(function* (release: Docs["contentReleases"], signed: SignedContentRelease) {
  const build = yield* loadModelBuild();
  if (
    !build ||
    build.releaseId !== release.releaseId ||
    build.manifestHash !== signed.manifestHash ||
    build.sequence !== release.sequence ||
    build.phase !== "ready" ||
    build.syncJobId !== undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${release.releaseId} lacks a ready model build.`
    );
  }
  yield* loadModelBuildRelease(build);
  return build;
});

/** Projects one exact release and its verified buffers into active state. */
export function modelActivationFields(
  build: Docs["contentModelBuilds"],
  release: Docs["contentReleases"],
  signed: SignedContentRelease
) {
  return {
    articleManifestHash: signed.manifestHash,
    articleReleaseId: release.releaseId,
    articleSequence: release.sequence,
    articleSlot: build.slots.articleTargetSlot,
    materialManifestHash: signed.manifestHash,
    materialReleaseId: release.releaseId,
    materialSequence: release.sequence,
    materialSlot: build.slots.materialTargetSlot,
    searchManifestHash: signed.manifestHash,
    searchReleaseId: release.releaseId,
    searchSequence: release.sequence,
    searchSlot: build.slots.searchTargetSlot,
  };
}
