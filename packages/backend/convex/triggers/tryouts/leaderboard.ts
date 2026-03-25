import {
  globalLeaderboard,
  tryoutLeaderboard,
} from "@repo/backend/convex/tryouts/aggregate";

export const tryoutLeaderboardTrigger = tryoutLeaderboard.trigger();

export const globalLeaderboardTrigger = globalLeaderboard.trigger();
