import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";

/** Returns the latest successful calibration run start time for one set. */
export async function getLatestCompletedCalibrationRunStartedAt(
  ctx: QueryCtx,
  latestCompletedRunStartedAtBySetId: Map<
    Id<"exerciseSets">,
    number | undefined
  >,
  setId: Id<"exerciseSets">
) {
  if (latestCompletedRunStartedAtBySetId.has(setId)) {
    return latestCompletedRunStartedAtBySetId.get(setId);
  }

  const latestCompletedRun = await ctx.db
    .query("irtCalibrationRuns")
    .withIndex("by_setId_and_status_and_startedAt", (q) =>
      q.eq("setId", setId).eq("status", "completed")
    )
    .order("desc")
    .first();
  const startedAt = latestCompletedRun?.startedAt;

  latestCompletedRunStartedAtBySetId.set(setId, startedAt);
  return startedAt;
}
