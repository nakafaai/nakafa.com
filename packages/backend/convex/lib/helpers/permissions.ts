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
import type {
  SchoolClassMemberRole,
  SchoolClassTeacherRole,
} from "@repo/backend/convex/classes/schema";
import type { SchoolMemberRole } from "@repo/backend/convex/schools/schema";
import { Effect, Schema } from "effect";

type SchoolRole = SchoolMemberRole;
type ClassRole = SchoolClassMemberRole;
type TeacherRole = SchoolClassTeacherRole;

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

const PermissionSchema = Schema.Literals(Object.values(PERMISSIONS));
export type Permission = Schema.Schema.Type<typeof PermissionSchema>;

/** The stable access-control failure returned by school and class mutations. */
export class PermissionDenied extends Schema.TaggedError<PermissionDenied>()(
  "PermissionDenied",
  {
    code: Schema.Literal("FORBIDDEN"),
    message: Schema.String,
  }
) {}

interface PermissionTarget {
  readonly classId?: Id<"schoolClasses">;
  readonly schoolId?: Id<"schools">;
  readonly userId: Id<"users">;
}

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

/** Checks school grants before class grants and teacher-specific additions. */
const checkPermission = Effect.fn("permissions.check")(function* (
  ctx: QueryCtx | MutationCtx,
  permission: Permission,
  { userId, schoolId, classId }: PermissionTarget
) {
  if (schoolId) {
    const schoolMember = yield* Effect.promise(() =>
      ctx.db
        .query("schoolMembers")
        .withIndex("by_schoolId_and_userId_and_status", (query) =>
          query
            .eq("schoolId", schoolId)
            .eq("userId", userId)
            .eq("status", "active")
        )
        .unique()
    );
    if (
      schoolMember &&
      ROLE_PERMISSIONS[schoolMember.role].includes(permission)
    ) {
      return true;
    }
  }
  if (!classId) {
    return false;
  }
  const classMember = yield* Effect.promise(() =>
    ctx.db
      .query("schoolClassMembers")
      .withIndex("by_classId_and_userId", (query) =>
        query.eq("classId", classId).eq("userId", userId)
      )
      .unique()
  );
  if (!classMember) {
    return false;
  }
  if (ROLE_PERMISSIONS[classMember.role].includes(permission)) {
    return true;
  }
  if (classMember.role !== "teacher" || !classMember.teacherRole) {
    return false;
  }
  return ROLE_PERMISSIONS[classMember.teacherRole].includes(permission);
});

/** Requires an explicit school or class grant using the existing FORBIDDEN contract. */
export const requirePermission = Effect.fn("permissions.require")(function* (
  ctx: QueryCtx | MutationCtx,
  permission: Permission,
  target: PermissionTarget
) {
  if (!(yield* checkPermission(ctx, permission, target))) {
    return yield* new PermissionDenied({
      code: "FORBIDDEN",
      message: `Permission '${permission}' required`,
    });
  }
});
