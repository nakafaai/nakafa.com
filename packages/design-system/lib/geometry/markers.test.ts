import { describe, expect, it } from "@effect/vitest";
import {
  LineMarkerError,
  resolveLineMarkers,
} from "@repo/design-system/lib/geometry/markers";
import { Effect } from "effect";

const points = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 2, y: 4 },
];

describe("curve point markers", () => {
  it.effect("preserves authored sample identity and selection order", () =>
    Effect.gen(function* () {
      const selected = yield* resolveLineMarkers(points, [2, 0]);
      expect(selected).toEqual([points[2], points[0]]);
      expect(selected[0]).toBe(points[2]);
      expect(yield* resolveLineMarkers(points)).toBe(points);
    })
  );
  it.effect("supports an explicit empty selection and an empty path", () =>
    Effect.gen(function* () {
      expect(yield* resolveLineMarkers(points, [])).toEqual([]);
      expect(yield* resolveLineMarkers([], [])).toEqual([]);
    })
  );
  it.effect.each([[-1], [0.5], [Number.POSITIVE_INFINITY], [0, 0], [3]])(
    "rejects a non-sample marker index: %j",
    (indices) =>
      Effect.gen(function* () {
        expect(
          yield* Effect.flip(resolveLineMarkers(points, indices))
        ).toBeInstanceOf(LineMarkerError);
      })
  );
});
