import { describe, expect, it } from "@effect/vitest";
import {
  resolveVectorGeometry,
  VectorError,
} from "@repo/design-system/components/contents/mathematics/vector";
import { Effect } from "effect";

const points = [
  { x: 1, y: 4 },
  { x: 0, y: 0 },
];

describe("directed vector geometry", () => {
  it.effect(
    "preserves decreasing x order and labels the forward arrow tip",
    () =>
      Effect.gen(function* () {
        const vector = yield* resolveVectorGeometry({ points });
        expect(vector).toEqual({
          direction: "forward",
          points,
          tail: points[0],
          tip: points[1],
        });
      })
  );

  it.effect("reverses the tip without sorting or reversing the path", () =>
    Effect.gen(function* () {
      const vector = yield* resolveVectorGeometry({
        direction: "backward",
        points,
      });
      expect(vector.points).toEqual(points);
      expect(vector.tip).toEqual(points[0]);
      expect(vector.tail).toEqual(points[1]);
    })
  );

  it.effect("represents a zero vector with coincident tip and tail", () =>
    Effect.gen(function* () {
      const vector = yield* resolveVectorGeometry({
        direction: "none",
        points: [{ x: 0, y: 0 }],
      });
      expect(vector.tip).toEqual(vector.tail);
      expect(vector.direction).toBe("none");
    })
  );

  it.effect.each([
    { points: [] },
    { points: [{ x: Number.NaN, y: 0 }] },
    { points: [{ x: 0, y: Number.POSITIVE_INFINITY }] },
    { direction: "sideways", points },
  ])("rejects invalid vector geometry: %j", (input) =>
    Effect.gen(function* () {
      expect(yield* Effect.flip(resolveVectorGeometry(input))).toBeInstanceOf(
        VectorError
      );
    })
  );
});
