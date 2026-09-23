import { internal } from "@repo/backend/convex/_generated/api";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  type ClaimLearningPopularityRetentionResult,
  claimLearningPopularityRetentionResultValidator,
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
import { getPopularitySignalDay } from "@repo/backend/convex/contents/popularity";
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
          .refreshLearningPopularityWindowPage
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
          .expireLearningPopularityWindowPage
      )
    ),
});

/**
 * Drains the retired cron without claiming unsafe deletion. ADR 0001 requires
 * raw coverage, queue progress, lifetime and rank proof; finite cycles provide
 * none of those guarantees. Retire this handler after queued jobs are cleared.
 */
export const claimLearningPopularityRetention = internalMutation({
  args: {},
  returns: claimLearningPopularityRetentionResultValidator,
  handler: (): ClaimLearningPopularityRetentionResult => ({
    claimed: false,
    day: getPopularitySignalDay(Date.now()),
  }),
});

/** Drains previously scheduled pages while preserving unproven audit data. */
export const sweepLearningPopularityRetention = internalMutation({
  args: sweepLearningPopularityRetentionArgs,
  returns: sweepLearningPopularityRetentionResultValidator,
  handler: (): SweepLearningPopularityRetentionResult => ({
    deleted: 0,
    done: true,
    skipped: true,
  }),
});
