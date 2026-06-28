import { internal } from "@repo/backend/convex/_generated/api";
import {
  claimContentAnalyticsPartition,
  processClaimedContentAnalyticsPartition,
  scheduleAllContentAnalyticsPartitions,
} from "@repo/backend/convex/contents/analytics/impl";
import {
  type ProcessContentAnalyticsPartitionResult,
  processContentAnalyticsPartitionArgs,
  processContentAnalyticsPartitionResultValidator,
  type ScheduleContentAnalyticsPartitionResult,
  type ScheduleContentAnalyticsPartitionsResult,
  scheduleContentAnalyticsPartitionArgs,
  scheduleContentAnalyticsPartitionResultValidator,
  scheduleContentAnalyticsPartitionsResultValidator,
} from "@repo/backend/convex/contents/analytics/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Schedules one worker attempt per analytics partition. */
export const scheduleContentAnalyticsPartitions = internalMutation({
  args: {},
  returns: scheduleContentAnalyticsPartitionsResultValidator,
  handler: async (ctx): Promise<ScheduleContentAnalyticsPartitionsResult> =>
    await runConvexProgram(
      scheduleAllContentAnalyticsPartitions(
        ctx,
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition
      )
    ),
});

/** Claims one partition lease and starts one bounded drain worker. */
export const scheduleContentAnalyticsPartition = internalMutation({
  args: scheduleContentAnalyticsPartitionArgs,
  returns: scheduleContentAnalyticsPartitionResultValidator,
  handler: async (
    ctx,
    args
  ): Promise<ScheduleContentAnalyticsPartitionResult> =>
    await runConvexProgram(
      claimContentAnalyticsPartition(
        ctx,
        args,
        internal.contents.mutations.analytics.processContentAnalyticsPartition
      )
    ),
});

/** Drains one leased analytics partition into derived popularity tables. */
export const processContentAnalyticsPartition = internalMutation({
  args: processContentAnalyticsPartitionArgs,
  returns: processContentAnalyticsPartitionResultValidator,
  handler: async (ctx, args): Promise<ProcessContentAnalyticsPartitionResult> =>
    await runConvexProgram(
      processClaimedContentAnalyticsPartition(
        ctx,
        args,
        internal.contents.mutations.analytics.processContentAnalyticsPartition
      )
    ),
});
