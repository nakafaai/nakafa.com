import { internal } from "@repo/backend/convex/_generated/api";
import { deleteMessageBatchFromPoint } from "@repo/backend/convex/chats/helpers";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/** Deletes one deleted chat's messages and parts in bounded batches. */
export const cleanupDeletedChat = internalMutation({
  args: {
    chatId: vv.id("chats"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deleteResult = await deleteMessageBatchFromPoint(ctx, args.chatId, 0);

    if (!deleteResult.hasMore) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.triggers.chats.cleanup.cleanupDeletedChat,
      args
    );

    return null;
  },
});
