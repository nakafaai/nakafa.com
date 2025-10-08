import { getStaticAuth } from "@convex-dev/better-auth";
import { v } from "convex/values";
import { createAuth } from "../auth";
import { mutation } from "./_generated/server";

// Export a static instance for Better Auth schema generation
export const auth = getStaticAuth(createAuth);

export const setUserId = mutation({
  args: {
    authId: v.id("user"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.authId, {
      userId: args.userId,
    });
  },
});
