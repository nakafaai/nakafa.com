import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicVersionGroup = GroupSpec.make(
  "version"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createAssessmentVersion",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      gradingMode: Schema.Literal("auto", "manual", "hybrid"),
      instructions: Schema.optional(
        Schema.Struct({
          format: Schema.Literal("plate-v1"),
          json: Schema.String,
          text: Schema.String,
        })
      ),
      monitoringMode: Schema.Literal("off", "basic", "strict"),
      rankingScope: Schema.Literal("none", "class", "school"),
      releaseMode: Schema.Literal("instant", "manual", "scheduled"),
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
