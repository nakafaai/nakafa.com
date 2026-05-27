import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicSaveGroup = GroupSpec.make("save").addFunction(
  FunctionSpec.publicMutation({
    name: "saveResponse",
    args: Schema.Struct({
      attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
      essayAttachmentStorageIds: Schema.optional(
        Schema.Array(GenericId.GenericId("_storage"))
      ),
      essayContent: Schema.optional(
        Schema.Struct({
          format: Schema.Literal("plate-v1"),
          json: Schema.String,
          text: Schema.String,
        })
      ),
      isFinal: Schema.Boolean,
      questionId: GenericId.GenericId("schoolAssessmentVersionQuestions"),
      questionType: Schema.Literal("mcq-single", "mcq-multi", "essay"),
      selectedChoiceIds: Schema.optional(
        Schema.Array(GenericId.GenericId("schoolAssessmentVersionChoices"))
      ),
    }),
    returns: GenericId.GenericId("schoolAssessmentResponses"),
  })
);

export { assessmentsMutationsPublicSaveGroup };
