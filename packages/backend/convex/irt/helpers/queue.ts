import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  IRT_OPERATIONAL_MODEL,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { workflow } from "@repo/backend/convex/workflow";
import { ConvexError } from "convex/values";

export async function startCalibrationRunWorkflow(
  ctx: MutationCtx,
  setId: Id<"exerciseSets">
) {
  const now = Date.now();
  const set = await ctx.db.get("exerciseSets", setId);

  if (!set) {
    throw new ConvexError({
      code: "IRT_SET_NOT_FOUND",
      message: "Exercise set not found for calibration.",
    });
  }

  const latestRun = await ctx.db
    .query("irtCalibrationRuns")
    .withIndex("by_setId_and_startedAt", (q) => q.eq("setId", setId))
    .order("desc")
    .first();

  if (latestRun?.status === "running") {
    return null;
  }

  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    setId,
    model: IRT_OPERATIONAL_MODEL,
    status: "running",
    questionCount: set.questionCount,
    responseCount: 0,
    attemptCount: 0,
    iterationCount: 0,
    maxParameterDelta: 0,
    startedAt: now,
    updatedAt: now,
  });

  await workflow.start(ctx, internal.irt.workflows.calibrateSetTwoPL, {
    calibrationRunId,
    setId,
  });

  return calibrationRunId;
}

export function getPendingCalibrationQueueQuery(
  ctx: Pick<MutationCtx, "db">,
  {
    lastSuccessfulRunStartedAt,
    setId,
  }: {
    lastSuccessfulRunStartedAt?: number;
    setId: Id<"exerciseSets">;
  }
) {
  return ctx.db
    .query("irtCalibrationQueue")
    .withIndex("by_setId_and_enqueuedAt", (q) => {
      const setQuery = q.eq("setId", setId);

      if (lastSuccessfulRunStartedAt === undefined) {
        return setQuery;
      }

      return setQuery.gt("enqueuedAt", lastSuccessfulRunStartedAt);
    });
}

export async function cleanupCalibrationQueueEntriesBatch(
  ctx: Pick<MutationCtx, "db">,
  {
    setId,
    throughAt,
  }: {
    setId: Id<"exerciseSets">;
    throughAt: number;
  }
) {
  const queueEntries = await ctx.db
    .query("irtCalibrationQueue")
    .withIndex("by_setId_and_enqueuedAt", (q) =>
      q.eq("setId", setId).lte("enqueuedAt", throughAt)
    )
    .take(IRT_QUEUE_CLEANUP_BATCH_SIZE);

  for (const entry of queueEntries) {
    await ctx.db.delete("irtCalibrationQueue", entry._id);
  }

  return queueEntries.length;
}

export async function cleanupScalePublicationQueueEntriesBatch(
  ctx: Pick<MutationCtx, "db">,
  tryoutId: Id<"tryouts">
) {
  const queueEntries = await ctx.db
    .query("irtScalePublicationQueue")
    .withIndex("by_tryoutId_and_enqueuedAt", (q) => q.eq("tryoutId", tryoutId))
    .take(IRT_QUEUE_CLEANUP_BATCH_SIZE);

  for (const entry of queueEntries) {
    await ctx.db.delete("irtScalePublicationQueue", entry._id);
  }

  return queueEntries.length;
}
