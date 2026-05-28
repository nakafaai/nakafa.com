import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { orderDirectionSchema } from "@repo/backend/confect/modules/school/order.schemas";
import { Schema } from "effect";

const assessmentsMutationsPublicReorderGroup = GroupSpec.make(
  "reorder"
).addFunction(
  FunctionSpec.publicMutation({
    name: "reorderAssessment",
    args: Schema.Struct({
      assessmentId: GenericId.GenericId("schoolAssessments"),
      direction: orderDirectionSchema,
      schoolId: GenericId.GenericId("schools"),
    }),
    returns: Schema.Null,
  })
);

export { assessmentsMutationsPublicReorderGroup };
