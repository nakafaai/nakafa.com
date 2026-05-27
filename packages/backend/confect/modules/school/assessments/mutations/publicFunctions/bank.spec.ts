import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicBankGroup = GroupSpec.make("bank")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createQuestionBank",
      args: Schema.Struct({
        classId: Schema.optional(GenericId.GenericId("schoolClasses")),
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
      }),
      returns: GenericId.GenericId("schoolAssessmentQuestionBanks"),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createQuestionBankEntry",
      args: Schema.Struct({
        bankId: GenericId.GenericId("schoolAssessmentQuestionBanks"),
        classId: Schema.optional(GenericId.GenericId("schoolClasses")),
        explanation: Schema.optional(
          Schema.Struct({
            format: Schema.Literal("plate-v1"),
            json: Schema.String,
            text: Schema.String,
          })
        ),
        maxSelectionCount: Schema.optional(Schema.Number),
        points: Schema.Number,
        questionType: Schema.Literal("mcq-single", "mcq-multi", "essay"),
        schoolId: GenericId.GenericId("schools"),
        shuffleChoices: Schema.Boolean,
        stem: Schema.Struct({
          format: Schema.Literal("plate-v1"),
          json: Schema.String,
          text: Schema.String,
        }),
      }),
      returns: GenericId.GenericId("schoolAssessmentQuestionBankEntries"),
    })
  );

export { assessmentsMutationsPublicBankGroup };
