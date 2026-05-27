import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { SchoolActionError } from "@repo/backend/confect/modules/school/schoolErrors";
import { Schema } from "effect";

const schoolsMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createSchool",
      args: Schema.Struct({
        address: Schema.String,
        city: Schema.String,
        email: Schema.String,
        name: Schema.String,
        phone: Schema.String,
        province: Schema.String,
        type: Schema.Literal(
          "elementary-school",
          "middle-school",
          "high-school",
          "vocational-school",
          "university",
          "other"
        ),
      }),
      returns: Schema.Struct({
        schoolId: GenericId.GenericId("schools"),
        slug: Schema.String,
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "joinSchool",
      args: Schema.Struct({ code: Schema.String }),
      returns: Schema.Struct({
        schoolId: GenericId.GenericId("schools"),
        slug: Schema.String,
      }),
    })
  );

export { schoolsMutationsGroup };

const schoolsQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSchoolBySlug",
      args: Schema.Struct({ slug: Schema.String }),
      error: SchoolActionError,
      returns: Schema.Struct({
        membership: Schema.Struct({
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
          role: Schema.Literal("admin", "teacher", "student", "parent", "demo"),
          schoolId: GenericId.GenericId("schools"),
          status: Schema.Literal("active", "invited", "removed"),
          updatedAt: Schema.Number,
          userId: GenericId.GenericId("users"),
        }),
        school: Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("schools"),
          address: Schema.optional(Schema.String),
          city: Schema.String,
          createdBy: GenericId.GenericId("users"),
          currentStudents: Schema.Number,
          currentTeachers: Schema.Number,
          email: Schema.String,
          name: Schema.String,
          phone: Schema.optional(Schema.String),
          province: Schema.String,
          slug: Schema.String,
          type: Schema.Literal(
            "elementary-school",
            "middle-school",
            "high-school",
            "vocational-school",
            "university",
            "other"
          ),
          updatedAt: Schema.Number,
          updatedBy: Schema.optional(GenericId.GenericId("users")),
        }),
      }),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getMySchoolLandingState",
      args: Schema.Struct({}),
      returns: Schema.Union(
        Schema.Struct({ kind: Schema.Literal("none") }),
        Schema.Struct({ kind: Schema.Literal("single"), slug: Schema.String }),
        Schema.Struct({ kind: Schema.Literal("multiple") })
      ),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getMySchoolsPage",
      args: Schema.Struct({
        paginationOpts: Schema.Struct({
          cursor: Schema.Union(Schema.String, Schema.Null),
          endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
          id: Schema.optional(Schema.Number),
          maximumBytesRead: Schema.optional(Schema.Number),
          maximumRowsRead: Schema.optional(Schema.Number),
          numItems: Schema.Number,
        }),
      }),
      returns: Schema.Struct({
        continueCursor: Schema.String,
        isDone: Schema.Boolean,
        page: Schema.Array(
          Schema.Struct({
            _id: GenericId.GenericId("schools"),
            name: Schema.String,
            slug: Schema.String,
            type: Schema.Literal(
              "elementary-school",
              "middle-school",
              "high-school",
              "vocational-school",
              "university",
              "other"
            ),
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
  );

export { schoolsQueriesGroup };

const schoolsGroup = GroupSpec.make("schools")
  .addGroup(schoolsMutationsGroup)
  .addGroup(schoolsQueriesGroup);

export { schoolsGroup };
