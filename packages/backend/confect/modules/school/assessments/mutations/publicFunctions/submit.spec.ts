import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicSubmitGroup = GroupSpec.make(
  "submit"
).addFunction(
  FunctionSpec.publicMutation({
    name: "submitAttempt",
    args: Schema.Struct({
      attemptId: GenericId.GenericId("schoolAssessmentAttempts"),
    }),
    returns: Schema.Null,
  })
);

export { assessmentsMutationsPublicSubmitGroup };
