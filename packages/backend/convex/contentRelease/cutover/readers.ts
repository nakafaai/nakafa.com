import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { proveArticleAssetIdsComplete } from "@repo/backend/convex/contentRelease/cutover/articleAssets";
import { proveFreezeHistory } from "@repo/backend/convex/contentRelease/cutover/history";
import { AUDITED_ARTICLE_COUNT } from "@repo/backend/convex/contentRelease/cutover/inventory";
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
  articleAssets: v.number(),
  history: historyReadinessValidator,
});

/** Proves retained readers are safe before unlocking destructive drains. */
export const acceptReaderCutover = Effect.fn(
  "contentRelease.cutover.acceptReaderCutover"
)(function* (
  ctx: MutationCtx,
  plan: RetainedTryoutHistoryPlan,
  expectedArticleCount: number
) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  const [articleAssets, history] = yield* Effect.all([
    proveArticleAssetIdsComplete(
      ctx,
      expectedArticleCount,
      state.auditedActiveSequence
    ),
    proveFreezeHistory(ctx, plan),
  ]);
  const existingAcceptedAt = state.readerCutoverAcceptedAt;

  if (existingAcceptedAt !== undefined) {
    yield* requireReaderCutoverCheckpoint(state);
    return { acceptedAt: existingAcceptedAt, articleAssets, history };
  }

  const acceptedAt = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      readerCutoverAcceptedAt: acceptedAt,
      updatedAt: acceptedAt,
    })
  );
  return { acceptedAt, articleAssets, history };
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
        AUDITED_ARTICLE_COUNT
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          contentKeyResolver
        )
      )
    ),
});
