import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getUserByAuthId = internalQuery({
  args: {
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", args.authId))
      .first();
    if (!user) {
      return null;
    }
    return user;
  },
});
