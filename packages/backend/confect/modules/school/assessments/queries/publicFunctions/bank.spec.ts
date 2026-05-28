import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentQuestionBankScopeSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsQueriesPublicBankGroup = GroupSpec.make("bank").addFunction(
  FunctionSpec.publicQuery({
    name: "listQuestionBanks",
    args: Schema.Struct({
      classId: Schema.optional(GenericId.GenericId("schoolClasses")),
      schoolId: GenericId.GenericId("schools"),
    }),
    returns: Schema.Array(
      Schema.Struct({
        _creationTime: Schema.Number,
        _id: GenericId.GenericId("schoolAssessmentQuestionBanks"),
        classId: Schema.optional(GenericId.GenericId("schoolClasses")),
        createdBy: GenericId.GenericId("users"),
        description: Schema.optional(richContentSchema),
        schoolId: GenericId.GenericId("schools"),
        scope: assessmentQuestionBankScopeSchema,
        title: Schema.String,
        updatedAt: Schema.Number,
        updatedBy: Schema.optional(GenericId.GenericId("users")),
      })
    ),
  })
);

export { assessmentsQueriesPublicBankGroup };
