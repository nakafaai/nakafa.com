import { internal } from "@repo/backend/convex/_generated/api";
import { recordUniqueContentView } from "@repo/backend/convex/contents/views/impl";
import {
  type RecordContentViewResult,
  recordContentViewArgs,
  recordContentViewResultValidator,
} from "@repo/backend/convex/contents/views/spec";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/**
 * Records a unique content view per user or device.
 *
 * Uses the trigger-aware native mutation builder so content-view analytics
 * triggers stay atomic with the durable view write.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 */
export const recordContentView = mutation({
  args: recordContentViewArgs,
  returns: recordContentViewResultValidator,
  handler: async (ctx, args): Promise<RecordContentViewResult> =>
    await runConvexProgram(
      recordUniqueContentView(
        ctx,
        args,
        internal.contents.mutations.analytics.scheduleContentAnalyticsPartition
      )
    ),
});
