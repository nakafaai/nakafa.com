import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/** Serializes leaderboard writes so best-score selection remains deterministic. */
export const tryoutLeaderboardWorkpool = new Workpool(
  components.tryoutLeaderboardWorkpool,
  {
    maxParallelism: 1,
  }
);
