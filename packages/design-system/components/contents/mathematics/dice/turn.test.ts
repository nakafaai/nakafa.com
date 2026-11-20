// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type {
  Quaternion,
  Triple,
} from "@repo/design-system/components/contents/mathematics/dice/turn";
import {
  axisAngle,
  IDENTITY,
  inverse,
  multiply,
  rotate,
  slerp,
} from "@repo/design-system/components/contents/mathematics/dice/turn";
import { Array as Arr } from "effect";

/** Expects two vectors or quaternions to agree to 12 places. */
function expectClose(actual: readonly number[], expected: readonly number[]) {
  Arr.forEach(actual, (value, index) => {
    expect(value).toBeCloseTo(Arr.getUnsafe(expected, index), 12);
  });
}

describe("turns", () => {
  it("turns by the right-hand rule", () => {
    expectClose(
      rotate(axisAngle([1, 0, 0], -Math.PI / 2), [0, 0, 1]),
      [0, 1, 0]
    );
    expectClose(
      rotate(axisAngle([0, 0, 1], Math.PI / 2), [1, 0, 0]),
      [0, 1, 0]
    );
    expectClose(rotate(IDENTITY, [0.3, -0.2, 0.9]), [0.3, -0.2, 0.9]);
  });

  it("applies the right-hand turn of a product first", () => {
    const first = axisAngle([0, 1, 0], 0.7);
    const second = axisAngle([1, 0, 0], -1.1);
    const vector: Triple = [0.2, 0.5, -0.4];
    expectClose(
      rotate(multiply(second, first), vector),
      rotate(second, rotate(first, vector))
    );
  });

  it("undoes a turn with its inverse", () => {
    const turn = axisAngle([0, 0, 1], 2.1);
    expectClose(multiply(turn, inverse(turn)), IDENTITY);
  });

  it("blends turns along the shorter arc at a steady rate", () => {
    const quarter = axisAngle([0, 1, 0], Math.PI / 2);
    expectClose(slerp(IDENTITY, quarter, 0), IDENTITY);
    expectClose(slerp(IDENTITY, quarter, 1), quarter);
    expectClose(
      slerp(IDENTITY, quarter, 0.5),
      axisAngle([0, 1, 0], Math.PI / 4)
    );
    const flipped: Quaternion = [
      -quarter[0],
      -quarter[1],
      -quarter[2],
      -quarter[3],
    ];
    expectClose(
      rotate(slerp(IDENTITY, flipped, 0.5), [1, 0, 0]),
      rotate(axisAngle([0, 1, 0], Math.PI / 4), [1, 0, 0])
    );
    expect(slerp(quarter, quarter, 0.3)).toBe(quarter);
  });
});
