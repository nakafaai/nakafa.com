import { query } from "@repo/backend/convex/betterAuth/_generated/server";
import schema from "@repo/backend/convex/betterAuth/schema";
import { v } from "convex/values";
import { doc, nullable } from "convex-helpers/validators";

/**
 * Get Better Auth user by email address.
 * Returns null if user doesn't exist.
 */
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  returns: nullable(doc(schema, "user")),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .withIndex("email_name", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      return null;
    }

    return user;
  },
});
