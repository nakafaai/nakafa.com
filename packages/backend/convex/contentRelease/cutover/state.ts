import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { AUDITED_REFERENCE_PROOF_COUNTS } from "@repo/backend/convex/contentRelease/cutover/inventory";
import type { ReferenceProofCounts } from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import type {
  cutoverPhaseValidator,
  readerCutoverReceiptValidator,
} from "@repo/backend/convex/contentRelease/cutover/schema";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

type CutoverPhase = Infer<typeof cutoverPhaseValidator>;
type ReadCtx = Pick<MutationCtx | QueryCtx, "db">;

/** Reads the single temporary cutover checkpoint through its exact identity. */
export const loadCutoverState = Effect.fn("contentRelease.cutover.loadState")(
  function* (ctx: ReadCtx) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("contentCutoverState")
        .withIndex("by_key", (index) => index.eq("key", "phase1"))
        .unique()
    );
  }
);

/** Requires the exact durable phase accepted by one cutover operation. */
export const requireCutoverPhase = Effect.fn(
  "contentRelease.cutover.requirePhase"
)(function* (ctx: ReadCtx, phases: readonly CutoverPhase[]) {
  const state = yield* loadCutoverState(ctx);
  if (!(state && phases.includes(state.phase))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Cutover requires phase ${phases.join(" or ")}.`
    );
  }
  return state;
});

/** Blocks destructive drains until the deployed reader cutover is accepted. */
export const requireReaderCutoverCheckpoint = Effect.fn(
  "contentRelease.cutover.requireReaderCutoverCheckpoint"
)(function* (
  state: {
    readonly readerCutoverReceipt?: Infer<typeof readerCutoverReceiptValidator>;
  },
  plan: RetainedTryoutHistoryPlan = retainedTryoutHistoryPlan,
  referenceProofs: ReferenceProofCounts = AUDITED_REFERENCE_PROOF_COUNTS
) {
  const receipt = state.readerCutoverReceipt;
  const history = receipt?.history;
  const references = receipt?.referenceProofs;
  if (
    !(
      receipt &&
      history &&
      references &&
      Number.isSafeInteger(receipt.acceptedAt)
    ) ||
    receipt.acceptedAt <= 0 ||
    history.attempts !== plan.attemptCount ||
    history.catalogRows !== plan.catalogRowCount ||
    history.frozenPlacements !== plan.frozenPlacementCount ||
    history.markers !== plan.attemptCount ||
    history.placementRows !== plan.placementRowCount ||
    history.progressRows !== plan.progressCount ||
    history.snapshotId !== plan.snapshotId ||
    references.article !== referenceProofs.article ||
    references.material !== referenceProofs.material ||
    references.materialTopic !== referenceProofs.materialTopic ||
    references.quran !== referenceProofs.quran ||
    references.tryout !== referenceProofs.tryout
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "The retained-history and legacy reader cutover has not been accepted."
    );
  }
  return receipt;
});

/** Proves the legacy-write token still equals the quiescent audit. */
export const requireLegacyWriteCheckpoint = Effect.fn(
  "contentRelease.cutover.requireLegacyWriteCheckpoint"
)(function* (
  ctx: ReadCtx,
  state: { readonly auditedLegacyWriteVersion: number }
) {
  const activity = yield* Effect.promise(() =>
    ctx.db
      .query("contentCutoverActivity")
      .withIndex("by_key", (index) => index.eq("key", "legacy"))
      .take(2)
  );
  if (
    activity.length !== 1 ||
    activity[0]?.version !== state.auditedLegacyWriteVersion
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "The legacy-write token changed after writer quiescence."
    );
  }
});

/** Blocks every old publication writer after cutover initialization. */
export const ensurePublicationWritable = Effect.fn(
  "contentRelease.cutover.ensurePublicationWritable"
)(function* (ctx: ReadCtx) {
  const state = yield* loadCutoverState(ctx);
  if (!state) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_STATE",
    "Content publication is frozen for the strict Phase 1 cutover."
  );
});

/** Internal guard used by the sole authenticated publication dispatcher. */
export const publicationGuard = internalQuery({
  args: {},
  returns: v.null(),
  handler: (ctx) =>
    runConvexProgram(ensurePublicationWritable(ctx).pipe(Effect.as(null))),
});
