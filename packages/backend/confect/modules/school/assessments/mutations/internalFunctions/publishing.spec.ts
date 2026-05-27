import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsInternalPublishingGroup = GroupSpec.make(
  "publishing"
).addFunction(
  FunctionSpec.internalMutation({
    name: "publishAssessment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      publishedBy: GenericId.GenericId("users"),
    }),
    returns: Schema.Null,
  })
);

export { assessmentsMutationsInternalPublishingGroup };
