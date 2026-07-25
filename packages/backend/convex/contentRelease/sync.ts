import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

/** Loads one completed release that still owns the exact active sequence. */
export const loadSyncRelease = Effect.fn("contentRelease.loadSyncRelease")(
  function* (ctx: MutationCtx, releaseId: string) {
    const [release, state] = yield* Effect.all([
      loadRelease(ctx, releaseId),
      loadState(ctx),
    ]);
    if (
      !state ||
      release.status !== "completed" ||
      state.activeReleaseId !== releaseId ||
      state.activeSequence !== release.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Read-model sync ${releaseId} is not the active completed release.`
      );
    }
    const signed = yield* decodeReleaseJson(release.releaseJson);
    if (
      signed.manifestHash !== state.activeManifestHash ||
      signed.manifest.itemCount < 0
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Read-model sync ${releaseId} lost its active manifest.`
      );
    }
    return { release, signed, state };
  }
);
