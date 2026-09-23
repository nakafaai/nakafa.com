// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  getVectorState,
  LOAD_MAX_X,
  LOAD_MIN_X,
  LOAD_STEP,
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

  it.effect(
    "balances the load and preserves the force scale at every slider position",
    () =>
      Effect.gen(function* () {
        const steps = Math.round((LOAD_MAX_X - LOAD_MIN_X) / LOAD_STEP);
        for (let step = 0; step <= steps; step += 1) {
          const loadX = LOAD_MIN_X + ((LOAD_MAX_X - LOAD_MIN_X) * step) / steps;
          const state = yield* getVectorState(loadX);
          let horizontalForce = 0;
          let verticalForce = 0;

          expect(state.loadPoint[0]).toBe(loadX);
          for (const cable of [state.left, state.right]) {
            expect(cable.tension).toBeGreaterThan(0);
            expect(cable.arrowEnd.every(Number.isFinite)).toBe(true);
            const dx = cable.anchor[0] - loadX;
            const dy = cable.anchor[1] - state.loadPoint[1];
            const length = Math.hypot(dx, dy);
            horizontalForce += (cable.tension * dx) / length;
            verticalForce += (cable.tension * dy) / length;
            expect(cable.arrowEnd[0] - loadX).toBeCloseTo(
              (cable.tension * dx) / length / 100,
              10
            );
            expect(cable.arrowEnd[1] - state.loadPoint[1]).toBeCloseTo(
              (cable.tension * dy) / length / 100,
              10
            );
          }
          expect(horizontalForce).toBeCloseTo(0, 10);
          expect(verticalForce).toBeCloseTo(120, 10);
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
