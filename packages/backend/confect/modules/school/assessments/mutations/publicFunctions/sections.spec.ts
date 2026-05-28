import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { richContentSchema } from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicSectionsGroup = GroupSpec.make(
  "sections"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createSection",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      description: Schema.optional(richContentSchema),
      durationMinutes: Schema.optional(Schema.Number),
      schoolId: GenericId.GenericId("schools"),
      title: Schema.String,
    }),
    returns: GenericId.GenericId("schoolAssessmentSections"),
  })
);

export { assessmentsMutationsPublicSectionsGroup };
