import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicDeleteGroup = GroupSpec.make(
  "deleteFunctions"
).addFunction(
  FunctionSpec.publicMutation({
    name: "deleteAssessment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      schoolId: GenericId.GenericId("schools"),
    }),
    returns: Schema.Null,
  })
);

export { assessmentsMutationsPublicDeleteGroup };
