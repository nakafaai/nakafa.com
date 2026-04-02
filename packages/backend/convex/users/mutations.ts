import { components } from "@repo/backend/convex/_generated/api";
import { mutation } from "@repo/backend/convex/_generated/server";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/convex/credits/helpers/state";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  selfSelectableUserRoleValidator,
  userRoleValidator,
} from "@repo/backend/convex/users/schema";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

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

/**
 * Returns the authenticated user's chat-gating info and repairs stale credit
 * state against the materialized reset-period table.
 */
export const syncUserInfoForChat = mutation({
  args: {},
  returns: v.object({
    role: nullable(userRoleValidator),
    credits: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const effectiveCredits = await resolveEffectiveCreditState(
      ctx.db,
      user.appUser,
      Date.now()
    );
    const creditResetGrant = getCreditResetGrantTransaction(
      user.appUser,
      effectiveCredits
    );

    if (
      effectiveCredits.credits === user.appUser.credits &&
      effectiveCredits.creditsResetAt === user.appUser.creditsResetAt
    ) {
      return {
        role: user.appUser.role ?? null,
        credits: effectiveCredits.credits,
      };
    }

    await ctx.db.patch("users", user.appUser._id, {
      credits: effectiveCredits.credits,
      creditsResetAt: effectiveCredits.creditsResetAt,
    });

    if (creditResetGrant) {
      await ctx.db.insert("creditTransactions", {
        userId: user.appUser._id,
        ...creditResetGrant,
      });
    }

    return {
      role: user.appUser.role ?? null,
      credits: effectiveCredits.credits,
    };
  },
});
