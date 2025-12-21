import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isSchoolAdmin, requireClassAccess } from "../lib/authHelpers";
import type { TeacherPermission } from "./constants";

/**
 * Check if user has a specific teacher permission.
 * School admins automatically have all permissions.
 */
export function hasTeacherPermission(
  classMembership: Doc<"schoolClassMembers"> | null,
  schoolMembership: Doc<"schoolMembers"> | null,
  permission: TeacherPermission
): boolean {
  if (isSchoolAdmin(schoolMembership)) {
    return true;
  }

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
 * @throws FORBIDDEN if user lacks the permission.
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

/**
 * Load a class by ID.
 * @throws CLASS_NOT_FOUND if class doesn't exist.
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
 * @throws CLASS_NOT_FOUND or CLASS_ARCHIVED.
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

/**
 * Load class and verify user has access (member or school admin).
 * Returns class data with membership info.
 * @throws CLASS_NOT_FOUND or ACCESS_DENIED.
 */
export async function loadClassWithAccess(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  const classData = await loadClass(ctx, classId);
  const access = await requireClassAccess(
    ctx,
    classId,
    classData.schoolId,
    userId
  );
  return { classData, ...access };
}

/**
 * Load active (non-archived) class and verify user has access.
 * Returns class data with membership info.
 * @throws CLASS_NOT_FOUND, CLASS_ARCHIVED, or ACCESS_DENIED.
 */
export async function loadActiveClassWithAccess(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"schoolClasses">,
  userId: Id<"users">
) {
  const classData = await loadActiveClass(ctx, classId);
  const access = await requireClassAccess(
    ctx,
    classId,
    classData.schoolId,
    userId
  );
  return { classData, ...access };
}
