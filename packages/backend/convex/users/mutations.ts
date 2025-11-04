import { ConvexError, v } from "convex/values";
import { components } from "../_generated/api";
import { mutation } from "../_generated/server";
import { safeGetAppUser } from "../auth";

/**
 * Update Better Auth user's display name.
 */
export const updateUserName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await safeGetAppUser(ctx);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to update your name.",
      });
    }
    await ctx.runMutation(components.betterAuth.auth.updateUserName, {
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
    await ctx.runMutation(components.betterAuth.auth.verifyApiKey, {
      key: args.key,
      permissions: args.permissions,
    }),
});
