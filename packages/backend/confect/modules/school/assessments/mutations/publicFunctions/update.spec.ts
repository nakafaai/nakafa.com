import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentModeSchema,
  assessmentStatusSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicUpdateGroup = GroupSpec.make(
  "update"
).addFunction(
  FunctionSpec.publicMutation({
    name: "updateAssessment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      description: Schema.optional(richContentSchema),
      mode: Schema.optional(assessmentModeSchema),
      scheduledAt: Schema.optional(Schema.Number),
      schoolId: GenericId.GenericId("schools"),
      status: Schema.optional(assessmentStatusSchema),
      title: Schema.optional(Schema.String),
    }),
    returns: Schema.Null,
  })
);

export { assessmentsMutationsPublicUpdateGroup };
