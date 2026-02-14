import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for chats table changes.
 *
 * Cascades deletion of chat to all associated messages and their parts.
 * Only executes on delete operations to maintain referential integrity.
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function chatsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "chats">
) {
  if (change.operation !== "delete") {
    return;
  }

  const messages = await ctx.db
    .query("messages")
    .withIndex("chatId", (q) => q.eq("chatId", change.id))
    .collect();

  for (const message of messages) {
    const parts = await ctx.db
      .query("parts")
      .withIndex("messageId_order", (q) => q.eq("messageId", message._id))
      .collect();

    for (const part of parts) {
      await ctx.db.delete("parts", part._id);
    }

    await ctx.db.delete("messages", message._id);
  }
}
