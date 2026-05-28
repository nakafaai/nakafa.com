import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentQuestionBankScopeSchema,
  assessmentQuestionTypeSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicBankGroup = GroupSpec.make("bank")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createQuestionBank",
      args: Schema.Struct({
        classId: Schema.optional(GenericId.GenericId("schoolClasses")),
        description: Schema.optional(richContentSchema),
        schoolId: GenericId.GenericId("schools"),
        scope: assessmentQuestionBankScopeSchema,
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
        explanation: Schema.optional(richContentSchema),
        maxSelectionCount: Schema.optional(Schema.Number),
        points: Schema.Number,
        questionType: assessmentQuestionTypeSchema,
        schoolId: GenericId.GenericId("schools"),
        shuffleChoices: Schema.Boolean,
        stem: richContentSchema,
      }),
      returns: GenericId.GenericId("schoolAssessmentQuestionBankEntries"),
    })
  );

export { assessmentsMutationsPublicBankGroup };
