import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  schoolClassEnrollMethodSchema,
  schoolClassMemberRoleSchema,
  schoolClassTeacherRoleSchema,
} from "@repo/backend/confect/modules/school/classes.tables";
import { Schema } from "effect";

/**
 * School type validator
 */
export const schoolTypeSchema = Schema.Literal(
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
export const schoolMemberRoleSchema = Schema.Literal(
  "admin",
  "teacher",
  "student",
  "parent",
  "demo"
);

export type SchoolMemberRole = Schema.Schema.Type<
  typeof schoolMemberRoleSchema
>;

/**
 * School member status validator
 */
export const schoolMemberStatusSchema = Schema.Literal(
  "active",
  "invited",
  "removed"
);

/**
 * School base validator (without system fields)
 */
export const schoolSchema = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
  email: Schema.String,
  phone: Schema.optional(Schema.String),
  address: Schema.optional(Schema.String),
  city: Schema.String,
  province: Schema.String,
  type: schoolTypeSchema,
  currentStudents: Schema.Number,
  currentTeachers: Schema.Number,
  updatedAt: Schema.Number,
  createdBy: GenericId.GenericId("users"),
  updatedBy: Schema.optional(GenericId.GenericId("users")),
});

/**
 * School member base validator (without system fields)
 */
export const schoolMemberSchema = Schema.Struct({
  schoolId: GenericId.GenericId("schools"),
  userId: GenericId.GenericId("users"),
  role: schoolMemberRoleSchema,
  status: schoolMemberStatusSchema,
  invitedBy: Schema.optional(GenericId.GenericId("users")),
  invitedAt: Schema.optional(Schema.Number),
  inviteToken: Schema.optional(Schema.String),
  inviteCodeId: Schema.optional(GenericId.GenericId("schoolInviteCodes")),
  updatedAt: Schema.Number,
  joinedAt: Schema.Number,
  removedBy: Schema.optional(GenericId.GenericId("users")),
  removedAt: Schema.optional(Schema.Number),
});

/**
 * School activity action validator
 */
export const schoolActivityActionSchema = Schema.Literal(
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
export const schoolActivityEntityTypeSchema = Schema.Literal(
  "schools",
  "schoolMembers",
  "schoolClasses",
  "schoolClassMembers"
);

const schoolRoleMetadataSchema = Schema.Struct({
  role: schoolMemberRoleSchema,
});

const classRoleMetadataSchema = Schema.Struct({
  role: schoolClassMemberRoleSchema,
});

const schoolActivityMetadataSchema = Schema.optional(
  Schema.Union(
    Schema.Struct({
      schoolName: Schema.String,
      memberId: Schema.optional(Schema.String),
    }),
    Schema.Struct({ schoolName: Schema.String }),
    Schema.Struct({
      schoolName: Schema.String,
      oldName: Schema.optional(Schema.String),
      newName: Schema.optional(Schema.String),
      oldEmail: Schema.optional(Schema.String),
      newEmail: Schema.optional(Schema.String),
      oldPhone: Schema.optional(Schema.String),
      newPhone: Schema.optional(Schema.String),
      oldAddress: Schema.optional(Schema.String),
      newAddress: Schema.optional(Schema.String),
      oldCity: Schema.optional(Schema.String),
      newCity: Schema.optional(Schema.String),
      oldProvince: Schema.optional(Schema.String),
      newProvince: Schema.optional(Schema.String),
      oldType: Schema.optional(schoolTypeSchema),
      newType: Schema.optional(schoolTypeSchema),
    }),
    Schema.Struct({
      ...schoolRoleMetadataSchema.fields,
      joinedAt: Schema.Number,
    }),
    Schema.Struct({
      invitedUserId: Schema.String,
      ...schoolRoleMetadataSchema.fields,
      invitedAt: Schema.optional(Schema.Number),
    }),
    Schema.Struct({
      oldRole: schoolMemberRoleSchema,
      newRole: schoolMemberRoleSchema,
    }),
    Schema.Struct({
      removedUserId: Schema.String,
      ...schoolRoleMetadataSchema.fields,
      removedAt: Schema.optional(Schema.Number),
    }),
    Schema.Struct({
      className: Schema.String,
      subject: Schema.String,
      year: Schema.String,
    }),
    Schema.Struct({
      className: Schema.String,
      isArchived: Schema.Boolean,
      archivedAt: Schema.optional(Schema.Number),
    }),
    Schema.Struct({
      className: Schema.String,
      oldName: Schema.optional(Schema.String),
      newName: Schema.optional(Schema.String),
      oldSubject: Schema.optional(Schema.String),
      newSubject: Schema.optional(Schema.String),
      oldYear: Schema.optional(Schema.String),
      newYear: Schema.optional(Schema.String),
      oldVisibility: Schema.optional(Schema.String),
      newVisibility: Schema.optional(Schema.String),
    }),
    Schema.Struct({
      classId: Schema.String,
      addedUserId: Schema.String,
      ...classRoleMetadataSchema.fields,
      teacherRole: schoolClassTeacherRoleSchema,
      enrollMethod: schoolClassEnrollMethodSchema,
    }),
    Schema.Struct({
      classId: Schema.String,
      oldRole: schoolClassMemberRoleSchema,
      newRole: schoolClassMemberRoleSchema,
    }),
    Schema.Struct({
      classId: Schema.String,
      oldTeacherRole: schoolClassTeacherRoleSchema,
      newTeacherRole: schoolClassTeacherRoleSchema,
    }),
    Schema.Struct({
      classId: Schema.String,
      removedUserId: Schema.String,
      ...classRoleMetadataSchema.fields,
      removedAt: Schema.optional(Schema.Number),
    })
  )
);

/** schools table definition. */
export const Schools = Table.make("schools", schoolSchema)
  .index("by_slug", ["slug"])
  .index("by_email", ["email"]);

/** schoolMembers table definition. */
export const SchoolMembers = Table.make("schoolMembers", schoolMemberSchema)
  .index("by_userId_and_status", ["userId", "status"])
  .index("by_schoolId_and_userId_and_status", ["schoolId", "userId", "status"]);

/** schoolInviteCodes table definition. */
export const SchoolInviteCodes = Table.make(
  "schoolInviteCodes",
  Schema.Struct({
    schoolId: GenericId.GenericId("schools"),
    role: schoolMemberRoleSchema,
    code: Schema.String,
    enabled: Schema.Boolean,
    expiresAt: Schema.optional(Schema.Number),
    maxUsage: Schema.optional(Schema.Number),
    currentUsage: Schema.Number,
    description: Schema.optional(Schema.String),
    createdBy: GenericId.GenericId("users"),
    updatedBy: Schema.optional(GenericId.GenericId("users")),
    updatedAt: Schema.Number,
  })
).index("by_code", ["code"]);

/** schoolActivityLogs table definition. */
export const SchoolActivityLogs = Table.make(
  "schoolActivityLogs",
  Schema.Struct({
    schoolId: GenericId.GenericId("schools"),
    userId: GenericId.GenericId("users"),
    action: schoolActivityActionSchema,
    entityType: schoolActivityEntityTypeSchema,
    entityId: Schema.String,
    metadata: schoolActivityMetadataSchema,
    ipAddress: Schema.optional(Schema.String),
    userAgent: Schema.optional(Schema.String),
  })
).index("by_schoolId", ["schoolId"]);

export const tables = [
  Schools,
  SchoolMembers,
  SchoolInviteCodes,
  SchoolActivityLogs,
] as const;
