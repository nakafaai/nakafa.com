import { GroupSpec } from "@confect/core";
import { tryoutsMutationsInternalExpiryGroup } from "./expiry.spec";
import { tryoutsMutationsInternalLeaderboardGroup } from "./leaderboard.spec";
import { tryoutsMutationsInternalScoringGroup } from "./scoring.spec";
import { tryoutsMutationsInternalStatsGroup } from "./stats.spec";

const tryoutsMutationsInternalGroup = GroupSpec.make("internalFunctions")
  .addGroup(tryoutsMutationsInternalExpiryGroup)
  .addGroup(tryoutsMutationsInternalLeaderboardGroup)
  .addGroup(tryoutsMutationsInternalScoringGroup)
  .addGroup(tryoutsMutationsInternalStatsGroup);

export { tryoutsMutationsInternalGroup };
