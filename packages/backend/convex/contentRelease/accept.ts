import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  abortProgram,
  validateAbortedRelease,
} from "@repo/backend/convex/contentRelease/abort";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
  ownsRole,
} from "@repo/backend/convex/contentRelease/model";
import { validateRecoveryRelation } from "@repo/backend/convex/contentRelease/recovery";
import { abortReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/** Builds the cumulative terminal receipt retained by an aborted recovery. */
function terminalReceipt(recovery: Doc<"contentReleases">) {
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
  ctx: MutationCtx,
  releaseId: string,
  recoveryId: string
) {
  const candidate = yield* loadRelease(ctx, releaseId);
  const recovery = yield* loadRelease(ctx, recoveryId);
  const signed = yield* validateRecoveryRelation(candidate, recovery);
  if (recovery.status === "aborted") {
    yield* validateAbortedRelease(ctx, recoveryId);
    return terminalReceipt(recovery);
  }
  const state = yield* loadState(ctx);
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
  return yield* abortProgram(ctx, recoveryId);
});

/** Internal atomic page used by the authenticated accept operation. */
export const accept = internalMutation({
  args: { recoveryId: v.string(), releaseId: v.string() },
  returns: abortReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(acceptProgram(ctx, args.releaseId, args.recoveryId)),
});
