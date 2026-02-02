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
 * Fast authentication using JWT identity.
 * Reads from JWT directly - no database call for session.
 *
 * Pros: ~700ms faster than session validation
 * Cons: Won't catch revoked sessions until JWT expires
 *
 * Best for: Read-only queries where speed matters
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  const email = identity?.email;
  if (!email) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You must be logged in.",
    });
  }

  const appUser = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();

  if (!appUser) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found.",
    });
  }

  return { appUser, identity };
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
 * Actions don't have ctx.db, so uses runQuery instead.
 */
export async function requireAuthForAction(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "You must be logged in.",
    });
  }

  const appUser = await ctx.runQuery(internal.users.queries.getUserByEmail, {
    email: identity.email,
  });

  if (!appUser) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found.",
    });
  }

  return { appUser, identity };
}
