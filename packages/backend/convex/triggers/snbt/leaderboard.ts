import {
  globalLeaderboard,
  tryoutLeaderboard,
} from "@repo/backend/convex/snbt/aggregate";

/** Trigger for maintaining per-tryout leaderboard aggregate. */
export const tryoutLeaderboardTrigger = tryoutLeaderboard.trigger();

/** Trigger for maintaining global leaderboard aggregate. */
export const globalLeaderboardTrigger = globalLeaderboard.trigger();
