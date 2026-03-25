import { internal } from "@repo/backend/convex/_generated/api";
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

  await ctx.scheduler.runAfter(
    0,
    internal.triggers.chats.cleanup.cleanupDeletedChat,
    { chatId: change.id }
  );
}
