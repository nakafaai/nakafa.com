import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "@repo/backend/convex/_generated/api";

/** Per-tryout leaderboard aggregate sorted by highest theta first. */
export const tryoutLeaderboard = new TableAggregate(
  components.tryoutLeaderboard,
  {
    namespace: (entry) => entry.tryoutId,
    sortKey: (entry) => [
      -(entry.theta ?? Number.NEGATIVE_INFINITY),
      entry.userId,
    ],
  }
);

/** Global leaderboard aggregate sorted by highest average theta first. */
export const globalLeaderboard = new TableAggregate(
  components.globalLeaderboard,
  {
    namespace: (stats) => stats.leaderboardNamespace,
    sortKey: (stats) => [
      -(stats.averageTheta ?? Number.NEGATIVE_INFINITY),
      stats.userId,
    ],
  }
);
