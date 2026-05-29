import { internal } from "@repo/backend/convex/_generated/api";
import {
  type ContentAnalyticsSchedulerTargets,
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

const schedulerTargets: ContentAnalyticsSchedulerTargets = {
  processPartition:
    internal.contents.mutations.analytics.processContentAnalyticsPartition,
  schedulePartition:
    internal.contents.mutations.analytics.scheduleContentAnalyticsPartition,
};

/** Schedules one worker attempt per analytics partition. */
export const scheduleContentAnalyticsPartitions = internalMutation({
  args: {},
  returns: scheduleContentAnalyticsPartitionsResultValidator,
  handler: async (ctx): Promise<ScheduleContentAnalyticsPartitionsResult> =>
    await runConvexProgram(
      scheduleAllContentAnalyticsPartitions(ctx, schedulerTargets)
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
      claimContentAnalyticsPartition(ctx, args, schedulerTargets)
    ),
});

/** Drains one leased analytics partition into derived popularity tables. */
export const processContentAnalyticsPartition = internalMutation({
  args: processContentAnalyticsPartitionArgs,
  returns: processContentAnalyticsPartitionResultValidator,
  handler: async (ctx, args): Promise<ProcessContentAnalyticsPartitionResult> =>
    await runConvexProgram(
      processClaimedContentAnalyticsPartition(ctx, args, schedulerTargets)
    ),
});
