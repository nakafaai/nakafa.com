/**
 * Authentication helpers for Convex functions.
 *
 * Two strategies:
 * 1. getOptionalAppUser() - nullable helper for optional reads
 * 2. requireAuth() / requireAuthForAction() - required auth helpers
 *
 * @see https://labs.convex.dev/better-auth/basic-usage/authorization
 */

import { internal } from "@repo/backend/convex/_generated/api";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { authComponent } from "@repo/backend/convex/auth/client";
import { getAppUserByAuthId } from "@repo/backend/convex/lib/helpers/user";
import { ConvexError } from "convex/values";

/**
 * Resolve the current app user without enforcing auth.
 * Returns null when no valid Better Auth user or matching app user exists.
 */
export async function getOptionalAppUser(ctx: QueryCtx | MutationCtx) {
  const authUser = await authComponent.safeGetAuthUser(ctx);

  if (!authUser) {
    return null;
  }

  const appUser = await getAppUserByAuthId(ctx, authUser._id);

  if (!appUser) {
    return null;
  }

  return {
    appUser,
    authUser,
  };
}

/** Required query/mutation authentication with Better Auth session validation. */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const authUser = await authComponent.getAuthUser(ctx);
  const appUser = await getAppUserByAuthId(ctx, authUser._id);

  if (!appUser) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found.",
    });
  }

  return { appUser, authUser };
}

/** Session-validated authentication for actions. */
export async function requireAuthForAction(ctx: ActionCtx) {
  const authUser = await authComponent.getAuthUser(ctx);

  const appUser = await ctx.runQuery(internal.users.queries.getUserByAuthId, {
    authId: authUser._id,
  });

  if (!appUser) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found.",
    });
  }

  return { appUser, authUser };
}
