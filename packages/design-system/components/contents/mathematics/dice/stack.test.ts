// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  CHIP,
  chipPlacements,
  PITCH,
  RACK,
  rackWidth,
  STACK_Z,
  stackX,
} from "@repo/design-system/components/contents/mathematics/dice/stack";
import { Array as Arr } from "effect";

describe("the chip tally", () => {
  it("stands the stacks apart in the middle of a rack that holds them all", () => {
    expect(PITCH).toBeGreaterThan(2 * CHIP.radius);
    expect(stackX(0, 11)).toBeCloseTo(-stackX(10, 11), 12);
    expect(stackX(5, 11)).toBe(0);
    expect(rackWidth(6)).toBeCloseTo(0.224, 12);
    expect(rackWidth(11)).toBeCloseTo(0.345, 12);
    expect(rackWidth(11) / 2).toBeGreaterThan(stackX(10, 11) + CHIP.radius);
  });

  it("stacks one chip per roll, bottom up, close to its stack's middle", () => {
    const chips = chipPlacements([2, 0, 1]);
    expect(Arr.map(chips, (chip) => [chip.stack, chip.level])).toEqual([
      [0, 0],
      [0, 1],
      [2, 0],
    ]);
    const [bottom, top] = chips;
    expect(top?.position[1]).toBeCloseTo(
      (bottom?.position[1] ?? 0) + CHIP.thickness,
      12
    );
    expect(bottom?.position[1]).toBeCloseTo(
      RACK.height + CHIP.thickness / 2,
      12
    );
    Arr.forEach(chips, (chip) => {
      expect(Math.abs(chip.position[0] - stackX(chip.stack, 3))).toBeLessThan(
        0.001
      );
      expect(Math.abs(chip.position[2] - STACK_Z)).toBeLessThan(0.001);
      expect(chip.spin).toBeGreaterThanOrEqual(0);
    });
    expect(chipPlacements([0, 0])).toEqual([]);
  });
});
