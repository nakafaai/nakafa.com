/**
 * Centralized Auth Helpers
 *
 * Authentication and authorization patterns used across queries and mutations.
 */

import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { safeGetAppUser } from "../auth";

/**
 * Require authentication.
 * Throws UNAUTHORIZED error if user is not logged in.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
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
    ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q.eq("schoolId", schoolId).eq("userId", userId).eq("status", "active")
      )
      .unique(),
    ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (q) =>
        q.eq("classId", classId).eq("userId", userId)
      )
      .unique(),
  ]);

  const hasAccess =
    classMembership !== null || schoolMembership?.role === "admin";

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
