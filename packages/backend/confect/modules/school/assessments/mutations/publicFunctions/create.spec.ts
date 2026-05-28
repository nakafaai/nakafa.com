import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentModeSchema,
  assessmentStatusSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicCreateGroup = GroupSpec.make(
  "create"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createAssessment",
    args: Schema.Struct({
      classId: Schema.optional(GenericId.GenericId("schoolClasses")),
      description: Schema.optional(richContentSchema),
      mode: assessmentModeSchema,
      scheduledAt: Schema.optional(Schema.Number),
      schoolId: GenericId.GenericId("schools"),
      status: assessmentStatusSchema,
      title: Schema.String,
    }),
    returns: GenericId.GenericId("schoolAssessments"),
  })
);

export { assessmentsMutationsPublicCreateGroup };
