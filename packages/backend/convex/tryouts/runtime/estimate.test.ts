import { describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { estimateIrtScore } from "@repo/backend/convex/tryouts/runtime/estimate";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type IrtScaleItem = Doc<"irtScaleItems">;

async function loadIrtItem() {
  const t = convexTest(schema, convexModules);
  return await t.mutation(async (ctx) => {
    const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
      model: "2pl",
      publishedAt: 1,
      questionCount: 1,
      setIdentity: "estimate-test-set",
      status: "provisional",
      tryoutSnapshotId: "estimate-test-snapshot",
    });
    const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
      attemptCount: 0,
      completedAt: 1,
      iterationCount: 0,
      maxParameterDelta: 0,
      model: "2pl",
      questionCount: 1,
      responseCount: 0,
      scaleVersionId,
      sectionIdentity: "estimate-test-section",
      startedAt: 1,
      status: "completed",
      updatedAt: 1,
    });
    const itemId = await ctx.db.insert("irtScaleItems", {
      calibrationRunId,
      calibrationStatus: "provisional",
      correctRate: 0,
      difficulty: 0,
      discrimination: 1,
      placementIdentity: "estimate-test-placement",
      placementRowHash: "estimate-test-row",
      responseCount: 0,
      scaleVersionId,
    });
    const item = await ctx.db.get(itemId);
    if (!item) {
      throw new Error("Expected one IRT estimator item fixture.");
    }
    return item;
  });
}

describe("tryouts/runtime/estimate", () => {
  it.live(
    "returns the scale midpoint for balanced equal-difficulty answers",
    () =>
      Effect.gen(function* () {
        const item = yield* Effect.promise(() => loadIrtItem());
        const result = yield* estimateIrtScore([
          { isCorrect: true, item },
          { isCorrect: false, item },
        ]);

        expect(result).toMatchObject({
          publishedScore: 500,
          theta: 0,
        });
        expect(result.thetaSE).toBeCloseTo(Math.SQRT2, 12);
      })
  );

  it.live.each([
    { isCorrect: true, theta: 4, publishedScore: 900 },
    { isCorrect: false, theta: -4, publishedScore: 100 },
  ])(
    "bounds an all-$isCorrect response vector",
    ({ isCorrect, theta, publishedScore }) =>
      Effect.gen(function* () {
        const item = yield* Effect.promise(() => loadIrtItem());
        const result = yield* estimateIrtScore([{ isCorrect, item }]);

        expect(result.theta).toBe(theta);
        expect(result.publishedScore).toBe(publishedScore);
        const expected = 1 / (1 + Math.exp(-theta));
        expect(result.thetaSE).toBeCloseTo(
          1 / Math.sqrt(expected * (1 - expected)),
          10
        );
      })
  );

  it.live(
    "preserves the difficulty shift of a balanced calibrated response vector",
    () =>
      Effect.gen(function* () {
        const stored = yield* Effect.promise(() => loadIrtItem());
        const item = { ...stored, difficulty: 1.5 };
        const result = yield* estimateIrtScore([
          { isCorrect: true, item },
          { isCorrect: false, item },
        ]);

        expect(result.theta).toBeCloseTo(1.5, 3);
        expect(result.publishedScore).toBe(650);
        expect(result.thetaSE).toBeCloseTo(Math.SQRT2, 6);
      })
  );

  it.effect(
    "rejects an empty response vector with insufficient information",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(estimateIrtScore([]));
        expect(error).toMatchObject({
          _tag: "TryoutRuntimeError",
          code: "TRYOUT_IRT_INFORMATION_TOO_LOW",
        });
      })
  );

  it.live.each([
    {
      kind: "underflowing discrimination",
      difficulty: 0,
      discrimination: Number.MIN_VALUE,
    },
    { kind: "saturated probability", difficulty: 1000, discrimination: 1 },
  ])(
    "rejects $kind without publishing a score",
    ({ difficulty, discrimination }) =>
      Effect.gen(function* () {
        const stored = yield* Effect.promise(() => loadIrtItem());
        const error = yield* Effect.flip(
          estimateIrtScore([
            {
              isCorrect: true,
              item: { ...stored, difficulty, discrimination },
            },
          ])
        );

        expect(error).toMatchObject({
          _tag: "TryoutRuntimeError",
          code: "TRYOUT_IRT_INFORMATION_TOO_LOW",
        });
      })
  );

  it.live(
    "rejects Fisher information overflow at the final bounded estimate",
    () =>
      Effect.gen(function* () {
        const item = yield* Effect.promise(() => loadIrtItem());
        const answers = [
          { discrimination: 12.6, difficulty: 4.7, isCorrect: true },
          { discrimination: 8.2, difficulty: 0.2, isCorrect: false },
          { discrimination: 7.1, difficulty: -3.4, isCorrect: true },
          { discrimination: 10.7, difficulty: 2.7, isCorrect: false },
          { discrimination: 12.3, difficulty: 4.2, isCorrect: false },
          { discrimination: 14.2, difficulty: -3, isCorrect: true },
          { discrimination: 10.8, difficulty: 2, isCorrect: true },
          { discrimination: 3.9, difficulty: 3, isCorrect: false },
        ].map(({ isCorrect, ...parameters }) => ({
          isCorrect,
          item: { ...item, ...parameters },
        }));
        const baseline = yield* estimateIrtScore(answers);
        // These saturated items contribute no information before the final theta.
        // At that theta, individually finite terms overflow when accumulated.
        const saturated = Array.from({ length: 6 }, () => ({
          isCorrect: false,
          item: {
            ...item,
            difficulty: baseline.theta,
            discrimination: 1.2e154,
          },
        }));
        const error = yield* Effect.flip(
          estimateIrtScore([...answers, ...saturated])
        );

        expect(error).toMatchObject({
          _tag: "TryoutRuntimeError",
          code: "TRYOUT_IRT_ITEM_INVALID",
        });
      })
  );

  it.live.each([
    {
      kind: "non-positive discrimination",
      update: (item: IrtScaleItem) => ({ ...item, discrimination: 0 }),
    },
    {
      kind: "non-finite discrimination",
      update: (item: IrtScaleItem) => ({
        ...item,
        discrimination: Number.NaN,
      }),
    },
    {
      kind: "non-finite difficulty",
      update: (item: IrtScaleItem) => ({
        ...item,
        difficulty: Number.POSITIVE_INFINITY,
      }),
    },
    {
      kind: "overflowing finite discrimination",
      update: (item: IrtScaleItem) => ({
        ...item,
        discrimination: Number.MAX_VALUE,
      }),
    },
  ])("rejects $kind", ({ update }) =>
    Effect.gen(function* () {
      const item = update(yield* Effect.promise(() => loadIrtItem()));
      const error = yield* Effect.flip(
        estimateIrtScore([{ isCorrect: true, item }])
      );

      expect(error).toMatchObject({
        _tag: "TryoutRuntimeError",
        code: "TRYOUT_IRT_ITEM_INVALID",
      });
    })
  );
});
