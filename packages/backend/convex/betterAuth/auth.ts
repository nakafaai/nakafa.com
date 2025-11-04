import { getStaticAuth } from "@convex-dev/better-auth";
import { v } from "convex/values";
import { doc } from "convex-helpers/validators";
import { createAuth } from "../auth";
import { mutation, query } from "./_generated/server";
import schema from "./schema";

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
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(v.null(), doc(schema, "user")),
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
