import { query } from "@repo/backend/convex/betterAuth/_generated/server";
import schema from "@repo/backend/convex/betterAuth/schema";
import { nullable } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";
import { doc } from "convex-helpers/validators";

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

/**
 * Get API keys by user ID.
 * Returns API keys for the user.
 */
export const getApiKeysByUserId = query({
  args: {
    userId: v.id("user"),
  },
  returns: v.array(doc(schema, "apikey")),
  handler: async (ctx, args) => {
    const apiKeys = await ctx.db
      .query("apikey")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();

    return apiKeys;
  },
});
