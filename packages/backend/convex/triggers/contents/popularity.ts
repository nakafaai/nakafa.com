import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";

/**
 * Keeps the popularity ranking aggregate synchronized with every counter row
 * write, so homepage top-N reads never fall back to table scans.
 */
export const learningPopularityRankingsTrigger =
  learningPopularityRankings.trigger();
