import { loadActiveForumWithAccess } from "@repo/backend/convex/classes/forums/utils/access";
import {
  MAX_FORUM_REACTION_VALUE_LENGTH,
  MAX_FORUM_REACTION_VARIANTS,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";

const FORUM_REACTION_VALUE_PATTERN =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))(?:\u200D(?:\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;

/**
 * Ensure one reaction value is a bounded emoji sequence.
 */
function validateForumReactionValue(emoji: string) {
  if (
    emoji.length > 0 &&
    emoji.length <= MAX_FORUM_REACTION_VALUE_LENGTH &&
    FORUM_REACTION_VALUE_PATTERN.test(emoji)
  ) {
    return emoji;
  }

  throw new ConvexError({
    code: "FORUM_REACTION_INVALID",
    message: "Forum reaction must be a supported emoji.",
  });
}

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
    const user = await requireAuthWithSession(ctx);
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
      .withIndex("postId_userId_emoji", (q) =>
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
    const user = await requireAuthWithSession(ctx);
    const userId = user.appUser._id;
    const { forum } = await loadActiveForumWithAccess(
      ctx,
      args.forumId,
      userId
    );

    const existingReaction = await ctx.db
      .query("schoolClassForumReactions")
      .withIndex("forumId_userId_emoji", (q) =>
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
