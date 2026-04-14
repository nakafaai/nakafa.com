import {
  schoolClassEnrollMethodValidator,
  schoolClassMemberRoleValidator,
  schoolClassTeacherRoleValidator,
} from "@repo/backend/convex/classes/schema";
import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * School type validator
 */
export const schoolTypeValidator = literals(
  "elementary-school",
  "middle-school",
  "high-school",
  "vocational-school",
  "university",
  "other"
);

/**
 * School member role validator
 */
export const schoolMemberRoleValidator = literals(
  "admin",
  "teacher",
  "student",
  "parent",
  "demo"
);
export type SchoolMemberRole = Infer<typeof schoolMemberRoleValidator>;

/**
 * School member status validator
 */
export const schoolMemberStatusValidator = literals(
  "active",
  "invited",
  "removed"
);

/**
 * School base validator (without system fields)
 */
export const schoolValidator = v.object({
  name: v.string(),
  slug: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  city: v.string(),
  province: v.string(),
  type: schoolTypeValidator,
  currentStudents: v.number(),
  currentTeachers: v.number(),
  updatedAt: v.number(),
  createdBy: v.id("users"),
  updatedBy: v.optional(v.id("users")),
});

/**
 * School member base validator (without system fields)
 */
export const schoolMemberValidator = v.object({
  schoolId: v.id("schools"),
  userId: v.id("users"),
  role: schoolMemberRoleValidator,
  status: schoolMemberStatusValidator,
  invitedBy: v.optional(v.id("users")),
  invitedAt: v.optional(v.number()),
  inviteToken: v.optional(v.string()),
  inviteCodeId: v.optional(v.id("schoolInviteCodes")),
  updatedAt: v.number(),
  joinedAt: v.number(),
  removedBy: v.optional(v.id("users")),
  removedAt: v.optional(v.number()),
});

/**
 * School activity action validator
 */
export const schoolActivityActionValidator = literals(
  "school_created",
  "school_updated",
  "school_deleted",
  "member_invited",
  "member_joined",
  "member_removed",
  "member_role_changed",
  "class_created",
  "class_updated",
  "class_archived",
  "class_deleted",
  "class_member_added",
  "class_member_removed",
  "class_member_role_changed"
);

/**
 * School activity entity type validator.
 */
export const schoolActivityEntityTypeValidator = literals(
  "schools",
  "schoolMembers",
  "schoolClasses",
  "schoolClassMembers"
);

const schoolRoleMetadataValidator = v.object({
  role: schoolMemberRoleValidator,
});

const classRoleMetadataValidator = v.object({
  role: schoolClassMemberRoleValidator,
});

const schoolActivityMetadataValidator = v.optional(
  v.union(
    v.object({
      schoolName: v.string(),
      memberId: v.optional(v.string()),
    }),
    v.object({
      schoolName: v.string(),
    }),
    v.object({
      schoolName: v.string(),
      oldName: v.optional(v.string()),
      newName: v.optional(v.string()),
      oldEmail: v.optional(v.string()),
      newEmail: v.optional(v.string()),
      oldPhone: v.optional(v.string()),
      newPhone: v.optional(v.string()),
      oldAddress: v.optional(v.string()),
      newAddress: v.optional(v.string()),
      oldCity: v.optional(v.string()),
      newCity: v.optional(v.string()),
      oldProvince: v.optional(v.string()),
      newProvince: v.optional(v.string()),
      oldType: v.optional(schoolTypeValidator),
      newType: v.optional(schoolTypeValidator),
    }),
    v.object({
      ...schoolRoleMetadataValidator.fields,
      joinedAt: v.number(),
    }),
    v.object({
      invitedUserId: v.string(),
      ...schoolRoleMetadataValidator.fields,
      invitedAt: v.optional(v.number()),
    }),
    v.object({
      oldRole: schoolMemberRoleValidator,
      newRole: schoolMemberRoleValidator,
    }),
    v.object({
      removedUserId: v.string(),
      ...schoolRoleMetadataValidator.fields,
      removedAt: v.optional(v.number()),
    }),
    v.object({
      className: v.string(),
      subject: v.string(),
      year: v.string(),
    }),
    v.object({
      className: v.string(),
      isArchived: v.boolean(),
      archivedAt: v.optional(v.number()),
    }),
    v.object({
      className: v.string(),
      oldName: v.optional(v.string()),
      newName: v.optional(v.string()),
      oldSubject: v.optional(v.string()),
      newSubject: v.optional(v.string()),
      oldYear: v.optional(v.string()),
      newYear: v.optional(v.string()),
      oldVisibility: v.optional(v.string()),
      newVisibility: v.optional(v.string()),
    }),
    v.object({
      classId: v.string(),
      addedUserId: v.string(),
      ...classRoleMetadataValidator.fields,
      teacherRole: schoolClassTeacherRoleValidator,
      enrollMethod: schoolClassEnrollMethodValidator,
    }),
    v.object({
      classId: v.string(),
      oldRole: schoolClassMemberRoleValidator,
      newRole: schoolClassMemberRoleValidator,
    }),
    v.object({
      classId: v.string(),
      oldTeacherRole: schoolClassTeacherRoleValidator,
      newTeacherRole: schoolClassTeacherRoleValidator,
    }),
    v.object({
      classId: v.string(),
      removedUserId: v.string(),
      ...classRoleMetadataValidator.fields,
      removedAt: v.optional(v.number()),
    })
  )
);

const tables = {
  schools: defineTable(schoolValidator)
    .index("by_slug", ["slug"])
    .index("by_email", ["email"]),

  schoolMembers: defineTable(schoolMemberValidator)
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_schoolId_and_userId_and_status", [
      "schoolId",
      "userId",
      "status",
    ]),

  schoolInviteCodes: defineTable({
    schoolId: v.id("schools"),
    role: schoolMemberRoleValidator,
    code: v.string(),
    enabled: v.boolean(),
    expiresAt: v.optional(v.number()),
    maxUsage: v.optional(v.number()),
    currentUsage: v.number(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),

  schoolActivityLogs: defineTable({
    schoolId: v.id("schools"),
    userId: v.id("users"),
    action: schoolActivityActionValidator,
    entityType: schoolActivityEntityTypeValidator,
    entityId: v.string(),
    metadata: schoolActivityMetadataValidator,
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_schoolId", ["schoolId"]),
};

export default tables;
