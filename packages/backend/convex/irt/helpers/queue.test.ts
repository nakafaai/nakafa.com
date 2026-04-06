import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  cleanupCalibrationQueueEntriesBatch,
  cleanupScalePublicationQueueEntriesBatch,
  enqueueScaleQualityRefresh,
  getPendingCalibrationQueueQuery,
  startCalibrationRunWorkflow,
} from "@repo/backend/convex/irt/helpers/queue";
import { IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS } from "@repo/backend/convex/irt/policy";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { workflow } from "@repo/backend/convex/workflow";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 16, 0, 0);

async function insertExerciseSet(
  ctx: MutationCtx,
  slugSuffix: string,
  questionCount = 20
) {
  return await ctx.db.insert("exerciseSets", {
    locale: "id",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slugSuffix}`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: slugSuffix,
    title: `Set ${slugSuffix}`,
    questionCount,
    syncedAt: NOW,
  });
}

async function insertTryout(ctx: MutationCtx, slug: string) {
  return await ctx.db.insert("tryouts", {
    catalogPosition: 1,
    product: "snbt",
    locale: "id",
    cycleKey: "2026",
    slug,
    label: slug,
    partCount: 1,
    totalQuestionCount: 20,
    isActive: true,
    detectedAt: NOW,
    syncedAt: NOW,
  });
}

describe("irt/helpers/queue", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("throws when starting a calibration run for a missing set", async () => {
    const t = convexTest(schema, convexModules);
    const missingSetId = await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, "deleted");
      await ctx.db.delete("exerciseSets", setId);
      return setId;
    });

    await expect(
      t.mutation(async (ctx) => {
        await startCalibrationRunWorkflow(ctx, missingSetId);
      })
    ).rejects.toBeTruthy();
  });

  it("returns null when a calibration run is already active", async () => {
    const t = convexTest(schema, convexModules);
    const startSpy = vi
      .spyOn(workflow, "start")
      .mockResolvedValue(undefined as never);

    const result = await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, "running");

      await ctx.db.insert("irtCalibrationRuns", {
        setId,
        model: "2pl",
        status: "running",
        questionCount: 20,
        responseCount: 0,
        attemptCount: 0,
        iterationCount: 0,
        maxParameterDelta: 0,
        startedAt: NOW - 1000,
        updatedAt: NOW - 1000,
      });

      return await startCalibrationRunWorkflow(ctx, setId);
    });

    expect(result).toBeNull();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it("creates a new calibration run and starts the workflow", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);
    const startSpy = vi
      .spyOn(workflow, "start")
      .mockResolvedValue(undefined as never);

    const result = await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, "fresh", 30);

      await ctx.db.insert("irtCalibrationRuns", {
        setId,
        model: "2pl",
        status: "completed",
        questionCount: 30,
        responseCount: 120,
        attemptCount: 4,
        iterationCount: 3,
        maxParameterDelta: 0.01,
        startedAt: NOW - 5000,
        updatedAt: NOW - 4000,
        completedAt: NOW - 3000,
      });

      const calibrationRunId = await startCalibrationRunWorkflow(ctx, setId);
      const latestRun = calibrationRunId
        ? await ctx.db.get("irtCalibrationRuns", calibrationRunId)
        : null;

      return {
        calibrationRunId,
        latestRun,
        setId,
      };
    });

    expect(result.calibrationRunId).not.toBeNull();
    expect(result.latestRun).toMatchObject({
      _id: result.calibrationRunId,
      attemptCount: 0,
      model: "2pl",
      questionCount: 30,
      status: "running",
    });
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  it("returns all pending calibration rows when there is no successful cutoff", async () => {
    const t = convexTest(schema, convexModules);

    const queueEntries = await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, "no-cutoff");

      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        enqueuedAt: NOW - 2000,
      });
      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        enqueuedAt: NOW - 1000,
      });

      return await getPendingCalibrationQueueQuery(ctx, { setId }).collect();
    });

    expect(queueEntries).toHaveLength(2);
    expect(queueEntries.map((entry) => entry.enqueuedAt)).toEqual([
      NOW - 2000,
      NOW - 1000,
    ]);
  });

  it("filters pending calibration rows to entries newer than the last successful run", async () => {
    const t = convexTest(schema, convexModules);

    const queueEntries = await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, "with-cutoff");

      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        enqueuedAt: NOW - 3000,
      });
      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        enqueuedAt: NOW - 2000,
      });
      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        enqueuedAt: NOW - 1000,
      });

      return await getPendingCalibrationQueueQuery(ctx, {
        setId,
        lastSuccessfulRunStartedAt: NOW - 2000,
      }).collect();
    });

    expect(queueEntries).toHaveLength(1);
    expect(queueEntries[0]?.enqueuedAt).toBe(NOW - 1000);
  });

  it("cleans one bounded batch of calibration queue rows through a timestamp", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const setId = await insertExerciseSet(ctx, "cleanup-calibration");
      const otherSetId = await insertExerciseSet(
        ctx,
        "cleanup-calibration-other"
      );

      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        enqueuedAt: NOW - 3000,
      });
      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        enqueuedAt: NOW - 1000,
      });
      await ctx.db.insert("irtCalibrationQueue", {
        setId: otherSetId,
        enqueuedAt: NOW - 3000,
      });

      const deleted = await cleanupCalibrationQueueEntriesBatch(ctx, {
        setId,
        throughAt: NOW - 2000,
      });

      return {
        deleted,
        remainingForSet: await ctx.db
          .query("irtCalibrationQueue")
          .withIndex("by_setId_and_enqueuedAt", (q) => q.eq("setId", setId))
          .collect(),
        remainingForOtherSet: await ctx.db
          .query("irtCalibrationQueue")
          .withIndex("by_setId_and_enqueuedAt", (q) =>
            q.eq("setId", otherSetId)
          )
          .collect(),
      };
    });

    expect(result.deleted).toBe(1);
    expect(result.remainingForSet).toHaveLength(1);
    expect(result.remainingForSet[0]?.enqueuedAt).toBe(NOW - 1000);
    expect(result.remainingForOtherSet).toHaveLength(1);
  });

  it("cleans one bounded batch of publication queue rows for one tryout", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const tryoutId = await insertTryout(ctx, "cleanup-publication");
      const otherTryoutId = await insertTryout(
        ctx,
        "cleanup-publication-other"
      );

      await ctx.db.insert("irtScalePublicationQueue", {
        tryoutId,
        enqueuedAt: NOW - 2000,
      });
      await ctx.db.insert("irtScalePublicationQueue", {
        tryoutId,
        enqueuedAt: NOW - 1000,
      });
      await ctx.db.insert("irtScalePublicationQueue", {
        tryoutId: otherTryoutId,
        enqueuedAt: NOW - 1000,
      });

      const deleted = await cleanupScalePublicationQueueEntriesBatch(
        ctx,
        tryoutId
      );

      return {
        deleted,
        remainingForTryout: await ctx.db
          .query("irtScalePublicationQueue")
          .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
            q.eq("tryoutId", tryoutId)
          )
          .collect(),
        remainingForOtherTryout: await ctx.db
          .query("irtScalePublicationQueue")
          .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
            q.eq("tryoutId", otherTryoutId)
          )
          .collect(),
      };
    });

    expect(result.deleted).toBe(2);
    expect(result.remainingForTryout).toHaveLength(0);
    expect(result.remainingForOtherTryout).toHaveLength(1);
  });

  it("enqueues one fresh quality refresh row and blocks duplicate pending rows", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const tryoutId = await insertTryout(ctx, "refresh-pending");
      const firstEnqueue = await enqueueScaleQualityRefresh(ctx, {
        tryoutId,
        enqueuedAt: NOW - 1000,
      });
      const secondEnqueue = await enqueueScaleQualityRefresh(ctx, {
        tryoutId,
        enqueuedAt: NOW,
      });

      return {
        firstEnqueue,
        secondEnqueue,
        queueEntries: await ctx.db
          .query("irtScaleQualityRefreshQueue")
          .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
          .collect(),
      };
    });

    expect(result.firstEnqueue).toBe(true);
    expect(result.secondEnqueue).toBe(false);
    expect(result.queueEntries).toHaveLength(1);
    expect(result.queueEntries[0]).toMatchObject({
      enqueuedAt: NOW - 1000,
      tryoutId: result.queueEntries[0]?.tryoutId,
    });
  });

  it("reclaims a stale claimed quality refresh row", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const tryoutId = await insertTryout(ctx, "refresh-stale-claim");

      const queueEntryId = await ctx.db.insert("irtScaleQualityRefreshQueue", {
        tryoutId,
        enqueuedAt: NOW - IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS - 5000,
        processingStartedAt:
          NOW - IRT_SCALE_QUALITY_REFRESH_CLAIM_TIMEOUT_MS - 1000,
      });

      const reclaimed = await enqueueScaleQualityRefresh(ctx, {
        tryoutId,
        enqueuedAt: NOW,
      });

      return {
        reclaimed,
        queueEntry: await ctx.db.get(
          "irtScaleQualityRefreshQueue",
          queueEntryId as Id<"irtScaleQualityRefreshQueue">
        ),
      };
    });

    expect(result.reclaimed).toBe(true);
    expect(result.queueEntry).toMatchObject({
      enqueuedAt: NOW,
    });
    expect(result.queueEntry?.processingStartedAt).toBeUndefined();
  });
});
