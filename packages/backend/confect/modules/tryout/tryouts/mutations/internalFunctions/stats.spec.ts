import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

const tryoutsMutationsInternalStatsGroup = GroupSpec.make("stats").addFunction(
  FunctionSpec.internalMutation({
    name: "rebuildUserTryoutStats",
    args: Schema.Struct({
      cursor: Schema.optional(Schema.String),
      leaderboardNamespace: Schema.String,
      product: tryoutProductSchema,
      progress: Schema.optional(
        Schema.Struct({
          bestTheta: Schema.optional(Schema.Number),
          lastTryoutAt: Schema.Number,
          totalRawScore: Schema.Number,
          totalTheta: Schema.Number,
          totalTryoutsCompleted: Schema.Number,
        })
      ),
      userId: GenericId.GenericId("users"),
    }),
    returns: Schema.Null,
  })
);

export { tryoutsMutationsInternalStatsGroup };
