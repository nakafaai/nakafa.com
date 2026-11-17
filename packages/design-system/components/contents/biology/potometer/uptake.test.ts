// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  boreArea,
  bubbleMark,
  bubbleTravel,
  SCALE_LENGTH,
  uptakeAfter,
} from "@repo/design-system/components/contents/biology/potometer/uptake";

describe("potometer", () => {
  it("reads the bore area in square centimetres from a radius in millimetres", () => {
    expect(boreArea(0.5)).toBeCloseTo(Math.PI * 0.0025, 12);
  });

  it("moves the bubble by the volume taken up over the bore area", () => {
    const rate = (Math.PI * 0.05 ** 2 * 4.5 * 60) / 5;

    expect(uptakeAfter(rate, 5)).toBeCloseTo(0.0353, 4);
    expect(bubbleTravel(rate, 0.5, 5)).toBeCloseTo(4.5, 12);
  });

  it("pushes the bubble back to the start once it runs off the scale", () => {
    expect(bubbleMark(12)).toBe(12);
    expect(bubbleMark(SCALE_LENGTH + 4)).toBe(4);
  });
});
