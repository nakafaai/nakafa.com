/**
 * Role-based permission system.
 *
 * Defines permissions for school roles, class roles, and teacher roles.
 * Use requirePermission() to enforce access control in mutations.
 */
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ConvexError } from "convex/values";

type SchoolRole = "admin" | "teacher" | "student" | "parent" | "demo";
type ClassRole = "teacher" | "student";
type TeacherRole = "primary" | "co-teacher" | "assistant";

export type Permission =
  | "class:create"
  | "class:read"
  | "class:write"
  | "class:delete"
  | "member:add"
  | "member:remove"
  | "content:create"
  | "content:read"
  | "content:edit"
  | "content:delete"
  | "forum:read"
  | "forum:write"
  | "forum:moderate";

export const PERMISSIONS = {
  CLASS_CREATE: "class:create",
  CLASS_READ: "class:read",
  CLASS_WRITE: "class:write",
  CLASS_DELETE: "class:delete",
  MEMBER_ADD: "member:add",
  MEMBER_REMOVE: "member:remove",
  CONTENT_CREATE: "content:create",
  CONTENT_READ: "content:read",
  CONTENT_EDIT: "content:edit",
  CONTENT_DELETE: "content:delete",
  FORUM_READ: "forum:read",
  FORUM_WRITE: "forum:write",
  FORUM_MODERATE: "forum:moderate",
} as const;

export const ROLE_PERMISSIONS: Record<
  SchoolRole | ClassRole | TeacherRole,
  Permission[]
> = {
  admin: [
    "class:create",
    "class:read",
    "class:write",
    "class:delete",
    "member:add",
    "member:remove",
    "content:create",
    "content:read",
    "content:edit",
    "content:delete",
    "forum:read",
    "forum:write",
    "forum:moderate",
  ],
  teacher: [
    "class:create",
    "class:read",
    "class:write",
    "content:create",
    "content:read",
    "content:edit",
    "forum:read",
    "forum:write",
  ],
  student: ["class:read", "content:read", "forum:read"],
  parent: ["class:read", "content:read"],
  demo: [
    "class:create",
    "class:read",
    "class:write",
    "class:delete",
    "member:add",
    "member:remove",
    "content:create",
    "content:read",
    "content:edit",
    "content:delete",
    "forum:read",
    "forum:write",
    "forum:moderate",
  ],
  "co-teacher": ["content:delete"],
  assistant: ["forum:moderate"],
  primary: [
    "class:delete",
    "member:remove",
    "content:delete",
    "forum:moderate",
  ],
};

/**
 * Check if user has a specific permission.
 * Checks both school-level and class-level roles.
 * Internal helper - use requirePermission for public API.
 */
async function checkPermission(
  ctx: QueryCtx | MutationCtx,
  permission: Permission,
  options: {
    userId: Id<"users">;
    schoolId?: Id<"schools">;
    classId?: Id<"schoolClasses">;
  }
): Promise<boolean> {
  const { userId, schoolId, classId } = options;

  if (schoolId) {
    const schoolMember = await ctx.db
      .query("schoolMembers")
      .withIndex("schoolId_userId_status", (q) =>
        q.eq("schoolId", schoolId).eq("userId", userId).eq("status", "active")
      )
      .unique();

    if (schoolMember) {
      const schoolPerms = ROLE_PERMISSIONS[schoolMember.role] ?? [];
      if (schoolPerms.includes(permission)) {
        return true;
      }
    }
  }

  if (classId) {
    const classMember = await ctx.db
      .query("schoolClassMembers")
      .withIndex("classId_userId", (q) =>
        q.eq("classId", classId).eq("userId", userId)
      )
      .unique();

    if (classMember) {
      const classPerms = ROLE_PERMISSIONS[classMember.role] ?? [];
      if (classPerms.includes(permission)) {
        return true;
      }

      if (classMember.role === "teacher" && classMember.teacherRole) {
        const teacherPerms = ROLE_PERMISSIONS[classMember.teacherRole] ?? [];
        if (teacherPerms.includes(permission)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Require permission or throw.
 * Throws FORBIDDEN if user lacks the required permission.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: Permission,
  options: {
    userId: Id<"users">;
    schoolId?: Id<"schools">;
    classId?: Id<"schoolClasses">;
  }
): Promise<void> {
  const hasPerms = await checkPermission(ctx, permission, options);
  if (!hasPerms) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Permission '${permission}' required`,
    });
  }
}
