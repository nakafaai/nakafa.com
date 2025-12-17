/**
 * Centralized Auth Helpers
 *
 * Authentication and authorization patterns used across queries and mutations.
 *
 * Two auth strategies:
 * 1. requireAuth() - Fast, uses JWT identity (for queries)
 * 2. requireAuthWithSession() - Full session validation (for mutations)
 *
 * @see https://convex-better-auth.netlify.app/basic-usage/authorization
 */

import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { safeGetAppUser } from "../auth";

// ============================================================================
// Authentication
// ============================================================================

/**
 * Fast authentication using JWT identity.
 * Uses ctx.auth.getUserIdentity() which reads from JWT directly.
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
 * Uses Better Auth component to validate session against database.
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

// ============================================================================
// School Membership Helpers
// ============================================================================

/**
 * Check if user is a school admin.
 * Admin can do anything in their school.
 */
export function isSchoolAdmin(
  membership: Doc<"schoolMembers"> | null | undefined
): boolean {
  return membership?.role === "admin";
}

/**
 * Get active school membership for a user.
 * Returns null if user is not a member.
 */
export async function getSchoolMembership(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return await ctx.db
    .query("schoolMembers")
    .withIndex("schoolId_userId_status", (q) =>
      q.eq("schoolId", schoolId).eq("userId", userId).eq("status", "active")
    )
    .unique();
}

/**
 * Require active school membership.
 * Throws ACCESS_DENIED error if user is not a member.
 */
export async function requireSchoolMembership(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  const membership = await getSchoolMembership(ctx, schoolId, userId);
  if (!membership) {
    throw new ConvexError({
      code: "ACCESS_DENIED",
      message: "You must be a member of this school.",
    });
  }
  return membership;
}

// ============================================================================
// Class Access Helpers
// ============================================================================

/**
 * Get class membership for a user.
 * Returns null if user is not a class member.
 */
export async function getClassMembership(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  return await ctx.db
    .query("schoolClassMembers")
    .withIndex("classId_userId", (q) =>
      q.eq("classId", classId).eq("userId", userId)
    )
    .unique();
}

/**
 * Check if user has access to a class.
 * Access is granted if user is either:
 * 1. A direct class member (teacher/student)
 * 2. A school admin (can access all classes in their school)
 */
export async function checkClassAccess(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  const [schoolMembership, classMembership] = await Promise.all([
    getSchoolMembership(ctx, schoolId, userId),
    getClassMembership(ctx, classId, userId),
  ]);

  const hasAccess = classMembership !== null || isSchoolAdmin(schoolMembership);

  return { hasAccess, classMembership, schoolMembership };
}

/**
 * Require class access.
 * Throws ACCESS_DENIED error if user doesn't have access.
 */
export async function requireClassAccess(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  const { hasAccess, classMembership, schoolMembership } =
    await checkClassAccess(ctx, classId, schoolId, userId);

  if (!schoolMembership) {
    throw new ConvexError({
      code: "ACCESS_DENIED",
      message: "You must be a member of this school to access this class.",
    });
  }

  if (!hasAccess) {
    throw new ConvexError({
      code: "ACCESS_DENIED",
      message: "You do not have access to this class.",
    });
  }

  return { classMembership, schoolMembership };
}

// ============================================================================
// Chat Access Helpers
// ============================================================================

/**
 * Require chat access.
 * Throws FORBIDDEN error if user doesn't have access to private chat.
 */
export function requireChatAccess(
  chatUserId: Id<"users">,
  currentUserId: Id<"users">,
  visibility: "public" | "private"
) {
  if (visibility === "private" && chatUserId !== currentUserId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this private chat.",
    });
  }
}
