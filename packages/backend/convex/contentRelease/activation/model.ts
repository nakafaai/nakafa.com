import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadModelBuild,
  loadModelBuildRelease,
} from "@repo/backend/convex/contentRelease/models/build";
import { Effect } from "effect";

/** Requires the fully verified inactive buffers for one exact release. */
export const requireReadyModelBuild = Effect.fn(
  "contentRelease.requireReadyModelBuild"
)(function* (
  ctx: MutationCtx,
  release: Doc<"contentReleases">,
  signed: SignedContentRelease
) {
  const build = yield* loadModelBuild(ctx);
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
  yield* loadModelBuildRelease(ctx, build);
  return build;
});

/** Projects one exact release and its verified buffers into active state. */
export function modelActivationFields(
  build: Doc<"contentModelBuilds">,
  release: Doc<"contentReleases">,
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
