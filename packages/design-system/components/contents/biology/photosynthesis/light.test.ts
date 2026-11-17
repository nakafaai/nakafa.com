// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  bubbleInterval,
  bubbleRise,
  bubblesAt,
  farthestDistance,
  relativeIntensity,
} from "@repo/design-system/components/contents/biology/photosynthesis/light";

describe("light on Hydrilla", () => {
  it("falls with the square of the lamp distance", () => {
    expect(relativeIntensity(40, 40)).toBe(1);
    expect(relativeIntensity(20, 40)).toBe(4);
    expect(relativeIntensity(10, 40)).toBe(16);
  });

  it("finds the farthest lamp", () => {
    expect(
      farthestDistance([
        { bubbles: 18, distance: 20 },
        { bubbles: 5, distance: 40 },
        { bicarbonate: true, bubbles: 48, distance: 10 },
      ])
    ).toBe(40);
  });

  it("spaces the bubbles so a minute holds the reading", () => {
    expect(bubbleInterval(30)).toBe(2);
    expect(bubbleRise(1.5, 4)).toBe(6);
  });

  it("keeps only the bubbles still under the surface, newest first", () => {
    expect(bubblesAt(30, 5, 2, 7)).toEqual([2, 6]);
    expect(bubblesAt(60, 0, 1, 2.5)).toEqual([0, 1, 2]);
  });
});
