import { query } from "@repo/backend/convex/betterAuth/_generated/server";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Get Better Auth user by email address.
 * Returns null if user doesn't exist.
 */
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  returns: nullable(v.object({ _id: v.id("user") })),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      return null;
    }

    return { _id: user._id };
  },
});
