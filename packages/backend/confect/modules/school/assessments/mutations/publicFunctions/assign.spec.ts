import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentGradingModeSchema,
  assessmentMonitoringModeSchema,
  assessmentRankingScopeSchema,
  assessmentReleaseModeSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsMutationsPublicAssignGroup = GroupSpec.make(
  "assign"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createAssignment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      classIds: Schema.Array(GenericId.GenericId("schoolClasses")),
      closesAt: Schema.optional(Schema.Number),
      gradingMode: assessmentGradingModeSchema,
      monitoringMode: assessmentMonitoringModeSchema,
      opensAt: Schema.optional(Schema.Number),
      rankingScope: assessmentRankingScopeSchema,
      releaseMode: assessmentReleaseModeSchema,
      releasesAt: Schema.optional(Schema.Number),
      retakePolicy: Schema.Struct({
        allowRetake: Schema.Boolean,
        maxAttempts: Schema.optional(Schema.Number),
      }),
      schoolId: GenericId.GenericId("schools"),
      timingPolicy: Schema.Struct({
        durationMinutes: Schema.optional(Schema.Number),
        perSection: Schema.Boolean,
      }),
      title: Schema.String,
      versionId: GenericId.GenericId("schoolAssessmentVersions"),
    }),
    returns: GenericId.GenericId("schoolAssessmentAssignments"),
  })
);

export { assessmentsMutationsPublicAssignGroup };
