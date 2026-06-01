import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { listTrendingSubjects } from "@repo/backend/convex/subjectSections/trending/impl";
import {
  getTrendingSubjectsArgs,
  getTrendingSubjectsResultValidator,
} from "@repo/backend/convex/subjectSections/trending/spec";

/**
 * Get trending subjects for a time range.
 *
 * Timestamps should be rounded to the helper's day bucket for caching.
 * Use getTrendingTimeRange(days, nowMs) helper.
 *
 * @see https://docs.convex.dev/understanding/best-practices/#date-in-queries
 * @see https://docs.convex.dev/understanding/best-practices/#only-use-collect-with-a-small-number-of-results
 */
export const getTrendingSubjects = query({
  args: getTrendingSubjectsArgs,
  returns: getTrendingSubjectsResultValidator,
  handler: async (ctx, args) =>
    await runConvexProgram(listTrendingSubjects(ctx, args)),
});
