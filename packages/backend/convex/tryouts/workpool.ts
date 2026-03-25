import { Workpool } from "@convex-dev/workpool";
import { components } from "@repo/backend/convex/_generated/api";

/**
 * Serializes leaderboard upserts so one user/tryout pair cannot race into
 * duplicate leaderboard rows.
 */
export const tryoutLeaderboardWorkpool = new Workpool(
  components.tryoutLeaderboardWorkpool,
  {
    maxParallelism: 1,
  }
);
