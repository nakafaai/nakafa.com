/**
 * Authentication helpers for Convex functions.
 *
 * Two strategies:
 * 1. requireAuth() - Fast JWT-based (for queries)
 * 2. requireAuthWithSession() - Full session validation (for mutations)
 *
 * @see https://labs.convex.dev/better-auth/basic-usage/authorization
 */
import { internal } from "@repo/backend/convex/_generated/api";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { authComponent } from "@repo/backend/convex/auth";
import { ConvexError } from "convex/values";

/**
 * Resolve the current app user from the JWT identity without enforcing auth.
 * Returns null when no identity is present or no matching app user exists.
 */
export async function getOptionalAppUserFromIdentity(
  ctx: QueryCtx | MutationCtx
) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.subject) {
    return null;
  }

  const appUser = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
    .unique();

  if (!(appUser && identity)) {
    return null;
  }

  return {
    appUser,
    identity,
  };
}

/**
 * Fast authentication using JWT identity.
 * Reads from JWT directly and resolves the app user by Better Auth user ID.
 *
 * Pros: ~700ms faster than session validation
 * Cons: Won't catch revoked sessions until JWT expires
 *
 * Best for: Read-only queries where speed matters
 */
export async function requireAuth(ctx: QueryCtx) {
  const user = await getOptionalAppUserFromIdentity(ctx);

  if (!user) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You must be logged in.",
    });
  }

  return user;
}

/**
 * Full authentication with session validation.
 * Validates session against database via Better Auth component.
 *
 * Pros: Catches revoked sessions immediately
 * Cons: ~700ms slower due to component overhead
 *
 * Best for: Mutations, sensitive operations, security-critical paths
 */
export async function requireAuthWithSession(ctx: MutationCtx) {
  const authUser = await authComponent.getAuthUser(ctx);
  const appUser = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
    .unique();

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
