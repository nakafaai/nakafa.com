// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  activeAt,
  carryAt,
  checkedAt,
  stampAt,
  sweepEnd,
} from "@repo/design-system/components/contents/mathematics/counterexample/sweep";
import { Option } from "effect";

describe("the check of every case", () => {
  it("checks the tiles one after another and ends with the last", () => {
    expect(checkedAt(0, 0)).toBe(0);
    expect(checkedAt(sweepEnd(1), 0)).toBe(1);
    expect(checkedAt(sweepEnd(1), 1)).toBe(0);
    expect(checkedAt(sweepEnd(4), 3)).toBe(1);
    expect(sweepEnd(0)).toBe(sweepEnd(1));
    const half = checkedAt(sweepEnd(1) - 0.21, 0);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
  });

  it("names the tile being checked only while its check runs", () => {
    expect(activeAt(0, 3)).toEqual(Option.none());
    expect(activeAt(0.5, 3)).toEqual(Option.some(0));
    expect(activeAt(0.85, 3)).toEqual(Option.none());
    expect(activeAt(1.4, 3)).toEqual(Option.some(2));
    expect(activeAt(1.9, 3)).toEqual(Option.none());
  });

  it("brings the stamp down once the claim is settled", () => {
    const early = Option.some(1);
    expect(stampAt(sweepEnd(2), early, 6)).toBe(1);
    expect(stampAt(sweepEnd(2) - 0.01, early, 6)).toBe(0);
    expect(stampAt(sweepEnd(5), Option.none(), 6)).toBe(0);
    expect(stampAt(sweepEnd(6) + 1, Option.none(), 6)).toBe(1);
  });

  it("carries a tile in an arc from one spot to another", () => {
    const from = { x: 0, z: 0 };
    const to = { x: 0.2, z: -0.1 };
    expect(carryAt(from, to, 0)).toEqual({ x: 0, y: 0, z: 0 });
    const middle = carryAt(from, to, 0.5);
    expect(middle.x).toBeCloseTo(0.1);
    expect(middle.y).toBeCloseTo(0.05);
    expect(carryAt(from, to, 1).y).toBeCloseTo(0);
    expect(carryAt(from, from, 0.5)).toEqual({ x: 0, y: 0, z: 0 });
    expect(carryAt(from, { x: 0.04, z: 0 }, 0.5).y).toBeCloseTo(0.02);
  });
});
