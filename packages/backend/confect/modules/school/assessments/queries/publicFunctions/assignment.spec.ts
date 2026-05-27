import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
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
        gradingMode: Schema.Literal("auto", "manual", "hybrid"),
        monitoringMode: Schema.Literal("off", "basic", "strict"),
        opensAt: Schema.optional(Schema.Number),
        publishedAt: Schema.optional(Schema.Number),
        rankingScope: Schema.Literal("none", "class", "school"),
        releaseMode: Schema.Literal("instant", "manual", "scheduled"),
        releasesAt: Schema.optional(Schema.Number),
        retakePolicy: Schema.Struct({
          allowRetake: Schema.Boolean,
          maxAttempts: Schema.optional(Schema.Number),
        }),
        schoolId: GenericId.GenericId("schools"),
        status: Schema.Literal(
          "draft",
          "scheduled",
          "published",
          "closed",
          "archived"
        ),
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
