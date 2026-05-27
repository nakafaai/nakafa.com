import { GroupSpec } from "@confect/core";
import { tryoutsQueriesLeaderboardGroup } from "./leaderboard.spec";
import { tryoutsQueriesMeGroup } from "./me/me.spec";
import { tryoutsQueriesTryoutsGroup } from "./tryouts.spec";

const tryoutsQueriesGroup = GroupSpec.make("queries")
  .addGroup(tryoutsQueriesLeaderboardGroup)
  .addGroup(tryoutsQueriesTryoutsGroup)
  .addGroup(tryoutsQueriesMeGroup);

export { tryoutsQueriesGroup };
