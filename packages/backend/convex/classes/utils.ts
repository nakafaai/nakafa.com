import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isSchoolAdmin } from "../lib/authHelpers";
import { getUserMap } from "../lib/userHelpers";
import type { TeacherPermission } from "./constants";

// ============================================================================
// User Helpers
// ============================================================================

export function attachForumUsers(
  ctx: QueryCtx,
  forums: Doc<"schoolClassForums">[]
) {
  return getUserMap(
    ctx,
    forums.map((f) => f.createdBy)
  );
}

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if a teacher has a specific permission.
 * School admins automatically have all permissions.
 */
export function hasTeacherPermission(
  classMembership: Doc<"schoolClassMembers"> | null,
  schoolMembership: Doc<"schoolMembers"> | null,
  permission: TeacherPermission
): boolean {
  // School admins have all permissions
  if (isSchoolAdmin(schoolMembership)) {
    return true;
  }

  // Check if user is a teacher with the required permission
  if (
    classMembership?.role === "teacher" &&
    classMembership.teacherPermissions?.includes(permission)
  ) {
    return true;
  }

  return false;
}

/**
 * Require a specific teacher permission.
 * Throws FORBIDDEN error if user doesn't have the permission.
 */
export function requireTeacherPermission(
  classMembership: Doc<"schoolClassMembers"> | null,
  schoolMembership: Doc<"schoolMembers"> | null,
  permission: TeacherPermission
): void {
  if (!hasTeacherPermission(classMembership, schoolMembership, permission)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
  }
}

// ============================================================================
// Class Loading Helpers
// ============================================================================

/**
 * Load a class by ID.
 * Throws CLASS_NOT_FOUND error if class doesn't exist.
 */
export async function loadClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">
) {
  const classData = await ctx.db.get("schoolClasses", classId);

  if (!classData) {
    throw new ConvexError({
      code: "CLASS_NOT_FOUND",
      message: "Class not found.",
    });
  }

  return classData;
}

/**
 * Load a class and validate it's not archived.
 * Throws CLASS_NOT_FOUND or CLASS_ARCHIVED error.
 */
export async function loadActiveClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">
) {
  const classData = await loadClass(ctx, classId);

  if (classData.isArchived) {
    throw new ConvexError({
      code: "CLASS_ARCHIVED",
      message: "Cannot modify an archived class.",
    });
  }

  return classData;
}
