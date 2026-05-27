import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const assessmentsMutationsPublicCreateGroup = GroupSpec.make(
  "create"
).addFunction(
  FunctionSpec.publicMutation({
    name: "createAssessment",
    args: Schema.Struct({
      classId: Schema.optional(GenericId.GenericId("schoolClasses")),
      description: Schema.optional(
        Schema.Struct({
          format: Schema.Literal("plate-v1"),
          json: Schema.String,
          text: Schema.String,
        })
      ),
      mode: Schema.Literal("practice", "assignment", "quiz", "exam", "tryout"),
      scheduledAt: Schema.optional(Schema.Number),
      schoolId: GenericId.GenericId("schools"),
      status: Schema.Literal("draft", "published", "scheduled", "archived"),
      title: Schema.String,
    }),
    returns: GenericId.GenericId("schoolAssessments"),
  })
);

export { assessmentsMutationsPublicCreateGroup };
