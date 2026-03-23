/**
 * Authentication helpers for Convex functions.
 *
 * Two strategies:
 * 1. requireAuth() - Fast JWT-based (for queries)
 * 2. requireAuthWithSession() - Full session validation (for mutations)
 *
 * @see https://convex-better-auth.netlify.app/basic-usage/authorization
 */
import { internal } from "@repo/backend/convex/_generated/api";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { safeGetAppUser } from "@repo/backend/convex/auth";
import { ConvexError } from "convex/values";

/**
 * Resolve the current app user from the JWT identity without enforcing auth.
 * Returns null when no identity is present or no matching app user exists.
 */
export async function getOptionalAppUserFromIdentity(
  ctx: QueryCtx | MutationCtx
) {
  const identity = await ctx.auth.getUserIdentity();
  // In this Better Auth integration, Convex JWT `subject` carries the Better
  // Auth user ID. We persist that value on `users.authId` and resolve app users
  // from it for the fast JWT-backed read path.
  const authId = identity?.subject;

  if (!authId) {
    return null;
  }

  const appUser = await ctx.db
    .query("users")
    .withIndex("authId", (q) => q.eq("authId", authId))
    .unique();

  if (!appUser) {
    return null;
  }

  return {
    appUser,
    identity,
  };
}

/**
 * Fast authentication using JWT identity.
 * Reads from JWT directly and resolves the app user by stable auth ID.
 *
 * Pros: ~700ms faster than session validation
 * Cons: Won't catch revoked sessions until JWT expires
 *
 * Best for: Read-only queries where speed matters
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
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
export async function requireAuthWithSession(ctx: QueryCtx | MutationCtx) {
  const user = await safeGetAppUser(ctx);
  if (!user) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You must be logged in.",
    });
  }
  return user;
}

/**
 * Fast authentication for actions using JWT identity.
 */
export async function requireAuthForAction(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You must be logged in.",
    });
  }

  const appUser = await ctx.runQuery(internal.users.queries.getUserByAuthId, {
    authId: identity.subject,
  });

  if (!appUser) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found.",
    });
  }

  return { appUser, identity };
}
