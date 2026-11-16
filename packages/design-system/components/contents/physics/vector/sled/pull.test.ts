import { describe, expect, it } from "@effect/vitest";
import {
  TowSchema,
  towParts,
} from "@repo/design-system/components/contents/physics/vector/sled/pull";
import { Schema } from "effect";

const tow = Schema.decodeSync(TowSchema)({
  distance: 10,
  force: 50,
  mass: 20,
});

describe("towParts", () => {
  it("pulls 50 N at 37° as about 40 N along and 30 N up", () => {
    const parts = towParts(tow, 37);
    expect(parts.along).toBeCloseTo(39.93, 2);
    expect(parts.up).toBeCloseTo(30.09, 2);
    expect(parts.work).toBeCloseTo(399.3, 1);
    expect(parts.normal).toBeCloseTo(196 - 30.09, 2);
  });

  it("does the most work with the rope level and none straight up", () => {
    expect(towParts(tow, 0).work).toBeCloseTo(500, 10);
    expect(towParts(tow, 90).work).toBeCloseTo(0, 10);
  });

  it("never pushes the snow with a negative normal force", () => {
    const light = Schema.decodeSync(TowSchema)({
      distance: 1,
      force: 500,
      mass: 1,
    });
    expect(towParts(light, 90).normal).toBe(0);
  });
});
