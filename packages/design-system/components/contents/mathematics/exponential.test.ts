import { describe, expect, it } from "@effect/vitest";
import {
  ExponentialError,
  resolveExponential,
} from "@repo/design-system/components/contents/mathematics/exponential";
import { Effect } from "effect";

describe("exponential chart models", () => {
  it.effect(
    "preserves exact integer observations and samples the exponential itself",
    () =>
      Effect.gen(function* () {
        const plot = yield* resolveExponential({ a: 2, p: 30 });
        expect(plot.values).toHaveLength(11);
        expect(plot.values.at(-1)).toEqual({ x: 10, y: 30_720 });
        for (const point of plot.curve) {
          expect(point.y).toBeCloseTo(30 * 2 ** point.x, 8);
        }
      })
  );
  it.effect(
    "keeps rebound heights discrete without inventing intermediate values",
    () =>
      Effect.gen(function* () {
        const plot = yield* resolveExponential({
          a: 0.6,
          p: 300,
          n: 3,
          mode: "discrete",
        });
        expect(plot.curve).toEqual([]);
        expect(plot.values).toEqual([
          { x: 0, y: 300 },
          { x: 1, y: 180 },
          { x: 2, y: 108 },
        ]);
      })
  );
  it.effect("represents the zero function without changing its values", () =>
    Effect.gen(function* () {
      const plot = yield* resolveExponential({ a: 1, p: 0, n: 2 });
      expect(plot.curve.every(({ y }) => y === 0)).toBe(true);
    })
  );
  it.effect.each([
    { a: 0, p: 1 },
    { a: -1, p: 1 },
    { a: 1, p: Number.POSITIVE_INFINITY },
    { a: 1, p: 1, n: 1 },
    { a: 1, p: 1, n: 2.5 },
    { a: 1e308, p: 1, n: 3 },
  ])("rejects unrepresentable model inputs: %j", (input) =>
    Effect.gen(function* () {
      expect(yield* resolveExponential(input).pipe(Effect.flip)).toBeInstanceOf(
        ExponentialError
      );
    })
  );
});
