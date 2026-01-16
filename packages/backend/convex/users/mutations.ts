import { components } from "@repo/backend/convex/_generated/api";
import { mutation } from "@repo/backend/convex/_generated/server";
import { requireAuthWithSession } from "@repo/backend/convex/lib/authHelpers";
import { v } from "convex/values";

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
 * Update user's display name.
 * Updates both the Better Auth user and app user tables.
 *
 * Note: Triggers only fire for client-side Better Auth API calls.
 * For server-side mutations, we sync manually.
 */
export const updateUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthWithSession(ctx);

    // Update Better Auth user table
    await ctx.runMutation(components.betterAuth.mutations.updateUserName, {
      authId: user.authUser._id,
      name: args.name,
    });

    // Sync to app user table (manual sync since triggers don't fire)
    await ctx.db.patch("users", user.appUser._id, {
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
