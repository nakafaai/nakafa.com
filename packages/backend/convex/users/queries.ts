import { components } from "@repo/backend/convex/_generated/api";
import { internalQuery, query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/authHelpers";
import { v } from "convex/values";
import { apiKeyValidator, userDocValidator, userRoleValidator } from "./schema";

/**
 * Get app user by Better Auth user ID.
 * Returns null if user doesn't exist.
 */
export const getUserByAuthId = internalQuery({
  args: {
    authId: v.string(),
  },
  returns: v.union(userDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", args.authId))
      .unique();
  },
});

/**
 * Get app user by email address.
 * Returns null if user doesn't exist.
 */
export const getUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(userDocValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
  },
});

/**
 * Get current user's API keys.
 * Requires authentication.
 */
export const getCurrentUserApiKeys = query({
  args: {},
  returns: v.array(apiKeyValidator),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return await ctx.runQuery(
      components.betterAuth.queries.getApiKeysByUserId,
      { userId: user.appUser.authId }
    );
  },
});

/**
 * Get all user IDs.
 * Useful for generating static params for user pages.
 */
export const getAllUserIds = query({
  args: {},
  returns: v.array(v.id("users")),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => user._id);
  },
});

/**
 * Get user role.
 * Requires authentication.
 * Returns null if role is not set.
 */
export const getUserRole = query({
  args: {},
  returns: userRoleValidator,
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return user.appUser.role ?? null;
  },
});
