import { components } from "@repo/backend/convex/_generated/api";
import { internalQuery, query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/authHelpers";
import { v } from "convex/values";

/**
 * Get app user by Better Auth user ID.
 * Returns null if user doesn't exist.
 */
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

/**
 * Get app user by email address.
 * Returns null if user doesn't exist.
 */
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

/**
 * Get current user's API keys.
 * Requires authentication.
 * Returns API keys for the current user.
 */
export const getCurrentUserApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const apiKeys = await ctx.runQuery(
      components.betterAuth.queries.getApiKeysByUserId,
      {
        // Use authId from appUser (same as authUser._id)
        userId: user.appUser.authId,
      }
    );
    return apiKeys;
  },
});

/**
 * Get all user IDs.
 * Useful for generating static params for user pages.
 * Returns an array of user IDs.
 */
export const getAllUserIds = query({
  args: {},
  handler: async (ctx) => {
    const userIds = await ctx.db.query("users").collect();
    return userIds.map((user) => user._id);
  },
});

/**
 * Get user role.
 * Requires authentication.
 * Returns user role.
 */
export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return user.appUser.role;
  },
});
