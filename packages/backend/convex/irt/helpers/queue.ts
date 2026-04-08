import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  IRT_OPERATIONAL_MODEL,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
  IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS,
} from "@repo/backend/convex/irt/policy";
import { workflow } from "@repo/backend/convex/workflow";
import { ConvexError } from "convex/values";

const MAX_CALIBRATION_QUEUE_ROWS_PER_ATTEMPT = 2;

/** Starts one durable calibration workflow if the set is not already running. */
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

/**
 * Returns the single pending queue row for one attempt.
 *
 * Multiple rows for the same attempt indicate a broken queue invariant and are
 * rejected explicitly so the operator can repair the data instead of silently
 * continuing with ambiguous state.
 */
export async function getPendingCalibrationQueueEntryForAttempt(
  ctx: Pick<MutationCtx, "db">,
  attemptId: Id<"exerciseAttempts">
) {
  const queueEntries = await ctx.db
    .query("irtCalibrationQueue")
    .withIndex("by_attemptId_and_enqueuedAt", (q) =>
      q.eq("attemptId", attemptId)
    )
    .take(MAX_CALIBRATION_QUEUE_ROWS_PER_ATTEMPT);

  if (queueEntries.length <= 1) {
    return queueEntries[0] ?? null;
  }

  throw new ConvexError({
    code: "IRT_CALIBRATION_QUEUE_DUPLICATE_ATTEMPT",
    message: "Multiple pending calibration queue rows exist for one attempt.",
  });
}

/**
 * Ensure one attempt owns exactly one pending queue row for its current set.
 *
 * Repeated syncs preserve the original enqueue timestamp so the documented
 * staleness gate still measures how long the pending calibration evidence has
 * been waiting, not how recently one answer was edited.
 */
export async function ensurePendingCalibrationQueueEntry(
  ctx: Pick<MutationCtx, "db">,
  {
    attemptId,
    enqueuedAt,
    setId,
  }: {
    attemptId: Id<"exerciseAttempts">;
    enqueuedAt: number;
    setId: Id<"exerciseSets">;
  }
) {
  const existingQueueEntry = await getPendingCalibrationQueueEntryForAttempt(
    ctx,
    attemptId
  );

  if (!existingQueueEntry) {
    await ctx.db.insert("irtCalibrationQueue", {
      setId,
      attemptId,
      enqueuedAt,
    });

    return null;
  }

  if (existingQueueEntry.setId === setId) {
    return null;
  }

  await ctx.db.patch("irtCalibrationQueue", existingQueueEntry._id, {
    setId,
    enqueuedAt,
  });

  return null;
}

/** Remove the pending calibration queue row for one attempt, if it exists. */
export async function removePendingCalibrationQueueEntry(
  ctx: Pick<MutationCtx, "db">,
  attemptId: Id<"exerciseAttempts">
) {
  const existingQueueEntry = await getPendingCalibrationQueueEntryForAttempt(
    ctx,
    attemptId
  );

  if (!existingQueueEntry) {
    return null;
  }

  await ctx.db.delete("irtCalibrationQueue", existingQueueEntry._id);
  return null;
}

/** Returns the pending calibration queue rows that are newer than the last successful run. */
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

/** Deletes one bounded batch of processed calibration queue rows. */
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

/** Deletes one bounded batch of processed scale-publication queue rows. */
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

/** Enqueues one tryout for scale-quality refresh if it is not already queued. */
export async function enqueueScaleQualityRefresh(
  ctx: Pick<MutationCtx, "db">,
  {
    enqueuedAt,
    tryoutId,
  }: {
    enqueuedAt: number;
    tryoutId: Id<"tryouts">;
  }
) {
  const now = Date.now();
  const existingEntry = await ctx.db
    .query("irtScaleQualityRefreshQueue")
    .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
    .first();

  if (!existingEntry) {
    await ctx.db.insert("irtScaleQualityRefreshQueue", {
      tryoutId,
      enqueuedAt,
    });

    return true;
  }

  if (
    existingEntry.processingStartedAt !== undefined &&
    existingEntry.processingStartedAt <=
      now - IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS
  ) {
    await ctx.db.replace("irtScaleQualityRefreshQueue", existingEntry._id, {
      tryoutId,
      enqueuedAt,
    });

    return true;
  }

  return false;
}
