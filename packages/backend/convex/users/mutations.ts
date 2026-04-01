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
    clearImage: v.optional(v.boolean()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    name: v.optional(v.string()),
    role: v.optional(selfSelectableUserRoleValidator),
    syncCustomerAfter: v.optional(v.boolean()),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    let role = user.role;
    if (args.role !== undefined) {
      role = args.role;
    }

    let image = user.image;
    if (args.clearImage) {
      image = undefined;
    } else if (args.image !== undefined) {
      image = args.image;
    }

    const nextUser = {
      authId: user.authId,
      credits: user.credits,
      creditsResetAt: user.creditsResetAt,
      email: args.email ?? user.email,
      name: args.name ?? user.name,
      plan: user.plan,
      ...(role === undefined ? {} : { role }),
      ...(image === undefined ? {} : { image }),
    };

    await ctx.db.replace(args.userId, nextUser);

    if (args.syncCustomerAfter) {
      await ctx.scheduler.runAfter(0, internal.customers.actions.syncCustomer, {
        userId: args.userId,
      });
    }

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
