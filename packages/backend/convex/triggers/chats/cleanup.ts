import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

const CHAT_PART_CLEANUP_BATCH_SIZE = 100;

/** Deletes one deleted chat's messages and parts in bounded batches. */
export const cleanupDeletedChat = internalMutation({
  args: {
    chatId: vv.id("chats"),
    messageId: v.optional(vv.id("messages")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = args.messageId
      ? await ctx.db.get("messages", args.messageId)
      : await ctx.db
          .query("messages")
          .withIndex("chatId", (q) => q.eq("chatId", args.chatId))
          .first();

    if (!message) {
      return null;
    }

    const parts = await ctx.db
      .query("parts")
      .withIndex("messageId_order", (q) => q.eq("messageId", message._id))
      .take(CHAT_PART_CLEANUP_BATCH_SIZE);

    for (const part of parts) {
      await ctx.db.delete("parts", part._id);
    }

    if (parts.length === CHAT_PART_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.chats.cleanup.cleanupDeletedChat,
        {
          chatId: args.chatId,
          messageId: message._id,
        }
      );

      return null;
    }

    await ctx.db.delete("messages", message._id);

    const nextMessage = await ctx.db
      .query("messages")
      .withIndex("chatId", (q) => q.eq("chatId", args.chatId))
      .first();

    if (!nextMessage) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.triggers.chats.cleanup.cleanupDeletedChat,
      {
        chatId: args.chatId,
      }
    );

    return null;
  },
});
