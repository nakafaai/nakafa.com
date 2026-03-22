import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

const COMMENT_VOTE_CLEANUP_BATCH_SIZE = 100;
const COMMENT_REPLY_CLEANUP_BATCH_SIZE = 100;

/** Deletes one comment's dependent votes and child replies in bounded batches. */
export const cleanupDeletedComment = internalMutation({
  args: {
    commentId: vv.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("commentVotes")
      .withIndex("commentId_userId", (q) => q.eq("commentId", args.commentId))
      .take(COMMENT_VOTE_CLEANUP_BATCH_SIZE);

    for (const vote of votes) {
      await ctx.db.delete("commentVotes", vote._id);
    }

    if (votes.length === COMMENT_VOTE_CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.triggers.comments.cleanup.cleanupDeletedComment,
        args
      );

      return null;
    }

    const replies = await ctx.db
      .query("comments")
      .withIndex("parentId", (q) => q.eq("parentId", args.commentId))
      .take(COMMENT_REPLY_CLEANUP_BATCH_SIZE);

    for (const reply of replies) {
      await ctx.db.delete("comments", reply._id);
    }

    if (replies.length < COMMENT_REPLY_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.triggers.comments.cleanup.cleanupDeletedComment,
      args
    );

    return null;
  },
});
