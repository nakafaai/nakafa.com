import { components } from "@repo/backend/convex/_generated/api";
import { mutation } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { selfSelectableUserRoleValidator } from "@repo/backend/convex/users/schema";
import { v } from "convex/values";

/**
 * Update the app user's role.
 */
export const updateUserRole = mutation({
  args: {
    role: selfSelectableUserRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await ctx.db.patch("users", user.appUser._id, {
      role: args.role,
    });
    return null;
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Update Better Auth user table
    await ctx.runMutation(components.betterAuth.mutations.updateUserName, {
      authId: user.authUser._id,
      name: args.name,
    });

    // Sync to app user table (manual sync since triggers don't fire)
    await ctx.db.patch("users", user.appUser._id, {
      name: args.name,
    });
    return null;
  },
});
