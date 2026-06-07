import { chatResponseFailureCode } from "@repo/ai/config/generation";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { MAX_CHAT_MESSAGE_PARTS } from "@repo/backend/convex/chats/constants";
import { deletePartsForMessageBatch } from "@repo/backend/convex/chats/helpers";
import { internalMutation } from "@repo/backend/convex/functions";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

/**
 * Repairs historical assistant turns that were persisted without final text.
 *
 * This stays paginated because Convex mutations must not collect unbounded
 * tables. See https://docs.convex.dev/database/pagination
 */
export const repairIncompleteAssistantResponses = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    refundedCredits: v.number(),
    repaired: v.number(),
    scanned: v.number(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("messages")
      .withIndex("by_role", (q) => q.eq("role", "assistant"))
      .paginate(args.paginationOpts);

    let refundedCredits = 0;
    let repaired = 0;

    for (const message of page.page) {
      if (message.generationStatus === "failed") {
        continue;
      }

      const parts = await ctx.db
        .query("parts")
        .withIndex("by_messageId_and_order", (q) =>
          q.eq("messageId", message._id)
        )
        .take(MAX_CHAT_MESSAGE_PARTS + 1);

      if (parts.length > MAX_CHAT_MESSAGE_PARTS) {
        throw new ConvexError({
          code: "CHAT_INCOMPLETE_RESPONSE_REPAIR_EXCEEDED",
          message: "Incomplete response repair exceeded the part batch size.",
        });
      }

      if (!isIncompleteAssistantMessage(message, parts)) {
        continue;
      }

      const partsBatch = await deletePartsForMessageBatch(ctx, message._id);

      if (partsBatch.hasMore) {
        throw new ConvexError({
          code: "CHAT_INCOMPLETE_RESPONSE_REPAIR_EXCEEDED",
          message: "Incomplete response repair exceeded the part batch size.",
        });
      }

      const refunded = await refundAssistantCredits(ctx, message);

      await ctx.db.patch(message._id, {
        credits: 0,
        generationStatus: "failed",
        generationErrorCode: chatResponseFailureCode,
      });

      refundedCredits += refunded;
      repaired += 1;
    }

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      refundedCredits,
      repaired,
      scanned: page.page.length,
    };
  },
});

/** Identifies persisted assistant messages that cannot render as completed answers. */
function isIncompleteAssistantMessage(
  message: Doc<"messages">,
  parts: Doc<"parts">[]
) {
  if (message.generationStatus === "complete" && hasFinalTextPart(parts)) {
    return parts.some(isOpenStreamPart);
  }

  return !hasFinalTextPart(parts) || parts.some(isOpenStreamPart);
}

/** Detects a durable final text part from the persisted transcript. */
function hasFinalTextPart(parts: Doc<"parts">[]) {
  return parts.some(
    (part) =>
      part.type === "text" &&
      part.textState !== "streaming" &&
      (part.textText?.trim().length ?? 0) > 0
  );
}

/** Detects persisted parts that still describe in-progress AI SDK stream state. */
function isOpenStreamPart(part: Doc<"parts">) {
  if (part.type === "text") {
    return part.textState === "streaming";
  }

  if (part.type === "reasoning") {
    return part.reasoningState === "streaming";
  }

  switch (part.type) {
    case "tool-deepResearch":
    case "tool-math":
    case "tool-nakafa":
      return (
        part.toolState === "input-streaming" ||
        part.toolState === "input-available"
      );
    default:
      return false;
  }
}

/** Refunds credits for an old incomplete assistant message that charged usage. */
async function refundAssistantCredits(
  ctx: MutationCtx,
  message: Doc<"messages">
) {
  const credits = message.credits ?? 0;

  if (credits <= 0) {
    return 0;
  }

  const chat = await ctx.db.get(message.chatId);

  if (!chat) {
    return 0;
  }

  const user = await ctx.db.get(chat.userId);

  if (!user) {
    return 0;
  }

  const balanceAfter = user.credits + credits;

  await ctx.db.patch(user._id, {
    credits: balanceAfter,
  });
  await ctx.db.insert("creditTransactions", {
    userId: user._id,
    amount: credits,
    type: "refund",
    balanceAfter,
    metadata: {
      chatId: message.chatId,
      messageId: message._id,
      modelId: message.modelId ?? null,
      reason: "incomplete-assistant-response",
    },
  });

  return credits;
}
