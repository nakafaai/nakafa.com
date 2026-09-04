import { internal } from "@repo/backend/convex/_generated/api";
import {
  type ExpireLearningPopularityWindowPageResult,
  expireLearningPopularityWindowPageArgs,
  expireLearningPopularityWindowPageResultValidator,
  type RefreshLearningPopularityWindowPageResult,
  refreshLearningPopularityWindowPageArgs,
  refreshLearningPopularityWindowPageResultValidator,
  type ScheduleLearningPopularityExpiriesResult,
  type ScheduleLearningPopularityRefreshesResult,
  type SweepLearningPopularityRetentionResult,
  scheduleLearningPopularityExpiriesResultValidator,
  scheduleLearningPopularityRefreshesResultValidator,
  sweepLearningPopularityRetentionArgs,
  sweepLearningPopularityRetentionResultValidator,
} from "@repo/backend/convex/contents/analytics/spec";
import {
  expireLearningPopularityWindowPage as expireLearningPopularityWindowPageProgram,
  scheduleLearningPopularityExpiries as scheduleLearningPopularityExpiriesProgram,
} from "@repo/backend/convex/contents/metrics/expiry";
import {
  refreshLearningPopularityWindowPage as refreshLearningPopularityWindowPageProgram,
  scheduleLearningPopularityRefreshes as scheduleLearningPopularityRefreshesProgram,
} from "@repo/backend/convex/contents/metrics/refresh";
import { sweepLearningPopularityRetention as sweepLearningPopularityRetentionProgram } from "@repo/backend/convex/contents/metrics/retention";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Schedules daily expiry or a full repair after any missed cycle. */
export const scheduleLearningPopularityExpiries = internalMutation({
  args: {},
  returns: scheduleLearningPopularityExpiriesResultValidator,
  handler: async (ctx): Promise<ScheduleLearningPopularityExpiriesResult> =>
    await runConvexProgram(
      scheduleLearningPopularityExpiriesProgram(
        ctx,
        internal.contents.mutations.popularity
          .expireLearningPopularityWindowPage,
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage
      )
    ),
});

/** Schedules finite popularity-window read-model refresh work. */
export const scheduleLearningPopularityRefreshes = internalMutation({
  args: {},
  returns: scheduleLearningPopularityRefreshesResultValidator,
  handler: async (ctx): Promise<ScheduleLearningPopularityRefreshesResult> =>
    await runConvexProgram(
      scheduleLearningPopularityRefreshesProgram(
        ctx,
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage
      )
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
      refreshLearningPopularityWindowPageProgram(
        ctx,
        args,
        internal.contents.mutations.popularity
          .refreshLearningPopularityWindowPage,
        internal.contents.mutations.popularity.sweepLearningPopularityRetention
      )
    ),
});

/** Expires one bounded page with one outgoing-signal lookup per counter. */
export const expireLearningPopularityWindowPage = internalMutation({
  args: expireLearningPopularityWindowPageArgs,
  returns: expireLearningPopularityWindowPageResultValidator,
  handler: async (
    ctx,
    args
  ): Promise<ExpireLearningPopularityWindowPageResult> =>
    await runConvexProgram(
      expireLearningPopularityWindowPageProgram(
        ctx,
        args,
        internal.contents.mutations.popularity
          .expireLearningPopularityWindowPage,
        internal.contents.mutations.popularity.sweepLearningPopularityRetention
      )
    ),
});

/** Deletes one indexed page after all finite daily maintenance completes. */
export const sweepLearningPopularityRetention = internalMutation({
  args: sweepLearningPopularityRetentionArgs,
  returns: sweepLearningPopularityRetentionResultValidator,
  handler: async (ctx, args): Promise<SweepLearningPopularityRetentionResult> =>
    await runConvexProgram(
      sweepLearningPopularityRetentionProgram(
        ctx,
        args,
        internal.contents.mutations.popularity.sweepLearningPopularityRetention
      )
    ),
});
