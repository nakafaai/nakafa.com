import { internal } from "@repo/backend/convex/_generated/api";
import { action } from "@repo/backend/convex/_generated/server";
import tables from "@repo/backend/convex/chats/schema";
import { requireAuthForAction } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Enqueues saveAssistantResponse as a scheduled internal mutation.
 * Guarantees exactly-once execution with automatic retry — unlike a direct
 * fetchMutation call which has no retry on transient failures.
 */
export const scheduleSaveAssistantResponse = action({
  args: {
    message: tables.messages.validator,
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
