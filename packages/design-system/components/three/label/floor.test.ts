import { describe, expect, it } from "@effect/vitest";
import {
  LABEL_FLOOR,
  LABEL_WIDE_CANVAS,
  labelFloor,
  labelRange,
} from "@repo/design-system/components/three/label/floor";

describe("labelFloor", () => {
  it("draws 14 px on a phone and 15 px from a laptop-wide canvas", () => {
    expect(labelFloor(358)).toBe(LABEL_FLOOR.narrow);
    expect(labelFloor(LABEL_WIDE_CANVAS - 1)).toBe(14);
    expect(labelFloor(LABEL_WIDE_CANVAS)).toBe(15);
    expect(labelFloor(828)).toBe(LABEL_FLOOR.wide);
  });
});

describe("labelRange", () => {
  it("raises a least size under the floor to the floor", () => {
    expect(labelRange({ canvasWidth: 358, maximum: 22, minimum: 0 })).toEqual({
      high: 22,
      low: 14,
    });
    expect(labelRange({ canvasWidth: 828, maximum: 22, minimum: 14 })).toEqual({
      high: 22,
      low: 15,
    });
  });

  it("keeps a least size above the floor", () => {
    expect(labelRange({ canvasWidth: 358, maximum: 22, minimum: 16 })).toEqual({
      high: 22,
      low: 16,
    });
  });

  it("raises a largest size under the least size to the least size", () => {
    expect(labelRange({ canvasWidth: 828, maximum: 12, minimum: 10 })).toEqual({
      high: 15,
      low: 15,
    });
    expect(
      labelRange({
        canvasWidth: 358,
        maximum: Number.POSITIVE_INFINITY,
        minimum: 0,
      })
    ).toEqual({ high: Number.POSITIVE_INFINITY, low: 14 });
  });
});
