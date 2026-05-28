import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentGradingModeSchema,
  assessmentMonitoringModeSchema,
  assessmentRankingScopeSchema,
  assessmentReleaseModeSchema,
  richContentSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicVersionGroup = GroupSpec.make(
  "version"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createAssessmentVersion",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      gradingMode: assessmentGradingModeSchema,
      instructions: Schema.optional(richContentSchema),
      monitoringMode: assessmentMonitoringModeSchema,
      rankingScope: assessmentRankingScopeSchema,
      releaseMode: assessmentReleaseModeSchema,
      retakePolicy: Schema.Struct({
        allowRetake: Schema.Boolean,
        maxAttempts: Schema.optional(Schema.Number),
      }),
      schoolId: GenericId.GenericId("schools"),
      timingPolicy: Schema.Struct({
        durationMinutes: Schema.optional(Schema.Number),
        perSection: Schema.Boolean,
      }),
    }),
    returns: GenericId.GenericId("schoolAssessmentVersions"),
  })
);

export { assessmentsMutationsPublicVersionGroup };
