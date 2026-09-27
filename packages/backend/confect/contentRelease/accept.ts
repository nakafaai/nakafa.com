import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  abortProgram,
  validateAbortedRelease,
} from "@repo/backend/confect/contentRelease/abort";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/confect/contentRelease/model";
import { validateRecoveryRelation } from "@repo/backend/confect/contentRelease/recovery";
import { Effect } from "effect";

/** Builds the cumulative terminal receipt retained by an aborted recovery. */
export function terminalReceipt(recovery: Docs["contentReleases"]) {
  const total =
    recovery.checkedItems +
    recovery.stagedItems +
    recovery.stagedRoutes +
    recovery.stagedSnapshotBatches;
  return {
    complete: true,
    processedItems: total,
    releaseId: recovery.releaseId,
    totalItems: total,
  };
}

/** Accepts healthy production by durably discarding its retained inverse. */
export const acceptProgram = Effect.fn("contentRelease.accept")(function* (
  releaseId: string,
  recoveryId: string
) {
  const candidate = yield* loadRelease(releaseId);
  const recovery = yield* loadRelease(recoveryId);
  const signed = yield* validateRecoveryRelation(candidate, recovery);
  if (recovery.status === "aborted") {
    yield* validateAbortedRelease(recoveryId);
    return terminalReceipt(recovery);
  }
  const state = yield* loadState();
  if (
    !state ||
    state.activeReleaseId !== releaseId ||
    state.activeManifestHash !== signed.candidate.manifestHash ||
    state.activeSequence !== candidate.sequence ||
    !ownsRole(state, "recovery", recovery) ||
    state.recoveryManifestHash === undefined ||
    recovery.status === "staging" ||
    recovery.status === "verifying" ||
    recovery.status === "completed"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Candidate ${releaseId} and recovery ${recoveryId} do not own the accepted active state.`
    );
  }
  if (state.recoveryManifestHash !== signed.recovery.manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Recovery ${recoveryId} lost its retained manifest identity.`
    );
  }
  return yield* abortProgram(recoveryId);
});
