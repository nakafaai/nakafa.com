import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { cleanSlug, truncateText } from "@repo/backend/convex/utils/helper";
import { ConvexError, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Vote action validator: -1 = downvote, 0 = remove vote, 1 = upvote
 */
const voteActionValidator = literals(-1, 0, 1);

/**
 * Add a comment to a slug (article, post, etc.).
 * Note: Denormalized replyCount is updated via trigger in functions.ts
 */
export const addComment = mutation({
  args: {
    slug: v.string(),
    text: v.string(),
    parentId: v.optional(vv.id("comments")),
  },
  returns: vv.id("comments"),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);

    const parentComment = args.parentId
      ? await ctx.db.get("comments", args.parentId)
      : null;

    // Insert comment - trigger handles parent's replyCount update
    const newCommentId = await ctx.db.insert("comments", {
      slug: cleanSlug(args.slug),
      userId: user.appUser._id,
      text: args.text,
      parentId: args.parentId,
      replyToUserId: parentComment?.userId,
      // Store preview snippet (truncated, like Discord)
      replyToText: parentComment
        ? truncateText({ text: parentComment.text })
        : undefined,
      upvoteCount: 0,
      downvoteCount: 0,
      replyCount: 0,
    });

    return newCommentId;
  },
});

/**
 * Vote on a comment (upvote, downvote, or remove vote).
 * Vote values: 1 = upvote, -1 = downvote, 0 = remove vote.
 *
 * Note: Denormalized vote counts are updated via trigger in functions.ts
 */
export const voteOnComment = mutation({
  args: {
    commentId: vv.id("comments"),
    vote: voteActionValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);

    const comment = await ctx.db.get("comments", args.commentId);

    if (!comment) {
      throw new ConvexError({
        code: "COMMENT_NOT_FOUND",
        message: "Comment not found.",
      });
    }

    const existingVote = await ctx.db
      .query("commentVotes")
      .withIndex("commentId_userId", (q) =>
        q.eq("commentId", args.commentId).eq("userId", user.appUser._id)
      )
      .unique();

    // Remove existing vote if any - trigger handles count update
    if (existingVote) {
      await ctx.db.delete("commentVotes", existingVote._id);
    }

    // Add new vote if not removing (vote=0 means remove) - trigger handles count update
    if (args.vote !== 0) {
      await ctx.db.insert("commentVotes", {
        commentId: args.commentId,
        userId: user.appUser._id,
        vote: args.vote as -1 | 1,
      });
    }

    return null;
  },
});

/**
 * Delete a comment.
 * Only the comment author can delete their own comments.
 */
export const deleteComment = mutation({
  args: {
    commentId: vv.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);

    const comment = await ctx.db.get("comments", args.commentId);
    if (!comment) {
      throw new ConvexError({
        code: "COMMENT_NOT_FOUND",
        message: `Comment not found for commentId: ${args.commentId}`,
      });
    }

    if (comment.userId !== user.appUser._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You can only delete your own comments.",
      });
    }

    await ctx.db.delete("comments", args.commentId);

    return null;
  },
});
