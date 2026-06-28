import { getModelCreditCost, type ModelId } from "@repo/ai/config/model";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  deleteMessageBatchFromPoint,
  getMessageByIdentifier,
} from "@repo/backend/convex/chats/helpers";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/convex/credits/helpers/state";
import { ConvexError } from "convex/values";

/** Deletes an existing assistant response before saving its replacement. */
export async function deleteExistingResponseByIdentifier(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  identifier: string
) {
  const existingMessage = await getMessageByIdentifier(ctx, chatId, identifier);

  if (!existingMessage) {
    return;
  }

  const deleteResult = await deleteMessageBatchFromPoint(
    ctx,
    chatId,
    existingMessage._creationTime
  );

  if (deleteResult.hasMore) {
    throw new ConvexError({
      code: "CHAT_ASSISTANT_RESPONSE_REWRITE_EXCEEDED",
      message: "Assistant response rewrite exceeded the supported batch size.",
    });
  }
}

/** Resolves the credit state mutation needed for one billable assistant answer. */
export async function getAssistantCreditUsage(
  ctx: MutationCtx,
  user: Doc<"users">,
  modelId: ModelId | undefined
) {
  if (!modelId) {
    return null;
  }

  const effectiveCredits = await resolveEffectiveCreditState(
    ctx.db,
    user,
    Date.now()
  );
  const credits = getModelCreditCost(modelId);

  return {
    credits,
    newBalance: effectiveCredits.credits - credits,
    nextResetTimestamp: effectiveCredits.creditsResetAt,
    resetGrant: getCreditResetGrantTransaction(user, effectiveCredits),
  };
}
