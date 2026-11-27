import { describe, expect, it } from "@effect/vitest";
import {
  clampTime,
  growthAt,
  growthRecord,
} from "@repo/design-system/components/contents/biology/metamorphosis/growth";

describe("clampTime and growthAt", () => {
  it("progresses grasshopper through egg, stepped nymph instars, and winged adult", () => {
    expect(clampTime(-0.5)).toBe(0);
    expect(clampTime(2)).toBe(1);
    expect(growthAt("grasshopper", 0.02).stage).toBe("egg");
    const early = growthAt("grasshopper", 0.15);
    const late = growthAt("grasshopper", 0.72);
    expect(early.stage).toBe("nymph");
    expect(late.lengthMm).toBeGreaterThan(early.lengthMm);
    expect(late.moults).toBeGreaterThan(early.moults);
    expect(growthAt("grasshopper", 0.95)).toMatchObject({
      moults: 5,
      stage: "adult",
    });
  });

  it("progresses butterfly through egg, larva, pupa, and adult", () => {
    expect(growthAt("butterfly", 0.02).stage).toBe("egg");
    expect(growthAt("butterfly", 0.4).stage).toBe("larva");
    expect(growthAt("butterfly", 0.8).stage).toBe("pupa");
    expect(growthAt("butterfly", 0.96).stage).toBe("adult");
  });
});

describe("growthRecord", () => {
  it("records length in steps and mass between them at every percent of the life cycle", () => {
    const record = growthRecord("grasshopper");
    expect(record).toHaveLength(101);
    expect(record[0]).toStrictEqual({ length: 5, mass: 8, x: 0 });
    expect(record[100]).toStrictEqual({ length: 42, mass: 928, x: 100 });
    expect(record[20]?.length).toBe(record[21]?.length);
    expect(record[21]?.mass).toBeGreaterThan(record[20]?.mass ?? 0);
    expect(growthRecord("butterfly")[100]?.length).toBe(32);
  });
});
