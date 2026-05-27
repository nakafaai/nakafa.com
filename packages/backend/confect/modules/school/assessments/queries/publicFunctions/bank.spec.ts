import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
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
        description: Schema.optional(
          Schema.Struct({
            format: Schema.Literal("plate-v1"),
            json: Schema.String,
            text: Schema.String,
          })
        ),
        schoolId: GenericId.GenericId("schools"),
        scope: Schema.Literal("class", "school"),
        title: Schema.String,
        updatedAt: Schema.Number,
        updatedBy: Schema.optional(GenericId.GenericId("users")),
      })
    ),
  })
);

export { assessmentsQueriesPublicBankGroup };
