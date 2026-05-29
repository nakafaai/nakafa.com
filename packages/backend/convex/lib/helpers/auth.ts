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
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { authReader } from "@repo/backend/convex/auth/reader";
import { getAppUserByAuthId } from "@repo/backend/convex/lib/helpers/user";
import { ConvexError } from "convex/values";

type AuthUser = Awaited<ReturnType<typeof authReader.getAuthUser>>;

interface AuthContext {
  readonly appUser: Doc<"users">;
  readonly authUser: AuthUser;
}

/**
 * Resolve the current app user without enforcing auth.
 * Returns null when no valid Better Auth user or matching app user exists.
 */
export async function getOptionalAppUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext | null> {
  const authUser = await authReader.safeGetAuthUser(ctx);

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
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext> {
  const authUser = await authReader.getAuthUser(ctx);
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
export async function requireAuthForAction(
  ctx: ActionCtx
): Promise<AuthContext> {
  const authUser = await authReader.getAuthUser(ctx);

  const appUser: Doc<"users"> | null = await ctx.runQuery(
    internal.users.queries.getUserByAuthId,
    {
      authId: authUser._id,
    }
  );

  if (!appUser) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found.",
    });
  }

  return { appUser, authUser };
}
