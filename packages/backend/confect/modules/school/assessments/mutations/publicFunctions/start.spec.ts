import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicStartGroup = GroupSpec.make(
  "start"
).addFunction(
  FunctionSpec.publicMutation({
    name: "startAttempt",
    args: Schema.Struct({
      assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
      classId: GenericId.GenericId("schoolClasses"),
    }),
    returns: GenericId.GenericId("schoolAssessmentAttempts"),
  })
);

export { assessmentsMutationsPublicStartGroup };
