import { ConvexError, v } from "convex/values";
import { safeGetAppUser } from "../auth";
import { mutation } from "../functions";
import { cleanSlug } from "../utils/helper";

export const addComment = mutation({
  args: {
    slug: v.string(),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);

    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to comment.",
      });
    }

    const parentComment = args.parentId
      ? await ctx.db.get(args.parentId)
      : null;

    const newCommentId = await ctx.db.insert("comments", {
      slug: cleanSlug(args.slug),
      userId: user.appUser._id,
      text: args.text,
      parentId: args.parentId,
      replyToUserId: parentComment?.userId,
      upvoteCount: 0,
      downvoteCount: 0,
      replyCount: 0,
    });

    if (parentComment) {
      await ctx.db.patch(parentComment._id, {
        replyCount: parentComment.replyCount + 1,
      });
    }

    return newCommentId;
  },
});

/**
 * Vote on a comment (upvote, downvote, or remove vote).
 * Vote values: 1 = upvote, -1 = downvote, 0 = remove vote.
 */
export const voteOnComment = mutation({
  args: {
    commentId: v.id("comments"),
    vote: v.union(v.literal(-1), v.literal(0), v.literal(1)),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);

    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to vote.",
      });
    }

    const comment = await ctx.db.get(args.commentId);

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

    let upvoteCount = comment.upvoteCount;
    let downvoteCount = comment.downvoteCount;

    // Remove existing vote
    if (existingVote) {
      if (existingVote.vote === 1) {
        upvoteCount -= 1;
      } else if (existingVote.vote === -1) {
        downvoteCount -= 1;
      }
      await ctx.db.delete(existingVote._id);
    }

    // Add new vote if not removing
    if (args.vote !== 0) {
      await ctx.db.insert("commentVotes", {
        commentId: args.commentId,
        userId: user.appUser._id,
        vote: args.vote as -1 | 1,
      });

      if (args.vote === 1) {
        upvoteCount += 1;
      } else if (args.vote === -1) {
        downvoteCount += 1;
      }
    }

    await ctx.db.patch(args.commentId, {
      upvoteCount,
      downvoteCount,
    });

    return { upvoteCount, downvoteCount };
  },
});

/**
 * Delete a comment.
 * Only the comment author can delete their own comments.
 */
export const deleteComment = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);

    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to delete a comment.",
      });
    }

    const comment = await ctx.db.get(args.commentId);

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

    await ctx.db.delete(args.commentId);
  },
});
