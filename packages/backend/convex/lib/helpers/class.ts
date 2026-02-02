/**
 * Class access control helpers.
 *
 * Check and enforce class membership and access rights.
 */
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";
import { getSchoolMembership, isAdmin } from "./school";

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
 * Access granted if user is either:
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

  const hasAccess = classMembership !== null || isAdmin(schoolMembership);

  return { hasAccess, classMembership, schoolMembership };
}

/**
 * Require class access or throw.
 * Throws ACCESS_DENIED if user doesn't have access.
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
