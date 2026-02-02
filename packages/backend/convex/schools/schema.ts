import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * School type validator
 */
export const schoolTypeValidator = v.union(
  v.literal("elementary-school"),
  v.literal("middle-school"),
  v.literal("high-school"),
  v.literal("vocational-school"),
  v.literal("university"),
  v.literal("other")
);
export type SchoolType = Infer<typeof schoolTypeValidator>;

/**
 * School member role validator
 */
export const schoolMemberRoleValidator = v.union(
  v.literal("admin"),
  v.literal("teacher"),
  v.literal("student"),
  v.literal("parent"),
  v.literal("demo")
);
export type SchoolMemberRole = Infer<typeof schoolMemberRoleValidator>;

/**
 * School member status validator
 */
export const schoolMemberStatusValidator = v.union(
  v.literal("active"),
  v.literal("invited"),
  v.literal("removed")
);
export type SchoolMemberStatus = Infer<typeof schoolMemberStatusValidator>;

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
 * School document validator (with system fields)
 */
export const schoolDocValidator = schoolValidator.extend({
  _id: v.id("schools"),
  _creationTime: v.number(),
});
export type SchoolDoc = Infer<typeof schoolDocValidator>;

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
 * School member document validator (with system fields)
 */
export const schoolMemberDocValidator = schoolMemberValidator.extend({
  _id: v.id("schoolMembers"),
  _creationTime: v.number(),
});
export type SchoolMemberDoc = Infer<typeof schoolMemberDocValidator>;

/**
 * Parent-student relationship validator
 */
export const parentStudentRelationshipValidator = v.union(
  v.literal("father"),
  v.literal("mother"),
  v.literal("guardian"),
  v.literal("other")
);

/**
 * Parent-student status validator
 */
export const parentStudentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("inactive")
);

/**
 * School activity action validator
 */
export const schoolActivityActionValidator = v.union(
  v.literal("school_created"),
  v.literal("school_updated"),
  v.literal("school_deleted"),
  v.literal("school_code_regenerated"),
  v.literal("member_invited"),
  v.literal("member_joined"),
  v.literal("member_removed"),
  v.literal("member_role_changed"),
  v.literal("class_created"),
  v.literal("class_updated"),
  v.literal("class_archived"),
  v.literal("class_deleted"),
  v.literal("class_code_regenerated"),
  v.literal("class_member_added"),
  v.literal("class_member_removed"),
  v.literal("class_member_role_changed"),
  v.literal("class_member_permissions_changed"),
  v.literal("parent_linked"),
  v.literal("parent_unlinked"),
  v.literal("parent_permissions_changed"),
  v.literal("assignment_created"),
  v.literal("assignment_updated"),
  v.literal("assignment_deleted"),
  v.literal("assignment_published"),
  v.literal("progress_updated"),
  v.literal("assignment_completed")
);

/**
 * School activity entity type validator
 */
export const schoolActivityEntityTypeValidator = v.union(
  v.literal("schools"),
  v.literal("schoolMembers"),
  v.literal("classes"),
  v.literal("classMembers"),
  v.literal("parentStudents"),
  v.literal("assignments"),
  v.literal("progresses")
);

/**
 * Activity log metadata validator.
 * Uses v.any() because metadata varies by action type (polymorphic):
 * - member_role_changed: { oldRole, newRole }
 * - member_invited: { email, role }
 * - class_created: { className, subject }
 * - etc.
 * Full typing would require discriminated unions per action type.
 */
const activityMetadataValidator = v.optional(v.any());

const tables = {
  schools: defineTable(schoolValidator)
    .index("slug", ["slug"])
    .index("createdBy", ["createdBy"])
    .index("email", ["email"]),

  schoolMembers: defineTable(schoolMemberValidator)
    .index("schoolId", ["schoolId"])
    .index("userId", ["userId"])
    .index("userId_status", ["userId", "status"])
    .index("schoolId_role", ["schoolId", "role"])
    .index("schoolId_userId", ["schoolId", "userId"])
    .index("schoolId_userId_status", ["schoolId", "userId", "status"])
    .index("schoolId_status", ["schoolId", "status"])
    .index("inviteToken", ["inviteToken"]),

  schoolParentStudents: defineTable({
    parentId: v.id("users"),
    studentId: v.id("users"),
    schoolId: v.id("schools"),
    relationship: parentStudentRelationshipValidator,
    permissions: v.array(v.string()),
    status: parentStudentStatusValidator,
    verifiedEmail: v.optional(v.string()),
    verifiedPhone: v.optional(v.string()),
    updatedAt: v.number(),
    verifiedAt: v.optional(v.number()),
    verifiedBy: v.optional(v.id("users")),
  })
    .index("parentId", ["parentId"])
    .index("studentId", ["studentId"])
    .index("parentId_studentId", ["parentId", "studentId"])
    .index("schoolId", ["schoolId"])
    .index("status", ["status"]),

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
  })
    .index("schoolId", ["schoolId"])
    .index("schoolId_role", ["schoolId", "role"])
    .index("code", ["code"])
    .index("schoolId_code", ["schoolId", "code"])
    .index("schoolId_enabled", ["schoolId", "enabled"]),

  schoolActivityLogs: defineTable({
    schoolId: v.id("schools"),
    userId: v.id("users"),
    action: schoolActivityActionValidator,
    entityType: schoolActivityEntityTypeValidator,
    entityId: v.string(),
    metadata: activityMetadataValidator,
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("schoolId", ["schoolId"])
    .index("userId", ["userId"])
    .index("action", ["action"])
    .index("entityType_entityId", ["entityType", "entityId"]),
};

export default tables;
