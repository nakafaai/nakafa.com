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
      .unique();
    if (!user) {
      return null;
    }
    return user;
  },
});

export const getUserByEmail = internalQuery({
  args: v.object({
    email: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) {
      return null;
    }
    return user;
  },
});
