import { describe, expect, it } from "@effect/vitest";
import {
  BreezeSchema,
  breezeParts,
  quadrantOf,
} from "@repo/design-system/components/contents/physics/vector/wind/breeze";
import { Schema } from "effect";

const decode = Schema.decodeUnknownSync(BreezeSchema);

describe("breezeParts", () => {
  it("splits 10 m/s at 30° into 8.66 m/s east and 5 m/s north", () => {
    const parts = breezeParts(decode({ angle: 30, speed: 10 }));
    expect(parts.east).toBeCloseTo(8.660_254, 6);
    expect(parts.north).toBeCloseTo(5, 10);
    expect(parts.quadrant).toBe(1);
  });

  it("gives a wind toward 210° two negative components", () => {
    const parts = breezeParts(decode({ angle: 210, speed: 10 }));
    expect(parts.east).toBeCloseTo(-8.660_254, 6);
    expect(parts.north).toBeCloseTo(-5, 10);
    expect(parts.quadrant).toBe(3);
  });

  it("lies on an axis with an exact zero component at 90°", () => {
    const parts = breezeParts(decode({ angle: 90, speed: 4 }));
    expect(parts.east).toBe(0);
    expect(parts.quadrant).toBe(0);
  });
});

describe("quadrantOf", () => {
  it("names the second and fourth quadrants", () => {
    expect(quadrantOf(-1, 1)).toBe(2);
    expect(quadrantOf(1, -1)).toBe(4);
    expect(quadrantOf(1, 0)).toBe(0);
  });
});
