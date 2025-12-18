import { v } from "convex/values";
import { components } from "../_generated/api";
import { mutation } from "../_generated/server";
import { requireAuthWithSession } from "../lib/authHelpers";

/**
 * Update the app user's role.
 */
export const updateUserRole = mutation({
  args: {
    role: v.union(
      v.literal("teacher"),
      v.literal("student"),
      v.literal("parent"),
      v.literal("administrator")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    await ctx.db.patch("users", user.appUser._id, {
      role: args.role,
    });
  },
});

/**
 * Update Better Auth user's display name.
 */
export const updateUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);
    await ctx.runMutation(components.betterAuth.mutations.updateUserName, {
      authId: user.authUser._id,
      name: args.name,
    });
  },
});

/**
 * Verify an API key with optional permissions.
 */
export const verifyApiKey = mutation({
  args: {
    key: v.string(),
    permissions: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await ctx.runMutation(components.betterAuth.mutations.verifyApiKey, {
      key: args.key,
      permissions: args.permissions,
    }),
});
