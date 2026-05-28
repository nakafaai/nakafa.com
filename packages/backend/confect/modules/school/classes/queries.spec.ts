import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import {
  schoolClassEnrollMethodSchema,
  schoolClassImageSchema,
  schoolClassMemberRoleSchema,
  schoolClassTeacherRoleSchema,
  schoolClassVisibilitySchema,
} from "@repo/backend/confect/modules/school/classes.tables";
import {
  schoolMemberRoleSchema,
  schoolMemberStatusSchema,
} from "@repo/backend/confect/modules/school/schools.tables";
import { Schema } from "effect";

const classesQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getClasses",
      args: Schema.Struct({
        isArchived: Schema.optional(Schema.Boolean),
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        q: Schema.optional(Schema.String),
        schoolId: GenericId.GenericId("schools"),
        visibility: Schema.optional(schoolClassVisibilitySchema),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolClasses"),
            archivedAt: Schema.optional(Schema.Number),
            archivedBy: Schema.optional(GenericId.GenericId("users")),
            createdBy: GenericId.GenericId("users"),
            image: schoolClassImageSchema,
            isArchived: Schema.Boolean,
            name: Schema.String,
            schoolId: GenericId.GenericId("schools"),
            studentCount: Schema.Number,
            subject: Schema.String,
            teacherCount: Schema.Number,
            updatedAt: Schema.Number,
            updatedBy: Schema.optional(GenericId.GenericId("users")),
            visibility: schoolClassVisibilitySchema,
            year: Schema.String,
          })
        ),
        pageStatus: Schema.optional(
          Schema.Union(
            Schema.Literal("SplitRecommended"),
            Schema.Literal("SplitRequired"),
            Schema.Null
          )
        ),
        splitCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getClassRoute",
      args: Schema.Struct({ classId: Schema.String }),
      error: ClassActionError,
      returns: Schema.Union(
        Schema.Struct({
          class: Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolClasses"),
            archivedAt: Schema.optional(Schema.Number),
            archivedBy: Schema.optional(GenericId.GenericId("users")),
            createdBy: GenericId.GenericId("users"),
            image: schoolClassImageSchema,
            isArchived: Schema.Boolean,
            name: Schema.String,
            schoolId: GenericId.GenericId("schools"),
            studentCount: Schema.Number,
            subject: Schema.String,
            teacherCount: Schema.Number,
            updatedAt: Schema.Number,
            updatedBy: Schema.optional(GenericId.GenericId("users")),
            visibility: schoolClassVisibilitySchema,
            year: Schema.String,
          }),
          classMembership: Schema.Union(
            Schema.Null,
            Schema.Struct({
              _creationTime: Schema.Number,
              _id: GenericId.GenericId("schoolClassMembers"),
              addedBy: Schema.optional(GenericId.GenericId("users")),
              classId: GenericId.GenericId("schoolClasses"),
              enrollMethod: schoolClassEnrollMethodSchema,
              inviteCodeId: Schema.optional(
                GenericId.GenericId("schoolClassInviteCodes")
              ),
              removedAt: Schema.optional(Schema.Number),
              removedBy: Schema.optional(GenericId.GenericId("users")),
              role: schoolClassMemberRoleSchema,
              schoolId: GenericId.GenericId("schools"),
              teacherRole: schoolClassTeacherRoleSchema,
              updatedAt: Schema.Number,
              userId: GenericId.GenericId("users"),
            })
          ),
          kind: Schema.Literal("accessible"),
          schoolMembership: Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolMembers"),
            inviteCodeId: Schema.optional(
              GenericId.GenericId("schoolInviteCodes")
            ),
            inviteToken: Schema.optional(Schema.String),
            invitedAt: Schema.optional(Schema.Number),
            invitedBy: Schema.optional(GenericId.GenericId("users")),
            joinedAt: Schema.Number,
            removedAt: Schema.optional(Schema.Number),
            removedBy: Schema.optional(GenericId.GenericId("users")),
            role: schoolMemberRoleSchema,
            schoolId: GenericId.GenericId("schools"),
            status: schoolMemberStatusSchema,
            updatedAt: Schema.Number,
            userId: GenericId.GenericId("users"),
          }),
        }),
        Schema.Struct({
          class: Schema.Struct({
            _id: GenericId.GenericId("schoolClasses"),
            image: schoolClassImageSchema,
            name: Schema.String,
            subject: Schema.String,
            visibility: schoolClassVisibilitySchema,
            year: Schema.String,
          }),
          kind: Schema.Literal("joinRequired"),
          schoolMembership: Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolMembers"),
            inviteCodeId: Schema.optional(
              GenericId.GenericId("schoolInviteCodes")
            ),
            inviteToken: Schema.optional(Schema.String),
            invitedAt: Schema.optional(Schema.Number),
            invitedBy: Schema.optional(GenericId.GenericId("users")),
            joinedAt: Schema.Number,
            removedAt: Schema.optional(Schema.Number),
            removedBy: Schema.optional(GenericId.GenericId("users")),
            role: schoolMemberRoleSchema,
            schoolId: GenericId.GenericId("schools"),
            status: schoolMemberStatusSchema,
            updatedAt: Schema.Number,
            userId: GenericId.GenericId("users"),
          }),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getPeople",
      args: Schema.Struct({
        classId: GenericId.GenericId("schoolClasses"),
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
        q: Schema.optional(Schema.String),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("schoolClassMembers"),
            addedBy: Schema.optional(GenericId.GenericId("users")),
            classId: GenericId.GenericId("schoolClasses"),
            enrollMethod: schoolClassEnrollMethodSchema,
            inviteCodeId: Schema.optional(
              GenericId.GenericId("schoolClassInviteCodes")
            ),
            removedAt: Schema.optional(Schema.Number),
            removedBy: Schema.optional(GenericId.GenericId("users")),
            role: schoolClassMemberRoleSchema,
            schoolId: GenericId.GenericId("schools"),
            teacherRole: schoolClassTeacherRoleSchema,
            updatedAt: Schema.Number,
            user: Schema.Struct({
              _id: GenericId.GenericId("users"),
              email: Schema.String,
              image: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
              name: Schema.String,
            }),
            userId: GenericId.GenericId("users"),
          })
        ),
        pageStatus: Schema.optional(
          Schema.Union(
            Schema.Literal("SplitRecommended"),
            Schema.Literal("SplitRequired"),
            Schema.Null
          )
        ),
        splitCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getInviteCodes",
      args: Schema.Struct({ classId: GenericId.GenericId("schoolClasses") }),
      returns: Schema.Array(
        Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("schoolClassInviteCodes"),
          classId: GenericId.GenericId("schoolClasses"),
          code: Schema.String,
          createdBy: GenericId.GenericId("users"),
          currentUsage: Schema.Number,
          description: Schema.optional(Schema.String),
          enabled: Schema.Boolean,
          expiresAt: Schema.optional(Schema.Number),
          maxUsage: Schema.optional(Schema.Number),
          role: schoolClassMemberRoleSchema,
          schoolId: GenericId.GenericId("schools"),
          updatedAt: Schema.Number,
          updatedBy: Schema.optional(GenericId.GenericId("users")),
        })
      ),
    })
  );

export { classesQueriesGroup };
