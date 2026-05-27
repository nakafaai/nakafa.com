import { GroupSpec } from "@confect/core";
import { tryoutsMutationsInternalExpiryGroup } from "@repo/backend/confect/modules/tryout/tryouts/mutations/internalFunctions/expiry.spec";
import { tryoutsMutationsInternalLeaderboardGroup } from "@repo/backend/confect/modules/tryout/tryouts/mutations/internalFunctions/leaderboard.spec";
import { tryoutsMutationsInternalScoringGroup } from "@repo/backend/confect/modules/tryout/tryouts/mutations/internalFunctions/scoring.spec";
import { tryoutsMutationsInternalStatsGroup } from "@repo/backend/confect/modules/tryout/tryouts/mutations/internalFunctions/stats.spec";

const tryoutsMutationsInternalGroup = GroupSpec.make("internalFunctions")
  .addGroup(tryoutsMutationsInternalExpiryGroup)
  .addGroup(tryoutsMutationsInternalLeaderboardGroup)
  .addGroup(tryoutsMutationsInternalScoringGroup)
  .addGroup(tryoutsMutationsInternalStatsGroup);

export { tryoutsMutationsInternalGroup };
