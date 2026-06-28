import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/convex/irt/policy";
import {
  getPublishableScaleSnapshot,
  hasPublishedScaleChanged,
} from "@repo/backend/convex/irt/scales/snapshot";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 16, 0, 0);

async function insertTryout(ctx: MutationCtx) {
  return await ctx.db.insert("tryouts", {
    catalogPosition: 1,
    cycleKey: "2026",
    detectedAt: NOW,
    isActive: true,
    label: "Set 1",
    locale: "id",
    partCount: 1,
    product: "snbt",
    slug: "2026-set-1",
    syncedAt: NOW,
    totalQuestionCount: 2,
  });
}

async function insertSet(ctx: MutationCtx) {
  return await ctx.db.insert("exerciseSets", {
    category: "high-school",
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    questionCount: 2,
    setName: "set-1",
    slug: "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    syncedAt: NOW,
    title: "Set 1",
    type: "snbt",
  });
}

async function insertQuestion(
  ctx: MutationCtx,
  {
    number,
    setId,
  }: {
    number: number;
    setId: Id<"exerciseSets">;
  }
) {
  return await ctx.db.insert("exerciseQuestions", {
    answerBody: `Answer ${number}`,
    category: "high-school",
    contentHash: `question-${number}`,
    date: NOW,
    exerciseType: "try-out",
    locale: "id",
    material: "quantitative-knowledge",
    number,
    questionBody: `Question ${number}`,
    setId,
    setName: "set-1",
    slug: `material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/${number}`,
    syncedAt: NOW,
    title: `Question ${number}`,
    type: "snbt",
  });
}

async function insertCalibrationRun(
  ctx: MutationCtx,
  setId: Id<"exerciseSets">
) {
  return await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 12,
    completedAt: NOW,
    iterationCount: 8,
    maxParameterDelta: 0.001,
    model: IRT_OPERATIONAL_MODEL,
    questionCount: 2,
    responseCount: 24,
    setId,
    startedAt: NOW - 1000,
    status: "completed",
    updatedAt: NOW,
  });
}

async function insertCalibratedParams(
  ctx: MutationCtx,
  {
    calibrationRunId,
    difficulty,
    questionId,
    setId,
  }: {
    calibrationRunId?: Id<"irtCalibrationRuns">;
    difficulty: number;
    questionId: Id<"exerciseQuestions">;
    setId: Id<"exerciseSets">;
  }
) {
  await ctx.db.insert("exerciseItemParameters", {
    calibratedAt: NOW,
    calibrationStatus: calibrationRunId ? "calibrated" : "emerging",
    correctRate: 0.5,
    difficulty,
    discrimination: 1.2,
    questionId,
    responseCount: 12,
    setId,
    ...(calibrationRunId ? { calibrationRunId } : {}),
  });
}

async function insertSnapshotFixture(ctx: MutationCtx) {
  const tryoutId = await insertTryout(ctx);
  const setId = await insertSet(ctx);

  await ctx.db.insert("tryoutPartSets", {
    partIndex: 0,
    partKey: "quantitative-knowledge",
    setId,
    tryoutId,
  });

  const firstQuestionId = await insertQuestion(ctx, { number: 1, setId });
  const secondQuestionId = await insertQuestion(ctx, { number: 2, setId });
  const calibrationRunId = await insertCalibrationRun(ctx, setId);

  return {
    calibrationRunId,
    firstQuestionId,
    secondQuestionId,
    setId,
    tryoutId,
  };
}

describe("irt/scales/snapshot", () => {
  it("returns null when the tryout no longer exists", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      const tryoutId = await insertTryout(ctx);
      await ctx.db.delete("tryouts", tryoutId);

      return await getPublishableScaleSnapshot(ctx.db, tryoutId);
    });

    expect(snapshot).toBeNull();
  });

  it("returns null until every question has calibrated parameters from a run", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      const fixture = await insertSnapshotFixture(ctx);

      await insertCalibratedParams(ctx, {
        calibrationRunId: fixture.calibrationRunId,
        difficulty: -0.2,
        questionId: fixture.firstQuestionId,
        setId: fixture.setId,
      });
      await insertCalibratedParams(ctx, {
        difficulty: 0.4,
        questionId: fixture.secondQuestionId,
        setId: fixture.setId,
      });

      return await getPublishableScaleSnapshot(ctx.db, fixture.tryoutId);
    });

    expect(snapshot).toBeNull();
  });

  it("builds a frozen snapshot when every question is calibrated", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      const fixture = await insertSnapshotFixture(ctx);

      await insertCalibratedParams(ctx, {
        calibrationRunId: fixture.calibrationRunId,
        difficulty: -0.2,
        questionId: fixture.firstQuestionId,
        setId: fixture.setId,
      });
      await insertCalibratedParams(ctx, {
        calibrationRunId: fixture.calibrationRunId,
        difficulty: 0.4,
        questionId: fixture.secondQuestionId,
        setId: fixture.setId,
      });

      return await getPublishableScaleSnapshot(ctx.db, fixture.tryoutId);
    });

    expect(snapshot).toMatchObject({
      questionCount: 2,
      items: [
        expect.objectContaining({ difficulty: -0.2 }),
        expect.objectContaining({ difficulty: 0.4 }),
      ],
    });
  });

  it("compares published scale items by question and calibration run", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const fixture = await insertSnapshotFixture(ctx);

      await insertCalibratedParams(ctx, {
        calibrationRunId: fixture.calibrationRunId,
        difficulty: -0.2,
        questionId: fixture.firstQuestionId,
        setId: fixture.setId,
      });
      await insertCalibratedParams(ctx, {
        calibrationRunId: fixture.calibrationRunId,
        difficulty: 0.4,
        questionId: fixture.secondQuestionId,
        setId: fixture.setId,
      });

      const snapshot = await getPublishableScaleSnapshot(
        ctx.db,
        fixture.tryoutId
      );
      if (!snapshot) {
        throw new Error("Expected a publishable scale snapshot.");
      }

      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: IRT_OPERATIONAL_MODEL,
        publishedAt: NOW,
        questionCount: snapshot.questionCount,
        status: "official",
        tryoutId: fixture.tryoutId,
      });

      for (const item of snapshot.items) {
        await ctx.db.insert("irtScaleVersionItems", {
          calibrationRunId: item.calibrationRunId,
          difficulty: item.difficulty,
          discrimination: item.discrimination,
          questionId: item.questionId,
          scaleVersionId,
          setId: item.setId,
        });
      }

      const publishedItems = await ctx.db
        .query("irtScaleVersionItems")
        .withIndex("by_scaleVersionId_and_setId_and_questionId", (q) =>
          q.eq("scaleVersionId", scaleVersionId)
        )
        .collect();
      const otherRunId = await insertCalibrationRun(ctx, fixture.setId);
      const extraQuestionId = await insertQuestion(ctx, {
        number: 3,
        setId: fixture.setId,
      });
      const changedRunItems = snapshot.items.map((item, index) =>
        index === 0 ? { ...item, calibrationRunId: otherRunId } : item
      );
      const missingQuestionItems = snapshot.items.map((item, index) =>
        index === 0 ? { ...item, questionId: extraQuestionId } : item
      );

      return {
        changedRun: hasPublishedScaleChanged({
          publishedItems,
          snapshotItems: changedRunItems,
        }),
        lengthMismatch: hasPublishedScaleChanged({
          publishedItems: publishedItems.slice(1),
          snapshotItems: snapshot.items,
        }),
        missingQuestion: hasPublishedScaleChanged({
          publishedItems,
          snapshotItems: missingQuestionItems,
        }),
        unchanged: hasPublishedScaleChanged({
          publishedItems,
          snapshotItems: snapshot.items,
        }),
      };
    });

    expect(result).toEqual({
      changedRun: true,
      lengthMismatch: true,
      missingQuestion: true,
      unchanged: false,
    });
  });
});
