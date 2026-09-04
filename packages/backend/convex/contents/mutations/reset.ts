import { internal } from "@repo/backend/convex/_generated/api";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  getPopularityResetReport,
  runPopularityResetAggregate,
  verifyPopularityReset,
} from "@repo/backend/convex/contents/reset/aggregate";
import {
  runPopularityResetPage,
  startPopularityReset,
} from "@repo/backend/convex/contents/reset/page";
import {
  type AggregatePopularityResetResult,
  aggregatePopularityResetArgs,
  aggregatePopularityResetResultValidator,
  type PopularityResetPageResult,
  type PopularityResetReport,
  popularityResetPageArgs,
  popularityResetPageResultValidator,
  popularityResetReportValidator,
  type StartPopularityResetResult,
  startPopularityResetResultValidator,
  type VerifyPopularityResetResult,
  verifyPopularityResetResultValidator,
} from "@repo/backend/convex/contents/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Activates the popularity reset latch and schedules its first bounded page. */
export const start = internalMutation({
  args: {},
  returns: startPopularityResetResultValidator,
  handler: async (ctx): Promise<StartPopularityResetResult> =>
    await runConvexProgram(
      startPopularityReset(ctx, internal.contents.mutations.reset.page)
    ),
});

/** Deletes one bounded page from the five reset-owned tables. */
export const page = internalMutation({
  args: popularityResetPageArgs,
  returns: popularityResetPageResultValidator,
  handler: async (ctx, args): Promise<PopularityResetPageResult> =>
    await runConvexProgram(
      runPopularityResetPage(
        ctx,
        args,
        internal.contents.mutations.reset.page,
        internal.contents.mutations.reset.aggregate
      )
    ),
});

/** Clears orphaned ranking entries one namespace at a time. */
export const aggregate = internalMutation({
  args: aggregatePopularityResetArgs,
  returns: aggregatePopularityResetResultValidator,
  handler: async (ctx, args): Promise<AggregatePopularityResetResult> =>
    await runConvexProgram(
      runPopularityResetAggregate(
        ctx,
        args,
        internal.contents.mutations.reset.aggregate,
        internal.contents.mutations.reset.verify
      )
    ),
});

/** Rechecks every reset-owned table and ranking namespace after a quiet period. */
export const verify = internalMutation({
  args: {},
  returns: verifyPopularityResetResultValidator,
  handler: async (ctx): Promise<VerifyPopularityResetResult> =>
    await runConvexProgram(
      verifyPopularityReset(ctx, internal.contents.mutations.reset.page)
    ),
});

/** Reports the popularity reset's durable completion proof. */
export const report = internalQuery({
  args: {},
  returns: popularityResetReportValidator,
  handler: async (ctx): Promise<PopularityResetReport> =>
    await runConvexProgram(getPopularityResetReport(ctx)),
});
