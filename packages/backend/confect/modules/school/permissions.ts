import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { Schema } from "effect";

export const permissionSchema = Schema.Literal(
  "class:create",
  "class:read",
  "class:write",
  "class:delete",
  "assessment:create",
  "assessment:update",
  "assessment:publish",
  "assessment:delete",
  "assessment:monitor",
  "assessment:grade",
  "assessment:release",
  "member:add",
  "member:remove",
  "content:create",
  "content:read",
  "content:edit",
  "content:delete",
  "forum:read",
  "forum:write",
  "forum:moderate"
);

export type Permission = Schema.Schema.Type<typeof permissionSchema>;

/** Permission names used by school and class role checks. */
export const PERMISSIONS = {
  CLASS_CREATE: "class:create",
  CLASS_READ: "class:read",
  CLASS_WRITE: "class:write",
  CLASS_DELETE: "class:delete",
  ASSESSMENT_CREATE: "assessment:create",
  ASSESSMENT_UPDATE: "assessment:update",
  ASSESSMENT_PUBLISH: "assessment:publish",
  ASSESSMENT_DELETE: "assessment:delete",
  ASSESSMENT_MONITOR: "assessment:monitor",
  ASSESSMENT_GRADE: "assessment:grade",
  ASSESSMENT_RELEASE: "assessment:release",
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

export const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.CLASS_CREATE,
    PERMISSIONS.CLASS_READ,
    PERMISSIONS.CLASS_WRITE,
    PERMISSIONS.CLASS_DELETE,
    PERMISSIONS.ASSESSMENT_CREATE,
    PERMISSIONS.ASSESSMENT_UPDATE,
    PERMISSIONS.ASSESSMENT_PUBLISH,
    PERMISSIONS.ASSESSMENT_DELETE,
    PERMISSIONS.ASSESSMENT_MONITOR,
    PERMISSIONS.ASSESSMENT_GRADE,
    PERMISSIONS.ASSESSMENT_RELEASE,
    PERMISSIONS.MEMBER_ADD,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_EDIT,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.FORUM_READ,
    PERMISSIONS.FORUM_WRITE,
    PERMISSIONS.FORUM_MODERATE,
  ],
  teacher: [
    PERMISSIONS.CLASS_CREATE,
    PERMISSIONS.CLASS_READ,
    PERMISSIONS.CLASS_WRITE,
    PERMISSIONS.ASSESSMENT_CREATE,
    PERMISSIONS.ASSESSMENT_UPDATE,
    PERMISSIONS.ASSESSMENT_PUBLISH,
    PERMISSIONS.ASSESSMENT_DELETE,
    PERMISSIONS.ASSESSMENT_MONITOR,
    PERMISSIONS.ASSESSMENT_GRADE,
    PERMISSIONS.ASSESSMENT_RELEASE,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_EDIT,
    PERMISSIONS.FORUM_READ,
    PERMISSIONS.FORUM_WRITE,
  ],
  student: [
    PERMISSIONS.CLASS_READ,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.FORUM_READ,
  ],
  parent: [PERMISSIONS.CLASS_READ, PERMISSIONS.CONTENT_READ],
  demo: [
    PERMISSIONS.CLASS_CREATE,
    PERMISSIONS.CLASS_READ,
    PERMISSIONS.CLASS_WRITE,
    PERMISSIONS.CLASS_DELETE,
    PERMISSIONS.ASSESSMENT_CREATE,
    PERMISSIONS.ASSESSMENT_UPDATE,
    PERMISSIONS.ASSESSMENT_PUBLISH,
    PERMISSIONS.ASSESSMENT_DELETE,
    PERMISSIONS.ASSESSMENT_MONITOR,
    PERMISSIONS.ASSESSMENT_GRADE,
    PERMISSIONS.ASSESSMENT_RELEASE,
    PERMISSIONS.MEMBER_ADD,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_READ,
    PERMISSIONS.CONTENT_EDIT,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.FORUM_READ,
    PERMISSIONS.FORUM_WRITE,
    PERMISSIONS.FORUM_MODERATE,
  ],
  "co-teacher": [
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.ASSESSMENT_GRADE,
    PERMISSIONS.ASSESSMENT_MONITOR,
  ],
  assistant: [PERMISSIONS.FORUM_MODERATE],
  primary: [
    PERMISSIONS.CLASS_DELETE,
    PERMISSIONS.MEMBER_REMOVE,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.ASSESSMENT_DELETE,
    PERMISSIONS.FORUM_MODERATE,
  ],
} as const;

/** Checks a role permission list without leaking narrow tuple types to callers. */
export function roleHasPermission(
  role: keyof typeof ROLE_PERMISSIONS | undefined,
  permission: Permission
) {
  if (role === undefined) {
    return false;
  }

  const permissions: readonly Permission[] = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

export interface PermissionScope {
  readonly classId?: Id<"schoolClasses">;
  readonly schoolId?: Id<"schools">;
  readonly userId: Id<"users">;
}
