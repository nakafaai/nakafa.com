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
import type { TransactionMetrics } from "convex/server";
import { Effect } from "effect";

const ACCEPTANCE_MAX_BYTES_READ = 512 * 1024;
const ACCEPTANCE_MAX_DATABASE_QUERIES = 4;
const ACCEPTANCE_MAX_DOCUMENTS_READ = 44;

/** Exact cold-path transaction ceilings for reader cutover acceptance. */
export const readerAcceptanceBudget = {
  bytesRead: ACCEPTANCE_MAX_BYTES_READ,
  databaseQueries: ACCEPTANCE_MAX_DATABASE_QUERIES,
  documentsRead: ACCEPTANCE_MAX_DOCUMENTS_READ,
  functionsScheduled: 0,
};

/** Proves retained readers are safe before unlocking destructive drains. */
export const acceptReaderCutover = Effect.fn(
  "contentRelease.cutover.acceptReaderCutover"
)(function* (
  ctx: MutationCtx,
  plan: RetainedTryoutHistoryPlan,
  expectedReferenceProofs: ReferenceProofCounts
) {
  const before = yield* readAcceptanceMetrics(ctx);
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
  const after = yield* readAcceptanceMetrics(ctx);
  yield* verifyReaderAcceptanceBudget(before, after);

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

const readAcceptanceMetrics = Effect.fn(
  "contentRelease.cutover.readReaderAcceptanceMetrics"
)(function* (ctx: MutationCtx) {
  return yield* Effect.promise(() => ctx.meta.getTransactionMetrics());
});

type ReaderAcceptanceMetrics = Pick<
  TransactionMetrics,
  "bytesRead" | "databaseQueries" | "documentsRead" | "functionsScheduled"
>;

/** Fails before the receipt write if the cold-path owned delta drifts. */
export const verifyReaderAcceptanceBudget = Effect.fn(
  "contentRelease.cutover.verifyReaderAcceptanceBudget"
)(function* (before: ReaderAcceptanceMetrics, after: ReaderAcceptanceMetrics) {
  const usage = readerAcceptanceUsage(before, after);
  if (
    usage.bytesRead < 0 ||
    usage.databaseQueries < 0 ||
    usage.documentsRead < 0 ||
    usage.functionsScheduled < 0 ||
    usage.bytesRead > readerAcceptanceBudget.bytesRead ||
    usage.databaseQueries > readerAcceptanceBudget.databaseQueries ||
    usage.documentsRead > readerAcceptanceBudget.documentsRead ||
    usage.functionsScheduled > readerAcceptanceBudget.functionsScheduled
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Reader cutover acceptance used ${usage.bytesRead} bytes, ${usage.databaseQueries} queries, ${usage.documentsRead} documents, and ${usage.functionsScheduled} schedules.`
    );
  }
});

function readerAcceptanceUsage(
  before: ReaderAcceptanceMetrics,
  after: ReaderAcceptanceMetrics
) {
  return {
    bytesRead: after.bytesRead.used - before.bytesRead.used,
    databaseQueries: after.databaseQueries.used - before.databaseQueries.used,
    documentsRead: after.documentsRead.used - before.documentsRead.used,
    functionsScheduled:
      after.functionsScheduled.used - before.functionsScheduled.used,
  };
}

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
