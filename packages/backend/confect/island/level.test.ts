import { describe, expect, it } from "@effect/vitest";
import { growthOf } from "@repo/backend/confect/island/level";
import { Option } from "effect";

describe("island/level", () => {
  it("grows the footprint at each level's lifetime Stars", () => {
    expect(growthOf(0)).toEqual({
      from: 0,
      level: 1,
      next: Option.some(150),
      size: 52,
    });
    expect(growthOf(149)).toEqual({
      from: 0,
      level: 1,
      next: Option.some(150),
      size: 52,
    });
    expect(growthOf(150)).toEqual({
      from: 150,
      level: 2,
      next: Option.some(400),
      size: 54,
    });
    expect(growthOf(3500)).toEqual({
      from: 3500,
      level: 6,
      next: Option.some(6000),
      size: 62,
    });
  });

  it("keeps the widest footprint past the last level, with no next level", () => {
    expect(growthOf(6000)).toEqual({
      from: 6000,
      level: 7,
      next: Option.none(),
      size: 64,
    });
    expect(growthOf(1_000_000)).toEqual({
      from: 6000,
      level: 7,
      next: Option.none(),
      size: 64,
    });
  });
});
