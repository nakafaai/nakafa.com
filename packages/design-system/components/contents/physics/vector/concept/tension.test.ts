// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  getVectorState,
  LOAD_MAX_X,
  LOAD_MIN_X,
} from "@repo/design-system/components/contents/physics/vector/concept/tension";
import { Effect, Schema } from "effect";

describe("cable tension projection", () => {
  it.effect("solves symmetric tension and projects both force arrows", () =>
    Effect.gen(function* () {
      const state = yield* getVectorState(0);

      expect(state.loadPoint).toEqual([0, 0.3, 0]);
      expect(state.left.tension).toBeCloseTo(state.right.tension, 10);
      expect(state.left.arrowEnd[0]).toBeLessThan(state.loadPoint[0]);
      expect(state.right.arrowEnd[0]).toBeGreaterThan(state.loadPoint[0]);
    })
  );

  it.effect("keeps asymmetric geometry finite across the slider range", () =>
    Effect.gen(function* () {
      for (const loadX of [LOAD_MIN_X, 0.7, LOAD_MAX_X]) {
        const state = yield* getVectorState(loadX);

        expect(state.loadPoint[0]).toBe(loadX);
        for (const cable of [state.left, state.right]) {
          expect(cable.tension).toBeGreaterThan(0);
          expect(cable.arrowEnd.every(Number.isFinite)).toBe(true);
        }
      }
    })
  );

  it.effect.each([LOAD_MIN_X - 0.1, LOAD_MAX_X + 0.1, Number.NaN])(
    "rejects a load position outside the authored slider bounds: %j",
    (loadX) =>
      Effect.gen(function* () {
        expect(
          Schema.isSchemaError(yield* Effect.flip(getVectorState(loadX)))
        ).toBe(true);
      })
  );
});
