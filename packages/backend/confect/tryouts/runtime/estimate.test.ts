import { describe, expect, it } from "@effect/vitest";
import { estimateIrtScore } from "@repo/backend/confect/tryouts/runtime/estimate";
import { Array as Arr, Effect } from "effect";

/** The parameters of one calibrated item at the scale's centre. */
const item = { difficulty: 0, discrimination: 1 };
type IrtItem = typeof item;

describe("tryouts/runtime/estimate", () => {
  it.effect(
    "returns the scale midpoint for balanced equal-difficulty answers",
    () =>
      Effect.gen(function* () {
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

  it.effect.each([
    { isCorrect: true, theta: 4, publishedScore: 900 },
    { isCorrect: false, theta: -4, publishedScore: 100 },
  ])(
    "bounds an all-$isCorrect response vector",
    ({ isCorrect, theta, publishedScore }) =>
      Effect.gen(function* () {
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

  it.effect(
    "preserves the difficulty shift of a balanced calibrated response vector",
    () =>
      Effect.gen(function* () {
        const shifted = { ...item, difficulty: 1.5 };
        const result = yield* estimateIrtScore([
          { isCorrect: true, item: shifted },
          { isCorrect: false, item: shifted },
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

  it.effect.each([
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
        const error = yield* Effect.flip(
          estimateIrtScore([
            {
              isCorrect: true,
              item: { ...item, difficulty, discrimination },
            },
          ])
        );

        expect(error).toMatchObject({
          _tag: "TryoutRuntimeError",
          code: "TRYOUT_IRT_INFORMATION_TOO_LOW",
        });
      })
  );

  it.effect(
    "rejects Fisher information overflow at the final bounded estimate",
    () =>
      Effect.gen(function* () {
        const answers = Arr.map(
          [
            { discrimination: 12.6, difficulty: 4.7, isCorrect: true },
            { discrimination: 8.2, difficulty: 0.2, isCorrect: false },
            { discrimination: 7.1, difficulty: -3.4, isCorrect: true },
            { discrimination: 10.7, difficulty: 2.7, isCorrect: false },
            { discrimination: 12.3, difficulty: 4.2, isCorrect: false },
            { discrimination: 14.2, difficulty: -3, isCorrect: true },
            { discrimination: 10.8, difficulty: 2, isCorrect: true },
            { discrimination: 3.9, difficulty: 3, isCorrect: false },
          ],
          ({ isCorrect, ...parameters }) => ({
            isCorrect,
            item: { ...item, ...parameters },
          })
        );
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

  it.effect.each([
    {
      kind: "non-positive discrimination",
      update: (item: IrtItem) => ({ ...item, discrimination: 0 }),
    },
    {
      kind: "non-finite discrimination",
      update: (item: IrtItem) => ({
        ...item,
        discrimination: Number.NaN,
      }),
    },
    {
      kind: "non-finite difficulty",
      update: (item: IrtItem) => ({
        ...item,
        difficulty: Number.POSITIVE_INFINITY,
      }),
    },
    {
      kind: "overflowing finite discrimination",
      update: (item: IrtItem) => ({
        ...item,
        discrimination: Number.MAX_VALUE,
      }),
    },
  ])("rejects $kind", ({ update }) =>
    Effect.gen(function* () {
      const changed = update(item);
      const error = yield* Effect.flip(
        estimateIrtScore([{ isCorrect: true, item: changed }])
      );

      expect(error).toMatchObject({
        _tag: "TryoutRuntimeError",
        code: "TRYOUT_IRT_ITEM_INVALID",
      });
    })
  );
});
