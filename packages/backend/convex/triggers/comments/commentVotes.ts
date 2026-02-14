import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Trigger handler for commentVotes table changes.
 *
 * Maintains denormalized vote counts on comments table:
 * - On insert: Increments upvote or downvote count
 * - On delete: Decrements the corresponding count
 *
 * @param ctx - The Convex mutation context with database access
 * @param change - The change object containing operation details and document state
 */
export async function commentVotesHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "commentVotes">
) {
  const vote = change.newDoc;
  const oldVote = change.oldDoc;

  switch (change.operation) {
    case "insert": {
      if (!vote) {
        break;
      }

      const comment = await ctx.db.get("comments", vote.commentId);
      if (comment) {
        if (vote.vote === 1) {
          await ctx.db.patch("comments", vote.commentId, {
            upvoteCount: comment.upvoteCount + 1,
          });
        } else if (vote.vote === -1) {
          await ctx.db.patch("comments", vote.commentId, {
            downvoteCount: comment.downvoteCount + 1,
          });
        }
      }
      break;
    }

    case "delete": {
      if (!oldVote) {
        break;
      }

      const comment = await ctx.db.get("comments", oldVote.commentId);
      if (comment) {
        if (oldVote.vote === 1) {
          await ctx.db.patch("comments", oldVote.commentId, {
            upvoteCount: Math.max(comment.upvoteCount - 1, 0),
          });
        } else if (oldVote.vote === -1) {
          await ctx.db.patch("comments", oldVote.commentId, {
            downvoteCount: Math.max(comment.downvoteCount - 1, 0),
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
