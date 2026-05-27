import { FunctionSpec, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

const contentSyncMutationsTryoutsGroup = GroupSpec.make("tryouts").addFunction(
  FunctionSpec.internalMutation({
    name: "bulkSyncTryouts",
    args: Schema.Struct({
      locale: localeSchema,
      product: tryoutProductSchema,
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
