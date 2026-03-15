import { mutation } from "@repo/backend/convex/betterAuth/_generated/server";
import { v } from "convex/values";

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
    await ctx.db.patch("user", args.authId, {
      userId: args.userId,
    });
  },
});

/**
 * Update Better Auth user's display name.
 * Only updates the auth user table. The caller (main app mutation)
 * is responsible for syncing to the app user table.
 *
 * Note: Triggers only fire when updates go through Better Auth's API
 * (e.g., auth.api.updateUser on client). For server-side mutations,
 * sync must be done manually in the calling mutation.
 *
 * @see https://labs.convex.dev/better-auth/features/triggers
 */
export const updateUserName = mutation({
  args: {
    authId: v.id("user"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("user", args.authId, {
      name: args.name,
    });
  },
});
