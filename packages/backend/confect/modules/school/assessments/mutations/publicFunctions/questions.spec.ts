import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentQuestionSourceSchema,
  assessmentQuestionTypeSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicQuestionsGroup = GroupSpec.make(
  "questions"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createQuestion",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      bankEntryId: Schema.optional(
        GenericId.GenericId("schoolAssessmentQuestionBankEntries")
      ),
      choices: Schema.Array(
        Schema.Struct({
          content: richContentSchema,
          isCorrect: Schema.Boolean,
          key: Schema.String,
        })
      ),
      explanation: Schema.optional(richContentSchema),
      maxSelectionCount: Schema.optional(Schema.Number),
      points: Schema.Number,
      questionType: assessmentQuestionTypeSchema,
      required: Schema.Boolean,
      rubricCriteria: Schema.Array(
        Schema.Struct({
          description: Schema.optional(richContentSchema),
          label: Schema.String,
          maxScore: Schema.Number,
        })
      ),
      schoolId: GenericId.GenericId("schools"),
      sectionId: GenericId.GenericId("schoolAssessmentSections"),
      shuffleChoices: Schema.Boolean,
      source: assessmentQuestionSourceSchema,
      stem: richContentSchema,
    }),
    returns: GenericId.GenericId("schoolAssessmentQuestions"),
  })
);

export { assessmentsMutationsPublicQuestionsGroup };
