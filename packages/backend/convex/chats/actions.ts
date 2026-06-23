import { internal } from "@repo/backend/convex/_generated/api";
import { action } from "@repo/backend/convex/_generated/server";
import { learningArtifactWriteValidator } from "@repo/backend/convex/chats/artifacts/spec";
import tables, {
  messageGenerationErrorCodeValidator,
  modelIdValueValidator,
} from "@repo/backend/convex/chats/schema";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Enqueues saveAssistantResponse as a scheduled internal mutation.
 * Guarantees exactly-once execution with automatic retry — unlike a direct
 * fetchMutation call which has no retry on transient failures.
 *
 * @see https://docs.convex.dev/scheduling/scheduled-functions
 */
export const scheduleSaveAssistantResponse = action({
  args: {
    message: tables.messages.validator,
    artifacts: v.optional(v.array(learningArtifactWriteValidator)),
    parts: v.array(
      v.object({
        ...tables.parts.validator.fields,
        messageId: v.optional(vv.id("messages")),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthForAction(ctx);
    await ctx.scheduler.runAfter(
      0,
      internal.chats.mutations.saveAssistantResponse,
      { userId: appUser._id, ...args }
    );
    return null;
  },
});

/**
 * Enqueues a refresh-safe failed assistant response marker.
 *
 * @see https://docs.convex.dev/scheduling/scheduled-functions
 */
export const scheduleSaveAssistantFailure = action({
  args: {
    message: v.object({
      chatId: vv.id("chats"),
      identifier: v.string(),
      modelId: modelIdValueValidator,
      generationErrorCode: messageGenerationErrorCodeValidator,
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthForAction(ctx);
    await ctx.scheduler.runAfter(
      0,
      internal.chats.mutations.saveAssistantFailure,
      { userId: appUser._id, ...args }
    );
    return null;
  },
});
