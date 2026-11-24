// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  fillOf,
  isSpilling,
  levelOf,
  lipOf,
  originFor,
  POUR_TILT,
  turnX,
  VESSELS,
} from "@repo/design-system/components/contents/biology/waste/pour";
import type { Point } from "@repo/design-system/components/contents/biology/waste/station";

const SALT = VESSELS.salt;

/** Expects two points to agree to the micrometre. */
function expectNear(actual: Point, expected: Point) {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
  expect(actual[2]).toBeCloseTo(expected[2], 6);
}

describe("pouring from a beaker", () => {
  it("fills a 100 mL beaker with 60 mL to about 34 mm", () => {
    expect(fillOf(SALT)).toBeCloseTo(0.0337, 4);
  });

  it("turns a point about the x axis", () => {
    expectNear(turnX([0, 1, 0], Math.PI / 2), [0, 0, 1]);
    expectNear(turnX([2, 0, 1], -Math.PI / 2), [2, 1, 0]);
  });

  it("finds the lip at the back of the rim, and stands the beaker so its lip meets a spout", () => {
    expectNear(lipOf(SALT, [1, 2, 3], 0), [1, 2.07, 3 - 0.0238]);
    const spout: Point = [0.1, 0.2, -0.3];
    expectNear(
      lipOf(SALT, originFor(SALT, spout, -POUR_TILT), -POUR_TILT),
      spout
    );
  });

  it("keeps the surface at the upright depth until it reaches the lip", () => {
    expect(levelOf(SALT, [0, 0.5, 0], 0)).toBeCloseTo(0.5 + fillOf(SALT), 12);
    const tipped = levelOf(SALT, [0, 0.5, 0], -POUR_TILT);
    expect(tipped).toBeCloseTo(lipOf(SALT, [0, 0.5, 0], -POUR_TILT)[1], 12);
  });

  it("spills over the lip only once the beaker is tipped far enough", () => {
    expect(isSpilling(SALT, 0)).toBe(false);
    expect(isSpilling(SALT, -0.6)).toBe(false);
    expect(isSpilling(SALT, -POUR_TILT)).toBe(true);
    expect(isSpilling(VESSELS.solvent, -POUR_TILT)).toBe(true);
  });
});
