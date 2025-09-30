import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { safeGetUser } from "../auth";

const MAX_DEPTH = 2;

export const addComment = mutation({
  args: {
    contentSlug: v.string(),
    text: v.string(),
    parentId: v.optional(v.id("comments")),
    mentions: v.optional(v.array(v.id("user"))),
  },
  handler: async (ctx, args) => {
    const user = await safeGetUser(ctx);

    if (!user) {
      throw new Error("You must be logged in to comment.");
    }

    let depth = 0;

    if (args.parentId) {
      const parentComment = await ctx.db.get(args.parentId);
      if (parentComment) {
        // Increment depth from the parent, but cap it at 3.
        // This makes it so a reply to a depth 3 comment also becomes depth 3,
        // creating a flat thread at the maximum depth.
        depth = Math.min(parentComment.depth + 1, MAX_DEPTH);
      }
    }

    const newComment = {
      contentSlug: args.contentSlug,
      userId: user._id,
      text: args.text,
      parentId: args.parentId,
      mentions: args.mentions,
      depth,
      upvoteCount: 0,
      downvoteCount: 0,
      score: 0,
    };

    await ctx.db.insert("comments", newComment);
  },
});

export const voteOnComment = mutation({
  args: {
    commentId: v.id("comments"),
    vote: v.union(v.literal(-1), v.literal(0), v.literal(1)),
  },
  handler: async (ctx, args) => {
    const user = await safeGetUser(ctx);

    if (!user) {
      throw new Error("You must be logged in to vote.");
    }

    const comment = await ctx.db.get(args.commentId);

    if (!comment) {
      throw new Error("Comment not found.");
    }

    const existingVote = await ctx.db
      .query("commentVotes")
      .withIndex("commentId_userId", (q) =>
        q.eq("commentId", args.commentId).eq("userId", user._id)
      )
      .unique();

    let upvoteCount = comment.upvoteCount;
    let downvoteCount = comment.downvoteCount;

    if (existingVote) {
      if (existingVote.vote === 1) {
        upvoteCount -= 1;
      } else if (existingVote.vote === -1) {
        downvoteCount -= 1;
      }

      await ctx.db.delete(existingVote._id);
    }

    if (args.vote !== 0) {
      await ctx.db.insert("commentVotes", {
        commentId: args.commentId,
        userId: user._id,
        vote: args.vote as -1 | 1,
      });

      if (args.vote === 1) {
        upvoteCount += 1;
      } else if (args.vote === -1) {
        downvoteCount += 1;
      }
    }

    const score = upvoteCount - downvoteCount;

    await ctx.db.patch(args.commentId, {
      upvoteCount,
      downvoteCount,
      score,
    });

    return {
      upvoteCount,
      downvoteCount,
      score,
    };
  },
});
