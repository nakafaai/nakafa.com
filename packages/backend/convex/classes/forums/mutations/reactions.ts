import { loadActiveForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import { MAX_FORUM_REACTION_VARIANTS } from "@repo/backend/convex/classes/forums/utils/constants";
import { validateForumReactionValue } from "@repo/backend/convex/classes/forums/utils/reactions";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

/**
 * Toggle one reaction on a forum post.
 */
export const togglePostReaction = mutation({
  args: {
    emoji: v.string(),
    postId: vv.id("schoolClassForumPosts"),
  },
  handler: async (ctx, args) => {
    const emoji = validateForumReactionValue(args.emoji);
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;
    const post = await ctx.db.get("schoolClassForumPosts", args.postId);

    if (!post) {
      throw new ConvexError({
        code: "POST_NOT_FOUND",
        message: "Post not found.",
      });
    }

    await loadActiveForumWithAccess(ctx, post.forumId, userId);

    const existingReaction = await ctx.db
      .query("schoolClassForumPostReactions")
      .withIndex("by_postId_and_userId_and_emoji", (q) =>
        q.eq("postId", args.postId).eq("userId", userId).eq("emoji", emoji)
      )
      .unique();

    if (existingReaction) {
      await ctx.db.delete(
        "schoolClassForumPostReactions",
        existingReaction._id
      );
      return { added: false };
    }

    const hasReactionVariant = post.reactionCounts.some(
      (reactionCount) => reactionCount.emoji === emoji
    );

    if (
      !hasReactionVariant &&
      post.reactionCounts.length >= MAX_FORUM_REACTION_VARIANTS
    ) {
      throw new ConvexError({
        code: "FORUM_REACTION_VARIANT_LIMIT_EXCEEDED",
        message: "Forum post reaction variants exceed the supported limit.",
      });
    }

    await ctx.db.insert("schoolClassForumPostReactions", {
      emoji,
      postId: args.postId,
      userId,
    });

    return { added: true };
  },
});

/**
 * Toggle one reaction on a forum.
 */
export const toggleForumReaction = mutation({
  args: {
    emoji: v.string(),
    forumId: vv.id("schoolClassForums"),
  },
  handler: async (ctx, args) => {
    const emoji = validateForumReactionValue(args.emoji);
    const user = await requireAuth(ctx);
    const userId = user.appUser._id;
    const { forum } = await loadActiveForumWithAccess(
      ctx,
      args.forumId,
      userId
    );

    const existingReaction = await ctx.db
      .query("schoolClassForumReactions")
      .withIndex("by_forumId_and_userId_and_emoji", (q) =>
        q.eq("forumId", args.forumId).eq("userId", userId).eq("emoji", emoji)
      )
      .unique();

    if (existingReaction) {
      await ctx.db.delete("schoolClassForumReactions", existingReaction._id);
      return { added: false };
    }

    const hasReactionVariant = forum.reactionCounts.some(
      (reactionCount) => reactionCount.emoji === emoji
    );

    if (
      !hasReactionVariant &&
      forum.reactionCounts.length >= MAX_FORUM_REACTION_VARIANTS
    ) {
      throw new ConvexError({
        code: "FORUM_REACTION_VARIANT_LIMIT_EXCEEDED",
        message: "Forum reaction variants exceed the supported limit.",
      });
    }

    await ctx.db.insert("schoolClassForumReactions", {
      emoji,
      forumId: args.forumId,
      userId,
    });

    return { added: true };
  },
});
