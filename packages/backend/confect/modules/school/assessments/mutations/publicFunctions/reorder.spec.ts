import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicReorderGroup = GroupSpec.make(
  "reorder"
).addFunction(
  FunctionSpec.publicMutation({
    name: "reorderAssessment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      direction: Schema.Literal("up", "down"),
      schoolId: GenericId.GenericId("schools"),
    }),
    returns: Schema.Null,
  })
);

export { assessmentsMutationsPublicReorderGroup };
