import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import { asyncMap } from "convex-helpers";
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

  // Parallel queries: Fetch all parts for all messages at once
  // This avoids the N+1 query problem of querying parts sequentially
  const allParts = await asyncMap(messages, (message) =>
    ctx.db
      .query("parts")
      .withIndex("messageId_order", (q) => q.eq("messageId", message._id))
      .collect()
  );

  // Sequential deletes are acceptable - Convex auto-batches writes in transactions
  for (let i = 0; i < messages.length; i++) {
    const parts = allParts[i];
    for (const part of parts) {
      await ctx.db.delete("parts", part._id);
    }
    await ctx.db.delete("messages", messages[i]._id);
  }
}
