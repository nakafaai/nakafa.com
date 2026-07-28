/**
 * Authentication helpers for Convex functions.
 *
 * Three strategies:
 * 1. getOptionalAppUserForRead() - nullable query helper
 * 2. getOptionalActiveAppUser() - nullable mutation helper
 * 3. requireAuth() / requireAuthForAction() - required auth helpers
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
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { authReader } from "@repo/backend/convex/auth/reader";
import { getAppUserByAuthId } from "@repo/backend/convex/lib/helpers/user";
import { ConvexError } from "convex/values";

type AuthUser = Awaited<ReturnType<typeof authReader.getAuthUser>>;

interface AuthContext {
  readonly appUser: Doc<"users">;
  readonly authUser: AuthUser;
}

/** Resolves a session and its app row without applying an activity policy. */
async function loadOptionalAuthContext(
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

/** Optional query identity; prepared users stay readable for recovery UX. */
export async function getOptionalAppUserForRead(
  ctx: QueryCtx
): Promise<AuthContext | null> {
  const auth = await loadOptionalAuthContext(ctx);

  return auth && auth.appUser.deletedAt === undefined ? auth : null;
}

/** Optional mutation identity that cannot write after deletion preparation. */
export async function getOptionalActiveAppUser(
  ctx: MutationCtx
): Promise<AuthContext | null> {
  const auth = await loadOptionalAuthContext(ctx);

  return auth && !isAccountDeletionPending(auth.appUser) ? auth : null;
}

/** Required query/mutation authentication with Better Auth session validation. */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<AuthContext> {
  const authUser = await authReader.getAuthUser(ctx);
  const appUser = await getAppUserByAuthId(ctx, authUser._id);

  if (!appUser || isAccountDeletionPending(appUser)) {
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

  if (!appUser || isAccountDeletionPending(appUser)) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found.",
    });
  }

  return { appUser, authUser };
}
