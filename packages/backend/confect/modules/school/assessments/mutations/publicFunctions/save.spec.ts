import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentQuestionTypeSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicSaveGroup = GroupSpec.make("save").addFunction(
  FunctionSpec.publicMutation({
    name: "saveResponse",
    args: Schema.Struct({
      attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
      essayAttachmentStorageIds: Schema.optional(
        Schema.Array(GenericId.GenericId("_storage"))
      ),
      essayContent: Schema.optional(richContentSchema),
      isFinal: Schema.Boolean,
      questionId: GenericId.GenericId("schoolAssessmentVersionQuestions"),
      questionType: assessmentQuestionTypeSchema,
      selectedChoiceIds: Schema.optional(
        Schema.Array(GenericId.GenericId("schoolAssessmentVersionChoices"))
      ),
    }),
    returns: GenericId.GenericId("schoolAssessmentResponses"),
  })
);

export { assessmentsMutationsPublicSaveGroup };
