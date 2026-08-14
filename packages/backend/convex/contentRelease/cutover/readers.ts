import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { AUDITED_REFERENCE_PROOF_COUNTS } from "@repo/backend/convex/contentRelease/cutover/inventory";
import {
  type ReferenceProofCounts,
  requireReferenceProofs,
} from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import { readerCutoverReceiptValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import {
  loadCutoverState,
  requireReaderCutoverCheckpoint,
} from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { proveRetainedHistoryMarkers } from "@repo/backend/convex/tryouts/history/markers";
import type { RetainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

const ACCEPTANCE_MAX_BYTES_READ = 512 * 1024;
const ACCEPTANCE_MAX_DATABASE_QUERIES = 4;
const ACCEPTANCE_MAX_DOCUMENTS_READ = 48;

/** Proves retained readers are safe before unlocking destructive drains. */
export const acceptReaderCutover = Effect.fn(
  "contentRelease.cutover.acceptReaderCutover"
)(function* (
  ctx: MutationCtx,
  plan: RetainedTryoutHistoryPlan,
  expectedReferenceProofs: ReferenceProofCounts
) {
  const state = yield* loadCutoverState(ctx);
  if (state?.readerCutoverReceipt !== undefined) {
    return yield* requireReaderCutoverCheckpoint(
      state,
      plan,
      expectedReferenceProofs
    );
  }
  if (state?.phase !== "quiescent") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Reader cutover acceptance requires the quiescent cutover phase."
    );
  }

  const [history, referenceProofs] = yield* Effect.all([
    proveRetainedHistoryMarkers(ctx, plan),
    requireReferenceProofs(ctx, state, expectedReferenceProofs),
  ]);
  yield* requireAcceptanceBudget(ctx);

  const acceptedAt = Date.now();
  const readerCutoverReceipt = { acceptedAt, history, referenceProofs };
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      readerCutoverReceipt,
      updatedAt: acceptedAt,
    })
  );
  return readerCutoverReceipt;
});

/** Fails before the receipt write if the bounded acceptance budget drifts. */
const requireAcceptanceBudget = Effect.fn(
  "contentRelease.cutover.requireReaderAcceptanceBudget"
)(function* (ctx: MutationCtx) {
  const metrics = yield* Effect.promise(() => ctx.meta.getTransactionMetrics());
  if (
    metrics.bytesRead.used > ACCEPTANCE_MAX_BYTES_READ ||
    metrics.databaseQueries.used > ACCEPTANCE_MAX_DATABASE_QUERIES ||
    metrics.documentsRead.used > ACCEPTANCE_MAX_DOCUMENTS_READ ||
    metrics.functionsScheduled.used !== 0
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Reader cutover acceptance used ${metrics.bytesRead.used} bytes, ${metrics.databaseQueries.used} queries, ${metrics.documentsRead.used} documents, and ${metrics.functionsScheduled.used} schedules.`
    );
  }
});

/** Sole reader-deployment writer for the otherwise unreachable checkpoint. */
export const accept = internalMutation({
  args: {},
  returns: readerCutoverReceiptValidator,
  handler: (ctx) =>
    runConvexProgram(
      acceptReaderCutover(
        ctx,
        retainedTryoutHistoryPlan,
        AUDITED_REFERENCE_PROOF_COUNTS
      )
    ),
});
