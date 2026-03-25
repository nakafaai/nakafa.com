import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for comments table changes.
 *
 * Manages comment thread relationships and schedules bounded cleanup:
 * - On insert: Increments parent comment's reply count
 * - On delete: Schedules dependent cleanup, decrements parent count
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function commentsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "comments">
) {
  const comment = change.newDoc;
  const oldComment = change.oldDoc;

  if (change.operation === "insert") {
    if (!comment?.parentId) {
      return;
    }

    const parentComment = await ctx.db.get("comments", comment.parentId);

    if (!parentComment) {
      return;
    }

    await ctx.db.patch("comments", comment.parentId, {
      replyCount: parentComment.replyCount + 1,
    });

    return;
  }

  if (change.operation !== "delete" || !oldComment) {
    return;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.triggers.comments.cleanup.cleanupDeletedComment,
    { commentId: change.id }
  );

  if (!oldComment.parentId) {
    return;
  }

  const parentComment = await ctx.db.get("comments", oldComment.parentId);

  if (!parentComment) {
    return;
  }

  await ctx.db.patch("comments", oldComment.parentId, {
    replyCount: Math.max(parentComment.replyCount - 1, 0),
  });
}
