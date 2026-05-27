import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const contentSyncMutationsTryoutsGroup = GroupSpec.make("tryouts").addFunction(
  FunctionSpec.internalMutation({
    name: "bulkSyncTryouts",
    args: Schema.Struct({
      locale: Schema.Literal("en", "id"),
      product: Schema.Literal("snbt"),
      requiredPartKeys: Schema.Array(
        Schema.Literal(
          "mathematics",
          "quantitative-knowledge",
          "mathematical-reasoning",
          "general-reasoning",
          "indonesian-language",
          "english-language",
          "general-knowledge",
          "reading-and-writing-skills"
        )
      ),
    }),
    returns: Schema.Struct({
      created: Schema.Number,
      unchanged: Schema.Number,
      updated: Schema.Number,
    }),
  })
);

export { contentSyncMutationsTryoutsGroup };
