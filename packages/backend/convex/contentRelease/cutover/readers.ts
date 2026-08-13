import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { proveFreezeHistory } from "@repo/backend/convex/contentRelease/cutover/history";
import {
  AUDITED_ARTICLE_COUNT,
  AUDITED_MATERIAL_COUNT,
  AUDITED_MATERIAL_TOPIC_COUNT,
  AUDITED_QURAN_SEARCH_COUNT,
  AUDITED_TRYOUT_CATALOG_COUNT,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import {
  type ReferenceProofCounts,
  requireReferenceProofs,
} from "@repo/backend/convex/contentRelease/cutover/referenceProofs";
import {
  requireCutoverPhase,
  requireReaderCutoverCheckpoint,
} from "@repo/backend/convex/contentRelease/cutover/state";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  historyReadinessValidator,
  type RetainedTryoutHistoryPlan,
  retainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { v } from "convex/values";
import { Effect } from "effect";

const readerCutoverAcceptanceValidator = v.object({
  acceptedAt: v.number(),
  history: historyReadinessValidator,
  referenceProofs: v.object({
    article: v.number(),
    material: v.number(),
    materialTopic: v.number(),
    quran: v.number(),
    tryout: v.number(),
  }),
});

const productionReferenceProofCounts = {
  article: AUDITED_ARTICLE_COUNT,
  material: AUDITED_MATERIAL_COUNT,
  materialTopic: AUDITED_MATERIAL_TOPIC_COUNT,
  quran: AUDITED_QURAN_SEARCH_COUNT,
  tryout: AUDITED_TRYOUT_CATALOG_COUNT,
};

/** Proves retained readers are safe before unlocking destructive drains. */
export const acceptReaderCutover = Effect.fn(
  "contentRelease.cutover.acceptReaderCutover"
)(function* (
  ctx: MutationCtx,
  plan: RetainedTryoutHistoryPlan,
  expectedReferenceProofs: ReferenceProofCounts
) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  const [history, referenceProofs] = yield* Effect.all([
    proveFreezeHistory(ctx, plan),
    requireReferenceProofs(ctx, expectedReferenceProofs),
  ]);
  const existingAcceptedAt = state.readerCutoverAcceptedAt;

  if (existingAcceptedAt !== undefined) {
    yield* requireReaderCutoverCheckpoint(state);
    return { acceptedAt: existingAcceptedAt, history, referenceProofs };
  }

  const acceptedAt = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      readerCutoverAcceptedAt: acceptedAt,
      updatedAt: acceptedAt,
    })
  );
  return { acceptedAt, history, referenceProofs };
});

/** Sole reader-deployment writer for the otherwise unreachable checkpoint. */
export const accept = internalMutation({
  args: {},
  returns: readerCutoverAcceptanceValidator,
  handler: (ctx) =>
    runConvexProgram(
      acceptReaderCutover(
        ctx,
        retainedTryoutHistoryPlan,
        productionReferenceProofCounts
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
