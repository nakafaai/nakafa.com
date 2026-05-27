import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const tryoutsQueriesLeaderboardGroup = GroupSpec.make("leaderboard")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getTryoutLeaderboard",
      args: Schema.Struct({
        limit: Schema.optional(Schema.Number),
        tryoutId: GenericId.GenericId("tryouts"),
      }),
      returns: Schema.Array(
        Schema.Struct({
          completedAt: Schema.Number,
          irtScore: Schema.Number,
          rank: Schema.Number,
          rawScore: Schema.Number,
          theta: Schema.Number,
          userId: GenericId.GenericId("users"),
          userName: Schema.Union(Schema.Null, Schema.String),
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getGlobalLeaderboard",
      args: Schema.Struct({
        cycleKey: Schema.String,
        limit: Schema.optional(Schema.Number),
        locale: Schema.Literal("en", "id"),
        product: Schema.Literal("snbt"),
      }),
      returns: Schema.Array(
        Schema.Struct({
          averageRawScore: Schema.Number,
          averageTheta: Schema.Number,
          bestTheta: Schema.Number,
          lastTryoutAt: Schema.Number,
          rank: Schema.Number,
          totalTryoutsCompleted: Schema.Number,
          userId: GenericId.GenericId("users"),
          userName: Schema.Union(Schema.Null, Schema.String),
        })
      ),
    })
  );

export { tryoutsQueriesLeaderboardGroup };
