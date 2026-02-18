import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for comments table changes.
 *
 * Manages comment thread relationships and cascading deletions:
 * - On insert: Increments parent comment's reply count
 * - On delete: Removes all votes and replies, decrements parent count
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

  switch (change.operation) {
    case "insert": {
      if (!comment?.parentId) {
        break;
      }

      const parentComment = await ctx.db.get("comments", comment.parentId);
      if (parentComment) {
        await ctx.db.patch("comments", comment.parentId, {
          replyCount: parentComment.replyCount + 1,
        });
      }
      break;
    }

    case "delete": {
      if (!oldComment) {
        break;
      }

      const votes = await ctx.db
        .query("commentVotes")
        .withIndex("commentId_userId", (q) => q.eq("commentId", change.id))
        .collect();

      for (const vote of votes) {
        await ctx.db.delete("commentVotes", vote._id);
      }

      const replies = await ctx.db
        .query("comments")
        .withIndex("parentId", (q) => q.eq("parentId", change.id))
        .collect();

      for (const reply of replies) {
        await ctx.db.delete("comments", reply._id);
      }

      if (oldComment.parentId) {
        const parentComment = await ctx.db.get("comments", oldComment.parentId);
        if (parentComment) {
          await ctx.db.patch("comments", oldComment.parentId, {
            replyCount: Math.max(parentComment.replyCount - 1, 0),
          });
        }
      }
      break;
    }

    default: {
      break;
    }
  }
}
