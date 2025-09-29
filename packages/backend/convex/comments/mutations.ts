import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { safeGetUser } from "../auth";

const MAX_DEPTH = 3;

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

    let depth = 1;

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
    };

    await ctx.db.insert("comments", newComment);
  },
});
