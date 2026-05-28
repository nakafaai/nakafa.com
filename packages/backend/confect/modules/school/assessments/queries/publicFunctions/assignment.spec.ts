import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  assessmentAssignmentStatusSchema,
  assessmentGradingModeSchema,
  assessmentMonitoringModeSchema,
  assessmentRankingScopeSchema,
  assessmentReleaseModeSchema,
} from "@repo/backend/confect/modules/school/assessmentsTables/shared";
import { Schema } from "effect";

const assessmentsQueriesPublicAssignmentGroup = GroupSpec.make(
  "assignment"
).addFunction(
  FunctionSpec.publicQuery({
    name: "getAssignment",
    args: Schema.Struct({
      assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
      classId: GenericId.GenericId("schoolClasses"),
    }),
    returns: Schema.Struct({
      assignment: Schema.Struct({
        _creationTime: Schema.Number,
        _id: GenericId.GenericId("schoolAssessmentAssignments"),
        archivedAt: Schema.optional(Schema.Number),
        assessmentId: GenericId.GenericId("schoolAssessments"),
        closesAt: Schema.optional(Schema.Number),
        createdBy: GenericId.GenericId("users"),
        gradingMode: assessmentGradingModeSchema,
        monitoringMode: assessmentMonitoringModeSchema,
        opensAt: Schema.optional(Schema.Number),
        publishedAt: Schema.optional(Schema.Number),
        rankingScope: assessmentRankingScopeSchema,
        releaseMode: assessmentReleaseModeSchema,
        releasesAt: Schema.optional(Schema.Number),
        retakePolicy: Schema.Struct({
          allowRetake: Schema.Boolean,
          maxAttempts: Schema.optional(Schema.Number),
        }),
        schoolId: GenericId.GenericId("schools"),
        status: assessmentAssignmentStatusSchema,
        timingPolicy: Schema.Struct({
          durationMinutes: Schema.optional(Schema.Number),
          perSection: Schema.Boolean,
        }),
        title: Schema.String,
        updatedAt: Schema.Number,
        updatedBy: Schema.optional(GenericId.GenericId("users")),
        versionId: GenericId.GenericId("schoolAssessmentVersions"),
      }),
      target: Schema.Struct({
        _creationTime: Schema.Number,
        _id: GenericId.GenericId("schoolAssessmentAssignmentTargets"),
        assignmentId: GenericId.GenericId("schoolAssessmentAssignments"),
        classId: GenericId.GenericId("schoolClasses"),
        schoolId: GenericId.GenericId("schools"),
      }),
    }),
  })
);

export { assessmentsQueriesPublicAssignmentGroup };
