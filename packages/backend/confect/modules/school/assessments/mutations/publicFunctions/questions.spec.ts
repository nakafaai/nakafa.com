import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
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
          content: Schema.Struct({
            format: Schema.Literal("plate-v1"),
            json: Schema.String,
            text: Schema.String,
          }),
          isCorrect: Schema.Boolean,
          key: Schema.String,
        })
      ),
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
      required: Schema.Boolean,
      rubricCriteria: Schema.Array(
        Schema.Struct({
          description: Schema.optional(
            Schema.Struct({
              format: Schema.Literal("plate-v1"),
              json: Schema.String,
              text: Schema.String,
            })
          ),
          label: Schema.String,
          maxScore: Schema.Number,
        })
      ),
      schoolId: GenericId.GenericId("schools"),
      sectionId: GenericId.GenericId("schoolAssessmentSections"),
      shuffleChoices: Schema.Boolean,
      source: Schema.Literal("manual", "bank", "ai-import"),
      stem: Schema.Struct({
        format: Schema.Literal("plate-v1"),
        json: Schema.String,
        text: Schema.String,
      }),
    }),
    returns: GenericId.GenericId("schoolAssessmentQuestions"),
  })
);

export { assessmentsMutationsPublicQuestionsGroup };
