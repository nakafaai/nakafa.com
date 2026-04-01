import { components, internal } from "@repo/backend/convex/_generated/api";
import {
  internalMutation,
  mutation,
} from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { selfSelectableUserRoleValidator } from "@repo/backend/convex/users/schema";
import { userWriteWorkpool } from "@repo/backend/convex/users/workpool";
import { v } from "convex/values";

/** Apply one users-table patch through the shared serialized writer. */
export const applyUserStateUpdate = internalMutation({
  args: {
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    name: v.optional(v.string()),
    role: v.optional(selfSelectableUserRoleValidator),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch = {
      ...(args.email === undefined ? {} : { email: args.email }),
      ...(args.image === undefined ? {} : { image: args.image }),
      ...(args.name === undefined ? {} : { name: args.name }),
      ...(args.role === undefined ? {} : { role: args.role }),
    };

    if (Object.keys(patch).length === 0) {
      return null;
    }

    await ctx.db.patch("users", args.userId, patch);

    return null;
  },
});

/** Delete one app-user row through the shared serialized writer. */
export const deleteUserRecord = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("users", args.userId);
    return null;
  },
});

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

    await userWriteWorkpool.enqueueMutation(
      ctx,
      internal.users.mutations.applyUserStateUpdate,
      {
        role: args.role,
        userId: user.appUser._id,
      }
    );

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

    await userWriteWorkpool.enqueueMutation(
      ctx,
      internal.users.mutations.applyUserStateUpdate,
      {
        name: args.name,
        userId: user.appUser._id,
      }
    );

    return null;
  },
});
