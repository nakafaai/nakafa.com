import { GroupSpec } from "@confect/core";
import { tryoutsQueriesLeaderboardGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/leaderboard.spec";
import { tryoutsQueriesMeGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/me/me.spec";
import { tryoutsQueriesTryoutsGroup } from "@repo/backend/confect/modules/tryout/tryouts/queries/tryouts.spec";

const tryoutsQueriesGroup = GroupSpec.make("queries")
  .addGroup(tryoutsQueriesLeaderboardGroup)
  .addGroup(tryoutsQueriesTryoutsGroup)
  .addGroup(tryoutsQueriesMeGroup);

export { tryoutsQueriesGroup };
