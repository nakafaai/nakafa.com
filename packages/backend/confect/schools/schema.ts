import { GenericId } from "@confect/core/GenericId";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  schoolClassEnrollMethodValidator,
  schoolClassMemberRoleValidator,
  schoolClassTeacherRoleBaseValidator,
} from "@repo/backend/confect/classes/role";
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
export const schoolTypeValidator = schoolTypeSchema;

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
export const schoolValidator = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
  email: Schema.String,
  phone: Schema.optionalKey(Schema.String),
  address: Schema.optionalKey(Schema.String),
  city: Schema.String,
  province: Schema.String,
  type: schoolTypeValidator,
  currentStudents: Schema.Finite,
  currentTeachers: Schema.Finite,
  updatedAt: Schema.Finite,
  createdBy: IdSchema("users"),
  updatedBy: Schema.optionalKey(IdSchema("users")),
});

/**
 * School member base validator (without system fields)
 */
export const schoolMemberValidator = Schema.Struct({
  schoolId: IdSchema("schools"),
  userId: IdSchema("users"),
  role: schoolMemberRoleSchema,
  status: schoolMemberStatusSchema,
  invitedBy: Schema.optionalKey(IdSchema("users")),
  invitedAt: Schema.optionalKey(Schema.Finite),
  inviteToken: Schema.optionalKey(Schema.String),
  inviteCodeId: Schema.optionalKey(IdSchema("schoolInviteCodes")),
  updatedAt: Schema.Finite,
  joinedAt: Schema.Finite,
  removedBy: Schema.optionalKey(IdSchema("users")),
  removedAt: Schema.optionalKey(Schema.Finite),
});

/** Activity fields shared by every operation-specific event. */
const activityFields = {
  schoolId: GenericId("schools"),
  userId: GenericId("users"),
  entityId: Schema.String,
  ipAddress: Schema.optionalKey(Schema.String),
  userAgent: Schema.optionalKey(Schema.String),
};
const classMemberRole = schoolClassMemberRoleValidator;
const teacherRole = schoolClassTeacherRoleBaseValidator;
const enrollMethod = schoolClassEnrollMethodValidator.schema;

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
    metadata: Schema.Struct({
      schoolName: Schema.String,
    }),
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
