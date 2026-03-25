import { mutation } from "@repo/backend/convex/betterAuth/_generated/server";
import { ConvexError, v } from "convex/values";

/**
 * Link Better Auth user to app user.
 * Called when app user is created.
 */
export const setUserId = mutation({
  args: {
    authId: v.string(),
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authId = ctx.db.normalizeId("user", args.authId);

    if (!authId) {
      throw new ConvexError({
        code: "BETTER_AUTH_USER_ID_INVALID",
        message: "Better Auth user ID is invalid.",
      });
    }

    await ctx.db.patch("user", authId, {
      userId: args.userId,
    });

    return null;
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
    authId: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authId = ctx.db.normalizeId("user", args.authId);

    if (!authId) {
      throw new ConvexError({
        code: "BETTER_AUTH_USER_ID_INVALID",
        message: "Better Auth user ID is invalid.",
      });
    }

    await ctx.db.patch("user", authId, {
      name: args.name,
    });

    return null;
  },
});
