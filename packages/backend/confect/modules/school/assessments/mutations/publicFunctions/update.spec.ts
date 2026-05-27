import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicUpdateGroup = GroupSpec.make(
  "update"
).addFunction(
  FunctionSpec.publicMutation({
    name: "updateAssessment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      description: Schema.optional(
        Schema.Struct({
          format: Schema.Literal("plate-v1"),
          json: Schema.String,
          text: Schema.String,
        })
      ),
      mode: Schema.optional(
        Schema.Literal("practice", "assignment", "quiz", "exam", "tryout")
      ),
      scheduledAt: Schema.optional(Schema.Number),
      schoolId: GenericId.GenericId("schools"),
      status: Schema.optional(
        Schema.Literal("draft", "published", "scheduled", "archived")
      ),
      title: Schema.optional(Schema.String),
    }),
    returns: Schema.Null,
  })
);

export { assessmentsMutationsPublicUpdateGroup };
