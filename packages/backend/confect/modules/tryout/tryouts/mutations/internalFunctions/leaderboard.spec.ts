import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const tryoutsMutationsInternalLeaderboardGroup = GroupSpec.make(
  "leaderboard"
).addFunction(
  FunctionSpec.internalMutation({
    name: "updateLeaderboard",
    args: Schema.Struct({
      tryoutAttemptId: GenericId.GenericId("tryoutAttempts"),
    }),
    returns: Schema.Null,
  })
);

export { tryoutsMutationsInternalLeaderboardGroup };
