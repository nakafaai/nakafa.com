import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const REAL_SNBT_SET_1_TRYOUT = {
  product: "snbt" as const,
  locale: "id" as const,
  cycleKey: "2026",
  slug: "2026-set-1",
  label: "Set 1",
  partCount: 7,
  totalQuestionCount: 150,
  isActive: true,
};

// Sourced from packages/contents/exercises/high-school/snbt/*/try-out/2026/set-1
const REAL_SNBT_SET_1_PARTS = [
  { partKey: "quantitative-knowledge", questionCount: 20 },
  { partKey: "mathematical-reasoning", questionCount: 20 },
  { partKey: "general-reasoning", questionCount: 20 },
  { partKey: "indonesian-language", questionCount: 30 },
  { partKey: "english-language", questionCount: 20 },
  { partKey: "general-knowledge", questionCount: 20 },
  { partKey: "reading-and-writing-skills", questionCount: 20 },
] as const;

const REAL_TRYOUT_DETECTED_AT = Date.UTC(2026, 3, 2, 11, 0, 0);
const SCALE_QUALITY_REBUILD_BATCH_SIZE = 100;

async function insertRealSnbtSet1Tryout(
  ctx: MutationCtx,
  overrides?: Partial<typeof REAL_SNBT_SET_1_TRYOUT>
) {
  return await ctx.db.insert("tryouts", {
    product: overrides?.product ?? REAL_SNBT_SET_1_TRYOUT.product,
    locale: overrides?.locale ?? REAL_SNBT_SET_1_TRYOUT.locale,
    cycleKey: overrides?.cycleKey ?? REAL_SNBT_SET_1_TRYOUT.cycleKey,
    slug: overrides?.slug ?? REAL_SNBT_SET_1_TRYOUT.slug,
    label: overrides?.label ?? REAL_SNBT_SET_1_TRYOUT.label,
    partCount: overrides?.partCount ?? REAL_SNBT_SET_1_TRYOUT.partCount,
    totalQuestionCount:
      overrides?.totalQuestionCount ??
      REAL_SNBT_SET_1_TRYOUT.totalQuestionCount,
    isActive: overrides?.isActive ?? REAL_SNBT_SET_1_TRYOUT.isActive,
    detectedAt: REAL_TRYOUT_DETECTED_AT,
    syncedAt: REAL_TRYOUT_DETECTED_AT,
  });
}

async function insertRealSnbtSet1Parts(
  ctx: MutationCtx,
  tryoutId: Id<"tryouts">
) {
  for (const [partIndex, part] of REAL_SNBT_SET_1_PARTS.entries()) {
    const setSlug = `exercises/high-school/snbt/${part.partKey}/try-out/2026/set-1`;
    const setId = await ctx.db.insert("exerciseSets", {
      locale: REAL_SNBT_SET_1_TRYOUT.locale,
      slug: setSlug,
      category: "high-school",
      type: REAL_SNBT_SET_1_TRYOUT.product,
      material: part.partKey,
      exerciseType: "try-out",
      setName: "set-1",
      title: REAL_SNBT_SET_1_TRYOUT.label,
      questionCount: part.questionCount,
      syncedAt: REAL_TRYOUT_DETECTED_AT,
    });

    await ctx.db.insert("tryoutPartSets", {
      tryoutId,
      setId,
      partIndex,
      partKey: part.partKey,
    });

    for (
      let questionNumber = 1;
      questionNumber <= part.questionCount;
      questionNumber += 1
    ) {
      await ctx.db.insert("exerciseQuestions", {
        setId,
        locale: REAL_SNBT_SET_1_TRYOUT.locale,
        slug: `${setSlug}/${questionNumber}`,
        category: "high-school",
        type: REAL_SNBT_SET_1_TRYOUT.product,
        material: part.partKey,
        exerciseType: "try-out",
        setName: "set-1",
        number: questionNumber,
        title: `Soal ${questionNumber}`,
        date: REAL_TRYOUT_DETECTED_AT,
        questionBody: `Pertanyaan ${questionNumber}`,
        answerBody: `Jawaban ${questionNumber}`,
        contentHash: `${part.partKey}-${questionNumber}`,
        syncedAt: REAL_TRYOUT_DETECTED_AT,
      });
    }
  }
}

describe("irt/mutations/internal/scales", () => {
  it("returns zero work when the quality refresh queue is empty", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
      {}
    );

    expect(result).toEqual({
      processedCount: 0,
      scheduledCount: 0,
    });
  });

  it("returns null when the scale publication queue is empty", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(
      internal.irt.mutations.internal.scales.drainScalePublicationQueue,
      {}
    );

    expect(result).toBeNull();
  });

  it("cleans publication queue rows even when refresh is already queued", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 2, 11, 0, 0)));

    const t = convexTest(schema, convexModules);

    const tryoutId = await t.mutation(async (ctx) => {
      const tryoutId = await insertRealSnbtSet1Tryout(ctx, {
        isActive: true,
      });

      await insertRealSnbtSet1Parts(ctx, tryoutId);

      await ctx.db.insert("irtScalePublicationQueue", {
        tryoutId,
        enqueuedAt: Date.now() - 1000,
      });
      await ctx.db.insert("irtScaleQualityRefreshQueue", {
        tryoutId,
        enqueuedAt: Date.now() - 500,
      });

      return tryoutId;
    });

    await t.mutation(
      internal.irt.mutations.internal.scales.drainScalePublicationQueue,
      {}
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const result = await t.query(async (ctx) => {
      return {
        publicationEntries: await ctx.db
          .query("irtScalePublicationQueue")
          .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
            q.eq("tryoutId", tryoutId)
          )
          .collect(),
        qualityCheck: await ctx.db
          .query("irtScaleQualityChecks")
          .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
          .unique(),
      };
    });

    expect(result.publicationEntries).toHaveLength(0);
    expect(result.qualityCheck).toMatchObject({
      tryoutId,
      status: "blocked",
      blockingReason: "missing-calibrated-items",
      totalQuestionCount: REAL_SNBT_SET_1_TRYOUT.totalQuestionCount,
      calibratedQuestionCount: 0,
      staleQuestionCount: 0,
      minAttemptCount: 0,
    });

    vi.useRealTimers();
  });

  it("re-enqueues failed quality refresh work for a malformed tryout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 2, 11, 30, 0)));

    const t = convexTest(schema, convexModules);

    const tryoutId = await t.mutation(async (ctx) => {
      const tryoutId = await insertRealSnbtSet1Tryout(ctx, {
        isActive: true,
        slug: "2026-set-1-malformed",
      });

      await ctx.db.insert("irtScaleQualityRefreshQueue", {
        tryoutId,
        enqueuedAt: Date.now() - 1000,
      });

      return tryoutId;
    });

    await t.mutation(
      internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
      {}
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const result = await t.query(async (ctx) => {
      return {
        queueEntries: await ctx.db
          .query("irtScaleQualityRefreshQueue")
          .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
          .collect(),
        qualityCheck: await ctx.db
          .query("irtScaleQualityChecks")
          .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
          .unique(),
      };
    });

    expect(result.queueEntries).toHaveLength(1);
    expect(result.qualityCheck).toBeNull();

    vi.useRealTimers();
  });

  it("queues refresh work for eligible tryouts and skips ones already pending publication", async () => {
    const t = convexTest(schema, convexModules);

    const { eligibleTryoutId, queuedTryoutId } = await t.mutation(
      async (ctx) => {
        const eligibleTryoutId = await insertRealSnbtSet1Tryout(ctx, {
          partCount: 0,
          totalQuestionCount: 0,
          isActive: true,
        });
        const queuedTryoutId = await insertRealSnbtSet1Tryout(ctx, {
          partCount: 0,
          totalQuestionCount: 0,
          isActive: true,
          slug: "2026-set-1-pending-publication",
          label: "Set 1 Pending Publication",
        });

        await ctx.db.insert("irtScalePublicationQueue", {
          tryoutId: queuedTryoutId,
          enqueuedAt: REAL_TRYOUT_DETECTED_AT - 1000,
        });

        return { eligibleTryoutId, queuedTryoutId };
      }
    );

    const result = await t.mutation(
      internal.irt.mutations.internal.scales.rebuildScaleQualityChecksPage,
      {}
    );

    const queueEntries = await t.query(async (ctx) => {
      return await ctx.db
        .query("irtScaleQualityRefreshQueue")
        .withIndex("by_enqueuedAt")
        .collect();
    });

    expect(result).toEqual({
      isDone: true,
      processedCount: 2,
    });
    expect(queueEntries).toHaveLength(1);
    expect(queueEntries[0]?.tryoutId).toBe(eligibleTryoutId);
    expect(queueEntries[0]?.tryoutId).not.toBe(queuedTryoutId);
  });

  it("schedules follow-up rebuild pages when the first page is full", async () => {
    const t = convexTest(schema, convexModules);

    const firstPageResult = await t.mutation(async (ctx) => {
      for (
        let index = 0;
        index <= SCALE_QUALITY_REBUILD_BATCH_SIZE;
        index += 1
      ) {
        await insertRealSnbtSet1Tryout(ctx, {
          partCount: 0,
          totalQuestionCount: 0,
          isActive: true,
          slug: `2026-set-1-page-${index + 1}`,
          label: `Set 1 Page ${index + 1}`,
        });
      }

      return await ctx.runMutation(
        internal.irt.mutations.internal.scales.rebuildScaleQualityChecksPage,
        {}
      );
    });

    const refreshQueueCount = await t.query(async (ctx) => {
      return (await ctx.db.query("irtScaleQualityRefreshQueue").collect())
        .length;
    });

    expect(firstPageResult).toEqual({
      isDone: false,
      processedCount: SCALE_QUALITY_REBUILD_BATCH_SIZE,
    });
    expect(refreshQueueCount).toBe(SCALE_QUALITY_REBUILD_BATCH_SIZE);
  });

  it("processes a follow-up rebuild page from a real pagination cursor", async () => {
    const t = convexTest(schema, convexModules);

    const continueCursor = await t.mutation(async (ctx) => {
      for (
        let index = 0;
        index <= SCALE_QUALITY_REBUILD_BATCH_SIZE;
        index += 1
      ) {
        await insertRealSnbtSet1Tryout(ctx, {
          partCount: 0,
          totalQuestionCount: 0,
          isActive: true,
          slug: `2026-set-1-followup-${index + 1}`,
          label: `Set 1 Follow-up ${index + 1}`,
        });
      }

      const page = await ctx.db.query("tryouts").paginate({
        cursor: null,
        numItems: SCALE_QUALITY_REBUILD_BATCH_SIZE,
      });

      return page.continueCursor;
    });

    const secondPageResult = await t.mutation(
      internal.irt.mutations.internal.scales.rebuildScaleQualityChecksPage,
      {
        cursor: continueCursor,
      }
    );

    const refreshQueueCount = await t.query(async (ctx) => {
      return (await ctx.db.query("irtScaleQualityRefreshQueue").collect())
        .length;
    });

    expect(secondPageResult).toEqual({
      isDone: true,
      processedCount: 1,
    });
    expect(refreshQueueCount).toBe(1);
  });

  it("schedules a follow-up drain when one full refresh batch is consumed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 3, 2, 12, 0, 0)));

    const t = convexTest(schema, convexModules);

    const tryoutId = await t.mutation(async (ctx) => {
      const tryoutId = await insertRealSnbtSet1Tryout(ctx, {
        isActive: true,
      });

      await insertRealSnbtSet1Parts(ctx, tryoutId);

      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert("irtScaleQualityRefreshQueue", {
          tryoutId,
          enqueuedAt: REAL_TRYOUT_DETECTED_AT - 1000 - index,
        });
      }

      return tryoutId;
    });

    const result = await t.mutation(
      internal.irt.mutations.internal.scales.drainScaleQualityRefreshQueue,
      {}
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const queueEntries = await t.query(async (ctx) => {
      return await ctx.db
        .query("irtScaleQualityRefreshQueue")
        .withIndex("by_tryoutId", (q) => q.eq("tryoutId", tryoutId))
        .collect();
    });

    expect(result).toEqual({
      processedCount: 25,
      scheduledCount: 1,
    });
    expect(queueEntries).toHaveLength(0);

    vi.useRealTimers();
  });
});
