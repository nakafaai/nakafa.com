import { describe, expect, it } from "@effect/vitest";
import { growthOf, MAX_SIZE } from "@repo/backend/confect/island/level";
import { Option } from "effect";

describe("island/level", () => {
  it("grows the island and its game footprint at each level's lifetime Stars", () => {
    expect(growthOf(0)).toEqual({
      level: 1,
      next: Option.some(150),
      size: 6,
      world: 16,
    });
    expect(growthOf(149)).toEqual({
      level: 1,
      next: Option.some(150),
      size: 6,
      world: 16,
    });
    expect(growthOf(150)).toEqual({
      level: 2,
      next: Option.some(400),
      size: 8,
      world: 24,
    });
    expect(growthOf(3500)).toEqual({
      level: 6,
      next: Option.some(6000),
      size: 20,
      world: 56,
    });
  });

  it("keeps the widest island past the last level, with no next level", () => {
    expect(growthOf(6000)).toEqual({
      level: 7,
      next: Option.none(),
      size: 24,
      world: 64,
    });
    expect(growthOf(1_000_000)).toEqual({
      level: 7,
      next: Option.none(),
      size: MAX_SIZE,
      world: 64,
    });
  });
});
