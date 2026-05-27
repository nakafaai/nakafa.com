import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicSectionsGroup = GroupSpec.make(
  "sections"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createSection",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      description: Schema.optional(
        Schema.Struct({
          format: Schema.Literal("plate-v1"),
          json: Schema.String,
          text: Schema.String,
        })
      ),
      durationMinutes: Schema.optional(Schema.Number),
      schoolId: GenericId.GenericId("schools"),
      title: Schema.String,
    }),
    returns: GenericId.GenericId("schoolAssessmentSections"),
  })
);

export { assessmentsMutationsPublicSectionsGroup };
