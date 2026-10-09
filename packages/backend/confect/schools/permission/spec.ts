import { Record as Rec, Schema } from "effect";

/**
 * Role-based permission system.
 *
 * Defines permissions for school roles, class roles, and teacher roles.
 * Use requirePermission() to enforce access control in mutations.
 */

import type {
  SchoolClassMemberRole,
  SchoolClassTeacherRole,
} from "@repo/backend/confect/classes/role";
import type { SchoolMemberRole } from "@repo/backend/confect/schools/schema";

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
const PermissionSchema = Schema.Literals(Rec.values(PERMISSIONS));
export type Permission = typeof PermissionSchema.Type;

/** The stable access-control failure returned by school and class mutations. */
export class PermissionDenied extends Schema.TaggedError<PermissionDenied>()(
  "PermissionDenied",
  {
    code: Schema.Literal("FORBIDDEN"),
    message: Schema.String,
  }
) {}

/** The public code/message payload decodes to the domain's tagged failure. */

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
