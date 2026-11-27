import { describe, expect, it } from "@effect/vitest";
import { extent } from "@repo/design-system/components/three/optic/extent";

describe("extent", () => {
  it("holds every place of a path with room round it", () => {
    expect(
      extent(
        [
          [-1, 0.2, 0.5],
          [2, 0.2, -1.5],
          [0.5, 0.4, 2],
        ],
        0.25
      )
    ).toEqual({
      x: { max: 2.25, min: -1.25 },
      y: { max: 0.65, min: -0.05 },
      z: { max: 2.25, min: -1.75 },
    });
  });

  it("is the pad round a single place", () => {
    expect(extent([[1, 2, 3]], 0.5)).toEqual({
      x: { max: 1.5, min: 0.5 },
      y: { max: 2.5, min: 1.5 },
      z: { max: 3.5, min: 2.5 },
    });
  });
});
