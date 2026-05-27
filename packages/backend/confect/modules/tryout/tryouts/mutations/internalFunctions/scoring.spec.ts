import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const tryoutsMutationsInternalScoringGroup = GroupSpec.make(
  "scoring"
).addFunction(
  FunctionSpec.internalMutation({
    name: "promoteProvisionalTryoutScores",
    args: Schema.Struct({
      scaleVersionId: GenericId.GenericId("irtScaleVersions"),
      tryoutId: GenericId.GenericId("tryouts"),
    }),
    returns: Schema.Null,
  })
);

export { tryoutsMutationsInternalScoringGroup };
