import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";

/** Serializes leaderboard writes so best-score selection remains deterministic. */
export const tryoutLeaderboardWorkpool = new Workpool(
  components.tryoutLeaderboardWorkpool,
  {
    maxParallelism: 1,
  }
);
