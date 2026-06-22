import { internal } from "@repo/backend/convex/_generated/api";
import {
  type RefreshLearningPopularityWindowPageResult,
  refreshLearningPopularityWindowPageArgs,
  refreshLearningPopularityWindowPageResultValidator,
  type ScheduleLearningPopularityRefreshesResult,
  scheduleLearningPopularityRefreshesResultValidator,
} from "@repo/backend/convex/contents/analytics/spec";
import {
  type LearningPopularityRefreshTargets,
  refreshLearningPopularityWindowPage as refreshLearningPopularityWindowPageProgram,
  scheduleLearningPopularityRefreshes as scheduleLearningPopularityRefreshesProgram,
} from "@repo/backend/convex/contents/metrics/refresh";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

const refreshTargets: LearningPopularityRefreshTargets = {
  refreshWindowPage:
    internal.contents.mutations.popularity.refreshLearningPopularityWindowPage,
};

/** Schedules finite popularity-window read-model refresh work. */
export const scheduleLearningPopularityRefreshes = internalMutation({
  args: {},
  returns: scheduleLearningPopularityRefreshesResultValidator,
  handler: async (ctx): Promise<ScheduleLearningPopularityRefreshesResult> =>
    await runConvexProgram(
      scheduleLearningPopularityRefreshesProgram(ctx, refreshTargets)
    ),
});

/** Refreshes one bounded page of popularity counters from daily signals. */
export const refreshLearningPopularityWindowPage = internalMutation({
  args: refreshLearningPopularityWindowPageArgs,
  returns: refreshLearningPopularityWindowPageResultValidator,
  handler: async (
    ctx,
    args
  ): Promise<RefreshLearningPopularityWindowPageResult> =>
    await runConvexProgram(
      refreshLearningPopularityWindowPageProgram(ctx, args, refreshTargets)
    ),
});
