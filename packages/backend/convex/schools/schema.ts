import { GenericId } from "@confect/core/GenericId";
import {
  compileSchema,
  compileTableSchema,
} from "@confect/core/SchemaToValidator";
import {
  schoolClassEnrollMethodValidator,
  schoolClassMemberRoleValidator,
  schoolClassTeacherRoleValidator,
} from "@repo/backend/convex/classes/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { Schema } from "effect";

/**
 * School type validator
 */
export const schoolTypeSchema = Schema.Literals([
  "elementary-school",
  "middle-school",
  "high-school",
  "vocational-school",
  "university",
  "other",
]);
export const schoolTypeValidator = compileSchema(schoolTypeSchema);

/**
 * School member role validator
 */
export const schoolMemberRoleSchema = Schema.Literals([
  "admin",
  "teacher",
  "student",
  "parent",
  "demo",
]);
export type SchoolMemberRole = typeof schoolMemberRoleSchema.Type;

/**
 * School member status validator
 */
const schoolMemberStatusSchema = Schema.Literals([
  "active",
  "invited",
  "removed",
]);

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
  role: compileSchema(schoolMemberRoleSchema),
  status: compileSchema(schoolMemberStatusSchema),
  invitedBy: v.optional(v.id("users")),
  invitedAt: v.optional(v.number()),
  inviteToken: v.optional(v.string()),
  inviteCodeId: v.optional(v.id("schoolInviteCodes")),
  updatedAt: v.number(),
  joinedAt: v.number(),
  removedBy: v.optional(v.id("users")),
  removedAt: v.optional(v.number()),
});

/** Activity fields shared by every operation-specific event. */
const activityFields = {
  schoolId: GenericId("schools"),
  userId: GenericId("users"),
  entityId: Schema.String,
  ipAddress: Schema.optionalKey(Schema.String),
  userAgent: Schema.optionalKey(Schema.String),
};

const classMemberRole = Schema.Literals(
  schoolClassMemberRoleValidator.members.map((member) => member.value)
);
const teacherRole = Schema.Literals(
  schoolClassTeacherRoleValidator.members.map((member) => member.value)
);
const enrollMethod = Schema.Literals(
  schoolClassEnrollMethodValidator.members.map((member) => member.value)
);

/** Couples an audit operation to its entity and exact metadata contract. */
export const schoolActivitySchema = Schema.Union([
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("school_created"),
    entityType: Schema.Literal("schools"),
    metadata: Schema.Struct({
      schoolName: Schema.String,
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("school_updated"),
    entityType: Schema.Literal("schools"),
    metadata: Schema.Struct({
      schoolName: Schema.String,
      oldName: Schema.optionalKey(Schema.String),
      newName: Schema.optionalKey(Schema.String),
      oldEmail: Schema.optionalKey(Schema.String),
      newEmail: Schema.optionalKey(Schema.String),
      oldPhone: Schema.optionalKey(Schema.String),
      newPhone: Schema.optionalKey(Schema.String),
      oldAddress: Schema.optionalKey(Schema.String),
      newAddress: Schema.optionalKey(Schema.String),
      oldCity: Schema.optionalKey(Schema.String),
      newCity: Schema.optionalKey(Schema.String),
      oldProvince: Schema.optionalKey(Schema.String),
      newProvince: Schema.optionalKey(Schema.String),
      oldType: Schema.optionalKey(schoolTypeSchema),
      newType: Schema.optionalKey(schoolTypeSchema),
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("school_deleted"),
    entityType: Schema.Literal("schools"),
    metadata: Schema.Struct({ schoolName: Schema.String }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("member_joined"),
    entityType: Schema.Literal("schoolMembers"),
    metadata: Schema.Struct({
      role: schoolMemberRoleSchema,
      joinedAt: Schema.Finite,
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("member_invited"),
    entityType: Schema.Literal("schoolMembers"),
    metadata: Schema.Struct({
      invitedUserId: Schema.String,
      role: schoolMemberRoleSchema,
      invitedAt: Schema.optionalKey(Schema.Finite),
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("member_removed"),
    entityType: Schema.Literal("schoolMembers"),
    metadata: Schema.Struct({
      removedUserId: Schema.String,
      role: schoolMemberRoleSchema,
      removedAt: Schema.optionalKey(Schema.Finite),
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("member_role_changed"),
    entityType: Schema.Literal("schoolMembers"),
    metadata: Schema.Struct({
      oldRole: schoolMemberRoleSchema,
      newRole: schoolMemberRoleSchema,
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literals(["class_created", "class_deleted"]),
    entityType: Schema.Literal("schoolClasses"),
    metadata: Schema.Struct({
      className: Schema.String,
      subject: Schema.String,
      year: Schema.String,
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("class_archived"),
    entityType: Schema.Literal("schoolClasses"),
    metadata: Schema.Struct({
      className: Schema.String,
      isArchived: Schema.Boolean,
      archivedAt: Schema.optionalKey(Schema.Finite),
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("class_updated"),
    entityType: Schema.Literal("schoolClasses"),
    metadata: Schema.Struct({
      className: Schema.String,
      oldName: Schema.optionalKey(Schema.String),
      newName: Schema.optionalKey(Schema.String),
      oldSubject: Schema.optionalKey(Schema.String),
      newSubject: Schema.optionalKey(Schema.String),
      oldYear: Schema.optionalKey(Schema.String),
      newYear: Schema.optionalKey(Schema.String),
      oldVisibility: Schema.optionalKey(Schema.String),
      newVisibility: Schema.optionalKey(Schema.String),
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("class_member_added"),
    entityType: Schema.Literal("schoolClassMembers"),
    metadata: Schema.Struct({
      classId: Schema.String,
      addedUserId: Schema.String,
      role: classMemberRole,
      teacherRole: Schema.optionalKey(teacherRole),
      enrollMethod: Schema.optionalKey(enrollMethod),
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("class_member_removed"),
    entityType: Schema.Literal("schoolClassMembers"),
    metadata: Schema.Struct({
      classId: Schema.String,
      removedUserId: Schema.String,
      role: classMemberRole,
      removedAt: Schema.optionalKey(Schema.Finite),
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("class_member_role_changed"),
    entityType: Schema.Literal("schoolClassMembers"),
    metadata: Schema.Struct({
      classId: Schema.String,
      oldRole: classMemberRole,
      newRole: classMemberRole,
    }),
  }),
  Schema.Struct({
    ...activityFields,
    action: Schema.Literal("class_member_teacher_role_changed"),
    entityType: Schema.Literal("schoolClassMembers"),
    metadata: Schema.Union([
      Schema.Struct({
        classId: Schema.String,
        oldTeacherRole: teacherRole,
        newTeacherRole: Schema.optionalKey(teacherRole),
      }),
      Schema.Struct({
        classId: Schema.String,
        oldTeacherRole: Schema.optionalKey(teacherRole),
        newTeacherRole: teacherRole,
      }),
    ]),
  }),
]);

const tables = {
  schools: defineTable(schoolValidator)
    .index("by_slug", ["slug"])
    .index("by_email", ["email"])
    .index("by_createdBy", ["createdBy"]),

  schoolMembers: defineTable(schoolMemberValidator)
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_schoolId_and_status", ["schoolId", "status"])
    .index("by_schoolId_and_userId_and_status", [
      "schoolId",
      "userId",
      "status",
    ]),

  schoolInviteCodes: defineTable({
    schoolId: v.id("schools"),
    role: compileSchema(schoolMemberRoleSchema),
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

  schoolActivityLogs: defineTable(compileTableSchema(schoolActivitySchema))
    .index("by_schoolId", ["schoolId"])
    .index("by_userId", ["userId"])
    .index("by_metadata_invitedUserId", ["metadata.invitedUserId"])
    .index("by_metadata_addedUserId", ["metadata.addedUserId"])
    .index("by_metadata_removedUserId", ["metadata.removedUserId"]),
};

export default tables;
