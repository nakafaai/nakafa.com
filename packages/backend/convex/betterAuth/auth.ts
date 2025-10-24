import { getStaticAuth } from "@convex-dev/better-auth";
import { v } from "convex/values";
import { createAuth } from "../auth";
import { internalQuery, mutation } from "./_generated/server";

// Export a static instance for Better Auth schema generation
export const auth = getStaticAuth(createAuth);

/**
 * Link Better Auth user to app user.
 * Called when app user is created.
 */
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

/**
 * Update Better Auth user's display name.
 */
export const updateName = mutation({
  args: {
    authId: v.id("user"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.authId, {
      name: args.name,
    });
  },
});

/**
 * Get Better Auth user by email address.
 * Returns null if user doesn't exist.
 */
export const getUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
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
