import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import {
  completedReceipt,
  stagedEvidence,
} from "@repo/backend/convex/contentRelease/receipt";
import { Effect } from "effect";

/** Loads one completed base snapshot and returns its immutable sequence. */
const loadBase = Effect.fn("contentRelease.loadSnapshotBase")(function* (
  ctx: QueryCtx,
  releaseId: null | string,
  manifestHash: null | string,
  expectedSequence?: number
) {
  if (releaseId === null || manifestHash === null) {
    if (
      releaseId !== null ||
      manifestHash !== null ||
      expectedSequence !== undefined
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Content snapshot has an incomplete genesis base identity."
      );
    }
    return 0;
  }
  const release = yield* loadRelease(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (
    release.status !== "completed" ||
    signed.manifestHash !== manifestHash ||
    (expectedSequence !== undefined && release.sequence !== expectedSequence)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content snapshot base ${releaseId} is not exact and completed.`
    );
  }
  yield* completedReceipt(release, signed);
  return release.sequence;
});

/** Checks whether a candidate extends the exact current active identity. */
function hasExactBase(
  active: {
    readonly manifestHash: string | undefined;
    readonly releaseId: string | undefined;
    readonly sequence: number | undefined;
  },
  base: {
    readonly manifestHash: null | string;
    readonly releaseId: null | string;
  }
) {
  if (base.releaseId === null) {
    return (
      base.manifestHash === null &&
      active.releaseId === undefined &&
      active.manifestHash === undefined &&
      active.sequence === undefined
    );
  }
  return (
    base.manifestHash !== null &&
    active.releaseId === base.releaseId &&
    active.manifestHash === base.manifestHash &&
    active.sequence !== undefined
  );
}

/** Loads one exact active or verified-candidate immutable snapshot. */
export const loadReadableSnapshot = Effect.fn(
  "contentRelease.loadReadableSnapshot"
)(function* (ctx: QueryCtx, releaseId: string, manifestHash: string) {
  const state = yield* loadState(ctx);
  if (!state) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Release ${releaseId} has no publication snapshot.`
    );
  }
  const release = yield* loadRelease(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const isActive =
    state.activeReleaseId === releaseId &&
    state.activeManifestHash === manifestHash &&
    state.activeSequence === release.sequence &&
    release.status === "completed";
  const isCandidate =
    state.candidateReleaseId === releaseId &&
    state.candidateManifestHash === manifestHash &&
    state.candidateSequence === release.sequence &&
    release.role === "candidate" &&
    release.status === "verified" &&
    hasExactBase(
      {
        manifestHash: state.activeManifestHash,
        releaseId: state.activeReleaseId,
        sequence: state.activeSequence,
      },
      {
        manifestHash: signed.manifest.baseManifestHash,
        releaseId: signed.manifest.baseReleaseId,
      }
    );
  if (signed.manifestHash !== manifestHash || !(isActive || isCandidate)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Release ${releaseId} is not an exact readable snapshot.`
    );
  }
  if (isActive) {
    yield* completedReceipt(release, signed);
  } else {
    yield* stagedEvidence(release, signed);
  }
  const baseSequence = yield* loadBase(
    ctx,
    signed.manifest.baseReleaseId,
    signed.manifest.baseManifestHash,
    isCandidate ? state.activeSequence : undefined
  );
  return { baseSequence, release, signed };
});
