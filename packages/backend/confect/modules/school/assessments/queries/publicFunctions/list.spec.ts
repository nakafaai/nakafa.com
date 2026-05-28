import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentModeSchema,
  assessmentQuestionBankScopeSchema,
  assessmentStatusSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsQueriesPublicListGroup = GroupSpec.make("list").addFunction(
  FunctionSpec.publicQuery({
    name: "listAssessments",
    args: Schema.Struct({
      classId: Schema.optional(GenericId.GenericId("schoolClasses")),
      paginationOpts: Schema.Struct({
        cursor: Schema.Union(Schema.String, Schema.Null),
        endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
        id: Schema.optional(Schema.Number),
        maximumBytesRead: Schema.optional(Schema.Number),
        maximumRowsRead: Schema.optional(Schema.Number),
        numItems: Schema.Number,
      }),
      schoolId: GenericId.GenericId("schools"),
    }),
    returns: Schema.Struct({
      continueCursor: Schema.String,
      isDone: Schema.Boolean,
      page: Schema.Array(
        Schema.Struct({
          _creationTime: Schema.Number,
          _id: GenericId.GenericId("schoolAssessments"),
          archivedAt: Schema.optional(Schema.Number),
          archivedBy: Schema.optional(GenericId.GenericId("users")),
          classId: Schema.optional(GenericId.GenericId("schoolClasses")),
          createdBy: GenericId.GenericId("users"),
          currentVersionId: Schema.optional(
            GenericId.GenericId("schoolAssessmentVersions")
          ),
          description: Schema.optional(richContentSchema),
          mode: assessmentModeSchema,
          order: Schema.Number,
          publishedAt: Schema.optional(Schema.Number),
          publishedBy: Schema.optional(GenericId.GenericId("users")),
          questionBankScope: assessmentQuestionBankScopeSchema,
          scheduledAt: Schema.optional(Schema.Number),
          scheduledJobId: Schema.optional(
            GenericId.GenericId("_scheduled_functions")
          ),
          schoolId: GenericId.GenericId("schools"),
          slug: Schema.String,
          status: assessmentStatusSchema,
          title: Schema.String,
          updatedAt: Schema.Number,
          updatedBy: Schema.optional(GenericId.GenericId("users")),
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

export { assessmentsQueriesPublicListGroup };
